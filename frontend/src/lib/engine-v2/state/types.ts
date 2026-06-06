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
  // Twin Suns format: "Take the Initiative" is replaced by "Take an Available
  // Counter" — three counters (Initiative, Blast, Plan), each takeable once per
  // round, one per player. Initiative → go first next round; Blast → 1 damage to
  // each enemy base; Plan → draw 1 then bottom a card. Taking any counter ends
  // your turns for the round. (Official Twin Suns insert.)
  countersHeld: Array<'initiative' | 'blast' | 'plan'>;
  hasTakenCounterThisRound: boolean;
  hasResourced: boolean;
  perPhaseCounters: Record<string, number>;
  perRoundCounters: Record<string, number>;
  perGameFlags: Set<string>;
  /** One-shot play-cost discounts awaiting a matching card play ("the next unit
   *  you play this phase costs N less" — General's Blade). Each applies to (and
   *  is consumed by) the first matching play; matching discounts STACK on one
   *  play. Cleared at end of phase. Optional for back-compat with hand-built
   *  states. */
  discounts?: PendingDiscount[];
}

/** A pending one-shot play-cost discount on a player. `cardType` (if set) gates
 *  which cards it applies to ("unit" → only units); keyed by card type rather
 *  than a full predicate so `effectiveCost` stays free of the predicate
 *  evaluator. Consumed by the first matching play; phase-scoped. */
export interface PendingDiscount {
  amount: number;
  cardType?: 'unit' | 'event' | 'upgrade';
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
  /** For abilities GRANTED to the host by an attached upgrade ("Attached unit
   *  gains: '<ability>'"): the granted ability, snapshotted inline so resolution
   *  doesn't re-derive it by index (the grant is context-dependent — e.g. a
   *  granted When-Defeated fires after the upgrade has already detached). When
   *  set, resolution uses this instead of `cardAbilities(source)[abilityIndex]`. */
  grantedAbility?: import('../spec/ast').TriggeredAbility;
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
  /** Twin Suns: counters taken this round (game-wide). Each of initiative/blast/
   *  plan can be taken at most once per round by at most one player. Reset at
   *  round end. Optional for back-compat with hand-built states (absent = none
   *  taken). */
  countersTakenThisRound?: Array<'initiative' | 'blast' | 'plan'>;
  /** `step` at which the current action phase began. A unit whose
   *  `enteredZoneAt >=` this entered play during this phase — used by Hidden
   *  (§18: can't be attacked the phase it was played/deployed/created). Optional
   *  for back-compat (absent → no unit counts as "entered this phase"). */
  phaseStartedAtStep?: number;
  /** Controllers of units that have LEFT PLAY (defeated / returned to hand /
   *  captured) during the current action phase — for "if a [friendly] unit left
   *  play this phase, …". Reset at action-phase start. Optional for back-compat
   *  (absent → none left play). A controller may appear more than once. */
  leftPlayThisPhase?: PlayerId[];
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
