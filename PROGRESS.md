# PROGRESS.md

**Update this at the end of every session. A stale PROGRESS.md is actively harmful.**

---

## Current Status

*(2026-05-25 session 37)* **Engine v2 Week 3 landed — pending-choice + tokens + capture + interactive CLI. Scenarios 18/18. CLI plays AI-vs-AI games to completion. UAT artifact ready.**

**👉 UAT moment**: `cd frontend && npm run play-cli` — Christian can now play full games at the terminal (human-vs-human, human-vs-AI, or AI-vs-AI). The game UI in the browser still runs on v1 untouched; v2 powers the CLI only.

**New files (10):**
- `runtime/chooser.ts` — Chooser API (synchronous): ChoicePrompt → ChoiceResult. defaultChooser (leftmost/yes/first-N), declineChooser, scriptedChooser for tests.
- `state/tokens.ts` — TOKEN_REGISTRY with Battle Droid, Clone Trooper, TIE Fighter, X-Wing, Spy, Experience, Shield. Hand-coded for Week 3; production loader pulls from SWU API (Week 4).
- `primitives/tokens.ts` — `createToken` primitive. Emits TOKEN_CREATED, mirrors token spec into reg.cards on first use so all stat/predicate code finds it. Calls keyword onCreate hooks (Shielded/Ambush on token units).
- `primitives/capture.ts` — `capture`, `rescue`, `releaseAllCaptivesFor`. Removes damage + upgrades on capture per §v7 8.33; rescue restores faceup exhausted under original owner, does NOT trigger When Played.
- `legal.ts` — `getLegalActions(state, reg, pid)` enumerates every legal PlayerAction, honoring Sentinel constraints, ready resources, exhausted attackers. `describeAction` for display.
- `scripts/play_cli.ts` — interactive readline driver with optional AI per seat (`--ai p1` / `--ai p2` / `--ai both`).
- `__fixtures__/cards/W3_001..003.json` — Pelta Supply Frigate (create_token), Sanctioner's Shuttle (capture), Take Captive (event with choose_one between capture and damage).

**Modified files:**
- `spec/ast.ts` — added `ChooseOneEffect`, `OptionalEffect`, `CreateTokenEffect`, `CaptureEffect`, `RescueEffect` to the Effect union.
- `runtime/predicates.ts` — `EvalCtx` now carries optional `chooser`.
- `runtime/selectors.ts` — scoped selectors with `selector: 'chosen'` now call the chooser via `prompt_target`. Default chooser picks leftmost so existing tests still pass.
- `runtime/interpret.ts` — added `applyChooseOne`, `applyOptional`, `applyCreateToken`, `applyCapture`, `applyRescue`. choose_one auto-resolves the picked branch's effect.
- `runtime/triggers.ts` — `drainTriggers` + `settleTriggers` accept optional chooser, threaded into the InterpCtx for each resolved ability.
- `reducer.ts` — `step()` accepts optional chooser. Event-type card play now supported (`spec.type === 'event'` → move to discard → resolve when_played ability inline). Setup-phase advance handles "player declined under 2 resources" so AI-vs-AI games actually finish setup.
- `index.ts` — exports `getLegalActions`, `describeAction`, `defaultChooser`, `declineChooser`, `scriptedChooser`, `Chooser`, `ChoicePrompt`, `ChoiceResult`.
- `__fixtures__/index.ts` — adds `W3_CARDS` + `ALL_CARDS`.
- `package.json` — adds `play-cli` script.

**Design decisions (in code):**
- **Synchronous Chooser, not async PendingChoice.** The eventual web UI needs the engine to pause and surface PendingChoice. For Week 3 the CLI uses blocking readline, tests use scriptedChooser, AI uses a heuristic — all synchronous. The async lift is Week 4 when we wire v1's UI to v2. The Chooser API was designed so the eventual swap doesn't touch the primitives that use it.
- **Token specs mirrored into reg.cards on first creation.** Tokens aren't in the deck so they're not in the initial registry; mirroring on use keeps all downstream code (effectivePower, predicates, triggers) unaware of the token/non-token distinction.
- **Capture removes damage + upgrades** per §v7 8.33.1. Token units captured are set aside (not held) per §8.33.5.
- **Rescue selector is sourcePlayer's first captive.** A capture-zone-aware Selector form lands when a card actually needs finer rescue targeting.
- **Setup-decline tracking via perGameFlags.has('setup_declined')** — needed because hasResourced is reset between passes, so a player who declines once would otherwise be prompted forever.
- **Event cards resolve their When-Played ability inline**, not through the trigger drain, because the trigger drain looks for the card in the arena/discard slots and the event has *just* moved to discard. Going through the drain would work but adds latency for no benefit.

**Scenarios (18/18 passing):**
- 13 Week-2 scenarios (Grit, Sentinel, Saboteur, Shielded, Ambush, Raid, Restore, Overwhelm, When-Played damage, On-Attack draw, constant aura, lasting effect)
- 5 new Week-3 scenarios: create_token (Pelta), capture (Sanctioner), choose_one damage branch (scripted chooser), choose_one capture branch (default chooser leftmost), token unit defeats normally

**CLI verified:** `npm run play-cli -- --ai both` plays a 7-round game with seeded deck setup. Pelta tokens, Sanctioner captures, and Take Captive choose_one all fire in real play. Final outcome: p1 wins by base damage.

**Known gaps deliberately deferred:**
- **Leaders** (deploy + leader-unit-side abilities + Twin Suns 2-leader format) — Week 4
- **Upgrades** (attach, modifier stacking, "Attached unit gains X" text)
- **Indirect damage, divided damage, move (arena→arena), search, look at, disclose** — declarative AST exists, primitives ship next
- **Replacement effects layer** (Instead/Would interception)
- **Coordinate** (needs `player.controls_count` predicate path) + **Smuggle** (needs `active_in_zone` honored in cardAbilities scan)
- **Async PendingChoice** for the web UI — current CLI uses sync stdin
- **CLI choice prompting** — choose_one and chosen-target effects currently use defaultChooser inside the CLI (auto-pick leftmost) because the readline integration doesn't pre-load answers. Wire-up is small but didn't fit in this session; CLI is still useful for vanilla play and observing token/capture mechanics, just not yet for choosing between option branches interactively.

---

*(2026-05-25 session 36)* **Engine v2 Week 2 landed — abilities + 8 keywords + triggered/constant/lasting effects. Scenario suite: 13/13 passing. TypeScript: 0 errors.**

Layer-2 architecture complete: AST → predicate eval → selector resolver → modifier aggregator → effect interpreter → trigger drain → reducer integration.

**New files (18):**
- `spec/ast.ts` — Effect, Ability (Triggered/Action/Constant), Selector, Predicate, Modifier, KeywordGrant, TriggerCondition discriminated unions. The L3 contract.
- `state/effects.ts` — LastingEffectRec with snapshotted iid targets and expiry enum
- `runtime/predicates.ts` — evalCardPredicate + evalTriggerPredicate, closed enum field paths
- `runtime/selectors.ts` — Selector → ResolvedTarget[] with self/trigger_source/base/scoped/exclude forms. Defaults to ALL when no `selector`/`count` (auras), explicit `chosen` triggers count-limited slicing.
- `runtime/modifiers.ts` (rewritten) — multi-source aggregation: constant abilities on in-play cards + lasting effects + keyword bonusPower/bonusHp hooks. New: `effectiveKeywords`, `effectiveKeywordValue`, `hasEffectiveKeyword`.
- `runtime/interpret.ts` — applyEffect AST walker dispatching to L2 primitives (damage, heal, defeat, give_shield, draw, discard, exhaust, ready, give, sequence, if, noop)
- `runtime/triggers.ts` — collectTriggers scans in-play + just-defeated cards for matching `on:` + `where:` predicates; drainTriggers resolves in active-player-first order with nested-trigger stacking per §v7 7.6.11
- `primitives/keywords/types.ts` + `index.ts` — KeywordDef interface (bonusPower/Hp, attackBonusPower, onPlay/Deploy/Create/Defeated, onAttack, attackRestriction, overwhelmExcess)
- `primitives/keywords/{ambush,grit,overwhelm,raid,restore,saboteur,sentinel,shielded}.ts` — 8 v3 keywords
- `__fixtures__/cards/W2_001..010.json` — 10 cards exercising every Week 2 pattern: Grit (Wampa), Ambush+Raid (Pathfinder), Shielded+Sentinel (Shield Generator), Restore (Medical Frigate), Overwhelm (Battering Tank), Saboteur (Demolitions Droid), triggered When-Played damage (Sniper Strike Team), triggered On-Attack draw (Field Commander), constant aura (Clone Sergeant buffs other clones), vanilla clone (Recon Trooper)
- `scripts/scenarios.ts` — 13-scenario test suite asserting specific mechanic behaviors

**Reducer updates:**
- `settle()` now runs state-based fixpoint → trigger drain → state-based again (catches defeats from trigger-emitted damage)
- `applyPlayCard` runs keyword onPlay hooks after the card moves into the arena
- `applyAttack` validates Sentinel (force-target unless attacker has Saboteur), runs keyword onAttack hooks (Restore/Saboteur), applies Raid power bonus, applies Overwhelm excess-to-base on defender defeat
- Lasting effects are swept at end_of_attack / end_of_phase / end_of_round boundaries
- One bug found + fixed during scenario verification: scoped selectors with neither `selector` nor `count` defaulted to count=1, breaking aura targeting. Fixed to default to ALL matching candidates (the natural reading for grant targets)

**Scripts:**
- `npm run scenarios` — runs 13-scenario verification suite (Grit, Sentinel force-target, Saboteur bypass/strip, Shielded onPlay, Ambush ready, Raid +N power, Restore base heal, Overwhelm excess, When-Played triggered damage, On-Attack triggered draw, constant aura, lasting-effect expiry)
- `npm run play-demo` (Week 1) — still passes; no regression

**Categories covered vs ENGINE_DESIGN.md goals:**
- ✅ Category A (STAT_BUFF, KEYWORD grant, ON_ATTACK_DRAW, ON_ATTACK_PREVENT_DAMAGE) — all expressible
- ✅ Category B (ON_ATTACK_DEAL_DAMAGE_TARGET, ON_ATTACK_DEBUFF_DEFENDER, ON_ATTACK_DEBUFF_TARGET, WHEN_PLAYED_DAMAGE_DUAL, AURA_BUFF_OTHERS) — all expressible as triggered + give + sequence
- 🟡 Bounty (controlled_by: 'opponent') — Predicate supports it but the trigger drainer's player-ordering doesn't yet route to the opponent for resolution
- 🟡 Coordinate — needs `player.controls_count` predicate driver in collectModifiers (one-line add)
- 🟡 Smuggle — needs `active_in_zone: 'resource_zone'` honored in cardAbilities scan (one-line add)

**Known gaps — Week 3 scope:**
- Choose-one / optional / prompt_target with pending-choice protocol (currently the interpreter auto-picks the leftmost candidate for chosen selectors)
- Category C primitives: create_token, capture, release_captives, rescue, search, indirect_damage, take_counter (blast/plan), use_force/create_force_token
- Leaders (deploy → flip → leader_unit_abilities)
- Event cards (play → discard → resolve ability)
- Upgrades (attach_upgrade)
- Replacement effects (Instead/Would) — interpreter has the `replace` primitive grammar; needs the engine-level interception layer
- Per-phase counter reset on PHASE_STARTED (currently only on round start)

---

*(2026-05-25 session 35)* **Engine v2 Week 1 landed — L1 + minimal L2 + 10 specs + playable 2-player loop. TypeScript: 0 errors. Demo runs end-to-end.**

Sign-off received; greenfield engine started under [frontend/src/lib/engine-v2/](frontend/src/lib/engine-v2/). v1 untouched.

