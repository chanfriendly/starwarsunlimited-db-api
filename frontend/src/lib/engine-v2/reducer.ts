// The L1 reducer. Pure function: (state, action, registry) → next, events.
// Routes by action type, runs state-based fixpoint after every change.
//
// Week 2: keywords (Ambush/Grit/Raid/Restore/Saboteur/Sentinel/Shielded/
// Overwhelm) and triggered abilities (When Played / On Attack / When
// Defeated) are wired in through the interpreter + trigger drain.

import type { PlayerAction } from './actions';
import type { CardRegistry, GameState, PlayerId, StepResult } from './state/types';
import type { LastingEffectRec } from './state/effects';
import type { GameEvent } from './state/bus';
import { findCard, getZoneArr, mapInstance, withPlayer } from './state/zones';
import { isUnit, type CardSpec } from './spec/types';
import { draw } from './primitives/card_flow';
import { damageBase, damageUnit, snapshot } from './primitives/combat';
import { exhaust, readyAll } from './primitives/state';
import { moveToZone } from './primitives/move';
import { runStateBased } from './runtime/state_based';
import { effectivePower, effectiveHp, hasEffectiveKeyword, effectiveKeywordValue } from './runtime/modifiers';
import { nextActivePlayer, opponentOf } from './state/types';
import { KEYWORDS, defeatDefenderShields } from './primitives/keywords';
import { settleTriggers } from './runtime/triggers';
import type { Chooser } from './runtime/chooser';
import { applyEffect } from './runtime/interpret';
import { isTriggered, type TriggeredAbility } from './spec/ast';

function settle(state: GameState, reg: CardRegistry, eventsIn: GameEvent[], chooser?: Chooser): StepResult {
  const stepped: GameState = { ...state, step: state.step + 1 };
  const sb = runStateBased(stepped, reg);
  // Triggered abilities watching the events from this step (including any
  // DEFEATED events from the state-based loop) get a chance to fire.
  const settled = settleTriggers(sb.state, reg, [...eventsIn, ...sb.events], chooser);
  // Triggered effects may produce more events that themselves change state →
  // run state-based one more time. One extra pass is enough for Week 2
  // because no current trigger creates units mid-resolution.
  const sb2 = runStateBased(settled.state, reg);
  return { next: sb2.state, events: [...eventsIn, ...sb.events, ...settled.events, ...sb2.events] };
}

function log(state: GameState, message: string, player?: PlayerId, kind: 'info' | 'critical' = 'info'): GameState {
  return { ...state, log: [...state.log, { round: state.round, player, message, kind }] };
}

function specOf(reg: CardRegistry, iid: string, state: GameState): CardSpec | undefined {
  const f = findCard(state, iid);
  if (!f) return undefined;
  return reg.cards[f.inst.cardId];
}

function specKeywords(spec: CardSpec | undefined): { name: string; value?: number }[] {
  if (!spec) return [];
  if (spec.type === 'unit' || spec.type === 'upgrade' || spec.type === 'token') {
    return (spec.keywords ?? []).map(k => ({ name: k.name.toLowerCase(), value: k.value }));
  }
  return [];
}

export function step(state: GameState, action: PlayerAction, reg: CardRegistry, chooser?: Chooser): StepResult {
  if (state.winner) return { next: state, events: [] };

  switch (action.kind) {
    case 'START_GAME':
      return settle(log(state, 'Setup begins. Each player places 2 resources.', undefined, 'critical'),
        reg, [{ kind: 'GAME_STARTED' }], chooser);

    case 'RESOURCE_CARD':       return applyResourceCard(state, action.player, action.iid, reg, chooser);
    case 'DECLINE_RESOURCE':    return applyDeclineResource(state, action.player, reg, chooser);

    case 'PLAY_CARD':           return applyPlayCard(state, action.player, action.iid, reg, chooser);
    case 'ATTACK':              return applyAttack(state, action.player, action.attackerIid, action.defenderIid, reg, chooser);
    case 'TAKE_COUNTER':        return applyTakeCounter(state, action.player, action.counter, reg, chooser);
    case 'PASS':                return applyPass(state, action.player, reg, chooser);

    case 'RESOLVE_CHOICE':
      throw new Error('RESOLVE_CHOICE not used — choices resolve via the synchronous Chooser');
  }
}

