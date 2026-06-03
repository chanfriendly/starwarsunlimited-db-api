// Trigger matching + drain.
//
// Algorithm (per §v7 7.6):
//   1. After an action resolves, scan all in-play cards (plus just-defeated
//      cards for "When Defeated") against the new events.
//   2. For each (ability, event) match where the ability's `where` predicate
//      holds, materialize a TriggerInstance and append to pendingTriggers.
//   3. Drain pendingTriggers in active-player-first order; resolving each
//      may emit more events → run step 1 again until pendingTriggers is empty
//      and no new triggers materialize.
//
// Week 2 simplification: per-player ordering is insertion-order, not
// player-chosen. Active-player-chooses UI uses the pending-choice protocol
// and lands when we wire RESOLVE_CHOICE.

import type { GameEvent } from '../state/bus';
import type { CardInstance, CardRegistry, GameState, PlayerId, TriggerInstance } from '../state/types';
import type { Ability, TriggeredAbility, TriggerCondition } from '../spec/ast';
import { isTriggered } from '../spec/ast';
import { getZoneArr } from '../state/zones';
import { evalTriggerPredicate, type EvalCtx } from './predicates';
import { applyEffect } from './interpret';
import { defaultChooser } from './chooser';

/** Human-readable label for a pending trigger, for the ordering prompt. */
function triggerLabel(state: GameState, reg: CardRegistry, t: TriggerInstance): string {
  const found = locateSource(state, t.sourceIid);
  const name = found ? (reg.cards[found.inst.cardId]?.name ?? t.sourceIid) : t.sourceIid;
  return `${name}'s triggered ability`;
}

const EVENT_KIND_TO_TRIGGER: Record<string, TriggerCondition> = {
  CARD_PLAYED:     'event.card_played',
  CARD_DRAWN:      'event.card_drawn',
  ATTACK_DECLARED: 'event.attack_declared',
  ATTACK_ENDED:    'event.attack_ended',
  DEFEATED:        'event.defeated',
  DAMAGE_DEALT:    'event.damage_dealt',
  LEADER_DEPLOYED: 'event.leader_deployed',
  TOKEN_CREATED:   'event.token_created',
  PHASE_STARTED:   'event.phase_started',
  PHASE_ENDED:     'event.phase_ended',
  ROUND_STARTED:   'event.round_started',
  ROUND_ENDED:     'event.round_ended',
};

/** Synthetic iid prefix for un-deployed leaders. The real LeaderInstance has
 *  no iid because it isn't a CardInstance, but the trigger / ability machinery
 *  is iid-keyed everywhere. We build a stable id of the form
 *  `LEAD:<playerId>:<leaderIndex>` so per-source counters, the chooser context,
 *  and the limit accounting work uniformly. */
export const UNDEPLOYED_LEADER_IID_PREFIX = 'LEAD:';

export function makeUndeployedLeaderIid(pid: PlayerId, idx: number): string {
  return `${UNDEPLOYED_LEADER_IID_PREFIX}${pid}:${idx}`;
}

export function parseUndeployedLeaderIid(iid: string): { pid: PlayerId; idx: number } | undefined {
  if (!iid.startsWith(UNDEPLOYED_LEADER_IID_PREFIX)) return undefined;
  const rest = iid.slice(UNDEPLOYED_LEADER_IID_PREFIX.length);
  const colon = rest.indexOf(':');
  if (colon < 0) return undefined;
  const pid = rest.slice(0, colon);
  const idx = parseInt(rest.slice(colon + 1), 10);
  if (Number.isNaN(idx)) return undefined;
  return { pid, idx };
}

/** Build a synthetic CardInstance for an un-deployed leader so it can flow
 *  through the modifier / trigger / interpret machinery (all of which expect
 *  a CardInstance). The synth is read-only — never mutated; never enters a zone. */
