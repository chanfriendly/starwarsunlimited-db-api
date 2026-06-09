// Real-card → engine-v2 spec translator.
//
// The backend serves cards in the v1 `Card` shape (db_helpers.card_to_dict +
// enrich_card_with_relationships): Title-Case `type`, `aspects[].aspect_name`,
// name-only `keywords[]`, `traits[]`, `arenas[]`, plus `energy_cost`/`cost`,
// `attack`/`health`, free-text `text`.
//
// engine-v2 wants declarative `CardSpec`/`BaseSpec` in a `CardRegistry`. This
// module maps the *structured* half of a card — stats, aspects, traits, arena,
// and keywords — into a playable spec. The *unstructured* half (rules `text` →
// ability AST) is the L4 problem from ENGINE_DESIGN.md and is NOT attempted
// here: every translated card gets `abilities: []`. So a real deck loads and
// plays with correct stats and working keywords (Grit/Sentinel/Saboteur/
// Shielded/Ambush/Raid/Restore/Overwhelm), but card *text* effects are inert
// until the LLM cascade lands.
//
// The one bit of text parsing done here is deliberately narrow: pulling the
// numeric value out of "Raid N" / "Restore N" (the SWU API exposes these
// keywords by name only; the value lives in the rules text). That's a bounded,
// deterministic regex, not ability parsing.

import type { Card, SavedDeck } from '@/lib/api';
import type {
  CardRegistry, GameConfig, PlayerId,
} from '@/lib/engine-v2';
import type {
  AspectIcon, BaseSpec, CardSpec, KeywordRef, LeaderSpec, UnitSpec, UpgradeSpec, EventSpec,
} from '@/lib/engine-v2';
import { matchCard } from './match';

// ---------------------------------------------------------------------------
// Field normalizers
// ---------------------------------------------------------------------------

const VALID_ASPECTS = new Set<AspectIcon>([
  'villainy', 'heroism', 'command', 'aggression', 'vigilance', 'cunning',
]);

// v2 keyword registry keys (the ones with real engine behavior). Names not in
// this set still translate — they're just inert until implemented.
const VALUE_KEYWORDS = new Set(['raid', 'restore', 'exploit', 'smuggle']);

/** Default deployed-unit stats for a leader whose attack/health are NULL in the
 *  DB (common — the SWU API often omits the unit-side stats). Mirrors the v1
 *  `LEADER_DEPLOYED_STATS` 3/6 fallback. */
const LEADER_FALLBACK_POWER = 3;
const LEADER_FALLBACK_HP = 6;
const BASE_FALLBACK_HP = 30;

export function normalizeType(raw: string | undefined): CardSpec['type'] | 'base' | 'unknown' {
  switch ((raw ?? '').trim().toLowerCase()) {
    case 'unit':    return 'unit';
    case 'event':   return 'event';
    case 'upgrade': return 'upgrade';
    case 'leader':  return 'leader';
    case 'base':    return 'base';
    case 'token':   return 'token';
    default:        return 'unknown';
  }
}

export function normalizeAspects(card: Card): AspectIcon[] {
  const out: AspectIcon[] = [];
  for (const a of card.aspects ?? []) {
    const name = a.aspect_name?.trim().toLowerCase() as AspectIcon | undefined;
    if (name && VALID_ASPECTS.has(name) && !out.includes(name)) out.push(name);
  }
  return out;
}

export function normalizeArena(card: Card): 'ground' | 'space' {
  for (const a of card.arenas ?? []) {
    const v = a.trim().toLowerCase();
    if (v === 'space') return 'space';
    if (v === 'ground') return 'ground';
  }
  // Default ground — every SWU unit has exactly one arena, but be defensive.
  return 'ground';
}

export function normalizeTraits(card: Card): string[] {
  return (card.traits ?? []).map(t => t.trim().toLowerCase()).filter(Boolean);
}

function costOf(card: Card): number {
  return card.energy_cost ?? card.cost ?? 0;
}

/** Parse a keyword's numeric value. The keyword string is name-only ("Raid"),
 *  so the N comes from the rules text ("Raid 2."). Defensive: also handles a
 *  value baked into the keyword string itself ("Raid 2"). */
