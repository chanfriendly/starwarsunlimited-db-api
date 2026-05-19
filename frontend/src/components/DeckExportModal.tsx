'use client';

import React, { useMemo, useState } from 'react';
import { SavedDeck, CollectionItem, Card } from '@/lib/api';

interface Props {
  deck: SavedDeck;
  collection?: CollectionItem[];
  onClose: () => void;
}

interface CardRow {
  cardId: string;
  name: string;
  price_usd?: number;
  tcgUrl: string;
  ckUrl: string;
}

interface MissingRow extends CardRow {
  needQuantity: number;
}

function buildTcgUrl(name: string) {
  return `https://www.tcgplayer.com/search/star-wars-unlimited/product?productLineName=star-wars-unlimited&q=${encodeURIComponent(name)}&view=grid`;
}
function buildCkUrl(name: string) {
  return `https://www.cardkingdom.com/catalog/search?search=NM&filter[name]=${encodeURIComponent(name)}&filter[game]=swu`;
}

// Format: "Name - Subtitle [SET]" — subtitle only when present, set code only when available.
// Matches TCGPlayer's expected import format.
function cardLine(card: Card): string {
  const subtitle = card.subtitle ? ` - ${card.subtitle}` : '';
  const setTag = card.set_code ? ` [${card.set_code}]` : '';
  return `${card.name}${subtitle}${setTag}`;
}

function buildTextExport(deck: SavedDeck): string {
  const totalMain = deck.cards.reduce((s, i) => s + i.quantity, 0);

  const allPriced = [
    ...deck.cards.map(i => ({ card: i.card, qty: i.quantity })),
    ...deck.leaders.map(l => ({ card: l, qty: 1 })),
    ...(deck.base ? [{ card: deck.base, qty: 1 }] : []),
  ];
  const priceTotal = allPriced.reduce((s, { card, qty }) => s + (card.price_usd ?? 0) * qty, 0);
  const hasPrices = allPriced.some(({ card }) => card.price_usd != null);

  const grouped: Record<string, typeof deck.cards> = { Unit: [], Event: [], Upgrade: [], Other: [] };
  deck.cards.forEach(item => {
    const t = (item.card.type ?? '').toLowerCase();
    if (t.includes('unit')) grouped.Unit.push(item);
    else if (t.includes('event')) grouped.Event.push(item);
    else if (t.includes('upgrade')) grouped.Upgrade.push(item);
    else grouped.Other.push(item);
  });

  const lines: string[] = [];
  lines.push(`=== ${deck.name} ===`);
  lines.push('');

  lines.push('LEADERS:');
  deck.leaders.forEach(l => lines.push(`1 ${cardLine(l)}`));
  lines.push('');

  lines.push('BASE:');
  if (deck.base) lines.push(`1 ${cardLine(deck.base)}`);
  lines.push('');

  lines.push(`MAIN DECK (${totalMain} cards):`);
  (['Unit', 'Event', 'Upgrade', 'Other'] as const).forEach(section => {
    grouped[section]
      .sort(
        (a, b) =>
          (a.card.energy_cost ?? 0) - (b.card.energy_cost ?? 0) ||
          a.card.name.localeCompare(b.card.name)
      )
      .forEach(({ card, quantity }) => {
        lines.push(`${quantity} ${cardLine(card)}`);
      });
  });

  if (hasPrices) {
    lines.push('');
    lines.push(`Total Value: ~$${priceTotal.toFixed(2)}`);
  }

  return lines.join('\n');
}

function buildCardRows(deck: SavedDeck): CardRow[] {
  const seen = new Set<string>();
  const rows: CardRow[] = [];
  const push = (card: Card) => {
    if (seen.has(card.id)) return;
    seen.add(card.id);
    rows.push({ cardId: card.id, name: card.name, price_usd: card.price_usd, tcgUrl: buildTcgUrl(card.name), ckUrl: buildCkUrl(card.name) });
  };
  deck.leaders.forEach(push);
  if (deck.base) push(deck.base);
  deck.cards.forEach(({ card }) => push(card));
  return rows;
}

function computeMissing(deck: SavedDeck, collection: CollectionItem[]): MissingRow[] {
  const owned = new Map(collection.map(ci => [ci.card.id, ci.count]));
  return deck.cards
    .filter(({ card, quantity }) => (owned.get(card.id) ?? 0) < quantity)
    .map(({ card, quantity }) => ({
      cardId: card.id,
      name: card.name,
      price_usd: card.price_usd,
      needQuantity: quantity - (owned.get(card.id) ?? 0),
      tcgUrl: buildTcgUrl(card.name),
      ckUrl: buildCkUrl(card.name),
    }));
}