// ---------------------------------------------------------------------------
// Setup phase
// ---------------------------------------------------------------------------

function applyResourceCard(state: GameState, pid: PlayerId, iid: string, reg: CardRegistry, chooser?: Chooser): StepResult {
  const found = findCard(state, iid);
  if (!found || found.loc.controller !== pid || found.loc.zone !== 'hand') {
    throw new Error(`Cannot resource ${iid}: not in ${pid}'s hand`);
  }
  const p = state.players[pid];
  const hand = p.hand.filter(c => c.iid !== iid);
  // Setup resources enter play ready so round 1 is meaningful. Regroup
  // resources enter exhausted per §v7 5.5c — readied next regroup-step.
  const resourced = { ...found.inst, exhausted: state.phase !== 'setup' };
  const resources = [...p.resources, resourced];
  let next = withPlayer(state, pid, { ...p, hand, resources, hasResourced: true });

  const events: GameEvent[] = [{ kind: 'RESOURCE_PLACED', player: pid, iid }];
  next = log(next, `${pid} resources a card.`, pid);

  if (state.phase === 'setup') return advanceSetupAfterResource(next, reg, events, chooser);
  if (state.phase === 'regroup') return advanceRegroupAfterResource(next, reg, events, chooser);
  return settle(next, reg, events, chooser);
}

function applyDeclineResource(state: GameState, pid: PlayerId, reg: CardRegistry, chooser?: Chooser): StepResult {
  const p = state.players[pid];
  const next = withPlayer(state, pid, { ...p, hasResourced: true });
  if (state.phase === 'setup') return advanceSetupAfterResource(next, reg, [], chooser);
  if (state.phase === 'regroup') return advanceRegroupAfterResource(next, reg, [], chooser);
  return settle(next, reg, [], chooser);
}

function advanceSetupAfterResource(state: GameState, reg: CardRegistry, events: GameEvent[], chooser?: Chooser): StepResult {
  const SETUP_RESOURCES = 2;
  // A player is "done" with setup if they hit the cap OR they declined
  // (hasResourced=true via DECLINE_RESOURCE). Need to track per-player
  // setup-done across passes since hasResourced gets reset.
  const setupDone = (pid: PlayerId) =>
    state.players[pid].resources.length >= SETUP_RESOURCES ||
    state.players[pid].perGameFlags.has('setup_declined');

  // Mark current player as declined-out if they have hasResourced=true and
  // didn't actually hit the cap (i.e. they declined).
  let s = state;
  if (s.players[s.activePlayer].hasResourced && s.players[s.activePlayer].resources.length < SETUP_RESOURCES) {
    const p = s.players[s.activePlayer];
    const flags = new Set(p.perGameFlags); flags.add('setup_declined');
    s = withPlayer(s, s.activePlayer, { ...p, perGameFlags: flags });
  }

  const allDone = s.playerOrder.every(setupDone);
  if (allDone) {
    // Clear the transient flag so it doesn't pollute regroup tracking.
    const players = { ...s.players };
    for (const pid of s.playerOrder) {
      const flags = new Set(players[pid].perGameFlags); flags.delete('setup_declined');
      players[pid] = { ...players[pid], perGameFlags: flags, hasResourced: false };
    }
    s = { ...s, players };
    return startActionPhase(s, reg, [
      ...events,
      { kind: 'PHASE_ENDED', phase: 'setup' },
      { kind: 'ROUND_STARTED', round: 1 },
      { kind: 'PHASE_STARTED', phase: 'action' },
    ], chooser);
  }

  const remaining = s.playerOrder.filter(pid => !setupDone(pid));
  const idx = remaining.indexOf(s.activePlayer);
  const nextActive = remaining[(idx + 1) % remaining.length] ?? remaining[0];
  // Reset hasResourced so the next active player can act again.
  const reset = { ...s.players[nextActive], hasResourced: false };
  return settle(withPlayer({ ...s, activePlayer: nextActive }, nextActive, reset), reg, events, chooser);
}