function keywordValue(name: string, keywordRaw: string, text: string | undefined): number | undefined {
  // Smuggle's value is a bracketed cost — "Smuggle [9 resources …]" — so the N
  // comes after "[", not a bare "Smuggle 9". (We take the leading resource count;
  // aspect penalties + additional bracket costs aren't modeled — consistent with
  // the engine ignoring aspect penalties for normal play too.)
  if (name.toLowerCase() === 'smuggle' && text) {
    const m = text.match(/Smuggle\s*\[\s*(\d+)/i);
    if (m) return parseInt(m[1], 10);
    return undefined;
  }
  // (a) value inline in the keyword string
  const inline = keywordRaw.match(/(\d+)\s*$/);
  if (inline) return parseInt(inline[1], 10);
  // (b) value in the rules text, e.g. "Raid 2"
  if (text) {
    const re = new RegExp(`\\b${name}\\s+(\\d+)\\b`, 'i');
    const m = text.match(re);
    if (m) return parseInt(m[1], 10);
  }
  return undefined;
}

export function parseKeywords(card: Card): KeywordRef[] {
  const out: KeywordRef[] = [];
  for (const raw of card.keywords ?? []) {
    // Strip any trailing number so the name is clean; capture it separately.
    const namePart = raw.replace(/\s*\d+\s*$/, '').trim();
    const name = namePart.toLowerCase();
    if (!name) continue;
    const ref: KeywordRef = { name };
    if (VALUE_KEYWORDS.has(name)) {
      const v = keywordValue(namePart, raw, card.text);
      if (v !== undefined) ref.value = v;
    }
    out.push(ref);
  }
  // "While attacking, this unit deals combat damage before the defender" is
  // printed ability text, not a DB keyword (§1618c / §7.5.6d). Detect it with a
  // narrow regex (like the Raid/Restore value parsing above) and surface it as
  // the internal marker keyword the combat core reads. See keywords/combat_first.
  if (card.text && /deals combat damage before the defender|deals combat damage first/i.test(card.text)) {
    if (!out.some(k => k.name === 'attacker_combat_first')) out.push({ name: 'attacker_combat_first' });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Card → spec
// ---------------------------------------------------------------------------

export interface TranslateResult {
  /** A CardSpec to register under registry.cards, OR */
  spec?: CardSpec;
  /** A BaseSpec to register under registry.bases. Exactly one of spec/base set. */
  base?: BaseSpec;
  /** Set when the card type couldn't be mapped (e.g. token in a deck). */
  skipped?: { id: string; reason: string };
}

export function translateCard(card: Card): TranslateResult {
  const type = normalizeType(card.type);
  const id = card.id;
  const common = {
    id,
    name: card.name,
    subtitle: card.subtitle ?? null,
    cost: costOf(card),
    aspects: normalizeAspects(card),
    traits: normalizeTraits(card),
    // Uniqueness (rule-of-one). The DB column `is_unique` flows through to the
    // frontend Card; map it onto the spec so state_based.ts enforces it for real
    // translated decks. Absent/false → not unique.
    unique: Boolean(card.is_unique),
    // Printed oracle text — carried through for UI display (playtest card-hover
    // preview). Inert to the engine.
    text: card.text ?? null,
  };

  // Tier-1 template matcher: rules text → ability AST. Returns [] for cards the
  // matcher doesn't recognize (they play inert until Tier 2 / hand-authoring).
  const matched = matchCard({ name: card.name, type: card.type, text: card.text ?? undefined, keywords: card.keywords });

  switch (type) {
    case 'unit': {
      const spec: UnitSpec = {
        ...common,
        type: 'unit',
        arena: normalizeArena(card),
        power: card.attack ?? 0,
        hp: card.health ?? 1,
        keywords: parseKeywords(card),
        abilities: matched.abilities,
      };
      return { spec };
    }
    case 'event': {
      const spec: EventSpec = { ...common, type: 'event', abilities: matched.abilities, keywords: parseKeywords(card) };
      return { spec };
    }
    case 'upgrade': {
      const spec: UpgradeSpec = {
        ...common,
        type: 'upgrade',
        powerModifier: card.attack ?? 0,
        hpModifier: card.health ?? 0,
        keywords: parseKeywords(card),
        abilities: matched.abilities,
      };
      return { spec };
    }
    case 'leader': {
      // A leader has two ability sources in the DB:
      //   • `text`       — the leader-side (un-deployed) abilities  → leaderAbilities
      //   • `deploy_box` — the deployed leader-UNIT abilities         → leaderUnitAbilities
      // The deployed unit side parses like a unit (On Attack / When Played /
      // constant / action), so run the matcher over deploy_box as a unit.
      const deployMatch = matchCard({
        name: card.name,
        type: 'unit',
        text: card.deploy_box ?? undefined,
        keywords: card.keywords,
      });
      const spec: LeaderSpec = {
        ...common,
        type: 'leader',
        arena: normalizeArena(card),
        power: card.attack ?? LEADER_FALLBACK_POWER,
        hp: card.health ?? LEADER_FALLBACK_HP,
        leaderAbilities: matched.abilities,
        leaderUnitAbilities: deployMatch.abilities,
      };
      return { spec };
    }
    case 'base': {
      const base: BaseSpec = {
        id,
        name: card.name,
        type: 'base',
        hp: card.health ?? BASE_FALLBACK_HP,
        aspects: normalizeAspects(card),
        traits: normalizeTraits(card),
        abilities: [],
      };
      return { base };
    }
    case 'token':
      return { skipped: { id, reason: 'tokens are engine-generated, not deckable' } };
    default:
      return { skipped: { id, reason: `unmapped card type "${card.type}"` } };
  }
}

export function translateBase(card: Card): BaseSpec {
  const r = translateCard(card);
  if (r.base) return r.base;
  // Forced base translation for a card the deck designates as base even if its
  // `type` field is off — use HP from health with the standard fallback.
  return {
    id: card.id,
    name: card.name,
    type: 'base',
    hp: card.health ?? BASE_FALLBACK_HP,
    aspects: normalizeAspects(card),
    traits: normalizeTraits(card),
    abilities: [],
  };
}

// ---------------------------------------------------------------------------
// Deck → GameConfig + registry
// ---------------------------------------------------------------------------

export interface BuildGameOptions {
  gameId?: string;
  p1Name?: string;
  p2Name?: string;
  /** Collects diagnostics (skipped cards, fallbacks) for surfacing in the UI. */
  onWarn?: (msg: string) => void;
}

export interface BuiltGame {
  config: GameConfig;
  registry: CardRegistry;
  /** Non-fatal issues encountered while translating (skipped cards, etc.). */
  warnings: string[];
}

/** Translate two saved decks into a complete, playable engine-v2 game:
 *  a CardRegistry covering every card across both decks plus a GameConfig
 *  with per-player DeckConfigs. Throws only on unrecoverable problems (a deck
 *  with no base). */
export function buildGameFromDecks(
  p1Deck: SavedDeck,
  p2Deck: SavedDeck,
  opts: BuildGameOptions = {},
): BuiltGame {
  const registry: CardRegistry = { cards: {}, bases: {} };
  const warnings: string[] = [];
  const warn = (m: string) => { warnings.push(m); opts.onWarn?.(m); };

  const registerCard = (card: Card): boolean => {
    if (registry.cards[card.id]) return true; // already translated
    const r = translateCard(card);
    if (r.spec) { registry.cards[card.id] = r.spec; return true; }
    if (r.base) { registry.bases[card.id] = r.base; return true; }
    if (r.skipped) warn(`Skipped ${card.name} (${card.id}): ${r.skipped.reason}`);
    return false;
  };

  const buildOne = (deck: SavedDeck, pid: PlayerId, displayName: string) => {
    if (!deck.base) throw new Error(`Deck "${deck.name}" has no base — cannot start a game.`);

    // Base
    registry.bases[deck.base.id] = translateBase(deck.base);
    const baseId = deck.base.id;

    // Leaders (1–2). Translate into registry.cards as type:'leader'.
    const leaderIds: string[] = [];
    for (const l of deck.leaders ?? []) {
      const r = translateCard(l);
      if (r.spec && r.spec.type === 'leader') {
        registry.cards[l.id] = r.spec;
        leaderIds.push(l.id);
      } else {
        warn(`Leader ${l.name} (${l.id}) did not translate as a leader — skipping.`);
      }
    }

    // Deck cards — expand by quantity, exclude any leader/base that leaked in.
    const excluded = new Set<string>([baseId, ...leaderIds]);
    const deckCardIds: string[] = [];
    for (const entry of deck.cards ?? []) {
      const card = entry.card;
      if (excluded.has(card.id)) continue;
      const ok = registerCard(card);
      if (!ok) continue; // skipped (e.g. token); diagnostic already logged
      for (let i = 0; i < entry.quantity; i++) deckCardIds.push(card.id);
    }

    if (deckCardIds.length === 0) {
      warn(`Deck "${deck.name}" expanded to 0 playable cards.`);
    }

    return { playerId: pid, displayName, baseId, deckCardIds, leaderIds };
  };

  const config: GameConfig = {
    gameId: opts.gameId ?? `realdeck-${Date.now()}`,
    players: [
      buildOne(p1Deck, 'p1', opts.p1Name ?? 'You'),
      buildOne(p2Deck, 'p2', opts.p2Name ?? 'Opponent'),
    ],
  };

  return { config, registry, warnings };
}
