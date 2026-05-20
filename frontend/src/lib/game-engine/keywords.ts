import { CardInstance, GameState, PlayerId } from './types';
import { GameAction } from './actions';
import { CARD_ABILITIES, CoordinateEffect } from './abilities';

// ---------------------------------------------------------------------------
// Keyword parsing
// ---------------------------------------------------------------------------

export interface ParsedKeyword {
  name: string;
  value?: number;
}

export function parseKeyword(kw: string): ParsedKeyword {
  const match = kw.trim().match(/^([A-Za-z\s]+?)(?:\s+(\d+))?$/);
  if (!match) return { name: kw };
  return { name: match[1].trim(), value: match[2] ? parseInt(match[2], 10) : undefined };
}

export function getKeywordValue(card: { keywords?: string[] | null }, name: string): number | undefined {
  for (const kw of card.keywords ?? []) {
    const parsed = parseKeyword(kw);
    if (parsed.name.toLowerCase() === name.toLowerCase()) return parsed.value;
  }
  return undefined;
}

export function hasKeyword(card: { keywords?: string[] | null }, name: string): boolean {
  return (card.keywords ?? []).some(kw => parseKeyword(kw).name.toLowerCase() === name.toLowerCase());
}

// ---------------------------------------------------------------------------
// Handler types
// ---------------------------------------------------------------------------

export interface KeywordHandler {
  /** Called after a unit is placed into an arena. Return modified state. */
  onPlay?: (state: GameState, card: CardInstance, playerId: PlayerId) => GameState;
  /** Called after combat damage is applied. Return modified state. */
  onAttack?: (
    state: GameState,
    attacker: CardInstance,
    defenderIid: string | 'base',
    playerId: PlayerId,
  ) => GameState;
  /** Called just before a unit is moved to discard. Return modified state. */
  onDefeated?: (state: GameState, card: CardInstance, ownerId: PlayerId) => GameState;
  /**
   * Filters or extends the legal ATTACK actions for this player.
   * Used by Sentinel to restrict attack targets.
   */
  filterAttackActions?: (
    state: GameState,
    actions: GameAction[],
    playerId: PlayerId,
  ) => GameAction[];
}

// ---------------------------------------------------------------------------
// Coordinate helpers
// ---------------------------------------------------------------------------

/** True while the player controls 3 or more units across both arenas. */
export function isCoordinateActive(state: GameState, ownerId: PlayerId): boolean {
  const p = state.players[ownerId];
  return p.groundArena.length + p.spaceArena.length >= 3;
}

/**
 * Returns all Coordinate effects for a unit that are currently active.
 * Returns [] if the card lacks the Coordinate keyword or if the threshold
 * (3+ units for the owner) is not met.
 */
export function getActiveCoordinateEffects(
  state: GameState,
  inst: CardInstance,
  ownerId: PlayerId,
): CoordinateEffect[] {
  if (!hasKeyword(inst.card, 'Coordinate')) return [];
  if (!isCoordinateActive(state, ownerId)) return [];
  const abilities = CARD_ABILITIES[inst.card.name] ?? [];
  return abilities
    .filter(a => a.type === 'COORDINATE')
    .map(a => a.effect);
}

/**
 * True if the unit has the keyword natively OR via an active Coordinate grant.
 * Use this everywhere the engine checks for a keyword on a unit.
 */
export function hasEffectiveKeyword(
  state: GameState,
  inst: CardInstance,
  ownerId: PlayerId,
  keyword: string,
): boolean {
  if (hasKeyword(inst.card, keyword)) return true;
  const effects = getActiveCoordinateEffects(state, inst, ownerId);
  return effects.some(
    e => e.type === 'KEYWORD' && e.keyword.toLowerCase() === keyword.toLowerCase(),
  );
}

/**
 * Returns the keyword's numeric value, preferring the native value, then any
 * Coordinate-granted value. Returns undefined if neither is present.
 */
