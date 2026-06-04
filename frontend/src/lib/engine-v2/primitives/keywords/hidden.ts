// Hidden — §18. "This unit can't be attacked if it was played/deployed/created
// this phase." A conditional attack restriction on the DEFENDER, so (like
// Sentinel) the logic lives in attackIllegalReason (runtime/attack.ts), which has
// the attack context. §18b: a unit with both Hidden and Sentinel CAN be attacked
// (abilities can't stop a Sentinel from being attacked) — handled there.
//
// Like Ambush, this def is hook-free: its only job is to make
// hasEffectiveKeyword(..., 'hidden') return true (incl. when granted) and to be a
// recognized keyword.

import type { KeywordDef } from './types';

export const Hidden: KeywordDef = {
  name: 'hidden',
};
