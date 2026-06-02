// The L1 reducer. Pure function: (state, action, registry) → next, events.
// Routes by action type, runs state-based fixpoint after every change.
//
// Week 2: keywords (Ambush/Grit/Raid/Restore/Saboteur/Sentinel/Shielded/
// Overwhelm) and triggered abilities (When Played / On Attack / When
// Defeated) are wired in through the interpreter + trigger drain.

import type { PlayerAction } from './actions';
import type { CardInstance, CardRegistry, GameState, PlayerId, StepResult } from './state/types';
import type { LastingEffectRec } from './state/effects';
import type { GameEvent } from './state/bus';
import { findCard, getZoneArr, mapInstance, withPlayer } from './state/zones';
import { isUnit, type CardSpec } from './spec/types';
import { draw } from './primitives/card_flow';
import { snapshot } from './primitives/combat';
import { dealDamageToBase, dealDamageToUnit } from './runtime/damage';
import { exhaust, readyAll } from './primitives/state';
import { moveToZone, attachUpgrade } from './primitives/move';
import { runStateBased } from './runtime/state_based';
import { effectivePower, effectiveHp, hasEffectiveKeyword, effectiveKeywordValue } from './runtime/modifiers';
import { nextActivePlayer, opponentOf } from './state/types';
import { KEYWORDS, defeatDefenderShields } from './primitives/keywords';
import { settleTriggers, isLimitExhausted, bumpLimit, parseUndeployedLeaderIid, makeUndeployedLeaderIid, synthLeaderInstance } from './runtime/triggers';
import { defaultChooser, type Chooser } from './runtime/chooser';
import { applyEffect } from './runtime/interpret';
import { isTriggered, type ActionAbility, type Ability, type TriggeredAbility } from './spec/ast';
import { resolveSelector } from './runtime/selectors';
import { resolvePlayer } from './runtime/predicates';
import { effectiveCost } from './runtime/cost';
import { resolveAttack, attackIllegalReason, resolveAmbush } from './runtime/attack';

function settle(state: GameState, reg: CardRegistry, eventsIn: GameEvent[], chooser?: Chooser): StepResult {
  const stepped: GameState = { ...state, step: state.step + 1 };
  const sb = runStateBased(stepped, reg, chooser);
  // Triggered abilities watching the events from this step (including any
  // DEFEATED events from the state-based loop) get a chance to fire.
  const settled = settleTriggers(sb.state, reg, [...eventsIn, ...sb.events], chooser);
  // Triggered effects may produce more events that themselves change state →
  // run state-based one more time. One extra pass is enough for current
  // mechanics because no trigger creates units mid-resolution.
  const sb2 = runStateBased(settled.state, reg, chooser);
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

    case 'PLAY_CARD':           return applyPlayCard(state, action.player, action.iid, reg, chooser, action.targetIid);
    case 'DEPLOY_LEADER':       return applyDeployLeader(state, action.player, action.leaderIndex, reg, chooser);
    case 'USE_ACTION_ABILITY':  return applyActionAbility(state, action.player, action.sourceIid, action.leaderIndex, action.abilityIndex, action.targetIid, reg, chooser);
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

  if (state.phase === 'setup') return advanceSetupAfterResource(next, reg, events, chooser, false);
  if (state.phase === 'regroup') return advanceRegroupAfterResource(next, reg, events, chooser);
  return settle(next, reg, events, chooser);
}

function applyDeclineResource(state: GameState, pid: PlayerId, reg: CardRegistry, chooser?: Chooser): StepResult {
  const p = state.players[pid];
  const next = withPlayer(state, pid, { ...p, hasResourced: true });
  if (state.phase === 'setup') return advanceSetupAfterResource(next, reg, [], chooser, true);
  if (state.phase === 'regroup') return advanceRegroupAfterResource(next, reg, [], chooser);
  return settle(next, reg, [], chooser);
}

/** Advance setup after a player just placed a resource or declined.
 *  `declined=true` means the call came from DECLINE_RESOURCE — that's when
 *  the player is bowing out before reaching the 2-resource cap and gets the
 *  `setup_declined` flag. After a normal RESOURCE_CARD, the active player
 *  still has resources left to place; just rotate to the next player. */
