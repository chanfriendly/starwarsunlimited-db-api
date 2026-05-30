// Translator verification suite. Run: cd frontend && npm run translate-scenarios
//
// Two halves:
//   (1) Shape assertions — real-Card fixtures → expected CardSpec/BaseSpec.
//   (2) End-to-end — translate two decks, build a game, play it AI-vs-AI to a
//       winner. Proves the produced registry+config is actually playable, not
//       just structurally plausible.

import { buildGameFromDecks, translateCard, parseKeywords } from './translate';
import { matchCard } from './match';
import type { Card, SavedDeck, DeckCardEntry } from '../api';
import { initGame, step, getLegalActions, validateCardSpec } from '../engine-v2';
import type {
  CardRegistry, CardSpec, GameState, PlayerId, PlayerAction, Chooser,
} from '../engine-v2';

// ---------------------------------------------------------------------------
// Fixture helpers — produce backend-shaped Card objects.
// ---------------------------------------------------------------------------

let _id = 0;
function mkCard(over: Partial<Card> & { name: string }): Card {
  return {
    id: over.id ?? `C${_id++}`,
    aspects: [],
    keywords: [],
    traits: [],
    arenas: [],
    ...over,
  };
}

function aspect(name: string) { return { aspect_name: name }; }

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

let passed = 0, failed = 0;
function scenario(name: string, fn: () => void) {
  try { fn(); console.log(`✅ ${name}`); passed++; }
  catch (e) { console.log(`❌ ${name}\n     ${e instanceof Error ? e.message : String(e)}`); failed++; }
}
function assertEq(actual: unknown, expected: unknown, label: string) {
  const a = JSON.stringify(actual), b = JSON.stringify(expected);
  if (a !== b) throw new Error(`${label}: expected ${b}, got ${a}`);
}

// ---------------------------------------------------------------------------
// (1) Shape assertions
// ---------------------------------------------------------------------------

scenario('Unit: stats, arena, aspects, traits map correctly', () => {
  const r = translateCard(mkCard({
    id: 'u1', name: 'Battlefield Marine', type: 'Unit',
    energy_cost: 2, attack: 3, health: 2,
    arenas: ['Ground'], aspects: [aspect('Heroism')], traits: ['Rebel', 'Trooper'],
  }));
  if (!r.spec || r.spec.type !== 'unit') throw new Error('not a unit spec');
  assertEq(r.spec.cost, 2, 'cost');
  assertEq(r.spec.power, 3, 'power');
  assertEq(r.spec.hp, 2, 'hp');
  assertEq(r.spec.arena, 'ground', 'arena');
  assertEq(r.spec.aspects, ['heroism'], 'aspects');
  assertEq(r.spec.traits, ['rebel', 'trooper'], 'traits');
  assertEq(r.spec.abilities, [], 'abilities empty (L4 deferred)');
});

scenario('Keyword without value: Grit/Sentinel translate name-only', () => {
  const kws = parseKeywords(mkCard({ name: 'X', keywords: ['Grit', 'Sentinel'], text: 'Grit. Sentinel.' }));
  assertEq(kws, [{ name: 'grit' }, { name: 'sentinel' }], 'keywords');
});

scenario('Keyword value from text: Raid 3 pulled from rules text', () => {
  const kws = parseKeywords(mkCard({ name: 'X', keywords: ['Raid'], text: 'Raid 3. (While attacking, this gets +3 power.)' }));
  assertEq(kws, [{ name: 'raid', value: 3 }], 'raid value');
});

scenario('Keyword value inline: "Raid 2" in keyword string', () => {
  const kws = parseKeywords(mkCard({ name: 'X', keywords: ['Raid 2'] }));
  assertEq(kws, [{ name: 'raid', value: 2 }], 'inline raid value');
});

scenario('Restore value from text', () => {
  const kws = parseKeywords(mkCard({ name: 'X', keywords: ['Restore'], text: 'Restore 1.' }));
  assertEq(kws, [{ name: 'restore', value: 1 }], 'restore value');
});

