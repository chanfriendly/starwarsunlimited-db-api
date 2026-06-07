// Effective stats + keyword aggregation. The single source of truth for
// "what is this unit's current power / HP / keyword set?". Always reads live —
// never mutates state.
//
// Aggregation sources:
//   1. Card's printed stats / printed keywords
//   2. Constant abilities on in-play cards whose `grant.target` selector
//      matches this unit (auras like Clone Commander Cody, while-conditions
//      like Vigilant Honor Guards)
//   3. Lasting effects in state.lastingEffects targeting this unit
//   4. Keyword hooks (Grit's per-damage power bonus)

import type { CardInstance, CardRegistry, GameState, PlayerId, Zone } from '../state/types';
import type { LastingEffectRec } from '../state/effects';
import type { Ability, ConstantAbility, KeywordGrant, Modifier } from '../spec/ast';
import { isConstant } from '../spec/ast';
import { isUnit } from '../spec/types';
import { getZoneArr } from '../state/zones';
import { evalCardPredicate, type EvalCtx } from './predicates';
import { resolveSelector } from './selectors';
import { KEYWORDS } from '../primitives/keywords';
import { synthLeaderInstance, UNDEPLOYED_LEADER_IID_PREFIX } from './triggers';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function cardKeywords(reg: CardRegistry, inst: CardInstance): KeywordGrant[] {
  const spec = reg.cards[inst.cardId];
  if (!spec || !('keywords' in spec) || !spec.keywords) return [];
  return spec.keywords.map(k => ({ name: k.name.toLowerCase(), value: k.value }));
}

function cardAbilities(reg: CardRegistry, inst: CardInstance): Ability[] {
  const spec = reg.cards[inst.cardId];
  if (!spec) return [];
  if (spec.type === 'unit' || spec.type === 'event' || spec.type === 'upgrade' || spec.type === 'token') {
    return spec.abilities ?? [];
  }
  if (spec.type === 'leader') {
    // Synthetic un-deployed leader instance → leaderAbilities. In-arena
    // leader-unit CardInstance (cardId = leader id) → leaderUnitAbilities.
    if (inst.iid.startsWith(UNDEPLOYED_LEADER_IID_PREFIX)) return spec.leaderAbilities ?? [];
    return spec.leaderUnitAbilities ?? [];
  }
  return [];
}

/** Does this constant ability apply when its source is sitting in `sourceZone`?
 *  - active_in_zone undefined → applies only while in an arena (default for
 *    "in-play" abilities)
 *  - active_in_zone set → must exactly match the source zone (Smuggle uses
 *    'resource_zone', etc.) */
function constantAppliesInZone(ab: ConstantAbility, sourceZone: Zone): boolean {
  const required = ab.active_in_zone;
  if (required === undefined) return sourceZone === 'ground_arena' || sourceZone === 'space_arena';
  return required === sourceZone;
}

// Zones that may host an active constant ability. Arenas cover normal play;
// resource_zone covers Smuggle constants.
const CONSTANT_SOURCE_ZONES: Zone[] = ['ground_arena', 'space_arena', 'resource_zone'];

// Walk all in-play cards and lasting effects to find modifiers that affect
// the given (targetIid, targetController). Returns a flat array of Modifiers.
function collectModifiersFor(
  state: GameState,
  reg: CardRegistry,
  targetIid: string,
  targetController: PlayerId,
): Modifier[] {
  const mods: Modifier[] = [];

  // (a) Constant abilities on cards in zones that can host them
  for (const pid of state.playerOrder) {
    const p = state.players[pid];
    for (const z of CONSTANT_SOURCE_ZONES) {
      const arr = getZoneArr(p, z);
      for (const source of arr) {
        // Constants from the source card itself
        for (const ab of cardAbilities(reg, source)) {
          if (!isConstant(ab)) continue;
          if (!constantAppliesInZone(ab, z)) continue;
          const ctx: EvalCtx = { state, reg, sourceIid: source.iid, sourcePlayer: pid };
          if (ab.while && !evalSourcePredicate(ab.while, ctx, source, pid)) continue;
          const targets = resolveSelector(ctx, ab.grant.target);
          if (ab.grant.modifier && targets.some(t => t.kind === 'unit' && t.iid === targetIid)) {
            mods.push(ab.grant.modifier);
          }
        }
        // Constants from upgrades attached to the source (only arenas — upgrades
        // never live on cards outside of arenas).
        if (z === 'ground_arena' || z === 'space_arena') {
          for (const up of source.upgrades) {
            for (const ab of cardAbilities(reg, up)) {
              if (!isConstant(ab)) continue;
              // `while_attacking` grants (Condemn) carry no stat modifier and are
              // handled in trigger collection — skip them in the stat aggregator.
              if (ab.while_attacking) continue;
              // Upgrade constants always apply while the host is in play.
              const ctx: EvalCtx = { state, reg, sourceIid: up.iid, sourcePlayer: pid };
              if (ab.while && !evalSourcePredicate(ab.while, ctx, up, pid)) continue;
              const targets = resolveSelector(ctx, ab.grant.target);
              if (ab.grant.modifier && targets.some(t => t.kind === 'unit' && t.iid === targetIid)) {
                mods.push(ab.grant.modifier);
              }
            }
          }
        }
      }
    }
  }

  // (a') Constant abilities on un-deployed leaders. Leaders aren't in an
  // arena, so the zone-gating logic doesn't apply — these are always-on while
  // the leader sits on the un-deployed side.
  for (const pid of state.playerOrder) {
    const p = state.players[pid];
    for (let i = 0; i < p.leaders.length; i++) {
      const leader = p.leaders[i];
      if (leader.isDeployed) continue;
      const synth = synthLeaderInstance(state, pid, i);
      if (!synth) continue;
      for (const ab of cardAbilities(reg, synth)) {
        if (!isConstant(ab)) continue;
        const ctx: EvalCtx = { state, reg, sourceIid: synth.iid, sourcePlayer: pid };
        if (ab.while && !evalSourcePredicate(ab.while, ctx, synth, pid)) continue;
        const targets = resolveSelector(ctx, ab.grant.target);
        if (ab.grant.modifier && targets.some(t => t.kind === 'unit' && t.iid === targetIid)) {
          mods.push(ab.grant.modifier);
        }
      }
    }
  }

  // (b) Lasting effects
  for (const le of state.lastingEffects as LastingEffectRec[]) {
    if (le.targets.kind === 'units' && le.targets.iids.includes(targetIid)) {
      mods.push(le.modifier);
    }
  }

  return mods;
}

