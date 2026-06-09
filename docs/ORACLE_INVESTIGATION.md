# Correctness Oracle — Investigation & Recommendation

**Date:** 2026-06-09
**Question:** How do we verify engine-v2 card behavior at *pool scale* (~2,400 cards) without hand-playing each one? "Coverage" (a card translates to *something*) ≠ "correctness" (it does the *right* thing). The fuzzer only proves no-crash. We need an automated **correctness oracle** before mass-authoring/LLM-generating the ~750 bespoke residual cards — otherwise we get thousands of plausible-but-unverified cards, which is worse than the ~788 we trust.

---

## Candidate reference: Karabast / `forceteki`

[Karabast](https://karabast.net/) is a fan-made, free SWU simulator. Its engine is open-source:

- **Repo:** `SWU-Karabast/forceteki` — **MIT license**, **TypeScript (98.7%)**.
- **Cards:** implemented as **code classes per card** (not declarative data).
- **Tests:** a **Jasmine** suite with **per-card spec files** (e.g. `LukeSkywalkerFaithfulFriend.spec.js`). DSL helpers: `player.setDeck()`, `player.setSpaceArenaUnits([...])`, `player.setResourceCount(n)`; cards referenced by **name string**; custom assertions like `toBeInLocation()`, `toHaveExactUpgradeNames()`. Wiki has a "Card Testing Guide" + "Test Cheat Sheet".

**The important realization: forceteki's value to us is its *test corpus*, not its engine.** Its per-card specs (set up a board → act → assert outcomes) are a community-maintained, MIT-licensed **ground truth of card behavior**. That reframes the oracle problem.

---

## Options assessed

### A. Live differential testing (drive both engines, diff state) — **NOT first**
Run identical game scripts through both engines, compare outputs.
- ✅ Gold standard; would auto-verify many cards.
- ❌ forceteki is **prompt/server-based** with a different action+state model (players respond to prompts; ours is a synchronous `chooser`/`step` pure function). Mapping action sequences and state representations between two independently-designed engines is **high integration cost and brittle**. Their engine is not a pure function we can call with our state.
- **Verdict:** the model mismatch makes this the *most* expensive path. Defer.

### B. Adapt forceteki's per-card test specs into our harness — **RECOMMENDED**
Their specs already encode "given board X, do Y, expect Z." We translate the *setup + assertions* to our `scenarios.ts` API and run them against **our** engine.
- ✅ Reuses an existing, maintained ground truth — golden per-card tests we don't have to author from scratch. MIT-licensed (attribute in the ported files).
- ✅ Bounded, per-card, parallelizable. A passing port = independent verification of our card.
- ⚠️ Their specs are TS *code* using their DSL, not data. Porting needs: (1) translate their setup (`setSpaceArenaUnits(['Name'])` → our `emptyState({ spaceP1:[mkInst(id)] })`), (2) map their assertions (`toBeInLocation` → our zone checks), (3) **card name → our card id** (we have names in the registry/DB, so this is a lookup). Per-card cost is medium but mechanical — a strong candidate for **LLM-assisted translation** of their spec → our scenario.
- **Verdict:** highest-leverage real oracle. Their *tests* are more useful to us than their *engine*.

### C. LLM-as-judge (card text + our AST → "do these match?") — **cheap complement**
- ✅ Cheap, scales to all cards, catches gross mistranslations.
- ❌ Won't catch subtle timing/interaction bugs (the On-Attack-before-combat class). Not a behavioral oracle.
- **Verdict:** good cheap first-pass *filter* over LLM-generated specs; complements B, doesn't replace it.

### D. Property/invariant testing (extend the fuzzer) — **cheap, do now**
We already assert no-crash / termination / non-empty action sets. Add invariants: HP ≥ 0, effective cost ≥ 0, no negative/over-count resources, rule-of-one upheld, no unit in two zones, etc.
- ✅ Very cheap; catches a whole class of state-corruption bugs across the *whole* random card pool.
- ❌ Not card-specific correctness.
- **Verdict:** low-cost partial oracle; bank it.

---

## Recommendation (sequence)

1. **Now (cheap):** extend the fuzzer with state invariants (D) + sketch an LLM-judge pass (C) over any generated spec. These are days, not weeks, and immediately raise the floor.
2. **The real oracle (B):** build a thin porting pipeline for forceteki's per-card specs.
   - **Proof-of-concept first:** hand-port forceteki's specs for ~5–10 cards we already implement (start with the "Test for Claude" deck cards + the W8 fixtures). Confirm our engine agrees; measure per-card porting cost. A disagreement is either a real bug we found *or* a rules misread — both valuable.
   - **Then scale** with LLM-assisted translation of their spec → our scenario, human-reviewed. The name→id map and the assertion vocabulary are small and reusable.
3. **Only after an oracic exists:** LLM-generate AST specs for the bespoke tail, gated by `validate.ts` (schema) + the oracle (behavior) + LLM-judge (gross check).
4. **Do NOT** invest in live differential testing (A) first — the engine-model mismatch is too costly; their tests give us 80% of the value at 20% of the cost.

**Metric to optimize: "% verified correct," not "% translated."**

## Risks / caveats
- forceteki tracks the live game; **rules/set version drift** between their corpus and ours must be checked (pin a commit; note SWU rules version).
- Their card *names* must map to our DB ids (variants/subtitles) — mostly mechanical but needs a reconciliation pass.
- License: MIT — fine to adapt; **attribute** ported tests to SWU-Karabast/forceteki.

## Sources
- https://karabast.net/
- https://github.com/SWU-Karabast/forceteki (engine, MIT, TypeScript, per-card Jasmine specs)
- https://github.com/SWU-Karabast/forceteki/wiki (Card Testing Guide, Test Cheat Sheet)
- Alternative (not recommended — PHP, different model): https://github.com/SWU-Petranaki/SWUOnline
