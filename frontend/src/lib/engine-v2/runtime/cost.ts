// Effective play-cost computation. Single source of truth for "what does this
// card cost to play RIGHT NOW for this player?" — shared by legal.ts (which
// offers PLAY_CARD only when affordable) and reducer.ts (which charges it).
//
// Base cost is the printed `spec.cost`. `cost`-type abilities on the card apply
// a delta (flat or per-X over the controller's board). Per §8.x the result is
// clamped to a minimum of 0 ("a card's cost cannot be modified below 0").
//
// Pure read — never mutates state. Evaluated against the card while it's in the
// player's hand (the controller is the player who would play it).

import type { CardRegistry, GameState, PlayerId } from '../state/types';
import type { CardSpec } from '../spec/types';
import type { CostAbility, CostCount, Predicate } from '../spec/ast';
import { isCost } from '../spec/ast';

function countFor(count: CostCount, state: GameState, pid: PlayerId, reg: CardRegistry): number {
  const p = state.players[pid];
  if (!p) return 0;
  switch (count) {
    case 'friendly_resources': return p.resources.length;
    case 'friendly_units':     return p.groundArena.length + p.spaceArena.length;
    case 'friendly_leader_units': {
      // Deployed leaders are CardInstances in an arena whose cardId is a leader
      // spec; count those across both arenas.
      let n = 0;
      for (const c of [...p.groundArena, ...p.spaceArena]) {
        if (reg.cards[c.cardId]?.type === 'leader') n++;
      }
      return n;
    }
    default: return 0;
  }
}

/** Abilities live on different fields per card type; a hand card is always a
 *  unit/event/upgrade, which carry `abilities`. */
function abilitiesOf(spec: CardSpec): readonly import('../spec/ast').Ability[] {
  if (spec.type === 'unit' || spec.type === 'event' || spec.type === 'upgrade' || spec.type === 'token') {
    return spec.abilities ?? [];
  }
  return [];
}

/** Effective cost of `spec` if played now by `pid`. Clamped to ≥ 0. The
 *  `evalWhile` callback evaluates a cost ability's optional `while` predicate
 *  against the controller (passed in to avoid a predicates.ts import cycle). */
export function effectiveCost(
  state: GameState,
  reg: CardRegistry,
  spec: CardSpec,
  pid: PlayerId,
  evalWhile?: (p: Predicate, pid: PlayerId) => boolean,
): number {
  let cost = spec.cost ?? 0;
  for (const ab of abilitiesOf(spec)) {
    if (!isCost(ab)) continue;
    const c = ab as CostAbility;
    if (c.while && evalWhile && !evalWhile(c.while, pid)) continue;
    const delta = c.per ? c.amount * countFor(c.per, state, pid, reg) : c.amount;
    cost += delta;
  }
  // One-shot pending discounts ("the next unit you play this phase costs N less"
  // — General's Blade). All matching discounts stack on this play. Pure read —
  // consumption happens in reducer.applyPlayCard when the card is actually played.
  cost -= matchingDiscount(state, spec, pid);
  return Math.max(0, cost);
}

/** Sum of pending discounts on `pid` that apply to `spec` (by card type). */
export function matchingDiscount(state: GameState, spec: CardSpec, pid: PlayerId): number {
  const ds = state.players[pid]?.discounts;
  if (!ds || ds.length === 0) return 0;
  return ds.reduce((n, d) => (!d.cardType || d.cardType === spec.type) ? n + d.amount : n, 0);
}

/** Total Exploit X on a card (§16): the player MAY defeat up to X friendly units
 *  while playing it, each reducing the cost by 2. Multiple Exploit instances
 *  stack (§16b). Read from the card's keywords (the value is pulled from the
 *  "Exploit N" text by the translator). The interactive sacrifice + the −2-each
 *  reduction live in reducer.applyPlayCard / legal.ts, not in effectiveCost,
 *  because Exploit involves a player choice (which/how many units to defeat). */
export function exploitOf(spec: CardSpec): number {
  const kws = (spec.type === 'unit' || spec.type === 'upgrade' || spec.type === 'token')
    ? (spec.keywords ?? [])
    : [];
  return kws.reduce((n, k) => k.name.toLowerCase() === 'exploit' ? n + (k.value ?? 0) : n, 0);
}
