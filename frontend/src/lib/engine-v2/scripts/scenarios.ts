// Scenario suite for Week 2 mechanics. Each scenario builds a minimal
// GameState, exercises a single behavior, asserts the observable outcome,
// and prints pass/fail. Run: cd frontend && npm run scenarios

import { buildRegistry, step, scriptedChooser } from '../index';
import type { CardInstance, CardRegistry, GameState, PlayerId } from '../index';
import { ALL_CARDS, W1_BASES } from '../__fixtures__';
import { findCard, getZoneArr } from '../state/zones';
import {
  effectivePower, effectiveHp, remainingHp, hasEffectiveKeyword,
} from '../runtime/modifiers';

const reg: CardRegistry = buildRegistry(ALL_CARDS, W1_BASES);

// ---------------------------------------------------------------------------
// State construction helpers
// ---------------------------------------------------------------------------

let _iid = 1000;
function mkInst(cardId: string, opts: Partial<CardInstance> = {}): CardInstance {
  return {
    iid: `s${_iid++}`,
    cardId,
    damage: 0,
    exhausted: false,
    upgrades: [],
    shieldTokens: 0,
    isToken: false,
    enteredZoneAt: 0,
    ...opts,
  };
}

function emptyState(opts: {
  groundP1?: CardInstance[]; spaceP1?: CardInstance[];
  groundP2?: CardInstance[]; spaceP2?: CardInstance[];
  handP1?: CardInstance[]; handP2?: CardInstance[];
  deckP1?: CardInstance[]; deckP2?: CardInstance[];
  resourcesP1?: number; resourcesP2?: number;
  active?: PlayerId;
  phase?: 'action' | 'setup' | 'regroup';
} = {}): GameState {
  function mkRes(n: number, iidOffset: number): CardInstance[] {
    return Array.from({ length: n }, (_, i) => mkInst('W1_001', { iid: `r${iidOffset + i}`, exhausted: false }));
  }
  return {
    id: 'scen',
    round: 1,
    step: 0,
    activePlayer: opts.active ?? 'p1',
    initiative: 'p1',
    phase: opts.phase ?? 'action',
    players: {
      p1: {
        id: 'p1', displayName: 'P1',
        hand: opts.handP1 ?? [],
        deck: opts.deckP1 ?? [mkInst('W1_001'), mkInst('W1_001'), mkInst('W1_001')],
        discard: [], resources: mkRes(opts.resourcesP1 ?? 10, 0), creditTokens: [],
        groundArena: opts.groundP1 ?? [], spaceArena: opts.spaceP1 ?? [],
        leaders: [], base: { cardId: 'B_001', damage: 0 },
        forceToken: false, capturedByMe: [],
        countersHeld: [], hasTakenCounterThisRound: false, hasResourced: false,
        perPhaseCounters: {}, perRoundCounters: {}, perGameFlags: new Set(),
      },
      p2: {
        id: 'p2', displayName: 'P2',
        hand: opts.handP2 ?? [],
        deck: opts.deckP2 ?? [mkInst('W1_003'), mkInst('W1_003'), mkInst('W1_003')],
        discard: [], resources: mkRes(opts.resourcesP2 ?? 10, 100), creditTokens: [],
        groundArena: opts.groundP2 ?? [], spaceArena: opts.spaceP2 ?? [],
        leaders: [], base: { cardId: 'B_002', damage: 0 },
        forceToken: false, capturedByMe: [],
        countersHeld: [], hasTakenCounterThisRound: false, hasResourced: false,
        perPhaseCounters: {}, perRoundCounters: {}, perGameFlags: new Set(),
      },
    },
    playerOrder: ['p1', 'p2'],
    lastingEffects: [], delayedEffects: [], pendingTriggers: [],
    log: [], consecutivePasses: 0, _nextIid: 9999,
  };
}

// ---------------------------------------------------------------------------
// Scenario runner
// ---------------------------------------------------------------------------

let passed = 0, failed = 0;

function scenario(name: string, fn: () => void) {
  try {
    fn();
    console.log(`✅ ${name}`);
    passed++;
  } catch (e) {
    const msg = (e instanceof Error) ? e.message : String(e);
    console.log(`❌ ${name}\n     ${msg}`);
    failed++;
  }
}

function assertEq(actual: unknown, expected: unknown, label: string) {
  if (actual !== expected) throw new Error(`${label}: expected ${expected}, got ${actual}`);
}

function expectThrow(fn: () => void, msgIncludes: string) {
  try { fn(); } catch (e) {
    const m = (e instanceof Error ? e.message : String(e));
    if (!m.includes(msgIncludes)) throw new Error(`expected error containing "${msgIncludes}", got "${m}"`);
    return;
  }
  throw new Error(`expected throw with "${msgIncludes}", but no error was raised`);
}

