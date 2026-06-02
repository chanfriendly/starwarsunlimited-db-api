// Ambush — §v7 7.5.5. "When Played/Deployed/Created: if there is an enemy unit
// this unit can attack, you may ready it and attack that enemy unit."
//
// The behavior (ready + nested attack, with the "may" choice and target pick)
// needs chooser access, which the keyword lifecycle hooks don't have. So Ambush
// is resolved by `resolveAmbush` in runtime/attack.ts, called from the play /
// deploy / create sites in the reducer + tokens primitive (which DO have the
// chooser). This def intentionally has NO onPlay/onDeploy/onCreate hook — its
// only job is to make `hasEffectiveKeyword(..., 'ambush')` return true (incl.
// when Ambush is granted by another card, e.g. Admiral Piett) and to count as a
// recognized keyword. Adding a ready-only hook here would double-ready and, worse,
// ready a unit that then never attacks (the old bug).

import type { KeywordDef } from './types';

export const Ambush: KeywordDef = {
  name: 'ambush',
};
