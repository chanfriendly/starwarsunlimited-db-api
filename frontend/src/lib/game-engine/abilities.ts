// Per-card ability registry + card-text parser.
//
// IMPORTANT: design intent — keep ability resolution data-driven.
// The text parser (parseCoordinateText / parseEventText) handles common card
// phrasings so the registry doesn't need an entry per card. The registry exists
// only as an authoritative override for cards whose text is unparseable, or
// where the parser would misclassify. As the SWU card pool grows, the parser
// is the primary path. New effect categories (e.g. token creation, capture)
// require both new engine code AND new parser patterns.

import { Card } from '@/lib/api';

// ---------------------------------------------------------------------------
// Effect types
// ---------------------------------------------------------------------------

export type CoordinateEffect =
  // Continuous stat bonus while Coordinate is active
  | { type: 'STAT_BUFF'; atk: number; hp: number }
  // Grants a keyword while Coordinate is active (e.g. Hevy → Raid 2)
  | { type: 'KEYWORD'; keyword: string; value?: number }
  // On Attack: draw N cards
  | { type: 'ON_ATTACK_DRAW'; count: number }
  // On Attack: prevent all combat damage to this unit for this attack
  | { type: 'ON_ATTACK_PREVENT_DAMAGE' }
  // On Attack: optionally deal N damage to a chosen unit (Kit Fisto pattern).
  // arenaFilter restricts the legal targets; absent = either arena.
  | { type: 'ON_ATTACK_DEAL_DAMAGE_TARGET'; amount: number; arenaFilter?: 'ground' | 'space' }
  // While attacking, the defender unit gets atk/hp for this attack only
  // (Clone Dive Trooper pattern). atk/hp are typically negative (debuff).
  | { type: 'ON_ATTACK_DEBUFF_DEFENDER'; atk: number; hp: number }
  // On Attack: give a chosen enemy unit atk/hp for the rest of this phase
  // (Padmé Pursuing Peace pattern). atk/hp are typically negative.
  | { type: 'ON_ATTACK_DEBUFF_TARGET'; atk: number; hp: number }
  // When Played: optionally deal damage to one friendly + one enemy unit
  // (Reckless Torrent pattern). sameArena requires both targets share an arena.
  | { type: 'WHEN_PLAYED_DAMAGE_DUAL'; friendlyAmount: number; enemyAmount: number; sameArena?: boolean }
  // Continuous: each OTHER friendly unit gets atk/hp and optional keywords
  // (Clone Commander Cody pattern). Re-evaluated live in computePower /
  // effectiveHealth / hasEffectiveKeyword — no state mutation needed.
  | { type: 'AURA_BUFF_OTHERS'; atk: number; hp: number; grantKeywords?: string[] };

export interface CoordinateAbility {
  type: 'COORDINATE';
  effect: CoordinateEffect;
}

export type CardAbility = CoordinateAbility;