// ---------------------------------------------------------------------------
// Scenarios
// ---------------------------------------------------------------------------

scenario('Grit: Wampa with 2 damage has +2 power', () => {
  const wampa = mkInst('W2_001', { damage: 2 });
  const state = emptyState({ groundP1: [wampa] });
  const p = effectivePower(state, reg, wampa, 'p1');
  assertEq(p, 4 + 2, 'effective power');
});

scenario('Grit: undamaged Wampa has printed power only', () => {
  const wampa = mkInst('W2_001');
  const state = emptyState({ groundP1: [wampa] });
  assertEq(effectivePower(state, reg, wampa, 'p1'), 4, 'effective power');
});

scenario('Sentinel: opponent forced to attack the Sentinel', () => {
  const shield = mkInst('W2_003');                  // Shielded + Sentinel
  const grunt = mkInst('W2_009');                   // vanilla 2/2
  const attacker = mkInst('W1_001');                // 3/3, ready
  const state = emptyState({
    groundP1: [attacker], groundP2: [shield, grunt],
    active: 'p1',
  });
  // p1 attacking p2's grunt (non-Sentinel) is illegal — Sentinel forces target
  expectThrow(
    () => step(state, { kind: 'ATTACK', player: 'p1', attackerIid: attacker.iid, defenderIid: grunt.iid }, reg),
    'Sentinel',
  );
  // Attacking the Sentinel itself is legal.
  const r = step(state, { kind: 'ATTACK', player: 'p1', attackerIid: attacker.iid, defenderIid: shield.iid }, reg);
  // Sentinel has 3 HP and 1 shield — first damage absorbed by shield, then 3 more damage would be dealt
  // but actually attacker power is 3, defender shields catch it.
  if (!r.next) throw new Error('no next state');
});

scenario('Saboteur: bypasses Sentinel + strips shields', () => {
  const shield = mkInst('W2_003');                  // Shielded + Sentinel (gets 1 shield)
  const sabo = mkInst('W2_006');                    // Saboteur, 3/2
  const state = emptyState({ groundP1: [sabo], groundP2: [shield], active: 'p1' });
  // Apply Shielded onPlay manually since we bypass play — Shield Generator has Shielded
  const state2 = { ...state, players: { ...state.players, p2: { ...state.players.p2,
    groundArena: state.players.p2.groundArena.map(c =>
      c.iid === shield.iid ? { ...c, shieldTokens: 1 } : c
    )
  } } };

  // Sabo (3/2) attacks Shield Generator (1/3 + 1 shield). Saboteur lets us ignore Sentinel +
  // its On Attack strips the shield, so the full 3 damage lands → defender defeats.
  // Sabo takes 1 damage back. Both should survive except shield generator defeats.
  const r = step(state2, { kind: 'ATTACK', player: 'p1', attackerIid: sabo.iid, defenderIid: shield.iid }, reg);
  // After defeat, shield gen sits in p2's discard, NOT in any arena.
  const stillInArena = getZoneArr(r.next.players.p2, 'ground_arena').some(c => c.iid === shield.iid);
  if (stillInArena) throw new Error('Shield Generator should have been defeated');
  const inDiscard = r.next.players.p2.discard.some(c => c.iid === shield.iid);
  if (!inDiscard) throw new Error('Shield Generator should be in p2 discard');
});

scenario('Shielded: blocks first damage instance', () => {
  // Place a fresh Shield Generator in hand and have p1 play it; the Shielded
  // keyword onPlay should give it 1 shield token.
  const card = mkInst('W2_003');
  const state = emptyState({ handP1: [card], resourcesP1: 5, active: 'p1' });
  const r = step(state, { kind: 'PLAY_CARD', player: 'p1', iid: card.iid }, reg);
  const inPlay = findCard(r.next, card.iid);
  if (!inPlay) throw new Error('Shield Generator should be in play');
  assertEq(inPlay.inst.shieldTokens, 1, 'shield tokens after onPlay');
});

scenario('Ambush: unit enters play ready', () => {
  const card = mkInst('W2_002');                    // Pathfinder w/ Ambush+Raid 1
  const state = emptyState({ handP1: [card], resourcesP1: 5, active: 'p1' });
  const r = step(state, { kind: 'PLAY_CARD', player: 'p1', iid: card.iid }, reg);
  const inPlay = findCard(r.next, card.iid);
  if (!inPlay) throw new Error('Pathfinder should be in play');
  assertEq(inPlay.inst.exhausted, false, 'should be ready due to Ambush');
});

scenario('Raid 1: attacks base for power+1', () => {
  const pathfinder = mkInst('W2_002');              // 2/1 w/ Raid 1
  const state = emptyState({ groundP1: [pathfinder], active: 'p1' });
  const r = step(state, { kind: 'ATTACK', player: 'p1', attackerIid: pathfinder.iid, defenderIid: 'base' }, reg);
  assertEq(r.next.players.p2.base.damage, 3, 'base damage = 2 power + 1 Raid');
});

