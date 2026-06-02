# ENGINE_DESIGN.md — Twin Suns Engine v2

> **Status:** Design contract awaiting sign-off. No code yet.
> **Author:** Drafted with Claude, 2026-05-24. v7 deltas folded in 2026-05-25.
> **Supersedes:** Implicit design in `frontend/src/lib/game-engine/` (v1, kept untouched until v2 reaches parity).
> **Rules basis:** SWU Comprehensive Rules **v7.0** (3/6/26). See [§16 Change log](#16-change-log) for what shifted from the v3 draft.

---

## 0. TL;DR

Cards become **data**. The engine becomes a small, stable interpreter over a closed primitive vocabulary. New SWU sets ship as YAML/JSON files with **zero engine changes** for the ~95% of cards that map to existing primitives. The remaining ~5% add one new primitive handler.

Four layers:

```
L4  Authoring pipeline:  printed card text → template match → local LLM → Claude (rare) → human review → spec.json
L3  Card specs:          JSON files (or rows). Declarative AST. No code.
L2  AST interpreter:     handlers for ~40 primitives, organized by namespace. The only thing that grows when a genuinely new mechanic appears.
L1  Game state + bus:    zones, phases, action windows, event bus, simultaneous-trigger ordering. Bounded by the rulebook.
```

Synthesis behind the design:
- **Datalog-style production rules** for triggers ("when event E happens and predicate P holds, fire effect F")
- **Algebraic effects + handlers** for action verbs (each primitive is a request the interpreter handles; adding a primitive doesn't modify any other)
- **ECS-style modifiers** for continuous effects and auras (recomputed live from current state)
- **Controlled vocabulary** for authoring (the LLM cannot invent primitives; the schema enforces a closed set)

---

## 1. Goals & non-goals

### Goals
1. **Zero engine code per new set** for cards that use existing primitives.
2. **Locally-runnable LLM authoring pipeline** (Mac mini, 8B model, grammar-constrained sampling). Claude is opt-in for hard cases.
3. **Deterministic, auditable card behavior.** The validator rejects any spec referencing an unknown primitive, target, trigger, or keyword.
4. **Clean boundary between engine and UI.** The engine takes `(GameState, PlayerAction) → (GameState, Event[])` and knows nothing about React.
5. **Portfolio-quality.** Worth writing up on Medium — the architecture itself is the artifact.

### Non-goals
- Magic-grade depth (split cards, mana abilities, complex layer system) — SWU is much simpler.
- Multi-format support beyond Twin Suns.
- Replacing v1 before reaching feature parity. v1 keeps running.
- AI play (the existing `ai.ts` is out of scope for this redesign; it can sit on top of v2 later).

---

## 2. Architecture

```
┌────────────────────────────────────────────────────────────────────┐
│  L4  AUTHORING PIPELINE                                            │
│  ───────────────────────                                           │
│  printed text  →  template matcher (Tier 1)                        │
│                →  local 8B + GBNF (Tier 2)                         │
│                →  Claude (Tier 3, opt-in)                          │
│                →  human review (Tier 4, validator failures)        │
│                →  validated spec.json                              │
└─────────────────────────────┬──────────────────────────────────────┘
                              │ writes
                              ▼
┌────────────────────────────────────────────────────────────────────┐
│  L3  CARD SPECS  (data, not code; one record per card)             │
│  ──────────────                                                    │
│  - id, name, type, cost, aspects, traits, stats, keywords          │
│  - abilities[]: triggered | action | constant                      │
│  - validated against JSON Schema before storage                    │
└─────────────────────────────┬──────────────────────────────────────┘
                              │ loaded by
                              ▼
┌────────────────────────────────────────────────────────────────────┐
│  L2  AST INTERPRETER  (the brain — grows rarely)                   │
│  ───────────────────                                               │
│  effect handlers:  one per primitive (~40 total)                   │
│    card_flow/  combat/  state/  move/  tokens/                     │
│    resource/   choice/  meta/                                      │
│  target resolver:  zone × controller × filter × selector           │
│  trigger matcher:  Datalog-style predicate over event stream       │
│  modifier layer:   continuous + aura + lasting effects             │
│  cost system:      pay/refund (resources, exhaust, additional)     │
└─────────────────────────────┬──────────────────────────────────────┘
                              │ operates on
                              ▼
┌────────────────────────────────────────────────────────────────────┐
│  L1  GAME STATE + EVENT BUS  (the rulebook in code)                │
│  ──────────────────────────                                        │
│  state:   zones, players, leaders, bases, counters, turn struct    │
│  bus:     publishes events as the state changes                    │
│  windows: action timing, regroup steps, end-of-phase resolution    │
│  ordering: simultaneous triggers → active player chooses order     │
│  state-based actions: 0-HP defeat, unattached upgrade, etc.        │
└────────────────────────────────────────────────────────────────────┘
```

**Why this stratification works:**
- **L1 is bounded by the rulebook.** SWU's rules are a finite document. Once L1 matches it, L1 stops growing.
- **L2 is bounded by the primitive vocabulary.** Adding a new card mechanic = adding one handler to one file. Existing handlers don't change.
- **L3 is data.** Cost of adding a card = cost of writing JSON. Zero risk to other cards.
- **L4 is automation.** Every tier is optional; the cheapest tier handles the most cards.

---

## 3. Game state model (L1)

The v1 type model in `frontend/src/lib/game-engine/types.ts` is mostly correct — v2 extends it for capture, tokens, lasting effects, and an event bus.

### Zones (from rules §4)

```ts
type Zone =
  | 'hand'           // per player, hidden
  | 'deck'           // per player, hidden order
  | 'discard'        // per player, public
  | 'resource_zone'  // per player, face-down, public count
  | 'ground_arena'   // shared, public
  | 'space_arena'    // shared, public
  | 'base_zone'      // per player, holds base + leader (Leader side)
  | 'leader_unit'    // synthetic: a leader currently deployed (in arena)
  | 'capture_zone'   // per capturer, holds captured cards (rules priority §1.7d)
  | 'set_aside'      // tokens between uses; out-of-play
```

### Player state

```ts
interface PlayerState {
  id: PlayerId;                       // string — supports 2-4 players (v7 §12 Twin Suns multiplayer)
  hand: CardInstance[];
  deck: CardInstance[];
  discard: CardInstance[];
  resources: CardInstance[];          // ordered, face-down
  creditTokens: CreditToken[];        // v7 §3.7.13 — in resource zone but NOT resources
  groundArena: CardInstance[];
  spaceArena: CardInstance[];
  leaders: LeaderInstance[];          // Twin Suns: always 2; each can be on its leader/leader_unit/leader_upgrade side
  base: BaseInstance;
  forceToken: boolean;                // v7 §8.37 — max 1; "the Force is with you"
  capturedByMe: CapturedCard[];       // who I'm holding captive (captured cards are open info per §v7 8.33.1)
  // counters held this round (v7 §12.5 generalizes initiative)
  countersHeld: Array<'initiative' | 'blast' | 'plan'>;
  hasTakenCounterThisRound: boolean;  // Twin Suns: max 1 counter per round
  // turn/round bookkeeping
  hasResourced: boolean;
  perPhaseCounters: Record<string, number>;  // e.g. "cards_played_this_phase", "leader_ability_uses"
  perRoundCounters: Record<string, number>;  // e.g. "agent_kallus_uses" for "once each round" abilities
  perGameFlags: Set<string>;          // Epic Action used, etc.
}
```

**On `PlayerId` as a string:** v1 hardcoded `'player1' | 'player2'`. v2 uses an open string ID so the same engine supports 2-player matches today and 3–4-player Twin Suns later without a state-model refactor. Turn cycling logic (`activePlayer = nextActivePlayer(state)`) is an O(1) helper either way.

### Card instance

```ts
interface CardInstance {
  iid: string;                       // unique per game
  cardId: string;                    // ref to spec
  damage: number;
  exhausted: boolean;
  upgrades: CardInstance[];
  shieldTokens: number;
  isToken: boolean;
  capturedByIid?: string;            // if currently captured
  // active modifiers granted to this card (auras, lasting effects, while-conditions)
  modifiers: ActiveModifier[];
  // bookkeeping
  enteredZoneAt: number;             // game step number; for "this turn" checks
  deployedThisTurn?: boolean;        // leaders only
}
```

### Game state

```ts
interface GameState {
  id: string;
  round: number;
  step: number;                      // monotonic, increments on every state change
  activePlayer: PlayerId;
  initiative: PlayerId;
  phase: 'setup' | 'action' | 'regroup';
  regroupStep?: 'start' | 'draw' | 'resource' | 'ready' | 'end';
  players: Record<PlayerId, PlayerState>;
  lastingEffects: LastingEffect[];   // tracked centrally (see §6.4)
  delayedEffects: DelayedEffect[];   // see §6.5
  pendingTriggers: TriggerInstance[];// triggered but not yet resolved (see §6.3)
  winner?: PlayerId | 'draw';
  log: GameEvent[];
}
```

### Event bus

Every state-changing operation emits a `GameEvent`. Triggered abilities subscribe via predicates.

```ts
type GameEvent =
  // card flow
  | { kind: 'CARD_PLAYED';      iid; cardId; controller; viaSmuggle?: boolean; viaPlot?: boolean }
  | { kind: 'CARD_DRAWN';       player; iid }
  | { kind: 'CARD_DISCARDED';   player; iid; from: Zone }
  | { kind: 'CARD_REVEALED';    player; iid }
  | { kind: 'CARD_DISCLOSED';   player; iids[]; aspects }       // v7 §8.38
  // movement
  | { kind: 'ZONE_CHANGED';     iid; from: Zone; to: Zone }
  | { kind: 'ARENA_MOVED';      iid; from: 'ground_arena' | 'space_arena'; to } // v7 §8.36 — NOT enter/leave play
  | { kind: 'UPGRADE_ATTACHED'; upgradeIid; hostIid }
  | { kind: 'UPGRADE_DETACHED'; upgradeIid; hostIid }
  | { kind: 'CAPTURED';         capturedIid; capturerIid }
  | { kind: 'RESCUED';          capturedIid; capturerIid; via: 'rescue' | 'release' }
  // combat
  | { kind: 'ATTACK_DECLARED';  attackerIid; defenderIid | 'base' }
  | { kind: 'ATTACK_ENDED';     attackerIid; defenderIid | 'base'; damageDealt }  // v7 §7.6.16
  | { kind: 'DAMAGE_DEALT';     sourceIid; targetIid | 'base'; amount; combat: boolean; indirect: boolean }
  | { kind: 'DAMAGE_PREVENTED'; targetIid; amount; by }          // v7 §8.20
  | { kind: 'HEALED';           targetIid | 'base'; amount }
  | { kind: 'DEFEATED';         iid; by?: PlayerId; combat: boolean; lastKnown: CardSnapshot } // v7 §8.11
  | { kind: 'SHIELD_GAINED';    iid }
  | { kind: 'SHIELD_DEFEATED';  iid }
  // state
  | { kind: 'EXHAUSTED';        iid }
  | { kind: 'READIED';          iid }
  | { kind: 'CONTROL_CHANGED';  iid; from: PlayerId; to: PlayerId }
  | { kind: 'LEADER_DEPLOYED';  player; leaderIid; as: 'unit' | 'upgrade'; targetIid?: string } // v7 §3.4.4A
  | { kind: 'LEADER_DEFEATED';  player; leaderIid }
  // tokens
  | { kind: 'TOKEN_CREATED';    iid; tokenId; controller; zone }    // v7 §3.7.2 — distinct from CARD_PLAYED
  // Force
  | { kind: 'FORCE_TOKEN_CREATED'; player }                          // v7 §8.37
  | { kind: 'FORCE_USED';       player }
  // turn/phase
  | { kind: 'PHASE_STARTED';    phase }
  | { kind: 'PHASE_ENDED';      phase }
  | { kind: 'ROUND_STARTED';    round }
  | { kind: 'ROUND_ENDED';      round }
  | { kind: 'TURN_STARTED';     player }
  // resources & counters
  | { kind: 'RESOURCE_PLACED';  player; iid }
  | { kind: 'RESOURCE_SPENT';   player; iid }
  | { kind: 'COUNTER_TAKEN';    player; counter: 'initiative' | 'blast' | 'plan' };  // v7 §12.5 generalized
```

This list is **closed**. Any new primitive that needs to fire a trigger must either (a) emit one of these events or (b) extend this enum (rare; engine change required).

---

## 4. Primitive vocabulary (L2)

This is **the contract**. Every card spec composes from these. Adding a new primitive is the one engine-level change that "novel mechanic" cards require.

> **Implementation status (2026-06-01):** this section is the original *design* vocabulary. The **authoritative implemented vocabulary** is the closed set enforced in [`frontend/src/lib/engine-v2/spec/validate.ts`](frontend/src/lib/engine-v2/spec/validate.ts) (`EFFECT_KINDS`, `ABILITY_TYPES`, etc.), and the AST shapes in [`spec/ast.ts`](frontend/src/lib/engine-v2/spec/ast.ts). Some implemented names differ from the design draft (e.g. design `if_you_do` shipped as the `if_did` effect with an optional `else_`; cost reduction shipped as a `cost`-type **ability**, not an effect). Effects implemented as of this writing: `damage`, `heal`, `defeat`, `give_shield`, `give_experience`, `draw`, `discard`, `exhaust`, `ready`, `give`, `sequence`, `if`, `if_did`, `noop`, `choose_one`, `optional`, `create_token`, `capture`, `rescue`, `move`, `look_at`, `disclose`, `search`, `divided_damage`, `return_to_hand`, `return_from_discard`, `take_control`, `use_force`, `gain_force`, `attack`, `power_damage_from_each`. Ability types: `triggered`, `action`, `constant`, `replacement`, `cost`. See PROGRESS.md / CHANGELOG.md for per-primitive history.

### `card_flow.*`
| Primitive | Params | Notes |
|---|---|---|
| `draw` | `{ player, count }` | Empty deck damages base per rules §2.3 |
| `discard` | `{ player, count, chooser }` | `chooser: "self" | "opponent"` |
| `mill` | `{ player, count, destination }` | Top N of deck → discard or other zone |
| `return_to_hand` | `{ target }` | Selector — any zone |
| `return_to_deck` | `{ target, position: "top" | "bottom" | "shuffled" }` | |
| `search` | `{ player, zone, filter, count, then: Effect }` | Look at zone, find matching, apply effect to result |
| `look` | `{ player, zone, count, then?: Effect }` | Look at top N; optional ordering |
| `reveal` | `{ target }` | Makes hidden information open |

### `combat.*`
| Primitive | Params | Notes |
|---|---|---|
| `damage` | `{ source?, target, amount, combat?: false, unpreventable?: false }` | `combat:true` only emitted during attack step; `unpreventable` bypasses prevent effects (§v7 8.20) |
| `damage_divided` | `{ source?, amount, among: Selector, chooser: PlayerRef }` | "X damage divided as you choose"; §v7 8.4.5 |
| `indirect_damage` | `{ source?, amount, chooser: PlayerRef, valid_targets?: Selector }` | §v7 8.35. Unpreventable, ignores Shield tokens (damage assigned through them), assigned among any units + base |
| `heal` | `{ target, amount }` | |
| `defeat` | `{ target }` | Bypasses HP check |
| `give_shield` | `{ target, count: 1 }` | Shield itself is a token upgrade with a replacement effect — see [§5.5](#55-the-modifier-grammar) |
| `remove_shield` | `{ target, count }` | Saboteur uses this |
| `prevent_damage` | `{ amount?: number \| "all", target: Selector }` | For "prevent damage to this unit" effects |

### `state.*`
| Primitive | Params | Notes |
|---|---|---|
| `exhaust` | `{ target }` | |
| `ready` | `{ target }` | |
| `give` | `{ target, modifier: Modifier }` | The big one — see [§5.5](#55-the-modifier-grammar) |
| `take_control` | `{ target, new_controller }` | |
| `flip_leader` | `{ player, leaderIid, side: "leader" | "leader_unit" }` | Deploy/defeat |

### `move.*`
| Primitive | Params | Notes |
|---|---|---|
| `move_to_zone` | `{ target, destination: Zone, facedown?: boolean }` | Generic mover; counts as enter/leave play per §v7 8.7 / 8.12 |
| `move_arena` | `{ target, destination: "ground_arena" \| "space_arena" }` | §v7 8.36. Preserves upgrades, damage, ready/exhausted; **does not count as leave/enter play** |
| `attach_upgrade` | `{ upgrade, host }` | Validates eligibility per §v7 3.6 |
| `detach_upgrade` | `{ upgrade }` | Triggers defeat per §v7 1.7c |
| `capture` | `{ target, captor }` | §v7 8.33. Places target facedown under captor, removes damage, defeats upgrades. Captured is open info. |
| `rescue` | `{ target }` | §v7 8.33.3. Retrieves captured unit faceup, exhausted, under owner's control. Does NOT trigger "When Played". |
| `release_captives` | `{ from_captor }` | §v7 8.33.4. Automatic when guard leaves play; rescues all captives under that captor. |

### `tokens.*`
| Primitive | Params | Notes |
|---|---|---|
| `create_token` | `{ token_id, controller, zone, count }` | References `tokens/{id}.json` registry; emits `CREATED` (not `CARD_PLAYED`) per §v7 3.7.2 |
| `give_experience` | `{ target, count: 1 }` | Sugar for `create_token + attach`; the Experience token is `+1/+1` LEARNED upgrade |
| `give_shield` (alias) | `{ target, count: 1 }` | Lives in `combat.*` but creates a Shield token attached to target |

### `force.*` (NEW in v7)
| Primitive | Params | Notes |
|---|---|---|
| `create_force_token` | `{ player }` | §v7 8.37.1-2. Spawns in base zone. Max 1 per player; ignored if player already has one. "The Force is with you." |
| `use_force` | `{ player }` | §v7 8.37.4. Defeats player's Force token (optional — `you may`). Required precondition: player controls one. |

### `disclose` (NEW in v7)
| Primitive | Params | Notes |
|---|---|---|
| `disclose` | `{ player, aspects: AspectIcon[], then: Effect }` | §v7 8.38. Player reveals any number of cards from hand whose aspects collectively cover the required set. If satisfied, resolve `then`. If not, no reveal counted. |

### `resource.*`
| Primitive | Params | Notes |
|---|---|---|
| `add_resource` | `{ player, source: "hand" \| "deck_top", count }` | Smuggle, Lando, etc. |
| `exhaust_resource` | `{ player, count }` | Paying costs |
| `ready_resource` | `{ player, count }` | Restoration effects |
| `take_counter` | `{ player, counter: "initiative" \| "blast" \| "plan" }` | §v7 12.5. Generalized from v3's `INITIATIVE_TAKEN`. Blast deals 1 to each opponent's base; Plan draws 1 + bottoms 1. |

### `choice.*`
| Primitive | Params | Notes |
|---|---|---|
| `choose_one` | `{ chooser, prompt, options: [{ label, do: Effect }] }` | Mandatory pick |
| `optional` | `{ chooser, prompt, do: Effect }` | "You may..." |
| `prompt_target` | `{ chooser, prompt, selector }` | "Choose a unit" without effect (used inside other effects) |
| `for_each_choice` | `{ chooser, options, repeat: number }` | Repeat-with-different-choice |

### `meta.*` — control flow
| Primitive | Params | Notes |
|---|---|---|
| `sequence` | `{ steps: [Effect] }` | Resolve in order. Mirrors v7 §8.28 "then" — second step resolves even if first cannot |
| `parallel` | `{ steps: [Effect] }` | Simultaneous (rare; nested ability rules apply) |
| `if` | `{ condition: Predicate, then: Effect, else?: Effect }` | |
| `if_you_do` | `{ first: Effect, then: Effect }` | §v7 8.9. `then` resolves only if `first` was resolved in full |
| `repeat` | `{ count: number \| Expression, do: Effect }` | |
| `for_each` | `{ target: Selector, do: Effect }` | Apply per-card; §v7 8.34 — all effects calculated first, applied simultaneously |
| `noop` | `{}` | Explicit no-effect (events with conditional benefits) |
| `replace` | `{ event: EventPattern, condition?: Predicate, instead: Effect }` | §v7 7.7.5. Replacement effect. The standard event resolution is replaced. Cannot replace itself. |

### Aliases (sugar — expand at validation time)
| Alias | Expands to |
|---|---|
| `when_played` | `triggered + on: event.card_played + where: { card: self }` |
| `when_defeated` | `triggered + on: event.defeated + where: { card: self }` |
| `when_captured` | `triggered + on: event.captured + where: { card: self }` |
| `on_attack` | `triggered + on: event.attack_declared + where: { attacker: self }` |
| `on_defense` | `triggered + on: event.attack_declared + where: { defender: self }` — **NEW v7 §7.6.15** |
| `when_attack_ends` | `triggered + on: event.attack_ended + where: { attacker_or_defender: self }` — **NEW v7 §7.6.16** |
| `when_deployed` | `triggered + on: event.leader_deployed + where: { leader: self }` |
| `when_created` | `triggered + on: event.token_created + where: { token: self }` — tokens use this in place of "When Played" per §v7 3.7.2A |
| `shielded_trigger` | maps Shielded keyword to `when_played / when_deployed / when_created` per §v7 7.5.12 |
| `ambush_trigger` | same — §v7 7.5.5 |

**Vocabulary stats:** ~50 primitives across 9 namespaces (was ~40 in the v3 draft; v7 added `indirect_damage`, `damage_divided`, `move_arena`, `rescue`, `create_force_token`, `use_force`, `disclose`, `take_counter`, `if_you_do`, `replace`). Empirical claim worth testing: this covers everything in v1's `abilities.ts` Categories A, B, and C, plus Bounty, Smuggle, Exploit, Piloting, Hidden, Plot, and constant "while" abilities. Anything that doesn't fit is a flagged escalation — we add one row to this table or one alias.

---

## 5. Card spec format (L3)

### 5.1 Top-level card

```json
{
  "$schema": "twin-suns/card.v2.json",
  "id": "SOR_001",
  "name": "Battlefield Marine",
  "subtitle": null,
  "type": "unit",
  "cost": 3,
  "aspects": ["heroism"],
  "arena": "ground",
  "power": 3,
  "hp": 3,
  "traits": ["rebel", "trooper"],
  "keywords": [],
  "abilities": [],
  "unique": false
}
```

The minimum spec is just the printed values; abilities is `[]` for vanilla cards.

### 5.2 Keywords

Keywords are first-class data; the engine knows their definitions. A spec just names them. v7 keyword enum (15 total):

| Name | Form | Notes |
|---|---|---|
| `ambush` | bare | "When Played/Deployed/Created: optional attack" |
| `grit` | bare | +1/+0 per damage on this unit |
| `overwhelm` | bare | Excess combat damage to base (only if defender defeated) |
| `raid` | with value | +N power while attacking |
| `restore` | with value | "On Attack: heal N from base" |
| `saboteur` | bare | Ignore Sentinel + "On Attack: defeat shields on defender" |
| `sentinel` | bare | Force-defender, can't have "can't be attacked" suppression |
| `shielded` | bare | "When Played/Deployed/Created: give shield" |
| `bounty` | em-dash | Opponent-controlled trigger on Defeat/Capture |
| `smuggle` | with value | Constant ability active in resource zone — alternate-cost play |
| `coordinate` | em-dash | Active while controller has ≥3 units |
| `exploit` | with value | "While playing: defeat up to N friendlies, cost -2 each" |
| `piloting` | with value | **NEW v7.** Alternate cost to play unit as upgrade on friendly Vehicle without Pilot |
| `hidden` | bare | **NEW v7.** "Can't be attacked the phase it was played/deployed/created" (overridden by Sentinel) |
| `plot` | bare | **NEW v7.** "When you deploy a leader: may play this from resource zone" |

```json
"keywords": [
  { "name": "raid", "value": 2 },
  { "name": "ambush" },
  { "name": "restore", "value": 1 },
  { "name": "piloting", "value": 3 },
  { "name": "hidden" }
]
```

Em-dash keywords (Bounty, Coordinate, Smuggle) carry an embedded ability:

```json
"keywords": [
  {
    "name": "coordinate",
    "ability": {
      "type": "constant",
      "grant": {
        "target": { "self": true },
        "modifier": { "power": 1, "health": 1 }
      }
    }
  }
]
```

### 5.3 Abilities

Three ability shapes:

```json
// Triggered — fires on an event
{
  "type": "triggered",
  "on": "event.card_played",
  "where": { "card.controller": "self", "card.trait": "clone" },
  "limit": "once_per_phase",
  "do": { "effect": "give", "target": { "self": true }, "modifier": { ... } }
}

// Action — explicit player choice during action phase
{
  "type": "action",
  "cost": { "exhaust": true, "resources": 2 },
  "do": { "effect": "draw", "player": "self", "count": 1 }
}

// Constant — always-on while in play (optionally gated by `while`)
{
  "type": "constant",
  "while": { "self.damage": 0 },
  "grant": {
    "target": { "self": true },
    "modifier": { "keyword": "sentinel" }
  }
}
```

### 5.4 Selectors (the target language)

The selector is a small constraint expression. Conceptually: `pick from {scope} where {filter} how={selector} count={count}`.

```json
{
  "zone": "ground_arena",            // single zone or array
  "controller": "opponent",          // "self" | "opponent" | "any"
  "filter": {                        // optional Predicate (see §5.6)
    "card.type": "unit",
    "stat.power": { "max": 3 }
  },
  "selector": "chosen",              // "chosen" | "all" | "random" | "self_choose" | "opponent_choose"
  "count": { "min": 1, "max": 1 }    // or "all"
}
```

Shortcuts:
- `{ "self": true }` — the card with the ability
- `{ "self_base": true }` — controller's base
- `{ "opponent_base": true }` — opponent's base
- `{ "all_friendly_units": true }` — sugar for `zone: any_arena, controller: self`
- `{ "attached_to_self": true }` — for upgrade abilities affecting their host
- `{ "trigger_source": true }` — within a triggered ability, the card that caused the event (the played card, the attacker, etc.)
- `{ "exclude": Selector }` — wrap a selector to exclude matches; supports v7 §8.18 "other/another"
- `{ "search_result": true }` / `{ "search_remainder": true }` — synthesized inside search effects (§7.11)

Additional filter atoms (closed enum):
- `is_leader_unit: true` — for "non-leader unit" exclusions (§v7 3.4.4)
- `is_token: true`
- `has_force_token: true` (player predicate, used inside selectors targeting players)
- `is_unique: true`

### 5.5 The modifier grammar

`give` takes a modifier; modifiers are the unification of buffs, debuffs, keyword grants, ability grants, and lasting effects.

```json
{
  "duration": "end_of_attack",       // permanent | while_source_in_play | end_of_attack | end_of_phase | end_of_round | until_condition
  "until": { ... },                  // for duration: until_condition
  "power": 2,                        // number; can be negative
  "health": 2,
  "keyword": "sentinel",             // or array
  "keywords": ["raid 2", "sentinel"],
  "lose_keyword": "sentinel",        // §v7 8.14 — strip a keyword for the duration
  "lose_all_abilities": false,       // §v7 8.14.2 — Force Lightning style
  "grant_ability": { ... Ability ... },
  "cant": ["attack", "be_attacked", "ready", "exhaust"], // restrictions
  "must": ["attack_each_turn"],      // §v7 8.16 — forced behavior
  "source_iid": "synthesized"        // engine-filled; for "when source leaves play, expire" semantics
}
```

A modifier with `duration: permanent` applied to an out-of-play card via a "When Played" trigger is functionally equivalent to a constant ability — but the constant form is preferred for clarity.

**Replacement effects (v7 §7.7.5).** A modifier can carry a replacement clause instead of a stat delta:

```json
{
  "duration": "permanent",
  "replace": {
    "event": "DAMAGE_DEALT",
    "where": { "target": "attached_to_self" },
    "instead": {
      "effect": "sequence",
      "steps": [
        { "effect": "prevent_damage", "amount": "all", "target": { "attached_to_self": true } },
        { "effect": "defeat", "target": { "self": true } }
      ]
    }
  }
}
```
This is exactly how the **Shield token** is modeled — it's a token upgrade carrying a `replace` modifier. The Shield token spec lives in the token registry, not in card specs.

Resolution rules (mirroring §v7 7.7.5):
1. Multiple applicable replacements → controller of affected object chooses order.
2. A replaced event does not also resolve normally unless the replacement only replaces part of it.
3. A replacement cannot replace itself (no infinite loops).
4. If the replacement uses "you may" and the player declines, the standard resolution proceeds.

### 5.6 Predicates

Datalog-style. The validator enforces that all left-hand sides are well-known paths.

```json
{
  "card.trait": "clone",                // string equality
  "card.aspects": { "contains": "vigilance" },
  "card.type": { "in": ["unit", "upgrade"] },
  "card.cost": { "min": 4, "max": 7 },
  "card.is_unique": true,
  "card.is_token": false,
  "card.is_leader_unit": false,
  "stat.power": { "max": 3 },           // current effective stat
  "stat.hp": { "min": 4 },
  "controller": "self",
  "zone": "ground_arena",
  "self.damage": { "min": 1 },          // "this unit is damaged"
  "self.exhausted": false,
  "self.upgraded": true,
  "player.has_force_token": true,       // v7 §8.37.3 — "while the Force is with you"
  "player.controls_count": { "filter": { "card.trait": "clone" }, "min": 3 },
  "phase": "action",
  "round.is_first": true,
  "first.event": { "kind": "CARD_PLAYED", "where": { ... } },  // §v7 8.8 "the first event played this phase"
  "and": [Predicate, Predicate],        // composition
  "or":  [Predicate, Predicate],
  "not": Predicate
}
```

Field paths are a closed enum. New paths require an engine change (one line in `runtime/predicates.ts`).

### 5.7 Costs

Action ability costs:

```json
{
  "exhaust": true,                   // exhaust the source card
  "resources": 2,                    // resource cost
  "defeat": { ... selector ... },    // sacrifice cost (Exploit)
  "discard": { "player": "self", "count": 1 },
  "remove_shield": { "target": { "self": true } }
}
```

All cost components must be payable before any resolves (atomic).

---

## 6. Runtime model

### 6.1 The reducer signature

```ts
function step(state: GameState, action: PlayerAction): {
  next: GameState;
  events: GameEvent[];
  pendingChoices?: PendingChoice[];   // engine pauses for player input
}
```

Pure function. No mutation. All randomness via injected RNG.

### 6.2 Action resolution

Per rules §6: every Play-a-Card / Attack-with-Unit / Use-Action-Ability follows a fixed 5-step protocol (declare → check restrictions → determine costs → pay costs → put into play / resolve). The engine has **one function per action type**, hardcoded to the protocol. Cards never override the protocol; they only inject effects at the well-defined hooks ("When Played", "On Attack", etc.).

### 6.3 Trigger matching & resolution

After every state change, the bus emits zero or more events. For each event:

1. Scan all in-play cards (plus cards just-defeated for "When Defeated") for triggered abilities whose `on:` matches and whose `where:` predicate evaluates true against the event payload.
2. Materialize each match as a `TriggerInstance` and push into `state.pendingTriggers`.
3. Once the originating action fully completes, drain `pendingTriggers` per rules §7.6:
   - Active player chooses which player resolves first (when both have pending).
   - That player chooses order among their own triggers.
   - Resolution of a trigger may emit more events → more triggers → **nested** stack (resolve nested fully before returning to outer layer).

This is the same algorithm as Magic's "stack" but simpler: SWU has no interrupts, no instants, no priority passing during resolution. The engine is fundamentally a depth-first event loop.

### 6.4 Continuous effects & auras (the modifier layer)

Instead of mutating card state when a buff lands, we **derive** effective stats on read:

```ts
function effectivePower(state: GameState, iid: string): number {
  const card = lookup(state, iid);
  let p = card.basePower + card.phaseAtkBonus;
  for (const m of activeModifiers(state, iid)) {
    if (m.power) p += m.power;
  }
  return Math.max(0, p);
}
```

`activeModifiers` is the union of:
- Modifiers on the card itself (from "give" effects with non-expired duration)
- Aura contributions from other cards' constant abilities whose `target` selector matches this card
- Lasting effects in `state.lastingEffects` whose target matches this card

This is exactly the v1 pattern from `keywords.ts:computePower` generalized. The benefit: live recomputation; no state desync; aura sources can leave/re-enter without bookkeeping.

### 6.5 Lasting & delayed effects

- **Lasting effect:** a modifier with `duration: end_of_phase | end_of_round | end_of_attack | until_condition`. Stored in `state.lastingEffects` keyed by duration; the engine sweeps the list at phase/round boundaries.
- **Delayed effect:** a scheduled future effect (e.g. "At the start of your next turn, ..."). Stored in `state.delayedEffects` with a trigger; resolves like any other triggered ability when its trigger fires.

Both are first-class state, not callbacks. This makes them serializable (critical for save/load, replays, and the tabletop simulator's sync model).

### 6.6 Costs & state-based actions

State-based checks (rules §1.7) run after every event drain:
- Base at 0 HP → that player loses.
- Multiple uniques → owner defeats extras.
- Unattached upgrade → defeated.
- Guard defeated → captured unit released.
- Unit at 0 effective HP → defeated.

These cascade: a defeat triggers `DEFEATED` events → new triggered abilities fire → potential more state-based checks. The loop runs to fixpoint before returning control.

---

## 7. Worked examples (21 cards)

Each example shows the full spec for a card spanning the easy → Category-C difficulty range from v1.

### 7.1 Vanilla unit
```json
{
  "id": "SOR_095",
  "name": "Battlefield Marine",
  "type": "unit",
  "cost": 3,
  "aspects": ["heroism"],
  "arena": "ground",
  "power": 3,
  "hp": 3,
  "traits": ["rebel", "trooper"],
  "keywords": [],
  "abilities": []
}
```
Engine work: none. New-set work: data only.

### 7.2 Unit with Ambush
```json
{
  "id": "SOR_152",
  "name": "Phase II Clone Trooper",
  "type": "unit",
  "cost": 2,
  "aspects": ["heroism"],
  "arena": "ground",
  "power": 2,
  "hp": 2,
  "traits": ["republic", "clone", "trooper"],
  "keywords": [{ "name": "ambush" }]
}
```
Engine work: `Ambush` keyword definition (one entry, already in v1).

### 7.3 Unit with valued keyword (Raid 2)
```json
{
  "id": "SOR_178",
  "name": "Hevy",
  "subtitle": "Cocky and Eager",
  "type": "unit",
  "cost": 2,
  "aspects": ["heroism"],
  "arena": "ground",
  "power": 2,
  "hp": 2,
  "traits": ["republic", "clone", "trooper"],
  "keywords": [
    { "name": "coordinate", "ability": {
      "type": "constant",
      "grant": {
        "target": { "self": true },
        "modifier": { "keyword": "raid", "keyword_value": 2 }
      }
    }}
  ]
}
```

### 7.4 When Played: deal damage
```json
{
  "id": "SOR_212",
  "name": "Vader's Lightsaber",
  "type": "upgrade",
  "abilities": [
    {
      "type": "triggered",
      "on": "event.upgrade_attached",
      "where": { "upgrade": "self" },
      "do": {
        "effect": "damage",
        "target": {
          "zone": "any_arena",
          "controller": "any",
          "selector": "chosen",
          "count": { "min": 1, "max": 1 }
        },
        "amount": 2
      }
    }
  ]
}
```

### 7.5 Token creation (Pelta — was Category C in v1)
```json
{
  "id": "SOR_PELTA",
  "name": "Pelta Supply Frigate",
  "type": "unit",
  "cost": 6,
  "aspects": ["heroism"],
  "arena": "space",
  "power": 3,
  "hp": 6,
  "traits": ["republic", "capital ship"],
  "abilities": [
    {
      "type": "triggered",
      "on": "event.card_played",
      "where": { "card": "self" },
      "do": {
        "effect": "create_token",
        "token_id": "clone_trooper",
        "controller": "self",
        "zone": "ground_arena",
        "count": 1
      }
    }
  ]
}
```
Engine work: `create_token` primitive + token registry. **One handler. Then every future token-creating card is data.**

### 7.6 Capture (Sanctioner's Shuttle — was Category C)
```json
{
  "id": "SOR_SANCTIONER",
  "name": "Sanctioner's Shuttle",
  "type": "unit",
  "abilities": [
    {
      "type": "triggered",
      "on": "event.card_played",
      "where": { "card": "self" },
      "do": {
        "effect": "capture",
        "target": {
          "zone": "ground_arena",
          "controller": "opponent",
          "filter": { "stat.power": { "max": 3 } },
          "selector": "chosen",
          "count": { "min": 1, "max": 1 }
        },
        "captor": { "self": true }
      }
    },
    {
      "type": "triggered",
      "on": "event.defeated",
      "where": { "card": "self" },
      "do": {
        "effect": "release_captives",
        "from_captor": { "self": true },
        "destination": "original_arena"
      }
    }
  ]
}
```
Engine work: `capture` and `release_captives` primitives + `capture_zone` state. Done once.

### 7.7 Triggered ability with per-phase limit (Ki-Adi-Mundi — was Category C)
```json
{
  "id": "SOR_KIADIMUNDI",
  "name": "Ki-Adi-Mundi",
  "type": "unit",
  "abilities": [
    {
      "type": "triggered",
      "on": "event.card_played",
      "where": {
        "controller": "self",
        "card.trait": "clone"
      },
      "limit": "once_per_phase",
      "do": {
        "effect": "give",
        "target": { "self": true },
        "modifier": { "duration": "end_of_phase", "power": 1, "health": 1 }
      }
    }
  ]
}
```
Engine work: none. **The trigger predicate + per-phase counter is generic infrastructure.**

### 7.8 Coordinate aura (Clone Commander Cody)
```json
{
  "id": "SOR_CODY",
  "name": "Clone Commander Cody",
  "type": "unit",
  "keywords": [
    {
      "name": "coordinate",
      "ability": {
        "type": "constant",
        "grant": {
          "target": {
            "zone": "any_arena",
            "controller": "self",
            "filter": { "not": { "card": "self" } }
          },
          "modifier": { "power": 1, "health": 1 }
        }
      }
    }
  ]
}
```
Engine work: none. The Coordinate keyword definition gates the constant ability on the 3-unit threshold automatically.

### 7.9 Constant ability with `while` condition (Vigilant Honor Guards)
```json
{
  "id": "SOR_048",
  "name": "Vigilant Honor Guards",
  "type": "unit",
  "abilities": [
    {
      "type": "constant",
      "while": { "self.damage": 0 },
      "grant": {
        "target": { "self": true },
        "modifier": { "keyword": "sentinel" }
      }
    }
  ]
}
```

### 7.10 Event with choose_one
```json
{
  "id": "SOR_TAKE_CAPTIVE",
  "name": "Take Captive",
  "type": "event",
  "cost": 2,
  "abilities": [
    {
      "type": "triggered",
      "on": "event.card_played",
      "where": { "card": "self" },
      "do": {
        "effect": "choose_one",
        "chooser": "controller",
        "prompt": "Choose one",
        "options": [
          {
            "label": "Capture a unit with 3 or less power",
            "do": {
              "effect": "capture",
              "target": { "zone": "any_arena", "controller": "opponent",
                          "filter": { "stat.power": { "max": 3 } },
                          "selector": "chosen", "count": { "max": 1 } },
              "captor": { "selector": "chosen", "zone": "any_arena", "controller": "self" }
            }
          },
          {
            "label": "Deal 2 damage to a unit",
            "do": {
              "effect": "damage", "amount": 2,
              "target": { "zone": "any_arena", "selector": "chosen", "count": { "max": 1 } }
            }
          }
        ]
      }
    }
  ]
}
```

### 7.11 Event with deck search
```json
{
  "id": "SOR_096",
  "name": "Mon Mothma",
  "type": "unit",
  "abilities": [
    {
      "type": "triggered",
      "on": "event.card_played",
      "where": { "card": "self" },
      "do": {
        "effect": "search",
        "player": "self",
        "zone": "deck",
        "count": 5,
        "filter": { "card.trait": "rebel" },
        "then": {
          "effect": "sequence",
          "steps": [
            { "effect": "reveal", "target": { "search_result": true } },
            { "effect": "move_to_zone", "target": { "search_result": true }, "destination": "hand" },
            { "effect": "move_to_zone", "target": { "search_remainder": true }, "destination": "deck", "facedown": true, "position": "bottom" }
          ]
        }
      }
    }
  ]
}
```
Note: `search_result` / `search_remainder` are synthesized selectors inside the search context.

### 7.12 Upgrade with stat modifier + keyword grant
```json
{
  "id": "SOR_057",
  "name": "Protector",
  "type": "upgrade",
  "cost": 2,
  "abilities": [
    {
      "type": "constant",
      "grant": {
        "target": { "attached_to_self": true },
        "modifier": { "power": 2, "health": 2, "keyword": "sentinel" }
      }
    }
  ]
}
```

### 7.13 Leader with action ability
```json
{
  "id": "SOR_003",
  "name": "Chewbacca",
  "subtitle": "Walking Carpet",
  "type": "leader",
  "abilities": [
    {
      "type": "action",
      "cost": { "exhaust": true },
      "do": {
        "effect": "search",
        "player": "self",
        "zone": "hand",
        "filter": { "card.type": "unit", "card.cost": { "max": 3 } },
        "count": 1,
        "then": {
          "effect": "play_card",
          "target": { "search_result": true },
          "free": true
        }
      }
    }
  ]
}
```
Adds one primitive (`play_card` — playing a card without the action-economy cost).

### 7.14 Bounty (opponent-controlled trigger)
```json
{
  "id": "SOR_204",
  "name": "Greedo",
  "type": "unit",
  "keywords": [
    {
      "name": "bounty",
      "ability": {
        "type": "triggered",
        "on": "event.defeated",
        "where": { "card": "self" },
        "controlled_by": "opponent",
        "do": {
          "effect": "draw",
          "player": "controller_of_trigger",
          "count": 2
        }
      }
    }
  ]
}
```
Bounty needs only one extra concept: `controlled_by: "opponent"` on the trigger spec, so the engine routes ordering/resolution to the right player per rules §7.6.

### 7.15 Smuggle (constant ability active in resource zone)
```json
{
  "id": "SOR_HONDO",
  "name": "Hondo Ohnaka",
  "type": "unit",
  "keywords": [
    {
      "name": "smuggle",
      "value": 4,
      "ability": {
        "type": "constant",
        "active_in_zone": "resource_zone",
        "grant": {
          "target": { "self": true },
          "modifier": { "play_from": "resource_zone", "alternate_cost": 4 }
        }
      }
    }
  ]
}
```
Smuggle needs: (a) the engine considers `resource_zone` as a valid play origin when checking restrictions, (b) the alternate-cost path is honored. One handler.

### 7.16 Piloting (v7 — alternate cost as upgrade) {NEW}
```json
{
  "id": "JTL_HERA",
  "name": "Hera Syndulla",
  "subtitle": "We've Lost Enough",
  "type": "unit",
  "arena": "ground",
  "keywords": [
    { "name": "piloting", "value": 3 }
  ]
}
```
With `piloting 3` in the keyword enum, the engine knows: the card can also be played as an upgrade attached to a friendly Vehicle without a Pilot, for cost 3 (replacing its normal cost). The attached unit becomes a Leader Unit per §v7 3.4.7 (only when the card is itself a leader — handled by the leader path).

### 7.17 Hidden (v7 — can't be attacked this phase) {NEW}
```json
{
  "id": "TWI_DECOY",
  "name": "Decoy Scout",
  "type": "unit",
  "keywords": [{ "name": "hidden" }]
}
```
Engine work: the Hidden keyword definition checks `enteredZoneAt > phaseStartedAt` and adds a `cant: ["be_attacked"]` modifier with `duration: end_of_phase`. Sentinel overrides this per §v7 7.5.18.A.

### 7.18 Plot (v7 — play from resource on leader deploy) {NEW}
```json
{
  "id": "TWI_AMBUSH",
  "name": "Coordinated Strike",
  "type": "event",
  "cost": 2,
  "keywords": [{ "name": "plot" }],
  "abilities": [
    {
      "type": "triggered",
      "on": "event.card_played",
      "where": { "card": "self" },
      "do": { "effect": "damage", "amount": 4, "target": { "zone": "any_arena", "selector": "chosen" } }
    }
  ]
}
```
The Plot keyword definition wires the constant "may play from resource zone when controller deploys a leader" trigger; the card's own ability still resolves normally because it's a real `Play a Card` action.

### 7.19 Indirect damage event (v7) {NEW}
```json
{
  "id": "TWI_BARRAGE",
  "name": "Orbital Barrage",
  "type": "event",
  "cost": 5,
  "abilities": [
    {
      "type": "triggered",
      "on": "event.card_played",
      "where": { "card": "self" },
      "do": {
        "effect": "indirect_damage",
        "amount": 6,
        "chooser": "controller",
        "valid_targets": { "controller": "opponent" }
      }
    }
  ]
}
```
Engine routes the 6 damage to the chooser, who divides it among any opponent units + opponent base. Unpreventable. Shields ignored. Per-unit cap = remaining HP.

### 7.20 Force token leader (v7) {NEW}
```json
{
  "id": "SOR_PLO",
  "name": "Plo Koon",
  "type": "leader",
  "leader_abilities": [
    {
      "type": "action",
      "cost": { "exhaust": true },
      "do": {
        "effect": "if_you_do",
        "first": { "effect": "use_force", "player": "self" },
        "then": {
          "effect": "give",
          "target": { "all_friendly_units": true, "filter": { "card.trait": "jedi" } },
          "modifier": { "duration": "end_of_phase", "power": 1, "health": 1 }
        }
      }
    }
  ],
  "leader_unit_abilities": [
    {
      "type": "triggered",
      "on": "event.attack_declared",
      "where": { "attacker": "self" },
      "do": { "effect": "create_force_token", "player": "self" }
    }
  ]
}
```
Two ability lists per `leader_abilities` / `leader_unit_abilities` (per Christian's preference). Demonstrates `use_force` as a cost (via `if_you_do`) and `create_force_token` as an On Attack effect. The Force token primitive is a one-time engine addition; this and all future Force-using cards become data.

### 7.21 Twin Suns counter — Take an Available Counter {NEW}
This isn't a card; it's an engine-supplied action. Listed here for completeness:
```ts
// Action surfaced by getLegalActions() in Twin Suns multiplayer games
type TwinSunsAction =
  | { kind: 'TAKE_COUNTER'; counter: 'initiative' | 'blast' | 'plan'; player: PlayerId };
```
- **Blast** taken → emit `damage` of 1 to each opponent's base.
- **Plan** taken → emit `draw 1` + `move_to_zone(hand[choice] → deck.bottom)`.
- **Initiative** taken → as today.
Player flagged `hasTakenCounterThisRound = true`; remaining actions auto-pass per §v7 12.6.

---

## 8. Authoring pipeline (L4)

### 8.1 The cascade

```
printed_text  ─┐
               ├─► Tier 1: deterministic templates ─► spec (✓) ──┐
               │                                                  │
               ├─► Tier 2: local 8B + GBNF grammar  ─► spec (?) ──┤
               │                                                  │
               ├─► Tier 3: Claude (opt-in, paid)    ─► spec (?) ──┤
               │                                                  │
               └─► Tier 4: human review                           │
                                                                  ▼
                                                            validator
                                                              │  │
                                                          ✓ │  │ ✗ → pending_review/
                                                              ▼
                                                        cards/{id}.json
```

Each tier outputs a candidate spec. The validator (next section) is the gate. **Tier 2 only runs if Tier 1 doesn't match; Tier 3 only runs if Tier 2 fails validation or is marked low-confidence.**

### 8.2 Tier 1 — deterministic templates

A regex/grammar library of common SWU phrasings. Expansion of v1's `parseCoordinateText`. Each template binds capture groups to spec fields.

Examples:
| Template | Maps to |
|---|---|
| `Deal {N} damage to a unit` | `damage` with chosen-unit selector |
| `Draw {N} cards` | `draw` |
| `When Played: {X}` | wraps `X` in a `triggered` ability on `event.card_played` |
| `On Attack: {X}` | wraps `X` in a `triggered` ability on `event.attack_declared` |
| `For each {trait} unit you control, {X}` | `for_each` with predicate |
| `Choose one — {A}; or {B}` | `choose_one` with two options |

Goal: 60% coverage. Templates have **zero semantic error rate by construction**.

### 8.3 Tier 2 — local 8B with grammar-constrained sampling

Run on the Mac mini via llama.cpp or vLLM. Recommended model: **Qwen 2.5 7B-Instruct** (best structured-output track record at this size; Llama 3.1 8B as fallback).

The unlock: **GBNF grammar derived from the card JSON Schema.** The model literally cannot emit invalid primitives, invalid zones, or malformed JSON — the sampler restricts tokens at every position.

```bnf
# Simplified excerpt
ability      ::= "{" "\"type\":" ability-type "," ability-body "}"
ability-type ::= "\"triggered\"" | "\"action\"" | "\"constant\""
effect       ::= damage-effect | draw-effect | give-effect | sequence-effect | ...
damage-effect ::= "{" "\"effect\":\"damage\"," "\"amount\":" int "," "\"target\":" selector "}"
primitive-name ::= "\"damage\"" | "\"draw\"" | "\"discard\"" | ... # closed enum from L2
```

System prompt to the local model includes:
- The full L2 primitive vocabulary as enums
- 10 canonical card-text → spec examples (few-shot)
- Strict instruction: "If the text does not match a primitive in the vocabulary, return `{ \"error\": \"unmappable\", \"reason\": \"...\" }`"

Goal: handles ~30% more cards beyond Tier 1. Empirically uncertain until tested — measure on a 100-card sample.

### 8.4 Tier 3 — Claude (paid, opt-in)

For:
- Validator failures from Tier 2
- Cards Tier 2 returned `error: unmappable`
- Cards a human flagged

Same prompt as Tier 2, but no grammar constraint (Claude is reliable enough to produce schema-conformant output without it). Output still passes through the validator.

Expected volume: small minority of the pool after Tier 1 + 2 do their work. Christian sets a monthly token budget; the pipeline halts cleanly when reached.

### 8.5 Tier 4 — human review

What lands here:
- Cards no tier could spec
- Cards the validator rejected from all tiers
- Cards a regression test flagged as semantically wrong

UI sketch: a small Next.js page showing `printed text | last attempted spec | diff against canonical | LLM-generated plain-English readback of the spec`. Human approves, edits, or escalates.

### 8.6 The validator

Strictly mechanical. JSON Schema + L2 vocabulary check + reference integrity:

1. **Schema:** every required field present, every value the right type.
2. **Closed enums:** every primitive name, zone, event kind, keyword name is in the L2 enum.
3. **Reference integrity:** every `token_id` exists in `tokens/`; every selector's filter paths are known.
4. **Type consistency:** a `triggered` ability has `on`, an `action` ability has `cost`, etc.
5. **Spot-checks:** no `target.zone` for a base-targeted effect, etc.

The validator never runs LLM output directly into the game. It is the **only** path from authoring to playable.

### 8.7 Regression / semantic correctness

The biggest LLM risk: syntactically valid spec, semantically wrong (`"target: opponent"` instead of `"target: chosen unit"`). Mitigations:

1. **Canonical corpus.** A growing set of `{ printed_text, expected_spec }` pairs (start with 50, grow over time). Every pipeline run diffs new specs against this set; any deviation on a known pattern is a regression.
2. **Behavioral tests.** For each spec, generate a scripted game scenario (`opponent has X, play card, expect Y`). Store as a `cards/{id}.test.json`. The engine executes it as a CI gate.
3. **Plain-English readback.** Tier 2/3 also emit a one-sentence English summary of the spec. Human reviewer compares it to the printed text; mismatches flagged.

---

## 9. Migration plan

```
Week 1     L1 + minimal L2 (draw, damage, give, exhaust)
           Hand-write 10 canonical card specs
           Playtest 2-player loop end-to-end

Week 2     Expand L2 to cover all v1 Category A+B effects
           Hand-write 40 more cards
           Reach parity with v1 on the existing card pool

Week 3     Add Category C primitives: create_token, capture, release_captives,
           per-phase/round counters, search, choose_one
           Re-spec the v1 Category C cards as YAML

Week 4     Build the validator + Tier 1 template matcher
           Run pipeline on the full card pool; measure Tier 1 hit rate
           Stand up Tier 2 (local model + GBNF) on the mini
           Stand up the reviewer UI

Week 5+    Iterate on coverage; switch the Tabletop client; retire v1
```

v1 stays running on `frontend/src/lib/game-engine/`. v2 lives at `frontend/src/lib/engine-v2/` with a clean boundary (no React imports). When parity holds, swap the import in `frontend/src/app/game/` and delete v1.

---

## 10. Directory layout

```
frontend/src/lib/engine-v2/
  index.ts                # public API — the only file outsiders import
  state/
    types.ts              # GameState, CardInstance, PlayerState
    zones.ts              # zone semantics, valid moves
    bus.ts                # event emission, subscription
    state_based.ts        # rules §1.7 fixpoint loop
  primitives/
    card_flow.ts          # draw, discard, mill, return_*, search, look, reveal
    combat.ts             # damage, heal, defeat, give_shield, remove_shield
    state.ts              # exhaust, ready, give (the modifier engine)
    move.ts               # move_to_zone, attach/detach, capture, release
    tokens.ts             # create_token
    resource.ts           # add/exhaust/ready_resource
    choice.ts             # choose_one, optional, prompt_target
    meta.ts               # sequence, parallel, if, repeat, for_each, noop
    keywords/             # one file per keyword (definitions, not handlers)
      index.ts            # keyword registry
      ambush.ts
      raid.ts
      ...
  runtime/
    interpret.ts          # effect interpreter (the AST walker)
    triggers.ts           # match events → pending triggers; resolve order
    modifiers.ts          # active modifier aggregation; effective stats
    selectors.ts          # resolve a selector against state → CardInstance[]
    predicates.ts         # evaluate a predicate against a context
  spec/
    schema.json           # JSON Schema for cards
    validator.ts          # validates a spec, returns errors or ok
    loader.ts             # loads cards from disk/DB into engine memory
  __tests__/

tools/authoring/          # NOT in the engine; runs separately on the mini
  cascade.py              # the L4 pipeline orchestrator
  tier1_templates.py      # deterministic templates
  tier2_local_llm.py      # local model + GBNF
  tier3_claude.py         # Claude fallback
  grammar.gbnf            # generated from schema.json
  corpus/                 # canonical card_text → spec pairs
  pending_review/         # validator failures land here

cards/                    # the spec database (file-per-card)
  SOR_001.json
  ...
  tokens/
    clone_trooper.json
    ...
```

---

## 11. What I'm explicitly NOT doing

- **Lua transpilation for Tabletop Simulator (the Steam app).** v2 is TypeScript-only. The "tabletop sim" in scope is the web app at `frontend/src/app/game/`.
- **AI play.** v1's `ai.ts` is not migrated. v2 supports it later by exposing `getLegalActions(state)` and `applyAction(state, action)`.
- **Magic-style stack / interrupts / priority.** SWU has no instants; the action protocol is fixed.
- **Multiplayer (3+).** Twin Suns is 2-player. The state model assumes `PlayerId = 'player1' | 'player2'`.
- **Live re-authoring at play time.** Specs load once at game start; they're not hot-reloaded mid-game.

---

## 12. What I'm leaving for v2.1+

- **Replay format.** With pure-functional reducer + serializable lasting/delayed effects, replays are free; just need a viewer.
- **Save/load.** Same reasoning.
- **Network sync for the web tabletop.** State is serializable; the harder part is action-validation on the server.
- **Card-text → spec translation for v7 keywords** not present in v3 (extend the enum + add one keyword file each).

---

## 13. Open questions

### Resolved (Christian, 2026-05-25)

1. ~~**v7 PDF access.**~~ ✅ Christian dropped the file locally. v7 folded in throughout this doc. See [§16 Change log](#16-change-log).
2. ~~**Token registry source of truth.**~~ ✅ **Pull from SWU API.** A `tools/authoring/build_token_registry.py` script queries the API for token definitions (Battle Droid, Clone Trooper, TIE Fighter, X-Wing, Experience, Shield, Spy, Force, Credit), normalizes into the spec format, and writes `cards/tokens/{id}.json`. Re-run when new sets ship. Hands-off matches Christian's preference for the keyword script.
3. ~~**Leader two-sidedness.**~~ ✅ **Two separate lists per leader spec:** `leader_abilities` and `leader_unit_abilities` (plus optional `leader_upgrade_abilities` for the §v7 3.4.4A deploy-as-upgrade case). Only the faceup side's abilities are active. Once deployed, the leader cannot be re-deployed unless an ability explicitly allows it. Example in §7.20.
4. ~~**Choice persistence (UI contract).**~~ ✅ **Both inline + highlight.** When a `choose_one` / `optional` / `prompt_target` effect pauses:
   - The engine returns `pendingChoice: { kind, prompt: string, options?: [...], validTargets?: iid[], canPass: boolean }`.
   - UI shows the `prompt` string inline (e.g. "Choose one — Deal 2 damage or Draw a card").
   - UI highlights `validTargets` in the relevant zones (units in arena, cards in discard, upgrades, base).
   - If `canPass` (set true when the effect uses "may"), UI shows a Pass button.
   - Player input round-trips back as a `PlayerChoice` the reducer consumes to continue.
5. ~~**Set-cadence keyword refresh.**~~ ✅ **Automated script.** `tools/authoring/sync_keywords.py` diffs the SWU API's keyword list against `primitives/keywords/index.ts`. New keywords land in `pending_review/` with a stub definition for human approval; the script never auto-adds without review (to prevent silent semantic drift).

### Still open

6. **Twin Suns multi-player support.** §v7 12.1 frames Twin Suns as a multiplayer format (2–4 players). The state model in §3 uses string `PlayerId` and a counter-cycling helper so 3–4-player support is mechanical when needed — but the UI, AI, and tabletop flow currently assume two seats. **Decision needed:** ship v2 at 2-player parity with v1, and add 3–4-player as v2.1? I lean **2-player first** — get the engine right with the simpler invariant, then generalize. Christian's call.
7. **Replacement effect resolution UI.** When a player has multiple applicable replacement effects (§v7 7.7.5.E), they choose order. I lean: same choice-pause mechanism as #4, surfaced as an inline "Choose which effect to apply first" prompt.
8. **Last Known Information snapshotting.** §v7 8.11 requires "When Defeated" abilities to see card stats *as they were immediately before defeat*. Implementation: snapshot the `CardInstance` into the `DEFEATED` event payload (already in §3's event list). Calling out so the L1 contract reflects it.

---

## 14. Acceptance criteria for "v2 is done"

- [ ] All cards in the current `swu_cards.db` have a valid spec in `cards/`.
- [ ] All v1 Category A + B + C effects work in v2 with the same observable behavior.
- [ ] The L4 cascade processes a hypothetical new 50-card set with **zero engine changes** in ≥90% of cases.
- [ ] The reviewer UI exists; pending_review queue is operational.
- [ ] The web tabletop at `frontend/src/app/game/` runs on v2.
- [ ] v1 is removed from the codebase.

---

## 15. Sign-off checklist for Christian

Before any code lands:

- [ ] Architecture (§2) makes sense.
- [ ] Primitive vocabulary (§4) covers what you expect; nothing obviously missing.
- [ ] Spec format (§5) is the shape you want the LLM to produce.
- [ ] Worked examples (§7) feel like the right authoring experience.
- [ ] Pipeline (§8) matches the cascade you wanted (templates → local → Claude).
- [ ] Open questions (§13) are addressed or acknowledged.

If yes to all: I'll start Week 1 from §9 (L1 + minimal L2 + 10 hand-written specs + 2-player loop).

---

## 16. Change log

### 2026-05-25 — v7 rules deltas folded in (post-PDF access)

**Keywords:**
- Added: `piloting`, `hidden`, `plot` (15 keywords total, was 12)
- Expanded trigger windows for `ambush` and `shielded` to also fire on "When Deployed" (leaders) and "When Created" (tokens) per §v7 7.5

**Triggered ability vocabulary:**
- New aliases: `on_defense`, `when_attack_ends`, `when_captured`, `when_created`
- `bounty` now also triggers on capture (§v7 7.5.13.F)

**Primitives added:**
- `combat.indirect_damage`, `combat.damage_divided`, `combat.prevent_damage`
- `move.move_arena` (between ground/space, does NOT count as enter/leave play — §v7 8.36)
- `move.rescue` (distinct from `release_captives`; voluntary retrieval — §v7 8.33.3)
- `force.create_force_token`, `force.use_force` (new namespace — §v7 8.37)
- `disclose` (§v7 8.38)
- `resource.take_counter` (generalizes initiative-only to {initiative, blast, plan} — §v7 12.5)
- `meta.if_you_do` (§v7 8.9), `meta.replace` (§v7 7.7.5)
- `tokens.give_experience` (sugar alias for create+attach)

**Event bus additions:**
- `CARD_DISCLOSED`, `ARENA_MOVED`, `ATTACK_ENDED`, `DAMAGE_PREVENTED`, `RESCUED`
- `TOKEN_CREATED` (distinct from `CARD_PLAYED`)
- `FORCE_TOKEN_CREATED`, `FORCE_USED`
- `COUNTER_TAKEN` (replaces `INITIATIVE_TAKEN`; carries which counter)
- `LEADER_DEPLOYED` now carries `as: 'unit' | 'upgrade'` and optional `targetIid` (§v7 3.4.4A)
- `DEFEATED` now carries `lastKnown: CardSnapshot` (§v7 8.11)

**State model additions:**
- `PlayerState.forceToken: boolean`, `creditTokens`, `countersHeld`, `hasTakenCounterThisRound`
- `PlayerId` widened from `'player1' | 'player2'` to open string (for Twin Suns multiplayer support — §v7 12)
- Capture zone documented as facedown-but-open-info (§v7 8.33.1)

**Modifier grammar additions:**
- `lose_keyword`, `lose_all_abilities` (§v7 8.14)
- `must: [...]` for forced behavior (§v7 8.16)
- First-class `replace: { event, where, instead }` for replacement effects (§v7 7.7.5). Shield token now modeled here.

**Selectors/predicates additions:**
- `attached_to_self`, `trigger_source`, `exclude: Selector` for §v7 8.18 "other/another"
- Filter atoms: `is_leader_unit`, `is_token`, `has_force_token`, `is_unique`
- Predicate paths: `player.has_force_token`, `player.controls_count`, `first.event`

**Open questions resolved (Christian, 2026-05-25):**
- Token source = SWU API (script-driven, hands-off)
- Leader spec = two ability lists (+ optional third for deploy-as-upgrade)
- Choice UI = inline prompt + object highlight + pass option
- Keyword refresh = automated diff script with human approval gate

**New open question:** Multi-player Twin Suns scope (ship v2 at 2-player, generalize in v2.1?).

**Examples expanded:** §7.16–7.21 added (Piloting, Hidden, Plot, Indirect Damage, Force-token leader, Twin Suns counter).