// ---------------------------------------------------------------------------
// Coordinate coverage map
//
// Category A — engine + parser fully cover:
//   STAT_BUFF, KEYWORD grant (Ambush/Saboteur/Sentinel/Grit/Raid),
//   ON_ATTACK_DRAW, ON_ATTACK_PREVENT_DAMAGE
//
// Category B — engine + parser cover (added in this pass):
//   ON_ATTACK_DEAL_DAMAGE_TARGET   (Kit Fisto, future "deal N to a unit" cards)
//   ON_ATTACK_DEBUFF_DEFENDER      (Clone Dive Trooper, future defender debuffs)
//   ON_ATTACK_DEBUFF_TARGET        (Padmé "Pursuing Peace", future enemy-target debuffs)
//   WHEN_PLAYED_DAMAGE_DUAL        (Reckless Torrent, future split-damage on play)
//   AURA_BUFF_OTHERS               (Clone Commander Cody, future continuous auras)
//
// Category C — blocked on engine subsystems NOT YET BUILT. Listed with the
// architectural piece each one needs. Adding the parser pattern alone is not
// enough — these require new state shape and dispatch:
//
//   Pelta Supply Frigate    — TOKEN SYSTEM. Need a `CREATE_TOKEN` effect, a
//                             TokenDefinition registry (name → stat profile +
//                             keywords + image), an `isToken: boolean` flag on
//                             CardInstance, and a defeat path that removes
//                             tokens entirely (no discard pile entry).
//
//   Sanctioner's Shuttle    — CAPTURE ZONE. Need `captureZone: CardInstance[]`
//                             on PlayerState with provenance (original owner),
//                             a `CAPTURE_UNIT` effect, and a defeat hook on the
//                             capturer that releases captives back to their
//                             original arena.
//
//   Ki-Adi-Mundi            — TRIGGERED-ABILITY DISPATCH. Need an event bus
//                             that the engine emits to (CARD_PLAYED, ATTACK_DECLARED,
//                             UNIT_DEFEATED, etc.), per-phase counters on
//                             PlayerState ("cards played this phase"), and a
//                             TriggeredAbility type with { trigger, condition,
//                             effect } that we scan against every event.
//
//   Ahsoka Tano (Leader)    — Coordinate as a LEADER ACTION, with `TRIGGER_ATTACK_WITH`
//                             which already exists as an event effect. Plumbing
//                             work only: extend LEADER_ABILITIES to support a
//                             TRIGGER_ATTACK_WITH-style effect, and route the
//                             leader action through the PLAY_ATTACK_EVENT flow.
//
//   Padmé Amidala (Serving the Republic)
//                           — DECK SEARCH UI. Need `SEARCH_DECK_TOP { count,
//                             filter: { trait?, aspect?, type? } }` effect, a
//                             "look at top N" interaction (modal showing cards
//                             face-up to the active player), and a way to
//                             reorder the remaining cards back onto the deck.
//
//   For The Republic        — UPGRADE-AS-COORDINATE-SOURCE. Need upgrades to
//                             contribute Coordinate effects to their host unit.
//                             Specifically: `getCoordinateAbilities` should also
//                             aggregate effects from `inst.upgrades[*].card`, and
//                             `Coordinate Restore N` needs Restore-as-keyword
//                             support on the host. Smaller than the others but
//                             requires touching both the aura aggregator and the
//                             upgrade attach flow.
//
// When a Category C subsystem lands, the parser is the place to add the
// matching text pattern. Then future cards using the same mechanic become
// automatic — same registry-first / parser-fallback contract used today.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Leader ability and event effect types
// ---------------------------------------------------------------------------

/**
 * Effects that both leader abilities and event cards can apply.
 * Add new variants here as new cards are registered.
 */
export type AbilityEffect =
  /** Draw N cards from own deck */
  | { type: 'DRAW'; count: number }
  /** Give a chosen unit +atk/+hp (or negative for debuffs) until end of phase */
  | { type: 'PHASE_BUFF_UNIT'; atk: number; hp: number }
  /** Deal N damage to a chosen unit */
  | { type: 'DEAL_DAMAGE_UNIT'; amount: number }
  /** Deal N damage to a chosen unit OR the opponent's base */
  | { type: 'DEAL_DAMAGE_ANY'; amount: number }
  /** Deal N damage directly to the opponent's base (no target selection) */
  | { type: 'DEAL_DAMAGE_OPP_BASE'; amount: number }
  /** Restore N HP to own base */
  | { type: 'HEAL_BASE'; amount: number }
  /** Exhaust a chosen non-leader unit */
  | { type: 'EXHAUST_UNIT' }
  /** Give a chosen friendly unit a Shield token */
  | { type: 'GIVE_SHIELD_FRIENDLY' }
  /** Immediately defeat a chosen non-leader unit (no damage, straight to discard) */
  | { type: 'DEFEAT_UNIT' }
  /**
   * "Attack with a unit. It gets +N/+N for this attack."
   * Triggers the PLAY_ATTACK_EVENT two-step flow — not resolved via applyAbilityEffect.
   * grantKeywords is noted but not yet implemented (complex temporary-keyword system needed).
   */
  | { type: 'TRIGGER_ATTACK_WITH'; atkBonus: number; hpBonus: number; grantKeywords?: string[] };

