# SWU Rules — the engine's correctness oracle

The Twin Suns rules engine (`frontend/src/lib/engine-v2/`) is verified against the
**official Star Wars: Unlimited rules**, never against memory (see the standing
note in the repo-root `CLAUDE.md`). This directory is where those rules live so
every session — and the scheduled remote agent, which has no `/tmp` — uses the
same, current source.

## What's here

| File | What it is |
|------|------------|
| `comprehensive-rules.pdf` | Official full rulebook. **V 7.0 — 3/6/26.** |
| `comprehensive-rules.txt` | Layout-preserving text dump of the PDF, for fast `grep`. Regenerate with the command below if the PDF is updated. |
| `twin-suns-insert.md`     | The **Twin Suns format rules** (Section 12 of the Comprehensive Rules, pp. 52–53), cleaned up into Markdown with rule numbers preserved for citation. |

Note: as of V 7.0 the Twin Suns rules are **Section 12 of the Comprehensive Rules
itself**, not a separate insert PDF. `twin-suns-insert.md` is an extracted,
readable copy of that section so it doesn't have to be re-found in a 54-page PDF
each session.

Get the current versions from the official rules index:
**https://starwarsunlimited.com/rules**

## Twin Suns ≠ 1v1 SWU

When a rule is format-sensitive, **`twin-suns-insert.md` wins** over the base 1v1
Comprehensive Rules. Most notably:

- **Three counters**, not just initiative: **Initiative, Blast, Plan**. "Take the
  Initiative" is replaced by **Take an Available Counter** (§12.5.3).
- **Two leaders per deck**, deployed independently, both providing aspects (§12.3).
- **80+ card decks**, singleton (one copy of any card, leaders included) (§12.2).

## How to read them in a session

```bash
# The committed .txt is already there — grep it directly:
grep -n -i "ambush\|overwhelm\|<keyword>" docs/rules/comprehensive-rules.txt

# Jump to the Twin Suns section:
sed -n '/12. *TWIN SUNS/,/13\./p' docs/rules/comprehensive-rules.txt

# Regenerate the .txt if the PDF is replaced with a newer version:
pdftotext -layout docs/rules/comprehensive-rules.pdf docs/rules/comprehensive-rules.txt
```

## Why this matters

A prior session re-downloaded a **stale** Comprehensive Rules PDF (v1.1, 1/31/24)
into `/tmp` and reasoned from it — which predated the Twin Suns rules (Blast/Plan
counters) and the newer-set keywords (Bounty, Exploit, Smuggle, Piloting, Plot).
That led to a wrong "these counters don't exist" conclusion. Committing the current
rules here prevents that class of error.

## Status

✅ **Rules committed (V 7.0, 3/6/26).** The deferred keywords
(Bounty/Exploit/Smuggle/Piloting/Plot) and the Twin Suns counters can now be
verified against source. When FFG publishes a newer version, replace the PDF,
regenerate the `.txt`, re-extract Section 12 into `twin-suns-insert.md`, and bump
the version stamps in this README and the insert.
