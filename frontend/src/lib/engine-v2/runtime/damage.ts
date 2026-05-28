// Damage dispatch — the single chokepoint for damage-to-unit application.
//
// Both the combat path (reducer.ts applyAttack) and the non-combat path
// (interpret.ts applyDamage) route through `dealDamageToUnit` so the
// replacement-effects layer is consulted uniformly. Previously combat damage
// bypassed replacements because primitives/combat.ts couldn't import
// applyEffect (the resulting cycle was a deal-breaker before this module
// existed). Now both call sites delegate here; the cycle exists only between
// runtime/damage.ts and runtime/interpret.ts at the value layer (functions
// referenced at call time, not module init), which TypeScript handles cleanly.
//
// Base-damage replacements aren't in scope yet — damageBase is still called
// directly from both paths. Adding them is a small extension of this module:
// a `dealDamageToBase` wrapper + a base-damage collector in replacements.ts.

import type { CardRegistry, GameState, PlayerId } from '../state/types';
import type { GameEvent } from '../state/bus';
import type { Chooser } from './chooser';
import { damageBase, damageUnit, type DamageOpts } from '../primitives/combat';
import { applyEffect } from './interpret';
import {
  collectDamageBaseReplacements,
  collectDamageUnitReplacements,
  makeProspectiveBaseDamageEvent,
  makeProspectiveDamageEvent,
} from './replacements';

export interface DealDamageResult { state: GameState; events: GameEvent[] }

export function dealDamageToUnit(
  state: GameState,
  reg: CardRegistry,
  targetIid: string,
  amount: number,
  opts: DamageOpts,
  sourceIid: string | undefined,
  chooser?: Chooser,
): DealDamageResult {
  // Unpreventable damage skips both replacements and shields per §v7 7.7.5.
  if (opts.unpreventable) {
    return damageUnit(state, reg, targetIid, amount, opts, sourceIid);
  }

  const prospective = makeProspectiveDamageEvent(targetIid, amount, !!opts.combat, !!opts.indirect, sourceIid);
  const matches = collectDamageUnitReplacements(state, reg, prospective);

  if (matches.length === 0) {
    return damageUnit(state, reg, targetIid, amount, opts, sourceIid);
  }

  // Multiple matches: §v7 7.7.5 says the affected player picks the order.
  // Until that chooser pass ships, resolve in source-creation order — matches
  // the trigger-drain convention and is deterministic.
  const matched = matches[0];
  const preventionEvent: GameEvent = {
    kind: 'DAMAGE_PREVENTED', targetIid, amount, by: matched.sourceIid,
  };
  const r = applyEffect(
    { state, reg, sourceIid: matched.sourceIid, sourcePlayer: matched.sourceController, chooser },
    matched.ability.with,
  );
  return { state: r.state, events: [preventionEvent, ...r.events] };
}

/** Damage-to-base equivalent of `dealDamageToUnit`. Same shape: check
 *  `damage_base` replacements first, fall through to `damageBase`. Used by the
 *  interpret.ts base-target branch and reducer.ts applyAttack (both base
 *  attacks and Overwhelm excess). */
export function dealDamageToBase(
  state: GameState,
  reg: CardRegistry,
  controller: PlayerId,
  amount: number,
  opts: DamageOpts,
  sourceIid: string | undefined,
  chooser?: Chooser,
): DealDamageResult {
  if (opts.unpreventable) {
    return damageBase(state, reg, controller, amount, opts, sourceIid);
  }

  const prospective = makeProspectiveBaseDamageEvent(controller, amount, !!opts.combat, !!opts.indirect, sourceIid);
  const matches = collectDamageBaseReplacements(state, reg, prospective);

  if (matches.length === 0) {
    return damageBase(state, reg, controller, amount, opts, sourceIid);
  }

  // Source-creation order; affected-player ordering is a future chooser pass.
  const matched = matches[0];
  // DAMAGE_PREVENTED on the bus is unit-iid-shaped; for base damage we don't
  // have a unit iid. We could widen the event union, but for now emit the
  // prevention through the replacement's own events (the `with` effect can
  // log/heal explicitly) and skip the prevented event. Callers that want a
  // visible "blocked" indicator should read DAMAGE_DEALT vs heal events.
  const r = applyEffect(
    { state, reg, sourceIid: matched.sourceIid, sourcePlayer: matched.sourceController, chooser },
    matched.ability.with,
  );
  return { state: r.state, events: r.events };
}