/**
 * Describes who the player must pick as the ability target.
 * Used by both leader abilities and targeted events.
 */
export type TargetKind =
  | 'FRIENDLY_UNIT'         // any friendly unit in either arena
  | 'ENEMY_UNIT'            // any enemy unit in either arena
  | 'ANY_UNIT'              // any unit in either arena
  | 'ENEMY_UNIT_OR_BASE';   // any enemy unit or the opponent's base

// ---------------------------------------------------------------------------
// Leader ability registry
//
// Keyed by card name (not id — ids can change between DB builds).
// Only the non-deployed side ability is listed here (the leader card action).
// Effects that require token creation or complex triggers are omitted for now.
//
// NOTE: Verify effect details against actual card text before adding new entries.
// ---------------------------------------------------------------------------

export interface LeaderAbility {
  /** Additional resource cost beyond exhausting the leader */
  resourceCost: number;
  effect: AbilityEffect;
  /** If set, the player must choose a valid target before the ability resolves */
  targetKind?: TargetKind;
}

export const LEADER_ABILITIES: Record<string, LeaderAbility> = {
  // 'Action [Exhaust]: Give a unit +0/+2 for this phase.'
  'Chirrut Îmwe': {
    resourceCost: 0,
    effect: { type: 'PHASE_BUFF_UNIT', atk: 0, hp: 2 },
    targetKind: 'FRIENDLY_UNIT',
  },
  // 'Action [1 resource, Exhaust]: Exhaust a non-leader unit.'
  // (Token creation skipped — requires token system)
  'Admiral Ackbar': {
    resourceCost: 1,
    effect: { type: 'EXHAUST_UNIT' },
    targetKind: 'ENEMY_UNIT',
  },
};

// ---------------------------------------------------------------------------
// Event effect registry
//
// Keyed by card name. Events not listed here are discarded with no effect.
// Effects are best-effort approximations — verify against the actual card text.
// ---------------------------------------------------------------------------

export interface EventEffect {
  effect: AbilityEffect;
  /** If set, the player must choose a target before the event resolves */
  targetKind?: TargetKind;
}

