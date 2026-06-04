// Plot — §19. "When you deploy a leader: You may play this card from your
// resource zone by paying its cost, replacing it with the top card of your
// deck." The behavior lives in reducer.applyDeployLeader (the deploy window scans
// the resource zone for cards with this keyword and offers to play each via
// playFromResourceZone), not in a keyword hook. This def is hook-free — its only
// job is to be a recognized keyword (so the validator doesn't flag it inert).

import type { KeywordDef } from './types';

export const Plot: KeywordDef = {
  name: 'plot',
};
