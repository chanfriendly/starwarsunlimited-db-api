// Overwhelm — §v7 7.5.7. While attacking, this unit deals its excess combat
// damage to the defending player's base. v7 added a clarification: no excess
// damage flows through if the defender wasn't defeated by the attack.
//
// Implemented as a flag the reducer reads in combat-damage routing.

import type { KeywordDef } from './types';

export const Overwhelm: KeywordDef = {
  name: 'overwhelm',
  overwhelmExcess: true,
};