export const EVENT_EFFECTS: Record<string, EventEffect> = {
  // ── Draw ──────────────────────────────────────────────────────────────────
  'Strategic Analysis':     { effect: { type: 'DRAW', count: 3 } },
  'Tactical Retreat':       { effect: { type: 'DRAW', count: 2 } },
  'Smuggle the Plans':      { effect: { type: 'DRAW', count: 2 } },

  // ── Damage to unit or base ────────────────────────────────────────────────
  'Daring Raid':            { effect: { type: 'DEAL_DAMAGE_ANY', amount: 2 }, targetKind: 'ENEMY_UNIT_OR_BASE' },
  'Surprise Strike':        { effect: { type: 'DEAL_DAMAGE_ANY', amount: 3 }, targetKind: 'ENEMY_UNIT_OR_BASE' },

  // ── Damage to unit only ───────────────────────────────────────────────────
  'Open Fire':              { effect: { type: 'DEAL_DAMAGE_UNIT', amount: 4 }, targetKind: 'ENEMY_UNIT' },
  "We're In Trouble":       { effect: { type: 'DEAL_DAMAGE_UNIT', amount: 3 }, targetKind: 'ENEMY_UNIT' },
  'Shoot First':            { effect: { type: 'DEAL_DAMAGE_UNIT', amount: 3 }, targetKind: 'ENEMY_UNIT' },
  'Precision Fire':         { effect: { type: 'DEAL_DAMAGE_UNIT', amount: 2 }, targetKind: 'ENEMY_UNIT' },
  'Force Lightning':        { effect: { type: 'DEAL_DAMAGE_UNIT', amount: 5 }, targetKind: 'ENEMY_UNIT' },
  'Orbital Bombardment':    { effect: { type: 'DEAL_DAMAGE_UNIT', amount: 6 }, targetKind: 'ENEMY_UNIT' },
  'Calculated Lethality':   { effect: { type: 'DEAL_DAMAGE_UNIT', amount: 5 }, targetKind: 'ENEMY_UNIT' },
  'No Mercy':               { effect: { type: 'DEAL_DAMAGE_UNIT', amount: 4 }, targetKind: 'ENEMY_UNIT' },
  'Sniper Shot':            { effect: { type: 'DEAL_DAMAGE_UNIT', amount: 3 }, targetKind: 'ENEMY_UNIT' },

  // ── Phase buffs ───────────────────────────────────────────────────────────
  'Tactical Advantage':     { effect: { type: 'PHASE_BUFF_UNIT', atk: 2, hp: 0 }, targetKind: 'FRIENDLY_UNIT' },
  'Inspire':                { effect: { type: 'PHASE_BUFF_UNIT', atk: 1, hp: 1 }, targetKind: 'FRIENDLY_UNIT' },

  // ── Shield ────────────────────────────────────────────────────────────────
  'Shield Generator':       { effect: { type: 'GIVE_SHIELD_FRIENDLY' }, targetKind: 'FRIENDLY_UNIT' },

  // ── Heal ──────────────────────────────────────────────────────────────────
  'Battle Meditation':      { effect: { type: 'HEAL_BASE', amount: 3 } },
  'Force Heal':             { effect: { type: 'HEAL_BASE', amount: 4 } },
  'Medic Support':          { effect: { type: 'HEAL_BASE', amount: 2 } },

  // ── Defeat non-leader unit ────────────────────────────────────────────────
  // "Defeat a non-leader unit." Text confirmed from SWU card database.
  'Vanquish':               { effect: { type: 'DEFEAT_UNIT' }, targetKind: 'ENEMY_UNIT' },
  'Lost and Forgotten':     { effect: { type: 'DEFEAT_UNIT' }, targetKind: 'ENEMY_UNIT' },
  "It's Worse":             { effect: { type: 'DEFEAT_UNIT' }, targetKind: 'ENEMY_UNIT' },
  'Lethal Crackdown':       { effect: { type: 'DEFEAT_UNIT' }, targetKind: 'ENEMY_UNIT' },
};

/** True if a leader ability requires the player to pick a target. */
export function needsLeaderAbilityTarget(cardName: string): boolean {
  return !!LEADER_ABILITIES[cardName]?.targetKind;
}

// ---------------------------------------------------------------------------
// Event text parser
//
// Parses a single-clause event card text into an EventEffect.
// Returns null if the text is multi-clause or uses an unrecognised pattern.
// Called only as a fallback when the card is NOT found in EVENT_EFFECTS.
// All patterns use ^ and $ anchors so multi-line text returns null.
// ---------------------------------------------------------------------------

