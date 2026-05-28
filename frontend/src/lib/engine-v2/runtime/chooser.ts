// Synchronous choice protocol.
//
// When an effect needs player input — choose_one branch, chosen-target
// selector, optional "you may", replacement ordering — the interpreter
// calls the configured Chooser. This is the synchronous foundation; async
// (UI-friendly) resumption lives in runtime/async_step.ts as a replay-based
// wrapper that invokes step() with a journal-backed chooser and throws a
// PendingChoiceSignal when the journal is exhausted. The Chooser API stays
// unchanged — that's why the async lift was a wrapper, not a rewrite.
//
// Sync callers:
//   • Scenario tests (scriptedChooser).
//   • The greedy AI in play_cli (default + heuristic choosers).
//   • Any callsite that wants to drive step() directly.
//
// Async callers:
//   • play_cli's human turns (stepAsync + readline-prompted resolveStep loop).
//   • The eventual useGameV2 React hook.

import type { PlayerId } from '../state/types';
import type { ResolvedTarget } from '../spec/ast';

export type ChoicePrompt =
  | {
      kind: 'choose_one';
      prompt: string;
      options: Array<{ label: string; value: string }>;
      player: PlayerId;
      canPass: boolean; // true when the source ability uses "may"
    }
  | {
      kind: 'prompt_target';
      prompt: string;
      candidates: ResolvedTarget[];
      count: number;
      minCount: number;
      player: PlayerId;
      canPass: boolean;
    }
  | {
      kind: 'optional';
      prompt: string;
      player: PlayerId;
    };

export type ChoiceResult =
  | { kind: 'option'; value: string }
  | { kind: 'targets'; targets: ResolvedTarget[] }
  | { kind: 'yes' }
  | { kind: 'no' }
  | { kind: 'pass' };

export type Chooser = (prompt: ChoicePrompt) => ChoiceResult;

// Default chooser: deterministic leftmost / yes / first-N. Preserves Week-2
// scenario test behavior where no chooser was supplied.
export const defaultChooser: Chooser = (prompt) => {
  switch (prompt.kind) {
    case 'choose_one':
      if (prompt.options.length === 0) return { kind: 'pass' };
      return { kind: 'option', value: prompt.options[0].value };
    case 'prompt_target':
      return { kind: 'targets', targets: prompt.candidates.slice(0, prompt.count) };
    case 'optional':
      return { kind: 'yes' };
  }
};

// Convenience: chooser that always declines optional/may prompts and
// auto-picks for non-optional ones. Useful in tests that want to verify
// "if the player declines, no effect" behavior.
export const declineChooser: Chooser = (prompt) => {
  if (prompt.kind === 'optional') return { kind: 'no' };
  return defaultChooser(prompt);
};

// Predetermined-pick chooser. Pass an array of results to apply in order.
// After the array is exhausted, falls back to defaultChooser.
export function scriptedChooser(picks: ChoiceResult[]): Chooser {
  let i = 0;
  return (prompt) => {
    if (i < picks.length) {
      const r = picks[i++];
      return r;
    }
    return defaultChooser(prompt);
  };
}
