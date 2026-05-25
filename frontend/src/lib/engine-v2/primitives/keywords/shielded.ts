// Shielded — §v7 7.5.12. "When Played/When Deployed/When Created: Give a
// Shield token to this unit."

import { mapInstance } from '../../state/zones';
import type { KeywordDef } from './types';

export const Shielded: KeywordDef = {
  name: 'shielded',
  onPlay: ({ state, inst }) => ({
    state: mapInstance(state, inst.iid, c => ({ ...c, shieldTokens: c.shieldTokens + 1 })),
    events: [{ kind: 'SHIELD_GAINED', iid: inst.iid }],
  }),
  onDeploy: ({ state, inst }) => ({
    state: mapInstance(state, inst.iid, c => ({ ...c, shieldTokens: c.shieldTokens + 1 })),
    events: [{ kind: 'SHIELD_GAINED', iid: inst.iid }],
  }),
  onCreate: ({ state, inst }) => ({
    state: mapInstance(state, inst.iid, c => ({ ...c, shieldTokens: c.shieldTokens + 1 })),
    events: [{ kind: 'SHIELD_GAINED', iid: inst.iid }],
  }),
};