function parseEventText(text: string): EventEffect | null {
  const t = text.trim();

  let m: RegExpMatchArray | null;

  // Draw N cards.
  m = t.match(/^Draw (\d+) cards?\.$/);
  if (m) return { effect: { type: 'DRAW', count: parseInt(m[1], 10) } };

  // Deal N damage to a unit or base.
  m = t.match(/^Deal (\d+) damage to a unit or base\.$/);
  if (m) return { effect: { type: 'DEAL_DAMAGE_ANY', amount: parseInt(m[1], 10) }, targetKind: 'ENEMY_UNIT_OR_BASE' };

  // Deal N damage to an (enemy) unit.
  m = t.match(/^Deal (\d+) damage to an? (?:enemy )?unit\.$/);
  if (m) return { effect: { type: 'DEAL_DAMAGE_UNIT', amount: parseInt(m[1], 10) }, targetKind: 'ENEMY_UNIT' };

  // Deal N damage to your opponent's / the enemy base.
  m = t.match(/^Deal (\d+) damage to (?:your opponent's|the opponent's|the enemy) base\.$/);
  if (m) return { effect: { type: 'DEAL_DAMAGE_OPP_BASE', amount: parseInt(m[1], 10) } };

  // Heal N damage from your/a base.
  m = t.match(/^Heal (\d+) damage from (?:your|a) base\.$/);
  if (m) return { effect: { type: 'HEAL_BASE', amount: parseInt(m[1], 10) } };

  // Give a (friendly) unit +N/+N for this phase.  (buff → FRIENDLY_UNIT)
  m = t.match(/^Give a (?:friendly )?unit \+(\d+)\/\+(\d+) for this phase\.$/);
  if (m) return { effect: { type: 'PHASE_BUFF_UNIT', atk: parseInt(m[1], 10), hp: parseInt(m[2], 10) }, targetKind: 'FRIENDLY_UNIT' };

  // Give an (enemy) unit –N/–N for this phase.  (en-dash or hyphen, debuff)
  m = t.match(/^Give an? (enemy )?unit [–-](\d+)\/[–-](\d+) for this phase\.$/);
  if (m) {
    const targetKind: TargetKind = m[1] ? 'ENEMY_UNIT' : 'FRIENDLY_UNIT';
    return {
      effect: { type: 'PHASE_BUFF_UNIT', atk: -parseInt(m[2], 10), hp: -parseInt(m[3], 10) },
      targetKind,
    };
  }

  // Exhaust an (enemy) (ground|space) unit.
  m = t.match(/^Exhaust an? (?:enemy )?(?:ground |space )?unit\.$/);
  if (m) return { effect: { type: 'EXHAUST_UNIT' }, targetKind: 'ENEMY_UNIT' };

  // Give a/N Shield token(s) to a (friendly) unit.
  m = t.match(/^Give (?:\d+|a) Shield tokens? to a (?:friendly )?unit\.$/);
  if (m) return { effect: { type: 'GIVE_SHIELD_FRIENDLY' }, targetKind: 'FRIENDLY_UNIT' };

  // Defeat a non-leader unit.
  m = t.match(/^Defeat a non-leader unit\.$/);
  if (m) return { effect: { type: 'DEFEAT_UNIT' }, targetKind: 'ENEMY_UNIT' };

  // Attack with a (ground|space) unit. It gets +N/+N for this attack.
  m = t.match(/^Attack with a (?:ground |space )?unit\. It gets \+(\d+)\/\+(\d+) for this attack\.$/);
  if (m) return { effect: { type: 'TRIGGER_ATTACK_WITH', atkBonus: parseInt(m[1], 10), hpBonus: parseInt(m[2], 10) } };

  // Attack with a (ground|space) unit. It gets +N/+N and gains KEYWORD for this attack.
  m = t.match(/^Attack with a (?:ground |space )?unit\. It gets \+(\d+)\/\+(\d+) and gains ([\w ]+?) for this attack\.$/);
  if (m) return { effect: { type: 'TRIGGER_ATTACK_WITH', atkBonus: parseInt(m[1], 10), hpBonus: parseInt(m[2], 10), grantKeywords: [m[3]] } };

  return null;
}

/**
 * Look up the effect for an event card.
 * Tries the manual registry first (authoritative); falls back to text parsing.
 * Returns null if neither source covers the card.
 */
export function getEventEffect(name: string, text: string): EventEffect | null {
  return EVENT_EFFECTS[name] ?? parseEventText(text);
}

/** True if an event card requires the player to pick a target. */
export function needsEventTarget(cardName: string, cardText = ''): boolean {
  return !!getEventEffect(cardName, cardText)?.targetKind;
}

// ---------------------------------------------------------------------------
// Coordinate text parser
//
// Maps the "Coordinate — ..." clause of a card to a list of CoordinateEffect.
// Returns [] when no Coordinate clause is present OR the clause's body doesn't
// match a known pattern. Called as the fallback for cards NOT in CARD_ABILITIES.
//
// Pattern coverage is grouped by SWU's natural phrasing. Each new pattern
// added here covers an unknown number of future cards using the same template.
// ---------------------------------------------------------------------------

