'use client';
import React from 'react';
import type { PlayerState } from '@/lib/game-engine/types';
import { hasKeyword } from '@/lib/game-engine';
import { PlayCard, toPlayCardProps, BaseCard, toBaseData, LeaderCard, toLeaderData, InitToken } from './PlayCard';
import { ResourceLattice, CardPile } from './BoardParts';

interface YourMatProps {
  player: PlayerState;
  round: number;
  hasInitiative: boolean;
  selectedIid: string | null;
  pendingAttackerIid: string | null;
  canPlayIids: Set<string>;
  legalDeployIds: Set<string>;
  /** True during the opening setup phase (select up to 2 resources before round 1) */
  isSetupPhase: boolean;
  isResourcePhase: boolean;
  /** True when the player controls 3+ units — Coordinate abilities are active */
  coordinateActive: boolean;
  onUnitClick: (iid: string) => void;
  onHandCardClick: (iid: string) => void;
  onDeployLeader: (cardId: string) => void;
  onResourceCard: (iid: string) => void;
  onSkipResource: () => void;
}

export function YourMat({
  player, round, hasInitiative, selectedIid, pendingAttackerIid,
  canPlayIids, legalDeployIds, isSetupPhase, isResourcePhase, coordinateActive,
  onUnitClick, onHandCardClick, onDeployLeader, onResourceCard, onSkipResource,
}: YourMatProps) {
  const base = toBaseData(player.base);
  // Only show the Coordinate badge when both: threshold met AND a Coordinate unit is in play
  const hasCoordinateUnit = [...player.groundArena, ...player.spaceArena]
    .some(ci => hasKeyword(ci.card, 'Coordinate'));
  const showCoordinateBadge = coordinateActive && hasCoordinateUnit;

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '1.4fr 168px 1.4fr',
      gridTemplateRows: 'minmax(180px, 1fr) auto auto',
      gap: 18,
      padding: '14px 16px 4px',
      flex: 1,
      minHeight: 0,
    }}>
      {/* ── Ground arena ─────────────────────────────────────────── */}
      <div className="zone" style={{ gridColumn: 1, gridRow: 1 }}>
        <span className="zone-label" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          ◆ Ground Arena · You
          {showCoordinateBadge && (
            <span style={{
              fontSize: 8, letterSpacing: '0.2em', padding: '1px 6px',
              border: '1px solid #4ade80', color: '#4ade80', borderRadius: 2,
            }}>COORDINATE</span>
          )}
        </span>
        <div className="arena-grid">
          {player.groundArena.length === 0
            ? <div className="arena-empty">No ground units deployed</div>
            : player.groundArena.map(ci => {
                const canAttack = !ci.exhausted;
                return (
                  <PlayCard
                    key={ci.iid}
                    card={toPlayCardProps(ci)}
                    size="md"
                    clickable={canAttack}
                    selected={pendingAttackerIid === ci.iid}
                    onClick={canAttack ? () => onUnitClick(ci.iid) : undefined}
                  />
                );
              })}
        </div>
      </div>

      {/* ── Center: base + leaders ────────────────────────────────── */}
      <div style={{ gridColumn: 2, gridRow: 1, display: 'flex', flexDirection: 'column', gap: 14, alignItems: 'center' }}>
        <div className="zone" style={{ width: '100%', padding: '14px 8px 8px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <span className="zone-label">Base</span>
          <BaseCard base={base} size="md" />
        </div>
        <div className="zone" style={{ width: '100%', padding: '14px 8px 8px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
          <span className="zone-label">Leaders</span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {player.leaders.map(li => {
              const canDeploy = !li.isDeployed && legalDeployIds.has(li.card.id);
              return (
                <div key={li.card.id} style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'center' }}>
                  <LeaderCard leader={toLeaderData(li)} size="sm" />
                  {canDeploy && (
                    <button
                      onClick={() => onDeployLeader(li.card.id)}
                      className="div-btn"
                      style={{ fontSize: 8, padding: '2px 10px' }}
                    >
                      DEPLOY
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Space arena ──────────────────────────────────────────── */}
      <div className="zone" style={{ gridColumn: 3, gridRow: 1 }}>
        <span className="zone-label">◆ Space Arena · You</span>
        <div className="arena-grid">
          {player.spaceArena.length === 0
            ? <div className="arena-empty">No vehicles in space</div>
            : player.spaceArena.map(ci => {
                const canAttack = !ci.exhausted;
                return (
                  <PlayCard
                    key={ci.iid}
                    card={toPlayCardProps(ci)}
                    size="md"
                    clickable={canAttack}
                    selected={pendingAttackerIid === ci.iid}
                    onClick={canAttack ? () => onUnitClick(ci.iid) : undefined}
                  />
                );
              })}
        </div>
      </div>

      {/* ── Resources (spans cols 1-2) ────────────────────────────── */}
      <div className="zone" style={{ gridColumn: '1 / 3', gridRow: 2, height: 72 }}>
        <span className="zone-label">
          ◆ Resources · {player.resources.available} ready · {player.resources.total} total
        </span>
        <ResourceLattice total={player.resources.total} available={player.resources.available} />
      </div>

      {/* ── Deck / Discard / Init (col 3) ────────────────────────── */}
      <div style={{ gridColumn: 3, gridRow: 2, display: 'flex', gap: 8, alignItems: 'flex-end', justifyContent: 'flex-end', height: 72 }}>
        <CardPile count={player.deck.length} label="Deck" faceDown size="sm" />
        <CardPile count={player.discard.length} label="Discard" faceDown size="sm" />
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
          <InitToken hasInit={hasInitiative} round={round} />
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.2em', color: 'var(--ink-3)', textTransform: 'uppercase' }}>
            Init
          </span>
        </div>
      </div>

      {/* ── Hand (spans full width) ───────────────────────────────── */}
      <div style={{ gridColumn: '1 / 4', gridRow: 3, position: 'relative', minHeight: 132 }}>
        {isSetupPhase ? (
          <>
            <div style={{
              position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)',
              fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.24em',
              color: 'var(--saber-amber)', textTransform: 'uppercase',
              background: 'var(--bg)', padding: '2px 14px', border: '1px solid var(--saber-amber)',
              zIndex: 2, whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 10,
            }}>
              <span>SETUP · Select up to {player.setupResourcesLeft} card{player.setupResourcesLeft !== 1 ? 's' : ''} to resource</span>
              <button
                onClick={onSkipResource}
                className="div-btn"
                style={{ fontSize: 8, padding: '1px 8px', marginLeft: 4 }}
              >
                DONE
              </button>
            </div>
            <div className="hand-row">
              {player.hand.map(ci => (
                <PlayCard
                  key={ci.iid}
                  card={toPlayCardProps(ci)}
                  size="md"
                  clickable
                  onClick={() => onResourceCard(ci.iid)}
                />
              ))}
            </div>
          </>
        ) : isResourcePhase ? (
          <>
            <div style={{
              position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)',
              fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.24em',
              color: 'var(--saber-amber)', textTransform: 'uppercase',
              background: 'var(--bg)', padding: '2px 14px', border: '1px solid var(--saber-amber)',
              zIndex: 2, whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 10,
            }}>
              <span>REGROUP · Select a card to resource</span>
              <button
                onClick={onSkipResource}
                className="div-btn"
                style={{ fontSize: 8, padding: '1px 8px', marginLeft: 4 }}
              >
                SKIP
              </button>
            </div>
            <div className="hand-row">
              {player.hand.map(ci => (
                <PlayCard
                  key={ci.iid}
                  card={toPlayCardProps(ci)}
                  size="md"
                  clickable
                  onClick={() => onResourceCard(ci.iid)}
                />
              ))}
            </div>
          </>
        ) : (
          <>
            <div style={{
              position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)',
              fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.24em',
              color: 'var(--ink-3)', textTransform: 'uppercase',
              background: 'var(--bg)', padding: '2px 14px', border: '1px solid var(--line)',
              zIndex: 2, whiteSpace: 'nowrap',
            }}>
              Hand · {player.hand.length} cards
              {selectedIid && canPlayIids.has(selectedIid) && (
                <span style={{ color: 'var(--saber-amber)', marginLeft: 8 }}>· tap again to play</span>
              )}
            </div>
            <div className="hand-row">
              {player.hand.map(ci => (
                <PlayCard
                  key={ci.iid}
                  card={toPlayCardProps(ci)}
                  size="md"
                  clickable={canPlayIids.has(ci.iid)}
                  selected={selectedIid === ci.iid}
                  onClick={canPlayIids.has(ci.iid) ? () => onHandCardClick(ci.iid) : undefined}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
