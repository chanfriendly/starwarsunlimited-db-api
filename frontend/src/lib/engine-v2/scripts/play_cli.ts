// Interactive CLI driver. Lets a human play a 2-player game against
// themselves (controlling both seats) or against a simple "always-greedy" AI.
//
// Run: cd frontend && npm run play-cli
//      cd frontend && npm run play-cli -- --ai p2   (p1 is human, p2 is AI)
//      cd frontend && npm run play-cli -- --ai both (both AI; you watch)

import * as readline from 'node:readline';
import type { Chooser, ChoicePrompt, ChoiceResult, AsyncStepResult, PendingStep } from '../index';
import {
  buildRegistry, describeAction, getLegalActions, initGame, step, stepAsync, resolveStep,
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

// AI players keep using synchronous step() with a heuristic chooser — the
// engine never pauses; the chooser auto-picks deterministically. Human
// players go through stepAsync (see runtime/async_step.ts), which surfaces
// each PendingChoice to readline interactively.
const aiChooser: Chooser = (prompt: ChoicePrompt) => {
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
// Interactive PendingChoice resolution (human players only)
// ---------------------------------------------------------------------------

function renderTarget(state: GameState, t: { kind: 'unit' | 'base'; iid?: string; controller: PlayerId }): string {
  if (t.kind === 'base') {
    const p = state.players[t.controller];
    const baseSpec = reg.bases[p.base.cardId];
    return `${t.controller}'s ${baseSpec?.name ?? 'base'}`;
  }
  const iid = (t as { iid: string }).iid;
  // Find the unit in either arena.
  for (const z of ['groundArena', 'spaceArena'] as const) {
    const found = state.players[t.controller][z].find(c => c.iid === iid);
    if (found) {
      const spec = reg.cards[found.cardId];
      return `${t.controller}'s ${spec?.name ?? iid}<${iid}>`;
    }
  }
  return `${t.controller}/${iid}`;
}

async function promptHuman(state: GameState, prompt: ChoicePrompt): Promise<ChoiceResult> {
  console.log(`\n  ▶ ${prompt.player} must resolve a choice`);
  switch (prompt.kind) {
    case 'choose_one': {
      console.log(`    ${prompt.prompt}`);
      prompt.options.forEach((o, i) => console.log(`    [${i}] ${o.label}`));
      if (prompt.canPass) console.log(`    [p] pass / decline`);
      while (true) {
        const ans = (await ask(`    > choose: `)).trim().toLowerCase();
        if (ans === 'q' || ans === 'quit') { rl.close(); process.exit(0); }
        if (prompt.canPass && (ans === 'p' || ans === 'pass')) return { kind: 'pass' };
        const i = parseInt(ans, 10);
        if (!Number.isNaN(i) && i >= 0 && i < prompt.options.length) {
          return { kind: 'option', value: prompt.options[i].value };
        }
        console.log(`    invalid — pick 0..${prompt.options.length - 1}${prompt.canPass ? ' or p' : ''}`);
      }
    }
    case 'prompt_target': {
      console.log(`    ${prompt.prompt} (need ${prompt.count}${prompt.minCount < prompt.count ? `, min ${prompt.minCount}` : ''})`);
      prompt.candidates.forEach((t, i) => console.log(`    [${i}] ${renderTarget(state, t)}`));
      if (prompt.canPass) console.log(`    [p] decline`);
      while (true) {
        const ans = (await ask(`    > pick ${prompt.count} indices (space-separated): `)).trim().toLowerCase();
        if (ans === 'q' || ans === 'quit') { rl.close(); process.exit(0); }
        if (prompt.canPass && (ans === 'p' || ans === 'pass' || ans === '')) return { kind: 'pass' };
        const parts = ans.split(/\s+/).filter(Boolean);
        const idxs = parts.map(p => parseInt(p, 10));
        if (idxs.length === 0 || idxs.some(i => Number.isNaN(i) || i < 0 || i >= prompt.candidates.length)) {
          console.log(`    invalid — pick ${prompt.count} indices from 0..${prompt.candidates.length - 1}`);
          continue;
        }
        if (idxs.length < prompt.minCount || idxs.length > prompt.count) {
          console.log(`    need ${prompt.minCount}-${prompt.count} picks, got ${idxs.length}`);
          continue;
        }
        const targets = idxs.map(i => prompt.candidates[i]);
        return { kind: 'targets', targets };
      }
    }
    case 'optional': {
      console.log(`    ${prompt.prompt} (y/n)`);
      while (true) {
        const ans = (await ask(`    > [y/n]: `)).trim().toLowerCase();
        if (ans === 'q' || ans === 'quit') { rl.close(); process.exit(0); }
        if (ans === 'y' || ans === 'yes') return { kind: 'yes' };
        if (ans === 'n' || ans === 'no')  return { kind: 'no' };
        console.log(`    invalid — type y or n`);
      }
    }
  }
}

/** Drive a human action through stepAsync, prompting interactively for every
 *  pending choice the engine surfaces. Returns the settled result. */
async function executeHumanAction(state: GameState, action: import('../actions').PlayerAction): Promise<{ next: GameState; events: import('../state/bus').GameEvent[] }> {
  let r: AsyncStepResult = stepAsync(state, action, reg);
  let pending: PendingStep | undefined = r.kind === 'pending' ? r.pending : undefined;
  // We collect events across the full step+resumes by replaying through the
  // final settled result — the engine's events are emitted on the final run.
  while (r.kind === 'pending') {
    const pick = await promptHuman(state, r.pending.prompt);
    pending = r.pending;
    r = resolveStep(r.pending, pick, reg);
  }
  void pending;
  return { next: r.next, events: r.events };
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

  let r: { next: GameState; events: import('../state/bus').GameEvent[] } = step(state, { kind: 'START_GAME' }, reg, aiChooser);
  state = r.next;

  console.log(`\n🎲 Twin Suns engine-v2 — interactive CLI`);
  console.log(`AI: ${aiOpt ?? 'none (both human)'}`);
  console.log(`Type the bracketed number to act; "q" to quit.`);

  let safety = 1000;
  while (!state.winner && safety-- > 0) {
    render(state);

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
      if (aiPlayers.has(pid)) {
        r = step(state, action, reg, aiChooser);
      } else {
        r = await executeHumanAction(state, action);
      }
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
