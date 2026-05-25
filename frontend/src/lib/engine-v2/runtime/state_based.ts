// State-based actions per §v7 1.16. Runs to fixpoint after every player
// action and after every primitive that may have changed HP, control, or
// attachment. Week 1 covers: base defeat (game over), unit defeat at 0 HP.

import type { CardRegistry, GameState, PlayerId } from '../state/types';
import type { GameEvent } from '../state/bus';
import { getZoneArr, withPlayer, withZoneArr } from '../state/zones';
import { effectiveHp, effectivePower } from './modifiers';

export function runStateBased(
  state: GameState,
  reg: CardRegistry,
): { state: GameState; events: GameEvent[] } {
  let s = state;
  const events: GameEvent[] = [];

  // Loop to fixpoint — each pass may emit DEFEATED, which (in Week 2+) may
  // cascade triggers. Keep iterating until nothing changes.
  for (let guard = 0; guard < 64; guard++) {
    let changed = false;

    // Base defeat — terminal.
    if (!s.winner) {
      for (const pid of s.playerOrder) {
        const p = s.players[pid];
        const baseHp = reg.bases[p.base.cardId]?.hp ?? 30;
        if (p.base.damage >= baseHp) {
          const winners = s.playerOrder.filter(o => {
            const op = s.players[o];
            const oHp = reg.bases[op.base.cardId]?.hp ?? 30;
            return op.base.damage < oHp;
          });
          const winner: PlayerId | 'draw' = winners.length === 1 ? winners[0] : 'draw';
          s = { ...s, winner };
          events.push({ kind: 'GAME_ENDED', winner });
          changed = true;
          break;
        }
      }
    }
    if (s.winner) break;

    // Unit defeat — damage >= effective HP. Move to discard.
    for (const pid of s.playerOrder) {
      const p = s.players[pid];
      for (const z of ['ground_arena', 'space_arena'] as const) {
        const arr = getZoneArr(p, z);
        const dead = arr.filter(c => c.damage >= effectiveHp(s, reg, c, pid));
        if (dead.length === 0) continue;
        const alive = arr.filter(c => c.damage < effectiveHp(s, reg, c, pid));
        const newDiscard = p.discard.slice();
        for (const c of dead) {
          const lastKnown = {
            cardId: c.cardId,
            power: effectivePower(s, reg, c, pid),
            hp: effectiveHp(s, reg, c, pid),
            damage: c.damage,
            controller: pid,
          };
          events.push({ kind: 'DEFEATED', iid: c.iid, combat: false, lastKnown });
          newDiscard.push({ ...c, damage: 0, exhausted: false });
        }
        let newP = withZoneArr(p, z, alive);
        newP = { ...newP, discard: newDiscard };
        s = withPlayer(s, pid, newP);
        changed = true;
      }
    }

    if (!changed) break;
  }

  return { state: s, events };
}
