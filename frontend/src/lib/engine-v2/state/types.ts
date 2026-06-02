// L1 game state types. See ENGINE_DESIGN.md §3.

import type { CardSpec, BaseSpec } from '../spec/types';
import type { GameEvent } from './bus';

export type PlayerId = string;

export type Zone =
  | 'hand'
  | 'deck'
  | 'discard'
  | 'resource_zone'
  | 'ground_arena'
  | 'space_arena'
  | 'base_zone'
  | 'leader_unit'
  | 'capture_zone'
  | 'set_aside';

export type Phase = 'setup' | 'action' | 'regroup';
export type RegroupStep = 'start' | 'draw' | 'resource' | 'ready' | 'end';

export interface CardInstance {
  iid: string;
  cardId: string;
  damage: number;
  exhausted: boolean;
  upgrades: CardInstance[];
  shieldTokens: number;
  isToken: boolean;
  capturedByIid?: string;
  enteredZoneAt: number;
  deployedThisTurn?: boolean;
  /** The card's OWNER (the player who started the game with it in their deck/
   *  leader/base). Control is positional — whichever arena holds the instance is
   *  its controller — but ownership is fixed. Absent = owner is the current
   *  controller (the common case). Set only when an opponent takes control
   *  (§8.28 Take Control). On defeat a unit returns to its OWNER's discard
   *  (§8.28.2), not the controller's. */
  owner?: PlayerId;
  /** Experience tokens on this unit. Each grants +1/+1 (§SWU); they stack and
   *  persist while the unit is in play. Optional — absent = 0. */
  experienceTokens?: number;
}

export interface BaseInstance {
  cardId: string;
  damage: number;
}

export interface LeaderInstance {
  cardId: string;
  side: 'leader' | 'leader_unit' | 'leader_upgrade';
  isDeployed: boolean;
  unitIid?: string;
  exhausted: boolean;
  /** Deploy is an Epic Action — once per game (§SWU). Set true on deploy and
   *  never cleared, so a leader that's been defeated + flipped back cannot be
   *  redeployed. Optional for back-compat with hand-built test states (absent =
   *  never deployed). */
  hasDeployed?: boolean;
}

export interface CapturedCard {
  iid: string;
  cardId: string;
  originalController: PlayerId;
  originalZone: Zone;
}

export interface CreditToken {
  iid: string;
}

export interface PlayerState {
  id: PlayerId;
  displayName: string;
  hand: CardInstance[];
  deck: CardInstance[];
  discard: CardInstance[];
  resources: CardInstance[];
  creditTokens: CreditToken[];
  groundArena: CardInstance[];
  spaceArena: CardInstance[];
  leaders: LeaderInstance[];
  base: BaseInstance;
  forceToken: boolean;
  capturedByMe: CapturedCard[];
  countersHeld: Array<'initiative' | 'blast' | 'plan'>;
  hasTakenCounterThisRound: boolean;
  hasResourced: boolean;
  perPhaseCounters: Record<string, number>;
  perRoundCounters: Record<string, number>;
  perGameFlags: Set<string>;
}

// Lasting effects ship in Week 2; delayed effects + nested-trigger queueing
// land in Week 3.
import type { LastingEffectRec } from './effects';
export type LastingEffect = LastingEffectRec;
export type DelayedEffect = unknown;

export interface TriggerInstance {
  id: string;
  abilityIndex: number;
  sourceIid: string;
  sourceController: PlayerId;
  /** the event that fired this trigger, snapshot for resolution */
  event: import('./bus').GameEvent;
}

export interface PendingChoice {
  kind: 'choose_one' | 'optional' | 'prompt_target' | 'replacement_order';
  prompt: string;
  player: PlayerId;
  options?: Array<{ label: string; value: string }>;
  validTargets?: string[];
  canPass: boolean;
}

export interface LogEntry {
  round: number;
  player?: PlayerId;
  message: string;
  kind?: 'info' | 'critical';
}

export interface GameState {
  id: string;
  round: number;
  step: number;
  activePlayer: PlayerId;
  initiative: PlayerId;
  phase: Phase;
  regroupStep?: RegroupStep;
  players: Record<PlayerId, PlayerState>;
  playerOrder: PlayerId[];
  lastingEffects: LastingEffect[];
  delayedEffects: DelayedEffect[];
  pendingTriggers: TriggerInstance[];
  pendingChoice?: PendingChoice;
  winner?: PlayerId | 'draw';
  log: LogEntry[];
  consecutivePasses: number;
  _nextIid: number;
}

// Card registry — loaded once at init. Specs are immutable.
export interface CardRegistry {
  cards: Record<string, CardSpec>;
  bases: Record<string, BaseSpec>;
}

export interface StepResult {
  next: GameState;
  events: GameEvent[];
  pendingChoice?: PendingChoice;
}

// Utility: opponent in 2-player; first other in N-player turn order.
export function opponentOf(state: GameState, p: PlayerId): PlayerId {
  for (const other of state.playerOrder) if (other !== p) return other;
  throw new Error(`No opponent for ${p}`);
}

export function nextActivePlayer(state: GameState): PlayerId {
  const i = state.playerOrder.indexOf(state.activePlayer);
  return state.playerOrder[(i + 1) % state.playerOrder.length];
}