function resetResourcedFlags(state: GameState): GameState {
  const players = { ...state.players };
  for (const pid of state.playerOrder) players[pid] = { ...players[pid], hasResourced: false };
  return { ...state, players };
}

function startActionPhase(state: GameState, reg: CardRegistry, events: GameEvent[], chooser?: Chooser): StepResult {
  let s: GameState = { ...state, phase: 'action', round: state.round + 1, activePlayer: state.initiative, consecutivePasses: 0 };
  s = log(s, `Round ${s.round} begins.`, undefined, 'critical');
  s = log(s, `${s.activePlayer} acts first.`, s.activePlayer);
  return settle(s, reg, [...events, { kind: 'TURN_STARTED', player: s.activePlayer }], chooser);
}

// ---------------------------------------------------------------------------
// Action phase
// ---------------------------------------------------------------------------

function applyPlayCard(state: GameState, pid: PlayerId, iid: string, reg: CardRegistry, chooser?: Chooser): StepResult {
  if (state.activePlayer !== pid) throw new Error(`${pid} is not the active player`);
  if (state.phase !== 'action') throw new Error(`Cannot play card outside action phase`);

  const found = findCard(state, iid);
  if (!found || found.loc.controller !== pid || found.loc.zone !== 'hand') {
    throw new Error(`Cannot play ${iid}: not in ${pid}'s hand`);
  }
  const spec = reg.cards[found.inst.cardId];
  if (!spec) throw new Error(`Unknown spec for ${iid}`);
  if (spec.type !== 'unit' && spec.type !== 'event') {
    throw new Error(`Week 3 only supports unit and event cards. Got ${spec.type}`);
  }

  const p = state.players[pid];
  const readyResources = p.resources.filter(r => !r.exhausted);
  const cost = spec.type === 'unit' ? (spec.cost ?? 0) : (spec.cost ?? 0);
  if (readyResources.length < cost) throw new Error(`Insufficient resources: need ${cost}, have ${readyResources.length}`);

  let s = state;
  const events: GameEvent[] = [];
  for (let i = 0; i < cost; i++) {
    const ri = readyResources[i].iid;
    const r = exhaust(s, ri);
    s = r.state;
    events.push({ kind: 'RESOURCE_SPENT', player: pid, iid: ri });
  }

  if (spec.type === 'event') {
    // Events move directly to discard before their ability resolves (§v7 3.3).
    const moved = moveToZone(s, iid, pid, 'discard');
    s = moved.state;
    events.push({ kind: 'CARD_PLAYED', iid, cardId: spec.id, controller: pid });
    s = log(s, `${pid} plays event ${spec.name} (${cost}).`, pid);
    // Resolve the event's triggered when_played ability inline. Events have
    // no in-play keywords or constant abilities — only the event ability.
    if (spec.abilities) {
      for (const ab of spec.abilities) {
        if (!isTriggered(ab)) continue;
        const trig = ab as TriggeredAbility;
        if (trig.on !== 'event.card_played') continue;
        // The event's own when_played fires from the discard pile (where the
        // event now resides), so don't wait for the trigger drain to find it
        // — apply it directly.
        const r = applyEffect({ state: s, reg, sourceIid: iid, sourcePlayer: pid, chooser }, trig.do);
        s = r.state;
        events.push(...r.events);
      }
    }
    return advanceToNextTurn(s, pid, reg, events, undefined, chooser);
  }

  // unit
  if (!isUnit(spec)) throw new Error(`expected unit spec`);
  const destZone = spec.arena === 'space' ? 'space_arena' : 'ground_arena';
  const moved = moveToZone(s, iid, pid, destZone);
  s = moved.state;
  s = mapInstance(s, iid, c => ({ ...c, exhausted: true }));
  events.push({ kind: 'CARD_PLAYED', iid, cardId: spec.id, controller: pid });
  s = log(s, `${pid} plays ${spec.name} (${spec.cost ?? 0}) into ${destZone}.`, pid);

  // Keyword onPlay hooks (Shielded, Ambush). Run before triggered When-Played
  // abilities so that — for example — a Shielded unit's shield is present when
  // a When-Played damage trigger would resolve.
  for (const kw of (spec.keywords ?? [])) {
    const def = KEYWORDS[kw.name.toLowerCase()];
    if (!def?.onPlay) continue;
    const here = findCard(s, iid);
    if (!here) continue;
    const r = def.onPlay({ state: s, reg, inst: here.inst, owner: pid, value: kw.value });
    s = r.state;
    events.push(...r.events);
  }

  return advanceToNextTurn(s, pid, reg, events, undefined, chooser);
}

