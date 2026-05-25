// getLegalActions(state, reg, pid) — enumerate every PlayerAction the named
// player can legally take right now. Used by the CLI driver to show options
// and by any AI to score-and-pick. Mirrors what the reducer would accept.

import type { PlayerAction } from './actions';
import type { CardRegistry, GameState, PlayerId } from './state/types';
import { findCard, getZoneArr } from './state/zones';
import { hasEffectiveKeyword } from './runtime/modifiers';
import { isUnit } from './spec/types';

export interface LegalActionsResult {
  actions: PlayerAction[];
  /** message explaining why no actions are legal (game over, off-turn, etc.) */
  reason?: string;
}

export function getLegalActions(state: GameState, reg: CardRegistry, pid: PlayerId): LegalActionsResult {
  if (state.winner) return { actions: [], reason: `Game over (${state.winner})` };

  if (state.phase === 'setup') {
    return setupActions(state, pid);
  }

  if (state.phase === 'regroup') {
    if (state.regroupStep !== 'resource') return { actions: [], reason: 'Engine is processing regroup' };
    if (state.activePlayer !== pid) return { actions: [], reason: `Wait — ${state.activePlayer} is resourcing` };
    if (state.players[pid].hasResourced) return { actions: [], reason: 'Already resourced this regroup' };
    return resourceActions(state, pid);
  }

  // action phase
  if (state.activePlayer !== pid) return { actions: [], reason: `Wait — ${state.activePlayer}'s turn` };
  if (state.players[pid].hasTakenCounterThisRound) {
    return { actions: [], reason: 'You took the initiative; auto-passing for the round' };
  }

  const actions: PlayerAction[] = [];

  // PLAY_CARD — every card in hand whose cost ≤ ready resources.
  const p = state.players[pid];
  const readyResourceCount = p.resources.filter(r => !r.exhausted).length;
  for (const c of p.hand) {
    const spec = reg.cards[c.cardId];
    if (!spec) continue;
    if (spec.type !== 'unit' && spec.type !== 'event') continue;
    const cost = spec.cost ?? 0;
    if (cost > readyResourceCount) continue;
    actions.push({ kind: 'PLAY_CARD', player: pid, iid: c.iid });
  }

  // ATTACK — every ready unit in arena × every legal defender.
  for (const z of ['ground_arena', 'space_arena'] as const) {
    const myUnits = getZoneArr(p, z).filter(u => !u.exhausted);
    for (const attacker of myUnits) {
      const oppId = state.playerOrder.find(o => o !== pid);
      if (!oppId) continue;
      const opp = state.players[oppId];
      const oppArena = getZoneArr(opp, z);

      // Sentinel constraint
      const attackerHasSaboteur = hasEffectiveKeyword(state, reg, attacker, pid, 'saboteur');
      const sentinels = attackerHasSaboteur
        ? []
        : oppArena.filter(c => hasEffectiveKeyword(state, reg, c, oppId, 'sentinel'));

      if (sentinels.length > 0) {
        for (const s of sentinels) {
          actions.push({ kind: 'ATTACK', player: pid, attackerIid: attacker.iid, defenderIid: s.iid });
        }
      } else {
        // Any enemy in this arena
        for (const def of oppArena) {
          actions.push({ kind: 'ATTACK', player: pid, attackerIid: attacker.iid, defenderIid: def.iid });
        }
        // Or attack base
        actions.push({ kind: 'ATTACK', player: pid, attackerIid: attacker.iid, defenderIid: 'base' });
      }
    }
  }

  // TAKE_COUNTER (initiative) — once per round per player
  if (!p.countersHeld.includes('initiative')) {
    actions.push({ kind: 'TAKE_COUNTER', player: pid, counter: 'initiative' });
  }

  // PASS — always legal
  actions.push({ kind: 'PASS', player: pid });

  return { actions };
}

function setupActions(state: GameState, pid: PlayerId): LegalActionsResult {
  if (state.activePlayer !== pid) return { actions: [], reason: `Wait — ${state.activePlayer} is placing` };
  const SETUP_RESOURCES = 2;
  const p = state.players[pid];
  if (p.resources.length >= SETUP_RESOURCES) return { actions: [], reason: 'Already placed setup resources' };
  const actions: PlayerAction[] = p.hand.map(c => ({ kind: 'RESOURCE_CARD' as const, player: pid, iid: c.iid }));
  actions.push({ kind: 'DECLINE_RESOURCE', player: pid });
  return { actions };
}

function resourceActions(state: GameState, pid: PlayerId): LegalActionsResult {
  const p = state.players[pid];
  const actions: PlayerAction[] = p.hand.map(c => ({ kind: 'RESOURCE_CARD' as const, player: pid, iid: c.iid }));
  actions.push({ kind: 'DECLINE_RESOURCE', player: pid });
  return { actions };
}

// Small helper to summarize an action for display.
export function describeAction(state: GameState, reg: CardRegistry, a: PlayerAction): string {
  switch (a.kind) {
    case 'START_GAME':       return 'Start game';
    case 'RESOURCE_CARD': {
      const f = findCard(state, a.iid); const spec = f && reg.cards[f.inst.cardId];
      return `Resource ${spec?.name ?? a.iid}`;
    }
    case 'DECLINE_RESOURCE': return 'Decline resource';
    case 'PLAY_CARD': {
      const f = findCard(state, a.iid); const spec = f && reg.cards[f.inst.cardId];
      const cost = spec && (spec.type === 'unit' || spec.type === 'event' || spec.type === 'upgrade') ? (spec.cost ?? 0) : 0;
      return `Play ${spec?.name ?? a.iid} (${cost})`;
    }
    case 'ATTACK': {
      const af = findCard(state, a.attackerIid);
      const aspec = af && reg.cards[af.inst.cardId];
      let target = 'base';
      if (a.defenderIid !== 'base') {
        const df = findCard(state, a.defenderIid);
        const dspec = df && reg.cards[df.inst.cardId];
        target = dspec?.name ?? a.defenderIid;
      }
      const pw = aspec && isUnit(aspec) ? aspec.power : '?';
      return `Attack ${target} with ${aspec?.name ?? a.attackerIid} (${pw} power)`;
    }
    case 'TAKE_COUNTER':     return `Take ${a.counter} counter`;
    case 'PASS':             return 'Pass';
    case 'RESOLVE_CHOICE':   return `Resolve choice (${a.value ?? a.targetIid ?? ''})`;
  }
}
