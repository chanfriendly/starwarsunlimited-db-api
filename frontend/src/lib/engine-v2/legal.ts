// getLegalActions(state, reg, pid) — enumerate every PlayerAction the named
// player can legally take right now. Used by the CLI driver to show options
// and by any AI to score-and-pick. Mirrors what the reducer would accept.

import type { PlayerAction } from './actions';
import type { CardRegistry, GameState, PlayerId } from './state/types';
import type { Ability, ActionAbility, ActionAbilityCost } from './spec/ast';
import { findCard, getZoneArr } from './state/zones';
import { effectivePower, hasEffectiveKeyword } from './runtime/modifiers';
import { isLimitExhausted, makeUndeployedLeaderIid } from './runtime/triggers';

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
    if (spec.type !== 'unit' && spec.type !== 'event' && spec.type !== 'upgrade') continue;
    const cost = spec.cost ?? 0;
    if (cost > readyResourceCount) continue;
    if (spec.type === 'upgrade') {
      // One PLAY_CARD action per legal friendly host. No host → no action.
      const hosts = [...p.groundArena, ...p.spaceArena];
      for (const host of hosts) {
        actions.push({ kind: 'PLAY_CARD', player: pid, iid: c.iid, targetIid: host.iid });
      }
    } else {
      actions.push({ kind: 'PLAY_CARD', player: pid, iid: c.iid });
    }
  }

  // DEPLOY_LEADER — every un-deployed leader whose cost ≤ ready resources.
  p.leaders.forEach((leader, idx) => {
    if (leader.isDeployed) return;
    const spec = reg.cards[leader.cardId];
    if (!spec || spec.type !== 'leader') return;
    const cost = spec.cost ?? 0;
    if (cost > readyResourceCount) return;
    actions.push({ kind: 'DEPLOY_LEADER', player: pid, leaderIndex: idx });
  });

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

  // USE_ACTION_ABILITY — every action ability whose cost is payable and
  // limit isn't exhausted. Walks: in-arena units (+ their upgrades) and every
  // leader (un-deployed → leaderAbilities; deployed leader-unit → leaderUnitAbilities).
  for (const z of ['ground_arena', 'space_arena'] as const) {
    const arr = getZoneArr(p, z);
    for (const card of arr) {
      const cardSpec = reg.cards[card.cardId];
      if (cardSpec) {
        const abs = cardSpec.type === 'leader'
          ? (cardSpec.leaderUnitAbilities ?? [])
          : ('abilities' in cardSpec ? cardSpec.abilities ?? [] : []);
        pushActionAbilities(state, reg, pid, abs, card.iid, card.exhausted, readyResourceCount, actions, { sourceIid: card.iid });
      }
      for (const up of card.upgrades) {
        const upSpec = reg.cards[up.cardId];
        if (!upSpec || !('abilities' in upSpec)) continue;
        pushActionAbilities(state, reg, pid, upSpec.abilities ?? [], up.iid, up.exhausted, readyResourceCount, actions, { sourceIid: up.iid });
      }
    }
  }
  p.leaders.forEach((leader, idx) => {
    const spec = reg.cards[leader.cardId];
    if (!spec || spec.type !== 'leader') return;
    if (leader.isDeployed) return; // deployed-side is enumerated above via the leader-unit CardInstance
    const abs = spec.leaderAbilities ?? [];
    const iid = makeUndeployedLeaderIid(pid, idx);
    pushActionAbilities(state, reg, pid, abs, iid, leader.exhausted, readyResourceCount, actions, { leaderIndex: idx });
  });

  // TAKE_COUNTER (initiative) — once per round game-wide. Per §v7 7.4 there
  // is a single initiative counter passed between players; once any player
  // takes it this round, no one else can. Previously the check only looked
  // at this player's own `countersHeld`, which let the second player also
  // take initiative and produced a soft-hang when both seats had
  // hasTakenCounterThisRound=true (bug #2 from session-45 UAT).
  const anyoneTookCounterThisRound = state.playerOrder.some(o => state.players[o].hasTakenCounterThisRound);
  if (!anyoneTookCounterThisRound && !p.countersHeld.includes('initiative')) {
    actions.push({ kind: 'TAKE_COUNTER', player: pid, counter: 'initiative' });
  }

  // PASS — always legal
  actions.push({ kind: 'PASS', player: pid });

  return { actions };
}

