// Random-game fuzzer — the "survives cases I didn't think of" net.
//
// Plays many full games where BOTH seats pick a uniformly-random legal action
// each step and a random chooser answers every prompt. Asserts the engine:
//   • never throws,
//   • always terminates with a winner (no soft-hang / infinite loop),
//   • stays within a sane step budget,
//   • never lands in an illegal shape (active player has zero legal actions
//     mid-action-phase without the phase advancing).
//
// Determinism: every game is driven by a seeded PRNG, so a failure prints the
// exact seed to reproduce. Run:
//   cd frontend && npm run fuzz                  (default 200 games)
//   cd frontend && npm run fuzz -- 1000          (1000 games)
//   cd frontend && npm run fuzz -- 50 12345      (50 games from base seed 12345)

import { buildRegistry, initGame, step, getLegalActions } from '../index';
import type { CardRegistry, GameState, PlayerId, PlayerAction, Chooser, ChoiceResult } from '../index';
import { ALL_CARDS, W1_BASES } from '../__fixtures__';
import { mulberry32 } from '../util/rng';

const reg: CardRegistry = buildRegistry(ALL_CARDS, W1_BASES);

// A broad, varied deck pool so the fuzzer exercises many primitives. We just
// need legal card ids; the deckbuilder legality (aspects, etc.) isn't enforced
// by the engine, so any unit/event/upgrade ids work.
const CARD_POOL = ALL_CARDS
  .filter(c => c.type === 'unit' || c.type === 'event' || c.type === 'upgrade')
  .map(c => c.id);
const LEADER_POOL = ALL_CARDS.filter(c => c.type === 'leader').map(c => c.id);

function buildDeck(rand: () => number, n: number): string[] {
  const out: string[] = [];
  for (let i = 0; i < n; i++) out.push(CARD_POOL[Math.floor(rand() * CARD_POOL.length)]);
  return out;
}

function randomChooser(rand: () => number): Chooser {
  return (prompt): ChoiceResult => {
    switch (prompt.kind) {
      case 'choose_one': {
        if (prompt.options.length === 0) return { kind: 'pass' };
        const o = prompt.options[Math.floor(rand() * prompt.options.length)];
        return { kind: 'option', value: o.value };
      }
      case 'prompt_target': {
        // Pick a random subset of size between minCount and count.
        const lo = prompt.minCount;
        const hi = Math.min(prompt.count, prompt.candidates.length);
        const k = lo + Math.floor(rand() * (hi - lo + 1));
        const shuffled = [...prompt.candidates].sort(() => rand() - 0.5);
        const targets = shuffled.slice(0, k);
        if (targets.length === 0 && prompt.canPass) return { kind: 'pass' };
        return { kind: 'targets', targets };
      }
      case 'optional':
        return rand() < 0.5 ? { kind: 'yes' } : { kind: 'no' };
    }
  };
}

function playOneGame(seed: number): { ok: boolean; rounds: number; steps: number; error?: string; phase?: string } {
  const rand = mulberry32(seed);
  const chooser = randomChooser(rand);

  const p1Leaders = LEADER_POOL.length ? [LEADER_POOL[Math.floor(rand() * LEADER_POOL.length)]] : [];
  const p2Leaders = LEADER_POOL.length ? [LEADER_POOL[Math.floor(rand() * LEADER_POOL.length)]] : [];

  let state: GameState;
  try {
    state = initGame({
      gameId: `fuzz-${seed}`,
      players: [
        { playerId: 'p1', displayName: 'P1', baseId: 'B_001', deckCardIds: buildDeck(rand, 30), leaderIds: p1Leaders },
        { playerId: 'p2', displayName: 'P2', baseId: 'B_002', deckCardIds: buildDeck(rand, 30), leaderIds: p2Leaders },
      ],
    }, reg);
    state = step(state, { kind: 'START_GAME' }, reg, chooser).next;
  } catch (e) {
    return { ok: false, rounds: 0, steps: 0, error: `init/start: ${e instanceof Error ? e.message : String(e)}`, phase: 'init' };
  }

  const STEP_BUDGET = 20000;
  let steps = 0;
  while (!state.winner) {
    if (steps++ > STEP_BUDGET) {
      return { ok: false, rounds: state.round, steps, error: `exceeded step budget (round ${state.round}, phase ${state.phase}) — likely a soft-hang`, phase: state.phase };
    }
    const pid: PlayerId = state.activePlayer;
    const { actions, reason } = getLegalActions(state, reg, pid);
    if (actions.length === 0) {
      // No legal actions: acceptable only if the engine auto-advances on the next
      // step (e.g. a seat that took a counter). Detect a true stall: if a step
      // with a forced PASS doesn't change the step counter / phase, bail.
      // In practice getLegalActions always returns PASS in the action phase, so
      // an empty list mid-action-phase is itself a bug.
      if (state.phase === 'action') {
        return { ok: false, rounds: state.round, steps, error: `no legal actions in action phase for ${pid} (${reason ?? 'no reason'})`, phase: state.phase };
      }
      // Setup/regroup: try a PASS-equivalent by advancing with the only sensible
      // action. If none exists the engine should have auto-advanced; treat as stall.
      return { ok: false, rounds: state.round, steps, error: `no legal actions in ${state.phase} for ${pid} (${reason ?? 'no reason'})`, phase: state.phase };
    }
    const action: PlayerAction = actions[Math.floor(rand() * actions.length)];
    try {
      state = step(state, action, reg, chooser).next;
    } catch (e) {
      return { ok: false, rounds: state.round, steps, error: `step threw on ${action.kind}: ${e instanceof Error ? e.message : String(e)}`, phase: state.phase };
    }
  }
  return { ok: true, rounds: state.round, steps };
}

// ---------------------------------------------------------------------------

const games = parseInt(process.argv[2] ?? '200', 10);
const baseSeed = parseInt(process.argv[3] ?? '1', 10);

console.log(`🎲 Fuzzing ${games} random games (base seed ${baseSeed}, ${CARD_POOL.length} cards / ${LEADER_POOL.length} leaders in pool)…`);

let passed = 0;
const failures: Array<{ seed: number; error: string }> = [];
let totalRounds = 0, totalSteps = 0, maxRounds = 0, maxSteps = 0;

for (let i = 0; i < games; i++) {
  const seed = baseSeed + i;
  const r = playOneGame(seed);
  if (r.ok) {
    passed++;
    totalRounds += r.rounds; totalSteps += r.steps;
    maxRounds = Math.max(maxRounds, r.rounds); maxSteps = Math.max(maxSteps, r.steps);
  } else {
    failures.push({ seed, error: r.error ?? 'unknown' });
    if (failures.length <= 10) console.log(`❌ seed ${seed}: ${r.error}`);
  }
}

console.log(`\n${passed}/${games} games completed cleanly.`);
if (passed > 0) {
  console.log(`   avg ${(totalRounds / passed).toFixed(1)} rounds / ${(totalSteps / passed).toFixed(0)} steps; max ${maxRounds} rounds / ${maxSteps} steps.`);
}
if (failures.length > 0) {
  console.log(`\n${failures.length} FAILURES. Reproduce a single game by base seed, e.g.: npm run fuzz -- 1 ${failures[0].seed}`);
  process.exit(1);
}
console.log('✅ no throws, no hangs, all games terminated with a winner.');
