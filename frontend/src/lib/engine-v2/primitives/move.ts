// move.move_to_zone — the generic mover.

import type { CardInstance, GameState, PlayerId, Zone } from '../state/types';
import type { GameEvent } from '../state/bus';
import { findCard, getZoneArr, withZoneArr, withPlayer } from '../state/zones';

export interface MoveResult {
  state: GameState;
  events: GameEvent[];
  movedIid?: string;
}

export function moveToZone(
  state: GameState,
  iid: string,
  destController: PlayerId,
  destZone: Zone,
  opts?: { position?: 'top' | 'bottom' },
): MoveResult {
  const found = findCard(state, iid);
  if (!found) return { state, events: [] };
  const { loc, inst } = found;

  const fromP = state.players[loc.controller];
  const fromArr = getZoneArr(fromP, loc.zone).slice();
  fromArr.splice(loc.index, 1);
  let next = withPlayer(state, loc.controller, withZoneArr(fromP, loc.zone, fromArr));

  const updated: CardInstance = { ...inst, enteredZoneAt: next.step };
  const toP = next.players[destController];
  const toArr = getZoneArr(toP, destZone).slice();
  if (opts?.position === 'top') toArr.unshift(updated);
  else toArr.push(updated);
  next = withPlayer(next, destController, withZoneArr(toP, destZone, toArr));

  return {
    state: next,
    events: [{ kind: 'ZONE_CHANGED', iid, from: loc.zone, to: destZone }],
    movedIid: iid,
  };
}

// Place a fresh instance (drawn from deck top, created token, etc.) directly
// into a zone without going through findCard. Used by primitives that create
// or surface cards.
export function placeInZone(
  state: GameState,
  inst: CardInstance,
  controller: PlayerId,
  zone: Zone,
): { state: GameState; events: GameEvent[] } {
  const p = state.players[controller];
  const arr = getZoneArr(p, zone).slice();
  arr.push({ ...inst, enteredZoneAt: state.step });
  const next = withPlayer(state, controller, withZoneArr(p, zone, arr));
  return { state: next, events: [] };
}