function applyAttack(
  state: GameState, pid: PlayerId,
  attackerIid: string, defenderIid: string | 'base',
  reg: CardRegistry,
  chooser?: Chooser,
): StepResult {
  if (state.activePlayer !== pid) throw new Error(`${pid} is not the active player`);
  if (state.phase !== 'action') throw new Error(`Cannot attack outside action phase`);

  const attackerFound = findCard(state, attackerIid);
  if (!attackerFound) throw new Error(`Attacker ${attackerIid} not found`);
  if (attackerFound.loc.controller !== pid) throw new Error(`${pid} does not control attacker`);
  if (attackerFound.inst.exhausted) throw new Error(`Attacker is exhausted`);

  const attackerZone = attackerFound.loc.zone;
  if (attackerZone !== 'ground_arena' && attackerZone !== 'space_arena') {
    throw new Error(`Attacker must be in an arena`);
  }

  const oppId = opponentOf(state, pid);

  // Sentinel validation (§v7 7.5.11). If any enemy unit in this arena has
  // Sentinel and the attacker lacks Saboteur, attacker must target a Sentinel.
  const attackerHasSaboteur = hasEffectiveKeyword(state, reg, attackerFound.inst, pid, 'saboteur');
  if (!attackerHasSaboteur) {
    const oppArena = getZoneArr(state.players[oppId], attackerZone);
    const sentinels = oppArena.filter(c => hasEffectiveKeyword(state, reg, c, oppId, 'sentinel'));
    if (sentinels.length > 0) {
      const sentinelIids = new Set(sentinels.map(c => c.iid));
      if (defenderIid === 'base' || !sentinelIids.has(defenderIid)) {
        throw new Error(`Sentinel forces attack at a Sentinel unit`);
      }
    }
  }

  let s = state;
  const events: GameEvent[] = [];

  s = exhaust(s, attackerIid).state;

  // Raid: extra power while attacking.
  const raidVal = effectiveKeywordValue(s, reg, attackerFound.inst, pid, 'raid') ?? 0;
  const basePower = effectivePower(s, reg, attackerFound.inst, pid);
  const attackerPower = basePower + raidVal;

  events.push({ kind: 'ATTACK_DECLARED', attackerIid, defenderIid, defendingPlayer: oppId });

  // Keyword onAttack hooks fire BEFORE combat damage per §v7 7.6.15.A.
  // Restore heals base; Saboteur defeats defender shields (if defender is a unit).
  for (const kw of specKeywords(reg.cards[attackerFound.inst.cardId])) {
    const def = KEYWORDS[kw.name];
    if (def?.onAttack) {
      const here = findCard(s, attackerIid);
      if (!here) continue;
      const r = def.onAttack({ state: s, reg, inst: here.inst, owner: pid, value: kw.value });
      s = r.state;
      events.push(...r.events);
    }
  }
  if (attackerHasSaboteur && defenderIid !== 'base') {
    const r = defeatDefenderShields(s, defenderIid);
    s = r.state;
    events.push(...r.events);
  }

  // Combat damage.
  if (defenderIid === 'base') {
    const dmg = damageBase(s, reg, oppId, attackerPower, { combat: true }, attackerIid);
    s = dmg.state;
    events.push(...dmg.events);
    events.push({ kind: 'ATTACK_ENDED', attackerIid, defenderIid: 'base', damageDealt: attackerPower });
    s = log(s, `${pid} attacks base for ${attackerPower}${raidVal ? ` (Raid ${raidVal})` : ''}.`, pid, attackerPower >= 5 ? 'critical' : 'info');
  } else {
    const defenderFound = findCard(s, defenderIid);
    if (!defenderFound) throw new Error(`Defender ${defenderIid} not found`);
    if (defenderFound.loc.controller === pid) throw new Error(`Cannot attack friendly unit`);
    if (defenderFound.loc.zone !== attackerZone) throw new Error(`Defender must share attacker's arena`);
    const defenderPower = effectivePower(s, reg, defenderFound.inst, oppId);

    // Overwhelm: compute defender's remaining HP before damage so excess
    // can route to base if defender is defeated by combat damage.
    const defenderHpBefore = effectiveHp(s, reg, defenderFound.inst, oppId) - defenderFound.inst.damage;

    const d1 = damageUnit(s, reg, defenderIid, attackerPower, { combat: true }, attackerIid);
    s = d1.state;
    events.push(...d1.events);
    const d2 = damageUnit(s, reg, attackerIid, defenderPower, { combat: true }, defenderIid);
    s = d2.state;
    events.push(...d2.events);

    // Overwhelm excess to base — only if attack damage actually landed (no shield-block)
    // and the defender will be defeated by it.
    const attackerHasOverwhelm = hasEffectiveKeyword(s, reg, attackerFound.inst, pid, 'overwhelm');
    if (attackerHasOverwhelm) {
      const shieldBlocked = d1.events.some(e => e.kind === 'DAMAGE_PREVENTED');
      const excess = attackerPower - Math.max(0, defenderHpBefore);
      if (!shieldBlocked && excess > 0 && defenderHpBefore <= attackerPower) {
        const ow = damageBase(s, reg, oppId, excess, { combat: true }, attackerIid);
        s = ow.state;
        events.push(...ow.events);
        s = log(s, `Overwhelm: ${excess} excess damage to base.`, pid);
      }
    }

    events.push({ kind: 'ATTACK_ENDED', attackerIid, defenderIid, damageDealt: attackerPower });
    s = log(s, `${pid} attacks ${defenderIid} (${attackerPower} vs ${defenderPower}).`, pid);
  }

  // Expire end_of_attack lasting effects.
  s = expireLastingEffects(s, 'end_of_attack');

  return advanceToNextTurn(s, pid, reg, events, undefined, chooser);
}

