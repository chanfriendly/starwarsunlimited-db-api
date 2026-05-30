// Tier-1 coverage report. Run: cd frontend && npm run coverage-report
//
// Reads every card from databases/swu_cards.db, runs the template matcher,
// validates the AST it emits, and prints:
//   - coverage breakdown (vanilla / full / partial / none) overall + by type
//   - any cards where the matcher emitted INVALID ast (a matcher bug)
//   - the most common UNMATCHED clause shapes (normalized), so the next
//     templates / engine primitives to build are obvious from the data.
//
// This is the number that right-sizes Tier 2 (the local model): if Tier 1 +
// vanilla already covers most cards, the model only fights the long tail.

import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { matchCard, type Coverage } from './match';
import { validateCardSpec } from '../engine-v2';
import type { CardSpec } from '../engine-v2';

interface Row { id: string; name: string; type: string; text: string | null }

/** Resolve swu_cards.db. Honors DB_DIR (project convention); otherwise probes
 *  the repo-root `databases/` (when run from frontend/ via npm) and ./databases. */
function resolveDb(): string {
  const candidates = [
    process.env.DB_DIR && path.join(process.env.DB_DIR, 'swu_cards.db'),
    path.resolve(process.cwd(), 'databases/swu_cards.db'),
    path.resolve(process.cwd(), '../databases/swu_cards.db'),
  ].filter(Boolean) as string[];
  const found = candidates.find(p => existsSync(p));
  if (!found) throw new Error(`swu_cards.db not found. Tried:\n  ${candidates.join('\n  ')}`);
  return found;
}

const DB = resolveDb();

function loadCards(): Row[] {
  const out = execFileSync('sqlite3', ['-json', DB, 'SELECT id, name, type, text FROM cards;'], {
    encoding: 'utf8', maxBuffer: 64 * 1024 * 1024,
  });
  return JSON.parse(out) as Row[];
}

// Normalize an unmatched clause so similar ones tally together: lowercase,
// digits → N, collapse whitespace, trim, cap length.
function normalize(clause: string): string {
  return clause.toLowerCase().replace(/\d+/g, 'N').replace(/\s+/g, ' ').trim().slice(0, 80);
}

function main() {
  const rows = loadCards();

  // Deckable card types the matcher targets. Tokens/credit/force are engine-
  // generated, not authored from text here.
  const DECKABLE = new Set(['unit', 'event', 'upgrade', 'leader']);

  const byType: Record<string, Record<Coverage, number>> = {};
  const overall: Record<Coverage, number> = { vanilla: 0, full: 0, partial: 0, none: 0 };
  const residualTally = new Map<string, number>();
  const invalidAst: { name: string; errors: string[] }[] = [];
  let considered = 0;

  for (const r of rows) {
    const type = (r.type ?? '').toLowerCase();
    if (!DECKABLE.has(type)) continue;
    considered++;

    const res = matchCard({ name: r.name, type: r.type, text: r.text });
    byType[type] ??= { vanilla: 0, full: 0, partial: 0, none: 0 };
    byType[type][res.coverage]++;
    overall[res.coverage]++;

    for (const clause of res.residual) {
      const n = normalize(clause);
      residualTally.set(n, (residualTally.get(n) ?? 0) + 1);
    }

    // Validate emitted abilities by wrapping in a throwaway spec.
    if (res.abilities.length > 0) {
      const probe: CardSpec = {
        id: r.id, name: r.name, type: 'unit', arena: 'ground', power: 1, hp: 1,
        abilities: res.abilities,
      } as CardSpec;
      const v = validateCardSpec(probe);
      if (!v.ok) invalidAst.push({ name: r.name, errors: v.errors.map(e => `${e.path}: ${e.message}`) });
    }
  }

  // ── Print ────────────────────────────────────────────────────────────────
  const pct = (n: number) => `${((n / considered) * 100).toFixed(1)}%`;
  const playable = overall.vanilla + overall.full;

  console.log(`\n=== Tier-1 coverage over ${considered} deckable cards (of ${rows.length} total) ===\n`);
  console.log(`  vanilla (no text / keyword-only): ${overall.vanilla}  ${pct(overall.vanilla)}`);
  console.log(`  full    (all clauses matched):    ${overall.full}  ${pct(overall.full)}`);
  console.log(`  partial (some clauses matched):   ${overall.partial}  ${pct(overall.partial)}`);
  console.log(`  none    (text, nothing matched):  ${overall.none}  ${pct(overall.none)}`);
  console.log(`  ----------------------------------------------------`);
  console.log(`  fully playable (vanilla+full):    ${playable}  ${pct(playable)}`);
  console.log(`  needs work (partial+none):        ${overall.partial + overall.none}  ${pct(overall.partial + overall.none)}`);

  console.log(`\n=== by card type ===`);
  for (const [type, c] of Object.entries(byType)) {
    const tot = c.vanilla + c.full + c.partial + c.none;
    console.log(`  ${type.padEnd(8)} n=${String(tot).padStart(4)}  vanilla ${c.vanilla}  full ${c.full}  partial ${c.partial}  none ${c.none}  →  ${(((c.vanilla + c.full) / tot) * 100).toFixed(0)}% playable`);
  }

  console.log(`\n=== AST validity: ${invalidAst.length} card(s) emitted INVALID ast ===`);
  for (const bad of invalidAst.slice(0, 15)) console.log(`  ❌ ${bad.name}: ${bad.errors[0]}`);
  if (invalidAst.length === 0) console.log(`  ✅ every matched ability validated clean`);

  console.log(`\n=== top 30 unmatched clause shapes (digits→N) ===`);
  const sorted = [...residualTally.entries()].sort((a, b) => b[1] - a[1]).slice(0, 30);
  for (const [clause, n] of sorted) console.log(`  ${String(n).padStart(4)}  ${clause}`);

  console.log('');
}

main();