/** Strip the reminder text in trailing "(Gain this ability ...)" parenthetical. */
function stripReminder(s: string): string {
  return s.replace(/\s*\([^)]*\)\s*$/, '').trim();
}

export function parseCoordinateText(text: string): CoordinateEffect[] {
  if (!text) return [];

  // Find the line containing "Coordinate — ..." (any of em-dash, en-dash, or hyphen).
  // Some cards have the Coordinate clause on its own line; some inline.
  const lines = text.split(/\r?\n/);
  const coordLine = lines.find(l => /Coordinate\s+[—–-]\s+/.test(l));
  if (!coordLine) return [];

  const body = stripReminder(coordLine.replace(/^.*?Coordinate\s+[—–-]\s+/, '').trim());

  let m: RegExpMatchArray | null;

  // ── STAT_BUFF ────────────────────────────────────────────────────────────
  m = body.match(/^This unit gets \+(\d+)\/\+(\d+)\.?$/);
  if (m) return [{ type: 'STAT_BUFF', atk: +m[1], hp: +m[2] }];

  // ── ON_ATTACK_DRAW ───────────────────────────────────────────────────────
  m = body.match(/^On Attack: Draw a card\.?$/);
  if (m) return [{ type: 'ON_ATTACK_DRAW', count: 1 }];
  m = body.match(/^On Attack: Draw (\d+) cards?\.?$/);
  if (m) return [{ type: 'ON_ATTACK_DRAW', count: +m[1] }];

  // ── ON_ATTACK_PREVENT_DAMAGE ────────────────────────────────────────────
  if (/^On Attack: Prevent all combat damage/.test(body)) {
    return [{ type: 'ON_ATTACK_PREVENT_DAMAGE' }];
  }

  // ── ON_ATTACK_DEAL_DAMAGE_TARGET ────────────────────────────────────────
  // "On Attack: You may deal N damage to a (ground |space )?unit."
  m = body.match(/^On Attack: You may deal (\d+) damage to a (ground |space )?unit\.?$/);
  if (m) {
    const arenaFilter = m[2] ? (m[2].trim() as 'ground' | 'space') : undefined;
    return [{ type: 'ON_ATTACK_DEAL_DAMAGE_TARGET', amount: +m[1], ...(arenaFilter ? { arenaFilter } : {}) }];
  }

  // ── ON_ATTACK_DEBUFF_TARGET ─────────────────────────────────────────────
  // "On Attack: Give an enemy unit –N/–M for this phase."
  m = body.match(/^On Attack: Give an enemy unit [–-](\d+)\/[–-](\d+) for this phase\.?$/);
  if (m) return [{ type: 'ON_ATTACK_DEBUFF_TARGET', atk: -+m[1], hp: -+m[2] }];

  // ── ON_ATTACK_DEBUFF_DEFENDER ───────────────────────────────────────────
  // "While this unit is attacking, the defender gets –N/–M."
  m = body.match(/^While this unit is attacking, the defender gets [–-](\d+)\/[–-](\d+)\.?$/);
  if (m) return [{ type: 'ON_ATTACK_DEBUFF_DEFENDER', atk: -+m[1], hp: -+m[2] }];

  // ── AURA_BUFF_OTHERS ────────────────────────────────────────────────────
  // "Each other friendly unit gets +N/+M (and gains KEYWORD)?."
  m = body.match(/^Each other friendly unit gets \+(\d+)\/\+(\d+)(?: and gains ([A-Z][\w ]*?))?\.?$/);
  if (m) {
    const kw = m[3]?.trim();
    return [{
      type: 'AURA_BUFF_OTHERS',
      atk: +m[1],
      hp: +m[2],
      ...(kw ? { grantKeywords: [kw] } : {}),
    }];
  }

  // ── WHEN_PLAYED_DAMAGE_DUAL ─────────────────────────────────────────────
  // "When Played: You may deal N damage to a friendly unit and M damage to
  //  an enemy unit (in the same arena)?."
  m = body.match(/^When Played: You may deal (\d+) damage to a friendly unit and (\d+) damage to an enemy unit( in the same arena)?\.?$/);
  if (m) {
    return [{
      type: 'WHEN_PLAYED_DAMAGE_DUAL',
      friendlyAmount: +m[1],
      enemyAmount: +m[2],
      ...(m[3] ? { sameArena: true } : {}),
    }];
  }

  // ── KEYWORD grants (single-word) ────────────────────────────────────────
  m = body.match(/^(Ambush|Saboteur|Sentinel|Grit|Shielded|Overwhelm)$/);
  if (m) return [{ type: 'KEYWORD', keyword: m[1] }];

  // ── KEYWORD with value ──────────────────────────────────────────────────
  m = body.match(/^(Raid|Restore) (\d+)\.?$/);
  if (m) return [{ type: 'KEYWORD', keyword: m[1], value: +m[2] }];

  return [];
}