// `while` evaluates against the source card itself.
function evalSourcePredicate(p: ConstantAbility['while'], ctx: EvalCtx, source: CardInstance, ownerId: PlayerId): boolean {
  if (!p) return true;
  return evalCardPredicate(p, ctx, source, ownerId);
}

// ---------------------------------------------------------------------------
// Public reads
// ---------------------------------------------------------------------------

/** Sum of UpgradeSpec.powerModifier across all upgrades attached to a unit. */
function upgradePowerBonus(reg: CardRegistry, inst: CardInstance): number {
  let n = 0;
  for (const up of inst.upgrades) {
    const spec = reg.cards[up.cardId];
    if (!spec) continue;
    if (spec.type === 'upgrade' && spec.powerModifier) n += spec.powerModifier;
    if (spec.type === 'token' && spec.tokenType === 'upgrade' && spec.powerModifier) n += spec.powerModifier;
  }
  return n;
}

/** Sum of UpgradeSpec.hpModifier across all upgrades attached to a unit. */
function upgradeHpBonus(reg: CardRegistry, inst: CardInstance): number {
  let n = 0;
  for (const up of inst.upgrades) {
    const spec = reg.cards[up.cardId];
    if (!spec) continue;
    if (spec.type === 'upgrade' && spec.hpModifier) n += spec.hpModifier;
    if (spec.type === 'token' && spec.tokenType === 'upgrade' && spec.hpModifier) n += spec.hpModifier;
  }
  return n;
}

function upgradeKeywords(reg: CardRegistry, inst: CardInstance): KeywordGrant[] {
  const out: KeywordGrant[] = [];
  for (const up of inst.upgrades) {
    const spec = reg.cards[up.cardId];
    if (!spec) continue;
    if ((spec.type === 'upgrade' || spec.type === 'token') && 'keywords' in spec && spec.keywords) {
      for (const k of spec.keywords) out.push({ name: k.name.toLowerCase(), value: k.value });
    }
  }
  return out;
}

/** Printed unit stats — used for leader-unit-side power lookups when the spec
 *  is a LeaderSpec rather than a UnitSpec. */
function printedPower(reg: CardRegistry, inst: CardInstance): number {
  const spec = reg.cards[inst.cardId];
  if (!spec) return 0;
  if (spec.type === 'unit') return spec.power;
  if (spec.type === 'leader' && typeof spec.power === 'number') return spec.power;
  if (spec.type === 'token' && spec.tokenType === 'unit' && typeof spec.power === 'number') return spec.power;
  return 0;
}

function printedHp(reg: CardRegistry, inst: CardInstance): number {
  const spec = reg.cards[inst.cardId];
  if (!spec) return 1;
  if (spec.type === 'unit') return spec.hp;
  if (spec.type === 'leader' && typeof spec.hp === 'number') return spec.hp;
  if (spec.type === 'token' && spec.tokenType === 'unit' && typeof spec.hp === 'number') return spec.hp;
  return 1;
}

