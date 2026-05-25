// Grit — §v7 7.5.6. +1 power per damage on this unit.
//
// Note: per §v7 7.5.6.C, during simultaneous combat damage the Grit unit does
// NOT receive bonus power from the new damage until after all damage is dealt.
// Our combat path applies damage in two sequential applies (defender first,
// then attacker per v7 6.3) — but the power read happens once per attack
// step. For Week 2 this is "close enough"; v1 has the same approximation.

import type { KeywordDef } from './types';

export const Grit: KeywordDef = {
  name: 'grit',
  bonusPower: ({ inst }) => inst.damage,
};
