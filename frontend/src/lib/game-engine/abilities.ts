// Per-card ability registry.
// Keyed by card name (not card ID — IDs can change between DB builds).
// Where multiple cards share a name, the effect is the same across printings.

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
  | { type: 'ON_ATTACK_PREVENT_DAMAGE' };

export interface CoordinateAbility {
  type: 'COORDINATE';
  effect: CoordinateEffect;
}

export type CardAbility = CoordinateAbility;

// ---------------------------------------------------------------------------
// Registry
//
// Only includes cards whose Coordinate effects the engine can evaluate:
//   - STAT_BUFF: continuous attack/health bonus
//   - KEYWORD: grants an existing engine-handled keyword (Raid, Grit, Saboteur,
//              Sentinel, Ambush) while Coordinate is active
//   - ON_ATTACK_DRAW: simple card draw on attack
//   - ON_ATTACK_PREVENT_DAMAGE: attacker avoids combat damage for this attack
//
// NOT included (require targeted or event-based UI not yet implemented):
//   Clone Commander Cody   — buffs all other friendlies (continuous aura)
//   Clone Dive Trooper     — debuffs defender attack (requires per-attack temp state)
//   Padmé (Pursuing Peace) — debuffs enemy attack for the phase
//   Kit Fisto              — deal 3 to a chosen ground unit (needs target selection)
//   Ki-Adi-Mundi           — triggered by opponent's second card each phase
//   Pelta Supply Frigate   — create a Clone Trooper token when played
//   Reckless Torrent       — deal 2 damage each way when played
//   Sanctioner's Shuttle   — capture an enemy unit when played
//   Ahsoka Tano (Leader)   — new action type (attack with a unit, +1/+0)
//   Padmé Amidala (Leader) — new action type (deck search)
//   For The Republic       — upgrade that grants Coordinate Restore 2
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
// Coordinate ability registry (original)
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
