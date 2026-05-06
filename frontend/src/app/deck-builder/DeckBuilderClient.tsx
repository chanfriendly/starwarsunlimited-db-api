// frontend/src/app/deck-builder/DeckBuilderClient.tsx
'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useDeckBuilder } from '@/contexts/DeckBuilderContext';
import { Card as CardType, FetchCardsParams, fetchCards, fetchAspects, fetchSets, fetchTraits, SavedDeck } from '@/lib/api';
import { debounce } from 'lodash-es';
import { fetchWithAuth } from '@/lib/fetch-utils';
import { useAuth } from '@/contexts/AuthContext';
import SaveDeckDialog from '@/components/SaveDeckDialog';
import { HandSimModal } from './HandSimModal';

// ── Constants ──────────────────────────────────────────────
const SEARCH_DEBOUNCE_MS = 400;
const CARDS_PER_PAGE = 60;
const LOOP_CHECK_WINDOW_MS = 3000;
const MAX_VISITS_IN_WINDOW = 10;

// ── Aspect pip ─────────────────────────────────────────────
function AspectPip({ aspect }: { aspect: string }) {
  const initials: Record<string, string> = {
    Command: 'C', Aggression: 'A', Cunning: 'U',
    Heroism: 'H', Vigilance: 'V', Villainy: 'X',
  };
  return (
    <span
      className="ts-aspect-pip"
      data-aspect={aspect}
      title={aspect}
      style={{ width: 18, height: 18, fontSize: 8 }}
    >
      {initials[aspect] ?? aspect[0]}
    </span>
  );
}

