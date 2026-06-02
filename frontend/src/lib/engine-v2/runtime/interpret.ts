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
import { healBase, healUnit } from '../primitives/combat';
import { exhaust, ready } from '../primitives/state';
import { draw } from '../primitives/card_flow';
import { createToken } from '../primitives/tokens';
import { capture, rescue } from '../primitives/capture';
import { resolveSelector } from './selectors';
import { evalCardPredicate, resolvePlayer, type EvalCtx } from './predicates';
import { findCard, withPlayer, mapInstance, getZoneArr, withZoneArr } from '../state/zones';
import { defaultChooser } from './chooser';
import { dealDamageToBase, dealDamageToUnit } from './damage';
import { effectivePower } from './modifiers';
import { shuffleDeterministic } from '../util/rng';

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
    case 'give_experience': return applyGiveExperience(ctx, effect);
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

    case 'if_did': {
      // "<do>. If you do, <then>. [If you do not, <else_>.]" Resolve `do`; run
      // `then` if `do` actually happened, else run `else_`. "Happened" is proxied
      // by "emitted at least one event" — a declined optional or a no-legal-target
      // effect emits nothing → the `else_` branch (if any) fires instead.
      const first = applyEffect(ctx, effect.do);
      const branch = first.events.length > 0 ? effect.then : effect.else_;
      if (!branch) return first;
      const second = applyEffect({ ...ctx, state: first.state }, branch);
      return { state: second.state, events: [...first.events, ...second.events] };
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

    case 'move':             return applyMove(ctx, effect);
    case 'look_at':          return applyLookAt(ctx, effect);
    case 'disclose':         return applyDisclose(ctx, effect);
    case 'search':           return applySearch(ctx, effect);
    case 'divided_damage':   return applyDividedDamage(ctx, effect);
    case 'return_to_hand':   return applyReturnToHand(ctx, effect);
    case 'return_from_discard': return applyReturnFromDiscard(ctx, effect);
    case 'take_control':     return applyTakeControl(ctx, effect);
    case 'use_force':        return applyUseForce(ctx, effect);
    case 'gain_force':       return applyGainForce(ctx, effect);
    case 'power_damage_from_each': return applyPowerDamageFromEach(ctx, effect);
  }
}

function applyPowerDamageFromEach(ctx: InterpCtx, e: Extract<Effect, { effect: 'power_damage_from_each' }>): InterpResult {
  const targets = resolveSelector(ctx, e.target);
  const targetUnit = targets.find(t => t.kind === 'unit');
  if (!targetUnit || targetUnit.kind !== 'unit') return { state: ctx.state, events: [] };

  let sources = resolveSelector(ctx, e.sources).filter(t => t.kind === 'unit');
  if (e.sources_same_arena_as_target) {
    const tf = findCard(ctx.state, targetUnit.iid);
    const tArena = tf?.loc.zone;
    sources = sources.filter(t => {
      const f = findCard(ctx.state, t.iid);
      return f && f.loc.zone === tArena;
    });
  }

  let s = ctx.state;
  const events: GameEvent[] = [];
  for (const src of sources) {
    const f = findCard(s, src.iid);
    if (!f) continue; // source left play mid-resolution
    const pow = effectivePower(s, ctx.reg, f.inst, f.loc.controller);
    if (pow <= 0) continue;
    const r = applyDamageToTarget(s, ctx.reg, targetUnit, pow, false, false, false, src.iid, ctx.chooser);
    s = r.state;
    events.push(...r.events);
  }
  return { state: s, events };
}

function applyUseForce(ctx: InterpCtx, e: Extract<Effect, { effect: 'use_force' }>): InterpResult {
  // "Use the Force" spends the source controller's Force token (per-player; max
  // one). No token → can't use it → the `do` doesn't happen.
  const pid = ctx.sourcePlayer;
  const p = ctx.state.players[pid];
  if (!p || !p.forceToken) return { state: ctx.state, events: [] };
  const s = withPlayer(ctx.state, pid, { ...p, forceToken: false });
  const r = applyEffect({ ...ctx, state: s }, e.do);
  return { state: r.state, events: [{ kind: 'FORCE_USED', player: pid }, ...r.events] };
}

