// Grit — §7.5.6. +1 power per damage on this unit ("+1/+0 for each damage").
//
// §7.5.6c: in simultaneous combat, a Grit unit does NOT get bonus power from the
// damage it takes that combat until after all damage is dealt. This is handled
// correctly by the combat core (runtime/attack.ts): both the attacker's and the
// defender's combat power are SNAPSHOT before either damage application lands, so
// the defender deals its pre-damage power back (verified by the "Grit in
// simultaneous combat" scenario, which replicates the rules' 2/2-vs-1/3 example).
// §7.5.6d (an attacker that deals damage first, before the defender) would need a
// "deals combat damage before the defender" ability — none exists yet; when one
// lands, that ordering must re-read the defender's power after the first hit.

import type { KeywordDef } from './types';

export const Grit: KeywordDef = {
  name: 'grit',
  bonusPower: ({ inst }) => inst.damage,
};
