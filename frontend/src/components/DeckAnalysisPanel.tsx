'use client';

import React, { useMemo } from 'react';
import { SavedDeck } from '@/lib/api';

interface Props {
  deck: SavedDeck;
}

interface Analysis {
  curve: number[];
  curveMax: number;
  typeCounts: Record<string, number>;
  totalCards: number;
  uniqueCards: number;
  avgCost: string;
  rarityCounts: Record<string, number>;
  aspectCounts: Record<string, number>;
  priceTotal: number;
  pricedCount: number;
  totalCount: number;
}

function computeAnalysis(deck: SavedDeck): Analysis {
  const entries = deck.cards;

  // Cost curve — 8 buckets: 0,1,2,3,4,5,6,7+
  const curve = Array(8).fill(0);
  entries.forEach(({ card, quantity }) => {
    const cost = card.energy_cost ?? 0;
    curve[Math.min(cost, 7)] += quantity;
  });
  const curveMax = Math.max(...curve, 1);

  // Type breakdown
  const typeCounts: Record<string, number> = { Unit: 0, Event: 0, Upgrade: 0, Other: 0 };
  entries.forEach(({ card, quantity }) => {
    const t = (card.type ?? '').toLowerCase();
    if (t.includes('unit')) typeCounts.Unit += quantity;
    else if (t.includes('event')) typeCounts.Event += quantity;
    else if (t.includes('upgrade')) typeCounts.Upgrade += quantity;
    else typeCounts.Other += quantity;
  });

  const totalCards = entries.reduce((s, i) => s + i.quantity, 0);
  const uniqueCards = entries.length;

  // Weighted average cost
  const weightedCostSum = entries.reduce(
    (s, { card, quantity }) => s + (card.energy_cost ?? 0) * quantity,
    0
  );
  const avgCost = totalCards > 0 ? (weightedCostSum / totalCards).toFixed(2) : '—';

  // Rarity counts (weighted)
  const rarityCounts: Record<string, number> = {};
  entries.forEach(({ card, quantity }) => {
    const r = card.rarity ?? 'Unknown';
    rarityCounts[r] = (rarityCounts[r] ?? 0) + quantity;
  });

  // Aspect distribution (weighted)
  const aspectCounts: Record<string, number> = {};
  entries.forEach(({ card, quantity }) => {
    card.aspects?.forEach(a => {
      aspectCounts[a.aspect_name] = (aspectCounts[a.aspect_name] ?? 0) + quantity;
    });
  });

  // Price total — leaders + base + main deck
  const allEntries = [
    ...entries,
    ...deck.leaders.map(l => ({ card: l, quantity: 1 })),
    ...(deck.base ? [{ card: deck.base, quantity: 1 }] : []),
  ];
  let priceTotal = 0;
  let pricedCount = 0;
  let totalCount = 0;
  allEntries.forEach(({ card, quantity }) => {
    totalCount += quantity;
    if (card.price_usd != null) {
      priceTotal += card.price_usd * quantity;
      pricedCount += quantity;
    }
  });

  return { curve, curveMax, typeCounts, totalCards, uniqueCards, avgCost, rarityCounts, aspectCounts, priceTotal, pricedCount, totalCount };
}

const ASPECT_ORDER = ['Heroism', 'Villainy', 'Command', 'Aggression', 'Cunning', 'Vigilance'];
const TYPE_COLORS: Record<string, string> = {
  Unit: 'var(--ts-amber)',
  Event: 'var(--ts-blue)',
  Upgrade: 'var(--ts-green)',
  Other: 'var(--ts-ink-3)',
};
const RARITY_ORDER = ['Common', 'Uncommon', 'Rare', 'Legendary', 'Special'];

