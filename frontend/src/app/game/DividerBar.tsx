'use client';
import React, { useState } from 'react';
import type { LogEntry, PlayerId } from '@/lib/game-engine/types';
import { InitToken } from './PlayCard';

interface DividerBarProps {
  round: number;
  phase: 'action' | 'regroup' | 'setup';
  activePlayer: PlayerId;
  initiative: PlayerId;
  playerName: string;
  isMyTurn: boolean;
  isAiThinking: boolean;
  isSetupPhase: boolean;
  isResourcePhase: boolean;
  canTakeCounter: boolean;
  onTakeCounter: () => void;
  actionLog: LogEntry[];
  winner?: PlayerId | 'draw';
}

export function DividerBar({
  round, phase, initiative, playerName,
  isMyTurn, isAiThinking, isSetupPhase, isResourcePhase, canTakeCounter, onTakeCounter, actionLog, winner,
}: DividerBarProps) {
  const [logOpen, setLogOpen] = useState(false);

  function actorLabel(entry: LogEntry) {
    if (!entry.player) return null;
    const isPlayer = entry.player === 'player1';
    const name     = isPlayer ? playerName : 'AI';
    const color    = isPlayer ? 'var(--saber-blue)' : 'var(--saber-red)';
    return (
      <span className="lg-actor" style={{ color, borderColor: color }}>
        {name}
      </span>
    );
  }

  return (
    <div className="divider-bar">
      <div className="divider-main">

        {/* Left: round + phase */}
        <div className="divider-left">
          <span className="round-num">{round}</span>
          <div>
            <div className="phase">
              <strong>{phase === 'action' ? 'Action' : phase === 'setup' ? 'Setup' : 'Regroup'}</strong>
              {phase === 'regroup' && !isResourcePhase && (
                <span style={{ color: 'var(--ink-4)', marginLeft: 6 }}>auto…</span>
              )}
              {phase === 'setup' && !isSetupPhase && (
                <span style={{ color: 'var(--ink-4)', marginLeft: 6 }}>AI selecting…</span>
              )}
            </div>
            <div style={{ fontSize: 9, letterSpacing: '0.18em', textTransform: 'uppercase', marginTop: 2,
              color: (isSetupPhase || isResourcePhase) ? 'var(--saber-amber)' : 'var(--ink-3)' }}>
              {isSetupPhase   ? 'Select resources ↓'
                : isResourcePhase ? 'Select resource ↓'
                : isAiThinking ? 'AI thinking…'
                : isMyTurn    ? 'Your turn'
                : 'Waiting…'}
            </div>
          </div>
        </div>

        {/* Center: initiative + winner / action buttons */}
        <div className="divider-center">
          <InitToken hasInit={initiative === 'player1'} round={round} />
          {winner && (
            <span style={{
              fontFamily: 'var(--font-display)', fontSize: 18,
              color: winner === 'player1' ? 'var(--saber-green)' : winner === 'draw' ? 'var(--saber-amber)' : 'var(--saber-red)',
            }}>
              {winner === 'player1' ? 'VICTORY' : winner === 'draw' ? 'DRAW' : 'DEFEAT'}
            </span>
          )}
          {!winner && canTakeCounter && (
            <button className="div-btn is-primary" onClick={onTakeCounter}>
              Take Initiative
            </button>
          )}
          {!winner && !canTakeCounter && isMyTurn && (
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--saber-blue)', letterSpacing: '0.12em' }}>
              ACT OR ATTACK
            </span>
          )}
        </div>

        {/* Right: last log entry + log toggle */}
        <div className="divider-right">
          {actionLog.length > 0 && (
            <div className="last-log-entry" title={actionLog[actionLog.length - 1].message}>
              {actionLog[actionLog.length - 1].message}
            </div>
          )}
          <button className={'div-btn' + (logOpen ? ' is-active' : '')} onClick={() => setLogOpen(o => !o)}>
            LOG
          </button>
        </div>
      </div>

      {/* Log drawer */}
      {logOpen && (
        <div className="divider-log">
          {actionLog.length === 0 && (
            <div style={{ color: 'var(--ink-4)', fontStyle: 'italic', fontSize: 10 }}>No actions yet</div>
          )}
          {[...actionLog].reverse().map((entry, i) => (
            <div key={i} className="divider-log-row">
              <span className="lg-rnd">R{entry.round}</span>
              {actorLabel(entry)}
              <span className="lg-msg" style={entry.kind === 'critical' ? { color: 'var(--saber-red)' } : {}}>
                {entry.message}
              </span>
              {entry.time && <span className="lg-time">{entry.time}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
