// Effect interpreter. Takes an Effect AST + InterpContext, dispatches to the
// corresponding L2 primitive, returns next state + emitted events.
//
// This is the ONE function callers should use to "resolve an ability." The
// reducer hands When-Played / On-Attack / etc. effects in here; the trigger
// drain hands triggered abilities' effects in here; future action abilities
// will route through here too.

import type { GameEvent } from '../state/bus';
import type { CardInstance, CardRegistry, GameState, PlayerId } from '../state/types';
import type { LastingEffectRec } from '../state/effects';
import type { Effect, Modifier, PlayerRef, ResolvedTarget } from '../spec/ast';
import { healBase, healUnit } from '../primitives/combat';
import { exhaust, ready } from '../primitives/state';
import { draw } from '../primitives/card_flow';
import { createToken } from '../primitives/tokens';
import { capture, rescue } from '../primitives/capture';
import { resolveSelector } from './selectors';
import { evalCardPredicate, resolvePlayer, type EvalCtx } from './predicates';
import { findCard, findUpgrade, withPlayer, mapInstance, getZoneArr, withZoneArr } from '../state/zones';
import { moveToZone } from '../primitives/move';
import { defaultChooser } from './chooser';
import { dealDamageToBase, dealDamageToUnit } from './damage';
import { effectivePower, effectiveHp } from './modifiers';
import { shuffleDeterministic } from '../util/rng';
import { resolveAttack, attackIllegalReason, resolveAmbush } from './attack';
import { effectiveCost } from './cost';
import { KEYWORDS } from '../primitives/keywords';

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
    case 'search_play':      return applySearchPlay(ctx, effect);
    case 'divided_damage':   return applyDividedDamage(ctx, effect);
    case 'indirect_damage':  return applyIndirectDamage(ctx, effect);
    case 'play_as_resource': return applyPlayAsResource(ctx, effect);
    case 'create_credit':    return applyCreateCredit(ctx, effect);
    case 'discount':         return applyDiscount(ctx, effect);
    case 'play_from_discard': return applyPlayFromDiscard(ctx, effect);
    case 'return_to_hand':   return applyReturnToHand(ctx, effect);
    case 'return_from_discard': return applyReturnFromDiscard(ctx, effect);
    case 'take_control':     return applyTakeControl(ctx, effect);
    case 'exchange_control': return applyExchangeControl(ctx, effect);
    case 'transfer_upgrade': return applyTransferUpgrade(ctx, effect);
    case 'name_card':        return applyNameCard(ctx, effect);
    case 'use_force':        return applyUseForce(ctx, effect);
    case 'gain_force':       return applyGainForce(ctx, effect);
    case 'attack':           return applyAttackEffect(ctx, effect);
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

