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
import w8c013 from './cards/W8_013.json';
import w8c014 from './cards/W8_014.json';
import w8c015 from './cards/W8_015.json';
import w8c016 from './cards/W8_016.json';
import w8c017 from './cards/W8_017.json';
import w8c018 from './cards/W8_018.json';
import w8c019 from './cards/W8_019.json';
import w8c020 from './cards/W8_020.json';
import w8c021 from './cards/W8_021.json';
import w8c022 from './cards/W8_022.json';
import w8c023 from './cards/W8_023.json';
import w8c024 from './cards/W8_024.json';
import w8c025 from './cards/W8_025.json';
import w8c026 from './cards/W8_026.json';
import w8c027 from './cards/W8_027.json';
import w8c028 from './cards/W8_028.json';
import w8c029 from './cards/W8_029.json';
import w8c030 from './cards/W8_030.json';
import w8c031 from './cards/W8_031.json';
import w8c032 from './cards/W8_032.json';
import w8c033 from './cards/W8_033.json';
import w8c034 from './cards/W8_034.json';
import w8c035 from './cards/W8_035.json';
import w8c036 from './cards/W8_036.json';
import w8c037 from './cards/W8_037.json';
import w8c038 from './cards/W8_038.json';
import w8c039 from './cards/W8_039.json';
import w8c040 from './cards/W8_040.json';
import w8c041 from './cards/W8_041.json';
import w8c042 from './cards/W8_042.json';
import w8c043 from './cards/W8_043.json';
import w8c044 from './cards/W8_044.json';
import w8c045 from './cards/W8_045.json';
import w8c046 from './cards/W8_046.json';
import w8c047 from './cards/W8_047.json';
import w8c048 from './cards/W8_048.json';
import w8c049 from './cards/W8_049.json';
import w8c050 from './cards/W8_050.json';
import w8c051 from './cards/W8_051.json';
import w8c052 from './cards/W8_052.json';
import w8c053 from './cards/W8_053.json';
import w8c054 from './cards/W8_054.json';
import w8c055 from './cards/W8_055.json';
import w8c056 from './cards/W8_056.json';
import w8c057 from './cards/W8_057.json';
import w8c058 from './cards/W8_058.json';
import w8c059 from './cards/W8_059.json';
import w8c060 from './cards/W8_060.json';
import w8c061 from './cards/W8_061.json';
import w8c062 from './cards/W8_062.json';
import w8c063 from './cards/W8_063.json';
export const W8_CARDS: CardSpec[] = [w8c001, w8c002, w8c003, w8c004, w8c005, w8c006, w8c007, w8c008, w8c009, w8c010, w8c011, w8c012, w8c013, w8c014, w8c015, w8c016, w8c017, w8c018, w8c019, w8c020, w8c021, w8c022, w8c023, w8c024, w8c025, w8c026, w8c027, w8c028, w8c029, w8c030, w8c031, w8c032, w8c033, w8c034, w8c035, w8c036, w8c037, w8c038, w8c039, w8c040, w8c041, w8c042, w8c043, w8c044, w8c045, w8c046, w8c047, w8c048, w8c049, w8c050, w8c051, w8c052, w8c053, w8c054, w8c055, w8c056, w8c057, w8c058, w8c059, w8c060, w8c061, w8c062, w8c063] as CardSpec[];

export const ALL_CARDS: CardSpec[] = [...W1_CARDS, ...W2_CARDS, ...W3_CARDS, ...W4_CARDS, ...W5_CARDS, ...W6_CARDS, ...W7_CARDS, ...W8_CARDS];
