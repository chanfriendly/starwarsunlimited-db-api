// Token registry. v7 §3.7 defines token cards as a card type that doesn't
// start in the deck — created by abilities, set aside when not in play.
//
// Hand-coded for Week 3. The production loader (Week 4) pulls these from the
// SWU API per Christian's "tools/authoring/build_token_registry.py" answer.

import type { TokenSpec } from '../spec/types';

export const TOKEN_REGISTRY: Record<string, TokenSpec> = {
  battle_droid: {
    id: 'TKN_BATTLE_DROID',
    name: 'Battle Droid',
    type: 'token',
    tokenType: 'unit',
    arena: 'ground',
    power: 1,
    hp: 1,
    aspects: ['villainy'],
    traits: ['separatist', 'droid', 'trooper'],
  },
  clone_trooper: {
    id: 'TKN_CLONE_TROOPER',
    name: 'Clone Trooper',
    type: 'token',
    tokenType: 'unit',
    arena: 'ground',
    power: 2,
    hp: 2,
    aspects: ['heroism'],
    traits: ['republic', 'clone', 'trooper'],
  },
  tie_fighter: {
    id: 'TKN_TIE_FIGHTER',
    name: 'TIE Fighter',
    type: 'token',
    tokenType: 'unit',
    arena: 'space',
    power: 1,
    hp: 1,
    aspects: ['villainy'],
    traits: ['imperial', 'vehicle', 'fighter'],
  },
  x_wing: {
    id: 'TKN_X_WING',
    name: 'X-Wing',
    type: 'token',
    tokenType: 'unit',
    arena: 'space',
    power: 2,
    hp: 2,
    aspects: ['heroism'],
    traits: ['rebel', 'vehicle', 'fighter'],
  },
  spy: {
    id: 'TKN_SPY',
    name: 'Spy',
    type: 'token',
    tokenType: 'unit',
    arena: 'ground',
    power: 0,
    hp: 2,
    traits: ['official'],
    keywords: [{ name: 'raid', value: 2 }],
  },
  experience: {
    id: 'TKN_EXPERIENCE',
    name: 'Experience',
    type: 'token',
    tokenType: 'upgrade',
    powerModifier: 1,
    hpModifier: 1,
    traits: ['learned'],
  },
  shield: {
    id: 'TKN_SHIELD',
    name: 'Shield',
    type: 'token',
    tokenType: 'upgrade',
    powerModifier: 0,
    hpModifier: 0,
    traits: ['armor'],
  },
};

export function getTokenSpec(tokenId: string): TokenSpec | undefined {
  return TOKEN_REGISTRY[tokenId];
}
