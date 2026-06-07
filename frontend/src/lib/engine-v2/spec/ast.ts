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
  /** True iff the unit being evaluated has at least one Shield token. For
   *  "defeat an enemy unit with a Shield token on it"-style targeting. */
  has_shield_token?: boolean;
  /** Remaining HP = effective HP − damage. For "defeat a unit with N or less
   *  remaining HP"-style targeting. Unlike stat_hp (printed), this is the
   *  rules-accurate current HP including upgrade/aura/Experience buffs. Safe
   *  from the modifier cycle because it's only used in selector FILTERS, never
   *  in a constant ability's `while:` (which is what effectiveHp scans). */
  remaining_hp?: Range;
  player_has_force_token?: boolean;
  /** Count of units the *controller of the card under evaluation* has in any arena.
   *  Used by Coordinate ("if you control 3 or more units…") via a constant
   *  ability's `while:` clause. Counts both arenas combined. */
  controller_unit_count?: Range;
  /** Count of resources the controller has (ready + exhausted). For
   *  "while you control N or more resources…" self-conditional buffs. */
  controller_resource_count?: Range;
  /** True iff the controller has at least one in-arena unit with this trait.
   *  For "while you control a Vehicle unit, this gains Sentinel"-style cards. */
  controller_controls_trait?: string;
  /** True iff the controller has at least one in-arena unit matching `filter`
   *  (any unit if omitted). `exclude_self` drops the unit being evaluated, for
   *  "while you control ANOTHER <X> unit, …". Generalizes controller_controls_trait
   *  to aspects/power/"another". */
  controller_controls?: { filter?: Predicate; exclude_self?: boolean };
  /** True iff a unit left play this action phase: 'friendly' = one the evaluated
   *  card's controller controlled; 'any' = any player's. For "if a [friendly]
   *  unit left play this phase, …". Reads `state.leftPlayThisPhase`. */
  unit_left_play_this_phase?: 'friendly' | 'any';
  /** Range over the count of DISTINCT keyword names among the controller's
   *  in-play units (printed keywords + those on attached upgrades). For "if there
   *  are 4 or more different keywords among friendly units, …" (The Darksaber). */
  controller_distinct_keywords?: Range;
}

export interface PredicateAnd { and: Predicate[] }
export interface PredicateOr  { or:  Predicate[] }
export interface PredicateNot { not: Predicate }

export type Predicate = PredicateLeaf | PredicateAnd | PredicateOr | PredicateNot;

// ---------------------------------------------------------------------------
// Selectors
// ---------------------------------------------------------------------------

export type ZoneFilter = Zone | Zone[] | 'any_arena' | 'any_zone' | 'host_arena';

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
  /** The DEFENDER of the triggering attack event — "the defender" / "the
   *  attacked unit". Resolved from ATTACK_DECLARED/ATTACK_ENDED.defenderIid.
   *  Used by upgrade-granted On-Attack abilities ("Exhaust the defender"). */
  | { trigger_defender: true }
  | { self_base: true }
  | { opponent_base: true }
  /** "a base" — the source player chooses which base (theirs or an opponent's).
   *  The default/AI chooser picks the opponent's base (the sane aggressive
   *  default). Resolves to a single base ResolvedTarget. */
  | { chosen_base: true }
  /** The base of the controller of the unit in the triggering event — i.e. "its
   *  controller's base" on a defeat trigger. Resolved from DEFEATED.lastKnown.
   *  controller. Falls back to opponent's base if there's no usable trigger. */
  | { trigger_controller_base: true }
  | { all_friendly_units: true; filter?: Predicate }
  /** The upgrade's host. Optional `filter` gates on the host (e.g. "If attached
   *  unit is a Sith, it gains Grit" → filter `{ card_trait: 'sith' }`); the host
   *  must match or the selector resolves empty. */
  | { attached_to_self: true; filter?: Predicate }
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

/** Count source for per-X scaling modifiers ("+1/+1 for each resource you
 *  control", "for each upgrade on this unit"). Evaluated live in the modifier
 *  aggregator against the target's controller / the target instance. */
export type PerCount = 'controller_resources' | 'controller_units' | 'self_upgrades' | 'controller_discard_units';

