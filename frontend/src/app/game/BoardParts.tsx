'use client';
import React from 'react';
import { CardBack } from './PlayCard';

// ── ResourceLattice ───────────────────────────────────────────────────────────

interface ResourceLatticeProps {
  total: number;
  available: number;
  compact?: boolean;
}

export function ResourceLattice({ total, available, compact }: ResourceLatticeProps) {
  return (
    <div className="resources-strip" style={compact ? { padding: '8px 6px' } : undefined}>
      {Array.from({ length: total }, (_, i) => (
        <div
          key={i}
          className={'res-card' + (i >= available ? ' is-spent' : '')}
          title={i < available ? 'ready' : 'spent'}
        />
      ))}
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
