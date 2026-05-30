# CHANGELOG

Most recent entry first. Captures *why*, not just *what* — decisions, root causes, alternatives rejected.

---

### 2026-05-29: Production UI bug fixes — empty img src + unguarded clipboard (session 50b)

**Change**

Two runtime errors reported while viewing cards/decks (blocking deck-building UAT), both fixed. Frontend app bugs (not the v2 engine). All affected routes compile + 200.

- **Empty `<img src="">`** (warned at `profile/page.tsx:92`): the pattern `src={image_uri || image_url || ''}` passes an empty string when a card/leader has no art, which makes the browser re-request the page and Next surfaces it as an error. Found **8 occurrences** (profile ×2, DeckViewClient ×3, PublicDeckViewClient ×3, decks/page ×1, GameCard ×1). Profile's two now conditionally render a name/initial placeholder instead of an `<img>`; the rest changed `|| ''` → `|| undefined` (React omits the attribute — the React-sanctioned fix per the warning text). No remaining empty-string src in the app.
- **Unhandled `NotAllowedError` from `clipboard.writeText`** (`DeckExportModal.handleCopy`, unguarded): clipboard writes reject when the document isn't focused / lacks permission, surfacing as a scary console error. Added a shared `copyToClipboard(text)` helper in `lib/utils.ts` — tries the modern API, falls back to legacy `execCommand('copy')`, resolves to a boolean, never throws. Wired into both clipboard call sites (`DeckExportModal`, `DeckViewClient` share). `DeckViewClient` now distinguishes "link created but copy blocked" from "link generation failed" instead of mislabeling.

**Verification:** `npx tsc --noEmit` clean; dev SSR of `/profile`, `/cards`, `/decks`, `/playtest` all compile + HTTP 200.

**Files:** `app/profile/page.tsx`, `app/decks/[id]/DeckViewClient.tsx`, `app/decks/share/[token]/PublicDeckViewClient.tsx`, `app/decks/page.tsx`, `app/game/GameCard.tsx`, `components/DeckExportModal.tsx`, `lib/utils.ts` (new `copyToClipboard`).

---

### 2026-05-29: Deck-driven primitives — per-X scaling, keyword auras, 2 predicates (session 51c)

**Change**

Continued grinding the test deck. Added two predicates, a per-X scaling modifier, keyword-grant aura + conditional self-grant templates, and a self-phase-buff. Test deck 33% → **40%** (17 → 21 cards). Crucially these are corpus-general: whole-corpus matcher-full coverage jumped **51 → 128 cards** (2.3% → 5.7%), corpus fully-playable 18.4% → **21.8%**. The deck-driven approach is paying the dividend it's supposed to — one player's deck surfaced primitives that unlock ~77 cards pool-wide. Engine 76, matcher 35, validator 16 — all green; play-cli completes.

**New predicates (engine)**

- **`controller_resource_count?: Range`** — resources the controller has (ready+exhausted). For "While you control N or more resources…" (Seasoned Shoretrooper). Mirrors `controller_unit_count`.
- **`controller_controls_trait?: string`** — true iff the controller has an in-arena unit with the trait. For "While you control a Vehicle unit, this gains Sentinel" (Bunker Defender). Walks the controller's arenas checking `reg.cards[id].traits`.
- Both wired into `evalCardPredicate`, the validator's closed-vocab + range check, and covered by engine scenarios (resource-gated +2/+0; trait-gated Sentinel) using new fixtures W7_003/W7_004.

**Per-X scaling modifier (engine)**

- `Modifier.per?: { count: PerCount; power?; health? }` where `PerCount ∈ {controller_resources, controller_units, self_upgrades}`. `effectivePower`/`effectiveHp` add `per.power × liveCount` — so "+1/+1 for each resource you control" (97th Legion) and "+N/+N for each upgrade on this unit" track live as the count changes. Validator gates the `per` shape. Engine scenario verifies it tracks resource count live (4 → 2 resources).
- This is the keystone for SWU's very common "for each X" pattern — broadly reusable beyond the deck.

**Matcher templates**

- Keyword-grant auras: "Each friendly non-leader unit that costs N or more gains KEYWORD" (Piett, with `card_type`+`card_cost` filter); "Each/Other friendly [Trait] units gain KEYWORD".
- Conditional self-grants: "While you control N or more resources, this unit gets +N/+N" (→ resource-count gate); "While you control a Trait unit, this unit gains KEYWORD" (→ controls-trait gate).
- Per-X: "This unit gets +N/+N for each resource you control / for each upgrade on this unit".
- Self phase-buff: "This unit gets +N/+N for this phase" (Crosshair action body → action self-buff; Crosshair now partial).

**Honest remaining tail (task #58).** The deck's last ~31 cards need genuinely new mechanics, ~1–2 cards each: token creation with conditionals (Spy tokens — Palpatine), control-transfer (Choose Sides, Death Star Plans), play-from-discard (Palpatine's Return), power-based damage ("deals damage equal to its power" — Crosshair/Focus Fire/Maximum Firepower), upgrade-granted-ability host-redirection (Sith Traditions), modal choose-one + Force (Shatterpoint), discard-pile counting (Captain Enoch), and Revan's leader trigger (embedded exhaust cost + trigger-source target). These are real primitive/engine work or Tier-2/hand-author — diminishing returns per card on this deck, but several (power-based damage, token creation) are high-corpus-value.

**Verification:** `npx tsc --noEmit` clean · `npm run scenarios` 76/76 · `npm run translate-scenarios` 35/35 · `npm run validate-scenarios` 16/16 · `npm run play-cli` completes · deck-coverage 40% · coverage-report 21.8%.

**New files (2):** `__fixtures__/cards/W7_003.json`, `W7_004.json`.
**Modified:** `spec/ast.ts` (predicates + `Modifier.per`), `runtime/predicates.ts`, `runtime/modifiers.ts` (per-X), `spec/validate.ts`, `__fixtures__/index.ts`, `scripts/scenarios.ts`, `engine-v2-data/match.ts` (templates), `engine-v2-data/translate_scenarios.ts`.

---

### 2026-05-29: Close-miss templates + leader-action matching (session 51b)

**Change**

Continued the deck-driven matcher work: added close-miss effect templates and an Action-ability parser that finally gives leaders non-zero coverage. The test deck rose 23% → **33%** (12 → 17 cards fully playable) across this batch. tsc clean; engine 73, matcher 30, validator 16 — all green; play-cli completes.

**Close-miss templates (no new primitives — better matching of existing effects)**

- **Trait-qualified give buff:** `Give a <Trait> unit +N/+N for this phase` (Obedient Vanguard) — generalized the give template to capture an optional trait → `card_trait` filter, friendly default.
- **Ready a unit:** `Ready a [<qualifier>] unit` → existing `ready` effect on a chosen friendly (Admiral Motti). Qualifier filter dropped (best-effort).
- **Heal a unit:** `Heal N damage from a unit [or base]` → `heal` a chosen friendly unit (Repair). The "or base" option is dropped — heals the unit; noted.
- **Indirect damage to a player:** `Deal N indirect damage to the defending player / a player / each opponent` → `damage` to `opponent_base` with `indirect: true` (TIE Bomber). In SWU "damage to a player" = their base; the existing damage effect already supports indirect + base.

**Leader-action matching (leaders 0% → non-zero)**

- New **`parseActionClause`** handles `Action [<cost>]: <effect>`. **`parseActionCost`** interprets the bracket: `exhaust` and `N resource(s)` → an `ActionAbilityCost`; any other cost component (e.g. "deal 1 damage to a friendly unit" as a cost, Doctor Pershing) returns null so the card stays honestly residual rather than mis-matched.
- Wired into the matcher's clause loop (action → triggered → constant order).
- **`translateCard` now routes a leader's matched abilities into `leaderAbilities`** (the `text` column is the un-deployed leader-side ability; the deployed unit-side isn't in that column, so `leaderUnitAbilities` stays empty). This unlocks Tarkin's `Action [1 resource, exhaust]: Give an Experience token to an Imperial unit` — combining with the new Experience primitive, his signature ability now fully matches.