scenario('Event: maps to event spec, no stats', () => {
  const r = translateCard(mkCard({ id: 'e1', name: 'Vanquish', type: 'Event', energy_cost: 5, aspects: [aspect('Vigilance')] }));
  if (!r.spec || r.spec.type !== 'event') throw new Error('not event');
  assertEq(r.spec.cost, 5, 'cost');
});

scenario('Upgrade: attack/health become powerModifier/hpModifier', () => {
  const r = translateCard(mkCard({ id: 'up1', name: 'Resilient', type: 'Upgrade', energy_cost: 1, attack: 2, health: 3 }));
  if (!r.spec || r.spec.type !== 'upgrade') throw new Error('not upgrade');
  assertEq(r.spec.powerModifier, 2, 'powerModifier');
  assertEq(r.spec.hpModifier, 3, 'hpModifier');
});

scenario('Leader with NULL stats falls back to 3/6', () => {
  const r = translateCard(mkCard({
    id: 'l1', name: 'Some Leader', type: 'Leader', energy_cost: 5,
    arenas: ['Ground'], attack: undefined, health: undefined,
  }));
  if (!r.spec || r.spec.type !== 'leader') throw new Error('not leader');
  assertEq(r.spec.power, 3, 'fallback power');
  assertEq(r.spec.hp, 6, 'fallback hp');
  assertEq(r.spec.cost, 5, 'deploy cost');
});

scenario('Leader with real stats keeps them', () => {
  const r = translateCard(mkCard({
    id: 'l2', name: 'Statty Leader', type: 'Leader', energy_cost: 6,
    arenas: ['Ground'], attack: 4, health: 7,
  }));
  if (!r.spec || r.spec.type !== 'leader') throw new Error('not leader');
  assertEq(r.spec.power, 4, 'power');
  assertEq(r.spec.hp, 7, 'hp');
});

scenario('Base: health → BaseSpec.hp, fallback 30', () => {
  const withHp = translateCard(mkCard({ id: 'b1', name: 'Echo Base', type: 'Base', health: 30 }));
  if (!withHp.base) throw new Error('not base');
  assertEq(withHp.base.hp, 30, 'base hp');
  const noHp = translateCard(mkCard({ id: 'b2', name: 'Mystery Base', type: 'Base' }));
  if (!noHp.base) throw new Error('not base 2');
  assertEq(noHp.base.hp, 30, 'fallback base hp');
});

scenario('Unknown aspect is dropped', () => {
  const r = translateCard(mkCard({
    id: 'u2', name: 'Weird', type: 'Unit', attack: 1, health: 1,
    arenas: ['Space'], aspects: [aspect('Heroism'), aspect('Bogus')],
  }));
  if (!r.spec || r.spec.type !== 'unit') throw new Error('not unit');
  assertEq(r.spec.aspects, ['heroism'], 'bogus aspect dropped');
  assertEq(r.spec.arena, 'space', 'space arena');
});

scenario('Token in deck is skipped with a reason', () => {
  const r = translateCard(mkCard({ id: 't1', name: 'Clone Trooper Token', type: 'Token' }));
  if (!r.skipped) throw new Error('token should be skipped');
});

// ---------------------------------------------------------------------------
// (2) End-to-end: translate decks → build game → play to completion
// ---------------------------------------------------------------------------

