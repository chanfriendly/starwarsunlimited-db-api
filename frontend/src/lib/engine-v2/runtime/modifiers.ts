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

import type { CardInstance, CardRegistry, GameState, PlayerId } from '../state/types';
import type { LastingEffectRec } from '../state/effects';
import type { Ability, ConstantAbility, KeywordGrant, Modifier } from '../spec/ast';
import { isConstant } from '../spec/ast';
import { isUnit } from '../spec/types';
import { getZoneArr } from '../state/zones';
import { evalCardPredicate, type EvalCtx } from './predicates';
import { resolveSelector } from './selectors';
import { KEYWORDS } from '../primitives/keywords';

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
  return [];
}

// Walk all in-play cards and lasting effects to find modifiers that affect
// the given (targetIid, targetController). Returns a flat array of Modifiers.
function collectModifiersFor(
  state: GameState,
  reg: CardRegistry,
  targetIid: string,
  targetController: PlayerId,
): Modifier[] {
  const mods: Modifier[] = [];

  // (a) Constant abilities on in-play cards
  for (const pid of state.playerOrder) {
    const p = state.players[pid];
    for (const z of ['ground_arena', 'space_arena'] as const) {
      const arr = getZoneArr(p, z);
      for (const source of arr) {
        for (const ab of cardAbilities(reg, source)) {
          if (!isConstant(ab)) continue;
          const ctx: EvalCtx = { state, reg, sourceIid: source.iid, sourcePlayer: pid };
          if (ab.while && !evalSourcePredicate(ab.while, ctx, source, pid)) continue;
          const targets = resolveSelector(ctx, ab.grant.target);
          if (targets.some(t => t.kind === 'unit' && t.iid === targetIid)) {
            mods.push(ab.grant.modifier);
          }
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

export function effectivePower(
  state: GameState,
  reg: CardRegistry,
  inst: CardInstance,
  ownerId: PlayerId,
): number {
  const spec = reg.cards[inst.cardId];
  if (!spec || !isUnit(spec)) return 0;
  let p = spec.power;

  // Modifiers from constants + lasting effects
  for (const m of collectModifiersFor(state, reg, inst.iid, ownerId)) {
    if (m.power) p += m.power;
  }

  // Keyword bonuses (Grit; also any future "bonusPower" keyword)
  for (const kw of cardKeywords(reg, inst)) {
    const def = KEYWORDS[kw.name];
    if (def?.bonusPower) p += def.bonusPower({ state, reg, inst, owner: ownerId, value: kw.value });
  }
  // Coordinate-granted keywords are not yet implemented; effective-keyword
  // aggregation handles that path so a Grit-grant via Coordinate would also
  // surface here once Coordinate ships.

  return Math.max(0, p);
}

export function effectiveHp(
  state: GameState,
  reg: CardRegistry,
  inst: CardInstance,
  ownerId: PlayerId,
): number {
  const spec = reg.cards[inst.cardId];
  if (!spec || !isUnit(spec)) return 1;
  let h = spec.hp;
  for (const m of collectModifiersFor(state, reg, inst.iid, ownerId)) {
    if (m.health) h += m.health;
  }
  for (const kw of cardKeywords(reg, inst)) {
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

// Effective keyword set = printed + granted via constant-ability modifiers.
// Returns the keyword names lowercased; numeric values are tracked separately
// via `effectiveKeywordValue`.
export function effectiveKeywords(
  state: GameState,
  reg: CardRegistry,
  inst: CardInstance,
  ownerId: PlayerId,
): Set<string> {
  const out = new Set<string>();
  for (const kw of cardKeywords(reg, inst)) out.add(kw.name);
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
  for (const kw of cardKeywords(reg, inst)) {
    if (kw.name === want && kw.value !== undefined) return kw.value;
  }
  let total: number | undefined;
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
