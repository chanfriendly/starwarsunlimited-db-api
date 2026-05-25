// Keyword registry. The interpreter, reducer, and modifier layer all consult
// `KEYWORDS[name]` for keyword-specific behavior.

import { Ambush } from './ambush';
import { Grit } from './grit';
import { Overwhelm } from './overwhelm';
import { Raid } from './raid';
import { Restore } from './restore';
import { Saboteur } from './saboteur';
import { Sentinel } from './sentinel';
import { Shielded } from './shielded';
import type { KeywordDef } from './types';

export const KEYWORDS: Record<string, KeywordDef> = {
  ambush: Ambush,
  grit: Grit,
  overwhelm: Overwhelm,
  raid: Raid,
  restore: Restore,
  saboteur: Saboteur,
  sentinel: Sentinel,
  shielded: Shielded,
};

export type { KeywordDef };
export { defeatDefenderShields } from './saboteur';
