// Interactive CLI driver. Lets a human play a 2-player game against
// themselves (controlling both seats) or against a simple "always-greedy" AI.
//
// Run: cd frontend && npm run play-cli
//      cd frontend && npm run play-cli -- --ai p2   (p1 is human, p2 is AI)
//      cd frontend && npm run play-cli -- --ai both (both AI; you watch)

import * as readline from 'node:readline';
import type { Chooser, ChoicePrompt, ChoiceResult } from '../index';
import {
  buildRegistry, describeAction, getLegalActions, initGame, step,
} from '../index';
import type { CardInstance, GameState, PlayerId } from '../index';
import { ALL_W12_CARDS, W1_BASES, W3_CARDS } from '../__fixtures__';
import { effectivePower, effectiveHp } from '../runtime/modifiers';

const reg = buildRegistry([...ALL_W12_CARDS, ...W3_CARDS], W1_BASES);

// ---------------------------------------------------------------------------
// CLI argument parsing
// ---------------------------------------------------------------------------

const argv = process.argv.slice(2);
function flag(name: string): string | undefined {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : undefined;
}
const aiOpt = flag('ai'); // 'p1' | 'p2' | 'both' | undefined
const aiPlayers: Set<PlayerId> = new Set(
  aiOpt === 'both' ? ['p1', 'p2']
  : aiOpt === 'p1' ? ['p1']
  : aiOpt === 'p2' ? ['p2']
  : []
);

// ---------------------------------------------------------------------------
// Readline helpers (synchronous prompts via question/promise + await loop)
// ---------------------------------------------------------------------------

const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });

function ask(q: string): Promise<string> {
  return new Promise(resolve => rl.question(q, ans => resolve(ans)));
}

// Synchronous version using a busy wait on a promise — we await at the top
// level of the script, so the engine's synchronous Chooser callback runs
// inside our event loop turn. To make Chooser truly synchronous, we resolve
// it via a closure that captures the most recent async user input. The
// engine never actually pauses; it asks Chooser, which has the answer pre-loaded
// from the async UI loop. Pattern: the outer loop reads input async, then calls
// step() with a chooser that knows the pre-resolved answer.
//
// For Week 3 simplicity, we implement: when the engine needs a choice DURING
// reducer execution, we use a stack-based pre-loaded answer queue. The outer
// driver loop pre-fetches likely answers before calling step(). For complex
// nested choice paths this is incomplete; we mark such cases and fall back to
// the defaultChooser (leftmost). Real async choice handling is Week 4.

let pendingAnswers: ChoiceResult[] = [];
const cliChooser: Chooser = (prompt: ChoicePrompt) => {
  if (pendingAnswers.length > 0) return pendingAnswers.shift()!;
  // No pre-loaded answer: fall back to leftmost / yes / first-N.
  // This handles the common case where choose_one and chosen-selector decisions
  // are made BEFORE the step() call (in the pre-fetch phase below).
  console.log(`  [auto-choice: ${prompt.kind} → leftmost/yes/first]`);
  if (prompt.kind === 'choose_one') return { kind: 'option', value: prompt.options[0]?.value ?? '' };
  if (prompt.kind === 'prompt_target') return { kind: 'targets', targets: prompt.candidates.slice(0, prompt.count) };
  return { kind: 'yes' };
};

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

function fmtUnit(state: GameState, c: CardInstance, pid: PlayerId): string {
  const spec = reg.cards[c.cardId];
  const name = spec?.name ?? c.cardId;
  const pw = effectivePower(state, reg, c, pid);
  const hpRem = effectiveHp(state, reg, c, pid) - c.damage;
  const shield = c.shieldTokens > 0 ? ` 🛡${c.shieldTokens}` : '';
  const exh = c.exhausted ? ' ⊘' : '';
  return `${name}<${c.iid}>(${pw}/${hpRem}${shield}${exh})`;
}