function makeDeck(name: string, idPrefix: string): SavedDeck {
  // Two leaders, a base, and a spread of cheap aggressive units so the game
  // converges in a handful of rounds.
  const leaders: Card[] = [
    mkCard({ id: `${idPrefix}-L1`, name: `${name} Leader A`, type: 'Leader', energy_cost: 4, arenas: ['Ground'], attack: 3, health: 6, aspects: [aspect('Command')] }),
    mkCard({ id: `${idPrefix}-L2`, name: `${name} Leader B`, type: 'Leader', energy_cost: 5, arenas: ['Ground'], attack: 4, health: 7, aspects: [aspect('Aggression')] }),
  ];
  const base = mkCard({ id: `${idPrefix}-BASE`, name: `${name} Base`, type: 'Base', health: 30 });

  const unitDefs = [
    { n: 'Trooper', cost: 1, atk: 2, hp: 1, arena: 'Ground', kw: [] as string[] },
    { n: 'Raider',  cost: 2, atk: 3, hp: 2, arena: 'Ground', kw: ['Raid'], text: 'Raid 2.' },
    { n: 'Guard',   cost: 2, atk: 1, hp: 4, arena: 'Ground', kw: ['Sentinel'] },
    { n: 'Fighter', cost: 3, atk: 4, hp: 3, arena: 'Space',  kw: ['Grit'] },
    { n: 'Brute',   cost: 4, atk: 5, hp: 4, arena: 'Ground', kw: ['Overwhelm'] },
    { n: 'Sapper',  cost: 2, atk: 2, hp: 2, arena: 'Ground', kw: ['Saboteur'] },
  ];
  const cards: DeckCardEntry[] = unitDefs.map((u, i) => ({
    card: mkCard({
      id: `${idPrefix}-U${i}`, name: `${name} ${u.n}`, type: 'Unit',
      energy_cost: u.cost, attack: u.atk, health: u.hp,
      arenas: [u.arena], keywords: u.kw, text: (u as { text?: string }).text,
      aspects: [aspect('Aggression')], traits: ['trooper'],
    }),
    quantity: 5,
  }));

  return { id: `${idPrefix}-deck`, name, leaders, base, cards };
}

const chooser: Chooser = (prompt) => {
  if (prompt.kind === 'choose_one') return { kind: 'option', value: prompt.options[0]?.value ?? '' };
  if (prompt.kind === 'prompt_target') return { kind: 'targets', targets: prompt.candidates.slice(0, prompt.count) };
  return { kind: 'yes' };
};

function greedy(state: GameState, reg: CardRegistry, pid: PlayerId): PlayerAction | undefined {
  const { actions } = getLegalActions(state, reg, pid);
  if (actions.length === 0) return undefined;
  if (state.phase === 'setup' || (state.phase === 'regroup' && state.regroupStep === 'resource')) {
    const res = actions.find(a => a.kind === 'RESOURCE_CARD');
    return res ?? actions[0];
  }
  // Avoid TAKE_COUNTER in the driver to keep the loop simple; prefer base hits
  // to converge, then plays, then any attack, then pass.
  return actions.find(a => a.kind === 'ATTACK' && a.defenderIid === 'base')
      ?? actions.find(a => a.kind === 'PLAY_CARD')
      ?? actions.find(a => a.kind === 'ATTACK')
      ?? actions.find(a => a.kind === 'PASS')
      ?? actions[actions.length - 1];
}

scenario('buildGameFromDecks: registry + config shape', () => {
  const d1 = makeDeck('Alpha', 'A');
  const d2 = makeDeck('Bravo', 'B');
  const { config, registry, warnings } = buildGameFromDecks(d1, d2);
  // Base in registry.bases, leaders + units in registry.cards.
  if (!registry.bases['A-BASE']) throw new Error('p1 base not registered');
  if (!registry.cards['A-L1'] || registry.cards['A-L1'].type !== 'leader') throw new Error('leader not registered as leader');
  assertEq(config.players[0].leaderIds, ['A-L1', 'A-L2'], 'p1 leaderIds');
  assertEq(config.players[0].baseId, 'A-BASE', 'p1 baseId');
  // 6 unit defs × qty 5 = 30 deck cards.
  assertEq(config.players[0].deckCardIds.length, 30, 'p1 deck size');
  assertEq(warnings.length, 0, 'no warnings for clean decks');
});

scenario('buildGameFromDecks: token in deck.cards is skipped with warning', () => {
  const d1 = makeDeck('Alpha', 'A');
  const d2 = makeDeck('Bravo', 'B');
  d1.cards.push({ card: mkCard({ id: 'A-TOK', name: 'Token', type: 'Token' }), quantity: 2 });
  const { config, warnings } = buildGameFromDecks(d1, d2);
  // Token excluded from deck — still 30 real cards.
  assertEq(config.players[0].deckCardIds.length, 30, 'token excluded from deck');
  if (!warnings.some(w => w.includes('Token'))) throw new Error('expected a token-skip warning');
});

