// Async step protocol — replay-based resumption.
//
// The engine itself is fully synchronous and pure. Every player-input point
// flows through the `Chooser` callback, so we can implement async-shaped
// "pause for a choice, resume when the player picks" without rewriting any
// of the engine internals.
//
// Strategy:
//   1. `stepAsync` invokes the existing synchronous `step()` with a *replay
//      chooser* backed by a journal of pre-answered picks.
//   2. If the engine asks for a pick the journal doesn't have, the replay
//      chooser throws a `PendingChoiceSignal`. `stepAsync` catches it and
//      returns `{ kind: 'pending', prompt, pending }` — a resumable handle.
//   3. The UI passes the player's pick to `resolveStep(pending, pick)`. We
//      append the pick to the journal and re-run `step()` from the original
//      state. The engine is fully deterministic (no RNG / Date.now / map
//      iteration in step()), so replay produces the same intermediate state
//      up to the next previously-unanswered choice point.
//   4. Eventually no more choices are needed and `step()` settles. We return
//      `{ kind: 'settled', next, events }`.
//
// Cost: a step with N choice points runs N+1 times total (once per resume
// plus once for the final completion). For typical card abilities (0–2
// prompts) this is fine; pathological cases are bounded by the step's
// own complexity, which is already small.
//
// The synchronous `step()` and `Chooser` API are unchanged — tests + the
// CLI keep using them. This module is the engine-to-UI adapter only.

import type { PlayerAction } from '../actions';
import type { CardRegistry, GameState, StepResult } from '../state/types';
import type { GameEvent } from '../state/bus';
import type { ChoicePrompt, ChoiceResult, Chooser } from './chooser';
import { step } from '../reducer';

/** Internal signal thrown by the replay chooser when the journal is
 *  exhausted. NOT a public type — UI never sees this; `stepAsync` catches it
 *  and converts to a `{ kind: 'pending' }` result. */
class PendingChoiceSignal {
  constructor(public readonly prompt: ChoicePrompt) {}
}

/** Resumable handle for a step that's paused on a player choice.
 *  Opaque to the UI — pass back to `resolveStep` to continue. The `state`
 *  and `action` fields are the originals; `journal` is the picks made so far. */
export interface PendingStep {
  id: string;
  prompt: ChoicePrompt;
  // Internal fields used to replay. Not for UI consumption.
  state: GameState;
  action: PlayerAction;
  journal: ChoiceResult[];
}

/** What the async step API returns. */
export type AsyncStepResult =
  | { kind: 'settled'; next: GameState; events: GameEvent[] }
  | { kind: 'pending'; pending: PendingStep };

let _pendingCounter = 0;
function nextPendingId(): string {
  return `pc${++_pendingCounter}`;
}

/** Run an action via the synchronous engine with a replay chooser. Returns
 *  either `settled` (no choice needed, step completed) or `pending` (engine
 *  asked for a pick the journal didn't have). */
function executeWithJournal(
  state: GameState,
  action: PlayerAction,
  reg: CardRegistry,
  journal: ChoiceResult[],
): AsyncStepResult {
  let cursor = 0;
  const replayChooser: Chooser = (prompt) => {
    if (cursor < journal.length) {
      return journal[cursor++];
    }
    throw new PendingChoiceSignal(prompt);
  };

  try {
    const result: StepResult = step(state, action, reg, replayChooser);
    return { kind: 'settled', next: result.next, events: result.events };
  } catch (e) {
    if (e instanceof PendingChoiceSignal) {
      return {
        kind: 'pending',
        pending: {
          id: nextPendingId(),
          prompt: e.prompt,
          state,
          action,
          journal,
        },
      };
    }
    throw e;
  }
}

/** Start a step. Returns `settled` if the action requires no player input,
 *  or `pending` carrying the first prompt the engine asked for. */
export function stepAsync(
  state: GameState,
  action: PlayerAction,
  reg: CardRegistry,
): AsyncStepResult {
  return executeWithJournal(state, action, reg, []);
}

/** Resume a paused step with the player's pick. Returns `settled` if the
 *  step is now complete, or another `pending` if the engine needs another
 *  choice. */
export function resolveStep(
  pending: PendingStep,
  result: ChoiceResult,
  reg: CardRegistry,
): AsyncStepResult {
  const nextJournal: ChoiceResult[] = [...pending.journal, result];
  return executeWithJournal(pending.state, pending.action, reg, nextJournal);
}
