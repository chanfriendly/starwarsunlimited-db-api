# PROGRESS.md

**Update this at the end of every session. A stale PROGRESS.md is actively harmful.**

---

## Current Status

### ▶ NEXT STEPS (start of next session)

**(2026-06-07) Condemn done + On-Attack-before-combat ordering COMPLETE (all paths) → deck 49/52 (94%). READY FOR PLAYTEST (Christian's plan).** Condemn forced the big one: On-Attack triggered abilities now resolve BEFORE combat damage (§7.x) on EVERY path — `resolveAttack` split into `declareAttack`/`resolveCombat` with a `settle` between (player path in the reducer; nested ability-attacks + Ambush via a `DeclaredAttackResolver` the reducer injects into attack.ts, with pending-trigger-queue isolation for re-entrancy safety). Fuzz 2000 clean. **No remaining ordering gap.** **Only 1 real deck gap remains: Corvus** (When-Played "attach a friendly Pilot unit or upgrade to this unit" — the **Piloting** dual-play-type path: play/attach a UNIT as an upgrade onto a Vehicle; deferred since 63e/63g as a whole architectural path). **Overwhelming Barrage** stays DEFERRED (power-divided, Christian's call). **Incinerator Trooper** is the false positive (works in-game) → effective ≈51/52. **NEXT: run the `/playtest` UAT** (browser route `/playtest`, or `npm run play-cli` headless) and triage findings; then decide Corvus (Piloting) vs the engine-correctness backlog (replacement-effect ordering §3200, §3018 opponent-batch-first). Decklist regen: `sqlite3 databases/swu_cards.db` + `ATTACH '~/.swu/swu_app.db' AS app; SELECT dc.quantity||' '||c.name||CASE WHEN COALESCE(c.subtitle,'')<>'' THEN ' - '||c.subtitle ELSE '' END FROM app.deck_cards dc JOIN cards c ON c.id=dc.card_id WHERE dc.deck_id='166ee4fe-b12e-4ecf-9d62-4f8d7a48b377';` → `/tmp/test_for_claude.txt`, then `npm run deck-coverage -- /tmp/test_for_claude.txt`.