scenario('buildGameFromDecks: deck with no base throws clearly', () => {
  const d1 = makeDeck('Alpha', 'A');
  const d2 = makeDeck('Bravo', 'B');
  d1.base = null;
  let threw = '';
  try { buildGameFromDecks(d1, d2); } catch (e) { threw = e instanceof Error ? e.message : String(e); }
  if (!threw.includes('no base')) throw new Error(`expected "no base" error, got "${threw}"`);
});

scenario('Translated real decks play to completion (AI vs AI)', () => {
  const d1 = makeDeck('Alpha', 'A');
  const d2 = makeDeck('Bravo', 'B');
  const { config, registry } = buildGameFromDecks(d1, d2);
  let s = initGame(config, registry);
  s = step(s, { kind: 'START_GAME' }, registry, chooser).next;
  let guard = 3000;
  while (!s.winner && guard-- > 0) {
    const a = greedy(s, registry, s.activePlayer);
    if (!a) break;
    s = step(s, a, registry, chooser).next;
  }
  if (!s.winner) throw new Error(`game did not converge in 3000 steps (round ${s.round}, phase ${s.phase})`);
  console.log(`     → winner: ${s.winner} in round ${s.round}`);
});

// ---------------------------------------------------------------------------
// Tier-1 template matcher
// ---------------------------------------------------------------------------

scenario('Matcher: event "Deal 3 damage to an enemy unit." → when-played triggered', () => {
  const r = matchCard({ name: 'X', type: 'Event', text: 'Deal 3 damage to an enemy unit.' });
  assertEq(r.coverage, 'full', 'coverage');
  assertEq(r.abilities.length, 1, 'one ability');
  const a = r.abilities[0];
  if (a.type !== 'triggered' || a.on !== 'event.card_played') throw new Error('expected when-played trigger');
  if (a.do.effect !== 'damage') throw new Error('expected damage effect');
  assertEq((a.do as { amount: number }).amount, 3, 'damage amount');
});

scenario('Matcher: "When Played: Draw a card." → draw 1 ("a" = 1)', () => {
  const r = matchCard({ name: 'X', type: 'Unit', text: 'When Played: Draw a card.' });
  assertEq(r.coverage, 'full', 'coverage');
  const a = r.abilities[0];
  if (a.type !== 'triggered' || a.do.effect !== 'draw') throw new Error('expected draw');
  assertEq((a.do as { count: number }).count, 1, 'draw count');
});

scenario('Matcher: event "Give a unit +2/+2 for this phase." → give w/ end_of_phase', () => {
  const r = matchCard({ name: 'X', type: 'Event', text: 'Give a unit +2/+2 for this phase.' });
  assertEq(r.coverage, 'full', 'coverage');
  const a = r.abilities[0];
  if (a.type !== 'triggered' || a.do.effect !== 'give') throw new Error('expected give');
  assertEq((a.do as { modifier: { duration: string } }).modifier.duration, 'end_of_phase', 'phase duration');
});

scenario('Matcher: upgrade "Attach to a non-vehicle unit." → vanilla (attach restriction stripped)', () => {
  const r = matchCard({ name: 'X', type: 'Upgrade', text: 'Attach to a non-vehicle unit.' });
  assertEq(r.coverage, 'vanilla', 'attach-only upgrade is vanilla');
  assertEq(r.abilities.length, 0, 'no abilities');
});

scenario('Matcher: "While this unit is upgraded, it gets +2/+2." → constant w/ self_upgraded', () => {
  const r = matchCard({ name: 'X', type: 'Unit', text: 'While this unit is upgraded, it gets +2/+2.' });
  assertEq(r.coverage, 'full', 'coverage');
  const a = r.abilities[0];
  if (a.type !== 'constant') throw new Error('expected constant');
  if (!a.while || !('self_upgraded' in a.while)) throw new Error('expected self_upgraded gate');
});

