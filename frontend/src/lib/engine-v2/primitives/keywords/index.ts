// Keyword registry. The interpreter, reducer, and modifier layer all consult
// `KEYWORDS[name]` for keyword-specific behavior.

import { Ambush } from './ambush';
import { AttackerCombatFirst } from './combat_first';
import { Grit } from './grit';
import { Hidden } from './hidden';
import { Overwhelm } from './overwhelm';
import { Plot } from './plot';
import { Raid } from './raid';
import { Restore } from './restore';
import { Saboteur } from './saboteur';
import { Sentinel } from './sentinel';
import { Shielded } from './shielded';
import type { KeywordDef } from './types';

export const KEYWORDS: Record<string, KeywordDef> = {
  ambush: Ambush,
  attacker_combat_first: AttackerCombatFirst,
  grit: Grit,
  hidden: Hidden,
  overwhelm: Overwhelm,
  plot: Plot,
  raid: Raid,
  restore: Restore,
  saboteur: Saboteur,
  sentinel: Sentinel,
  shielded: Shielded,
};

export type { KeywordDef };
export { defeatDefenderShields } from './saboteur';