**Honest tail.** At 33% the remaining 35 deck cards need genuinely new machinery, not more regex: keyword-grant auras + a resource-count predicate (a few clean wins, task #57), then token creation (Spy tokens), control-transfer (Choose Sides, Death Star Plans), per-X scaling modifiers (97th Legion), play-from-discard (Palpatine's Return), upgrade-granted-ability host-redirection (Sith Traditions), and modal+Force (Shatterpoint). Those are real primitive/engine work or Tier-2/hand-author tail — captured in task #57, ranked.

**Verification:** `npx tsc --noEmit` clean · `npm run scenarios` 73/73 · `npm run translate-scenarios` 30/30 (Tarkin action, leader→leaderAbilities routing, uninterpretable-cost residual, plus the prior Experience matcher tests) · `npm run validate-scenarios` 16/16 · `npm run play-cli` completes · test deck via `deck-coverage` → 33%.

**Modified files:** `engine-v2-data/match.ts` (close-miss templates, `parseActionClause`/`parseActionCost`, defeat-of-other prefixes from 51), `engine-v2-data/translate.ts` (leader→leaderAbilities), `engine-v2-data/translate_scenarios.ts` (matcher scenarios).

---

### 2026-05-29: Experience-token primitive (deck-driven) (session 51)

**Change**

Built the Experience-token primitive — the keystone surfaced by Christian's Experience-themed test deck — plus matcher templates and a defeat-of-another-unit trigger prefix. The test deck's Tier-1 coverage rose 17% → 23% (9 → 12 cards fully playable). Engine scenarios 73, matcher 27, validator 16 — all green.

**The mechanic (§SWU)**

An Experience token sits on a unit and grants **+1/+1**; tokens stack and persist while the unit is in play. Modeled as a counter on the instance, read by the effective-stats layer — same shape as damage/shields, no per-card code.

**Design choices made in code**

- **`CardInstance.experienceTokens?: number`** (optional → 0). `effectivePower`/`effectiveHp` add it after upgrade bonuses. That's the entire stat side — the existing modifier pipeline already aggregates everything else around it.
- **New `give_experience` effect** (`{ target, count? }`, default 1) in the AST, interpreter (`applyGiveExperience` → bumps the counter, emits `EXPERIENCE_GAINED`), and validator (closed-vocab + required-field check). One more effect kind in the closed set; the validator's fixture cross-check still passes.
- **Matcher templates** for the real card phrasings: `Give an/N Experience token(s) to <target>` and `Give an Experience token to each of up to N <Trait> units`. A `experienceTargetSelector` helper maps the target phrase to a selector — Experience is always a friendly buff in practice, so unqualified/trait targets default to `controller: 'self'`; only an explicit "enemy" flips it. Trait ("an Imperial unit") and cost ("that costs 3 or less") qualifiers become predicate filters. Because the triggered-prefix wrapper already exists, `When Played:/On Attack:` Experience cards match for free.
- **Defeat-of-another-unit trigger prefixes** added while here (directly completes Gideon Hask, an Experience card): `When an enemy unit is defeated:` → `event.defeated where {controller:'opponent'}`; `When a[nother] friendly unit is defeated:` → `{controller:'self'}`. Generalized `TRIGGER_PREFIXES` to carry an optional `where` override; the self `When Defeated:` stays the default. Ordered before the self prefix so the specific forms win.
- **Deck-driven, honestly bounded.** The primitive made 2 cards fully playable immediately and Gideon Hask a 3rd. The remaining 3 Experience cards in the deck *bundle* Experience with mechanics outside this primitive: Tarkin + Revan need **leader-text matching** (leaders are still 0% — their text→leaderAbilities split isn't parsed), and Sith Traditions needs **upgrade-granted-ability parsing** ("Attached unit gains: '…'"). Those are the next chunks, flagged — not Experience-primitive work.

**Verification**

`npx tsc --noEmit` clean · `npm run scenarios` 73/73 (3 new Experience: stacking, end-to-end give via the new W7_002 "Decorated Veteran" fixture, tokens-independent-of-damage) · `npm run translate-scenarios` 27/27 (3 new matcher: trait-filtered give, up-to-N multi-target, Gideon Hask defeat-trigger) · `npm run validate-scenarios` 16/16 · `npm run deck-coverage` on the test deck → 23%.

**New files (1):** `__fixtures__/cards/W7_002.json` (Decorated Veteran — When Played: give 2 experience to self).
**Modified files:** `state/types.ts`, `state/bus.ts`, `spec/ast.ts`, `runtime/interpret.ts`, `runtime/modifiers.ts`, `spec/validate.ts`, `__fixtures__/index.ts`, `scripts/scenarios.ts`, `engine-v2-data/match.ts`, `engine-v2-data/translate_scenarios.ts`.

**Next (task #56):** close-miss templates + small primitives (trait-qualified give/damage, heal unit-or-base, ready-a-unit, indirect-damage-to-player), then the larger leader-text and upgrade-grant matchers that unlock the rest of the Experience cards.

---

### 2026-05-29: L4 Tier 1 — template matcher + corpus coverage measurement (session 50)

**Change**

Built the deterministic Tier-1 template matcher (`engine-v2-data/match.ts`) and a coverage report over the full 2,360-card DB, wired the matcher into the translator, and wrote the Mac mini / LM Studio handoff runbook for Tier 2. The headline is a *measured* number that corrects my own prior estimate. All suites green.

**The measurement, and the honest correction**

I'd hypothesized the template matcher would cover 60–80% of ability-bearing cards. The data: **18.4% of 2,241 deckable cards are fully playable** (vanilla/keyword 16.1% + matcher-full 2.3%); 81.6% need work. By type: units 25%, events 6%, upgrades 9%, leaders 0%. I built the coverage report *first*, before investing in the model, precisely so this would be a number and not a guess — and the guess was wrong by a lot. Worth stating plainly: regex templating has a low ceiling on SWU because (1) the ability text is genuinely diverse/multi-clause and (2) a large share needs engine primitives that don't exist yet (Force tokens, Experience tokens, return-to-hand, mill, modal choose-one/two, "if you control [X]," indirect-damage-to-player). No matcher *or* LLM can emit working AST for a primitive the engine lacks — so the real levers are **new primitives + the LLM tier**, focused through the "decks I play to 100% first" strategy rather than chasing 2,000 cards corpus-wide.

**Design choices made in code**

- **Ported v1's battle-tested regexes, retargeted to v2 AST.** `parseEffectClause` is `game-engine/abilities.ts:parseEventText` with the output swapped from v1 effect objects to v2 `Effect`. Reusing patterns proven against real card text beats authoring fresh regexes.
- **"Attach to …" is stripped as a non-ability.** It's an upgrade attach *restriction* (which hosts are legal), not an ability — counting it as unparsed rules text was the single biggest false-negative in the first run (~70 cards). Stripped like keyword-reminder text. (Enforcing the restriction is a separate concern, like uniqueness; noted, not done.)
- **Coverage classes: vanilla / full / partial / none.** "vanilla" = no text or keyword-only (already fully described by stats + keyword table). The matcher only claims `full` when *every* non-reminder clause parsed — partials are honest about leaving residual.
- **The report tallies normalized residual clauses (digits→N).** Output isn't just a percentage — it's a ranked to-do list of the most common unmatched shapes, so the next templates/primitives are chosen from data. Top residuals after tuning: modal "choose one/two," "when an enemy unit is defeated…," Force/Experience/bounce text.
- **Every emitted ability is validated in the report** (wrapped in a probe spec → `validateCardSpec`). 0 invalid across the whole corpus — the matcher and the session-48 validator agree, which is the cross-check that matters before trusting matcher output in real games.
- **Matcher wired into `translateCard`.** Real decks now receive matched abilities (proven-valid), inert `[]` otherwise. Did *not* add a validation-gate in the translator yet (matcher output is already proven valid; the gate belongs with Tier 2 where untrusted LLM specs flow, and adding it now means an import-hygiene change for no benefit).
- **Cheap wins banked from the first run's data:** `Draw a card` ("a"/"an" = 1, not just digits), `While this unit is upgraded, it gets/gains …` (uses the real `self_upgraded` predicate). Re-ran to confirm the lift (17.8% → 18.4%) — modest, which is itself the signal that the ceiling is low.

**Tier-2 handoff**

`engine-v2-data/TIER2_LMSTUDIO_HANDOFF.md` — a self-contained runbook for the Mac mini Claude Code instance to install LM Studio, load a capable instruct model (Qwen2.5 7B/14B GGUF), start the OpenAI-compatible server, and — the make-or-break check — confirm **schema-constrained JSON** output via a curl smoke test. Emphasis on structured output over model size, because the validator catches imperfect-but-valid output; what kills the pipeline is malformed JSON. Tailscale-only, no public exposure, no credentials needed. The generation harness that calls the server is built separately.

**Verification:** `npx tsc --noEmit` clean · `npm run scenarios` 70/70 · `npm run translate-scenarios` 24/24 (8 new matcher scenarios) · `npm run validate-scenarios` 16/16 · `npm run coverage-report` runs over 2,360 cards, 0 invalid AST emitted.

**New files (3):** `engine-v2-data/match.ts`, `engine-v2-data/coverage_report.ts`, `engine-v2-data/TIER2_LMSTUDIO_HANDOFF.md`.
**Modified files (4):** `engine-v2-data/translate.ts` (wire matcher), `engine-v2-data/index.ts` + `engine-v2/index.ts` (exports: matcher + Ability/Effect/Selector/Predicate/Modifier types), `engine-v2-data/translate_scenarios.ts` (8 matcher scenarios), `package.json` (`coverage-report` script).

**Known gaps / next**

- **Primitive vocabulary is the real bottleneck**, not regex. Force tokens, Experience tokens, return-to-hand, mill, modal choice, conditional "if you control X" — the highest-frequency residuals. Build these (deck-focused) and matcher *and* LLM coverage both rise.
- **Leaders match 0%** — their text needs the leader/leader-unit ability split, not yet templated.
- **Need the user's decklists** to drive the "decks to 100%" rollout (per-deck coverage + exact primitive/card list).
- **Tier-2 harness** (prompt + AST JSON-schema + validate loop calling the LM Studio server) — built after the mini reports its server is up with structured output.

---

### 2026-05-28: Leader deploy correction — free + once-per-game, verified vs official rules (session 49b)

**Change**

Christian pushed back on my "Twin Suns house rule" framing of free deploy: it's standard SWU. I web-verified the official rule and he's right — and the verification surfaced a second rule my engine was violating. Net: free deploy stays (correct), plus a new once-per-game guard. 70/70 scenarios. TypeScript: 0 errors.

**The rule, confirmed against the source**

Leader deploy is an **Epic Action**: "If you control N or more resources, deploy this leader." Two facts I had wrong from memory:
1. Using an Epic Action does **not** cost resources. N is a threshold on resources *controlled* (the whole pool, exhausted included) — not a payment. (Already implemented correctly last session, just mislabeled as a divergence.)
2. Epic Actions are **once per game**. A leader that deploys and is later defeated flips back to its leader side but **cannot be deployed again that game**. My engine allowed infinite redeploy after every flip-back — a real bug.

**Process note (worth keeping):** I asserted the standard SWU rule confidently from memory, pushed back on the user, and was wrong — twice now on SWU rules (this and an earlier instance). The fix wasn't "always defer to the user" or "trust my memory" — it was *go to the source*. A 30-second web search of the official rules settled it definitively and caught the once-per-game bug I'd never have found otherwise. Added a standing note to CLAUDE.md: verify SWU rules against the official text, don't author from memory. Christian is the rules authority; the published rules are the tiebreak.

**Implementation**

- `state/types.ts`: `LeaderInstance.hasDeployed?: boolean` — optional (back-compat with hand-built test states), set on deploy, never cleared, survives the flip-back spread in `state_based`.
- `reducer.applyDeployLeader`: throws if `leader.hasDeployed`; sets `hasDeployed: true` on deploy.
- `legal.ts`: `DEPLOY_LEADER` gated on `!leader.hasDeployed` (in addition to the total-resource threshold).
- `init.ts`: leaders initialize with `hasDeployed: false`.
- `CLAUDE.md`: replaced the "Twin Suns diverges" note with a corrected "SWU rules notes — verify against the source" section documenting deploy as standard (free, threshold-on-control, once-per-game).

**Scenarios**

- New: "Leader deploy: Epic Action is once per game — no redeploy after flip-back" (deploy → defeat → flip-back → `DEPLOY_LEADER` not legal + step throws "Epic Action").
- Existing flip-back scenario now also asserts `hasDeployed` is retained through the flip-back.

**Verification:** `npx tsc --noEmit` clean · `npm run scenarios` 70/70 · `npm run translate-scenarios` 16/16 · `npm run validate-scenarios` 16/16 · `npm run play-cli -- --ai both` completes.

**Modified files (5):** `state/types.ts`, `reducer.ts`, `legal.ts`, `init.ts`, `CLAUDE.md` (+ `scripts/scenarios.ts`).

---

### 2026-05-28: Twin Suns rule — leader deploy is free (session 49, UAT round 2)

**Change**

UAT confirmed sessions 46/47 fixes (setup resources, initiative hang, PLAY AGAIN all working). One rules correction: deploying a leader was exhausting resources; in Twin Suns it shouldn't. Now `applyDeployLeader` gates on *total* resources ≥ deploy cost and spends nothing. 69/69 scenarios (+3 new), other suites unchanged. TypeScript: 0 errors.

**Why I asked before coding**

Christian's report said "deploying a leader does not cost any resources, you just need that many to deploy them." My understanding of *standard* SWU is the opposite — the deploy cost is paid by exhausting resources, exactly like playing a card, and that's the whole "deploy now vs. develop the board" tension. The current behavior (couldn't deploy after spending on a unit) was therefore correct *for standard SWU*. Rather than silently comply (risking a rules regression) or silently refuse (ignoring the format authority), I stated the standard rule plainly, noted the code already implemented it, and asked via AskUserQuestion whether Twin Suns intentionally diverges. Christian confirmed: free deploy, threshold on total. This is the "be the smart one in the room, then defer to the domain authority" path — bring the precise mechanic, don't assume.

**Implementation**

- `reducer.applyDeployLeader`: gate changed from `readyResources.length < cost` to `p.resources.length < cost` (total pool, exhausted resources count toward the threshold); removed the exhaust loop and `RESOURCE_SPENT` events. Everything else (leader-unit instance creation, flip to `isDeployed`, `exhausted: true` on the body, `LEADER_DEPLOYED` event) unchanged.
- `legal.ts`: `DEPLOY_LEADER` enumeration gates on `p.resources.length` (total) instead of `readyResourceCount`.
- **Scope held tight:** did NOT change unit-play exhaustion. Whether a freshly-played unit can attack the same turn is a separate SWU rules question that interacts with the Ambush keyword, and it wasn't reported. Bundling it would risk a second unverified rules change. If it's wrong, it'll surface as its own UAT item and it's a one-line change then.

**Recorded as a deliberate divergence**

Added a "Twin Suns diverges from standard SWU" note to `CLAUDE.md` > Principles documenting the free-deploy rule and the general policy: Christian is the rules authority; when a SWU rule seems off, ask rather than assume standard SWU, and log confirmed divergences. This prevents a future session from "correcting" deploy back to charging resources.

**Scenarios**

- Renamed "Leader: deploy pays cost…" → "Leader: deploy is free — lands as 4/5, spends no resources (Twin Suns)"; added asserts that total + ready resource counts are unchanged and no `RESOURCE_SPENT` event fires.
- "Leader deploy: gated on TOTAL resources (exhausted ones still count)" — 1 ready + 3 exhausted = 4 total ≥ cost 4 → deployable (standard SWU would block).
- "Leader deploy: playing a unit first does NOT block deploy (UAT #1)" — the exact reported case: deploy legal, play a 3-cost unit, deploy still legal.
- "Leader deploy: blocked when TOTAL resources < cost" — 3 total < cost 4 → not offered + step throws.

**Verification**

`npx tsc --noEmit` clean · `npm run scenarios` 69/69 · `npm run translate-scenarios` 16/16 · `npm run validate-scenarios` 16/16 · `npm run play-cli -- --ai both` completes.

**Modified files (4):** `reducer.ts`, `legal.ts`, `scripts/scenarios.ts`, `CLAUDE.md`.

---

### 2026-05-26: Spec validator — the gate to the registry (session 48)

**Change**

New `spec/validate.ts` validates CardSpec/BaseSpec ASTs against the engine's closed primitive vocabulary, with path-tracked errors and a warning tier. All 41 shipped fixtures + 2 bases validate clean. New `validate-scenarios` suite: 16/16. No engine behavior changed; this is a tool + safety gate. TypeScript: 0 errors.

**Why this, and why now (instead of the L4 cascade)**

The user asked me to proceed while they test, and the obvious "next" is the L4 rules-text → ability-AST cascade. I deliberately didn't start it. That cascade has a genuine architecture fork — local 8B model on the Jetson/mini, Claude-assisted authoring, or hand-authoring the most-played cards first — with real homelab/token-cost/maintenance implications that are the user's call, and they explicitly flagged wanting to discuss approach first. Starting it unilaterally would either presuppose that decision or produce throwaway work.

So I built the piece that is needed under *every* one of those approaches and commits to none: the validator. Whatever emits an ability AST — an LLM, a deterministic template matcher, or a human — its output must be checked against the closed vocabulary before it enters the registry, because the engine fails *silently* on unknown discriminators (the interpreter's effect switch, the selector resolver, and the predicate evaluator all treat unrecognized shapes as no-ops). A mistranslated card would load and just... do nothing, with no error. The validator converts that into a loud, precisely-located failure. It's strictly on the critical path to L4 and useful the moment any spec source produces real abilities.

**Design choices made in code**

- **Two severities, and the line between them.** `error` = outside the closed vocabulary, or a required field missing/wrong-typed — the spec would misbehave, reject it. `warning` = valid SWU but inert in the current engine, specifically unimplemented keywords (Bounty, Coordinate, Smuggle, Piloting, Hidden, Plot…) which load fine and simply have no effect yet. `ok` is true iff there are no errors; warnings never block. This matters because real decks are full of unimplemented keywords — erroring on them would make the validator useless against the actual card pool.
- **Imports the `KEYWORDS` registry to decide warn-vs-accept.** A hand-maintained "implemented keywords" list would drift the moment a keyword is added. Importing the registry auto-syncs. The `spec/ → primitives/` dependency is acceptable because the validator is a tool, never on the reducer hot path.
- **Closed-vocab sets are hardcoded runtime `Set<string>`s.** TS types are erased at runtime, so they can't be reflected. The drift guard is scenario (1): it validates every shipped fixture, so adding an effect kind to `ast.ts` + a fixture that uses it without teaching the validator makes that scenario fail loudly. The validator and the fixtures check each other.
- **Precise path tracking.** Every issue carries a path like `W2_007.abilities[0].do.steps[1].target.badkey`. For an LLM cascade this is the difference between "card X is broken somewhere" and "card X's second sequence step has a bad selector key" — the latter is actionable as automated feedback to the model or a human reviewer.
- **`buildRegistry` left untouched.** Validation is opt-in via `validateSpecs`, not forced into the loader. Existing callers and the structural-only build path are unchanged. The forward wiring point (documented, not built): validate each translated/LLM-generated spec before it enters the registry and downgrade invalid abilities to inert `[]`. Not wired now because the translator emits `abilities: []` (trivially valid) — wiring against empty abilities is busywork; it lands with the cascade that actually produces abilities.
- **Recursion mirrors the interpreter.** The validator walks effects → nested effects (sequence steps, if then/else, choose_one option do-blocks, optional do), selectors → exclude/from recursion and scoped-form field checks, predicates → and/or/not recursion and leaf-field enums, modifiers, trigger predicates, and action costs (including the selectors inside defeat/remove_shield costs). The structure parallels `runtime/interpret.ts` so "what the validator accepts" and "what the engine executes" stay aligned.

**Coverage of the closed vocabulary**

22 effect kinds · 4 ability types · 12 trigger conditions · 10 zones (+ any_arena/any_zone for filters) · 6 aspects · 4 player refs · 5 selector modes · 6 durations · 5 restrictions · 3 replacement-`on` kinds · move/look_at/search sub-enums · 17 predicate-leaf fields · 11 modifier fields · 11 trigger-predicate fields · action-cost fields.

**Verification**

- `npx tsc --noEmit` clean.
- `npm run validate-scenarios` — 16/16; all 41 fixture cards + 2 bases clean with 0 warnings.
- `npm run scenarios` 66/66 · `npm run translate-scenarios` 16/16 · `npm run play-cli -- --ai both` completes — confirming the new export + file disturbed nothing.

**New files (2):** `spec/validate.ts`, `scripts/validate_scenarios.ts`.
**Modified files (2):** `index.ts` (exports), `package.json` (`validate-scenarios` script).

**Known gaps / next**

- **The L4 cascade itself** is still the next major arc and still wants an approach decision (local model / Claude-assisted / hand-authoring-first). The validator is its safety net and its automated-feedback signal.
- **Validator not yet wired into any build/CI step** — it's a library + script. A pre-deploy "validate all specs" gate is a natural follow-up once specs carry real abilities.

---

### 2026-05-26: Real-card translator + "play your own deck" in /playtest (session 47)

**Change**

New `engine-v2-data` module translates backend-shaped cards into engine-v2 specs (stats + keywords), and the `/playtest` setup screen can now load the user's saved decks instead of only fixtures. 66/66 engine scenarios + 16/16 new translator scenarios. TypeScript: 0 errors. Both playtest routes SSR clean.

**Scope discipline — why only half the problem**

Translating a real deck has two halves: the *structured* half (stats, cost, aspects, traits, arena, keywords — all already columns/relations in the DB) and the *unstructured* half (free-text rules → declarative ability AST). The second half is the L4 cascade from ENGINE_DESIGN.md (deterministic template matcher → local 8B model → Claude → human review) — genuinely multi-week and dependent on the Jetson/mini LLM wiring. Attempting it in one session would produce a fragile half-working parser. So this session does the structured half completely and cleanly, and every translated card gets `abilities: []`. A real deck loads and plays with correct stats and working keywords; text effects are inert. That's an honest, shippable increment and it establishes the exact seam the LLM cascade plugs into later (`translateCard` is where ability AST will eventually be attached).

**Design choices made in code**

- **`engine-v2-data` is a separate sibling module**, not folded into `engine-v2` (keeps the engine's no-dependencies-on-card-DB-shape boundary) nor into `engine-v2-react` (the translator is pure, no React). Its boundary imports from `@/lib/api` and `@/lib/engine-v2` are all `import type` — fully erased at runtime — so the module runs under `tsx` headless tests despite the `@/` alias, with no path-resolution shim.
- **Keyword values come from a narrow text regex, not ability parsing.** The SWU API exposes keywords by name only (`keyword.attributes.name` → `"Raid"`); the numeric value lives in the rules text (`"Raid 2."`). v2 treats a valueless Raid/Restore as +0 (inert), so without the value those keywords would silently do nothing. `parseKeywords` pulls the N with `/\b<name>\s+(\d+)\b/i` against `card.text`, plus a fallback for a value baked into the keyword string. This is deterministic and bounded — explicitly NOT the slippery slope into general text parsing.
- **Leader NULL-stat fallback (3/6).** The DB frequently has NULL attack/health for leaders (the unit-side stats aren't always populated — see session 32's `LEADER_DEPLOYED_STATS` note). v2's `applyDeployLeader`/`effectivePower` would render 0/1 for a NULL-stat leader. The translator falls back to 3/6, matching the v1 precedent, so a deployed leader is a sensible body.
- **`buildGameFromDecks` returns warnings, doesn't throw on soft problems.** Tokens that leaked into `deck.cards`, a leader that didn't translate, a deck that expanded to 0 cards — all warn and continue. The only hard throw is "deck has no base" (unplayable). Warnings are surfaced to the console in the UI; the game still starts. This keeps a slightly-malformed real deck playable rather than dead.
- **Registry dedupes by card id; deckCardIds expands by quantity.** Mirror matches (same deck for both players) reuse one registry entry; `initGame` already creates a fresh `CardInstance` per id occurrence, so quantity expansion in `deckCardIds` is all that's needed. Leaders/base are excluded from the deck pile via the same `excludedIds` guard v1 used.
- **The integration test plays a translated game to completion.** Beyond shape assertions, `translate_scenarios.ts` builds two synthetic real-decks, translates them, and runs an AI-vs-AI loop to a winner (p1, round 5). A registry+config that *type-checks* isn't proof it's *playable* — a missing base, a bad arena, an unresolvable leader id would all pass tsc but hang or throw at runtime. Playing to a winner is the real proof.

**Playtest UI**

- DECK SOURCE toggle on the setup screen: FIXTURE DECK (unchanged default) vs MY SAVED DECKS.
- "My decks" fetches `/api/decks` (slim list) on demand; on START fetches full detail (`/api/decks/{id}`) for the chosen deck(s) — mirror match reuses one fetch — translates, and hands `{config, registry}` to the same `Board`. Board is source-agnostic.
- Graceful degradation everywhere: not logged in / fetch error / no decks → clear inline message, fixtures still work. The real-deck path is strictly additive.

**Latent bug fixed in passing — PLAY AGAIN never reset the game**

`useGameV2` builds initial state in a lazy `useState` initializer (runs once) and exposes a `restart()` that the UI wasn't calling — the PLAY AGAIN button called an `onRestart` prop that bumped a `seed` which changed the config object but never re-initialized the hook, and `Board` had no `key`, so React reused the same instance and state. Net effect: PLAY AGAIN did nothing. Fixed by keying `Board` on a `gameKey` that bumps on restart → clean remount → fresh `initGame` (Math.random reshuffle). Works for both fixtures and real decks. (This was present since session 45 but the user hadn't hit it — they'd been mid-game, not post-win.)

**Verification**

- `npx tsc --noEmit` clean.
- `npm run scenarios` 66/66; `npm run translate-scenarios` 16/16; `npm run play-cli -- --ai both` completes.
- SSR 200 on `/playtest` and `/playtest/smoke`, new setup strings present, no error indicators.

**New files (3)**

- `lib/engine-v2-data/translate.ts` — the translator.
- `lib/engine-v2-data/index.ts` — exports.
- `lib/engine-v2-data/translate_scenarios.ts` — 16-scenario suite.

**Modified files (2)**

- `app/playtest/PlaytestClient.tsx` — DECK SOURCE toggle, deck fetch/select, real-deck start path, Board keyed on `gameKey` (restart fix), new styles.
- `package.json` — `translate-scenarios` script.

**Known gaps deliberately deferred**

- **Card text → ability AST (L4 cascade).** The whole reason real decks play as "vanilla + keywords." This is the next major arc.
- **Authenticated fetch path** verified only by compile + SSR; live deck load needs the user logged in.
- **Uniqueness** not exposed by backend / not enforced by engine.
- **Real card art** in the playtest board (UnitCard renders names).

---

### 2026-05-26: UAT bug fixes — setup resources, initiative-take, leader attack power (session 46)

**Change**

First browser playtest surfaced four issues; three were real bugs. All fixed. 66/66 scenarios passing. TypeScript: 0 errors.

**Bug #1 root cause and fix — `setup_declined` flag leaking onto every resource placement**

`applyResourceCard` and `applyDeclineResource` both set `hasResourced=true` and both called `advanceSetupAfterResource`. The helper then checked "if `hasResourced && resources < cap` → mark this player as declined" without distinguishing whether the call came from a decline or a normal placement. So p1's first `RESOURCE_CARD` was treated as a decline → flag set → p1 skipped for the rest of setup → p2 got both placements.

The fix: thread a `declined: boolean` parameter through both call sites. Only set the flag when `declined=true`. As a secondary cleanup, restructured the helper so `setupDone` reads from the post-flag state (`s`) instead of the captured input (`state`) — previously the flag wouldn't be visible inside the same call, and the decline propagated one iteration late.

Why this didn't show up in `play-cli --ai both`: the bug fires symmetrically and the game still completes — both players ended up with asymmetric resources (1 vs 2), but the action phase still ran, the AI still made decisions, and a winner was eventually declared. The CLI tests asserted "game completes" not "resources placed correctly." That's a gap the new scenarios cover now.

**Bug #2 root cause and fix — TAKE_COUNTER offered after someone already took it**

`legal.ts`'s TAKE_COUNTER gate was `!p.countersHeld.includes('initiative')` — checking only the asking player. Per §v7 7.4 the initiative counter is shared; once any player takes it that round, no one else can. The check should consider every seat's `hasTakenCounterThisRound`.

If both seats took it (p1 → AI's heuristic prioritized TAKE_COUNTER for p2 since it was still "legal"), `advanceToNextTurn`'s skip-loop bounced between them until the safety counter ran out and left `activePlayer` on a seat with no legal actions. The local player saw "no legal actions" and was stuck — the AI dispatch effect saw the active player was the human (or both seats stuck if AI) and didn't advance.

Two-part fix:
1. `legal.ts`: gate on `state.playerOrder.some(o => state.players[o].hasTakenCounterThisRound)` — if anyone took it, no one else can.
2. `advanceToNextTurn`: defensive — if every player has `hasTakenCounterThisRound`, end the action phase. Catches any future case where the legal gate is bypassed (e.g. an engine call that synthesizes a TAKE_COUNTER action without going through legal).

This bug was *also* present in CLI smoke runs but masked by the AI heuristic's pick order — `TAKE_COUNTER` is checked AFTER ATTACK in `aiPick`, and base hits are usually available, so the AI rarely took initiative in practice. Browser UAT exposed it because the user took initiative early and the AI then took it on its next turn.

**Bug #3 — only PASS after deploying leader — not a bug**

After spending 4 resources on Clone General, the user had 0 ready resources, an exhausted leader-unit (correct per §v7 — leaders enter exhausted on deploy), and hand cards that all cost > 0. PASS was the only legal action. Closing as expected behavior; the user observed it because resources are scarce in the early game.

**Bug #4 root cause and fix — `?` power in ATTACK description for leaders**

`describeAction`'s ATTACK case did:
```ts
const pw = aspec && isUnit(aspec) ? aspec.power : '?';
```

`isUnit` returns true only for `spec.type === 'unit'`. Leader specs have `type === 'leader'` and token specs have `type === 'token'` — both fall through to `'?'`. The actual attack worked (damage landed correctly via `effectivePower`), so this was purely cosmetic.

Fix: replace with `effectivePower(state, reg, attacker.inst, controller)`. This not only handles leaders and tokens but also displays buffed power (aura modifiers, upgrade modifiers, Coordinate buffs, lasting effects) — the same number the engine uses for combat resolution. Better UX as a side effect of the bug fix.

**Why fixing the typings would have caught some of this**

The `isUnit` check passing through type='leader' silently was structurally avoidable if I'd had a stricter `Attacker` type that asserts "this card is unit-shaped." TypeScript's structural typing doesn't catch "function expects T1 but T2 is also a member of the union T1|T2|..." — the gate was a runtime narrowing. Future refactor opportunity: a `UnitLikeSpec` union (unit | leader | token-as-unit) with a shared interface for stats, used consistently in display code.

**Verification**

- `npx tsc --noEmit` — clean.
- `npm run scenarios` — 66/66 (61 holdovers + 5 new).
- `npm run play-cli -- --ai both` — completes.
- SSR on both `/playtest` and `/playtest/smoke` — 200, no error indicators.

**New scenarios (5)** — one per bug + a defensive "both took counter → action phase ends gracefully" test. Each scenario drives the engine through the actual sequence that surfaced the bug, not just the underlying helper.

**Modified files (3)**

- `reducer.ts` — `advanceSetupAfterResource` takes `declined: boolean`; `setupDone` reads post-flag state; `advanceToNextTurn` ends action phase if all players took counter.
- `legal.ts` — TAKE_COUNTER gated on game-wide `hasTakenCounterThisRound`; ATTACK description uses `effectivePower`. Dropped now-unused `isUnit` import.
- `scripts/scenarios.ts` — 5 new UAT scenarios.

---

### 2026-05-26: Engine v2 Week 7b — `/playtest` browser UAT artifact + base-damage replacements + deterministic search shuffle (session 45)

**Change**

v2 engine runs end-to-end in the browser. A new `/playtest` route lets a human play a 2-player game with the v2 engine driving everything: board state, legal actions, async choice prompts via modal, AI opponent via the heuristic chooser. The "path to UI UAT" item that's been queued since session 42 is now complete. Scenarios 57/57. TypeScript: 0 errors. SSR-verified clean on `/playtest` and `/playtest/smoke`.

**Design choices made in code**

- **New top-level module `frontend/src/lib/engine-v2-react/` for the React adapter.** Kept separate from `engine-v2/` to preserve the engine's "no React imports" boundary (per ENGINE_DESIGN.md). Three files: `useGameV2.ts` (hook), `ai.ts` (greedy picker + chooser), `index.ts` (exports).
- **`useGameV2` is materially simpler than v1's `useGame`.** v1 stored a mutable engine instance in a ref and had to defend against Strict Mode double-mounts that would build two engines and desync from state. v2's engine is pure-functional — state is plain data in `useState`, no engine instance to thread. The hook is ~150 lines and the subtle Strict-Mode safeguards in v1 just aren't needed.
- **AI uses synchronous `step()`; humans use `stepAsync`.** Same call-site split as the CLI in session 44. AI doesn't pause, so going through the replay wrapper would add overhead with no benefit. Both paths funnel into the same `applyAsync`/`applySync` setState helpers.
- **`stateRef` for the auto-dispatch closure.** The AI's `setTimeout` callback reads `stateRef.current` rather than the closed-over `state`. This guards against the case where state changes between scheduling the timeout and the timeout firing (which can happen under Strict Mode double-execution).
- **Single new export from engine-v2: `ResolvedTarget`.** The modal needs to render targets with proper typing. The only diff to `engine-v2/index.ts` is a one-line type re-export — the engine's API surface is otherwise untouched.
- **Decision: legal-actions list as a flat clickable column, not contextual interaction.** v1's `/game` has rich contextual UI (click a hand card to play, click an attacker to start an attack, target highlighting). That's months of UX work. For the UAT, the legal-actions list is exhaustive and unambiguous — you can always see exactly what's possible, no guessing. Contextual interactions are a layer on top, not a replacement.
- **`/playtest/smoke` subroute as a headless verification artifact.** Mounts `Board` directly with a deterministic AI-vs-AI config (no setup screen click required). Lets me SSR-check the playing-mode render path without driving an actual browser. Kept in the route tree because it's harmless and useful for any future headless verification.
- **Fixture cards, not real SWU cards.** The playtest deck uses the W1-W6 JSON fixtures. Wiring deck-builder output (which produces v1-shaped decks) to `DeckConfig` requires either a translator layer or hand-authoring specs for the cards a player actually has — neither blocks the UAT route from shipping, both are followup work.
- **EventTicker filters to noteworthy events.** Showing every `RESOURCE_SPENT` and `EXHAUSTED` would be noise. The ticker surfaces `DEFEATED`, `TOKEN_CREATED`, `CAPTURED`, `LEADER_DEPLOYED`, `LEADER_DEFEATED`, `DAMAGE_PREVENTED`, `UPGRADE_ATTACHED`, `UPGRADE_DETACHED`, `GAME_ENDED` — the things a player wants to see.
- **Effective stats on units, not printed stats.** `UnitCard` calls `effectivePower(state, registry, inst, pid)` so aura buffs (Clone Sergeant, Clone General) and upgrade modifiers (Battle Plates) show up in the displayed power/HP. The damage indicator only appears when damage > 0 (less clutter on full-HP units).

**Verification**

- `npx tsc --noEmit` — clean across `engine-v2/` + `engine-v2-react/` + `app/playtest/`.
- `npm run scenarios` — 57/57 passing (no engine code changed this session).
- `npm run play-cli -- --ai both` — engine end-to-end smoke still completes.
- `/playtest` SSR — HTTP 200, 31 KB response, all setup-screen strings (`TWIN SUNS · ENGINE V2 PLAYTEST`, `Browser UAT`, `HUMAN vs AI`, `AI vs AI`, `START GAME`) present.
- `/playtest/smoke` SSR — HTTP 200, 43 KB response, Board mounted with both PlayerMats; `GROUND`/`SPACE`/`HAND`/`RESOURCES` × 2 (per seat); `Echo Base` + `Death Star` base names visible; zero runtime error indicators (`TypeError`, `Cannot read`, hydration mismatch).

**New files (10)**

- `lib/engine-v2-react/useGameV2.ts` — hook.
- `lib/engine-v2-react/ai.ts` — greedy AI + chooser.
- `lib/engine-v2-react/index.ts` — exports.
- `app/playtest/page.tsx` — server wrapper.
- `app/playtest/PlaytestClient.tsx` — setup/playing/ended state machine + deck config.
- `app/playtest/Board.tsx` — root board + event ticker.
- `app/playtest/PlayerMat.tsx` — per-player display.
- `app/playtest/UnitCard.tsx` — unit display with effective stats + upgrade stack.
- `app/playtest/ActionPicker.tsx` — grouped legal-actions list.
- `app/playtest/ChoicePromptModal.tsx` — async prompt modal.
- `app/playtest/smoke/page.tsx` + `SmokeClient.tsx` — headless verification harness.

**Modified files (1)**

- `lib/engine-v2/index.ts` — `export type { ResolvedTarget }`.

**Base-damage replacements (added after the UI work)**

While momentum was high I closed one more documented engine gap: the replacement layer now covers base damage too.

- `ReplacementAbility.on` accepts `'damage_base'` alongside `'damage_unit'` and `'defeat_unit'`.
- `TriggerPredicate.base_controller?: PlayerRef` — new field for matching the controller of the base being damaged. Standard use: `where: { base_controller: 'self' }` on a unit guarding its own base.
- `runtime/damage.ts` exports `dealDamageToBase` mirroring `dealDamageToUnit`. Same cycle-broken pattern.
- `interpret.ts applyDamageToTarget` (base branch) and `reducer.ts applyAttack` (both base-attack and Overwhelm-excess paths) route through it.
- Fixture: Aegis Shield Generator (W7_001) — `damage_base` replacement with `where: { base_controller: 'self' }` + `with: noop`. Three new scenarios verify positive guarding, asymmetry (doesn't fire on the controller's own attacks on enemy base), and that Overwhelm excess damage is also intercepted.
- The DAMAGE_PREVENTED event currently shapes around unit iids; base prevention skips that event for now (the replacement's `with` effect can log/heal as needed). Widening DAMAGE_PREVENTED to carry base targets is a one-line bus change if observers need it.
- 60/60 scenarios passing after base-damage work.

**Deterministic deck shuffle in `search` (added after the base-damage work)**

Closing one more documented gap while momentum was high. Per §v7 8.36 the deck shuffles after a search; previously `applySearch` left the deck in pre-search order. The blocker was that any RNG had to be reproducible under the replay-based async step model.

- **New `util/rng.ts`** — `mulberry32` PRNG + `shuffleDeterministic` Fisher-Yates. The runtime now has a single sanctioned randomness source.
- **`applySearch` seeds the shuffle from `state.step`** — monotonically incremented per top-level step(), so replays are stable. Two searches in the same step would share a seed (degenerate; not exercised by any current card). If that case ever matters, the fix is a `_rngTick` counter on state — trivial extension.
- **All three exit paths shuffle**: match found, no match, declined.
- **Determinism audit still holds**: `Math.random` only in `init.ts` (deck shuffle at game *start*, with `cfg.rng` injection), `Date.now` only in `util/uuid.ts` (initGame's game id). The new PRNG in `util/rng.ts` reads `state.step` — no clock, no entropy.
- **Scenario updates**: prior "deck unchanged on no-match" flipped to verify same cards retained (order may differ); new "shuffle deterministic across replays" confirms running the same search twice from the same state produces the same deck order. 61/61 scenarios passing.

**Known gaps deliberately deferred**

- **Real card data.** Playtest uses fixtures. Wiring deck-builder output → `DeckConfig` + authoring specs for real SWU cards (whether by hand or by the L4 cascade pipeline from ENGINE_DESIGN.md) is the next product step.
- **Contextual interaction.** Click-to-play and click-to-attack would be UX wins but aren't blockers.
- **Animations / transitions.** The board is functional but static.
- **Card text on hover.** Fixture cards don't carry flavor text; deferred until real card data flows.
- **Keyboard shortcuts** for the action picker and modal.
- **Mobile/responsive layout.** Currently desktop-only.
- Remaining engine gaps: replacement ordering chooser, leader-as-base-upgrade.

**Path to full UI UAT, updated**

- ✅ Async PendingChoice protocol (43)
- ✅ CLI choice prompting (44)
- ✅ `useGameV2` hook + Board + modal + AI auto-dispatch (this session)
- 🎯 Next: real card data flow (deck-builder ↔ playtest) + UX polish

---

### 2026-05-26: Engine v2 Week 7a follow-up — CLI rewired to stepAsync (session 44)

**Change**

The CLI's `cliChooser` auto-pick fallback for human turns is gone. Human players now go through `stepAsync`/`resolveStep` and get prompted interactively for every choice point. AI turns keep using synchronous `step()` with a heuristic chooser — no behavior change. Closes the long-standing "CLI choice prompting" deferred gap. 57/57 scenarios still passing. TypeScript: 0 errors. AI-vs-AI play-cli still completes end-to-end (smoke verified).

**Design choices made in code**

- **Two code paths in the same driver, not one unified async path.** The AI keeps using `step()` with a heuristic chooser. Two reasons:
  - The AI doesn't need pause semantics — its choices are deterministic at the chooser, so `step()` returns settled immediately. Going through `stepAsync` adds replay overhead for no benefit.
  - Leaving the AI on `step()` keeps the synchronous API exercised in a real driver, not just scenarios. That guards against future changes accidentally breaking sync callers.
  - If unification is wanted later, adding a `fallbackChooser?` param to `stepAsync` is a small change — when set, the replay chooser delegates to it instead of throwing on cache miss. Skipped for now: no caller needs it.
- **`promptHuman` renders all three prompt kinds with consistent UX.** `choose_one` shows numbered options with optional `p` to pass; `prompt_target` shows numbered candidates with full unit names + the count/min count, plus optional decline; `optional` is straight y/n. Targets are pretty-printed (`p2's Battlefield Marine<i17>`) so the player sees what they're picking, not raw iids.
- **`executeHumanAction` returns the same `{ next, events }` shape as `step()`** so the main loop's event-handling code (the DEFEATED/TOKEN_CREATED/CAPTURED/GAME_ENDED ticker) didn't need to change. The async surface terminates at the driver level.
- **No "back" / "undo" on multi-prompt resolutions.** A human who picks wrong is stuck for that step. Could be added by tracking the journal length at each prompt and rewinding `pending`, but it's UI sugar, not engine work — defer.
- **`runtime/chooser.ts` doc comment updated** to reflect the async lift landed in `runtime/async_step.ts`. Previously it pointed to a "Week-4 lift" that was now ancient history.

**Smoke verified**

- `npm run play-cli -- --ai both` completes to a winner.
- `npm run scenarios` — 57/57 still passing (this session changes no engine code).
- Human-path liveness: piped a quick input to `--ai p2` and observed the legal-actions list renders, the action prompt waits for input, and the path doesn't crash.

**Modified files (2)**

- `scripts/play_cli.ts` — removed `cliChooser` and `pendingAnswers`; added `aiChooser` (synchronous fallback for AI players only), `renderTarget`, `promptHuman`, `executeHumanAction`; main loop dispatches by `aiPlayers.has(pid)`.
- `runtime/chooser.ts` — doc comment updated; no code changes.

**Known gaps deliberately deferred**

- **Multi-prompt undo** in the CLI (UI sugar, not engine).
- **Unified async-only CLI** (would add a `fallbackChooser` param to `stepAsync`; not needed yet).
- All Week-7+ gaps from session 43 still open: base-damage replacements, replacement ordering chooser, useGameV2 hook + GameBoard rewire, hand-authored playtest cards, capture-zone UI, upgrade-stacking visual.

---

### 2026-05-26: Engine v2 Week 7a — async step protocol (session 43)

**Change**

Closes the single biggest blocker on the path to UI UAT. The engine can now pause for player input in environments (React) where a synchronous chooser can't work, *without* rewriting any engine internals. `stepAsync(state, action, reg)` and `resolveStep(pending, result, reg)` form the async-shaped surface. 5 new scenarios verify the protocol. 57/57 passing. TypeScript: 0 errors.

**Design choices made in code**

- **Replay-based resumption beats CPS / generators for this codebase.** Three patterns were on the table:
  - *Continuation-passing*: transform every effect into CPS. Massive churn; JS has no first-class continuations so you simulate with closures — becomes spaghetti.
  - *Generator coroutines*: make `applyEffect` and friends `function*`. Natural pause/resume; readable. But every layer (interpret.ts, state_based.ts, damage.ts, the whole reducer) becomes generator-bound; lots of `yield*` plumbing.
  - *Replay-based resumption* (chosen): engine stays synchronous; the chooser callback becomes the pause point via thrown signal. Driver catches the signal, surfaces the prompt, then re-runs the step with the pick appended to a journal.

  The synchronous `Chooser` API was *already* designed to be swappable (function-typed parameter, every prompt site accepts it). Replay-based resumption is the pattern that exploits that design. Zero engine churn.
- **Determinism is the load-bearing property.** Replay only works if running `step()` twice with the same inputs produces the same intermediate state at each choice point. Audited:
  - `Math.random` only in `init.ts` (deck shuffle at game start) — not in `step()`.
  - `Date.now` only in `util/uuid.ts` — used by `initGame` once, not in `step()`.
  - `Object.keys/entries/values` — never used in the engine. All iteration goes through `state.playerOrder`.
  - Map/Set: only `Set<string>` in `perGameFlags`; insertion order is deterministic. No `Map`s in state.
  - iid generation uses `state._nextIid`, threaded through state mutations.

  The runtime was already pure by design — replay just made the property load-bearing.
- **PendingChoiceSignal is a thrown class, not a return value.** The alternative was rewriting every `applyEffect` call site to return `Result<T> | Pending`. That's a CPS-shaped refactor in disguise. Throwing keeps every primitive's signature untouched — the signal bubbles up from the chooser through the entire engine call stack to `stepAsync`'s try/catch. The engine has no `try/catch` in its hot path, so the throw propagates cleanly.
- **Cost: O(N²) re-execution per step for N choice points.** Each `resolveStep` re-runs the whole step from the original state. For typical card abilities (0–2 prompts) this is fine. Lightning Storm (4 prompts) verified clean. Pathological cases are bounded by step complexity, which is already small.
- **No CLI changes.** The synchronous `step()` and `Chooser` API are untouched. CLI and tests keep using them. The async layer is the engine-to-UI adapter only. Wiring the CLI through `stepAsync` would make its readline driver truly interactive for branching plays, but it's not blocking the UI UAT path.
- **`PendingStep` holds the original state + action + journal**, not the in-progress state. The point of replay is that we don't *have* a coherent mid-step state to resume from — the engine threw partway through. The "resume" is "re-run from the start with one more answer." This is what makes the design simple.
- **`stepAsync` is the new public entry point for callers that need pause semantics; `step` stays exactly as-is.** Both coexist. UI uses `stepAsync`. Tests / CLI / AI keep using `step`.

**Scenarios verified (57/57)**

52 holdovers (Weeks 2-6c) all green.

5 new W7a: no-choice action settles on first call (verifies the happy path with no overhead); choose_one prompts return `kind: 'pending'` with the right prompt shape (verifies the signal-catch path); single-choice resolves to settled or another pending (verifies the resume path); two `stepAsync` calls with identical inputs produce identical settled state (verifies determinism); 4 sequential prompts surface one-at-a-time using Lightning Storm divided damage (verifies the N>2 case).

**New files (1)**

- `runtime/async_step.ts` — `PendingChoiceSignal` (internal exception), `PendingStep` (resumable handle), `AsyncStepResult` (discriminated union `settled | pending`), `stepAsync` + `resolveStep` (public API), `executeWithJournal` (shared implementation).

**Modified files**

- `index.ts` — exports `stepAsync`, `resolveStep`, `AsyncStepResult`, `PendingStep`.
- `scripts/scenarios.ts` — 5 new async-protocol scenarios; imports `stepAsync`, `resolveStep`, `AsyncStepResult` from the public API.

**Known gaps deliberately deferred**

- **CLI wiring to stepAsync.** The CLI still uses the synchronous chooser. Small refactor — not blocking the UI UAT path.
- **PendingStep serialization.** Right now `PendingStep` holds a live `GameState` reference. Serialization is straightforward (engine state is plain data) but not load-bearing for the initial UAT.
- **PendingChoice ordering** when multiple replacements match the same event (Week 6c gap, still open).
- **Base-damage replacements**, leader-as-base-upgrade, true deck shuffle in `search`.
- **Visual UI surface** — the next blocker. `useGameV2` hook + GameBoard rewiring + capture-zone UI + choice-prompt modals + ~20 hand-authored playtest cards.

**Path to UI UAT, updated:**

- ✅ Async PendingChoice protocol (this session)
- 🎯 Next: `useGameV2` hook + GameBoard wiring to v2 + choice-prompt modal component
- Then: hand-author ~20 cards for a playtest deck
- Then: capture-zone UI, upgrade-stacking visual, action-ability buttons on v2

---

### 2026-05-26: Engine v2 Week 6c — combat damage on the replacement layer + defeat_unit replacement (session 42)

**Change**

Two related closes: combat damage now routes through the replacement layer (previously a documented + locked gap), and a new `defeat_unit` replacement kind lets cards intercept their own would-be defeat (Phoenix / Mantle-of-the-Force patterns). 1 new fixture card + 3 new scenarios + the previously-locked "does NOT intercept combat damage" scenario flipped to a positive assertion. Scenarios: 52/52 passing. TypeScript: 0 errors.

**Design choices made in code**

- **New module `runtime/damage.ts` is the cycle-breaker.** The blocker for combat-damage replacements was that `primitives/combat.ts` couldn't import `applyEffect` (to run a replacement's `with` effect) without producing a cycle that's annoying to reason about. The fix: extract damage dispatch into a third module. `combat.ts` exports the raw `damageUnit` primitive (no replacement awareness, no `applyEffect` dependency). `damage.ts` imports both `damageUnit` (from combat) and `applyEffect` (from interpret) and exposes `dealDamageToUnit` — the new chokepoint. Both `interpret.ts applyDamage` (non-combat) and `reducer.ts applyAttack` (combat) call `dealDamageToUnit`. The cycle between damage.ts and interpret.ts is value-level only — TypeScript resolves it at call time, matching the existing modifiers↔triggers↔interpret pattern.
- **`damageUnitWithReplacements` in interpret.ts is deleted.** It was a transitional wrapper for the non-combat path; once damage.ts existed it became a redundant indirection. interpret.ts's `applyDamageToTarget` and `applyDividedDamage` now call `dealDamageToUnit` directly.
- **`ReplacementAbility.on` widened to `'damage_unit' | 'defeat_unit'`.** A single union (vs separate ability shapes per event kind) keeps the AST flat and reuses the same `where` predicate machinery. New event kinds drop in as new union members and a new collector in `runtime/replacements.ts`.
- **`runtime/replacements.ts` factored** into a private generic `collectReplacements(state, reg, event, on)` with thin public wrappers per `on`. Same scan walks arenas + their upgrades; the kind filter is just a string compare.
- **State-based loop rewritten to process one dead unit per pass** (previously: all-at-once). The old pattern computed `dead = arr.filter(lethal)`, then defeated all of them in a single iteration. With defeat replacements that mutate state mid-iteration (heal one, damage another), the read-after-write semantics required either: (a) recomputing dead after every replacement, or (b) processing one defeat per iteration with the outer loop already responsible for fixpoint. (b) is cleaner — the outer loop already exists for cascade handling. Guard raised from 64 to 256 to absorb the slower cadence; that's still tiny relative to the state space.
- **DEFEATED event suppressed when a defeat_unit replacement matches.** The semantics are "this defeat doesn't happen." If the replacement fires, no DEFEATED event is emitted (no trigger fires for the suppressed event). If the replacement's effect doesn't lower damage below lethal, the next state-based pass tries to defeat again and the 256 guard catches an infinite loop. Card authors who write a broken replacement get a hard runtime error, not a soft hang.
- **Leader flip-back stays a direct branch in state_based.** Migrating it to a defeat replacement would need a `return_to_leader_zone` effect (or similar) — too much AST surface for one mechanic. Re-evaluate when a second similar pattern appears. The existing leader regression scenario was re-run under the new loop and still passes.
- **Multiple-replacement order: source-creation order.** Per §v7 7.7.5 the affected player chooses — that's a chooser pass (Week 7).
- **Chooser threads through `runStateBased`.** Defeat-replacement effects may need to prompt (e.g. for chosen-target effects in the `with` block); the chooser parameter is plumbed from `settle()` → `runStateBased()` → `applyEffect()`.
- **The previously-locked "Replacement: does NOT intercept combat damage" scenario is flipped to a positive assertion.** Force Barrier (1/4) attacked by a 3/3 now takes 0 damage (replacement fires, emits `DAMAGE_PREVENTED` naming itself); the attacker still takes 1 strikeback because the replacement only intercepts damage on the source — outbound damage flows normally.

**Scenarios verified (52/52)**

49 holdovers (Weeks 2-6b) all green. The previously-locked combat-damage scenario flipped: "Replacement: does NOT intercept combat damage (known gap)" → "Replacement: intercepts combat damage too."

3 new Week-6c: Phoenix Sentinel heals itself instead of being defeated (verifies replacement fires, damage cleared, exhausted, no DEFEATED event, not in discard); Phoenix survives a 6-power combat hit through the same defeat replacement (combat damage routes through the layer, then the defeat replacement catches the would-be lethal); leader flip-back still works under the new state-based loop (regression check).

**New files (2)**

- `runtime/damage.ts` — `dealDamageToUnit` chokepoint. Both combat and non-combat damage call this; the replacement-or-raw-damage decision lives here in one place.
- `__fixtures__/cards/W6_008.json` — Phoenix Sentinel (3/3 ground; replacement on defeat_unit: heal self to full + exhaust).

**Modified files**

- `spec/ast.ts` — `ReplacementAbility.on` widened.
- `runtime/replacements.ts` — generic `collectReplacements`; `collectDefeatUnitReplacements` + `makeProspectiveDefeatEvent`.
- `runtime/state_based.ts` — rewritten for one-defeat-per-pass + replacement consultation; takes `chooser?`; guard raised to 256.
- `runtime/interpret.ts` — `damageUnitWithReplacements` deleted; delegates to `dealDamageToUnit`.
- `reducer.ts` — `applyAttack` uses `dealDamageToUnit`; `settle` threads chooser to `runStateBased`.
- `__fixtures__/index.ts` — registers W6_008.
- `scripts/scenarios.ts` — combat-damage scenario flipped; 3 new defeat-replacement scenarios.

**Known gaps deliberately deferred (Week 7+)**

- **Base-damage replacements** — `dealDamageToBase` mirror of `dealDamageToUnit`. Unblocks "if your base would take damage, prevent it" patterns. Small extension once needed.
- **Replacement ordering chooser** when multiple replacements match the same event.
- **More replacement event kinds** — `zone_change`, `card_drawn`, etc.
- **Distribution-prompt chooser variant** for divided_damage AI.
- **CLI interactive choice prompting** + async PendingChoice (long-standing).
- **Leader-as-base-upgrade** (Twin Suns §v7 3.4.4A).
- **True deck shuffle in `search`**.
- **Leader flip-back as a true defeat replacement** (cosmetic refactor — needs a `return_to_leader_zone` effect).

---

### 2026-05-26: Engine v2 Week 6b — divided damage + replacement-effects layer (session 41)

**Change**

Two things land together: the `divided_damage` primitive (chooser-driven AOE distribution) and the first iteration of the replacement-effects layer (§v7 7.7.5). The replacement layer is scoped to non-combat damage on units — combat damage in `applyAttack` still uses the hardcoded shield fast-path because routing it through the replacement layer needs a refactor that breaks the cycle between `primitives/combat.ts` and `runtime/interpret.ts`. That's an explicit Week-6c task. The architectural extension point is in place: new replacement event kinds (`defeat_unit`, `zone_change`, base damage) drop into `runtime/replacements.ts` without touching the rest of the runtime.

**Design choices made in code**

- **Divided damage as a per-point loop, not a new chooser shape.** Each point is a `choose_one` over surviving candidates with `value = iid`. Same idiom `disclose` and `search` use. A distribution-prompt variant returning `Map<iid, amount>` would be cleaner for AI heuristics but the per-point loop satisfies both the deterministic default-chooser case (leftmost-each-time = first target eats everything) and the scripted-chooser case (any split is expressible by listing N picks). Cards needing the smarter shape can drive it in a future batch.
- **Divided damage is indirect by default** (`indirect: true`). Per §v7 8.35.1 ability-distributed damage is non-combat and shieldless. The spec overrides this only if it explicitly says "is combat damage."
- **Replacement scope: `damage_unit` only.** Replacement abilities target a discriminated `on:` field. Only `'damage_unit'` is in the union right now — shipping `defeat_unit` / `zone_change` / base damage replacements without driver cards adds dead code. Each new kind costs one collector function in `runtime/replacements.ts` and one check site in the relevant primitive.
- **Replacements live in `runtime/replacements.ts`, not in `runtime/triggers.ts`.** They share predicate-evaluation infrastructure (the same `evalTriggerPredicate` against a prospective event) but the semantics are different — triggers fire AFTER the event; replacements INTERCEPT it. Keeping them in separate files makes the "is this an interception or a reaction" distinction obvious at the import line.
- **Combat damage stays on the hardcoded path.** The cleanest refactor is to extract damage dispatch into a third module that both `primitives/combat.ts` and `runtime/interpret.ts` import — neither calls `applyEffect` directly, both call `dealDamage(state, reg, …, chooser)`. That refactor is its own batch. The "Replacement: does NOT intercept combat damage" scenario locks the current gap so we notice when it changes.
- **`unpreventable: true` bypasses both replacements and shields.** The shield check lives inside `damageUnit`; the replacement gate is the same flag. Both bail when `unpreventable=true`. This matches §v7 7.7.5 — unpreventable damage skips the entire prevention layer.
- **Multiple-replacement order: source-creation order.** Per §v7 7.7.5 the affected player chooses. Until a chooser pass for prevention-ordering ships, source-creation order (the order the scan discovers them) is deterministic and matches the trigger drain's convention. Listed in the Week 6c gaps.
- **`eventCardIid` extended for `DAMAGE_DEALT` → `targetIid`.** This makes the existing trigger-predicate machinery work for replacement `where` clauses out of the box. `where: { card: 'self' }` on a replacement reads as "this damage is hitting me," which is what Shield-style replacements need.
- **`DAMAGE_PREVENTED { by: <replacement source iid> }` event** signals the prevention. The existing shield path emits `DAMAGE_PREVENTED { by: 'shield' }`; the replacement path emits `by: <iid>` so downstream code can distinguish.

**Scenarios verified (49/49)**

44 holdovers (Weeks 2-6a) all green.

5 new Week-6b: divided damage default chooser dumps all 4 on the leftmost target (defeats it); divided damage scripted chooser splits 2+1+1 across three targets (verifies per-target damage counters); replacement prevents non-combat damage on the source unit and emits DAMAGE_PREVENTED; replacement does NOT intercept combat damage (locks the current gap); damage to a non-replacement target still lands.

**New files (3)**

- `runtime/replacements.ts` — the replacement collector (`collectDamageUnitReplacements`) and prospective-event helper (`makeProspectiveDamageEvent`). Single import surface for the rest of the runtime.
- `__fixtures__/cards/W6_006.json` — Lightning Storm (event, 3, `divided_damage 4 indirect across enemy units`).
- `__fixtures__/cards/W6_007.json` — Force Barrier (1/4 unit, replacement `if damage would hit me, do nothing`).

**Modified files**

- `spec/ast.ts` — `DividedDamageEffect`; `ReplacementAbility { type: 'replacement'; on: 'damage_unit'; where?; with: Effect }`; `isReplacement` guard.
- `runtime/interpret.ts` — `applyDividedDamage`; new `damageUnitWithReplacements` helper between `applyDamageToTarget` and `damageUnit`; chooser threaded through.
- `runtime/predicates.ts` — `eventCardIid` handles `DAMAGE_DEALT`.
- `__fixtures__/index.ts` — registers W6_006 + W6_007.
- `scripts/scenarios.ts` — 5 new Week-6b scenarios.

**Known gaps deliberately deferred (Week 6c)**

- **Combat damage onto the replacement layer.** Needs the dispatch-extraction refactor described above.
- **More replacement event kinds.** `defeat_unit` (clean up state_based leader flip-back); `zone_change`; base damage.
- **Ordering chooser** when multiple replacements match the same event.
- **Distribution-prompt chooser variant** for `divided_damage` AI-driven split decisions.
- **CLI interactive choice prompting** + async PendingChoice for the web UI (long-standing).
- **Leader-as-base-upgrade** (Twin Suns §v7 3.4.4A).
- **True deck shuffle in `search`** — RNG/permutation through the chooser.

---

### 2026-05-26: Engine v2 Week 6a — five missing primitives (session 40)

**Change**

Lands five primitives the design called out as "AST exists" but were in fact missing from both the AST and the interpreter: `move`, indirect damage (as a `DamageEffect` field), `look_at`, `disclose`, and `search`. Each unblocks a distinct v1 card pattern. 5 new fixture event cards exercise the new paths. Scenarios: 44/44 passing. TypeScript: 0 errors. Sister primitive `divided_damage` and the full replacement-effects layer are deferred to Week 6b — divided damage's chooser-driven distribution prompt is novel enough to deserve its own batch, and the replacement-effects layer is an architectural pass that touches state_based.

**Design choices made in code**

- **Indirect damage as a `DamageEffect` field, not a separate variant.** The runtime already supported `indirect: boolean` in `DamageOpts` (the `damageUnit` primitive already skipped shield absorption when set). The AST gap was the only blocker — adding `indirect?: boolean` to `DamageEffect` and threading it through `applyDamage`/`applyDamageToTarget` exposed the existing behavior. Alternative was a separate `IndirectDamageEffect` variant — rejected because it'd duplicate the entire damage shape (target/amount/combat) for one boolean.
- **`move` is implemented inline, not via `moveToZone`.** `moveToZone` emits `ZONE_CHANGED`; arena swaps emit `ARENA_MOVED` per §v7 7.5.3. Using `moveToZone` would emit both events for the same zone change, polluting the event stream. The inline path emits only `ARENA_MOVED`, matching what triggers watching for arena movement expect.
- **`look_at` is a pure event emitter.** No state mutation; emits `CARD_REVEALED` per peeked card. The actual "who can see what" model is the UI's concern — the engine emits events that signal a peek happened; the UI overlays them on the appropriate seat. Alternative was tracking peek state in `GameState` — rejected because it bloats serialization for ephemeral information that the event stream already captures.
- **`disclose` uses `choose_one` (not `prompt_target`) to pick from hand.** `prompt_target` returns `ResolvedTarget[]` (unit/base), which is the wrong shape for "pick a card from this list." `choose_one` passes a free-form `value` field that fits card iids cleanly. Same trick used by `search`.
- **`search` returns non-picked cards in deck order, not shuffled.** Per §v7 8.36 the searched portion should be shuffled, but the interpreter doesn't carry an RNG. Piping RNG through every `applyEffect` call site for this one primitive felt wrong — better to wait until the chooser API can supply a permutation directly (Week 6b lands a chooser variant for this). Documented as a gap; no current scenario actually observes deck order beyond top/bottom.
- **Search with no matches is a state no-op.** Returning the searched portion in original order means the deck looks identical to before — fine for the no-match case. The alternative (shuffle even when nothing was searched out) would require RNG for a state-equivalent transformation.
- **All five new primitives slot into the existing `applyEffect` dispatch.** No new dispatcher path, no new chooser shape, no new event types beyond what was already in the bus union. The AST gap was the only thing blocking these.

**Scenarios verified (44/44)**

37 holdovers (Weeks 2-5) all green.

7 new Week-6: ground→space via `other_arena`; space→ground via `other_arena`; indirect damage bypasses shield and doesn't consume it; `look_at` fires `CARD_REVEALED` per peeked card; `disclose` emits `CARD_DISCLOSED` carrying the disclosed card's aspects; `search` top-3 picks the matching card and lands it in hand (others return to deck); `search` with no matches leaves the deck untouched.

**New files (5)**

- `__fixtures__/cards/W6_001.json` — Tactical Maneuver (event, 1, `move target to other_arena`). Exercises arena swap.
- `__fixtures__/cards/W6_002.json` — Ion Burst (event, 2, indirect 2 damage to chosen enemy). Exercises shield bypass.
- `__fixtures__/cards/W6_003.json` — Reconnaissance (event, 1, `look_at opponent deck_top 3`). Exercises peek + event emission.
- `__fixtures__/cards/W6_004.json` — Reveal Plans (event, 1, `disclose self`). Exercises chooser + CARD_DISCLOSED.
- `__fixtures__/cards/W6_005.json` — Tactical Brief (event, 2, `search top 3 for republic → hand`). Exercises filtered search + deck-restore.

**Modified files**

- `spec/ast.ts` — added `MoveEffect`, `LookAtEffect`, `DiscloseEffect`, `SearchEffect` to the Effect union; added `indirect?: boolean` to `DamageEffect`.
- `runtime/interpret.ts` — new `applyMove` / `applyLookAt` / `applyDisclose` / `applySearch`; `applyDamageToTarget` now threads `indirect`.
- `__fixtures__/index.ts` — registers W6_CARDS.
- `scripts/scenarios.ts` — 7 new Week-6 scenarios.

**Known gaps deliberately deferred (Week 6b)**

- **`divided_damage`** — chooser-driven distribution of N damage among any number of targets. The chooser needs a new prompt shape (`Map<iid, amount>` return value).
- **True deck shuffle in `search`** — RNG piped through the interpreter, or a chooser-supplied permutation. No current scenario observes deck order beyond top/bottom.
- **Replacement effects layer** (Instead/Would).
- **CLI choice prompting** + async PendingChoice for the web UI.
- **Leader-as-base-upgrade** (Twin Suns §v7 3.4.4A).

---

### 2026-05-25: Engine v2 Week 5 — action abilities + un-deployed leader abilities (session 39)

**Change**

Closes the next-largest v1 → v2 parity gap after Week 4's leaders/upgrades. v2 now supports `Action [...]: …` abilities on every legal source (in-arena units, attached upgrades, deployed leader-units, and un-deployed leaders), and surfaces the un-deployed side of leaders to both the modifier scan and the trigger collector. The two land together because un-deployed leaders are mostly action-ability sources — implementing one without the other leaves most of v1's 47 leaders dormant. 4 new fixture cards. Scenarios: 37/37 passing. TypeScript: 0 errors.

**Design choices made in code**

- **Synthetic CardInstance for un-deployed leaders.** The LeaderInstance has no iid because it isn't a CardInstance — but every downstream system (predicates, selectors, chooser context, limit counters, locateSource in the trigger drain) is iid-keyed. Rather than special-case the leader source everywhere, `synthLeaderInstance(state, pid, idx)` builds a read-only CardInstance on demand with iid `LEAD:<pid>:<idx>`. The synth never enters a zone, never mutates state, and disappears after each callsite — but while alive it satisfies every shape contract. The `LEAD:` iid prefix is self-describing (helpful in logs) and survives serialization.
- **`cardAbilities` branches on iid prefix for leader specs.** `LEAD:`-prefixed iid → `leaderAbilities`; otherwise (i.e. real in-arena CardInstance with `cardId = leader.id`) → `leaderUnitAbilities`. Same logic in both modifiers.ts and triggers.ts.
- **Limit counter `tag` parameter (`'trig' | 'act'`).** Triggered and action abilities share counter machinery but use distinct keys so a card with both kinds at the same `abilityIndex` doesn't collide. `limitKey(tag, iid, abIdx, limit)` builds `${tag}:${iid}:${abIdx}:${limit}`.
- **Targets resolved by the Chooser at effect time, not enumerated by legal.ts.** Action abilities surface as one PlayerAction per (source × ability), never per target. The chooser picks targets when `applyEffect` walks a `chosen` selector. Alternative was Cartesian enumeration in legal.ts — rejected because it bloats the legal-actions list and duplicates work already done by the chooser. Same approach used by Week-3 choose_one.
- **Cost-payable check in legal.ts is loose.** `exhaust` and `resources` and `discard` are validated at enumeration time (cheap checks). `defeat` and `remove_shield` selectors are not — they may resolve to 0 candidates depending on chooser policy. The reducer throws at fire time if the selector picks nothing. This matches how PLAY_CARD treats triggered effects.
- **Un-deployed leader constants are always-on** (no `active_in_zone` gating). Per §v7 3.4.4, while the leader sits on the leader zone, its abilities are active. If a future card needs "while-not-deployed only" gating, that's already the semantics — `leaderUnitAbilities` covers the deployed case separately. The constant scan loop in modifiers.ts skips its `constantAppliesInZone` zone check for un-deployed leaders entirely.
- **`readyAll` readies LeaderInstances too.** Leaders ready during regroup just like cards (§v7 5.5.d). The action-ability `exhaust` cost on an un-deployed leader sets `LeaderInstance.exhausted = true`; readyAll resets it.
- **`mapInstance` upgrade gap noted but not fixed.** `exhaust(state, iid)` uses `mapInstance` which only walks arena cards, not upgrades attached to them. If a future card needs an upgrade with an `Action [Exhaust]:` cost, mapInstance needs an upgrade-aware variant. No current card hits this — left as a deliberate gap.
- **Drain uses `cardAbilities` not direct `spec.abilities`.** The trigger drainer previously did `reg.cards[found.inst.cardId].abilities[trigger.abilityIndex]`. That works for unit/upgrade/event/token specs but fails for leader specs (no `abilities` field). Refactored to go through `cardAbilities` so leader synth iids resolve correctly.
- **`locateSource` extended for upgrade iids too.** The drainer's source lookup walked arena+discard; now also walks each host's upgrades[] so triggered abilities on upgrades resolve their source after the trigger drain delay.

**Scenarios verified (37/37)**

13 Week-2 + 5 Week-3 + 11 Week-4 holdovers all green.

8 new Week-5: action ability fires + pays costs + exhausts source; once_per_round limit blocks second fire; exhausted-source rejection; insufficient-resources rejection; un-deployed leader constant buffs friendlies (Clone Strategist); un-deployed leader triggered fires on the right event (Mother Talzin draws on friendly defeat); action ability `[1 resource, Exhaust]` on un-deployed leader (Admiral Ackbar exhausts an enemy); limit resets at end of round (round-transition smoke test through regroup → action phase 2).

**New files (4)**

- `__fixtures__/cards/W5_001.json` — Admiral Ackbar (Stay on Target). Cost-5 leader with un-deployed `Action [1, Exhaust]: exhaust an enemy unit`. Exercises the multi-cost path (resources + exhaust) and the chosen-target selector flowing through the chooser.
- `__fixtures__/cards/W5_002.json` — Targeting Computer Sentry. In-arena unit with `Action [Exhaust] (once_per_round): 1 damage to a chosen enemy`. Exercises the source-card path + once_per_round limit.
- `__fixtures__/cards/W5_003.json` — Clone Strategist. Cost-6 leader with un-deployed constant `+1 power to friendly clones`. Exercises the un-deployed leader constant scan.
- `__fixtures__/cards/W5_004.json` — Mother Talzin (Whispering Witch). Cost-5 leader with un-deployed triggered `on friendly defeated → draw 1`. Exercises the un-deployed leader triggered collector + drainer (via synthetic source iid).

**Modified files**

- `actions.ts` — `USE_ACTION_ABILITY { player, sourceIid?, leaderIndex?, abilityIndex, targetIid? }`.
- `runtime/triggers.ts` — exported `UNDEPLOYED_LEADER_IID_PREFIX`, `makeUndeployedLeaderIid`, `parseUndeployedLeaderIid`, `synthLeaderInstance`, `isLimitExhausted`, `bumpLimit`, `limitKey`. `cardAbilities` branches on iid prefix for leader specs. `inPlayCards` flattens un-deployed leaders into the in-play list. `locateSource` handles `LEAD:` iids and walks host upgrades. Drain calls `cardAbilities` so leader synths resolve.
- `runtime/modifiers.ts` — `cardAbilities` branches on iid prefix; new (a') scan over un-deployed leaders' constants (no zone gating).
- `primitives/state.ts` — `readyAll` readies LeaderInstances.
- `reducer.ts` — new `applyActionAbility` + `resolveActionSource` helper; dispatcher case; imports the new triggers helpers.
- `legal.ts` — `pushActionAbilities` helper; new enumeration across in-arena units + attached upgrades + leaders (both sides). `describeAction` covers `USE_ACTION_ABILITY` for both source-iid and leader-index forms.
- `__fixtures__/index.ts` — registers W5_CARDS into ALL_CARDS.
- `scripts/scenarios.ts` — 8 new Week-5 scenarios.

**Known gaps deliberately deferred**

- **Leader-as-base-upgrade** (Twin Suns §v7 3.4.4A — leader upgrades that attach to your base and provide a leader-unit ability). `leaderUpgradeAbilities` is read by the loader but unused.
- **Replacement effects layer** (Instead/Would). The state-based leader flip-back is still a direct branch; would be cleaner as a replacement.
- **CLI choice prompting** + async PendingChoice for the web UI (Week 3 gap, still open).
- **Remaining declared primitives**: indirect_damage, divided_damage, arena-move, search, look_at, disclose.
- **`mapInstance` upgrade-aware variant** — if a future card needs an upgrade with `Action [Exhaust]:` cost, this needs to be added. No current card hits it.

---

### 2026-05-25: Engine v2 Week 4 — leaders, upgrades, Coordinate, Smuggle (session 38)

**Change**

Closes the largest v1-parity gap. v2 now supports leader deploy + leader-unit-side abilities + flip-back on lethal damage; upgrade attach with stat/keyword stacking + detach-to-discard on host defeat; Coordinate ("while you control N units") as a `controller_unit_count` predicate; Smuggle as `active_in_zone: 'resource_zone'` on constant abilities. 5 new fixture cards. Scenario suite: 29/29 passing. TypeScript: 0 errors. play-demo and play-cli AI-vs-AI still run end-to-end.

**Design choices made in code**

- **Leaders: only the leader-unit side surfaces through the modifier/trigger scan for now.** Un-deployed leader abilities are typically action abilities (`Action [Exhaust]: …`), which the action-ability dispatcher (Week 5) will handle. Constants/triggers on the *deployed* side become live the moment a leader is deployed because the leader-unit lands in the arena as a regular CardInstance with `cardId = leaderSpec.id`, and `cardAbilities` was extended to read `leaderUnitAbilities` from leader specs. No special case in the scan loop — the leader simply *is* an in-play card while deployed.
- **Leader flip-back lives in state_based, not the trigger drain.** Per §v7 3.4.5 a defeated leader-unit returns to the leader zone, not the discard. The state-based defeat loop already iterates the dead set; it now branches: if the dead card matches a `LeaderInstance.unitIid`, flip the LeaderInstance (`isDeployed=false`, `unitIid=undefined`, `exhausted=false`) and emit `LEADER_DEFEATED`; otherwise discard. Going through the trigger drain or a replacement-effects layer was the alternative — both add machinery for a single rule. Replacement effects ship when more than one card actually needs them.
- **Upgrades store as CardInstance entries inside `host.upgrades[]`, not as separate arena entries.** Two consequences: (a) `findCard` doesn't see them — added `findUpgrade` / `findHostOfUpgrade` for the cases that do; (b) the modifier scan recurses into `host.upgrades` and the trigger scan flattens them into `inPlayCards()`. This keeps "an upgrade is in play" honest without requiring a second arena pseudo-zone.
- **Upgrade stat bonuses route through `effectivePower`/`effectiveHp` directly, not through synthesized Modifier records.** `UpgradeSpec.powerModifier`/`hpModifier` are spec-level fields, not Modifier records. The aggregator (`upgradePowerBonus`, `upgradeHpBonus`) walks `inst.upgrades` and sums them. Synthesizing them into Modifier records was the alternative — cleaner-looking but adds an indirection for the most common upgrade type (vanilla +N/+N).
- **`attached_to_self` selector finds the host of `ctx.sourceIid` by scanning all arenas.** O(units) per call. For Week 4 fine — upgrades are rare per side. If this becomes hot, a `hostOfUpgrade` index on PlayerState is the optimization.
- **Coordinate as a `while:` predicate, not a custom ability kind.** The closed AST already has `ConstantAbility.while: Predicate`. Coordinate is "constant ability gated on `controller_unit_count >= N`" — no new ability kind needed. The new predicate field counts units across both arenas for the controller of the source card (resolved via `evalCardPredicate(while, ctx, source, source.pid)`).
- **Smuggle via `active_in_zone`, not a keyword definition.** A constant ability with `active_in_zone: 'resource_zone'` fires only while its source sits in the resource zone. The cardAbilities scan in `runtime/modifiers.ts` was extended to walk resource_zone too (in addition to the two arenas) and gates each constant by `(active_in_zone === undefined ? sourceZone is arena : active_in_zone === sourceZone)`. Smuggle as a keyword (with bonus hooks like Grit) was the alternative — but Smuggle's semantics are "ability while in resource zone," not "stat bonus while in play."
- **`DEPLOY_LEADER { leaderIndex }` references the leader array position, not a card id.** A player can theoretically have two leaders sharing a card id (rare but possible in casual formats). Index disambiguates.
- **`leaderIds?` on DeckConfig is optional.** Scenario state construction bypasses initGame; many tests don't care about leaders. Twin Suns format will pass 2 leader ids at the call site.

**Scenarios verified (29/29)**

13 Week-2 holdovers (Grit, Sentinel, Saboteur, Shielded, Ambush, Raid, Restore, Overwhelm, triggered When-Played damage, triggered On-Attack draw, constant aura, lasting effect expiry).
5 Week-3 holdovers (create_token, capture, choose_one damage branch, choose_one capture branch, token unit defeats normally).
11 Week-4 new: Battle Plates +2/+2 stacks on host; Tactical Visor grants Sentinel via attached_to_self; upgrade attaches via PLAY_CARD; upgrade detaches to discard on host defeat; Coordinate aura activates at 3 controlled units; Coordinate inactive at 2; Smuggle resource_zone constant buffs friendlies; same Smuggle card in arena does NOT fire (zone gating works); leader deploys as 4/5 in ground; leader-unit aura buffs other clones; leader flips back on lethal damage with no discard entry.

**New files (5)**

- `__fixtures__/cards/W4_001.json` — Clone General (leader, ground, 4/5; leaderUnitAbilities = +1/+1 aura to friendly clones).
- `__fixtures__/cards/W4_002.json` — Battle Plates (upgrade, +2/+2 powerModifier/hpModifier).
- `__fixtures__/cards/W4_003.json` — Tactical Visor (upgrade, constant ability with `attached_to_self` granting Sentinel).
- `__fixtures__/cards/W4_004.json` — Coordinated Strike Captain (unit, constant ability gated by `controller_unit_count >= 3`).
- `__fixtures__/cards/W4_005.json` — Smuggled Cache (unit, constant ability with `active_in_zone: 'resource_zone'` granting +1 power).

**Modified files**

- `spec/ast.ts` — added `controller_unit_count?: Range` to PredicateLeaf.
- `actions.ts` — `PLAY_CARD` gained optional `targetIid` (for upgrades); new `DEPLOY_LEADER { player, leaderIndex }`.
- `state/zones.ts` — added `findUpgrade` and `findHostOfUpgrade` helpers.
- `runtime/predicates.ts` — evaluator for `controller_unit_count` against the source's controller.
- `runtime/modifiers.ts` — cardAbilities returns leader specs' `leaderUnitAbilities`; constant scan walks resource_zone with `active_in_zone` gating; scan also recurses into `host.upgrades` for upgrade-borne constants; `effectivePower`/`effectiveHp` add upgrade stat modifiers; `effectiveKeywords`/`effectiveKeywordValue` include upgrade keywords; new helpers `printedPower`/`printedHp` so leader-unit instances pull stats from `LeaderSpec.power/hp`.
- `runtime/selectors.ts` — `attached_to_self` resolves to the host unit of the source upgrade.
- `runtime/triggers.ts` — cardAbilities reads `leaderUnitAbilities` for leader specs; `inPlayCards` flattens upgrades onto the in-play list so triggered abilities on upgrades fire.
- `runtime/state_based.ts` — defeated units' upgrades route to host owner's discard with `UPGRADE_DETACHED` events; defeated leader-units flip the LeaderInstance back instead of going to discard, emitting `LEADER_DEFEATED`.
- `primitives/move.ts` — new `attachUpgrade(state, upgradeIid, hostIid)` helper.
- `reducer.ts` — `applyPlayCard` routes `type === 'upgrade'` through `attachUpgrade` after paying cost; new `applyDeployLeader` pays cost, creates the leader-unit CardInstance in the spec's arena, flips the LeaderInstance, emits `LEADER_DEPLOYED`.
- `init.ts` — `DeckConfig.leaderIds?: string[]`; `newPlayer` instantiates LeaderInstance entries from those ids.
- `legal.ts` — `PLAY_CARD` enumerated per-host for upgrades; new `DEPLOY_LEADER` enumeration; `describeAction` covers both.
- `__fixtures__/index.ts` — registers W4_CARDS and includes them in ALL_CARDS.
- `scripts/scenarios.ts` — 11 new Week-4 scenarios.

**Known gaps deliberately deferred**

- **Action abilities** on leaders (`Action [Exhaust]: …`) — the AST already has `ActionAbility`; needs a `USE_ACTION_ABILITY` action and dispatcher. The leader's deployed-side action abilities like Ahsoka "Snips" (Coordinate—Action: attack with a unit gets +1/+0) land when this ships.
- **Un-deployed leader constants and triggered abilities** — `leaderAbilities` is read but never surfaced. Almost all real leaders use action abilities on the back side, so this rarely matters in practice — but Mother Talzin and Asajj Ventress need it.
- **Upgrades on leader-units** — a leader-unit is a CardInstance with `cardId = leaderSpec.id`. Targeting it with an upgrade works mechanically (it lands in `host.upgrades[]`); the leader-flip path correctly discards those upgrades. But Twin Suns leader upgrades (§v7 3.4.4A: leader upgrades attach to your *base* and provide an ability to the leader-unit) need a different attach destination — `LeaderInstance.leaderUpgradeIids` style — and the spec field `leaderUpgradeAbilities` to start firing.
- **Replacement effects layer** — Instead/Would interception. AST `replace` grammar exists; nothing routes through it yet. The leader flip-back uses a direct branch in state_based instead.
- **CLI choice prompting and Async PendingChoice** — same gap as Week 3.

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