function isCostPayable(state: GameState, pid: PlayerId, cost: ActionAbilityCost | undefined, sourceExhausted: boolean, readyResources: number): boolean {
  if (!cost) return true;
  if (cost.exhaust && sourceExhausted) return false;
  if (cost.resources && cost.resources > readyResources) return false;
  if (cost.discard && state.players[pid].hand.length < cost.discard.count) return false;
  // defeat / remove_shield are validated at resolution time — they may target
  // a 0-candidate set in which case the cost effectively can't be paid. For
  // legal enumeration we accept and let the reducer throw if needed.
  return true;
}

function pushActionAbilities(
  state: GameState, reg: CardRegistry, pid: PlayerId,
  abs: Ability[], iidForLimit: string, sourceExhausted: boolean, readyResources: number,
  out: PlayerAction[], ref: { sourceIid?: string; leaderIndex?: number },
): void {
  abs.forEach((ab, idx) => {
    if (ab.type !== 'action') return;
    const aab = ab as ActionAbility;
    if (aab.limit && isLimitExhausted(state, pid, 'act', iidForLimit, idx, aab.limit)) return;
    if (!isCostPayable(state, pid, aab.cost, sourceExhausted, readyResources)) return;
    out.push({
      kind: 'USE_ACTION_ABILITY',
      player: pid,
      sourceIid: ref.sourceIid,
      leaderIndex: ref.leaderIndex,
      abilityIndex: idx,
    });
  });
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
      if (a.targetIid) {
        const hf = findCard(state, a.targetIid);
        const hspec = hf && reg.cards[hf.inst.cardId];
        return `Play ${spec?.name ?? a.iid} (${cost}) on ${hspec?.name ?? a.targetIid}`;
      }
      return `Play ${spec?.name ?? a.iid} (${cost})`;
    }
    case 'DEPLOY_LEADER': {
      const p = state.players[a.player];
      const leader = p?.leaders[a.leaderIndex];
      const spec = leader && reg.cards[leader.cardId];
      const cost = spec && spec.type === 'leader' ? (spec.cost ?? 0) : 0;
      return `Deploy leader ${spec?.name ?? a.leaderIndex} (${cost})`;
    }
    case 'USE_ACTION_ABILITY': {
      if (a.leaderIndex !== undefined) {
        const leader = state.players[a.player]?.leaders[a.leaderIndex];
        const spec = leader && reg.cards[leader.cardId];
        return `Use ${spec?.name ?? `leader#${a.leaderIndex}`} action #${a.abilityIndex}`;
      }
      if (a.sourceIid) {
        const f = findCard(state, a.sourceIid);
        const spec = f && reg.cards[f.inst.cardId];
        return `Use ${spec?.name ?? a.sourceIid} action #${a.abilityIndex}`;
      }
      return `Use action #${a.abilityIndex}`;
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
      // Use effective power so leaders, tokens, and units with auras/upgrades
      // all render their actual attack power instead of '?'. Previously this
      // gated on `isUnit(aspec)` which filtered out type='leader' and
      // type='token' specs — bug #4 from session-45 UAT.
      const pw = af ? effectivePower(state, reg, af.inst, af.loc.controller) : '?';
      return `Attack ${target} with ${aspec?.name ?? a.attackerIid} (${pw} power)`;
    }
    case 'TAKE_COUNTER':     return `Take ${a.counter} counter`;
    case 'PASS':             return 'Pass';
    case 'RESOLVE_CHOICE':   return `Resolve choice (${a.value ?? a.targetIid ?? ''})`;
  }
}