export function DeckAnalysisPanel({ deck }: Props) {
  const a = useMemo(() => computeAnalysis(deck), [deck]);

  const typeTotal = Object.values(a.typeCounts).reduce((s, n) => s + n, 0);

  return (
    <div style={{ marginTop: 48 }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20,
        paddingBottom: 12, borderBottom: '1px solid var(--ts-line)',
      }}>
        <div className="ts-eyebrow">Deck Analysis</div>
        <div style={{ flex: 1, borderBottom: '1px dotted var(--ts-line-2)' }} />
      </div>

      {/* Stats line */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 28 }}>
        {[
          `${a.totalCards} cards`,
          `${a.uniqueCards} unique`,
          `avg cost ${a.avgCost}`,
          a.pricedCount > 0
            ? `~$${a.priceTotal.toFixed(2)}${a.pricedCount < a.totalCount ? ` (${a.pricedCount}/${a.totalCount} priced)` : ''}`
            : 'no price data',
        ].map(label => (
          <span key={label} className="ts-chip" style={{
            color: label.startsWith('~$') ? 'var(--ts-amber)' : 'var(--ts-ink-2)',
          }}>{label}</span>
        ))}
      </div>

      {/* Two-column grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: 24,
      }}>
        {/* Left: cost curve + type breakdown */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* Cost curve */}
          <div style={{ background: 'var(--ts-panel)', border: '1px solid var(--ts-line)', padding: 16 }}>
            <div className="ts-eyebrow" style={{ marginBottom: 12 }}>Cost Curve</div>
            <div className="ts-curve-chart">
              {a.curve.map((count, i) => (
                <div key={i} className="ts-curve-bar">
                  <div
                    className="ts-curve-bar-fill"
                    style={{ height: `${Math.round((count / a.curveMax) * 100)}%` }}
                  />
                </div>
              ))}
            </div>
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)',
              gap: 4, marginTop: 4,
            }}>
              {[0, 1, 2, 3, 4, 5, 6, '7+'].map((label, i) => (
                <div key={i} style={{
                  fontFamily: 'var(--ts-font-mono)', fontSize: 8,
                  color: 'var(--ts-ink-4)', textAlign: 'center',
                }}>{label}</div>
              ))}
            </div>
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)',
              gap: 4, marginTop: 2,
            }}>
              {a.curve.map((count, i) => (
                <div key={i} style={{
                  fontFamily: 'var(--ts-font-mono)', fontSize: 8,
                  color: count > 0 ? 'var(--ts-amber)' : 'var(--ts-ink-4)', textAlign: 'center',
                }}>{count > 0 ? count : '·'}</div>
              ))}
            </div>
          </div>

          {/* Type breakdown */}
          <div style={{ background: 'var(--ts-panel)', border: '1px solid var(--ts-line)', padding: 16 }}>
            <div className="ts-eyebrow" style={{ marginBottom: 12 }}>Composition</div>
            {typeTotal > 0 && (
              <div style={{
                display: 'flex', height: 8, borderRadius: 0,
                overflow: 'hidden', border: '1px solid var(--ts-line-2)', marginBottom: 12,
              }}>
                {Object.entries(a.typeCounts)
                  .filter(([, n]) => n > 0)
                  .map(([type, count]) => (
                    <div key={type} style={{
                      width: `${(count / typeTotal) * 100}%`,
                      background: TYPE_COLORS[type],
                    }} />
                  ))}
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {Object.entries(a.typeCounts).map(([type, count]) => (
                <div key={type} style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  fontFamily: 'var(--ts-font-mono)', fontSize: 10,
                }}>
                  <div style={{
                    width: 8, height: 8, background: TYPE_COLORS[type], flexShrink: 0,
                  }} />
                  <span style={{ flex: 1, color: 'var(--ts-ink-3)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{type}</span>
                  <span style={{ color: count > 0 ? 'var(--ts-ink)' : 'var(--ts-ink-4)' }}>{count}</span>
                  {typeTotal > 0 && count > 0 && (
                    <span style={{ color: 'var(--ts-ink-4)', minWidth: 32, textAlign: 'right' }}>
                      {Math.round((count / typeTotal) * 100)}%
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right: aspects + rarity */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* Aspect distribution */}
          {Object.keys(a.aspectCounts).length > 0 && (
            <div style={{ background: 'var(--ts-panel)', border: '1px solid var(--ts-line)', padding: 16 }}>
              <div className="ts-eyebrow" style={{ marginBottom: 12 }}>Aspects</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                {ASPECT_ORDER
                  .filter(asp => a.aspectCounts[asp] > 0)
                  .map(asp => (
                    <div key={asp} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span className="ts-aspect-pip" data-aspect={asp}>
                        {asp.charAt(0)}
                      </span>
                      <span style={{
                        fontFamily: 'var(--ts-font-mono)', fontSize: 10,
                        color: 'var(--ts-ink-2)',
                      }}>{a.aspectCounts[asp]}</span>
                    </div>
                  ))}
                {/* Any aspects not in the known order */}
                {Object.entries(a.aspectCounts)
                  .filter(([asp]) => !ASPECT_ORDER.includes(asp))
                  .map(([asp, count]) => (
                    <div key={asp} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span className="ts-aspect-pip" style={{ background: 'var(--ts-line-2)' }}>
                        {asp.charAt(0)}
                      </span>
                      <span style={{ fontFamily: 'var(--ts-font-mono)', fontSize: 10, color: 'var(--ts-ink-2)' }}>{count}</span>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Rarity breakdown */}
          <div style={{ background: 'var(--ts-panel)', border: '1px solid var(--ts-line)', padding: 16 }}>
            <div className="ts-eyebrow" style={{ marginBottom: 12 }}>Rarity</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {RARITY_ORDER
                .filter(r => a.rarityCounts[r] > 0)
                .map(r => (
                  <span key={r} className="ts-chip" style={{ color: 'var(--ts-ink-2)' }}>
                    {r} {a.rarityCounts[r]}
                  </span>
                ))}
              {Object.entries(a.rarityCounts)
                .filter(([r]) => !RARITY_ORDER.includes(r))
                .map(([r, count]) => (
                  <span key={r} className="ts-chip" style={{ color: 'var(--ts-ink-3)' }}>
                    {r} {count}
                  </span>
                ))}
              {Object.keys(a.rarityCounts).length === 0 && (
                <span style={{ fontFamily: 'var(--ts-font-mono)', fontSize: 10, color: 'var(--ts-ink-4)' }}>No rarity data</span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
