'use client';
// Scrollable log panel — reads state.log directly. Auto-scrolls to the latest
// entry so the user always sees the freshest line even during fast AI turns.

import { useEffect, useRef } from 'react';
import type { GameState } from '@/lib/engine-v2';

export interface GameLogProps {
  state: GameState;
  /** Max entries to render. Defaults to 60 — enough for a couple of rounds
   *  of context without exploding the DOM. */
  limit?: number;
}

export function GameLog({ state, limit = 60 }: GameLogProps) {
  const entries = state.log.slice(-limit);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new entries. The state.log array reference
  // changes on every reducer pass, so this fires once per game tick.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end', behavior: 'smooth' });
  }, [state.log.length]);

  return (
    <div style={panelStyle}>
      <div style={titleStyle}>GAME LOG</div>
      <div style={listStyle}>
        {entries.length === 0 ? (
          <div style={emptyStyle}>(no events yet)</div>
        ) : (
          entries.map((e, i) => {
            const isCritical = e.kind === 'critical';
            const prefix = e.player ? `${e.player} · ` : '';
            return (
              <div
                key={i}
                style={{
                  ...lineStyle,
                  color: isCritical ? '#f0c040' : 'rgba(232,220,196,0.7)',
                  fontWeight: isCritical ? 500 : 400,
                  borderLeft: isCritical
                    ? '2px solid rgba(200,160,40,0.5)'
                    : '2px solid transparent',
                }}
                title={`round ${e.round}`}
              >
                <span style={roundChip}>r{e.round}</span>{prefix}{e.message}
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────

const panelStyle: React.CSSProperties = {
  padding: 10,
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 4,
  background: 'rgba(255,255,255,0.02)',
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
  minHeight: 200,
  maxHeight: '40vh',
};

const titleStyle: React.CSSProperties = {
  fontFamily: 'var(--ts-font-mono, monospace)',
  fontSize: 9,
  letterSpacing: '0.1em',
  color: 'rgba(255,255,255,0.4)',
};

const listStyle: React.CSSProperties = {
  flex: 1,
  overflow: 'auto',
  display: 'flex',
  flexDirection: 'column',
  gap: 3,
};

const emptyStyle: React.CSSProperties = {
  fontSize: 11,
  color: 'rgba(255,255,255,0.3)',
  fontStyle: 'italic',
};

const lineStyle: React.CSSProperties = {
  fontSize: 11,
  lineHeight: 1.5,
  paddingLeft: 6,
  fontFamily: 'system-ui, sans-serif',
};

const roundChip: React.CSSProperties = {
  fontFamily: 'var(--ts-font-mono, monospace)',
  fontSize: 9,
  color: 'rgba(255,255,255,0.35)',
  marginRight: 6,
};