function applyGainForce(ctx: InterpCtx, e: Extract<Effect, { effect: 'gain_force' }>): InterpResult {
  // "The Force is with you" — gain a Force token (max one; idempotent if held).
  const pid = e.player ? resolvePlayerStrict(e.player, ctx) : ctx.sourcePlayer;
  const p = ctx.state.players[pid];
  if (!p || p.forceToken) return { state: ctx.state, events: [] };
  const s = withPlayer(ctx.state, pid, { ...p, forceToken: true });
  return { state: s, events: [{ kind: 'FORCE_TOKEN_CREATED', player: pid }] };
}

// ---------------------------------------------------------------------------
// Per-effect implementations
// ---------------------------------------------------------------------------

function applyDamage(ctx: InterpCtx, e: Extract<Effect, { effect: 'damage' }>): InterpResult {
  // "Deals damage equal to its power": snapshot the source unit's effective
  // power once, up front, so damage dealt mid-resolution can't change it.
  const amount = e.amountFromPower !== undefined
    ? powerFromSelector(ctx, e.amountFromPower)
    : (e.amount ?? 0);
  const targets = resolveSelector(ctx, e.target);
  let s = ctx.state;
  const events: GameEvent[] = [];
  for (const t of targets) {
    const r = applyDamageToTarget(s, ctx.reg, t, amount, !!e.combat, !!e.unpreventable, !!e.indirect, ctx.sourceIid, ctx.chooser);
    s = r.state;
    events.push(...r.events);
  }
  return { state: s, events };
}

/** Effective power of the first unit a selector resolves to (0 if none). Used
 *  for `amountFromPower` — e.g. `{ self: true }` for "deals damage equal to his
 *  power". */
function powerFromSelector(ctx: InterpCtx, sel: import('../spec/ast').Selector): number {
  const resolved = resolveSelector(ctx, sel);
  const unit = resolved.find(t => t.kind === 'unit');
  if (!unit || unit.kind !== 'unit') return 0;
  const f = findCard(ctx.state, unit.iid);
  if (!f) return 0;
  return effectivePower(ctx.state, ctx.reg, f.inst, f.loc.controller);
}