function advanceSetupAfterResource(
  state: GameState, reg: CardRegistry,
  events: GameEvent[], chooser: Chooser | undefined,
  declined: boolean,
): StepResult {
  const SETUP_RESOURCES = 2;

  // Mark the active player as declined ONLY when the call came via
  // DECLINE_RESOURCE and they haven't already maxed out. (The previous code
  // also flagged after a normal RESOURCE_CARD because both paths set
  // `hasResourced=true` — that's bug #1 from session-45 UAT.)
  let s = state;
  if (declined && s.players[s.activePlayer].resources.length < SETUP_RESOURCES) {
    const p = s.players[s.activePlayer];
    const flags = new Set(p.perGameFlags); flags.add('setup_declined');
    s = withPlayer(s, s.activePlayer, { ...p, perGameFlags: flags });
  }

  // Read from the post-flag state — earlier code used the closure-captured
  // `state` and the flag wouldn't be visible until the next call.
  const setupDone = (pid: PlayerId) =>
    s.players[pid].resources.length >= SETUP_RESOURCES ||
    s.players[pid].perGameFlags.has('setup_declined');

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

function applyPlayCard(state: GameState, pid: PlayerId, iid: string, reg: CardRegistry, chooser?: Chooser, targetIid?: string): StepResult {
  if (state.activePlayer !== pid) throw new Error(`${pid} is not the active player`);
  if (state.phase !== 'action') throw new Error(`Cannot play card outside action phase`);

  const found = findCard(state, iid);
  if (!found || found.loc.controller !== pid || found.loc.zone !== 'hand') {
    throw new Error(`Cannot play ${iid}: not in ${pid}'s hand`);
  }
  const spec = reg.cards[found.inst.cardId];
  if (!spec) throw new Error(`Unknown spec for ${iid}`);
  if (spec.type !== 'unit' && spec.type !== 'event' && spec.type !== 'upgrade') {
    throw new Error(`PLAY_CARD does not support ${spec.type}`);
  }

  const p = state.players[pid];
  const readyResources = p.resources.filter(r => !r.exhausted);
  const cost = effectiveCost(state, reg, spec, pid);
  if (readyResources.length < cost) throw new Error(`Insufficient resources: need ${cost}, have ${readyResources.length}`);

  let s = state;
  const events: GameEvent[] = [];
  for (let i = 0; i < cost; i++) {
    const ri = readyResources[i].iid;
    const r = exhaust(s, ri);
    s = r.state;
    events.push({ kind: 'RESOURCE_SPENT', player: pid, iid: ri });
  }

  if (spec.type === 'upgrade') {
    if (!targetIid) throw new Error(`Upgrade requires a target unit`);
    const hostFound = findCard(s, targetIid);
    if (!hostFound) throw new Error(`Upgrade target ${targetIid} not found`);
    if (hostFound.loc.controller !== pid) throw new Error(`Upgrade target must be friendly`);
    if (hostFound.loc.zone !== 'ground_arena' && hostFound.loc.zone !== 'space_arena') {
      throw new Error(`Upgrade target must be in an arena`);
    }
    const att = attachUpgrade(s, iid, targetIid);
    s = att.state;
    events.push(...att.events);
    events.push({ kind: 'CARD_PLAYED', iid, cardId: spec.id, controller: pid });
    s = log(s, `${pid} plays upgrade ${spec.name} (${cost}) on ${hostFound.inst.iid}.`, pid);
    return advanceToNextTurn(s, pid, reg, events, undefined, chooser);
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

  // Keyword onPlay hooks (Shielded). Run before triggered When-Played abilities
  // so that — for example — a Shielded unit's shield is present when a
  // When-Played damage trigger would resolve.
  for (const kw of (spec.keywords ?? [])) {
    const def = KEYWORDS[kw.name.toLowerCase()];
    if (!def?.onPlay) continue;
    const here = findCard(s, iid);
    if (!here) continue;
    const r = def.onPlay({ state: s, reg, inst: here.inst, owner: pid, value: kw.value });
    s = r.state;
    events.push(...r.events);
  }

  // Ambush (§7.5.5): may ready + nested attack in the same window as When-Played.
  const amb = resolveAmbush(s, reg, iid, pid, chooser);
  s = amb.state;
  events.push(...amb.events);

  return advanceToNextTurn(s, pid, reg, events, undefined, chooser);
}

function applyDeployLeader(
  state: GameState, pid: PlayerId, leaderIndex: number,
  reg: CardRegistry, chooser?: Chooser,
): StepResult {
  if (state.activePlayer !== pid) throw new Error(`${pid} is not the active player`);
  if (state.phase !== 'action') throw new Error(`Cannot deploy leader outside action phase`);

  const p = state.players[pid];
  const leader = p.leaders[leaderIndex];
  if (!leader) throw new Error(`No leader at index ${leaderIndex}`);
  if (leader.isDeployed) throw new Error(`Leader is already deployed`);
  // Deploy is an Epic Action — once per game. A leader that already deployed
  // (even if since defeated + flipped back) cannot redeploy.
  if (leader.hasDeployed) throw new Error(`Leader already used its deploy Epic Action this game`);

  const spec = reg.cards[leader.cardId];
  if (!spec || spec.type !== 'leader') throw new Error(`Invalid leader spec for ${leader.cardId}`);

  // Twin Suns house rule: deploying a leader is FREE — it spends no resources.
  // You only need a total resource pool that meets the deploy-cost threshold
  // (ready or exhausted both count). This diverges from standard SWU, where
  // deploy exhausts resources like playing a card; see CLAUDE.md > Conventions.
  const cost = spec.cost ?? 0;
  if (p.resources.length < cost) {
    throw new Error(`Insufficient resources to deploy: need ${cost} total, have ${p.resources.length}`);
  }

  let s = state;
  const events: GameEvent[] = [];
  // (no resource exhaust — deploy is free in Twin Suns)

  // Create the leader-unit CardInstance. Enters READY per §3.4.4c: "When a
  // Leader Unit is deployed, it enters the ground arena ready, even if it was
  // exhausted before." A deployed leader can attack/use its leader-unit
  // abilities the same round it deploys. (This is the exception to §3.4.4b,
  // where *non-leader* units enter play exhausted.)
  const iid = `i${s._nextIid}`;
  s = { ...s, _nextIid: s._nextIid + 1 };
  const leaderUnit: CardInstance = {
    iid,
    cardId: leader.cardId,
    damage: 0,
    exhausted: false,
    upgrades: [],
    shieldTokens: 0,
    isToken: false,
    enteredZoneAt: s.step,
  };
  const arena: 'ground_arena' | 'space_arena' = spec.arena === 'space' ? 'space_arena' : 'ground_arena';
  const targetP = s.players[pid];
  const newArenaArr = (arena === 'ground_arena' ? targetP.groundArena : targetP.spaceArena).slice();
  newArenaArr.push(leaderUnit);
  const newLeaders = targetP.leaders.slice();
  newLeaders[leaderIndex] = {
    ...leader,
    side: 'leader_unit',
    isDeployed: true,
    hasDeployed: true,   // Epic Action spent — never redeployable, even after flip-back
    unitIid: iid,
  };
  s = withPlayer(s, pid, {
    ...targetP,
    ...(arena === 'ground_arena' ? { groundArena: newArenaArr } : { spaceArena: newArenaArr }),
    leaders: newLeaders,
  });

  events.push({ kind: 'LEADER_DEPLOYED', player: pid, leaderIid: iid, as: 'unit' });
  s = log(s, `${pid} deploys leader ${spec.name} (${cost}).`, pid, 'critical');

  return advanceToNextTurn(s, pid, reg, events, undefined, chooser);
}

/** Look up an action ability source: either an in-play CardInstance or an
 *  un-deployed leader. Returns the abilities array + source iid + the source's
 *  exhausted state + (for leaders) the leaderIndex. */
function resolveActionSource(
  state: GameState, reg: CardRegistry, pid: PlayerId,
  sourceIid: string | undefined, leaderIndex: number | undefined,
): { abilities: Ability[]; iid: string; exhausted: boolean; leaderIndex?: number; isLeaderInst?: boolean } {
  if (sourceIid !== undefined && leaderIndex !== undefined) {
    throw new Error(`USE_ACTION_ABILITY: pass sourceIid OR leaderIndex, not both`);
  }
  if (sourceIid !== undefined) {
    // sourceIid may reference a card in arena, an upgrade attached to one, or
    // the synthetic id of an un-deployed leader (in case a caller chooses to
    // address leaders by iid rather than index).
    const synth = parseUndeployedLeaderIid(sourceIid);
    if (synth) return resolveActionSource(state, reg, pid, undefined, synth.idx);

    const found = findCard(state, sourceIid);
    if (found) {
      if (found.loc.controller !== pid) throw new Error(`Source ${sourceIid} is not yours`);
      const spec = reg.cards[found.inst.cardId];
      if (!spec) throw new Error(`Unknown spec for ${sourceIid}`);
      const abs = spec.type === 'leader'
        ? (spec.leaderUnitAbilities ?? [])
        : ('abilities' in spec ? spec.abilities ?? [] : []);
      return { abilities: abs, iid: sourceIid, exhausted: found.inst.exhausted };
    }
    // Upgrade lookup
    for (const ppid of state.playerOrder) {
      const p = state.players[ppid];
      for (const z of ['ground_arena', 'space_arena'] as const) {
        const arr = getZoneArr(p, z);
        for (const host of arr) {
          const up = host.upgrades.find(u => u.iid === sourceIid);
          if (up) {
            if (ppid !== pid) throw new Error(`Source ${sourceIid} is not yours`);
            const spec = reg.cards[up.cardId];
            const abs = spec && 'abilities' in spec ? (spec.abilities ?? []) : [];
            return { abilities: abs, iid: sourceIid, exhausted: up.exhausted };
          }
        }
      }
    }
    throw new Error(`Source ${sourceIid} not found`);
  }
  if (leaderIndex !== undefined) {
    const leader = state.players[pid].leaders[leaderIndex];
    if (!leader) throw new Error(`No leader at index ${leaderIndex}`);
    const spec = reg.cards[leader.cardId];
    if (!spec || spec.type !== 'leader') throw new Error(`Invalid leader spec`);
    const abs = leader.isDeployed
      ? (spec.leaderUnitAbilities ?? [])
      : (spec.leaderAbilities ?? []);
    const iid = leader.isDeployed && leader.unitIid
      ? leader.unitIid
      : makeUndeployedLeaderIid(pid, leaderIndex);
    return { abilities: abs, iid, exhausted: leader.exhausted, leaderIndex, isLeaderInst: !leader.isDeployed };
  }
  throw new Error(`USE_ACTION_ABILITY: must pass sourceIid or leaderIndex`);
}

function applyActionAbility(
  state: GameState, pid: PlayerId,
  sourceIid: string | undefined, leaderIndex: number | undefined,
  abilityIndex: number, targetIid: string | undefined,
  reg: CardRegistry, chooser?: Chooser,
): StepResult {
  void targetIid; // targets are resolved by the Chooser at effect time
  if (state.activePlayer !== pid) throw new Error(`${pid} is not the active player`);
  if (state.phase !== 'action') throw new Error(`Cannot use ability outside action phase`);

  const src = resolveActionSource(state, reg, pid, sourceIid, leaderIndex);
  const ability = src.abilities[abilityIndex];
  if (!ability) throw new Error(`No ability at index ${abilityIndex}`);
  if (ability.type !== 'action') throw new Error(`Ability ${abilityIndex} is not an action ability (type=${ability.type})`);

  if (ability.limit && isLimitExhausted(state, pid, 'act', src.iid, abilityIndex, ability.limit)) {
    throw new Error(`Limit ${ability.limit} reached for this ability`);
  }

  const cost = ability.cost ?? {};
  if (cost.exhaust && src.exhausted) throw new Error(`Source is exhausted`);

  const p = state.players[pid];
  const readyResources = p.resources.filter(r => !r.exhausted);
  const resCost = cost.resources ?? 0;
  if (readyResources.length < resCost) {
    throw new Error(`Insufficient resources: need ${resCost}, have ${readyResources.length}`);
  }

  let s = state;
  const events: GameEvent[] = [];

  // Pay exhaust
  if (cost.exhaust) {
    if (src.isLeaderInst && src.leaderIndex !== undefined) {
      // Exhaust the un-deployed LeaderInstance directly.
      const ps = s.players[pid];
      const newLeaders = ps.leaders.slice();
      newLeaders[src.leaderIndex] = { ...newLeaders[src.leaderIndex], exhausted: true };
      s = withPlayer(s, pid, { ...ps, leaders: newLeaders });
    } else {
      // Exhaust the in-arena CardInstance (or attached upgrade — exhaust works
      // through mapInstance, which only walks arena cards; if/when an upgrade
      // gets an action ability with exhaust cost, mapInstance will need an
      // upgrade-aware variant).
      const r = exhaust(s, src.iid);
      s = r.state;
      events.push(...r.events);
    }
  }

  // Pay resource cost
  for (let i = 0; i < resCost; i++) {
    const ri = readyResources[i].iid;
    const r = exhaust(s, ri);
    s = r.state;
    events.push({ kind: 'RESOURCE_SPENT', player: pid, iid: ri });
  }

  // Pay discard cost
  if (cost.discard) {
    const who = resolvePlayer(cost.discard.player, { state: s, reg, sourcePlayer: pid });
    const dpid = who === 'any' ? pid : who;
    const dp = s.players[dpid];
    const toDiscard = dp.hand.slice(0, cost.discard.count);
    if (toDiscard.length < cost.discard.count) throw new Error(`Cannot pay discard cost: not enough cards in hand`);
    const remaining = dp.hand.slice(cost.discard.count);
    s = withPlayer(s, dpid, { ...dp, hand: remaining, discard: [...dp.discard, ...toDiscard] });
    for (const c of toDiscard) events.push({ kind: 'CARD_DISCARDED', player: dpid, iid: c.iid, from: 'hand' });
  }

  // Pay defeat cost — selector resolved against the source's perspective.
  if (cost.defeat) {
    const ctx = { state: s, reg, sourceIid: src.iid, sourcePlayer: pid, chooser };
    const targets = resolveSelector(ctx, cost.defeat);
    for (const t of targets) {
      if (t.kind !== 'unit') continue;
      s = mapInstance(s, t.iid, c => ({ ...c, damage: c.damage + 9999 }));
    }
  }

  // Pay remove_shield cost
  if (cost.remove_shield) {
    const ctx = { state: s, reg, sourceIid: src.iid, sourcePlayer: pid, chooser };
    const targets = resolveSelector(ctx, cost.remove_shield);
    for (const t of targets) {
      if (t.kind !== 'unit') continue;
      s = mapInstance(s, t.iid, c => c.shieldTokens > 0 ? { ...c, shieldTokens: c.shieldTokens - 1 } : c);
    }
  }

  // Bump the limit counter (after costs paid, before effect — so a card whose
  // effect references the limit-tracked counter sees the post-fire state).
  if (ability.limit) {
    s = bumpLimit(s, pid, 'act', src.iid, abilityIndex, ability.limit);
  }

  // Resolve the effect.
  const r = applyEffect({ state: s, reg, sourceIid: src.iid, sourcePlayer: pid, chooser }, (ability as ActionAbility).do);
  s = r.state;
  events.push(...r.events);

  const sName = (() => {
    if (src.leaderIndex !== undefined) {
      const spec = reg.cards[state.players[pid].leaders[src.leaderIndex].cardId];
      return spec?.name ?? `leader#${src.leaderIndex}`;
    }
    return src.iid;
  })();
  s = log(s, `${pid} uses action ability on ${sName}.`, pid);

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
  // The player ATTACK action requires a ready attacker (a nested ability-attack
  // is the "unless otherwise specified" exception and goes through resolveAttack
  // directly without this gate).
  if (attackerFound.inst.exhausted) throw new Error(`Attacker is exhausted`);

  const reason = attackIllegalReason(state, pid, reg, attackerIid, defenderIid);
  if (reason) throw new Error(reason);

  const r = resolveAttack(state, pid, attackerIid, defenderIid, reg, chooser);
  return advanceToNextTurn(r.state, pid, reg, r.events, undefined, chooser);
}

function applyTakeCounter(
  state: GameState, pid: PlayerId,
  counter: 'initiative' | 'blast' | 'plan',
  reg: CardRegistry,
  chooser?: Chooser,
): StepResult {
  if (state.activePlayer !== pid) throw new Error(`${pid} is not the active player`);
  if (state.phase !== 'action') throw new Error(`Cannot take counter outside action phase`);
  // Twin Suns "Take an Available Counter": each of the three counters can be
  // taken at most once per round (game-wide); a player takes at most one and is
  // then done for the round (handled by hasTakenCounterThisRound + the turn loop).
  const taken = state.countersTakenThisRound ?? [];
  if (taken.includes(counter)) throw new Error(`The ${counter} counter has already been taken this round`);
  if (state.players[pid].hasTakenCounterThisRound) throw new Error(`${pid} already took a counter this round`);

  let s: GameState = { ...state, countersTakenThisRound: [...taken, counter] };
  const events: GameEvent[] = [];

  if (counter === 'initiative') {
    // Take control of the initiative → first action next round.
    s = { ...s, initiative: pid };
    s = log(s, `${pid} takes the Initiative.`, pid, 'critical');
  } else if (counter === 'blast') {
    // Blast: deal 1 damage to each ENEMY base.
    s = log(s, `${pid} takes the Blast counter — 1 damage to each enemy base.`, pid, 'critical');
    for (const oid of s.playerOrder) {
      if (oid === pid) continue;
      const r = dealDamageToBase(s, reg, oid, 1, { combat: false, indirect: false }, undefined, chooser);
      s = r.state;
      events.push(...r.events);
    }
  } else {
    // Plan: draw 1, then put a card from hand on the BOTTOM of your deck.
    s = log(s, `${pid} takes the Plan counter — draw 1, bottom a card.`, pid, 'critical');
    const dr = draw(s, reg, pid, 1);
    s = dr.state;
    events.push(...dr.events);
    const hand = s.players[pid].hand;
    if (hand.length > 0) {
      // Let the player pick which card to bottom; default chooser → leftmost.
      const chooseFn = chooser ?? defaultChooser;
      const pick = chooseFn({
        kind: 'choose_one',
        prompt: 'Plan: choose a card to put on the bottom of your deck',
        options: hand.map(c => ({ label: reg.cards[c.cardId]?.name ?? c.iid, value: c.iid })),
        player: pid,
        canPass: false,
      });
      const iid = pick.kind === 'option' ? pick.value : hand[0].iid;
      const mv = moveToZone(s, iid, pid, 'deck', { position: 'bottom' });
      s = mv.state;
      events.push({ kind: 'ZONE_CHANGED', iid, from: 'hand', to: 'deck' });
    }
  }

  const p = s.players[pid];
  s = withPlayer(s, pid, { ...p, countersHeld: [...p.countersHeld, counter], hasTakenCounterThisRound: true });
  events.push({ kind: 'COUNTER_TAKEN', player: pid, counter });
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

  // Defensive: if EVERY player has taken their counter this round, there's
  // no one left to switch to. The skip-loop below would bounce between them
  // until the safety counter ran out, leaving `activePlayer` on a seat with
  // no legal actions and no auto-pass — the soft-hang from bug #2. End the
  // action phase instead.
  if (s.playerOrder.every(o => s.players[o].hasTakenCounterThisRound)) {
    return endActionPhase(s, reg, events, chooser);
  }

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
  s = { ...s, countersTakenThisRound: [] }; // counters become available again next round
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
