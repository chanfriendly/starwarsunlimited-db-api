// Synchronous choice protocol.
//
// When an effect needs player input — choose_one branch, chosen-target
// selector, optional "you may", replacement ordering — the interpreter
// calls the configured Chooser. This is sync because:
//   • The CLI driver uses blocking readline.
//   • Scenario tests provide predetermined-pick choosers.
//   • An AI provides a heuristic chooser.
//
// The eventual web UI needs ASYNC (the engine must pause and surface
// PendingChoice to the React layer). That's the Week-4 lift: replace this
// synchronous boundary with a continuation/journal protocol so step() can
// return a PendingChoice + serializable continuation. The Chooser API is
// designed to be swappable — sites that use it today won't change shape.

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
