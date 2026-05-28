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

/** Attach an upgrade (sourced from `hand` or wherever it currently is) to a
 *  host unit. The upgrade is removed from its current zone and pushed onto the
 *  host's upgrades[]. Emits UPGRADE_ATTACHED. */
export function attachUpgrade(
  state: GameState,
  upgradeIid: string,
  hostIid: string,
): MoveResult {
  const upFound = findCard(state, upgradeIid);
  if (!upFound) return { state, events: [] };
  const hostFound = findCard(state, hostIid);
  if (!hostFound) return { state, events: [] };

  // Remove the upgrade from wherever it lives now.
  const fromP = state.players[upFound.loc.controller];
  const fromArr = getZoneArr(fromP, upFound.loc.zone).slice();
  fromArr.splice(upFound.loc.index, 1);
  let next = withPlayer(state, upFound.loc.controller, withZoneArr(fromP, upFound.loc.zone, fromArr));

  // Push onto the host's upgrades[].
  const hostP = next.players[hostFound.loc.controller];
  const hostArr = getZoneArr(hostP, hostFound.loc.zone).slice();
  const hostIdx = hostArr.findIndex(c => c.iid === hostIid);
  if (hostIdx < 0) return { state, events: [] };
  const updatedUpgrade: CardInstance = { ...upFound.inst, enteredZoneAt: next.step };
  hostArr[hostIdx] = {
    ...hostArr[hostIdx],
    upgrades: [...hostArr[hostIdx].upgrades, updatedUpgrade],
  };
  next = withPlayer(next, hostFound.loc.controller, withZoneArr(hostP, hostFound.loc.zone, hostArr));

  return {
    state: next,
    events: [{ kind: 'UPGRADE_ATTACHED', upgradeIid, hostIid }],
    movedIid: upgradeIid,
  };
}
