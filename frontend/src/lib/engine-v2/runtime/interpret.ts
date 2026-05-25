// Effect interpreter. Takes an Effect AST + InterpContext, dispatches to the
// corresponding L2 primitive, returns next state + emitted events.
//
// This is the ONE function callers should use to "resolve an ability." The
// reducer hands When-Played / On-Attack / etc. effects in here; the trigger
// drain hands triggered abilities' effects in here; future action abilities
// will route through here too.

import type { GameEvent } from '../state/bus';
import type { CardRegistry, GameState, PlayerId } from '../state/types';
import type { LastingEffectRec } from '../state/effects';
import type { Effect, Modifier, PlayerRef, ResolvedTarget } from '../spec/ast';
import { damageBase, damageUnit, healBase, healUnit } from '../primitives/combat';
import { exhaust, ready } from '../primitives/state';
import { draw } from '../primitives/card_flow';
import { createToken } from '../primitives/tokens';
import { capture, rescue } from '../primitives/capture';
import { resolveSelector } from './selectors';
import { evalCardPredicate, resolvePlayer, type EvalCtx } from './predicates';
import { findCard, withPlayer, mapInstance } from '../state/zones';
import { defaultChooser } from './chooser';

export interface InterpCtx extends EvalCtx {}

export interface InterpResult {
  state: GameState;
  events: GameEvent[];
}

export function applyEffect(ctx: InterpCtx, effect: Effect): InterpResult {
  switch (effect.effect) {
    case 'noop': return { state: ctx.state, events: [] };

    case 'damage':       return applyDamage(ctx, effect);
    case 'heal':         return applyHeal(ctx, effect);
    case 'defeat':       return applyDefeat(ctx, effect);
    case 'give_shield':  return applyGiveShield(ctx, effect);
    case 'draw':         return applyDraw(ctx, effect);
    case 'discard':      return applyDiscard(ctx, effect);
    case 'exhaust':      return applyExhaustEffect(ctx, effect);
    case 'ready':        return applyReadyEffect(ctx, effect);
    case 'give':         return applyGive(ctx, effect);

    case 'sequence': {
      let s = ctx.state;
      const events: GameEvent[] = [];
      for (const step of effect.steps) {
        const r = applyEffect({ ...ctx, state: s }, step);
        s = r.state;
        events.push(...r.events);
      }
      return { state: s, events };
    }

    case 'if': {
      // `if` is evaluated against the source card (or a target, but Week 2
      // only exercises source-conditioned ifs). Source-card lookup via
      // sourceIid; if no source (engine-level effects), treats as true.
      let cond = true;
      if (ctx.sourceIid) {
        const found = findCard(ctx.state, ctx.sourceIid);
        if (found) cond = evalCardPredicate(effect.condition, ctx, found.inst, found.loc.controller);
      }
      const next = cond ? effect.then : effect.else;
      if (!next) return { state: ctx.state, events: [] };
      return applyEffect(ctx, next);
    }

    case 'choose_one':       return applyChooseOne(ctx, effect);
    case 'optional':         return applyOptional(ctx, effect);
    case 'create_token':     return applyCreateToken(ctx, effect);
    case 'capture':          return applyCapture(ctx, effect);
    case 'rescue':           return applyRescue(ctx, effect);
  }
}

// ---------------------------------------------------------------------------
// Per-effect implementations
// ---------------------------------------------------------------------------

function applyDamage(ctx: InterpCtx, e: Extract<Effect, { effect: 'damage' }>): InterpResult {
  const targets = resolveSelector(ctx, e.target);
  let s = ctx.state;
  const events: GameEvent[] = [];
  for (const t of targets) {
    const r = applyDamageToTarget(s, ctx.reg, t, e.amount, !!e.combat, !!e.unpreventable, ctx.sourceIid);
    s = r.state;
    events.push(...r.events);
  }
  return { state: s, events };
}

function applyDamageToTarget(
  state: GameState, reg: CardRegistry, target: ResolvedTarget,
  amount: number, combat: boolean, unpreventable: boolean,
  sourceIid: string | undefined,
): InterpResult {
  if (target.kind === 'base') return damageBase(state, reg, target.controller, amount, { combat }, sourceIid);
  return damageUnit(state, reg, target.iid, amount, { combat, unpreventable }, sourceIid);
}

