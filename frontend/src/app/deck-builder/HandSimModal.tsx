// frontend/src/app/deck-builder/HandSimModal.tsx
'use client';

import React, { useState, useCallback } from 'react';
import { Card as CardType } from '@/lib/api';

interface DeckItem {
  card: CardType;
  quantity: number;
}

interface Props {
  deckCards: DeckItem[];
  mode: 'sim' | 'mulligan';
  onClose: () => void;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function buildPool(deckCards: DeckItem[]): CardType[] {
  const pool: CardType[] = [];
  deckCards.forEach(({ card, quantity }) => {
    for (let i = 0; i < quantity; i++) pool.push(card);
  });
  return pool;
}

function MiniCard({ card }: { card: CardType }) {
  const [imgError, setImgError] = React.useState(false);
  const aspects = card.aspects?.map(a => a.aspect_name) ?? [];
  const ASPECT_COLORS: Record<string, string> = {
    Command: '#c2453a', Aggression: '#d96f2d', Cunning: '#e2b342',
    Heroism: '#ead7a8', Vigilance: '#4a90c4', Villainy: '#2c2a26',
  };
  const bg = aspects.length === 1
    ? `linear-gradient(155deg, ${ASPECT_COLORS[aspects[0]] ?? '#2c251a'}, #2c251a)`
    : aspects.length >= 2
    ? `linear-gradient(155deg, ${aspects.map(a => ASPECT_COLORS[a] ?? '#2c251a').join(', ')})`
    : 'linear-gradient(155deg, #2c251a, #1f1a12)';

  const artSrc = card.image_uri || card.image_url || '';
  const showArt = !!artSrc && !imgError;
  const cost = card.cost ?? card.energy_cost ?? '—';

  return (
    <div
      className="ts-mini-card"
      style={{
        width: 90,
        aspectRatio: '5 / 7',
        background: showArt ? '#000' : bg,
        border: '1px solid var(--ts-line-2)',
        position: 'relative',
        boxShadow: '0 6px 18px rgba(0,0,0,0.4)',
        flexShrink: 0,
        overflow: 'hidden',
      }}
    >
      {showArt && (
        <img
          src={artSrc}
          alt={card.name ?? ''}
          onError={() => setImgError(true)}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            objectPosition: 'center top',
          }}
        />
      )}
      {/* Cost */}
      <div
        style={{
          position: 'absolute',
          top: 5,
          left: 5,
          width: 20,
          height: 20,
          background: 'rgba(0,0,0,0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'var(--ts-font-mono)',
          fontSize: 12,
          fontWeight: 700,
          color: '#fff',
        }}
      >
        {cost}
      </div>

      {/* Aspect pips */}
      <div style={{ position: 'absolute', top: 5, right: 5, display: 'flex', flexDirection: 'column', gap: 2 }}>
        {aspects.map(a => (
          <span
            key={a}
            style={{
              width: 14,
              height: 14,
              background: ASPECT_COLORS[a] ?? '#555',
              clipPath: 'polygon(50% 0, 100% 25%, 100% 75%, 50% 100%, 0 75%, 0 25%)',
              display: 'inline-block',
            }}
          />
        ))}
      </div>

      {/* Name plate */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          background: 'rgba(20,16,10,0.92)',
          padding: '4px 5px',
          borderTop: '1px solid rgba(255,255,255,0.15)',
        }}
      >
        <div
          style={{
            fontFamily: 'var(--ts-font-display)',
            fontSize: 9,
            color: '#e8dcc4',
            lineHeight: 1.2,
            overflow: 'hidden',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
          }}
        >
          {card.name}
        </div>
        <div
          style={{
            fontFamily: 'var(--ts-font-mono)',
            fontSize: 7,
            color: 'rgba(255,255,255,0.45)',
            letterSpacing: '0.1em',
            marginTop: 1,
            textTransform: 'uppercase',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {card.type}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <div className="ts-eyebrow" style={{ marginBottom: 4 }}>{label}</div>
      <div style={{ fontFamily: 'var(--ts-font-display)', fontSize: 28, lineHeight: 1, color: 'var(--ts-ink)' }}>
        {value}
      </div>
    </div>
  );
}

