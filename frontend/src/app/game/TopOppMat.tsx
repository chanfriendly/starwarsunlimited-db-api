'use client';
import React from 'react';
import type { PlayerState } from '@/lib/game-engine/types';
import { PlayCard, toPlayCardProps, BaseCard, toBaseData, LeaderCard, toLeaderData, InitToken, CardBack } from './PlayCard';
import { HpReadout, Counter, ResourceLattice } from './BoardParts';

interface TopOppMatProps {
  player: PlayerState;
  round: number;
  hasInitiative: boolean;
  attackTargetIids: Set<string>;
  canAttackBase: boolean;
  onUnitClick: (iid: string) => void;
  onAttackBase: () => void;
  displayName: string;
}

export function TopOppMat({
  player, round, hasInitiative, attackTargetIids, canAttackBase,
  onUnitClick, onAttackBase, displayName,
}: TopOppMatProps) {
  const base   = toBaseData(player.base);
  const handle = displayName.substring(0, 2).toUpperCase();

  return (
    <div
      className="seat"
      style={{
        display: 'grid',
        gridTemplateColumns: '1.2fr 148px 1.2fr',
        gridTemplateRows: 'auto auto minmax(120px, 1fr) auto',
        gap: 12,
        padding: 10,
        flex: 1, minHeight: 0,
      }}
    >
      {/* ── Header bar ───────────────────────────────────────────── */}
      <div className="seat-header" style={{ gridColumn: '1 / 4', gridRow: 1, marginBottom: 0 }}>
        <div className="seat-avatar">{handle}</div>
        <div style={{ flex: 1 }}>
          <div className="seat-name">{displayName}</div>
          <div className="seat-sub">
            {player.leaders[0]?.card.name ?? 'AI Opponent'}
          </div>
        </div>
        <HpReadout hp={base.hp} maxHp={base.maxHp} />
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <Counter label="Hand" value={player.hand.length} />
          <Counter label="Deck" value={player.deck.length} />
          <Counter label="Disc" value={player.discard.length} />
          {hasInitiative && <InitToken hasInit round={round} />}
        </div>
      </div>

      {/* ── Hand (face down) ─────────────────────────────────────── */}
      <div style={{ gridColumn: '1 / 4', gridRow: 2, display: 'flex', justifyContent: 'center' }}>
        <div className="hand-opp">
          {player.hand.map(ci => <CardBack key={ci.iid} size="xs" />)}
        </div>
      </div>

      {/* ── Ground arena ─────────────────────────────────────────── */}
      <div className="zone" style={{ gridColumn: 1, gridRow: 3 }}>
        <span className="zone-label">◆ Ground · {displayName}</span>
        <div className="arena-grid">
          {player.groundArena.length === 0
            ? <div className="arena-empty">— no ground units —</div>
            : player.groundArena.map(ci => {
                const isTarget = attackTargetIids.has(ci.iid);
                return (
                  <PlayCard
                    key={ci.iid}
                    card={toPlayCardProps(ci)}
                    size="sm"
                    target={isTarget}
                    clickable={isTarget}
                    onClick={isTarget ? () => onUnitClick(ci.iid) : undefined}
                  />
                );
              })}
        </div>
      </div>

      {/* ── Center: base + leaders ────────────────────────────────── */}
      <div style={{ gridColumn: 2, gridRow: 3, display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center' }}>
        <div className="zone" style={{ width: '100%', padding: '12px 6px 6px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <span className="zone-label">Base</span>
          <BaseCard
            base={base}
            size="sm"
            isTarget={canAttackBase}
            onClick={canAttackBase ? onAttackBase : undefined}
          />

        </div>
        <div className="zone" style={{ width: '100%', padding: '12px 6px 6px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
          <span className="zone-label">Leaders</span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {player.leaders.map(li => (
              <LeaderCard key={li.card.id} leader={toLeaderData(li)} size="sm" />
            ))}
          </div>
        </div>
      </div>

      {/* ── Space arena ──────────────────────────────────────────── */}
      <div className="zone" style={{ gridColumn: 3, gridRow: 3 }}>
        <span className="zone-label">◆ Space · {displayName}</span>
        <div className="arena-grid">
          {player.spaceArena.length === 0
            ? <div className="arena-empty">— space clear —</div>
            : player.spaceArena.map(ci => {
                const isTarget = attackTargetIids.has(ci.iid);
                return (
                  <PlayCard
                    key={ci.iid}
                    card={toPlayCardProps(ci)}
                    size="sm"
                    target={isTarget}
                    clickable={isTarget}
                    onClick={isTarget ? () => onUnitClick(ci.iid) : undefined}
                  />
                );
              })}
        </div>
      </div>

      {/* ── Resources ────────────────────────────────────────────── */}
      <div className="zone" style={{ gridColumn: '1 / 4', gridRow: 4, height: 48 }}>
        <span className="zone-label">
          ◆ Resources · {player.resources.available} ready · {player.resources.total} total
        </span>
        <ResourceLattice
          total={player.resources.total}
          available={player.resources.available}
          compact
        />
      </div>
    </div>
  );
}
