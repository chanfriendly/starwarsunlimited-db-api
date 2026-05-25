// Keyword definition shape. Each v3+ keyword exports a KeywordDef from its
// own file; the registry in keywords/index.ts collects them.
//
// Three flavors of hook, ordered by how often they fire:
//   - modifyOwnPower / modifyOwnHp:   continuous, called on every stat read
//   - lifecycle (onPlay/onDeploy/onCreate/onDefeated): one-shot at zone change
//   - filterAttackActions:            called during getLegalActions / pre-attack
//
// Keywords expressible as plain abilities (a constant + a grant, or a
// triggered + an effect) can ALSO declare `abilities: [...]` and the interpreter
// will execute those. Most v3 keywords need at least one code hook because
// they interact with the engine's action-validation layer.

import type { CardInstance, GameState, PlayerId } from '../../state/types';
import type { Ability } from '../../spec/ast';
import type { CardRegistry } from '../../state/types';

export interface KwStatCtx {
  state: GameState;
  reg: CardRegistry;
  inst: CardInstance;
  owner: PlayerId;
  /** the numeric value following the keyword on this card, if any (e.g. Raid 2 → 2) */
  value?: number;
}

export interface KwLifecycleCtx {
  state: GameState;
  reg: CardRegistry;
  inst: CardInstance;
  owner: PlayerId;
  value?: number;
}

export interface KwAttackFilterCtx {
  state: GameState;
  reg: CardRegistry;
  attackerIid: string;
  attackerOwner: PlayerId;
  /** the unit whose keyword is being consulted */
  keywordHolderIid: string;
  keywordHolderOwner: PlayerId;
  value?: number;
}

export interface KwAttackBonusCtx {
  state: GameState;
  reg: CardRegistry;
  attackerInst: CardInstance;
  attackerOwner: PlayerId;
  value?: number;
}

import type { GameEvent } from '../../state/bus';

export type StepDelta = { state: GameState; events: GameEvent[] };

export interface KeywordDef {
  name: string;
  abilities?: Ability[];

  // Always-on stat hooks (Grit). Return additive bonuses.
  bonusPower?: (ctx: KwStatCtx) => number;
  bonusHp?: (ctx: KwStatCtx) => number;

  // Combat-time stat hooks (Raid).
  attackBonusPower?: (ctx: KwAttackBonusCtx) => number;

  // Lifecycle (Shielded, Ambush).
  onPlay?: (ctx: KwLifecycleCtx) => StepDelta;
  onDeploy?: (ctx: KwLifecycleCtx) => StepDelta;
  onCreate?: (ctx: KwLifecycleCtx) => StepDelta;
  onDefeated?: (ctx: KwLifecycleCtx) => StepDelta;

  // Attack-time hooks (Restore = heal base; Saboteur = defeat shields).
  onAttack?: (ctx: KwLifecycleCtx) => StepDelta;

  // Attack-validation. Sentinel returns 'force_target' to require the keyword
  // holder be chosen as defender; Saboteur returns 'override' to permit
  // ignoring opponent Sentinels.
  attackRestriction?: (ctx: KwAttackFilterCtx) => 'force_target' | 'override' | 'allow';

  // Overwhelm — called after combat damage to compute excess-to-base routing.
  overwhelmExcess?: boolean;
}
