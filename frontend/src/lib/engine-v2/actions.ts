// Player actions accepted by the reducer. See ENGINE_DESIGN.md §6.2.
// Week 1 set; leader/upgrade/event paths land in Week 2.

import type { PlayerId } from './state/types';

export type PlayerAction =
  | { kind: 'START_GAME' }
  | { kind: 'PLAY_CARD'; player: PlayerId; iid: string }
  | { kind: 'ATTACK'; player: PlayerId; attackerIid: string; defenderIid: string | 'base' }
  | { kind: 'TAKE_COUNTER'; player: PlayerId; counter: 'initiative' | 'blast' | 'plan' }
  | { kind: 'PASS'; player: PlayerId }
  | { kind: 'RESOURCE_CARD'; player: PlayerId; iid: string }
  | { kind: 'DECLINE_RESOURCE'; player: PlayerId }
  | { kind: 'RESOLVE_CHOICE'; player: PlayerId; value?: string; targetIid?: string };