function applyHeal(ctx: InterpCtx, e: Extract<Effect, { effect: 'heal' }>): InterpResult {
  const targets = resolveSelector(ctx, e.target);
  let s = ctx.state;
  const events: GameEvent[] = [];
  for (const t of targets) {
    const r = t.kind === 'base'
      ? healBase(s, t.controller, e.amount, ctx.reg)
      : healUnit(s, t.iid, e.amount);
    s = r.state;
    events.push(...r.events);
  }
  return { state: s, events };
}

function applyDefeat(ctx: InterpCtx, e: Extract<Effect, { effect: 'defeat' }>): InterpResult {
  const targets = resolveSelector(ctx, e.target);
  let s = ctx.state;
  const events: GameEvent[] = [];
  for (const t of targets) {
    if (t.kind !== 'unit') continue; // bases aren't defeated by primitive 'defeat'
    // Bump damage to ≥ hp so the state-based loop handles the defeat + emits
    // the proper DEFEATED event with lastKnown snapshot. Keeps defeat-side-
    // effects (When Defeated triggers, capture-zone release, etc.) on one path.
    s = mapInstance(s, t.iid, c => ({ ...c, damage: c.damage + 9999 }));
  }
  return { state: s, events };
}

function applyGiveShield(ctx: InterpCtx, e: Extract<Effect, { effect: 'give_shield' }>): InterpResult {
  const targets = resolveSelector(ctx, e.target);
  const n = e.count ?? 1;
  let s = ctx.state;
  const events: GameEvent[] = [];
  for (const t of targets) {
    if (t.kind !== 'unit') continue;
    s = mapInstance(s, t.iid, c => ({ ...c, shieldTokens: c.shieldTokens + n }));
    for (let i = 0; i < n; i++) events.push({ kind: 'SHIELD_GAINED', iid: t.iid });
  }
  return { state: s, events };
}

function applyDraw(ctx: InterpCtx, e: Extract<Effect, { effect: 'draw' }>): InterpResult {
  const player = resolvePlayerStrict(e.player, ctx);
  return draw(ctx.state, ctx.reg, player, e.count);
}

function applyDiscard(ctx: InterpCtx, e: Extract<Effect, { effect: 'discard' }>): InterpResult {
  // Week 2 simplification: discard the leftmost N cards from the player's
  // hand without prompting for choice. Interactive choice ships with the
  // choose-target / pending-choice infrastructure.
  const player = resolvePlayerStrict(e.player, ctx);
  const p = ctx.state.players[player];
  if (!p) return { state: ctx.state, events: [] };
  const toDiscard = p.hand.slice(0, e.count);
  const remaining = p.hand.slice(e.count);
  const newP = { ...p, hand: remaining, discard: [...p.discard, ...toDiscard] };
  const events: GameEvent[] = toDiscard.map(c => ({ kind: 'CARD_DISCARDED', player, iid: c.iid, from: 'hand' as const }));
  return { state: withPlayer(ctx.state, player, newP), events };
}

function applyExhaustEffect(ctx: InterpCtx, e: Extract<Effect, { effect: 'exhaust' }>): InterpResult {
  const targets = resolveSelector(ctx, e.target);
  let s = ctx.state;
  const events: GameEvent[] = [];
  for (const t of targets) {
    if (t.kind !== 'unit') continue;
    const r = exhaust(s, t.iid);
    s = r.state;
    events.push(...r.events);
  }
  return { state: s, events };
}

function applyReadyEffect(ctx: InterpCtx, e: Extract<Effect, { effect: 'ready' }>): InterpResult {
  const targets = resolveSelector(ctx, e.target);
  let s = ctx.state;
  const events: GameEvent[] = [];
  for (const t of targets) {
    if (t.kind !== 'unit') continue;
    const r = ready(s, t.iid);
    s = r.state;
    events.push(...r.events);
  }
  return { state: s, events };
}

