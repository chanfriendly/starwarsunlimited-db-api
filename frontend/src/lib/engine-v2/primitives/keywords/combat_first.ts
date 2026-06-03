// "Deals combat damage before the defender" — §1618c / §7.5.6d. NOT an SWU
// keyword (it's printed ability text, e.g. Incinerator Trooper: "While attacking,
// this unit deals combat damage before the defender. If the defender is defeated,
// it deals no combat damage."), but modeled internally as a marker keyword so the
// combat core can detect it via hasEffectiveKeyword (incl. when granted) and the
// validator recognizes it.
//
// The rule (§1618c): the unit that deals combat damage SECOND must SURVIVE the
// first damage before it can deal combat damage back. So if the attacker deals
// first and defeats the defender, the defender deals no combat damage in return.
// If the second (defending) unit survives and has Grit, it gets bonus power from
// the damage just dealt to it (§7.5.6d) — handled by recomputing its power after
// the first damage in runtime/attack.ts.
//
// Name encodes the role: `attacker_combat_first` = "while attacking, deals first"
// (Incinerator's scope). It only takes effect when the holder is the ATTACKER, so
// it correctly does nothing when the holder is defending. A symmetric
// "while defending" variant is not yet needed (no such card shipped).
//
// Like Ambush, this def is hook-free — its only job is to make
// hasEffectiveKeyword(..., 'attacker_combat_first') return true. The sequencing
// lives in resolveAttack (runtime/attack.ts).

import type { KeywordDef } from './types';

export const AttackerCombatFirst: KeywordDef = {
  name: 'attacker_combat_first',
};
