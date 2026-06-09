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

scenario('Unit: is_unique → spec.unique (rule-of-one wiring)', () => {
  const u = translateCard(mkCard({ id: 'uq', name: 'Han Solo', type: 'Unit', attack: 5, health: 6, arenas: ['Ground'], is_unique: true }));
  if (!u.spec || u.spec.type !== 'unit') throw new Error('not a unit');
  assertEq(u.spec.unique, true, 'unique mapped from is_unique');
  // Non-unique (flag absent) → false, not undefined.
  const n = translateCard(mkCard({ id: 'nq', name: 'Trooper', type: 'Unit', attack: 2, health: 1, arenas: ['Ground'] }));
  if (!n.spec || n.spec.type !== 'unit') throw new Error('not a unit');
  assertEq(n.spec.unique, false, 'absent is_unique → false');
  // Leaders can be unique too.
  const l = translateCard(mkCard({ id: 'lq', name: 'Leia', type: 'Leader', arenas: ['Ground'], attack: 3, health: 6, is_unique: true }));
  if (!l.spec || l.spec.type !== 'leader') throw new Error('not a leader');
  assertEq(l.spec.unique, true, 'leader unique mapped');
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

scenario('Deals-combat-damage-first text → attacker_combat_first marker keyword', () => {
  const kws = parseKeywords(mkCard({
    name: 'Incinerator Trooper',
    text: 'While attacking, this unit deals combat damage before the defender. (If the defender is defeated, it deals no combat damage.)',
  }));
  assertEq(kws, [{ name: 'attacker_combat_first' }], 'combat-first marker added from text');
});

scenario('No deals-first text → no marker keyword', () => {
  const kws = parseKeywords(mkCard({ name: 'X', keywords: ['Grit'], text: 'Grit. When Played: draw a card.' }));
  assertEq(kws, [{ name: 'grit' }], 'only the real keyword; no spurious combat-first marker');
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

scenario('Leader: text → leaderAbilities, deploy_box → leaderUnitAbilities', () => {
  // Tarkin-shaped: leader-side action in `text`, deployed-unit On-Attack in
  // `deploy_box`. Both columns must translate into their respective ability lists.
  const r = translateCard(mkCard({
    id: 'l3', name: 'Grand Moff Tarkin', subtitle: 'Oversector Governor', type: 'Leader',
    energy_cost: 5, arenas: ['Ground'], traits: ['Imperial'],
    text: 'Action [1 resource, exhaust]: Give an Experience token to an Imperial unit.',
    deploy_box: 'On Attack: You may give an Experience token to another Imperial unit.',
  }));
  if (!r.spec || r.spec.type !== 'leader') throw new Error('not leader');
  const la = r.spec.leaderAbilities ?? [];
  const lua = r.spec.leaderUnitAbilities ?? [];
  assertEq(la.length, 1, 'leader-side action from text');
  assertEq(la[0].type, 'action', 'text is an action ability');
  assertEq(lua.length, 1, 'deployed-unit ability from deploy_box');
  assertEq(lua[0].type, 'triggered', 'deploy_box On Attack is triggered');
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

scenario('Matcher: "On Attack: Deal 3 indirect damage to the defending player" → indirect_damage', () => {
  const r = matchCard({ name: 'TIE Bomber', type: 'Unit', text: 'On Attack: Deal 3 indirect damage to the defending player. (They assign 3 unpreventable damage among their base and units.)' });
  assertEq(r.coverage, 'full', 'coverage');
  const a = r.abilities[0];
  if (a.type !== 'triggered' || a.on !== 'event.attack_declared') throw new Error('expected on-attack trigger');
  if (a.do.effect !== 'indirect_damage') throw new Error('expected indirect_damage effect');
  const ind = a.do as { amount: number; player: string };
  assertEq(ind.amount, 3, 'amount');
  assertEq(ind.player, 'opponent', 'recipient = the defending player (opponent)');
});

scenario('Matcher: "Put this event into play as a resource." → play_as_resource', () => {
  const r = matchCard({ name: 'Resupply', type: 'Event', text: 'Put this event into play as a resource.' });
  assertEq(r.coverage, 'full', 'coverage');
  const a = r.abilities[0];
  if (a.type !== 'triggered' || a.do.effect !== 'play_as_resource') throw new Error('expected play_as_resource');
});

scenario('Matcher: "Attached unit gains: \'On Attack: …\' and \'When Defeated: …\'" → constant grant.abilities (Sith Traditions)', () => {
  const r = matchCard({ name: 'Sith Traditions', type: 'Upgrade', text: 'Attach to a non-Vehicle unit.\nAttached unit gains: “On Attack: Give an Experience token to this unit.” and “When Defeated: Give an Experience token to a friendly unit.”' });
  assertEq(r.coverage, 'full', 'coverage');
  const a = r.abilities[0];
  if (a.type !== 'constant' || !a.grant.abilities) throw new Error('expected constant grant.abilities');
  assertEq(a.grant.abilities.length, 2, 'two granted abilities');
  if (!('attached_to_self' in a.grant.target)) throw new Error('grant targets the host');
  const [g0, g1] = a.grant.abilities;
  if (g0.type !== 'triggered' || g0.on !== 'event.attack_declared') throw new Error('granted On-Attack');
  if (g0.do.effect !== 'give_experience' || !('self' in (g0.do as { target: object }).target)) throw new Error('On-Attack gives Experience to the host (self)');
  if (g1.type !== 'triggered' || g1.on !== 'event.defeated') throw new Error('granted When-Defeated');
});

scenario('Matcher: "If attached unit is a Jedi, it gains: \'On Attack: The next unit you play this phase costs 2 resources less.\'" → conditional discount grant (General\'s Blade)', () => {
  const r = matchCard({ name: "General's Blade", type: 'Upgrade', text: 'Attach to a non-Vehicle unit.\nIf attached unit is a Jedi, it gains: “On Attack: The next unit you play this phase costs 2 resources less.”' });
  assertEq(r.coverage, 'full', 'coverage');
  const a = r.abilities[0];
  if (a.type !== 'constant' || !a.grant.abilities) throw new Error('expected constant grant.abilities');
  const tgt = a.grant.target as { attached_to_self?: boolean; filter?: { card_trait?: string } };
  if (!tgt.attached_to_self || tgt.filter?.card_trait !== 'jedi') throw new Error('host gated on Jedi');
  const g = a.grant.abilities[0];
  if (g.type !== 'triggered' || g.on !== 'event.attack_declared' || g.do.effect !== 'discount') throw new Error('granted On-Attack discount');
  if ((g.do as { amount?: number; card_type?: string }).amount !== 2 || (g.do as { card_type?: string }).card_type !== 'unit') throw new Error('discount 2, units');
});

scenario('Matcher: "Defeat a non-leader ground unit with 3 or less remaining HP." → arena-scoped remaining-HP defeat', () => {
  const r = matchCard({ name: 'X', type: 'Event', text: 'Defeat a non-leader ground unit with 3 or less remaining HP.' });
  assertEq(r.coverage, 'full', 'coverage');
  const tgt = (r.abilities[0] as { do: { effect: string; target: { zone?: string; filter?: unknown } } }).do.target;
  assertEq(tgt.zone, 'ground_arena', 'ground-scoped');
  if (!tgt.filter) throw new Error('expected remaining_hp + non-leader filter');
});

scenario('Matcher: "Create a Credit token." / "Create 2 Credit tokens." → create_credit (not a unit token)', () => {
  const one = matchCard({ name: 'X', type: 'Event', text: 'Create a Credit token.' });
  assertEq(one.coverage, 'full', 'a credit');
  const a = one.abilities[0];
  if (a.type !== 'triggered' || a.do.effect !== 'create_credit') throw new Error('expected create_credit');
  const two = matchCard({ name: 'X', type: 'Event', text: 'Create 2 Credit tokens.' });
  assertEq((two.abilities[0] as { do: { count?: number } }).do.count, 2, 'count 2');
});

scenario('Matcher: exhaust variants — attached unit / friendly / non-leader / remaining-HP / "If this unit is upgraded"', () => {
  assertEq(matchCard({ name: 'X', type: 'Upgrade', text: 'When Played: Exhaust attached unit.' }).coverage, 'full', 'exhaust attached');
  const fr = matchCard({ name: 'X', type: 'Event', text: 'Exhaust a friendly unit.' });
  assertEq((fr.abilities[0] as { do: { target: { controller?: string } } }).do.target.controller, 'self', 'friendly → self');
  const hp = matchCard({ name: 'X', type: 'Event', text: 'Exhaust an enemy unit with 4 or less remaining HP.' });
  if (!(hp.abilities[0] as { do: { target: { filter?: { remaining_hp?: object } } } }).do.target.filter?.remaining_hp) throw new Error('remaining-HP filter');
  const up = matchCard({ name: 'X', type: 'Unit', text: 'On Attack: If this unit is upgraded, exhaust an enemy unit.' });
  if ((up.abilities[0] as { do: { effect: string; condition?: { self_upgraded?: boolean } } }).do.condition?.self_upgraded !== true) throw new Error('if-self-upgraded');
});

scenario('Matcher: "While the Force is with you, this unit gains <Keyword> / each friendly unit gets +N/+N" → player_has_force_token gate (reuses existing predicate)', () => {
  const a = matchCard({ name: 'Plo Koon', type: 'Unit', text: 'While the Force is with you, this unit gains Grit. (He gets +1/+0 for each damage on him.)' });
  assertEq(a.coverage, 'full', 'self keyword grant');
  if ((a.abilities[0] as { while?: { player_has_force_token?: boolean }; grant: { modifier?: { keyword?: string } } }).while?.player_has_force_token !== true) throw new Error('gated on the Force token');
  const b = matchCard({ name: 'The Son', type: 'Unit', text: 'While the Force is with you, each friendly unit gets +2/+0.' });
  assertEq(b.coverage, 'full', 'friendly aura');
});

scenario('Matcher: "Defeat [up to N] [enemy] [non-unique] upgrade(s)." / "Defeat this upgrade." → defeat_upgrade', () => {
  const a = matchCard({ name: 'X', type: 'Event', text: 'Defeat an enemy upgrade.' });
  assertEq(a.coverage, 'full', 'enemy upgrade');
  if ((a.abilities[0] as { do: { effect: string; controller?: string } }).do.effect !== 'defeat_upgrade') throw new Error('expected defeat_upgrade');
  assertEq((a.abilities[0] as { do: { controller?: string } }).do.controller, 'opponent', 'enemy → opponent');
  const b = matchCard({ name: 'X', type: 'Event', text: 'Defeat up to 2 upgrades.' });
  assertEq((b.abilities[0] as { do: { count?: number } }).do.count, 2, 'up to 2');
  const c = matchCard({ name: 'X', type: 'Upgrade', text: 'On Attack: Defeat this upgrade.' });
  if ((c.abilities[0] as { do: { effect: string; self?: boolean } }).do.self !== true) throw new Error('"this upgrade" → self defeat');
});

scenario('Matcher: "If you control Poe Dameron (as a unit, upgrade, or leader), …" → if-on-controls_named (Black One)', () => {
  const r = matchCard({ name: 'Black One', type: 'Unit', text: 'On Attack: If you control Poe Dameron (as a unit, upgrade, or leader), you may deal 1 damage to a unit.' });
  assertEq(r.coverage, 'full', 'coverage');
  const a = r.abilities[0];
  if (a.type !== 'triggered' || a.do.effect !== 'if') throw new Error('expected On-Attack if');
  assertEq((a.do as { condition: { controls_named?: string } }).condition.controls_named, 'Poe Dameron', 'gated on controlling the named card');
  // The generic "If you control a/another <X> unit" form is NOT misread as a name.
  const generic = matchCard({ name: 'X', type: 'Unit', text: 'On Attack: If you control another Villainy unit, deal 1 damage to a unit.' });
  if ((generic.abilities[0] as { do: { condition: object } }).do.condition.hasOwnProperty('controls_named')) throw new Error('generic control must not use controls_named');
});

scenario('Matcher: "While you have the initiative, +2/+0" / "If you have the initiative, …" → has_initiative gate', () => {
  const c = matchCard({ name: 'Senator’s Aide', type: 'Unit', text: 'While you have the initiative, this unit gets +2/+0.' });
  assertEq(c.coverage, 'full', 'constant coverage');
  if ((c.abilities[0] as { while?: { has_initiative?: boolean } }).while?.has_initiative !== true) throw new Error('constant gated on has_initiative');
  const e = matchCard({ name: 'Jedi Knight', type: 'Unit', text: 'When Played: If you have the initiative, deal 2 damage to an enemy ground unit.' });
  assertEq(e.coverage, 'full', 'effect coverage');
  if ((e.abilities[0] as { do: { effect: string; condition?: { has_initiative?: boolean } } }).do.condition?.has_initiative !== true) throw new Error('effect gated on has_initiative');
});

scenario('Matcher: "If a unit left play this phase, create a Clone Trooper token." → if-on-left-play (Chancellor Palpatine)', () => {
  const r = matchCard({ name: 'Chancellor Palpatine', type: 'Unit', text: 'On Attack: If a unit left play this phase, create a Clone Trooper token.' });
  assertEq(r.coverage, 'full', 'coverage');
  const do_ = (r.abilities[0] as { do: { effect: string; condition?: { unit_left_play_this_phase?: string }; then?: { effect: string } } }).do;
  assertEq(do_.effect, 'if', 'if effect');
  assertEq(do_.condition?.unit_left_play_this_phase, 'any', '"a unit" → any controller');
  assertEq(do_.then?.effect, 'create_token', 'creates a token');
  // "a friendly unit" → friendly scope.
  const fr = matchCard({ name: 'X', type: 'Event', text: 'If a friendly unit left play this phase, draw 2 cards.' });
  assertEq(((fr.abilities[0] as { do: { condition?: { unit_left_play_this_phase?: string } } }).do.condition?.unit_left_play_this_phase), 'friendly', '"a friendly unit" → friendly');
});

scenario('Matcher: "If you control a Jedi unit, you may give an Experience token to this unit." → if-on-control + optional inner (control-gated effect)', () => {
  const r = matchCard({ name: 'X', type: 'Unit', text: 'On Attack: If you control a Jedi unit, you may give an Experience token to this unit.' });
  assertEq(r.coverage, 'full', 'coverage');
  const do_ = (r.abilities[0] as { do: { effect: string; condition?: { controller_controls?: { filter?: { card_trait?: string } } }; then?: { effect: string } } }).do;
  assertEq(do_.effect, 'if', 'if effect');
  assertEq(do_.condition?.controller_controls?.filter?.card_trait, 'jedi', 'gated on controlling a Jedi unit');
  assertEq(do_.then?.effect, 'optional', '"you may" → optional inner');
});

scenario('Matcher: "If you control a ground unit and a space unit, …" (compound condition) stays residual', () => {
  const r = matchCard({ name: 'X', type: 'Event', text: 'If you control a ground unit and a space unit, draw 2 cards.' });
  if (r.coverage === 'full') throw new Error('compound / arena control conditions are not modeled — must stay residual');
});

scenario('Matcher: "While you control another Villainy unit, this unit gets +2/+0." → controller_controls gate (exclude_self, aspect)', () => {
  const r = matchCard({ name: 'X', type: 'Unit', text: 'While you control another Villainy unit, this unit gets +2/+0.' });
  assertEq(r.coverage, 'full', 'coverage');
  const a = r.abilities[0];
  if (a.type !== 'constant') throw new Error('expected constant');
  const cc = (a.while as { controller_controls?: { filter?: { card_aspect?: string }; exclude_self?: boolean } }).controller_controls;
  assertEq(cc?.filter?.card_aspect, 'villainy', 'gated on a Villainy unit');
  assertEq(cc?.exclude_self, true, '"another" excludes this unit');
  assertEq(a.grant.modifier!.power, 2, '+2 power');
});

scenario('Matcher: "While you control a Vehicle unit, this unit gains Sentinel." → controls gate (no exclude_self), keyword', () => {
  const r = matchCard({ name: 'X', type: 'Unit', text: 'While you control a Vehicle unit, this unit gains Sentinel.' });
  assertEq(r.coverage, 'full', 'coverage');
  const a = r.abilities[0];
  if (a.type !== 'constant') throw new Error('expected constant');
  const cc = (a.while as { controller_controls?: { filter?: { card_trait?: string }; exclude_self?: boolean } }).controller_controls;
  assertEq(cc?.filter?.card_trait, 'vehicle', 'gated on a Vehicle unit (trait)');
  if (cc?.exclude_self) throw new Error('"a" (not "another") includes this unit');
  assertEq(a.grant.modifier!.keyword, 'sentinel', 'grants Sentinel');
});

scenario('Matcher: "Exhaust a unit in attached unit\'s arena." → host_arena-scoped exhaust (Nimble Prowess)', () => {
  const r = matchCard({ name: 'Nimble Prowess', type: 'Upgrade', text: "When Played: You may exhaust a unit in attached unit's arena." });
  assertEq(r.coverage, 'full', 'coverage');
  const inner = (r.abilities[0] as { do: { effect: string; do?: { effect: string; target: { zone?: string } } } }).do;
  assertEq(inner.effect, 'optional', '"you may" → optional');
  assertEq(inner.do?.effect, 'exhaust', 'exhaust');
  assertEq(inner.do?.target.zone, 'host_arena', 'scoped to the host\'s arena');
});

scenario('Matcher: The Darksaber — both clauses (Sentinel grant + When-Played conditional ready) → full', () => {
  const r = matchCard({ name: 'The Darksaber', type: 'Upgrade', text: 'Attach to a non-Vehicle unit.\nAttached unit gains Sentinel.\nWhen Played: If there are 4 or more different keywords among friendly units, ready attached unit.' });
  assertEq(r.coverage, 'full', 'whole card covered');
  assertEq(r.abilities.length, 2, 'two abilities');
  const wp = r.abilities.find(a => a.type === 'triggered');
  if (!wp || wp.type !== 'triggered' || wp.do.effect !== 'if') throw new Error('When-Played is an if');
  const cond = (wp.do as { condition: { controller_distinct_keywords?: { min?: number } } }).condition;
  assertEq(cond.controller_distinct_keywords?.min, 4, 'gated on 4+ distinct keywords');
  const then = (wp.do as { then: { effect: string; target: object } }).then;
  assertEq(then.effect, 'ready', 'then = ready');
  if (!('attached_to_self' in then.target)) throw new Error('readies the host');
});

scenario('Matcher: Death Star Plans — both clauses (when-attacked upgrade transfer + granted round-discount) → full', () => {
  const r = matchCard({ name: 'Death Star Plans', type: 'Upgrade', text: 'When attached unit is attacked: The attacking player takes control of this upgrade and attaches it to a unit they control.\nAttached unit gains: “The first unit you play each round costs 2 resources less.”' });
  assertEq(r.coverage, 'full', 'whole card covered');
  assertEq(r.abilities.length, 2, 'two abilities');
  const trig = r.abilities.find(a => a.type === 'triggered');
  if (!trig || trig.type !== 'triggered') throw new Error('expected a triggered ability');
  assertEq(trig.on, 'event.attack_declared', 'fires when attacked');
  assertEq((trig.where as { defender?: string }).defender, 'host', 'host is the defender');
  assertEq(trig.do.effect, 'transfer_upgrade', 'transfers the upgrade');
  const grant = r.abilities.find(a => a.type === 'constant');
  if (!grant || grant.type !== 'constant' || !grant.grant.abilities) throw new Error('expected constant grant.abilities');
  const g = grant.grant.abilities[0];
  if (g.type !== 'round_discount') throw new Error('granted a round_discount');
  assertEq(g.amount, 2, 'discount 2');
  assertEq(g.card_type, 'unit', 'units only');
});

scenario('Matcher: "When Played: Name a card. While this unit is in play, opponents can\'t play the named card." → name_card (Regional Governor)', () => {
  const r = matchCard({ name: 'Regional Governor', type: 'Unit', text: "When Played: Name a card. While this unit is in play, opponents can't play the named card." });
  assertEq(r.coverage, 'full', 'whole card covered');
  const a = r.abilities[0];
  if (a.type !== 'triggered' || a.on !== 'event.card_played') throw new Error('expected a When-Played trigger');
  assertEq(a.do.effect, 'name_card', 'names a card');
});

scenario('Matcher: "If you control a leader unit, create 2 Spy tokens and give those tokens Sentinel for this phase." → if-on-leader-unit + create_token grant (Chancellor Palpatine)', () => {
  const r = matchCard({ name: 'Chancellor Palpatine', type: 'Unit', text: 'When Played: If you control a leader unit, create 2 Spy tokens and give those tokens Sentinel for this phase.' });
  assertEq(r.coverage, 'full', 'whole clause covered');
  const a = r.abilities[0];
  if (a.type !== 'triggered' || a.do.effect !== 'if') throw new Error('expected a When-Played if');
  const cond = (a.do as { condition: { controller_controls?: { filter?: { card_is_leader_unit?: boolean } } } }).condition;
  if (cond.controller_controls?.filter?.card_is_leader_unit !== true) throw new Error('gated on controlling a leader unit');
  const then = (a.do as { then: { effect: string; count?: number; grant?: { keyword?: string; duration?: string } } }).then;
  assertEq(then.effect, 'create_token', 'creates tokens');
  assertEq(then.count, 2, 'two tokens');
  assertEq(then.grant?.keyword, 'sentinel', 'granted Sentinel');
  assertEq(then.grant?.duration, 'end_of_phase', 'for this phase');
});

scenario('Matcher: Condemn — while-attacking grant (disclose → -6/-0) + loses all other abilities → full', () => {
  const r = matchCard({ name: 'Condemn', type: 'Upgrade', text: 'While attached unit is attacking, it gains: “On Attack: The defending player may disclose VigilanceVillainy. If they do, this unit gets –6/–0 for this attack” and loses all other abilities.' });
  assertEq(r.coverage, 'full', 'whole card covered');
  const a = r.abilities[0];
  if (a.type !== 'constant' || !a.while_attacking) throw new Error('expected a while_attacking constant');
  if (!a.grant.modifier?.lose_all_abilities) throw new Error('grants lose_all_abilities');
  const g = a.grant.abilities?.[0];
  if (!g || g.type !== 'triggered' || g.on !== 'event.attack_declared') throw new Error('granted On-Attack ability');
  if (g.do.effect !== 'if_did') throw new Error('On-Attack body is if_did(disclose, give)');
  const giveMod = (g.do as { then?: { effect: string; modifier?: { power?: number; duration?: string } } }).then;
  assertEq(giveMod?.modifier?.power, -6, 'gives -6 power');
  assertEq(giveMod?.modifier?.duration, 'end_of_attack', 'for this attack');
});

scenario('Matcher: "Attached unit gains: \'Bounty — Draw 2 cards.\'" → grants an opponent-controlled bounty (Death Mark)', () => {
  const r = matchCard({ name: 'Death Mark', type: 'Upgrade', text: 'Attached unit gains: “Bounty — Draw 2 cards.”' });
  assertEq(r.coverage, 'full', 'coverage');
  const a = r.abilities[0];
  if (a.type !== 'constant' || !a.grant.abilities) throw new Error('expected granted ability');
  const g = a.grant.abilities[0];
  if (g.type !== 'triggered' || g.on !== 'event.defeated') throw new Error('granted When-Defeated bounty');
  assertEq((g as { controlled_by?: string }).controlled_by, 'opponent', 'bounty is opponent-resolved');
});

scenario('Matcher: "Attached unit gains Restore 2." → unconditional keyword grant w/ value (Devotion)', () => {
  const r = matchCard({ name: 'Devotion', type: 'Upgrade', text: 'Attach to a non-Vehicle unit.\nAttached unit gains Restore 2.' });
  assertEq(r.coverage, 'full', 'coverage');
  const a = r.abilities[0];
  if (a.type !== 'constant' || !a.grant.modifier) throw new Error('expected constant grant.modifier');
  assertEq(a.grant.modifier.keyword, 'restore', 'grants restore');
  assertEq(a.grant.modifier.keyword_value, 2, 'value 2');
  if (!('attached_to_self' in a.grant.target) || (a.grant.target as { filter?: unknown }).filter) throw new Error('unconditional (no host filter)');
});

scenario('Matcher: "Attached unit gains the Mandalorian trait." stays residual (trait grant not modeled)', () => {
  const r = matchCard({ name: 'Foundling', type: 'Upgrade', text: 'Attached unit gains the Mandalorian trait.' });
  if (r.coverage === 'full') throw new Error('trait grants are not a keyword grant — must stay residual');
});

scenario('Matcher: "If attached unit is a Sith, it gains Grit." → host-gated keyword grant (Darth Revan\'s Lightsabers)', () => {
  const r = matchCard({ name: "Darth Revan's Lightsabers", type: 'Upgrade', text: 'Attach to a non-Vehicle unit.\nIf attached unit is a Sith, it gains Grit.' });
  assertEq(r.coverage, 'full', 'coverage');
  const a = r.abilities[0];
  if (a.type !== 'constant' || !a.grant.modifier) throw new Error('expected constant grant.modifier');
  assertEq(a.grant.modifier.keyword, 'grit', 'grants grit');
  const tgt = a.grant.target as { attached_to_self?: boolean; filter?: { card_trait?: string } };
  if (!tgt.attached_to_self || tgt.filter?.card_trait !== 'sith') throw new Error('host gated on Sith trait');
});

scenario('Matcher: Constructed Lightsaber → 3 aspect-gated keyword grants incl. valued + negated', () => {
  const r = matchCard({ name: 'Constructed Lightsaber', type: 'Upgrade', text: 'Attach to a Force unit.\nIf attached unit is a Heroism unit, it gains Restore 2.\nIf attached unit is a Villainy unit, it gains Raid 2.\nIf attached unit is a non-Heroism, non-Villainy unit, it gains Sentinel.' });
  assertEq(r.coverage, 'full', 'coverage');
  assertEq(r.abilities.length, 3, 'three conditional grants');
  const restore = r.abilities[0];
  if (restore.type !== 'constant' || restore.grant.modifier?.keyword !== 'restore' || restore.grant.modifier?.keyword_value !== 2) throw new Error('Restore 2 (valued)');
  const sentinel = r.abilities[2];
  if (sentinel.type !== 'constant') throw new Error('expected constant');
  const f = (sentinel.grant.target as { filter?: { and?: unknown[] } }).filter;
  if (!f?.and || f.and.length !== 2) throw new Error('non-Heroism, non-Villainy → and of two negations');
});

scenario('Matcher: "Attached unit gains: \'On Attack: Exhaust the defender.\'" → granted exhaust trigger_defender (Vambrace Grappleshot)', () => {
  const r = matchCard({ name: 'Vambrace Grappleshot', type: 'Upgrade', text: 'Attach to a non-Vehicle unit.\nAttached unit gains: “On Attack: Exhaust the defender.”' });
  assertEq(r.coverage, 'full', 'coverage');
  const a = r.abilities[0];
  if (a.type !== 'constant' || !a.grant.abilities) throw new Error('expected constant grant.abilities');
  const g = a.grant.abilities[0];
  if (g.type !== 'triggered' || g.do.effect !== 'exhaust') throw new Error('granted exhaust');
  if (!('trigger_defender' in (g.do as { target: object }).target)) throw new Error('targets the defender');
});

scenario('Matcher: "Search the top 10 cards … for any number of [Villainy] units with combined cost 3 or less and play each for free." → search_play (Darth Vader)', () => {
  const r = matchCard({ name: 'Darth Vader', type: 'Unit', text: 'Ambush\n\nWhen Played: Search the top 10 cards of your deck for any number of [Villainy] units with combined cost 3 or less and play each of them for free.' });
  assertEq(r.coverage, 'full', 'coverage (Ambush keyword + search_play clause)');
  const a = r.abilities.find(x => x.type === 'triggered');
  if (!a || a.type !== 'triggered' || a.do.effect !== 'search_play') throw new Error('expected search_play');
  const d = a.do as { count?: number; max_combined_cost?: number; filter?: { and?: Array<{ card_aspect?: string }> } };
  assertEq(d.count, 10, 'top 10');
  assertEq(d.max_combined_cost, 3, 'combined cost ≤ 3');
  if (!d.filter?.and?.some(p => p.card_aspect === 'villainy')) throw new Error('filtered to Villainy units');
});

scenario('Matcher: "Attack with a unit. It gets +2/+0 and gains Overwhelm for this attack." → attack w/ chosen ready attacker + attacker_buff', () => {
  const r = matchCard({ name: 'X', type: 'Event', text: 'Attack with a unit. It gets +2/+0 and gains Overwhelm for this attack.' });
  assertEq(r.coverage, 'full', 'coverage');
  const d = (r.abilities[0] as { do: { effect: string; attacker?: { controller?: string; filter?: { self_exhausted?: boolean } }; attacker_buff?: { power?: number; keyword?: string } } }).do;
  assertEq(d.effect, 'attack', 'attack effect');
  assertEq(d.attacker?.controller, 'self', 'choose a friendly unit');
  assertEq(d.attacker?.filter?.self_exhausted, false, 'must be a ready unit');
  assertEq(d.attacker_buff?.power, 2, '+2 power for this attack');
  assertEq(d.attacker_buff?.keyword, 'overwhelm', 'gains Overwhelm');
});

scenario('Matcher: "You may attack with a unit." → optional attack', () => {
  const opt = matchCard({ name: 'X', type: 'Event', text: 'You may attack with a unit.' });
  assertEq(opt.coverage, 'full', 'bare optional attack matches');
  if ((opt.abilities[0] as { do: { effect: string } }).do.effect !== 'optional') throw new Error('"You may" → optional');
});

scenario('Matcher: "Attack with a unit. If it\'s an Imperial unit, it gets +2/+0 for this attack." → conditional attacker buff (Snowtrooper Lieutenant)', () => {
  const r = matchCard({ name: 'Snowtrooper Lieutenant', type: 'Event', text: "Attack with a unit. If it's an Imperial unit, it gets +2/+0 for this attack." });
  assertEq(r.coverage, 'full', 'coverage');
  const d = (r.abilities[0] as { do: { attacker_buff?: { power?: number }; attacker_buff_if?: { card_trait?: string } } }).do;
  assertEq(d.attacker_buff?.power, 2, '+2 power buff');
  assertEq(d.attacker_buff_if?.card_trait, 'imperial', 'gated on the attacker being Imperial');
});

scenario('Matcher: "Attack with a unit. The defender gets –4/–0 for this attack." → attack w/ defender_debuff (Catch Unawares)', () => {
  const r = matchCard({ name: 'Catch Unawares', type: 'Event', text: 'Attack with a unit. The defender gets –4/–0 for this attack.' });
  assertEq(r.coverage, 'full', 'coverage (en-dash debuff)');
  const d = (r.abilities[0] as { do: { effect: string; defender_debuff?: { power?: number } } }).do;
  assertEq(d.effect, 'attack', 'attack effect');
  assertEq(d.defender_debuff?.power, -4, 'defender -4 power for this attack');
});

scenario('Matcher: "If it\'s attacking a unit …" (defender condition) stays residual', () => {
  // The "If it's a/an <noun>" attacker-identity form is handled; "If it's
  // attacking …" is a defender condition we don't model → residual.
  const cond = matchCard({ name: 'Y', type: 'Event', text: "Attack with a unit. If it's attacking a unit, it gets +2/+0 for this attack." });
  if (cond.coverage === 'full') throw new Error('defender-condition attack buff is not modeled — must stay residual');
});

scenario('Matcher: damage-target batch — "a base" (chosen), "your base", "each base", "this unit", "each ground unit"', () => {
  const ab = matchCard({ name: 'X', type: 'Event', text: 'Deal 2 damage to a base.' });
  assertEq(ab.coverage, 'full', 'a base');
  if (!('chosen_base' in ((ab.abilities[0] as { do: { target: object } }).do.target))) throw new Error('a base → chosen_base');
  const yb = matchCard({ name: 'X', type: 'Event', text: 'Deal 1 damage to your base.' });
  if (!('self_base' in ((yb.abilities[0] as { do: { target: object } }).do.target))) throw new Error('your base → self_base');
  const eb = matchCard({ name: 'X', type: 'Event', text: 'Deal 1 damage to each base.' });
  assertEq((eb.abilities[0] as { do: { effect: string } }).do.effect, 'sequence', 'each base → both bases');
  const tu = matchCard({ name: 'X', type: 'Unit', text: 'On Attack: Deal 2 damage to this unit.' });
  if (!('self' in ((tu.abilities[0] as { do: { target: object } }).do.target))) throw new Error('this unit → self');
  const eg = matchCard({ name: 'X', type: 'Event', text: 'Deal 1 damage to each ground unit.' });
  assertEq((eg.abilities[0] as { do: { target: { zone?: string } } }).do.target.zone, 'ground_arena', 'each ground unit → ground arena AOE');
});

scenario('Matcher: "Deal 2 damage to a friendly ground unit and 2 damage to an enemy ground unit." → sequence of two damages (Death Trooper)', () => {
  const r = matchCard({ name: 'Death Trooper', type: 'Unit', text: 'When Played: Deal 2 damage to a friendly ground unit and 2 damage to an enemy ground unit.' });
  assertEq(r.coverage, 'full', 'coverage');
  const a = r.abilities[0];
  if (a.type !== 'triggered' || a.do.effect !== 'sequence') throw new Error('expected sequence');
  const steps = (a.do as { steps: Array<{ effect: string; amount?: number; target: { controller?: string; zone?: string } }> }).steps;
  assertEq(steps.length, 2, 'two damage steps');
  assertEq(steps[0].target.controller, 'self', 'first hits a friendly');
  assertEq(steps[1].target.controller, 'opponent', 'second hits an enemy');
  assertEq(steps[0].target.zone, 'ground_arena', 'ground-scoped');
});

scenario('Matcher: "This unit gets +1/+0 for each Trooper unit in your discard pile." → per controller_discard_units (Captain Enoch)', () => {
  const r = matchCard({ name: 'Captain Enoch', type: 'Unit', text: 'This unit gets +1/+0 for each Trooper unit in your discard pile.' });
  assertEq(r.coverage, 'full', 'coverage');
  const a = r.abilities[0];
  if (a.type !== 'constant' || !a.grant.modifier?.per) throw new Error('expected per-X modifier');
  const per = a.grant.modifier.per as { count?: string; power?: number; filter?: { card_trait?: string } };
  assertEq(per.count, 'controller_discard_units', 'counts units in discard');
  assertEq(per.power, 1, '+1 power each');
  assertEq(per.filter?.card_trait, 'trooper', 'restricted to Troopers');
});

scenario('Matcher: "When another unique unit is defeated: You may draw a card. Use this ability only once each round." → unique-defeat trigger + once_per_round (Agent Kallus)', () => {
  const r = matchCard({ name: 'Agent Kallus', type: 'Unit', text: 'When another unique unit is defeated: You may draw a card. Use this ability only once each round.' });
  assertEq(r.coverage, 'full', 'coverage');
  const a = r.abilities[0];
  if (a.type !== 'triggered' || a.on !== 'event.defeated') throw new Error('expected When-Defeated trigger');
  assertEq(a.limit, 'once_per_round', 'once-per-round limit parsed from the suffix');
  const w = a.where as { and?: Array<{ card_is_unique?: boolean; not?: { card?: string } }> };
  if (!w.and || w.and[0].card_is_unique !== true || w.and[1].not?.card !== 'self') throw new Error('where = unique AND not self');
  if (a.do.effect !== 'optional') throw new Error('"You may" → optional draw');
});

scenario('Matcher: multi-line "Play a unit from your discard pile. It costs 6 less. If Force, 8 less." → play_from_discard (Palpatine\'s Return)', () => {
  const r = matchCard({ name: "Palpatine's Return", type: 'Event', text: "Play a unit from your discard pile. \nIt costs 6 resources less. If it's a Force unit, \nit costs 8 resources less instead." });
  assertEq(r.coverage, 'full', 'coverage (whitespace-flattened whole text)');
  const a = r.abilities[0];
  if (a.type !== 'triggered' || a.do.effect !== 'play_from_discard') throw new Error('expected play_from_discard');
  const d = a.do as { cost_reduction?: number; cost_reduction_if?: { amount?: number; filter?: { card_trait?: string } } };
  assertEq(d.cost_reduction, 6, '6 less normally');
  assertEq(d.cost_reduction_if?.amount, 8, '8 less if Force');
  assertEq(d.cost_reduction_if?.filter?.card_trait, 'force', 'conditional on the Force trait');
});

scenario('Matcher: "Choose a friendly non-leader unit and an enemy non-leader unit. Exchange control of those units." → exchange_control (Choose Sides)', () => {
  const r = matchCard({ name: 'Choose Sides', type: 'Event', text: 'Choose a friendly non-leader unit and an enemy non-leader unit. Exchange control of those units.' });
  assertEq(r.coverage, 'full', 'coverage');
  const a = r.abilities[0];
  if (a.type !== 'triggered' || a.do.effect !== 'exchange_control') throw new Error('expected exchange_control');
  const e = a.do as { friendly: { controller?: string }; enemy: { controller?: string } };
  assertEq(e.friendly.controller, 'self', 'friendly = your unit');
  assertEq(e.enemy.controller, 'opponent', 'enemy = their unit');
});

scenario('Matcher: "An opponent chooses a unit they control. Defeat that unit." → defeat opponent_choose (Power of the Dark Side)', () => {
  const r = matchCard({ name: 'Power of the Dark Side', type: 'Event', text: 'An opponent chooses a unit they control. Defeat that unit.' });
  assertEq(r.coverage, 'full', 'coverage');
  const a = r.abilities[0];
  if (a.type !== 'triggered' || a.do.effect !== 'defeat') throw new Error('expected defeat');
  const tgt = (a.do as { target: { controller?: string; selector?: string } }).target;
  assertEq(tgt.controller, 'opponent', 'targets opponent units');
  assertEq(tgt.selector, 'opponent_choose', 'opponent chooses which dies');
});

scenario('Matcher: When-Defeated "put this unit into play as a resource and ready it" → optional play_as_resource ready (Superlaser Technician)', () => {
  const r = matchCard({ name: 'Superlaser Technician', type: 'Unit', text: 'When Defeated: You may put this unit into play as a resource and ready it.' });
  assertEq(r.coverage, 'full', 'coverage');
  const a = r.abilities[0];
  if (a.type !== 'triggered' || a.on !== 'event.defeated') throw new Error('expected When-Defeated trigger');
  if (a.do.effect !== 'optional') throw new Error('"You may" → optional');
  const inner = (a.do as { do: { effect: string; ready?: boolean } }).do;
  assertEq(inner.effect, 'play_as_resource', 'inner play_as_resource');
  assertEq(inner.ready, true, '"and ready it" → ready: true');
});

scenario('Matcher: "When a friendly unit attacks and defeats a unit: You may give Experience to that friendly unit"', () => {
  const r = matchCard({ name: 'Darth Revan', type: 'Unit', text: 'When a friendly unit attacks and defeats a unit: You may give an Experience token to that friendly unit.' });
  assertEq(r.coverage, 'full', 'coverage');
  const a = r.abilities[0] as { type: string; on?: string; where?: { controller?: string; defender_defeated?: boolean }; do: { effect: string; do?: { effect: string; target?: { trigger_source?: boolean } } } };
  if (a.type !== 'triggered' || a.on !== 'event.attack_ended') throw new Error('expected attack_ended trigger');
  if (a.where?.controller !== 'self' || a.where?.defender_defeated !== true) throw new Error('expected friendly + defender_defeated');
  if (a.do.effect !== 'optional' || a.do.do?.effect !== 'give_experience' || !a.do.do?.target?.trigger_source) {
    throw new Error('expected optional → give_experience to trigger_source');
  }
});

scenario('Matcher: leader "You may exhaust this leader. If you do, give Experience to that friendly unit"', () => {
  const r = matchCard({ name: 'Darth Revan', type: 'Unit', text: 'When a friendly unit attacks and defeats a unit: You may exhaust this leader. If you do, give an Experience token to that friendly unit.' });
  assertEq(r.coverage, 'full', 'coverage');
  const a = r.abilities[0] as { type: string; on?: string; do: { effect: string; do?: { effect: string; do?: { effect: string; target?: { self?: boolean } }; then?: { effect: string; target?: { trigger_source?: boolean } } } } };
  if (a.type !== 'triggered' || a.on !== 'event.attack_ended') throw new Error('expected attack_ended trigger');
  if (a.do.effect !== 'optional') throw new Error('expected optional wrapper');
  const ifdid = a.do.do;
  if (ifdid?.effect !== 'if_did') throw new Error('expected if_did inside optional');
  if (ifdid.do?.effect !== 'exhaust' || !ifdid.do?.target?.self) throw new Error('expected exhaust self as the cost');
  if (ifdid.then?.effect !== 'give_experience' || !ifdid.then?.target?.trigger_source) throw new Error('expected then: give_experience to trigger_source');
});

scenario('Matcher: "Bounty — Draw a card." → opponent-controlled When-Defeated trigger', () => {
  const r = matchCard({ name: 'Cartel Turncoat', type: 'Unit', text: 'Bounty — Draw a card. (When this unit is defeated or captured, your opponent collects its bounty.)' });
  assertEq(r.coverage, 'full', 'coverage');
  const a = r.abilities[0] as { type: string; on?: string; where?: { card?: string }; controlled_by?: string; do: { effect: string; do?: { effect: string } } };
  if (a.type !== 'triggered' || a.on !== 'event.defeated') throw new Error('expected when-defeated trigger');
  if (a.where?.card !== 'self') throw new Error('expected where card:self');
  if (a.controlled_by !== 'opponent') throw new Error('expected controlled_by opponent');
  if (a.do.effect !== 'optional' || a.do.do?.effect !== 'draw') throw new Error('expected optional → draw');
});

scenario('Matcher: "deals damage equal to his power to an enemy ground unit" → amountFromPower', () => {
  const r = matchCard({ name: 'Crosshair', type: 'Unit', text: 'Action [Exhaust]: This unit deals damage equal to his power to an enemy ground unit.' });
  assertEq(r.coverage, 'full', 'coverage');
  const a = r.abilities[0];
  if (a.type !== 'action') throw new Error('expected action ability');
  if (a.do.effect !== 'damage') throw new Error('expected damage effect');
  const dmg = a.do as { amount?: number; amountFromPower?: { self?: boolean }; target: { zone?: string; controller?: string } };
  if (dmg.amount !== undefined) throw new Error('should NOT have a fixed amount');
  if (!dmg.amountFromPower?.self) throw new Error('expected amountFromPower: { self: true }');
  assertEq(dmg.target.zone, 'ground_arena', 'targets ground arena');
  assertEq(dmg.target.controller, 'opponent', 'targets enemy');
});

scenario('Matcher: modal "Choose two, in any order:" → choose_one count 2', () => {
  const r = matchCard({ name: 'Z', type: 'Event', text: 'Choose two, in any order:\n\nDraw a card.\nDeal 2 damage to an enemy unit.\nGive an enemy unit -1/-1 for this phase.' });
  assertEq(r.coverage, 'full', 'coverage');
  const a = r.abilities[0];
  if (a.type !== 'triggered' || a.do.effect !== 'choose_one') throw new Error('expected when-played choose_one');
  const m = a.do as { count?: number; options: unknown[] };
  assertEq(m.count, 2, 'count 2');
  assertEq(m.options.length, 3, 'three modes');
});

scenario('Matcher: modal with an unparseable mode stays residual (no partial misfire)', () => {
  // A modal with ANY unmodeled mode must NOT match (else the card would wrongly
  // fire the parseable modes unconditionally). "An opponent reveals their hand"
  // is not templated.
  const r = matchCard({ name: 'W', type: 'Event', text: 'Choose one:\nDraw a card.\nAn opponent reveals their hand.' });
  assertEq(r.coverage, 'none', 'coverage none');
  assertEq(r.abilities.length, 0, 'no abilities emitted');
});

scenario('Matcher: modal option with a parenthetical reminder still parses (Shatterpoint)', () => {
  // The "Use the Force (lose your Force token)." reminder must be stripped per
  // option, exactly as the normal clause path does — otherwise the unparsed
  // mode voids the whole modal and the card silently does nothing (playtest bug).
  const r = matchCard({ name: 'Shatterpoint', type: 'Event', text:
    'Choose one:\nDefeat a non-leader unit with 3 or less remaining HP.\nUse the Force (lose your Force token). If you do, defeat a non-leader unit.' });
  assertEq(r.coverage, 'full', 'coverage full despite reminder');
  const a = r.abilities[0];
  if (a.type !== 'triggered' || a.do.effect !== 'choose_one') throw new Error('expected choose_one');
  const m = a.do as { options: Array<{ do: { effect: string } }> };
  assertEq(m.options.length, 2, 'two modes');
  assertEq(m.options[0].do.effect, 'defeat', 'mode 0 = defeat');
  assertEq(m.options[1].do.effect, 'use_force', 'mode 1 = use_force (reminder stripped)');
});

scenario('Matcher: "Return a non-leader unit that costs N or less to its owner\'s hand" → return_to_hand', () => {
  const r = matchCard({ name: 'X', type: 'Event', text: "Return a non-leader unit that costs 3 or less to its owner's hand." });
  assertEq(r.coverage, 'full', 'coverage');
  const a = r.abilities[0];
  if (a.type !== 'triggered' || a.do.effect !== 'return_to_hand') throw new Error('expected when-played return_to_hand');
  const tgt = (a.do as { target: { controller?: string; filter?: unknown } }).target;
  assertEq(tgt.controller, 'any', 'any controller (you choose)');
  if (!tgt.filter) throw new Error('expected a non-leader + cost filter');
});

scenario('Matcher: "Deal N damage to each of up to M units" → up-to-M chosen', () => {
  const r = matchCard({ name: 'X', type: 'Event', text: 'Deal 2 damage to each of up to 3 units.' });
  assertEq(r.coverage, 'full', 'coverage');
  const d = (r.abilities[0] as { do: { effect: string; amount?: number; target: { count?: unknown } } }).do;
  assertEq(d.effect, 'damage', 'damage');
  assertEq(d.amount, 2, 'amount 2');
  assertEq(JSON.stringify(d.target.count), JSON.stringify({ min: 0, max: 3 }), 'up to 3');
});

scenario('Matcher: "Give a Shield token to a friendly unit and to an enemy unit" → sequence of two', () => {
  const r = matchCard({ name: 'X', type: 'Event', text: 'Give a Shield token to a friendly unit and to an enemy unit.' });
  assertEq(r.coverage, 'full', 'coverage');
  const d = (r.abilities[0] as { do: { effect: string; steps?: Array<{ effect: string; target: { controller?: string } }> } }).do;
  assertEq(d.effect, 'sequence', 'sequence');
  assertEq(d.steps?.length, 2, 'two shield grants');
  assertEq(d.steps?.[0].target.controller, 'self', 'first → friendly');
  assertEq(d.steps?.[1].target.controller, 'opponent', 'second → enemy');
});

scenario('Matcher: "Create N <Token> tokens" → create_token (unit tokens only)', () => {
  const r = matchCard({ name: 'X', type: 'Event', text: 'Create 2 Clone Trooper tokens.' });
  assertEq(r.coverage, 'full', 'coverage');
  const d = (r.abilities[0] as { do: { effect: string; token_id?: string; zone?: string; count?: number } }).do;
  assertEq(d.effect, 'create_token', 'create_token');
  assertEq(d.token_id, 'clone_trooper', 'token key');
  assertEq(d.zone, 'ground_arena', 'ground arena from token spec');
  assertEq(d.count, 2, 'count 2');
  // Space token routes to space arena.
  const x = matchCard({ name: 'Y', type: 'Event', text: 'Create an X-Wing token.' });
  assertEq((x.abilities[0] as { do: { zone?: string } }).do.zone, 'space_arena', 'X-Wing → space');
  // Unknown token → residual, not a broken create_token.
  const unk = matchCard({ name: 'Z', type: 'Event', text: 'Create 2 Stormtrooper tokens.' });
  assertEq(unk.coverage, 'none', 'unknown token stays residual');
});

scenario('Matcher: "Defeat a unit with N or less remaining HP" → remaining_hp filter', () => {
  const r = matchCard({ name: 'X', type: 'Event', text: 'Defeat a unit with 3 or less remaining HP.' });
  assertEq(r.coverage, 'full', 'coverage');
  const d = (r.abilities[0] as { do: { effect: string; target: { filter?: { remaining_hp?: { max?: number } } } } }).do;
  assertEq(d.effect, 'defeat', 'defeat');
  assertEq(d.target.filter?.remaining_hp?.max, 3, 'remaining_hp max 3');
});

scenario('Matcher: "When an enemy unit is defeated: deal N to its controller\'s base" → defeat trigger + contextual base', () => {
  const r = matchCard({ name: 'X', type: 'Unit', text: "When an enemy unit is defeated: Deal 2 damage to its controller's base." });
  assertEq(r.coverage, 'full', 'coverage');
  const a = r.abilities[0] as { type: string; on?: string; where?: { controller?: string }; do: { effect: string; amount?: number; target: Record<string, unknown> } };
  assertEq(a.type, 'triggered', 'triggered');
  assertEq(a.on, 'event.defeated', 'on defeated');
  assertEq(a.where?.controller, 'opponent', 'enemy-defeat filter');
  assertEq(a.do.effect, 'damage', 'damage');
  assertEq(JSON.stringify(a.do.target), JSON.stringify({ trigger_controller_base: true }), 'contextual base target');
});

scenario('Matcher: "Use the Force … If you do, X" → use_force(X); "The Force is with you" → gain_force', () => {
  const use = matchCard({ name: 'X', type: 'Event', text: 'Use the Force (lose your Force token). If you do, deal 3 damage to a unit.' });
  assertEq(use.coverage, 'full', 'use coverage');
  const ud = (use.abilities[0] as { do: { effect: string; do?: { effect: string } } }).do;
  assertEq(ud.effect, 'use_force', 'use_force');
  assertEq(ud.do?.effect, 'damage', 'inner effect parsed');
  const gain = matchCard({ name: 'Y', type: 'Event', text: 'The Force is with you (create your Force token).' });
  assertEq(gain.coverage, 'full', 'gain coverage');
  assertEq((gain.abilities[0] as { do: { effect: string } }).do.effect, 'gain_force', 'gain_force');
});

scenario('Matcher: Focus Fire + Maximum Firepower → power_damage_from_each', () => {
  const ff = matchCard({ name: 'Focus Fire', type: 'Event', text: 'Choose a unit. Each friendly Vehicle unit in the same arena deals damage equal to its power to that unit.' });
  assertEq(ff.coverage, 'full', 'focus fire coverage');
  const fd = (ff.abilities[0] as { do: { effect: string; sources_same_arena_as_target?: boolean; sources: { filter?: { card_trait?: string } } } }).do;
  assertEq(fd.effect, 'power_damage_from_each', 'effect');
  assertEq(fd.sources_same_arena_as_target, true, 'same-arena flag');
  assertEq(fd.sources.filter?.card_trait, 'vehicle', 'vehicle sources');

  const mf = matchCard({ name: 'Maximum Firepower', type: 'Event', text: 'A friendly Imperial unit deals damage equal to its power to a unit.\n\nThen, another friendly Imperial unit deals damage equal to its power to the same unit.' });
  assertEq(mf.coverage, 'full', 'max firepower coverage');
  const md = (mf.abilities[0] as { do: { effect: string; sources: { count?: number; filter?: { card_trait?: string } } } }).do;
  assertEq(md.effect, 'power_damage_from_each', 'effect');
  assertEq(md.sources.count, 2, 'two chosen sources');
  assertEq(md.sources.filter?.card_trait, 'imperial', 'imperial sources');
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

scenario('Matcher: "Action [Exhaust, deal 1 damage to a friendly unit]: Draw a card." → action w/ damage cost (Doctor Pershing)', () => {
  const r = matchCard({ name: 'Doctor Pershing', type: 'Unit', text: 'Action [Exhaust, deal 1 damage to a friendly unit]: Draw a card.' });
  assertEq(r.coverage, 'full', 'coverage');
  const a = r.abilities[0];
  if (a.type !== 'action') throw new Error('expected action ability');
  if (!a.cost?.exhaust) throw new Error('exhaust cost');
  const dmg = (a.cost as { damage?: { amount?: number; target?: { controller?: string } } }).damage;
  assertEq(dmg?.amount, 1, 'deal 1 damage cost');
  assertEq(dmg?.target?.controller, 'self', 'to a friendly unit');
  if (a.do.effect !== 'draw') throw new Error('draw a card');
});

scenario('Matcher: a genuinely uninterpretable action cost still → residual', () => {
  // A cost component we don't model (e.g. "reveal your hand") must leave the
  // action residual rather than silently dropping the cost.
  const r = matchCard({ name: 'X', type: 'Unit', text: 'Action [Exhaust, reveal your hand]: Draw a card.' });
  if (r.coverage === 'full') throw new Error('should not fully match an uninterpretable cost');
});

scenario('Matcher: Piett "Each friendly non-leader unit that costs 6 or more gains Ambush." → keyword aura', () => {
  const r = matchCard({ name: 'X', type: 'Unit', text: 'Each friendly non-leader unit that costs 6 or more gains Ambush.' });
  assertEq(r.coverage, 'full', 'coverage');
  const a = r.abilities[0];
  if (a.type !== 'constant') throw new Error('expected constant');
  assertEq(a.grant.modifier!.keyword, 'ambush', 'grants ambush');
});

scenario('Matcher: Shoretrooper "While you control 6 or more resources, this unit gets +2/+0." → resource-count gate', () => {
  const r = matchCard({ name: 'X', type: 'Unit', text: 'While you control 6 or more resources, this unit gets +2/+0.' });
  assertEq(r.coverage, 'full', 'coverage');
  const a = r.abilities[0];
  if (a.type !== 'constant' || !a.while || !('controller_resource_count' in a.while)) throw new Error('expected resource-count gate');
});


scenario('Matcher: 97th Legion "This unit gets +1/+1 for each resource you control." → per-X scaling', () => {
  const r = matchCard({ name: 'X', type: 'Unit', text: 'This unit gets +1/+1 for each resource you control.' });
  assertEq(r.coverage, 'full', 'coverage');
  const a = r.abilities[0];
  if (a.type !== 'constant' || a.grant.modifier!.per?.count !== 'controller_resources') throw new Error('expected per controller_resources');
});

scenario('Matcher: Crosshair "Action [2 resources]: This unit gets +1/+0 for this phase." → action self-buff', () => {
  const r = matchCard({ name: 'X', type: 'Unit', text: 'Action [2 resources]: This unit gets +1/+0 for this phase.' });
  assertEq(r.coverage, 'full', 'coverage');
  const a = r.abilities[0];
  if (a.type !== 'action' || a.do.effect !== 'give') throw new Error('expected action give self-buff');
  assertEq((a.cost as { resources?: number }).resources, 2, 'cost 2 resources');
});

scenario('Matcher: Coordinate "Coordinate — This unit gets +2/+2." → controller_unit_count gate', () => {
  const r = matchCard({ name: 'X', type: 'Unit', text: 'Coordinate — This unit gets +2/+2. (While you control 3 or more units, this is active.)' });
  assertEq(r.coverage, 'full', 'coverage');
  const a = r.abilities[0];
  if (a.type !== 'constant') throw new Error('expected constant');
  if (!a.while || (a.while as { controller_unit_count?: { min?: number } }).controller_unit_count?.min !== 3) {
    throw new Error('expected controller_unit_count >= 3 gate');
  }
  assertEq(a.grant.modifier!.power, 2, '+2 power');
  assertEq(a.grant.modifier!.health, 2, '+2 health');
  if (!('self' in a.grant.target)) throw new Error('expected self target');
});

scenario('Matcher: "Return a unit from your discard pile to your hand." → return_from_discard', () => {
  const r = matchCard({ name: 'X', type: 'Event', text: 'Return a unit from your discard pile to your hand.' });
  assertEq(r.coverage, 'full', 'coverage');
  const a = r.abilities[0];
  if (a.type !== 'triggered' || a.do.effect !== 'return_from_discard') throw new Error('expected when-played return_from_discard');
  const d = a.do as { player?: string; filter?: { card_type?: string } };
  assertEq(d.player, 'self', 'your discard pile → self');
  assertEq(d.filter?.card_type, 'unit', 'unit filter');
  // Trait + cost variant → compound filter.
  const tv = matchCard({ name: 'Y', type: 'Event', text: 'Return a Rebel unit that costs 4 or less from your discard pile to your hand.' });
  assertEq(tv.coverage, 'full', 'trait+cost coverage');
  const td = (tv.abilities[0] as { do: { filter?: { and?: Array<Record<string, unknown>> } } }).do;
  if (!td.filter?.and || td.filter.and.length !== 3) throw new Error('expected card_type+trait+cost compound filter');
});

scenario('Matcher: "You may … If you do, …" → if_did(optional(do), then)', () => {
  const r = matchCard({ name: 'X', type: 'Event', text: "You may return an enemy unit to its owner's hand. If you do, draw a card." });
  assertEq(r.coverage, 'full', 'coverage');
  const a = r.abilities[0];
  if (a.type !== 'triggered' || a.do.effect !== 'if_did') throw new Error('expected when-played if_did');
  const d = a.do as { do: { effect: string; do?: { effect: string } }; then: { effect: string } };
  assertEq(d.do.effect, 'optional', '"You may" → optional wrapper');
  assertEq(d.do.do?.effect, 'return_to_hand', 'inner do is the bounce');
  assertEq(d.then.effect, 'draw', 'then is the draw');
});

scenario('Matcher: non-optional "If you do" compound → if_did without optional wrapper', () => {
  const r = matchCard({ name: 'Y', type: 'Event', text: 'Deal 2 damage to an enemy unit. If you do, draw a card.' });
  assertEq(r.coverage, 'full', 'coverage');
  const d = (r.abilities[0] as { do: { effect: string; do: { effect: string }; then: { effect: string } } }).do;
  assertEq(d.effect, 'if_did', 'if_did');
  assertEq(d.do.effect, 'damage', 'do is damage (no optional wrapper)');
  assertEq(d.then.effect, 'draw', 'then is draw');
});

scenario('Matcher: "If you do" with an untemplated half stays residual (no misfire)', () => {
  const r = matchCard({ name: 'Z', type: 'Event', text: 'Reverse the polarity. If you do, draw a card.' });
  assertEq(r.coverage, 'none', 'untemplated do → whole clause residual');
});

scenario('Matcher: "If you do, X. If you do not, Y." → if_did with then + else_', () => {
  const r = matchCard({ name: 'X', type: 'Event', text: "You may return an enemy unit to its owner's hand. If you do, draw a card. If you do not, deal 1 damage to the enemy base." });
  assertEq(r.coverage, 'full', 'coverage');
  const d = (r.abilities[0] as { do: { effect: string; do: { effect: string }; then?: { effect: string }; else_?: { effect: string } } }).do;
  assertEq(d.effect, 'if_did', 'if_did');
  assertEq(d.do.effect, 'optional', '"You may" → optional');
  assertEq(d.then?.effect, 'draw', 'then is draw');
  assertEq(d.else_?.effect, 'damage', 'else_ is damage');
});

scenario('Matcher: "X. If you do not, Y." → if_did with else_ only', () => {
  const r = matchCard({ name: 'Y', type: 'Event', text: 'Draw a card. If you do not, deal 2 damage to an enemy unit.' });
  assertEq(r.coverage, 'full', 'coverage');
  const d = (r.abilities[0] as { do: { effect: string; do: { effect: string }; then?: unknown; else_?: { effect: string } } }).do;
  assertEq(d.effect, 'if_did', 'if_did');
  assertEq(d.do.effect, 'draw', 'do is draw (no optional)');
  if (d.then !== undefined) throw new Error('no then branch expected');
  assertEq(d.else_?.effect, 'damage', 'else_ is damage');
});

scenario('Matcher: "Take control of an enemy non-leader unit." → take_control', () => {
  const r = matchCard({ name: 'X', type: 'Event', text: 'Take control of an enemy non-leader unit.' });
  assertEq(r.coverage, 'full', 'coverage');
  const a = r.abilities[0];
  if (a.type !== 'triggered' || a.do.effect !== 'take_control') throw new Error('expected when-played take_control');
  const tgt = (a.do as { target: { controller?: string; filter?: unknown } }).target;
  assertEq(tgt.controller, 'opponent', 'targets enemy');
  if (!tgt.filter) throw new Error('expected a non-leader filter');
  // Cost-restricted ground variant → ground arena + compound filter.
  const cv = matchCard({ name: 'Y', type: 'Event', text: 'Take control of a ground unit that costs 3 or less.' });
  assertEq(cv.coverage, 'full', 'cost variant coverage');
  const cd = (cv.abilities[0] as { do: { target: { zone?: string; filter?: { card_cost?: { max?: number } } } } }).do;
  assertEq(cd.target.zone, 'ground_arena', 'ground arena');
  assertEq(cd.target.filter?.card_cost?.max, 3, 'cost ≤ 3 filter');
});

scenario('Matcher: "When this unit is attacked: Draw a card." → attack_declared w/ defender:self', () => {
  const r = matchCard({ name: 'X', type: 'Unit', text: 'When this unit is attacked: Draw a card.' });
  assertEq(r.coverage, 'full', 'coverage');
  const a = r.abilities[0] as { type: string; on?: string; where?: { defender?: string }; do: { effect: string } };
  assertEq(a.type, 'triggered', 'triggered');
  assertEq(a.on, 'event.attack_declared', 'on attack_declared');
  assertEq(a.where?.defender, 'self', 'defender:self (this unit is attacked)');
  assertEq(a.do.effect, 'draw', 'draw');
});

scenario('Matcher: "This event costs 1 less to play for each friendly leader unit." → cost ability', () => {
  const r = matchCard({ name: 'X', type: 'Event', text: 'This event costs 1 less to play for each friendly leader unit.\nDraw a card.' });
  assertEq(r.coverage, 'full', 'coverage');
  const costAb = r.abilities.find(a => a.type === 'cost') as { amount?: number; per?: string } | undefined;
  if (!costAb) throw new Error('expected a cost ability');
  assertEq(costAb.amount, -1, 'amount -1');
  assertEq(costAb.per, 'friendly_leader_units', 'per friendly leader units');
  // The trailing "Draw a card." still becomes a when-played triggered ability.
  if (!r.abilities.some(a => a.type === 'triggered')) throw new Error('expected the draw to also match');
});

scenario('Matcher: flat "This unit costs 2 less to play." → cost ability (no per)', () => {
  const r = matchCard({ name: 'Y', type: 'Unit', text: 'This unit costs 2 less to play.' });
  assertEq(r.coverage, 'full', 'coverage');
  const costAb = r.abilities[0] as { type: string; amount?: number; per?: string };
  assertEq(costAb.type, 'cost', 'cost ability');
  assertEq(costAb.amount, -2, 'amount -2');
  if (costAb.per !== undefined) throw new Error('flat reduction has no per');
});

scenario('Matcher: multi-attack "This unit attacks twice." → attack effect count 2', () => {
  const r = matchCard({ name: 'X', type: 'Unit', text: 'On Attack: This unit attacks twice.' });
  assertEq(r.coverage, 'full', 'coverage');
  const a = r.abilities[0];
  if (a.type !== 'triggered' || a.do.effect !== 'attack') throw new Error('expected attack effect');
  assertEq((a.do as { count?: number }).count, 2, 'count 2');
  // "again" = 1 more; "N times" = N.
  const again = matchCard({ name: 'Y', type: 'Unit', text: 'On Attack: This unit attacks again.' });
  assertEq(((again.abilities[0] as { do: { count?: number } }).do).count, 1, 'again → 1');
  const ntimes = matchCard({ name: 'Z', type: 'Unit', text: 'On Attack: This unit attacks 3 times.' });
  assertEq(((ntimes.abilities[0] as { do: { count?: number } }).do).count, 3, '3 times → 3');
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
