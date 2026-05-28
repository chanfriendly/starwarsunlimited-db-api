// Greedy AI for v2 — ported from play_cli.ts. Picks the highest-cost
// playable card; otherwise attacks base; otherwise attacks; otherwise passes.
// Setup + regroup: picks lowest-cost hand card to resource, or declines.

import type {
  CardRegistry, GameState, PlayerId, PlayerAction, Chooser,
} from '@/lib/engine-v2';
import { getLegalActions } from '@/lib/engine-v2';

export const aiChooser: Chooser = (prompt) => {
  if (prompt.kind === 'choose_one') return { kind: 'option', value: prompt.options[0]?.value ?? '' };
  if (prompt.kind === 'prompt_target') return { kind: 'targets', targets: prompt.candidates.slice(0, prompt.count) };
  return { kind: 'yes' };
};

export function aiPick(state: GameState, reg: CardRegistry, pid: PlayerId): PlayerAction | undefined {
  const { actions } = getLegalActions(state, reg, pid);
  if (actions.length === 0) return undefined;

  // Setup + regroup: prefer resourcing over declining.
  if (state.phase === 'setup' || (state.phase === 'regroup' && state.regroupStep === 'resource')) {
    const resourceCards = actions.filter(a => a.kind === 'RESOURCE_CARD');
    if (resourceCards.length > 0) {
      // Pick the lowest-cost card to resource (preserve high-cost plays).
      const p = state.players[pid];
      const ranked = resourceCards.slice().sort((a, b) => {
        if (a.kind !== 'RESOURCE_CARD' || b.kind !== 'RESOURCE_CARD') return 0;
        const ca = p.hand.find(h => h.iid === a.iid);
        const cb = p.hand.find(h => h.iid === b.iid);
        const sa = ca && reg.cards[ca.cardId];
        const sb = cb && reg.cards[cb.cardId];
        const costA = sa && 'cost' in sa ? (sa.cost ?? 0) : 99;
        const costB = sb && 'cost' in sb ? (sb.cost ?? 0) : 99;
        return costA - costB;
      });
      return ranked[0];
    }
    return actions[0]; // DECLINE_RESOURCE
  }

  // Action phase priority: PLAY_CARD (highest-cost we can afford) > ATTACK base > ATTACK > PASS
  const plays = actions.filter(a => a.kind === 'PLAY_CARD');
  if (plays.length > 0) {
    plays.sort((a, b) => {
      if (a.kind !== 'PLAY_CARD' || b.kind !== 'PLAY_CARD') return 0;
      const fa = state.players[pid].hand.find(c => c.iid === a.iid);
      const fb = state.players[pid].hand.find(c => c.iid === b.iid);
      const ca = fa && reg.cards[fa.cardId];
      const cb = fb && reg.cards[fb.cardId];
      const costA = ca && (ca.type === 'unit' || ca.type === 'event') ? (ca.cost ?? 0) : 99;
      const costB = cb && (cb.type === 'unit' || cb.type === 'event') ? (cb.cost ?? 0) : 99;
      return costB - costA;
    });
    return plays[0];
  }

  // Deploy leader if affordable.
  const deploys = actions.filter(a => a.kind === 'DEPLOY_LEADER');
  if (deploys.length > 0) return deploys[0];

  // Try base attacks before unit attacks.
  const baseHits = actions.filter(a => a.kind === 'ATTACK' && a.defenderIid === 'base');
  if (baseHits.length > 0) return baseHits[0];

  const unitHits = actions.filter(a => a.kind === 'ATTACK');
  if (unitHits.length > 0) return unitHits[0];

  // Action abilities if available.
  const abilities = actions.filter(a => a.kind === 'USE_ACTION_ABILITY');
  if (abilities.length > 0) return abilities[0];

  // Counters last (initiative is the only one wired).
  const counter = actions.find(a => a.kind === 'TAKE_COUNTER');
  if (counter) return counter;

  // PASS as fallback.
  return actions[actions.length - 1];
}
