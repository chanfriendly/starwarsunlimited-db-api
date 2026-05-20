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
