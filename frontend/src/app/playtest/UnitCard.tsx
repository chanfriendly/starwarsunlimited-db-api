'use client';
// One unit in an arena. Shows: name, effective power/HP, damage indicator,
// exhausted overlay, shield count, attached upgrades stacked below.

import type { CardInstance, CardRegistry, GameState, PlayerId } from '@/lib/engine-v2';
import { effectivePower, effectiveHp } from '@/lib/engine-v2/runtime/modifiers';

export interface UnitCardProps {
  inst: CardInstance;
  state: GameState;
  registry: CardRegistry;
  pid: PlayerId;
}

export function UnitCard({ inst, state, registry, pid }: UnitCardProps) {
  const spec = registry.cards[inst.cardId];
  const name = spec?.name ?? inst.cardId;
  const pow = effectivePower(state, registry, inst, pid);
  const hp = effectiveHp(state, registry, inst, pid);
  const hpRem = Math.max(0, hp - inst.damage);
  const isToken = inst.isToken;

  return (
    <div style={{ ...cardWrap, opacity: inst.exhausted ? 0.55 : 1 }}>
      <div style={{ ...cardBody, borderColor: isToken ? 'rgba(140,140,255,0.45)' : 'rgba(200,160,40,0.4)' }}>
        <div style={cardName} title={inst.iid}>
          {isToken ? '✨ ' : ''}{name}
        </div>
        <div style={cardStats}>
          <span style={statPow}>{pow}</span>
          <span style={statSep}>/</span>
          <span style={{ ...statHp, color: inst.damage > 0 ? '#ff9a5a' : '#7ec47e' }}>
            {hpRem}{inst.damage > 0 ? `/${hp}` : ''}
          </span>
          {inst.shieldTokens > 0 && (
            <span style={shieldChip}>🛡{inst.shieldTokens > 1 ? inst.shieldTokens : ''}</span>
          )}
        </div>
        {inst.exhausted && <div style={exhaustOverlay}>EXHAUSTED</div>}
      </div>
      {/* Upgrades — small chips stacked below the host */}
      {inst.upgrades.length > 0 && (
        <div style={upgradeStack}>
          {inst.upgrades.map(u => {
            const us = registry.cards[u.cardId];
            return (
              <span key={u.iid} style={upgradeChip} title={u.iid}>
                📎 {us?.name ?? u.cardId}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────

const cardWrap: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 2,
};

const cardBody: React.CSSProperties = {
  position: 'relative',
  width: 130,
  minHeight: 60,
  padding: '6px 8px',
  background: 'linear-gradient(180deg, rgba(40,30,15,0.8), rgba(20,15,10,0.8))',
  border: '1px solid',
  borderRadius: 4,
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'space-between',
};

const cardName: React.CSSProperties = {
  fontSize: 11,
  lineHeight: 1.2,
  color: '#e8dcc4',
  fontWeight: 500,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

const cardStats: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 2,
  fontFamily: 'var(--ts-font-mono, monospace)',
  fontSize: 13,
  fontWeight: 600,
};

const statPow: React.CSSProperties = {
  color: '#ff9a5a',
};

const statSep: React.CSSProperties = {
  color: 'rgba(255,255,255,0.4)',
};

const statHp: React.CSSProperties = {
  color: '#7ec47e',
};

const shieldChip: React.CSSProperties = {
  marginLeft: 'auto',
  fontSize: 10,
  color: '#c0d8ff',
};

const exhaustOverlay: React.CSSProperties = {
  position: 'absolute',
  top: '50%',
  left: 0,
  right: 0,
  transform: 'translateY(-50%)',
  textAlign: 'center',
  fontFamily: 'var(--ts-font-mono, monospace)',
  fontSize: 9,
  letterSpacing: '0.15em',
  color: 'rgba(255,255,255,0.5)',
  background: 'rgba(0,0,0,0.6)',
  pointerEvents: 'none',
};

const upgradeStack: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 2,
};

const upgradeChip: React.CSSProperties = {
  padding: '2px 6px',
  fontSize: 9,
  background: 'rgba(100,140,200,0.15)',
  border: '1px solid rgba(100,140,200,0.4)',
  color: '#a8c8ff',
  borderRadius: 2,
  fontFamily: 'var(--ts-font-mono, monospace)',
};
