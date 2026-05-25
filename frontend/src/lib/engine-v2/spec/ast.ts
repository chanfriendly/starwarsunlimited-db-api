// The card-spec AST. See ENGINE_DESIGN.md §5.
//
// JSON files conform to these types. The interpreter (runtime/interpret.ts)
// walks Effect ASTs; the selector resolver walks Selector ASTs; the predicate
// evaluator walks Predicate ASTs. Each discriminator is a string literal so
// TS narrowing works without runtime checks.
//
// NOTE on field naming: ENGINE_DESIGN uses dotted keys ("card.trait") in JSON
// for readability. We implement with underscores ("card_trait") because dots
// in TS object keys force bracket-access everywhere. The validator (Week 4)
// accepts either form and normalizes; for now hand-authored cards use the
// underscore form.

import type { AspectIcon } from '../state/bus';
import type { PlayerId, Zone } from '../state/types';

// ---------------------------------------------------------------------------
// Predicates
// ---------------------------------------------------------------------------

export type PlayerRef = 'self' | 'opponent' | 'any' | 'controller_of_trigger';

export interface Range { min?: number; max?: number }

export interface PredicateLeaf {
  card_trait?: string;
  card_traits_any?: string[];
  card_type?: 'unit' | 'upgrade' | 'event' | 'leader' | 'base' | 'token';
  card_aspect?: AspectIcon;
  card_cost?: Range;
  card_is_unique?: boolean;
  card_is_token?: boolean;
  card_is_leader_unit?: boolean;
  stat_power?: Range;
  stat_hp?: Range;
  controller?: PlayerRef;
  zone?: Zone;
  self_damage?: Range;
  self_exhausted?: boolean;
  self_upgraded?: boolean;
  player_has_force_token?: boolean;
}

export interface PredicateAnd { and: Predicate[] }
export interface PredicateOr  { or:  Predicate[] }
export interface PredicateNot { not: Predicate }

export type Predicate = PredicateLeaf | PredicateAnd | PredicateOr | PredicateNot;

// ---------------------------------------------------------------------------
// Selectors
// ---------------------------------------------------------------------------

export type ZoneFilter = Zone | Zone[] | 'any_arena' | 'any_zone';

export interface ScopedSelector {
  zone?: ZoneFilter;
  controller?: PlayerRef;
  filter?: Predicate;
  selector?: 'chosen' | 'all' | 'random' | 'self_choose' | 'opponent_choose';
  count?: number | Range | 'all';
}

export type Selector =
  | { self: true }
  | { trigger_source: true }
  | { self_base: true }
  | { opponent_base: true }
  | { all_friendly_units: true; filter?: Predicate }
  | { attached_to_self: true }
  | { exclude: Selector; from: Selector }
  | ScopedSelector;

// Cards-or-base destination. Some effects target a unit OR a base interchangeably
// (damage primarily); the resolver returns this union.
export type ResolvedTarget =
  | { kind: 'unit'; iid: string; controller: PlayerId }
  | { kind: 'base'; controller: PlayerId };

// ---------------------------------------------------------------------------
// Modifiers
// ---------------------------------------------------------------------------

export type Duration =
  | 'permanent'
  | 'while_source_in_play'
  | 'end_of_attack'
  | 'end_of_phase'
  | 'end_of_round'
  | 'until_condition';

export type Restriction = 'attack' | 'be_attacked' | 'ready' | 'exhaust' | 'attack_base';

export interface KeywordGrant {
  name: string;
  value?: number;
}

export interface Modifier {
  duration?: Duration;
  until?: Predicate;
  power?: number;
  health?: number;
  keyword?: string;
  keyword_value?: number;
  keywords?: KeywordGrant[];
  lose_keyword?: string;
  lose_all_abilities?: boolean;
  cant?: Restriction[];
  must?: string[];
}

// ---------------------------------------------------------------------------
// Effects (the AST the interpreter walks)
// ---------------------------------------------------------------------------

export interface DamageEffect {
  effect: 'damage';
  amount: number;
  target: Selector;
  combat?: boolean;
  unpreventable?: boolean;
}

export interface HealEffect {
  effect: 'heal';
  target: Selector;
  amount: number;
}

export interface DefeatEffect {
  effect: 'defeat';
  target: Selector;
}

export interface GiveShieldEffect {
  effect: 'give_shield';
  target: Selector;
  count?: number;
}

export interface DrawEffect {
  effect: 'draw';
  player: PlayerRef;
  count: number;
}

export interface DiscardEffect {
  effect: 'discard';
  player: PlayerRef;
  count: number;
  chooser: PlayerRef;
}

export interface ExhaustEffect {
  effect: 'exhaust';
  target: Selector;
}

