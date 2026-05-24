import { CardInstance, GameState, PlayerId } from './types';
import { GameAction } from './actions';
import { GameEngine } from './engine';
import { computePower, effectiveHealth } from './keywords';

export type AIDifficulty = 'easy' | 'normal';

/**
 * Heuristic AI for the Twin Suns tabletop simulator.
 *
 * Architecture: score-based. Every legal action receives a numeric score;
 * the highest-scoring action is executed. This makes it easy to tune
 * individual action types without touching other branches.
 *
 * Scoring scale:
 *   200   killing the opponent's base (win condition)
 *   100   favorable trades (kill their unit, our unit survives)
 *    80   deploy a leader (high impact, costs no hand cards)
 *    60   neutral trade (both units die — worth it if their unit is more valuable)
 *    50   leader ability
 *    40   play a unit card (adjusted by stats-per-cost)
 *    30   play a damage/defeat event
 *    20   even chip damage to base (when ahead on board)
 *    10   chip damage to base (neutral board)
 *     5   play an event (draw, buff, misc)
 *     0   take counter / pass
 *   -40   bad trade (we die, they live)
 */
export class HeuristicAI {
  constructor(
    private engine: GameEngine,
    private playerId: PlayerId,
    private difficulty: AIDifficulty = 'normal',
  ) {}

  chooseAction(): GameAction {
    const actions = this.engine.getLegalActions(this.playerId);

    // Easy: 30% of turns take a purely random action
    if (this.difficulty === 'easy' && Math.random() < 0.3) {
      return actions[Math.floor(Math.random() * actions.length)];
    }

    return this.selectBestAction(actions);
  }

  private get oppId(): PlayerId {
    return this.playerId === 'player1' ? 'player2' : 'player1';
  }

  /** Rough unit worth: attack + remaining HP. Used to evaluate trades. */
  private unitValue(state: GameState, ci: CardInstance, ownerId: PlayerId): number {
    return computePower(state, ci, ownerId) + effectiveHealth(state, ci, ownerId) - ci.damage;
  }

  private selectBestAction(actions: GameAction[]): GameAction {
    const state = this.engine.getState();
    const me  = state.players[this.playerId];
    const opp = state.players[this.oppId];

    const myUnits  = [...me.groundArena,  ...me.spaceArena];
    const oppUnits = [...opp.groundArena, ...opp.spaceArena];

    const myBoardValue  = myUnits.reduce((s, u)  => s + this.unitValue(state, u,  this.playerId), 0);
    const oppBoardValue = oppUnits.reduce((s, u) => s + this.unitValue(state, u,  this.oppId),    0);
    const boardAdvantage = myBoardValue - oppBoardValue;

    let best: GameAction = { type: 'TAKE_COUNTER' };
    let bestScore = -Infinity;

    for (const action of actions) {
      const score = this.scoreAction(action, state, me, opp, myUnits, oppUnits, boardAdvantage);
      if (score > bestScore) {
        bestScore = score;
        best = action;
      }
    }

    return best;
  }

