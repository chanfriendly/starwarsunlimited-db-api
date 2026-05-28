// Replacement effects — pre-event interception per §v7 7.7.5.
//
// A replacement ability fires when an event WOULD happen, runs its `with`
// effect INSTEAD, and suppresses the original. Initial scope: damage-to-unit
// replacements consulted by `applyDamageToTarget` (the non-combat damage
// path). Combat damage in `applyAttack` still uses the hardcoded shield
// fast-path — moving combat damage onto this layer requires extracting the
// damage call site out of `primitives/combat.ts` to avoid the cycle with
// `applyEffect`, which lands in a follow-up batch.
//
// Resolution order when multiple replacements match: source-creation order.
// Per §v7 7.7.5 the affected player chooses the order — that's a chooser pass
// (Week 6c).

import type { CardInstance, CardRegistry, GameState, PlayerId } from '../state/types';
import type { CardSnapshot, GameEvent } from '../state/bus';
import type { Ability, ReplacementAbility } from '../spec/ast';
import { isReplacement } from '../spec/ast';
import { getZoneArr } from '../state/zones';
import { evalTriggerPredicate, type EvalCtx } from './predicates';

export interface MatchedReplacement {
  ability: ReplacementAbility;
  sourceIid: string;
  sourceController: PlayerId;
}

function specAbilities(reg: CardRegistry, inst: CardInstance): Ability[] {
  const spec = reg.cards[inst.cardId];
  if (!spec) return [];
  if (spec.type === 'unit' || spec.type === 'event' || spec.type === 'upgrade' || spec.type === 'token') {
    return spec.abilities ?? [];
  }
  if (spec.type === 'leader') {
    // Deployed leader-unit side; un-deployed leaders also live here in the
    // future (their leaderAbilities can carry replacements once that need
    // surfaces). For now only deployed side is consulted.
    return spec.leaderUnitAbilities ?? [];
  }
  return [];
}

/** Build the candidate event payload that the replacement layer compares
 *  against. The event is hypothetical — it hasn't happened yet — but it has
 *  the same shape as the GameEvent the damage primitive would emit, so the
 *  same `evalTriggerPredicate` works. */
export function makeProspectiveDamageEvent(
  targetIid: string,
  amount: number,
  combat: boolean,
  indirect: boolean,
  sourceIid: string | undefined,
): GameEvent {
  return {
    kind: 'DAMAGE_DEALT',
    sourceIid,
    targetIid,
    amount,
    combat,
    indirect,
  };
}

/** Scan in-play cards (arenas + their upgrades) for replacement abilities
 *  matching the prospective event. Returns matches in source-creation order
 *  (first-discovered first). */
function collectReplacements(
  state: GameState,
  reg: CardRegistry,
  event: GameEvent,
  on: ReplacementAbility['on'],
): MatchedReplacement[] {
  const out: MatchedReplacement[] = [];
  for (const pid of state.playerOrder) {
    const p = state.players[pid];
    for (const z of ['ground_arena', 'space_arena'] as const) {
      const arr = getZoneArr(p, z);
      for (const source of arr) {
        // Replacements on the card itself
        for (const ab of specAbilities(reg, source)) {
          if (!isReplacement(ab) || ab.on !== on) continue;
          const ctx: EvalCtx = { state, reg, sourceIid: source.iid, sourcePlayer: pid };
          if (!evalTriggerPredicate(ab.where, ctx, event)) continue;
          out.push({ ability: ab, sourceIid: source.iid, sourceController: pid });
        }
        // Replacements on attached upgrades
        for (const up of source.upgrades) {
          for (const ab of specAbilities(reg, up)) {
            if (!isReplacement(ab) || ab.on !== on) continue;
            const ctx: EvalCtx = { state, reg, sourceIid: up.iid, sourcePlayer: pid };
            if (!evalTriggerPredicate(ab.where, ctx, event)) continue;
            out.push({ ability: ab, sourceIid: up.iid, sourceController: pid });
          }
        }
      }
    }
  }
  return out;
}

export function collectDamageUnitReplacements(
  state: GameState,
  reg: CardRegistry,
  event: GameEvent,
): MatchedReplacement[] {
  if (event.kind !== 'DAMAGE_DEALT') return [];
  return collectReplacements(state, reg, event, 'damage_unit');
}

/** Build the prospective DAMAGE_DEALT event targeting a base. Mirror of
 *  `makeProspectiveDamageEvent` for the unit case; the target shape is
 *  `{ base: PlayerId }` per the GameEvent type. */
export function makeProspectiveBaseDamageEvent(
  baseController: PlayerId,
  amount: number,
  combat: boolean,
  indirect: boolean,
  sourceIid: string | undefined,
): GameEvent {
  return {
    kind: 'DAMAGE_DEALT',
    sourceIid,
    targetIid: { base: baseController },
    amount,
    combat,
    indirect,
  };
}

export function collectDamageBaseReplacements(
  state: GameState,
  reg: CardRegistry,
  event: GameEvent,
): MatchedReplacement[] {
  if (event.kind !== 'DAMAGE_DEALT') return [];
  return collectReplacements(state, reg, event, 'damage_base');
}

/** Build the prospective DEFEATED event the defeat-replacement layer checks
 *  against. The unit hasn't actually moved to discard yet; the snapshot is
 *  computed against the live state. */
export function makeProspectiveDefeatEvent(
  inst: CardInstance,
  controller: PlayerId,
  lastKnown: CardSnapshot,
  combat: boolean,
): GameEvent {
  return {
    kind: 'DEFEATED',
    iid: inst.iid,
    combat,
    lastKnown,
  };
}

export function collectDefeatUnitReplacements(
  state: GameState,
  reg: CardRegistry,
  event: GameEvent,
): MatchedReplacement[] {
  if (event.kind !== 'DEFEATED') return [];
  return collectReplacements(state, reg, event, 'defeat_unit');
}
