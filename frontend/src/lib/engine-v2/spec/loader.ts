// Minimal Week-1 loader. Takes an array of card and base specs and produces
// a CardRegistry. Full validator (Week 4) checks against the JSON Schema and
// the closed primitive enum; this is a structural stub.

import type { BaseSpec, CardSpec } from './types';
import type { CardRegistry } from '../state/types';

export function buildRegistry(cards: CardSpec[], bases: BaseSpec[]): CardRegistry {
  const reg: CardRegistry = { cards: {}, bases: {} };
  for (const c of cards) {
    if (reg.cards[c.id]) throw new Error(`Duplicate card id ${c.id}`);
    reg.cards[c.id] = c;
  }
  for (const b of bases) {
    if (reg.bases[b.id]) throw new Error(`Duplicate base id ${b.id}`);
    reg.bases[b.id] = b;
  }
  return reg;
}
