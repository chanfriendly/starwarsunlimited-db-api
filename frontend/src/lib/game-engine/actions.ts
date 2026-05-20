export type GameAction =
  | { type: 'PLAY_CARD';     iid: string; targetIid?: string }
  | { type: 'ATTACK';        attackerIid: string; defenderIid: string | 'base' }
  | { type: 'DEPLOY_LEADER'; leaderCardId: string }
  | { type: 'USE_ABILITY';   iid: string; abilityIndex: number; targetIid?: string }
  | { type: 'TAKE_COUNTER' }
  | { type: 'PASS_PRIORITY' }
  | { type: 'RESOURCE_CARD'; iid: string }
  | { type: 'END_REGROUP' };

export type ActionType = GameAction['type'];