function applyGive(ctx: InterpCtx, e: Extract<Effect, { effect: 'give' }>): InterpResult {
  const targets = resolveSelector(ctx, e.target);
  if (targets.length === 0) return { state: ctx.state, events: [] };
  const iids: string[] = [];
  const players: PlayerId[] = [];
  for (const t of targets) {
    if (t.kind === 'unit') iids.push(t.iid);
    else players.push(t.controller);
  }
  const m: Modifier = e.modifier;
  const duration = m.duration ?? 'permanent';

  // permanent modifiers on in-play targets are stored as lasting effects
  // with expiry='permanent'. (For "while_source_in_play", a future pass
  // hooks expiry to source-leaves-play; not exercised by Week 2 demo.)
  const rec: LastingEffectRec = {
    id: `le_${ctx.state.step}_${ctx.state.lastingEffects.length}`,
    modifier: m,
    targets: iids.length > 0 ? { kind: 'units', iids } : { kind: 'bases', players },
    expiry: durationToExpiry(duration),
    sourceIid: ctx.sourceIid,
  };
  const next: GameState = { ...ctx.state, lastingEffects: [...ctx.state.lastingEffects, rec] };
  return { state: next, events: [] };
}

function durationToExpiry(d: import('../spec/ast').Duration): LastingEffectRec['expiry'] {
  return d;
}

function resolvePlayerStrict(ref: PlayerRef, ctx: InterpCtx): PlayerId {
  const r = resolvePlayer(ref, ctx);
  if (r === 'any') return ctx.sourcePlayer;
  return r;
}

// ---------------------------------------------------------------------------
// Choice & Category C primitives
// ---------------------------------------------------------------------------

function applyChooseOne(ctx: InterpCtx, e: Extract<Effect, { effect: 'choose_one' }>): InterpResult {
  if (e.options.length === 0) return { state: ctx.state, events: [] };
  const chooser = ctx.chooser ?? defaultChooser;
  const who = e.chooser ? resolvePlayerStrict(e.chooser, ctx) : ctx.sourcePlayer;
  const result = chooser({
    kind: 'choose_one',
    prompt: e.prompt ?? 'Choose one',
    options: e.options.map(o => ({ label: o.label, value: o.value })),
    player: who,
    canPass: false,
  });
  if (result.kind === 'pass' || result.kind === 'no') return { state: ctx.state, events: [] };
  const picked = result.kind === 'option'
    ? e.options.find(o => o.value === result.value)
    : e.options[0];
  if (!picked) return { state: ctx.state, events: [] };
  return applyEffect(ctx, picked.do);
}

function applyOptional(ctx: InterpCtx, e: Extract<Effect, { effect: 'optional' }>): InterpResult {
  const chooser = ctx.chooser ?? defaultChooser;
  const who = e.chooser ? resolvePlayerStrict(e.chooser, ctx) : ctx.sourcePlayer;
  const result = chooser({
    kind: 'optional',
    prompt: e.prompt ?? 'You may resolve this ability',
    player: who,
  });
  if (result.kind === 'no' || result.kind === 'pass') return { state: ctx.state, events: [] };
  return applyEffect(ctx, e.do);
}

function applyCreateToken(ctx: InterpCtx, e: Extract<Effect, { effect: 'create_token' }>): InterpResult {
  const controller = resolvePlayerStrict(e.controller, ctx);
  return createToken(ctx.state, ctx.reg, e.token_id, controller, e.zone, e.count ?? 1);
}

function applyCapture(ctx: InterpCtx, e: Extract<Effect, { effect: 'capture' }>): InterpResult {
  const targets = resolveSelector(ctx, e.target);
  const captors = resolveSelector(ctx, e.captor);
  if (targets.length === 0 || captors.length === 0) return { state: ctx.state, events: [] };
  // First captor captures first target. Multi-capture cards are rare; if a
  // future card needs it, this is the place to extend.
  const captor = captors[0];
  let s = ctx.state;
  const events: import('../state/bus').GameEvent[] = [];
  for (const t of targets) {
    if (t.kind !== 'unit' || captor.kind !== 'unit') continue;
    const r = capture(s, ctx.reg, t.iid, captor.iid);
    s = r.state;
    events.push(...r.events);
  }
  return { state: s, events };
}

function applyRescue(ctx: InterpCtx, e: Extract<Effect, { effect: 'rescue' }>): InterpResult {
  // Selectors over captured cards aren't fully expressible in the Week 3 AST
  // — the spec format covers in-play cards but capture zone needs its own
  // selector form. For now, rescue picks the first captive of the sourcePlayer.
  // Cards that need finer rescue targeting (e.g. "rescue any captive") will
  // land when we add a capture_zone-aware selector form.
  void e;
  const p = ctx.state.players[ctx.sourcePlayer];
  if (p.capturedByMe.length === 0) return { state: ctx.state, events: [] };
  return rescue(ctx.state, p.capturedByMe[0].iid);
}
