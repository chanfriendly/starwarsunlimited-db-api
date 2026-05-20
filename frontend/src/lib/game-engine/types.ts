import { Card } from '@/lib/api';

export type PlayerId = 'player1' | 'player2';
export type Phase = 'action' | 'regroup' | 'setup';
export type ArenaId = 'ground' | 'space';

export interface CardInstance {
  iid: string;
  card: Card;
  exhausted: boolean;
  damage: number;
  upgrades: CardInstance[];
  shieldTokens: number;
  /** Prevents attacking the turn a leader is deployed */
  deployedThisTurn?: boolean;
}

export interface LeaderInstance {
  card: Card;
  isDeployed: boolean;
  /** iid of the CardInstance added to arena on deploy */
  unitIid?: string;
}

export interface BaseInstance {
  card: Card;
  damage: number;
}

export interface PlayerState {
  id: PlayerId;
  deck: CardInstance[];
  hand: CardInstance[];
  discard: CardInstance[];
  resources: { total: number; available: number };
  groundArena: CardInstance[];
  spaceArena: CardInstance[];
  /** Twin Suns: always 2 leaders */
  leaders: LeaderInstance[];
  base: BaseInstance;
  /** True once the player takes the counter this round */
  hasCountered: boolean;
  /** True once the player has made their resource selection during regroup/setup */
  hasResourced: boolean;
  /** During setup phase: how many more resources this player can still place (starts at 2) */
  setupResourcesLeft: number;
}

export interface LogEntry {
  round: number;
  player?: PlayerId;
  message: string;
  time?: string;
  kind?: 'critical';
}

export interface GameState {
  id: string;
  round: number;
  activePlayer: PlayerId;
  /** Who holds the initiative token this round */
  initiative: PlayerId;
  phase: Phase;
  players: Record<PlayerId, PlayerState>;
  winner?: PlayerId | 'draw';
  actionLog: LogEntry[];
  /** Internal counter — incremented to produce unique iids */
  _nextIid: number;
}

export interface PlayerConfig {
  playerId: PlayerId;
  displayName: string;
  /** Twin Suns: exactly 2 */
  leaders: Card[];
  base: Card;
  /** The 50 non-leader, non-base deck cards (duplicates expanded by quantity) */
  deck: Card[];
}

export interface GameConfig {
  gameId?: string;
  player1: PlayerConfig;
  player2: PlayerConfig;
}
