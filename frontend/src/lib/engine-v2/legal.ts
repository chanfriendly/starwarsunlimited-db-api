// getLegalActions(state, reg, pid) — enumerate every PlayerAction the named
// player can legally take right now. Used by the CLI driver to show options
// and by any AI to score-and-pick. Mirrors what the reducer would accept.

import type { PlayerAction } from './actions';
import type { CardRegistry, GameState, PlayerId } from './state/types';
import type { Ability, ActionAbility, ActionAbilityCost, Effect, Selector } from './spec/ast';
import { findCard, getZoneArr } from './state/zones';
import { effectivePower, hasEffectiveKeyword } from './runtime/modifiers';
import { isLimitExhausted, makeUndeployedLeaderIid } from './runtime/triggers';
import { resolveSelector } from './runtime/selectors';
import { defaultChooser } from './runtime/chooser';
import { effectiveCost, exploitOf } from './runtime/cost';

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
  // Credit tokens are one-shot resources spendable to PLAY a card (the reducer
  // spends them in applyPlayCard). They are NOT yet wired into action-ability /
  // deploy cost payment, so only the play-a-card affordability counts them.
  const playAffordCount = readyResourceCount + p.creditTokens.length;
  for (const c of p.hand) {
    const spec = reg.cards[c.cardId];
    if (!spec) continue;
    if (spec.type !== 'unit' && spec.type !== 'event' && spec.type !== 'upgrade') continue;
    const cost = effectiveCost(state, reg, spec, pid);
    // Exploit (§16): the player may defeat up to X friendly units when playing
    // this card, each cutting the cost by 2 (floored at 0). The card is
    // affordable if it's payable at the best-case (max) reduction; how many to
    // actually sacrifice is chosen in reducer.applyPlayCard.
    const exploit = exploitOf(spec);
    const maxSac = Math.min(exploit, p.groundArena.length + p.spaceArena.length);
    const minCost = Math.max(0, cost - 2 * maxSac);
    if (minCost > playAffordCount) continue;
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

  // DEPLOY_LEADER — every un-deployed leader whose deploy cost ≤ TOTAL
  // resources. Twin Suns house rule: deploying is free (spends nothing); the
  // cost is a threshold on the total pool, so exhausted resources still count
  // and spending on a unit first never blocks a deploy. See CLAUDE.md.
  const totalResourceCount = p.resources.length;
  p.leaders.forEach((leader, idx) => {
    if (leader.isDeployed) return;
    if (leader.hasDeployed) return; // Epic Action is once per game — no redeploy after flip-back
    const spec = reg.cards[leader.cardId];
    if (!spec || spec.type !== 'leader') return;
    const cost = spec.cost ?? 0;
    if (cost > totalResourceCount) return;
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
        // Any enemy in this arena, except a Hidden unit that entered play this
        // phase (§18 — mirrors attackIllegalReason so legal/reducer agree; a
        // Hidden+Sentinel unit is offered via the sentinels branch above).
        for (const def of oppArena) {
          const hiddenProtected =
            state.phaseStartedAtStep !== undefined
            && def.enteredZoneAt >= state.phaseStartedAtStep
            && hasEffectiveKeyword(state, reg, def, oppId, 'hidden')
            && !hasEffectiveKeyword(state, reg, def, oppId, 'sentinel');
          if (hiddenProtected) continue;
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

  // TAKE_COUNTER (Twin Suns "Take an Available Counter"). Three counters —
  // initiative, blast, plan — each takeable once per round game-wide. A player
  // takes at most one per round (and is then done for the round). Offer every
  // counter not yet taken this round, provided this player hasn't taken one.
  if (!p.hasTakenCounterThisRound) {
    const taken = state.countersTakenThisRound ?? [];
    for (const counter of ['initiative', 'blast', 'plan'] as const) {
      if (!taken.includes(counter)) {
        actions.push({ kind: 'TAKE_COUNTER', player: pid, counter });
      }
    }
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

/** A scoped "chosen" selector with a mandatory count (numeric, or a range whose
 *  min ≥ 1). These force the player to pick a target; if no candidate exists the
 *  ability would just waste its cost, so we don't offer it. A `{ min: 0 }` range
 *  ("up to N") is optional and never gated. */
function mandatoryChosenTarget(sel: Selector | undefined): sel is Extract<Selector, { selector?: unknown }> {
  if (!sel || !('selector' in sel)) return false;
  const s = sel.selector;
  if (s !== 'chosen' && s !== 'self_choose' && s !== 'opponent_choose') return false;
  const c = sel.count;
  if (typeof c === 'object' && c !== null) return (c.min ?? 0) >= 1;
  return true; // numeric or undefined count → mandatory pick
}

/** True if the action's effect requires choosing a target but none is available.
 *  Resolves the candidate set with the deterministic chooser (no side effects);
 *  an empty result for a mandatory chosen target means the ability can't do
 *  anything, so it shouldn't be offered. `optional` ("you may") effects are
 *  never gated — declining is the player's call. */
function actionTargetUnsatisfiable(
  state: GameState, reg: CardRegistry, pid: PlayerId, sourceIid: string | undefined, ability: ActionAbility,
): boolean {
  const eff: Effect = ability.do;
  if (eff.effect === 'optional') return false;
  const target = 'target' in eff ? (eff.target as Selector) : undefined;
  if (!mandatoryChosenTarget(target)) return false;
  const ctx = { state, reg, sourceIid, sourcePlayer: pid, chooser: defaultChooser };
  return resolveSelector(ctx, target).length === 0;
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
    const srcIid = ref.sourceIid
      ?? (ref.leaderIndex !== undefined ? makeUndeployedLeaderIid(pid, ref.leaderIndex) : undefined);
    if (actionTargetUnsatisfiable(state, reg, pid, srcIid, aab)) return;
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
      const cost = spec && (spec.type === 'unit' || spec.type === 'event' || spec.type === 'upgrade') ? effectiveCost(state, reg, spec, a.player) : 0;
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