function render(state: GameState) {
  console.log('\n' + '═'.repeat(78));
  console.log(`Round ${state.round} | ${state.phase}${state.regroupStep ? '/' + state.regroupStep : ''} | active=${state.activePlayer} | initiative=${state.initiative}`);
  for (const pid of state.playerOrder) {
    const p = state.players[pid];
    const baseSpec = reg.bases[p.base.cardId];
    const baseHp = (baseSpec?.hp ?? 30) - p.base.damage;
    const aiTag = aiPlayers.has(pid) ? ' [AI]' : '';
    console.log(`\n${pid} (${p.displayName})${aiTag}:`);
    console.log(`  base: ${baseSpec?.name} ${baseHp}HP | hand: ${p.hand.length} | deck: ${p.deck.length} | discard: ${p.discard.length}`);
    console.log(`  resources: ${p.resources.length} (${p.resources.filter(r => !r.exhausted).length} ready)`);
    console.log(`  ground: ${p.groundArena.map(c => fmtUnit(state, c, pid)).join(', ') || '-'}`);
    console.log(`  space:  ${p.spaceArena.map(c => fmtUnit(state, c, pid)).join(', ') || '-'}`);
    if (p.capturedByMe.length > 0) {
      console.log(`  captured: ${p.capturedByMe.map(c => reg.cards[c.cardId]?.name ?? c.iid).join(', ')}`);
    }
  }
  // Show only the current player's hand contents (CLI is single-screen; both
  // players "see" their own).
  const me = state.players[state.activePlayer];
  console.log(`\n${state.activePlayer} hand: ${me.hand.map(c => {
    const s = reg.cards[c.cardId];
    const cost = s && (s.type === 'unit' || s.type === 'event' || s.type === 'upgrade') ? (s.cost ?? 0) : 0;
    return `${s?.name ?? c.cardId}<${c.iid}>(${cost})`;
  }).join(', ') || '(empty)'}`);
}

// ---------------------------------------------------------------------------
// Greedy AI
// ---------------------------------------------------------------------------

function aiPick(state: GameState, pid: PlayerId) {
  const { actions } = getLegalActions(state, reg, pid);
  if (actions.length === 0) return undefined;

  // During setup / regroup-resource, prefer RESOURCE_CARD over DECLINE so the
  // AI actually places resources (otherwise it stalls on its preference for
  // "the last action in the list").
  const resourceCards = actions.filter(a => a.kind === 'RESOURCE_CARD');
  if (resourceCards.length > 0 && (state.phase === 'setup' || state.regroupStep === 'resource')) {
    return resourceCards[0];
  }

  // Preference: PLAY_CARD (cheapest first) > ATTACK base > ATTACK enemy > TAKE_COUNTER > PASS
  const plays = actions.filter(a => a.kind === 'PLAY_CARD');
  if (plays.length > 0) {
    plays.sort((a, b) => {
      if (a.kind !== 'PLAY_CARD' || b.kind !== 'PLAY_CARD') return 0;
      const fa = state.players[pid].hand.find(c => c.iid === a.iid);
      const fb = state.players[pid].hand.find(c => c.iid === b.iid);
      const ca = fa && reg.cards[fa.cardId];
      const cb = fb && reg.cards[fb.cardId];
      const costA = ca && (ca.type === 'unit' || ca.type === 'event') ? (ca.cost ?? 0) : 99;
      const costB = cb && (cb.type === 'unit' || cb.type === 'event') ? (cb.cost ?? 0) : 99;
      return costB - costA; // play highest-cost we can afford
    });
    return plays[0];
  }
  const baseHits = actions.filter(a => a.kind === 'ATTACK' && a.defenderIid === 'base');
  if (baseHits.length > 0) return baseHits[0];
  const unitHits = actions.filter(a => a.kind === 'ATTACK');
  if (unitHits.length > 0) return unitHits[0];
  return actions[actions.length - 1]; // PASS as last resort
}

// ---------------------------------------------------------------------------
// Human turn
// ---------------------------------------------------------------------------

