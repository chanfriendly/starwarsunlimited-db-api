import { PlayerId } from './types';
import { GameAction } from './actions';
import { GameEngine } from './engine';

export type AIDifficulty = 'easy' | 'normal';

export class HeuristicAI {
  constructor(
    private engine: GameEngine,
    private playerId: PlayerId,
    private difficulty: AIDifficulty = 'normal',
  ) {}

  chooseAction(): GameAction {
    const actions = this.engine.getLegalActions(this.playerId);

    if (this.difficulty === 'easy' && Math.random() < 0.3) {
      return actions[Math.floor(Math.random() * actions.length)];
    }

    return this.selectBestAction(actions);
  }

  private selectBestAction(actions: GameAction[]): GameAction {
    const state = this.engine.getState();
    const me = state.players[this.playerId];

    // 1. Deploy a leader if we can afford it (high board impact)
    const deploy = actions.find(a => a.type === 'DEPLOY_LEADER');
    if (deploy) return deploy;

    // 2. Play the highest-cost affordable unit (greedy)
    const plays = actions.filter(a => a.type === 'PLAY_CARD');
    if (plays.length > 0) {
      const best = plays.reduce((acc, a) => {
        if (a.type !== 'PLAY_CARD') return acc;
        const c = me.hand.find(h => h.iid === a.iid);
        if (!c) return acc;
        const cost = c.card.cost ?? c.card.energy_cost ?? 0;
        const accC = me.hand.find(h => h.iid === (acc as { type: 'PLAY_CARD'; iid: string }).iid);
        const accCost = accC ? (accC.card.cost ?? accC.card.energy_cost ?? 0) : -1;
        return cost > accCost ? a : acc;
      }, plays[0]);
      return best;
    }

    // 3. Attack the opponent's base if we can without dying in counterattack
    const baseAttacks = actions.filter(
      a => a.type === 'ATTACK' && a.defenderIid === 'base',
    ) as Extract<GameAction, { type: 'ATTACK' }>[];

    const safeBaseAttack = baseAttacks.find(a => {
      const attRef = findInArenas(state, this.playerId, a.attackerIid);
      if (!attRef) return false;
      return attRef.damage === 0; // don't attack with already-damaged units (conservative)
    });
    if (safeBaseAttack) return safeBaseAttack;

    // 4. Attack a unit to improve board (prefer killing units)
    const unitAttacks = actions.filter(
      a => a.type === 'ATTACK' && a.defenderIid !== 'base',
    ) as Extract<GameAction, { type: 'ATTACK' }>[];

    const killShot = unitAttacks.find(a => {
      const attRef = findInArenas(state, this.playerId, a.attackerIid);
      const defOpp = findInArenas(state, this.playerId === 'player1' ? 'player2' : 'player1', a.defenderIid as string);
      if (!attRef || !defOpp) return false;
      const power = (attRef.card.attack ?? 0);
      const defHealth = (defOpp.card.health ?? 1) - defOpp.damage;
      return power >= defHealth; // we can kill it
    });
    if (killShot) return killShot;

    // 5. Take counter — no good move found
    return { type: 'TAKE_COUNTER' };
  }
}

function findInArenas(
  state: ReturnType<GameEngine['getState']>,
  ownerId: PlayerId,
  iid: string,
) {
  const p = state.players[ownerId];
  return (
    p.groundArena.find(c => c.iid === iid) ??
    p.spaceArena.find(c => c.iid === iid) ??
    null
  );
}
