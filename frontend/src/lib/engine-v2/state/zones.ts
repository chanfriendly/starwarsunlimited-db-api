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
    // Attached upgrades are in play too — an upgrade's OWN triggered/constant
    // ability resolves with the upgrade as source (e.g. The Darksaber's
    // When-Played), so it must be findable. Report it at its host's arena +
    // controller (index −1 = "attached, not a top-level arena slot").
    for (const z of ['ground_arena', 'space_arena'] as Zone[]) {
      for (const host of getZoneArr(p, z)) {
        const up = host.upgrades.find(u => u.iid === iid);
        if (up) return { inst: up, loc: { controller: pid, zone: z, index: -1 } };
      }
    }
  }
  return undefined;
}

/** Locate an upgrade by iid: returns the host unit + index within its upgrades array. */
export interface UpgradeLocation { hostIid: string; controller: PlayerId; zone: Zone; index: number }

export function findUpgrade(state: GameState, iid: string): { inst: CardInstance; loc: UpgradeLocation } | undefined {
  for (const pid of state.playerOrder) {
    const p = state.players[pid];
    for (const z of ['ground_arena', 'space_arena'] as Zone[]) {
      const arr = getZoneArr(p, z);
      for (const host of arr) {
        const idx = host.upgrades.findIndex(u => u.iid === iid);
        if (idx >= 0) return { inst: host.upgrades[idx], loc: { hostIid: host.iid, controller: pid, zone: z, index: idx } };
      }
    }
  }
  return undefined;
}

/** Find the host unit of an upgrade, by upgrade iid. */
export function findHostOfUpgrade(state: GameState, upgradeIid: string): { inst: CardInstance; controller: PlayerId; zone: Zone } | undefined {
  for (const pid of state.playerOrder) {
    const p = state.players[pid];
    for (const z of ['ground_arena', 'space_arena'] as Zone[]) {
      const arr = getZoneArr(p, z);
      for (const host of arr) {
        if (host.upgrades.some(u => u.iid === upgradeIid)) {
          return { inst: host, controller: pid, zone: z };
        }
      }
    }
  }
  return undefined;
}

/** True iff `pid` is forbidden from playing a card named `cardName` — i.e. an
 *  OPPONENT controls an in-play unit that has named that card ("opponents can't
 *  play the named card" — Regional Governor). Pure state read; matches by card
 *  NAME (all copies/variants of the named card are blocked). */
export function isPlayNameBlocked(state: GameState, pid: PlayerId, cardName: string): boolean {
  for (const oppId of state.playerOrder) {
    if (oppId === pid) continue;
    const opp = state.players[oppId];
    for (const u of [...opp.groundArena, ...opp.spaceArena]) {
      if (u.namedCard === cardName) return true;
    }
  }
  return false;
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
