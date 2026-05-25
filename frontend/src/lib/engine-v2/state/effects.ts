// Lasting-effect storage. A LastingEffect is a Modifier scoped to a specific
// set of targets (snapshotted by iid at creation) with a defined expiration.
// State carries them on GameState.lastingEffects; the sweep happens at
// phase/round boundaries.
//
// Captured targets matter per §v7 7.7.3.D: "By default, a lasting effect only
// applies to a card that's in play at the time of the lasting effect's
// creation." So the engine snapshots iids at give-time, NOT a selector ref
// (which would re-resolve dynamically).

import type { Modifier, Predicate } from '../spec/ast';
import type { PlayerId } from './types';

export type ExpiryKind =
  | 'permanent'
  | 'while_source_in_play'
  | 'end_of_attack'
  | 'end_of_phase'
  | 'end_of_round'
  | 'until_condition';

export interface ExpiryUnitTargets {
  kind: 'units';
  iids: string[];
}

export interface ExpiryBaseTargets {
  kind: 'bases';
  players: PlayerId[];
}

export type LastingTargets = ExpiryUnitTargets | ExpiryBaseTargets;

export interface LastingEffectRec {
  id: string;
  modifier: Modifier;
  targets: LastingTargets;
  expiry: ExpiryKind;
  until?: Predicate;
  sourceIid?: string;
}