/**
 * Look up Coordinate effects for a card.
 * Registry (manual) takes precedence over parser (text-derived). Returns [] if
 * neither source produces effects — the card silently has no Coordinate effect.
 *
 * This is the single entry point all engine code should use to access a card's
 * Coordinate effects.
 */
export function getCoordinateAbilities(card: Card): CoordinateEffect[] {
  const registry = CARD_ABILITIES[card.name];
  if (registry) {
    return registry
      .filter((a): a is CoordinateAbility => a.type === 'COORDINATE')
      .map(a => a.effect);
  }
  return parseCoordinateText(card.text ?? '');
}

// ---------------------------------------------------------------------------
// Coordinate ability registry (manual overrides)
//
// Only list cards whose text the parser CANNOT correctly handle, or where we
// want to explicitly override the parser. Every entry here is essentially a
// statement that the parser's behavior on this card is wrong or insufficient.
// ---------------------------------------------------------------------------

export const CARD_ABILITIES: Record<string, CardAbility[]> = {
  // ── Continuous stat buffs ────────────────────────────────────────────────
  '332nd Stalwart':        [{ type: 'COORDINATE', effect: { type: 'STAT_BUFF', atk: 1, hp: 1 } }],
  '41st Elite Corps':      [{ type: 'COORDINATE', effect: { type: 'STAT_BUFF', atk: 0, hp: 3 } }],
  'Clone Heavy Gunner':    [{ type: 'COORDINATE', effect: { type: 'STAT_BUFF', atk: 2, hp: 0 } }],
  'Echo':                  [{ type: 'COORDINATE', effect: { type: 'STAT_BUFF', atk: 2, hp: 2 } }],

  // ── Conditional keyword grants ───────────────────────────────────────────
  'Coruscant Guard':       [{ type: 'COORDINATE', effect: { type: 'KEYWORD', keyword: 'Ambush' } }],
  'Hevy':                  [{ type: 'COORDINATE', effect: { type: 'KEYWORD', keyword: 'Raid', value: 2 } }],
  'Infantry of the 212th': [{ type: 'COORDINATE', effect: { type: 'KEYWORD', keyword: 'Sentinel' } }],
  'Luminara Unduli':       [{ type: 'COORDINATE', effect: { type: 'KEYWORD', keyword: 'Grit' } }],
  'Plo Koon':              [{ type: 'COORDINATE', effect: { type: 'KEYWORD', keyword: 'Raid', value: 3 } }],
  'Republic Commando':     [{ type: 'COORDINATE', effect: { type: 'KEYWORD', keyword: 'Saboteur' } }],

  // ── On-attack effects ────────────────────────────────────────────────────
  'Aayla Secura':          [{ type: 'COORDINATE', effect: { type: 'ON_ATTACK_PREVENT_DAMAGE' } }],
  'Anakin Skywalker':      [{ type: 'COORDINATE', effect: { type: 'ON_ATTACK_DRAW', count: 1 } }],
};
