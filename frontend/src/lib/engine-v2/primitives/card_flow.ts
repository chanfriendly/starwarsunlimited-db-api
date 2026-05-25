// card_flow.draw — empty deck deals 3 damage to base per §v7 8.6.

import type { GameState, PlayerId } from '../state/types';
import type { GameEvent } from '../state/bus';
import { moveToZone } from './move';
import { damageBase } from './combat';

export function draw(
  state: GameState,
  reg: import('../state/types').CardRegistry,
  player: PlayerId,
  count: number,
): { state: GameState; events: GameEvent[] } {
  let s = state;
  const events: GameEvent[] = [];

  for (let i = 0; i < count; i++) {
    const p = s.players[player];
    if (p.deck.length === 0) {
      const r = damageBase(s, reg, player, 3, { combat: false, indirect: false });
      s = r.state;
      events.push(...r.events);
      continue;
    }
    const topIid = p.deck[0].iid;
    const moved = moveToZone(s, topIid, player, 'hand', { position: 'bottom' });
    s = moved.state;
    events.push({ kind: 'CARD_DRAWN', player, iid: topIid });
  }

  return { state: s, events };
}
