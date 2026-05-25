// Restore X — §v7 7.5.9. On Attack: heal X damage from your base.

import { healBase } from '../combat';
import type { KeywordDef } from './types';

export const Restore: KeywordDef = {
  name: 'restore',
  onAttack: ({ state, reg, owner, value }) => {
    if (!value) return { state, events: [] };
    return healBase(state, owner, value, reg);
  },
};
