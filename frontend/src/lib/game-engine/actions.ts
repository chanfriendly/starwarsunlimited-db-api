export type GameAction =
  /**
   * Play a card from hand.
   * - targetIid: legacy single target (events with a single target, upgrades).
   * - targetIids: multi-target list. Convention by effect type:
   *     WHEN_PLAYED_DAMAGE_DUAL → [friendlyTarget, enemyTarget]
   */
  | { type: 'PLAY_CARD';         iid: string; targetIid?: string; targetIids?: string[] }
  /**
   * Attack with a unit.
   * - coordDamageTarget: chosen target for ON_ATTACK_DEAL_DAMAGE_TARGET
   *   (Kit Fisto pattern). Optional — the effect is "You may" so absence means
   *   the player declined to use it.
   * - coordDebuffTarget: chosen target for ON_ATTACK_DEBUFF_TARGET (Padmé
   *   Pursuing Peace pattern). Mandatory if the effect is active and any
   *   valid enemy target exists; absent only when no targets are available.
   */
  | {
      type: 'ATTACK';
      attackerIid: string;
      defenderIid: string | 'base';
      coordDamageTarget?: string;
      coordDebuffTarget?: string;
    }
  | { type: 'DEPLOY_LEADER';     leaderCardId: string }
  | { type: 'LEADER_ABILITY';    leaderCardId: string; targetIid?: string }
  /**
   * "Attack with a unit. It gets +N/+N for this attack."
   * Leader-ability variant of PLAY_ATTACK_EVENT. Exhausts the leader, applies
   * a temporary stat buff to the chosen attacker, executes the attack, then
   * removes the buff.
   */
  | { type: 'LEADER_ATTACK_ABILITY'; leaderCardId: string; attackerIid: string; defenderIid: string | 'base' }
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
