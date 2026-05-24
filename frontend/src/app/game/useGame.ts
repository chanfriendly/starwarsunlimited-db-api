'use client';
import { useRef, useState, useEffect, useCallback } from 'react';
import { GameEngine, deckToPlayerConfig, HeuristicAI, isCoordinateActive } from '@/lib/game-engine';
import type { GameState, PlayerId } from '@/lib/game-engine/types';
import type { GameAction } from '@/lib/game-engine/actions';
import type { AIDifficulty } from '@/lib/game-engine/ai';
import type { SavedDeck } from '@/lib/api';

export interface UseGameOptions {
  playerDeck: SavedDeck;
  aiDeck: SavedDeck;
  difficulty: AIDifficulty;
  playerName: string;
}

export interface UseGameResult {
  state: GameState;
  selectedIid: string | null;
  setSelectedIid: (iid: string | null) => void;
  handleAction: (action: GameAction) => void;
  isAiThinking: boolean;
  isSetupPhase: boolean;
  isResourcePhase: boolean;
  /** True when player1 controls 3+ units (Coordinate threshold met) */
  playerCoordinateActive: boolean;
  legalActions: GameAction[];
}

export function useGame({ playerDeck, aiDeck, difficulty, playerName }: UseGameOptions): UseGameResult {
  const engineRef = useRef<GameEngine | null>(null);
  const aiRef     = useRef<HeuristicAI | null>(null);

  // Initialize engine + AI BEFORE useState so the lazy initializer always reads
  // from the same engine instance. React Strict Mode invokes the useState
  // initializer twice in dev, causing two different engines to be created if
  // the engine is built inside that callback — the ref ends up pointing to
  // engine2 while the state snapshot is from engine1, desynchronizing all
  // subsequent actions (wrong card iids, wrong arenas, etc.).
  // The null-check here is idempotent: refs persist across Strict Mode's
  // double-render so the engine is only ever created once.
  if (engineRef.current === null) {
    const engine = new GameEngine({
      player1: deckToPlayerConfig(playerDeck, 'player1', playerName),
      player2: deckToPlayerConfig(aiDeck,    'player2', 'AI Opponent'),
    });
    engineRef.current = engine;
    aiRef.current = new HeuristicAI(engine, 'player2', difficulty);
  }

  const [state, setState] = useState<GameState>(
    () => engineRef.current!.getState() as GameState,
  );

  const [selectedIid, setSelectedIid] = useState<string | null>(null);

  // Derived — no async mismatch possible
  const isAiThinking = !state.winner &&
    state.phase === 'action' &&
    state.activePlayer === 'player2' &&
    !state.players.player2.hasCountered;

  const isSetupPhase = !state.winner &&
    state.phase === 'setup' &&
    state.activePlayer === 'player1' &&
    !state.players.player1.hasResourced;

  const isResourcePhase = !state.winner &&
    state.phase === 'regroup' &&
    state.activePlayer === 'player1' &&
    !state.players.player1.hasResourced;

  const playerCoordinateActive = !state.winner && isCoordinateActive(state, 'player1');
  const legalActions = engineRef.current?.getLegalActions('player1') ?? [];

  const handleAction = useCallback((action: GameAction) => {
    if (!engineRef.current) return;
    const next = engineRef.current.applyAction('player1', action);
    setState({ ...next });
    setSelectedIid(null);
  }, []);

  // AI turn + auto-regroup + auto-setup
  useEffect(() => {
    if (!engineRef.current || !aiRef.current || state.winner) return;

    // During setup phase: player1 waits for UI; player2 (AI) auto-resources up to 2 cards
    if (state.phase === 'setup') {
      if (state.activePlayer === 'player1') return; // wait for player1 UI

      const t = setTimeout(() => {
        if (!engineRef.current) return;
        const aiActions = engineRef.current.getLegalActions('player2');
        const resourceOpts = aiActions.filter(a => a.type === 'RESOURCE_CARD');
        // AI always fills both setup resource slots if possible
        const action = resourceOpts.length > 0
          ? resourceOpts[Math.floor(Math.random() * resourceOpts.length)]
          : ({ type: 'END_REGROUP' } as const);
        const next = engineRef.current.applyAction('player2', action);
        setState({ ...next });
      }, 400);
      return () => clearTimeout(t);
    }

    // During regroup phase: player1 waits for UI input; player2 (AI) auto-resources
    if (state.phase === 'regroup') {
      if (state.activePlayer === 'player1') return; // wait for player1 UI

      // AI's resource turn — pick the lowest-cost card to resource (preserve high-value plays), or skip if empty
      const t = setTimeout(() => {
        if (!engineRef.current) return;
        const aiActions = engineRef.current.getLegalActions('player2');
        const resourceOpts = aiActions.filter(a => a.type === 'RESOURCE_CARD') as Extract<typeof aiActions[number], { type: 'RESOURCE_CARD' }>[];
        const action = resourceOpts.length > 0
          ? (() => {
              const p2 = engineRef.current!.getState().players.player2;
              return resourceOpts.reduce((best, a) => {
                const ci = p2.hand.find(h => h.iid === a.iid);
                const bestCi = p2.hand.find(h => h.iid === (best as { iid: string }).iid);
                const cost = ci ? (ci.card.energy_cost ?? ci.card.cost ?? 0) : 99;
                const bestCost = bestCi ? (bestCi.card.energy_cost ?? bestCi.card.cost ?? 0) : 99;
                return cost < bestCost ? a : best;
              }, resourceOpts[0]);
            })()
          : ({ type: 'END_REGROUP' } as const);
        const next = engineRef.current.applyAction('player2', action);
        setState({ ...next });
      }, 800);
      return () => clearTimeout(t);
    }

    if (state.activePlayer !== 'player2') return;
    if (state.players.player2.hasCountered) return;

    const delay = 500 + Math.random() * 500;

    const t = setTimeout(() => {
      if (!engineRef.current || !aiRef.current) return;
      const action = aiRef.current.chooseAction();
      const next   = engineRef.current.applyAction('player2', action);
      setState({ ...next });
    }, delay);

    return () => clearTimeout(t);
  }, [state]);

  return { state, selectedIid, setSelectedIid, handleAction, isAiThinking, isSetupPhase, isResourcePhase, playerCoordinateActive, legalActions };
}
