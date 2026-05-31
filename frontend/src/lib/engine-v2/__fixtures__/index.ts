// Fixture aggregator — imports all Week 1+2 card JSON files so the demo
// (and any future test) can pass them to buildRegistry() without enumerating
// each path. Real production loading reads from disk/DB.

import c001 from './cards/W1_001.json';
import c002 from './cards/W1_002.json';
import c003 from './cards/W1_003.json';
import c004 from './cards/W1_004.json';
import c005 from './cards/W1_005.json';
import c006 from './cards/W1_006.json';
import c007 from './cards/W1_007.json';
import c008 from './cards/W1_008.json';
import c009 from './cards/W1_009.json';
import c010 from './cards/W1_010.json';
import b001 from './cards/B_001.json';
import b002 from './cards/B_002.json';

import w2c001 from './cards/W2_001.json';
import w2c002 from './cards/W2_002.json';
import w2c003 from './cards/W2_003.json';
import w2c004 from './cards/W2_004.json';
import w2c005 from './cards/W2_005.json';
import w2c006 from './cards/W2_006.json';
import w2c007 from './cards/W2_007.json';
import w2c008 from './cards/W2_008.json';
import w2c009 from './cards/W2_009.json';
import w2c010 from './cards/W2_010.json';

import type { BaseSpec, CardSpec } from '../spec/types';

export const W1_CARDS: CardSpec[] = [
  c001, c002, c003, c004, c005, c006, c007, c008, c009, c010,
] as CardSpec[];

export const W1_BASES: BaseSpec[] = [b001, b002] as BaseSpec[];

export const W2_CARDS: CardSpec[] = [
  w2c001, w2c002, w2c003, w2c004, w2c005, w2c006, w2c007, w2c008, w2c009, w2c010,
] as CardSpec[];

export const ALL_W12_CARDS: CardSpec[] = [...W1_CARDS, ...W2_CARDS];

import w3c001 from './cards/W3_001.json';
import w3c002 from './cards/W3_002.json';
import w3c003 from './cards/W3_003.json';

export const W3_CARDS: CardSpec[] = [w3c001, w3c002, w3c003] as CardSpec[];

import w4c001 from './cards/W4_001.json';
import w4c002 from './cards/W4_002.json';
import w4c003 from './cards/W4_003.json';
import w4c004 from './cards/W4_004.json';
import w4c005 from './cards/W4_005.json';

export const W4_CARDS: CardSpec[] = [w4c001, w4c002, w4c003, w4c004, w4c005] as CardSpec[];

import w5c001 from './cards/W5_001.json';
import w5c002 from './cards/W5_002.json';
import w5c003 from './cards/W5_003.json';
import w5c004 from './cards/W5_004.json';

export const W5_CARDS: CardSpec[] = [w5c001, w5c002, w5c003, w5c004] as CardSpec[];

import w6c001 from './cards/W6_001.json';
import w6c002 from './cards/W6_002.json';
import w6c003 from './cards/W6_003.json';
import w6c004 from './cards/W6_004.json';
import w6c005 from './cards/W6_005.json';
import w6c006 from './cards/W6_006.json';
import w6c007 from './cards/W6_007.json';
import w6c008 from './cards/W6_008.json';

export const W6_CARDS: CardSpec[] = [w6c001, w6c002, w6c003, w6c004, w6c005, w6c006, w6c007, w6c008] as CardSpec[];

import w7c001 from './cards/W7_001.json';
import w7c002 from './cards/W7_002.json';
import w7c003 from './cards/W7_003.json';
import w7c004 from './cards/W7_004.json';
export const W7_CARDS: CardSpec[] = [w7c001, w7c002, w7c003, w7c004] as CardSpec[];

import w8c001 from './cards/W8_001.json';
import w8c002 from './cards/W8_002.json';
import w8c003 from './cards/W8_003.json';
import w8c004 from './cards/W8_004.json';
import w8c005 from './cards/W8_005.json';
import w8c006 from './cards/W8_006.json';
import w8c007 from './cards/W8_007.json';
import w8c008 from './cards/W8_008.json';
import w8c009 from './cards/W8_009.json';
import w8c010 from './cards/W8_010.json';
import w8c011 from './cards/W8_011.json';
import w8c012 from './cards/W8_012.json';
export const W8_CARDS: CardSpec[] = [w8c001, w8c002, w8c003, w8c004, w8c005, w8c006, w8c007, w8c008, w8c009, w8c010, w8c011, w8c012] as CardSpec[];

export const ALL_CARDS: CardSpec[] = [...W1_CARDS, ...W2_CARDS, ...W3_CARDS, ...W4_CARDS, ...W5_CARDS, ...W6_CARDS, ...W7_CARDS, ...W8_CARDS];
