// Predicate evaluation. Two flavors:
//   evalCardPredicate(p, ctx, inst, instController)   — for selectors
//   evalTriggerPredicate(p, ctx, event)               — for triggered abilities
//
// Closed enums; any path that isn't in the leaf interface is a no-op (returns
// true). The validator (Week 4) will reject unknown paths at load time.

import type { GameEvent } from '../state/bus';
import type { CardInstance, CardRegistry, GameState, PlayerId } from '../state/types';
import type { PlayerRef, Predicate, PredicateLeaf, Range, TriggerPredicate } from '../spec/ast';
import { isPredicateAnd, isPredicateNot, isPredicateOr } from '../spec/ast';
import { isUnit } from '../spec/types';
import { findCard } from '../state/zones';
import { effectiveHp } from './modifiers';

export interface EvalCtx {
  state: GameState;
  reg: CardRegistry;
  /** the card the ability is on; used to resolve "self" and "controller: self" */
  sourceIid?: string;
  sourcePlayer: PlayerId;
  /** for triggered abilities: the event that fired this resolution */
  triggerEvent?: GameEvent;
  /** synchronous choice provider; see runtime/chooser.ts. Optional —
   *  callers that don't supply one get defaultChooser (leftmost / yes / first-N). */
  chooser?: import('./chooser').Chooser;
}

export function resolvePlayer(ref: PlayerRef, ctx: EvalCtx): PlayerId | 'any' {
  if (ref === 'any') return 'any';
  if (ref === 'self') return ctx.sourcePlayer;
  if (ref === 'controller_of_trigger') return ctx.sourcePlayer;
  if (ref === 'opponent') {
    for (const pid of ctx.state.playerOrder) if (pid !== ctx.sourcePlayer) return pid;
  }
  return ctx.sourcePlayer;
}

function inRange(v: number, r: Range | undefined): boolean {
  if (!r) return true;
  if (r.min !== undefined && v < r.min) return false;
  if (r.max !== undefined && v > r.max) return false;
  return true;
}

export function evalCardPredicate(
  p: Predicate | undefined,
  ctx: EvalCtx,
  inst: CardInstance,
  instController: PlayerId,
  instZone?: string,
): boolean {
  if (!p) return true;
  if (isPredicateAnd(p)) return p.and.every(x => evalCardPredicate(x, ctx, inst, instController, instZone));
  if (isPredicateOr(p))  return p.or.some  (x => evalCardPredicate(x, ctx, inst, instController, instZone));
  if (isPredicateNot(p)) return !evalCardPredicate(p.not, ctx, inst, instController, instZone);

  const leaf = p as PredicateLeaf;
  const spec = ctx.reg.cards[inst.cardId];
  const traits = spec && 'traits' in spec ? spec.traits ?? [] : [];
  const aspects = spec && 'aspects' in spec ? spec.aspects ?? [] : [];

  if (leaf.card_trait !== undefined && !traits.some(t => t.toLowerCase() === leaf.card_trait!.toLowerCase())) return false;
  if (leaf.card_traits_any !== undefined && !leaf.card_traits_any.some(t => traits.map(x => x.toLowerCase()).includes(t.toLowerCase()))) return false;
  if (leaf.card_type !== undefined && spec?.type !== leaf.card_type) return false;
  if (leaf.card_aspect !== undefined && !aspects.includes(leaf.card_aspect)) return false;
  if (leaf.card_cost !== undefined && !inRange(spec && 'cost' in spec ? spec.cost ?? 0 : 0, leaf.card_cost)) return false;
  if (leaf.card_is_unique !== undefined && Boolean(spec && 'unique' in spec ? spec.unique : false) !== leaf.card_is_unique) return false;
  if (leaf.card_is_token !== undefined && inst.isToken !== leaf.card_is_token) return false;

  if (leaf.controller !== undefined) {
    const want = resolvePlayer(leaf.controller, ctx);
    if (want !== 'any' && want !== instController) return false;
  }
  if (leaf.zone !== undefined && instZone !== undefined && instZone !== leaf.zone) return false;

  if (leaf.stat_power !== undefined && spec && isUnit(spec)) {
    // Use printed for predicate filtering. Effective stats invite cycles
    // (modifiers selecting modifiers); the rulebook examples only ever
    // filter on printed values.
    if (!inRange(spec.power, leaf.stat_power)) return false;
  }
  if (leaf.stat_hp !== undefined && spec && isUnit(spec)) {
    if (!inRange(spec.hp, leaf.stat_hp)) return false;
  }
  if (leaf.self_damage !== undefined && !inRange(inst.damage, leaf.self_damage)) return false;
  if (leaf.self_exhausted !== undefined && inst.exhausted !== leaf.self_exhausted) return false;
  if (leaf.self_upgraded !== undefined && (inst.upgrades.length > 0) !== leaf.self_upgraded) return false;
  if (leaf.has_shield_token !== undefined && (inst.shieldTokens > 0) !== leaf.has_shield_token) return false;
  if (leaf.remaining_hp !== undefined) {
    // Effective HP − damage (rules-accurate "remaining HP"). Effective stats
    // are an explicit exception to the printed-stats convention above; this is
    // safe from the modifier cycle because remaining_hp is only ever used in
    // selector filters, not in the `while:` clauses effectiveHp scans.
    const remaining = effectiveHp(ctx.state, ctx.reg, inst, instController) - inst.damage;
    if (!inRange(remaining, leaf.remaining_hp)) return false;
  }

  if (leaf.player_has_force_token !== undefined) {
    const has = ctx.state.players[instController]?.forceToken === true;
    if (has !== leaf.player_has_force_token) return false;
  }

  if (leaf.controller_unit_count !== undefined) {
    const ps = ctx.state.players[instController];
    const n = ps ? (ps.groundArena.length + ps.spaceArena.length) : 0;
    if (!inRange(n, leaf.controller_unit_count)) return false;
  }

  if (leaf.controller_resource_count !== undefined) {
    const ps = ctx.state.players[instController];
    const n = ps ? ps.resources.length : 0;
    if (!inRange(n, leaf.controller_resource_count)) return false;
  }

  if (leaf.controller_controls_trait !== undefined) {
    const ps = ctx.state.players[instController];
    const want = leaf.controller_controls_trait.toLowerCase();
    const hasTrait = (arr: CardInstance[]) => arr.some(c => {
      const cs = ctx.reg.cards[c.cardId];
      const ts = cs && 'traits' in cs ? cs.traits ?? [] : [];
      return ts.some(x => x.toLowerCase() === want);
    });
    if (!ps || (!hasTrait(ps.groundArena) && !hasTrait(ps.spaceArena))) return false;
  }

  return true;
}

