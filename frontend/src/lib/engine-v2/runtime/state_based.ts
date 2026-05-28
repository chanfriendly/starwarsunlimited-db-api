// State-based actions per §v7 1.16. Runs to fixpoint after every player
// action and after every primitive that may have changed HP, control, or
// attachment. Covers: base defeat (game over), unit defeat at 0 HP, with
// `defeat_unit` replacement abilities consulted before each would-be defeat.

import type { CardRegistry, GameState, PlayerId } from '../state/types';
import type { GameEvent } from '../state/bus';
import { getZoneArr, withPlayer, withZoneArr } from '../state/zones';
import { effectiveHp, effectivePower } from './modifiers';
import { collectDefeatUnitReplacements, makeProspectiveDefeatEvent } from './replacements';
import { applyEffect } from './interpret';
import type { Chooser } from './chooser';

export function runStateBased(
  state: GameState,
  reg: CardRegistry,
  chooser?: Chooser,
): { state: GameState; events: GameEvent[] } {
  let s = state;
  const events: GameEvent[] = [];

  // Loop to fixpoint. Each pass handles ONE dead unit (or terminal base
  // defeat) and then re-checks — defeat replacements may mutate state in ways
  // that change subsequent defeat decisions, so processing one at a time
  // keeps the read-after-write semantics honest.
  for (let guard = 0; guard < 256; guard++) {
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

    // Find ONE dead unit and process it. Defeat replacements intercept here:
    // if a `defeat_unit` replacement matches, run its `with` effect instead
    // of defeating. The unit stays in the arena; the next iteration of this
    // loop re-checks (so if the replacement's effect didn't reduce damage
    // below lethal, the next pass tries again and the 256-guard catches a
    // misbehaving card).
    const found = findOneDefeated(s, reg);
    if (found) {
      const { pid, zone, inst } = found;
      const lastKnown = {
        cardId: inst.cardId,
        power: effectivePower(s, reg, inst, pid),
        hp: effectiveHp(s, reg, inst, pid),
        damage: inst.damage,
        controller: pid,
      };

      const prospective = makeProspectiveDefeatEvent(inst, pid, lastKnown, false);
      const matches = collectDefeatUnitReplacements(s, reg, prospective);

      if (matches.length > 0) {
        // Replacement: run `with` instead of defeating. Per §v7 7.7.5 the
        // affected player chooses the order when multiple match; until that
        // chooser pass ships, source-creation order is deterministic.
        const matched = matches[0];
        const r = applyEffect(
          { state: s, reg, sourceIid: matched.sourceIid, sourcePlayer: matched.sourceController, chooser },
          matched.ability.with,
        );
        s = r.state;
        events.push(...r.events);
        changed = true;
        continue;
      }

      // No replacement matched — defeat for real.
      const result = processDefeat(s, pid, zone, inst, lastKnown);
      s = result.state;
      events.push(...result.events);
      changed = true;
      continue;
    }

    if (!changed) break;
  }

  return { state: s, events };
}

interface DeadUnit { pid: PlayerId; zone: 'ground_arena' | 'space_arena'; inst: import('../state/types').CardInstance }

function findOneDefeated(state: GameState, reg: CardRegistry): DeadUnit | undefined {
  for (const pid of state.playerOrder) {
    const p = state.players[pid];
    for (const z of ['ground_arena', 'space_arena'] as const) {
      const arr = getZoneArr(p, z);
      for (const c of arr) {
        if (c.damage >= effectiveHp(state, reg, c, pid)) {
          return { pid, zone: z, inst: c };
        }
      }
    }
  }
  return undefined;
}

function processDefeat(
  state: GameState, pid: PlayerId,
  zone: 'ground_arena' | 'space_arena',
  inst: import('../state/types').CardInstance,
  lastKnown: { cardId: string; power: number; hp: number; damage: number; controller: PlayerId },
): { state: GameState; events: GameEvent[] } {
  const events: GameEvent[] = [];
  const p = state.players[pid];
  const arr = getZoneArr(p, zone);
  const alive = arr.filter(c => c.iid !== inst.iid);
  const newDiscard = p.discard.slice();
  let newLeaders = p.leaders;

  events.push({ kind: 'DEFEATED', iid: inst.iid, combat: false, lastKnown });

  // Detach upgrades into the host owner's discard (cleared of damage/exhaust).
  for (const up of inst.upgrades) {
    events.push({ kind: 'UPGRADE_DETACHED', upgradeIid: up.iid, hostIid: inst.iid });
    newDiscard.push({ ...up, damage: 0, exhausted: false, upgrades: [] });
  }

  const leaderIdx = newLeaders.findIndex(l => l.isDeployed && l.unitIid === inst.iid);
  if (leaderIdx >= 0) {
    // Leader-unit defeat: flip back, do NOT discard.
    newLeaders = newLeaders.slice();
    newLeaders[leaderIdx] = {
      ...newLeaders[leaderIdx],
      isDeployed: false,
      unitIid: undefined,
      exhausted: false,
    };
    events.push({ kind: 'LEADER_DEFEATED', player: pid, leaderIid: inst.iid });
  } else {
    newDiscard.push({ ...inst, damage: 0, exhausted: false, upgrades: [] });
  }

  let newP = withZoneArr(p, zone, alive);
  newP = { ...newP, discard: newDiscard, leaders: newLeaders };
  return { state: withPlayer(state, pid, newP), events };
}