// ── Resource curve chart ───────────────────────────────────
function ResourceCurveChart({ deckCards }: { deckCards: { card: CardType; quantity: number }[] }) {
  const curve = Array(8).fill(0);
  deckCards.forEach(({ card, quantity }) => {
    const cost = card.cost ?? card.energy_cost ?? 0;
    const i = Math.min(cost, 7);
    curve[i] += quantity;
  });
  const maxBar = Math.max(...curve, 1);
  const labels = ['0','1','2','3','4','5','6','7+'];

  return (
    <div>
      <div
        className="ts-eyebrow"
        style={{ marginBottom: 12, paddingLeft: 0 }}
      >
        Resource Curve
      </div>
      <div className="ts-curve-chart" style={{ marginBottom: 28 }}>
        {curve.map((n, i) => (
          <div key={i} className="ts-curve-bar">
            <div
              className="ts-curve-bar-fill"
              style={{ height: `${(n / maxBar) * 100}%` }}
            />
            {n > 0 && (
              <span
                style={{
                  position: 'absolute',
                  top: -16,
                  left: 0,
                  right: 0,
                  textAlign: 'center',
                  fontFamily: 'var(--ts-font-mono)',
                  fontSize: 10,
                  color: 'var(--ts-ink)',
                }}
              >
                {n}
              </span>
            )}
            <span
              style={{
                position: 'absolute',
                bottom: -18,
                left: 0,
                right: 0,
                textAlign: 'center',
                fontFamily: 'var(--ts-font-mono)',
                fontSize: 9,
                color: 'var(--ts-ink-3)',
              }}
            >
              {labels[i]}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Composition bar ────────────────────────────────────────
function CompositionBar({ deckCards }: { deckCards: { card: CardType; quantity: number }[] }) {
  const counts = { Unit: 0, Event: 0, Upgrade: 0, Other: 0 };
  deckCards.forEach(({ card, quantity }) => {
    const t = card.type ?? '';
    if (t.toLowerCase().includes('unit'))    counts.Unit    += quantity;
    else if (t.toLowerCase().includes('event'))   counts.Event   += quantity;
    else if (t.toLowerCase().includes('upgrade')) counts.Upgrade += quantity;
    else counts.Other += quantity;
  });
  const total = Object.values(counts).reduce((a, b) => a + b, 0) || 1;

  const segments = [
    { key: 'Unit',    color: 'var(--ts-amber)',  n: counts.Unit },
    { key: 'Event',   color: 'var(--ts-blue)',   n: counts.Event },
    { key: 'Upgrade', color: 'var(--ts-green)',  n: counts.Upgrade },
  ].filter(s => s.n > 0);

  if (segments.length === 0) return null;

  return (
    <div style={{ marginBottom: 16 }}>
      <div className="ts-eyebrow" style={{ marginBottom: 10 }}>Composition</div>
      <div style={{ height: 7, display: 'flex', border: '1px solid var(--ts-line-2)' }}>
        {segments.map(s => (
          <div
            key={s.key}
            style={{ width: `${(s.n / total) * 100}%`, background: s.color }}
            title={`${s.key}: ${s.n}`}
          />
        ))}
      </div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginTop: 7,
          fontFamily: 'var(--ts-font-mono)',
          fontSize: 10,
          color: 'var(--ts-ink-2)',
        }}
      >
        {segments.map(s => (
          <span key={s.key}>
            <span style={{ display:'inline-block', width:7, height:7, background:s.color, marginRight:5 }} />
            {s.key} {s.n}
          </span>
        ))}
      </div>
    </div>
  );
}

// ── Deck panel (right column) ──────────────────────────────
function DeckPanel({
  deckCards, leaders, base, deckName, setDeckName,
  addCard, removeCard,
  openHandSim, openMulligan,
  onSave, totalCards,
}: {
  deckCards: { card: CardType; quantity: number }[];
  leaders: CardType[];
  base: CardType | null;
  deckName: string;
  setDeckName: (n: string) => void;
  addCard: (c: CardType) => void;
  removeCard: (id: string) => void;
  openHandSim: () => void;
  openMulligan: () => void;
  onSave: () => void;
  totalCards: number;
}) {
  const grouped = useMemo(() => {
    const g: Record<string, { card: CardType; quantity: number }[]> = {
      Unit: [], Event: [], Upgrade: [], Other: [],
    };
    deckCards.forEach(item => {
      const t = item.card.type ?? '';
      if (t.toLowerCase().includes('unit'))         g.Unit.push(item);
      else if (t.toLowerCase().includes('event'))   g.Event.push(item);
      else if (t.toLowerCase().includes('upgrade')) g.Upgrade.push(item);
      else g.Other.push(item);
    });
    Object.values(g).forEach(arr =>
      arr.sort((a, b) => {
        const ca = a.card.cost ?? a.card.energy_cost ?? 0;
        const cb = b.card.cost ?? b.card.energy_cost ?? 0;
        return ca - cb || a.card.name.localeCompare(b.card.name);
      })
    );
    return g;
  }, [deckCards]);

  const avgCost = useMemo(() => {
    const sum = deckCards.reduce((s, { card, quantity }) => s + (card.cost ?? card.energy_cost ?? 0) * quantity, 0);
    return totalCards > 0 ? (sum / totalCards).toFixed(1) : '—';
  }, [deckCards, totalCards]);

  const leaderAspects = leaders.flatMap(l => l.aspects?.map(a => a.aspect_name) ?? []);

  const sections = [
    ['Units', grouped.Unit],
    ['Events', grouped.Event],
    ['Upgrades', grouped.Upgrade],
    ['Other', grouped.Other],
  ] as [string, { card: CardType; quantity: number }[]][];

  const isTargetMet = totalCards >= 30;

  return (
    <div>
      {/* Header */}
      <div style={{ paddingBottom: 14, borderBottom: '1px solid var(--ts-line)' }}>
        <div className="ts-eyebrow" style={{ marginBottom: 6 }}>Working Deck</div>
        <input
          value={deckName}
          onChange={e => setDeckName(e.target.value)}
          style={{
            fontFamily: 'var(--ts-font-display)',
            fontSize: 22,
            color: 'var(--ts-ink)',
            background: 'transparent',
            border: 'none',
            outline: 'none',
            width: '100%',
            padding: '2px 0',
          }}
        />
        {leaderAspects.length > 0 && (
          <div style={{ display: 'flex', gap: 5, marginTop: 6, flexWrap: 'wrap' }}>
            {leaderAspects.map((a, i) => <AspectPip key={i} aspect={a} />)}
            {leaders[0] && (
              <span
                style={{
                  fontFamily: 'var(--ts-font-mono)',
                  fontSize: 10,
                  color: 'var(--ts-ink-3)',
                  letterSpacing: '0.12em',
                  alignSelf: 'center',
                }}
              >
                {leaders.map(l => l.name).join(' · ').toUpperCase()}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Stats row */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          borderBottom: '1px solid var(--ts-line)',
        }}
      >
        {[
          { l: 'Cards', v: totalCards, sub: '/ 30 min' },
          { l: 'Avg Cost', v: avgCost },
          { l: 'Stage', v: leaders.length === 2 && base ? 'Ready' : 'Setup', sub: leaders.length < 2 ? `${leaders.length}/2 leaders` : !base ? 'no base' : undefined },
        ].map(s => (
          <div key={s.l} style={{ padding: '12px 10px', borderRight: '1px solid var(--ts-line)' }}>
            <div className="ts-eyebrow" style={{ marginBottom: 4 }}>{s.l}</div>
            <div
              style={{
                fontFamily: 'var(--ts-font-display)',
                fontSize: 22,
                lineHeight: 1,
                color: s.l === 'Cards' && isTargetMet ? 'var(--ts-green)' : 'var(--ts-ink)',
              }}
            >
              {s.v}
            </div>
            {s.sub && (
              <div
                style={{
                  fontFamily: 'var(--ts-font-mono)',
                  fontSize: 9,
                  color: 'var(--ts-ink-4)',
                  marginTop: 2,
                }}
              >
                {s.sub}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Curve + composition */}
      <div style={{ padding: '20px 6px 6px' }}>
        <ResourceCurveChart deckCards={deckCards} />
        <CompositionBar deckCards={deckCards} />
      </div>

      {/* Sim buttons */}
      {totalCards > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 14, padding: '0 2px' }}>
          <button className="ts-btn ts-btn-sm ts-btn-blue" onClick={openHandSim}>◇ Hand Sim</button>
          <button className="ts-btn ts-btn-sm ts-btn-blue" onClick={openMulligan}>◇ Mulligan</button>
        </div>
      )}

      {/* Deck list */}
      <div style={{ borderTop: '1px solid var(--ts-line)' }}>
        {sections.map(([label, list]) =>
          list.length > 0 ? (
            <div key={label} style={{ paddingBottom: 4 }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '10px 8px 5px',
                }}
              >
                <span
                  style={{
                    fontFamily: 'var(--ts-font-mono)',
                    fontSize: 9,
                    letterSpacing: '0.2em',
                    color: 'var(--ts-amber)',
                    textTransform: 'uppercase',
                  }}
                >
                  {label}
                </span>
                <span
                  style={{
                    fontFamily: 'var(--ts-font-mono)',
                    fontSize: 9,
                    color: 'var(--ts-ink-3)',
                  }}
                >
                  {list.reduce((s, i) => s + i.quantity, 0)}
                </span>
              </div>
              {list.map(({ card, quantity }) => (
                <div key={card.id} className="ts-deck-row">
                  <span
                    style={{
                      fontFamily: 'var(--ts-font-mono)',
                      fontSize: 10,
                      color: 'var(--ts-amber)',
                    }}
                  >
                    ×{quantity}
                  </span>
                  <span
                    style={{
                      fontFamily: 'var(--ts-font-mono)',
                      fontSize: 10,
                      color: 'var(--ts-ink-3)',
                    }}
                  >
                    {card.cost ?? card.energy_cost ?? '—'}
                  </span>
                  <span style={{ fontSize: 13, color: 'var(--ts-ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {card.name}
                  </span>
                  <button
                    onClick={() => removeCard(card.id)}
                    style={{
                      background: 'transparent',
                      border: '1px solid var(--ts-line-2)',
                      color: 'var(--ts-ink-3)',
                      width: 20,
                      height: 20,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      fontFamily: 'var(--ts-font-mono)',
                      fontSize: 12,
                      padding: 0,
                      flexShrink: 0,
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--ts-red)'; (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--ts-red)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--ts-ink-3)'; (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--ts-line-2)'; }}
                  >
                    −
                  </button>
                </div>
              ))}
            </div>
          ) : null
        )}
      </div>

      {/* Footer actions */}
      <div style={{ padding: '14px 2px 0', display: 'flex', flexDirection: 'column', gap: 7 }}>
        <button
          className="ts-btn ts-btn-primary ts-btn-sm"
          style={{ width: '100%', justifyContent: 'center' }}
          onClick={onSave}
          disabled={leaders.length !== 2 || !base}
        >
          Save Deck
        </button>
      </div>
    </div>
  );
}

// ── Stage banner (leaders/base setup) ─────────────────────
function StageBanner({
  currentStage, leaders, base, resetDeck, setStage,
  handleRemoveFromDeck,
}: {
  currentStage: string;
  leaders: CardType[];
  base: CardType | null;
  resetDeck: () => void;
  setStage: (s: 'leaders' | 'base' | 'cards') => void;
  handleRemoveFromDeck: (id: string) => void;
}) {
  if (currentStage === 'cards') return null;

  const isLeaders = currentStage === 'leaders';

  return (
    <div
      style={{
        background: 'var(--ts-panel)',
        border: '1px solid var(--ts-line)',
        padding: 20,
        marginBottom: 0,
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: 16,
        }}
      >
        <div>
          <div className="ts-eyebrow" style={{ marginBottom: 4 }}>
            {isLeaders ? `Step 1 · Select Leaders` : `Step 2 · Select Base`}
          </div>
          <div
            style={{ fontFamily: 'var(--ts-font-display)', fontSize: 20, color: 'var(--ts-ink)' }}
          >
            {isLeaders
              ? `Choose two leaders (${leaders.length}/2)`
              : 'Choose your base'}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {!isLeaders && (
            <button
              className="ts-btn ts-btn-sm"
              onClick={() => setStage('leaders')}
            >
              ← Leaders
            </button>
          )}
          <button
            className="ts-btn ts-btn-sm"
            onClick={resetDeck}
            style={{ color: 'var(--ts-red)', borderColor: 'var(--ts-red)' }}
          >
            Reset
          </button>
          {isLeaders && leaders.length === 2 && (
            <button
              className="ts-btn ts-btn-sm ts-btn-primary"
              onClick={() => setStage('base')}
            >
              Next: Base →
            </button>
          )}
          {!isLeaders && base && (
            <button
              className="ts-btn ts-btn-sm ts-btn-primary"
              onClick={() => setStage('cards')}
            >
              Build Deck →
            </button>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        {isLeaders
          ? leaders.map(leader => (
              <div
                key={leader.id}
                style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 10 }}
              >
                <div
                  style={{
                    width: 44,
                    height: 44,
                    overflow: 'hidden',
                    border: '1px solid var(--ts-amber)',
                    flexShrink: 0,
                  }}
                >
                  <img
                    src={leader.image_uri ?? '/placeholder-card.png'}
                    alt={leader.name}
                    style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: '50% 20%' }}
                    onError={e => { (e.target as HTMLImageElement).src = '/placeholder-card.png'; }}
                  />
                </div>
                <div>
                  <div style={{ fontFamily: 'var(--ts-font-display)', fontSize: 15, color: 'var(--ts-ink)' }}>{leader.name}</div>
                  <div style={{ display: 'flex', gap: 4, marginTop: 3 }}>
                    {leader.aspects?.map(a => <AspectPip key={a.aspect_name} aspect={a.aspect_name} />)}
                  </div>
                </div>
                <button
                  onClick={() => handleRemoveFromDeck(leader.id)}
                  style={{
                    background: 'transparent',
                    border: '1px solid var(--ts-line-2)',
                    color: 'var(--ts-ink-3)',
                    width: 18,
                    height: 18,
                    cursor: 'pointer',
                    fontSize: 10,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: 0,
                    alignSelf: 'flex-start',
                  }}
                >
                  ✕
                </button>
              </div>
            ))
          : base ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div
                style={{
                  width: 44,
                  height: 44,
                  overflow: 'hidden',
                  border: '1px solid var(--ts-amber)',
                }}
              >
                <img
                  src={base.image_uri ?? '/placeholder-card.png'}
                  alt={base.name}
                  style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: '50% 20%' }}
                  onError={e => { (e.target as HTMLImageElement).src = '/placeholder-card.png'; }}
                />
              </div>
              <div>
                <div style={{ fontFamily: 'var(--ts-font-display)', fontSize: 15, color: 'var(--ts-ink)' }}>{base.name}</div>
                <div style={{ display: 'flex', gap: 4, marginTop: 3 }}>
                  {base.aspects?.map(a => <AspectPip key={a.aspect_name} aspect={a.aspect_name} />)}
                </div>
              </div>
              <button
                onClick={() => handleRemoveFromDeck(base.id)}
                style={{
                  background: 'transparent',
                  border: '1px solid var(--ts-line-2)',
                  color: 'var(--ts-ink-3)',
                  width: 18,
                  height: 18,
                  cursor: 'pointer',
                  fontSize: 10,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: 0,
                }}
              >
                ✕
              </button>
            </div>
          ) : null}
      </div>
    </div>
  );
}

// ── Filter sidebar ──────────────────────────────────────────
function FilterSidebar({
  filterAspects, setFilterAspects,
  filterTraits, setFilterTraits,
  filterSets, setFilterSets,
  cardTypeFilter, setCardTypeFilter,
  availableAspects, availableTraits, availableSets,
  showAllCards, setShowAllCards,
  hideCardsInDeck, setHideCardsInDeck,
  currentStage,
}: {
  filterAspects: string[];
  setFilterAspects: React.Dispatch<React.SetStateAction<string[]>>;
  filterTraits: string[];
  setFilterTraits: React.Dispatch<React.SetStateAction<string[]>>;
  filterSets: string[];
  setFilterSets: React.Dispatch<React.SetStateAction<string[]>>;
  cardTypeFilter: string;
  setCardTypeFilter: React.Dispatch<React.SetStateAction<string>>;
  availableAspects: string[];
  availableTraits: string[];
  availableSets: string[];
  showAllCards: boolean;
  setShowAllCards: React.Dispatch<React.SetStateAction<boolean>>;
  hideCardsInDeck: boolean;
  setHideCardsInDeck: React.Dispatch<React.SetStateAction<boolean>>;
  currentStage: string;
}) {
  const toggle = (arr: string[], val: string, set: React.Dispatch<React.SetStateAction<string[]>>) => {
    set(arr.includes(val) ? arr.filter(v => v !== val) : [...arr, val]);
  };

  const ASPECTS = ['Command', 'Aggression', 'Cunning', 'Heroism', 'Vigilance', 'Villainy'];
  const TYPES = ['Unit', 'Event', 'Upgrade'];

  if (currentStage !== 'cards') return null;

  return (
    <aside
      style={{
        borderRight: '1px solid var(--ts-line)',
        background: 'var(--ts-panel)',
        padding: '18px 16px',
        overflowY: 'auto',
        height: '100%',
      }}
    >
      {/* Aspect */}
      <div style={{ borderBottom: '1px solid var(--ts-line)', paddingBottom: 16, marginBottom: 0 }}>
        <div className="ts-eyebrow" style={{ marginBottom: 10 }}>Aspect</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 5 }}>
          {ASPECTS.map(a => (
            <button
              key={a}
              className={'ts-filter-pill' + (filterAspects.includes(a) ? ' is-active' : '')}
              onClick={() => toggle(filterAspects, a, setFilterAspects)}
              style={{ justifyContent: 'flex-start', gap: 5 }}
            >
              <AspectPip aspect={a} />
              <span style={{ fontSize: 9, letterSpacing: '0.1em' }}>{a.toUpperCase()}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Card Type */}
      <div style={{ borderBottom: '1px solid var(--ts-line)', padding: '14px 0' }}>
        <div className="ts-eyebrow" style={{ marginBottom: 10 }}>Card Type</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
          {TYPES.map(t => (
            <button
              key={t}
              className={'ts-filter-pill' + (cardTypeFilter === t ? ' is-active' : '')}
              onClick={() => setCardTypeFilter(prev => prev === t ? '' : t)}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Set */}
      {availableSets.length > 0 && (
        <div style={{ borderBottom: '1px solid var(--ts-line)', padding: '14px 0' }}>
          <div className="ts-eyebrow" style={{ marginBottom: 10 }}>Set</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {availableSets.slice(0, 8).map(s => (
              <label
                key={s}
                style={{
                  display: 'flex',
                  gap: 8,
                  alignItems: 'center',
                  fontSize: 11,
                  color: 'var(--ts-ink-2)',
                  cursor: 'pointer',
                  fontFamily: 'var(--ts-font-mono)',
                  letterSpacing: '0.08em',
                }}
              >
                <input
                  type="checkbox"
                  checked={filterSets.includes(s)}
                  onChange={e =>
                    setFilterSets(prev =>
                      e.target.checked ? [...prev, s] : prev.filter(x => x !== s)
                    )
                  }
                  style={{ accentColor: 'var(--ts-amber)' }}
                />
                {s}
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Traits */}
      {availableTraits.length > 0 && (
        <div style={{ borderBottom: '1px solid var(--ts-line)', padding: '14px 0' }}>
          <div className="ts-eyebrow" style={{ marginBottom: 10 }}>Trait</div>
          <div style={{ maxHeight: 180, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 5 }}>
            {availableTraits.slice(0, 20).map(t => (
              <label
                key={t}
                style={{
                  display: 'flex',
                  gap: 8,
                  alignItems: 'center',
                  fontSize: 11,
                  color: 'var(--ts-ink-2)',
                  cursor: 'pointer',
                  fontFamily: 'var(--ts-font-mono)',
                  letterSpacing: '0.08em',
                }}
              >
                <input
                  type="checkbox"
                  checked={filterTraits.includes(t)}
                  onChange={e =>
                    setFilterTraits(prev =>
                      e.target.checked ? [...prev, t] : prev.filter(x => x !== t)
                    )
                  }
                  style={{ accentColor: 'var(--ts-amber)' }}
                />
                {t}
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Smart filters */}
      <div style={{ padding: '14px 0' }}>
        <div className="ts-eyebrow" style={{ marginBottom: 10 }}>Smart Filters</div>
        <label
          style={{
            display: 'flex',
            gap: 8,
            alignItems: 'center',
            fontSize: 12,
            color: 'var(--ts-ink-2)',
            cursor: 'pointer',
            marginBottom: 10,
          }}
        >
          <input
            type="checkbox"
            checked={hideCardsInDeck}
            onChange={e => setHideCardsInDeck(e.target.checked)}
            style={{ accentColor: 'var(--ts-amber)' }}
          />
          Hide cards in deck
        </label>
        <label
          style={{
            display: 'flex',
            gap: 8,
            alignItems: 'center',
            fontSize: 12,
            color: 'var(--ts-ink-2)',
            cursor: 'pointer',
          }}
        >
          <input
            type="checkbox"
            checked={showAllCards}
            onChange={e => setShowAllCards(e.target.checked)}
            style={{ accentColor: 'var(--ts-amber)' }}
          />
          Show all aspects
        </label>
      </div>

      {/* Clear */}
      {(filterAspects.length + filterTraits.length + filterSets.length) > 0 && (
        <button
          onClick={() => { setFilterAspects([]); setFilterTraits([]); setFilterSets([]); setCardTypeFilter(''); }}
          style={{
            fontFamily: 'var(--ts-font-mono)',
            fontSize: 9,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            color: 'var(--ts-red)',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            padding: '4px 0',
          }}
        >
          Clear All Filters
        </button>
      )}
    </aside>
  );
}

// ── Card list (middle column) ──────────────────────────────
function CardListView({
  cards, deck, addCard, removeCard,
  loading, hasMoreCards, isLoadingMore, loadMore,
  isCardInDeck,
}: {
  cards: CardType[];
  deck: { cards: { card: CardType; quantity: number }[] };
  addCard: (c: CardType) => void;
  removeCard: (id: string) => void;
  loading: boolean;
  hasMoreCards: boolean;
  isLoadingMore: boolean;
  loadMore: () => void;
  isCardInDeck: (id: string) => boolean;
}) {
  if (loading) {
    return (
      <div
        style={{
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--ts-ink-3)',
          fontFamily: 'var(--ts-font-mono)',
          fontSize: 11,
          letterSpacing: '0.16em',
        }}
      >
        Loading cards…
      </div>
    );
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Column headers */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '28px 1fr auto 88px',
          gap: 8,
          padding: '8px 12px',
          background: 'var(--ts-bg-2)',
          borderBottom: '1px solid var(--ts-line)',
          fontFamily: 'var(--ts-font-mono)',
          fontSize: 9,
          letterSpacing: '0.2em',
          textTransform: 'uppercase',
          color: 'var(--ts-ink-3)',
          flexShrink: 0,
        }}
      >
        <span>#</span>
        <span>Card · Type</span>
        <span>Aspects</span>
        <span style={{ textAlign: 'right' }}>Action</span>
      </div>

      {/* Card rows */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {cards.length === 0 ? (
          <div
            style={{
              padding: 40,
              textAlign: 'center',
              color: 'var(--ts-ink-3)',
              fontFamily: 'var(--ts-font-mono)',
              fontSize: 11,
              letterSpacing: '0.14em',
            }}
          >
            No cards found
          </div>
        ) : (
          cards.map(card => {
            const inDeck = isCardInDeck(card.id);
            const cost = card.cost ?? card.energy_cost ?? '—';
            return (
              <div key={card.id} className="ts-card-row">
                <span
                  style={{
                    fontFamily: 'var(--ts-font-mono)',
                    fontSize: 12,
                    color: 'var(--ts-ink)',
                    fontWeight: 600,
                  }}
                >
                  {cost}
                </span>
                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      fontFamily: 'var(--ts-font-display)',
                      fontSize: 14,
                      color: 'var(--ts-ink)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {card.name}
                  </div>
                  <div
                    style={{
                      fontFamily: 'var(--ts-font-mono)',
                      fontSize: 9,
                      color: 'var(--ts-ink-3)',
                      letterSpacing: '0.14em',
                      marginTop: 1,
                    }}
                  >
                    {card.type}
                    {card.power !== undefined && card.hp !== undefined
                      ? ` · ${card.power}/${card.hp}`
                      : ''}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 3 }}>
                  {card.aspects?.map(a => (
                    <AspectPip key={a.aspect_name} aspect={a.aspect_name} />
                  ))}
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  {inDeck ? (
                    <button
                      className="ts-filter-pill is-active"
                      style={{
                        padding: '4px 10px',
                        background: 'var(--ts-green)',
                        borderColor: 'var(--ts-green)',
                        color: '#0e1410',
                        fontSize: 9,
                      }}
                      onClick={() => removeCard(card.id)}
                    >
                      ✓ IN DECK
                    </button>
                  ) : (
                    <button
                      className="ts-filter-pill"
                      style={{ padding: '4px 10px', fontSize: 9 }}
                      onClick={() => addCard(card)}
                    >
                      + ADD
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}

        {hasMoreCards && !isLoadingMore && cards.length > 0 && (
          <div style={{ padding: 16, textAlign: 'center' }}>
            <button
              className="ts-btn ts-btn-sm"
              onClick={loadMore}
            >
              Load More
            </button>
          </div>
        )}
        {isLoadingMore && (
          <div
            style={{
              padding: 16,
              textAlign: 'center',
              fontFamily: 'var(--ts-font-mono)',
              fontSize: 10,
              color: 'var(--ts-ink-3)',
            }}
          >
            Loading…
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────
export default function DeckBuilderClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const deckIdParam = searchParams.get('deckId');
  const { isAuthenticated, isLoading: authLoading } = useAuth();

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login?redirect=/deck-builder');
    }
  }, [authLoading, isAuthenticated, router]);

  // State
  const [isPotentialLoop, setIsPotentialLoop] = useState(false);
  const [cards, setCards] = useState<CardType[]>([]);
  const [loading, setLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [loadingDeck, setLoadingDeck] = useState(!!deckIdParam);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [cardTypeFilter, setCardTypeFilter] = useState('');
  const [showAllCards, setShowAllCards] = useState(false);
  const [hideCardsInDeck, setHideCardsInDeck] = useState(true);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMoreCards, setHasMoreCards] = useState(true);
  const [handSimMode, setHandSimMode] = useState<'sim' | 'mulligan' | null>(null);

  // Filter state
  const [filterAspects, setFilterAspects] = useState<string[]>([]);
  const [filterTraits, setFilterTraits] = useState<string[]>([]);
  const [filterSets, setFilterSets] = useState<string[]>([]);
  const [availableAspects, setAvailableAspects] = useState<string[]>([]);
  const [availableTraits, setAvailableTraits] = useState<string[]>([]);
  const [availableSets, setAvailableSets] = useState<string[]>([]);

  const loadingRef = useRef(false);
  const cardLoadingStageRef = useRef<string | null>(null);

  // Context
  const {
    currentStage, leaders, base, deckCards, deckName,
    addLeader, removeLeader, setBase: setBaseContext, addCard, removeCard,
    setDeckName, isCardInDeck: isCardIdInDeck, isCardInAspect, resetDeck,
    setCurrentStage: contextSetCurrentStage, totalCards,
  } = useDeckBuilder();

  // Loop detection
  useEffect(() => {
    const visitTimestamp = Date.now();
    let visitHistory: number[] = [];
    try { visitHistory = JSON.parse(sessionStorage.getItem('deckBuilderVisitHistory') || '[]'); }
    catch { visitHistory = []; }
    const recentVisits = visitHistory.filter(ts => visitTimestamp - ts < LOOP_CHECK_WINDOW_MS);
    recentVisits.push(visitTimestamp);
    sessionStorage.setItem('deckBuilderVisitHistory', JSON.stringify(recentVisits));
    if (recentVisits.length > MAX_VISITS_IN_WINDOW) {
      setIsPotentialLoop(true);
      sessionStorage.clear();
    }
    const timer = setTimeout(() => sessionStorage.removeItem('deckBuilderVisitHistory'), LOOP_CHECK_WINDOW_MS + 2000);
    return () => clearTimeout(timer);
  }, []);

  // Load filter options
  useEffect(() => {
    if (currentStage !== 'cards' || availableAspects.length > 0) return;
    Promise.all([fetchAspects(), fetchSets(), fetchTraits()])
      .then(([asp, sets, traits]) => {
        setAvailableAspects(asp.map((a: any) => a.aspect_name).filter(Boolean));
        setAvailableSets(sets.map((s: any) => s.set_name).filter(Boolean));
        setAvailableTraits(traits.map((t: any) => t.trait).filter(Boolean));
      })
      .catch(err => console.error('[DeckBuilder] filter options:', err));
  }, [currentStage, availableAspects.length]);

  // Load cards
  const loadCards = useCallback(async (page = 1, append = false) => {
    if (loadingRef.current || (append && !hasMoreCards)) return;
    loadingRef.current = true;
    if (page === 1 && !append) setLoading(true);
    else if (append) setIsLoadingMore(true);

    const params: FetchCardsParams = {
      page: page.toString(),
      limit: CARDS_PER_PAGE.toString(),
      search: searchQuery || undefined,
    };

    if (currentStage === 'leaders') params.type = 'Leader';
    else if (currentStage === 'base') params.type = 'Base';
    else {
      params.type = cardTypeFilter
        ? cardTypeFilter
        : 'Unit,Event,Upgrade';
      if (filterAspects.length) params.aspect = filterAspects.join(',');
      if (filterTraits.length) params.trait = filterTraits.join(',');
      if (filterSets.length) params.set = filterSets.join(',');
    }

    try {
      const response = await fetchCards(params);
      const newCards = Array.isArray(response.data) ? response.data : [];
      const meta = response.meta || { pages: 1 };
      setCards(prev => append ? [...prev, ...newCards] : newCards);
      setHasMoreCards((meta.pages || 1) > page);
      setCurrentPage(page);
    } catch (err) {
      setError(`Failed to load cards: ${err instanceof Error ? err.message : 'Unknown'}`);
    } finally {
      setLoading(false);
      setIsLoadingMore(false);
      loadingRef.current = false;
    }
  }, [currentStage, searchQuery, filterAspects, filterTraits, filterSets, cardTypeFilter, hasMoreCards]);

  // Load existing deck
  useEffect(() => {
    if (!deckIdParam || isPotentialLoop) { setLoadingDeck(false); return; }
    const processedId = sessionStorage.getItem('processedDeckId');
    if (processedId === deckIdParam) { setLoadingDeck(false); if (currentStage !== 'cards') contextSetCurrentStage('cards'); return; }

    const load = async () => {
      setLoadingDeck(true);
      try {
        sessionStorage.setItem('processedDeckId', deckIdParam);
        const data = await fetchWithAuth(`/api/me/get-deck?id=${encodeURIComponent(deckIdParam)}`);
        if (!data?.id) throw new Error('Invalid deck data');
        resetDeck();
        setDeckName(data.name || 'Untitled Deck');
        data.leaders?.forEach((l: CardType) => l?.id && addLeader(l));
        if (data.base?.id) setBaseContext(data.base);
        data.cards?.forEach((item: { card: CardType; quantity: number }) => item.card?.id && addCard(item.card));
        contextSetCurrentStage('cards');
      } catch (err) {
        setError(`Failed to load deck: ${err instanceof Error ? err.message : 'Unknown'}`);
        sessionStorage.removeItem('processedDeckId');
      } finally { setLoadingDeck(false); }
    };
    load();
  }, [deckIdParam, isPotentialLoop]);

  // Reload cards when stage/filters change
  useEffect(() => {
    if (isPotentialLoop) return;
    const key = `${currentStage}-${searchQuery}-${filterAspects.join(',')}-${filterTraits.join(',')}-${filterSets.join(',')}-${cardTypeFilter}`;
    if (cardLoadingStageRef.current === key) return;
    cardLoadingStageRef.current = key;
    setCards([]);
    setCurrentPage(1);
    setHasMoreCards(true);
    loadCards(1, false);
  }, [currentStage, searchQuery, filterAspects, filterTraits, filterSets, cardTypeFilter, loadCards, isPotentialLoop]);

  const debouncedSearch = useMemo(
    () => debounce((q: string) => setSearchQuery(q), SEARCH_DEBOUNCE_MS),
    []
  );

  // Client-side filtering
  const displayedCards = useMemo(() => {
    let filtered = cards;

    if (currentStage === 'leaders' && leaders.length === 1) {
      const first = leaders[0];
      const firstAspects = first.aspects?.map(a => a.aspect_name) ?? [];
      filtered = filtered.filter(card => {
        if (card.id === first.id) return false;
        const cardAspects = card.aspects?.map(a => a.aspect_name) ?? [];
        if (firstAspects.includes('Heroism') && cardAspects.includes('Villainy')) return false;
        if (firstAspects.includes('Villainy') && cardAspects.includes('Heroism')) return false;
        return firstAspects.some(a => cardAspects.includes(a));
      });
    }
    if (currentStage === 'leaders') {
      const ids = new Set(leaders.map(l => l.id));
      filtered = filtered.filter(c => !ids.has(c.id));
    }
    if (currentStage === 'cards' && hideCardsInDeck) {
      const deckIds = new Set(deckCards.map(dc => dc.card.id));
      filtered = filtered.filter(c => !deckIds.has(c.id));
    }
    if (currentStage === 'cards' && !showAllCards && leaders.length === 2 && base) {
      filtered = filtered.filter(c => isCardInAspect(c));
    }
    return filtered;
  }, [cards, currentStage, leaders, base, hideCardsInDeck, showAllCards, deckCards, isCardInAspect]);

  const handleAddCard = useCallback((card: CardType) => {
    if (currentStage === 'leaders') {
      if (leaders.length < 2 && !leaders.some(l => l.id === card.id)) addLeader(card);
    } else if (currentStage === 'base') {
      if (card.type === 'Base' && !base) setBaseContext(card);
    } else {
      if (!isCardIdInDeck(card.id)) addCard(card);
    }
  }, [currentStage, leaders, base, addLeader, setBaseContext, addCard, isCardIdInDeck]);

  const handleRemoveFromDeck = useCallback((id: string) => {
    if (leaders.some(l => l.id === id)) removeLeader(id);
    else if (base?.id === id) setBaseContext(null);
    else removeCard(id);
  }, [leaders, base, removeLeader, setBaseContext, removeCard]);

  if (isPotentialLoop) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--ts-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', border: '1px solid var(--ts-red)', padding: 32, maxWidth: 400 }}>
          <div style={{ fontFamily: 'var(--ts-font-display)', fontSize: 28, color: 'var(--ts-red)', marginBottom: 12 }}>Loop Detected</div>
          <p style={{ color: 'var(--ts-ink-2)', marginBottom: 16 }}>Too many rapid renders. Deck loading halted.</p>
          <button
            className="ts-btn ts-btn-sm"
            onClick={() => { sessionStorage.clear(); window.location.reload(); }}
            style={{ borderColor: 'var(--ts-red)', color: 'var(--ts-red)' }}
          >
            Clear & Reload
          </button>
        </div>
      </div>
    );
  }

  const colHeight = 'calc(100vh - 90px)'; // nav (60) + status strip (30)

  return (
    <div style={{ background: 'var(--ts-bg)', minHeight: '100vh' }}>
      {/* Top toolbar */}
      <div
        style={{
          padding: '10px 24px',
          background: 'var(--ts-panel)',
          borderBottom: '1px solid var(--ts-line)',
          display: 'flex',
          alignItems: 'center',
          gap: 16,
        }}
      >
        <div className="ts-eyebrow">Atelier · Construction</div>
        <div style={{ width: 1, height: 18, background: 'var(--ts-line)' }} />
        <div style={{ flex: 1, position: 'relative', maxWidth: 520 }}>
          <svg
            width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
            style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--ts-ink-3)' }}
          >
            <circle cx="11" cy="11" r="7" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          <input
            className="ts-input"
            placeholder="Search cards…"
            onChange={e => debouncedSearch(e.target.value)}
            style={{ paddingLeft: 32, fontSize: 13 }}
          />
        </div>

        {/* Stage selector */}
        <div style={{ display: 'flex', gap: 0, border: '1px solid var(--ts-line-2)' }}>
          {(['leaders', 'base', 'cards'] as const).map(stage => (
            <button
              key={stage}
              onClick={() => contextSetCurrentStage(stage)}
              style={{
                padding: '5px 14px',
                fontFamily: 'var(--ts-font-mono)',
                fontSize: 9,
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
                background: currentStage === stage ? 'var(--ts-amber)' : 'transparent',
                color: currentStage === stage ? '#1a1611' : 'var(--ts-ink-3)',
                border: 'none',
                borderRight: stage !== 'cards' ? '1px solid var(--ts-line-2)' : 'none',
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
            >
              {stage.charAt(0).toUpperCase() + stage.slice(1)}
            </button>
          ))}
        </div>

        <span
          style={{
            fontFamily: 'var(--ts-font-mono)',
            fontSize: 11,
            letterSpacing: '0.14em',
            color: totalCards >= 30 ? 'var(--ts-green)' : 'var(--ts-amber)',
          }}
        >
          ◉ {totalCards} / 30 CARDS
        </span>
      </div>

      {/* Error banner */}
      {error && (
        <div
          style={{
            padding: '10px 24px',
            background: 'rgba(255,61,46,0.1)',
            borderBottom: '1px solid var(--ts-red)',
            display: 'flex',
            gap: 12,
            alignItems: 'center',
          }}
        >
          <span style={{ color: 'var(--ts-red)', fontFamily: 'var(--ts-font-mono)', fontSize: 11 }}>{error}</span>
          <button
            className="ts-btn ts-btn-sm"
            onClick={() => setError(null)}
            style={{ borderColor: 'var(--ts-red)', color: 'var(--ts-red)' }}
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Stage banner (leaders / base) */}
      {currentStage !== 'cards' && (
        <div style={{ padding: '0 0' }}>
          <StageBanner
            currentStage={currentStage}
            leaders={leaders}
            base={base}
            resetDeck={resetDeck}
            setStage={contextSetCurrentStage}
            handleRemoveFromDeck={handleRemoveFromDeck}
          />
        </div>
      )}

      {/* 3-column builder grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: currentStage === 'cards' ? '260px 1fr 340px' : '1fr',
          borderTop: '1px solid var(--ts-line)',
          height: currentStage === 'cards' ? colHeight : undefined,
          minHeight: currentStage !== 'cards' ? '60vh' : undefined,
        }}
      >
        {/* Left: filters */}
        {currentStage === 'cards' && (
          <FilterSidebar
            filterAspects={filterAspects} setFilterAspects={setFilterAspects}
            filterTraits={filterTraits} setFilterTraits={setFilterTraits}
            filterSets={filterSets} setFilterSets={setFilterSets}
            cardTypeFilter={cardTypeFilter} setCardTypeFilter={setCardTypeFilter}
            availableAspects={availableAspects}
            availableTraits={availableTraits}
            availableSets={availableSets}
            showAllCards={showAllCards} setShowAllCards={setShowAllCards}
            hideCardsInDeck={hideCardsInDeck} setHideCardsInDeck={setHideCardsInDeck}
            currentStage={currentStage}
          />
        )}

        {/* Middle: card list (always shown) */}
        <div
          style={{
            background: 'var(--ts-bg)',
            borderRight: '1px solid var(--ts-line)',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {currentStage === 'cards' ? (
            <CardListView
              cards={displayedCards}
              deck={{ cards: deckCards }}
              addCard={handleAddCard}
              removeCard={handleRemoveFromDeck}
              loading={loading}
              hasMoreCards={hasMoreCards}
              isLoadingMore={isLoadingMore}
              loadMore={() => loadCards(currentPage + 1, true)}
              isCardInDeck={isCardIdInDeck}
            />
          ) : (
            /* Leaders / base: grid of card images */
            <div style={{ padding: 16, overflowY: 'auto' }}>
              {loading ? (
                <div
                  style={{
                    height: 200,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--ts-ink-3)',
                    fontFamily: 'var(--ts-font-mono)',
                    fontSize: 11,
                  }}
                >
                  Loading…
                </div>
              ) : (
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
                    gap: 10,
                  }}
                >
                  {displayedCards.map(card => (
                    <div
                      key={card.id}
                      onClick={() => handleAddCard(card)}
                      style={{
                        cursor: 'pointer',
                        border: '1px solid var(--ts-line)',
                        overflow: 'hidden',
                        transition: 'border-color 0.15s',
                        position: 'relative',
                      }}
                      onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--ts-amber)'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--ts-line)'; }}
                    >
                      <div style={{ aspectRatio: '7/10' }}>
                        <img
                          src={card.image_uri ?? '/placeholder-card.png'}
                          alt={card.name}
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          onError={e => { (e.target as HTMLImageElement).src = '/placeholder-card.png'; }}
                        />
                      </div>
                      <div
                        style={{
                          padding: '5px 6px',
                          background: 'var(--ts-panel)',
                          borderTop: '1px solid var(--ts-line)',
                        }}
                      >
                        <div
                          style={{
                            fontFamily: 'var(--ts-font-display)',
                            fontSize: 12,
                            color: 'var(--ts-ink)',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {card.name}
                        </div>
                        <div style={{ display: 'flex', gap: 3, marginTop: 3 }}>
                          {card.aspects?.map(a => (
                            <AspectPip key={a.aspect_name} aspect={a.aspect_name} />
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {hasMoreCards && !loading && displayedCards.length > 0 && (
                <div style={{ textAlign: 'center', marginTop: 16 }}>
                  <button
                    className="ts-btn ts-btn-sm"
                    onClick={() => loadCards(currentPage + 1, true)}
                    disabled={isLoadingMore}
                  >
                    {isLoadingMore ? 'Loading…' : 'Load More'}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right: deck panel */}
        {currentStage === 'cards' && (
          <div
            style={{
              background: 'var(--ts-panel)',
              padding: '18px 14px',
              overflowY: 'auto',
            }}
          >
            <DeckPanel
              deckCards={deckCards}
              leaders={leaders}
              base={base}
              deckName={deckName}
              setDeckName={setDeckName}
              addCard={addCard}
              removeCard={handleRemoveFromDeck}
              openHandSim={() => setHandSimMode('sim')}
              openMulligan={() => setHandSimMode('mulligan')}
              onSave={() => setShowSaveDialog(true)}
              totalCards={totalCards}
            />
          </div>
        )}
      </div>

      {/* Modals */}
      <SaveDeckDialog
        isOpen={showSaveDialog}
        onClose={() => setShowSaveDialog(false)}
        existingDeckId={deckIdParam || undefined}
        onSuccess={() => { setShowSaveDialog(false); router.push('/profile'); }}
      />

      {handSimMode && (
        <HandSimModal
          deckCards={deckCards}
          mode={handSimMode}
          onClose={() => setHandSimMode(null)}
        />
      )}
    </div>
  );
}