function applyTakeCounter(
  state: GameState, pid: PlayerId,
  counter: 'initiative' | 'blast' | 'plan',
  reg: CardRegistry,
  chooser?: Chooser,
): StepResult {
  if (state.activePlayer !== pid) throw new Error(`${pid} is not the active player`);
  if (state.phase !== 'action') throw new Error(`Cannot take counter outside action phase`);
  if (counter !== 'initiative') throw new Error(`Week 2 only supports the initiative counter`);
  let s: GameState = { ...state, initiative: pid };
  const p = s.players[pid];
  s = withPlayer(s, pid, { ...p, countersHeld: [...p.countersHeld, counter], hasTakenCounterThisRound: true });
  s = log(s, `${pid} takes the initiative.`, pid, 'critical');
  const events: GameEvent[] = [{ kind: 'COUNTER_TAKEN', player: pid, counter }];
  return advanceToNextTurn(s, pid, reg, events, { taker: pid }, chooser);
}

function applyPass(state: GameState, pid: PlayerId, reg: CardRegistry, chooser?: Chooser): StepResult {
  if (state.activePlayer !== pid) throw new Error(`${pid} is not the active player`);
  if (state.phase !== 'action') throw new Error(`Cannot pass outside action phase`);
  const s = log(state, `${pid} passes.`, pid);
  return advanceToNextTurn(s, pid, reg, [], { isPass: true }, chooser);
}

// ---------------------------------------------------------------------------
// Turn / phase advancement
// ---------------------------------------------------------------------------