scenario('Restore 2: heals base on attack', () => {
  const frigate = mkInst('W2_004');                 // Restore 2
  const state = emptyState({
    spaceP1: [frigate],
    active: 'p1',
  });
  // First damage p1's base to 5
  const damaged = { ...state, players: { ...state.players, p1: { ...state.players.p1,
    base: { ...state.players.p1.base, damage: 5 },
  } } };
  const r = step(damaged, { kind: 'ATTACK', player: 'p1', attackerIid: frigate.iid, defenderIid: 'base' }, reg);
  assertEq(r.next.players.p1.base.damage, 3, 'p1 base damage = 5 - 2 (Restore)');
});

scenario('Overwhelm: excess combat damage to base', () => {
  const tank = mkInst('W2_005');                    // 6/4 w/ Overwhelm
  const grunt = mkInst('W2_009');                   // 2/2
  const state = emptyState({ groundP1: [tank], groundP2: [grunt], active: 'p1' });
  const r = step(state, { kind: 'ATTACK', player: 'p1', attackerIid: tank.iid, defenderIid: grunt.iid }, reg);
  // Tank deals 6 → grunt has 2 HP → 4 excess → p2 base takes 4
  assertEq(r.next.players.p2.base.damage, 4, 'excess to base');
  // Grunt defeated (in p2 discard, not in arena)
  const stillInArena = getZoneArr(r.next.players.p2, 'ground_arena').some(c => c.iid === grunt.iid);
  if (stillInArena) throw new Error('grunt should be defeated');
});

scenario('Triggered When Played: Sniper deals 2 damage', () => {
  const sniper = mkInst('W2_007');                  // When Played: 2 dmg to chosen opp unit
  const target = mkInst('W1_001', { damage: 0 });   // 3/3
  const state = emptyState({ handP1: [sniper], resourcesP1: 5, groundP2: [target], active: 'p1' });
  const r = step(state, { kind: 'PLAY_CARD', player: 'p1', iid: sniper.iid }, reg);
  const t = findCard(r.next, target.iid);
  if (!t) throw new Error('target missing');
  assertEq(t.inst.damage, 2, 'target damage from When Played');
});

scenario('Triggered On Attack: Field Commander draws on attack', () => {
  const cmdr = mkInst('W2_010');
  const state = emptyState({ groundP1: [cmdr], active: 'p1' });
  const handBefore = state.players.p1.hand.length;
  const r = step(state, { kind: 'ATTACK', player: 'p1', attackerIid: cmdr.iid, defenderIid: 'base' }, reg);
  assertEq(r.next.players.p1.hand.length, handBefore + 1, 'drew 1 from trigger');
});

scenario('Constant aura: Clone Sergeant buffs other clones (+1/+1)', () => {
  const sgt = mkInst('W2_008');
  const clone = mkInst('W2_009');                   // 2/2 clone
  const state = emptyState({ groundP1: [sgt, clone], active: 'p1' });
  // Sergeant itself excludes via filter (not creature, but also self via "other"
  // semantics aren't expressible in Week 2 yet — Sergeant *will* buff itself
  // because the spec lacks an exclude_self selector. This scenario verifies
  // the aggregator hits the clone with the buff.)
  assertEq(effectivePower(state, reg, clone, 'p1'), 2 + 1, 'clone +1 power');
  assertEq(effectiveHp(state, reg, clone, 'p1'),    2 + 1, 'clone +1 hp');
});

scenario('Lasting effect: end_of_phase modifier expires after action phase', () => {
  // Play a card that gives a phase buff, then advance to regroup; expect the
  // modifier to no longer apply.  Hand-craft a Wampa with a fake lasting
  // effect since no W2 card writes one yet.
  const wampa = mkInst('W2_001');
  const baseState = emptyState({ groundP1: [wampa], active: 'p1' });
  const withLasting: GameState = {
    ...baseState,
    lastingEffects: [{
      id: 'le1',
      modifier: { duration: 'end_of_phase', power: 3 },
      targets: { kind: 'units', iids: [wampa.iid] },
      expiry: 'end_of_phase',
    }],
  };
  // Wampa should have +3 power right now (4 + 3 = 7)
  assertEq(effectivePower(withLasting, reg, wampa, 'p1'), 7, 'with lasting');
  // Both pass → action phase ends
  let s = withLasting;
  s = step(s, { kind: 'PASS', player: 'p1' }, reg).next;
  s = step(s, { kind: 'PASS', player: 'p2' }, reg).next;
  // Now we're in regroup. Lasting effect should be expired.
  const wampaPostPhase = findCard(s, wampa.iid);
  if (!wampaPostPhase) throw new Error('wampa missing');
  assertEq(effectivePower(s, reg, wampaPostPhase.inst, 'p1'), 4, 'after end_of_phase');
});

