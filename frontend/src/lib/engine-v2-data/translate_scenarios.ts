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
  // "Defeat up to 2 upgrades" isn't templated → the whole modal must NOT match
  // (otherwise the card would wrongly fire the parseable modes unconditionally).
  const r = matchCard({ name: 'W', type: 'Event', text: 'Choose one:\nDraw a card.\nDefeat up to 2 upgrades.' });
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

scenario('Matcher: Coordinate "Coordinate — This unit gets +2/+2." → controller_unit_count gate', () => {
  const r = matchCard({ name: 'X', type: 'Unit', text: 'Coordinate — This unit gets +2/+2. (While you control 3 or more units, this is active.)' });
  assertEq(r.coverage, 'full', 'coverage');
  const a = r.abilities[0];
  if (a.type !== 'constant') throw new Error('expected constant');
  if (!a.while || (a.while as { controller_unit_count?: { min?: number } }).controller_unit_count?.min !== 3) {
    throw new Error('expected controller_unit_count >= 3 gate');
  }
  assertEq(a.grant.modifier.power, 2, '+2 power');
  assertEq(a.grant.modifier.health, 2, '+2 health');
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
