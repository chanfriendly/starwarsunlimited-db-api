// Raid X — §v7 7.5.8. While attacking, this unit gets +X power.
//
// Applied at attack-declaration time by the reducer. Not exposed via the
// continuous bonusPower hook because Raid is a transient combat bonus,
// not a stat read modifier — putting it in bonusPower would make Raid units
// appear permanently buffed in the UI's stat display.

import type { KeywordDef } from './types';

export const Raid: KeywordDef = {
  name: 'raid',
  attackBonusPower: ({ value }) => value ?? 0,
};