export function synthLeaderInstance(state: GameState, pid: PlayerId, idx: number): CardInstance | undefined {
  const leader = state.players[pid]?.leaders[idx];
  if (!leader) return undefined;
  return {
    iid: makeUndeployedLeaderIid(pid, idx),
    cardId: leader.cardId,
    damage: 0,
    exhausted: leader.exhausted,
    upgrades: [],
    shieldTokens: 0,
    isToken: false,
    enteredZoneAt: 0,
  };
}

function cardAbilities(reg: CardRegistry, inst: CardInstance): Ability[] {
  const spec = reg.cards[inst.cardId];
  if (!spec) return [];
  if (spec.type === 'unit' || spec.type === 'event' || spec.type === 'upgrade' || spec.type === 'token') {
    return spec.abilities ?? [];
  }
  if (spec.type === 'leader') {
    // Synthetic un-deployed leader → leaderAbilities; in-arena leader-unit
    // (real CardInstance with `cardId = leaderSpec.id`) → leaderUnitAbilities.
    if (inst.iid.startsWith(UNDEPLOYED_LEADER_IID_PREFIX)) return spec.leaderAbilities ?? [];
    return spec.leaderUnitAbilities ?? [];
  }
  return [];
}

interface CardSlot { inst: CardInstance; controller: PlayerId }

function inPlayCards(state: GameState): CardSlot[] {
  const out: CardSlot[] = [];
  for (const pid of state.playerOrder) {
    const p = state.players[pid];
    for (const c of p.groundArena) {
      out.push({ inst: c, controller: pid });
      // Upgrades attached to a unit are "in play" for the purposes of
      // triggered abilities (e.g. an upgrade with "When attached unit attacks…").
      for (const up of c.upgrades) out.push({ inst: up, controller: pid });
    }
    for (const c of p.spaceArena)  {
      out.push({ inst: c, controller: pid });
      for (const up of c.upgrades) out.push({ inst: up, controller: pid });
    }
    // Un-deployed leaders: their leaderAbilities (constants + triggered)
    // are active while the leader sits on the leader zone (§v7 3.4.4).
    for (let i = 0; i < p.leaders.length; i++) {
      const leader = p.leaders[i];
      if (leader.isDeployed) continue;
      const synth = synthLeaderInstance(state, pid, i);
      if (synth) out.push({ inst: synth, controller: pid });
    }
  }
  return out;
}

// When-Defeated abilities run from the discard pile — find recently-defeated
// cards by matching DEFEATED events to their last-known controller.
function defeatedCards(state: GameState, events: GameEvent[]): CardSlot[] {
  const out: CardSlot[] = [];
  for (const e of events) {
    if (e.kind !== 'DEFEATED') continue;
    for (const pid of state.playerOrder) {
      const p = state.players[pid];
      const found = p.discard.find(c => c.iid === e.iid);
      if (found && e.lastKnown.controller === pid) {
        out.push({ inst: found, controller: pid });
        break;
      }
    }
  }
  return out;
}

// Build the set of materialized triggers from a fresh batch of events.
export function collectTriggers(
  state: GameState,
  reg: CardRegistry,
  events: GameEvent[],
): TriggerInstance[] {
  const triggers: TriggerInstance[] = [];
  const slots = [...inPlayCards(state), ...defeatedCards(state, events)];

  let nextId = state.step * 1000 + state.lastingEffects.length;

  for (const { inst, controller } of slots) {
    const abs = cardAbilities(reg, inst);
    abs.forEach((ab, abIdx) => {
      if (!isTriggered(ab)) return;
      const wanted = ab.on;
      for (const event of events) {
        const eventCondition = EVENT_KIND_TO_TRIGGER[event.kind];
        if (eventCondition !== wanted) continue;
        const ctx: EvalCtx = {
          state, reg,
          sourceIid: inst.iid,
          sourcePlayer: controller,
          triggerEvent: event,
        };
        if (!evalTriggerPredicate(ab.where, ctx, event)) continue;

        // Enforce limit by checking the source player's counter.
        if (ab.limit && isLimitExhausted(state, controller, 'trig', inst.iid, abIdx, ab.limit)) continue;

        // `controlled_by` (Bounty, §13a/f): the ability is resolved by an
        // opponent of the unit's controller. The predicate matched from the
        // unit's perspective above, but resolution, ordering (§3018), and the
        // chooser all key off the RESOLVING player.
        const resolver = ab.controlled_by
          ? (state.playerOrder.find(pl => pl !== controller) ?? controller)
          : controller;

        triggers.push({
          id: `t${nextId++}`,
          abilityIndex: abIdx,
          sourceIid: inst.iid,
          sourceController: resolver,
          event,
        });
      }
    });
  }
  return triggers;
}