export interface ReadyEffect {
  effect: 'ready';
  target: Selector;
}

export interface GiveEffect {
  effect: 'give';
  target: Selector;
  modifier: Modifier;
}

export interface SequenceEffect {
  effect: 'sequence';
  steps: Effect[];
}

export interface IfEffect {
  effect: 'if';
  condition: Predicate;
  then: Effect;
  else?: Effect;
}

export interface NoopEffect {
  effect: 'noop';
}

// Player chooses one option to resolve. `controller` indicates who picks.
export interface ChooseOneEffect {
  effect: 'choose_one';
  prompt?: string;
  chooser?: PlayerRef;
  options: Array<{ label: string; value: string; do: Effect }>;
}

// "You may X" — player can decline.
export interface OptionalEffect {
  effect: 'optional';
  prompt?: string;
  chooser?: PlayerRef;
  do: Effect;
}

export interface CreateTokenEffect {
  effect: 'create_token';
  token_id: string;
  controller: PlayerRef;
  zone: import('../state/types').Zone;
  count?: number;
}

export interface CaptureEffect {
  effect: 'capture';
  target: Selector;
  captor: Selector;
}

export interface RescueEffect {
  effect: 'rescue';
  target: Selector;
}

export type Effect =
  | DamageEffect
  | HealEffect
  | DefeatEffect
  | GiveShieldEffect
  | DrawEffect
  | DiscardEffect
  | ExhaustEffect
  | ReadyEffect
  | GiveEffect
  | SequenceEffect
  | IfEffect
  | NoopEffect
  | ChooseOneEffect
  | OptionalEffect
  | CreateTokenEffect
  | CaptureEffect
  | RescueEffect;

// ---------------------------------------------------------------------------
// Abilities
// ---------------------------------------------------------------------------

// Triggered ability — fires on a matching event.
export type TriggerCondition =
  | 'event.card_played'
  | 'event.card_drawn'
  | 'event.attack_declared'
  | 'event.attack_ended'
  | 'event.defeated'
  | 'event.damage_dealt'
  | 'event.leader_deployed'
  | 'event.token_created'
  | 'event.phase_started'
  | 'event.phase_ended'
  | 'event.round_started'
  | 'event.round_ended';

export type Limit = 'once_per_phase' | 'once_per_round' | 'once_per_game';

export interface TriggeredAbility {
  type: 'triggered';
  on: TriggerCondition;
  where?: TriggerPredicate;
  limit?: Limit;
  optional?: boolean;
  controlled_by?: PlayerRef; // bounty defaults to 'opponent'
  do: Effect;
}

// Predicate evaluated against the triggering event payload, not a card.
export interface TriggerPredicate {
  card?: 'self' | 'trigger_source';
  controller?: PlayerRef;
  attacker?: 'self' | 'trigger_source';
  defender?: 'self' | 'trigger_source';
  card_trait?: string;
  card_type?: string;
  card_aspect?: AspectIcon;
  combat?: boolean;
  // composition
  and?: TriggerPredicate[];
  or?: TriggerPredicate[];
  not?: TriggerPredicate;
}

// Action ability — explicit player action during the action phase.
export interface ActionAbilityCost {
  exhaust?: boolean;
  resources?: number;
  discard?: { player: PlayerRef; count: number };
  defeat?: Selector;
  remove_shield?: Selector;
}

export interface ActionAbility {
  type: 'action';
  cost?: ActionAbilityCost;
  limit?: Limit;
  do: Effect;
}

// Constant ability — always active while the card is in play (or in the
// designated zone for Smuggle). `while` gates the effect with a predicate.
export interface ConstantAbility {
  type: 'constant';
  active_in_zone?: Zone;
  while?: Predicate;
  grant: {
    target: Selector;
    modifier: Modifier;
  };
}

export type Ability = TriggeredAbility | ActionAbility | ConstantAbility;

// ---------------------------------------------------------------------------
// Discriminator helpers
// ---------------------------------------------------------------------------

export const isTriggered = (a: Ability): a is TriggeredAbility => a.type === 'triggered';
export const isAction    = (a: Ability): a is ActionAbility    => a.type === 'action';
export const isConstant  = (a: Ability): a is ConstantAbility  => a.type === 'constant';

export const isPredicateAnd = (p: Predicate): p is PredicateAnd => 'and' in p && Array.isArray((p as PredicateAnd).and);
export const isPredicateOr  = (p: Predicate): p is PredicateOr  => 'or'  in p && Array.isArray((p as PredicateOr).or);
export const isPredicateNot = (p: Predicate): p is PredicateNot => 'not' in p && (p as PredicateNot).not !== undefined;
