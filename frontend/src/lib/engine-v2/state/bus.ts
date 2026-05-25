// Event taxonomy. See ENGINE_DESIGN.md §3 "Event bus".
// Week 1 emits a subset; the full union is locked here so Week 2+ trigger code
// has a stable target.

import type { PlayerId, Zone } from './types';

export type AspectIcon = 'villainy' | 'heroism' | 'command' | 'aggression' | 'vigilance' | 'cunning';

export interface CardSnapshot {
  cardId: string;
  power: number;
  hp: number;
  damage: number;
  controller: PlayerId;
}

export type GameEvent =
  | { kind: 'GAME_STARTED' }
  | { kind: 'PHASE_STARTED'; phase: string }
  | { kind: 'PHASE_ENDED'; phase: string }
  | { kind: 'ROUND_STARTED'; round: number }
  | { kind: 'ROUND_ENDED'; round: number }
  | { kind: 'TURN_STARTED'; player: PlayerId }
  | { kind: 'CARD_PLAYED'; iid: string; cardId: string; controller: PlayerId; viaSmuggle?: boolean; viaPlot?: boolean }
  | { kind: 'CARD_DRAWN'; player: PlayerId; iid: string }
  | { kind: 'CARD_DISCARDED'; player: PlayerId; iid: string; from: Zone }
  | { kind: 'CARD_REVEALED'; player: PlayerId; iid: string }
  | { kind: 'CARD_DISCLOSED'; player: PlayerId; iids: string[]; aspects: AspectIcon[] }
  | { kind: 'ZONE_CHANGED'; iid: string; from: Zone; to: Zone }
  | { kind: 'ARENA_MOVED'; iid: string; from: 'ground_arena' | 'space_arena'; to: 'ground_arena' | 'space_arena' }
  | { kind: 'UPGRADE_ATTACHED'; upgradeIid: string; hostIid: string }
  | { kind: 'UPGRADE_DETACHED'; upgradeIid: string; hostIid: string }
  | { kind: 'CAPTURED'; capturedIid: string; capturerIid: string }
  | { kind: 'RESCUED'; capturedIid: string; capturerIid: string; via: 'rescue' | 'release' }
  | { kind: 'ATTACK_DECLARED'; attackerIid: string; defenderIid: string | 'base'; defendingPlayer: PlayerId }
  | { kind: 'ATTACK_ENDED'; attackerIid: string; defenderIid: string | 'base'; damageDealt: number }
  | { kind: 'DAMAGE_DEALT'; sourceIid?: string; targetIid: string | { base: PlayerId }; amount: number; combat: boolean; indirect: boolean }
  | { kind: 'DAMAGE_PREVENTED'; targetIid: string; amount: number; by?: string }
  | { kind: 'HEALED'; targetIid: string | { base: PlayerId }; amount: number }
  | { kind: 'DEFEATED'; iid: string; by?: PlayerId; combat: boolean; lastKnown: CardSnapshot }
  | { kind: 'SHIELD_GAINED'; iid: string }
  | { kind: 'SHIELD_DEFEATED'; iid: string }
  | { kind: 'EXHAUSTED'; iid: string }
  | { kind: 'READIED'; iid: string }
  | { kind: 'CONTROL_CHANGED'; iid: string; from: PlayerId; to: PlayerId }
  | { kind: 'LEADER_DEPLOYED'; player: PlayerId; leaderIid: string; as: 'unit' | 'upgrade'; targetIid?: string }
  | { kind: 'LEADER_DEFEATED'; player: PlayerId; leaderIid: string }
  | { kind: 'TOKEN_CREATED'; iid: string; tokenId: string; controller: PlayerId; zone: Zone }
  | { kind: 'FORCE_TOKEN_CREATED'; player: PlayerId }
  | { kind: 'FORCE_USED'; player: PlayerId }
  | { kind: 'RESOURCE_PLACED'; player: PlayerId; iid: string }
  | { kind: 'RESOURCE_SPENT'; player: PlayerId; iid: string }
  | { kind: 'COUNTER_TAKEN'; player: PlayerId; counter: 'initiative' | 'blast' | 'plan' }
  | { kind: 'GAME_ENDED'; winner: PlayerId | 'draw' };
