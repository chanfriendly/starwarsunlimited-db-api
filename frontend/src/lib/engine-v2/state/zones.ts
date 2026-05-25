// Zone semantics and lookup helpers. Keep zone access in one place — the
// reducer & primitives should not poke into PlayerState fields by name.

import type { CardInstance, GameState, PlayerId, PlayerState, Zone } from './types';

export const IN_PLAY_ZONES: Zone[] = [
  'base_zone', 'ground_arena', 'space_arena', 'resource_zone',
];

export const OUT_OF_PLAY_ZONES: Zone[] = [
  'hand', 'deck', 'discard',
];

export function isInPlay(z: Zone): boolean {
  return IN_PLAY_ZONES.includes(z);
}

export function getZoneArr(p: PlayerState, z: Zone): CardInstance[] {
  switch (z) {
    case 'hand': return p.hand;
    case 'deck': return p.deck;
    case 'discard': return p.discard;
    case 'resource_zone': return p.resources;
    case 'ground_arena': return p.groundArena;
    case 'space_arena': return p.spaceArena;
    default: throw new Error(`getZoneArr: unsupported zone ${z}`);
  }
}

export function withZoneArr(p: PlayerState, z: Zone, arr: CardInstance[]): PlayerState {
  switch (z) {
    case 'hand': return { ...p, hand: arr };
    case 'deck': return { ...p, deck: arr };
    case 'discard': return { ...p, discard: arr };
    case 'resource_zone': return { ...p, resources: arr };
    case 'ground_arena': return { ...p, groundArena: arr };
    case 'space_arena': return { ...p, spaceArena: arr };
    default: throw new Error(`withZoneArr: unsupported zone ${z}`);
  }
}

export interface CardLocation {
  controller: PlayerId;
  zone: Zone;
  index: number;
}

export function findCard(state: GameState, iid: string): { inst: CardInstance; loc: CardLocation } | undefined {
  for (const pid of state.playerOrder) {
    const p = state.players[pid];
    for (const z of ['hand', 'deck', 'discard', 'resource_zone', 'ground_arena', 'space_arena'] as Zone[]) {
      const arr = getZoneArr(p, z);
      const idx = arr.findIndex(c => c.iid === iid);
      if (idx >= 0) return { inst: arr[idx], loc: { controller: pid, zone: z, index: idx } };
    }
  }
  return undefined;
}

export function withPlayer(state: GameState, pid: PlayerId, p: PlayerState): GameState {
  return { ...state, players: { ...state.players, [pid]: p } };
}

export function mapInstance(
  state: GameState,
  iid: string,
  fn: (c: CardInstance) => CardInstance,
): GameState {
  const found = findCard(state, iid);
  if (!found) return state;
  const { loc } = found;
  const p = state.players[loc.controller];
  const arr = getZoneArr(p, loc.zone).slice();
  arr[loc.index] = fn(arr[loc.index]);
  return withPlayer(state, loc.controller, withZoneArr(p, loc.zone, arr));
}
