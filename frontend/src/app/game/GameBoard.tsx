'use client';
import React, { useState, useCallback, useEffect, useMemo } from 'react';
import type { GameAction } from '@/lib/game-engine/actions';
import type { UseGameResult } from './useGame';
import { TopOppMat } from './TopOppMat';
import { DividerBar } from './DividerBar';
import { YourMat } from './YourMat';
import { CardPreview } from './CardPreview';
import { TweaksPanel } from './TweaksPanel';

interface GameBoardProps extends UseGameResult {
  playerName: string;
  onGameEnd: (result: 'win' | 'loss' | 'draw') => void;
}


export function GameBoard({
  state, selectedIid, setSelectedIid, handleAction, isAiThinking, isSetupPhase, isResourcePhase,
  playerCoordinateActive, legalActions,
  playerName, onGameEnd,
}: GameBoardProps) {
  const [pendingAttackerIid, setPendingAttackerIid] = useState<string | null>(null);

  const p1 = state.players.player1;
  const p2 = state.players.player2;
  const isMyTurn = state.activePlayer === 'player1' && !p1.hasCountered && state.phase === 'action';

  // Notify parent when game ends
  useEffect(() => {
    if (!state.winner) return;
    const result = state.winner === 'player1' ? 'win'
                 : state.winner === 'player2' ? 'loss'
                 : 'draw';
    onGameEnd(result);
  }, [state.winner, onGameEnd]);

  // ── Derived legal-action sets ────────────────────────────────────────────

  const attackTargetIids = useMemo((): Set<string> => {
    if (!pendingAttackerIid) return new Set();
    return new Set(
      legalActions
        .filter(a => a.type === 'ATTACK' && a.attackerIid === pendingAttackerIid && a.defenderIid !== 'base')
        .map(a => (a as Extract<GameAction, { type: 'ATTACK' }>).defenderIid as string),
    );
  }, [pendingAttackerIid, legalActions]);

  const canAttackBase = useMemo(() => {
    if (!pendingAttackerIid) return false;
    return legalActions.some(
      a => a.type === 'ATTACK' && a.attackerIid === pendingAttackerIid && a.defenderIid === 'base',
    );
  }, [pendingAttackerIid, legalActions]);

  const canPlayIids = useMemo(
    () => new Set(legalActions.filter(a => a.type === 'PLAY_CARD').map(a => (a as Extract<GameAction, { type: 'PLAY_CARD' }>).iid)),
    [legalActions],
  );

  const legalDeployIds = useMemo(
    () => new Set(legalActions.filter(a => a.type === 'DEPLOY_LEADER').map(a => (a as Extract<GameAction, { type: 'DEPLOY_LEADER' }>).leaderCardId)),
    [legalActions],
  );

  const canTakeCounter = !state.winner && isMyTurn && legalActions.some(a => a.type === 'TAKE_COUNTER');

  // ── Interaction handlers ─────────────────────────────────────────────────

  const handleMyUnitClick = useCallback((iid: string) => {
    if (!isMyTurn) return;
    if (!legalActions.some(a => a.type === 'ATTACK' && a.attackerIid === iid)) return;
    setPendingAttackerIid(prev => prev === iid ? null : iid);
    setSelectedIid(null);
  }, [isMyTurn, legalActions, setSelectedIid]);

  const handleOppUnitClick = useCallback((iid: string) => {
    if (!pendingAttackerIid || !attackTargetIids.has(iid)) return;
    handleAction({ type: 'ATTACK', attackerIid: pendingAttackerIid, defenderIid: iid });
    setPendingAttackerIid(null);
  }, [pendingAttackerIid, attackTargetIids, handleAction]);

  const handleAttackBase = useCallback(() => {
    if (!pendingAttackerIid || !canAttackBase) return;
    handleAction({ type: 'ATTACK', attackerIid: pendingAttackerIid, defenderIid: 'base' });
    setPendingAttackerIid(null);
  }, [pendingAttackerIid, canAttackBase, handleAction]);

  const handleHandCardClick = useCallback((iid: string) => {
    if (!isMyTurn || !canPlayIids.has(iid)) return;
    if (selectedIid === iid) {
      // Second tap = play it
      handleAction({ type: 'PLAY_CARD', iid });
      setSelectedIid(null);
    } else {
      setSelectedIid(iid);
      setPendingAttackerIid(null);
    }
  }, [isMyTurn, canPlayIids, selectedIid, handleAction, setSelectedIid]);

  const handleDeployLeader = useCallback((cardId: string) => {
    handleAction({ type: 'DEPLOY_LEADER', leaderCardId: cardId });
  }, [handleAction]);

  const handleTakeCounter = useCallback(() => {
    handleAction({ type: 'TAKE_COUNTER' });
    setPendingAttackerIid(null);
    setSelectedIid(null);
  }, [handleAction, setSelectedIid]);

  const handleResourceCard = useCallback((iid: string) => {
    handleAction({ type: 'RESOURCE_CARD', iid });
  }, [handleAction]);

  const handleSkipResource = useCallback(() => {
    handleAction({ type: 'END_REGROUP' });
  }, [handleAction]);

  // ── Layout ───────────────────────────────────────────────────────────────

  return (
    <div style={{
      position: 'fixed', inset: 0,
      display: 'flex', flexDirection: 'column',
      background: 'var(--bg)',
      color: 'var(--ink)',
      overflow: 'hidden',
    }}>
      {/* ── Top chrome rail ───────────────────────────────────────── */}
      <div className="table-rail">
        <div className="table-chrome is-tl">
          <a href="/decks" className="chrome-btn">← DECKS</a>
        </div>
        <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <span style={{
            fontFamily: 'var(--font-mono)', fontSize: 9,
            letterSpacing: '0.28em', color: 'var(--ink-4)', textTransform: 'uppercase',
          }}>
            Twin Suns · 2P
          </span>
        </div>
        <div className="table-chrome is-tr">
          <TweaksPanel />
        </div>
      </div>

      {/* ── Opponent mat ──────────────────────────────────────────── */}
      <TopOppMat
        player={p2}
        round={state.round}
        hasInitiative={state.initiative === 'player2'}
        attackTargetIids={attackTargetIids}
        canAttackBase={canAttackBase}
        onUnitClick={handleOppUnitClick}
        onAttackBase={handleAttackBase}
        displayName="AI Opponent"
      />

      {/* ── Divider bar ───────────────────────────────────────────── */}
      <DividerBar
        round={state.round}
        phase={state.phase}
        activePlayer={state.activePlayer}
        initiative={state.initiative}
        playerName={playerName}
        resources={p1.resources}
        isMyTurn={isMyTurn}
        isAiThinking={isAiThinking}
        isSetupPhase={isSetupPhase}
        isResourcePhase={isResourcePhase}
        canTakeCounter={canTakeCounter}
        onTakeCounter={handleTakeCounter}
        actionLog={state.actionLog}
        winner={state.winner}
      />

      {/* ── Player mat ────────────────────────────────────────────── */}
      <YourMat
        player={p1}
        round={state.round}
        hasInitiative={state.initiative === 'player1'}
        selectedIid={selectedIid}
        pendingAttackerIid={pendingAttackerIid}
        canPlayIids={canPlayIids}
        legalDeployIds={legalDeployIds}
        isSetupPhase={isSetupPhase}
        isResourcePhase={isResourcePhase}
        coordinateActive={playerCoordinateActive}
        onUnitClick={handleMyUnitClick}
        onHandCardClick={handleHandCardClick}
        onDeployLeader={handleDeployLeader}
        onResourceCard={handleResourceCard}
        onSkipResource={handleSkipResource}
      />

      {/* ── Hover preview ─────────────────────────────────────────── */}
      <CardPreview />
    </div>
  );
}
