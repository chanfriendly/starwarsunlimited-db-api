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
   * Triggers the PLAY_ATTACK_EVENT / LEADER_ATTACK_ABILITY two-step flow — not resolved
   * via applyAbilityEffect. grantKeywords is noted but not yet implemented.
   */
  | { type: 'TRIGGER_ATTACK_WITH'; atkBonus: number; hpBonus: number; grantKeywords?: string[] }
  /** Heal N damage from a chosen friendly unit */
  | { type: 'HEAL_UNIT'; amount: number };

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
  /**
   * If true, the ability is only available while Coordinate is active (3+ friendly units).
   * Used for leaders whose ability text reads "Coordinate — Action [Exhaust]: …".
   */
  coordinateRequired?: boolean;
}

/**
 * Leader ability registry — keyed by card ID (not name — multiple leaders share names).
 *
 * TRIGGER_ATTACK_WITH entries are routed through the LEADER_ATTACK_ABILITY action
 * type and the applyLeaderAttackAbility engine function — NOT applyAbilityEffect.
 *
 * All effects are best-effort approximations of card text. Conditions, trait/aspect
 * filters, and secondary clauses that require unbuilt subsystems (Force tokens,
 * token creation, deck search, triggered effects) are omitted. See PROGRESS.md for
 * the full list of unimplemented subsystems.
 */