/** Live count for a per-X scaling modifier. */
function perCount(per: NonNullable<Modifier['per']>, state: GameState, reg: CardRegistry, inst: CardInstance, ownerId: PlayerId): number {
  const ps = state.players[ownerId];
  switch (per.count) {
    case 'controller_resources': return ps ? ps.resources.length : 0;
    case 'controller_units':     return ps ? ps.groundArena.length + ps.spaceArena.length : 0;
    case 'self_upgrades':        return inst.upgrades.length;
    case 'controller_discard_units': {
      // "for each [Trait] unit in your discard pile" (Captain Enoch).
      if (!ps) return 0;
      const ctx: EvalCtx = { state, reg, sourceIid: inst.iid, sourcePlayer: ownerId };
      return ps.discard.filter(c => {
        const spec = reg.cards[c.cardId];
        if (!spec || spec.type !== 'unit') return false;
        return !per.filter || evalCardPredicate(per.filter, ctx, c, ownerId, 'discard');
      }).length;
    }
    default:                     return 0;
  }
}

export function effectivePower(
  state: GameState,
  reg: CardRegistry,
  inst: CardInstance,
  ownerId: PlayerId,
): number {
  let p = printedPower(reg, inst);

  // Modifiers from constants + lasting effects
  for (const m of collectModifiersFor(state, reg, inst.iid, ownerId)) {
    if (m.power) p += m.power;
    if (m.per?.power) p += m.per.power * perCount(m.per, state, reg, inst, ownerId);
  }

  // Upgrades contribute their powerModifier directly to the host's stats.
  p += upgradePowerBonus(reg, inst);

  // Experience tokens: +1 power each (§SWU).
  p += inst.experienceTokens ?? 0;

  // Keyword bonuses (Grit; also any future "bonusPower" keyword).
  // Include keywords granted by upgrades (e.g. an upgrade with Grit).
  const allKeywords = [...cardKeywords(reg, inst), ...upgradeKeywords(reg, inst)];
  for (const kw of allKeywords) {
    const def = KEYWORDS[kw.name];
    if (def?.bonusPower) p += def.bonusPower({ state, reg, inst, owner: ownerId, value: kw.value });
  }

  return Math.max(0, p);
}

export function effectiveHp(
  state: GameState,
  reg: CardRegistry,
  inst: CardInstance,
  ownerId: PlayerId,
): number {
  let h = printedHp(reg, inst);
  for (const m of collectModifiersFor(state, reg, inst.iid, ownerId)) {
    if (m.health) h += m.health;
    if (m.per?.health) h += m.per.health * perCount(m.per, state, reg, inst, ownerId);
  }
  h += upgradeHpBonus(reg, inst);

  // Experience tokens: +1 HP each (§SWU).
  h += inst.experienceTokens ?? 0;
  const allKeywords = [...cardKeywords(reg, inst), ...upgradeKeywords(reg, inst)];
  for (const kw of allKeywords) {
    const def = KEYWORDS[kw.name];
    if (def?.bonusHp) h += def.bonusHp({ state, reg, inst, owner: ownerId, value: kw.value });
  }
  return Math.max(1, h);
}

export function remainingHp(
  state: GameState,
  reg: CardRegistry,
  inst: CardInstance,
  ownerId: PlayerId,
): number {
  return effectiveHp(state, reg, inst, ownerId) - inst.damage;
}

// Effective keyword set = printed + granted via constant-ability modifiers +
// keywords on attached upgrades. Returns names lowercased; numeric values are
// tracked separately via `effectiveKeywordValue`.
export function effectiveKeywords(
  state: GameState,
  reg: CardRegistry,
  inst: CardInstance,
  ownerId: PlayerId,
): Set<string> {
  const out = new Set<string>();
  for (const kw of cardKeywords(reg, inst)) out.add(kw.name);
  for (const kw of upgradeKeywords(reg, inst)) out.add(kw.name);
  for (const m of collectModifiersFor(state, reg, inst.iid, ownerId)) {
    if (m.keyword) out.add(m.keyword.toLowerCase());
    if (m.keywords) for (const k of m.keywords) out.add(k.name.toLowerCase());
    if (m.lose_keyword) out.delete(m.lose_keyword.toLowerCase());
  }
  return out;
}

export function effectiveKeywordValue(
  state: GameState,
  reg: CardRegistry,
  inst: CardInstance,
  ownerId: PlayerId,
  keyword: string,
): number | undefined {
  const want = keyword.toLowerCase();
  let total: number | undefined;
  for (const kw of cardKeywords(reg, inst)) {
    if (kw.name === want && kw.value !== undefined) total = (total ?? 0) + kw.value;
  }
  for (const kw of upgradeKeywords(reg, inst)) {
    if (kw.name === want && kw.value !== undefined) total = (total ?? 0) + kw.value;
  }
  for (const m of collectModifiersFor(state, reg, inst.iid, ownerId)) {
    if (m.keyword?.toLowerCase() === want && m.keyword_value !== undefined) {
      total = (total ?? 0) + m.keyword_value;
    }
    if (m.keywords) {
      for (const k of m.keywords) {
        if (k.name.toLowerCase() === want && k.value !== undefined) total = (total ?? 0) + k.value;
      }
    }
  }
  return total;
}

export function hasEffectiveKeyword(
  state: GameState,
  reg: CardRegistry,
  inst: CardInstance,
  ownerId: PlayerId,
  keyword: string,
): boolean {
  return effectiveKeywords(state, reg, inst, ownerId).has(keyword.toLowerCase());
}
