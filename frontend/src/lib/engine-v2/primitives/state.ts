// state.exhaust / state.ready primitives.

import type { GameState } from '../state/types';
import type { GameEvent } from '../state/bus';
import { mapInstance } from '../state/zones';

export function exhaust(state: GameState, iid: string): { state: GameState; events: GameEvent[] } {
  const next = mapInstance(state, iid, c => (c.exhausted ? c : { ...c, exhausted: true }));
  if (next === state) return { state, events: [] };
  return { state: next, events: [{ kind: 'EXHAUSTED', iid }] };
}

export function ready(state: GameState, iid: string): { state: GameState; events: GameEvent[] } {
  const next = mapInstance(state, iid, c => (c.exhausted ? { ...c, exhausted: false } : c));
  if (next === state) return { state, events: [] };
  return { state: next, events: [{ kind: 'READIED', iid }] };
}

export function readyAll(state: GameState, playerId: string): { state: GameState; events: GameEvent[] } {
  const p = state.players[playerId];
  if (!p) return { state, events: [] };
  const events: GameEvent[] = [];

  const readyArr = (arr: typeof p.groundArena) => arr.map(c => {
    if (!c.exhausted) return c;
    events.push({ kind: 'READIED', iid: c.iid });
    return { ...c, exhausted: false };
  });

  // Leaders also ready during regroup so their action abilities reset each round.
  const newLeaders = p.leaders.map(l => l.exhausted ? { ...l, exhausted: false } : l);

  const newP = {
    ...p,
    groundArena: readyArr(p.groundArena),
    spaceArena: readyArr(p.spaceArena),
    resources: readyArr(p.resources),
    leaders: newLeaders,
  };
  return {
    state: { ...state, players: { ...state.players, [playerId]: newP } },
    events,
  };
}
