# CHANGELOG

Most recent entry first. Captures *why*, not just *what* — decisions, root causes, alternatives rejected.

---

### 2026-05-25: Engine v2 Week 3 — choices, tokens, capture, interactive CLI (session 37)

**Change**

Week 3 lands the pending-choice protocol (synchronous Chooser API), the token system, the capture mechanic, and an interactive CLI driver — the first UAT-able artifact of v2. Scenario suite expanded to 18/18 passing. CLI plays full AI-vs-AI games to completion.

**Design choices made in code**

- **Synchronous Chooser callback over async PendingChoice.** The design doc (§6.1) sketches an async `pendingChoices` field returned from `step()`. For Week 3 the only consumers are (a) a Node CLI with blocking stdin, (b) scenario tests with predetermined picks, (c) an inline AI. All synchronous. The async lift is Week 4 when the web UI is wired to v2 — at that point we replace this sync boundary with a continuation/journal protocol. The Chooser API was designed so the primitives that consume it (`choose_one`, `optional`, scoped selectors with `chosen`) don't change shape during the swap.
- **Tokens mirror their spec into the card registry on first creation.** Token specs live in a separate `TOKEN_REGISTRY` (because they aren't in player decks), but the rest of the engine — effective stats, predicates, triggers, selectors — looks up `reg.cards[cardId]`. Rather than add a parallel token lookup everywhere, `createToken` does a one-shot `reg.cards[spec.id] = spec` mirror. Token instances carry `isToken: true` so the few places that need the distinction (capture-becomes-set-aside) can branch.
- **Capture cleans damage and defeats attached upgrades on entering the capture zone** per §v7 8.33.1. Token units that would be captured are set aside instead (§8.33.5).
- **Rescue selector targets the sourcePlayer's first captive.** The Selector AST doesn't have a capture-zone-aware form yet — cards that need finer rescue targeting will trigger that addition (Greedo: Hated Smuggler, Bounty Hunter Cad Bane, etc.).
- **Setup-decline tracked via perGameFlags.has('setup_declined').** `hasResourced` gets reset between passes so a player who declined once would be prompted again forever. The flag is set on DECLINE_RESOURCE during setup and cleared when setup transitions to round 1.
- **Event-type cards resolve their When-Played ability inline, not through the trigger drain.** Events move directly to discard before their ability resolves (§v7 3.3). Going through the drain works but adds an unnecessary scan-and-match step when we already have the spec in hand. The triggered ability is dispatched directly to `applyEffect`.
- **`getLegalActions` is the public legal-action enumerator** — used by the CLI and intended for any AI. Honors Sentinel constraints by checking Saboteur-or-not on the attacker and either narrowing defenders to Sentinels or including base + all enemies.
- **Per-card setup of game state in scenario tests** bypasses initGame to construct deterministic positions. Tradeoff acknowledged: init logic isn't exercised by scenarios; it's covered by Week 1's `play-demo`.
- **CLI Chooser fallback** when no pre-loaded answer is queued: pick leftmost / yes / first-N (same as `defaultChooser`) with a `[auto-choice]` log line. The full pre-fetch / interactive choose-target wiring requires walking the effect AST to find decision points before calling `step()` — small but didn't fit this session. CLI is still useful for vanilla play and observing token/capture mechanics; interactive option-branch picking is the first thing to land in Week 4.

**Scenarios verified (18/18)**

Week 2 holdovers: Grit, Sentinel force-target, Saboteur bypass + shield strip, Shielded onPlay, Ambush enters-ready, Raid, Restore, Overwhelm, triggered When-Played damage, triggered On-Attack draw, constant aura, end_of_phase lasting effect expiry.

Week 3 new: Pelta create_token (Clone Trooper appears in ground arena), Sanctioner capture (target moves from p2 arena to p1's capturedByMe), Take Captive damage branch (scriptedChooser picks 'damage'), Take Captive capture branch (defaultChooser picks leftmost = capture), token unit fights and dies normally (damage + state-based defeat).

**CLI driver verified**

`npm run play-cli -- --ai both` runs a 7-round game with seeded deck construction. Observed mechanics in play:
- p1 plays Pelta Supply Frigate → Clone Trooper token created in p1's ground arena
- p2 plays Pelta — same flow, opponent side
- p1 plays Sanctioner's Shuttle → captures a Demolitions Droid from p2's arena; visible in `captured: Demolitions Droid` line
- p2 captures a Shield Generator
- Game terminates correctly with `GAME_ENDED` event when Echo Base hits 0 HP
- All keyword behaviors (Grit, Raid, Sentinel, Shielded, etc.) from Week 2 still working in mixed-deck play

**Week 2 regression**: scenarios stay at 18/18 (was 13/13 with 5 new). Week 1 `play-demo` still passes.

**Categories vs v1 parity (updated)**

- ✅ Category A
- ✅ Category B
- ✅ Tokens (was 🔴 Category C)
- ✅ Capture (was 🔴)
- ✅ Pending choice via sync Chooser (was 🔴 — async PendingChoice still pending for web UI)
- ✅ Events as a card type
- 🟡 Bounty: AST supports `controlled_by: 'opponent'`; trigger drainer player-ordering still doesn't honor it
- 🟡 Coordinate, Smuggle: small predicate/scan additions still needed
- 🔴 Leaders, Upgrades, Indirect damage, Search, Look at, Disclose, The Force, Replacement effects: Week 4 scope

**Files added**

```
runtime/chooser.ts                  Chooser API, defaultChooser, scriptedChooser
state/tokens.ts                     TOKEN_REGISTRY (7 tokens hand-coded)
primitives/tokens.ts                createToken primitive
primitives/capture.ts               capture / rescue / releaseAllCaptivesFor
legal.ts                            getLegalActions + describeAction
scripts/play_cli.ts                 interactive CLI driver
__fixtures__/cards/W3_001.json      Pelta Supply Frigate (create_token)
__fixtures__/cards/W3_002.json      Sanctioner's Shuttle (capture)
__fixtures__/cards/W3_003.json      Take Captive (event + choose_one)
```

**Files modified**: `spec/ast.ts`, `runtime/predicates.ts`, `runtime/selectors.ts`, `runtime/interpret.ts`, `runtime/triggers.ts`, `reducer.ts`, `index.ts`, `__fixtures__/index.ts`, `scripts/scenarios.ts`, `package.json`.

`tsc --noEmit` clean across the frontend. Both `play-demo` and `scenarios` and `play-cli --ai both` pass.

---

### 2026-05-25: Engine v2 Week 2 — abilities + keywords + triggers (session 36)

**Change**

Week 2 lands Layer 2 of [engine-v2](frontend/src/lib/engine-v2/): the AST, the interpreter, the modifier aggregator, the trigger drain, and 8 v3 keywords (Ambush, Grit, Overwhelm, Raid, Restore, Saboteur, Sentinel, Shielded). With this in place, the engine handles every effect shape from v1's Category A and Category B without needing per-card code — new cards in those categories become pure JSON.

**Design choices made in code**

- **Closed-enum field paths.** `predicates.ts` uses an explicit set of field paths (`card_trait`, `stat_power`, `controller`, etc.). Underscored, not dotted — design doc uses dots for readability; TS implementation uses underscores to avoid bracket-access friction. Validator (Week 4) will accept either form.
- **Modifier aggregation has three sources.** Constant abilities on in-play cards (re-resolved every read; supports `while` predicates), lasting effects in `state.lastingEffects` (snapshotted iid targets per §v7 7.7.3.D), and keyword `bonusPower` / `bonusHp` hooks (Grit). One `effectivePower` / `effectiveHp` call walks all three.
- **Effective-vs-printed stats in predicate filters.** `predicates.ts` uses *printed* stats for filtering, not effective. Per the rulebook examples, "deal X damage to a unit with power 3 or less" filters on printed power; using effective would invite cycles (a modifier selecting modifiers that select modifiers).
- **Trigger drain prefers the active player.** §v7 7.6.10 says the active player chooses who resolves first. Week 2 simplification picks the first pending trigger controlled by the active player, then falls back to insertion order. Player-chooses UI uses the same pending-choice mechanism as choose_one and ships when that protocol lands.
- **Nested triggers stack at the front of the queue** per §v7 7.6.11 ("each new layer of abilities must be fully resolved before returning to an earlier layer"). Implemented in `drainTriggers` by prepending new triggers to `pendingTriggers`.
- **Saboteur shield strip is inlined into the reducer's attack flow**, not driven through the keyword `onAttack` hook. The strip needs the defender iid in scope, which the generic onAttack ctx doesn't carry. Restore's base-heal uses the standard hook because it only needs the attacker's owner.
- **Overwhelm computes excess vs `defenderHpBefore` at attack-time**, before combat damage applies. Per §v7 7.5.7.E, no overwhelm flow if a shield blocked the damage; per 7.5.7.F, the full damage routes to base if the defender left play before combat damage (e.g. via an On Attack ability). Week 2 implements the standard case; the leaves-play corner case lands when we have a card that needs it.
- **Selector default is ALL matching, not first-1.** A scoped selector with neither `selector` nor `count` reads as "all units matching the filter" — the natural reading for constant-ability grants (`each friendly clone unit gets +1/+1`). Explicit `selector: "chosen"` triggers count-limited slicing. **Bug caught by scenario suite during verification** (Clone Sergeant aura buffed only the leftmost matching unit); fixed at `selectors.ts:resolveSelector`.
- **`defeat` primitive bumps damage to ≥ HP** instead of inlining the discard move. This routes through the state-based fixpoint, which already emits `DEFEATED` with `lastKnown` snapshot and handles unattached-upgrade cascade. One path for "thing dies" instead of two.
- **`give` writes a `LastingEffectRec`** with snapshotted target iids — not a re-resolving selector ref. Matches §v7 7.7.3.D.
- **Lasting-effect expiry sweep** runs at end_of_attack (after `applyAttack`), end_of_phase (action-phase end), end_of_round (regroup end).

**Scenarios verified (13/13)**

`npm run scenarios` runs scenario-style assertions:
- Grit damage→power scaling
- Sentinel force-target validation (with attacker-throws-on-illegal-target)
- Saboteur bypass + shield strip
- Shielded onPlay shield grant
- Ambush enters-ready
- Raid attack bonus
- Restore base heal on attack
- Overwhelm excess routing to base
- Triggered When Played dealing chosen damage
- Triggered On Attack drawing a card
- Constant aura buffing matching units
- Lasting effect expiring at phase end

**Week 1 regression check**: `npm run play-demo` still runs to the same Bob-wins-round-6 outcome.

**Categories vs v1 parity**

- ✅ Category A (STAT_BUFF, KEYWORD grant, ON_ATTACK_DRAW, ON_ATTACK_PREVENT_DAMAGE)
- ✅ Category B (ON_ATTACK_DEAL_DAMAGE_TARGET, ON_ATTACK_DEBUFF_DEFENDER, ON_ATTACK_DEBUFF_TARGET, WHEN_PLAYED_DAMAGE_DUAL, AURA_BUFF_OTHERS)
- 🟡 Bounty: `controlled_by: 'opponent'` exists in the AST; trigger drainer needs to honor it when picking resolution player (small)
- 🟡 Coordinate: needs `player.controls_count` predicate path + `active_in_zone` for resource zone (Smuggle); both one-line additions
- 🔴 Category C (tokens, capture, search, indirect, force) — Week 3 scope

**Known gaps deliberately deferred to Week 3**

- Choose-one / optional / prompt_target pending-choice protocol (interpreter auto-picks leftmost for `chosen` selectors)
- Per-phase counter reset on phase start (currently only on round start)
- Token primitives (create_token, give_experience), the token registry
- Capture / rescue / release_captives
- Indirect damage, divided damage
- Move (arena→arena), search, look at, disclose
- The Force token system
- Replacement effects interception layer (the `replace` AST exists; nothing intercepts yet)
- Leaders, events, upgrades as playable card types
- 40+ specs (Week 2 added 10; design says Week 2 target was 50 cumulative)

**Files added/modified**

```
spec/ast.ts                      [new] AST type contract
state/effects.ts                 [new] LastingEffectRec
runtime/predicates.ts            [new] card + trigger predicate eval
runtime/selectors.ts             [new] Selector → ResolvedTarget[]
runtime/modifiers.ts             [rewrite] multi-source aggregation
runtime/interpret.ts             [new] Effect AST walker
runtime/triggers.ts              [new] collect + drain
primitives/keywords/             [new] 8 keyword files + index + types
primitives/combat.ts             [unchanged]  (Shield shortcut still in place)
reducer.ts                       [rewrite] hooks keyword onPlay/onAttack, Sentinel validation, Raid+Overwhelm, trigger drain via settleTriggers, lasting-effect sweep
spec/types.ts                    [edit] Ability type now imported from ast.ts
state/types.ts                   [edit] LastingEffect aliased to LastingEffectRec
__fixtures__/cards/W2_001..010.json   [new] 10 keyword/ability-driven specs
__fixtures__/index.ts            [edit] adds W2_CARDS, ALL_W12_CARDS
scripts/scenarios.ts             [new] 13-scenario verification suite
package.json                     [edit] adds "scenarios" script
```

`tsc --noEmit` clean across the whole frontend (v1 + v2 + UI).

---

### 2026-05-25: Engine v2 Week 1 implementation (session 35)

**Change**

Greenfield engine v2 lands under [frontend/src/lib/engine-v2/](frontend/src/lib/engine-v2/). 18 new files implement the L1 state model + minimal L2 primitives needed for vanilla 2-player play. v1 at `frontend/src/lib/game-engine/` is untouched and remains the production engine until v2 reaches parity.

**Design choices made in code that weren't in the doc**

- **`util/uuid.ts`**: chose a dependency-free monotonic generator (`g{timestamp36}{counter36}`) over `crypto.randomUUID()` to keep engine portable across Node runtimes without polyfill noise. IDs are opaque strings; cryptographic uniqueness isn't required.
- **`init.ts` opening hand = 6 cards, mulligan skipped.** §v7 5.2 specifies a mulligan step. Out of Week 1 scope (no UI to support it). Decks are shuffled with a seedable RNG so the demo is reproducible.
- **Setup resources enter PLAY READY** (`reducer.ts` `applyResourceCard`). v3/v7 don't spell out setup-resource readiness explicitly, but v1's `engine.ts:1140-1162` treats them as available (`{ total, available }` counts equal after setup) and real SWU play has round 1 productive. v2 marks setup resources `exhausted: false`, regroup-phase resources `exhausted: true` (§v7 5.5c).
- **Shield token absorption is a primitive shortcut in `combat.damageUnit`**, not yet the full replacement-effect path. The proper model (per ENGINE_DESIGN §5.5) is a token upgrade carrying a `replace` modifier; that lands when the modifier layer ships in Week 2. The shortcut is correct for indirect-damage bypass (§v7 8.35.2.A).
- **`runtime/state_based.ts` defeats units → discard with damage cleared**, per §v7 8.7 leaves-play implication that damage counters are removed when a card leaves play.
- **`reducer.ts` initiative model:** taking initiative auto-passes the taker for the rest of the round (§v7 6.1.5b). The active-player advance in `advanceToNextTurn` skips any player flagged `hasTakenCounterThisRound`. Both players passing consecutively (`consecutivePasses >= playerOrder.length`) ends the action phase.
- **No leader/upgrade/event routing** in `applyPlayCard` — throws explicit error for non-unit specs. Forces Week 2 to extend deliberately rather than letting silent fall-through bugs accumulate.

**New tooling**

- `tsx` added as devDep so TS files can run via `node` without a build step.
- `npm run play-demo` exercises a full game end-to-end (seeded, deterministic).
- `npm run type-check` runs `tsc --noEmit`.

**Demo verification**

Game converges in 6 rounds with deterministic seeded RNG (seed 42). Round 1 plays cheap units, rounds 2–6 attack into base. Bob wins; Alice's base hits 0 HP; `GAME_ENDED` event fires; state-based loop correctly marks the winner. Action log shows the full turn-by-turn play. `tsc --noEmit` exits clean across the entire frontend (v1 + v2 + UI all compile).

**Known gaps — intentional, per design Week 2+ scope**

- No abilities (all specs are `abilities: []`)
- No leaders, upgrades, events, or tokens
- No keyword definitions (Shield is a hard-coded shortcut)
- No modifier aggregation (effective stats = printed stats)
- No spec validator, no LLM cascade

**Files added**

```
frontend/src/lib/engine-v2/
  index.ts
  actions.ts
  reducer.ts
  init.ts
  util/uuid.ts
  state/{types,bus,zones}.ts
  spec/{types,loader}.ts
  primitives/{state,move,card_flow,combat,meta}.ts
  runtime/{modifiers,state_based}.ts
  scripts/play_demo.ts
  __fixtures__/index.ts
  __fixtures__/cards/{W1_001..010,B_001,B_002}.json
```

`frontend/package.json` — added `tsx` devDep and `play-demo` / `type-check` scripts.

---

### 2026-05-25: Engine v2 design — v7 rules deltas folded in (session 34)

**Change**

v7 PDF dropped locally (CloudFront blocked direct fetch). Full v7 vocabulary now drives [ENGINE_DESIGN.md](ENGINE_DESIGN.md). Net diff captured in the doc's new §16:

- **3 new keywords**: Piloting [Y], Hidden, Plot. Ambush/Shielded trigger windows widened to include "When Deployed" and "When Created".
- **10 new primitives**: `indirect_damage`, `damage_divided`, `prevent_damage`, `move_arena`, `rescue`, `create_force_token`, `use_force`, `disclose`, `take_counter`, `if_you_do`, `replace`, plus the `force.*` namespace.
- **Replacement effects** (§v7 7.7.5 Instead/Would) are now first-class in the modifier grammar. Shield token is modeled as a token upgrade carrying a `replace` clause rather than a hard-coded engine behavior — same authoring path as every other card.
- **Event bus** gained `ARENA_MOVED`, `ATTACK_ENDED`, `RESCUED`, `TOKEN_CREATED`, `FORCE_TOKEN_CREATED`, `FORCE_USED`, `COUNTER_TAKEN`, `CARD_DISCLOSED`, `DAMAGE_PREVENTED`. `DEFEATED` now carries `lastKnown: CardSnapshot` per §v7 8.11.
- **State model**: `PlayerState` gains `forceToken`, `creditTokens`, `countersHeld`, `hasTakenCounterThisRound`. `PlayerId` widened from `'player1' | 'player2'` to open string to enable 3–4-player Twin Suns (§v7 12) without a state-model refactor.

**Open questions resolved (Christian, 2026-05-25)**

- *Token registry source*: pull from SWU API via script (`tools/authoring/build_token_registry.py`). Matches keyword-sync approach; hands-off.
- *Leader two-sidedness*: two ability lists per leader spec (`leader_abilities`, `leader_unit_abilities`); third optional list `leader_upgrade_abilities` for the rare §v7 3.4.4A deploy-as-upgrade case (e.g. Hera "We've Lost Enough").
- *Choice UI*: inline prompt text + highlight valid objects in zones + pass button when effect uses "may". Engine surfaces `pendingChoice` with `kind, prompt, options?, validTargets?, canPass`.
- *Set-cadence keyword refresh*: automated script (`tools/authoring/sync_keywords.py`) diffs SWU API keyword list against engine enum; new keywords land in `pending_review/` for human approval. Never auto-adds — prevents silent semantic drift.

**New open question**

Twin Suns multiplayer (2–4 players per §v7 12.1) vs 2-player-only v2. State model is already string-keyed `PlayerId` so 3–4-player generalization is mechanical. Recommendation: ship v2 at 2-player parity with v1, generalize in v2.1. Awaiting Christian's call.

**No code in this session.** Awaiting sign-off on ENGINE_DESIGN.md §15 checklist before Week 1 begins.

---

### 2026-05-24: Engine v2 design contract — `ENGINE_DESIGN.md` (session 33)

**Decision**

v1's per-card / per-effect-category registry (`abilities.ts`) has well-understood limits: every novel mechanic requires both engine code AND parser patterns, and the Category C list in `abilities.ts:64-107` is growing. Rather than continue extending the registry, the next iteration moves cards out of code entirely.

The design contract is captured in [ENGINE_DESIGN.md](ENGINE_DESIGN.md). Four layers:

- **L1** Game state + event bus (bounded by the rulebook)
- **L2** ~40-primitive AST interpreter, namespaced (`card_flow.*`, `combat.*`, `state.*`, `move.*`, `tokens.*`, `resource.*`, `choice.*`, `meta.*`) — grows only when a genuinely novel mechanic appears
- **L3** Cards as declarative JSON specs (data, not code)
- **L4** Authoring cascade: deterministic template matcher → local 8B model with GBNF grammar-constrained sampling (Mac mini, Qwen 2.5 7B-Instruct recommended) → Claude (opt-in for hard cases) → human review queue

**Why this synthesis**

- **Datalog-style production rules** for triggers (each triggered ability is `on: event + where: predicate + do: effect`)
- **Algebraic effects + handlers** for action verbs (adding a primitive does not modify existing ones — the Pelta/Sanctioner's/Ki-Adi-Mundi cards from v1's Category C all collapse to data given three new handlers)
- **ECS-style modifier layer** for continuous effects (effective stats derived live, generalizing v1's `keywords.ts:computePower` pattern)
- **Controlled vocabulary** at the schema level so the LLM cannot invent primitives — the GBNF grammar enforces the closed enum at the token level during sampling

**Alternatives considered**

- *Single LLM call per card (Claude only).* Rejected: ongoing token cost, ignores the user's homelab inference goal, no determinism.
- *Pure deterministic grammar (no LLM).* Rejected: the existing parser already shows the limits of regex templates for novel phrasings; the LLM tier exists precisely for the long tail.
- *Magic-style stack with priority/interrupts.* Rejected: SWU has no instants; the action protocol is fixed at 5 steps.
- *Lua transpile for Tabletop Simulator (the Steam app).* Out of scope — the "tabletop sim" in this project is the web app at `frontend/src/app/game/`.

**Constraints honored**

- v1 stays running; v2 lives at `frontend/src/lib/engine-v2/` with a clean boundary (no React imports). Greenfield rewrite. v1 retired only after parity.
- JSON-only spec format (LLMs produce JSON more reliably than YAML; JSON Schema is the mature validator standard).
- Local-first inference (homelab goal #4); Claude is opt-in.

**v3-baseline keyword surface**

v7 PDF blocked by CloudFront (403). Structural design is version-stable; only the keyword enum differs. v3 keywords locked: Ambush, Grit, Overwhelm, Raid X, Restore X, Saboteur, Sentinel, Shielded, Bounty (em-dash), Smuggle Y, Coordinate (em-dash), Exploit X. v7 additions extend the enum and add one keyword file each — no architecture change.

**No code in this session.** Awaiting sign-off on ENGINE_DESIGN.md §15 checklist before Week 1 work begins.

---

### 2026-05-24: Layout fixes — opponent resources repositioned, card preview aspect ratio (session 32)

**Opponent resources row order (`TopOppMat.tsx`)**

Resources zone was at `gridRow: 4` (below arenas, closest to the divider bar), which compressed the arena row and pushed the second leader card out of view. Fixed by swapping rows: resources moved to `gridRow: 3` (between hand and arenas), arenas moved to `gridRow: 4`. `gridTemplateRows` updated from `'auto auto minmax(120px, 1fr) auto'` → `'auto auto auto minmax(120px, 1fr)'` so arenas continue to get all available flexible height. Now mirrors `YourMat`'s layout where resources sit between arenas and hand.

**Card preview aspect ratio (`CardPreview.tsx`)**

`objectFit: 'fill'` stretched images to fill a fixed 240×335 portrait container regardless of the image's native ratio. Base cards are landscape (~140×86), so their hover popouts were severely squished. Fix: removed the fixed `height` from the container and changed the `<img>` to `width: 100%; height: auto`. The container now sizes to the image's natural ratio — portrait cards render at ~240×335, landscape base cards at ~240×148, with no distortion. The fallback (no-image) div retains an explicit `PREVIEW_MAX_H` height. Vertical position clamping uses `PREVIEW_MAX_H = 340` as an estimate (slightly overestimates for base cards, but keeps them on screen).

---

### 2026-05-24: Full leader ability expansion — 47 leaders, attack-type ability machine (session 32)

**ID-keyed leader registry (`abilities.ts`)**

`LEADER_ABILITIES` was keyed by card name (e.g. `'Chirrut Îmwe'`). Multiple leaders share names across sets — Ahsoka Tano has 3 entries (sets 1, 4, 5), Boba Fett has 4, Anakin Skywalker has 3, etc. Name-keying meant only the last entry in the registry was reachable, and the engine `getLegalActions` / `applyLeaderAbility` were both calling `LEADER_ABILITIES[leader.card.name]` which silently returned `undefined` for any leader not in the registry. Fix: registry changed to ID-keyed (card ID is stable per DB build), with a comment noting it. Both lookup sites in `engine.ts` updated.

**New `LEADER_ATTACK_ABILITY` action type (`actions.ts`, `engine.ts`)**

Leaders with "Attack with a unit. It gets +N/+N for this attack." ability text require a distinct action type because they need three arguments (leaderCardId, attackerIid, defenderIid), go through a different state machine in the UI, and cannot be routed through `applyAbilityEffect` (which takes a single targetIid). Added `LEADER_ATTACK_ABILITY` to `GameAction`. Engine function `applyLeaderAttackAbility` mirrors `applyPlayAttackEvent`. LEADER_ATTACK_ABILITY actions reuse `filteredAttacks` so Sentinel and arena rules automatically apply. Dispatcher wired.

**`coordinateRequired?: boolean` on `LeaderAbility`**

Ahsoka Tano "Snips" (set 1, id `13980`) reads "Coordinate — Action [Exhaust]: Attack with a unit. It gets +1/+0." Her ability should only be legal when 3+ friendly units are in play. New flag on `LeaderAbility`; `getLegalActions` checks `isCoordinateActive(state, playerId)` (imported from `keywords.ts`) before generating actions for flagged leaders.

**New `HEAL_UNIT` effect type**

Three leaders (Obi-Wan Kenobi "Patient Mentor", Leia "Get to Your Transports!", Satine Kryze) heal damage from a unit rather than a base. Added `{ type: 'HEAL_UNIT'; amount: number }` to `AbilityEffect`, wired `case 'HEAL_UNIT'` in `applyAbilityEffect` using `mapCardInArenas` + `Math.max(0, c.damage - amount)`.

**UI state machine for leader attack abilities (`GameBoard.tsx`, `YourMat.tsx`)**

New state: `pendingLeaderAttackAbilityId`. New memos: `legalLeaderAttackAbilityIds` (set of leaders with LEADER_ATTACK_ABILITY actions), `leaderAttackAbilityAttackerIids` (step 1: valid attackers), `leaderAttackAbilityTargetIids` (step 2: valid defenders), `canLeaderAttackAbilityTargetBase`. `handleLeaderAbility` detects attack-type by checking legalActions before entering standard or attack mode. `handleMyUnitClick` / `handleOppUnitClick` / `handleAttackBase` all check for `pendingLeaderAttackAbilityId` first. `clearPending` clears all pending states including the new one. `YourMat` shows the ABILITY button for both `LEADER_ABILITY` and `LEADER_ATTACK_ABILITY` leaders; CANCEL state covers both.

**Disclaimer banner (`GameBoard.tsx`)**

Small amber badge in the top chrome rail: "⚠ Simulator β — card effects approximate, some unimplemented". Addresses user request for an explicit under-construction notice. Opacity 0.75 so it's visible but not distracting.

---

### 2026-05-24: Upgrade targeting UI — two-step attach flow (session 31)

**Upgrade targeting state machine (`GameBoard.tsx`, `YourMat.tsx`)**

Upgrades (type = "upgrade") were falling through to arena placement in `applyPlayCard` because `handleHandCardClick` dispatched `{ type: 'PLAY_CARD', iid }` without a `targetIid`. The engine's `type === 'upgrade' && targetIid` path (which attaches the card to a unit) was never reached — the card went to the else branch which placed it as a unit in the arena. Bug: Protector ended up in the ground arena rather than attached to a unit.

Fix: mirrored the existing event/dual-target state machine pattern. New state: `pendingUpgradeIid`. New memos:
- `canPlayUpgradeIids` — hand cards whose `type === 'upgrade'` and are in `canPlayIids` (affordable, correct phase). Derived from `p1.hand` + `canPlayIids`.
- `upgradeTargetIids` — friendly unit iids from `PLAY_CARD` actions where `iid === pendingUpgradeIid && targetIid !== undefined`. Engine already generates one action per friendly unit for each affordable upgrade — so this set is exactly the valid attachment targets.

Flow: click upgrade card → `handleHandCardClick` sets `pendingUpgradeIid`, clears all other pending states, sets selectedIid null → `friendlyTargetIids` now returns `upgradeTargetIids` → friendly units highlight as targets → click a friendly unit → `handleMyUnitClick` dispatches `PLAY_CARD { iid: pendingUpgradeIid, targetIid: iid }` → engine attaches upgrade → `setPendingUpgradeIid(null)`. Tap the upgrade card again to cancel.

`YourMat` changes: added `canPlayUpgradeIids` + `pendingUpgradeIid` props; upgrade cards in hand render as clickable and show `selected` glow when pending; hand banner now includes the "▸ Select a unit to attach the upgrade — click the card again to cancel" state.

Chose to NOT add a separate upgrade-targeting ring/highlight (distinct from the existing `target` ring on ability targets) — the `target` ring already signals "click this unit" which is correct for upgrades. No additional CSS needed.

**Ambush timing gap (known, not fixed this session)**

Ambush is implemented by setting the unit's `exhausted: false` when it enters play (`ambushHandler` in `keywords.ts`). The unit is then available to attack on the player's *next* turn. SWU rules grant an *interrupt* attack — the player attacks with the Ambush unit before the opponent gets their next action. Implementing this correctly would require holding `activePlayer` after playing the unit and running a short "you may attack with this unit now" loop before calling `switchActivePlayer`. This is non-trivial and deferred. The current behavior (unit attacks on next turn) is a conservative approximation — the player gets the benefit, just one action-order later.

---

### 2026-05-24: UAT bug fixes — 6 of 7 issues resolved (session 30)

**Root cause: React Strict Mode engine/state desync (`useGame.ts`)**

The single most impactful bug: `engineRef.current = engine` was set *inside* the `useState` lazy initializer. React Strict Mode (development) invokes the initializer twice to detect impure functions — the second invocation created a new `GameEngine` (different random shuffle) and overwrote `engineRef.current`, while `state` stayed from the *first* invocation. The result: every card in the UI had iids from engine1's shuffle, but player actions were dispatched to engine2, so the wrong card was always targeted. This caused:
- Wrong card resourced during setup (Bug #2)
- Reckless Torrent in ground arena instead of space (Bug #5A) — iid `i5` in engine1 was a space unit; in engine2 it was a ground unit
- Coordinate dual-damage effect not triggering (Bug #5B)
- Sentinel bypass (Bug #6) — attack filter ran against the engine2 board state, not what was displayed
- Player couldn't deploy leader (Bug #7, deploy portion) — `legalActions` were engine2's, which had different resource counts

Fix: engine and AI are initialized in the render body with a null-check before `useState`. Refs persist across Strict Mode's double-render, so the null-check is idempotent — the engine is only ever created once and both the ref and the state initializer see the same object.

**Draw/resource order (`engine.ts`)**

`resolveRegroup()` was drawing 2 cards for each player after the resource phase completed. SWU rules: draw at the *start* of regroup, then resource. Fix: draw loop moved to `applyTakeCounter` when both players have countered and the game enters regroup. `resolveRegroup` now only readies units, refreshes available resources, and advances the round counter. Players see their newly drawn cards before making the resource selection.

**Deployed leader stats (`engine.ts`)**

`swu_cards.db` stores leader cards with `attack: null, health: null` — the API client (`swu_api_client.py`) explicitly skips attack/health for the "Leader" card type because that data lives on the back/unit side, which the API client doesn't currently fetch. The engine's `effectiveHealth` defaulted null health to 1, giving deployed leaders 0/1 stats (nearly useless). Fix: `LEADER_DEPLOYED_STATS` map added to `engine.ts` keyed by card ID, with known stats for the three Ahsoka Tano variants tested in play. `applyDeployLeader` uses the map when attack/health are null; unknown leaders fall back to 3/6. Long-term fix is a `build_database.py` update to also fetch and store leader unit deployed stats from the SWU API.

**CardPreview redesign (`CardPreview.tsx`)**

Previous design: 260×400 container with a 170px art crop (top half, objectPosition: top) + full text panel (name, subtitle, type, card text, keyword list, stats footer). Issues: (1) cost badge overlaid on the card art covered the printed cost number, (2) aspect pips were colored by CSS variable but the variable didn't always match the actual aspect color, (3) the text panel was less useful than seeing the actual card. New design: full card image at standard SWU aspect ratio (240×335, 63:88 ratio) with no overlays. No cost badge, no separate stat footer — everything visible on the card image itself. Fallback shows name/subtitle/stats when no `image_uri` is available.

**DividerBar — last log entry replaces resource readout (`DividerBar.tsx`, `play.css`)**

Resource counts (`X/Y res`) removed from the divider bar right section. Resources are already shown in the player mat's resource zone. The freed space now shows the most recent action log message in a truncated mono label — useful during AI turns or after complex sequences to see what just happened without opening the log drawer. `resources` prop removed from `DividerBarProps` and the `GameBoard.tsx` call site.

**Data gap — leader deployed stats**

`swu_cards.db` is built by `build_database.py` → `swu_api_client.py`. The client fetches cards from the SWU `card-list` endpoint, filters variants (`variantOf[$null]=true`), and processes by type. For type "Leader", it stores `epic_action`, `deploy_box`, and `energy_cost` — not `attack`/`health`, since those aren't on the leader side. The deployed unit stats are either on a separate API field not currently fetched, or on a separate "Leader Unit" type card that `variantOf[$null]=true` filters out. Until the API client is updated, the `LEADER_DEPLOYED_STATS` map in `engine.ts` is the maintainable interim solution. Entries must be added manually when new leaders are tested.

---

### 2026-05-23: AI heuristic overhaul + event registry expansion (session 29)

**AI scoring system (`ai.ts` rewrite)**

The previous AI used a 5-branch priority chain: always deploy → play highest-cost unit → attack base safely → kill shot → take counter. Several correctness issues:
1. **Kill-shot detection** used raw `card.attack` instead of `computePower()`, so a Grit unit, Coordinate-buffed unit, or aura-buffed unit (Cody +1/+1) would never be correctly evaluated as a threat or as a kill-shot attacker.
2. **Leader abilities** had no branch — the AI would never choose `LEADER_ABILITY` actions.
3. **Events were never played** — the only `PLAY_CARD` path played units only.
4. **Base attack was excessively conservative** — only attacked base if the attacker had zero damage, regardless of whether a kill was close.
5. **Trade quality** — unit attacks only attempted kill shots; the AI would never make a neutral trade (both units die) even when their unit was more valuable.

New approach: `scoreAction()` evaluates every legal action and returns the highest scorer. Score ranges:
- `200` — wins the game (base kill, lethal base attack)
- `100+` — favorable trade (kill their unit, ours survives; higher for more valuable defenders)
- `55–80` — deploy, defeat-event, attack-event kill, leader ability
- `20–55` — play unit (stats-per-cost + keyword bonuses), play non-kill event
- `5–20` — chip base attack (scales by proximity to lethal)
- `0` — take counter
- `-40` — bad trade (we die, they don't)

**Why score-based vs. priority chain:** Priorities are brittle when two actions are in similar tiers (e.g., "should I play a unit or attack base?"). A scoring approach allows fine-grained tuning of each case without touching unrelated branches. It also makes it natural to add new action types (leader ability, PLAY_ATTACK_EVENT) without retrofitting a new priority level.

**Resource selection (`useGame.ts`):** AI now picks the lowest-cost card to resource during regroup (previously random). Rationale: high-cost cards are the ones you most want to play later; low-cost cards (cost 0–1) are often best candidates for the resource zone. This makes the AI's resource curve more consistent and preserves its best plays.

**Event registry expansion (`abilities.ts`)**

Added ~30 new entries to `EVENT_EFFECTS`. The existing parser handles simple single-clause events (anchored regex), but fails on:
- Multi-clause events (any event with more than one sentence — parser `^...$` anchors break)
- Type-restricted events ("Vehicle unit", "REBEL unit", "Droid or Vehicle unit", "Force unit") — parser only handles unqualified "unit"
- Conditional events ("If you control a Force unit…") — parser skips optionality entirely

New registry entries by category:

**Draw/tutor** — `I Want Proof Not Leads` (draw 2, discard 1 → approx DRAW 2), `I've Found Them` (reveal 3, draw unit → DRAW 1), `Arms Deal` (each player draws 2 → DRAW 2), `Do or Do Not` (draw 2 with Force or 1 → DRAW 2), `Recruit` (search top 5 for unit → DRAW 1), `Commission` (search top 10 → DRAW 1), `Bounty Posting` (search for Bounty upgrade → DRAW 1).

**Damage** — `That's a Rock` (1 to unit; second clause breaks parser), `Grenade Strike` (2 + optional 1 more), `Drain Essence` (2 + Force token), `Contempt for Culture` (2 to non-Vehicle), `Air Superiority` (4 to ground, conditional), `Force Choke` (5, conditional cost reduction), `Electromagnetic Pulse` (2 to Droid/Vehicle + exhaust), `Fight Fire With Fire` (3 to a friendly + 3 to an enemy; modeled as 3 to enemy).

**Attack-boost** — 16 entries including Outflank (+0/+0, approximates one of two attacks), Punch It (+2/+0 Vehicle), Desperate Attack (+2/+0 damaged), Flash the Vents (+2/+0 Overwhelm), One Way Out (+1/+0 Overwhelm), Breaking In (+2/+0 Saboteur), Improvised Detonation (+2/+0), and others. Multi-attack events (Outflank, Attack Run, Rebel Assault, Tandem Assault) are approximated as a single `TRIGGER_ATTACK_WITH` — the player gets one boosted attack instead of two unbooosted ones. This is a simplification that keeps the engine from requiring a new "multi-attack" action type.

**Debuffs** — `Incapacitate` (–2/–2), `Mystic Reflection` (–2/–0 base case).

**Heals** — `Smuggler's Aid` (heal base 3; Smuggle text on second line blocks parser), `Repair` (heal 3 from unit or base; "or base" pattern not parseable, approximated as HEAL_BASE).

All approximations are noted inline. Exact behavior of conditional or secondary clauses is ignored in the simulator — the primary effect resolves, which is correct for most board states.

---

### 2026-05-23: Coordinate stat display fix, resource pile tracking, resource hover, setup UX

**Coordinate stat display fix (Echo 2/2 → 4/4)**

The engine correctly computed Coordinate STAT_BUFF and AURA_BUFF_OTHERS bonuses, but they never reached the card display. `toPlayCardProps(ci)` reads `card.attack` / `card.health` directly off the `Card` object — it has no `GameState` access. The display was always showing base stats regardless of active buffs. Same bug applied to Clone Commander Cody's +1/+1 aura to all other friendlies.

Fix: compute effective stats where `GameState` is available (`GameBoard.tsx`) and pass them down to the display layer. Two `useMemo` blocks — one for each player — iterate each player's arena units, call `computePower(state, ci, ownerId)` and `effectiveHealth(state, ci, ownerId)`, and accumulate a `Map<iid, { power, hp }>`. The map is passed as a new optional prop `unitEffectiveStats` to `YourMat` and `TopOppMat`. Each mat has an `applyEffectiveStats()` helper that merges the override into the `PlayCardData` props before rendering. If no override exists for an iid (e.g. a card without Coordinate effects), the raw stats fall through unchanged.

Why this approach instead of threading `GameState` directly: the display components are pure React with no engine dependency. Adding a `GameState` import would couple them tightly to the engine and make testing harder. The precomputed Map is a clean boundary — display layer stays dumb, orchestration layer stays authoritative.

---

**Resource pile tracking and hover**

Previously `PlayerState.resources` was `{ total: number; available: number }` — a count only. Card identity was lost the moment a card was resourced. There was no way for the UI to tell players what any given resource pip contained.

New approach: `resourcePile: CardInstance[]` appended to `PlayerState`. Each call to `applyResourceCard` captures the `CardInstance` before removing it from hand and pushes it into `resourcePile`. The pile is append-only and never shrinks — it's purely additive so pip index `i` always corresponds to `resourcePile[i]`.

`ResourceLattice` in `BoardParts.tsx` now looks up the corresponding `CardInstance` for each pip. When found, `toResourceHoverData(ci)` converts it to a `PlayCardData` shape and wires `onMouseEnter`/`onMouseMove`/`onMouseLeave` events that call `emitHoverCard()`. This reuses the same event bus already used by the `PlayCard` hover preview system — no new plumbing, no new state. The `CardPreview` overlay fires with the full card face on hover.

Why `CardInstance` instead of just `Card`: `CardInstance` carries `iid`, `damage`, and other runtime fields. Storing it also keeps the door open for future display of face-down resource status, damage, etc.

---

**"Wrong card resourced" investigation and defensive guard**

A bug was reported: player selected Luminara as a resource during setup, but the resource log and pile showed Anakin Skywalker. After a full code review, no engine-level bug was found — the iid system is sound (player 1 cards get iids `i0`–`i49`, player 2 gets `i50`–`i99`, no collision possible), `findCard` searches the hand by iid correctly, and there is no async race in the single-threaded reducer.

Most probable explanations: (a) "Anakin Skywalker" the unit card (distinct from the Anakin leader) is in the Coordinate deck — it is confirmed in the `CARD_ABILITIES` registry as a Coordinate card. The setup hand shows `md`-size cards (≈83×116px) where names can be hard to read. The player may have clicked the wrong card. (b) Leader or base card ID leaking into `deck.cards` from the backend deck response would cause the wrong card to appear in hand. The backend `get_user_deck` correctly separates leaders, but this was an unverified assumption.

Three UX fixes to prevent future ambiguity:
1. **Setup cards enlarged to `lg` (110×154px)** — card names become clearly readable, reducing misclick risk.
2. **Hover-selection glow** — `resourceHoveredIid` state added to `YourMat`. Hovering a card during setup or regroup applies the amber `is-selected` border, confirming which card will be resourced before the click commits.
3. **Defensive filter in `deckToPlayerConfig`** — builds `excludedIds` from leader card IDs and base card ID. Any `deck.cards` entry matching an excluded ID is skipped with `console.warn` naming the card. This is a last-resort safety net with a clear diagnostic, not the primary fix — if a leader leaks into deck.cards this would have caught it and logged it.

---

### 2026-05-22: Deck builder — search query leaks across stages

**Symptom.** Switching from leaders to bases (or any stage transition) shows an empty bases list. Backend returns the 59 expected bases; the frontend just doesn't display them.

**Root cause.** The search input at the top of the deck builder was uncontrolled, and `searchQuery` state was never reset between stages. If you typed `"Anakin"` on the leaders stage to find a leader, then clicked Next: Base, the same query was sent as `?type=Base&search=Anakin` to the backend — which legitimately returns 0 results because no base card has any leader's name in its title. The visible input still showed the leftover text but most users wouldn't think to clear it because the search box looks like it belongs to whatever stage they're currently on.

**Fix** (`DeckBuilderClient.tsx`):
1. Added a controlled local `searchInput` state alongside the existing `searchQuery`. The input now has `value={searchInput}` so its DOM value tracks state, and `onChange` updates both `searchInput` (instant, controlled) and via debounce `searchQuery` (drives the API). Keeps the existing 300ms debounce behavior intact.
2. Added a `useEffect` keyed on `currentStage` that calls `debouncedSearch.cancel()` (flushes any pending debounced setter that would otherwise re-set after we clear) and resets both `searchInput` and `searchQuery` to `''`. Runs on every stage transition, including the initial mount (where it's a no-op since both are already empty).

**Why this wasn't caught before.** Three-stage deck building has been live for many sessions; the leak only manifests when a user actually types in the search box during one stage and then advances. Casual testing of "click Leader → click Base → click Build Deck" without typing never triggers it.

**TypeScript: 0 errors.** No new dependencies.

---

### 2026-05-22: CSP regression — card images blocked (session 25 fallout)

**Symptom.** Card images stopped loading in the deck builder (and everywhere else card art is shown — the cards browser, profile collection, deck view, game board). Discovered while building a Coordinate deck.

**Root cause.** The CSP `img-src` directive added in session 25 (2026-05-21) listed only `cdn.jsdelivr.net` as an allowed image source. Actual SWU card art is served from `cdn.starwarsunlimited.com` (verified by querying every distinct hostname in `image_uri` and `image_back_uri` in `swu_cards.db` — only one CDN appears, and it's not jsdelivr). The browser silently blocks every card image as a CSP violation. The original comment claimed jsdelivr was the SWU card source, which was wrong — that's an old JimJafar fork mirror that the current build doesn't use.

**Fix.** Added `https://cdn.starwarsunlimited.com` to:
1. CSP `img-src` in `frontend/next.config.ts`
2. `images.domains` and `images.remotePatterns` in the same file (so any future `<Image>` usage works without re-tripping over this)

Kept `cdn.jsdelivr.net` in both for safety in case any legacy URL still references the JimJafar mirror, but it's not needed by anything in the current DB. Updated the surrounding comments to name both CDNs explicitly and explain the role of each.

**Why this wasn't caught.** Session 25 didn't include a browser play-test of the card grid — TypeScript was the only check. CSP violations don't surface in `tsc`. Lesson: any change to `next.config.ts` security headers needs a browser smoke test of the cards page before being called done.

**Restart required.** Next.js config changes (including `headers()`) are read at server start, not hot-reloaded. After pulling this fix, `./dev.sh` (or whatever runs `npm run dev`) must be restarted for the new CSP to take effect.

---

### 2026-05-22: Coordinate keyword — Category B parser + engine, Category C plan

**Goal.** Stop hard-coding every Coordinate card. Switch the primary path to a text parser that maps SWU's natural phrasings to typed effects; the manual `CARD_ABILITIES` registry stays as a fallback/override. Same registry-first / parser-fallback contract already used for events. As the card pool grows, new cards using known phrasings cost zero registry entries.

**Five new `CoordinateEffect` variants (Category B)** added to `abilities.ts`:
- `ON_ATTACK_DEAL_DAMAGE_TARGET` — Kit Fisto: "You may deal 3 damage to a ground unit." Optional ("You may"). UI emits a `coordDamageTarget` per legal enemy plus an undefined slot for declining.
- `ON_ATTACK_DEBUFF_DEFENDER` — Clone Dive Trooper: "the defender gets –2/–0." No target picking; reduces defender strikeback power inside `applyAttack`.
- `ON_ATTACK_DEBUFF_TARGET` — Padmé Amidala (Pursuing Peace): "Give an enemy unit –3/–0 for this phase." Mandatory if any enemy exists. Reuses existing `phaseAtk`/`phaseHp` mechanism so `resolveRegroup` clears it for free.
- `WHEN_PLAYED_DAMAGE_DUAL` — Reckless Torrent: "You may deal 2 damage to a friendly unit and 2 damage to an enemy unit in the same arena." Optional. Engine resolves it AFTER `addToArena` + `dispatchOnPlay` so the new unit counts toward the Coordinate threshold (Reckless Torrent's "including this one").
- `AURA_BUFF_OTHERS` — Clone Commander Cody: "Each other friendly unit gets +1/+1 and gains Overwhelm." Continuous, no state mutation. New `getIncomingAuras(state, target, ownerId)` helper in `keywords.ts` scans friendlies for aura sources (excluding the target itself, hence "OTHER friendly"). Wired into `computePower`, `effectiveHealth`, and `hasEffectiveKeyword` so the aura is visible to every stat read.

**Parser** — `parseCoordinateText(text)` in `abilities.ts`. Splits on newlines to find the `Coordinate — ...` line (handles em-dash, en-dash, or hyphen). Strips the trailing `(Gain this ability ...)` reminder text. Pattern-matches the body against the regex set covering the five new effect types AND the four pre-existing ones (STAT_BUFF, KEYWORD grant, ON_ATTACK_DRAW, ON_ATTACK_PREVENT_DAMAGE). Every currently-registered Coordinate card's text also matches the parser, which means the manual registry is redundant for them and only retained as a safety net. New `getCoordinateAbilities(card)` is the single entry point — registry first (manual override), parser second.

**Why parser over more registry entries.** Registry entries are O(cards) maintenance; the parser is O(distinct phrasings). SWU uses a fairly narrow template language for Coordinate clauses, so a few patterns cover many cards. New cards with the same templates become free. Cards with genuinely novel mechanics still go into `CARD_ABILITIES` as overrides, but the bar for "do we add to the registry?" is now "is the parser wrong?" instead of "is this card unimplemented?"

**Action shape changes.** `ATTACK` gains `coordDamageTarget?` and `coordDebuffTarget?`. `PLAY_CARD` gains `targetIids?: string[]` (legacy `targetIid` kept for single-target compatibility). `getLegalActions` enumerates the combinations: per-attacker × per-defender × per-(damage target | undefined for "You may decline") × per-debuff target. Per-card the combination is small. Reckless Torrent enumerates (friendly × enemy) under the same-arena constraint, plus the no-target decline.

**`applyAttack` changes.** New locals: `defenderCombatAtkMod` accumulates ON_ATTACK_DEBUFF_DEFENDER contributions and is subtracted from defender's strikeback power (clamped at 0). The `coordDamageTarget` and `coordDebuffTarget` parameters apply their effects before main combat damage. Defender debuff lives on `phaseAtk`/`phaseHp` of the chosen unit, so existing regroup cleanup wipes it without engine plumbing.

**`applyPlayCard` changes.** After `addToArena` + `dispatchOnPlay`, if the just-played unit has an active `WHEN_PLAYED_DAMAGE_DUAL` Coordinate effect (Coordinate threshold is met post-entry) and the action carried `targetIids` with 2+ entries, deal damage to `targetIids[0]` (friendly) and `targetIids[1]` (enemy). Defeat check runs after.

**UI in `GameBoard.tsx`.** Three new state machines, each mirroring the event-targeting pattern that already exists:
- Coord-on-attack target picking: `coordChoiceMade` + `chosenCoordTargetIid`. Attacker click → coord targets highlighted; pick enemy → defenders highlighted; pick defender → dispatch. For optional effects (Kit Fisto), clicking the attacker again skips. For mandatory (Padmé), it cancels.
- Dual-target play: `pendingDualPlayIid` + `pendingDualFriendlyIid`. Card click → friendly highlighted; pick friendly → enemies highlighted (filtered by `sameArena`); pick enemy → dispatch. Re-clicking the card before picking a friendly plays it WITHOUT the effect (in-place decline). Clicking after a friendly is chosen reverts to step 1.
- `attackMatchesCoord` predicate funnels the chosen coord state into action selection so the right legal action (with the right coord target attached) ends up dispatched. `coordTargetingPhase` derived from `coordTargetIids.size > 0 && !coordChoiceMade`, which controls whether defenders or coord targets are highlighted.

`YourMat.tsx` gets three new props (`canPlayDualIids`, `pendingDualPlayIid`, `pendingDualFriendlyIid`), updates the hand banner with two new states, and treats dual-play cards as clickable + selected during the flow.

**Category C — plan only, not implemented.** Five cards remain blocked, each on a missing engine subsystem (NOT a missing parser pattern). The full architectural notes live in the doc comment at the top of `abilities.ts` so the next person to attempt these has the full picture:
- Pelta Supply Frigate → token system (CardInstance.isToken flag, TokenDefinition registry, defeat path that removes tokens entirely)
- Sanctioner's Shuttle → capture zone on PlayerState with provenance, defeat hook that releases captives
- Ki-Adi-Mundi → triggered-ability dispatch (engine event bus, per-phase counters, TriggeredAbility type)
- Ahsoka Tano (Leader) / Padmé (Serving the Republic) → leader actions with attack triggers / deck search UI
- For The Republic → upgrades as aura sources (extend `getIncomingAuras` to scan `inst.upgrades`)

Once any of these land, the parser is the place to add the matching text pattern — same contract, new effect category.

**Known limitations.** A card with BOTH `ON_ATTACK_DEAL_DAMAGE_TARGET` and `ON_ATTACK_DEBUFF_TARGET` would only be partially controllable from the UI (user picks one slot's target; the other gets the first-enumerated legal value). No current card has both effects. PLAY_ATTACK_EVENT (attack-events like "Shoot First") does not carry coord targets, so a Kit Fisto attacking via an attack event would not get its optional damage choice. Both are corner cases worth tracking but not worth additional plumbing now.

**TypeScript: 0 errors after all changes.** No new dependencies. The browser oracle still needs a play-test run.

---

### 2026-05-21: Production readiness hardening — infra items 28–32

**TLS cert renewed (item 28)** — Let's Encrypt cert for `twinsuns.chanfriendly.duckdns.org` manually renewed. Prior cert expired 2026-07-01. Confirm auto-renewal is enabled in NPM so future cycles don't require manual action.

**Backup chain verified (item 29)** — Confirmed via SSH to TrueNAS that `backup.sh` already includes the `twinsuns` Docker service in its loop. Data flows: `/mnt/volume1/docker/twinsuns/` → `/mnt/backup/docker/twinsuns/` daily, then `mirror.sh` syncs `/mnt/backup/` → Proxmox DAS weekly. No code changes needed.

**CSP baseline added (item 30)** — `Content-Security-Policy` header added to `frontend/next.config.ts`. Policy: `default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' https://cdn.jsdelivr.net data: blob:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'`. `unsafe-inline` is required by Next.js (inline script tags for hydration) and Tailwind (inline styles). Moving to a nonce-based policy that eliminates `unsafe-inline` would require shifting the header to NPM's custom Nginx config — noted in a code comment.

**Dependabot enabled (item 31)** — `.github/dependabot.yml` created covering pip (backend), npm (frontend), and github-actions. Weekly schedule on Mondays, 5-PR cap per ecosystem. PRs will auto-open for outdated or vulnerable dependencies.

**Structured JSON logging (item 32)** — `_JsonFormatter` and `_configure_logging()` added to `backend/src/api/main.py`. All log output from the backend is now `{"ts": ..., "level": ..., "logger": ..., "msg": ...}` — a single JSON object per line, compatible with Loki, ELK, or any container log driver. No new dependencies (stdlib `logging` + `json`). File-based logging deliberately omitted; add a `FileHandler` with a volume mount when/if a log aggregator is introduced.

---

### 2026-05-21: Production readiness hardening — auth, security headers, deploy

**`PATCH /api/me/password`** — New endpoint in `me.py`. Requires `current_password` (verified via bcrypt) + `new_password` (same validation rules as registration: 8–100 chars, at least one letter, one digit). On success, calls `revoke_user_tokens` to bump `token_version`, which invalidates all other active sessions — important so that a password change from a trusted device closes any stolen sessions. Frontend proxy at `PATCH /api/me/password/route.ts`. Profile page UI is not yet wired; that's a separate task (item 22 in checklist).

**`PATCH /api/me/email`** — New endpoint in `me.py`. Requires `current_password` as confirmation (prevents a stolen session from locking the real user out of their email). Validates format via regex, enforces uniqueness, sets `email_verified=False`, and sends a new verification email. Why require current_password for email change but not profile update: email is the recovery channel — if someone can silently reroute it they own the account. Frontend proxy at `PATCH /api/me/email/route.ts`. Profile page UI deferred (item 22).

**`avatar_url` validation** — `PATCH /api/me/profile` now rejects any `avatar_url` that doesn't start with `https://`. Previously any URL string was accepted. Without this, users could supply `http://` URLs that they control to beacon profile views (any browser rendering the avatar makes a request to that URL, leaking IP + timing). The fix is minimal: a string prefix check before committing.

**`me.py` new imports** — `verify_password`, `get_password_hash`, `revoke_user_tokens`, `create_email_verification_token` from `src.auth.auth`; `_send_verification_email` from `src.auth.routes`; `re` stdlib. The cross-module import from `auth.routes` is a minor coupling smell — if the email send helpers are ever needed in more places, move them to a shared `src/auth/email.py`. Not worth the refactor now.

**`typescript: { ignoreBuildErrors: true }` removed** — This flag was silently suppressing TypeScript errors during `next build`. `tsc --noEmit` confirms 0 errors, so the flag was a leftover from an earlier debugging session. Removed. Builds will now correctly fail on type errors.

**Security headers** — Added `Referrer-Policy: strict-origin-when-cross-origin` and `Permissions-Policy: camera=(), microphone=(), geolocation=()` to `next.config.ts`. The existing three headers (X-Content-Type-Options, X-Frame-Options, X-XSS-Protection) are unchanged. Still missing: HSTS (must be set in NPM, not Next.js — see PROGRESS item 27) and CSP (complex with Next.js inline scripts — see item 30).

**`deploy.sh` SHA tagging** — Each build now produces two Docker tags: `:latest` (for Portainer auto-pull) and `:<git-sha>` (for rollback). Previously only `:latest` was pushed, meaning a bad deploy had no rollback path. To roll back: `docker pull <image>:<sha>` on TrueNAS, retag as `:latest`, trigger Portainer redeploy. The SHA is derived from `git rev-parse --short HEAD` at deploy time.

**Fan-site disclaimer** — Added to homepage footer: "Fan-made tool. Not affiliated with or endorsed by Fantasy Flight Games, Asmodee, or Lucasfilm Ltd. Star Wars: Unlimited and all related properties are trademarks of Lucasfilm Ltd." Standard convention for fan/community tools built on IP-licensed games. Required the moment the URL is shared with anyone outside the household.

---

### 2026-05-19: Achievements system and Pilot Training

**Achievement catalog** — 14 auto-detected achievements across four categories (Deck Building, Collection, Social, Pilot Training). Definitions are hardcoded Python dicts in `backend/src/routes/achievements.py` — no DB table for definitions, which keeps them easy to add or adjust without migrations. Earned state is stored in `user_achievements` with an `earned_at` timestamp.

**Lazy evaluation model** — `GET /api/me/achievements` computes all conditions fresh from existing data (deck count, collection count, wishlist count, shared decks, all-aspects check) on every call. Newly earned achievements are inserted with `INSERT OR IGNORE` so the endpoint is idempotent. This means `earned_at` reflects when the user first fetched achievements after meeting a condition, not the exact moment they triggered it — acceptable for this scale.

**`all_aspects` condition** — queries `deck_cards` in `app_db` to get all card IDs across the user's decks, then queries `card_aspects` in `card_db` to check if all 6 aspects (Heroism, Villainy, Command, Aggression, Cunning, Vigilance) are covered. Heroism/Villainy only appear on leaders, so this requires having at least one Heroism deck and one Villainy deck in the user's collection. The cross-database query uses parameterized IN clauses since SQLite can't join across attached databases.

**Rank gates (cumulative)** — K1 = `first_deck`; K2 = K1 + `three_decks`; K3 = K2 + `all_aspects`; K4 = K3 + `ten_decks`. The `rank` field in the response returns the highest earned rank key (`K4 > K3 > K2 > K1 > null`).

**Karabast stub** — `source TEXT` column on `user_achievements` is the extension point. A future `POST /api/me/achievements/external` route can insert rows with `source='karabast'`. No schema change required. The column is nullable; all in-app earned rows get `source=NULL`.

**Pilot Training lesson content** — static strings embedded in `profile/page.tsx` as `RANK_LESSONS`. Each K1–K4 rank row in the profile Achievements tab is expandable (toggle open/close). Content covers: K1 Twin Suns rules and deck structure; K2 resources, aspect penalties, mulligan decisions, initiative; K3 the six aspects and their identities, deckbuilding philosophy; K4 card advantage, win conditions, testing methodology, organized play prep.

**Homepage rank track** — previously hardcoded with fake progress values. Now uses `fetchUserAchievements()` in a `useEffect` when authenticated; progress per track is derived from earned achievement keys. Logged-out users see all-0% demo values (was previously misleading fake 100%/60%/33%/0% data). `COMING_SOON` updated: "Achievements" removed (it now exists), "Karabast Import" added.

**Export format correction** — `DeckExportModal` text export format updated for TCGPlayer compatibility: quantity is now a plain integer (no `x` suffix), card name includes subtitle when present (`Name - Subtitle`), set code appended in `[brackets]`. Old `cardRef()` helper removed; new `cardLine()` helper handles all three fields.

**Set code grouping fix** — card browser query previously sorted by `c.name ASC` with no tiebreaker. Cards reprinted across sets (e.g., "Open Fire" in SOR and TWI) had undefined primary selection, causing decks to randomly receive the wrong set's card ID. Fixed by adding a canonical tiebreaker (`set_order_case ASC, CAST(card_number AS INTEGER) ASC`) to every sort mode. SOR (1) now always beats TWI (3), so original printings are consistently the grouped primary. 11 affected cards confirmed (Daring Raid, Open Fire, Outflank, Padawan Starfighter, Patrolling V-Wing, Resupply, Tactical Advantage, Take Captive, Vanquish, Volunteer Soldier, Waylay).

---

### 2026-05-19: Deck analysis, public sharing, and export with marketplace links

**Deck Analysis panel** — New `DeckAnalysisPanel` component renders below the card grid on both the authenticated deck view and the public share view. All computation is client-side via `useMemo` — no additional fetch calls. Cost curve uses the existing `ts-curve-chart`/`ts-curve-bar`/`ts-curve-bar-fill` CSS classes defined in `globals.css`. Price total covers leaders + base + main deck; shows "(N/M priced)" when some cards lack price data. Aspects use the `ts-aspect-pip` design system element.

**Public deck sharing** — `share_token TEXT` column added to the `decks` table via `PRAGMA table_info()` startup migration (same pattern as the `token_version` migration in session 12). `share_token` is nullable and unique; `NULL` means the deck is not currently shared. Two new backend endpoints in `me.py`: `POST /api/me/decks/{id}/share` (idempotent — returns existing token if one already exists, generates `str(uuid.uuid4())` if not) and `DELETE /api/me/decks/{id}/share` (sets to NULL, returns 204). New `backend/src/routes/public_decks.py` with `GET /api/decks/share/{token}` — no auth, uses `enrich_card_with_relationships` from `db_helpers.py` (the fuller version with traits/arenas). Returns same shape as the authenticated deck endpoint.

**Export modal** — `DeckExportModal` component follows the same `ts-modal-backdrop`/`ts-modal` pattern as `HandSimModal`. Text deck list groups cards by type (Unit → Event → Upgrade → Other), sorts within each group by `energy_cost` ascending. TCGPlayer URL: `https://www.tcgplayer.com/search/star-wars-unlimited/product?productLineName=star-wars-unlimited&q={name}&view=grid`. Card Kingdom URL: `https://www.cardkingdom.com/catalog/search?search=NM&filter[name]={name}&filter[game]=swu`. "Buy What You're Missing" section computes `needed = deck_quantity - owned_count` per card; only appears when the `collection` prop is passed (i.e., when the user is authenticated and collection has loaded lazily).

**Pre-existing proxy bug fixed** — `DeckViewClient` was calling `fetchWithAuth('/api/me/decks/${deckId}')` but no Next.js route handler existed at `/api/me/decks/[id]`. This meant the individual deck view was broken before this session. Fixed by creating `app/api/me/decks/[id]/route.ts` as a GET proxy.

**Why analysis is client-side** — The deck data is already fetched by `DeckViewClient`/`PublicDeckViewClient` on mount. Adding a second endpoint for analysis would require a round-trip for data already in memory. Client-side `useMemo` is faster, simpler, and keeps the backend stateless.

**Why public sharing uses `share_token` not deck ID** — Exposing deck IDs in public URLs would allow enumeration of all decks in the database. A random UUID token is unguessable and revocable independently of the deck itself.

---

### 2026-05-16: UX pass, email verification, design system completion, uptime monitoring

**Collection completion % fix** — Profile header was always showing 100% because the collection endpoint only returned owned cards when `all_cards=false`, making numerator === denominator. Fix: always fetch `?all_cards=true`; the `showAllCards` toggle now only affects display filtering, not the fetch.

**Profile avatar** — `avatar_url` column added to `User` model with startup auto-migration. `PATCH /api/me/profile` endpoint in `me.py`. Next.js proxy at `PATCH /api/me/profile`. Profile header shows avatar image when set, falls back to initials. Edit mode exposes a URL input field. `UserResponse` updated to include `avatar_url`.

**Set filter merging** — "Secrets of Power Weekly Play", "A Lawless Time Weekly Play", "Jump to Lightspeed Weekly Play", and "Legends of the Force Weekly Play" now merged into their parent sets in the filter UI. The merge is computed dynamically from the API response — any future set that has a Weekly Play sibling is handled automatically. When a merged set is selected, the query param expands to both set names.

**Email verification** — `EmailVerificationToken` model (mirrors `PasswordResetToken`). `create_email_verification_token` / `consume_email_verification_token` helpers. Register endpoint creates a token and emails it when SMTP is configured; falls back to returning the token in the response body for dev/no-SMTP. `POST /api/auth/verify-email` and `POST /api/auth/resend-verification` endpoints. Next.js proxies for both. `/verify-email?token=...` page handles loading/success/error. Signup success message updated. Profile page shows amber banner with "Resend link" button when `email_verified=false`. Login not blocked for unverified users — warning only (right call for a household app where lockout would be disruptive). `email_verified` added to `UserResponse` and `AuthContext` `User` interface.

**CSS cleanup** — `@keyframes spin`, `.xl-show`, `.xl-hide` moved from an inline `<style>` block in `cards/page.tsx` into `globals.css`. `@keyframes ts-shimmer` and `.ts-skeleton` added to `globals.css` for the new loading skeletons.

**Loading skeletons** — Card browser loading state replaced with a 24-card shimmer grid matching the real card grid layout. Profile decks tab gets 6 skeleton deck cards. Profile collection tab gets 24 skeleton card thumbnails. Shimmer uses a gradient sweep animation on `--ts-bg-2`/`--ts-bg-3` colors — visible but not distracting against the dark theme.

**Deck name validation** — Both `create_user_deck` and `update_user_deck` now enforce: required, non-empty after strip, max 100 characters. 400 with a clear message on violation.

**CardDetail.tsx design system migration** — Full rewrite removing the last shadcn and Lucide dependencies in the app. `Button` from `@/components/ui/button` replaced with `ts-btn`. `ChevronLeft`/`ChevronRight` from `lucide-react` replaced with `‹`/`›` characters. All Tailwind color classes replaced with `ts-*` CSS vars. Art nav, flip button, stats block, keywords, card text, empty state, and action button all on the design system. No new dependencies added or removed.

**Uptime monitoring** — `.github/workflows/uptime_check.yaml` pings `https://twinsuns.chanfriendly.duckdns.org/health` every 15 minutes via GitHub Actions cron. On failure (non-200 or timeout), sends email via `dawidd6/action-send-mail`. Requires three GitHub secrets to be set: `SMTP_USER`, `SMTP_PASSWORD` (same Gmail app password in Bitwarden as `twinsuns-smtp-*`), `ALERT_EMAIL`.

---

### 2026-05-16: Password reset emails — switched from Resend to Gmail SMTP

**What changed:**

**Replaced Resend HTTP API with Gmail SMTP** — `_send_password_reset_email()` in `backend/src/auth/routes.py` was rewritten to use Python stdlib `smtplib` with STARTTLS. No new dependencies. Reads `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM`, and `APP_BASE_URL` from env vars. Defaults: `smtp.gmail.com:587`, from address falls back to `SMTP_USER` if `SMTP_FROM` is not set. `requests` import and all Resend HTTP logic removed.

**Why Resend was abandoned:**
1. Resend's `onboarding@resend.dev` sender (available without a verified domain) can only deliver to the Resend account owner's email address — it cannot send to arbitrary users. This made it fundamentally unsuitable for a password reset feature where the recipient is whoever registered the account.
2. Even with the correct API key, emails to other users would silently fail or be blocked by Resend's sandbox restrictions.

**`docker-compose.prod.yaml` updated** — Backend environment block now has all 6 SMTP vars (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM`, `APP_BASE_URL`) using `${VAR:-default}` Portainer substitution syntax. Old Resend vars removed.

**Root cause of the multi-session debug loop** — Two separate issues compounded:
1. The Portainer YAML was only passing `SMTP_PASSWORD` — `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, and `SMTP_FROM` were never in the environment block and never reached the container. The code couldn't log in without `SMTP_USER`.
2. The `deploy.sh` Portainer redeploy step fails with HTTP 422 "Invalid credentials", so new images weren't being pulled automatically. After pushing, a manual "Update the stack" in the Portainer UI was required. This is a known open issue.

**Key lesson** — When adding new env vars to a service, the `docker-compose.prod.yaml` file AND the Portainer stack editor must both be updated. The compose file is the local source of truth, but Portainer uses its own stored copy — they diverge silently when the deploy step fails. Always verify env vars are present in the running container after a config change (`docker exec twinsuns-backend env | grep SMTP`).

---

### 2026-05-15: Full production readiness pass — security, cleanup, infrastructure

**What changed:**

**Token revocation via `token_version`** — Added an integer column to the `User` table. Logging out (or resetting a password) increments it. JWTs now carry a `tv` claim; `get_current_user` rejects tokens where the claim doesn't match the DB value. This means a stolen session token is invalidated the moment the user logs out. No blocklist needed — a single DB read per request handles it. Startup migration auto-adds the column to existing databases via `PRAGMA table_info` check + `ALTER TABLE ADD COLUMN`.

**JWT expiry reduced 10,080 → 1,440 minutes (7 days → 24 hours)** — Combined with revocation, the worst-case stolen-token window is now 24h and shrinks to zero on explicit logout. `docker-compose.prod.yaml` updated to match.

**`SameSite=strict` on auth cookie** — Prevents the cookie from being sent on cross-site requests, mitigating CSRF attacks against state-mutating endpoints. Also tightened `maxAge` to match the 24h JWT lifetime.

**Authenticated logout with server-side revocation** — The Next.js `/api/auth/logout` route now forwards the token to `POST /api/auth/logout` on the backend (which increments `token_version`) before clearing the cookie. Previously it only cleared the client-side cookie, leaving the JWT valid until expiry.

**Password reset — full stack** — `PasswordResetToken` DB model (UUID primary key, 1h expiry, one-time use). `POST /api/auth/password-reset-request` creates a token; `POST /api/auth/password-reset-confirm` validates, updates the password, and bumps `token_version` to invalidate all existing sessions. Next.js proxy routes added for both. Email delivery via Resend when `RESEND_API_KEY` is set; falls back to token-in-response for dev / users without an email. Frontend: `/forgot-password` and `/reset-password` pages on design system; "Forgot password?" link on login page.

**`DELETE /api/me/account`** — Backend cascades all user data (`Deck`, `DeckCard`, `UserCollection`, `UserWishlist`), bumps `token_version`, returns 204. Next.js proxy at `DELETE /api/me/account` clears the auth cookie on success.

**All 52 `console.log/warn/debug` calls stripped** — Removed from `AuthContext.tsx`, `DeckBuilderContext.tsx`, `profile/page.tsx`, `CardDetailDialog.tsx`, `DeckBuilderClient.tsx`, `Navbar.tsx`, `SaveDeckDialog.tsx`, `lib/api.ts`, and all `src/app/api/**/route.ts` files. `console.error` in catch blocks retained.

**`ErrorBoundary` component** — `src/components/ErrorBoundary.tsx` (React class component with "Try Again" reset). Wraps `{children}` in `layout.tsx` so an unhandled render error shows a styled error panel instead of a blank page.

**Fake data removed** — `SPOTLIGHT` fake deck stats replaced with a "coming soon" placeholder. `STATUS_ITEMS` in Navbar replaced with accurate copy. `COMING_SOON` on home page updated (Collection Tracker and Wishlist removed — they're live now). `defaultUserProfile.username` was `'GalacticGamer77'`; now initializes empty to eliminate the flash before auth resolves.

**Infrastructure (confirmed operational):**
- HTTPS: Let's Encrypt cert via Nginx Proxy Manager for `twinsuns.chanfriendly.duckdns.org`. TLS 1.3, valid until 2026-07-01.
- App DB backup cron: `0 3 * * * docker exec twinsuns-backend python /app/scripts/backup_db.py` on TrueNAS `truenas_admin` crontab, logging to `/mnt/volume1/docker/twinsuns/backup.log`.

---

### 2026-05-15: Password reset email delivery + frontend reset flow

**What changed:**

**Backend email sending via Resend** — `backend/src/auth/routes.py` now has `_send_password_reset_email()` using the Resend HTTP API (`POST https://api.resend.com/emails`). Uses `requests` (already in `requirements.txt` — no new dep). When `RESEND_API_KEY` env var is set, the `password-reset-request` endpoint emails the reset link to the user's address instead of returning the token in the response. Falls back to token-in-response when: the env var is not set, the user has no email on their account, or the Resend call fails. Failures are logged but don't surface as errors (always 200 to avoid enumeration).

**Why Resend over SMTP** — Resend's API is HTTP + one API key, no SMTP ports/TLS config, and `requests` is already a dep. Mailgun/SES are equivalent but require more setup. Resend free tier (3,000/month) is more than sufficient for this use case.

**`APP_BASE_URL` env var** — Used to build the reset link (`{APP_BASE_URL}/reset-password?token={token}`). Defaults to `http://localhost:3000` if not set. Set to `https://twinsuns.chanfriendly.duckdns.org` in production.

**Frontend `/forgot-password`** — Username form. POSTs to `/api/auth/password-reset-request`. Always shows success message after submit (no enumeration). Design system consistent with login/signup.

**Frontend `/reset-password`** — Reads `?token` from URL query string; falls back to a manual token paste field if not present. POSTs to `/api/auth/password-reset-confirm`. On success redirects to `/login` after 3s. Client-side validation: passwords must match and be ≥8 chars before hitting the API.

**Login page** — "Forgot password?" link added next to "Enlist now".

---

### 2026-05-11: Cards page + components — full Twin Suns design system rewrite

**What changed:**

**All shadcn and Lucide deps removed from the cards flow** — `cards/page.tsx`, `CardGrid`, `CardFilters`, `CardSearch`, and `CardDetailDialog` were all using the old purple/gray shadcn theme (`bg-gray-900`, `border-gray-700`, `text-purple-500`, Lucide icons). All five files rewritten to use `ts-*` CSS custom properties and the Imperial Field Manual design system. No new packages added.

**`CardDetailDialog` decoupled from shadcn Dialog** — Previously rendered inside a shadcn `<Dialog>`/`<DialogContent>` wrapper in `cards/page.tsx`, importing `DialogTitle`/`DialogHeader`/`DialogFooter`. Now self-contained; `cards/page.tsx` provides a fixed-overlay custom modal (`position: fixed`, `rgba(26,22,17,0.92)` backdrop, `var(--ts-panel)` inner panel with `border: 1px solid var(--ts-line)`). This removes the dependency and makes the component portable.

**Design specifics:** `CardGrid` — amber owned badge, ts-stamp "In Deck" overlay, mono set-code + amber cost in card footer, hover border on `var(--ts-line-2)`. `CardFilters` — custom amber checkbox squares (no shadcn Checkbox), native `<select>` for cost range, ts-eyebrow section headers. `CardSearch` — ts-input search bar, ts-filter-pill active-tag chips with × dismiss, expandable inline panel for mobile. `CardDetailDialog` — `ts-aspect-pip` hexagons, stat blocks with `var(--ts-amber/red/green)` accent values, ts-btn action row. `cards/page.tsx` — display font title with eyebrow, native `<select>` sort dropdown, ts-btn mobile filter button.

**Why shadcn was removed rather than restyled** — The shadcn components use Tailwind utility classes internally; overriding them with `ts-*` vars requires fighting specificity across both layers. Replacing with native HTML + inline styles using the CSS vars is simpler, more predictable, and matches the pattern already established by the profile page and deck builder redesigns.

---

### 2026-05-07: Login bug fixed, card database rebuilt (2,360 cards), deploy.sh hardened

**Login was broken — root cause: `Secure` cookie flag on HTTP connection**

`/api/auth/token` and `/api/auth/login` both set the `auth_token` cookie with `secure: process.env.NODE_ENV === 'production'`. In the Docker container `NODE_ENV=production`, so `Secure: true` was always set. Browsers silently drop `Secure` cookies on non-HTTPS connections (the app runs over plain HTTP at `192.168.1.124:4000`). The cookie was never stored, so every subsequent `/api/auth/me` check (which reads the cookie, not the `Authorization` header) returned "Not authenticated". Fixed by setting `secure: false` in both route handlers — this app runs on a local network without TLS.

**`/api/auth/me` only reads cookies, not `Authorization` header** — The `fetchWithAuth` utility sends `Authorization: Bearer token`, but the `/api/auth/me` route handler only reads `cookieStore.get('auth_token')`. This works because after the token response sets the cookie, browsers send it automatically. The `Authorization` header in `fetchWithAuth` calls to `/api/auth/me` is redundant but harmless.

**Card database rebuilt: 1,398 → 2,360 cards** — Last rebuild was `2025-06-26`. Two new main sets released since: Set 5 (A Lawless Time / LAW, 267 cards) and Set 6 (Secrets of Power / SEC, 266 cards). Also new: Intro Battle: Hoth (IBH, 104), 2026 Promo (P26, 66), 2026 Twin Suns (TS26, 88), weekly play sets. Rebuild run locally via `build_database.py`, then exec'd inside the backend container via Portainer API to write to the TrueNAS volume mount (`/databases/cards_db/swu_cards.db`).

**`deploy.sh` Portainer redeploy was silently failing** — Two bugs: (1) `PORTAINER_PASSWORD` in `.env.prod` contains `"` and `:` — shell `source` via `grep | source <(...)` produced `unmatched "`, leaving the variable empty. Fixed by quoting the value in `.env.prod` with single quotes. (2) Even with the password fixed, using the password in shell string interpolation (`-d "{...\"password\":\"${pass}\"..."`) broke JSON when the value contained `"`. Rewrote `portainer_redeploy()` as an embedded Python script that reads `.env.prod` directly and uses `json.dumps` for all request bodies. Also fixed: was using `StackFileContent` from the stack GET response (empty in newer Portainer) — now reads compose from `/api/stacks/{id}/file`.

**Frontend healthcheck `localhost` → `127.0.0.1`** — Docker's Alpine `wget` resolved `localhost` to `[::1]` (IPv6) but Next.js standalone listens on `0.0.0.0` (IPv4 only). Health check always failed even though the app was serving correctly. Fixed in `docker-compose.prod.yaml`.

---

### 2026-05-06: Security hardening — close cryptominer follow-up gaps

**What changed:**

**Backend port 8000 unexposed in prod** — Removed `ports: "8000:8000"` from `docker-compose.prod.yaml`. The backend is reachable by the frontend container over the internal Docker network (`http://backend:8000`) — it never needed to be host-bound. Exposing it meant FastAPI was directly reachable on the host, bypassing the Next.js proxy and all application-level controls. Only port 4000 (frontend) is now host-exposed.

**Debug/test endpoints deleted** — `GET /api/auth/create-test-user` (created `testuser`/`password123` with no auth) and `GET /api/auth/debug-login` (returned a bcrypt hash of `password123` in plain text) were both publicly accessible with no authentication. Both removed from `auth/routes.py`.

**Rate limiter activated** — `RateLimitMiddleware` (in `src/utils/rate_limiter.py`) was never wired in despite existing. Added to `main.py` at 120 req/min per IP across all endpoints. Additionally added a stricter in-route dependency (`_check_auth_rate_limit`) on `/api/auth/token` and `/api/auth/register` at 10 attempts/60s per IP. The middleware's `X-Forwarded-For` trust was also removed — only the direct connection IP is used, since that header is attacker-controlled with no trusted upstream proxy.

**`/debug-routes` removed** — Endpoint that listed all registered API routes. Unnecessary info disclosure.

**Note: Portainer (port 9004) firewall state unknown** — If 9004 is internet-accessible, that remains the highest-risk item (anyone with the Portainer password can spin up any container). Must be verified at the router/firewall level — not addressable in this codebase.

---

### 2026-05-06: Repo Cleanup — ML stubs deleted, stale docs updated

**What changed:**

**ML stub files deleted** — `backend/src/utils/vector_db.py`, `backend/scripts/build_vector_db.py`, and `backend/scripts/rules_parser.py` removed. None of these were imported by any active route or referenced in the running app. `requirements-ml.txt` retains the deps for the future; its comment updated to not reference the deleted files. CLAUDE.md updated to match.

**`docker-compose.prod.yaml` comment removed** — Stale comment about `NEXT_PUBLIC_API_URL` removed from the frontend service env block. The var is not needed at runtime (client code uses relative URLs; confirmed not present in any source file or env config).

**`frontend/src/lib/utils.ts` kept** — Verified still used by `src/components/ui/` shadcn components (`cn()` called in label, card, dialog, tabs, select, alert, switch, button, badge, avatar, slider, input, checkbox).

---

### 2026-05-06: Profile Page Design Pass + ML Dep Cleanup

**What changed:**

**Profile page — full design system rewrite** — The profile page (`profile/page.tsx`) was completely rewritten from the old Tailwind/shadcn purple theme to the Twin Suns `ts-*` design system. All shadcn imports removed: `Button`, `Card`/`CardContent`/`CardHeader`/`CardTitle`, `Badge`, `Avatar`/`AvatarFallback`/`AvatarImage`, `Tabs`/`TabsList`/`TabsTrigger`/`TabsContent` (only the last four are kept — the Radix Tabs primitives are kept for tab state management with `ts-tabs-list` / `ts-tab-trigger` CSS classes applied), `Input`, `Switch`, `Label`. `framer-motion` removed. Lucide icon imports removed. Logic layer (data loading, auth redirect, deck delete, collection add, wishlist remove) is unchanged.

**Profile `handleAddToCollection` bug fixed** — Previously the function was defined as a module-level export outside the component and checked `response.ok` on the return value of `fetchWithAuth` — which returns parsed JSON, not a `Response` object, so `response.ok` was always `undefined` (falsy) and the collection never reloaded after adding a card. Fixed: moved the function inside the component as `handleAddToCollection`, use try/catch around `fetchWithAuth` (success = no throw), call `loadData()` on success.

**`.env.dev` / `.env.prod` unstaged** — Both files were accidentally staged or in an unmerged state from a prior commit. Removed from git index with `git rm --cached`. Both are in `.gitignore` and should never be tracked.

**ML deps split to `requirements-ml.txt`** — `torch`, `sentence-transformers`, `qdrant-client`, `transformers`, `numpy` moved from `requirements.txt` to `backend/requirements-ml.txt`. These are only needed for `build_vector_db.py` and `src/utils/vector_db.py`, neither of which is imported by any active route. Removing them from the core requirements reduces Docker build time significantly (torch alone is ~2 GB). Install with `pip install -r requirements-ml.txt` when AI features are being developed.

---

### 2026-05-06: Twin Suns Design System + Wishlist Feature (PR #3)

**What changed:**

**Full design system replacement** — The original Tailwind/shadcn purple theme was replaced with the "Imperial Field Manual" Twin Suns visual identity. Root motivation: the prior design used generic shadcn components (Card, Button, Badge, Avatar, Tabs, etc.) with a gray-950/purple-600 palette that had no relation to the Star Wars Unlimited aesthetic. The new system is built on `--ts-*` CSS custom properties with three custom font stacks (Cormorant Garamond for display headers, Spectral for body copy, JetBrains Mono for data/labels), all loaded via Google Fonts in `layout.tsx`. This means zero reliance on Tailwind utility classes for the redesigned pages — components use inline `style` props against the CSS vars instead.

**Hero section layering approach** — The twin suns are implemented as `position: absolute` radial-gradient `<div>` elements (not SVG or images) bleeding off the top-right of the hero section at z-index 1–2. Scanlines (`repeating-linear-gradient`) sit at z-index 3, the left vignette (`linear-gradient` to right) at z-index 4, and the content grid at z-index 5. This avoids a separate image asset and makes the suns purely CSS. The left vignette starts opaque at 38% and fades to transparent at 75%, keeping the left-side copy legible without blocking the suns on the right.

**Favicon** — `frontend/src/app/icon.svg` is the twin suns mark (amber circle + red circle). Next.js App Router automatically serves any `icon.*` file in `src/app/` as the browser tab favicon — no manual `<link rel="icon">` needed.

**Login/Signup pages** — Both pages were rebuilt from scratch (removed all shadcn imports: Button, Card, Input, Label, Alert, AlertTriangle, lucide-react icons). All auth logic (`login`, `register`, validation, error handling, redirect on success) was preserved exactly. The decision to do a full rewrite rather than patch the existing components was driven by the depth of shadcn dependency — the component tree was so intertwined that incremental edits would have left orphan imports.

**HandSimModal extracted** — The hand simulator was inlined inside `DeckBuilderClient.tsx`. Extracted to `frontend/src/app/deck-builder/HandSimModal.tsx` to keep the deck builder file manageable. Added `useState` for opponent leader name with a controlled `<input>` styled as borderBottom-only (no background/border box) so it reads as an inline editable label rather than a form field.

**Wishlist — backend design decisions:**
- `UserWishlist` uses a composite primary key (`user_id` + `card_id`) rather than a separate autoincrement `id`. This enforces uniqueness at the DB level and the `POST /me/wishlist` route does an idempotent add (check → skip if exists) rather than relying solely on a DB unique constraint, which would surface as a 500 error to the client.
- No `count` column — unlike `UserCollection`, you either want a card or you don't. This could change if "want N copies" is ever needed, but the simpler model is correct for now.
- SQLAlchemy `create_all` auto-creates the table on first backend start. No Alembic migration needed because the app DB schema is managed this way throughout (no migration framework is in use).

**Wishlist — frontend proxy pattern:**
- `wishlist/[cardId]/route.ts` uses `Promise<{ cardId: string }>` for the `params` type — the correct Next.js 15 pattern. The existing `decks/[id]/route.ts` does NOT use this pattern (pre-existing issue, not introduced here).
- The wishlist fetch in `profile/page.tsx` uses plain `fetch('/api/me/wishlist')` (not `fetchWithAuth`) — the route handler reads from the cookie just like the collection route does.

**Profile page — partial design update** — The wishlist tab and collection completion stat chip are on the new design system. The rest of the profile page (header, decks tab, collection tab) still uses the old Tailwind/shadcn purple theme. A full profile rewrite was scoped out of this session to avoid a massive single-session PR. The mixed state is intentional and documented in What's Next.

---

### 2026-05-05: Local Dev Smoke Test + PORT Conflict Fix

**What changed:**

**`.env.dev` `PORT=8000` removed** — `dev.sh` loads `.env.dev` via `export $(...)`. The file had a bare `PORT=8000` line which Next.js (and many Node processes) automatically pick up as the port to listen on. When `npm run dev` started, it saw `PORT=8000` in the environment and bound to 8000 instead of the default 3000. Since uvicorn was already on 8000, the two processes raced for the same port — whichever started second would either crash or shadow the first. Fixed by removing the `PORT` line (the backend port is hardcoded in `dev.sh` via `uvicorn ... --port 8000`; Next.js defaults to 3000 without it). The `BACKEND_PORT=8000` and `FRONTEND_PORT=4000` named vars remain as documentation.

**Root cause of the confusion:** `dev.sh` said "backend failed to start (port already in use)" then said "backend started successfully" (because the health check hit the still-running *old* uvicorn). Then the new Next.js inherited `PORT=8000` and started there, shadowing the old uvicorn. Result: `GET /health` returned Next.js HTML, all FastAPI endpoints unreachable.

**Local dev smoke test results:**
- Frontend: `http://localhost:3000` — 200 OK, all pages render
- Backend: `http://localhost:8000` — all API endpoints healthy
- Proxy pattern confirmed: browser calls go through `:3000/api/...`, Next.js forwards to `:8000/api/...`
- Cards page: 2,360 cards, full filter sidebar (type, aspects, keywords, sets, cost range)
- Deck builder: leaders grid loads, aspect compatibility filtering logic confirmed in code
- Auth flow: register, login, JWT, protected routes all work
- Deck CRUD: create/read/delete via `GET|POST|DELETE /api/me/decks` all return correct status codes
- TypeScript: 0 errors

---

### 2026-05-04: Session 0 Part 3 — JWT Rotation, Production Smoke Test, Full Stack Repair

**What changed:**

**JWT secret rotated** — Old secret (`e21bb8c4...`) was committed in `.env.prod` AND hardcoded in the server's `docker-compose.prod.yaml` (which itself had a third secret value, `356aefd7...`, indicating the file had diverged from git). New secret generated via `openssl rand -hex 32`, applied to both local `.env.prod` and server `docker-compose.prod.yaml` + `stack.env`. Backend restarted with new secret. `.env.prod` removed from git tracking and added to `.gitignore`.

**`lib/` gitignore fix** — `.gitignore` had `lib/` as a bare pattern, which matched `frontend/src/lib/` and blocked git from tracking the new files. Changed to `/lib/` (root-scoped) to only exclude Python build artifacts.

**Production smoke test revealed multiple server-side issues:**

**`DB_DIR` missing from server compose** — Backend code (db.py) falls back to `~/.swu` if `DB_DIR` env var is not set. `~/.swu` didn't exist in the container and `appuser` had no permission to create it. Fixed by adding `DB_DIR=/databases` to the backend environment in the server's `docker-compose.prod.yaml`.

**Database directory permissions** — Databases at `/mnt/volume1/docker/twinsuns/databases/` were `drwxrwx---` owned by `truenas_admin`. Container's `appuser` (uid=999) had no access. Fixed with `chmod o+rwx` on the database directories.

**`types.py` import bug on server** — Server-side `backend/src/routes/types.py` imported `get_app_db` but the endpoint used `get_card_db` (not imported). Fixed via `sed` on the server source and `docker cp` into the running container. **Note: the backend image was NOT rebuilt** — the fix is only in the running container and server source. Image rebuild required before next container restart.

**Old frontend image had broken `localhost:8000` rewrite** — The `twinsuns-frontend:local` image (built 12 days ago) had `next.config.ts` with `async rewrites()` pointing to `http://localhost:8000`. Inside Docker, `localhost` is the frontend container itself. Fixed by: (1) updating server's `next.config.ts` to match local version (no rewrites, route handlers only), (2) rsyncing all 35 route handler files from local to server, (3) rebuilding the frontend image on TrueNAS.

**Containers on separate Docker networks** — Multiple `docker restart` and single-service `docker compose up` calls left the backend with an empty `EndpointID` (not actually connected to the network). Fixed by running `docker compose up --force-recreate` for both services together, which Compose managed as a unit.

**Final smoke test results** — All endpoints healthy:
- `GET /api/cards?limit=2` → 200, total: 1398 cards
- `GET /api/aspects` → 200, 10 aspects
- `GET /api/types` → 200, 8 types
- `GET /api/collection` → 401 (correct, requires auth)
- `GET /api/decks` → 401 (correct, requires auth)
- `POST /api/auth/login` (bad creds) → 401 with `{"detail": "Incorrect username or password"}`

**Server state divergence note** — The TrueNAS server has a `/mnt/volume1/docker/twinsuns/` directory containing a copy of the frontend/backend source. This copy is NOT in sync with the git repo — it was never designed to be. Changes applied to the server should be treated as production hotfixes, with the canonical code in git. The proper deployment flow is: local git → `deploy.sh` (build + push to Docker Hub) → TrueNAS (pull + restart). Currently the server uses locally-built images (`twinsuns-*:local`) instead of Hub images, which creates this divergence risk.

---

### 2026-05-04: Session 0 Part 2 — Critical Bug Fixes

**What changed:**

**`frontend/src/lib/` created from scratch** — files were never committed to git (`git log --all --diff-filter=D` confirmed no history). Reconstructed three files by reading all import sites across the codebase:
- `utils.ts`: `cn()` helper (clsx + tailwind-merge)
- `fetch-utils.ts`: `fetchWithAuth()` — reads JWT from localStorage, syncs to a browser cookie so Next.js server-side route handlers (`cookies()`) can find it, also sends as `Authorization` header
- `api.ts`: All types (`Card`, `ApiCard`, `AlternateArt`, `SavedDeck`, etc.) and fetch functions (`fetchCards`, `fetchUserCollection`, `saveUserDeck`, `deleteUserDeck`, etc.)

**Auth token mismatch resolved** — `AuthContext` stored JWT in localStorage but server-side route handlers read from `cookies()`. `fetchWithAuth` now syncs the token to a cookie before each call, bridging the gap without requiring a server-side architecture change.

**`cookies()` awaiting fixed** — In Next.js 15, `cookies()` is async and must be awaited. Fixed in 4 files: `api/collection/route.ts`, `api/decks/route.ts`, `api/decks/[id]/route.ts` (3 occurrences).

**Wrong env var for server-side proxying** — `api/collection/route.ts` and `api/decks/[id]/route.ts` were using `NEXT_PUBLIC_API_URL` (browser-facing URL) instead of `INTERNAL_API_URL` (container-to-container URL) for server-side fetch calls to the backend. Fixed both.

**`decks.py` status clarified** — Router is intentionally disabled because `me.py` already implements the same deck CRUD at `/api/me/decks`. The frontend proxy routes (`/api/decks/**`) all forward to `/api/me/decks` on the backend. Enabling `decks.py` would create a conflicting duplicate. Fixed the variable name bug (`get_current_user` → `current_user` at line 24) for cleanliness but kept router disabled.

**Collection item mapping bug** — `cards/page.tsx` mapped collection items via `item.card_id` but the API returns `{ card: { id: ... }, count, in_collection }`. Fixed to `item.card.id`.

**TypeScript: 0 errors** after all fixes.

**`twin-suns-databases` relationship** — Separate repo containing standalone scripts and the actual `.db` files (`app_db/swu_app.db`, `cards_db/swu_cards.db`). Has a GitHub Actions workflow (`update_dbs.yaml`) that runs weekly (Monday 2AM) to pull fresh card data from the SWU API. It's the canonical source for card data. The main app's backend scripts are copies/variants of these scripts. The relationship is: twin-suns-databases generates the databases → databases are copied/mounted into the main app's Docker containers.

---

### 2026-05-04: Session 0 — Project Audit & Documentation Bootstrap

**What happened:** First structured documentation session. Performed a full codebase audit. Created CLAUDE.md, CHANGELOG.md, and PROGRESS.md.

**Audit findings:**

#### CRITICAL — Missing `src/lib/` directory (frontend is broken)
Multiple frontend pages and contexts import from `@/lib/api`, `@/lib/fetch-utils`, and `@/lib/utils` — a directory that does not exist in the repo. Affected files:
- `src/contexts/AuthContext.tsx` → imports `fetchWithAuth` from `@/lib/fetch-utils`
- `src/contexts/DeckBuilderContext.tsx` → imports `Card` type from `@/lib/api`
- `src/app/cards/page.tsx` → imports `fetchCards`, `fetchAspects`, etc.
- `src/app/profile/page.tsx`, `src/app/deck-builder/DeckBuilderClient.tsx`

The frontend cannot function without this module. Root cause: likely extracted at some point during a refactor or the files were never committed. Priority: fix first before anything else.

#### CRITICAL — Backend decks router commented out
`backend/src/api/main.py` lines 24–29 have the decks router registration fully commented out. The route file (`src/routes/decks.py`) exists and implements full CRUD, but `/api/decks` is not accessible. Deck creation and management features in the frontend are silently broken.

#### CRITICAL — Variable name bug in `backend/src/routes/decks.py`
Line 35 references `current_user.id` but the dependency parameter is named `get_current_user` at line 24. This will raise `NameError` at runtime when the router is re-enabled. Must be fixed before enabling the decks router.

#### SECURITY — Live JWT secret committed to `.env.prod`
`.env.prod` is tracked in git and contains the actual production JWT secret (`e21bb8c4...`). This means anyone with repo access can forge tokens for the production server. Short-term: rotate the secret. Long-term: move secrets to a vault (TrueNAS or environment variables set in Portainer directly, not via committed file).

**Recent git history context:** The last ~10 commits were Docker troubleshooting and search/grouping bug fixes. The `7d4eb33` "Docker finally builds correctly" commit appears to be the current stable point. The `02a92f8` "Search and grouping resolved" commit fixed card grouping. No commits address the missing lib/ directory — it appears the frontend was working at some point with a different structure.

**Alternatives considered for lib/ recovery:** Could check git history for deleted files (`git log --diff-filter=D -- 'frontend/src/lib/*'`). If the files were never committed, they must be written from scratch based on how they're used across the codebase.

---

### (Earlier history)

Pre-documentation history captured from git log. See `git log --oneline` for commit-level detail.

- `7d4eb33` — Docker builds stabilized after multi-commit troubleshooting
- `02a92f8` — Card search and grouping resolved (groups by name+subtitle+type)
- `2977015` — Beta declared complete
- `31c6f9c` — Deck edit functionality updated
- `282baff` — Beta deploy preparation
- `78c5128` — Button styling updates
