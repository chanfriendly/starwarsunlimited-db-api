// Tier-1 deterministic template matcher: card rules text → engine-v2 ability AST.
//
// This is the cheap, stable, zero-token workhorse of the L4 cascade. It
// recognizes the high-frequency SWU text templates and emits validated v2
// abilities; anything it doesn't recognize is left as `residual` (and the card
// gets `abilities: []`, i.e. inert, until Tier 2 / hand-authoring fills it in).
//
// Patterns are ported from the battle-tested v1 parsers (game-engine/
// abilities.ts: parseEventText, parseCoordinateText) with the output retargeted
// from v1 effect objects to v2 AST `Effect`/`Ability` shapes.
//
// IMPORTANT — coverage is bounded by two things, not one:
//   1. text-pattern recognition (this file), and
//   2. which primitives the engine actually implements.
// A card whose text we recognize but which needs an unimplemented primitive
// (Force tokens, Experience tokens, return-to-hand/bounce, mill, modal
// "choose two") is NOT matchable yet — it's reported as `none`/`partial` with
// the residual clause, which is exactly the signal for what to build next.

import type { Ability, Effect, Selector, Predicate, Modifier, AspectIcon } from '@/lib/engine-v2';
import { TOKEN_REGISTRY } from '@/lib/engine-v2';

/** Map a token name as printed on cards ("Clone Trooper", "X-Wing") to its
 *  registry key ("clone_trooper", "x_wing"). Returns the key only if it's a
 *  known *unit* token with an arena (Battle Droid / Clone Trooper / TIE Fighter
 *  / X-Wing / Spy). Experience/Shield are handled by give_experience/give_shield,
 *  not create_token. */
function unitTokenKey(name: string): string | null {
  const key = name.trim().toLowerCase().replace(/[\s-]+/g, '_');
  const spec = TOKEN_REGISTRY[key];
  if (spec && spec.tokenType === 'unit' && spec.arena) return key;
  return null;
}

// A backend-shaped card is all this needs (subset of the `Card` type). Kept
// local + structural so the matcher works against DB rows or API objects alike.
export interface MatchableCard {
  name: string;
  type?: string;            // Title-case from DB: 'Unit' | 'Event' | ...
  text?: string | null;
  keywords?: string[];      // names from card_keywords
}

export type Coverage = 'vanilla' | 'full' | 'partial' | 'none';

export interface MatchResult {
  abilities: Ability[];
  coverage: Coverage;
  matchedClauses: number;
  totalClauses: number;
  residual: string[];       // clauses the matcher couldn't handle
}

// ---------------------------------------------------------------------------
// Reusable v2 selectors
// ---------------------------------------------------------------------------

const chosenEnemyUnit: Selector = { zone: 'any_arena', controller: 'opponent', selector: 'chosen', count: 1 };
const chosenFriendlyUnit: Selector = { zone: 'any_arena', controller: 'self', selector: 'chosen', count: 1 };
const chosenAnyUnit: Selector = { zone: 'any_arena', controller: 'any', selector: 'chosen', count: 1 };
const chosenEnemyNonLeader: Selector = {
  zone: 'any_arena', controller: 'opponent', selector: 'chosen', count: 1,
  filter: { not: { card_type: 'leader' } },
};
const opponentBase: Selector = { opponent_base: true };
const selfBase: Selector = { self_base: true };

// SWU keyword names whose entire clause is "covered" by the keyword table (so
// it doesn't count as unmatched rules text). Not all are implemented in the
// engine — the validator warns separately on unimplemented ones — but for
// text-coverage purposes a bare keyword clause is not residual.
const KEYWORD_WORDS = new Set([
  'ambush', 'bounty', 'coordinate', 'grit', 'hidden', 'overwhelm', 'pilot',
  'piloting', 'plot', 'raid', 'restore', 'saboteur', 'sentinel', 'shielded',
  'smuggle', 'exploit', 'leader',
]);

// ---------------------------------------------------------------------------
// Clause-level effect parser (ported from v1 parseEventText, → v2 Effect)
// ---------------------------------------------------------------------------

/** Map a target phrase from Experience/buff text to a chosen-unit selector.
 *  Experience is always a friendly buff in practice, so unqualified / trait
 *  targets default to controller 'self'; only an explicit "enemy" flips it. */
function experienceTargetSelector(phrase: string): Selector {
  const p = phrase.trim().toLowerCase().replace(/\.$/, '');
  if (/^this (unit|leader)$/.test(p)) return { self: true };
  // "that friendly unit" / "that unit" — the unit named by the trigger (for
  // attack-and-defeat triggers, the attacker). Resolves via trigger_source.
  if (/^that (?:friendly )?unit$/.test(p)) return { trigger_source: true };
  const enemy = /\benemy\b/.test(p);
  const controller = enemy ? 'opponent' : 'self';
  // Trait qualifier: "an Imperial unit", "a Trooper unit" → card_trait filter.
  const traitMatch = phrase.match(/\b(?:an?|another)\s+([A-Z][A-Za-z]+)\s+unit/);
  const trait = traitMatch && !/^(Enemy|Friendly)$/i.test(traitMatch[1]) ? traitMatch[1].toLowerCase() : undefined;
  // Cost qualifier: "that costs N or less".
  const costMatch = p.match(/costs (\d+) or less/);
  const filterParts: Predicate[] = [];
  if (trait) filterParts.push({ card_trait: trait });
  if (costMatch) filterParts.push({ card_cost: { max: parseInt(costMatch[1], 10) } });
  const filter: Predicate | undefined =
    filterParts.length === 0 ? undefined : filterParts.length === 1 ? filterParts[0] : { and: filterParts };
  const sel: Selector = { zone: 'any_arena', controller, selector: 'chosen', count: 1 };
  return filter ? { ...sel, filter } : sel;
}

