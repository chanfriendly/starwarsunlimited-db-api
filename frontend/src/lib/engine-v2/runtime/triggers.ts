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

function cardAbilities(reg: CardRegistry, inst: CardInstance): Ability[] {
  const spec = reg.cards[inst.cardId];
  if (!spec) return [];
  if (spec.type === 'unit' || spec.type === 'event' || spec.type === 'upgrade' || spec.type === 'token') {
    return spec.abilities ?? [];
  }
  return [];
}

interface CardSlot { inst: CardInstance; controller: PlayerId }

function inPlayCards(state: GameState): CardSlot[] {
  const out: CardSlot[] = [];
  for (const pid of state.playerOrder) {
    const p = state.players[pid];
    for (const c of p.groundArena) out.push({ inst: c, controller: pid });
    for (const c of p.spaceArena)  out.push({ inst: c, controller: pid });
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
        if (ab.limit && limitExhausted(state, controller, inst.iid, abIdx, ab.limit)) continue;

        triggers.push({
          id: `t${nextId++}`,
          abilityIndex: abIdx,
          sourceIid: inst.iid,
          sourceController: controller,
          event,
        });
      }
    });
  }
  return triggers;
}

function limitKey(iid: string, abIdx: number, limit: NonNullable<TriggeredAbility['limit']>): string {
  return `trig:${iid}:${abIdx}:${limit}`;
}

function limitExhausted(
  state: GameState, controller: PlayerId,
  iid: string, abIdx: number, limit: NonNullable<TriggeredAbility['limit']>,
): boolean {
  const k = limitKey(iid, abIdx, limit);
  const p = state.players[controller];
  if (limit === 'once_per_phase') return (p.perPhaseCounters[k] ?? 0) > 0;
  if (limit === 'once_per_round') return (p.perRoundCounters[k] ?? 0) > 0;
  if (limit === 'once_per_game')  return p.perGameFlags.has(k);
  return false;
}

function bumpLimit(state: GameState, controller: PlayerId, iid: string, abIdx: number, limit: NonNullable<TriggeredAbility['limit']>): GameState {
  const k = limitKey(iid, abIdx, limit);
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

    // Active-player-first ordering: pull the first trigger controlled by the
    // active player, else the first trigger.
    const ti = s.pendingTriggers as TriggerInstance[];
    let idx = ti.findIndex(t => t.sourceController === s.activePlayer);
    if (idx === -1) idx = 0;
    const trigger = ti[idx];

    // Remove it from the queue before resolving (so a nested trigger of the
    // same kind isn't re-resolved infinitely).
    const remaining = [...ti.slice(0, idx), ...ti.slice(idx + 1)];
    s = { ...s, pendingTriggers: remaining };

    const found = locateSource(s, trigger.sourceIid);
    if (!found) continue; // source left play entirely; trigger still resolves but lacks card abilities
    const spec = reg.cards[found.inst.cardId];
    if (!spec || !('abilities' in spec) || !spec.abilities) continue;
    const ability = spec.abilities[trigger.abilityIndex];
    if (!ability || !isTriggered(ability)) continue;

    // Optional + "you may" — Week 2 auto-resolves; pending-choice ships later.
    if (ability.limit) s = bumpLimit(s, trigger.sourceController, trigger.sourceIid, trigger.abilityIndex, ability.limit);

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
  for (const pid of state.playerOrder) {
    const p = state.players[pid];
    for (const z of ['ground_arena', 'space_arena', 'discard', 'base_zone'] as const) {
      if (z === 'base_zone') continue;
      const arr = getZoneArr(p, z);
      const f = arr.find(c => c.iid === iid);
      if (f) return { inst: f, controller: pid };
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