function MarketplaceRow({ row, prefix }: { row: CardRow & { needQuantity?: number }; prefix?: React.ReactNode }) {
  return (
    <div style={{
      display: 'flex', gap: 8, alignItems: 'center',
      padding: '6px 0', borderBottom: '1px solid var(--ts-line)',
      fontFamily: 'var(--ts-font-mono)', fontSize: 10,
    }}>
      {prefix}
      <span style={{ flex: 1, color: 'var(--ts-ink-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.name}</span>
      {row.price_usd != null && (
        <span style={{ color: 'var(--ts-amber)', flexShrink: 0 }}>
          ${(row.price_usd * (row.needQuantity ?? 1)).toFixed(2)}
        </span>
      )}
      <a
        href={row.tcgUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="ts-btn ts-btn-sm"
        style={{ textDecoration: 'none', fontSize: 8, padding: '3px 7px', flexShrink: 0 }}
      >
        TCGPlayer
      </a>
      <a
        href={row.ckUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="ts-btn ts-btn-sm"
        style={{ textDecoration: 'none', fontSize: 8, padding: '3px 7px', flexShrink: 0 }}
      >
        Card Kingdom
      </a>
    </div>
  );
}

export function DeckExportModal({ deck, collection, onClose }: Props) {
  const [copied, setCopied] = useState(false);

  const textExport = useMemo(() => buildTextExport(deck), [deck]);
  const cardRows = useMemo(() => buildCardRows(deck), [deck]);
  const missingRows = useMemo(
    () => (collection ? computeMissing(deck, collection) : []),
    [deck, collection]
  );

  async function handleCopy() {
    await navigator.clipboard.writeText(textExport);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  const missingTotal = missingRows.reduce((s, r) => s + (r.price_usd ?? 0) * r.needQuantity, 0);

  return (
    <div className="ts-modal-backdrop" onClick={onClose}>
      <div className="ts-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 780 }}>
        {/* Header */}
        <div style={{
          padding: '16px 24px',
          borderBottom: '1px solid var(--ts-line)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <div>
            <div className="ts-eyebrow" style={{ marginBottom: 4 }}>Export</div>
            <div style={{ fontFamily: 'var(--ts-font-display)', fontSize: 24, color: 'var(--ts-ink)' }}>
              {deck.name}
            </div>
          </div>
          <button className="ts-btn ts-btn-sm" onClick={onClose}>✕ Close</button>
        </div>

        <div style={{ padding: '24px 24px 32px', display: 'flex', flexDirection: 'column', gap: 28 }}>
          {/* Section 1 — Text deck list */}
          <div>
            <div className="ts-eyebrow" style={{ marginBottom: 10 }}>Deck List</div>
            <pre style={{
              fontFamily: 'var(--ts-font-mono)', fontSize: 10, lineHeight: 1.9,
              background: 'var(--ts-bg-2)', border: '1px solid var(--ts-line)',
              padding: '14px 16px', overflowX: 'auto',
              color: 'var(--ts-ink-2)', whiteSpace: 'pre-wrap', wordBreak: 'break-word',
              maxHeight: 300, overflowY: 'auto',
            }}>
              {textExport}
            </pre>
            <button
              className={`ts-btn ts-btn-sm${copied ? ' ts-btn-primary' : ''}`}
              style={{ marginTop: 10 }}
              onClick={handleCopy}
            >
              {copied ? '✓ Copied to Clipboard' : 'Copy to Clipboard'}
            </button>
          </div>

          {/* Section 2 — Find cards */}
          <div>
            <div className="ts-eyebrow" style={{ marginBottom: 10 }}>Find Cards</div>
            <div style={{ maxHeight: 300, overflowY: 'auto' }}>
              {cardRows.map(row => (
                <MarketplaceRow key={row.cardId} row={row} />
              ))}
            </div>
          </div>

          {/* Section 3 — Buy what you're missing */}
          {collection !== undefined && (
            <div>
              <div className="ts-eyebrow" style={{ marginBottom: 10 }}>
                {missingRows.length > 0
                  ? `Buy What You're Missing (${missingRows.length} card${missingRows.length === 1 ? '' : 's'})`
                  : "Buy What You're Missing"}
              </div>
              {missingRows.length === 0 ? (
                <div style={{ fontFamily: 'var(--ts-font-mono)', fontSize: 11, color: 'var(--ts-green)' }}>
                  ✓ You own all the cards in this deck.
                </div>
              ) : (
                <>
                  <div style={{ maxHeight: 240, overflowY: 'auto' }}>
                    {missingRows.map(row => (
                      <MarketplaceRow
                        key={row.cardId}
                        row={row}
                        prefix={
                          <span style={{ color: 'var(--ts-red)', flexShrink: 0, minWidth: 48 }}>
                            need {row.needQuantity}×
                          </span>
                        }
                      />
                    ))}
                  </div>
                  {missingTotal > 0 && (
                    <div style={{
                      marginTop: 10,
                      fontFamily: 'var(--ts-font-mono)', fontSize: 10,
                      color: 'var(--ts-amber)',
                    }}>
                      Est. missing value: ~${missingTotal.toFixed(2)}
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
