export type GameAction =
  | { type: 'PLAY_CARD';         iid: string; targetIid?: string }
  | { type: 'ATTACK';            attackerIid: string; defenderIid: string | 'base' }
  | { type: 'DEPLOY_LEADER';     leaderCardId: string }
  | { type: 'LEADER_ABILITY';    leaderCardId: string; targetIid?: string }
  | { type: 'USE_ABILITY';       iid: string; abilityIndex: number; targetIid?: string }
  /**
   * "Attack with a unit. It gets +N/+N for this attack."
   * Pays for the event card, applies a temporary stat buff to the attacker,
   * executes the attack, then removes the buff. One action / one turn taken.
   */
  | { type: 'PLAY_ATTACK_EVENT'; iid: string; attackerIid: string; defenderIid: string | 'base' }
  | { type: 'TAKE_COUNTER' }
  | { type: 'PASS_PRIORITY' }
  | { type: 'RESOURCE_CARD';     iid: string }
  | { type: 'END_REGROUP' };

export type ActionType = GameAction['type'];
