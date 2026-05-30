// Game setup. Builds the initial GameState from PlayerConfigs + a CardRegistry.
//
// Mulligan is skipped in Week 1 — players get their 6-card opening hand
// deterministically. Setup-phase resource placement is exposed as RESOURCE_CARD
// actions during the setup phase; once both players have placed 2 (or
// declined), the engine advances to round 1 action phase.

import { v4 as uuid } from './util/uuid';
import type {
  BaseInstance, CardInstance, CardRegistry, GameState, LeaderInstance, PlayerId, PlayerState,
} from './state/types';
import type { BaseSpec } from './spec/types';

export interface DeckConfig {
  playerId: PlayerId;
  displayName: string;
  baseId: string;
  deckCardIds: string[];
  /** Leader card ids. Twin Suns format uses 2; classic SWU uses 1. Optional
   *  (some test setups don't need leaders). */
  leaderIds?: string[];
}

export interface GameConfig {
  gameId?: string;
  players: DeckConfig[];
  initialActivePlayer?: PlayerId;
  rng?: () => number;
}

export const SETUP_HAND_SIZE = 6;
export const SETUP_RESOURCES = 2;

function shuffle<T>(arr: T[], rng: () => number): T[] {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function mkInstance(cardId: string, iid: string): CardInstance {
  return {
    iid, cardId, damage: 0, exhausted: false, upgrades: [],
    shieldTokens: 0, isToken: false, enteredZoneAt: 0,
  };
}

function newBase(spec: BaseSpec): BaseInstance {
  return { cardId: spec.id, damage: 0 };
}

function newPlayer(
  cfg: DeckConfig,
  reg: CardRegistry,
  start: { iid: number },
  rng: () => number,
): PlayerState {
  const baseSpec = reg.bases[cfg.baseId];
  if (!baseSpec) throw new Error(`Unknown base ${cfg.baseId}`);

  const deck: CardInstance[] = cfg.deckCardIds.map(cid => {
    if (!reg.cards[cid]) throw new Error(`Unknown card ${cid} in ${cfg.playerId}'s deck`);
    return mkInstance(cid, `i${start.iid++}`);
  });
  const shuffled = shuffle(deck, rng);
  const hand = shuffled.slice(0, SETUP_HAND_SIZE);
  const remaining = shuffled.slice(SETUP_HAND_SIZE);

  const leaders: LeaderInstance[] = (cfg.leaderIds ?? []).map(lid => {
    const spec = reg.cards[lid];
    if (!spec) throw new Error(`Unknown leader ${lid} for ${cfg.playerId}`);
    if (spec.type !== 'leader') throw new Error(`${lid} is not a leader spec (type=${spec.type})`);
    return { cardId: lid, side: 'leader', isDeployed: false, exhausted: false, hasDeployed: false };
  });

  return {
    id: cfg.playerId,
    displayName: cfg.displayName,
    hand,
    deck: remaining,
    discard: [],
    resources: [],
    creditTokens: [],
    groundArena: [],
    spaceArena: [],
    leaders,
    base: newBase(baseSpec),
    forceToken: false,
    capturedByMe: [],
    countersHeld: [],
    hasTakenCounterThisRound: false,
    hasResourced: false,
    perPhaseCounters: {},
    perRoundCounters: {},
    perGameFlags: new Set(),
  };
}

export function initGame(cfg: GameConfig, reg: CardRegistry): GameState {
  if (cfg.players.length < 2) throw new Error('initGame: need ≥2 players');
  const rng = cfg.rng ?? Math.random;
  const counter = { iid: 1 };
  const players: Record<PlayerId, PlayerState> = {};
  for (const p of cfg.players) players[p.playerId] = newPlayer(p, reg, counter, rng);

  const order = cfg.players.map(p => p.playerId);
  const first = cfg.initialActivePlayer ?? order[0];

  return {
    id: cfg.gameId ?? uuid(),
    round: 0,
    step: 0,
    activePlayer: first,
    initiative: first,
    phase: 'setup',
    players,
    playerOrder: order,
    lastingEffects: [],
    delayedEffects: [],
    pendingTriggers: [],
    log: [{ round: 0, message: `Game started. ${first} has initiative.`, kind: 'critical' }],
    consecutivePasses: 0,
    _nextIid: counter.iid,
  };
}