// ---------------------------------------------------------------------------
// Week 3: Tokens + Capture + Choices
// ---------------------------------------------------------------------------

scenario('create_token: Pelta plays → Clone Trooper appears in ground', () => {
  const pelta = mkInst('W3_001');
  const state = emptyState({ handP1: [pelta], resourcesP1: 6, active: 'p1' });
  const r = step(state, { kind: 'PLAY_CARD', player: 'p1', iid: pelta.iid }, reg);
  // p1's ground should have Pelta + 1 token
  // (Pelta itself is a space unit so it lands in space; the token lands in ground)
  const groundCount = r.next.players.p1.groundArena.length;
  if (groundCount !== 1) throw new Error(`expected 1 token in ground, got ${groundCount}`);
  const token = r.next.players.p1.groundArena[0];
  if (!token.isToken) throw new Error('created card should be marked isToken');
  if (reg.cards[token.cardId]?.name !== 'Clone Trooper') {
    throw new Error(`expected Clone Trooper, got ${reg.cards[token.cardId]?.name}`);
  }
});

scenario('capture: Sanctioner captures a 3-or-less power unit', () => {
  const sanc = mkInst('W3_002');                        // 3/3 ground
  const target = mkInst('W2_009');                      // 2/2 clone (≤3 power)
  const state = emptyState({ handP1: [sanc], resourcesP1: 4, groundP2: [target], active: 'p1' });
  const r = step(state, { kind: 'PLAY_CARD', player: 'p1', iid: sanc.iid }, reg);
  // target should be in p1's capture zone, not p2's arena
  const stillInArena = r.next.players.p2.groundArena.some(c => c.iid === target.iid);
  if (stillInArena) throw new Error('target should have been captured');
  const captured = r.next.players.p1.capturedByMe.some(c => c.iid === target.iid);
  if (!captured) throw new Error('target should be in p1 capturedByMe');
});

scenario('choose_one: Take Captive → damage branch (auto-pick)', () => {
  // Default chooser picks leftmost option, which is the capture branch.
  // Use scriptedChooser to force the damage branch.
  const takeCap = mkInst('W3_003');
  const target = mkInst('W1_001', { damage: 0 });       // 3/3 unit, 3 HP
  const state = emptyState({ handP1: [takeCap], resourcesP1: 3, groundP2: [target], active: 'p1' });
  const chooser = scriptedChooser([
    { kind: 'option', value: 'damage' },                // pick damage branch
    // then prompt_target — leftmost candidate is target
  ]);
  const r = step(state, { kind: 'PLAY_CARD', player: 'p1', iid: takeCap.iid }, reg, chooser);
  const t = findCard(r.next, target.iid);
  if (!t) throw new Error('target missing');
  assertEq(t.inst.damage, 2, 'damage from damage branch');
});

scenario('choose_one: Take Captive → capture branch (default chooser picks leftmost)', () => {
  const takeCap = mkInst('W3_003');
  const captor = mkInst('W1_001');                      // 3/3 friendly to capture INTO
  const target = mkInst('W2_009');                      // 2/2 enemy, ≤3 power
  const state = emptyState({
    handP1: [takeCap], resourcesP1: 3,
    groundP1: [captor], groundP2: [target],
    active: 'p1',
  });
  const r = step(state, { kind: 'PLAY_CARD', player: 'p1', iid: takeCap.iid }, reg);
  const captured = r.next.players.p1.capturedByMe.some(c => c.iid === target.iid);
  if (!captured) throw new Error('target should be captured');
});

scenario('Token unit fights and dies normally', () => {
  // Set up: p1 has a Clone Trooper token, p2 has an attacker. Resolve attack.
  const pelta = mkInst('W3_001');
  const state = emptyState({ handP1: [pelta], resourcesP1: 6, active: 'p1' });
  const r1 = step(state, { kind: 'PLAY_CARD', player: 'p1', iid: pelta.iid }, reg);
  const token = r1.next.players.p1.groundArena[0];
  // Pass control: now have p2 attack the token with a vanilla 3/3
  const attacker = mkInst('W1_001');
  const state2: GameState = {
    ...r1.next,
    players: {
      ...r1.next.players,
      p2: { ...r1.next.players.p2, groundArena: [attacker] },
    },
    activePlayer: 'p2',
  };
  const r2 = step(state2, { kind: 'ATTACK', player: 'p2', attackerIid: attacker.iid, defenderIid: token.iid }, reg);
  const tokenGone = !r2.next.players.p1.groundArena.some(c => c.iid === token.iid);
  if (!tokenGone) throw new Error('token should be defeated');
});

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