async function humanPick(state: GameState, pid: PlayerId) {
  const { actions, reason } = getLegalActions(state, reg, pid);
  if (actions.length === 0) {
    if (reason) console.log(`(${reason})`);
    return undefined;
  }
  console.log('');
  actions.forEach((a, i) => console.log(`  [${i}] ${describeAction(state, reg, a)}`));
  while (true) {
    const ans = (await ask(`> ${pid} action: `)).trim();
    if (ans === 'q' || ans === 'quit') { rl.close(); process.exit(0); }
    const i = parseInt(ans, 10);
    if (!Number.isNaN(i) && i >= 0 && i < actions.length) return actions[i];
    console.log('Invalid — type a number or "q" to quit');
  }
}

// ---------------------------------------------------------------------------
// Main loop
// ---------------------------------------------------------------------------

async function main() {
  // Quick decks: 30 cards each, biased toward Week 2 keyword variety.
  const deckP1 = [
    'W2_001','W2_002','W2_003','W2_004','W2_005','W2_007','W2_008','W2_010',
    'W1_001','W1_002','W1_005','W1_006','W1_007','W1_009','W1_010',
    'W3_001','W3_002','W3_003',
    'W1_001','W1_005','W1_006',
    'W2_001','W2_003','W2_007','W2_008',
    'W1_002','W1_007','W1_009','W1_010','W1_001',
  ];
  const deckP2 = [
    'W2_006','W2_009','W1_003','W1_004','W1_008','W2_005',
    'W1_003','W1_004','W1_008','W1_006','W1_009','W1_010',
    'W3_001','W3_002','W3_003',
    'W2_006','W2_009','W1_003','W1_004','W1_008',
    'W1_003','W1_004','W1_008','W1_006',
    'W1_009','W1_010','W2_006','W2_009','W1_003','W1_004',
  ];

  let state = initGame({
    gameId: 'cli-001',
    players: [
      { playerId: 'p1', displayName: 'Alice', baseId: 'B_001', deckCardIds: deckP1 },
      { playerId: 'p2', displayName: 'Bob',   baseId: 'B_002', deckCardIds: deckP2 },
    ],
  }, reg);

  let r = step(state, { kind: 'START_GAME' }, reg, cliChooser);
  state = r.next;

  console.log(`\n🎲 Twin Suns engine-v2 — interactive CLI`);
  console.log(`AI: ${aiOpt ?? 'none (both human)'}`);
  console.log(`Type the bracketed number to act; "q" to quit.`);

  let safety = 1000;
  while (!state.winner && safety-- > 0) {
    render(state);
    pendingAnswers = []; // reset before each step

    const pid = state.activePlayer;
    let action;
    if (aiPlayers.has(pid)) {
      action = aiPick(state, pid);
      if (action) console.log(`\n${pid} [AI]: ${describeAction(state, reg, action)}`);
    } else {
      action = await humanPick(state, pid);
    }
    if (!action) {
      // No legal actions — usually means we're between phases waiting on engine
      // bookkeeping. Try a settle step.
      console.log(`(no action — advancing)`);
      break;
    }

    try {
      r = step(state, action, reg, cliChooser);
    } catch (e) {
      console.log(`❌ ${e instanceof Error ? e.message : e}`);
      continue;
    }
    state = r.next;

    // Surface meaningful events
    for (const ev of r.events) {
      if (ev.kind === 'DEFEATED') {
        const spec = reg.cards[ev.lastKnown.cardId];
        console.log(`  💀 ${spec?.name ?? ev.iid} defeated`);
      }
      if (ev.kind === 'TOKEN_CREATED') {
        console.log(`  ✨ token created: ${reg.cards[ev.tokenId]?.name ?? ev.tokenId}`);
      }
      if (ev.kind === 'CAPTURED') {
        console.log(`  🔒 captured ${ev.capturedIid}`);
      }
      if (ev.kind === 'GAME_ENDED') {
        console.log(`\n🏁 GAME OVER — winner: ${ev.winner}`);
      }
    }
  }

  rl.close();
  console.log(`\nFinal winner: ${state.winner}`);
}

main().catch(err => { console.error(err); rl.close(); process.exit(1); });
