// Capture mechanic per §v7 8.33.
//
// On capture: the target leaves play, is placed in the captor's capture_zone
// (facedown to opponents but open info to all per §8.33.1), damage counters
// are removed, attached upgrades are defeated.
//
// On rescue (§8.33.3): the captured card is retrieved faceup, exhausted,
// under its owner's control. Does NOT trigger When Played.
//
// On capturer leaves play (§8.33.4): all captives are immediately rescued.

import type { CardInstance, CapturedCard, CardRegistry, GameState, PlayerId } from '../state/types';
import type { GameEvent } from '../state/bus';
import { findCard, getZoneArr, mapInstance, withPlayer, withZoneArr } from '../state/zones';
import { isUnit } from '../spec/types';

function removeFromArena(state: GameState, iid: string): { state: GameState; inst?: CardInstance; ownerOriginal?: PlayerId; originalArena?: 'ground_arena' | 'space_arena' } {
  for (const pid of state.playerOrder) {
    const p = state.players[pid];
    for (const z of ['ground_arena', 'space_arena'] as const) {
      const arr = getZoneArr(p, z);
      const idx = arr.findIndex(c => c.iid === iid);
      if (idx >= 0) {
        const removed = arr[idx];
        const cleaned = { ...removed, damage: 0, upgrades: [], shieldTokens: 0 };
        const next = arr.slice(); next.splice(idx, 1);
        const s2 = withPlayer(state, pid, withZoneArr(p, z, next));
        return { state: s2, inst: cleaned, ownerOriginal: pid, originalArena: z };
      }
    }
  }
  return { state };
}

export function capture(
  state: GameState, reg: CardRegistry,
  targetIid: string, captorIid: string,
): { state: GameState; events: GameEvent[] } {
  const captorFound = findCard(state, captorIid);
  if (!captorFound) return { state, events: [] };
  const captorOwner = captorFound.loc.controller;

  const targetFound = findCard(state, targetIid);
  if (!targetFound) return { state, events: [] };

  // §v7 8.33.5: If a token unit would be captured, it is set aside instead.
  const targetSpec = reg.cards[targetFound.inst.cardId];
  if (!targetSpec || !isUnit(targetSpec)) return { state, events: [] };
  if (targetFound.inst.isToken) {
    const removed = removeFromArena(state, targetIid);
    return {
      state: removed.state,
      events: [
        { kind: 'CAPTURED', capturedIid: targetIid, capturerIid: captorIid },
        // tokens are "set aside" — we model that as gone from any zone.
      ],
    };
  }

  const removed = removeFromArena(state, targetIid);
  if (!removed.inst || !removed.ownerOriginal || !removed.originalArena) {
    return { state, events: [] };
  }
  const captured: CapturedCard = {
    iid: removed.inst.iid,
    cardId: removed.inst.cardId,
    originalController: removed.ownerOriginal,
    originalZone: removed.originalArena,
  };
  // Attach to captor.
  let s = removed.state;
  const p = s.players[captorOwner];
  s = withPlayer(s, captorOwner, { ...p, capturedByMe: [...p.capturedByMe, captured] });
  return {
    state: s,
    events: [{ kind: 'CAPTURED', capturedIid: targetIid, capturerIid: captorIid }],
  };
}

// Voluntary rescue of a specific captured iid (§v7 8.33.3).
export function rescue(
  state: GameState, capturedIid: string,
): { state: GameState; events: GameEvent[] } {
  // Find which player holds this captive and where the original owner was.
  for (const captorId of state.playerOrder) {
    const p = state.players[captorId];
    const idx = p.capturedByMe.findIndex(c => c.iid === capturedIid);
    if (idx === -1) continue;
    const cap = p.capturedByMe[idx];

    // Pull from capture zone.
    const newCaptured = p.capturedByMe.slice();
    newCaptured.splice(idx, 1);
    let s = withPlayer(state, captorId, { ...p, capturedByMe: newCaptured });

    // Restore to original arena (or ground if unknown), under original owner,
    // exhausted, no damage. Does NOT trigger When Played.
    const ownerP = s.players[cap.originalController];
    const restoredArena = cap.originalZone === 'space_arena' ? 'space_arena' : 'ground_arena';
    const inst: CardInstance = {
      iid: cap.iid, cardId: cap.cardId, damage: 0, exhausted: true,
      upgrades: [], shieldTokens: 0, isToken: false, enteredZoneAt: s.step,
    };
    const arr = getZoneArr(ownerP, restoredArena).slice();
    arr.push(inst);
    s = withPlayer(s, cap.originalController, withZoneArr(ownerP, restoredArena, arr));

    return {
      state: s,
      events: [{ kind: 'RESCUED', capturedIid, capturerIid: '', via: 'rescue' }],
    };
  }
  return { state, events: [] };
}

// Automatic release when a guarding unit leaves play (§v7 8.33.4). The
// state-based loop calls this for any player whose captives' captor is no
// longer in play. Week 3 simplification: we don't track per-captive-which-
// captor; releasing simply means rescuing ALL captives held by the player
// when the player has zero in-arena units. A finer model lands when capture
// gets more cards.
export function releaseAllCaptivesFor(
  state: GameState, captorOwner: PlayerId,
): { state: GameState; events: GameEvent[] } {
  const p = state.players[captorOwner];
  if (p.capturedByMe.length === 0) return { state, events: [] };
  let s = state;
  const events: GameEvent[] = [];
  for (const cap of p.capturedByMe) {
    const r = rescue(s, cap.iid);
    s = r.state;
    // overwrite via:'rescue' with via:'release' for accurate logging
    events.push(...r.events.map(e => e.kind === 'RESCUED' ? { ...e, via: 'release' as const } : e));
  }
  return { state: s, events };
}
