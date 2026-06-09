// Card spec types — the L3 data contract. See ENGINE_DESIGN.md §5.
//
// Week 1 only exercises vanilla units + bases (abilities: []). The full
// Ability / Effect / Selector types are declared as `unknown` placeholders so
// the spec format is forward-compatible. Week 2 replaces them with the real
// AST shapes from §5.3+.

import type { AspectIcon } from '../state/bus';
import type { Ability } from './ast';

export type CardType = 'unit' | 'event' | 'upgrade' | 'leader' | 'base' | 'token';
export type Arena = 'ground' | 'space';

export type { Ability };

export interface KeywordRef {
  name: string;
  value?: number;
  ability?: Ability; // for em-dash keywords (Bounty, Coordinate, Smuggle)
}

interface CardSpecBase {
  id: string;
  name: string;
  subtitle?: string | null;
  cost?: number;
  aspects?: AspectIcon[];
  traits?: string[];
  unique?: boolean;
  /** Printed oracle text, carried through from the DB for UI display (e.g. the
   *  playtest card-hover preview). Not used by the engine — purely informational. */
  text?: string | null;
}

export interface UnitSpec extends CardSpecBase {
  type: 'unit';
  arena: Arena;
  power: number;
  hp: number;
  keywords?: KeywordRef[];
  abilities?: Ability[];
}

export interface EventSpec extends CardSpecBase {
  type: 'event';
  abilities?: Ability[];
  /** Events normally drop keywords in v2, but Smuggle [Y] lives on events too
   *  (played from the resource zone) — carried so `smuggleCostOf` can read it. */
  keywords?: KeywordRef[];
}

export interface UpgradeSpec extends CardSpecBase {
  type: 'upgrade';
  powerModifier?: number;
  hpModifier?: number;
  keywords?: KeywordRef[];
  abilities?: Ability[];
}

export interface LeaderSpec extends CardSpecBase {
  type: 'leader';
  hp?: number;
  power?: number;
  arena?: Arena;
  leaderAbilities?: Ability[];
  leaderUnitAbilities?: Ability[];
  leaderUpgradeAbilities?: Ability[];
}

export interface TokenSpec extends CardSpecBase {
  type: 'token';
  tokenType: 'unit' | 'upgrade';
  arena?: Arena;
  power?: number;
  hp?: number;
  powerModifier?: number;
  hpModifier?: number;
  keywords?: KeywordRef[];
  abilities?: Ability[];
}

export type CardSpec = UnitSpec | EventSpec | UpgradeSpec | LeaderSpec | TokenSpec;

export interface BaseSpec {
  id: string;
  name: string;
  type: 'base';
  hp: number;
  aspects?: AspectIcon[];
  traits?: string[];
  abilities?: Ability[];
}

// Type guards — used by the reducer to route by card type.
export const isUnit = (s: CardSpec): s is UnitSpec => s.type === 'unit';
export const isEvent = (s: CardSpec): s is EventSpec => s.type === 'event';
export const isUpgrade = (s: CardSpec): s is UpgradeSpec => s.type === 'upgrade';
