// meta primitives. Week 1 only needs `sequence` for the demo loop's
// composed actions; the rest land with the interpreter in Week 2.

import type { GameState } from '../state/types';
import type { GameEvent } from '../state/bus';

export type StepFn = (s: GameState) => { state: GameState; events: GameEvent[] };

export function sequence(state: GameState, steps: StepFn[]): { state: GameState; events: GameEvent[] } {
  let s = state;
  const events: GameEvent[] = [];
  for (const step of steps) {
    const r = step(s);
    s = r.state;
    events.push(...r.events);
  }
  return { state: s, events };
}