  private scoreAction(
    action: GameAction,
    state:  GameState,
    me:     GameState['players'][PlayerId],
    opp:    GameState['players'][PlayerId],
    myUnits:  CardInstance[],
    oppUnits: CardInstance[],
    boardAdvantage: number,
  ): number {
    switch (action.type) {
      // -----------------------------------------------------------------------
      // DEPLOY_LEADER — high-impact board play
      // -----------------------------------------------------------------------
      case 'DEPLOY_LEADER': {
        const leader = me.leaders.find(l => l.card.id === action.leaderCardId);
        if (!leader) return -100;
        const cost  = leader.card.cost ?? leader.card.energy_cost ?? 5;
        const stats = (leader.card.attack ?? 0) + (leader.card.health ?? 0);
        // Bonus when behind; penalty for deploying a cheap leader early (save resources)
        const boardBonus = boardAdvantage < 0 ? 15 : 0;
        return 80 + stats - cost * 2 + boardBonus;
      }

      // -----------------------------------------------------------------------
      // LEADER_ABILITY — use an available leader power
      // -----------------------------------------------------------------------
      case 'LEADER_ABILITY': {
        // Targeted abilities (exhaust, buff) are usually more valuable
        return action.targetIid ? 55 : 45;
      }

      // -----------------------------------------------------------------------
      // PLAY_CARD — units, events, upgrades
      // -----------------------------------------------------------------------
      case 'PLAY_CARD': {
        const ci = me.hand.find(h => h.iid === action.iid);
        if (!ci) return -100;
        const cost     = ci.card.energy_cost ?? ci.card.cost ?? 0;
        const cardType = (ci.card.type ?? '').toLowerCase();

        if (cardType === 'unit') {
          const stats = (ci.card.attack ?? 0) + (ci.card.health ?? 0);
          let score = 20 + stats * 1.5 - cost;
          // Sentinel: immediately improves our defense
          if (kw(ci, 'sentinel'))  score += 15;
          // Ambush: can strike immediately
          if (kw(ci, 'ambush'))    score += 10;
          // Overwhelm: good when we're pressing the base
          if (kw(ci, 'overwhelm')) score += 5;
          // Play units preferentially when losing the board
          if (boardAdvantage < -4) score += 12;
          return score;
        }

        if (cardType === 'event') {
          const text = (ci.card.text ?? '').toLowerCase();
          // Defeat effects: highest event value if we can use them
          if (/defeat/.test(text) && oppUnits.length > 0)   return 55;
          // Damage events: scale by how much damage
          const dmgMatch = text.match(/deal (\d+) damage/);
          if (dmgMatch) return 20 + Number(dmgMatch[1]) * 3;
          // Draw effects
          if (/draw \d+ card/.test(text)) return 30;
          // Stat buff events
          if (/\+\d+\/\+\d+/.test(text)) return 25;
          // Unknown event — play eventually but not urgently
          return 12;
        }

        // Upgrades and other types
        return 15;
      }

      // -----------------------------------------------------------------------
      // PLAY_ATTACK_EVENT — event that triggers an attack with a buff
      // -----------------------------------------------------------------------
      case 'PLAY_ATTACK_EVENT': {
        // Evaluate: does the buffed attack create a kill or kill the base?
        // We don't re-simulate here, but it's generally strong — score above
        // a plain attack, below a pure kill event.
        const eventCi = me.hand.find(h => h.iid === action.iid);
        const attacker = myUnits.find(u => u.iid === action.attackerIid);
        if (!eventCi || !attacker) return 10;

        const eventPower = computePower(state, attacker, this.playerId);

        if (action.defenderIid === 'base') {
          const baseHp = (opp.base.card.health ?? 30) - opp.base.damage;
          if (eventPower >= baseHp) return 200; // kills base → win condition
          return 25 + eventPower; // pressing the base
        }

        const defUnit = oppUnits.find(u => u.iid === action.defenderIid);
        if (!defUnit) return 15;

        const defHpRemaining = effectiveHealth(state, defUnit, this.oppId) - defUnit.damage;
        if (eventPower >= defHpRemaining) {
          // Buffed attack kills — treat like a kill shot
          return 65 + this.unitValue(state, defUnit, this.oppId);
        }
        return 20;
      }

      // -----------------------------------------------------------------------
      // ATTACK — primary combat action
      // -----------------------------------------------------------------------
      case 'ATTACK': {
        const attacker = myUnits.find(u => u.iid === action.attackerIid);
        if (!attacker) return -100;

        const attackPower       = computePower(state, attacker, this.playerId);
        const attackerEffHp     = effectiveHealth(state, attacker, this.playerId);
        const attackerHpLeft    = attackerEffHp - attacker.damage;

        // --- Attacking the opponent's base ---
        if (action.defenderIid === 'base') {
          const baseHp = (opp.base.card.health ?? 30) - opp.base.damage;

          // Win condition
          if (attackPower >= baseHp) return 200;

          // Base pressure score — more valuable when base is low
          const pressureRatio = attackPower / baseHp;
          let score = 8 + pressureRatio * 40;

          // Prefer base pressure when we dominate the board
          if (boardAdvantage > 6) score += 12;

          // Don't sacrifice cheap already-damaged units to chip base (they might
          // be needed for board trades next turn)
          if (attackerHpLeft <= 1 && attackPower < 3) score -= 15;

          return score;
        }

        // --- Attacking a unit ---
        const defender = oppUnits.find(u => u.iid === (action.defenderIid as string));
        if (!defender) return -100;

        const defenderPower      = computePower(state, defender, this.oppId);
        const defenderEffHp      = effectiveHealth(state, defender, this.oppId);
        const defenderHpLeft     = defenderEffHp - defender.damage;

        const weKillDefender   = attackPower >= defenderHpLeft;
        const theyKillAttacker = defenderPower >= attackerHpLeft;

        const myVal  = this.unitValue(state, attacker, this.playerId);
        const oppVal = this.unitValue(state, defender, this.oppId);

        if (weKillDefender && !theyKillAttacker) {
          // Best trade: kill their unit, ours survives
          return 100 + oppVal;
        }

        if (weKillDefender && theyKillAttacker) {
          // Mutual trade: both die — favorable only if their unit was worth more
          const netValue = oppVal - myVal;
          return 55 + netValue * 2;
        }

        if (!weKillDefender && theyKillAttacker) {
          // Worst: we die, they live — strongly avoid
          // Exception: if we have no good options and they have Sentinel, we must attack
          return -40;
        }

        // Neither dies — chip damage only
        // Slightly valuable if attacker has Overwhelm (chips base too)
        const baseScore = kw(attacker, 'overwhelm') ? 8 : 3;
        return baseScore;
      }

      // -----------------------------------------------------------------------
      // Pass / counter
      // -----------------------------------------------------------------------
      case 'TAKE_COUNTER':   return 0;
      case 'PASS_PRIORITY':  return -5;

      default: return 0;
    }
  }
}

/** Quick keyword membership check (case-insensitive, partial match on name). */
function kw(ci: CardInstance, name: string): boolean {
  return (ci.card.keywords ?? []).some(k => k.toLowerCase().includes(name));
}