export interface Modifier {
  duration?: Duration;
  until?: Predicate;
  power?: number;
  health?: number;
  /** Dynamic bonus: `power`/`health` multiplied by a live count. Stacks with
   *  the flat `power`/`health` above. `filter` (only for `controller_discard_units`)
   *  restricts which discard cards count — "for each Trooper unit in your discard
   *  pile" → `count: 'controller_discard_units', filter: { card_trait: 'trooper' }`. */
  per?: { count: PerCount; power?: number; health?: number; filter?: Predicate };
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
  /** Fixed damage amount. Provide this OR `amountFromPower` (exactly one). */
  amount?: number;
  /** Dynamic damage: "deals damage equal to its power". The amount is the
   *  effective power of the FIRST unit this selector resolves to (usually
   *  `{ self: true }` — "this unit deals damage equal to his power"), snapshot
   *  once before any damage is dealt. Non-unit / empty resolution → 0. */
  amountFromPower?: Selector;
  target: Selector;
  combat?: boolean;
  unpreventable?: boolean;
  /** Indirect damage has no specific source per §v7 8.35; it bypasses shields
   *  and is non-combat. Used by AOE / distributed damage abilities. */
  indirect?: boolean;
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

/** Give Experience token(s) to the target unit(s). Each token = +1/+1, stacks,
 *  persists while in play (§SWU). `count` defaults to 1. */
export interface GiveExperienceEffect {
  effect: 'give_experience';
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

/** "<do>. If you do, <then>." — the `then` effect resolves only if `do` actually
 *  happened. "Happened" = `do` produced at least one event (a declined optional,
 *  or an effect that found no legal target, emits nothing → `then` is skipped).
 *  `do` is often an `optional` ("You may return a unit … If you do, draw a card.").
 *  `else_` (optional) resolves instead when `do` did NOT happen — for the
 *  "If you do, X. If you do not, Y." shape. Either or both of `then`/`else_` may
 *  be present (at least one). Distinct from `if` (which branches on a card
 *  predicate, not on whether a prior effect resolved). */
export interface IfDidEffect {
  effect: 'if_did';
  do: Effect;
  then?: Effect;
  else_?: Effect;
}

// Player chooses option(s) to resolve. `chooser` indicates who picks.
// `count` (default 1) is how many DISTINCT options to pick and resolve in pick
// order — `count: 2` models "Choose two, in any order:". Picking fewer than
// `count` only happens when there aren't enough options.
export interface ChooseOneEffect {
  effect: 'choose_one';
  prompt?: string;
  chooser?: PlayerRef;
  count?: number;
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
  /** Optional modifier granted to EACH created token immediately ("create N
   *  tokens and give those tokens <Keyword> for this phase" — Chancellor
   *  Palpatine). Registered as a per-token lasting effect with the modifier's
   *  duration (e.g. end_of_phase), so it avoids a cross-effect "those tokens"
   *  binding. */
  grant?: Modifier;
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

/** Move a unit between arenas. `to: 'other_arena'` swaps to the opposite arena
 *  of its current one (Plot units, etc.). Non-arena targets are skipped. */
export interface MoveEffect {
  effect: 'move';
  target: Selector;
  to: 'ground_arena' | 'space_arena' | 'other_arena';
}

/** Multi-source power damage: each unit resolved by `sources` deals damage
 *  equal to ITS OWN effective power to the unit resolved by `target`.
 *   • Focus Fire: "Each friendly Vehicle unit in the same arena deals damage
 *     equal to its power to that unit" — `sources` = all friendly Vehicles,
 *     `sources_same_arena_as_target` filters them to the target's arena.
 *   • Maximum Firepower: two chosen friendly Imperial units, same target —
 *     `sources` is a chosen selector (count 2).
 *  Distinct from `damage.amountFromPower` (single self-source). Powers are read
 *  per source from current state; a source that has left play is skipped. */
export interface PowerDamageFromEachEffect {
  effect: 'power_damage_from_each';
  sources: Selector;
  target: Selector;
  sources_same_arena_as_target?: boolean;
}

/** "Use the Force (lose your Force token). If you do, X." A Force token is a
 *  per-player resource — each player may have at most one. Using it spends the
 *  source controller's token (sets `forceToken` false) and resolves `do`. If the
 *  controller has no Force token, this is a no-op (the `do` doesn't happen). */
export interface UseForceEffect {
  effect: 'use_force';
  do: Effect;
}

/** "The Force is with you (create your Force token)." Gain a Force token (max
 *  one per player — gaining when you already have it is a no-op). */
export interface GainForceEffect {
  effect: 'gain_force';
  player?: PlayerRef;
}

/** "This unit attacks." / "This unit may attack." / "Attack with a unit." — a
 *  nested attack from an ability (§7.6.12). `attacker` defaults to `{ self: true }`
 *  (the source unit). `count` (default 1) makes that many sequential attacks
 *  (§ "if an ability triggers multiple attacks, resolve them sequentially") —
 *  this is the "attacks twice"/"makes an additional attack" multi-attack shape.
 *  The defender is chosen each attack from eligible enemy units/base in the
 *  attacker's arena (via the chooser); an attack with no legal target is skipped.
 *  A nested attack may be made even by an exhausted attacker (the ability is the
 *  "unless otherwise specified" exception to the ready requirement). */
export interface AttackEffect {
  effect: 'attack';
  attacker?: Selector;
  count?: number;
  /** A buff applied to the resolved attacker FOR THIS ATTACK ("Attack with a
   *  unit. It gets +2/+0 and gains Overwhelm for this attack."). Added as a
   *  lasting effect on the attacker before combat and removed after, so it
   *  affects exactly this attack. */
  attacker_buff?: Modifier;
  /** Gates `attacker_buff` on the CHOSEN attacker ("…If it's an Imperial unit,
   *  it gets +2/+0 for this attack" — Snowtrooper Lieutenant). The buff applies
   *  only if the attacker matches; the attack happens either way. */
  attacker_buff_if?: Predicate;
  /** A debuff applied to the CHOSEN defender FOR THIS ATTACK ("Attack with a
   *  unit. The defender gets -4/-0 for this attack." — Catch Unawares). Applied
   *  as a lasting effect on the defender before combat and removed after; only
   *  unit defenders are affected (a base can't be debuffed). */
  defender_debuff?: Modifier;
}

/** "Return a unit to its owner's hand" (bounce). The unit leaves play and goes
 *  to its owner's hand as a fresh card: damage, exhaust, shields and Experience
 *  reset; attached upgrades are discarded (upgrades can't go to hand). Leader
 *  units are skipped (they have their own flip-back rules, not hand-return).
 *  Owner = controller until a control-transfer mechanic adds a separate owner. */
export interface ReturnToHandEffect {
  effect: 'return_to_hand';
  target: Selector;
}

/** "Return a [unit] from your discard pile to your hand" (recursion). The
 *  chooser picks `count` (default 1) cards from `player`'s discard pile matching
 *  `filter` and moves them to that player's hand as fresh cards (damage / exhaust
 *  / shields / Experience reset — a card in hand carries no in-play state). The
 *  card can then be replayed normally. No-op if the discard has no match. */
export interface ReturnFromDiscardEffect {
  effect: 'return_from_discard';
  player: PlayerRef;
  filter?: Predicate;
  count?: number;
}

/** "Take control of an enemy unit" (§8.28). The unit moves to the source
 *  player's matching arena and they become its controller — permanently (control
 *  does NOT revert at regroup). It keeps its ready/exhausted status, damage, and
 *  upgrades. The original controller is recorded as the unit's `owner` (if not
 *  already set) so it returns to the owner's discard on defeat (§8.28.2). A
 *  Leader Unit can't change control — it is defeated instead (§1.6). */
export interface TakeControlEffect {
  effect: 'take_control';
  target: Selector;
}

/** "Choose a friendly unit and an enemy unit. Exchange control of those units."
 *  (Choose Sides). The `friendly` target moves to the OPPONENT's control and the
 *  `enemy` target moves to the SOURCE player's control — a two-way control swap.
 *  Same per-unit rules as take_control (keeps damage/upgrades/exhausted, records
 *  `owner`, a Leader Unit is defeated instead of changing control — §1.6). */
export interface ExchangeControlEffect {
  effect: 'exchange_control';
  friendly: Selector;
  enemy: Selector;
}

/** "The attacking player takes control of this upgrade and attaches it to a unit
 *  they control." (Death Star Plans.) The SOURCE upgrade detaches from its
 *  current host and re-attaches to a unit chosen by `new_controller`. Control of
 *  an upgrade is positional (it follows its host), so moving it onto the new
 *  controller's unit transfers control. The original host's controller is
 *  recorded as the upgrade's `owner` (so it returns to the owner's discard on
 *  defeat). `new_controller: 'trigger_attacker'` reads the attacker of the
 *  triggering attack event. No-op if that player controls no unit to host it. */
export interface TransferUpgradeEffect {
  effect: 'transfer_upgrade';
  new_controller: 'trigger_attacker';
}

/** "Name a card. While this unit is in play, opponents can't play the named
 *  card." (Regional Governor.) The source unit's controller names a card; the
 *  chosen NAME is recorded on the source unit (`namedCard`). The play-restriction
 *  itself is a continuous effect enforced in legal.ts + reducer.applyPlayCard
 *  (opponents can't play a card of that name while the source unit is in play).
 *  Self-referential — always names on behalf of, and records on, the source. */
export interface NameCardEffect {
  effect: 'name_card';
}

/** Peek at a hidden zone without changing state. The runtime emits a
 *  CARD_REVEALED event per peeked card so the chooser/UI can display them. */
export interface LookAtEffect {
  effect: 'look_at';
  player: PlayerRef;       // whose zone is being peeked
  source: 'deck_top' | 'opponent_hand';
  count?: number;          // for deck_top; ignored for opponent_hand
}

/** Disclose: reveal a card from your hand matching a filter, optionally
 *  conferring a benefit (the do-block belongs in the calling sequence). The
 *  primitive itself emits CARD_DISCLOSED with the disclosed card's aspects so
 *  downstream code can branch on them. Per §v7 7.4 Disclose keyword. */
export interface DiscloseEffect {
  effect: 'disclose';
  player: PlayerRef;
  filter?: Predicate;
  count?: number;
}

/** Search the top N of a deck for a card matching `filter`, move it to `to`,
 *  return the rest to the deck (in order — true shuffling isn't deterministic
 *  here yet). The chooser picks among matches. */
export interface SearchEffect {
  effect: 'search';
  player: PlayerRef;
  count: number;
  filter?: Predicate;
  to: 'hand' | 'discard';
  reveal?: boolean;        // default true: emit CARD_REVEALED for the chosen card
}

/** "Search the top `count` cards of your deck for any number of <units matching
 *  `filter`> with combined cost ≤ `max_combined_cost` and play each for free."
 *  (Darth Vader — Commanding the First Legion.) The chosen units enter their
 *  arena for free (exhausted; When-Played fires); the deck is shuffled afterward
 *  (§8.36). Units only. Always acts on the source player's deck. */
export interface SearchPlayEffect {
  effect: 'search_play';
  count: number;
  filter?: Predicate;
  max_combined_cost?: number;
}

/** Divided damage: distribute `amount` damage among any number of candidates in
 *  `pool`. The chooser is consulted once per point — each prompt is a
 *  choose_one over the surviving pool. Default behavior (no scripted choices)
 *  is deterministic: every point lands on the leftmost remaining candidate.
 *  Defaults to indirect — per §v7 8.35.1, divided damage from an ability is
 *  non-combat and shieldless unless the source explicitly says otherwise. */
export interface DividedDamageEffect {
  effect: 'divided_damage';
  amount: number;
  pool: Selector;
  indirect?: boolean;      // default true
}

/** Indirect damage to a player (§8.35). "Deal N indirect damage to a player":
 *  choose a player — THAT player assigns N unpreventable damage, divided as they
 *  choose, among their base and any of their units, capped per unit at its
 *  remaining HP (§8.35.3), all simultaneously (§8.35.5), ignoring Shield tokens
 *  without consuming them (§8.35.2a). The ASSIGNING player is the recipient
 *  (`player`), NOT the source's controller — unlike `divided_damage`, where the
 *  source distributes. `player` is almost always 'opponent' ("the defending
 *  player"). Distinct from a `damage` effect with `indirect: true` (that targets
 *  specific units/base chosen by the ability; this hands assignment to the
 *  recipient over their whole board). */
export interface IndirectDamageEffect {
  effect: 'indirect_damage';
  amount: number;
  player: PlayerRef;
}

/** "Put this <card> into play as a resource." The source card becomes a resource
 *  in its controller's resource zone. Used two ways: Resupply (an event, instead
 *  of going to discard) and When-Defeated units like Superlaser Technician (the
 *  unit is in the discard pile when the trigger resolves, and moves from there).
 *  Self-referential: always acts on the source card, so it carries no target.
 *  The new resource enters play exhausted (§2046) UNLESS the card says "and ready
 *  it" (`ready: true`), e.g. Superlaser Technician. */
export interface PlayAsResourceEffect {
  effect: 'play_as_resource';
  ready?: boolean;
}

/** "Create N Credit token(s)." A Credit token is a one-shot resource: it can be
 *  spent like a resource to pay a play cost, and is removed when spent (§ Credit
 *  tokens). Added to the controller's `creditTokens`. */
export interface CreateCreditEffect {
  effect: 'create_credit';
  player?: PlayerRef;
  count?: number;
}

/** "The next <card_type> you play this phase costs N resources less." Registers
 *  a one-shot, phase-scoped play-cost discount on the controller (the source
 *  player). Consumed by the first matching card play; phase-scoped. `card_type`
 *  gates which cards it applies to ("unit"). General's Blade. */
export interface DiscountEffect {
  effect: 'discount';
  amount: number;
  card_type?: 'unit' | 'event' | 'upgrade';
}

/** "Play a unit from your discard pile [at a reduced cost]." (Palpatine's
 *  Return). Choose a matching unit in the controller's discard and play it into
 *  its arena (enters exhausted, runs onPlay keyword hooks + Ambush; its
 *  When-Played fires via the trailing settle). `cost_reduction` is subtracted
 *  from its play cost (clamped ≥0); `cost_reduction_if` overrides that amount
 *  when the chosen card matches its filter ("…8 less instead if it's a Force
 *  unit"). A no-op if no eligible card is affordable. */
export interface PlayFromDiscardEffect {
  effect: 'play_from_discard';
  filter?: Predicate;
  cost_reduction?: number;
  cost_reduction_if?: { filter: Predicate; amount: number };
}

export type Effect =
  | DamageEffect
  | HealEffect
  | DefeatEffect
  | GiveShieldEffect
  | GiveExperienceEffect
  | DrawEffect
  | DiscardEffect
  | ExhaustEffect
  | ReadyEffect
  | GiveEffect
  | SequenceEffect
  | IfEffect
  | IfDidEffect
  | NoopEffect
  | ChooseOneEffect
  | OptionalEffect
  | CreateTokenEffect
  | CaptureEffect
  | RescueEffect
  | MoveEffect
  | LookAtEffect
  | DiscloseEffect
  | SearchEffect
  | SearchPlayEffect
  | DividedDamageEffect
  | IndirectDamageEffect
  | PlayAsResourceEffect
  | CreateCreditEffect
  | DiscountEffect
  | PlayFromDiscardEffect
  | ReturnToHandEffect
  | ReturnFromDiscardEffect
  | TakeControlEffect
  | ExchangeControlEffect
  | TransferUpgradeEffect
  | NameCardEffect
  | UseForceEffect
  | GainForceEffect
  | AttackEffect
  | PowerDamageFromEachEffect;

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
  /** 'self' → the source is the defender; 'host' → the source is an UPGRADE and
   *  its HOST is the defender ("When attached unit is attacked" — Death Star
   *  Plans). 'host' resolves the upgrade's host via the source iid. */
  defender?: 'self' | 'trigger_source' | 'host';
  /** For attack events: true → the defender was DEFEATED by this attack ("…
   *  attacks and defeats a unit"). Evaluated after state-based actions have run
   *  (the defeated defender is already out of play), so it reads "defenderIid no
   *  longer in an arena". A base defender never counts as a defeated unit. */
  defender_defeated?: boolean;
  card_trait?: string;
  card_type?: string;
  card_aspect?: AspectIcon;
  /** The triggering card is/ isn't unique. Used by "When another unique unit is
   *  defeated" (Agent Kallus) — combine with `not: { card: 'self' }` for
   *  "another". Read from the event card's spec (the discard copy for defeats). */
  card_is_unique?: boolean;
  combat?: boolean;
  /** For base-damage events: the controller of the base being damaged. Used
   *  by `damage_base` replacements that guard the source's own base
   *  (`where: { base_controller: 'self' }`) or the opponent's base
   *  (`base_controller: 'opponent'`). */
  base_controller?: PlayerRef;
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
  /** "deal N damage to a friendly unit" as part of an action's cost (Doctor
   *  Pershing). The damage is dealt through the normal damage layer. */
  damage?: { amount: number; target: Selector };
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
  /** Scopes the grant to "while attached unit is attacking" (Condemn). The
   *  granted abilities are On-Attack (so they only fire during the attack anyway),
   *  and a `grant.modifier.lose_all_abilities` is honored by trigger collection to
   *  suppress the HOST's own abilities during its attack — implementing "it gains
   *  '<On-Attack>' and loses all other abilities." Not consulted by the stat
   *  modifier aggregator (its modifier carries no stats). */
  while_attacking?: boolean;
  grant: {
    target: Selector;
    /** Stat/keyword modifier the target gains. Provide `modifier` and/or
     *  `abilities`. */
    modifier?: Modifier;
    /** Full abilities the target GAINS ("Attached unit gains: '<ability>'").
     *  On an upgrade this targets the host; the granted abilities are attributed
     *  to the host (so `self` / `attacker: self` resolve to the host, not the
     *  upgrade). Granted TRIGGERED abilities fire from the host while in play,
     *  and granted When-Defeated abilities fire when the host is defeated
     *  (recovered from the UPGRADE_DETACHED event). */
    abilities?: Ability[];
  };
}

// Replacement ability — intercepts a would-be event and substitutes a
// different effect (per §v7 7.7.5). Supported event kinds:
//   - 'damage_unit': fires before any damage-to-unit application (combat or
//     non-combat). The replacement's `with` runs INSTEAD; damage doesn't land.
//   - 'damage_base': fires before damage applies to a base (combat or
//     non-combat). Typical match: `where: { base_controller: 'self' }` to
//     guard your own base. `with` runs INSTEAD.
//   - 'defeat_unit': fires before a unit at lethal damage is moved to discard.
//     The replacement's `with` typically heals (resetting damage) so the
//     state-based fixpoint doesn't immediately re-detect the defeat. Cards
//     that don't clear damage will infinite-loop and be caught by the 256-step
//     state-based guard.
export interface ReplacementAbility {
  type: 'replacement';
  on: 'damage_unit' | 'damage_base' | 'defeat_unit';
  where?: TriggerPredicate;
  /** Effect to run INSTEAD of the original. Use `noop` to suppress the
   *  original outright (true prevention for damage; not safe for defeat — the
   *  unit would still be at lethal damage next pass). */
  with: Effect;
}

// Count source for a per-X cost reduction ("costs 1 less for each friendly
// leader unit you control"). Evaluated live against the would-be-player when the
// card's effective cost is computed (in hand, before it's played).
export type CostCount = 'friendly_leader_units' | 'friendly_units' | 'friendly_resources';

// Cost ability — a self-referential static modifier to THIS card's play cost
// (§ a card's cost cannot be modified below 0). Not a firing ability: the cost
// computation (`effectiveCost`) scans for it on the card in hand. `amount` is a
// flat reduction (negative = cheaper; positive would be an increase). `per`
// multiplies `amount` by a live count of the controller's board. A `while`
// predicate (evaluated against the controller) can gate it.
export interface CostAbility {
  type: 'cost';
  amount: number;            // applied as cost + amount (so -1 = "costs 1 less")
  per?: CostCount;           // when set, total delta = amount × count
  while?: Predicate;
}

// Round-discount ability — a PASSIVE board-level discount: "The first <card_type>
// you play each round costs N less." Unlike CostAbility (which reduces THIS card's
// own cost), this lives on an in-play unit (usually granted to the host by an
// upgrade — Death Star Plans) and reduces the cost of OTHER cards its controller
// plays. Because each SWU round has exactly one action phase and cards are only
// played then, "first … each round" is armed as a phase-scoped PendingDiscount at
// the start of each action phase (see reducer.startActionPhase) and consumed by
// the controller's first matching play — reusing the General's Blade discount path.
export interface RoundDiscountAbility {
  type: 'round_discount';
  amount: number;            // reduction (positive = cheaper), clamped ≥0 at play
  card_type?: 'unit' | 'event' | 'upgrade';
}

export type Ability = TriggeredAbility | ActionAbility | ConstantAbility | ReplacementAbility | CostAbility | RoundDiscountAbility;

// ---------------------------------------------------------------------------
// Discriminator helpers
// ---------------------------------------------------------------------------

export const isTriggered   = (a: Ability): a is TriggeredAbility   => a.type === 'triggered';
export const isAction      = (a: Ability): a is ActionAbility      => a.type === 'action';
export const isConstant    = (a: Ability): a is ConstantAbility    => a.type === 'constant';
export const isReplacement = (a: Ability): a is ReplacementAbility => a.type === 'replacement';
export const isCost         = (a: Ability): a is CostAbility         => a.type === 'cost';
export const isRoundDiscount = (a: Ability): a is RoundDiscountAbility => a.type === 'round_discount';

export const isPredicateAnd = (p: Predicate): p is PredicateAnd => 'and' in p && Array.isArray((p as PredicateAnd).and);
export const isPredicateOr  = (p: Predicate): p is PredicateOr  => 'or'  in p && Array.isArray((p as PredicateOr).or);
export const isPredicateNot = (p: Predicate): p is PredicateNot => 'not' in p && (p as PredicateNot).not !== undefined;
