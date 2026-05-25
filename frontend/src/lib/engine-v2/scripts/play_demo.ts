// Headless 2-player demo. Exercises every Week 1 code path from setup
// through game-end. Deterministic — uses a seeded RNG so the transcript is
// reproducible.
//
// Run: cd frontend && npm run play-demo

import { buildRegistry, initGame, step } from '../index';
import type { CardInstance, GameState, PlayerAction, PlayerId, StepResult } from '../index';
import { W1_BASES, W1_CARDS } from '../__fixtures__';
import { findCard } from '../state/zones';
import { effectivePower } from '../runtime/modifiers';

function seededRng(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return (s & 0xfffffff) / 0xfffffff;
  };
}

const reg = buildRegistry(W1_CARDS, W1_BASES);

// Two decks of 20 cards each. Repetition is fine for Week 1 vanilla play.
const deckA = [
  'W1_001', 'W1_002', 'W1_005', 'W1_006', 'W1_007', 'W1_009', 'W1_010',
  'W1_001', 'W1_002', 'W1_005', 'W1_006', 'W1_007',
  'W1_001', 'W1_005', 'W1_006', 'W1_007', 'W1_009',
  'W1_001', 'W1_005', 'W1_006',
];
const deckB = [
  'W1_003', 'W1_004', 'W1_008', 'W1_006', 'W1_009', 'W1_010', 'W1_001',
  'W1_003', 'W1_004', 'W1_008', 'W1_006',
  'W1_003', 'W1_004', 'W1_008', 'W1_006', 'W1_009',
  'W1_003', 'W1_004', 'W1_008', 'W1_006',
];

let state = initGame({
  gameId: 'demo-001',
  players: [
    { playerId: 'p1', displayName: 'Alice', baseId: 'B_001', deckCardIds: deckA },
    { playerId: 'p2', displayName: 'Bob',   baseId: 'B_002', deckCardIds: deckB },
  ],
  rng: seededRng(42),
}, reg);

const transcript: string[] = [];
const log = (m: string) => { transcript.push(m); };

function apply(action: PlayerAction): StepResult {
  const r = step(state, action, reg);
  state = r.next;
  for (const e of r.events) {
    if (e.kind === 'GAME_ENDED') log(`🏁 GAME OVER — winner: ${e.winner}`);
    if (e.kind === 'DEFEATED') log(`💀 ${e.iid} defeated (${e.lastKnown.cardId})`);
    if (e.kind === 'CARD_PLAYED') log(`▶  ${e.controller} plays ${reg.cards[e.cardId].name} (${e.iid})`);
    if (e.kind === 'COUNTER_TAKEN') log(`🎯 ${e.player} takes ${e.counter}`);
  }
  return r;
}

function dumpState(label: string) {
  log(`\n— ${label} —`);
  log(`Round ${state.round} | phase ${state.phase}${state.regroupStep ? '/' + state.regroupStep : ''} | active ${state.activePlayer} | initiative ${state.initiative}`);
  for (const pid of state.playerOrder) {
    const p = state.players[pid];
    const baseSpec = reg.bases[p.base.cardId];
    const baseHp = (baseSpec?.hp ?? 30) - p.base.damage;
    log(`  ${pid} (${p.displayName}): base ${baseHp}HP | hand ${p.hand.length} | deck ${p.deck.length} | resources ${p.resources.length} (${p.resources.filter(r => !r.exhausted).length} ready) | ground [${p.groundArena.map(c => fmtUnit(c, pid)).join(', ') || '-'}] | space [${p.spaceArena.map(c => fmtUnit(c, pid)).join(', ') || '-'}]`);
  }
}

function fmtUnit(c: CardInstance, pid: PlayerId): string {
  const spec = reg.cards[c.cardId];
  if (!spec || spec.type !== 'unit') return c.iid;
  const pow = effectivePower(state, reg, c, pid);
  const remHp = spec.hp - c.damage;
  return `${spec.name}(${c.iid} ${pow}/${remHp}${c.exhausted ? ' ⊘' : ''})`;
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

apply({ kind: 'START_GAME' });
dumpState('After START_GAME');

// Each player resources 2 cards (just the first 2 in hand).
for (let i = 0; i < 2; i++) {
  const active = state.activePlayer;
  const card = state.players[active].hand[0];
  apply({ kind: 'RESOURCE_CARD', player: active, iid: card.iid });
}
for (let i = 0; i < 2; i++) {
  const active = state.activePlayer;
  const card = state.players[active].hand[0];
  apply({ kind: 'RESOURCE_CARD', player: active, iid: card.iid });
}

dumpState('After setup');

// ---------------------------------------------------------------------------
// Helper: greedy "play the cheapest unit you can afford" turn
// ---------------------------------------------------------------------------

function tryPlayCheapest(pid: PlayerId): boolean {
  const p = state.players[pid];
  const ready = p.resources.filter(r => !r.exhausted).length;
  const playable = p.hand
    .map(c => ({ c, spec: reg.cards[c.cardId] }))
    .filter(x => x.spec && x.spec.type === 'unit' && (x.spec.cost ?? 0) <= ready)
    .sort((a, b) => ((a.spec as { cost?: number }).cost ?? 0) - ((b.spec as { cost?: number }).cost ?? 0));
  if (playable.length === 0) return false;
  apply({ kind: 'PLAY_CARD', player: pid, iid: playable[0].c.iid });
  return true;
}

function tryAttackBase(pid: PlayerId): boolean {
  const p = state.players[pid];
  const ready = [...p.groundArena, ...p.spaceArena].filter(u => !u.exhausted);
  if (ready.length === 0) return false;
  // Attack base with the strongest ready unit.
  ready.sort((a, b) => effectivePower(state, reg, b, pid) - effectivePower(state, reg, a, pid));
  apply({ kind: 'ATTACK', player: pid, attackerIid: ready[0].iid, defenderIid: 'base' });
  return true;
}

// ---------------------------------------------------------------------------
// Play rounds until someone wins (cap at 20 rounds for safety)
// ---------------------------------------------------------------------------

for (let safetyRounds = 0; safetyRounds < 20 && !state.winner; safetyRounds++) {
  // Action phase — each player tries to play, then attack base, then pass.
  for (let actionSafety = 0; actionSafety < 30 && state.phase === 'action' && !state.winner; actionSafety++) {
    const pid = state.activePlayer;
    const acted = tryPlayCheapest(pid) || tryAttackBase(pid);
    if (!acted) apply({ kind: 'PASS', player: pid });
  }
  if (state.winner) break;
  // Regroup — accept the engine's draw, then both players decline to resource
  // (keeps the demo deterministic).
  while (state.phase === 'regroup' && !state.winner) {
    apply({ kind: 'DECLINE_RESOURCE', player: state.activePlayer });
  }
  dumpState(`End of round ${state.round - 1}`);
}

dumpState('FINAL');

console.log(transcript.join('\n'));
console.log('\n--- Action log ---');
for (const entry of state.log) {
  const tag = entry.kind === 'critical' ? '★' : ' ';
  console.log(`${tag} r${entry.round}${entry.player ? ' ' + entry.player : ''}: ${entry.message}`);
}

if (!state.winner) {
  console.error('\n❌ Demo did not produce a winner within the safety cap.');
  process.exit(1);
}
console.log(`\n✅ Demo completed. Winner: ${state.winner}`);