export function getEffectiveKeywordValue(
  state: GameState,
  inst: CardInstance,
  ownerId: PlayerId,
  keyword: string,
): number | undefined {
  const native = getKeywordValue(inst.card, keyword);
  if (native !== undefined) return native;
  const effects = getActiveCoordinateEffects(state, inst, ownerId);
  for (const e of effects) {
    if (e.type === 'KEYWORD' && e.keyword.toLowerCase() === keyword.toLowerCase()) {
      return e.value;
    }
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// Continuous power and health computation
// ---------------------------------------------------------------------------

/**
 * Returns the effective attack power of a unit, accounting for continuous
 * keywords that modify power based on game state.
 *
 * Raid is NOT included here — it's an on-attack bonus applied on top of this.
 */
export function computePower(
  state: GameState,
  inst: CardInstance,
  ownerId: PlayerId,
): number {
  let power = inst.card.attack ?? 0;

  // Grit (native or Coordinate-granted): +1 power per damage counter on this unit.
  // Computed live so mid-combat pings are reflected before final damage resolution.
  if (hasEffectiveKeyword(state, inst, ownerId, 'Grit')) {
    power += inst.damage;
  }

  // Coordinate stat buff (attack component)
  for (const e of getActiveCoordinateEffects(state, inst, ownerId)) {
    if (e.type === 'STAT_BUFF') power += e.atk;
  }

  return power;
}

/**
 * Returns the effective maximum HP of a unit, including any Coordinate HP bonus.
 * Use this in defeat checks instead of reading card.health directly.
 */
export function effectiveHealth(
  state: GameState,
  inst: CardInstance,
  ownerId: PlayerId,
): number {
  let hp = inst.card.health ?? 1;
  for (const e of getActiveCoordinateEffects(state, inst, ownerId)) {
    if (e.type === 'STAT_BUFF') hp += e.hp;
  }
  return hp;
}

// ---------------------------------------------------------------------------
// Handler implementations
// ---------------------------------------------------------------------------

function ambushHandler(state: GameState, card: CardInstance, _playerId: PlayerId): GameState {
  // Unit enters play ready (not exhausted) so the player can attack with it this turn
  return mapCard(state, card.iid, c => ({ ...c, exhausted: false }));
}

function shieldedHandler(state: GameState, card: CardInstance, _playerId: PlayerId): GameState {
  return mapCard(state, card.iid, c => ({ ...c, shieldTokens: c.shieldTokens + 1 }));
}

function sentinelFilter(
  state: GameState,
  actions: GameAction[],
  playerId: PlayerId,
): GameAction[] {
  const oppId = (playerId === 'player1' ? 'player2' : 'player1') as PlayerId;
  const opp   = state.players[oppId];

  // Check both native Sentinel and Coordinate-granted Sentinel (Infantry of the 212th)
  const groundSentinels = opp.groundArena.filter(c => hasEffectiveKeyword(state, c, oppId, 'Sentinel'));
  const spaceSentinels  = opp.spaceArena.filter(c => hasEffectiveKeyword(state, c, oppId, 'Sentinel'));

  if (groundSentinels.length === 0 && spaceSentinels.length === 0) return actions;

  const me = state.players[playerId];
  const myGroundIids = new Set(me.groundArena.map(c => c.iid));
  const mySpaceIids  = new Set(me.spaceArena.map(c => c.iid));

  return actions.filter(a => {
    if (a.type !== 'ATTACK') return true;

    const attackerInGround = myGroundIids.has(a.attackerIid);
    const attackerInSpace  = mySpaceIids.has(a.attackerIid);

    if (attackerInGround && groundSentinels.length > 0) {
      // Saboteur (native or Coordinate-granted) ignores Sentinel
      const attacker = me.groundArena.find(c => c.iid === a.attackerIid);
      if (attacker && hasEffectiveKeyword(state, attacker, playerId, 'Saboteur')) return true;

      const sentinelIids = new Set(groundSentinels.map(c => c.iid));
      return sentinelIids.has(a.defenderIid as string);
    }
    if (attackerInSpace && spaceSentinels.length > 0) {
      const attacker = me.spaceArena.find(c => c.iid === a.attackerIid);
      if (attacker && hasEffectiveKeyword(state, attacker, playerId, 'Saboteur')) return true;

      const sentinelIids = new Set(spaceSentinels.map(c => c.iid));
      return sentinelIids.has(a.defenderIid as string);
    }
    return true;
  });
}

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

export const KEYWORD_HANDLERS: Record<string, KeywordHandler> = {
  Ambush:     { onPlay: ambushHandler },
  Shielded:   { onPlay: shieldedHandler },
  Sentinel:   { filterAttackActions: sentinelFilter },
  // Raid, Restore, Overwhelm applied inline in engine combat (modify damage values)
  Raid:       {},
  Restore:    {},
  Overwhelm:  {},
  // Grit: handled via computePower() — no state side-effect needed here
  Grit:       {},
  // Saboteur: (1) Sentinel bypass handled in sentinelFilter above;
  //           (2) shield strip applied inline in applyAttack
  Saboteur:   {},
  // Coordinate: requires per-card ability system — see PROGRESS.md
  Coordinate: {},
};

// ---------------------------------------------------------------------------
// Lifecycle dispatch helpers (called by engine)
// ---------------------------------------------------------------------------

export function dispatchOnPlay(
  state: GameState,
  card: CardInstance,
  playerId: PlayerId,
): GameState {
  let s = state;

  // Native keyword on-play handlers
  for (const kw of card.card.keywords ?? []) {
    const { name } = parseKeyword(kw);
    const handler = KEYWORD_HANDLERS[name]?.onPlay;
    if (handler) s = handler(s, card, playerId);
  }

  // Coordinate keyword grants: trigger the corresponding on-play handler if
  // Coordinate is now active (unit counts itself since it's already in the arena)
  if (hasKeyword(card.card, 'Coordinate') && isCoordinateActive(s, playerId)) {
    for (const e of getActiveCoordinateEffects(s, card, playerId)) {
      if (e.type === 'KEYWORD') {
        const handler = KEYWORD_HANDLERS[e.keyword]?.onPlay;
        if (handler) s = handler(s, card, playerId);
      }
    }
  }

  return s;
}

export function dispatchOnDefeated(
  state: GameState,
  card: CardInstance,
  ownerId: PlayerId,
): GameState {
  let s = state;
  for (const kw of card.card.keywords ?? []) {
    const { name } = parseKeyword(kw);
    const handler = KEYWORD_HANDLERS[name]?.onDefeated;
    if (handler) s = handler(s, card, ownerId);
  }
  return s;
}

export function applyAttackFilters(
  state: GameState,
  actions: GameAction[],
  playerId: PlayerId,
): GameAction[] {
  const oppId = (playerId === 'player1' ? 'player2' : 'player1') as PlayerId;
  const opp = state.players[oppId];
  const allUnits = [...opp.groundArena, ...opp.spaceArena];

  let filtered = actions;
  // Track which filter names have already run to avoid duplicate passes.
  const ranFilters = new Set<string>();

  for (const unit of allUnits) {
    // Native keyword filters
    for (const kw of unit.card.keywords ?? []) {
      const { name } = parseKeyword(kw);
      const handler = KEYWORD_HANDLERS[name]?.filterAttackActions;
      if (handler && !ranFilters.has(name)) {
        filtered = handler(state, filtered, playerId);
        ranFilters.add(name);
      }
    }

    // Coordinate-granted keyword filters (e.g. Infantry of the 212th → Sentinel)
    for (const e of getActiveCoordinateEffects(state, unit, oppId)) {
      if (e.type !== 'KEYWORD') continue;
      const handler = KEYWORD_HANDLERS[e.keyword]?.filterAttackActions;
      if (handler && !ranFilters.has(e.keyword)) {
        filtered = handler(state, filtered, playerId);
        ranFilters.add(e.keyword);
      }
    }
  }
  return filtered;
}

// ---------------------------------------------------------------------------
// Internal utility — update a CardInstance anywhere in state
// ---------------------------------------------------------------------------

function mapCard(
  state: GameState,
  iid: string,
  fn: (c: CardInstance) => CardInstance,
): GameState {
  const mapArr = (arr: CardInstance[]) =>
    arr.map(c => (c.iid === iid ? fn(c) : c));

  return {
    ...state,
    players: {
      player1: mapPlayerCard(state.players.player1, iid, fn, mapArr),
      player2: mapPlayerCard(state.players.player2, iid, fn, mapArr),
    },
  };
}

function mapPlayerCard(
  p: import('./types').PlayerState,
  iid: string,
  fn: (c: CardInstance) => CardInstance,
  mapArr: (arr: CardInstance[]) => CardInstance[],
): import('./types').PlayerState {
  return {
    ...p,
    hand:        mapArr(p.hand),
    groundArena: mapArr(p.groundArena),
    spaceArena:  mapArr(p.spaceArena),
  };
}
