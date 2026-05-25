// Ambush — §v7 7.5.5. "When Played/When Deployed/When Created: if there is
// an enemy unit this unit can attack, you may ready it and attack."
//
// Week 2 simplification: we ready the unit on play and rely on the demo's
// turn loop to use the readied unit (no interrupt attack inline). Same gap v1
// flagged; doesn't break the loop, costs the player initiative they wouldn't
// have spent.

import { mapInstance } from '../../state/zones';
import type { KeywordDef } from './types';

export const Ambush: KeywordDef = {
  name: 'ambush',
  onPlay: ({ state, inst }) => ({
    state: mapInstance(state, inst.iid, c => ({ ...c, exhausted: false })),
    events: [{ kind: 'READIED', iid: inst.iid }],
  }),
  onDeploy: ({ state, inst }) => ({
    state: mapInstance(state, inst.iid, c => ({ ...c, exhausted: false })),
    events: [{ kind: 'READIED', iid: inst.iid }],
  }),
  onCreate: ({ state, inst }) => ({
    state: mapInstance(state, inst.iid, c => ({ ...c, exhausted: false })),
    events: [{ kind: 'READIED', iid: inst.iid }],
  }),
};
