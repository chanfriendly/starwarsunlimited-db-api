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
  const [pendingAttackerIid,   setPendingAttackerIid]   = useState<string | null>(null);
  /** leaderCardId of the leader whose ability is waiting for a target */
  const [pendingLeaderAbilityId, setPendingLeaderAbilityId] = useState<string | null>(null);
  /** iid of the event card waiting for a target */
  const [pendingEventIid,      setPendingEventIid]      = useState<string | null>(null);

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

  /** Leader card ids that have a usable ability this turn */
  const legalLeaderAbilityIds = useMemo(
    () => new Set(
      legalActions
        .filter(a => a.type === 'LEADER_ABILITY')
        .map(a => (a as Extract<GameAction, { type: 'LEADER_ABILITY' }>).leaderCardId),
    ),
    [legalActions],
  );

  /** Valid target iids for the pending leader ability */
  const leaderAbilityTargetIids = useMemo((): Set<string> => {
    if (!pendingLeaderAbilityId) return new Set();
    return new Set(
      legalActions
        .filter(a =>
          a.type === 'LEADER_ABILITY' &&
          (a as Extract<GameAction, { type: 'LEADER_ABILITY' }>).leaderCardId === pendingLeaderAbilityId &&
          (a as Extract<GameAction, { type: 'LEADER_ABILITY' }>).targetIid,
        )
        .map(a => (a as Extract<GameAction, { type: 'LEADER_ABILITY' }>).targetIid as string),
    );
  }, [pendingLeaderAbilityId, legalActions]);

  /** Map of event iid → targetIids[] for events that need a target */
  const canPlayEventTargeted = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const a of legalActions) {
      if (a.type !== 'PLAY_CARD') continue;
      const action = a as Extract<GameAction, { type: 'PLAY_CARD' }>;
      if (!action.targetIid) continue;
      // Only events, not upgrades
      const ci = p1.hand.find(c => c.iid === action.iid);
      if (!ci || ci.card.type?.toLowerCase() !== 'event') continue;
      const existing = map.get(action.iid) ?? [];
      map.set(action.iid, [...existing, action.targetIid]);
    }
    return map;
  }, [legalActions, p1.hand]);

  /** Valid target iids for the pending event */
  const eventTargetIids = useMemo((): Set<string> => {
    if (!pendingEventIid) return new Set();
    return new Set(
      legalActions
        .filter(a =>
          a.type === 'PLAY_CARD' &&
          (a as Extract<GameAction, { type: 'PLAY_CARD' }>).iid === pendingEventIid &&
          (a as Extract<GameAction, { type: 'PLAY_CARD' }>).targetIid,
        )
        .map(a => (a as Extract<GameAction, { type: 'PLAY_CARD' }>).targetIid as string),
    );
  }, [pendingEventIid, legalActions]);

  const canEventTargetBase = useMemo(() => {
    if (!pendingEventIid) return false;
    return legalActions.some(
      a =>
        a.type === 'PLAY_CARD' &&
        (a as Extract<GameAction, { type: 'PLAY_CARD' }>).iid === pendingEventIid &&
        (a as Extract<GameAction, { type: 'PLAY_CARD' }>).targetIid === 'base',
    );
  }, [pendingEventIid, legalActions]);

  // ── Effective targeting sets (attack, ability, or event) ─────────────────

  /** Enemy unit iids that should be highlighted/clickable right now */
  const effectiveOppTargetIids = useMemo((): Set<string> => {
    const oppUnitIids = new Set([...p2.groundArena, ...p2.spaceArena].map(c => c.iid));
    if (pendingLeaderAbilityId) {
      return new Set([...leaderAbilityTargetIids].filter(id => oppUnitIids.has(id)));
    }
    if (pendingEventIid) {
      return new Set([...eventTargetIids].filter(id => id !== 'base'));
    }
    return attackTargetIids;
  }, [pendingLeaderAbilityId, pendingEventIid, leaderAbilityTargetIids, eventTargetIids, attackTargetIids, p2]);

  /** My unit iids that should be highlighted as ability/event targets */
  const friendlyTargetIids = useMemo((): Set<string> => {
    const myUnitIids = new Set([...p1.groundArena, ...p1.spaceArena].map(c => c.iid));
    if (pendingLeaderAbilityId) {
      return new Set([...leaderAbilityTargetIids].filter(id => myUnitIids.has(id)));
    }
    if (pendingEventIid) {
      return new Set([...eventTargetIids].filter(id => myUnitIids.has(id)));
    }
    return new Set();
  }, [pendingLeaderAbilityId, pendingEventIid, leaderAbilityTargetIids, eventTargetIids, p1]);

  /** Whether the opponent's base is a valid target right now */
  const effectiveCanTargetBase = pendingEventIid ? canEventTargetBase : canAttackBase;

  const canTakeCounter = !state.winner && isMyTurn && legalActions.some(a => a.type === 'TAKE_COUNTER');

  // ── Interaction handlers ─────────────────────────────────────────────────

  const clearPending = useCallback(() => {
    setPendingAttackerIid(null);
    setPendingLeaderAbilityId(null);
    setPendingEventIid(null);
  }, []);

  const handleMyUnitClick = useCallback((iid: string) => {
    // Leader ability targeting a friendly unit
    if (pendingLeaderAbilityId && leaderAbilityTargetIids.has(iid)) {
      handleAction({ type: 'LEADER_ABILITY', leaderCardId: pendingLeaderAbilityId, targetIid: iid });
      setPendingLeaderAbilityId(null);
      return;
    }
    // Event targeting a friendly unit
    if (pendingEventIid && eventTargetIids.has(iid)) {
      handleAction({ type: 'PLAY_CARD', iid: pendingEventIid, targetIid: iid });
      setPendingEventIid(null);
      return;
    }
    // Normal attack selection
    if (!isMyTurn) return;
    if (!legalActions.some(a => a.type === 'ATTACK' && a.attackerIid === iid)) return;
    setPendingAttackerIid(prev => prev === iid ? null : iid);
    setPendingLeaderAbilityId(null);
    setPendingEventIid(null);
    setSelectedIid(null);
  }, [
    pendingLeaderAbilityId, pendingEventIid, leaderAbilityTargetIids, eventTargetIids,
    isMyTurn, legalActions, handleAction, setSelectedIid,
  ]);

  const handleOppUnitClick = useCallback((iid: string) => {
    // Leader ability targeting an enemy unit
    if (pendingLeaderAbilityId && leaderAbilityTargetIids.has(iid)) {
      handleAction({ type: 'LEADER_ABILITY', leaderCardId: pendingLeaderAbilityId, targetIid: iid });
      setPendingLeaderAbilityId(null);
      return;
    }
    // Event targeting an enemy unit
    if (pendingEventIid && eventTargetIids.has(iid)) {
      handleAction({ type: 'PLAY_CARD', iid: pendingEventIid, targetIid: iid });
      setPendingEventIid(null);
      return;
    }
    // Normal attack
    if (!pendingAttackerIid || !attackTargetIids.has(iid)) return;
    handleAction({ type: 'ATTACK', attackerIid: pendingAttackerIid, defenderIid: iid });
    setPendingAttackerIid(null);
  }, [
    pendingLeaderAbilityId, pendingEventIid, leaderAbilityTargetIids, eventTargetIids,
    pendingAttackerIid, attackTargetIids, handleAction,
  ]);

  const handleAttackBase = useCallback(() => {
    // Event that can target opponent's base
    if (pendingEventIid && canEventTargetBase) {
      handleAction({ type: 'PLAY_CARD', iid: pendingEventIid, targetIid: 'base' });
      setPendingEventIid(null);
      return;
    }
    if (!pendingAttackerIid || !canAttackBase) return;
    handleAction({ type: 'ATTACK', attackerIid: pendingAttackerIid, defenderIid: 'base' });
    setPendingAttackerIid(null);
  }, [pendingEventIid, canEventTargetBase, pendingAttackerIid, canAttackBase, handleAction]);

  const handleHandCardClick = useCallback((iid: string) => {
    if (!isMyTurn || !canPlayIids.has(iid)) return;

    // Cancel event targeting if same card tapped again
    if (pendingEventIid === iid) {
      setPendingEventIid(null);
      return;
    }

    // Events that need a target → enter targeting mode
    if (canPlayEventTargeted.has(iid)) {
      setPendingEventIid(iid);
      setPendingAttackerIid(null);
      setPendingLeaderAbilityId(null);
      setSelectedIid(null);
      return;
    }

    if (selectedIid === iid) {
      // Second tap = play it
      handleAction({ type: 'PLAY_CARD', iid });
      setSelectedIid(null);
    } else {
      setSelectedIid(iid);
      setPendingAttackerIid(null);
      setPendingLeaderAbilityId(null);
      setPendingEventIid(null);
    }
  }, [
    isMyTurn, canPlayIids, selectedIid, pendingEventIid, canPlayEventTargeted,
    handleAction, setSelectedIid,
  ]);

  const handleDeployLeader = useCallback((cardId: string) => {
    handleAction({ type: 'DEPLOY_LEADER', leaderCardId: cardId });
  }, [handleAction]);

  const handleLeaderAbility = useCallback((cardId: string) => {
    // Cancel if same leader clicked again
    if (pendingLeaderAbilityId === cardId) {
      setPendingLeaderAbilityId(null);
      return;
    }
    // Check whether this ability needs a target
    const hasTarget = legalActions.some(
      a =>
        a.type === 'LEADER_ABILITY' &&
        (a as Extract<GameAction, { type: 'LEADER_ABILITY' }>).leaderCardId === cardId &&
        (a as Extract<GameAction, { type: 'LEADER_ABILITY' }>).targetIid !== undefined,
    );
    if (hasTarget) {
      setPendingLeaderAbilityId(cardId);
      setPendingAttackerIid(null);
      setPendingEventIid(null);
      setSelectedIid(null);
    } else {
      // No target needed — dispatch immediately
      handleAction({ type: 'LEADER_ABILITY', leaderCardId: cardId });
    }
  }, [pendingLeaderAbilityId, legalActions, handleAction, setSelectedIid]);

  const handleTakeCounter = useCallback(() => {
    handleAction({ type: 'TAKE_COUNTER' });
    clearPending();
    setSelectedIid(null);
  }, [handleAction, clearPending, setSelectedIid]);

  const handleResourceCard = useCallback((iid: string) => {
    clearPending();
    handleAction({ type: 'RESOURCE_CARD', iid });
  }, [handleAction, clearPending]);

  const handleSkipResource = useCallback(() => {
    clearPending();
    handleAction({ type: 'END_REGROUP' });
  }, [handleAction, clearPending]);

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
        attackTargetIids={effectiveOppTargetIids}
        canAttackBase={effectiveCanTargetBase}
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
        pendingEventIid={pendingEventIid}
        canPlayIids={canPlayIids}
        legalDeployIds={legalDeployIds}
        legalLeaderAbilityIds={legalLeaderAbilityIds}
        pendingLeaderAbilityId={pendingLeaderAbilityId}
        abilityTargetIids={friendlyTargetIids}
        isSetupPhase={isSetupPhase}
        isResourcePhase={isResourcePhase}
        coordinateActive={playerCoordinateActive}
        onUnitClick={handleMyUnitClick}
        onHandCardClick={handleHandCardClick}
        onDeployLeader={handleDeployLeader}
        onLeaderAbility={handleLeaderAbility}
        onResourceCard={handleResourceCard}
        onSkipResource={handleSkipResource}
      />

      {/* ── Hover preview ─────────────────────────────────────────── */}
      <CardPreview />
    </div>
  );
}
