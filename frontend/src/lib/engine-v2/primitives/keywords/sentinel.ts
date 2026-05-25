// Sentinel — §v7 7.5.11. "Units in this arena can't attack your non-Sentinel
// units or your base."
//
// Pure action-validation hook; doesn't change state, just constrains legal
// attacks. The reducer consults this before resolving an ATTACK action.

import type { KeywordDef } from './types';

export const Sentinel: KeywordDef = {
  name: 'sentinel',
  attackRestriction: () => 'force_target',
};