**Files (18 new):**
- `state/types.ts`, `state/bus.ts`, `state/zones.ts` — L1 state model + event taxonomy + zone helpers
- `spec/types.ts`, `spec/loader.ts` — card spec types and registry builder
- `actions.ts` — PlayerAction discriminated union (Week 1: START_GAME, PLAY_CARD, ATTACK, TAKE_COUNTER, PASS, RESOURCE_CARD, DECLINE_RESOURCE, RESOLVE_CHOICE)
- `primitives/state.ts` (exhaust/ready/readyAll), `primitives/move.ts` (move_to_zone/placeInZone), `primitives/card_flow.ts` (draw with empty-deck damage), `primitives/combat.ts` (damageUnit/damageBase/healUnit/healBase/snapshot, with Shield absorption), `primitives/meta.ts` (sequence)
- `runtime/modifiers.ts` (effectivePower/effectiveHp/remainingHp — Week 1 reads printed stats; aggregation lands Week 2), `runtime/state_based.ts` (fixpoint loop for base defeat + unit defeat)
- `reducer.ts` — the L1 `step()` function. Routes by action, handles 5-step Play-a-Card protocol, attacks with simultaneous combat damage, take-initiative + auto-pass for the taker, regroup phase (draw 2 → optional resource → ready all → next round)
- `init.ts` — game setup with shuffled decks, opening hand of 6, setup-phase resource placement (NOTE: setup resources enter ready per real SWU; regroup resources enter exhausted per §v7 5.5c)
- `util/uuid.ts`, `index.ts` (public API surface)
- `__fixtures__/cards/W1_001..010.json`, `B_001.json`, `B_002.json`, `__fixtures__/index.ts` — 10 vanilla unit specs (mix of arenas/aspects/costs) and 2 base specs
- `scripts/play_demo.ts` — headless 2-player loop with seeded RNG, greedy "play cheapest then attack base" AI, runs to a winner

**New devDep + scripts** in `frontend/package.json`:
- `tsx` (devDep) for running TS files directly
- `npm run play-demo` — runs the headless loop
- `npm run type-check` — sugar for `tsc --noEmit`

**Demo outcome:** Game converges in 6 rounds. Bob (p2) wins by attacking Alice's Echo Base to 0 HP. Round 1 produces real plays (cheapest 1-cost units), state-based defeat correctly ends the game.

**Known gaps (intentional — design says Weeks 2+):**
- No abilities yet. All `abilities: []` in specs. Triggered/constant/action abilities → Week 2.
- No leaders/upgrades/events. Card type guard in reducer throws on non-units.
- No keywords beyond Shield's stub absorption in `damageUnit`. Keyword definitions → Week 2.
- No modifier aggregation. `effectivePower`/`effectiveHp` return printed stats. Modifier layer → Week 2.
- No spec validator. `buildRegistry` is structural only. JSON Schema validator → Week 4.
- No LLM cascade. Hand-written specs only for now. Pipeline → Week 4.
- No Twin Suns leaders/format-specific cards. v2 currently runs a generic 2-player loop with no leader phase.

**Awaiting:** Christian's review of the engine code; specifically the §15 questions are now grounded in actual TypeScript, so re-reading types.ts and reducer.ts will tell him whether the contract feels right before Week 2 builds on it.

