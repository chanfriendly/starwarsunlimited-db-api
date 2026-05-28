'use client';
// Per-player mat. Renders: header (base + counters), arenas (with units),
// hand (own only), resources, deck/discard counts, capture zone, leader row.

import type {
  CardInstance, CardRegistry, GameState, LeaderInstance, PlayerId,
} from '@/lib/engine-v2';
import { effectivePower, effectiveHp } from '@/lib/engine-v2/runtime/modifiers';
import { UnitCard } from './UnitCard';

export interface PlayerMatProps {
  state: GameState;
  registry: CardRegistry;
  pid: PlayerId;
  /** 'self' shows the hand contents; 'opponent' shows the hand as facedown. */
  perspective: 'self' | 'opponent';
}

export function PlayerMat({ state, registry, pid, perspective }: PlayerMatProps) {
  const p = state.players[pid];
  const baseSpec = registry.bases[p.base.cardId];
  const baseHp = (baseSpec?.hp ?? 30) - p.base.damage;
  const isActive = state.activePlayer === pid && !state.winner;
  const hasInitiative = state.initiative === pid;

  return (
    <div style={{ ...matStyle, ...(isActive ? activeRing : {}) }}>
      {/* Header row: name + base + counters */}
      <div style={headerRow}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <strong style={{ fontSize: 14, color: '#f0c040' }}>{p.displayName ?? pid}</strong>
          <span style={mutedStyle}>({pid})</span>
          {hasInitiative && <span style={chipStyle('amber')}>INITIATIVE</span>}
          {isActive && <span style={chipStyle('green')}>ACTIVE</span>}
        </div>
        <div style={baseInfo}>
          <span>{baseSpec?.name ?? 'Base'}</span>
          <span style={{ color: baseHp < 10 ? '#ff7070' : '#7ec47e' }}>{baseHp} HP</span>
          <span style={mutedStyle}>hand {p.hand.length}</span>
          <span style={mutedStyle}>deck {p.deck.length}</span>
          <span style={mutedStyle}>discard {p.discard.length}</span>
        </div>
      </div>

      {/* Leaders */}
      {p.leaders.length > 0 && (
        <div style={leaderRow}>
          <span style={labelStyle}>LEADERS</span>
          {p.leaders.map((l, i) => (
            <LeaderChip key={i} leader={l} registry={registry} />
          ))}
        </div>
      )}

      {/* Arenas */}
      <ArenaRow label="GROUND" units={p.groundArena} state={state} registry={registry} pid={pid} />
      <ArenaRow label="SPACE"  units={p.spaceArena}  state={state} registry={registry} pid={pid} />

      {/* Capture zone */}
      {p.capturedByMe.length > 0 && (
        <div style={capturedRow}>
          <span style={labelStyle}>CAPTURED</span>
          {p.capturedByMe.map((c, i) => {
            const spec = registry.cards[c.cardId];
            return (
              <span key={i} style={capturedChip}>🔒 {spec?.name ?? c.iid}</span>
            );
          })}
        </div>
      )}

      {/* Resources */}
      <div style={resourceRow}>
        <span style={labelStyle}>RESOURCES {p.resources.filter(r => !r.exhausted).length}/{p.resources.length}</span>
        <div style={{ display: 'flex', gap: 4 }}>
          {p.resources.map((r, i) => (
            <span key={i} style={{ ...resourcePip, opacity: r.exhausted ? 0.35 : 1 }}>●</span>
          ))}
        </div>
      </div>

      {/* Hand */}
      <div style={handRow}>
        <span style={labelStyle}>HAND</span>
        {p.hand.length === 0 ? (
          <span style={mutedStyle}>(empty)</span>
        ) : perspective === 'self' ? (
          p.hand.map(c => {
            const spec = registry.cards[c.cardId];
            const cost = spec && 'cost' in spec ? (spec.cost ?? 0) : 0;
            return (
              <span key={c.iid} style={handChip} title={c.iid}>
                {spec?.name ?? c.cardId} <span style={costBadge}>{cost}</span>
              </span>
            );
          })
        ) : (
          Array.from({ length: p.hand.length }).map((_, i) => (
            <span key={i} style={facedownChip}>?</span>
          ))
        )}
      </div>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────

function ArenaRow({
  label, units, state, registry, pid,
}: {
  label: string;
  units: CardInstance[];
  state: GameState;
  registry: CardRegistry;
  pid: PlayerId;
}) {
  return (
    <div style={arenaRow}>
      <span style={labelStyle}>{label}</span>
      {units.length === 0 ? (
        <span style={mutedStyle}>—</span>
      ) : (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {units.map(u => (
            <UnitCard key={u.iid} inst={u} state={state} registry={registry} pid={pid} />
          ))}
        </div>
      )}
    </div>
  );
}

function LeaderChip({ leader, registry }: { leader: LeaderInstance; registry: CardRegistry }) {
  const spec = registry.cards[leader.cardId];
  const label = spec?.name ?? leader.cardId;
  return (
    <span style={{
      ...leaderChip,
      opacity: leader.exhausted ? 0.45 : 1,
      borderColor: leader.isDeployed ? 'rgba(200,160,40,0.5)' : 'rgba(255,255,255,0.2)',
      color: leader.isDeployed ? '#f0c040' : '#e8dcc4',
    }}>
      👑 {label}{leader.isDeployed ? ' (deployed)' : ''}{leader.exhausted ? ' ⊘' : ''}
    </span>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────

const matStyle: React.CSSProperties = {
  padding: 12,
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
};

const activeRing: React.CSSProperties = {
  boxShadow: 'inset 0 0 0 2px rgba(200,160,40,0.5)',
};

const headerRow: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  paddingBottom: 6,
  borderBottom: '1px solid rgba(255,255,255,0.08)',
};

const baseInfo: React.CSSProperties = {
  display: 'flex',
  gap: 12,
  fontSize: 12,
  fontFamily: 'var(--ts-font-mono, monospace)',
};

const arenaRow: React.CSSProperties = {
  display: 'flex',
  gap: 8,
  alignItems: 'flex-start',
  minHeight: 28,
};

const leaderRow: React.CSSProperties = {
  display: 'flex',
  gap: 6,
  alignItems: 'center',
  flexWrap: 'wrap',
};

const capturedRow: React.CSSProperties = {
  display: 'flex',
  gap: 6,
  alignItems: 'center',
  flexWrap: 'wrap',
};

const resourceRow: React.CSSProperties = {
  display: 'flex',
  gap: 8,
  alignItems: 'center',
};

const handRow: React.CSSProperties = {
  display: 'flex',
  gap: 6,
  alignItems: 'center',
  flexWrap: 'wrap',
};

const labelStyle: React.CSSProperties = {
  fontFamily: 'var(--ts-font-mono, monospace)',
  fontSize: 9,
  letterSpacing: '0.08em',
  color: 'rgba(255,255,255,0.4)',
  minWidth: 80,
};

const mutedStyle: React.CSSProperties = {
  color: 'rgba(255,255,255,0.45)',
  fontSize: 11,
  fontFamily: 'var(--ts-font-mono, monospace)',
};

const handChip: React.CSSProperties = {
  padding: '4px 8px',
  fontSize: 11,
  background: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: 3,
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
};

const costBadge: React.CSSProperties = {
  background: 'rgba(200,160,40,0.2)',
  color: '#f0c040',
  borderRadius: '50%',
  width: 18,
  height: 18,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: 10,
  fontFamily: 'var(--ts-font-mono, monospace)',
};

const facedownChip: React.CSSProperties = {
  width: 24,
  height: 32,
  background: 'rgba(20,40,80,0.5)',
  border: '1px solid rgba(100,140,200,0.3)',
  borderRadius: 3,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: 12,
  color: 'rgba(100,140,200,0.7)',
};

const resourcePip: React.CSSProperties = {
  color: '#7ec47e',
  fontSize: 14,
};

const leaderChip: React.CSSProperties = {
  padding: '3px 8px',
  fontSize: 11,
  border: '1px solid',
  borderRadius: 3,
  background: 'rgba(0,0,0,0.3)',
};

const capturedChip: React.CSSProperties = {
  padding: '3px 8px',
  fontSize: 11,
  background: 'rgba(180,60,80,0.15)',
  border: '1px solid rgba(180,60,80,0.4)',
  color: '#e8a0a0',
  borderRadius: 3,
};

function chipStyle(color: 'amber' | 'green'): React.CSSProperties {
  const c = color === 'amber'
    ? { bg: 'rgba(200,160,40,0.2)', fg: '#f0c040', border: 'rgba(200,160,40,0.4)' }
    : { bg: 'rgba(126,196,126,0.15)', fg: '#9ed49e', border: 'rgba(126,196,126,0.4)' };
  return {
    padding: '2px 7px',
    fontFamily: 'var(--ts-font-mono, monospace)',
    fontSize: 9,
    letterSpacing: '0.08em',
    background: c.bg,
    color: c.fg,
    border: `1px solid ${c.border}`,
    borderRadius: 3,
  };
}

// Suppress unused warnings for the helpers imported but not yet used here.
void effectivePower;
void effectiveHp;