export function HandSimModal({ deckCards, mode, onClose }: Props) {
  const pool = buildPool(deckCards);
  const [hand, setHand] = useState<CardType[]>(() => shuffle(pool).slice(0, 6));
  const [mulligans, setMulligans] = useState(0);
  const [opponent, setOpponent] = useState('Sabine Wren');

  const doMulligan = useCallback(() => {
    setHand(shuffle(pool).slice(0, 6));
    setMulligans(m => m + 1);
  }, [pool]);

  const drawOne = useCallback(() => {
    const extended = shuffle(pool).slice(0, 6 + hand.length);
    setHand(extended.slice(0, hand.length + 1));
  }, [pool, hand.length]);

  const reset = useCallback(() => {
    setHand(shuffle(pool).slice(0, 6));
    setMulligans(0);
  }, [pool]);

  // Stats
  const avgCost = hand.length
    ? (hand.reduce((s, c) => s + (c.cost ?? c.energy_cost ?? 0), 0) / hand.length).toFixed(1)
    : '—';
  const oneDrops = hand.filter(c => (c.cost ?? c.energy_cost ?? 0) <= 1).length;
  const earlyUnits = hand.filter(
    c => c.type?.toLowerCase().includes('unit') && (c.cost ?? c.energy_cost ?? 0) <= 3
  ).length;

  const verdict =
    earlyUnits >= 2 && oneDrops >= 1
      ? { label: 'KEEP', color: 'var(--ts-green)' }
      : earlyUnits >= 2
      ? { label: 'KEEP', color: 'var(--ts-amber)' }
      : { label: 'MULLIGAN', color: 'var(--ts-red)' };

  return (
    <div className="ts-modal-backdrop" onClick={onClose}>
      <div className="ts-modal" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div
          style={{
            padding: '18px 24px',
            borderBottom: '1px solid var(--ts-line)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div>
            <div className="ts-eyebrow" style={{ marginBottom: 4 }}>
              {mode === 'mulligan' ? 'Mulligan Trainer' : 'Opening Hand Simulator'}
            </div>
            <div style={{ fontFamily: 'var(--ts-font-display)', fontSize: 28, color: 'var(--ts-ink)' }}>
              {mode === 'mulligan' ? 'Train your mulligan instinct' : 'Sample your opener'}
            </div>
          </div>
          <button
            className="ts-btn ts-btn-sm"
            onClick={onClose}
          >
            ✕ Close
          </button>
        </div>

        <div style={{ padding: '24px 28px' }}>
          {/* Matchup context (mulligan mode only) */}
          {mode === 'mulligan' && (
            <div
              style={{
                background: 'var(--ts-bg-2)',
                border: '1px solid var(--ts-line)',
                padding: '14px 18px',
                marginBottom: 20,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 20,
              }}
            >
              <div style={{ flex: 1 }}>
                <div className="ts-eyebrow" style={{ marginBottom: 6 }}>Matchup Context</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontFamily: 'var(--ts-font-mono)', fontSize: 10, color: 'var(--ts-ink-3)', letterSpacing: '0.1em', flexShrink: 0 }}>vs.</span>
                  <input
                    className="ts-input"
                    style={{ flex: 1, padding: '4px 10px', fontSize: 15, fontFamily: 'var(--ts-font-display)', color: 'var(--ts-ink)', background: 'transparent', border: 'none', borderBottom: '1px solid var(--ts-line-2)', outline: 'none' }}
                    value={opponent}
                    onChange={e => setOpponent(e.target.value)}
                    placeholder="Opponent leader…"
                    spellCheck={false}
                  />
                </div>
              </div>
              <div
                style={{
                  fontFamily: 'var(--ts-font-mono)',
                  fontSize: 9,
                  color: 'var(--ts-ink-3)',
                  letterSpacing: '0.14em',
                  textAlign: 'right',
                  flexShrink: 0,
                }}
              >
                MULLIGAN AGAINST:<br />
                {opponent || '—'}
              </div>
            </div>
          )}

          {/* Hand zone */}
          <div className="ts-hand-zone">
            {hand.length === 0 ? (
              <div
                style={{
                  color: 'var(--ts-ink-3)',
                  fontFamily: 'var(--ts-font-mono)',
                  fontSize: 11,
                  letterSpacing: '0.16em',
                }}
              >
                No cards in deck
              </div>
            ) : (
              hand.map((card, i) => <MiniCard key={`${card.id}-${i}`} card={card} />)
            )}
          </div>

          {/* Verdict + stats */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 20, marginTop: 20 }}>
            {/* Verdict */}
            <div
              style={{
                background: 'var(--ts-bg-2)',
                border: '1px solid var(--ts-line)',
                padding: 18,
                textAlign: 'center',
              }}
            >
              <div className="ts-eyebrow" style={{ marginBottom: 8 }}>Recommendation</div>
              <div
                style={{
                  fontFamily: 'var(--ts-font-display)',
                  fontSize: 40,
                  lineHeight: 1,
                  color: verdict.color,
                }}
              >
                {verdict.label}
              </div>
              <div
                style={{
                  fontFamily: 'var(--ts-font-mono)',
                  fontSize: 9,
                  color: 'var(--ts-ink-3)',
                  letterSpacing: '0.16em',
                  marginTop: 8,
                }}
              >
                {earlyUnits} EARLY UNITS · {oneDrops} ONE-DROP
              </div>
            </div>

            {/* Stats */}
            <div
              style={{
                background: 'var(--ts-bg-2)',
                border: '1px solid var(--ts-line)',
                padding: 18,
              }}
            >
              <div className="ts-eyebrow" style={{ marginBottom: 14 }}>Hand Readout</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
                <Stat label="Avg Cost" value={avgCost} />
                <Stat label="One-Drops" value={oneDrops} />
                <Stat label="Early Units" value={`${earlyUnits}/3`} />
                <Stat label="Mulligans" value={mulligans} />
              </div>

              {/* Mini curve of hand */}
              <div style={{ marginTop: 18, display: 'flex', gap: 3, height: 28, alignItems: 'flex-end' }}>
                {Array(8).fill(0).map((_, i) => {
                  const n = hand.filter(c => (i === 7 ? (c.cost ?? 0) >= 7 : (c.cost ?? 0) === i)).length;
                  return (
                    <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                      <div
                        style={{
                          background: 'var(--ts-amber)',
                          width: '100%',
                          height: n * 10,
                          minHeight: n > 0 ? 4 : 0,
                        }}
                      />
                      <div
                        style={{
                          fontFamily: 'var(--ts-font-mono)',
                          fontSize: 8,
                          color: 'var(--ts-ink-4)',
                          textAlign: 'center',
                        }}
                      >
                        {i === 7 ? '7+' : i}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Controls */}
          <div
            style={{
              display: 'flex',
              gap: 10,
              marginTop: 20,
              justifyContent: 'center',
            }}
          >
            <button className="ts-btn ts-btn-primary" onClick={doMulligan}>↻ Mulligan</button>
            <button className="ts-btn" onClick={drawOne} disabled={hand.length >= pool.length}>+ Draw Card</button>
            <button className="ts-btn" onClick={reset}>Reset</button>
          </div>

          {/* Veteran tips (mulligan mode) */}
          {mode === 'mulligan' && (
            <div
              style={{
                background: 'var(--ts-bg-2)',
                border: '1px solid var(--ts-line)',
                padding: '18px 20px',
                marginTop: 20,
              }}
            >
              <div className="ts-eyebrow" style={{ marginBottom: 14 }}>What Veterans Look For</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
                {[
                  {
                    t: 'Floor',
                    d: '1 unit by turn 2 OR a 1-cost interaction. Otherwise mulligan.',
                  },
                  {
                    t: 'Curve Target',
                    d: 'Aim for 1-2-3 develop. 4+ cost cards with no early board = mull.',
                  },
                  {
                    t: 'Aggro Matchup',
                    d: 'Need defensive bodies turns 2-3. Early blockers are gold.',
                  },
                ].map(tip => (
                  <div key={tip.t}>
                    <div
                      style={{
                        fontFamily: 'var(--ts-font-display)',
                        fontSize: 16,
                        color: 'var(--ts-amber)',
                        marginBottom: 6,
                      }}
                    >
                      {tip.t}
                    </div>
                    <p
                      style={{
                        color: 'var(--ts-ink-2)',
                        fontSize: 13,
                        lineHeight: 1.6,
                        margin: 0,
                      }}
                    >
                      {tip.d}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