import type { Limit } from '../spec/ast';

/** Counter key for per-source-per-ability limit tracking. Shared by triggered
 *  abilities and action abilities; the `tag` distinguishes (so a card with
 *  both a triggered and an action ability at the same index counts separately). */
export function limitKey(tag: 'trig' | 'act', iid: string, abIdx: number, limit: Limit): string {
  return `${tag}:${iid}:${abIdx}:${limit}`;
}

export function isLimitExhausted(
  state: GameState, controller: PlayerId,
  tag: 'trig' | 'act', iid: string, abIdx: number, limit: Limit,
): boolean {
  const k = limitKey(tag, iid, abIdx, limit);
  const p = state.players[controller];
  if (limit === 'once_per_phase') return (p.perPhaseCounters[k] ?? 0) > 0;
  if (limit === 'once_per_round') return (p.perRoundCounters[k] ?? 0) > 0;
  if (limit === 'once_per_game')  return p.perGameFlags.has(k);
  return false;
}

export function bumpLimit(
  state: GameState, controller: PlayerId,
  tag: 'trig' | 'act', iid: string, abIdx: number, limit: Limit,
): GameState {
  const k = limitKey(tag, iid, abIdx, limit);
  const p = state.players[controller];
  if (limit === 'once_per_phase') {
    return { ...state, players: { ...state.players, [controller]: { ...p, perPhaseCounters: { ...p.perPhaseCounters, [k]: 1 } } } };
  }
  if (limit === 'once_per_round') {
    return { ...state, players: { ...state.players, [controller]: { ...p, perRoundCounters: { ...p.perRoundCounters, [k]: 1 } } } };
  }
  if (limit === 'once_per_game') {
    const flags = new Set(p.perGameFlags); flags.add(k);
    return { ...state, players: { ...state.players, [controller]: { ...p, perGameFlags: flags } } };
  }
  return state;
}