See [CHANGELOG entry](CHANGELOG.md#2026-05-25-engine-v2-week-1-implementation-session-35) for the full decision log.

---

*(2026-05-25 session 34)* **Engine v2 design — v7 deltas folded, 4 open questions resolved. Still no code.**

Christian dropped the v7 PDF locally; v7 vocabulary now drives the design. Net additions to ENGINE_DESIGN.md:
- 3 new keywords: Piloting, Hidden, Plot (15 total)
- 10 new primitives across `combat`, `move`, `force`, `disclose`, `resource`, `meta`, `tokens` namespaces
- Triggered ability aliases for On Defense, When Attack Ends, When Created, When Captured
- Event bus expanded with `ARENA_MOVED`, `ATTACK_ENDED`, `RESCUED`, `TOKEN_CREATED`, `FORCE_*`, `COUNTER_TAKEN`, `CARD_DISCLOSED`, `DAMAGE_PREVENTED`
- Replacement effects (Instead/Would, §v7 7.7.5) now first-class in the modifier grammar — Shield token is modeled this way
- Player state gains `forceToken`, `creditTokens`, `countersHeld`, `hasTakenCounterThisRound`
- `PlayerId` widened from binary union to open string (Twin Suns multiplayer enablement, §v7 12)
- 6 new worked examples (Piloting, Hidden, Plot, Indirect Damage, Force-token leader, Twin Suns Take an Available Counter)

**Open questions resolved:**
- Token registry: pull from SWU API via script (matches keyword sync approach)
- Leader spec: two ability lists per side (`leader_abilities`, `leader_unit_abilities`, plus optional `leader_upgrade_abilities` for §v7 3.4.4A)
- Choice UI: inline prompt text + highlight valid objects + pass button for "may"
- Keyword refresh: automated diff script (`tools/authoring/sync_keywords.py`) with human approval gate

**New open question:** Multi-player Twin Suns (2–4 players per §v7 12.1). I recommend shipping v2 at 2-player parity with v1, generalizing in v2.1 — the state model is already string-keyed so the generalization is mechanical.

See [ENGINE_DESIGN.md §16](ENGINE_DESIGN.md#16-change-log) for the full v7 diff.

**Awaiting:** Christian's review of §15 sign-off checklist before code starts.

---

*(2026-05-24 session 33)* **Engine v2 design contract drafted — see [ENGINE_DESIGN.md](ENGINE_DESIGN.md). No code yet.**

Outcome of a design discussion: rather than continue growing v1's per-card / per-effect-category registry, the next iteration is a four-layer engine where cards become declarative JSON specs and the engine becomes an interpreter over a closed primitive vocabulary. Synthesis: Datalog-style production rules for triggers, algebraic effects for action verbs, ECS-style modifiers for continuous effects.

Pipeline (L4) is a cascade: deterministic template matcher → local 8B model with GBNF grammar (Mac mini, Qwen 2.5 7B) → Claude (opt-in) → human review. Honors the user's homelab goal of local-first inference and minimizes paid token usage.

v1 stays running at `frontend/src/lib/game-engine/`. v2 will live at `frontend/src/lib/engine-v2/` with a clean boundary (no React imports). Greenfield rewrite; v1 retired only after parity.

---

*(2026-05-24 session 32)* **Full leader ability expansion — 47 leaders implemented, attack-type ability state machine added, disclaimer banner. TypeScript: 0 errors.**

**New in session 32:**
- **All leaders implemented (47 entries).** `LEADER_ABILITIES` in `abilities.ts` changed from name-keyed → ID-keyed (multiple leaders share names, e.g. Ahsoka Tano, Boba Fett). 47 leaders now have abilities. Effect categories covered: `TRIGGER_ATTACK_WITH` (13 leaders), `PHASE_BUFF_UNIT` (3), `DEAL_DAMAGE_UNIT` (11), `DEAL_DAMAGE_OPP_BASE` (3), `DEAL_DAMAGE_ANY` (1), `EXHAUST_UNIT` (2), `HEAL_BASE` (1), `HEAL_UNIT` (3 — new effect type), `GIVE_SHIELD_FRIENDLY` (5), `DRAW` (2). All effects are best-effort approximations; conditions, trait/aspect filters, and secondary clauses are noted in comments.
- **New `LEADER_ATTACK_ABILITY` action type.** Leaders whose ability text says "Attack with a unit. It gets +N/+N for this attack." (Ahsoka "Snips", Asajj "Unparalleled Adversary", Anakin "What it Takes to Win", Jyn Erso, IG-88, Moff Gideon, Leia "Alliance General", Saw Gerrera, Rio Durant, Maul, Han Solo "Never Tell Me the Odds", Asajj "Ambitious Apprentice", Colonel Yularen) now use a new `LEADER_ATTACK_ABILITY` action type. Engine function `applyLeaderAttackAbility` mirrors `applyPlayAttackEvent`: pay cost → exhaust leader → apply stat bonus → call `applyAttack` → remove bonus. Sentinel and arena constraints inherited from `filteredAttacks`.
- **New `HEAL_UNIT` effect type.** Added to `AbilityEffect` union and wired in `applyAbilityEffect`. Used by Obi-Wan Kenobi "Patient Mentor", Leia "Get to Your Transports!", and Satine Kryze.
- **`coordinateRequired?: boolean` on `LeaderAbility`.** Ahsoka Tano "Snips" text reads "Coordinate — Action [Exhaust]: …" — her ability is only legal while Coordinate is active. `getLegalActions` checks `isCoordinateActive(state, playerId)` before generating actions for any leader with this flag.
- **Two-step UI state machine for leader attack abilities** (`GameBoard.tsx`). New state: `pendingLeaderAttackAbilityId`. New memos: `legalLeaderAttackAbilityIds`, `leaderAttackAbilityAttackerIids`, `leaderAttackAbilityTargetIids`, `canLeaderAttackAbilityTargetBase`. Flow: click ABILITY button → enter mode → highlight valid attackers → click attacker → highlight valid defenders → click defender → dispatch `LEADER_ATTACK_ABILITY`. Cancel by clicking ABILITY again.
- **`YourMat.tsx`** — ABILITY button now shows for both `LEADER_ABILITY` and `LEADER_ATTACK_ABILITY` leaders. CANCEL state covers both pending types.
- **Disclaimer banner** — amber `⚠ Simulator β — card effects approximate, some unimplemented` badge in the top chrome rail. Always visible during gameplay.

**Known gaps (not implementable without new subsystems):**
- **Force token system** — ~10 leaders (Ahsoka "Fighting For Peace", Ahsoka "I Have an Idea", Anakin "Tempted", Avar Kriss, Barriss, Cal Kestis, Darth Maul, Grand Inquisitor "Stories Quickly", Mother Talzin, Obi-Wan "Courage", Qui-Gon)
- **Token creation** — ~15 leaders (Captain Rex, Admiral Ackbar's X-Wing, Grand Moff Tarkin Experience, various Credit tokens, etc.)
- **Triggered/passive effects** — ~20 leaders (all Boba Fett variants, Cad Bane, Cassian "Climb!", Jango Fett, Darth Revan, Quinlan Vos, etc.)
- **Complex actions** — deck search (Chancellor Palpatine, Jyn "Time to Fight"), play-from-hand (Fennec Shand, Third Sister), resource manipulation (Han Solo "Audacious Smuggler", Hunter)

Zero new dependencies. TypeScript: 0 errors.

---

*(2026-05-24 session 31)* **UAT bug fixes continued — upgrade targeting UI implemented. TypeScript: 0 errors.**

Session 30 addressed all 7 bugs from the first play-test match (Strict Mode root-cause fix, draw order, leader stats, DividerBar, CardPreview). Session 31 addresses bugs from the second play-test match:

**New in session 31:**
- **Upgrade targeting flow** — `PlayCard` upgrades (e.g. Protector) now enter a two-step targeting mode instead of falling through to arena placement. Clicking an upgrade card highlights all friendly units as valid attachment targets with an amber banner ("▸ Select a unit to attach the upgrade — click the card again to cancel"). Clicking a highlighted unit dispatches `PLAY_CARD { iid, targetIid }` which triggers the engine's `type === 'upgrade' && targetIid` path. Tapping the upgrade card again cancels the selection. Changes: `canPlayUpgradeIids` + `upgradeTargetIids` memos in `GameBoard.tsx`, `pendingUpgradeIid` state wired through `clearPending`/`friendlyTargetIids`/`handleMyUnitClick`/`handleHandCardClick`, new props added to `YourMat` interface. TypeScript: 0 errors.

**From session 30 (carried):**
- **Root cause fixed (Strict Mode desync)** — engine init moved to render body before `useState`; idempotent null-check. Fixed Bugs #5A (wrong arena), #6 (Sentinel bypass), leader deploy, and Coordinate effects that were all failing due to the desynced state.
- **Draw/resource order** — draw 2 cards moved to `applyTakeCounter` so cards are visible before resource selection.
- **Leader deployed stats** — `LEADER_DEPLOYED_STATS` map + 3/6 fallback for null attack/health.
- **DividerBar** — last log entry in place of resource readout.
- **CardPreview** — full card image at SWU aspect ratio, no overlays.

**Still under investigation:**
- **Events not applying effects** — likely resolved by Strict Mode fix (engine state was desynced, effects were computing on wrong state). If specific cards still don't work, report card names and they'll be added to the registry.
- **Ambush "immediate attack" timing** — Current impl: Ambush unit enters play `exhausted: false` and can attack on your next turn. Proper SWU Ambush grants an interrupt attack before the turn passes. Full implementation would require holding `activePlayer` after playing the unit and allowing one optional attack. Noted as known gap; unit is still usable (attacks on next turn).
- **Deployed leader stats data gap** — `LEADER_DEPLOYED_STATS` covers only Ahsoka Tano variants. Other leaders fall back to 3/6. Long-term: update `build_database.py` to fetch deployed stats from the SWU API.

Zero new dependencies. TypeScript: 0 errors.

---

*(2026-05-23 session 29)* **AI heuristic overhaul + event registry expansion. TypeScript: 0 errors.**

- **AI scoring system.** `ai.ts` rewritten from a 5-priority chain to a per-action score system. `scoreAction()` evaluates every legal action and returns the highest scorer. Key correctness fixes: kill-shot detection now uses `computePower(state, attacker, ownerId)` / `effectiveHealth()` instead of raw `card.attack`/`card.health`, so Grit, Coordinate buffs, and Aura buffs are factored in. Trade quality assessment distinguishes favorable (kill, survive), neutral (mutual kill), bad (we die, they live), and chip-only cases with appropriate scores. Base-attack strategy scales by `attackPower / baseHp` ratio and grants a bonus when board advantage is positive. Deploy, leader ability, and event card scoring all improved.
- **Leader ability scoring.** `LEADER_ABILITY` actions were silently never chosen by the old AI (priority chain had no branch for them). Now scored at 45–55 based on whether a target is required. Targeted abilities (exhaust enemy unit, buff friendly) score higher.
- **Event card scoring.** Events are now played by the AI. `PLAY_CARD` events scored by text-pattern: defeat events score 55 when enemies exist, damage events by amount×3, draw events 30, buffs 25. `PLAY_ATTACK_EVENT` scored by combat outcome against the chosen defender.
- **Resource selection.** `useGame.ts` AI resource selection updated to pick the lowest-cost card from hand (preserve high-value plays for deployment) instead of a random card.
- **Event registry expanded (~30 new entries).** `EVENT_EFFECTS` in `abilities.ts` now covers: draw/tutor events (I Want Proof, I've Found Them, Arms Deal, Do or Do Not, Recruit, Commission, Bounty Posting), damage events (That's a Rock, Grenade Strike, Drain Essence, Contempt for Culture, Air Superiority, Force Choke, Electromagnetic Pulse, Fight Fire With Fire), attack-boost events (Outflank, Attack Run, Barrel Roll, Punch It, Desperate Attack, Corner the Prey, Flash the Vents, One Way Out, Commence the Festivities, Dogfight, I Have You Now, Niman Strike, Rebel Assault, Swoop Down, Breaking In, Improvised Detonation, Heroic Sacrifice, Grim Resolve, Catch Unawares, Tandem Assault, Headhunting), debuffs (Incapacitate, Mystic Reflection), and heals (Smuggler's Aid, Repair). Multi-clause and type-specific events are approximated with their primary effect.

Zero new dependencies. TypeScript: 0 errors. UAT match still in progress — no browser verification yet (user is playing).

---

*(2026-05-23 session 28)* **Coordinate stat display fix, resource pile tracking, resource hover, setup UX improvements. TypeScript: 0 errors.**

- **Coordinate stat display bug fixed.** Echo was showing 2/2 instead of 4/4 with Coordinate active (4 units in play). Root cause: `toPlayCardProps(ci)` reads raw `card.attack`/`card.health` — the display adapter had no access to `GameState`, so Coordinate STAT_BUFF and AURA_BUFF_OTHERS were computed by the engine but never reached the card component. Fix: added two `useMemo` stat maps (`p1UnitEffectiveStats`, `p2UnitEffectiveStats`) in `GameBoard.tsx` where full `GameState` is available. Each calls `computePower(state, ci, ownerId)` and `effectiveHealth(state, ci, ownerId)` per unit, builds a `Map<iid, { power, hp }>`, and passes it down as a new optional prop to `YourMat` and `TopOppMat`. An `applyEffectiveStats()` helper in each mat overrides the raw props before rendering. Clone Commander Cody's AURA_BUFF_OTHERS (+1/+1 to all other friendlies) is confirmed working.
- **Resource pile tracking added.** `PlayerState` gains `resourcePile: CardInstance[]` — an append-only ordered list tracking which cards were resourced and in what order. Added to `initPlayer` (empty on init) and populated in `applyResourceCard` for both setup and regroup branches (capturing the `CardInstance` before removal from hand). The pile index `i` directly corresponds to resource pip `i` in the UI.
- **Resource hover implemented.** `ResourceLattice` in `BoardParts.tsx` now looks up `resourcePile?.[i]` for each pip. When a `CardInstance` is found, hover events call `emitHoverCard()` with the card data — the same event bus used by `PlayCard` hover previews. The `CardPreview` overlay then shows the full card face. Pip cursor changes to `help` when hoverable. `toResourceHoverData(ci)` builds the `PlayCardData` shape from a `CardInstance`.
- **Setup hand card UX improved.** During setup and regroup phases, hand cards now wrap in a hover `<div>` with `onMouseEnter`/`onMouseLeave` that drives a `resourceHoveredIid` state. The hovered card shows an amber `is-selected` glow (same as normal selection) so the player sees exactly which card will be resourced before clicking. Setup cards enlarged from `md` to `lg` (110×154px) so card names are clearly legible. The existing `CardPreview` hover popup also fires on mouse-over during setup/regroup.
- **Defensive leader/base filter in `deckToPlayerConfig`.** Added `excludedIds` guard to `engine.ts` that checks each `deck.cards` entry against the deck's leader IDs and base ID before expanding. If a leader or base card leaks into the deck card list (possible backend quirk), it is silently skipped with a `console.warn` naming the card. This was added as a diagnostic/safety measure after investigating a reported "wrong card resourced" bug.

Zero new dependencies. Browser UAT needed — user will play a match and report issues.

---

*(2026-05-22 session 27)* **Coordinate keyword Category B — parser-driven effect system. 5 deferred cards unblocked. TypeScript: 0 errors.**

- **Architecture flip.** `getCoordinateAbilities(card)` is now the single entry point for Coordinate effects. Registry-first / parser-fallback contract mirroring the existing event parser. Manual `CARD_ABILITIES` entries are now overrides (kept for safety but no longer the primary path).
- **`parseCoordinateText(text)`** in `abilities.ts` — strips the "(Gain this ability...)" reminder, pattern-matches the body. Covers 9 effect shapes: STAT_BUFF, KEYWORD grant (with optional N value), ON_ATTACK_DRAW, ON_ATTACK_PREVENT_DAMAGE, plus the 5 new Category B types. Every currently-registered Coordinate card's text also matches the parser.
- **5 new `CoordinateEffect` variants + engine wiring**:
  - `ON_ATTACK_DEAL_DAMAGE_TARGET` (Kit Fisto) — optional damage to a chosen unit before combat. UI 3-step: attacker → coord target → defender.
  - `ON_ATTACK_DEBUFF_DEFENDER` (Clone Dive Trooper) — defender's strikeback power reduced. No UI work — engine-only.
  - `ON_ATTACK_DEBUFF_TARGET` (Padmé "Pursuing Peace") — mandatory phase debuff on a chosen enemy. UI 3-step.
  - `WHEN_PLAYED_DAMAGE_DUAL` (Reckless Torrent) — optional split damage on entry. UI 2-step: card → friendly → enemy; in-place decline by re-tapping the card.
  - `AURA_BUFF_OTHERS` (Clone Commander Cody) — continuous aura. New `getIncomingAuras(state, target, ownerId)` helper in `keywords.ts` wired into `computePower`, `effectiveHealth`, `hasEffectiveKeyword`. No UI work.
- **Action shape changes.** `ATTACK` gains `coordDamageTarget?` + `coordDebuffTarget?`. `PLAY_CARD` gains `targetIids?: string[]`. `getLegalActions` enumerates combinations (small N per attacker / per playable card).
- **`GameBoard.tsx`** — three new state machines mirroring the event-targeting pattern: coord-on-attack target picking (`coordChoiceMade` + `chosenCoordTargetIid`), dual-target play (`pendingDualPlayIid` + `pendingDualFriendlyIid`), and the `attackMatchesCoord` predicate that funnels coord state into action selection. `clearPending` resets all of it.
- **`YourMat.tsx`** — new props (`canPlayDualIids`, `pendingDualPlayIid`, `pendingDualFriendlyIid`), hand banner extended with two new states, dual-play cards highlight + click as expected.
- **Category C plan** documented in `abilities.ts` doc comment — 5 cards still blocked (Pelta Supply Frigate / Sanctioner's Shuttle / Ki-Adi-Mundi / Ahsoka or Padmé as Leaders / For The Republic). Each blocker is named with the engine subsystem it needs (token system / capture zone / triggered-ability dispatch / leader-as-attack-trigger / upgrades-as-aura-sources). Once a subsystem lands, the parser is where the new text pattern goes — no per-card registry growth.

Zero new dependencies. Browser play-test still needed.

---

*(2026-05-22 session 26)* **Profile Security tab implemented (item 22). TypeScript: 0 errors.**

- **22 (UX)** — "Security" tab added to profile page with Change Password and Change Email forms. Both wire to existing backend endpoints (`PATCH /api/me/password`, `PATCH /api/me/email`). Password change triggers auto-logout after 2.5s (token_version is bumped on backend). Email change shows verification-email notice. All input validation is client-side + backend. Zero new dependencies.

---

*(2026-05-21 session 25)* **Security/ops items 29–32 resolved. Item 28 still needs human action.**

- **29 (Data)** — Verified backup chain covers twinsuns. No code changes needed.
- **30 (Security)** — CSP baseline added to `frontend/next.config.ts`. TypeScript: 0 errors.
- **31 (Ops)** — `.github/dependabot.yml` created (pip + npm + actions, weekly).
- **32 (Ops)** — JSON structured logging wired into `backend/src/api/main.py` via `_JsonFormatter`. No new deps.
- **28 (Ops)** — TLS cert expires 2026-07-01. Requires human: check NPM UI → SSL before 2026-06-25.

---

*(2026-05-20 session 24)* **Event parser + attack-event flow (PLAY_ATTACK_EVENT) implemented. ~47 additional events auto-parsed, defeat/debuff/direct-base-damage effects live.**

Six files modified, zero new dependencies. TypeScript: 0 errors.

1. **`abilities.ts`** — Three new `AbilityEffect` variants:
   - `DEFEAT_UNIT` — immediately defeats chosen non-leader unit (no damage path)
   - `DEAL_DAMAGE_OPP_BASE` — deals N damage directly to opponent's base (no target selection)
   - `TRIGGER_ATTACK_WITH` — triggers the PLAY_ATTACK_EVENT two-step UI flow (atkBonus, hpBonus, optional grantKeywords note)
   - `EVENT_EFFECTS` registry extended: Vanquish, Lost and Forgotten, It's Worse, Lethal Crackdown (all `DEFEAT_UNIT`)
   - `parseEventText(text)` — regex fallback covering: Draw, DEAL_DAMAGE_ANY, DEAL_DAMAGE_UNIT, DEAL_DAMAGE_OPP_BASE, HEAL_BASE, PHASE_BUFF_UNIT (positive and negative, en-dash aware), EXHAUST_UNIT, GIVE_SHIELD_FRIENDLY, DEFEAT_UNIT, TRIGGER_ATTACK_WITH (with and without keyword grant)
   - `getEventEffect(name, text)` — tries registry first, falls back to parser
   - `needsEventTarget(name, text?)` — updated to use `getEventEffect`

2. **`actions.ts`** — New `PLAY_ATTACK_EVENT { iid, attackerIid, defenderIid }` action type. One action per legal (event × attack) combination. Inherits Sentinel filtering automatically.

3. **`keywords.ts`** — `computePower` now clamps to `Math.max(0, power)` so debuffs can't push attack below zero.

4. **`engine.ts`** — Multiple additions:
   - `defeatUnitByIid(state, iid)` — helper shared by DEFEAT_UNIT effect and future use
   - `applyAbilityEffect` — new cases for `DEAL_DAMAGE_OPP_BASE`, `DEFEAT_UNIT`, `TRIGGER_ATTACK_WITH` (no-op sentinel), fixed negative stat log formatting
   - `getLegalActions` — updated event branch to use `getEventEffect`; TRIGGER_ATTACK_WITH events skip PLAY_CARD actions; post-filter PLAY_ATTACK_EVENT actions generated for each (event × filtered-attack) pair
   - `applyPlayCard` — uses `getEventEffect` fallback; guards against routing TRIGGER_ATTACK_WITH through PLAY_CARD
   - `applyPlayAttackEvent` — pays for event, applies temporary phaseAtk/phaseHp buff, calls `applyAttack` (which handles exhaustion + turn switch), then removes buff (no-op if attacker died)
   - Dispatcher: `PLAY_ATTACK_EVENT` → `applyPlayAttackEvent`

5. **`GameBoard.tsx`** — Full two-step attack-event state machine:
   - New state: `pendingAttackEventIid`
   - New derived sets: `canPlayAttackEventIids`, `attackEventAttackerIids`, `attackEventTargetIids`, `canAttackEventTargetBase`
   - `effectiveOppTargetIids`: step 2 uses `attackEventTargetIids`
   - `friendlyTargetIids`: step 1 uses `attackEventAttackerIids` (so valid attackers highlight)
   - `effectiveCanTargetBase`: routes through attack-event base check in step 2
   - All click handlers updated for attack-event priority routing
   - `handleHandCardClick` recognizes `canPlayAttackEventIids` cards as clickable
   - New props passed to `YourMat`

6. **`YourMat.tsx`** — New props `canPlayAttackEventIids`, `pendingAttackEventIid`. Hand cards with attack-event actions are clickable. Attack-event pending card shows `selected` state. Banner shows "▸ Select a unit to attack with — click the card again to cancel" in step 1.

*(2026-05-20 session 23)* **Leader abilities, event card effects, and targeting mode UI fully implemented.**

Seven files modified, zero new dependencies. TypeScript: 0 errors.

1. **`types.ts`** — `CardInstance.phaseAtk/phaseHp` (cleared at regroup); `LeaderInstance.exhausted` (cleared at regroup).

2. **`actions.ts`** — New `LEADER_ABILITY` action type (`leaderCardId`, optional `targetIid`).

3. **`abilities.ts`** — Three new systems added above the Coordinate registry:
   - `AbilityEffect` union: `DRAW`, `PHASE_BUFF_UNIT`, `DEAL_DAMAGE_UNIT`, `DEAL_DAMAGE_ANY`, `HEAL_BASE`, `EXHAUST_UNIT`, `GIVE_SHIELD_FRIENDLY`
   - `TargetKind`: `FRIENDLY_UNIT`, `ENEMY_UNIT`, `ANY_UNIT`, `ENEMY_UNIT_OR_BASE`
   - `LEADER_ABILITIES` registry: Chirrut Îmwe (+0/+2 to unit for phase), Admiral Ackbar (exhaust enemy unit for 1 resource)
   - `EVENT_EFFECTS` registry: Strategic Analysis (draw 3), Daring Raid (2 to unit/base), Open Fire (4 to unit), We're In Trouble, Shoot First, Precision Fire, Force Lightning, Orbital Bombardment, Tactical Advantage, Battle Meditation, and ~10 more

4. **`keywords.ts`** — `computePower` adds `phaseAtk`, `effectiveHealth` adds `phaseHp`.

5. **`engine.ts`** — `mapCardInArenas`, `getValidTargets(state, playerId, targetKind)`, `applyAbilityEffect` (unified resolver), `applyLeaderAbility` (pays cost, exhausts leader, resolves effect, switches turn). `getLegalActions` now offers `LEADER_ABILITY` with one action per valid target for targeted abilities; events in `EVENT_EFFECTS` with `targetKind` generate `PLAY_CARD { iid, targetIid }` per valid target. `applyPlayCard` resolves registered event effects. `resolveRegroup` clears `phaseAtk/phaseHp` and un-exhausts all leaders.

6. **`PlayCard.tsx`** — `LeaderData.exhausted` field; `toLeaderData` passes it; `LeaderCard` shows dimmed border + bottom "exhausted" strip when ability used.

7. **`GameBoard.tsx`** — Full targeting state machine: `pendingLeaderAbilityId`, `pendingEventIid`; derived sets (`leaderAbilityTargetIids`, `eventTargetIids`, `effectiveOppTargetIids`, `friendlyTargetIids`); all click handlers updated to route through ability/event targeting before normal attack logic.

8. **`YourMat.tsx`** — ABILITY button on leaders (toggles to CANCEL while targeting). Friendly units highlight as targets. Hand banner turns amber "▸ Select a target" when event targeting mode is active.

*(2026-05-20 session 22)* **Coordinate keyword implemented — abilities registry, engine hooks, UI indicator.**

Four files added/modified, zero new dependencies:

1. **`abilities.ts` (new)** — Per-card ability registry keyed by card name. Maps 12 Coordinate cards to typed effects: `STAT_BUFF`, `KEYWORD` grant, `ON_ATTACK_DRAW`, `ON_ATTACK_PREVENT_DAMAGE`. 10 more cards deferred (need target selection or event triggers — see registry comments).

2. **`keywords.ts`** — New public API:
   - `isCoordinateActive(state, ownerId)` — true when ≥3 units in both arenas combined.
   - `getActiveCoordinateEffects(state, inst, ownerId)` — returns effects from registry if card has Coordinate keyword and threshold is met.
   - `hasEffectiveKeyword(state, inst, ownerId, kw)` — checks native OR Coordinate-granted keyword.
   - `getEffectiveKeywordValue(state, inst, ownerId, kw)` — native value, then Coordinate-granted.
   - `effectiveHealth(state, inst, ownerId)` — card.health + STAT_BUFF HP bonus.
   - `computePower` updated: Grit check uses `hasEffectiveKeyword`; Coordinate STAT_BUFF attack bonus added.
   - `sentinelFilter` updated: uses `hasEffectiveKeyword` for Sentinel (catches Infantry of the 212th) and Saboteur bypass.
   - `dispatchOnPlay` updated: triggers Coordinate keyword grants (e.g. Coruscant Guard Ambush) after native handlers, if threshold is met.
   - `applyAttackFilters` updated: also runs filter handlers for Coordinate-granted keywords (dedup via `ranFilters` set).

3. **`engine.ts`** — In `applyAttack`:
   - `raidBonus` uses `getEffectiveKeywordValue` (catches Hevy Raid 2, Plo Koon Raid 3).
   - Coordinate `ON_ATTACK_DRAW` fires at attack declaration — draws cards into hand.
   - Coordinate `ON_ATTACK_PREVENT_DAMAGE` sets `preventSelfDamage` flag — attacker skips shield burn and takes 0 damage.
   - Saboteur check uses `hasEffectiveKeyword` (catches Republic Commando).
   - `checkDefeated` uses `effectiveHealth` (accounts for STAT_BUFF HP bonuses from 332nd Stalwart, Echo, 41st Elite Corps).

4. **UI** — `useGame.ts` exposes `playerCoordinateActive: boolean`. `GameBoard` threads it to `YourMat`. `YourMat` shows a green `COORDINATE` badge in the Ground Arena zone label when active.

**Implemented cards (12):**
- STAT_BUFF: 332nd Stalwart (+1/+1), 41st Elite Corps (+0/+3), Clone Heavy Gunner (+2/+0), Echo (+2/+2)
- KEYWORD: Coruscant Guard (Ambush), Hevy (Raid 2), Infantry of the 212th (Sentinel), Luminara Unduli (Grit), Plo Koon (Raid 3), Republic Commando (Saboteur)
- ON_ATTACK_DRAW: Anakin Skywalker (draw 1)
- ON_ATTACK_PREVENT_DAMAGE: Aayla Secura

**Deferred (10 cards) — see `abilities.ts` comments and plan below.**

TypeScript: 0 errors.

*(2026-05-20 session 21)* **Game rules pass: resource mechanic, draw fix, Grit, Saboteur, visual card redesigns.**

Six items implemented:

1. **Regroup draw fix** — `resolveRegroup` now draws exactly 2 cards (`Math.min(2, p.deck.length)`) instead of "draw up to 6."

2. **Resource selection mechanic** — Players now exhaust a hand card face-down during regroup to grow their resource pool. New `RESOURCE_CARD` action type. `hasResourced: boolean` added to `PlayerState`. `getLegalActions` (regroup branch) offers RESOURCE_CARD for each hand card + END_REGROUP (skip). `applyResourceCard` removes the card from hand, increments `resources.total`, marks `hasResourced`, then switches to AI or resolves. `applyEndRegroup` does the same two-phase handoff. AI auto-resources (random pick or skip). `isResourcePhase` exposed from `useGame.ts` — drives amber banner in `YourMat` and "SELECT RESOURCE ↓" status in `DividerBar`.

3. **Grit keyword** — `computePower(state, inst, ownerId)` added to `keywords.ts`. Returns `base_attack + inst.damage` when unit has Grit (live computation so mid-combat pings apply). `applyAttack` in `engine.ts` uses `computePower(...) + raidBonus` instead of raw `card.attack + raidBonus`.

4. **Saboteur keyword** — Two parts: (a) `sentinelFilter` in `keywords.ts` carves out Saboteur attackers before applying Sentinel targeting restriction. (b) `applyAttack` in `engine.ts` strips all defender shield tokens before damage when attacker has Saboteur — tracked via `let defenderShields` local so post-strip value propagates to the shield absorption check without re-reading stale state.

5. **Native landscape BaseCard + LeaderCard** — Eliminated CSS rotation hacks. Both cards redesigned as natively horizontal (flex row: art left, info panel right). `sideways` prop removed from both. `TopOppMat` and `YourMat` callers updated.

6. **Official SWU card back** — `CardBack` rewritten as SVG: deep navy gradient background, two crossing lightsaber beams with gradient strokes + glow filter, "STAR WARS / UNLIMITED" text centered. Old custom "Twin Suns Field Manual" design replaced.

TypeScript: 0 errors after all changes.

*(2026-05-20 session 20)* **Tabletop simulator — full board UI ported from Claude Design.**

Ported the Claude Design prototype (`play-area.html`) into production React components. All interaction still wired to the real 2-player game engine from `useGame.ts`.

New files:
- `frontend/src/app/game/layout.tsx` — imports `play.css` scoped to the game route
- `frontend/src/app/game/PlayCard.tsx` — `PlayCard`, `CardBack`, `BaseCard`, `LeaderCard`, `InitToken`; adapters `toPlayCardProps`, `toBaseData`, `toLeaderData`; hover event bus (`emitHoverCard`)
- `frontend/src/app/game/BoardParts.tsx` — `ResourceLattice`, `CardPile`, `HpReadout`, `Counter`, `Stamp`
- `frontend/src/app/game/DividerBar.tsx` — center bar with round/phase, initiative token, Take Counter button, resource readout, expandable action log
- `frontend/src/app/game/YourMat.tsx` — full player mat (ground arena, base+leaders, space arena, resources, deck/discard/init, hand)
- `frontend/src/app/game/TopOppMat.tsx` — opponent mat with compact header, face-down hand, small arena cards
- `frontend/src/app/game/CardPreview.tsx` — hover preview overlay listening on `twin-suns:hover-card` custom event
- `frontend/src/app/game/TweaksPanel.tsx` — palette (desert/imperial/cantina), vibe (manual/print/holo), exhaust angle slider; persists to `twin_suns_play_tweaks` in localStorage

Rewrote: `frontend/src/app/game/GameBoard.tsx` — orchestrator using all above components; same interaction contract (attack select, play card, deploy leader, take counter).

Modified earlier this session: `engine.ts` `log()` now adds timestamps + critical detection; `types.ts` `LogEntry` gets `time?` and `kind?` fields.

Key implementation decisions:
- `card.aspects.map(a => a.aspect_name)` → Title Case strings for `ts-aspect-pip` data-aspect; lowercase for CSS art gradient variables
- Real card art images used when `image_uri` is present; falls back to aspect-gradient `CardArtFill` 
- Hand card: single tap to select, second tap to play (no separate PLAY button)
- `GameCard.tsx` is now unused (superseded by PlayCard.tsx) but left in place for safety

TypeScript: 0 errors.

*(2026-05-19 session 19)* **Achievements system and Pilot Training.**

14 auto-detected achievements across 4 categories (deck building, collection, social, training). `UserAchievement` model + `user_achievements` table with startup auto-migration. `GET /api/me/achievements` endpoint computes earned state from existing data (deck count, collection size, wishlist, shared decks, all-aspects cross-deck check), persists newly earned rows with `earned_at` timestamp, and returns the full catalog with earned/locked status + total points + current rank. Karabast future hook: `source` field on `UserAchievement` rows, no schema change needed later.

Pilot Training: K1–K4 rank track on the profile Achievements tab now has real lesson content (expandable per rank, toggle open/close). Each rank's gate condition is derived from achievements: K1=first_deck, K2=K1+three_decks, K3=K2+all_aspects, K4=K3+ten_decks. Homepage rank track now connects to live achievement data for authenticated users; shows demo (all-0%) when logged out. `COMING_SOON` updated: Achievements removed (it exists), Karabast Import added.

TypeScript: 0 errors. Backend: achievements router imports clean, 14 achievements defined.

*(2026-05-19 session 18)* **Deck analysis panel, public deck sharing, and export modal with marketplace links.**

Three new features fully implemented across backend and frontend. TypeScript compiles clean (0 errors).

**Deck Analysis** — `DeckAnalysisPanel` component (`src/components/DeckAnalysisPanel.tsx`) added. Computed client-side via `useMemo` from already-loaded deck data. Shows: cost curve (8 buckets, 0–7+, bar chart using `ts-curve-chart` CSS classes), type breakdown (Unit/Event/Upgrade/Other with stacked bar and percentages), aspect distribution (`ts-aspect-pip` per aspect with count), rarity counts (`ts-chip`), weighted average cost, and estimated price total. Price total includes leaders + base + main deck.

**Public deck sharing** — `share_token` UUID column added to `Deck` model with startup auto-migration. Backend: `POST /api/me/decks/{id}/share` (generates/returns token) and `DELETE /api/me/decks/{id}/share` (revokes) in `me.py`. New `backend/src/routes/public_decks.py`: `GET /api/decks/share/{token}` (no auth required). Frontend: Share button in `DeckViewClient` generates token, copies URL to clipboard, shows "✓ Copied!" feedback for 3s; Revoke Link button appears when token is active. New proxy routes: `POST/DELETE /api/me/decks/[id]/share/route.ts` and `GET /api/decks/share/[token]/route.ts`. New pages: `app/decks/share/[token]/page.tsx` (server wrapper) + `PublicDeckViewClient.tsx` (read-only deck view, no auth).

**Export with marketplace links** — `DeckExportModal` component (`src/components/DeckExportModal.tsx`). Three sections: (1) Plain-text deck list grouped by type, sorted by cost, with "Copy to Clipboard" button. (2) "Find Cards" — deduplicated list of all deck cards (leaders + base + main) with per-card TCGPlayer and Card Kingdom search links and price. (3) "Buy What You're Missing" — shown only when authenticated; compares deck quantities against user's collection, lists missing cards with "need Nx" label and estimated cost.

**Pre-existing bug fixed** — `DeckViewClient` was calling `/api/me/decks/${deckId}` but no Next.js proxy route existed there. Created `app/api/me/decks/[id]/route.ts` as the GET proxy.

**Note on UI verification** — Automated preview verification was blocked by a dev environment quirk: the preview backend runs from `backend/` without `DB_DIR` set, so it uses `~/.swu/swu_app.db` (not `./databases/swu_app.db`) with an unknown JWT secret. TypeScript compilation passed clean; backend logs confirmed migration and router load; public 404 endpoint verified. Production deploy will confirm UI correctness.

*(2026-05-16 session 17)* **CardDetail design system migration, uptime monitoring, production deploy.**

`CardDetail.tsx` (deck builder side panel) fully migrated off shadcn `Button` and Lucide icons. All Tailwind classes replaced with `ts-*` CSS vars and inline styles matching the design system. Art variant navigation uses `‹`/`›` characters instead of Lucide chevrons. Flip button uses amber border. Stats block uses amber/red/green `ts-*` accent colors. Keywords and card text use design system typography. Action button uses `ts-btn` with conditional amber/red/disabled states. Empty state uses design system placeholder. Zero new dependencies. Uptime monitoring added as `.github/workflows/uptime_check.yaml` — pings `/health` every 15 minutes via GitHub Actions cron; on failure, sends email via `dawidd6/action-send-mail`. Requires three GitHub secrets: `SMTP_USER`, `SMTP_PASSWORD` (same Gmail app password already in Bitwarden), `ALERT_EMAIL` (chanfriendly@gmail.com). All 🟡 and 🟢 production readiness items now resolved.

*(2026-05-16 session 16)* **Email verification, CSS cleanup, deck name validation, loading skeletons.**

Four items from the backlog: (1) Email verification — `EmailVerificationToken` model + startup migration; `create_email_verification_token` / `consume_email_verification_token` helpers in `auth.py`; `_send_verification_email` in `routes.py`; register now creates + emails a token when an address is provided; `POST /api/auth/verify-email` and `POST /api/auth/resend-verification` endpoints added; Next.js proxy routes for both; `/verify-email?token=...` page (handles loading/success/error states); signup success message updated; profile page shows amber banner with "Resend link" button when email is unverified; `email_verified` added to `UserResponse` and `User` interface in `AuthContext`. Login not blocked for unverified users — warning only (appropriate for household app). (2) Cards page inline `<style>` block moved to `globals.css` — `@keyframes spin`, `.xl-show`, `.xl-hide`. (3) Deck name length validation added to both `create_user_deck` and `update_user_deck` — required, non-empty after strip, max 100 chars. (4) Loading skeletons — shimmer animation (`@keyframes ts-shimmer`, `.ts-skeleton` class) added to `globals.css`; card browser loading state replaced with 24 shimmer cards matching the real grid layout; profile decks tab loading replaced with 6 skeleton deck cards; profile collection tab loading replaced with 24 skeleton card thumbnails. Zero TypeScript errors.

*(2026-05-16 session 15)* **Collection % fix, profile avatar, set filter merging.**

Three UX fixes: (1) Collection completion % on the profile header now shows accurately (was always 100% because the collection endpoint returned owned-only cards, making numerator = denominator). Fix: always fetch `?all_cards=true` for collection data; `showAllCards` toggle now only controls display filtering. (2) Profile avatar feature: `avatar_url` column added to `User` model with startup auto-migration; `PATCH /api/me/profile` endpoint added to `me.py`; Next.js proxy at `PATCH /api/me/profile`; profile header shows avatar image when set, falls back to initials; edit mode has URL input field. (3) Sets filter now merges "X Weekly Play" variants into the parent set display name (Secrets of Power, A Lawless Time, Jump to Lightspeed, Legends of the Force). Merging is dynamic from API data — no hardcoding. Query expansion sends both set names to the backend. Zero TypeScript errors.

*(2026-05-16 session 14)* **Password reset emails working. deploy.sh Portainer redeploy fixed.**

Replaced Resend HTTP API with stdlib `smtplib` + Gmail App Password. Resend was abandoned because `onboarding@resend.dev` can only deliver to the Resend account owner — not arbitrary users. The Portainer YAML was also missing `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, and `SMTP_FROM` (only `SMTP_PASSWORD` was present), so those vars never reached the container. Fixed by syncing `docker-compose.prod.yaml` to Portainer. Password reset emails now deliver to any user's email address. No new Python deps — `smtplib` is stdlib. `deploy.sh` Portainer redeploy also fixed: `.env.prod` had placeholder `REPLACE_WITH_SECRET_FROM_BITWARDEN` for `PORTAINER_PASSWORD` instead of the real value. Updated with actual credentials (single-quoted to handle embedded `"`). Full deploy now automated again.

*(2026-05-15 session 13)* **Password reset email delivery wired. Frontend reset flow added.**

Backend `password_reset_request` endpoint now sends via Resend when `RESEND_API_KEY` env var is set. Falls back to returning token in response body when unset (dev mode / no email on account). Uses `requests` lib (already in deps — no new packages). New frontend pages: `/forgot-password` (username form → request reset) and `/reset-password` (token + new password form → confirm reset). Login page has "Forgot password?" link. Zero TypeScript errors.

*(2026-05-15 session 12)* **Production readiness hardening — all must/should items addressed.**

Full backend security pass: token revocation via `token_version` integer on `User` (incrementing invalidates all existing JWTs); JWT now includes `jti` and `tv` claims; `get_current_user` validates `tv` against DB. `ACCESS_TOKEN_EXPIRE_MINUTES` reduced from 10080 → 1440 (24h). Password reset implemented (DB-backed token, 1-hour expiry, one-time use) — backend complete, email delivery deferred until SMTP configured. `DELETE /api/me/account` added (cascades all user data). `POST /api/auth/logout` now requires auth and calls `revoke_user_tokens`. Startup migration auto-adds `token_version` column to existing DBs. All debug `console.log/warn/debug` stripped from frontend (52 calls removed). `ErrorBoundary` added to `layout.tsx`. Auth cookie upgraded to `SameSite=strict`, 24h maxAge. Logout route now proxies token to backend for server-side revocation. `GalacticGamer77` placeholder removed from profile page. Fake `SPOTLIGHT` deck stats and misleading `STATUS_ITEMS` replaced with accurate copy. `COMING_SOON` updated to remove features that now exist (Collection Tracker, Wishlist). `docker-compose.prod.yaml` `ACCESS_TOKEN_EXPIRE_MINUTES` updated to 1440. New proxy routes: `DELETE /api/me/account`, `POST /api/auth/password-reset-request`, `POST /api/auth/password-reset-confirm`. Zero TypeScript errors.

Three items not fully addressable from code alone — see checklist:
- **HTTPS**: requires NPM configuration on TrueNAS → see checklist item 1
- **Password reset email delivery**: backend implemented, needs SMTP wired up → see checklist item 5
- **App DB backup schedule**: needs cron job on TrueNAS → see checklist item 8

*(2026-05-15 session 11)* **Leader filter fix, wishlist state on dialog open, mobile nav, production readiness audit.**

Second-leader aspect filter bug fixed: was incorrectly requiring the second leader to share a secondary aspect with the first (broke multi-aspect leaders like Tobias/Saw/DJ). Now only enforces Heroism/Villainy exclusion. `CardDetailDialog` now accepts `initialOnWishlist` and `onWishlistChange` props — wishlist state is accurate on open, not always `false`. `cards/page.tsx` fetches wishlist IDs on auth and passes them down. Mobile nav: hamburger (☰/✕) added to Navbar for ≤720px viewports with slide-down menu and outside-click dismiss; desktop nav unchanged. See **Production Readiness Checklist** below for what's left before this can be considered shippable.

*(2026-05-12 session 10)* **Deck list page, My Collection toggle, card detail collection count/remove, DeckViewClient redesign.**

`/decks/page.tsx` created: dedicated deck index with leader image strip thumbnails, aspect pips, sort (date/name), inline delete confirmation, empty state, and "+ New Deck" CTA. `DeckViewClient.tsx` fully rewritten to Twin Suns design system (removed shadcn `Button`, Lucide `AlertTriangle`, gray backgrounds). `cards/page.tsx`: added "◇ My Collection" toggle button — when active, switches card grid to full collection data source (all owned cards at once, no pagination). Collection counts now tracked in a `Map<string,number>` alongside the existing `Set`. `CardDetailDialog`: collection count display with `+`/`−` buttons to add/remove copies inline (backed by `POST /api/me/collection` with count); removing last copy drops card from `userCollection` and filters it out of the My Collection view. Navbar: "My Decks" link added for authenticated users. Zero TypeScript errors. Verified in browser.

*(2026-05-11 session 9)* **Full cards page + components redesigned to Twin Suns design system.**

`cards/page.tsx`, `CardGrid`, `CardFilters`, `CardSearch`, and `CardDetailDialog` all rewritten to use `ts-*` CSS vars and the Imperial Field Manual design system. All shadcn components removed (`Card`, `Button`, `Select`, `Dialog`, `DialogContent`, `Checkbox`, `Label`, `Badge`, `Input`). All Lucide icon imports removed. Key changes: `CardGrid` uses inline styles with `var(--ts-*)` tokens, amber owned badge, ts-stamp "In Deck" overlay; `CardFilters` has custom amber checkbox rows and native `<select>` cost dropdowns; `CardSearch` uses ts-filter-pill active tag chips; `CardDetailDialog` is now self-contained (no shadcn dialog wrappers), with aspect pips, stat blocks using amber/red/green accents, and ts-btn action row; `cards/page.tsx` replaces the shadcn Dialog with a fixed-overlay custom modal, display font page header with eyebrow, and native `<select>` sort dropdown. Zero TypeScript errors. Verified in browser: card grid, sort, filter toggle, and card detail modal all render correctly on the Twin Suns theme.

*(2026-05-07 session 7)* **GitHub workflow updated to deploy card DB to TrueNAS after rebuild.**

Added a `Deploy card database to TrueNAS via Portainer exec` step to `.github/workflows/update_dbs.yaml`. After the existing CI build + artifact upload, the new step authenticates with Portainer, finds the `twinsuns-backend` container by name, creates a Docker exec for `python /app/scripts/build_database.py` with `DB_DIR=/databases/cards_db`, then polls until it finishes (10-min timeout). `continue-on-error: true` keeps the workflow green if TrueNAS is unreachable. **Required GitHub secrets not yet set**: `PORTAINER_URL`, `PORTAINER_USER`, `PORTAINER_PASSWORD`, `PORTAINER_ENDPOINT_ID` — values are in `.env.prod`.

*(2026-05-07 session 6)* **Full production verification complete. 26 pytest tests added. All API flows confirmed working.**

Login, deck CRUD, collection, and wishlist all verified end-to-end via API on production (192.168.1.124:4000). Full deck flow confirmed: create with 2 leaders + base + 10 cards, GET list (leaders/base names resolved), GET by ID (enriched card data), PUT (card replace), DELETE. Collection add/remove confirmed (the "double-click" feature from cards page). Profile tab APIs (collection, wishlist, decks) all return authenticated `[]` for new account. 2,360 cards across all 21 sets confirmed. The `SaveDeckDialog` validates 2 leaders + base + 10 minimum cards before POSTing — correct. Deck builder uses `onClick` (single-click) for leaders/base and explicit `+ ADD` button for the cards stage; no double-click in the builder itself. Confirmed duplicate collection proxy routes (`/api/collection` and `/api/me/collection`) — both point to same backend, `api.ts` consistently uses `/api/me/collection`. No issues found.

*(2026-05-07 session 5)* **Login bug fixed. Card database rebuilt (1,398 → 2,360 cards). deploy.sh hardened.**

Login was broken in production: `auth_token` cookie was set with `Secure: true` but the app runs over plain HTTP, so browsers silently discarded the cookie. Every `/api/auth/me` check returned "Not authenticated". Fixed by setting `secure: false` in both `/api/auth/token/route.ts` and `/api/auth/login/route.ts`. The `deploy.sh` Portainer redeploy was also silently failing: the password in `.env.prod` contained `"` which broke both shell `source` parsing and curl JSON body construction. Rewrote `portainer_redeploy()` as an embedded Python script. Also fixed: was reading `StackFileContent` from stack GET (empty in current Portainer version) — now uses `/api/stacks/{id}/file` endpoint. Frontend healthcheck fixed: `localhost` → `127.0.0.1` (Alpine `wget` resolves `localhost` to IPv6 `[::1]` but Next.js standalone only listens on IPv4). Card DB rebuilt locally and via `build_database.py` exec'd inside the backend container — 2,360 cards across 21 sets including new Set 5 (A Lawless Time) and Set 6 (Secrets of Power). Both sets were released after the last DB build (2025-06-26).

*(2026-05-06 session 4)* **Repo cleanup + security hardening.** Deleted ML stubs. Removed backend port 8000 host-binding from prod compose (no longer publicly accessible — internal Docker network only). Deleted `create-test-user` and `debug-login` endpoints (both unauthenticated, exposed known credentials). Wired in `RateLimitMiddleware` at 120 req/min globally; added 10-attempt/min per-IP rate limit on `/api/auth/token` and `/api/auth/register`. Fixed `X-Forwarded-For` spoofability in rate limiter. **Still unverifiable from code**: whether Portainer port 9004 is firewalled at the router — if internet-accessible, that remains the highest-risk surface. Deleted `backend/src/utils/vector_db.py`, `backend/scripts/build_vector_db.py`, and `backend/scripts/rules_parser.py` (ML stubs not wired into anything). Removed stale comment about `NEXT_PUBLIC_API_URL` from `docker-compose.prod.yaml`. Updated CLAUDE.md to remove references to deleted files. `_cleanup_backup/` was already gone. `frontend/src/lib/utils.ts` kept — still used by `src/components/ui/` shadcn components. CHANGELOG.md updated. All PROGRESS.md cleanup items resolved.

*(2026-05-06 session 3)* **Production stack fully operational. Deploy workflow automated — no more manual Portainer step.** Fixed `INTERNAL_API_URL` missing from Portainer stack (was `http://localhost:8000` fallback inside container). `deploy.sh` now authenticates with Portainer API and triggers stack redeploy automatically after push. `docker-compose.prod.yaml` is now the single source of truth (synced with Portainer). Deleted dead `frontend/src/lib/config.ts` (referenced `NEXT_PUBLIC_API_URL` but was never imported — api.ts already uses relative URLs). `frontend/public/.gitkeep` added so Docker build doesn't fail on missing `public/` dir. Full smoke test passed: cards/aspects/types/sets/keywords all 200 on production at `192.168.1.124:4000`. Deploy workflow is now: `./deploy.sh` → done (no Portainer visit needed).

*(2026-05-06 session 2)* **Profile page design pass complete. ML deps split out. All TypeScript errors cleared.** Profile page fully on Twin Suns design system. `requirements-ml.txt` created. Fixed Docker `INTERNAL_API_URL` missing from dev compose (cards wouldn't load in Docker mode). Fixed `stats/route.ts` using wrong env var. Fixed `DeckBuilderClient` `power`/`hp` → `attack`/`health` — **frontend now compiles with zero TypeScript errors**. Production stack is down on TrueNAS (port 4000 connection refused, SSH 24 not responding) — needs manual restart via Portainer before `./deploy.sh` results are visible.

*(2026-05-06)* **Twin Suns Imperial Field Manual design system fully implemented. Wishlist feature live (full stack).** PR #3 merged into `development`. No regressions introduced; pre-existing TypeScript errors in `decks/[id]/route.ts` (Next.js params type) and `DeckBuilderClient.tsx` (`power`/`hp`) are unchanged. Backend `user_wishlist` table auto-creates on next startup via `create_all` — no migration script needed.

*(2026-05-05)* **Production stack rebuilt and operational after cryptominer incident.** Both `twinsuns-backend:local` and `twinsuns-frontend:local` images rebuilt from `--no-cache` using rsynced clean local source. Stack started via `docker-compose.prod.yaml`. Smoke test passed: cards/aspects/types return data, collection/decks return 401 (correct). Stack healthy at `192.168.1.124:4000`.

*(2026-05-05)* **Local dev smoke test complete.** Fixed `PORT=8000` bug in `.env.dev` that caused Next.js to start on port 8000 (conflicting with uvicorn). Local dev environment is stable: frontend on `:3000`, backend on `:8000`. Full end-to-end flow verified: login → deck builder renders → leaders load (2,360 total cards) → aspect filtering logic confirmed → deck CRUD works via API → cards page works with all filters. No console errors.

*(2026-05-04)* **Repo integration complete.** `twin-suns-databases` merged into this repo. All hardcoded `~/.swu` paths replaced with `DB_DIR`. TypeScript clean. **`twin-suns-databases` repo can now be archived.**

*(2026-05-04)* **Production stack is fully operational.** JWT secret rotated. All containers running on TrueNAS (`192.168.1.124:4000`). Smoke test passed: 1398 cards loading, aspects/types/keywords/sets all return data.

---

## What's Done

- [x] **[2026-05-20] Event parser + attack-event flow** — `parseEventText` regex parser (~47 events auto-covered); `getEventEffect` registry+fallback lookup; `TRIGGER_ATTACK_WITH` / `DEFEAT_UNIT` / `DEAL_DAMAGE_OPP_BASE` effect types; `PLAY_ATTACK_EVENT` action type; `defeatUnitByIid` helper; `applyPlayAttackEvent` (pays event, applies temporary phaseAtk/hpBonus buff, executes attack, removes buff); `getLegalActions` generates `PLAY_ATTACK_EVENT` per (event × filtered-attack) pair; `computePower` clamped to Math.max(0) so debuffs can't push attack negative; full two-step UI state machine in `GameBoard` (`pendingAttackEventIid` → pick attacker → pick defender); `YourMat` updated for attack-event card highlighting and banner.

- [x] **[2026-05-20] Leader abilities + event card effects + targeting mode** — `LEADER_ABILITY` action type; `AbilityEffect`/`TargetKind` type system; `LEADER_ABILITIES` and `EVENT_EFFECTS` registries; `applyLeaderAbility`; event effects resolved in `applyPlayCard`; `phaseAtk/phaseHp` on `CardInstance` (cleared at regroup); `LeaderInstance.exhausted` (cleared at regroup); `GameBoard` targeting state machine with `pendingLeaderAbilityId`/`pendingEventIid`; ABILITY button + targeting highlights in `YourMat`; exhausted leader visual in `LeaderCard`.

- [x] **[2026-05-20] UI polish pass** — Resources portrait/landscape orientation with card-back art (`ResCard`, SVG crossed lines, no ID collision). Opponent mat resource lattice. `BaseCard`/`LeaderCard` redesigned as full-bleed image cards (HP overlay bar on base, deployed overlay on leader). "Take Initiative" label for 1v1. Card hover text fixed (data pipeline complete: backend arenas/traits enrichment → full deck fetch on game start → `text` field through `toPlayCardProps`/`toBaseData`/`toLeaderData`).

- [x] **[2026-05-20] 5 gameplay bugs fixed** — Root cause: setup screen used slim deck list endpoint missing `type`, `energy_cost`, `arenas`, `text`. Fixed by: (1) backend `enrich_card_with_relationships` adds arenas + traits; (2) frontend fetches full deck detail (`/api/decks/{id}`) before game start; (3) `BaseCard`/`LeaderCard` hover data includes `image_uri` + `text`.

- [x] **[2026-05-20] Coordinate keyword** — `abilities.ts` registry + `isCoordinateActive` + `hasEffectiveKeyword` + `effectiveHealth`. 12 cards implemented across 4 effect types. `applyAttackFilters` extended to dispatch Coordinate-granted filter keywords. UI shows green COORDINATE badge in arena label when threshold met.

- [x] **[2026-05-20] Regroup draw fix** — `resolveRegroup` draws exactly 2 cards, not "up to 6."
- [x] **[2026-05-20] Resource selection mechanic** — `RESOURCE_CARD` action + `hasResourced` flag on `PlayerState`. Regroup phase now prompts player to exhaust a hand card face-down (or skip). AI auto-resources random card. Resource total grows by 1 per card placed; readied each round. `isResourcePhase` exposed from `useGame.ts`; drives amber banner in `YourMat` and "SELECT RESOURCE ↓" label in `DividerBar`.
- [x] **[2026-05-20] Grit keyword** — `computePower()` helper in `keywords.ts` returns `base_attack + damage_counters` when unit has Grit (continuous, live computation). `applyAttack` in `engine.ts` uses this for attack power.
- [x] **[2026-05-20] Saboteur keyword** — (1) `sentinelFilter` carves out Saboteur attackers before Sentinel restriction applies. (2) `applyAttack` strips all defender shield tokens before damage when attacker has Saboteur; uses `let defenderShields` local to propagate the post-strip value to shield absorption without stale reads.
- [x] **[2026-05-20] Native landscape BaseCard + LeaderCard** — Both redesigned as natively horizontal (flex row: art left, stats right). Removes CSS rotation hack and makes HP/stats text naturally readable. `sideways` prop removed.
- [x] **[2026-05-20] Official SWU card back** — `CardBack` rewritten as SVG with deep navy gradient, crossing lightsaber beams with glow filter, and "STAR WARS / UNLIMITED" text.

- [x] **[2026-05-19] Achievements system + Pilot Training** — `UserAchievement` model, `user_achievements` startup migration, `GET /api/me/achievements` endpoint (lazy eval, INSERT OR IGNORE), 14 achievements across 4 categories. Profile Achievements tab: rank panel with expandable K1–K4 lesson content, achievement grid with locked/earned states. Homepage rank track connected to live API. Karabast `source` hook designed in.
- [x] **[2026-05-19] Set code grouping fix** — card query sort now includes `set_order_case ASC` tiebreaker on all sort modes; original printing always wins as grouped primary. Fixes 11 reprinted cards (Open Fire, Resupply, Tactical Advantage, etc.) incorrectly showing TWI set code.
- [x] **[2026-05-19] Deck analysis panel** — `DeckAnalysisPanel` component: cost curve, type breakdown, aspect distribution, rarity counts, estimated price. Client-side `useMemo`. Used in both authenticated deck view and public share view.
- [x] **[2026-05-19] Public deck sharing** — `share_token` on `Deck` model with startup migration; `POST/DELETE /api/me/decks/{id}/share`; `GET /api/decks/share/{token}` (no auth); Share/Revoke buttons; `PublicDeckViewClient` page.
- [x] **[2026-05-19] Export modal with marketplace links** — `DeckExportModal`: plain-text deck list (TCGPlayer format: `N Name - Subtitle [SET]`), TCGPlayer + Card Kingdom per-card links, "Buy What You're Missing" collection diff.
- [x] **[2026-05-06] DeckBuilderClient `power`/`hp` → `attack`/`health` — zero TypeScript errors**
  - Frontend now compiles clean with no errors at all
- [x] **[2026-05-06] Docker dev compose: add missing `INTERNAL_API_URL=http://backend:8000`**
  - Without this, Next.js route handlers fall back to `localhost:8000` inside the container (wrong); cards/aspects/etc. all fail
  - Also fixed `stats/route.ts` which used `NEXT_PUBLIC_API_URL` server-side instead of `INTERNAL_API_URL`
- [x] **[2026-05-06] Profile page — full Twin Suns design system rewrite**
  - All shadcn components removed from `profile/page.tsx` (Avatar, Badge, Button, Card, Input, Switch, Tabs — Radix Tabs primitives kept for state, styled with `ts-tabs-list`/`ts-tab-trigger`)
  - `framer-motion` and all Lucide icon imports removed
  - `DeckCard`, `CollectionCard`, profile header, tab nav, all empty/loading/error states rewritten with `ts-*` CSS vars and design system patterns
  - `handleAddToCollection` bug fixed: was checking `.ok` on parsed JSON (always false), now uses try/catch on `fetchWithAuth`
- [x] **[2026-05-06] ML dependencies split to `requirements-ml.txt`**
  - `torch`, `sentence-transformers`, `qdrant-client`, `transformers`, `numpy` removed from `requirements.txt`
  - `backend/requirements-ml.txt` created — install separately when working on AI features
- [x] **[2026-05-06] `.env.dev` / `.env.prod` unstaged from git index**

- [x] **[2026-05-06] Twin Suns design system — Imperial Field Manual** (PR #3)
  - `globals.css` + `layout.tsx`: full `--ts-*` CSS custom property system; Cormorant Garamond (display), Spectral (body), JetBrains Mono (data/code) fonts
  - `page.tsx`: hero rewrite with absolute-positioned twin suns (radial gradient circles), scanlines overlay (`repeating-linear-gradient`), left vignette, correct copy, Deck of the Cycle spotlight, Pilot Training rank tracks
  - `Navbar.tsx`: full redesign with Twin Suns branding
  - `login/page.tsx` + `signup/page.tsx`: removed all shadcn/lucide; restyled with `ts-*` classes, Callsign/Security Code/Comm Channel labels, amber CTA buttons, red/green error/success panels
  - `DeckBuilderClient.tsx`: design system integration
  - `icon.svg`: twin suns favicon (amber + red circles); served automatically by Next.js App Router
  - `HandSimModal.tsx`: extracted as standalone component; mulligan mode adds editable opponent leader name input (`<input>` with borderBottom-only style)

- [x] **[2026-05-06] Profile — collection completion % stat**
  - `profile/page.tsx`: `completionPct` computed from `collection` state when `showAllCards=true` data is loaded; amber stat chip rendered in profile header showing `XX.X% · N / M cards`

- [x] **[2026-05-06] Wishlist — full stack** (PR #3)
  - `backend/src/database/models.py`: `UserWishlist` model (`user_id` PK, `card_id` PK, `added_at`); relationships on `User.wishlist` and `Card.wishlist_entries`
  - `backend/src/routes/me.py`: `GET /me/wishlist`, `POST /me/wishlist` (idempotent), `DELETE /me/wishlist/{card_id}`; returns enriched card data
  - `frontend/src/app/api/me/wishlist/route.ts`: GET + POST Next.js proxy
  - `frontend/src/app/api/me/wishlist/[cardId]/route.ts`: DELETE proxy (correct Next.js 15 `Promise<params>` pattern)
  - `profile/page.tsx` Wishlist tab: replaced Coming Soon panel with live card grid (`WishlistCard` mini-cards with aspect-gradient backgrounds, ✕ remove button, empty state + Browse CTA)
  - `CardDetailDialog.tsx`: "☆ Add to Wishlist" / "★ On Wishlist" toggle button in dialog footer

- [x] **[2026-05-04] Repo integration — twin-suns-databases merged in**
  - `backup_db.py` → `backend/scripts/backup_db.py` (updated to use `DB_DIR`)
  - `.github/workflows/update_dbs.yaml` created (Monday 2 AM card DB rebuild)
  - `databases/` canonical directory at repo root (`.gitkeep` tracked, `.db` files gitignored)
  - All hardcoded `~/.swu` paths eliminated — `DB_DIR` env var used everywhere
  - `swu_api_client.py` bug fixed: `_get_db_connection` was overwriting `self.database_path`
  - `docker-compose.yaml` paths updated: `/data/.swu` → `/data`
  - `dev.sh` overrides `DB_DIR` to `./databases/` for native dev after loading `.env.dev`
  - `_cleanup_backup/` deleted
  - TypeScript compiles clean

- [x] **[2026-05-05] Local dev smoke test — all pages and API flows verified**
  - `.env.dev` `PORT=8000` bug fixed — was causing Next.js to start on 8000, conflicting with uvicorn
  - Frontend `:3000`, backend `:8000`, all proxy routes verified (calls go through Next.js, not directly to FastAPI)
  - Cards page: 2,360 cards, all filter categories present (type, aspects, keywords, sets)
  - Deck builder: leaders load, `leadersShareAspects()` filtering logic confirmed in code
  - Auth: register, login, JWT token flow all work
  - Deck CRUD: create, read, delete verified via API
  - TypeScript: 0 errors

- [x] **[2026-05-04] Full production smoke test — stack operational at 192.168.1.124:4000**
- [x] JWT secret rotated on production server; `.env.prod` removed from git and gitignored
- [x] Production-side `DB_DIR` env var added to server compose (backend was falling back to `~/.swu`)
- [x] `types.py` import bug fixed on server: `get_app_db` → `get_card_db` (still needs git commit on server side — server source was patched in-place)
- [x] Old frontend image replaced: rewrote proxy approach from broken `localhost:8000` rewrites to route handlers; rebuilt image on TrueNAS
- [x] All frontend route handlers synced to TrueNAS (`rsync`); image rebuilt and deployed
- [x] Both containers now on same Docker network (`twinsuns_network`); DNS resolution working
- [x] Initial project setup (FastAPI backend + Next.js frontend) — *before 2026-05-04*
- [x] Card database import from official SWU API (1,398+ cards) — *before 2026-05-04*
- [x] Card browsing with search, filtering, sorting — *before 2026-05-04*
- [x] Card grouping by name+subtitle+type (art variant merging) — *before 2026-05-04*
- [x] JWT authentication (register, login, me, logout) — *before 2026-05-04*
- [x] User collection tracking (double-click to add) — *before 2026-05-04*
- [x] Deck builder UI and backend routes (partially — router disabled) — *before 2026-05-04*
- [x] Docker production deployment pipeline (MacBook → Docker Hub → TrueNAS/Portainer) — *2026-05-04 (stabilized)*
- [x] Session 0: CLAUDE.md, CHANGELOG.md, PROGRESS.md created — *2026-05-04*
- [x] `frontend/src/lib/` reconstructed: `utils.ts`, `fetch-utils.ts`, `api.ts` — *2026-05-04*
- [x] Auth token cookie sync added to `fetchWithAuth` (localStorage → cookie for server-side route handlers) — *2026-05-04*
- [x] Four Next.js route handlers fixed: `await cookies()` (Next.js 15 requirement) — *2026-05-04*
- [x] Two route handlers fixed: `NEXT_PUBLIC_API_URL` → `INTERNAL_API_URL` for server-side proxying — *2026-05-04*
- [x] `decks.py` variable name bug fixed (parameter was `get_current_user` instead of `current_user`) — *2026-05-04*
- [x] `main.py` clarified: decks.py disabled intentionally; me.py handles all deck CRUD at `/api/me/decks` — *2026-05-04*
- [x] `cards/page.tsx`: `item.card_id` → `item.card.id` (collection items have nested card object) — *2026-05-04*
- [x] TypeScript compiles clean (0 errors) — *2026-05-04*

---

## What's Next

**Priority order — top item is immediately actionable:**

1. **UAT: Full tabletop simulator match** — User will play a complete game and report what doesn't work. Known areas to exercise: Coordinate ability flows (Kit Fisto, Padmé Pursuing Peace, Reckless Torrent, Clone Commander Cody, Clone Dive Trooper), attack-event two-step (Shoot First / One Way Out / Vanquish), resource hover during gameplay, leader abilities (Chirrut, Admiral Ackbar). After the match, address reported issues before moving to new features.

2. **Play-test the event parser** — Run a game with an "Attack with a unit" event (e.g. Improvised Detonation, Breaking In, Shoot First, One Way Out) and verify the two-step attack-event flow works. Verify debuffs (–N/–N cards) apply correctly. Verify Vanquish/Lost and Forgotten defeat instantly. The registry now covers ~70 events; confirm the "effect not yet implemented" fallback is rare in practice.

3. ~~**Expand the event registry for common misses**~~ **✅ DONE (session 29).** ~30 new entries added: draw/tutor events, damage events, attack-boost events (Outflank, Punch It, Flash the Vents, etc.), debuffs, and heals. Multi-clause and type-specific events approximated with primary effect.

4. ~~**Deferred Coordinate cards now unblocked by targeting system**~~ **✅ DONE (session 27).** Kit Fisto, Padmé Pursuing Peace, Reckless Torrent, Clone Commander Cody, and Clone Dive Trooper all resolved via the new parser-driven Category B effect system. Browser play-test still needed to confirm UI flows.

5. ~~**AI improvements**~~ **✅ DONE (session 29).** AI rewritten from a 5-priority chain to a per-action score system. Now uses `computePower`/`effectiveHealth` for accurate kill-shot detection, evaluates trade quality (favorable/neutral/bad), plays events and uses leader abilities, and scores base attacks by proximity to win condition. Resource selection updated to pick lowest-cost card. See CHANGELOG for full details.

6. **Deploy sessions 21–29 to production** — `./deploy.sh`. All game engine sessions are frontend-only, no schema changes. `resourcePile` on `PlayerState` is in-memory only — not persisted — so no migration needed.
7. **Verify achievements in production** — navigate to Profile → Achievements tab; confirm rank panel shows with lesson content, achievement grid loads; build a deck and refresh to confirm `first_deck`/`rank_k1` earned.
8. **Consider adding `/decks/share/[token]` discoverability** — no entry point from the public side yet.

---

### Coordinate keyword — 17 of 22 cards implemented (parser-driven)

**Implemented session 22 (Category A) and session 27 (Category B).** Architecture is now `getCoordinateAbilities(card)` = registry-first / parser-fallback. The parser handles all 9 known phrasing templates; future cards using existing templates land without code changes. Manual registry entries are overrides only.

**Category A (12 cards)** — STAT_BUFF, KEYWORD grant, ON_ATTACK_DRAW, ON_ATTACK_PREVENT_DAMAGE. Originally registry-only; the parser now also matches all of them.

**Category B (5 cards, session 27)** — Kit Fisto, Padmé (Pursuing Peace), Reckless Torrent, Clone Commander Cody, Clone Dive Trooper. Parser-extracted; not in the registry.

**Category C — still blocked, 5 cards.** These are not parser-fixable — each needs a new engine subsystem. Full architectural notes in the doc comment at the top of `frontend/src/lib/game-engine/abilities.ts`.

| Card | Effect | Engine subsystem needed |
|------|--------|---------|
| Ki-Adi-Mundi | When opponent plays second card each phase: draw 2 | **Triggered-ability dispatch.** Engine event bus (CARD_PLAYED, ATTACK_DECLARED, …), per-phase counters on PlayerState, `TriggeredAbility` type. |
| Pelta Supply Frigate | When Played: create a Clone Trooper token | **Token system.** `isToken: boolean` on CardInstance, `TokenDefinition` registry (name → stat/keyword profile), defeat path that removes tokens entirely. |
| Sanctioner's Shuttle | When Played: capture an enemy unit (cost ≤3) | **Capture zone.** `captureZone: CardInstance[]` on PlayerState with provenance, `CAPTURE_UNIT` effect, defeat hook on capturer releases captives. |
| Ahsoka Tano (Leader) | Action [Exhaust]: attack with a unit, it gets +1/+0 | **Leader-as-attack-trigger.** Route a leader action through the existing PLAY_ATTACK_EVENT two-step flow (TRIGGER_ATTACK_WITH already exists for events). |
| Padmé Amidala (Serving the Republic, Leader) | Action [1, Exhaust]: search top 3 for Republic card | **Deck search UI.** `SEARCH_DECK_TOP { count, filter }` effect, "look at top N" modal, deck-reorder back-on-bottom flow. |
| For The Republic (Upgrade) | Attached unit gains Coordinate Restore 2 | **Upgrades as Coordinate sources.** Extend `getCoordinateAbilities` to aggregate effects from `inst.upgrades[*].card`; add Restore-as-keyword support on host. |

---

## What's Blocked

- **AI/ML features** — No spec. ML stub files deleted (session 4). `requirements-ml.txt` retains the deps for when this is revisited. Block until product decision on what Phase 2 AI features actually look like.
- **Offline/PWA support** — Listed in README as planned. No progress. Not a priority until core features are stable.

---

## Failed Approaches

- **Docker multi-service troubleshooting** — Multiple iterations (`741860e` through `7d4eb33`) on getting Docker networking right. Key lesson: dev compose uses `twinsuns_network`, prod uses `twinsuns` — they are different and cannot be mixed. The `INTERNAL_API_URL` (container-to-container) vs `NEXT_PUBLIC_API_URL` (browser-facing) distinction is critical and easy to swap accidentally.
- **Decks router** — The decks router was likely disabled to isolate a crash during the Docker troubleshooting phase. The variable name bug (`current_user` vs `get_current_user`) is probably the root cause. Do not simply uncomment — fix the bug first.

---

## Production Readiness Checklist

What needs to be resolved before this is genuinely shippable. Grouped by severity.

### 🔴 Must-fix before sharing with anyone outside the household

| # | Area | Issue | Fix |
|---|------|-------|-----|
| 1 | **Security** | ~~**No HTTPS.**~~ **✅ DONE** | NPM configured on TrueNAS with Let's Encrypt cert for `twinsuns.chanfriendly.duckdns.org`. |
| 2 | **Security** | ~~No CSRF protection.~~ **✅ DONE** | `SameSite=strict` added to auth cookie in both login and token routes. |
| 3 | **Security** | ~~No token revocation. 7-day JWTs.~~ **✅ DONE** | `token_version` on User model; JWT includes `tv` claim; logout bumps version; `ACCESS_TOKEN_EXPIRE_MINUTES` reduced to 1440 (24h); both backend logout and frontend logout route updated. |
| 4 | **Security** | **Portainer at `:9004` may be internet-accessible.** | Verify at router: port 9004 must NOT be in the port-forwarding table. **Confirmed not forwarded per your response.** |
| 5 | **Auth** | ~~**Password reset — email delivery wired, needs env vars set in prod.**~~ **✅ DONE** | Switched from Resend to Gmail SMTP (`smtplib`, no new deps). Portainer env vars set: `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_FROM`, `APP_BASE_URL`. Reset emails deliver to any user address. |

### 🟡 Should-fix before calling this "done"

| # | Area | Issue | Fix |
|---|------|-------|-----|
| 6 | **Auth** | ~~**No email verification.**~~ **✅ DONE** | `EmailVerificationToken` model; token sent on register (SMTP) or returned in response (dev); `POST /api/auth/verify-email` + `POST /api/auth/resend-verification`; profile page shows unverified banner; login not blocked (warning only). |
| 7 | **Auth** | ~~No account deletion.~~ **✅ DONE** | `DELETE /api/me/account` added to backend (cascades all user data, bumps token_version). Proxy route at `DELETE /api/me/account` added. |
| 8 | **Data** | ~~**`swu_app.db` has no production backup schedule.**~~ **✅ DONE** | Cron added to `truenas_admin` crontab on TrueNAS: `0 3 * * * docker exec twinsuns-backend python /app/scripts/backup_db.py >> /mnt/volume1/docker/twinsuns/backup.log 2>&1`. Runs daily at 3 AM. Backup log at `/mnt/volume1/docker/twinsuns/backup.log`. |
| 9 | **Input validation** | ~~**No length limits on user-submitted strings.**~~ **✅ DONE** | Username max 32 chars. Deck name: required, non-empty, max 100 chars — validated in both `create_user_deck` and `update_user_deck`. |
| 10 | **Frontend** | ~~52 `console.log` calls.~~ **✅ DONE** | All `console.log/warn/debug` stripped. `console.error` in catch blocks retained. |
| 11 | **Frontend** | ~~No error boundary.~~ **✅ DONE** | `ErrorBoundary` component added at `src/components/ErrorBoundary.tsx`, wired into `layout.tsx`. |
| 12 | **Fake data** | ~~Fake STATUS_ITEMS and SPOTLIGHT.~~ **✅ DONE** | `STATUS_ITEMS` replaced with accurate copy. `SPOTLIGHT` fake deck stats removed; replaced with "coming soon" placeholder. `COMING_SOON` list updated (Collection Tracker and Wishlist removed — they exist now). |
| 13 | **Fake data** | ~~`GalacticGamer77` flash.~~ **✅ DONE** | `defaultUserProfile` now initializes with empty strings. |

### 🟢 Nice-to-have / polish

| # | Area | Issue |
|---|------|-------|
| 14 | **UX** | ~~Cards page sidebar inline `<style>` block → globals.css.~~ **✅ DONE** | `@keyframes spin`, `.xl-show`, `.xl-hide` moved to `globals.css`. |
| 15 | **UX** | ~~`CardDetail.tsx` shadcn/Lucide.~~ **✅ DONE** | Full rewrite using `ts-*` CSS vars. No shadcn, no Lucide. Art nav, flip button, stats, keywords, action button all on design system. |
| 16 | **UX** | ~~No loading skeleton / placeholder images.~~ **✅ DONE** | `ts-skeleton` shimmer class in `globals.css`; card browser, profile decks tab, and profile collection tab all use skeleton grids on load. |
| 17 | **Ops** | No structured logging or request tracing. Errors surface only in container stdout. |
| 18 | **Ops** | ~~No uptime monitoring.~~ **✅ DONE** | `.github/workflows/uptime_check.yaml` — pings `/health` every 15 min, emails alert on failure. Requires GitHub secrets: `SMTP_USER`, `SMTP_PASSWORD`, `ALERT_EMAIL`. |
| 19 | **Auth** | ~~No change-password endpoint (authenticated users must use reset flow).~~ **✅ DONE** | `PATCH /api/me/password` added (requires current_password + new_password, bumps token_version to invalidate other sessions). Frontend proxy at `/api/me/password`. Profile page UI not yet wired — see item 22. |
| 20 | **Auth** | ~~No email-update endpoint (typo at registration = permanently stuck).~~ **✅ DONE** | `PATCH /api/me/email` added (requires current_password, validates format, checks uniqueness, resets email_verified, sends verification email). Frontend proxy at `/api/me/email`. Profile page UI not yet wired — see item 22. |
| 21 | **Security** | ~~`avatar_url` accepted any string.~~ **✅ DONE** | `PATCH /api/me/profile` now rejects `avatar_url` that doesn't start with `https://`. |
| 22 | **UX** | ~~Profile page has no UI for change-password or change-email.~~ **✅ DONE** | "Security" tab added to profile page. Two forms: Change Password (current + new + confirm, client-side validation, auto-logout on success since token_version is bumped) and Change Email (current password + new email, shows verification email notice on success). Both wire to existing proxy routes at `PATCH /api/me/password` and `PATCH /api/me/email`. TypeScript: 0 errors. |
| 23 | **Security** | ~~`typescript: { ignoreBuildErrors: true }` in `next.config.ts`.~~ **✅ DONE** | Removed — `tsc --noEmit` confirmed 0 errors. Build will now fail on TypeScript errors, as it should. |
| 24 | **Security** | ~~Missing Referrer-Policy and Permissions-Policy headers.~~ **✅ DONE** | Both added to `next.config.ts` security headers block. |
| 25 | **Legal** | ~~No fan-site disclaimer.~~ **✅ DONE** | Disclaimer added to homepage footer: "Fan-made tool. Not affiliated with or endorsed by FFG, Asmodee, or Lucasfilm Ltd." |
| 26 | **Ops** | ~~Docker images only tagged `:latest` — no rollback path.~~ **✅ DONE** | `deploy.sh` now tags each build with both `:latest` and the git SHA. To roll back: `docker pull <image>:<sha>`, retag as `:latest`, redeploy. |

### 🔵 Infrastructure — requires hands-on access (cannot be done from code)

| # | Area | Issue | Action needed |
|---|------|-------|---------------|
| 27 | **Security** | **No HSTS header.** Without it, browsers won't cache the HTTPS requirement and SSL-stripping attacks are possible on first connection. | Set `Strict-Transport-Security: max-age=63072000; includeSubDomains` in Nginx Proxy Manager → Advanced → Custom Nginx config for the `twinsuns.chanfriendly.duckdns.org` proxy host. |
| 28 | **Ops** | ~~**TLS cert expires 2026-07-01.**~~ **✅ DONE** | Cert manually renewed 2026-05-21. Check NPM UI → SSL for new expiry date and confirm auto-renewal is enabled so this doesn't require manual action next cycle. |
| 29 | **Data** | ~~**Backups are single-site.**~~ **✅ DONE** | Verified: `backup.sh` on TrueNAS explicitly includes `twinsuns` in its docker services loop — `/mnt/volume1/docker/twinsuns/` → `/mnt/backup/docker/twinsuns/` daily, then `mirror.sh` syncs `/mnt/backup/` → Proxmox DAS weekly. Off-site chain is intact. |
| 30 | **Security** | ~~**No Content Security Policy (CSP).**~~ **✅ DONE (baseline)** | Added CSP header to `frontend/next.config.ts`: `default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' cdn.jsdelivr.net data: blob:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'`. `unsafe-inline` required for Next.js/Tailwind. For a stricter nonce-based policy, move to NPM → Advanced → Custom Nginx config. |
| 31 | **Ops** | ~~**No dependency security scanning.**~~ **✅ DONE** | Created `.github/dependabot.yml` — weekly scans for pip (backend), npm (frontend), and github-actions. PRs open on Mondays, limit 5 per ecosystem. Review and merge/dismiss alerts weekly. |
| 32 | **Ops** | ~~**No structured logging.**~~ **✅ DONE** | Added `_JsonFormatter` + `_configure_logging()` to `backend/src/api/main.py`. Each log line is now a single JSON object: `{"ts": ..., "level": ..., "logger": ..., "msg": ...}`. Zero new dependencies (stdlib only). Works with any log driver that reads container stdout (Loki, ELK, etc.). File-based logging not added — add a volume mount and a `FileHandler` if a log aggregator isn't in play. |

---

## Notes for Next Session

- **Deploy is now fully automated**: `./deploy.sh` builds, pushes to Docker Hub, and triggers Portainer redeploy. No manual steps. Portainer credentials are in `.env.prod`.
- **Production Portainer stack** is ID 94, endpointId 3, at `https://192.168.1.124:9004`. The compose file in Portainer is now synced with `docker-compose.prod.yaml` on disk. `deploy.sh` overwrites the Portainer compose on every deploy — so always edit on disk, not in the Portainer UI.
- **Portainer stack env vars** (set in Portainer UI, not the compose file): `JWT_SECRET`, `DATABASE_PATH`, `ACCESS_TOKEN_EXPIRE_MINUTES`, `CORS_ALLOWED_ORIGINS`. These are preserved by `deploy.sh` (fetched via API and re-submitted). Don't add new required vars here without updating `deploy.sh` or the compose defaults.
- **Database layout on TrueNAS**: `swu_app.db` lives at `/mnt/volume1/docker/twinsuns/databases/app_db/swu_app.db`, card DB at `.../cards_db/swu_cards.db`. These paths are hardcoded in `docker-compose.prod.yaml` since they're TrueNAS-specific.
- `.env.prod` secrets (`JWT_SECRET`, `PORTAINER_PASSWORD`) now stored in Bitwarden as `twinsuns-jwt-secret` and `twinsuns-portainer`. `.env.prod` contains placeholder values. `deploy.sh` fetches from Bitwarden when `BW_SESSION` is set; falls back to `.env.prod` for backwards compatibility.
- When testing decks, use Swagger at `:8000/docs` to test backend directly before testing via the frontend proxy.
- The `_cleanup_backup/` directory at project root is safe to delete — old pre-architecture files, nothing recoverable.