scenario('Matcher: keyword-only text "Sentinel (...)" → vanilla', () => {
  const r = matchCard({ name: 'X', type: 'Unit', text: 'Sentinel (Enemy units in this arena must attack a Sentinel.)' });
  assertEq(r.coverage, 'vanilla', 'keyword-only is vanilla');
});

scenario('Matcher: unrecognized text → coverage none, residual captured', () => {
  const r = matchCard({ name: 'X', type: 'Unit', text: 'When Played: Reverse the polarity of the neutron flow.' });
  assertEq(r.coverage, 'none', 'coverage none');
  if (r.residual.length === 0) throw new Error('expected a residual clause');
});

scenario('Matcher: "Give an Experience token to an Imperial unit." → give_experience + trait filter', () => {
  const r = matchCard({ name: 'X', type: 'Event', text: 'Give an Experience token to an Imperial unit.' });
  assertEq(r.coverage, 'full', 'coverage');
  const a = r.abilities[0];
  if (a.type !== 'triggered' || a.do.effect !== 'give_experience') throw new Error('expected give_experience');
  const sel = (a.do as { target: { filter?: { card_trait?: string }; controller?: string } }).target;
  assertEq(sel.filter?.card_trait, 'imperial', 'trait filter');
  assertEq(sel.controller, 'self', 'friendly target');
});

scenario('Matcher: "When Played: Give an Experience token to each of up to 3 Trooper units." → multi-target', () => {
  const r = matchCard({ name: 'X', type: 'Unit', text: 'When Played: Give an Experience token to each of up to 3 Trooper units.' });
  assertEq(r.coverage, 'full', 'coverage');
  const a = r.abilities[0];
  if (a.type !== 'triggered' || a.on !== 'event.card_played' || a.do.effect !== 'give_experience') throw new Error('expected when-played give_experience');
  const sel = (a.do as { target: { count?: unknown; filter?: { card_trait?: string } } }).target;
  assertEq((sel.count as { max: number }).max, 3, 'up to 3');
  assertEq(sel.filter?.card_trait, 'trooper', 'trooper filter');
});

scenario('Matcher: Gideon Hask "When an enemy unit is defeated: Give an Experience token to a friendly unit."', () => {
  const r = matchCard({ name: 'X', type: 'Unit', text: 'When an enemy unit is defeated: Give an Experience token to a friendly unit.' });
  assertEq(r.coverage, 'full', 'coverage');
  const a = r.abilities[0];
  if (a.type !== 'triggered' || a.on !== 'event.defeated' || a.do.effect !== 'give_experience') throw new Error('expected defeated→give_experience');
  assertEq((a.where as { controller?: string } | undefined)?.controller, 'opponent', 'enemy-defeat filter');
});

scenario('Matcher: Tarkin "Action [1 resource, exhaust]: Give an Experience token to an Imperial unit."', () => {
  const r = matchCard({ name: 'X', type: 'Leader', text: 'Action [1 resource, exhaust]: Give an Experience token to an Imperial unit.' });
  assertEq(r.coverage, 'full', 'coverage');
  const a = r.abilities[0];
  if (a.type !== 'action') throw new Error('expected action ability');
  assertEq((a.cost as { resources?: number; exhaust?: boolean }).resources, 1, 'cost 1 resource');
  assertEq((a.cost as { exhaust?: boolean }).exhaust, true, 'cost exhaust');
  if (a.do.effect !== 'give_experience') throw new Error('expected give_experience');
});

scenario('Matcher: leader abilities route to leaderAbilities via translateCard', () => {
  const r = translateCard({
    id: 'L', name: 'Tarkin', type: 'Leader', energy_cost: 5, attack: 4, health: 7,
    arenas: ['Ground'], aspects: [aspect('Command')], keywords: [], traits: ['imperial'],
    text: 'Action [1 resource, exhaust]: Give an Experience token to an Imperial unit.',
  });
  if (!r.spec || r.spec.type !== 'leader') throw new Error('not a leader spec');
  assertEq(r.spec.leaderAbilities?.length, 1, 'one leader ability matched');
});

