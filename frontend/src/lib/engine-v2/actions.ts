// Player actions accepted by the reducer. See ENGINE_DESIGN.md §6.2.
// Week 1 set; leader/upgrade/event paths land in Week 2.

import type { PlayerId } from './state/types';

export type PlayerAction =
  | { kind: 'START_GAME' }
  /** `targetIid` is required when the played card is an upgrade — it names the
   *  friendly unit to attach to. Ignored for units and events. */
  | { kind: 'PLAY_CARD'; player: PlayerId; iid: string; targetIid?: string }
  | { kind: 'DEPLOY_LEADER'; player: PlayerId; leaderIndex: number }
  /** Use an `Action [...]: …` ability on a card or leader. Exactly one of
   *  `sourceIid` (for in-play units, upgrades, or deployed leader-units) and
   *  `leaderIndex` (for un-deployed leaders) must be set. `abilityIndex`
   *  references the position in that source's ability list. */
  | { kind: 'USE_ACTION_ABILITY'; player: PlayerId; sourceIid?: string; leaderIndex?: number; abilityIndex: number; targetIid?: string }
  | { kind: 'ATTACK'; player: PlayerId; attackerIid: string; defenderIid: string | 'base' }
  | { kind: 'TAKE_COUNTER'; player: PlayerId; counter: 'initiative' | 'blast' | 'plan' }
  | { kind: 'PASS'; player: PlayerId }
  | { kind: 'RESOURCE_CARD'; player: PlayerId; iid: string }
  | { kind: 'DECLINE_RESOURCE'; player: PlayerId }
  | { kind: 'RESOLVE_CHOICE'; player: PlayerId; value?: string; targetIid?: string };
