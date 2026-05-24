'use client';
import React from 'react';
import type { CardInstance } from '@/lib/game-engine/types';
import { CardBack, emitHoverCard, type PlayCardData } from './PlayCard';

// ── ResCard — card-back-art mini card for resource display ────────────────────

function ResCard({ w, h }: { w: number; h: number }) {
  return (
    <div style={{
      width: w, height: h,
      position: 'relative',
      background: [
        'radial-gradient(1px 1px at 15% 15%, rgba(220,235,255,0.9) 50%, transparent)',
        'radial-gradient(1px 1px at 65% 22%, rgba(200,220,255,0.7) 50%, transparent)',
        'radial-gradient(1px 1px at 82% 68%, rgba(220,235,255,0.8) 50%, transparent)',
        'radial-gradient(1px 1px at 28% 78%, rgba(180,210,255,0.6) 50%, transparent)',
        'radial-gradient(1px 1px at 48% 48%, rgba(210,228,255,0.65) 50%, transparent)',
        'radial-gradient(1px 1px at 90% 12%, rgba(200,230,255,0.6) 50%, transparent)',
        'linear-gradient(160deg, #03060e, #06101e, #020508)',
      ].join(', '),
      border: '1px solid rgba(100,140,200,0.28)',
      borderRadius: 2,
      overflow: 'hidden',
      flexShrink: 0,
    }}>
      <svg
        viewBox={`0 0 ${w} ${h}`}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
        xmlns="http://www.w3.org/2000/svg"
      >
        <line
          x1={w * 0.1} y1={h * 0.08} x2={w * 0.9} y2={h * 0.92}
          stroke="rgba(180,210,255,0.68)" strokeWidth="1.4"
        />
        <line
          x1={w * 0.9} y1={h * 0.08} x2={w * 0.1} y2={h * 0.92}
          stroke="rgba(200,220,255,0.62)" strokeWidth="1.4"
        />
        <rect
          x={w * 0.06} y={h * 0.05} width={w * 0.88} height={h * 0.9}
          fill="none" stroke="rgba(180,200,255,0.2)" strokeWidth="0.6" rx="1"
        />
      </svg>
    </div>
  );
}

// ── ResourceLattice ───────────────────────────────────────────────────────────

interface ResourceLatticeProps {
  total: number;
  available: number;
  compact?: boolean;
  /** Ordered list of cards in the resource zone — enables hover-to-identify. */
  resourcePile?: CardInstance[];
}

/** Build a PlayCardData hover payload from a CardInstance in the resource zone. */
function toResourceHoverData(ci: CardInstance): PlayCardData {
  return {
    iid: ci.iid,
    name: ci.card.name,
    subtitle: ci.card.subtitle,
    type: ci.card.type,
    cost: ci.card.energy_cost ?? ci.card.cost,
    aspects: (ci.card.aspects ?? []).map(a => a.aspect_name),
    power: ci.card.attack,
    hp: ci.card.health,
    maxHp: ci.card.health,
    damage: 0,
    exhausted: false,
    upgrades: [],
    image_uri: ci.card.image_uri ?? ci.card.image_url,
    text: ci.card.text,
    keywords: ci.card.keywords,
  };
}

export function ResourceLattice({ total, available, compact, resourcePile }: ResourceLatticeProps) {
  // Portrait dimensions (ready = upright, spent = rotated -90deg = landscape)
  const W = compact ? 18 : 26;  // portrait width
  const H = compact ? 26 : 38;  // portrait height

  return (
    <div className={'resources-strip' + (compact ? ' is-compact' : '')}>
      {Array.from({ length: total }, (_, i) => {
        const isReady = i < available;
        const ci = resourcePile?.[i];
        const hoverData = ci ? toResourceHoverData(ci) : undefined;
        // Wrapper sized to match the card's visual footprint after rotation.
        // Ready: portrait (W × H). Spent: landscape (H × W).
        return (
          <div
            key={i}
            title={isReady ? 'ready' : 'spent'}
            style={{
              position: 'relative',
              flexShrink: 0,
              width:  isReady ? W : H,
              height: isReady ? H : W,
              opacity: isReady ? 1 : 0.42,
              filter: isReady ? 'none' : 'grayscale(0.55)',
              transition: 'opacity 0.3s, filter 0.3s',
              cursor: hoverData ? 'help' : 'default',
            }}
            onMouseEnter={hoverData ? (e) => emitHoverCard({ card: hoverData, label: 'Resource', x: e.clientX, y: e.clientY }) : undefined}
            onMouseMove={hoverData ? (e) => emitHoverCard({ card: hoverData, label: 'Resource', x: e.clientX, y: e.clientY }) : undefined}
            onMouseLeave={hoverData ? () => emitHoverCard(null) : undefined}
          >
            <div style={{
              position: 'absolute',
              left: '50%', top: '50%',
              transform: `translate(-50%, -50%)${isReady ? '' : ' rotate(-90deg)'}`,
              transition: 'transform 0.35s ease',
            }}>
              <ResCard w={W} h={H} />
            </div>
          </div>
        );
      })}
      {total === 0 && (
        <span style={{
          fontFamily: 'var(--font-mono)', fontSize: 9,
          letterSpacing: '0.22em', color: 'var(--ink-4)', textTransform: 'uppercase',
        }}>
          No resources
        </span>
      )}
    </div>
  );
}

