'use client';
// React adapter for engine-v2. Holds the current GameState, threads
// stepAsync/resolveStep for human turns, and auto-dispatches AI turns via
// synchronous step() with a heuristic chooser. The pure-functional engine
// means no refs to a mutable instance — state lives in useState directly.

import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  AsyncStepResult,
  CardRegistry,
  GameConfig,
  GameEvent,
  GameState,
  PendingStep,
  PlayerAction,
  PlayerId,
  ChoicePrompt,
  ChoiceResult,
} from '@/lib/engine-v2';
import {
  getLegalActions,
  initGame,
  resolveStep,
  step,
  stepAsync,
} from '@/lib/engine-v2';
import { aiChooser, aiPick } from './ai';

export interface UseGameV2Options {
  config: GameConfig;
  registry: CardRegistry;
  /** Which seats the AI controls. Others are human (driven by dispatch + resolveChoice). */
  aiPlayers: Set<PlayerId>;
  /** Delay between AI actions in ms — gives the human time to read the board.
   *  Default 500. */
  aiDelayMs?: number;
  /** Who the local UI is acting as. Used to compute `legalActions` from this
   *  player's perspective. */
  localPlayer: PlayerId;
}

export interface UseGameV2Result {
  state: GameState;
  registry: CardRegistry;
  /** Set when a human action is paused on a player choice. Drive resolveChoice. */
  pending: { prompt: ChoicePrompt } | null;
  /** Last batch of events emitted by the engine (clears on next dispatch). */
  events: GameEvent[];
  /** Legal actions for the *local* player (the one this UI represents). */
  legalActions: PlayerAction[];
  /** True when the local player is the active player AND not awaiting a choice. */
  isMyTurn: boolean;
  /** True while an AI seat is mid-turn (auto-dispatch in flight). */
  isAiThinking: boolean;
  dispatch: (action: PlayerAction) => void;
  resolveChoice: (result: ChoiceResult) => void;
  restart: () => void;
}

export function useGameV2(opts: UseGameV2Options): UseGameV2Result {
  const { config, registry: reg, aiPlayers, localPlayer } = opts;
  const aiDelayMs = opts.aiDelayMs ?? 500;

  // Build the initial state once and run START_GAME so we begin in the setup
  // phase ready to accept resources. The initGame+START_GAME pair is cheap
  // enough to do inside lazy useState.
  const buildInitial = useCallback(() => {
    const s0 = initGame(config, reg);
    const r0 = step(s0, { kind: 'START_GAME' }, reg, aiChooser);
    return r0.next;
  }, [config, reg]);

  const [state, setState] = useState<GameState>(buildInitial);
  const [pending, setPending] = useState<PendingStep | null>(null);
  const [events, setEvents] = useState<GameEvent[]>([]);
  // useRef so the auto-dispatch effect can read the latest state without re-firing.
  const stateRef = useRef(state);
  stateRef.current = state;
  const [isAiThinking, setIsAiThinking] = useState(false);

  // Reset to a fresh game (same config).
  const restart = useCallback(() => {
    setState(buildInitial());
    setPending(null);
    setEvents([]);
    setIsAiThinking(false);
  }, [buildInitial]);

  // Apply an AsyncStepResult to React state.
  const applyAsync = useCallback((r: AsyncStepResult) => {
    if (r.kind === 'settled') {
      setState(r.next);
      setEvents(r.events);
      setPending(null);
    } else {
      setPending(r.pending);
    }
  }, []);

  // Apply a synchronous step result.
  const applySync = useCallback((r: { next: GameState; events: GameEvent[] }) => {
    setState(r.next);
    setEvents(r.events);
    setPending(null);
  }, []);

  // Public dispatcher — used by the local human's action picks.
  const dispatch = useCallback((action: PlayerAction) => {
    if (pending) return; // can't start a new action while one is paused
    try {
      const r = stepAsync(state, action, reg);
      applyAsync(r);
    } catch (e) {
      // Engine validation errors surface here; for now log + ignore.
      // The legal-actions list should prevent illegal dispatches, but bugs happen.
      // eslint-disable-next-line no-console
      console.error('dispatch failed', e);
    }
  }, [pending, state, reg, applyAsync]);

  const resolveChoice = useCallback((result: ChoiceResult) => {
    if (!pending) return;
    try {
      const r = resolveStep(pending, result, reg);
      applyAsync(r);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('resolveChoice failed', e);
    }
  }, [pending, reg, applyAsync]);

  // AI auto-dispatch effect — fires whenever state changes (or pending clears).
  // Plays one AI action per scheduled tick to keep the UI animated.
  useEffect(() => {
    if (state.winner) return;
    if (pending) return; // human is mid-choice; don't step AI
    const pid = state.activePlayer;
    if (!aiPlayers.has(pid)) {
      // Local human's turn (or another human seat) — don't auto-dispatch.
      return;
    }
    setIsAiThinking(true);
    const t = setTimeout(() => {
      const cur = stateRef.current;
      // Re-check in case state changed underneath us (Strict Mode / interrupts).
      if (cur.winner) { setIsAiThinking(false); return; }
      if (!aiPlayers.has(cur.activePlayer)) { setIsAiThinking(false); return; }
      const action = aiPick(cur, reg, cur.activePlayer);
      if (!action) { setIsAiThinking(false); return; }
      try {
        // AI uses synchronous step() with aiChooser — no pause possible.
        const r = step(cur, action, reg, aiChooser);
        applySync(r);
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error('AI dispatch failed', e);
      }
      setIsAiThinking(false);
    }, aiDelayMs);
    return () => { clearTimeout(t); setIsAiThinking(false); };
  }, [state, pending, aiPlayers, reg, aiDelayMs, applySync]);

  const legalActions = !state.winner && !pending
    ? getLegalActions(state, reg, localPlayer).actions
    : [];
  const isMyTurn = !state.winner && !pending && state.activePlayer === localPlayer;

  return {
    state,
    registry: reg,
    pending: pending ? { prompt: pending.prompt } : null,
    events,
    legalActions,
    isMyTurn,
    isAiThinking,
    dispatch,
    resolveChoice,
    restart,
  };
}
