// Per-deck coverage report. Run:
//   cd frontend && npm run deck-coverage -- /path/to/decklist.txt
//
// Parses a standard SWU decklist (LEADERS / BASE / MAIN DECK sections, lines
// like "1 Name - Subtitle [SET]"), looks each card up in swu_cards.db, runs
// the Tier-1 matcher, and reports per-card coverage + a themed tally of what
// the not-yet-covered cards need. This is the "decks I play to 100% first"
// instrument: it turns a decklist into a precise build list.

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { matchCard, type Coverage } from './match';

interface DBCard { id: string; name: string; subtitle: string; type: string; text: string | null }
interface DeckEntry { count: number; name: string; subtitle?: string; set?: string }

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

function sql(q: string): DBCard[] {
  const out = execFileSync('sqlite3', ['-json', DB, q], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  return out.trim() ? (JSON.parse(out) as DBCard[]) : [];
}
function esc(s: string) { return s.replace(/'/g, "''"); }

// ── Decklist parsing ───────────────────────────────────────────────────────

function parseDeck(text: string): DeckEntry[] {
  const entries: DeckEntry[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    const m = line.match(/^(\d+)\s+(.+?)(?:\s+\[([A-Za-z0-9]+)\])?$/);
    if (!m) continue;                       // section headers, blanks
    const count = parseInt(m[1], 10);
    let name = m[2].trim();
    const set = m[3];
    let subtitle: string | undefined;
    const dash = name.indexOf(' - ');        // SWU subtitle separator
    if (dash >= 0) { subtitle = name.slice(dash + 3).trim(); name = name.slice(0, dash).trim(); }
    entries.push({ count, name, subtitle, set });
  }
  return entries;
}

// ── Lookup: name (+ prefer subtitle, then set) ─────────────────────────────

function lookup(e: DeckEntry): DBCard | undefined {
  const rows = sql(`SELECT id,name,COALESCE(subtitle,'') AS subtitle,type,text FROM cards WHERE name='${esc(e.name)}';`);
  if (rows.length === 0) return undefined;
  if (e.subtitle) {
    const bySub = rows.find(r => r.subtitle.toLowerCase() === e.subtitle!.toLowerCase());
    if (bySub) return bySub;
  }
  // No subtitle match — fall back to first (reprints share text).
  return rows[0];
}

// ── Theme tally for residual clauses (what primitives are needed) ───────────

const THEMES: { label: string; re: RegExp }[] = [
  { label: 'Experience token', re: /experience token/i },
  { label: 'Force token / use the Force', re: /\bforce token\b|use the force/i },
  { label: 'return to hand (bounce)', re: /return .* to (its|their) owner's hand|return .* to your hand/i },
  { label: 'shield token', re: /shield token/i },
  { label: 'modal (choose one/two)', re: /choose (one|two)/i },
  { label: 'capture', re: /\bcapture(s|d)?\b/i },
  { label: 'take control', re: /take control/i },
  { label: 'discard from hand/deck', re: /discard(s)? .*(card|hand|deck)/i },
  { label: 'heal', re: /\bheal\b/i },
  { label: 'search/look at deck', re: /search the top|look at the top/i },
  { label: 'conditional "if you control/there are"', re: /if (you control|there (are|is))/i },
  { label: 'When Defeated', re: /when defeated/i },
  { label: 'When Played', re: /when played/i },
  { label: 'On Attack', re: /on attack/i },
];

function themesFor(residual: string[]): string[] {
  const hits = new Set<string>();
  for (const clause of residual) for (const t of THEMES) if (t.re.test(clause)) hits.add(t.label);
  return [...hits];
}

// ── Main ────────────────────────────────────────────────────────────────────

function main() {
  const file = process.argv[2];
  if (!file) { console.error('usage: deck-coverage -- <decklist.txt>'); process.exit(2); }
  const deck = parseDeck(readFileSync(file, 'utf8'));

  const tally: Record<Coverage, number> = { vanilla: 0, full: 0, partial: 0, none: 0 };
  const notFound: string[] = [];
  const needWork: { name: string; type: string; residual: string[]; themes: string[] }[] = [];
  const themeCounts = new Map<string, number>();

  console.log(`\n=== Per-card coverage: ${deck.length} distinct cards ===\n`);
  for (const e of deck) {
    const card = lookup(e);
    if (!card) { notFound.push(`${e.name}${e.subtitle ? ' - ' + e.subtitle : ''}${e.set ? ' [' + e.set + ']' : ''}`); console.log(`  ❔ NOT FOUND  ${e.name}`); continue; }
    const r = matchCard({ name: card.name, type: card.type, text: card.text });
    tally[r.coverage]++;
    const sym = r.coverage === 'vanilla' ? '▫️' : r.coverage === 'full' ? '✅' : r.coverage === 'partial' ? '🟡' : '❌';
    console.log(`  ${sym} ${r.coverage.padEnd(7)} ${card.name}${card.subtitle ? ' — ' + card.subtitle : ''}  [${card.type}]`);
    if (r.coverage === 'partial' || r.coverage === 'none') {
      const themes = themesFor(r.residual);
      needWork.push({ name: card.name, type: card.type, residual: r.residual, themes });
      for (const t of themes) themeCounts.set(t, (themeCounts.get(t) ?? 0) + 1);
    }
  }

  const playable = tally.vanilla + tally.full;
  const found = deck.length - notFound.length;
  console.log(`\n=== Summary ===`);
  console.log(`  found in DB: ${found}/${deck.length}   not found: ${notFound.length}`);
  console.log(`  playable now (vanilla+full): ${playable}/${found}  (${found ? ((playable / found) * 100).toFixed(0) : 0}%)`);
  console.log(`  needs work (partial+none):   ${tally.partial + tally.none}/${found}`);
  console.log(`    vanilla ${tally.vanilla} · full ${tally.full} · partial ${tally.partial} · none ${tally.none}`);

  if (notFound.length) { console.log(`\n=== not found in card DB (custom / name mismatch) ===`); notFound.forEach(n => console.log(`  ${n}`)); }

  console.log(`\n=== what the not-yet-covered cards need (theme → # cards) ===`);
  [...themeCounts.entries()].sort((a, b) => b[1] - a[1]).forEach(([t, n]) => console.log(`  ${String(n).padStart(3)}  ${t}`));

  console.log(`\n=== needs-work detail ===`);
  for (const w of needWork) {
    console.log(`  ${w.name} [${w.type}]${w.themes.length ? '  {' + w.themes.join(', ') + '}' : ''}`);
    for (const c of w.residual) console.log(`        · ${c}`);
  }
  console.log('');
}

main();