function advanceToNextTurn(
  state: GameState, _justActed: PlayerId, reg: CardRegistry,
  events: GameEvent[],
  opts?: { isPass?: boolean; taker?: PlayerId },
  chooser?: Chooser,
): StepResult {
  let s = state;
  if (opts?.isPass) s = { ...s, consecutivePasses: s.consecutivePasses + 1 };
  else s = { ...s, consecutivePasses: 0 };

  if (s.consecutivePasses >= s.playerOrder.length) return endActionPhase(s, reg, events, chooser);

  let next = nextActivePlayer(s);
  let safety = s.playerOrder.length + 1;
  while (s.players[next].hasTakenCounterThisRound && safety-- > 0) {
    next = (() => {
      const i = s.playerOrder.indexOf(next);
      return s.playerOrder[(i + 1) % s.playerOrder.length];
    })();
  }
  s = { ...s, activePlayer: next };
  events.push({ kind: 'TURN_STARTED', player: next });
  return settle(s, reg, events, chooser);
}

function endActionPhase(state: GameState, reg: CardRegistry, eventsIn: GameEvent[], chooser?: Chooser): StepResult {
  let s = log(state, `Action phase ends — entering regroup.`, undefined, 'critical');
  s = { ...s, phase: 'regroup', regroupStep: 'draw', consecutivePasses: 0 };
  const events: GameEvent[] = [
    ...eventsIn,
    { kind: 'PHASE_ENDED', phase: 'action' },
    { kind: 'PHASE_STARTED', phase: 'regroup' },
  ];

  // Expire end_of_phase lasting effects (the action phase that just ended).
  s = expireLastingEffects(s, 'end_of_phase');

  for (const pid of s.playerOrder) {
    const drawn = draw(s, reg, pid, 2);
    s = drawn.state;
    events.push(...drawn.events);
  }

  s = { ...s, regroupStep: 'resource', activePlayer: s.initiative };
  const players = { ...s.players };
  for (const pid of s.playerOrder) players[pid] = { ...players[pid], hasResourced: false };
  s = { ...s, players };
  return settle(s, reg, events, chooser);
}

function advanceRegroupAfterResource(state: GameState, reg: CardRegistry, eventsIn: GameEvent[], chooser?: Chooser): StepResult {
  const events = eventsIn;
  const allDone = state.playerOrder.every(pid => state.players[pid].hasResourced);
  if (!allDone) {
    const remaining = state.playerOrder.filter(pid => !state.players[pid].hasResourced);
    const idx = remaining.indexOf(state.activePlayer);
    const next = remaining[(idx + 1) % remaining.length] ?? remaining[0];
    return settle({ ...state, activePlayer: next }, reg, events, chooser);
  }

  let s = state;
  for (const pid of s.playerOrder) {
    const r = readyAll(s, pid);
    s = r.state;
    events.push(...r.events);
  }

  // Expire end_of_round lasting effects + reset round bookkeeping.
  s = expireLastingEffects(s, 'end_of_round');
  s = expireLastingEffects(s, 'end_of_phase'); // regroup phase also ends here
  const players = { ...s.players };
  for (const pid of s.playerOrder) {
    players[pid] = {
      ...players[pid],
      hasResourced: false,
      hasTakenCounterThisRound: false,
      perPhaseCounters: {},
      perRoundCounters: {},
    };
  }
  s = { ...s, players };
  events.push({ kind: 'PHASE_ENDED', phase: 'regroup' });
  events.push({ kind: 'ROUND_ENDED', round: s.round });
  return startActionPhase(s, reg, events, chooser);
}

// ---------------------------------------------------------------------------
// Lasting-effect expiry
// ---------------------------------------------------------------------------

function expireLastingEffects(state: GameState, kind: LastingEffectRec['expiry']): GameState {
  const before = state.lastingEffects as LastingEffectRec[];
  const after = before.filter(le => le.expiry !== kind);
  if (after.length === before.length) return state;
  return { ...state, lastingEffects: after };
}

// Re-exports for the demo / external callers.
export { findCard, getZoneArr, snapshot };