function applyAttackEffect(ctx: InterpCtx, e: Extract<Effect, { effect: 'attack' }>): InterpResult {
  // Nested attack(s) from an ability (§7.6.12). `count` sequential attacks by the
  // resolved attacker; each picks a legal defender (enemy unit in the attacker's
  // arena, or the opponent's base) via the chooser. Skips an attack with no legal
  // target. A nested attack ignores the ready requirement (§ "unless otherwise
  // specified") — resolveAttack exhausts but doesn't gate on exhausted.
  const attackerSel = e.attacker ?? { self: true };
  const resolved = resolveSelector(ctx, attackerSel).find(t => t.kind === 'unit');
  if (!resolved || resolved.kind !== 'unit') return { state: ctx.state, events: [] };
  const attackerIid = resolved.iid;
  const pid = resolved.controller;
  const count = e.count ?? 1;
  const chooser = ctx.chooser ?? defaultChooser;

  let s = ctx.state;
  const events: GameEvent[] = [];

  // "It gets +N/+0 [and gains K] for this attack" — buff the chosen attacker via
  // a lasting effect, scoped to exactly this attack (added now, removed after the
  // attack loop so it doesn't leak to a later attack/phase). `attacker_buff_if`
  // (if present) gates the buff on the chosen attacker matching ("…if it's an
  // Imperial unit"); the attack still happens, just unbuffed.
  const af0 = findCard(s, attackerIid);
  const buffApplies = !!e.attacker_buff
    && (!e.attacker_buff_if || (!!af0 && evalCardPredicate(e.attacker_buff_if, ctx, af0.inst, pid, af0.loc.zone)));
  const buffId = buffApplies ? `le_atk_${s.step}_${s.lastingEffects.length}` : undefined;
  if (buffId) {
    const rec: LastingEffectRec = {
      id: buffId, modifier: e.attacker_buff!,
      targets: { kind: 'units', iids: [attackerIid] },
      expiry: 'end_of_phase', sourceIid: ctx.sourceIid,
    };
    s = { ...s, lastingEffects: [...s.lastingEffects, rec] };
  }
  for (let i = 0; i < count; i++) {
    const af = findCard(s, attackerIid);
    if (!af) break; // attacker left play (e.g. defeated by a previous attack's combat)
    const oppId = s.playerOrder.find(p => p !== pid);
    if (!oppId) break;
    const arena = af.loc.zone;
    if (arena !== 'ground_arena' && arena !== 'space_arena') break;

    // Eligible defenders: enemy units in the attacker's arena that the attack is
    // legal against (honors Sentinel via attackIllegalReason), plus the base.
    const enemyUnits = getZoneArr(s.players[oppId], arena)
      .filter(c => attackIllegalReason(s, pid, ctx.reg, attackerIid, c.iid) === null)
      .map(c => c.iid);
    const baseLegal = attackIllegalReason(s, pid, ctx.reg, attackerIid, 'base') === null;
    const options: Array<{ label: string; value: string }> = [
      ...enemyUnits.map(iid => ({ label: ctx.reg.cards[findCard(s, iid)!.inst.cardId]?.name ?? iid, value: iid })),
      ...(baseLegal ? [{ label: 'base', value: 'base' }] : []),
    ];
    if (options.length === 0) break; // no legal target → stop

    const result = chooser({ kind: 'choose_one', prompt: 'Choose what to attack', options, player: pid, canPass: false });
    const defenderIid: string = result.kind === 'option' ? result.value : options[0].value;

    // "The defender gets -N/-0 for this attack" — debuff the chosen defender (a
    // unit, not the base) via a lasting effect scoped to exactly this attack.
    const debuffId = (e.defender_debuff && defenderIid !== 'base') ? `le_def_${s.step}_${s.lastingEffects.length}` : undefined;
    if (debuffId) {
      s = { ...s, lastingEffects: [...s.lastingEffects, {
        id: debuffId, modifier: e.defender_debuff!,
        targets: { kind: 'units', iids: [defenderIid] },
        expiry: 'end_of_phase', sourceIid: ctx.sourceIid,
      }] };
    }

    const r = resolveAttack(s, pid, attackerIid, defenderIid, ctx.reg, chooser);
    s = r.state;
    if (debuffId) s = { ...s, lastingEffects: s.lastingEffects.filter(le => le.id !== debuffId) };
    events.push(...r.events);
  }
  // Remove the "for this attack" buff so it doesn't outlast the attack.
  if (buffId) s = { ...s, lastingEffects: s.lastingEffects.filter(le => le.id !== buffId) };
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
    // Surface ability damage in the game log (combat damage logs separately in
    // attack.ts). Without this, e.g. TIE Bomber's "deal 3 indirect to the
    // defending player" landed silently.
    if (amount > 0) {
      const where = t.kind === 'base'
        ? `${t.controller}'s base`
        : (ctx.reg.cards[findCard(s, t.iid)?.inst.cardId ?? '']?.name ?? t.iid);
      const tag = e.indirect ? ' indirect' : '';
      s = { ...s, log: [...s.log, { round: s.round, player: ctx.sourcePlayer, message: `Deals ${amount}${tag} damage to ${where}.`, kind: amount >= 5 ? 'critical' : 'info' }] };
    }
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
  const r = createToken(ctx.state, ctx.reg, e.token_id, controller, e.zone, e.count ?? 1);
  if (!e.grant) return r;
  // "…and give those tokens <modifier> for this phase." Grant the modifier to the
  // just-created tokens (by iid from the TOKEN_CREATED events) as one lasting
  // effect with the modifier's duration.
  const iids = r.events.filter(ev => ev.kind === 'TOKEN_CREATED').map(ev => (ev as { iid: string }).iid);
  if (iids.length === 0) return r;
  const rec: LastingEffectRec = {
    id: `le_${r.state.step}_${r.state.lastingEffects.length}`,
    modifier: e.grant,
    targets: { kind: 'units', iids },
    expiry: e.grant.duration ?? 'permanent',
    sourceIid: ctx.sourceIid,
  };
  return { state: { ...r.state, lastingEffects: [...r.state.lastingEffects, rec] }, events: r.events };
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

/** Move a single in-arena unit to `toController`'s control (§8.28). Control is
 *  positional — the instance physically moves to the new controller's matching
 *  arena, keeping ready/exhausted + damage + upgrades; the original controller is
 *  recorded as `owner` so it returns to the owner's discard on defeat (§8.28.2).
 *  A Leader Unit can't change control — it's defeated instead (§1.6): bump to
 *  lethal and let the state-based loop handle it. Shared by take_control and
 *  exchange_control. */
function transferUnitControl(s: GameState, iid: string, toController: PlayerId): { state: GameState; event?: GameEvent } {
  const f = findCard(s, iid);
  if (!f) return { state: s };
  if (f.loc.zone !== 'ground_arena' && f.loc.zone !== 'space_arena') return { state: s };
  const from = f.loc.controller;
  if (from === toController) return { state: s }; // already controls it — no-op
  const ps0 = s.players[from];
  if (ps0.leaders.some(l => l.isDeployed && l.unitIid === iid)) {
    return { state: mapInstance(s, iid, c => ({ ...c, damage: c.damage + 9999 })) };
  }
  const fromArr = getZoneArr(ps0, f.loc.zone).slice();
  const idx = fromArr.findIndex(c => c.iid === iid);
  if (idx < 0) return { state: s };
  const moved = { ...fromArr[idx], owner: fromArr[idx].owner ?? from, enteredZoneAt: s.step };
  fromArr.splice(idx, 1);
  let s2 = withPlayer(s, from, withZoneArr(ps0, f.loc.zone, fromArr));
  const ps1 = s2.players[toController];
  const toArr = getZoneArr(ps1, f.loc.zone).slice();
  toArr.push(moved);
  s2 = withPlayer(s2, toController, withZoneArr(ps1, f.loc.zone, toArr));
  return { state: s2, event: { kind: 'CONTROL_CHANGED', iid, from, to: toController } };
}

function applyTakeControl(ctx: InterpCtx, e: Extract<Effect, { effect: 'take_control' }>): InterpResult {
  // §8.28: the source player takes control of the target unit.
  const targets = resolveSelector(ctx, e.target);
  let s = ctx.state;
  const events: GameEvent[] = [];
  for (const t of targets) {
    if (t.kind !== 'unit') continue;
    const r = transferUnitControl(s, t.iid, ctx.sourcePlayer);
    s = r.state;
    if (r.event) events.push(r.event);
  }
  return { state: s, events };
}

function applyExchangeControl(ctx: InterpCtx, e: Extract<Effect, { effect: 'exchange_control' }>): InterpResult {
  // "Exchange control": the chosen friendly unit goes to the opponent, the chosen
  // enemy unit comes to the source player. Resolve both selectors against the
  // ORIGINAL state (so picking the enemy isn't affected by moving the friendly),
  // then apply the two transfers.
  const opp = ctx.state.playerOrder.find(p => p !== ctx.sourcePlayer) ?? ctx.sourcePlayer;
  const mine = resolveSelector(ctx, e.friendly).filter(t => t.kind === 'unit');
  const theirs = resolveSelector(ctx, e.enemy).filter(t => t.kind === 'unit');
  let s = ctx.state;
  const events: GameEvent[] = [];
  for (const t of mine) {
    const r = transferUnitControl(s, t.iid, opp);
    s = r.state; if (r.event) events.push(r.event);
  }
  for (const t of theirs) {
    const r = transferUnitControl(s, t.iid, ctx.sourcePlayer);
    s = r.state; if (r.event) events.push(r.event);
  }
  return { state: s, events };
}

function applyTransferUpgrade(ctx: InterpCtx, e: Extract<Effect, { effect: 'transfer_upgrade' }>): InterpResult {
  // "The attacking player takes control of this upgrade and attaches it to a unit
  // they control." (Death Star Plans.) The source is the upgrade; move it off its
  // current host onto a unit chosen by the attacking player of the triggering
  // attack. Control follows the host, so this transfers control.
  const upgradeIid = ctx.sourceIid;
  if (!upgradeIid) return { state: ctx.state, events: [] };
  const up = findUpgrade(ctx.state, upgradeIid);
  if (!up) return { state: ctx.state, events: [] };

  // New controller = the attacker of the triggering attack event.
  const ev = ctx.triggerEvent;
  if (!ev || (ev.kind !== 'ATTACK_DECLARED' && ev.kind !== 'ATTACK_ENDED')) {
    return { state: ctx.state, events: [] };
  }
  const attacker = findCard(ctx.state, ev.attackerIid);
  if (!attacker) return { state: ctx.state, events: [] };
  const newController = attacker.loc.controller;

  // Candidate hosts: any unit the new controller controls (either arena).
  const np = ctx.state.players[newController];
  const candidates = [...np.groundArena, ...np.spaceArena];
  if (candidates.length === 0) return { state: ctx.state, events: [] }; // nothing to attach to

  const chooser = ctx.chooser ?? defaultChooser;
  let newHostIid = candidates[0].iid;
  if (candidates.length > 1) {
    const options = candidates.map(c => ({ label: ctx.reg.cards[c.cardId]?.name ?? c.cardId, value: c.iid }));
    const pick = chooser({ kind: 'choose_one', prompt: 'Attach the upgrade to which unit?', options, player: newController, canPass: false });
    if (pick.kind === 'option') newHostIid = pick.value;
  }

  // Detach from the old host, recording the original controller as owner so the
  // upgrade returns to its owner's discard on defeat.
  const oldHostIid = up.loc.hostIid;
  const oldController = up.loc.controller;
  const movedUpgrade: CardInstance = {
    ...up.inst,
    owner: up.inst.owner ?? oldController,
    enteredZoneAt: ctx.state.step,
  };
  let s = mapInstance(ctx.state, oldHostIid, h => ({ ...h, upgrades: h.upgrades.filter(u => u.iid !== upgradeIid) }));
  // Attach to the new host.
  s = mapInstance(s, newHostIid, h => ({ ...h, upgrades: [...h.upgrades, movedUpgrade] }));

  return {
    state: s,
    events: [
      { kind: 'UPGRADE_DETACHED', upgradeIid, hostIid: oldHostIid },
      { kind: 'UPGRADE_ATTACHED', upgradeIid, hostIid: newHostIid },
    ],
  };
}

function applyNameCard(ctx: InterpCtx, _e: Extract<Effect, { effect: 'name_card' }>): InterpResult {
  // "Name a card." The source unit's controller names one of the cards an
  // opponent could play (distinct names across the opponent's hand/deck/discard).
  // The chosen NAME is recorded on the source unit; the play-restriction is
  // enforced elsewhere (legal.ts / reducer) while the unit is in play.
  if (!ctx.sourceIid) return { state: ctx.state, events: [] };
  const opp = ctx.state.playerOrder.find(p => p !== ctx.sourcePlayer);
  if (!opp) return { state: ctx.state, events: [] };
  const op = ctx.state.players[opp];
  const names = new Set<string>();
  for (const c of [...op.hand, ...op.deck, ...op.discard]) {
    const nm = ctx.reg.cards[c.cardId]?.name;
    if (nm) names.add(nm);
  }
  if (names.size === 0) return { state: ctx.state, events: [] }; // nothing to name
  const options = [...names].sort().map(n => ({ label: n, value: n }));
  const chooser = ctx.chooser ?? defaultChooser;
  const pick = chooser({ kind: 'choose_one', prompt: 'Name a card', options, player: ctx.sourcePlayer, canPass: false });
  const named = pick.kind === 'option' ? pick.value : options[0].value;
  const s = mapInstance(ctx.state, ctx.sourceIid, c => ({ ...c, namedCard: named }));
  return { state: s, events: [] };
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
    // A unit controlled by `ctrl` left play this phase (bounce).
    s = { ...s, leftPlayThisPhase: [...(s.leftPlayThisPhase ?? []), ctrl] };
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

// "Deal N indirect damage to a player" (§8.35). The RECIPIENT (the chosen
// player) assigns N unpreventable damage among their base and units, divided as
// they choose, capped per unit at remaining HP (§8.35.3), all simultaneously
// (§8.35.5), ignoring Shield tokens without consuming them (§8.35.2a).
// Attribution stays with the source (§8.35.4). The assigning player is the
// recipient, so the chooser's `player` is the recipient — that's what surfaces
// the assignment prompt to the right side in the UI.
function applyIndirectDamage(ctx: InterpCtx, e: Extract<Effect, { effect: 'indirect_damage' }>): InterpResult {
  const recipient = resolvePlayerStrict(e.player, ctx);
  const p = ctx.state.players[recipient];
  if (!p || e.amount <= 0) return { state: ctx.state, events: [] };
  const chooser = ctx.chooser ?? defaultChooser;

  // Assignable slots: the recipient's base (uncapped) + each of their units,
  // capped at remaining HP. Caps use pre-damage HP so the allocation is
  // simultaneous (a unit can be assigned at most its remaining HP this ability).
  type Slot = { key: string; iid?: string; cap: number; assigned: number };
  const slots: Slot[] = [{ key: '__base__', cap: Infinity, assigned: 0 }];
  for (const z of ['ground_arena', 'space_arena'] as const) {
    for (const c of getZoneArr(p, z)) {
      const remaining = effectiveHp(ctx.state, ctx.reg, c, recipient) - c.damage;
      if (remaining > 0) slots.push({ key: c.iid, iid: c.iid, cap: remaining, assigned: 0 });
    }
  }

  // The recipient assigns each point. Default chooser dumps on the leftmost slot
  // (the base) — behavior-preserving vs the old "all to base" model and a sane
  // AI default (spare your own units). A scripted/human chooser distributes.
  let remaining = e.amount;
  while (remaining > 0) {
    const eligible = slots.filter(s => s.assigned < s.cap);
    if (eligible.length === 0) break; // base is uncapped, so this can't actually happen
    const options = eligible.map(s => ({
      label: s.iid
        ? (ctx.reg.cards[findCard(ctx.state, s.iid)?.inst.cardId ?? '']?.name ?? s.iid)
        : `${recipient}'s base`,
      value: s.key,
    }));
    const pick = chooser({ kind: 'choose_one', prompt: `Assign 1 of ${remaining} indirect damage`, options, player: recipient, canPass: false });
    const key = pick.kind === 'option' ? pick.value : eligible[0].key;
    const slot = slots.find(s => s.key === key && s.assigned < s.cap) ?? eligible[0];
    slot.assigned += 1;
    remaining -= 1;
  }

  // Apply the full allocation (unpreventable + indirect: ignores shields without
  // consuming them). State-based defeats run after this returns, so all damage
  // lands before any defeat → simultaneous.
  let s = ctx.state;
  const events: GameEvent[] = [];
  for (const slot of slots) {
    if (slot.assigned <= 0) continue;
    const r = slot.iid
      ? dealDamageToUnit(s, ctx.reg, slot.iid, slot.assigned, { indirect: true, unpreventable: true }, ctx.sourceIid, chooser)
      : dealDamageToBase(s, ctx.reg, recipient, slot.assigned, { indirect: true, unpreventable: true }, ctx.sourceIid, chooser);
    s = r.state;
    events.push(...r.events);
  }
  s = { ...s, log: [...s.log, { round: s.round, player: ctx.sourcePlayer, message: `${recipient} assigns ${e.amount} indirect damage.`, kind: e.amount >= 5 ? 'critical' : 'info' }] };
  return { state: s, events };
}

// "Put this event into play as a resource" (Resupply). By the time an event's
// ability resolves it's already in its controller's discard (reducer moves it
// there first); move it into the resource zone instead. The new resource enters
// play exhausted (§2046).
function applyPlayAsResource(ctx: InterpCtx, e: Extract<Effect, { effect: 'play_as_resource' }>): InterpResult {
  if (!ctx.sourceIid) return { state: ctx.state, events: [] };
  const found = findCard(ctx.state, ctx.sourceIid);
  if (!found) return { state: ctx.state, events: [] };
  const pid = found.loc.controller;
  const name = ctx.reg.cards[found.inst.cardId]?.name ?? ctx.sourceIid;

  // Resources put into play by an ability enter exhausted (§2046), UNLESS the
  // card explicitly readies it ("and ready it" — Superlaser Technician).
  const exhausted = !e.ready;
  const moved = moveToZone(ctx.state, ctx.sourceIid, pid, 'resource_zone');
  let s = mapInstance(moved.state, ctx.sourceIid, c => ({ ...c, exhausted }));
  s = { ...s, log: [...s.log, { round: s.round, player: pid, message: `${pid} puts ${name} into play as a resource${e.ready ? ' (ready)' : ''}.`, kind: 'info' }] };
  return { state: s, events: [...moved.events, { kind: 'RESOURCE_PLACED', player: pid, iid: ctx.sourceIid }] };
}

/** "Play a unit from your discard pile [at a reduced cost]." (Palpatine's
 *  Return.) Choose an eligible AFFORDABLE unit in the controller's discard, pay
 *  its reduced cost, and put it into its arena (exhausted, onPlay hooks + Ambush;
 *  its When-Played fires from the trailing settle on the CARD_PLAYED event). A
 *  no-op if nothing is eligible/affordable. Units only. */
function applyPlayFromDiscard(ctx: InterpCtx, e: Extract<Effect, { effect: 'play_from_discard' }>): InterpResult {
  const pid = ctx.sourcePlayer;
  const p = ctx.state.players[pid];
  if (!p) return { state: ctx.state, events: [] };
  const ready = p.resources.filter(r => !r.exhausted);

  // Eligible = unit cards in the discard matching the filter AND affordable at
  // their reduced cost.
  const reductionFor = (spec: import('../spec/types').CardSpec): number => {
    if (e.cost_reduction_if && evalCardPredicate(e.cost_reduction_if.filter, ctx, dummyInst(spec.id), pid, 'discard')) {
      return e.cost_reduction_if.amount;
    }
    return e.cost_reduction ?? 0;
  };
  const eligible = p.discard.filter(c => {
    const spec = ctx.reg.cards[c.cardId];
    if (!spec || spec.type !== 'unit') return false;
    if (e.filter && !evalCardPredicate(e.filter, ctx, c, pid, 'discard')) return false;
    const reduced = Math.max(0, effectiveCost(ctx.state, ctx.reg, spec, pid) - reductionFor(spec));
    return ready.length >= reduced;
  });
  if (eligible.length === 0) return { state: ctx.state, events: [] };

  const chooser = ctx.chooser ?? defaultChooser;
  const pick = chooser({
    kind: 'choose_one',
    prompt: 'Play a unit from your discard pile',
    options: eligible.map(c => ({ label: ctx.reg.cards[c.cardId]?.name ?? c.iid, value: c.iid })),
    player: pid, canPass: false,
  });
  const chosenIid = pick.kind === 'option' ? pick.value : eligible[0].iid;
  const card = eligible.find(c => c.iid === chosenIid) ?? eligible[0];
  const spec = ctx.reg.cards[card.cardId]!;
  const cost = Math.max(0, effectiveCost(ctx.state, ctx.reg, spec, pid) - reductionFor(spec));

  let s = ctx.state;
  const events: GameEvent[] = [];
  // Pay the reduced cost from ready resources.
  for (let i = 0; i < cost; i++) {
    const r = exhaust(s, ready[i].iid);
    s = r.state;
    events.push({ kind: 'RESOURCE_SPENT', player: pid, iid: ready[i].iid });
  }
  s = { ...s, log: [...s.log, { round: s.round, player: pid, message: `${pid} plays ${spec.name} from discard (${cost}).`, kind: 'info' }] };
  const put = putUnitIntoPlay(s, ctx.reg, card.iid, pid, spec, ctx.chooser);
  return { state: put.state, events: [...events, ...put.events] };
}

/** Move unit `iid` (from any zone) into its arena, exhausted (§3.4.4b), run its
 *  onPlay keyword hooks (Shielded) + Ambush, and emit CARD_PLAYED. The unit's
 *  triggered When-Played fires from the trailing settle on that event. Shared by
 *  play_from_discard and search_play (units played from a non-hand zone). */
function putUnitIntoPlay(
  state: GameState, reg: CardRegistry, iid: string, pid: PlayerId,
  spec: import('../spec/types').CardSpec, chooser: InterpCtx['chooser'],
): InterpResult {
  const events: GameEvent[] = [];
  const destZone = (spec.type === 'unit' && spec.arena === 'space') ? 'space_arena' : 'ground_arena';
  const moved = moveToZone(state, iid, pid, destZone);
  let s = mapInstance(moved.state, iid, c => ({ ...c, exhausted: true, enteredZoneAt: moved.state.step }));
  events.push(...moved.events, { kind: 'CARD_PLAYED', iid, cardId: spec.id, controller: pid });
  if (spec.type === 'unit') {
    for (const kw of (spec.keywords ?? [])) {
      const def = KEYWORDS[kw.name.toLowerCase()];
      if (!def?.onPlay) continue;
      const here = findCard(s, iid);
      if (!here) continue;
      const r = def.onPlay({ state: s, reg, inst: here.inst, owner: pid, value: kw.value });
      s = r.state;
      events.push(...r.events);
    }
  }
  const amb = resolveAmbush(s, reg, iid, pid, chooser);
  return { state: amb.state, events: [...events, ...amb.events] };
}

/** "Search the top N cards of your deck for any number of <units> with combined
 *  cost ≤ M and play each for free." (Darth Vader — Commanding the First Legion.)
 *  Reveal the top N; the player picks any subset of matching cards whose combined
 *  printed cost stays within the cap; each is put into play for free; the deck is
 *  then shuffled (§8.36). The default chooser greedily takes affordable matches. */
function applySearchPlay(ctx: InterpCtx, e: Extract<Effect, { effect: 'search_play' }>): InterpResult {
  const pid = ctx.sourcePlayer;
  const ps = ctx.state.players[pid];
  if (!ps || ps.deck.length === 0) return { state: ctx.state, events: [] };
  const top = ps.deck.slice(0, e.count);
  const shuffleSeed = ctx.state.step;
  const cap = e.max_combined_cost ?? Infinity;

  const eligibleAll = top.filter(c => {
    const spec = ctx.reg.cards[c.cardId];
    if (!spec || spec.type !== 'unit') return false;
    return !e.filter || evalCardPredicate(e.filter, ctx, c, pid, 'deck');
  });

  const chooser = ctx.chooser ?? defaultChooser;
  const chosen: string[] = [];
  let spent = 0;
  // Pick matches one at a time while any remaining one still fits the cap.
  while (true) {
    const remaining = eligibleAll.filter(c =>
      !chosen.includes(c.iid) && (ctx.reg.cards[c.cardId]?.cost ?? 0) <= cap - spent);
    if (remaining.length === 0) break;
    const options = [
      ...remaining.map(c => ({ label: `${ctx.reg.cards[c.cardId]?.name ?? c.iid} (${ctx.reg.cards[c.cardId]?.cost ?? 0})`, value: c.iid })),
      { label: 'Done', value: '__done__' },
    ];
    const pick = chooser({ kind: 'choose_one', prompt: `Search top ${e.count}: play a unit for free (combined ≤ ${cap}, ${spent} used)`, options, player: pid, canPass: true });
    const v = pick.kind === 'option' ? pick.value : (pick.kind === 'pass' || pick.kind === 'no' ? '__done__' : remaining[0].iid);
    if (v === '__done__') break;
    chosen.push(v);
    spent += ctx.reg.cards[eligibleAll.find(c => c.iid === v)!.cardId]?.cost ?? 0;
  }

  let s = ctx.state;
  const events: GameEvent[] = [];
  // Play each chosen unit for free (it's still in the deck array; putUnitIntoPlay
  // moves it from there into the arena).
  for (const iid of chosen) {
    const spec = ctx.reg.cards[top.find(c => c.iid === iid)!.cardId]!;
    s = { ...s, log: [...s.log, { round: s.round, player: pid, message: `${pid} plays ${spec.name} for free (searched).`, kind: 'info' }] };
    const put = putUnitIntoPlay(s, ctx.reg, iid, pid, spec, ctx.chooser);
    s = put.state;
    events.push(...put.events);
  }
  // Shuffle the deck afterwards (§8.36 — a search shuffles regardless).
  const psNow = s.players[pid];
  s = withPlayer(s, pid, { ...psNow, deck: shuffleDeterministic(psNow.deck, shuffleSeed) });
  return { state: s, events };
}

/** Minimal stand-in instance for predicate checks that only read the spec (by
 *  cardId) — used when evaluating a cost_reduction_if filter against a card we
 *  haven't moved yet. */
function dummyInst(cardId: string): import('../state/types').CardInstance {
  return { iid: `__probe_${cardId}`, cardId, damage: 0, exhausted: false, upgrades: [], shieldTokens: 0, isToken: false, enteredZoneAt: 0 };
}

/** "Create N Credit token(s)." Adds one-shot resource tokens to the controller. */
function applyCreateCredit(ctx: InterpCtx, e: Extract<Effect, { effect: 'create_credit' }>): InterpResult {
  const pid = resolvePlayerStrict(e.player ?? 'self', ctx);
  const p = ctx.state.players[pid];
  if (!p) return { state: ctx.state, events: [] };
  const n = e.count ?? 1;
  const made = Array.from({ length: n }, (_, i) => ({ iid: `credit_${ctx.state.step}_${p.creditTokens.length + i}` }));
  let s = withPlayer(ctx.state, pid, { ...p, creditTokens: [...p.creditTokens, ...made] });
  s = { ...s, log: [...s.log, { round: s.round, player: pid, message: `${pid} creates ${n} Credit token${n > 1 ? 's' : ''}.`, kind: 'info' }] };
  return { state: s, events: [] };
}

/** "The next <card_type> you play this phase costs N less." Registers a one-shot
 *  phase-scoped discount on the source player (General's Blade). Consumption +
 *  the cost computation live in cost.ts / reducer.applyPlayCard; phase expiry in
 *  reducer.endActionPhase. */
function applyDiscount(ctx: InterpCtx, e: Extract<Effect, { effect: 'discount' }>): InterpResult {
  const pid = ctx.sourcePlayer;
  const p = ctx.state.players[pid];
  if (!p) return { state: ctx.state, events: [] };
  const discounts = [...(p.discounts ?? []), { amount: e.amount, cardType: e.card_type }];
  let s = withPlayer(ctx.state, pid, { ...p, discounts });
  s = { ...s, log: [...s.log, { round: s.round, player: pid, message: `${pid}: next ${e.card_type ?? 'card'} played this phase costs ${e.amount} less.`, kind: 'info' }] };
  return { state: s, events: [] };
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
