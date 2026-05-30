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

import type { Ability, Effect, Selector, Predicate } from '@/lib/engine-v2';

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

  // Draw N card(s) / Draw a card.  ("a"/"an" = 1)
  if ((m = t.match(/^Draw (a|an|\d+) cards?\.?$/i))) {
    return { effect: 'draw', player: 'self', count: /^\d+$/.test(m[1]) ? parseInt(m[1], 10) : 1 };
  }

  // Deal N damage to a unit or base.
  if ((m = t.match(/^Deal (\d+) damage to a unit or base\.?$/i))) {
    return { effect: 'damage', amount: parseInt(m[1], 10), target: { zone: 'any_arena', controller: 'any', selector: 'chosen', count: 1 } };
  }

  // Deal N damage to an (enemy) unit.
  if ((m = t.match(/^Deal (\d+) damage to an? (enemy )?unit\.?$/i))) {
    return { effect: 'damage', amount: parseInt(m[1], 10), target: m[2] ? chosenEnemyUnit : chosenAnyUnit };
  }

  // Deal N damage to (the opponent's / the enemy / your opponent's) base.
  if ((m = t.match(/^Deal (\d+) damage to (?:your opponent's|the opponent's|the enemy) base\.?$/i))) {
    return { effect: 'damage', amount: parseInt(m[1], 10), target: opponentBase };
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

  // Deal N indirect damage to a player / the defending player / each opponent → opponent base, indirect.
  if ((m = t.match(/^Deal (\d+) indirect damage to (?:the defending player|a player|your opponent|the opponent|each opponent)\.?$/i))) {
    return { effect: 'damage', amount: parseInt(m[1], 10), target: opponentBase, indirect: true };
  }

  // Give an (enemy) unit -N/-N for this phase. (en-dash, em-dash, or hyphen)
  if ((m = t.match(/^Give an? (enemy )?unit [–—-](\d+)\/[–—-](\d+) for this phase\.?$/i))) {
    return { effect: 'give', target: m[1] ? chosenEnemyUnit : chosenFriendlyUnit, modifier: { power: -parseInt(m[2], 10), health: -parseInt(m[3], 10), duration: 'end_of_phase' } };
  }

  // Exhaust an (enemy) (ground|space) unit.
  if ((m = t.match(/^Exhaust an? (?:enemy )?(?:ground |space )?unit\.?$/i))) {
    return { effect: 'exhaust', target: chosenEnemyUnit };
  }

  // Give a/N Shield token(s) to a (friendly) unit.
  if ((m = t.match(/^Give (?:\d+|a) Shield tokens? to a (?:friendly )?unit\.?$/i))) {
    return { effect: 'give_shield', target: chosenFriendlyUnit, count: 1 };
  }

  // Defeat a non-leader unit.
  if ((m = t.match(/^Defeat a non-leader unit\.?$/i))) {
    return { effect: 'defeat', target: chosenEnemyNonLeader };
  }

  // This unit gets +N/+N for this phase. (self phase buff — action bodies)
  if ((m = t.match(/^This unit gets \+(\d+)\/\+(\d+) for this phase\.?$/i))) {
    return { effect: 'give', target: { self: true }, modifier: { power: +m[1], health: +m[2], duration: 'end_of_phase' } };
  }

  return null;
}

// ---------------------------------------------------------------------------
// Triggered-prefix detection (units): "When Played:", "On Attack:", etc.
// ---------------------------------------------------------------------------

type TrigOn = 'event.card_played' | 'event.attack_declared' | 'event.defeated';
interface TrigPrefix {
  re: RegExp;
  on: TrigOn;
  /** explicit `where` override; when absent, a sensible self-based default is used */
  where?: { card?: 'self'; attacker?: 'self'; controller?: 'self' | 'opponent' };
}

const TRIGGER_PREFIXES: TrigPrefix[] = [
  { re: /^When Played:\s*/i,   on: 'event.card_played' },
  { re: /^On Attack:\s*/i,     on: 'event.attack_declared' },
  // "When [an] enemy/friendly unit is defeated" — defeat of ANOTHER unit,
  // filtered by the defeated unit's controller. Must precede the self prefix.
  { re: /^When an enemy unit is defeated:\s*/i,        on: 'event.defeated', where: { controller: 'opponent' } },
  { re: /^When a(?:nother)? friendly unit is defeated:\s*/i, on: 'event.defeated', where: { controller: 'self' } },
  { re: /^When Defeated:\s*/i, on: 'event.defeated' },   // self
];

/** Try to parse a unit clause that begins with a triggered prefix into a
 *  TriggeredAbility. Returns null if no prefix or the body doesn't parse. */
function parseTriggeredClause(clause: string): Ability | null {
  for (const p of TRIGGER_PREFIXES) {
    if (!p.re.test(clause)) continue;
    const body = clause.replace(p.re, '').trim();
    // Drop a leading "You may " — optional effects map to `optional`, but the
    // inner effect must still parse.
    const optional = /^You may /i.test(body);
    const core = body.replace(/^You may /i, '');
    const eff = parseEffectClause(core);
    if (!eff) return null;
    const doEff: Effect = optional ? { effect: 'optional', do: eff } : eff;
    const where = p.where
      ?? (p.on === 'event.attack_declared' ? { attacker: 'self' as const } : { card: 'self' as const });
    return { type: 'triggered', on: p.on, where, do: doEff };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Action abilities: "Action [<cost>]: <effect>" (leaders + some units)
// ---------------------------------------------------------------------------

interface ParsedCost { exhaust?: boolean; resources?: number }

/** Parse the bracketed cost of an Action ability. Returns null if any cost
 *  component can't be expressed as an exhaust/resource cost (e.g. "deal 1
 *  damage to a friendly unit" as a cost) — the caller then leaves it residual. */
function parseActionCost(s: string): ParsedCost | null {
  const cost: ParsedCost = {};
  for (const part of s.split(',').map(p => p.trim().toLowerCase())) {
    if (!part) continue;
    if (part === 'exhaust') { cost.exhaust = true; continue; }
    const rm = part.match(/^(\d+) resources?$/);
    if (rm) { cost.resources = parseInt(rm[1], 10); continue; }
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
  // While you control a <Trait> unit, this unit gains KEYWORD.
  if ((m = clause.match(/^While you control an? ([A-Za-z]+) unit, this unit gains ([A-Za-z]+)\.?$/i))) {
    return {
      type: 'constant',
      while: { controller_controls_trait: m[1].toLowerCase() },
      grant: { target: { self: true }, modifier: { keyword: m[2].toLowerCase() } },
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

  const clauses = clausesOf(rawText);
  if (clauses.length === 0) {
    // Text was entirely keyword reminders → vanilla+keyword, already handled.
    return { abilities: [], coverage: 'vanilla', matchedClauses: 0, totalClauses: 0, residual: [] };
  }

  const abilities: Ability[] = [];
  const residual: string[] = [];

  for (const clause of clauses) {
    if (type === 'event') {
      // Event clause → effect, wrapped as a when-played triggered ability.
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

    const trig = parseTriggeredClause(clause);
    if (trig) { abilities.push(trig); continue; }

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