function applyDamageToTarget(
  state: GameState, reg: CardRegistry, target: ResolvedTarget,
  amount: number, combat: boolean, unpreventable: boolean, indirect: boolean,
  sourceIid: string | undefined,
  chooser?: import('./chooser').Chooser,
): InterpResult {
  if (target.kind === 'base') return dealDamageToBase(state, reg, target.controller, amount, { combat, unpreventable, indirect }, sourceIid, chooser);
  return dealDamageToUnit(state, reg, target.iid, amount, { combat, unpreventable, indirect }, sourceIid, chooser);
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

function applyGiveExperience(ctx: InterpCtx, e: Extract<Effect, { effect: 'give_experience' }>): InterpResult {
  const targets = resolveSelector(ctx, e.target);
  const n = e.count ?? 1;
  let s = ctx.state;
  const events: GameEvent[] = [];
  for (const t of targets) {
    if (t.kind !== 'unit') continue;
    s = mapInstance(s, t.iid, c => ({ ...c, experienceTokens: (c.experienceTokens ?? 0) + n }));
    events.push({ kind: 'EXPERIENCE_GAINED', iid: t.iid, amount: n });
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
  // count = how many distinct options to pick & resolve ("Choose two, in any
  // order:" → 2). The player's pick order IS the resolution order. Each pick is
  // removed from the pool so the same option can't be chosen twice.
  const count = Math.min(e.count ?? 1, e.options.length);
  const remaining = e.options.slice();
  let s = ctx.state;
  const events: GameEvent[] = [];
  for (let i = 0; i < count && remaining.length > 0; i++) {
    const result = chooser({
      kind: 'choose_one',
      prompt: e.prompt ?? (count > 1 ? `Choose ${count - i} more` : 'Choose one'),
      options: remaining.map(o => ({ label: o.label, value: o.value })),
      player: who,
      canPass: false,
    });
    if (result.kind === 'pass' || result.kind === 'no') break;
    const picked = result.kind === 'option'
      ? remaining.find(o => o.value === result.value)
      : remaining[0];
    if (!picked) break;
    const r = applyEffect({ ...ctx, state: s }, picked.do);
    s = r.state;
    events.push(...r.events);
    remaining.splice(remaining.indexOf(picked), 1);
  }
  return { state: s, events };
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

// ---------------------------------------------------------------------------
// Week 6 primitives: move, look_at, disclose, search
// ---------------------------------------------------------------------------

function applyMove(ctx: InterpCtx, e: Extract<Effect, { effect: 'move' }>): InterpResult {
  const targets = resolveSelector(ctx, e.target);
  let s = ctx.state;
  const events: GameEvent[] = [];
  for (const t of targets) {
    if (t.kind !== 'unit') continue;
    const f = findCard(s, t.iid);
    if (!f) continue;
    if (f.loc.zone !== 'ground_arena' && f.loc.zone !== 'space_arena') continue;
    let dest: 'ground_arena' | 'space_arena';
    if (e.to === 'other_arena') {
      dest = f.loc.zone === 'ground_arena' ? 'space_arena' : 'ground_arena';
    } else {
      dest = e.to;
    }
    if (dest === f.loc.zone) continue;
    // moveToZone is generic but emits a ZONE_CHANGED, not ARENA_MOVED. We
    // emit both so listeners watching either kind of event see this.
    // Re-implement the move inline to control event emission order and avoid
    // a redundant ZONE_CHANGED for arena→arena (which is more specifically an
    // ARENA_MOVED in the SWU rules).
    const fromZone = f.loc.zone;
    const fromP = s.players[t.controller];
    const fromArr = (fromZone === 'ground_arena' ? fromP.groundArena : fromP.spaceArena).slice();
    const idx = fromArr.findIndex(c => c.iid === t.iid);
    if (idx < 0) continue;
    const moved = { ...fromArr[idx], enteredZoneAt: s.step };
    fromArr.splice(idx, 1);
    let newP = fromZone === 'ground_arena' ? { ...fromP, groundArena: fromArr } : { ...fromP, spaceArena: fromArr };
    const toArr = (dest === 'ground_arena' ? newP.groundArena : newP.spaceArena).slice();
    toArr.push(moved);
    newP = dest === 'ground_arena' ? { ...newP, groundArena: toArr } : { ...newP, spaceArena: toArr };
    s = withPlayer(s, t.controller, newP);
    events.push({ kind: 'ARENA_MOVED', iid: t.iid, from: fromZone, to: dest });
  }
  return { state: s, events };
}

function applyTakeControl(ctx: InterpCtx, e: Extract<Effect, { effect: 'take_control' }>): InterpResult {
  // §8.28: the source player takes control of the target unit. Control is
  // positional here, so we physically move the instance to the new controller's
  // matching arena. It keeps ready/exhausted, damage, and upgrades. The original
  // controller is recorded as `owner` (if not already set) so the unit returns
  // to its owner's discard on defeat (§8.28.2). A Leader Unit can't change
  // control — it's defeated instead (§1.6).
  const targets = resolveSelector(ctx, e.target);
  const newController = ctx.sourcePlayer;
  let s = ctx.state;
  const events: GameEvent[] = [];
  for (const t of targets) {
    if (t.kind !== 'unit') continue;
    const f = findCard(s, t.iid);
    if (!f) continue;
    if (f.loc.zone !== 'ground_arena' && f.loc.zone !== 'space_arena') continue;
    const from = f.loc.controller;
    if (from === newController) continue; // already control it — no-op

    const ps0 = s.players[from];
    // Leader Unit changing control → defeated instead (§1.6). Bump to lethal and
    // let the state-based loop flip it back / route it correctly.
    if (ps0.leaders.some(l => l.isDeployed && l.unitIid === f.inst.iid)) {
      s = mapInstance(s, f.inst.iid, c => ({ ...c, damage: c.damage + 9999 }));
      continue;
    }

    // Remove from the original controller's arena.
    const fromArr = getZoneArr(ps0, f.loc.zone).slice();
    const idx = fromArr.findIndex(c => c.iid === f.inst.iid);
    if (idx < 0) continue;
    const moved = { ...fromArr[idx], owner: fromArr[idx].owner ?? from, enteredZoneAt: s.step };
    fromArr.splice(idx, 1);
    s = withPlayer(s, from, withZoneArr(ps0, f.loc.zone, fromArr));

    // Add to the new controller's MATCHING arena (ground stays ground, etc.).
    const ps1 = s.players[newController];
    const toArr = getZoneArr(ps1, f.loc.zone).slice();
    toArr.push(moved);
    s = withPlayer(s, newController, withZoneArr(ps1, f.loc.zone, toArr));
    events.push({ kind: 'CONTROL_CHANGED', iid: f.inst.iid, from, to: newController });
  }
  return { state: s, events };
}

function applyReturnToHand(ctx: InterpCtx, e: Extract<Effect, { effect: 'return_to_hand' }>): InterpResult {
  const targets = resolveSelector(ctx, e.target);
  let s = ctx.state;
  const events: GameEvent[] = [];
  for (const t of targets) {
    if (t.kind !== 'unit') continue;
    const f = findCard(s, t.iid);
    if (!f) continue;
    if (f.loc.zone !== 'ground_arena' && f.loc.zone !== 'space_arena') continue;
    const ctrl = f.loc.controller;
    const ps0 = s.players[ctrl];
    // Leader units don't return to hand — they have their own flip-back rules.
    if (ps0.leaders.some(l => l.isDeployed && l.unitIid === f.inst.iid)) continue;

    // Remove from its arena.
    const fromArr = getZoneArr(ps0, f.loc.zone).slice();
    const idx = fromArr.findIndex(c => c.iid === f.inst.iid);
    if (idx < 0) continue;
    fromArr.splice(idx, 1);
    let ps = withZoneArr(ps0, f.loc.zone, fromArr);

    // Attached upgrades can't go to hand — discard them, cleared of state.
    const newDiscard = ps.discard.slice();
    for (const up of f.inst.upgrades) {
      newDiscard.push({ ...up, damage: 0, exhausted: false, shieldTokens: 0, experienceTokens: 0, upgrades: [] });
      events.push({ kind: 'UPGRADE_DETACHED', upgradeIid: up.iid, hostIid: f.inst.iid });
    }

    // The unit returns to its owner's hand as a fresh card (owner = controller
    // until a control-transfer mechanic introduces a distinct owner).
    const fresh: typeof f.inst = {
      ...f.inst, damage: 0, exhausted: false, shieldTokens: 0, experienceTokens: 0,
      upgrades: [], capturedByIid: undefined, enteredZoneAt: s.step,
    };
    ps = { ...ps, hand: [...ps.hand, fresh], discard: newDiscard };
    s = withPlayer(s, ctrl, ps);
    events.push({ kind: 'ZONE_CHANGED', iid: f.inst.iid, from: f.loc.zone, to: 'hand' });
  }
  return { state: s, events };
}

function applyReturnFromDiscard(ctx: InterpCtx, e: Extract<Effect, { effect: 'return_from_discard' }>): InterpResult {
  const pid = resolvePlayerStrict(e.player, ctx);
  const ps = ctx.state.players[pid];
  if (!ps || ps.discard.length === 0) return { state: ctx.state, events: [] };
  const candidates = ps.discard.filter(c => evalCardPredicate(e.filter, ctx, c, pid, 'discard'));
  if (candidates.length === 0) return { state: ctx.state, events: [] };

  const n = Math.min(e.count ?? 1, candidates.length);
  const chooser = ctx.chooser ?? defaultChooser;
  // Pick n distinct cards, one prompt each (mirrors applySearch / applyDisclose).
  const picked: typeof candidates = [];
  let remaining = candidates.slice();
  for (let i = 0; i < n && remaining.length > 0; i++) {
    const result = chooser({
      kind: 'choose_one',
      prompt: `Return a card from your discard pile to your hand${n > 1 ? ` (${n - i} left)` : ''}`,
      options: remaining.map(c => ({ label: ctx.reg.cards[c.cardId]?.name ?? c.iid, value: c.iid })),
      player: pid,
      canPass: false,
    });
    const pick = result.kind === 'option' ? remaining.find(c => c.iid === result.value) : remaining[0];
    if (!pick) break;
    picked.push(pick);
    remaining = remaining.filter(c => c.iid !== pick.iid);
  }
  if (picked.length === 0) return { state: ctx.state, events: [] };

  // Move the picked cards discard → hand as fresh cards (a card in hand carries
  // no in-play state — reset damage/exhaust/shields/Experience/upgrades).
  const pickedIids = new Set(picked.map(c => c.iid));
  const newDiscard = ps.discard.filter(c => !pickedIids.has(c.iid));
  const fresh = picked.map(c => ({
    ...c, damage: 0, exhausted: false, shieldTokens: 0, experienceTokens: 0,
    upgrades: [], capturedByIid: undefined, enteredZoneAt: ctx.state.step,
  }));
  const newPs = { ...ps, discard: newDiscard, hand: [...ps.hand, ...fresh] };
  const events: GameEvent[] = fresh.map(c => ({ kind: 'ZONE_CHANGED', iid: c.iid, from: 'discard' as const, to: 'hand' as const }));
  return { state: withPlayer(ctx.state, pid, newPs), events };
}

function applyLookAt(ctx: InterpCtx, e: Extract<Effect, { effect: 'look_at' }>): InterpResult {
  const target = resolvePlayerStrict(e.player, ctx);
  const ps = ctx.state.players[target];
  if (!ps) return { state: ctx.state, events: [] };
  const cards = e.source === 'deck_top'
    ? ps.deck.slice(0, e.count ?? 1)
    : ps.hand.slice();
  const events: GameEvent[] = cards.map(c => ({
    kind: 'CARD_REVEALED',
    player: target,
    iid: c.iid,
  }));
  return { state: ctx.state, events };
}

function applyDisclose(ctx: InterpCtx, e: Extract<Effect, { effect: 'disclose' }>): InterpResult {
  const pid = resolvePlayerStrict(e.player, ctx);
  const ps = ctx.state.players[pid];
  if (!ps) return { state: ctx.state, events: [] };
  const candidates = ps.hand.filter(c => evalCardPredicate(e.filter, ctx, c, pid, 'hand'));
  if (candidates.length === 0) return { state: ctx.state, events: [] };

  const chooser = ctx.chooser ?? defaultChooser;
  const result = chooser({
    kind: 'choose_one',
    prompt: `Disclose a card${e.count && e.count > 1 ? ` (${e.count}×)` : ''}`,
    options: candidates.map(c => ({
      label: ctx.reg.cards[c.cardId]?.name ?? c.iid,
      value: c.iid,
    })),
    player: pid,
    canPass: false,
  });
  if (result.kind !== 'option') return { state: ctx.state, events: [] };

  const picked = candidates.find(c => c.iid === result.value);
  if (!picked) return { state: ctx.state, events: [] };
  const spec = ctx.reg.cards[picked.cardId];
  const aspects = spec && 'aspects' in spec ? (spec.aspects ?? []) : [];
  return {
    state: ctx.state,
    events: [{
      kind: 'CARD_DISCLOSED',
      player: pid,
      iids: [picked.iid],
      aspects,
    }],
  };
}

function applyDividedDamage(ctx: InterpCtx, e: Extract<Effect, { effect: 'divided_damage' }>): InterpResult {
  const candidates = resolveSelector(ctx, e.pool).filter(t => t.kind === 'unit');
  if (candidates.length === 0 || e.amount <= 0) return { state: ctx.state, events: [] };
  const indirect = e.indirect ?? true;
  const chooser = ctx.chooser ?? defaultChooser;

  let s = ctx.state;
  const events: GameEvent[] = [];
  let remaining = e.amount;

  // Per point: chooser picks a target from the surviving pool. Targets that
  // leave play (defeated mid-distribution) are filtered out before the next
  // pick. The default chooser dumps every point on the leftmost candidate —
  // deterministic behavior that matches the rest of the suite.
  while (remaining > 0) {
    const survivors = candidates.filter(t => t.kind === 'unit' && findCard(s, t.iid));
    if (survivors.length === 0) break;
    const result = chooser({
      kind: 'choose_one',
      prompt: `Divided damage: distribute 1 of ${remaining} remaining`,
      options: survivors.map(t => {
        const f = findCard(s, (t as { iid: string }).iid);
        const spec = f && ctx.reg.cards[f.inst.cardId];
        return { label: spec?.name ?? (t as { iid: string }).iid, value: (t as { iid: string }).iid };
      }),
      player: ctx.sourcePlayer,
      canPass: false,
    });
    const pickedIid = result.kind === 'option'
      ? result.value
      : (survivors[0] as { iid: string }).iid;
    const r = dealDamageToUnit(s, ctx.reg, pickedIid, 1, { combat: false, indirect }, ctx.sourceIid, chooser);
    s = r.state;
    events.push(...r.events);
    remaining -= 1;
  }
  return { state: s, events };
}

function applySearch(ctx: InterpCtx, e: Extract<Effect, { effect: 'search' }>): InterpResult {
  const pid = resolvePlayerStrict(e.player, ctx);
  const ps = ctx.state.players[pid];
  if (!ps || ps.deck.length === 0) return { state: ctx.state, events: [] };

  const top = ps.deck.slice(0, e.count);
  const rest = ps.deck.slice(e.count);
  const matches = top.filter(c => evalCardPredicate(e.filter, ctx, c, pid, 'deck'));

  // Per §v7 8.36 the deck is shuffled after a search regardless of whether a
  // card is taken. The shuffle is deterministic (seeded by state.step) so
  // replay under the async step model produces the same outcome.
  const shuffleSeed = ctx.state.step;

  if (matches.length === 0) {
    // No match → shuffle the deck (top + rest) and return.
    const newDeck = shuffleDeterministic([...top, ...rest], shuffleSeed);
    return {
      state: withPlayer(ctx.state, pid, { ...ps, deck: newDeck }),
      events: [],
    };
  }

  const chooser = ctx.chooser ?? defaultChooser;
  const result = chooser({
    kind: 'choose_one',
    prompt: `Search top ${e.count}: pick a card`,
    options: matches.map(c => ({
      label: ctx.reg.cards[c.cardId]?.name ?? c.iid,
      value: c.iid,
    })),
    player: pid,
    canPass: true,
  });
  if (result.kind === 'pass' || result.kind === 'no') {
    // Declined → still shuffle per §v7 8.36.
    const newDeck = shuffleDeterministic([...top, ...rest], shuffleSeed);
    return {
      state: withPlayer(ctx.state, pid, { ...ps, deck: newDeck }),
      events: [],
    };
  }
  const pickedIid = result.kind === 'option' ? result.value : matches[0].iid;
  const picked = top.find(c => c.iid === pickedIid);
  if (!picked) return { state: ctx.state, events: [] };

  const remainingTop = top.filter(c => c.iid !== pickedIid);
  // Shuffle the leftover top + rest back into the deck.
  const newDeck = shuffleDeterministic([...remainingTop, ...rest], shuffleSeed);
  const newPs = e.to === 'hand'
    ? { ...ps, hand: [...ps.hand, picked], deck: newDeck }
    : { ...ps, discard: [...ps.discard, picked], deck: newDeck };

  const events: GameEvent[] = [];
  if (e.reveal !== false) events.push({ kind: 'CARD_REVEALED', player: pid, iid: picked.iid });
  events.push({ kind: 'ZONE_CHANGED', iid: picked.iid, from: 'deck', to: e.to });
  return { state: withPlayer(ctx.state, pid, newPs), events };
}
