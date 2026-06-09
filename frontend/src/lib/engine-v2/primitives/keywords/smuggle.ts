// Smuggle [Y] — §14. "You may play this card from your resource zone by paying
// cost Y instead of its printed cost, replacing it with the top card of your
// deck." The behavior lives in the SMUGGLE player action (legal.ts offers it for
// resource-zone cards with Smuggle; reducer.applySmuggle plays it via
// playFromResourceZone with the bracket cost), not in a keyword hook. Hook-free —
// its only job is to be a recognized keyword (so the validator doesn't flag it
// inert). The bracket cost is carried as the keyword's `value` (see translate).

import type { KeywordDef } from './types';

export const Smuggle: KeywordDef = {
  name: 'smuggle',
};