// ---------------------------------------------------------------------------
// Trigger-event predicates (against the event payload, not a card)
// ---------------------------------------------------------------------------

export function evalTriggerPredicate(
  p: TriggerPredicate | undefined,
  ctx: EvalCtx,
  event: GameEvent,
): boolean {
  if (!p) return true;
  if (p.and) return p.and.every(x => evalTriggerPredicate(x, ctx, event));
  if (p.or)  return p.or.some  (x => evalTriggerPredicate(x, ctx, event));
  if (p.not !== undefined) return !evalTriggerPredicate(p.not, ctx, event);

  // `card: self` means the triggering card must be the source of this ability.
  if (p.card === 'self') {
    const eventIid = eventCardIid(event);
    if (eventIid !== ctx.sourceIid) return false;
  }
  if (p.attacker === 'self') {
    if (event.kind !== 'ATTACK_DECLARED' && event.kind !== 'ATTACK_ENDED') return false;
    if (event.attackerIid !== ctx.sourceIid) return false;
  }
  if (p.defender === 'self') {
    if (event.kind !== 'ATTACK_DECLARED' && event.kind !== 'ATTACK_ENDED') return false;
    if (event.defenderIid !== ctx.sourceIid) return false;
  }

  // For non-self triggers (Ki-Adi-Mundi: any clone played by self), allow
  // controller/trait/type predicates to apply to the event's card.
  if (p.controller !== undefined || p.card_trait !== undefined || p.card_type !== undefined || p.card_aspect !== undefined) {
    const iid = eventCardIid(event);
    if (!iid) return false;
    const found = findCard(ctx.state, iid);
    if (!found) return false;
    const spec = ctx.reg.cards[found.inst.cardId];
    const traits = spec && 'traits' in spec ? spec.traits ?? [] : [];
    const aspects = spec && 'aspects' in spec ? spec.aspects ?? [] : [];

    if (p.controller !== undefined) {
      const want = resolvePlayer(p.controller, ctx);
      if (want !== 'any' && want !== found.loc.controller) return false;
    }
    if (p.card_trait !== undefined && !traits.some(t => t.toLowerCase() === p.card_trait!.toLowerCase())) return false;
    if (p.card_type !== undefined && spec?.type !== p.card_type) return false;
    if (p.card_aspect !== undefined && !aspects.includes(p.card_aspect)) return false;
  }

  if (p.combat !== undefined) {
    if (event.kind === 'DAMAGE_DEALT' && event.combat !== p.combat) return false;
  }

  if (p.base_controller !== undefined) {
    // Only meaningful on DAMAGE_DEALT events whose target is a base. Other
    // events shape-mismatch — treat as no-match.
    if (event.kind !== 'DAMAGE_DEALT') return false;
    if (typeof event.targetIid === 'string') return false; // unit target, not base
    const baseOwner = event.targetIid.base;
    const want = resolvePlayer(p.base_controller, ctx);
    if (want !== 'any' && want !== baseOwner) return false;
  }

  return true;
}

function eventCardIid(event: GameEvent): string | undefined {
  switch (event.kind) {
    case 'CARD_PLAYED':       return event.iid;
    case 'CARD_DRAWN':        return event.iid;
    case 'CARD_DISCARDED':    return event.iid;
    case 'CARD_REVEALED':     return event.iid;
    case 'DEFEATED':          return event.iid;
    case 'EXHAUSTED':         return event.iid;
    case 'READIED':           return event.iid;
    case 'ATTACK_DECLARED':   return event.attackerIid;
    case 'ATTACK_ENDED':      return event.attackerIid;
    case 'TOKEN_CREATED':     return event.iid;
    // For damage events the "card of interest" is the TARGET — this is what
    // replacement abilities check with `where: { card: 'self' }` (i.e. "this
    // damage is hitting me"). Base damage carries `{ base: pid }` for the
    // target and has no card iid.
    case 'DAMAGE_DEALT':      return typeof event.targetIid === 'string' ? event.targetIid : undefined;
    case 'LEADER_DEPLOYED':   return event.leaderIid;
    case 'LEADER_DEFEATED':   return event.leaderIid;
    default: return undefined;
  }
}