export const LEADER_ABILITIES: Record<string, LeaderAbility> = {

  // ── Already implemented (kept for reference) ─────────────────────────────
  // Chirrut Îmwe "One With The Force" — "Give a unit +0/+2 for this phase."
  '386':   { resourceCost: 0, effect: { type: 'PHASE_BUFF_UNIT', atk: 0, hp: 2 }, targetKind: 'FRIENDLY_UNIT' },
  // Admiral Ackbar "It's A Trap!" — "Exhaust a non-leader unit." (X-Wing token skipped)
  '19551': { resourceCost: 1, effect: { type: 'EXHAUST_UNIT' }, targetKind: 'ENEMY_UNIT' },

  // ── TRIGGER_ATTACK_WITH ───────────────────────────────────────────────────
  // These abilities route through LEADER_ATTACK_ABILITY, not applyAbilityEffect.
  // Conditions (unit type, arena, card-played checks) are approximated as unconditional.

  // Ahsoka Tano "Snips" — Coordinate — "Attack with a unit. It gets +1/+0."
  '13980': { resourceCost: 0, effect: { type: 'TRIGGER_ATTACK_WITH', atkBonus: 1, hpBonus: 0 }, coordinateRequired: true },
  // Asajj Ventress "Unparalleled Adversary" — "Attack with a unit. +1/+0 if you played an event." (approx +1/+0 always)
  '14276': { resourceCost: 0, effect: { type: 'TRIGGER_ATTACK_WITH', atkBonus: 1, hpBonus: 0 } },
  // Anakin Skywalker "What it Takes to Win" — "Attack with a unit. +2/+0 if attacking a unit." (ignore deal-2-to-own-base cost)
  '14266': { resourceCost: 0, effect: { type: 'TRIGGER_ATTACK_WITH', atkBonus: 2, hpBonus: 0 } },
  // Jyn Erso "Resisting Oppression" — "Attack with a unit. Defender gets -1/-0." (approx plain attack)
  '391':   { resourceCost: 0, effect: { type: 'TRIGGER_ATTACK_WITH', atkBonus: 0, hpBonus: 0 } },
  // IG-88 "Ruthless Bounty Hunter" — "Attack with a unit. +1/+0 if you control more units." (approx +1/+0 always)
  '389':   { resourceCost: 0, effect: { type: 'TRIGGER_ATTACK_WITH', atkBonus: 1, hpBonus: 0 } },
  // Moff Gideon "Formidable Commander" — "Attack with unit costs 3 or less. +1/+0." (ignore cost filter)
  '2754':  { resourceCost: 0, effect: { type: 'TRIGGER_ATTACK_WITH', atkBonus: 1, hpBonus: 0 } },
  // Leia Organa "Alliance General" — "Attack with a Rebel unit, then another Rebel." (approx 1 attack, no filter)
  '205':   { resourceCost: 0, effect: { type: 'TRIGGER_ATTACK_WITH', atkBonus: 0, hpBonus: 0 } },
  // Saw Gerrera "Bring Down the Empire" — "Attack +2/+0 Overwhelm, then defeat it." (Overwhelm + defeat ignored)
  '46057': { resourceCost: 0, effect: { type: 'TRIGGER_ATTACK_WITH', atkBonus: 2, hpBonus: 0 } },
  // Rio Durant "Wisecracking Wheelman" — "Space unit +1/+0 and gains Saboteur." (arena filter + keyword ignored)
  '19546': { resourceCost: 1, effect: { type: 'TRIGGER_ATTACK_WITH', atkBonus: 1, hpBonus: 0 } },
  // Maul "A Rival in Darkness" — "Attack with a unit. It gains Overwhelm." (Overwhelm not modeled)
  '14256': { resourceCost: 0, effect: { type: 'TRIGGER_ATTACK_WITH', atkBonus: 0, hpBonus: 0 } },
  // Han Solo "Never Tell Me the Odds" — "Reveal top card, attack. +1/+0 if different odd cost." (approx +1/+0)
  '19556': { resourceCost: 0, effect: { type: 'TRIGGER_ATTACK_WITH', atkBonus: 1, hpBonus: 0 } },
  // Asajj Ventress "Ambitious Apprentice" — "Token unit +1/+0." (token filter ignored)
  '50887': { resourceCost: 0, effect: { type: 'TRIGGER_ATTACK_WITH', atkBonus: 1, hpBonus: 0 } },
  // Colonel Yularen "This Is Why We Plan" — "Attack, then attack with another costing less." (approx 1 attack)
  '39415': { resourceCost: 0, effect: { type: 'TRIGGER_ATTACK_WITH', atkBonus: 0, hpBonus: 0 } },

  // ── PHASE_BUFF_UNIT ───────────────────────────────────────────────────────
  // Admiral Holdo "We're Not Alone" — "+2/+2 to Resistance unit." (trait filter ignored)
  '19506': { resourceCost: 1, effect: { type: 'PHASE_BUFF_UNIT', atk: 2, hp: 2 }, targetKind: 'FRIENDLY_UNIT' },
  // Kylo Ren "Rash and Deadly" — "+2/+0 to a unit." (discard-from-hand cost ignored)
  '7923':  { resourceCost: 0, effect: { type: 'PHASE_BUFF_UNIT', atk: 2, hp: 0 }, targetKind: 'ANY_UNIT' },
  // Wat Tambor "Techno Union Foreman" — "+2/+2 if a friendly was defeated." (condition ignored)
  '14241': { resourceCost: 0, effect: { type: 'PHASE_BUFF_UNIT', atk: 2, hp: 2 }, targetKind: 'ANY_UNIT' },

  // ── DEAL_DAMAGE_UNIT ──────────────────────────────────────────────────────
  // Darth Vader "Dark Lord of the Sith" (set 1 & 3) — "If played Villainy: 1 dmg to unit + 1 to base." (approx: 1 to unit, ignore base + condition)
  '6':     { resourceCost: 1, effect: { type: 'DEAL_DAMAGE_UNIT', amount: 1 }, targetKind: 'ENEMY_UNIT' },
  '38445': { resourceCost: 1, effect: { type: 'DEAL_DAMAGE_UNIT', amount: 1 }, targetKind: 'ENEMY_UNIT' },
  // Bo-Katan "Princess in Exile" — "If attacked with Mandalorian: 1 damage to a unit." (condition ignored)
  '5406':  { resourceCost: 0, effect: { type: 'DEAL_DAMAGE_UNIT', amount: 1 }, targetKind: 'ENEMY_UNIT' },
  // Luke Skywalker "Hero of Yavin" — "If attacked with Fighter: 1 damage to a unit." (condition ignored)
  '19531': { resourceCost: 0, effect: { type: 'DEAL_DAMAGE_UNIT', amount: 1 }, targetKind: 'ENEMY_UNIT' },
  // Kit Fisto "Focused Jedi Master" — "If attacked with Jedi: 2 damage to a unit." (condition ignored)
  '27079': { resourceCost: 1, effect: { type: 'DEAL_DAMAGE_UNIT', amount: 2 }, targetKind: 'ENEMY_UNIT' },
  // Mace Windu "Vaapad Form Master" — "1 damage to damaged unit, +1 if 5+ damage." (approx 2 total)
  '14271': { resourceCost: 1, effect: { type: 'DEAL_DAMAGE_UNIT', amount: 2 }, targetKind: 'ENEMY_UNIT' },
  // Emperor Palpatine "Galactic Ruler" — "Defeat friendly, deal 1 to unit, draw." (approx: 1 to unit, ignore rest)
  '387':   { resourceCost: 1, effect: { type: 'DEAL_DAMAGE_UNIT', amount: 1 }, targetKind: 'ENEMY_UNIT' },
  // Rey "Nobody" — "If played non-unit Force card: 1 damage to a unit." (condition ignored)
  '27084': { resourceCost: 0, effect: { type: 'DEAL_DAMAGE_UNIT', amount: 1 }, targetKind: 'ENEMY_UNIT' },
  // Asajj Ventress "I Work Alone" — "1 damage to friendly, then 1 to enemy in same arena." (approx: 1 to enemy, ignore self-damage + arena filter)
  '19476': { resourceCost: 0, effect: { type: 'DEAL_DAMAGE_UNIT', amount: 1 }, targetKind: 'ENEMY_UNIT' },
  // Bossk "Hunting His Prey" — "1 damage to unit with Bounty." (Bounty filter ignored)
  '7918':  { resourceCost: 0, effect: { type: 'DEAL_DAMAGE_UNIT', amount: 1 }, targetKind: 'ENEMY_UNIT' },
  // Han Solo "I Got a Really Good Feeling" — "Defeat a token: 1 damage to a unit." (token cost ignored)
  '46137': { resourceCost: 0, effect: { type: 'DEAL_DAMAGE_UNIT', amount: 1 }, targetKind: 'ENEMY_UNIT' },

  // ── DEAL_DAMAGE_OPP_BASE ──────────────────────────────────────────────────
  // Darth Vader "Don't Fail Me Again" — "1 damage to a base."
  '39095': { resourceCost: 1, effect: { type: 'DEAL_DAMAGE_OPP_BASE', amount: 1 } },
  // Sabine Wren "Galvanized Revolutionary" — "1 damage to each base." (approx: opponent's base only)
  '235':   { resourceCost: 0, effect: { type: 'DEAL_DAMAGE_OPP_BASE', amount: 1 } },
  // Captain Phasma "Chrome Dome" — "If played First Order: 1 damage to a base." (condition ignored)
  '19521': { resourceCost: 0, effect: { type: 'DEAL_DAMAGE_OPP_BASE', amount: 1 } },

  // ── DEAL_DAMAGE_ANY (unit or opponent's base) ─────────────────────────────
  // Darth Vader "Unstoppable" — "Discard a card: 1 damage to unit or base." (discard ignored)
  '46107': { resourceCost: 0, effect: { type: 'DEAL_DAMAGE_ANY', amount: 1 }, targetKind: 'ENEMY_UNIT_OR_BASE' },

  // ── EXHAUST_UNIT ──────────────────────────────────────────────────────────
  // C-3PO "Human-Cyborg Relations" — "If you control exhausted unit: exhaust a unit." (condition ignored)
  '39450': { resourceCost: 1, effect: { type: 'EXHAUST_UNIT' }, targetKind: 'ENEMY_UNIT' },

  // ── HEAL_BASE ─────────────────────────────────────────────────────────────
  // Iden Versio "Inferno Squad Commander" — "If enemy unit was defeated: heal 1 from base." (condition ignored)
  '385':   { resourceCost: 0, effect: { type: 'HEAL_BASE', amount: 1 } },

  // ── HEAL_UNIT ─────────────────────────────────────────────────────────────
  // Obi-Wan Kenobi "Patient Mentor" — "Heal 1 damage from a unit."
  '14226': { resourceCost: 0, effect: { type: 'HEAL_UNIT', amount: 1 }, targetKind: 'FRIENDLY_UNIT' },
  // Leia Organa "Get to Your Transports!" — "Heal 1 damage from a friendly unit."
  '38835': { resourceCost: 1, effect: { type: 'HEAL_UNIT', amount: 1 }, targetKind: 'FRIENDLY_UNIT' },
  // Satine Kryze "Standing on Principles" — "Heal up to 2 from a unit, deal that much to own base." (base damage ignored)
  '39400': { resourceCost: 0, effect: { type: 'HEAL_UNIT', amount: 2 }, targetKind: 'FRIENDLY_UNIT' },

  // ── GIVE_SHIELD_FRIENDLY ──────────────────────────────────────────────────
  // Luke Skywalker "Faithful Friend" (set 1 & 3) — "Give a Shield to Heroism unit played this phase." (condition ignored)
  '5':     { resourceCost: 1, effect: { type: 'GIVE_SHIELD_FRIENDLY' }, targetKind: 'FRIENDLY_UNIT' },
  '38440': { resourceCost: 1, effect: { type: 'GIVE_SHIELD_FRIENDLY' }, targetKind: 'FRIENDLY_UNIT' },
  // Anakin Skywalker "Protect Her At All Costs" — "If 2+ units entered play: give a Shield." (condition ignored)
  '50862': { resourceCost: 0, effect: { type: 'GIVE_SHIELD_FRIENDLY' }, targetKind: 'FRIENDLY_UNIT' },
  // Kanan Jarrus "Help Us Survive" — "Give a Shield to a Creature or Spectre unit." (trait filter ignored)
  '27044': { resourceCost: 1, effect: { type: 'GIVE_SHIELD_FRIENDLY' }, targetKind: 'FRIENDLY_UNIT' },
  // Qi'ra "I Alone Survived" — "Deal 2 to friendly, then give it Shield." (approx: just give Shield)
  '7893':  { resourceCost: 1, effect: { type: 'GIVE_SHIELD_FRIENDLY' }, targetKind: 'FRIENDLY_UNIT' },

  // ── DRAW ──────────────────────────────────────────────────────────────────
  // Admiral Trench "Chk-chk-chk-chk" — "Discard 3+ cost card, draw 1." (discard cost ignored)
  '19541': { resourceCost: 0, effect: { type: 'DRAW', count: 1 } },
  // Cassian Andor "Dedicated to the Rebellion" — "If dealt 3+ damage to base this phase: draw." (condition ignored)
  '390':   { resourceCost: 1, effect: { type: 'DRAW', count: 1 } },
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
  'Strategic Analysis':      { effect: { type: 'DRAW', count: 3 } },
  'Tactical Retreat':        { effect: { type: 'DRAW', count: 2 } },
  'Smuggle the Plans':       { effect: { type: 'DRAW', count: 2 } },
  // Draw 2 events — multi-clause or conditional, parser can't reach them
  'I Want Proof, Not Leads': { effect: { type: 'DRAW', count: 2 } },   // "Draw 2 cards, then discard a card" → approx draw 2
  "I've Found Them":         { effect: { type: 'DRAW', count: 1 } },   // "Reveal top 3, draw a unit" → approx draw 1
  'Arms Deal':               { effect: { type: 'DRAW', count: 2 } },   // "Each player draws 2" → approx draw 2
  'Do or Do Not':            { effect: { type: 'DRAW', count: 2 } },   // "Draw 2 (or 1 without Force)" → approx draw 2
  // Search/tutor cards — modeled as draw 1 (we find what we need)
  'Recruit':                 { effect: { type: 'DRAW', count: 1 } },   // "Search top 5 for a unit, draw it"
  'Commission':              { effect: { type: 'DRAW', count: 1 } },   // "Search top 10 for Bounty Hunter/Item/Transport"
  'Bounty Posting':          { effect: { type: 'DRAW', count: 1 } },   // "Search for a Bounty upgrade, draw it"

  // ── Damage to unit or base ────────────────────────────────────────────────
  'Daring Raid':             { effect: { type: 'DEAL_DAMAGE_ANY', amount: 2 }, targetKind: 'ENEMY_UNIT_OR_BASE' },
  'Surprise Strike':         { effect: { type: 'DEAL_DAMAGE_ANY', amount: 3 }, targetKind: 'ENEMY_UNIT_OR_BASE' },
  // Multi-clause damage events where the parser's single-sentence anchor fails
  'That\'s a Rock':          { effect: { type: 'DEAL_DAMAGE_UNIT', amount: 1 }, targetKind: 'ENEMY_UNIT' }, // "Deal 1 damage to a unit." (second clause: discard trigger)
  'Grenade Strike':          { effect: { type: 'DEAL_DAMAGE_UNIT', amount: 2 }, targetKind: 'ENEMY_UNIT' }, // "Deal 2 damage to a unit. You may deal 1 more to another."
  'Drain Essence':           { effect: { type: 'DEAL_DAMAGE_UNIT', amount: 2 }, targetKind: 'ENEMY_UNIT' }, // "Deal 2 damage to a unit. The Force is with you."
  'Contempt for Culture':    { effect: { type: 'DEAL_DAMAGE_UNIT', amount: 2 }, targetKind: 'ENEMY_UNIT' }, // "Deal 2 damage to a non-Vehicle unit." (type filter)
  'Air Superiority':         { effect: { type: 'DEAL_DAMAGE_UNIT', amount: 4 }, targetKind: 'ENEMY_UNIT' }, // "If you control more space units... deal 4 damage to a ground unit." (conditional)
  'Force Choke':             { effect: { type: 'DEAL_DAMAGE_UNIT', amount: 5 }, targetKind: 'ENEMY_UNIT' }, // "Deal 5 damage to a non-Vehicle unit."
  'Electromagnetic Pulse':   { effect: { type: 'DEAL_DAMAGE_UNIT', amount: 2 }, targetKind: 'ENEMY_UNIT' }, // "Deal 2 damage to a Droid or Vehicle unit and exhaust it."
  'Fight Fire With Fire':    { effect: { type: 'DEAL_DAMAGE_UNIT', amount: 3 }, targetKind: 'ENEMY_UNIT' }, // "Deal 3 damage to a friendly + 3 to an enemy" → model enemy damage

  // ── Damage to unit only ───────────────────────────────────────────────────
  'Open Fire':               { effect: { type: 'DEAL_DAMAGE_UNIT', amount: 4 }, targetKind: 'ENEMY_UNIT' },
  "We're In Trouble":        { effect: { type: 'DEAL_DAMAGE_UNIT', amount: 3 }, targetKind: 'ENEMY_UNIT' },
  'Shoot First':             { effect: { type: 'DEAL_DAMAGE_UNIT', amount: 3 }, targetKind: 'ENEMY_UNIT' },
  'Precision Fire':          { effect: { type: 'DEAL_DAMAGE_UNIT', amount: 2 }, targetKind: 'ENEMY_UNIT' },
  'Force Lightning':         { effect: { type: 'DEAL_DAMAGE_UNIT', amount: 5 }, targetKind: 'ENEMY_UNIT' },
  'Orbital Bombardment':     { effect: { type: 'DEAL_DAMAGE_UNIT', amount: 6 }, targetKind: 'ENEMY_UNIT' },
  'Calculated Lethality':    { effect: { type: 'DEAL_DAMAGE_UNIT', amount: 5 }, targetKind: 'ENEMY_UNIT' },
  'No Mercy':                { effect: { type: 'DEAL_DAMAGE_UNIT', amount: 4 }, targetKind: 'ENEMY_UNIT' },
  'Sniper Shot':             { effect: { type: 'DEAL_DAMAGE_UNIT', amount: 3 }, targetKind: 'ENEMY_UNIT' },

  // ── Attack-boosting events (TRIGGER_ATTACK_WITH) ─────────────────────────
  // These multi-clause or type-specific events can't be parsed by parseEventText.
  // Approximation: model as a buff attack, ignoring type filters and secondary clauses.
  // "+0/+0" entries just trigger an extra attack (e.g., Outflank attacking with 1 of 2 units).
  'Outflank':                { effect: { type: 'TRIGGER_ATTACK_WITH', atkBonus: 0, hpBonus: 0 } }, // "Attack with 2 units" → 1 attack (approx)
  'Attack Run':              { effect: { type: 'TRIGGER_ATTACK_WITH', atkBonus: 0, hpBonus: 0 } }, // "Attack with 2 space units" → 1 attack
  'Barrel Roll':             { effect: { type: 'TRIGGER_ATTACK_WITH', atkBonus: 0, hpBonus: 0 } }, // "Attack with a space unit. After, exhaust a space unit."
  'Punch It':                { effect: { type: 'TRIGGER_ATTACK_WITH', atkBonus: 2, hpBonus: 0 } }, // "Attack with a Vehicle unit. It gets +2/+0." (type filter ignored)
  'Desperate Attack':        { effect: { type: 'TRIGGER_ATTACK_WITH', atkBonus: 2, hpBonus: 0 } }, // "Attack with a damaged unit. It gets +2/+0." (condition ignored)
  'Corner the Prey':         { effect: { type: 'TRIGGER_ATTACK_WITH', atkBonus: 1, hpBonus: 0 } }, // "+1/+0 for each damage on defender" → approx +1
  'Flash the Vents':         { effect: { type: 'TRIGGER_ATTACK_WITH', atkBonus: 2, hpBonus: 0 } }, // "+2/+0 gains Overwhelm" (post-attack defeat ignored)
  'One Way Out':             { effect: { type: 'TRIGGER_ATTACK_WITH', atkBonus: 1, hpBonus: 0 } }, // "+1/+0 gains Overwhelm, defender loses abilities"
  'Commence the Festivities':{ effect: { type: 'TRIGGER_ATTACK_WITH', atkBonus: 0, hpBonus: 0 } }, // "gains Saboteur, conditional +2/+0"
  'Dogfight':                { effect: { type: 'TRIGGER_ATTACK_WITH', atkBonus: 0, hpBonus: 0 } }, // "attack with exhausted unit, can't attack bases"
  'I Have You Now':          { effect: { type: 'TRIGGER_ATTACK_WITH', atkBonus: 0, hpBonus: 4 } }, // "Vehicle, prevent all damage to it" → model as +4 HP
  'Niman Strike':            { effect: { type: 'TRIGGER_ATTACK_WITH', atkBonus: 1, hpBonus: 0 } }, // "Force unit, even if exhausted, +1/+0"
  'Rebel Assault':           { effect: { type: 'TRIGGER_ATTACK_WITH', atkBonus: 1, hpBonus: 0 } }, // "REBEL unit +1/+0, then another REBEL +1/+0" → first attack
  'Swoop Down':              { effect: { type: 'TRIGGER_ATTACK_WITH', atkBonus: 2, hpBonus: 0 } }, // "space unit gains Saboteur, can attack ground, +2/+0"
  'Breaking In':             { effect: { type: 'TRIGGER_ATTACK_WITH', atkBonus: 2, hpBonus: 0 } }, // "+2/+0 gains Saboteur"
  'Improvised Detonation':   { effect: { type: 'TRIGGER_ATTACK_WITH', atkBonus: 2, hpBonus: 0 } }, // "+2/+0"
  'Heroic Sacrifice':        { effect: { type: 'TRIGGER_ATTACK_WITH', atkBonus: 2, hpBonus: 0 } }, // "draw 1, attack with +2/+0 gains death trigger" (draw & death ignored)
  'Grim Resolve':            { effect: { type: 'TRIGGER_ATTACK_WITH', atkBonus: 0, hpBonus: 0 } }, // "non-leader unit gains Grit" → approx +0 (Grit value is dynamic)
  'Catch Unawares':          { effect: { type: 'TRIGGER_ATTACK_WITH', atkBonus: 0, hpBonus: 0 } }, // "defender gets -4/+0" (defender debuff, not attacker buff)
  'Tandem Assault':          { effect: { type: 'TRIGGER_ATTACK_WITH', atkBonus: 0, hpBonus: 0 } }, // "space unit, then ground unit gets +2/+0" → 1 attack
  'Headhunting':             { effect: { type: 'TRIGGER_ATTACK_WITH', atkBonus: 2, hpBonus: 0 } }, // "up to 3 units, Bounty Hunters +2/+0" → approx 1 attack

  // ── Phase buffs ───────────────────────────────────────────────────────────
  'Tactical Advantage':      { effect: { type: 'PHASE_BUFF_UNIT', atk: 2, hp: 0 }, targetKind: 'FRIENDLY_UNIT' },
  'Inspire':                 { effect: { type: 'PHASE_BUFF_UNIT', atk: 1, hp: 1 }, targetKind: 'FRIENDLY_UNIT' },
  // Debuffs — commonly played to weaken a key threat
  'Incapacitate':            { effect: { type: 'PHASE_BUFF_UNIT', atk: -2, hp: -2 }, targetKind: 'ENEMY_UNIT' },
  'Mystic Reflection':       { effect: { type: 'PHASE_BUFF_UNIT', atk: -2, hp: 0 }, targetKind: 'ENEMY_UNIT' }, // base case; Force bonus ignored

  // ── Shield ────────────────────────────────────────────────────────────────
  'Shield Generator':        { effect: { type: 'GIVE_SHIELD_FRIENDLY' }, targetKind: 'FRIENDLY_UNIT' },

  // ── Heal ──────────────────────────────────────────────────────────────────
  'Battle Meditation':       { effect: { type: 'HEAL_BASE', amount: 3 } },
  'Force Heal':              { effect: { type: 'HEAL_BASE', amount: 4 } },
  'Medic Support':           { effect: { type: 'HEAL_BASE', amount: 2 } },
  // Multi-clause or non-base heals: model as base heal (most useful approximation)
  "Smuggler's Aid":          { effect: { type: 'HEAL_BASE', amount: 3 } }, // "Heal 3 from your base. Smuggle [...]" — Smuggle text breaks the parser
  'Repair':                  { effect: { type: 'HEAL_BASE', amount: 3 } }, // "Heal 3 from a unit or base" — "or base" not parseable, model as base

  // ── Defeat non-leader unit ────────────────────────────────────────────────
  // "Defeat a non-leader unit." Text confirmed from SWU card database.
  'Vanquish':                { effect: { type: 'DEFEAT_UNIT' }, targetKind: 'ENEMY_UNIT' },
  'Lost and Forgotten':      { effect: { type: 'DEFEAT_UNIT' }, targetKind: 'ENEMY_UNIT' },
  "It's Worse":              { effect: { type: 'DEFEAT_UNIT' }, targetKind: 'ENEMY_UNIT' },
  'Lethal Crackdown':        { effect: { type: 'DEFEAT_UNIT' }, targetKind: 'ENEMY_UNIT' },
};

/** True if a leader ability requires the player to pick a target. */
export function needsLeaderAbilityTarget(cardId: string): boolean {
  return !!LEADER_ABILITIES[cardId]?.targetKind;
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