// Drain pendingTriggers + any nested ones, returning the settled state.
// Caller is responsible for adding the initial triggers to state.pendingTriggers.
export function drainTriggers(state: GameState, reg: CardRegistry, chooser?: import('./chooser').Chooser): { state: GameState; events: GameEvent[] } {
  let s = state;
  const events: GameEvent[] = [];

  for (let guard = 0; guard < 256; guard++) {
    if (s.pendingTriggers.length === 0) break;

    // Trigger ordering (§3016 / §3018):
    //   • A player resolving multiple of their OWN simultaneous triggers chooses
    //     the order among them (§3016).
    //   • When both players have triggers, the active player's batch resolves
    //     first (§3018 — we take active-first as the default; the rare option for
    //     the active player to let the opponent go first is not surfaced).
    // The ELIGIBLE set is the active player's pending triggers if any, else the
    // opponent's. The owning player picks which of their eligible triggers goes
    // next. defaultChooser picks leftmost (= insertion order), so this is a
    // behavior-preserving generalization: only a scripted/human chooser reorders,
    // and only when a player actually has ≥2 simultaneous triggers.
    const ti = s.pendingTriggers as TriggerInstance[];
    const activeOwn = ti.filter(t => t.sourceController === s.activePlayer);
    const eligible = activeOwn.length > 0 ? activeOwn : ti;
    const orderingPlayer = eligible[0].sourceController;

    let trigger: TriggerInstance;
    if (eligible.length === 1) {
      trigger = eligible[0];
    } else {
      const pick = (chooser ?? defaultChooser)({
        kind: 'choose_one',
        prompt: 'Choose which triggered ability to resolve next',
        options: eligible.map(t => ({ label: triggerLabel(s, reg, t), value: t.id })),
        player: orderingPlayer,
        canPass: false,
      });
      trigger = (pick.kind === 'option' ? eligible.find(t => t.id === pick.value) : undefined) ?? eligible[0];
    }

    // Remove it from the queue before resolving (so a nested trigger of the
    // same kind isn't re-resolved infinitely).
    const idx = ti.indexOf(trigger);
    const remaining = [...ti.slice(0, idx), ...ti.slice(idx + 1)];
    s = { ...s, pendingTriggers: remaining };

    const found = locateSource(s, trigger.sourceIid);
    if (!found) continue; // source left play entirely; trigger still resolves but lacks card abilities
    const abilities = cardAbilities(reg, found.inst);
    const ability = abilities[trigger.abilityIndex];
    if (!ability || !isTriggered(ability)) continue;

    // Optional + "you may" — Week 2 auto-resolves; pending-choice ships later.
    if (ability.limit) s = bumpLimit(s, trigger.sourceController, 'trig', trigger.sourceIid, trigger.abilityIndex, ability.limit);

    const r = applyEffect({
      state: s, reg,
      sourceIid: trigger.sourceIid,
      sourcePlayer: trigger.sourceController,
      triggerEvent: trigger.event,
      chooser,
    }, ability.do);
    s = r.state;
    events.push(...r.events);

    // Nested: any new triggers materialized by this resolution are added to
    // the front of the queue. Per §v7 7.6.11 nested triggers resolve before
    // returning to the earlier layer.
    const newTriggers = collectTriggers(s, reg, r.events);
    if (newTriggers.length > 0) {
      s = { ...s, pendingTriggers: [...newTriggers, ...(s.pendingTriggers as TriggerInstance[])] };
    }
  }
  return { state: s, events };
}

function locateSource(state: GameState, iid: string): { inst: CardInstance; controller: PlayerId } | undefined {
  // Un-deployed leader source: rebuild the synth on demand.
  const synthParsed = parseUndeployedLeaderIid(iid);
  if (synthParsed) {
    const { pid, idx } = synthParsed;
    const inst = synthLeaderInstance(state, pid, idx);
    if (!inst) return undefined;
    return { inst, controller: pid };
  }
  for (const pid of state.playerOrder) {
    const p = state.players[pid];
    for (const z of ['ground_arena', 'space_arena', 'discard', 'base_zone'] as const) {
      if (z === 'base_zone') continue;
      const arr = getZoneArr(p, z);
      const f = arr.find(c => c.iid === iid);
      if (f) return { inst: f, controller: pid };
      // Upgrades attached to arena cards
      if (z === 'ground_arena' || z === 'space_arena') {
        for (const host of arr) {
          const upF = host.upgrades.find(u => u.iid === iid);
          if (upF) return { inst: upF, controller: pid };
        }
      }
    }
  }
  return undefined;
}

// Helper for the reducer: after an action emits events, materialize + drain
// any triggers in one go, returning settled state.
export function settleTriggers(
  state: GameState, reg: CardRegistry, freshEvents: GameEvent[],
  chooser?: import('./chooser').Chooser,
): { state: GameState; events: GameEvent[] } {
  const initial = collectTriggers(state, reg, freshEvents);
  if (initial.length === 0) return { state, events: [] };
  const s: GameState = { ...state, pendingTriggers: [...(state.pendingTriggers as TriggerInstance[]), ...initial] };
  return drainTriggers(s, reg, chooser);
}