/** Parse a single imperative clause into one v2 Effect, or null if unrecognized. */
export function parseEffectClause(raw: string): Effect | null {
  const t = raw.trim().replace(/\s+/g, ' ');

  let m: RegExpMatchArray | null;

  // Use the Force. If you do, <effect>. The reminder "(lose your Force token)"
  // is stripped to a space, leaving "Use the Force . If you do, …" — hence the
  // tolerant whitespace/period between "Force" and "If you do".
  if ((m = t.match(/^Use the Force\s*\.?\s*If you do,?\s*(.+)$/i))) {
    const inner = parseEffectClause(m[1].trim());
    return inner ? { effect: 'use_force', do: inner } : null;
  }

  // The Force is with you. (gain a Force token; reminder already stripped.)
  if (/^The Force is with you\s*\.?$/i.test(t)) {
    return { effect: 'gain_force', player: 'self' };
  }

  // Put this <card> into play as a resource [and ready it]. Two shapes:
  //   • Resupply (event) — the event becomes a resource instead of discarding.
  //   • Superlaser Technician (unit, When Defeated) — the defeated unit moves
  //     from the discard pile to the resource zone "and ready it" (enters ready,
  //     the exception to §2046's exhausted default).
  if ((m = t.match(/^Put this (?:event|card|unit) into play as a resource( and ready it)?\.?$/i))) {
    return m[1] ? { effect: 'play_as_resource', ready: true } : { effect: 'play_as_resource' };
  }

  // Ready this unit. (self)
  if (/^Ready this unit\.?$/i.test(t)) {
    return { effect: 'ready', target: { self: true } };
  }

  // Ready attached unit. (an upgrade readies its host — The Darksaber.)
  if (/^Ready attached unit\.?$/i.test(t)) {
    return { effect: 'ready', target: { attached_to_self: true } };
  }

  // The next unit you play this phase costs N resources less. (one-shot,
  // phase-scoped play-cost discount — General's Blade's granted On-Attack.)
  if ((m = t.match(/^The next unit you play this phase costs (\d+) resources? less\.?$/i))) {
    return { effect: 'discount', amount: parseInt(m[1], 10), card_type: 'unit' };
  }

  // Search the top N cards of your deck for any number of [<Aspect/Trait>] units
  // with combined cost M or less and play each of them for free. (Darth Vader —
  // Commanding the First Legion.) The aspect/trait qualifier is optional.
  if ((m = t.match(/^Search the top (\d+) cards of your deck for any number of (?:\[?([A-Za-z]+)\]? )?units with combined cost (\d+) or less and play each of them for free\.?$/i))) {
    const parts: Predicate[] = [{ card_type: 'unit' }];
    if (m[2] && !/^(?:friendly|enemy)$/i.test(m[2])) parts.push(aspectOrTrait(m[2]));
    return {
      effect: 'search_play',
      count: parseInt(m[1], 10),
      filter: parts.length === 1 ? parts[0] : { and: parts },
      max_combined_cost: parseInt(m[3], 10),
    };
  }

  // Exhaust this unit/leader. (self — used as a self-cost in "You may exhaust
  // this leader. If you do, …"). Exhausting an already-exhausted source no-ops,
  // so the if_did "then" correctly won't fire when the cost can't be paid.
  if (/^Exhaust this (?:unit|leader)\.?$/i.test(t)) {
    return { effect: 'exhaust', target: { self: true } };
  }

  // Multi-attack (§ sequential attacks). "This unit attacks again." (1 more),
  // "This unit attacks twice." (2 total), "This unit attacks N times."
  // All map to the source unit making sequential nested attacks.
  if (/^This unit attacks again\.?$/i.test(t)) {
    return { effect: 'attack', attacker: { self: true }, count: 1 };
  }
  if (/^This unit attacks twice\.?$/i.test(t)) {
    return { effect: 'attack', attacker: { self: true }, count: 2 };
  }
  if ((m = t.match(/^This unit attacks (\d+) times\.?$/i))) {
    return { effect: 'attack', attacker: { self: true }, count: parseInt(m[1], 10) };
  }

  // "Attack with a unit [that costs N or less]. [It gets +A/+B [and gains K] for
  // this attack.]" — the controller chooses a READY friendly unit to attack with
  // (you can only attack with a ready unit), optionally buffed for that attack.
  // (The biggest matcher overlap in the corpus — 37 cards. Variants with a
  // conditional buff or a post-attack rider stay residual.)
  {
    const head = t.match(/^Attack with a unit(?: that costs (\d+) or less)?\.\s*(.*)$/i);
    if (head) {
      const filterParts: Predicate[] = [{ self_exhausted: false }];
      if (head[1]) filterParts.push({ card_cost: { max: parseInt(head[1], 10) } });
      const attacker: Selector = {
        zone: 'any_arena', controller: 'self', selector: 'chosen', count: 1,
        filter: filterParts.length === 1 ? filterParts[0] : { and: filterParts },
      };
      const eff: Extract<Effect, { effect: 'attack' }> = { effect: 'attack', attacker };
      const rider = head[2].trim();
      if (rider === '') return eff; // bare "Attack with a unit."

      // Rider A — attacker buff, optionally gated on the attacker's identity
      // ("If it's an Imperial unit, …"). The "If it's a/an" guard excludes the
      // defender-condition form ("If it's attacking a unit").
      let rm: RegExpMatchArray | null;
      if ((rm = rider.match(/^(?:If it's an? (.+?), )?It gets \+(\d+)\/\+(\d+)(?: and gains ([A-Za-z]+)(?:\s+(\d+))?)? for this attack\.?$/i))) {
        const buff: Modifier = { power: parseInt(rm[2], 10), health: parseInt(rm[3], 10) };
        if (rm[4]) {
          const kw = rm[4].toLowerCase();
          if (!KEYWORD_WORDS.has(kw)) return null; // unknown granted keyword → residual
          buff.keyword = kw;
          if (rm[5]) buff.keyword_value = parseInt(rm[5], 10);
        }
        eff.attacker_buff = buff;
        if (rm[1]) {
          const cond = parseHostCondition(rm[1]);
          if (!cond) return null;
          eff.attacker_buff_if = cond;
        }
        return eff;
      }
      // Rider B — defender debuff ("The defender gets -N/-0 for this attack").
      // Dash may be hyphen-minus, en-dash, or em-dash.
      if ((rm = rider.match(/^The defender gets [-–—](\d+)\/[-–—](\d+) for this attack\.?$/i))) {
        eff.defender_debuff = { power: -parseInt(rm[1], 10), health: -parseInt(rm[2], 10) };
        return eff;
      }
      // Unrecognized rider → fall through (residual), don't fake coverage.
    }
  }

  // if_did conditional compounds (NOT the Force form, matched above). The `do`
  // half is often "You may …" → optional. ALL referenced halves must template,
  // else the clause falls through and stays residual (no half-match misfire).
  // "do not" contains "do", so the do-not forms are checked FIRST.
  // "If there are N or more different keywords among friendly units, <effect>."
  // → an `if` gated on the distinct-keyword count (The Darksaber).
  if ((m = t.match(/^If there are (\d+) or more different keywords among friendly units, (.+)$/i))) {
    const effText = m[2].trim();
    const opt = /^You may /i.test(effText);
    const inner = parseEffectClause(effText.replace(/^You may /i, ''));
    if (!inner) return null;
    return { effect: 'if', condition: { controller_distinct_keywords: { min: parseInt(m[1], 10) } }, then: opt ? { effect: 'optional', do: inner } : inner };
  }

  // "If a [friendly] unit left play this phase, <effect>." → an `if` gated on the
  // leftPlayThisPhase tracker. (Check before the "If you control …" template.)
  if ((m = t.match(/^If an? (friendly )?unit left play this phase, (.+)$/i))) {
    const scope = m[1] ? 'friendly' : 'any';
    const effText = m[2].trim();
    const opt = /^You may /i.test(effText);
    const inner = parseEffectClause(effText.replace(/^You may /i, ''));
    if (!inner) return null;
    return { effect: 'if', condition: { unit_left_play_this_phase: scope }, then: opt ? { effect: 'optional', do: inner } : inner };
  }

  // "If you control [another] [<Trait/Aspect/damaged/exhausted>] unit, <effect>."
  // → an `if` gated on the new controller_controls predicate. The inner effect
  // must itself parse (a leading "you may" wraps it as optional). (Distinct from
  // the "<do>. If you do, …" if_did compounds below — this one STARTS the clause.)
  if ((m = t.match(/^If you control (another |an? )(?:([A-Za-z]+) )?unit, (.+)$/i))) {
    const another = /another/i.test(m[1]);
    const word = m[2];
    const cc: { filter?: Predicate; exclude_self?: boolean } = {};
    if (word && !/^friendly$/i.test(word)) {
      const w = word.toLowerCase();
      if (w === 'ground' || w === 'space') return null;           // arena conditions not modeled
      else if (w === 'damaged') cc.filter = { self_damage: { min: 1 } };
      else if (w === 'exhausted') cc.filter = { self_exhausted: true };
      else cc.filter = aspectOrTrait(word);
    }
    if (another) cc.exclude_self = true;
    const effText = m[3].trim();
    const opt = /^You may /i.test(effText);
    const inner = parseEffectClause(effText.replace(/^You may /i, ''));
    if (!inner) return null; // inner effect must parse or the whole clause is residual
    return { effect: 'if', condition: { controller_controls: cc }, then: opt ? { effect: 'optional', do: inner } : inner };
  }

  {
    const parseDo = (raw: string): { do: Effect } | null => {
      const s = raw.trim();
      const opt = /^You may /i.test(s);
      const inner = parseEffectClause(s.replace(/^You may /i, ''));
      return inner ? { do: opt ? { effect: 'optional', do: inner } : inner } : null;
    };

    // "<do>. If you do, <then>. If you do not, <else>." (both branches)
    if ((m = t.match(/^(.+?)\.\s*If you do,?\s+(.+?)\.\s*If you do(?:\s+not|n['’]t),?\s+(.+)$/i))) {
      const d = parseDo(m[1]);
      const thenEff = parseEffectClause(m[2].trim());
      const elseEff = parseEffectClause(m[3].trim());
      if (d && thenEff && elseEff) return { effect: 'if_did', do: d.do, then: thenEff, else_: elseEff };
    }

    // "<do>. If you do not, <else>." (else branch only)
    if ((m = t.match(/^(.+?)\.\s*If you do(?:\s+not|n['’]t),?\s+(.+)$/i))) {
      const d = parseDo(m[1]);
      const elseEff = parseEffectClause(m[2].trim());
      if (d && elseEff) return { effect: 'if_did', do: d.do, else_: elseEff };
    }

    // "<do>. If you do, <then>." (then branch only)
    if ((m = t.match(/^(.+?)\.\s*If you do,?\s+(.+)$/i))) {
      const d = parseDo(m[1]);
      const thenEff = parseEffectClause(m[2].trim());
      if (d && thenEff) return { effect: 'if_did', do: d.do, then: thenEff };
    }
  }

  // Give an/N Experience token(s) to each of up to N <trait> units.
  if ((m = t.match(/^Give an? Experience token to each of up to (\d+) (.+?)\.?$/i))) {
    const cap = parseInt(m[1], 10);
    const traitMatch = m[2].match(/([A-Za-z]+) units?$/);
    const trait = traitMatch ? traitMatch[1].toLowerCase() : undefined;
    const base: Selector = { zone: 'any_arena', controller: 'self', selector: 'chosen', count: { min: 0, max: cap } };
    const target: Selector = trait && trait !== 'friendly' ? { ...base, filter: { card_trait: trait } } : base;
    return { effect: 'give_experience', target, count: 1 };
  }

  // Give an/N Experience token(s) to <target>.
  if ((m = t.match(/^Give (an?|\d+) Experience tokens? to (.+?)\.?$/i))) {
    const count = /^\d+$/.test(m[1]) ? parseInt(m[1], 10) : 1;
    return { effect: 'give_experience', target: experienceTargetSelector(m[2]), count };
  }

  // Create a/N Credit token(s). (one-shot resource tokens, not unit tokens.)
  if ((m = t.match(/^Create (an?|\d+) Credit tokens?\.?$/i))) {
    return { effect: 'create_credit', player: 'self', count: /^\d+$/.test(m[1]) ? parseInt(m[1], 10) : 1 };
  }

  // Create a/N <TokenName> token(s). (unit tokens only — Battle Droid, Clone
  // Trooper, TIE Fighter, X-Wing, Spy; the token's arena sets the zone.)
  if ((m = t.match(/^Create (an?|\d+) (.+?) tokens?\.?$/i))) {
    const count = /^\d+$/.test(m[1]) ? parseInt(m[1], 10) : 1;
    const key = unitTokenKey(m[2]);
    if (key) {
      const spec = TOKEN_REGISTRY[key];
      const zone = spec.arena === 'space' ? 'space_arena' : 'ground_arena';
      return { effect: 'create_token', token_id: key, controller: 'self', zone, count };
    }
    return null; // unknown / non-unit token → residual
  }

  // Draw N card(s) / Draw a card.  ("a"/"an" = 1)
  if ((m = t.match(/^Draw (a|an|\d+) cards?\.?$/i))) {
    return { effect: 'draw', player: 'self', count: /^\d+$/.test(m[1]) ? parseInt(m[1], 10) : 1 };
  }

  // Deal N damage to a unit or base.
  if ((m = t.match(/^Deal (\d+) damage to a unit or base\.?$/i))) {
    return { effect: 'damage', amount: parseInt(m[1], 10), target: { zone: 'any_arena', controller: 'any', selector: 'chosen', count: 1 } };
  }

  // Deal N damage to an [enemy] [ground|space] unit. (single chosen target,
  // optional controller + arena scope.)
  if ((m = t.match(/^Deal (\d+) damage to an? (enemy )?(ground |space )?unit\.?$/i))) {
    if (!m[2] && !m[3]) return { effect: 'damage', amount: parseInt(m[1], 10), target: chosenAnyUnit };
    const controller = m[2] ? 'opponent' : 'any';
    const zone = m[3] ? (/ground/i.test(m[3]) ? 'ground_arena' : 'space_arena') : 'any_arena';
    return { effect: 'damage', amount: parseInt(m[1], 10), target: { zone, controller, selector: 'chosen', count: 1 } };
  }

  // Deal N damage to (the opponent's / the enemy / your opponent's) base.
  if ((m = t.match(/^Deal (\d+) damage to (?:your opponent's|the opponent's|the enemy) base\.?$/i))) {
    return { effect: 'damage', amount: parseInt(m[1], 10), target: opponentBase };
  }

  // Deal N damage to its controller's base. (contextual — the controller of the
  // unit named by the trigger, e.g. "when an enemy unit is defeated: …".)
  if ((m = t.match(/^Deal (\d+) damage to its controller['’]?s base\.?$/i))) {
    return { effect: 'damage', amount: parseInt(m[1], 10), target: { trigger_controller_base: true } };
  }

  // Deal N damage to a base. (the player chooses any base — default = opponent's.)
  if ((m = t.match(/^Deal (\d+) damage to a base\.?$/i))) {
    return { effect: 'damage', amount: parseInt(m[1], 10), target: { chosen_base: true } };
  }

  // Deal N damage to your base.
  if ((m = t.match(/^Deal (\d+) damage to your base\.?$/i))) {
    return { effect: 'damage', amount: parseInt(m[1], 10), target: selfBase };
  }

  // Deal N damage to each base. → both bases.
  if ((m = t.match(/^Deal (\d+) damage to each base\.?$/i))) {
    const n = parseInt(m[1], 10);
    return { effect: 'sequence', steps: [
      { effect: 'damage', amount: n, target: opponentBase },
      { effect: 'damage', amount: n, target: selfBase },
    ] };
  }

  // Deal N damage to this unit. (self damage)
  if ((m = t.match(/^Deal (\d+) damage to this unit\.?$/i))) {
    return { effect: 'damage', amount: parseInt(m[1], 10), target: { self: true } };
  }

  // Deal N damage to each of up to M [enemy] units. (chosen up-to-M, each takes N)
  if ((m = t.match(/^Deal (\d+) damage to each of up to (\d+) (enemy )?units\.?$/i))) {
    const controller = m[3] ? 'opponent' : 'any';
    return { effect: 'damage', amount: parseInt(m[1], 10), target: { zone: 'any_arena', controller, selector: 'chosen', count: { min: 0, max: parseInt(m[2], 10) } } };
  }

  // Deal N damage to each [enemy|friendly] [non-leader] [ground|space] unit. (AOE)
  if ((m = t.match(/^Deal (\d+) damage to each (enemy |friendly )?(non-leader )?(ground |space )?unit\.?$/i))) {
    const controller = m[2] ? (/enemy/i.test(m[2]) ? 'opponent' : 'self') : 'any';
    const zone = m[4] ? (/ground/i.test(m[4]) ? 'ground_arena' : 'space_arena') : 'any_arena';
    const base: Selector = { zone, controller };
    const target: Selector = m[3] ? { ...base, filter: { not: { card_type: 'leader' } } } : base;
    return { effect: 'damage', amount: parseInt(m[1], 10), target };
  }

  // This unit deals damage equal to its/his/her power to an (enemy) (ground|space) unit.
  if ((m = t.match(/^This unit deals damage equal to (?:its|his|her|their) power to an? (enemy )?(ground |space )?unit\.?$/i))) {
    const controller = m[1] ? 'opponent' : 'any';
    const zone = m[2] ? (/ground/i.test(m[2]) ? 'ground_arena' : 'space_arena') : 'any_arena';
    return { effect: 'damage', amountFromPower: { self: true }, target: { zone, controller, selector: 'chosen', count: 1 } };
  }

  // Focus Fire: "Choose a unit. Each friendly <Trait> unit in the same arena
  // deals damage equal to its power to that unit." (every matching source.)
  if ((m = t.match(/^Choose a unit\. Each friendly ([A-Za-z]+) unit in the same arena deals damage equal to its power to that unit\.?$/i))) {
    return {
      effect: 'power_damage_from_each',
      target: { zone: 'any_arena', controller: 'any', selector: 'chosen', count: 1 },
      sources: { zone: 'any_arena', controller: 'self', filter: { card_trait: m[1].toLowerCase() } },
      sources_same_arena_as_target: true,
    };
  }

  // A friendly [<Trait>] unit deals damage equal to its power to a[n] [non-unique] [enemy] unit. (one chosen source)
  if ((m = t.match(/^A friendly (?:([A-Za-z]+) )?unit deals damage equal to its power to an? (non-unique )?(enemy )?unit\.?$/i))) {
    const srcTrait = m[1] && m[1].toLowerCase() !== 'friendly' ? m[1].toLowerCase() : undefined;
    const sources: Selector = srcTrait
      ? { zone: 'any_arena', controller: 'self', selector: 'chosen', count: 1, filter: { card_trait: srcTrait } }
      : { zone: 'any_arena', controller: 'self', selector: 'chosen', count: 1 };
    const tgtController = m[3] ? 'opponent' : 'any';
    const target: Selector = m[2]
      ? { zone: 'any_arena', controller: tgtController, selector: 'chosen', count: 1, filter: { card_is_unique: false } }
      : { zone: 'any_arena', controller: tgtController, selector: 'chosen', count: 1 };
    return { effect: 'power_damage_from_each', sources, target };
  }

  // Heal N damage from your/a base.
  if ((m = t.match(/^Heal (\d+) damage from (?:your|a) base\.?$/i))) {
    return { effect: 'heal', amount: parseInt(m[1], 10), target: selfBase };
  }

  // Give a [friendly] [<Trait>] unit +N/+N for this phase. (trait optional)
  if ((m = t.match(/^Give an? (?:friendly )?(?:([A-Za-z]+) )?unit \+(\d+)\/\+(\d+) for this phase\.?$/i))) {
    const trait = m[1] && m[1].toLowerCase() !== 'friendly' ? m[1].toLowerCase() : undefined;
    const target: Selector = trait ? { ...chosenFriendlyUnit, filter: { card_trait: trait } } : chosenFriendlyUnit;
    return { effect: 'give', target, modifier: { power: +m[2], health: +m[3], duration: 'end_of_phase' } };
  }

  // Ready a [friendly] [<qualifier>] unit. (qualifier filter dropped — best-effort)
  if ((m = t.match(/^Ready an? (?:friendly )?(?:\[?[A-Za-z]+\]? )?unit\.?$/i))) {
    return { effect: 'ready', target: chosenFriendlyUnit };
  }

  // Heal N damage from a [friendly] unit [or base].  (base option dropped — heals a friendly unit)
  if ((m = t.match(/^Heal (\d+) damage from an? (?:friendly )?unit(?: or base)?\.?$/i))) {
    return { effect: 'heal', amount: parseInt(m[1], 10), target: chosenFriendlyUnit };
  }

  // Deal N indirect damage to a player / the defending player / each opponent
  // (§8.35): the opponent assigns N among their base + units. (Trailing
  // parenthetical reminder text is already stripped by stripReminders upstream.)
  if ((m = t.match(/^Deal (\d+) indirect damage to (?:the defending player|a player|your opponent|the opponent|each opponent)\.?$/i))) {
    return { effect: 'indirect_damage', amount: parseInt(m[1], 10), player: 'opponent' };
  }

  // Deal N damage to a friendly [ground|space] unit and M damage to an enemy
  // [ground|space] unit. (Death Trooper) — a sequence of two chosen-target hits.
  if ((m = t.match(/^Deal (\d+) damage to a friendly (ground |space )?unit and (\d+) damage to an enemy (ground |space )?unit\.?$/i))) {
    const zoneOf = (g?: string) => !g ? ('any_arena' as const) : (/space/i.test(g) ? ('space_arena' as const) : ('ground_arena' as const));
    return { effect: 'sequence', steps: [
      { effect: 'damage', amount: parseInt(m[1], 10), target: { zone: zoneOf(m[2]), controller: 'self', selector: 'chosen', count: 1 } },
      { effect: 'damage', amount: parseInt(m[3], 10), target: { zone: zoneOf(m[4]), controller: 'opponent', selector: 'chosen', count: 1 } },
    ] };
  }

  // Give an (enemy) unit -N/-N for this phase. (en-dash, em-dash, or hyphen)
  if ((m = t.match(/^Give an? (enemy )?unit [–—-](\d+)\/[–—-](\d+) for this phase\.?$/i))) {
    return { effect: 'give', target: m[1] ? chosenEnemyUnit : chosenFriendlyUnit, modifier: { power: -parseInt(m[2], 10), health: -parseInt(m[3], 10), duration: 'end_of_phase' } };
  }

  // Exhaust an (enemy) (ground|space) unit.
  if ((m = t.match(/^Exhaust an? (?:enemy )?(?:ground |space )?unit\.?$/i))) {
    return { effect: 'exhaust', target: chosenEnemyUnit };
  }

  // Exhaust the defender. (On-Attack context — the unit being attacked. Vambrace
  // Grappleshot, as an upgrade-granted ability.)
  if (/^Exhaust the defender\.?$/i.test(t)) {
    return { effect: 'exhaust', target: { trigger_defender: true } };
  }

  // Exhaust a unit in attached unit's arena. (an upgrade's When-Played — Nimble
  // Prowess; any unit in the same arena as the host.)
  if (/^Exhaust a unit in attached unit['’]s arena\.?$/i.test(t)) {
    return { effect: 'exhaust', target: { zone: 'host_arena', controller: 'any', selector: 'chosen', count: 1 } };
  }

  // Give a Shield token to a friendly unit and to an enemy unit. (compound)
  if ((m = t.match(/^Give a Shield token to a friendly unit and to an enemy unit\.?$/i))) {
    return { effect: 'sequence', steps: [
      { effect: 'give_shield', target: chosenFriendlyUnit, count: 1 },
      { effect: 'give_shield', target: chosenEnemyUnit, count: 1 },
    ] };
  }

  // Give a/N Shield token(s) to a (friendly) unit.
  if ((m = t.match(/^Give (?:\d+|a) Shield tokens? to a (?:friendly )?unit\.?$/i))) {
    return { effect: 'give_shield', target: chosenFriendlyUnit, count: 1 };
  }

  // Defeat a non-leader unit.
  if ((m = t.match(/^Defeat a non-leader unit\.?$/i))) {
    return { effect: 'defeat', target: chosenEnemyNonLeader };
  }

  // "An opponent chooses a unit they control. Defeat that unit." (Power of the
  // Dark Side) — the OPPONENT picks which of their own units dies, via the
  // existing opponent_choose selector. No filter (leaders are eligible; a leader
  // unit flips back instead of dying, handled by the state-based loop).
  if (/^An opponent chooses a unit they control\.?\s*Defeat that unit\.?$/i.test(t)) {
    return { effect: 'defeat', target: { zone: 'any_arena', controller: 'opponent', selector: 'opponent_choose', count: 1 } };
  }

  // Defeat an enemy unit with a Shield token on it.
  if ((m = t.match(/^Defeat an enemy unit with a Shield token on it\.?$/i))) {
    return { effect: 'defeat', target: { zone: 'any_arena', controller: 'opponent', selector: 'chosen', count: 1, filter: { has_shield_token: true } } };
  }

  // Defeat a[n] [enemy] [non-leader] [ground|space] unit with N or less remaining HP.
  if ((m = t.match(/^Defeat an? (enemy )?(non-leader )?(ground |space )?unit with (\d+) or less remaining hp\.?$/i))) {
    const controller = m[1] ? 'opponent' : 'any';
    const zone = m[3] ? (/ground/i.test(m[3]) ? 'ground_arena' : 'space_arena') : 'any_arena';
    const parts: Predicate[] = [{ remaining_hp: { max: parseInt(m[4], 10) } }];
    if (m[2]) parts.push({ not: { card_type: 'leader' } });
    const filter: Predicate = parts.length === 1 ? parts[0] : { and: parts };
    return { effect: 'defeat', target: { zone, controller, selector: 'chosen', count: 1, filter } };
  }

  // Return a [enemy|friendly] [non-leader] unit [that costs N or less] to its owner's hand. (arena → hand bounce)
  if ((m = t.match(/^Return an? (enemy |friendly )?(non-leader )?unit(?: that costs (\d+) or less)? to (?:its|their) owner['’]?s hand\.?$/i))) {
    const controller = m[1] ? (/enemy/i.test(m[1]) ? 'opponent' : 'self') : 'any';
    const parts: Predicate[] = [];
    if (m[2]) parts.push({ not: { card_type: 'leader' } });
    if (m[3]) parts.push({ card_cost: { max: parseInt(m[3], 10) } });
    const base: Selector = { zone: 'any_arena', controller, selector: 'chosen', count: 1 };
    const target: Selector = parts.length === 0 ? base
      : { ...base, filter: parts.length === 1 ? parts[0] : { and: parts } };
    return { effect: 'return_to_hand', target };
  }

  // Return this unit / him / her / them / it to its owner's hand. (self bounce)
  if ((m = t.match(/^Return (?:this unit|him|her|them|it) to (?:its|his|her|their) owner['’]?s hand\.?$/i))) {
    return { effect: 'return_to_hand', target: { self: true } };
  }

  // Take control of a[n] [enemy] [non-leader] [ground|space] unit [that costs N or less]. (§8.28)
  if ((m = t.match(/^Take control of an? (enemy )?(non-leader )?(ground |space )?unit(?: that costs (\d+) or less)?\.?$/i))) {
    const controller = m[1] ? 'opponent' : 'any';
    const zone = m[3] ? (/ground/i.test(m[3]) ? 'ground_arena' : 'space_arena') : 'any_arena';
    const parts: Predicate[] = [];
    if (m[2]) parts.push({ not: { card_type: 'leader' } });
    if (m[4]) parts.push({ card_cost: { max: parseInt(m[4], 10) } });
    const base: Selector = { zone, controller, selector: 'chosen', count: 1 };
    const target: Selector = parts.length === 0 ? base
      : { ...base, filter: parts.length === 1 ? parts[0] : { and: parts } };
    return { effect: 'take_control', target };
  }

  // "Choose a friendly non-leader unit and an enemy non-leader unit. Exchange
  // control of those units." (Choose Sides) — a two-way control swap. Both are
  // mandatory single chosen targets; "non-leader" is enforced as a filter.
  if (/^Choose a friendly (non-leader )?unit and an enemy (non-leader )?unit\.\s*Exchange control of those units\.?$/i.test(t)) {
    const nonLeader: Predicate = { not: { card_type: 'leader' } };
    const friendly: Selector = { zone: 'any_arena', controller: 'self', selector: 'chosen', count: 1, filter: nonLeader };
    const enemy: Selector = { zone: 'any_arena', controller: 'opponent', selector: 'chosen', count: 1, filter: nonLeader };
    return { effect: 'exchange_control', friendly, enemy };
  }

  // Return a [Trait] unit [that costs N or less] from your discard pile to your
  // hand. (discard-pile recursion — distinct from bounce, which moves an
  // in-play unit. "your discard pile" → player: 'self'; restrict to units.)
  if ((m = t.match(/^Return an? (?:([A-Za-z]+) )?unit(?: that costs (\d+) or less)? from your discard pile to your hand\.?$/i))) {
    const trait = m[1] && m[1].toLowerCase() !== 'friendly' ? m[1].toLowerCase() : undefined;
    const parts: Predicate[] = [{ card_type: 'unit' }];
    if (trait) parts.push({ card_trait: trait });
    if (m[2]) parts.push({ card_cost: { max: parseInt(m[2], 10) } });
    return { effect: 'return_from_discard', player: 'self', filter: parts.length === 1 ? parts[0] : { and: parts }, count: 1 };
  }

  // This unit gets +N/+N for this phase. (self phase buff — action bodies)
  if ((m = t.match(/^This unit gets \+(\d+)\/\+(\d+) for this phase\.?$/i))) {
    return { effect: 'give', target: { self: true }, modifier: { power: +m[1], health: +m[2], duration: 'end_of_phase' } };
  }

  return null;
}

/** Parse a modal "Choose one:" / "Choose two, in any order:" block into a
 *  `choose_one` effect (with `count`). Options are newline-delimited effect
 *  clauses (the DB sometimes wraps them in `<bullet>…</bullet>`). Returns null
 *  unless EVERY option parses — a modal with an unsupported option stays
 *  residual rather than silently dropping a mode. */
export function parseModalEffect(raw: string): Effect | null {
  const m = raw.trim().match(/^Choose (one|two)(?:,? in any order)?:\s*([\s\S]+)$/i);
  if (!m) return null;
  const count = m[1].toLowerCase() === 'two' ? 2 : 1;
  const body = m[2].replace(/<\/?bullet>/gi, '\n');
  const optionTexts = body
    .split(/\r?\n/)
    .map(s => s.replace(/^[•\-*\s]+/, '').trim())
    // Strip parenthetical reminder text per option (e.g. "Use the Force
    // (lose your Force token).") — the same normalization clausesOf() applies
    // to the normal clause path. Without it, a reminder mid-option defeats the
    // effect template and — since one unparsed mode voids the whole modal —
    // silently turns a fully-supported card into a no-op (Shatterpoint).
    .map(stripReminders)
    .filter(Boolean);
  if (optionTexts.length < 2) return null;
  const options: Array<{ label: string; value: string; do: Effect }> = [];
  for (let i = 0; i < optionTexts.length; i++) {
    const eff = parseEffectClause(optionTexts[i].replace(/^You may /i, ''));
    if (!eff) return null; // an unparseable mode → leave the whole modal residual
    options.push({ label: optionTexts[i], value: `opt${i}`, do: eff });
  }
  return { effect: 'choose_one', count, options };
}

// ---------------------------------------------------------------------------
// Triggered-prefix detection (units): "When Played:", "On Attack:", etc.
// ---------------------------------------------------------------------------

type TrigOn = 'event.card_played' | 'event.attack_declared' | 'event.attack_ended' | 'event.defeated';
interface TrigPrefix {
  re: RegExp;
  on: TrigOn;
  /** explicit `where` override; when absent, a sensible self-based default is used */
  where?: { card?: 'self'; attacker?: 'self'; defender?: 'self'; controller?: 'self' | 'opponent'; defender_defeated?: boolean };
}

const TRIGGER_PREFIXES: TrigPrefix[] = [
  { re: /^When Played:\s*/i,   on: 'event.card_played' },
  { re: /^On Attack:\s*/i,     on: 'event.attack_declared' },
  // "When this unit is attacked" — this unit is the DEFENDER of an attack.
  // Must precede On Attack? No — distinct prefix. Maps to attack_declared with
  // defender: 'self' (the engine fires attack triggers for both attacker and
  // defender; the where-predicate disambiguates).
  { re: /^When this unit is attacked:\s*/i, on: 'event.attack_declared', where: { defender: 'self' } },
  // "When a friendly unit attacks and defeats a unit" / "When this unit attacks
  // and defeats a unit" — fires on attack RESOLUTION (attack_ended) where the
  // attack defeated the defending unit. "that friendly unit" / "this unit" is the
  // attacker (trigger_source). Must precede the bare On Attack prefix.
  { re: /^When a(?:nother)? friendly unit attacks and defeats a unit:\s*/i, on: 'event.attack_ended', where: { controller: 'self', defender_defeated: true } },
  { re: /^When this unit attacks and defeats a unit:\s*/i, on: 'event.attack_ended', where: { attacker: 'self', defender_defeated: true } },
  // "When [an] enemy/friendly unit is defeated" — defeat of ANOTHER unit,
  // filtered by the defeated unit's controller. Must precede the self prefix.
  { re: /^When an enemy unit is defeated:\s*/i,        on: 'event.defeated', where: { controller: 'opponent' } },
  { re: /^When a(?:nother)? friendly unit is defeated:\s*/i, on: 'event.defeated', where: { controller: 'self' } },
  { re: /^When Defeated:\s*/i, on: 'event.defeated' },   // self
];

/** "Bounty — <effect>" (§13). Resolves like a "When Defeated/When Captured"
 *  triggered ability, except it is controlled by an OPPONENT of the unit's
 *  controller (the player who defeated/captured it), and collecting it is
 *  optional (§13e). We model the "When Defeated" half; capture isn't an event
 *  the engine fires yet. The trailing reminder is already stripped upstream. */
function parseBountyClause(clause: string): Ability | null {
  const m = clause.match(/^Bounty\s*[—–-]\s*(.+)$/i);
  if (!m) return null;
  const inner = parseEffectClause(m[1].trim());
  if (!inner) return null;
  return {
    type: 'triggered',
    on: 'event.defeated',
    where: { card: 'self' },
    controlled_by: 'opponent',
    do: { effect: 'optional', do: inner },
  };
}

/** A trailing "Use this ability only once each round/phase/game." → a `limit`.
 *  Returns the stripped clause + the limit (undefined if no suffix). */
function extractLimit(clause: string): { clause: string; limit?: 'once_per_round' | 'once_per_phase' | 'once_per_game' } {
  const m = clause.match(/\s*Use this ability only once each (round|phase|game)\.?$/i);
  if (!m) return { clause };
  const word = m[1].toLowerCase();
  const limit = word === 'round' ? 'once_per_round' : word === 'phase' ? 'once_per_phase' : 'once_per_game';
  return { clause: clause.slice(0, m.index).trim(), limit };
}

/** Try to parse a unit clause that begins with a triggered prefix into a
 *  TriggeredAbility. Returns null if no prefix or the body doesn't parse. */
function parseTriggeredClause(clause: string): Ability | null {
  // A trailing once-per-X limit applies to the whole ability; strip it first.
  const { clause: limited, limit } = extractLimit(clause);
  const withLimit = (a: Ability): Ability => (limit ? { ...a, limit } as Ability : a);

  // "When another unique unit is defeated:" — fires on ANY unique unit's defeat
  // except this one (Agent Kallus). Compound `where`, so handle it before the
  // table-driven prefixes.
  let mk: RegExpMatchArray | null;
  if ((mk = limited.match(/^When another unique unit is defeated:\s*(.+)$/i))) {
    const body = mk[1].trim();
    const optional = /^You may /i.test(body);
    const eff = parseEffectClause(body.replace(/^You may /i, ''));
    if (!eff) return null;
    return withLimit({
      type: 'triggered', on: 'event.defeated',
      where: { and: [{ card_is_unique: true }, { not: { card: 'self' } }] },
      do: optional ? { effect: 'optional', do: eff } : eff,
    });
  }

  for (const p of TRIGGER_PREFIXES) {
    if (!p.re.test(limited)) continue;
    const body = limited.replace(p.re, '').trim();
    // Drop a leading "You may " — optional effects map to `optional`, but the
    // inner effect must still parse.
    const optional = /^You may /i.test(body);
    const core = body.replace(/^You may /i, '');
    const eff = parseEffectClause(core);
    if (!eff) return null;
    const doEff: Effect = optional ? { effect: 'optional', do: eff } : eff;
    const where = p.where
      ?? (p.on === 'event.attack_declared' ? { attacker: 'self' as const } : { card: 'self' as const });
    return withLimit({ type: 'triggered', on: p.on, where, do: doEff });
  }
  return null;
}

/** "Attached unit gains: '<ability>' [and '<ability>']" (upgrades). The host
 *  GAINS the quoted abilities — modeled as a constant `grant` whose target is
 *  the host (attached_to_self) carrying the parsed abilities, which the trigger
 *  system attributes to the host. Each quoted ability must parse as a TRIGGERED
 *  ability (On Attack / When Defeated / …); if any doesn't, the whole clause
 *  stays residual (so we never silently grant a subset). Covers Sith Traditions,
 *  Vambrace Grappleshot. Constant/cost granted abilities (cost reductions) are
 *  not yet modeled and correctly fall through to residual. */
function parseGrantAbilityClause(clause: string): Ability | null {
  // Two forms:
  //   "Attached unit gains: '<ability>' [and '<ability>']"            (always)
  //   "If attached unit is a <X>, it gains: '<ability>' [and …]"      (host-gated)
  let body: string | undefined;
  let filter: Predicate | undefined;
  let m = clause.match(/^Attached unit gains:\s*(.+)$/i);
  if (m) { body = m[1]; }
  else if ((m = clause.match(/^If attached unit is an? (.+?), it gains:\s*(.+)$/i))) {
    const f = parseHostCondition(m[1]);
    if (!f) return null;
    filter = f; body = m[2];
  } else {
    return null;
  }
  // Quoted segments — curly “…” or straight "…", joined by "and".
  const quoted = [...body.matchAll(/[“"]([^”"]+)[”"]/g)].map(x => x[1].trim());
  if (quoted.length === 0) return null;
  const granted: Ability[] = [];
  for (const q of quoted) {
    // A granted ability is either a triggered-prefix ability ("On Attack: …",
    // "When Defeated: …") or a "Bounty — <effect>" clause (an opponent-resolved
    // When-Defeated). Either must produce a triggered ability or the whole grant
    // stays residual (no silent partial grant).
    const trig = parseTriggeredClause(q) ?? parseBountyClause(q);
    if (!trig || trig.type !== 'triggered') return null;
    granted.push(trig);
  }
  const target: Selector = filter ? { attached_to_self: true, filter } : { attached_to_self: true };
  return { type: 'constant', grant: { target, abilities: granted } };
}

const ASPECT_ICONS = new Set<string>(['villainy', 'heroism', 'command', 'aggression', 'vigilance', 'cunning']);

/** "<X>" in "If attached unit is a <X>, …" → a host predicate. <X> is a trait
 *  (e.g. "Sith"), an aspect ("Heroism unit" / "Villainy unit"), or a negated
 *  aspect list ("non-Heroism, non-Villainy unit"). Aspect names are matched
 *  against the closed icon set; everything else is treated as a trait. */
function aspectOrTrait(word: string): Predicate {
  const w = word.trim().toLowerCase();
  return ASPECT_ICONS.has(w) ? { card_aspect: w as AspectIcon } : { card_trait: w };
}
function parseHostCondition(phrase: string): Predicate | null {
  const p = phrase.trim().replace(/\s+unit$/i, '').trim();
  if (!p) return null;
  if (/\bnon-/i.test(p)) {
    const preds: Predicate[] = [];
    for (const part of p.split(/,\s*/)) {
      const mm = part.trim().match(/^non-(.+)$/i);
      if (!mm) return null;
      preds.push({ not: aspectOrTrait(mm[1]) });
    }
    return preds.length === 1 ? preds[0] : { and: preds };
  }
  return aspectOrTrait(p);
}

/** Upgrade keyword grants — two forms, both → a constant grant to the host:
 *   • "Attached unit gains <Keyword> [N]."                  (unconditional —
 *      The Darksaber/Sentinel, Devotion/Restore 2, Grievous's Wheel Bike/Overwhelm)
 *   • "If attached unit is a <X>, it gains <Keyword> [N]."  (host-gated —
 *      Darth Revan's Lightsabers, Constructed Lightsaber)
 *  Restore/Raid N carry a `keyword_value`. The keyword is gated against the
 *  known-keyword set so an unrecognized word stays residual (and trait grants
 *  like "gains the Rebel trait" never match — they aren't a single keyword word). */
function parseAttachedKeywordGrant(clause: string): Ability | null {
  let m: RegExpMatchArray | null;
  let filter: Predicate | undefined;
  let keywordWord: string, valueStr: string | undefined;
  if ((m = clause.match(/^If attached unit is an? (.+?), it gains ([A-Za-z]+)(?:\s+(\d+))?\.?$/i))) {
    const f = parseHostCondition(m[1]);
    if (!f) return null;
    filter = f; keywordWord = m[2]; valueStr = m[3];
  } else if ((m = clause.match(/^Attached unit gains ([A-Za-z]+)(?:\s+(\d+))?\.?$/i))) {
    keywordWord = m[1]; valueStr = m[2];
  } else {
    return null;
  }
  const keyword = keywordWord.toLowerCase();
  if (!KEYWORD_WORDS.has(keyword)) return null; // unknown keyword / trait grant → residual
  const modifier: Modifier = { keyword };
  if (valueStr) modifier.keyword_value = parseInt(valueStr, 10);
  const target: Selector = filter ? { attached_to_self: true, filter } : { attached_to_self: true };
  return { type: 'constant', grant: { target, modifier } };
}

// ---------------------------------------------------------------------------
// Action abilities: "Action [<cost>]: <effect>" (leaders + some units)
// ---------------------------------------------------------------------------

interface ParsedCost { exhaust?: boolean; resources?: number; damage?: { amount: number; target: Selector } }

/** Parse the bracketed cost of an Action ability. Returns null if any cost
 *  component can't be expressed (the caller then leaves it residual). Handles
 *  exhaust, "N resources", and "deal N damage to a friendly unit" (Doctor
 *  Pershing). */
function parseActionCost(s: string): ParsedCost | null {
  const cost: ParsedCost = {};
  for (const part of s.split(',').map(p => p.trim().toLowerCase())) {
    if (!part) continue;
    if (part === 'exhaust') { cost.exhaust = true; continue; }
    const rm = part.match(/^(\d+) resources?$/);
    if (rm) { cost.resources = parseInt(rm[1], 10); continue; }
    const dm = part.match(/^deal (\d+) damage to a friendly unit$/);
    if (dm) { cost.damage = { amount: parseInt(dm[1], 10), target: { zone: 'any_arena', controller: 'self', selector: 'chosen', count: 1 } }; continue; }
    return null;   // uninterpretable cost component
  }
  return cost;
}

function parseActionClause(clause: string): Ability | null {
  const m = clause.match(/^Action \[([^\]]*)\]:\s*(.+)$/i);
  if (!m) return null;
  const cost = parseActionCost(m[1]);
  if (cost === null) return null;
  const body = m[2].trim();
  const optional = /^You may /i.test(body);
  const eff = parseEffectClause(body.replace(/^You may /i, ''));
  if (!eff) return null;
  return { type: 'action', cost, do: optional ? { effect: 'optional', do: eff } : eff };
}

// ---------------------------------------------------------------------------
// Simple constant auras (units): "Each enemy unit gets -N/-N." etc.
// ---------------------------------------------------------------------------

function parseConstantClause(clause: string): Ability | null {
  let m: RegExpMatchArray | null;
  // Each enemy (non-leader) unit gets -N/-N.
  if ((m = clause.match(/^Each enemy (?:non-leader )?unit gets [–—-](\d+)\/[–—-](\d+)\.?$/i))) {
    return {
      type: 'constant',
      grant: { target: { zone: 'any_arena', controller: 'opponent' }, modifier: { power: -parseInt(m[1], 10), health: -parseInt(m[2], 10) } },
    };
  }
  // Other friendly units get +N/+N.  /  Your other units get +N/+N.
  if ((m = clause.match(/^(?:Other friendly|Your other) units get \+(\d+)\/\+(\d+)\.?$/i))) {
    return {
      type: 'constant',
      grant: { target: { zone: 'any_arena', controller: 'self' }, modifier: { power: +m[1], health: +m[2] } },
    };
  }
  // While this unit is upgraded, it gets +N/+N.  (self_upgraded is a real v2 predicate)
  if ((m = clause.match(/^While this unit is upgraded, it gets \+(\d+)\/\+(\d+)\.?$/i))) {
    return {
      type: 'constant',
      while: { self_upgraded: true },
      grant: { target: { self: true }, modifier: { power: +m[1], health: +m[2] } },
    };
  }
  // While this unit is upgraded, it gains KEYWORD.
  if ((m = clause.match(/^While this unit is upgraded, it gains ([A-Za-z]+)\.?$/i))) {
    return {
      type: 'constant',
      while: { self_upgraded: true },
      grant: { target: { self: true }, modifier: { keyword: m[1].toLowerCase() } },
    };
  }
  // While you control N or more resources, this unit gets +N/+N.
  if ((m = clause.match(/^While you control (\d+) or more resources, this unit gets \+(\d+)\/\+(\d+)\.?$/i))) {
    return {
      type: 'constant',
      while: { controller_resource_count: { min: parseInt(m[1], 10) } },
      grant: { target: { self: true }, modifier: { power: +m[2], health: +m[3] } },
    };
  }
  // While you control [another] [<Trait/Aspect>] unit, this unit gets +N/+N
  // OR gains <Keyword> [N]. (self-buff/grant gated on controlling a matching
  // unit; "another" excludes this unit.)
  if ((m = clause.match(/^While you control (another |an? )(?:([A-Za-z]+) )?unit, this unit (?:gets \+(\d+)\/\+(\d+)|gains ([A-Za-z]+)(?:\s+(\d+))?)\.?$/i))) {
    const another = /another/i.test(m[1]);
    const word = m[2];
    const filter: Predicate | undefined = word && !/^(?:friendly)$/i.test(word) ? aspectOrTrait(word) : undefined;
    const cc: { filter?: Predicate; exclude_self?: boolean } = {};
    if (filter) cc.filter = filter;
    if (another) cc.exclude_self = true;
    const modifier: Modifier = m[3]
      ? { power: parseInt(m[3], 10), health: parseInt(m[4], 10) }
      : (() => { const mod: Modifier = { keyword: m[5].toLowerCase() }; if (m[6]) mod.keyword_value = parseInt(m[6], 10); return mod; })();
    if (m[5] && !KEYWORD_WORDS.has(m[5].toLowerCase())) return null; // unknown keyword → residual
    return { type: 'constant', while: { controller_controls: cc }, grant: { target: { self: true }, modifier } };
  }
  // Coordinate — This unit gets +N/+N.  (Coordinate self-buff; the keyword's
  // reminder — "While you control 3 or more units, …" — is stripped before this,
  // leaving the em-dash/en-dash/hyphen-prefixed body. The engine already models
  // Coordinate as controller_unit_count ≥ 3, e.g. W4_004.) Self-buff stat shape.
  if ((m = clause.match(/^Coordinate\s*[–—-]\s*(?:This unit|He|She|It|They) gets? \+(\d+)\/\+(\d+)\.?$/i))) {
    return {
      type: 'constant',
      while: { controller_unit_count: { min: 3 } },
      grant: { target: { self: true }, modifier: { power: +m[1], health: +m[2] } },
    };
  }
  // Each friendly non-leader unit that costs N or more gains KEYWORD.
  if ((m = clause.match(/^Each friendly non-leader unit that costs (\d+) or more gains ([A-Za-z]+)\.?$/i))) {
    return {
      type: 'constant',
      grant: {
        target: { zone: 'any_arena', controller: 'self', filter: { and: [{ not: { card_type: 'leader' } }, { card_cost: { min: parseInt(m[1], 10) } }] } },
        modifier: { keyword: m[2].toLowerCase() },
      },
    };
  }
  // Each friendly [<Trait>] unit gains KEYWORD.  (other friendly units gain …)
  if ((m = clause.match(/^(?:Each friendly|Other friendly|Your other) (?:([A-Za-z]+) )?units? gains? ([A-Za-z]+)\.?$/i))) {
    const trait = m[1] && m[1].toLowerCase() !== 'friendly' ? m[1].toLowerCase() : undefined;
    const base: Selector = { zone: 'any_arena', controller: 'self' };
    const target: Selector = trait ? { ...base, filter: { card_trait: trait } } : base;
    return { type: 'constant', grant: { target, modifier: { keyword: m[2].toLowerCase() } } };
  }
  // This unit gets +N/+N for each resource you control. (per-X scaling)
  if ((m = clause.match(/^This unit gets \+(\d+)\/\+(\d+) for each resource you control\.?$/i))) {
    return { type: 'constant', grant: { target: { self: true }, modifier: { per: { count: 'controller_resources', power: +m[1], health: +m[2] } } } };
  }
  // This unit gets +N/+N for each upgrade on (him|this unit|it).
  if ((m = clause.match(/^This unit gets \+(\d+)\/\+(\d+) for each upgrade on (?:him|this unit|it)\.?$/i))) {
    return { type: 'constant', grant: { target: { self: true }, modifier: { per: { count: 'self_upgrades', power: +m[1], health: +m[2] } } } };
  }
  // This unit gets +N/+N for each [Trait] unit in your discard pile. (Captain Enoch)
  if ((m = clause.match(/^This unit gets \+(\d+)\/\+(\d+) for each (?:([A-Za-z]+) )?unit in your discard pile\.?$/i))) {
    const trait = m[3] && m[3].toLowerCase() !== 'friendly' ? m[3].toLowerCase() : undefined;
    const per: NonNullable<import('@/lib/engine-v2').Modifier['per']> = { count: 'controller_discard_units', power: +m[1], health: +m[2] };
    if (trait) per.filter = { card_trait: trait };
    return { type: 'constant', grant: { target: { self: true }, modifier: { per } } };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Self cost-reduction: "This <card> costs N less to play [for each <X>]."
// Emits a `cost` ability (amount negative). Applies to events + units + upgrades.
// ---------------------------------------------------------------------------

function parseCostClause(clause: string): Ability | null {
  let m: RegExpMatchArray | null;
  // "This <card> costs N less to play for each friendly leader unit [you control]."
  if ((m = clause.match(/^This (?:event|unit|upgrade|card) costs (\d+) less to play for each friendly leader unit(?: you control)?\.?$/i))) {
    return { type: 'cost', amount: -parseInt(m[1], 10), per: 'friendly_leader_units' };
  }
  // "… for each friendly unit [you control]."
  if ((m = clause.match(/^This (?:event|unit|upgrade|card) costs (\d+) less to play for each friendly unit(?: you control)?\.?$/i))) {
    return { type: 'cost', amount: -parseInt(m[1], 10), per: 'friendly_units' };
  }
  // "… for each resource you control."
  if ((m = clause.match(/^This (?:event|unit|upgrade|card) costs (\d+) less to play for each resource you control\.?$/i))) {
    return { type: 'cost', amount: -parseInt(m[1], 10), per: 'friendly_resources' };
  }
  // Flat: "This <card> costs N less to play."
  if ((m = clause.match(/^This (?:event|unit|upgrade|card) costs (\d+) less to play\.?$/i))) {
    return { type: 'cost', amount: -parseInt(m[1], 10) };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Text segmentation
// ---------------------------------------------------------------------------

/** Strip parenthetical reminder text (anywhere). */
function stripReminders(s: string): string {
  return s.replace(/\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim();
}

/** Is this clause just a keyword (optionally with a numeric value)? Then it's
 *  covered by the keyword table, not residual rules text. */
function isKeywordClause(clause: string): boolean {
  const c = clause.trim().replace(/\.$/, '');
  const m = c.match(/^([A-Za-z]+)(?:\s+\d+)?$/);
  return !!m && KEYWORD_WORDS.has(m[1].toLowerCase());
}

/** An upgrade's "Attach to a <X> unit." line is an attach *restriction*, not an
 *  ability — it constrains legal hosts, it doesn't do anything. Enforcing the
 *  restriction is a separate concern (like uniqueness); for ability-AST coverage
 *  it's not unparsed rules text. */
function isAttachRestriction(clause: string): boolean {
  return /^Attach to /i.test(clause.trim());
}

/** Split card text into ability clauses: newline-separated, reminder-stripped,
 *  keyword-only + attach-restriction clauses removed. */
function clausesOf(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map(stripReminders)
    .map(s => s.trim())
    .filter(Boolean)
    .filter(c => !isKeywordClause(c))
    .filter(c => !isAttachRestriction(c));
}

// ---------------------------------------------------------------------------
// Top-level matcher
// ---------------------------------------------------------------------------

export function matchCard(card: MatchableCard): MatchResult {
  const type = (card.type ?? '').toLowerCase();
  const rawText = (card.text ?? '').trim();

  // No text at all → vanilla (stats + keywords from the table fully describe it).
  if (!rawText) {
    return { abilities: [], coverage: 'vanilla', matchedClauses: 0, totalClauses: 0, residual: [] };
  }

  // Whole-text modal ("Choose one/two: …"). Multi-line, so it must be handled
  // before clause-splitting. On events the modal IS the card's effect → wrap as
  // a when-played triggered ability.
  if (type === 'event' && /^Choose (?:one|two)/i.test(rawText)) {
    const modal = parseModalEffect(rawText);
    if (modal) {
      return {
        abilities: [{ type: 'triggered', on: 'event.card_played', where: { card: 'self' }, do: modal }],
        coverage: 'full', matchedClauses: 1, totalClauses: 1, residual: [],
      };
    }
    return { abilities: [], coverage: 'none', matchedClauses: 0, totalClauses: 1, residual: [rawText] };
  }

  // Maximum Firepower: two friendly <Trait> units each deal their power to the
  // SAME chosen target ("…to a unit. Then, another… to the same unit."). Two
  // sentences, so handle the whole text → one chosen source-selector of count 2.
  if (type === 'event') {
    const mf = rawText.match(/^A friendly (?:([A-Za-z]+) )?unit deals damage equal to its power to a unit\.\s*Then,? another friendly (?:[A-Za-z]+ )?unit deals damage equal to its power to the same unit\.?$/i);
    if (mf) {
      const trait = mf[1] && mf[1].toLowerCase() !== 'friendly' ? mf[1].toLowerCase() : undefined;
      const sources: Selector = trait
        ? { zone: 'any_arena', controller: 'self', selector: 'chosen', count: 2, filter: { card_trait: trait } }
        : { zone: 'any_arena', controller: 'self', selector: 'chosen', count: 2 };
      const effect: Effect = {
        effect: 'power_damage_from_each',
        sources,
        target: { zone: 'any_arena', controller: 'any', selector: 'chosen', count: 1 },
      };
      return {
        abilities: [{ type: 'triggered', on: 'event.card_played', where: { card: 'self' }, do: effect }],
        coverage: 'full', matchedClauses: 1, totalClauses: 1, residual: [],
      };
    }
  }

  // Palpatine's Return: "Play a unit from your discard pile. It costs N less. If
  // it's a Force unit, it costs M less instead." Multi-line in the DB, so match
  // the whitespace-flattened whole text → one play_from_discard effect.
  if (type === 'event') {
    const flat = rawText.replace(/\s+/g, ' ').trim();
    const pr = flat.match(/^Play a unit from your discard pile\. It costs (\d+) resources? less\.(?: If it['’]s a Force unit, it costs (\d+) resources? less instead\.?)?$/i);
    if (pr) {
      const effect: Effect = {
        effect: 'play_from_discard',
        filter: { card_type: 'unit' },
        cost_reduction: parseInt(pr[1], 10),
        ...(pr[2] ? { cost_reduction_if: { filter: { card_trait: 'force' }, amount: parseInt(pr[2], 10) } } : {}),
      };
      return {
        abilities: [{ type: 'triggered', on: 'event.card_played', where: { card: 'self' }, do: effect }],
        coverage: 'full', matchedClauses: 1, totalClauses: 1, residual: [],
      };
    }
  }

  const clauses = clausesOf(rawText);
  if (clauses.length === 0) {
    // Text was entirely keyword reminders → vanilla+keyword, already handled.
    return { abilities: [], coverage: 'vanilla', matchedClauses: 0, totalClauses: 0, residual: [] };
  }

  const abilities: Ability[] = [];
  const residual: string[] = [];

  for (const clause of clauses) {
    // Self cost-reduction is static text, identical for any card type — check it
    // first so it isn't mistaken for a When-Played effect.
    const costAb = parseCostClause(clause);
    if (costAb) { abilities.push(costAb); continue; }

    if (type === 'event') {
      // Event clause → effect, wrapped as a when-played triggered ability.
      // Try the RAW clause first: compounds like "You may X. If you do, Y." parse
      // their own "You may" into the right place (if_did(optional(X), Y)). Only if
      // that fails do we strip a leading "You may" and wrap the remainder as
      // optional (the plain "You may <effect>." case).
      const rawEff = parseEffectClause(clause);
      if (rawEff) {
        abilities.push({ type: 'triggered', on: 'event.card_played', where: { card: 'self' }, do: rawEff });
        continue;
      }
      const eff = parseEffectClause(clause.replace(/^You may /i, ''));
      if (eff) {
        const optional = /^You may /i.test(clause);
        abilities.push({ type: 'triggered', on: 'event.card_played', where: { card: 'self' }, do: optional ? { effect: 'optional', do: eff } : eff });
      } else {
        residual.push(clause);
      }
      continue;
    }

    // Units / upgrades / leaders: action ability, then triggered prefix, then
    // constant aura.
    const action = parseActionClause(clause);
    if (action) { abilities.push(action); continue; }

    const bounty = parseBountyClause(clause);
    if (bounty) { abilities.push(bounty); continue; }

    const trig = parseTriggeredClause(clause);
    if (trig) { abilities.push(trig); continue; }

    const grantAb = parseGrantAbilityClause(clause);
    if (grantAb) { abilities.push(grantAb); continue; }

    const condKw = parseAttachedKeywordGrant(clause);
    if (condKw) { abilities.push(condKw); continue; }

    const constant = parseConstantClause(clause);
    if (constant) { abilities.push(constant); continue; }

    residual.push(clause);
  }

  const matched = clauses.length - residual.length;
  const coverage: Coverage =
    residual.length === 0 ? 'full'
    : matched > 0 ? 'partial'
    : 'none';

  return { abilities, coverage, matchedClauses: matched, totalClauses: clauses.length, residual };
}