// ── CardPile ──────────────────────────────────────────────────────────────────

interface CardPileProps {
  count: number;
  label?: string;
  faceDown?: boolean;
  size?: 'sm' | 'md';
}

const PILE_DIMS = {
  sm: { w: 64, h: 90  },
  md: { w: 78, h: 110 },
};

export function CardPile({ count, label, faceDown = true, size = 'md' }: CardPileProps) {
  const dims = PILE_DIMS[size];

  if (count === 0) {
    return (
      <div className="pile" style={{ flexDirection: 'column', alignItems: 'center', gap: 4 }}>
        <div className="pile-empty" style={{ width: dims.w, height: dims.h }}>EMPTY</div>
        {label && (
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.2em', color: 'var(--ink-3)', textTransform: 'uppercase' }}>
            {label}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="pile" style={{ flexDirection: 'column', alignItems: 'center', gap: 4 }}>
      <div style={{ position: 'relative', width: dims.w, height: dims.h }}>
        {count >= 3 && (
          <div style={{ position: 'absolute', inset: 0, background: 'var(--panel)', border: '1px solid var(--line-2)', transform: 'translate(3px, 3px)', borderRadius: 3 }} />
        )}
        {count >= 2 && (
          <div style={{ position: 'absolute', inset: 0, background: 'var(--panel)', border: '1px solid var(--line-2)', transform: 'translate(1.5px, 1.5px)', borderRadius: 3 }} />
        )}
        <div style={{ position: 'absolute', inset: 0 }}>
          <CardBack size={size} />
        </div>
        <span className="pile-count">{count}</span>
      </div>
      {label && (
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.2em', color: 'var(--ink-3)', textTransform: 'uppercase' }}>
          {label}
        </div>
      )}
    </div>
  );
}

// ── HpReadout ─────────────────────────────────────────────────────────────────

interface HpReadoutProps {
  hp: number;
  maxHp: number;
  expanded?: boolean;
}

export function HpReadout({ hp, maxHp, expanded }: HpReadoutProps) {
  const pct    = maxHp > 0 ? hp / maxHp : 0;
  const level  = pct > 0.66 ? 'hi' : pct > 0.33 ? 'mid' : 'low';
  const color  = level === 'hi' ? 'var(--saber-green)' : level === 'mid' ? 'var(--saber-amber)' : 'var(--saber-red)';
  return (
    <div className="hp-readout" style={expanded ? { width: '100%' } : {}}>
      <span style={{ fontSize: 9, letterSpacing: '0.2em', color: 'var(--ink-3)', textTransform: 'uppercase' }}>Base</span>
      <span style={{ color, fontWeight: 700 }}>
        {hp}<span style={{ color: 'var(--ink-4)' }}>/{maxHp}</span>
      </span>
      <div className="hp-readout-bar" style={expanded ? { flex: 1 } : {}}>
        <div className="hp-readout-fill" data-hp={level} style={{ width: `${pct * 100}%` }} />
      </div>
    </div>
  );
}

// ── Counter ───────────────────────────────────────────────────────────────────

export function Counter({ label, value }: { label: string; value: string | number }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 36 }}>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.18em', color: 'var(--ink-3)', textTransform: 'uppercase' }}>
        {label}
      </span>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: 'var(--ink)', fontWeight: 600 }}>
        {value}
      </span>
    </div>
  );
}

// ── Stamp ─────────────────────────────────────────────────────────────────────

export function Stamp({ label }: { label: string }) {
  return (
    <span style={{
      display: 'inline-block', padding: '2px 8px',
      fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.22em',
      textTransform: 'uppercase', color: 'var(--saber-red)',
      border: '1px solid var(--saber-red)', transform: 'rotate(-2deg)', opacity: 0.85,
    }}>
      {label}
    </span>
  );
}
