// Saboteur — §v7 7.5.10. Two effects:
//   1. Constant: ignore Sentinel when choosing what to attack
//   2. Triggered: On Attack: defeat all Shield tokens on the defender
//
// Sentinel-override is a flag the reducer queries. Shield-strip is an
// onAttack hook that zeroes the defender's shieldTokens.

import { mapInstance, findCard } from '../../state/zones';
import type { GameEvent } from '../../state/bus';
import type { KeywordDef } from './types';
import type { GameState } from '../../state/types';

export const Saboteur: KeywordDef = {
  name: 'saboteur',
  attackRestriction: () => 'override',
  onAttack: ({ state, inst }) => {
    // Find the current attack target by inspecting state.log? Simpler: the
    // reducer passes attack context to onAttack via a synthetic field we
    // can't add to KwLifecycleCtx without coupling. So Saboteur's shield
    // strip is invoked DIRECTLY from the reducer's attack flow with the
    // defender iid in scope. This hook is a no-op; see reducer.applyAttack.
    return { state, events: [] };
  },
};

// Exported helper the reducer calls during attack resolution.
export function defeatDefenderShields(state: GameState, defenderIid: string): { state: GameState; events: GameEvent[] } {
  const found = findCard(state, defenderIid);
  if (!found || found.inst.shieldTokens === 0) return { state, events: [] };
  const count = found.inst.shieldTokens;
  let s = state;
  s = mapInstance(s, defenderIid, c => ({ ...c, shieldTokens: 0 }));
  const events: GameEvent[] = [];
  for (let i = 0; i < count; i++) events.push({ kind: 'SHIELD_DEFEATED', iid: defenderIid });
  return { state: s, events };
}
