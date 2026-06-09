'use client';
// Hover-to-preview a card during playtest: shows the printed name, type, cost,
// stats, traits and oracle text in a floating panel that follows the cursor.
// The oracle text is carried on the translated spec (`spec.text`); without it
// it's hard to know what a card on the board / in hand actually does.

import { useState } from 'react';
import { createPortal } from 'react-dom';
import type { CardSpec } from '@/lib/engine-v2';

interface CardHoverProps {
  spec?: CardSpec;
  /** Effective (live) stats to show instead of printed — used for board units. */
  power?: number;
  hp?: number;
  hpRemaining?: number;
  children: React.ReactNode;
  style?: React.CSSProperties;
}

export function CardHover({ spec, power, hp, hpRemaining, children, style }: CardHoverProps) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  if (!spec) return <>{children}</>;
  return (
    <span
      style={{ display: 'inline-flex', ...style }}
      onMouseEnter={(e) => setPos({ x: e.clientX, y: e.clientY })}
      onMouseMove={(e) => setPos({ x: e.clientX, y: e.clientY })}
      onMouseLeave={() => setPos(null)}
    >
      {children}
      {pos && typeof document !== 'undefined' && createPortal(
        <Preview spec={spec} power={power} hp={hp} hpRemaining={hpRemaining} x={pos.x} y={pos.y} />,
        document.body,
      )}
    </span>
  );
}

function Preview({ spec, power, hp, hpRemaining, x, y }: { spec: CardSpec; power?: number; hp?: number; hpRemaining?: number; x: number; y: number }) {
  const W = 300;
  const printed = spec as unknown as { power?: number; hp?: number; arena?: string };
  const isUnit = spec.type === 'unit' || spec.type === 'token' || spec.type === 'leader';
  const pow = power ?? printed.power;
  const maxHp = hp ?? printed.hp;
  const aspects = spec.aspects ?? [];
  const traits = spec.traits ?? [];
  const text = (spec.text ?? '').trim();

  // Clamp to viewport (cursor-anchored, offset to the lower-right by default).
  const vw = typeof window !== 'undefined' ? window.innerWidth : 1280;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 800;
  const left = Math.min(x + 18, vw - W - 12);
  const top = Math.min(y + 18, vh - 220);

  return (
    <div style={{ ...panel, left: Math.max(8, left), top: Math.max(8, top), width: W }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
        <div style={{ fontFamily: 'var(--ts-font-display)', fontSize: 17, color: 'var(--ts-ink)', lineHeight: 1.15 }}>
          {spec.name}{spec.unique ? ' ◆' : ''}
        </div>
        {spec.cost != null && <div style={costPip}>{spec.cost}</div>}
      </div>
      {spec.subtitle && (
        <div style={{ fontFamily: 'var(--ts-font-body)', fontStyle: 'italic', fontSize: 11, color: 'var(--ts-ink-3)', marginTop: 1 }}>{spec.subtitle}</div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
        <span style={metaTag}>{spec.type}{printed.arena ? ` · ${printed.arena}` : ''}</span>
        {aspects.map(a => <span key={a} style={metaTag}>{a}</span>)}
        {isUnit && pow != null && maxHp != null && (
          <span style={{ ...metaTag, color: 'var(--ts-amber)', borderColor: 'var(--ts-line-2)' }}>
            {pow} / {hpRemaining != null && hpRemaining !== maxHp ? `${hpRemaining}·${maxHp}` : maxHp}
          </span>
        )}
      </div>

      {traits.length > 0 && (
        <div style={{ fontFamily: 'var(--ts-font-mono)', fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--ts-ink-4)', marginTop: 8 }}>
          {traits.join(' · ')}
        </div>
      )}

      {text && (
        <>
          <div className="ts-rule" style={{ margin: '8px 0' }} />
          <div style={{ fontFamily: 'var(--ts-font-body)', fontSize: 12.5, lineHeight: 1.5, color: 'var(--ts-ink-2)', whiteSpace: 'pre-wrap' }}>{text}</div>
        </>
      )}
    </div>
  );
}

const panel: React.CSSProperties = {
  position: 'fixed',
  zIndex: 1000,
  pointerEvents: 'none',
  background: 'var(--ts-bg-2)',
  border: '1px solid var(--ts-line-2)',
  boxShadow: '0 8px 30px rgba(0,0,0,0.6)',
  padding: '12px 14px',
};

const costPip: React.CSSProperties = {
  fontFamily: 'var(--ts-font-mono)',
  fontSize: 13,
  fontWeight: 700,
  color: 'var(--ts-amber)',
  border: '1px solid var(--ts-line-2)',
  borderRadius: '50%',
  width: 24,
  height: 24,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
};

const metaTag: React.CSSProperties = {
  fontFamily: 'var(--ts-font-mono)',
  fontSize: 9,
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
  color: 'var(--ts-ink-3)',
  border: '1px solid var(--ts-line)',
  padding: '2px 6px',
};