**(2026-06-06, superseded by the line above) Death Star Plans + Regional Governor + Chancellor Palpatine done → deck 48/52 (92%, crossed 90%).** Regional Governor (`name_card` effect + `isPlayNameBlocked` restriction in legal.ts/reducer) and Chancellor Palpatine (`card_is_leader_unit` predicate wired + `CreateTokenEffect.grant` for the "give those tokens Sentinel for this phase" created-token reference) both done. **Remaining 2 real deck gaps are each a substantial multi-piece effort:** **Condemn** (needs THREE new pieces: a "while attacking" conditional grant window, wiring the inert `Modifier.lose_all_abilities` field into the modifier aggregator, AND the `disclose` runtime — `DiscloseEffect` AST + `applyDisclose` matcher exist but verify the runtime half actually reveals + branches), and **Corvus** (the **Piloting** dual-play-type path — "attach a unit as an upgrade onto a Vehicle"; deferred since 63e/63g as a whole architectural path, not a single primitive). **Overwhelming Barrage** stays DEFERRED (power-divided damage — Christian's call). **Incinerator Trooper** is the known false positive (works in-game) → effective ≈49/52. Decklist regen: `sqlite3 databases/swu_cards.db` with `ATTACH '~/.swu/swu_app.db' AS app; SELECT dc.quantity||' '||c.name||CASE WHEN COALESCE(c.subtitle,'')<>'' THEN ' - '||c.subtitle ELSE '' END FROM app.deck_cards dc JOIN cards c ON c.id=dc.card_id WHERE dc.deck_id='166ee4fe-b12e-4ecf-9d62-4f8d7a48b377';` → `/tmp/test_for_claude.txt`, then `npm run deck-coverage -- /tmp/test_for_claude.txt`. **Pivot option (recommended):** the matcher vein has thinned to these last bespoke compounds; engine-correctness backlog (replacement-effect ordering §3200, §3018 opponent-batch-first) or a fresh `/playtest` likely higher-value than grinding the last 2 hard cards.

**(2026-06-03 deck audit) Proactive `deck-coverage` pass over "Test for Claude" — now 43/52 playable (83%), 9 gaps left.** (+Snowtrooper Lieutenant via the conditional attacker buff.) (Was 30/52 at audit time; this session added: Power of the Dark Side, Sith Traditions, Vambrace Grappleshot, Darth Revan's Lightsabers, Constructed Lightsaber, General's Blade, Choose Sides, Palpatine's Return, Captain Enoch, Agent Kallus, Darth Vader (search-and-play), Death Trooper, Doctor Pershing. Incinerator Trooper is a false positive that works in-game → effective ≈43/52.) Remaining 10: Chancellor Palpatine, Condemn, Corvus, Death Star Plans, Nimble Prowess, Overwhelming Barrage (deferred), Regional Governor, Snowtrooper Lieutenant, The Darksaber, + Incinerator (false positive). Rather than waiting for playtest to surface each broken card one at a time, ran the audit tool to list every gap with its needed primitive. **Power of the Dark Side fixed this pass** (opponent_choose defeat — matcher-only). To regenerate the decklist: join `~/.swu/swu_app.db` deck_cards (deck "Test for Claude" = `166ee4fe-…`) to `databases/swu_cards.db` for names → `/tmp/test_for_claude.txt`, then `npm run deck-coverage -- <file>`. **Caveat:** the tool uses `matchCard` only (not `translate.parseKeywords`), so the `attacker_combat_first` marker shows as residual but works in-game — **Incinerator Trooper is a false positive** (real count ≈ 31/52).

**Prioritized remaining gaps (build order):**
   - **Upgrade-granted abilities ("Attached unit gains: '…'") — 5 of 7 DONE (2026-06-03).** (a) Host-attributed granted TRIGGERED abilities: **Sith Traditions** + **Vambrace Grappleshot** (grant.abilities → attributed to host, inline `grantedAbility` on TriggerInstance, When-Defeated recovered via UPGRADE_DETACHED, `trigger_defender` selector). (b) Host-gated conditional KEYWORD grants: **Darth Revan's Lightsabers** + **Constructed Lightsaber** (optional `filter` on `attached_to_self`; reuses the modifier-grant flow; `keyword_value` for Restore/Raid N). (c) **General's Blade** — conditional grant of an On-Attack `discount` (new one-shot phase-scoped play-cost discount primitive: `PlayerState.discounts`, consulted in `effectiveCost`, consumed in `applyPlayCard`, cleared at phase end). Deck 58%→**67%**. **2 of 7 remain:** **Death Star Plans** (its "first unit each round costs 2 less" is a *passive* per-round discount, not a triggered one-shot — needs a constant-ability discount + per-round consumption — PLUS a when-attacked upgrade control-transfer); **Condemn** ("While attacking, it gains '…' and loses all other abilities" — `Modifier.lose_all_abilities` field exists; needs a "while attacking" grant window + the lose-abilities wiring). Matcher leaves both residual (honest — no silent partial grant).
   - **Cheap matcher wins:** Death Trooper ("Deal 2 to a friendly ground unit and 2 to an enemy ground unit" → sequence of two damages; precedent = the W8_004 two-grant shield template). Snowtrooper Lieutenant ("When Played: You may attack with a unit. If it's Imperial, +2/+0 for this attack").
   - **Individual bigger primitives:** ~~Choose Sides~~ DONE (`exchange_control`). ~~Palpatine's Return~~ DONE (2026-06-03, `play_from_discard` — choose a unit in discard + play at reduced cost; self-contained in interpret.ts, When-Played via trailing settle). ~~Agent Kallus~~ DONE (`card_is_unique` trigger predicate + `extractLimit` once-per-round suffix). ~~Captain Enoch~~ DONE (`controller_discard_units` per-X count source w/ filter). ~~Darth Vader~~ DONE (`search_play` — search top N, multi-select under a combined-cost cap, play each for free; shared `putUnitIntoPlay` helper with play_from_discard). ~~Doctor Pershing~~ DONE (`damage` action-cost type — "deal N damage to a friendly unit" paid via the damage layer). Remaining: Chancellor Palpatine (Spy tokens + phase Sentinel grant — token creation exists, but "give those tokens Sentinel for this phase" needs a reference to the just-created tokens), Regional Governor ("name a card" — awkward chooser UX over the whole card pool), Corvus (attach a Pilot — Piloting-adjacent), Death Star Plans (upgrade control-transfer + passive per-round discount), Overwhelming Barrage (power-divided damage — deferred, Christian's call). Plus small near-misses: Death Trooper DONE.
   - **HIGH-OVERLAP corpus work (2026-06-03), chosen by DB frequency:** (a) **Unconditional keyword grant** "Attached unit gains `<Keyword>` [N]" — 5/7 simple cases full (The Darksaber's Sentinel clause, Devotion, Grievous's Wheel Bike, …); trait grants ("gains the Rebel trait") stay residual (no trait-grant modifier yet). (b) **"Attack with a unit. It gets +N/+0 [and gains K] for this attack."** — new `attacker_buff` on the `attack` effect (lasting buff on the chosen ready attacker, removed after the attack). ~35 corpus cards use "attack with a unit"; **9 fully covered now**. Riders DONE: bare, simple buff, cost-filtered, and **conditional attacker-identity buff** (`attacker_buff_if` — "If it's an Imperial/Rebel/Bounty Hunter unit, …" — Snowtrooper Lieutenant). Remaining riders (each an incremental template on this core): **defender debuff** ("The defender gets -N/-0 for this attack", ~6 cards — needs a defender-debuff lasting effect, mirror of attacker_buff), **per-X attacker buff** ("+1/+0 for each card in your hand"), **post-attack rider** ("After completing this attack, defeat it / give tokens"), **defender-condition buff** ("If it's attacking a unit, …" — runtime check on the defender), and "attack with another unit that costs less than it." **The Darksaber** is now partial (Sentinel clause matches; the keyword-counting "ready attached unit" When-Played clause is still residual).
   - Remaining named gaps: Snowtrooper Lieutenant (conditional attacker buff — see above), Nimble Prowess (When-Played exhaust a unit in the host's arena), The Darksaber (keyword-counting ready), Condemn ("while attacking" grant + lose-all-abilities).

0. **(2026-06-03 playtest, round 2) Shatterpoint CONFIRMED working; Superlaser Technician — FIXED.** Christian confirmed Shatterpoint resolves now. New finding: **Superlaser Technician** ("When Defeated: You may put this unit into play as a resource and ready it") did nothing — `coverage: none`, the matcher's `play_as_resource` regex only matched "this **event**/card," not "this **unit** … **and ready it**." Fixed: extended the regex to `(?:event|card|unit)` + an optional "and ready it" → `play_as_resource` with a new `ready?: boolean` flag (enters READY, the exception to §2046's exhausted default). The engine path already worked — a When-Defeated trigger fires after the unit is in the discard pile, and `play_as_resource` moves it from there to the resource zone. Fixture W8_033 + 2 engine scenarios (accept → ready resource, leaves discard; decline → stays in discard) + 1 matcher scenario. Engine 138 → **140**, translate 68 → **69**, fuzz 300 clean.
   - **(round 1) Shatterpoint** was a real `parseModalEffect` bug: it never stripped parenthetical reminders per option, so the "Use the Force **(lose your Force token)**." printing voided the whole modal → no abilities. Fixed (strip reminders per option, like `clausesOf`); regression scenario added.
   - **Overwhelming Barrage — STILL DEFERRED (Christian's call, round 1).** Plays as a vanilla no-op (`coverage: none`); needs (a) power-based divided damage (`divided_damage` is fixed-amount only, no `amountFromPower`) and (b) a cross-clause "it" binding (clause 2's source = the unit chosen in clause 1; no let-binding exists). Tracked coverage gap, not built.
1. **Christian: RE-TEST the stale-code trio in `/playtest`.** The May-30 playtest ran against a backend stale since **May 19** (predated arena serialization, committed May 20) and older frontend engine code. Now fixed/current — re-test and confirm: **(a) TIE Bomber renders in SPACE** (arena fix via backend restart), **(b) Shatterpoint** (now also fixed for the reminder printing — see #0), **(c) Tarkin's deployed On-Attack** Experience prompt (deploy_box → leaderUnitAbilities). If any still fail, it's a real execution bug, not staleness.
2. **Playtest triage: ALL gaps now resolved** (#2 session 63, #4 session 63c, #3 + #7 session 63d). Nothing open from the May-30 playtest except the re-test in #1.
3. **Engine correctness (~92% → higher), now that rules ARE committed in `docs/rules/`:**
   - **Deferred keywords — Bounty (63e), Exploit + Hidden (63f), Plot + resource-zone-play core (63g) DONE; two remain.** Implemented: **Bounty** (§13, opponent-resolved When-Defeated), **Exploit X** (§16, interactive cost reduction), **Hidden** (§18, can't-be-attacked-this-phase, Sentinel overrides), **Plot** (§19, play a card from the resource zone on leader deploy — built the reusable `playFromResourceZone` core: pay from other ready resources, replace with top of deck, resolve into play). **Remaining:** **Smuggle [Y]** (§14) — reuses the resource-zone-play core but needs (a) a new player action to initiate it in the action phase and (b) a parser for its bracketed cost (`[N resources <aspects>, <additional cost>]` — resources + aspect penalty + arbitrary additional costs, far more than a flat Y); **Piloting [Y]** (§17) — play a unit *as an upgrade* on a Vehicle (a dual-play-type path, separate from resource-zone play). NOTE: Plot currently covers unit/event cards in the resource zone; event-keyword carry needs `EventSpec.keywords` (events drop keywords in v2 translate), and resource-zone upgrades need a host-target choice — both deferred.
   - Replacement-effect ordering when multiple match (CR §3200, same chooser pattern as the session-61 trigger-ordering fix); the rare §3018 "opponent-batch-first" counter option.

**Engine status: ~93% on the correctness axis** (sessions 61–62 closed counters [all 3 Twin Suns], Ambush, trigger ordering, uniqueness-for-real-decks, a 2000-game fuzzer, and a verified 8-keyword set; 2026-06-07 closed the On-Attack-before-combat ordering, §7.x). Card *coverage* remains ~26% corpus-wide / **94% on the real "Test for Claude" deck** (the separate axis, deliberately deprioritized until the engine is table-trustworthy). Latest verified green (2026-06-07 Condemn + On-Attack-before-combat ordering complete on all paths): engine **180** / translate **103** / validate 16, tsc clean, fuzz (2000) clean. Deck "Test for Claude" now **49/52 (94%)**.

**Strategy shift → finishing WHOLE cards (Christian, 2026-06-06).** Done: **The Darksaber** (`controller_distinct_keywords` predicate + "ready attached unit") — found a real engine bug (`findCard` didn't search attached upgrades → upgrade-own `if`-conditionals were always-true; fixed). **Nimble Prowess** (`host_arena` zone filter — "a unit in attached unit's arena"). **Death Star Plans** (new `transfer_upgrade` effect + `defender: 'host'` trigger-predicate for the when-attacked upgrade control-transfer; new `round_discount` ability armed at `startActionPhase` for the "first unit each round costs 2 less" passive discount — reuses General's Blade's discount consume/clear path, since each round has exactly one action phase). All upgrade abilities now work thanks to the findCard fix. Lesson: whole-card work surfaces bugs clause-templating hides. **Remaining deck gaps (5 real + 1 false positive):** Chancellor Palpatine (Spy tokens + give-those-tokens-Sentinel for this phase — needs a created-token reference; "if you control a leader unit" gate), Condemn (while-attacking grant + lose-all-abilities + the `disclose` half), Corvus (attach a Pilot — Piloting dual-play-type path), Regional Governor (When-Played "name a card" + an opponent play-restriction), Overwhelming Barrage (power-divided — deferred, Christian's call). **Incinerator Trooper is the known false positive** (attacker_combat_first works in-game) → effective ≈47/52. NOTE: left-play predicate built but unlocked 0 cards; credit tokens PLAY_CARD-only.

**Cheap-overlap vein largely mined (2026-06-03).** After systematically clearing the top residual themes by corpus frequency — damage targets (chosen_base/AOE/arena), control-conditionals (While + If, via `controller_controls`), credit tokens (create+spend), Bounty-granting upgrades, the attack-with-a-unit family (bare/buff/conditional-buff/defender-debuff), upgrade grants (triggered/keyword/conditional), arena-scoped defeat — the remaining residuals are increasingly **bespoke**: fragmented per-X count sources ("+1/+0 for each ready token unit / Law card in discard / captured card guarded" — one PerCount each), card-specific multi-clause compounds, and mechanics needing new state ("if a friendly unit left play this phase", ~11 — needs a left-play-this-phase tracker). Next leverage is lower per-card; good remaining batches: the **per-X count-source family** (several "+1/+0 for each <X>" if a couple of shared count sources are added) and the deferred halves (action/deploy credit-spending; trait-grant modifier for "gains the <Trait> trait"). **"if a friendly unit left play this phase" — mechanism DONE** (`leftPlayThisPhase` tracker + `unit_left_play_this_phase` predicate; 2026-06-06) but it unlocked **0** cards fully (all 4 pair it with other unmodeled clauses) — banked as a reusable primitive. The honest read: matcher-coverage by corpus frequency has hit diminishing returns; remaining wins are per-card compounds. **Consider pivoting** to the engine-correctness axis, a fresh `/playtest`, or finishing whole cards (pick a card, build ALL its clauses) rather than single-clause templates. NOTE: credit tokens are spendable for PLAY_CARD only; action-ability/deploy credit-spending is deferred (a fuzz-caught mismatch — see CHANGELOG).

**Corpus-wide leverage focus (2026-06-03):** ran a residual-frequency pass over all ~1500 deckable cards (`matchCard` → tally 4-word clause-prefixes). Top residual themes, in order: **"Deal N damage to …"** (~50 — damage-target batch DONE: `chosen_base` for "a base", plus "this unit"/"your base"/"each base"/arena AOE), **control-conditionals** ("While/If you control another/a …", ~35 — BOTH forms DONE via the new `controller_controls` predicate: "**While** … this unit gets/gains" 16/16, "**If** you control … `<effect>`" 9/24 [`if`-on-control; rest gated on unmodeled inner effects like credit tokens]), **"attack with a unit"** (~14 residual remaining — bare/buff/conditional-buff/defender-debuff DONE; per-X buffs + post-attack riders remain), **"if a friendly unit left play this phase"** (11), **Bounty-granting upgrades** ("Attached unit gains: 'Bounty — …'") DONE 3/9 (composes grant.abilities + controlled_by + UPGRADE_DETACHED; rest need ramp/search inner effects). **Credit tokens DONE** (create + spend for PLAY_CARD; 6/23 of "Create a Credit token" cards full). Remaining credit work: action-ability/deploy credit-spending; arena-control conditions ("If you control a ground unit, …") that gate several credit cards. The control-conditional family is the cleanest next high-overlap primitive.

---

*(2026-06-03 session 63g)* **Resource-zone play CORE + Plot (§19) implemented. Engine 138 / translate 67 / validate 16, tsc clean, fuzz 500 + play-cli clean.**

Built the "play a card from the resource zone" architecture and used it for Plot.
- **Refactor (no behavior change):** extracted `resolveCardIntoPlay` from `applyPlayCard` — the post-cost "move the card to its play zone by type + run enter-play effects (onPlay hooks, Ambush, event When-Played)" step, WITHOUT advancing the turn. The normal Play-a-Card action now calls it then advances; resource-zone play reuses it. All prior play scenarios still pass (regression net).
- **`playFromResourceZone` (the core):** pays the cost from OTHER ready resources (the played card / its replacement can't pay), replaces the played card in the resource zone with the top of the deck (exhausted, §19c), then `resolveCardIntoPlay`. Units/events only (resource-zone upgrades need a host-target choice — deferred).
- **Plot (§19) — DONE.** Wired into `applyDeployLeader`: after a leader deploys, snapshot the controller's resource-zone cards that have the `plot` keyword (§19d — a card drawn as a replacement this deploy isn't eligible), and offer each optionally (printed cost) via `playFromResourceZone`. Marker keyword `plot` (hook-free; behavior is the deploy window). 2 engine scenarios (deploy→play-from-resources + top-of-deck replacement enters exhausted; decline leaves it). Real Plot unit verified (Galen Erso → plot). Covers Plot **units** (29 of the 42 Plot cards); Plot events (7) need `EventSpec.keywords` (events currently drop keywords in v2 translate).
- **Smuggle deferred but unblocked:** the §14 cost is a bracket — "Smuggle [9 resources Aggression Heroism]" / "[7 resources …, deal 4 damage to a friendly unit]" = resources + aspect penalty + arbitrary additional costs. It reuses `playFromResourceZone` but needs a new action (initiate in the action phase) + a bracket-cost parser. Piloting (§17, play-as-upgrade) is a separate dual-play-type path.

Files: `reducer.ts` (`resolveCardIntoPlay` extraction, `playFromResourceZone`, `specHasKeyword`, Plot deploy window), `primitives/keywords/plot.ts` + index, fixture W8_032 + 2 scenarios.

---

*(2026-06-03 session 63f)* **Exploit + Hidden implemented (2 more deferred keywords). Engine 136 / translate 67 / validate 16, tsc clean, fuzz 500 + play-cli clean.**

- **Exploit X (§16) — DONE.** "While playing this card, you may defeat up to X friendly units; each cuts the cost by 2." The X is pulled from the "Exploit N" text by the translator (`exploit` added to `VALUE_KEYWORDS`); `exploitOf(spec)` in cost.ts sums it. `legal.ts` gates affordability at the **best-case** reduction (`cost − 2·min(X, friendlyUnits)`), and `reducer.applyPlayCard` resolves the choice during cost determination: a chooser loop picks at least enough to afford and up to X (the "Done" option appears only once the minimum is met, so the **default chooser sacrifices exactly the minimum** — sane and fuzzer-safe). Sacrificed units are bumped to lethal and defeated by the trailing settle, so their When-Defeated fires with the played card's When-Played (§16d). 3 engine scenarios (default min; scripted max → cost floor; legal-gate enables an otherwise-unaffordable play). Real cards verified (Providence Destroyer / Multi-Troop Transport → exploit 2). Granted Exploit (Count Dooku) and "for each unit exploited" payoffs (Malevolence) not modeled.
- **Hidden (§18) — DONE.** "Can't be attacked if it was played/deployed/created this phase"; **Sentinel overrides** (§18b). Added a `phaseStartedAtStep` marker on `GameState`, set once in `startActionPhase` (the single action-phase choke point — attacks only happen in the action phase). A unit `enteredZoneAt >= phaseStartedAtStep` entered this phase. The restriction is enforced in BOTH `attackIllegalReason` (reducer throws) AND `legal.ts` attack generation (so legal/reducer agree and the fuzzer can't pick a now-illegal attack) — Hidden-this-phase units are filtered out of offered targets unless they also have Sentinel. Marker keyword `hidden` (hook-free, like Ambush). 3 engine scenarios (protected this phase; attackable from a prior phase; Hidden+Sentinel still attackable). Real card verified (8D8 → hidden). Back-compat: hand-built states without `phaseStartedAtStep` treat no unit as "this phase."

Files: `runtime/cost.ts` (`exploitOf`), `legal.ts` (Exploit affordability + Hidden filter), `reducer.ts` (Exploit sacrifice + `phaseStartedAtStep`), `runtime/attack.ts` (Hidden check), `state/types.ts` (`phaseStartedAtStep`), `primitives/keywords/hidden.ts` + index, `engine-v2-data/translate.ts` (`exploit` value keyword), fixtures W8_029/030/031 + scenarios.

---

*(2026-06-03 session 63e)* **Deferred-keyword verification pass + Bounty IMPLEMENTED. Engine 130 / translate 67 / validate 16, tsc clean, fuzz 300 + play-cli clean.**

Now that the rules are committed, verified all five deferred keywords against the text and implemented the one that fit the existing architecture:
- **Bounty (§13) — DONE.** "Bounty — <effect>" resolves like a When-Defeated ability but is **controlled by an opponent** of the unit's controller (the defeater), and collecting it is optional (§13e). The AST already had a `controlled_by?: PlayerRef` flag on `TriggeredAbility` (validated) but it was **inert** — nothing in the runtime read it. Wired it in `collectTriggers`: a trigger whose ability is `controlled_by:'opponent'` is pushed with `sourceController = the opponent`, so resolution, the optional chooser, and §3018 ordering all key off the defeating player while the predicate still matches on the unit. Matcher: new `parseBountyClause` ("Bounty — <effect>" → `event.defeated` / `card:self` / `controlled_by:'opponent'` / `optional(<effect>)`), wired into the unit clause loop before the triggered-prefix pass. Fixture W8_028; 2 engine scenarios (defeating player collects — and the owner does NOT; optional decline) + 1 matcher scenario. Coverage: 4/5 cards whose text *starts* with "Bounty —" now full (the 5th is a deck→resource ramp effect); the ~28 others grant Bounty via upgrades/"gains:" (the separate granted-ability path). Capture isn't modeled (no capture event yet) — only the When-Defeated half.
- **Exploit / Smuggle / Piloting / Plot — VERIFIED, deferred with scoped requirements** (see NEXT STEPS #3). None is a simple marker: Exploit needs an interactive cost-reduction step inside the Play-a-Card action; Smuggle/Plot need a "play from the resource zone" path (+ top-of-deck replacement; Plot also a leader-deploy hook); Piloting needs a "play a unit as an upgrade" path. Left unimplemented rather than half-built.

Files: `runtime/triggers.ts` (wire `controlled_by`), `engine-v2-data/match.ts` (`parseBountyClause` + wiring), fixture W8_028, engine + matcher scenarios. AST/validator already had `controlled_by`.

---

*(2026-06-03 session 63d)* **#3 Resupply + #7 Darth Revan DONE — the last two playtest-triage gaps. New `play_as_resource` effect; new `event.attack_ended` "attacks and defeats" trigger + `defender_defeated` predicate. Engine 128 / translate 66 / validate 16, tsc clean, fuzz 400 + play-cli clean.**

- **#3 Resupply ("Put this event into play as a resource").** New `play_as_resource` effect: the source event, already moved to discard by the event-play flow, is moved into its controller's resource zone exhausted (§2046) instead. Net ramp (pay the cost, gain a permanent resource). Matcher recognizes the clause; fixture W8_026 + engine scenario (becomes exhausted resource, leaves hand, not in discard) + matcher scenario. Real Resupply verified.
- **#7 Darth Revan ("When a friendly unit attacks and defeats a unit: …give Experience to that friendly unit").** Three new pieces: (a) the trigger fires on `event.attack_ended` with a new `defender_defeated` trigger-predicate; (b) "that friendly unit" = the attacker, resolved via the existing `trigger_source` selector (which already returns the attacker for attack events); (c) matcher prefixes for "When a friendly unit / this unit attacks and defeats a unit", "that (friendly) unit" → trigger_source, and "Exhaust this unit/leader" → exhaust self. The leader (un-deployed) "You may exhaust this leader. If you do, give…" composes as `optional(if_did(exhaust self, give_experience trigger_source))`; the deployed deploy_box version is `optional(give_experience trigger_source)`. **Subtle bug found + fixed in `defender_defeated`:** by trigger-collection time the defeated defender has been moved to the discard pile *with its damage reset to 0*, so a naive "findCard fails" OR "lethal damage" check both miss it — the predicate now treats "not in an arena" as defeated (plus the lethal-damage case for timing safety). Fixture W8_027; 2 engine scenarios (attacker gains Experience on a defeating attack; no fire when the defender survives) + 2 matcher scenarios (deployed + leader forms). Real Darth Revan verified end-to-end (both leaderAbilities and leaderUnitAbilities). Files: `spec/ast.ts` (TriggerPredicate.defender_defeated + PlayAsResourceEffect), `runtime/predicates.ts`, `runtime/interpret.ts`, `spec/validate.ts`, `engine-v2-data/match.ts`, fixtures + scenarios.

---

*(2026-06-02 session 63c)* **#4 DONE: indirect damage now modeled correctly — the DEFENDING player assigns it among their base + units (§8.35). New `indirect_damage` effect. Engine 125 / translate 63 / validate 16, tsc clean, fuzz 300 + play-cli clean.**

The session-63b log fix made TIE Bomber's indirect damage *visible*, but it still just dumped N on the base. Now it follows §8.35: "Deal N indirect damage to a player" → that player assigns N unpreventable damage, divided as they choose, among their base + any units, capped per unit at remaining HP (§8.35.3), simultaneously (§8.35.5), ignoring Shield tokens without consuming them (§8.35.2a). New `indirect_damage` effect (`{ amount, player }`), distinct from a `damage` effect with `indirect:true` (which the ability aims at specific targets). Key correctness point: the **assigning player is the recipient**, so the chooser's `player` is the recipient — that surfaces the assignment prompt to the defending side in the UI (the "I couldn't assign it" symptom). `damageUnit` already ignored shields for indirect without consuming them, so that came for free; I pass `{ indirect:true, unpreventable:true }`. Default/AI chooser dumps on the recipient's base (leftmost slot — behavior-preserving + sane "spare your own units" default); a human/scripted chooser distributes. Matcher now emits `indirect_damage` for "Deal N indirect damage to the defending player/a player/each opponent" (was `damage`→opponent_base). Fixture W8_025; 4 engine scenarios (default→base; recipient distributes; shield ignored-not-consumed; per-unit cap spills to base) + 1 matcher scenario. Real TIE Bomber verified: space arena + On-Attack → indirect_damage opponent 3. Modeled `player:'opponent'` (covers "the defending player" / "your opponent"); a "choose any player" variant isn't needed yet. Files: `spec/ast.ts`, `runtime/interpret.ts`, `spec/validate.ts`, `engine-v2-data/match.ts`, fixture + scenarios.

---

*(2026-06-02 session 63b)* **2nd playtest round: "deals combat damage first" combat-sequencing bug FIXED (Incinerator Trooper) + ability damage now shows in the game log. Engine 121 / translate 62 / validate 16, tsc clean, fuzz 300 + play-cli clean.**

Christian re-tested after 63: **Tarkin's deployed ability and TIE Bomber both confirmed working** (the stale-code trio is resolved). Two new findings:
- **Incinerator Trooper "deals combat damage before the defender" → REAL combat bug, FIXED (§1618c / §7.5.6d).** The unit dealt and took damage simultaneously (it shouldn't take damage when it defeats the defender first — like MTG first strike). This was the exact case session 62 flagged as "a future re-read point if such a card ships." Now: a new marker keyword `attacker_combat_first` (mirrors Ambush — hook-free, resolved in `runtime/attack.ts`), detected from card text in `translate.parseKeywords` (narrow regex, like Raid/Restore value parsing). In `resolveAttack`, when the attacker deals first: deal attacker→defender, and the defender deals back ONLY if it survives; if defeated, no return damage. Per §7.5.6d the surviving defender's return power is recomputed AFTER taking damage so a Grit defender gets the bonus (contrast §7.5.6c simultaneous, which snapshots before — both now have scenarios). Fixtures W8_023 (2/2 Incinerator) + W8_024 (1/9 test unit to read exact return damage); 3 engine scenarios (defeats→0 return; survives→Grit-bonus return of 5; regression: no-deals-first still simultaneous) + 2 translate scenarios (text→marker; no false positive). End-to-end verified: real Incinerator card → 2/2 with the marker keyword. Only attacker-side ("while attacking") is implemented; a "while defending" variant isn't needed yet (no such card) — noted in `keywords/combat_first.ts`.
- **Ability damage was invisible in the game log → FIXED.** `GameLog` renders `state.log`, but only combat (`attack.ts`) appended to it — all ability-driven damage (incl. TIE Bomber's indirect base damage) landed silently. Added a log line in `interpret.applyDamage` ("Deals N [indirect] damage to X."). Combat is unaffected (it uses `dealDamageToBase`/`dealDamageToUnit` directly, not the `damage` effect). NOTE: this only fixes #4's *visibility* — the indirect-damage *model* (defender assigns among base+units) is still wrong (dumps on base); that's the remaining #4 in NEXT STEPS.

**Files:** `primitives/keywords/combat_first.ts` (new) + `keywords/index.ts`; `runtime/attack.ts` (sequencing + log); `runtime/interpret.ts` (ability-damage log); `engine-v2-data/translate.ts` (detection); fixtures W8_023/024; engine + translate scenarios.

---

*(2026-06-02 session 63)* **Playtest triage (7 issues) + card-DATA fix: upgrade & leader stats were never captured from the SWU API. Rebuilt the card DB; all 149 upgrades + 139 leaders now have real stats. tsc clean, engine 118 / translate 60 / validate 16.**

Christian ran the real-deck playtest (NEXT STEP #1) and reported 7 issues. Triaged each against current code (ran the matcher per-card + traced engine paths). Verdicts:
- **#1 TIE Bomber in ground → STALE BACKEND.** The running uvicorn started **May 19**; arena serialization in `me.py` landed **May 20** (`c0306ae`), so deck payloads had empty `arenas` → translator defaulted every unit to ground. Killed it, relaunched with `--reload` (now current). Engine/UI/translator arena handling all verified correct. **Re-test pending.**
- **#5 Shatterpoint / #6 Tarkin deployed ability → LIKELY ALREADY WORK (stale frontend at playtest time).** Both translate *fully* on current code (Shatterpoint → `choose_one` of `defeat`+`remaining_hp` / `use_force`+`defeat`; Tarkin deploy_box → `leaderUnitAbilities` `On-Attack optional give_experience`, which `triggers.ts` fires). **Re-test pending.**
- **#2 Resilient no stat change → REAL, SYSTEMIC DATA GAP, FIXED THIS SESSION.** All 145 upgrades had NULL attack/health: the SWU API exposes upgrade modifiers in `upgradePower`/`upgradeHp`, but `swu_api_client.py` only read `power`/`hp` (null for upgrades). So NO upgrade modified stats. **While in there, found leaders had the same problem** — the Leader branch dropped `power`/`hp` entirely, so `translate.ts` fell back to a generic 3/6 for every leader (Tarkin's deployed unit is really 2/7, not 3/6). Fixed both branches in `swu_api_client.py`, added a verify-step guard ("Upgrades missing modifiers (should be 0)"), and **rebuilt `swu_cards.db`** (repo `databases/` + the running backend's `~/.swu/`). Verified end-to-end: DB upgrade attack/health = upgradePower/upgradeHp (Resilient +0/+3, negatives like Nowhere to Hide -2/0 handled); `translate.ts` already maps upgrade attack→powerModifier; `modifiers.ts` already sums them into effective stats. Corpus 2360 → **2403** cards (fresh fetch pulled newer-set additions). Backups at `/tmp/swu_cards.{repo,swu}.bak`.
- **#3 Resupply, #4 TIE Bomber indirect, #7 Darth Revan → REAL gaps, deferred** (see NEXT STEPS #2). #4: TIE Bomber's "indirect to the defending player" matches to dump-on-base, not defender-assigns; `divided_damage` exists but is unit-only + source-assigned. #3: needs a play-as-resource primitive. #7: needs a new trigger prefix + "that unit" selector + exhaust-self cost.

**Files:** `backend/scripts/swu_api_client.py` (Upgrade + Leader stat capture), `backend/scripts/build_database.py` (verify guard). No frontend code change needed — the translator/engine already handled the modifiers; the data was the gap. The weekly `update_dbs.yaml` rebuild now captures these going forward.

---

*(2026-06-01 session 61)* **TABLE-CORRECTNESS PASS (1/N): Ambush fixed — the keyword now actually attacks. Plus an audit of the four "situations at the table" areas. Engine 107 / translate 59 / validate 16, tsc clean, play-cli completes.**

Christian's priority shift: make the engine reliably correct for real play BEFORE chasing card coverage. Audited the named areas:
- **Counters:** ⚠ I initially got this WRONG (rules-from-memory miss — I checked the 1v1 CR, not the Twin Suns format insert). **Twin Suns replaces "Take the Initiative" with "Take an Available Counter": THREE counters — Initiative, Blast, Plan — each takeable once per round, one per player.** Christian (format authority) corrected me with the official insert. The engine had the vocab but never implemented Blast/Plan (it threw). **Now fully implemented (session 61 cont. below).**
- **Ground vs space arenas:** enforcement correct — attacker+defender must share an arena, Sentinel scoped to that arena, base attackable from either (CR §2018). **No bug.**
- **Multi-choice per card:** works via the synchronous Chooser + `stepAsync` replay protocol (sequential prompts each surface separately). **No bug.**
- **Ambush:** **REAL BUG, FIXED.** The keyword only readied the unit and never attacked (the core half of §7.5.5). Now `resolveAmbush` (in `runtime/attack.ts`) does the full rule: *may* ready + nested attack on an enemy UNIT in the same window as When-Played, honoring Sentinel, **skipping if no legal enemy unit** (§7.5.5c — so with an empty enemy board the unit now correctly stays exhausted, a behavior change the old test had backwards). Reuses session-60 `resolveAttack`. The `ambush` keyword def is now hooks-free (just marks the keyword present, incl. when granted by Piett); wired at the play site (deploy/create paths were already non-functional — `onDeploy`/`onCreate` for Ambush were never invoked and no token has Ambush — so left out of scope). Verified the Raid-on-any-attack rule in passing (CR §2885a — Raid applies vs units too, not just base; engine already correct). Fixture reuse (W2_002 Pathfinder); 3 scenarios (no-enemy→exhausted; accept→ready+attack+retaliation; decline→exhausted).

**Table-correctness pass continued (same session):**
- **Trigger ordering — FIXED (§3016/§3018).** `drainTriggers` was pure insertion-order. Now: the active player's simultaneous triggers form the eligible batch (active-first per §3018), and the owning player picks which of their own eligible triggers resolves next (§3016) via the chooser — but ONLY when ≥2 are eligible, and `defaultChooser` picks leftmost, so it's a behavior-preserving generalization (all prior scenarios unchanged). 2 scenarios: a scripted chooser reorders two simultaneous same-player triggers (CARD_DRAWN before base DAMAGE_DEALT); default chooser preserves insertion order. Fixture W8_020 (draw on enemy defeat) added alongside W8_006 (damage on enemy defeat). Not yet surfaced: the active player's §3018 option to let the OPPONENT resolve their batch first (rare; active-first is the common default).
- **Twin Suns counters (Blast + Plan) — IMPLEMENTED (corrects my earlier mistake).** All three counters now work via `applyTakeCounter`: **Initiative** (go first next round), **Blast** (1 damage to each enemy base), **Plan** (draw 1, then put a card from hand on the bottom of the deck — chooser-picked, default leftmost). New round-scoped `GameState.countersTakenThisRound` enforces "each counter once per round, game-wide" (can't derive from `countersHeld` since initiative persists across rounds); reset at round end. `legal.ts` now offers every not-yet-taken counter (was initiative-only); a player who's taken one is done for the round (`hasTakenCounterThisRound`). AI/CLI/UI need no change — they pick TAKE_COUNTER generically and `describeAction` already prints the counter name. 4 scenarios: Blast damages each enemy base; Plan draws+bottoms (net hand size unchanged, chosen card on bottom); each counter once-per-round; after p1 takes Initiative p2 may still take Blast/Plan (replaces the old 1v1-rule scenario that wrongly forbade it).

**Uniqueness (rule-of-one) — DONE.** `runStateBased` now enforces "a player can only control 1 copy of each unique card" (§3371): if a player controls 2+ in-play copies of the same unique `cardId`, the controller chooses which to keep and the rest are defeated (bumped to lethal → routed through `processDefeat` so When-Defeated / owner-discard / leader flip-back all apply), before enter-play abilities resolve. Player-specific (each player may control their own copy). **Subtle bug caught + fixed:** a copy already at lethal damage must be excluded from the live duplicate set, else the check re-flags the same pair every loop iteration and spins to the 256-guard (both copies survived). New `GameState`-free check (reads arenas); new unique fixture W8_021; 3 scenarios (defeat-one-keep-one; player-specific; non-unique stacks freely). Note: `translate.ts` does NOT yet populate `spec.unique` from the DB — so real translated decks won't trigger this until that one-line mapping is added (flagged).

**Random-game fuzzer (#4) — DONE.** New `npm run fuzz [games] [baseSeed]` (`scripts/fuzz.ts`): seeded-random legal action each step for both seats + a random chooser for every prompt, asserting no throw / termination with a winner / step-budget / no empty-action-set mid-action-phase. **2000 games across two seed ranges all completed cleanly** (avg ~12 rounds / ~104 steps, max 16 / 149). This is the "survives cases I didn't author" net — the difference between "passes my scenarios" and "robust." Failures print the exact seed to reproduce (`npm run fuzz -- 1 <seed>`).

**Remaining table-correctness backlog:** replacement-effect ordering when multiple match (CR §3200); the §3018 "opponent-batch-first" counter-ordering option; later-set keywords (Bounty/Exploit/Smuggle/Piloting/Plot) once a current rules PDF is available. Engine **115** / translate 59 / validate 16, tsc clean, play-cli + fuzz (2000 games) clean.

---

*(2026-06-01 session 62)* **`spec.unique` wired for real decks (#1) + keyword-exactness sweep (#3). Engine 118 / translate 60 / validate 16, tsc clean, play-cli + fuzz clean.**

- **#1 — uniqueness now fires for real translated decks.** The DB already serializes `is_unique` (column → `SELECT *` → `card_to_dict`/`me.py` deck payload), but the frontend `Card` type didn't declare it and `translate.ts` didn't map it. Added `is_unique?: boolean` to `Card`, and `unique: Boolean(card.is_unique)` to `translateCard`'s `common` (flows into unit/event/upgrade/leader specs; base builds separately and has no unique). So the session-61 rule-of-one now applies to actual decks, not just hand-authored fixtures. Translate scenario covers unit-unique / absent→false / leader-unique.
- **#3 — keyword exactness sweep (8 implemented keywords vs the CR PDF).** Verdict: **all 8 implementations are correct** — the gap was *test coverage* of rule subtleties, now closed:
  - **Grit §7.5.6c (simultaneous combat):** a Grit unit does NOT gain power from the damage it takes that combat. The combat core snapshots both powers before damage lands, so this already held — added the rules' exact 2/2-vs-1/3 example as a scenario, and corrected grit.ts's misleading "Week 2 approximation" comment (it's actually correct). Noted §7.5.6d (attacker-deals-first abilities) as a future re-read point if such a card ships.
  - **Overwhelm §7.5.7e/f:** added scenarios for "shield on defender blocks → no excess to base" and "defender survives → no excess." Both already handled correctly by `attack.ts` (shield-block + defeated checks).
  - Raid (any-attack +X, snapshot), Restore (On-Attack heal), Saboteur (ignore Sentinel + strip shields), Sentinel (force-target), Shielded (When-Played/Deployed shield), Ambush (fixed session 61) — all confirmed against the CR.
  - **Not verifiable here:** Bounty/Exploit/Smuggle/Piloting/Plot are from sets newer than the cached CR PDF (v1.1, Jan 2024); per the standing "verify against the source" rule, left untouched rather than authored from memory. The matcher treats them as recognized-but-inert keyword words. Fixtures W8_022 (2/2 Grit) added.

*(2026-06-01 session 60)* **Multi-attack: new `attack` effect + combat-core extraction (task #58, meatier mechanic — last of the big residuals). "This unit attacks again/twice/N times." → the source unit makes N SEQUENTIAL nested attacks (§ "if an ability triggers multiple attacks, resolve them sequentially"; one target each; the ready requirement is waived for ability-attacks per "unless otherwise specified"). Engine 105 / translate 59 / validate 16, tsc clean, play-cli completes.**

Extracted the combat core from `reducer.applyAttack` into a shared `runtime/attack.ts` (`resolveAttack` + `attackIllegalReason`) so the player ATTACK action and the new nested-attack effect share ONE code path (no reducer↔interpret cycle — both import `attack.ts`; `attack.ts` imports neither). `reducer.applyAttack` is now validation (active-player / phase / ready / Sentinel) + `resolveAttack` + turn-advance; the nested `attack` effect calls `resolveAttack` directly (no turn advance), picking a legal defender per attack via the chooser (enemy units in arena honoring Sentinel, or the base), stopping early if no legal target. AST `AttackEffect { attacker?, count? }` (attacker defaults to `{self}`). Fixture W8_019 (Relentless Vanguard, When Played → attacks twice) + 2 engine scenarios (two sequential combats accumulate damage both ways; stops/▸base-only case = 3 base attacks → 9) + 1 matcher scenario (twice/again/N times). Validator + matcher (`parseEffectClause` templates) updated. **This was the most invasive change of the run (refactored the core combat path every attack uses) — verified by full play-cli + all suites.**

*(2026-06-01 session 59)* **Cost reduction: new `cost`-type ability + shared `effectiveCost` helper (task #58, meatier mechanic). "This <card> costs N less to play [for each friendly leader unit / friendly unit / resource you control]." → a `cost` ability scanned at play time; cost clamped to ≥0 (Comprehensive Rules §: "a card's cost cannot be modified below 0"). Engine 103 / translate 58 / validate 16, tsc clean, play-cli completes.**

New `runtime/cost.ts` `effectiveCost(state, reg, spec, pid)` is the single source of truth for a card's current play cost; wired into BOTH cost sites — `legal.ts` (affordability gate + `describeAction` display) and `reducer.applyPlayCard` (charging). `CostAbility { type:'cost', amount, per?, while? }` where `per ∈ {friendly_leader_units, friendly_units, friendly_resources}` (new `CostCount` enum); a deployed leader unit is counted as an arena CardInstance whose cardId is a leader spec. Fixture W8_018 (Rallied Reinforcements: cost 5, −1 per friendly leader unit, +draw) + 3 engine scenarios (scales 5→3 at 2 leaders; clamps to 0 at 6; PLAY_CARD charges the reduced 4 end-to-end) + 2 matcher scenarios (per-X + flat). Validator gained the `cost` ability case + `COST_COUNTS`. `cost`-ability `while` is plumbed but unused (no in-scope card needs it). This is the first *dynamic-cost* mechanic, so it also unlocks future "costs N less" variants. **Multi-attack is the remaining meatier residual.**

*(2026-06-01 session 58)* **"When this unit is attacked" trigger (matcher-only — engine already supported it). New `TRIGGER_PREFIXES` entry "When this unit is attacked:" → `event.attack_declared` with `where: { defender: 'self' }`. Engine 101 / translate 56 / validate 16, tsc clean.** The trigger machinery already fired `ATTACK_DECLARED` for both attacker and defender, and `evalTriggerPredicate` already handled `defender: 'self'` (matches `event.defenderIid === sourceIid`) — the only gap was the matcher prefix. Fixture W8_017 (Vigilant Sentry, 1/6, draws when attacked) + 2 engine scenarios (fires when defending and survives; does NOT fire when it's the attacker) + 1 matcher scenario. Added `defender?: 'self'` to the matcher's `TrigPrefix.where` type. Deferred: targeting the attacker from the defender trigger needs a `trigger_source`-as-attacker selector refinement (currently `trigger_source` approximates controller).

*(2026-06-01 session 57)* **Control-transfer: new `take_control` effect + `owner` model (task #58). "Take control of an enemy [non-leader] [ground|space] unit [that costs N or less]." → moves the instance to the source player's matching arena; they become its controller. Engine 99 / translate 55 / validate 16, tsc clean, play-cli completes.**

**⚠ RULES CORRECTION (verified against the official Comprehensive Rules PDF, §8.28 / §1.5.2):** my earlier residual note said control returns "start-of-regroup." That is WRONG. **Take control is PERMANENT** — "remain so until either that card leaves play or their opponent takes control" (§8.28.1). There is no regroup-return. This was a rules-from-memory error caught by checking the source (per the CLAUDE.md standing rule).

Implementation: control is *positional* (arena holder = controller), so take_control physically moves the instance to the new controller's matching arena. New `CardInstance.owner?` field records the original controller (set only on a control change); a defeated card returns to its **owner's** discard (§8.28.2), not the controller's — `state_based.processDefeat` now routes per-owner and clears the flag on the way to discard. Unit keeps ready/exhausted + damage + upgrades (§8.28.1). A **Leader Unit can't change control — it's defeated instead (§1.6)**: take_control bumps it to lethal and lets the state-based loop flip it back. Fixture W8_016 (Change of Allegiance) + 3 engine scenarios (move+owner+retained-state; controlled-unit defeat → owner's discard; leader → defeated-not-moved) + 1 matcher scenario (non-leader + cost/arena variants). Deferred: upgrades played onto enemy units keeping a *separate* controller (§1.5.2e — upgrades currently follow the host's owner on defeat); take-control of a unit into a full/again arena edge cases.

*(2026-06-01 session 56b)* **"If you do not" else-branch: extended `if_did` with an optional `else_` (resolves when `do` did NOT happen). Covers "If you do, X. If you do not, Y." (both branches) and "X. If you do not, Y." (else only). Engine 96 / translate 54 / validate 16, tsc clean.** Fixture W8_015 (Contingency Plan: "You may return an enemy unit… If you do, draw a card. If you do not, deal 1 to the enemy base.") + 2 engine scenarios (accept → then fires, else_ skipped; decline → else_ fires, then skipped) + 2 matcher scenarios (both-branches / else-only). Matcher checks the "do not"/"don't" forms BEFORE the plain "if you do" form (since "do not" contains "do"); all referenced halves must template or the clause stays residual. Validator requires `do` + at least one of `then`/`else_`. Regression-checked: then-only `if_did` (W8_014) still parses with `else_` undefined. Deferred: control-transfer (owner≠controller).

*(2026-06-01 session 56)* **"If you do" conditional compound: new `if_did` effect (one engine primitive, task #58). "<do>. If you do, <then>." → `then` resolves only if `do` actually happened (proxied by "do emitted ≥1 event" — a declined optional or a no-legal-target effect emits nothing → `then` skipped). Engine 94 / translate 52 / validate 16, tsc clean.** Fixture W8_014 (Calculated Withdrawal: "You may return an enemy unit to its owner's hand. If you do, draw a card.") + 2 engine scenarios (accept → bounce+draw; decline → no draw) + 3 matcher scenarios (optional+if_did / non-optional / untemplated-half stays residual). Matcher gained a general `if_did` clause template AND the event clause-loop now tries the RAW clause before stripping "You may" (so compounds parse their own optional into the right place — verified plain "You may X." still wraps as `optional(X)`, no regression). Distinct from `if` (branches on a card predicate). Unlocks the bounce near-misses + Force-style compounds beyond the `use_force` special case. Deferred: "If you do not, …" (else-branch) and "If you don't" variants.

*(2026-05-31 session 55)* **Discard-pile recursion: new `return_from_discard` effect (one engine primitive, task #58). "Return a [Trait] unit [that costs N or less] from your discard pile to your hand." → chooser picks `count` matching cards from the player's discard, moves them to hand as fresh cards (damage/exhaust/shields/Experience reset). Engine 92 / translate 49 / validate 16, tsc clean.** Fixture W8_013 (Salvage Specialist, When Played → return a unit) + 2 engine scenarios (moves+resets / filter gates as no-op) + 1 matcher scenario (plain + trait+cost compound). AST/interpreter/validator/matcher all in lockstep; the all-fixtures validate regression covers the new fixture. Distinct from `return_to_hand` (bounce of an in-play unit) — this pulls from the discard zone. Deferred: "return a card" (non-unit) form, and "from an opponent's discard" (rare).

*(2026-05-31 session 54)* **Coordinate self-buff matcher template (matcher-only, no new engine primitive). Recognizes "Coordinate — This unit gets +N/+N." → constant gated on `controller_unit_count ≥ 3` (the engine already modeled Coordinate this way via W4_004). Closes a known residual. Engine 90 / translate 48 / validate 16, tsc clean.** Fixture W8_012 + 2 engine scenarios (active at 3 units / inactive at 2) + 1 matcher scenario (incl. reminder-stripping). The em-dash body is what reaches `parseConstantClause` after `stripReminders` removes the "(While you control 3 or more units…)" reminder. NOTE: tool-result channel was badly degraded this session, so scope was deliberately held to this one low-risk, high-confidence task.

*(2026-05-31 session 53)* **Six task-#58 primitives across three batches: quick wins (token creation, `remaining_hp`, event-contextual base) + Force tokens + multi-source power damage. Corpus 508 → 571 fully playable (22.7% → 25.5%), +63 cards. Engine 88 / translate 47 / validate 16, tsc clean, play-cli completes.**

**Batch 2 — Force tokens** (per Christian's ruling: per-player resource, max one each, NOT the shared counters): `use_force` ("Use the Force. If you do, X" → spend the controller's token if held, then do X; else no-op) + `gain_force` ("The Force is with you"). Matcher strips the reminder + tolerates the spacing; "You may use the Force" → optional. Added `Ready this unit.` → ready-self. Fixtures W8_007/008. **+27** (events 48→55).

**Batch 3 — multi-source power damage** `power_damage_from_each`: each source deals its OWN power to a shared target (vs `amountFromPower`'s single self-source). `sources_same_arena_as_target` for Focus Fire; Maximum Firepower's 2-sentence form detected at whole-text level (2 chosen sources). Also unlocks the Command modal's power-damage option. Fixtures W8_009/010/011. **+3.**



- **Token creation:** "Create N <Token> tokens" → `create_token`, mapping the printed name to the engine's `TOKEN_REGISTRY` key (now exported from the engine index) and using the token's arena for the zone. Unknown tokens stay residual. Flipped the "Choose one: Create…" modals to full. **+21 cards** (biggest single win of the batch).
- **`remaining_hp` predicate** = effective HP − damage (Christian's call: correctness over the printed-stats convention). Documented exception; safe from the modifier cycle (selector-filter use only). Matcher: "Defeat a[n] [enemy] [non-leader] unit with N or less remaining HP". Verified upgrade-buffed units (effective HP > N) are correctly not targetable. **+6.**
- **`trigger_controller_base` selector** ("its controller's base" on a defeat trigger; resolves `DEFEATED.lastKnown.controller`'s base). Matcher: "When an enemy unit is defeated: deal N to its controller's base". **+6.**
- Fixtures W8_001–006 now cover the session's primitives; each has matcher + engine scenarios.

**DESIGN DECISIONS RECORDED (Christian, 2026-05-31):**
1. **The Force = per-player boolean, NO transfer** (the current `forceToken` model is correct for Twin Suns). "Use the Force" should spend the player's own Force token. *Not yet built* — when implementing, still verify against the current Comprehensive Rules and flag if the official rule differs (my cached rules PDF predates the Force mechanic).
2. **`remaining_hp` uses effective HP** (done this session).

**Top residuals / next candidates (after session 53):** "this event costs N less to play for each friendly leader unit" (cost reduction — needs a dynamic-cost mechanic), "this unit can attack N units instead of 1" (multi-attack), "Coordinate — this unit gets +N/+N" (Coordinate self-buff — Coordinate exists as a predicate but not this self-buff shape), control-transfer ("take control of a non-leader unit" — Liberated by Darkness, needs an `owner`≠`controller` model + start-of-regroup return), discard-pile recursion ("return a unit from your discard pile to your hand"), bounce near-misses ("…to its owner's hand. If you do, …" compound + trailing-space "hand ." variant + the "When this unit is attacked" trigger), "name a card" naming mechanic, "if a friendly unit left play this phase" conditional. Token creation w/ disclose-conditional (Chancellor Palpatine Spy) now mostly works via the disclose + create_token primitives — re-check. Multi-clause "if you do / if you do not" branches (Do or Do Not) need an if/else compound.

---

*(2026-05-30 session 52)* **First browser UAT of "Test for Claude" by Christian. TWO real bugs fixed (deployed leaders entered EXHAUSTED → now READY per §3.4.4c; mandatory single-target picks could be confirmed with 0 selected → effect fizzled while cost was paid — the Tarkin Experience bug). Shoretrooper "+2/+0" was correct (needs 6 resources). Plus 2 approved features: zero-target legality gate + `deploy_box`→`leaderUnitAbilities`. tsc clean · scenarios 78 · translate 36 · validate 16.**

UAT results triaged (all verified against code + the Comprehensive Rules PDF, not memory):
1. **Real-deck load: PASS.**
2. **Tarkin leader action — "can't assign the Experience token": REAL bug, FIXED (modal layer).** ⚠ My first triage was wrong (I'd concluded "no Imperial units in play" — Christian corrected me: Seasoned Shoretrooper IS an Imperial unit and WAS in play). Root cause found by elimination: the engine/matcher/translator/`stepAsync` are all correct (proven with a real-card repro — the prompt surfaces with the Shoretrooper as a candidate). The bug was in the **chooser→modal contract**: the matcher emits a *mandatory* single target as `count: 1` (a plain number), and `selectors.ts` derived **`minCount: 0`** from any numeric count. So `ChoicePromptModal`'s `canSubmit = picked.length >= min` was true with **0 selected** — the Confirm button was enabled with nothing picked, the hint read "Pick 0–1 targets," and confirming with 0 returned empty targets → `give_experience` applied to nobody → step settled and the resource was spent for nothing. (Latent for EVERY mandatory single-target effect — damage/exhaust/etc. — not just Tarkin.) **Fix:** `selectors.ts` now treats a numeric `count: N` as mandatory → `minCount = min(N, candidates.length)`, `canPass` only for `{min:0,...}` ranges. The modal now forces selecting the target. Verified: Tarkin's prompt is now `count 1, minCount 1, canPass false`. Headless choosers (`defaultChooser` auto-picks first-N regardless of minCount) are unaffected, so scenarios/AI unchanged. **Christian: please re-test in the browser to confirm** — I fixed the contract but couldn't drive the exact authenticated browser session headlessly. Also note (separate gap): **Tarkin's `deploy_box` "On Attack: …give an Experience token to another Imperial unit" is inert** — `translateCard` only matches the leader's `text` column into `leaderAbilities`; `leaderUnitAbilities` stays `[]`.
3. **Leader deploy free: PASS. Leader-exhaust-on-deploy: FIXED (real bug).** Christian was right — deployed leaders enter the arena READY (§3.4.4c: "enters the ground arena ready, even if it was exhausted before"), the exception to §3.4.4b (non-leader units enter exhausted). Engine had it backwards (`exhausted: true`, citing "§v7" — wrong). Fixed `reducer.applyDeployLeader` → `exhausted: false`; added scenario "Leader deploy: enters READY and can attack the same round (§3.4.4c)"; updated CLAUDE.md rules note. This is the 3rd SWU-rule-from-memory miss — the PDF (`pdftotext` over the Comprehensive Rules) is the oracle.
4. **Seasoned Shoretrooper "+2/+0 didn't change stats": NOT a bug.** Repro confirms the conditional fires correctly: 3/5 resources → printed 3/6; **6/7 resources → 5/6 (+2/+0)**. Christian had fewer than 6 resources at the time; threshold is 6. (97th Legion per-resource scaling was not exercised in this UAT.)
5. **Regressions: all PASS.**
6. **Choice modal: works except Tarkin** — same root cause as #2 (the mandatory-target `minCount: 0` bug), fixed there.

**Two follow-ups Christian approved + DONE this session:**
- **Zero-target gate:** `legal.ts` no longer offers a `USE_ACTION_ABILITY` whose effect has a *mandatory* `chosen` target with no candidates (resolves the candidate set with `defaultChooser`, skips if empty). `optional` ("you may") effects and `{min:0}` ranges are never gated. Scenario added: "Action ability: NOT offered when its mandatory target has no candidates."
- **`deploy_box` → `leaderUnitAbilities`:** `translateCard` now runs the matcher over a leader's `deploy_box` column (as a unit) and routes the result to `leaderUnitAbilities` (was hard-coded `[]`). Unlocks deployed-leader On-Attack/When-Played abilities corpus-wide (e.g. Tarkin's "On Attack: give an Experience token"). Translate-scenario added.

**Verification:** tsc clean · scenarios 78/78 · translate-scenarios 36/36 · validate-scenarios 16/16 · `play-cli --ai both` completes.

---

*(2026-05-30 session 52 cont.)* **Task #58 started — power-based damage primitive ("deals damage equal to its power").**

- **AST:** `DamageEffect.amount` is now optional; added `amountFromPower?: Selector`. When set, the damage amount is the effective power of the FIRST unit the selector resolves to (usually `{ self: true }`), snapshot once before any damage lands so mid-resolution damage can't change it. Provide `amount` OR `amountFromPower`.
- **Interpreter:** `applyDamage` computes the dynamic amount via `powerFromSelector` (`resolveSelector` → first unit → `effectivePower`). Buffs/auras/experience tokens are included because it reads effective (not printed) power.
- **Validator:** a damage effect now needs `amount` OR `amountFromPower` (the latter validated as a selector). The all-fixtures regression scenario covers the new `W8_001` fixture.
- **Matcher template:** "This unit deals damage equal to its/his/her power to an (enemy) (ground|space) unit." → `damage` with `amountFromPower: {self}` and a zone+controller-scoped chosen target. Covers Crosshair's "Following Orders" action line.
- **Fixture + tests:** `W8_001` Marksman Clone (4 power, `Action [Exhaust]: power-damage to an enemy ground unit`). Scenario verifies 4 damage to a 5-hp Wampa, and that +1 experience (5 power) defeats it. Matcher scenario verifies the AST shape.

**Verification:** tsc clean · scenarios **79** · translate **37** · validate **16** · play-cli completes. Corpus: 490 fully playable (21.9%).

**Power-damage tail still open (multi-source — different shape, ~2 cards):** Focus Fire ("Each friendly Vehicle unit in the same arena deals damage equal to its power to that unit") and Maximum Firepower ("A friendly Imperial unit deals damage equal to its power to a unit. Then, another…") need a *per-source* template where EACH unit in a set deals its OWN power — distinct from the single-self-source case shipped here. Defer until the rest of task #58 (token-creation conditionals, control-transfer, play-from-discard, etc.) is scoped.

**Next:** Christian to re-test Tarkin's Experience action (un-deployed action + now the deployed On-Attack) in the browser. Continue task #58 — next genuinely-new mechanic (multi-source power damage, or token-creation conditionals / control-transfer / play-from-discard).

---

*(2026-05-30 session 52 cont. — more task-#58 primitives)* **Modal choice framework + return-to-hand. Corpus 490 → 497 fully playable (22.2%). Engine 81 / translate 40 / validate 16, tsc clean.**

- **Modal "Choose one/two":** `choose_one` gained `count?` (2 = "Choose two, in any order"); `applyChooseOne` loops, excluding picked options. `parseModalEffect` parses the multi-line modal block → `choose_one`, wired into `matchCard` for events at whole-text level. **Also fixed a latent correctness bug:** modal events were previously clause-split so every mode fired unconditionally; now it's a real choice (or residual if any mode is untemplated). Fixtures W8_002.
- **Return-to-hand (bounce):** new `return_to_hand` effect — unit → owner's hand as a fresh card (damage/exhaust/shields/Experience reset, upgrades discarded, leaders skipped; owner=controller until control-transfer exists). Matcher handles enemy/friendly/non-leader/cost-filtered + self forms. Power-filtered bounce deferred (no `card_power` predicate). Fixture W8_003.
- **AOE / multi-target damage (matcher-only):** "Deal N to each of up to M [enemy] units" + "Deal N to each [enemy|friendly] [non-leader] unit" (reuses `applyDamage`'s target loop). "Give a Shield token to a friendly unit and to an enemy unit" → `sequence` of two grants. Fixture W8_004.
- **`has_shield_token` predicate** (true iff `inst.shieldTokens > 0`): unlocks "Defeat an enemy unit with a Shield token on it". Together with the compound shield, this finishes the Darth Vader-style units.
- **Running total this session:** corpus 490 → **508 fully playable (21.9% → 22.7%)**; engine scenarios 76 → 82, translate 35 → 42, validate 16. tsc clean, play-cli completes throughout.

**Top residuals remaining (next data-driven picks):** "when an enemy unit is defeated: deal N to its controller's base" (6, needs event-contextual target = defeated unit's controller's base), "you may use the Force; if you do, …" (Force-token spend — several buckets), "defeat a non-leader unit with N or less remaining hp" (needs `remaining_hp` predicate = effectiveHp − damage), "you may return a non-leader unit … to its owner's hand. If you do, …" (bounce + "if you do" compound; also a trailing-space `hand .` variant), "this unit can attack N units instead of N" (multi-attack), token creation (Spy/Clone/Droid — needs verified token-stats data table, still deferred). Each is its own primitive/selector.

---

*(2026-05-29 — SESSION CLOSE)* **Tier-1 matcher matured deck-by-deck. "Test for Claude" (Experience deck) 17% → 40% playable; corpus 18.4% → 21.8% (matched-full 51 → 128 cards). Engine 76 / matcher 35 / validator 16 — all green; tsc clean; play-cli completes. Next session opens with a playtest pass (checklist below), then task #58 (harder primitives, power-based damage first).**

### ▶ Playtest checklist — DO THIS FIRST next session

Load **"Test for Claude"** in `/playtest` (DECK SOURCE → MY SAVED DECKS; needs login). Watch for these specifically and report anything off:

1. **Real-deck load works at all** — the authenticated `/api/decks` fetch + translate path was only verified headlessly. Confirm the deck builds a game and the board renders.
2. **Experience tokens visibly buff units (+1/+1 each):**
   - Tarkin's `Action [1 resource, exhaust]: Give an Experience token to an Imperial unit` → target unit goes +1/+1.
   - Gideon Hask → Experience to a friendly unit when an enemy unit is defeated.
   - General Tagge (When Played → up to 3 Troopers) and Outland TIE Vanguard.
3. **Leader rules:** deploy is **free** (threshold on *total* resources — spending on a unit first shouldn't block it) and **once-per-game** (deploy → get the leader-unit defeated → it flips back → can't redeploy).
4. **Auras / conditional grants update live:** Piett (cost-6+ units gain Ambush), Bunker Defender (Sentinel while you control a Vehicle), Shoretrooper (+2/+0 at 6 resources), **97th Legion (+1/+1 per resource — watch it scale as resources change)**.
5. **Regression re-checks** (fixed earlier, confirm still good): setup places **2** resources; taking initiative doesn't hang (turn 1 and mid-round); **PLAY AGAIN** resets the game.
6. **Choice modal** fires correctly for any card needing a target/branch pick.
7. **Inert cards don't crash** — the ~31 unmatched cards should play as plain stat/keyword bodies and simply do nothing on their text (no errors).

**Do NOT report as bugs (known-inert, deferred to task #58):** Palpatine's Return, Choose Sides, Shatterpoint (modal+Force), Sith Traditions (upgrade-granted ability), Power of the Dark Side, Crosshair's 2nd action / Focus Fire / Maximum Firepower (power-based damage), Death Star Plans, Chancellor Palpatine (Spy tokens), Captain Enoch (discard-pile counting), Darth Revan's leader trigger. These are tracked.

---

*(2026-05-29 session 51)* **Per-deck coverage tool + first real deck analyzed. Christian's Experience-themed "Test for Claude" deck: 9/52 playable now (17%); the keystone need is the Experience-token primitive (6 cards incl. both leaders' signature abilities). Also fixed: local backend was serving an EMPTY card DB.**

- **Empty-card-DB fix (environment, not code):** the running backend reads `~/.swu/swu_cards.db`, which had **0 cards** (DB_DIR-unset default). Every card view was blank. Imported the full 2,360-card data in-place into `~/.swu/swu_cards.db` (cards + aspects/keywords/traits/arenas) — no backend restart, account/decks in `~/.swu/swu_app.db` untouched, timestamped backup made. Backend now serves 136 leaders / 2,035 grouped cards. **Permanent fix still open:** account/decks live in `~/.swu/swu_app.db` while canonical card data is in `repo/databases/` — consolidating onto one `DB_DIR` needs a small app-DB migration (offered, not yet done).
- **`deck-coverage` script** (`npm run deck-coverage -- <decklist.txt>`): parses a standard SWU decklist, looks each card up in `swu_cards.db`, runs the Tier-1 matcher, and reports per-card coverage + a themed tally of what the uncovered cards need (Experience/Force/bounce/modal/etc.). The "decks to 100%" instrument — turns a decklist into a precise build list.
- **First deck analyzed (Test for Claude):** 52/52 found. 9 vanilla-playable, 43 need work. Theme tally: 11 When-Played · 6 Experience token · 6 On-Attack · 4 When-Defeated · conditional/shield/heal/modal/Force singles. Trigger *framework* already exists; the gap is mostly the *effects* triggers call. Keystone = **Experience tokens**.
- **Experience-token primitive DONE (session 51, task #55):** `CardInstance.experienceTokens` → +1/+1 each in effective stats; `give_experience` effect (AST + interpret + validator); matcher templates (give-to-target with trait/cost filters, give-to-each-of-up-to-N, friendly-default); defeat-of-another-unit trigger prefixes. Test deck 17% → **23%** (9 → 12 cards). Engine 73 / matcher 27 / validator 16 — green. The 3 remaining Experience cards bundle other mechanics: **Tarkin + Revan need leader-text matching** (leaders still 0%); **Sith Traditions needs upgrade-granted-ability parsing**.
- **Close-miss templates + leader-action matching DONE (session 51b, task #56):** trait-qualified give buff, ready-a-unit, heal-a-unit, indirect-damage-to-player (→ opponent base); `parseActionClause`/`parseActionCost` for `Action [<cost>]: …`; leader text now routes to `leaderAbilities` (unlocks Tarkin's Experience action). Test deck **23% → 33%** (12 → 17 cards, 8 full). Matcher 30 / engine 73 / validator 16 — green.
- **Deck-driven primitives DONE (session 51c, task #57):** `controller_resource_count` + `controller_controls_trait` predicates; **per-X scaling modifier** (`Modifier.per`, e.g. "+1/+1 for each resource you control" — 97th Legion); keyword-grant auras (Piett); conditional self-grants (Shoretrooper, Bunker Defender); self phase-buff. Test deck **33% → 40%** (17 → 21 cards). **Corpus-wide: matcher-full 51 → 128 cards** (2.3% → 5.7%), fully-playable 18.4% → **21.8%** — these primitives unlock ~77 cards pool-wide. Engine 76 / matcher 35 / validator 16 — green.
- **Remaining deck tail (task #58), genuinely-new mechanics (~1–2 cards each):** token creation w/ conditionals (Spy — Palpatine), control-transfer (Choose Sides, Death Star Plans), play-from-discard (Palpatine's Return), **power-based damage** ("deals damage equal to its power" — Crosshair/Focus Fire/Maximum Firepower; high corpus value), upgrade-granted-ability host-redirection (Sith Traditions), modal choose-one + Force (Shatterpoint), discard-pile counting (Enoch), Revan's leader trigger. Re-run `deck-coverage` after each.

---

*(2026-05-29 session 50)* **L4 Tier 1 built + measured: deterministic template matcher (`engine-v2-data/match.ts`) + coverage report over the full 2,360-card DB. Honest finding: Tier 1 covers ~18% of deckable cards (mostly vanilla/keyword) — the regex ceiling is low, the real levers are new primitives + the LLM tier. Matcher wired into the translator (real decks now get matched abilities). All suites green.**

**The measured number (the point of building this first):**
- 2,241 deckable cards (unit/event/upgrade/leader). Coverage: **vanilla 16.1% · matcher-full 2.3% · partial 1.7% · none 80.0%** → **18.4% fully playable**, 81.6% need work.
- By type: units 25% playable, events 6%, upgrades 9%, **leaders 0%** (their text→leaderAbilities/leaderUnitAbilities split isn't matched yet).
- Every emitted ability validates clean (0 invalid AST across the corpus — the matcher and validator agree).

**My earlier hypothesis was wrong, and the data says so.** I'd guessed the template matcher would cover 60–80% of ability-bearing cards. It covers ~18%. Reasons, from the residual tally:
1. SWU ability text is far more diverse/multi-clause than templating handles cheaply.
2. A large fraction needs **engine primitives that don't exist yet** — Force tokens, Experience tokens, return-to-hand (bounce), mill, modal "Choose one/two," conditional "if you control [named card / trait count]," indirect-damage-to-a-player. No matcher *or* LLM can emit working AST for a primitive the engine lacks.

**This reframes the plan:** the lever isn't more regex (diminishing returns — top residuals are now genuinely hard). It's **(a) expand the primitive vocabulary** and **(b) the LLM tier for text→AST**, both focused via your "decks I play to 100% first" strategy. Chasing 2,000 cards corpus-wide is the wrong order; targeting your actual decks' specific cards + the primitives they need is tractable.

**What shipped this session:**
- `engine-v2-data/match.ts` — `matchCard(card) → { abilities, coverage, residual }`. Ports v1's `parseEventText`/constant patterns to emit v2 AST. Strips keyword-reminder + "Attach to…" (attach restriction, not an ability) clauses. Templates: event whole-text (draw / damage / heal / phase buff/debuff / exhaust / shield / defeat), unit triggered prefixes (When Played / On Attack / When Defeated wrapping the effect parser, with `You may` → optional), simple constant auras, `While this unit is upgraded` self-conditional.
- `engine-v2-data/coverage_report.ts` (`npm run coverage-report`) — runs the matcher over `swu_cards.db`, validates emitted AST, prints coverage by type + top-30 unmatched clause shapes (the to-build list). Resolves the DB via `DB_DIR` or repo-root probe.
- Matcher **wired into `translateCard`** — real decks now receive matched abilities (validated-clean), inert otherwise.
- 8 matcher scenarios added to `translate-scenarios` (24/24).
- **`engine-v2-data/TIER2_LMSTUDIO_HANDOFF.md`** — self-contained runbook for the Mac mini Claude Code instance to stand up LM Studio (model + OpenAI-compatible server + **schema-constrained JSON** smoke test) for Tier 2. Per your call: Mac mini + LM Studio (not Ollama).

**Verification:** tsc clean · scenarios 70/70 · translate-scenarios 24/24 · validate-scenarios 16/16 · coverage-report runs over 2,360 cards.

**What I need from you next (per "decks I play to 100% first"):** your actual decklist(s) — or just the leaders + key cards. With those I can report per-deck coverage and a precise "here are the N primitives + M cards your decks need," which is the tractable path to a fully-correct real game. The LM Studio handoff doc is ready to pass to the mini whenever you want Tier 2 infra stood up (it can proceed in parallel).

---

*(2026-05-28 session 49)* **Leader-deploy rule corrected: FREE deploy + once-per-game Epic Action. Verified against official SWU rules (NOT a house rule — I was wrong twice from memory; Christian was right). Scenarios 70/70 + translator 16/16 + validator 16/16. TypeScript: 0 errors.**

**Correction to my earlier framing:** I initially implemented free deploy as a "Twin Suns divergence." Christian corrected me that it's standard SWU; I web-verified the official rule and he's right. Leader deploy is an **Epic Action** ("If you control N or more resources, deploy this leader") — using an Epic Action does **not** spend resources; N is a threshold on resources *controlled* (total pool). It's also **once per game**: a deployed leader that's defeated flips back but **cannot redeploy**. My engine was violating the once-per-game rule (infinite redeploy after flip-back) — now fixed:
- `LeaderInstance.hasDeployed?: boolean` (set on deploy, never cleared, survives flip-back).
- `reducer.applyDeployLeader` throws if `hasDeployed`; `legal.ts` gates `DEPLOY_LEADER` on `!hasDeployed`.
- New scenario: deploy → defeat → flip-back → redeploy is illegal + throws. Existing flip-back scenario now also asserts `hasDeployed` survives.
- `CLAUDE.md` updated: removed the false "divergence" label; added a standing "verify SWU rules against the source, don't author from memory" note (Claude has now been wrong on SWU rules twice).

UAT round 2 results: setup-resource fix (#1 from session 46), initiative-hang fix (#2), and PLAY AGAIN (the session-47 remount-key fix) all confirmed working. One new item: deploying a leader was consuming resources, which Christian flagged — in Twin Suns, **leader deploy costs no resources**; the deploy cost is a *threshold* on the total resource pool, not a payment.

I pushed back first (AskUserQuestion) because standard SWU *does* charge resources to deploy and I wanted to confirm this was an intentional house rule rather than overwrite a real rule with an assumption. Christian confirmed: free deploy, threshold on total. Implemented:
- `reducer.applyDeployLeader` — gates on `p.resources.length >= cost` (total, incl. exhausted); removed the exhaust loop + `RESOURCE_SPENT` events. Leader-unit creation/flip/exhausted/`LEADER_DEPLOYED` unchanged.
- `legal.ts` — `DEPLOY_LEADER` gated on total resources, not ready.
- **Did NOT touch unit-play exhaustion** — that's a separate rules question (interacts with Ambush) and wasn't reported.

**The divergence is now recorded in `CLAUDE.md` > Principles** so a future session doesn't "fix" deploy back to charging resources. Christian is the rules authority for Twin Suns; confirmed divergences get logged there.

**Scenarios:** renamed "deploy pays cost" → "deploy is free — spends no resources" (+ asserts total/ready unchanged + no `RESOURCE_SPENT`). 3 new: gated-on-total (exhausted resources count), playing-a-unit-first-doesn't-block-deploy (the exact UAT case), blocked-when-total<cost.

**Verification:** `npx tsc --noEmit` clean · `npm run scenarios` 69/69 · `npm run translate-scenarios` 16/16 · `npm run validate-scenarios` 16/16 · `npm run play-cli -- --ai both` completes.

**Still on Christian's plate to test:** live "MY SAVED DECKS" deck loading (needs login — the one path not headlessly verifiable). Re-test leader deploy with a real deck to confirm the fix lands there too.

---

*(2026-05-26 session 48)* **Spec validator — the gate between any spec source and the engine registry. Decision-independent L4 groundwork (needed under LLM-cascade, template-matcher, OR hand-authoring). All 41 fixtures validate clean; validator suite 16/16. Scenarios 66/66 + translator 16/16 + validator 16/16. TypeScript: 0 errors.**

Built deliberately *instead* of diving into the L4 rules-text → AST cascade, because that fork (local model vs Claude-assisted vs hand-authoring) is a real architecture decision with homelab/token-cost implications that's Christian's to make. The validator is what every one of those approaches needs: a gate that checks ability-AST output against the engine's closed primitive vocabulary before it reaches the registry. The engine's interpreter/selectors/predicate-evaluator silently no-op on unknown discriminators, so an LLM or a typo can produce a spec that loads fine and does nothing at the table. The validator turns that silent failure into a loud one with a precise path.

**New files (2):**
- `spec/validate.ts` — `validateCardSpec`, `validateBaseSpec`, `validateSpecs`. Walks the full AST (effects, selectors, predicates, modifiers, abilities, trigger predicates, action costs) against every closed enum: 22 effect kinds, 4 ability types, 12 trigger conditions, 10 zones, 6 aspects, 4 player refs, selector modes, durations, restrictions, replacement-`on` kinds, move/look_at/search sub-enums, predicate-leaf fields, modifier fields. Two severities: **error** (not in closed vocab / required field missing or wrong-typed → reject) and **warning** (valid SWU but inert, e.g. an unimplemented keyword like Bounty/Coordinate → loads, does nothing). Errors carry a precise path (`W2_007.abilities[0].do.steps[1].target.badkey`).
- `scripts/validate_scenarios.ts` (`npm run validate-scenarios`) — 16 scenarios: (1) all `ALL_CARDS` + `W1_BASES` validate with zero errors [regression net — validator and fixtures check each other]; (2) 15 malformed-spec cases each produce the expected error at the expected path (bad type/aspect/arena, missing power, unknown effect kind, unknown trigger condition, missing damage amount, unknown predicate field deep in a filter, unknown modifier field, bad replacement `on`, bad move arena, precise nested-path reporting, unimplemented-keyword-is-warning, implemented-keyword-no-warning, non-numeric base hp).

**Modified files (2):**
- `index.ts` — exports `validateCardSpec`, `validateBaseSpec`, `validateSpecs`, `ValidationResult`, `ValidationIssue`, `Severity`.
- `package.json` — `validate-scenarios` script.

**Design decisions (in code):**
- **error vs warning tier.** Unknown *keywords* are warnings (Bounty/Coordinate/Smuggle/etc. are real SWU, just not implemented — they load and sit inert). Everything structural (unknown effect kind, bad enum, missing required field) is an error. `ok` = no errors; warnings never block.
- **Imports `KEYWORDS` to decide warn-vs-accept on keyword names** — auto-syncs as keywords are implemented, instead of a hand-maintained list that would drift. The validator is a tool (not on the hot path), so the `spec/ → primitives/` import is benign.
- **Closed-vocab sets are hardcoded string Sets** (TS types are erased at runtime, so they can't be derived). The forcing function against drift: scenario (1) validates every fixture — add an effect kind to the AST + a fixture using it but forget to teach the validator, and that scenario fails.
- **`buildRegistry` left unchanged** — validation is opt-in (`validateSpecs`), not forced into the loader, so existing callers and the structural-only path are untouched. The obvious L4 wiring point: validate each translated/generated spec before it enters the registry, downgrading invalid abilities to inert. Not wired now because translator output is `abilities: []` (trivially valid) — adding it against empty abilities would be busywork; it lands with the L4 cascade.

**Verification:** `npx tsc --noEmit` clean · `npm run validate-scenarios` 16/16 (41 fixtures + 2 bases clean) · `npm run scenarios` 66/66 · `npm run translate-scenarios` 16/16 · `npm run play-cli -- --ai both` completes.

---

*(2026-05-26 session 47)* **Real-card → v2 translator + "play your own deck" in /playtest. New `engine-v2-data` module translates backend cards (stats + keywords) into v2 specs; the playtest setup screen can now load your saved decks. Scenarios 66/66 + translator 16/16. TypeScript: 0 errors.**

This is the "real card data flow" step — the deck-builder half of the L4 problem, deliberately scoped to the *structured* half. A real deck now loads and plays with correct stats and working keywords; card rules-*text* effects stay inert until the rules-text → AST pipeline lands (that's the genuinely hard, multi-week L4 cascade with the local LLM — not attempted here).

**New module: `frontend/src/lib/engine-v2-data/`**
- `translate.ts`:
  - `normalizeType/Aspects/Arena/Traits` — backend Title-Case → v2 lowercase enums. All six SWU aspects map directly; unknown aspects are dropped defensively.
  - `parseKeywords(card)` — backend keywords are name-only (`["Raid","Sentinel"]`); for the value-carrying keywords (Raid/Restore) the N is pulled from the rules `text` with a narrow regex (`/\bRaid\s+(\d+)\b/i`), with a fallback for a value baked into the keyword string. This is bounded text extraction, NOT ability parsing.
  - `translateCard(card)` → `{ spec | base | skipped }` for unit/event/upgrade/leader/base. Units map attack/health→power/hp + arena; upgrades map attack/health→powerModifier/hpModifier; leaders fall back to 3/6 when the DB has NULL stats (common — mirrors v1's `LEADER_DEPLOYED_STATS` fallback); bases use health with a 30 fallback. Every spec gets `abilities: []`.
  - `buildGameFromDecks(p1Deck, p2Deck, opts)` → `{ config, registry, warnings }`. Builds a complete playable `CardRegistry` (base→`registry.bases`, everything else incl. leaders→`registry.cards`) + per-player `DeckConfig` (quantity-expanded `deckCardIds`, leader/base excluded from the deck pile via the v1 `excludedIds` guard). Throws only on a deck with no base.
- `index.ts` — public exports.
- `translate_scenarios.ts` (`npm run translate-scenarios`) — 16 scenarios: 12 shape-mapping assertions + 4 integration (registry/config shape, token-skip warning, no-base throws, **and a translate→buildGame→AI-vs-AI-to-completion test that plays a translated pair of decks to a real winner** — proof the produced registry+config is genuinely playable, p1 won in round 5).

**Playtest UI: "MY SAVED DECKS" deck source**
- `PlaytestClient` setup screen gains a DECK SOURCE toggle (FIXTURE DECK / MY SAVED DECKS).
- "My decks" `fetchWithAuth('/api/decks')` on demand, picks your deck + opponent deck (defaults to a mirror). On START, fetches full deck detail (`/api/decks/{id}`) for stats/keywords, runs `buildGameFromDecks`, and hands the translated `{config, registry}` to the same `Board` — Board doesn't care where they came from.
- Graceful degradation: not logged in / fetch fails / no decks → clear message, FIXTURE DECK path still works. Additive only.
- A clear ⚠ note tells the user real cards play with stats+keywords but text abilities are inert.

**Latent bug fixed in passing: PLAY AGAIN didn't reset the game.** `useGameV2` holds state in `useState` (lazy init runs once); the old `seed`-bump approach changed the config object but never re-initialized the hook, and `Board` wasn't keyed. Now `Board` is keyed on a `gameKey` that bumps on restart → clean remount → fresh `initGame` (reshuffled). Fixes restart for both fixtures and real decks.

**Verification:**
- `npx tsc --noEmit` — clean across engine-v2 + engine-v2-data + engine-v2-react + app/playtest.
- `npm run scenarios` — 66/66.
- `npm run translate-scenarios` — 16/16 (incl. translate→play-to-completion).
- `npm run play-cli -- --ai both` — completes.
- `/playtest` + `/playtest/smoke` SSR — both 200, DECK SOURCE / MY SAVED DECKS strings present, no error indicators.

**Known limits of real-deck play (by design this session):**
- **Card text abilities are inert.** Only stats + the 8 implemented keywords fire. A real deck will feel like "vanilla + keywords" — no When-Played triggers, no event effects, no leader abilities, no upgrade-granted abilities beyond stat/keyword. This is the L4 boundary.
- **Live deck play needs the user logged in** (fetches `/api/decks`). The translator itself is fully verified headlessly; the fetch/auth path is built + SSR-verified but I can't exercise a real authenticated fetch in the headless env.
- **Uniqueness not enforced** — backend doesn't expose a `unique` flag and the engine has no rule-of-one state-based action yet.

---

*(2026-05-26 session 46)* **Engine v2 UAT bug fixes — setup resources, initiative-take, leader-attack power display. Three real bugs and one cosmetic, all from the first browser play session. Scenarios 66/66. TypeScript: 0 errors.**

### Bugs reported in session-45 UAT + fixes

**Bug #1: only able to place 1 resource during setup (AI got 2 — correct).** `advanceSetupAfterResource` was setting the `setup_declined` flag whenever `(hasResourced && resources < 2)`, which fires after EVERY `RESOURCE_CARD` action (not just declines, since both action paths set `hasResourced=true`). First action by p1 → flagged as declined → skipped for the rest of setup → p2 gets both placements. Fix: pass an explicit `declined: boolean` parameter; only set the flag on `DECLINE_RESOURCE`. Also restructured the helper so `setupDone` reads from the post-flag state instead of the captured input (the previous closure-captured state didn't see the flag until the *next* call).

**Bug #2: game hangs after taking initiative.** Two compounding issues. (a) `legal.ts` only checked the asking player's own `countersHeld.includes('initiative')` when deciding whether to offer `TAKE_COUNTER` — so after p1 took initiative, `TAKE_COUNTER` was still legal for p2. If both players ended up with `hasTakenCounterThisRound=true`, the skip-loop in `advanceToNextTurn` bounced between them until the safety counter ran out, leaving `activePlayer` on a seat with no legal actions and no auto-advance. (b) `advanceToNextTurn` had no defensive end-action-phase fallback. Fix: `legal.ts` now checks `state.playerOrder.some(o => state.players[o].hasTakenCounterThisRound)` and suppresses `TAKE_COUNTER` if ANYONE took it this round. `advanceToNextTurn` now ends the action phase if every player has taken their counter, as a defensive backstop.

**Bug #3: only able to PASS after deploying leader.** Likely not a bug — deploy costs 4 → 0 ready resources → hand cards unaffordable → no units to attack with → PASS is the only legal action. The leader entered exhausted per §v7 (correct). Closing as expected behavior.

**Bug #4: Clone General attack shows `?` power.** `describeAction`'s ATTACK case gated power lookup on `isUnit(spec)` which is false for leader specs. Fix: replaced with `effectivePower(state, reg, attacker.inst, controller)` — now leaders and tokens display their actual power, including any aura/upgrade buffs.

**Verification:**
- `npx tsc --noEmit` — clean.
- `npm run scenarios` — 66/66 passing (61 holdovers + 5 new for the UAT fixes).
- `npm run play-cli -- --ai both` — completes.
- `/playtest` and `/playtest/smoke` SSR — both 200, no error indicators.

**New scenarios (5):**
- "UAT bug #1: RESOURCE_CARD during setup does NOT set setup_declined flag" — drives a real setup phase, places one resource, asserts no flag and active switches.
- "UAT bug #1: full setup gives both players 2 resources" — alternating placements through to action phase, both players at 2 resources.
- "UAT bug #2: TAKE_COUNTER not legal for opponent after I take initiative" — hand-builds a state where p1 has taken initiative, asserts p2's legal actions don't include `TAKE_COUNTER`.
- "UAT bug #2: action phase ends gracefully if both players took counter" — defensive — handcrafts both flags set, confirms one PASS transitions to regroup.
- "UAT bug #4: describeAction shows real power for leader attacks" — Clone General as the attacker; asserts the description contains "5 power" (printed 4 + 1 from own clone aura), not "? power".

---

*(2026-05-26 session 45)* **Engine v2 Week 7b landed — `/playtest` browser route + base-damage replacements + deterministic deck shuffle in `search`. v2 engine runs end-to-end in the browser; the replacement layer now covers all damage (unit and base, combat and non-combat); `search` shuffles the deck per §v7 8.36 with a state-derived seed for replay safety. Scenarios 61/61. TypeScript: 0 errors.**

The UI UAT artifact ships. Visit `/playtest`, pick a mode (Human vs AI / AI vs AI / Human vs Human), click START GAME. The board renders both players' mats with deployed leaders, units (with effective stats accounting for upgrades + auras), upgrade stacks, capture zones, resource pips. AI seats auto-dispatch via the heuristic chooser; human seats dispatch via the legal-actions list and surface async prompts (`choose_one`, `prompt_target`, `optional`) through a modal overlay.

**New module: `frontend/src/lib/engine-v2-react/`**
- `useGameV2.ts` — the React adapter. Holds `GameState`, threads `stepAsync`/`resolveStep` for human turns, auto-dispatches AI turns via synchronous `step()` + heuristic chooser. Returns `{ state, pending, events, legalActions, isMyTurn, isAiThinking, dispatch, resolveChoice, restart }`. Engine is pure-functional, so no ref-to-mutable-instance like v1's `useGame` needed — just `useState<GameState>`.
- `ai.ts` — ported `aiPick` from `play_cli.ts` (greedy: highest-cost playable card → deploy → ATTACK base → ATTACK → action ability → counter → pass). Plus `aiChooser` (auto-leftmost/yes/first-N) for chooser callbacks during AI turns.
- `index.ts` — public exports.

**New route: `/playtest`** under `frontend/src/app/playtest/`:
- `page.tsx` — server component wrapper.
- `PlaytestClient.tsx` — top-level client; setup → playing → ended state machine, deck/leader/base selection from fixtures, AI-mode toggle.
- `Board.tsx` — root board layout. Two PlayerMats stacked vertically, action picker + event ticker on the right, choice modal overlay when pending.
- `PlayerMat.tsx` — per-player display: base + HP + counters, leader chips, ground arena, space arena, capture zone, resource pips, hand (own perspective shows contents; opponent perspective shows facedown).
- `UnitCard.tsx` — single unit display. Effective power/HP via `effectivePower`/`effectiveHp` (so aura buffs + upgrade modifiers are visible), damage indicator, exhausted overlay, shield count, upgrade stack below.
- `ActionPicker.tsx` — legal-actions list grouped by kind (PLAY / DEPLOY / ABILITY / ATTACK / RESOURCE / OTHER), each as a clickable button using `describeAction`.
- `ChoicePromptModal.tsx` — modal overlay rendering `choose_one` (option buttons), `prompt_target` (multi-select target picker with confirm), `optional` (yes/no). Targets are pretty-printed via `renderTarget`.
- `smoke/` subroute — developer-only headless verification harness that mounts `Board` directly with a deterministic config (skips the setup screen). Used for SSR-time smoke testing.

**Modified files (1)**
- `lib/engine-v2/index.ts` — added `export type { ResolvedTarget }` so the modal can render targets typed correctly.

**Verification:**
- `npx tsc --noEmit` — clean.
- `npm run scenarios` — 61/61 passing (57 holdovers + 3 new for base-damage replacements + 1 new for deck-shuffle-after-search, with the prior "no matches → deck unchanged" scenario updated to the new §v7 8.36 behavior).
- `npm run play-cli -- --ai both` — completes (engine end-to-end stable).
- **`/playtest` SSR** — HTTP 200, 31KB response, all setup-screen strings present.
- **`/playtest/smoke` SSR** — HTTP 200, 43KB response, Board mounts with both PlayerMats; GROUND/SPACE/HAND/RESOURCES sections present for each seat; Echo Base + Death Star base names rendered; zero runtime error indicators.

**Base-damage replacements (bonus — added after the UI work):**

The Week 6c replacement layer covered damage-to-unit and defeat-unit; this session extends it to base damage so the layer is now complete for damage events.

- **`ReplacementAbility.on` widened to `'damage_unit' | 'damage_base' | 'defeat_unit'`.**
- **`TriggerPredicate.base_controller?: PlayerRef`** — new predicate field for matching "the base being damaged belongs to X." Typical use: `where: { base_controller: 'self' }` on a unit's `damage_base` replacement.
- **`runtime/damage.ts` exports `dealDamageToBase`** mirroring `dealDamageToUnit`. Consults `damage_base` replacements first, falls through to `damageBase`. Used by `interpret.ts applyDamageToTarget` (base branch) and `reducer.ts applyAttack` (both base attacks and Overwhelm excess).
- **Fixture: Aegis Shield Generator (W7_001)** — space unit (1/5) with `replacement on: 'damage_base' where: { base_controller: 'self' } with: { effect: 'noop' }`. Guards friendly base from all damage as long as it's in play.
- **3 new scenarios**: Aegis prevents combat damage to its controller's base; Aegis does NOT fire when its controller attacks the opponent's base (asymmetry verified); Overwhelm excess damage is also intercepted (confirms `applyAttack`'s second base-damage call site is wired).

**Deterministic deck shuffle in `search` (bonus #2):**

`applySearch` previously left the deck in its pre-search order. Per §v7 8.36 the deck shuffles after a search regardless of whether a card was taken. Closing this gap required a deterministic PRNG (since the async step model replays from the original state, any randomness must be reproducible).

- **`util/rng.ts`** — `mulberry32` seedable PRNG + `shuffleDeterministic` Fisher-Yates. No `Math.random` anywhere.
- **`applySearch` shuffles on all three exit paths** — match found, no match, declined — using `state.step` as the seed. Two `search` calls in the same step would produce the same shuffle (acceptable for the rare double-search case); consecutive top-level steps get fresh randomness.
- **2 scenario updates** — the prior "deck unchanged on no-match" scenario flipped to verify the new behavior: same cards retained but order may differ. New scenario: running the same search twice from the same starting state produces the same shuffled deck (replay determinism verified).

**Playtest UX polish (bonus #3 — added so the user can productively test):**

- **`GameLog.tsx`** — scrollable side panel reading `state.log` directly. Auto-scrolls to newest entry, critical lines highlighted amber, round number prefix on every line. Shows last 60 entries. Lives in the right-side aside next to the action picker.
- **Keyboard shortcuts:**
  - **ActionPicker**: numeric keys 1-9 trigger the n-th legal action globally; `p` triggers PASS. Bracketed number chip rendered next to each button so the mapping is visible. A hint line ("Click or press the bracketed number / `p` to pass") appears when the user is on-turn.
  - **ChoicePromptModal**: numeric keys pick options (choose_one) or toggle candidates (prompt_target); `Enter` confirms target selection; `Esc` declines if `canPass`; `y`/`n` answer optional prompts. Shortcut chips render on each option/button.
- Listeners use `window.addEventListener('keydown', …)` with cleanup; modifier keys (Ctrl/Cmd/Alt) are ignored; inputs/textareas are excluded (defensive — no inputs currently).

**Design decisions (in code):**
- **Pure-functional engine → simpler React adapter.** v1's `useGame` had to hold the engine instance in a ref because the engine mutated state internally; the Strict Mode double-mount caused engine drift. v2 has no such issue — state is plain data, stored in `useState`. The hook is roughly 150 lines vs v1's 147 + a ton of subtle correctness commentary.
- **AI uses synchronous `step()`, not `stepAsync`.** Same call-site split as the CLI: AI doesn't need pause semantics, going through the replay wrapper would add overhead for no benefit. The chooser callback gives the AI its picks deterministically.
- **`stateRef` for the auto-dispatch closure.** The AI's `setTimeout` callback reads `stateRef.current` rather than the closed-over `state`, so a state change between schedule and fire is honored.
- **Strict Mode safety.** All state mutations go through `setState`; no refs-to-engine pattern; effects use cleanup that clears timeouts. Verified clean by render in dev mode.
- **Smoke route as a verification artifact.** `/playtest/smoke` skips the setup screen and mounts the Board directly. This let me verify the playing-mode render path in SSR without driving an actual browser click. It's a developer tool, not a user-facing feature — kept in the route tree because it's harmless.
- **Fixture cards, not real SWU cards.** The playtest deck uses W1-W6 fixture JSON. Real deck integration (mapping deck-builder output → `DeckConfig` + authoring specs for the player's actual cards) is the next batch.

**Path to full UI UAT, updated:**
- ✅ Async PendingChoice protocol (session 43)
- ✅ CLI choice prompting (session 44)
- ✅ `useGameV2` hook + Board + ChoicePromptModal + AI auto-dispatch (THIS session)
- 🎯 Next: wire deck-builder output → `DeckConfig`; hand-author specs for cards in a real playtest deck; polish UI (card text on hover, contextual click-to-play, keyboard shortcuts)
- Then: capture-zone UI polish, upgrade-stacking visual polish, animations, sound

The Week 7b plumbing is the line above which everything is engine work and below which is product/UX work. The engine is now demonstrably wired end-to-end in the browser.

---

*(2026-05-26 session 44)* **Engine v2 Week 7a follow-up — CLI rewired to stepAsync for human players. Long-standing "CLI choice prompting" gap closed. Scenarios 57/57. TypeScript: 0 errors. AI-vs-AI play-cli still completes; human turns now prompt interactively for every choose_one / chosen-target / optional decision.**

Session 43 landed the async step protocol as a wrapper around `step()`. This session is the first real driver to consume it — the CLI.

- **AI players keep using synchronous `step()`** with a heuristic `aiChooser` (auto-pick leftmost / yes / first-N). Zero behavior change for AI turns.
- **Human players go through `stepAsync`/`resolveStep`.** A new `executeHumanAction` function drives the loop: start with `stepAsync`, if `pending` call `promptHuman` to render the prompt via readline and read the pick, call `resolveStep`, repeat until settled.
- **`promptHuman` renders all three prompt kinds** — `choose_one` (numbered options + optional `p` to pass), `prompt_target` (numbered candidates with full unit names + counts + optional decline), `optional` (y/n). Targets are pretty-printed with controller + card name (e.g. "p2's Battlefield Marine<i17>").
- **The old auto-pick fallback (`cliChooser` with `pendingAnswers` queue) is gone.** That was the documented "CLI choice prompting" gap. The new path either prompts the human or uses the AI chooser — no silent leftmost picks during human turns.
- **Chooser comment block updated** in `runtime/chooser.ts` to reflect that the async lift has landed; the synchronous API is the foundation that `async_step.ts` wraps.

**Modified files (2):**
- `scripts/play_cli.ts` — removed the auto-pick `cliChooser`; replaced with `aiChooser` (for AI players only) + new `promptHuman` + `executeHumanAction` (for human players via `stepAsync`); main loop dispatches by player type.
- `runtime/chooser.ts` — doc comment updated.

**Design decisions (in code):**
- **AI keeps the synchronous path** rather than going through `stepAsync` with a fallback chooser. Two reasons: (a) `stepAsync` adds replay overhead the AI doesn't need; (b) leaving the AI on `step()` keeps the synchronous API exercised by a real driver, not just tests. If we want a unified path later, adding a `fallbackChooser` parameter to `stepAsync` is a small change.
- **`executeHumanAction` returns `{ next, events }` shaped identically to `step()`** so the main loop's event-display code (DEFEATED, TOKEN_CREATED, CAPTURED, GAME_ENDED) didn't need to change.
- **No "back" / "undo" on prompts.** A human who picks wrong during a multi-prompt resolution is stuck for that step. Could be added later by tracking journal depth and rewinding `pending`, but adds UI surface without changing the engine.

**Path to UI UAT, updated:**
- ✅ Async PendingChoice protocol (session 43)
- ✅ ~~CLI choice prompting~~ (this session) — bonus: validates the async API design under a real driver before React arrives
- 🎯 Next: `useGameV2` React hook wrapping `stepAsync`/`resolveStep` + a `ChoicePromptModal` component
- Then: GameBoard.tsx wired to v2 actions + ~20 hand-authored playtest cards + capture-zone UI + upgrade-stacking visual

---

*(2026-05-26 session 43)* **Engine v2 Week 7a landed — async step protocol (replay-based PendingChoice). Scenarios 57/57. TypeScript: 0 errors. The single biggest blocker to UI UAT is now closed.**

This was the long-standing "Week 4 lift" deferred since the start: how does the engine pause for player input in a browser, where a React component can't synchronously block on a click? Solved without rewriting any of the engine internals.

**The pattern: replay-based resumption.** The engine stays fully synchronous and pure (no RNG / Date.now / object iteration in the `step()` path — audited). Every player-input point already flows through the swappable `Chooser` callback, so the async surface is a thin wrapper:

1. `stepAsync(state, action, reg)` invokes the existing synchronous `step()` with a **replay chooser** backed by a journal of pre-answered picks.
2. If the engine asks for a pick the journal doesn't have, the replay chooser throws an internal `PendingChoiceSignal`. `stepAsync` catches it and returns `{ kind: 'pending', pending }` — a resumable handle carrying the original state + action + journal.
3. The UI passes the player's pick to `resolveStep(pending, result)`. The pick is appended to the journal and `step()` re-runs from the original state. The engine's determinism guarantees the same intermediate state up to the next unanswered choice point.
4. Eventually no more choices are needed and `step()` settles. Returns `{ kind: 'settled', next, events }`.

**Cost:** O(choices²) re-execution per step — N+1 runs total for N prompts. For typical card abilities (0–2 prompts) this is negligible. The pathological case (Lightning Storm = 4 prompts) ran cleanly under verification.

**Critically, no engine internals changed.** The synchronous `step()` and `Chooser` API are untouched. Tests + CLI keep using them directly. The async layer is the engine-to-UI adapter only.

**New files (1):**
- `runtime/async_step.ts` — `PendingChoiceSignal` (internal), `PendingStep` (resumable handle), `AsyncStepResult` (discriminated union), `stepAsync` + `resolveStep` (public API).

**Modified files:**
- `index.ts` — exports `stepAsync`, `resolveStep`, `AsyncStepResult`, `PendingStep`.
- `scripts/scenarios.ts` — 5 new async-protocol scenarios.

**Determinism audit (must hold for replay to be sound):**
- `Math.random`: only in `init.ts` (deck shuffle at game start) — NOT in `step()`.
- `Date.now`: only in `util/uuid.ts` — used by `initGame` once, NOT in `step()`.
- `Object.keys/entries/values`: never used in the engine; iteration uses `state.playerOrder` (deterministic).
- Map/Set iteration: only `Set<string>` in `perGameFlags`; insertion-ordered + deterministic. No `Map`s in state.
- iid generation: `state._nextIid` counter, threaded through state mutations.

The runtime was already pure by design. The replay model just made the property load-bearing.

**Scenarios (57/57 passing):**
- 52 holdovers (Weeks 2-6c) all green
- 5 new W7a: no-choice action settles on first call; choose_one prompts return pending with the right shape; single-choice resolves to settled (or another pending); replay determinism (two stepAsync calls with same inputs produce identical settled state); 4 sequential prompts surface one-at-a-time and settle on the 4th resolve (verified using Lightning Storm divided damage)

**Known gaps deliberately deferred (Week 7b+):**
- **CLI wiring to stepAsync** — the CLI still uses the synchronous chooser (which auto-picks for choose_one / chosen-target). Wiring it through stepAsync would make the readline driver truly interactive for branching plays. Small task; not blocking.
- **PendingStep serialization** — useful if we want to persist mid-step state across browser refreshes. Right now PendingStep holds a live `GameState` reference; serialization is straightforward (the engine state is plain JSON-able data) but not load-bearing for the initial UAT.
- **PendingChoice ordering** when multiple replacements match the same event (Week 7 gap from session 42).
- **Base-damage replacements**, leader-as-base-upgrade, true deck shuffle in `search` (long-standing gaps).
- **Visual UI surface** — the next-largest blocker after the async protocol. `useGameV2` hook + GameBoard rewiring + capture-zone UI + choice-prompt modals.

**Path to UI UAT, updated:**
- ✅ ~~Async PendingChoice protocol~~ (this session)
- **🎯 Next**: `useGameV2` hook + GameBoard wiring to v2 + choice-prompt modal component
- Then: hand-author ~20 cards for a playtest deck
- Then: capture-zone UI, upgrade-stacking visual, action-ability buttons on v2

---

*(2026-05-26 session 42)* **Engine v2 Week 6c landed — combat damage onto the replacement layer + `defeat_unit` replacement. Scenarios 52/52. TypeScript: 0 errors. play-demo + play-cli AI-vs-AI still run end-to-end.**

- **New module `runtime/damage.ts`** is the single chokepoint for damage-to-unit application. Both the combat path (`reducer.ts applyAttack`) and the non-combat path (`interpret.ts applyDamage` + `applyDividedDamage`) call `dealDamageToUnit` instead of `damageUnit` directly. The replacement layer is consulted uniformly: combat damage now respects damage_unit replacements (previously documented as a gap and locked by a scenario).
- **`defeat_unit` replacement** added. `ReplacementAbility.on` now accepts `'damage_unit' | 'defeat_unit'`. `runtime/replacements.ts` exposes `collectDefeatUnitReplacements` + `makeProspectiveDefeatEvent`. `state_based.ts` rewritten to process one dead unit per fixpoint pass — collects defeat replacements for the candidate unit, runs the matched replacement instead of moving to discard, and lets the next iteration re-check. The 64-step guard was raised to 256 to absorb the slower per-defeat cadence.
- **The locked "Replacement: does NOT intercept combat damage" scenario is now the positive assertion** "Replacement: intercepts combat damage too" — verifying Force Barrier (1/4) takes 0 damage from a 3-power attacker and emits `DAMAGE_PREVENTED` naming itself as the source. The attacker still takes 1 strikeback (the replacement only prevents incoming damage on its source; the defender's outbound damage is separate).
- **Leader flip-back is unchanged at the API level** — still lives in `state_based.ts` as a direct branch. Migrating it to a true defeat_unit replacement would require a leader-specific effect (return-to-leader-zone), and that adds an AST primitive for a single use case. Deferred until a second leader pattern needs it.
- **Chooser now threads through `runStateBased`** so defeat-replacement effects can prompt the player.

**New files (2):**
- `runtime/damage.ts` — `dealDamageToUnit` wraps `damageUnit` with replacement consultation. Single import surface for both combat and non-combat damage call sites.
- `__fixtures__/cards/W6_008.json` — Phoenix Sentinel (3/3 ground; defeat replacement that heals self to full and exhausts).

**Modified files:**
- `spec/ast.ts` — `ReplacementAbility.on` widened to `'damage_unit' | 'defeat_unit'`; doc updated.
- `runtime/replacements.ts` — factored out shared `collectReplacements(state, reg, event, on)`; added `collectDefeatUnitReplacements` + `makeProspectiveDefeatEvent`.
- `runtime/state_based.ts` — rewritten to process one dead unit per pass + consult defeat replacements; takes `chooser?` parameter; 256-step guard.
- `runtime/interpret.ts` — `damageUnitWithReplacements` removed; `applyDamageToTarget` and `applyDividedDamage` delegate to `dealDamageToUnit`.
- `reducer.ts` — `applyAttack` calls `dealDamageToUnit` for both defender and attacker combat damage; `settle` threads `chooser` to `runStateBased`.
- `__fixtures__/index.ts` — registers W6_008.
- `scripts/scenarios.ts` — combat-damage replacement scenario flipped from "locked gap" to positive assertion; 3 new defeat-replacement scenarios.

**Design decisions (in code):**
- **`runtime/damage.ts` is the cycle-breaker.** The cleanest way to get combat damage onto the replacement layer was extracting damage dispatch into a third module. `primitives/combat.ts` doesn't import `applyEffect` (no cycle there); `runtime/damage.ts` imports both `damageUnit` (from combat) and `applyEffect` (from interpret) — the cycle between damage.ts and interpret.ts is value-level only, which TS resolves at call time, matching the existing modifiers↔triggers↔interpret cycle pattern.
- **One dead unit per state-based pass instead of all-at-once.** The previous code processed all dead in a single iteration. With defeat replacements that mutate state (e.g. heal one unit, damage another), the read-after-write semantics require recomputing the dead set after each replacement. Processing one at a time keeps the loop correct without bookkeeping the mid-iteration changes. Guard raised from 64 to 256 to absorb the slower cadence — still tiny relative to the state space.
- **DEFEATED event suppressed when replacement matches.** The semantics are "this defeat doesn't happen." If the replacement fires, no DEFEATED event is emitted — triggers listening for `event.defeated` correctly don't fire either. If the replacement's effect doesn't lower damage below lethal, the next state-based pass tries to defeat again and the 256 guard catches an infinite loop.
- **Leader flip-back stays a direct branch.** Migrating it to a defeat replacement would need a `return_to_leader_zone` effect — too much AST surface for one use case. The pattern is identical (flip-back replaces discard), but expressing it as a generic effect when no card other than the implicit leader machinery uses it adds complexity for no win. Re-evaluate when a second similar mechanic appears.
- **256-step state-based guard.** Each defeat or replacement is one tick. 256 is high enough for any plausible chain without being so high that a misbehaving card stalls the engine.

**Scenarios (52/52 passing):**
- 13 W2 + 5 W3 + 11 W4 + 8 W5 + 7 W6a + 5 W6b holdovers
- 3 new W6c: Phoenix heals self instead of being defeated; Phoenix survives a 6-power combat hit via defeat replacement; leader flip-back still works under the new state-based loop (regression check)

**Known gaps deliberately deferred (Week 7+):**
- **Base-damage replacements** — `dealDamageToBase` wrapper + base-damage collector in replacements.ts. Mirror of `dealDamageToUnit`. Unblocks "If your base would take damage, prevent it" cards.
- **More replacement event kinds** — `zone_change`, `card_drawn`, etc.
- **Replacement ordering chooser** when multiple replacements match the same event.
- **Distribution-prompt chooser variant** for `divided_damage` AI-driven splits.
- **CLI interactive choice prompting** + async PendingChoice for the web UI.
- **Leader-as-base-upgrade** (Twin Suns §v7 3.4.4A).
- **True deck shuffle in `search`**.
- **Leader flip-back as a replacement** (cosmetic refactor — see above).

---

*(2026-05-26 session 41)* **Engine v2 Week 6b landed — divided damage + minimal replacement-effects layer. Scenarios 49/49. TypeScript: 0 errors. play-demo + play-cli AI-vs-AI still run end-to-end.**

- **`divided_damage`** — distributes N damage across a candidate pool via per-point chooser prompts. Default chooser dumps all points on the leftmost candidate; scripted chooser can split across targets (2+1+1 verified). Indirect by default per §v7 8.35.1.
- **`ReplacementAbility`** AST + `runtime/replacements.ts` collector. Replacement abilities intercept a would-be event and substitute a different effect per §v7 7.7.5. Initial scope: `on: 'damage_unit'` only. The non-combat damage path (`applyDamageToTarget`) consults the replacement layer before calling `damageUnit` — when a replacement matches, emits `DAMAGE_PREVENTED { by: <source iid> }` and runs the replacement's `with` effect instead.
- **Combat damage gap documented + locked.** Combat damage in `applyAttack` still goes through `damageUnit` directly (and the hardcoded shield path). Moving combat damage onto the replacement layer requires breaking the cycle between `primitives/combat.ts` and `runtime/interpret.ts` — landed as its own batch (Week 6c). The "Replacement: does NOT intercept combat damage" scenario locks the current behavior so we notice when this changes.
- **`unpreventable: true` bypasses both replacements and shields.** Honors §v7 7.7.5 — explicit unpreventable damage skips the entire prevention layer.
- **`eventCardIid` now resolves `DAMAGE_DEALT` → `targetIid`** so replacement `where: { card: 'self' }` reads as "this damage is hitting me."

**New files (3):**
- `runtime/replacements.ts` — `collectDamageUnitReplacements` scanner + `makeProspectiveDamageEvent` helper.
- `__fixtures__/cards/W6_006.json` — Lightning Storm (event, 3, `divided_damage 4 indirect across enemy units`).
- `__fixtures__/cards/W6_007.json` — Force Barrier (1/4 unit, replacement: `if damage would hit me, do nothing`).

**Modified files:**
- `spec/ast.ts` — `DividedDamageEffect`; `ReplacementAbility`; `isReplacement` guard.
- `runtime/interpret.ts` — `applyDividedDamage`; new `damageUnitWithReplacements` helper interposed between `applyDamageToTarget` and `damageUnit`; threads `chooser` through `applyDamage`.
- `runtime/predicates.ts` — `eventCardIid` handles `DAMAGE_DEALT`.
- `__fixtures__/index.ts` — registers W6_006 + W6_007.
- `scripts/scenarios.ts` — 5 new Week-6b scenarios.

**Design decisions (in code):**
- **`divided_damage` loops per point through the chooser** rather than introducing a new `distribute` prompt shape. Each iteration is a `choose_one` over surviving candidates with `value = iid`. Same pattern as `disclose` / `search`. A distribution-prompt chooser variant (returns `Map<iid, amount>`) would be cleaner for AI heuristics but isn't load-bearing for the current scenarios.
- **Replacement scope: damage_unit only.** The architectural extension point is in place (`runtime/replacements.ts` is the only place that needs to grow new collectors for `defeat_unit`, `zone_change`, etc.). Shipping more replacement event kinds without driver cards to validate them adds dead code.
- **Combat damage stays on the hardcoded path for now.** Breaking the cycle (combat → interpret → effect resolution → combat) needs a refactor: extract damage dispatch into a third module that both `combat.ts` and `interpret.ts` import. Postponed to its own batch so this one stays small.
- **Multiple-replacement order: source-creation order.** Per §v7 7.7.5 the affected player chooses the order. Until a chooser pass for prevention-ordering ships, source-creation order is deterministic and matches the existing trigger-drain convention.
- **`unpreventable` bypasses replacements *and* shields.** The shield check lives inside `damageUnit`; the replacement layer is gated by the same flag. Both bail when `unpreventable=true`.

**Scenarios (49/49 passing):**
- 13 W2 + 5 W3 + 11 W4 + 8 W5 + 7 W6a holdovers
- 5 new W6b: divided damage default chooser dumps on leftmost; divided damage scripted chooser splits 2+1+1; replacement prevents non-combat damage and emits DAMAGE_PREVENTED; replacement does NOT intercept combat damage (locks the current gap); unpreventable / no-match damage lands normally

**Known gaps deliberately deferred (Week 6c+):**
- **Combat damage replacements** — needs a refactor to break the cycle between `primitives/combat.ts` and `runtime/interpret.ts`. Most-impactful next batch.
- **Replacement event kinds beyond `damage_unit`** — defeat, zone_change, base damage.
- **Replacement ordering chooser** when multiple replacements match the same event.
- **CLI choice prompting** + **Async PendingChoice** (long-standing).
- **Leader-as-base-upgrade** (Twin Suns §v7 3.4.4A).
- **True deck shuffle in `search`** — RNG/permutation through the chooser.

---

*(2026-05-26 session 40)* **Engine v2 Week 6a landed — five missing primitives (move, indirect damage, look_at, disclose, search). Scenarios 44/44. TypeScript: 0 errors. play-demo + play-cli AI-vs-AI still run end-to-end.**

These primitives were declared in PROGRESS as "AST exists" — but the AST didn't actually have them. Week 6a closes that gap: the AST now declares all six (including `divided_damage`, which I left for the next batch since its chooser-driven distribution is novel) and the interpreter implements five of them.

- **`move { target, to: 'ground_arena' | 'space_arena' | 'other_arena' }`** — swaps a unit between arenas. `'other_arena'` is computed against the unit's current zone (the Plot keyword pattern). Emits `ARENA_MOVED`.
- **Indirect damage** — added `indirect?: boolean` to `DamageEffect`. The runtime already supported indirect (bypasses shields per §v7 8.35.2.A); the AST simply exposes it. `applyDamage` threads the flag through to `damageUnit` / `damageBase`.
- **`look_at { player, source: 'deck_top' | 'opponent_hand', count? }`** — peek at hidden information. State unchanged; emits `CARD_REVEALED` per peeked card so the chooser/UI can display.
- **`disclose { player, filter?, count? }`** — chooser-picked reveal from hand. Emits `CARD_DISCLOSED { player, iids, aspects }` so downstream effects can branch on the disclosed card's aspects (Force-card-disclose patterns).
- **`search { player, count, filter?, to: 'hand' | 'discard', reveal? }`** — peek top N, chooser picks a matching card, moves it to hand/discard, returns the rest to the deck in order. (True shuffle is gapped — RNG isn't piped into the interpreter; documented and doesn't affect any current scenario since cards are random-access only by top/bottom.)

**New files (5):**
- `__fixtures__/cards/W6_001.json` — Tactical Maneuver (event, 1, `move target to other_arena`).
- `__fixtures__/cards/W6_002.json` — Ion Burst (event, 2, indirect 2 damage to chosen enemy).
- `__fixtures__/cards/W6_003.json` — Reconnaissance (event, 1, `look_at opponent deck_top 3`).
- `__fixtures__/cards/W6_004.json` — Reveal Plans (event, 1, `disclose self`).
- `__fixtures__/cards/W6_005.json` — Tactical Brief (event, 2, `search top 3 for republic → hand`).

**Modified files:**
- `spec/ast.ts` — added `MoveEffect`, `LookAtEffect`, `DiscloseEffect`, `SearchEffect` to the Effect union; added `indirect?: boolean` to `DamageEffect`.
- `runtime/interpret.ts` — new `applyMove` / `applyLookAt` / `applyDisclose` / `applySearch`; `applyDamageToTarget` now threads the `indirect` flag through to `damageUnit` / `damageBase`.
- `__fixtures__/index.ts` — registers W6_CARDS into ALL_CARDS.
- `scripts/scenarios.ts` — 7 new Week-6 scenarios.

**Design decisions (in code):**
- **`move` is implemented inline in `applyMove`, not through `moveToZone`,** because `moveToZone` emits `ZONE_CHANGED` while arena-to-arena moves emit `ARENA_MOVED` per §v7 7.5.3. We want only the more-specific event for arena swaps.
- **`look_at` is a pure event emitter** — no state mutation. The `CARD_REVEALED` event is the artifact; the actual "hidden information" model is the UI's concern, not the engine's.
- **`disclose` uses the chooser to pick among hand cards matching the filter.** The chooser sees the cards as `choose_one` options (label = card name, value = iid). Future cards that want the choice gated by the disclosed aspects can read the `CARD_DISCLOSED.aspects` payload from the events stream.
- **`search` returns non-picked cards to the deck in order**, not shuffled, because the interpreter doesn't carry an RNG. Per §v7 8.36 the searched portion should be shuffled — this is documented as a gap but doesn't affect any current scenario (cards are random-access only by top/bottom).
- **No-match search is a state no-op.** The deck stays in its original order; no shuffle happens because there's nothing to interleave.

**Scenarios (44/44 passing):**
- 13 W2 + 5 W3 + 11 W4 + 8 W5 holdovers
- 7 new W6: ground→space via `other_arena`; space→ground via `other_arena`; indirect damage bypasses shield (and doesn't consume it); look_at fires CARD_REVEALED per peeked card; disclose emits CARD_DISCLOSED with the picked card's aspects; search top-3 picks the matching card and lands it in hand; search with no matches leaves the deck untouched

**Known gaps deliberately deferred (Week 6b):**
- **`divided_damage`** — distributing N damage among any number of targets via a chooser-driven distribution prompt. Novel interaction (chooser returns a Map<iid, amount>, not just a pick), so I deferred to its own batch.
- **Replacement effects layer** (Instead/Would) — still a direct branch in state_based for leader flip-back.
- **CLI choice prompting** + **Async PendingChoice** for the web UI (long-standing gap).
- **Leader-as-base-upgrade** (Twin Suns §v7 3.4.4A).
- **True deck shuffle in `search`** — needs RNG piped through the interpreter or a chooser-supplied permutation.

---

*(2026-05-25 session 39)* **Engine v2 Week 5 landed — action abilities (`Action [...]: …`) + un-deployed leader abilities. Scenarios 37/37. TypeScript: 0 errors. play-demo + play-cli AI-vs-AI still run end-to-end.**

This is the next-biggest v1 leader-parity chunk after Week 4. The two land together because un-deployed leaders are mostly *action* ability sources (Ahsoka "Snips," Admiral Ackbar exhaust-an-enemy, etc.) — implementing one without the other would leave most of v1's 47 leaders dormant.

- **New action**: `USE_ACTION_ABILITY { player, sourceIid?, leaderIndex?, abilityIndex, targetIid? }`. Exactly one of sourceIid/leaderIndex.
- **`applyActionAbility` dispatcher** validates limit + cost, pays exhaust/resources/discard/defeat/remove_shield, bumps the per-source-per-ability counter, then routes `do` through `applyEffect`.
- **Un-deployed leaders surface** as synthetic `CardInstance`s with iid `LEAD:<pid>:<idx>` so the existing modifier scan, trigger collector, chooser context, and limit accounting all work uniformly. The synth is read-only — never enters a zone, never mutated.
- **`cardAbilities` in modifiers/triggers** branches on iid prefix when looking at a leader spec: `LEAD:` → `leaderAbilities`; else → `leaderUnitAbilities`.
- **Limit helpers** (`isLimitExhausted`, `bumpLimit`, `limitKey`) extracted from triggers and exported; both triggered and action abilities use them with distinct `'trig'` / `'act'` tags so a card with both at the same index counts separately.
- **`readyAll`** now also readies LeaderInstances so action-ability `exhaust` resets each round.
- **`legal.ts`** enumerates `USE_ACTION_ABILITY` for every in-arena unit/upgrade + every leader (un-deployed → leaderAbilities; deployed leader-unit → leaderUnitAbilities), gated by cost-payable + limit-not-exhausted.

**New files (4):**
- `__fixtures__/cards/W5_001.json` — Admiral Ackbar (Stay on Target) — un-deployed leader with `Action [1, Exhaust]: exhaust an enemy unit`.
- `__fixtures__/cards/W5_002.json` — Targeting Computer Sentry — in-arena unit with `Action [Exhaust] (once_per_round): 1 dmg to a chosen enemy`.
- `__fixtures__/cards/W5_003.json` — Clone Strategist — un-deployed leader with a constant `+1 power to friendly clones`.
- `__fixtures__/cards/W5_004.json` — Mother Talzin (Whispering Witch) — un-deployed leader with `Triggered (on friendly defeated): draw 1`.

**Modified files:**
- `actions.ts` — new `USE_ACTION_ABILITY` variant.
- `runtime/triggers.ts` — synthetic-leader helpers + `LEAD:` prefix, `inPlayCards` includes un-deployed leaders, `locateSource` handles synthetic iids + walks upgrades, `cardAbilities` branches on iid prefix, drain uses `cardAbilities` (not direct spec.abilities) so leader specs resolve, limit helpers extracted + exported.
- `runtime/modifiers.ts` — `cardAbilities` branches on iid prefix; constant scan now iterates un-deployed leaders too (always-on, no zone gating).
- `primitives/state.ts` — `readyAll` readies leaders.
- `reducer.ts` — new `applyActionAbility` + `resolveActionSource` helper; dispatcher case for `USE_ACTION_ABILITY`.
- `legal.ts` — enumeration of action abilities across units/upgrades/leaders + `pushActionAbilities` helper + `describeAction` covers the new action.
- `__fixtures__/index.ts` — registers W5_CARDS into ALL_CARDS.
- `scripts/scenarios.ts` — 8 new Week-5 scenarios.

**Design decisions (in code):**
- **Synthetic CardInstance for un-deployed leaders** keeps the modifier/trigger/chooser machinery iid-keyed and unchanged. The discriminator is the `LEAD:` iid prefix — chosen over a side-channel "is-leader" flag because the prefix is self-describing in logs and survives serialization.
- **Limit counter `tag` parameter** (`'trig' | 'act'`) keeps triggered and action limits distinct. A future card with both kinds at the same source iid won't collide.
- **Cost-payable check at enumeration is loose**: defeat/remove_shield costs aren't validated by `legal.ts` because they require selector resolution (target sets may depend on chooser policy). The reducer throws at fire time if the selector picks nothing. This matches how PLAY_CARD treats triggered effects.
- **Targets resolved by the Chooser at effect time, not in legal enumeration.** Action abilities don't enumerate per-target — the chooser picks when `applyEffect` walks a `chosen` selector. This avoids combinatorial explosion in the legal-actions list and mirrors how Week 3's choose_one resolves.
- **Un-deployed leader constants are always-on** (no `active_in_zone` gating), modeled per §v7 3.4.4. If a future card needs "while-not-deployed only" gating that's already implicit; "while-deployed only" lives on `leaderUnitAbilities` automatically.

**Scenarios (37/37 passing):**
- 13 Week-2 + 5 Week-3 + 11 Week-4 holdovers
- 8 new Week-5: action ability fires + costs pay + source exhausts; once_per_round blocks second fire; exhausted-source rejection; insufficient-resources rejection; un-deployed leader constant buffs friendlies; un-deployed leader triggered (Mother Talzin draw-on-defeat); action ability `[1 resource, exhaust]` on un-deployed leader; limit resets at end of round (round-transition smoke test through regroup)

**Known gaps deliberately deferred (Week 6):**
- **Leader-as-base-upgrade** (Twin Suns §v7 3.4.4A) — `leaderUpgradeAbilities` is read but unused.
- **Replacement effects layer** (Instead/Would).
- **CLI choice prompting** + **Async PendingChoice** for the web UI.
- **Remaining primitives**: indirect_damage, divided_damage, arena-move, search, look_at, disclose.
- **Action ability with cost.exhaust on attached upgrades** — `exhaust(s, iid)` uses `mapInstance` which only walks arena cards, not upgrades. If a future card needs an upgrade with an action ability whose cost includes exhaust, `mapInstance` needs an upgrade-aware variant. Not blocking any current card.

---

*(2026-05-25 session 38)* **Engine v2 Week 4 landed — leaders + upgrades + Coordinate + Smuggle. Scenarios 29/29. TypeScript: 0 errors. play-demo + play-cli AI-vs-AI still run end-to-end.**

Closes the biggest v1 → v2 parity gap. v2 now supports:

- **Leader deploy** — `DEPLOY_LEADER { player, leaderIndex }` action. Pays cost, creates a CardInstance with `cardId = leaderSpec.id` in the spec's arena (default ground), flips the LeaderInstance (`isDeployed=true`, `unitIid` set), emits `LEADER_DEPLOYED`. Deployed leader-units enter exhausted.
- **Leader-unit-side abilities** — constants and triggered abilities on `leaderUnitAbilities` surface automatically because the leader-unit instance sits in an arena and `cardAbilities` was extended to read `leaderUnitAbilities` from leader specs. No special case in the scan loop.
- **Leader flip-back on lethal damage** — state-based defeat now branches: if the defeated card matches a `LeaderInstance.unitIid`, flip back (`isDeployed=false`, `unitIid=undefined`, `exhausted=false`) and emit `LEADER_DEFEATED`. No discard entry. Per §v7 3.4.5.
- **Upgrade attach** — `PLAY_CARD { iid, targetIid }` for upgrades. Pays cost, pushes the upgrade CardInstance into `host.upgrades[]`, emits `UPGRADE_ATTACHED`.
- **Upgrade stat + keyword stacking** — `effectivePower`/`effectiveHp` add `UpgradeSpec.powerModifier`/`hpModifier` from each upgrade on the host; `effectiveKeywords` merges upgrade keywords; constant abilities on upgrades fire through the modifier scan with the upgrade as source, and `attached_to_self` selector resolves to the host.
- **Upgrade detach on host defeat** — state-based defeat routes the host's upgrades to the host owner's discard (cleared of damage/exhaust) with `UPGRADE_DETACHED` events.
- **Coordinate** — `controller_unit_count?: Range` predicate field. Coordinate cards are constant abilities with `while: { controller_unit_count: { min: 3 } }`. No new ability kind.
- **Smuggle** — `active_in_zone: 'resource_zone'` on constant abilities. The modifier scan walks resource_zone in addition to the two arenas and gates each constant by zone match.

**New files (5):**
- `__fixtures__/cards/W4_001.json` — Clone General (leader, 4/5 ground, +1/+1 aura to friendly clones).
- `__fixtures__/cards/W4_002.json` — Battle Plates (upgrade, +2/+2).
- `__fixtures__/cards/W4_003.json` — Tactical Visor (upgrade, grants Sentinel via `attached_to_self`).
- `__fixtures__/cards/W4_004.json` — Coordinated Strike Captain (Coordinate +1 power to clones).
- `__fixtures__/cards/W4_005.json` — Smuggled Cache (+1 power to friendlies while in resource zone).

**Modified files:**
- `spec/ast.ts` — added `controller_unit_count?: Range` to PredicateLeaf.
- `actions.ts` — `PLAY_CARD` gained `targetIid?`; new `DEPLOY_LEADER`.
- `state/zones.ts` — added `findUpgrade` + `findHostOfUpgrade`.
- `runtime/predicates.ts` — `controller_unit_count` evaluator.
- `runtime/modifiers.ts` — leader-unit ability surfacing; resource_zone scan with `active_in_zone` gating; upgrade-host modifier aggregation in `effectivePower`/`effectiveHp`/`effectiveKeywords`/`effectiveKeywordValue`; `printedPower`/`printedHp` helpers so leader-unit stats route through the same code path.
- `runtime/selectors.ts` — `attached_to_self` finds the host of the source upgrade.
- `runtime/triggers.ts` — `inPlayCards` flattens host upgrades; cardAbilities reads `leaderUnitAbilities`.
- `runtime/state_based.ts` — upgrade detach + leader flip-back on defeat.
- `primitives/move.ts` — `attachUpgrade` helper.
- `reducer.ts` — `applyPlayCard` routes upgrades through `attachUpgrade`; new `applyDeployLeader`.
- `init.ts` — `DeckConfig.leaderIds?`; `newPlayer` instantiates LeaderInstance entries.
- `legal.ts` — `PLAY_CARD` enumerated per friendly host for upgrades; new `DEPLOY_LEADER` enumeration; `describeAction` covers both.
- `__fixtures__/index.ts` — registers W4_CARDS in ALL_CARDS.
- `scripts/scenarios.ts` — 11 new Week-4 scenarios.

**Design decisions (in code):**
- **Leaders skip a "leader zone" pseudo-arena.** A deployed leader is a normal CardInstance in `groundArena`/`spaceArena`; the LeaderInstance is just bookkeeping (which arena card is the leader-unit, is it deployed). The scan loop didn't need a branch for this — `cardAbilities` just returns `leaderUnitAbilities` for leader specs and the rest is transparent.
- **Leader flip-back lives in state_based, not a replacement-effects layer.** Replacement effects ship when more than one card actually needs them.
- **Upgrade stats stack directly in `effectivePower`/`effectiveHp`, not via synthesized Modifier records.** `UpgradeSpec.powerModifier` is a spec field, not a Modifier. Direct aggregation is the most common upgrade path; synthesizing Modifiers would add indirection for vanilla +N/+N cards.
- **Coordinate as a `while:` predicate, not a custom ability kind.** ConstantAbility already has `while: Predicate`. New predicate field `controller_unit_count: Range` counts units across both arenas.
- **Smuggle via `active_in_zone`, not a keyword definition.** Constant abilities with `active_in_zone: 'resource_zone'` only fire while the source sits in the resource zone.
- **`leaderIds?` on DeckConfig is optional.** Scenarios that bypass initGame don't need leaders; Twin Suns format passes 2 leader ids at the call site.

**Scenarios (29/29 passing):**
- 13 Week-2 holdovers
- 5 Week-3 holdovers
- 11 new Week-4: upgrade stat boost, upgrade keyword grant via attached_to_self, upgrade attach via PLAY_CARD, upgrade detach on host defeat, Coordinate active at 3 units, Coordinate inactive at 2 units, Smuggle active in resource zone, Smuggle inactive in arena, leader deploy lands as 4/5 in ground, leader-unit aura buffs other clones, leader flip-back on lethal (no discard entry)

**Known gaps deliberately deferred (Week 5):**
- **Action abilities** (`Action [Exhaust]: …`) — the AST has `ActionAbility`; needs a `USE_ACTION_ABILITY` action and dispatcher. Ahsoka "Snips" et al. land here.
- **Un-deployed leader abilities** — `leaderAbilities` is read but never surfaced. Mother Talzin / Asajj Ventress need this.
- **Leader-as-base-upgrade** (Twin Suns §v7 3.4.4A) — leader upgrades that attach to your base and provide a leader-unit ability. Needs `LeaderInstance.leaderUpgradeIids` + `leaderUpgradeAbilities` surfacing.
- **Replacement effects layer** (Instead/Would).
- **CLI choice prompting** + **Async PendingChoice** for the web UI.
- **Remaining primitives**: indirect_damage, divided_damage, arena-move, search, look_at, disclose.

---

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

0. **UI UAT path — next is real card data + UX polish.** Sessions 43-45 delivered the full engine→browser stack: async PendingChoice (43), CLI rewire to stepAsync (44), and the `/playtest` browser route with `useGameV2` + Board + ChoicePromptModal + AI auto-dispatch (45). The route uses W1-W6 fixture cards. Next concrete steps: (a) translate deck-builder output (v1-shape) → `DeckConfig` for the playtest; (b) hand-author specs for ~20 real SWU cards a player has in their deck (or build the L4 cascade pipeline from ENGINE_DESIGN.md); (c) UX polish — click-to-play, target highlighting, card text on hover, animations. Lower-priority engine gaps: base-damage replacements, replacement ordering chooser, true deck shuffle in search, leader-as-base-upgrade.

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