scenario('Matcher: uninterpretable action cost → residual (Doctor Pershing)', () => {
  const r = matchCard({ name: 'X', type: 'Unit', text: 'Action [Exhaust, deal 1 damage to a friendly unit]: Draw a card.' });
  // The damage-as-cost component can't be expressed → left residual, not a bad match.
  if (r.coverage === 'full') throw new Error('should not fully match an uninterpretable cost');
});

scenario('Matcher: Piett "Each friendly non-leader unit that costs 6 or more gains Ambush." → keyword aura', () => {
  const r = matchCard({ name: 'X', type: 'Unit', text: 'Each friendly non-leader unit that costs 6 or more gains Ambush.' });
  assertEq(r.coverage, 'full', 'coverage');
  const a = r.abilities[0];
  if (a.type !== 'constant') throw new Error('expected constant');
  assertEq(a.grant.modifier.keyword, 'ambush', 'grants ambush');
});

scenario('Matcher: Shoretrooper "While you control 6 or more resources, this unit gets +2/+0." → resource-count gate', () => {
  const r = matchCard({ name: 'X', type: 'Unit', text: 'While you control 6 or more resources, this unit gets +2/+0.' });
  assertEq(r.coverage, 'full', 'coverage');
  const a = r.abilities[0];
  if (a.type !== 'constant' || !a.while || !('controller_resource_count' in a.while)) throw new Error('expected resource-count gate');
});

scenario('Matcher: Bunker Defender "While you control a Vehicle unit, this unit gains Sentinel." → controls-trait gate', () => {
  const r = matchCard({ name: 'X', type: 'Unit', text: 'While you control a Vehicle unit, this unit gains Sentinel.' });
  assertEq(r.coverage, 'full', 'coverage');
  const a = r.abilities[0];
  if (a.type !== 'constant' || (a.while as { controller_controls_trait?: string } | undefined)?.controller_controls_trait !== 'vehicle') throw new Error('expected controls-trait gate');
  assertEq(a.grant.modifier.keyword, 'sentinel', 'grants sentinel');
});

scenario('Matcher: 97th Legion "This unit gets +1/+1 for each resource you control." → per-X scaling', () => {
  const r = matchCard({ name: 'X', type: 'Unit', text: 'This unit gets +1/+1 for each resource you control.' });
  assertEq(r.coverage, 'full', 'coverage');
  const a = r.abilities[0];
  if (a.type !== 'constant' || a.grant.modifier.per?.count !== 'controller_resources') throw new Error('expected per controller_resources');
});

scenario('Matcher: Crosshair "Action [2 resources]: This unit gets +1/+0 for this phase." → action self-buff', () => {
  const r = matchCard({ name: 'X', type: 'Unit', text: 'Action [2 resources]: This unit gets +1/+0 for this phase.' });
  assertEq(r.coverage, 'full', 'coverage');
  const a = r.abilities[0];
  if (a.type !== 'action' || a.do.effect !== 'give') throw new Error('expected action give self-buff');
  assertEq((a.cost as { resources?: number }).resources, 2, 'cost 2 resources');
});

scenario('Matcher: every emitted ability validates clean (spot set)', () => {
  const samples = [
    { type: 'Event', text: 'Deal 2 damage to a unit or base.' },
    { type: 'Event', text: 'Heal 3 damage from your base.' },
    { type: 'Event', text: 'Defeat a non-leader unit.' },
    { type: 'Unit', text: 'On Attack: Give a unit +1/+1 for this phase.' },
    { type: 'Unit', text: 'Each enemy unit gets -1/-1.' },
  ];
  for (const s of samples) {
    const r = matchCard({ name: 'probe', type: s.type, text: s.text });
    if (r.abilities.length === 0) throw new Error(`no abilities for "${s.text}"`);
    const probe = { id: 'p', name: 'p', type: 'unit', arena: 'ground', power: 1, hp: 1, abilities: r.abilities } as CardSpec;
    const v = validateCardSpec(probe);
    if (!v.ok) throw new Error(`invalid AST for "${s.text}": ${v.errors.map(e => e.message).join(', ')}`);
  }
});

// ---------------------------------------------------------------------------
console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
