// Public API of engine-v2. The ONLY file outsiders should import from.
// Keep this surface small — it's the contract.

export { step } from './reducer';
export { initGame } from './init';
export { buildRegistry } from './spec/loader';
export { getLegalActions, describeAction } from './legal';
export { defaultChooser, declineChooser, scriptedChooser } from './runtime/chooser';
export { stepAsync, resolveStep } from './runtime/async_step';
export type { AsyncStepResult, PendingStep } from './runtime/async_step';
export type { ResolvedTarget } from './spec/ast';

export type { PlayerAction } from './actions';
export type {
  GameState, PlayerState, CardInstance, BaseInstance, LeaderInstance,
  PlayerId, Zone, Phase, RegroupStep, StepResult, PendingChoice, CardRegistry,
} from './state/types';
export type { GameEvent, CardSnapshot, AspectIcon } from './state/bus';
export type {
  CardSpec, BaseSpec, UnitSpec, EventSpec, UpgradeSpec, LeaderSpec, TokenSpec, KeywordRef,
} from './spec/types';
export type { DeckConfig, GameConfig } from './init';
export type { Chooser, ChoicePrompt, ChoiceResult } from './runtime/chooser';
