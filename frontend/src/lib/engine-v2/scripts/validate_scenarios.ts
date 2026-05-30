// Validator verification. Run: cd frontend && npm run validate-scenarios
//
// Two halves:
//   (1) Every shipped fixture (ALL_CARDS + W1_BASES) validates with zero
//       errors. This is a regression net: the validator and the fixtures
//       check each other. If someone adds an effect kind to the AST and a
//       fixture using it but forgets to teach the validator, this fails.
//   (2) Deliberately-malformed specs each produce the expected error (and
//       clean specs don't), proving the validator actually catches things.

import { validateCardSpec, validateBaseSpec, validateSpecs } from '../spec/validate';
import type { CardSpec } from '../spec/types';
import { ALL_CARDS, W1_BASES } from '../__fixtures__';

let passed = 0, failed = 0;
function scenario(name: string, fn: () => void) {
  try { fn(); console.log(`✅ ${name}`); passed++; }
  catch (e) { console.log(`❌ ${name}\n     ${e instanceof Error ? e.message : String(e)}`); failed++; }
}
function assert(cond: boolean, msg: string) { if (!cond) throw new Error(msg); }
function expectError(spec: CardSpec, pathFragment: string) {
  const r = validateCardSpec(spec);
  if (r.ok) throw new Error(`expected an error mentioning "${pathFragment}", but spec validated clean`);
  if (!r.errors.some(e => e.path.includes(pathFragment) || e.message.includes(pathFragment))) {
    throw new Error(`expected an error mentioning "${pathFragment}", got: ${r.errors.map(e => `${e.path}: ${e.message}`).join(' | ')}`);
  }
}

// ---------------------------------------------------------------------------
// (1) All shipped fixtures validate clean
// ---------------------------------------------------------------------------

scenario('All fixture cards + bases validate with zero errors', () => {
  const r = validateSpecs(ALL_CARDS, W1_BASES);
  if (!r.ok) {
    const lines = r.errors.slice(0, 20).map(e => `  ${e.path}: ${e.message}`).join('\n');
    throw new Error(`fixtures produced ${r.errors.length} error(s):\n${lines}`);
  }
  console.log(`     → ${ALL_CARDS.length} cards + ${W1_BASES.length} bases clean (${r.warnings.length} warning(s))`);
});

// ---------------------------------------------------------------------------
// (2) Malformed specs are caught
// ---------------------------------------------------------------------------

scenario('Bad card type is rejected', () => {
  expectError({ id: 'X', name: 'X', type: 'creature' } as unknown as CardSpec, 'type');
});

scenario('Bad aspect is rejected', () => {
  expectError({
    id: 'X', name: 'X', type: 'unit', arena: 'ground', power: 1, hp: 1,
    aspects: ['heroism', 'darkness'],
  } as unknown as CardSpec, 'aspects[1]');
});

scenario('Bad arena is rejected', () => {
  expectError({
    id: 'X', name: 'X', type: 'unit', arena: 'orbital', power: 1, hp: 1,
  } as unknown as CardSpec, 'arena');
});

scenario('Unit missing power is rejected', () => {
  expectError({
    id: 'X', name: 'X', type: 'unit', arena: 'ground', hp: 1,
  } as unknown as CardSpec, 'power');
});

scenario('Unknown effect kind in an ability is rejected', () => {
  expectError({
    id: 'X', name: 'X', type: 'unit', arena: 'ground', power: 1, hp: 1,
    abilities: [{ type: 'triggered', on: 'event.card_played', do: { effect: 'teleport', target: { self: true } } }],
  } as unknown as CardSpec, 'effect');
});

scenario('Unknown trigger condition is rejected', () => {
  expectError({
    id: 'X', name: 'X', type: 'unit', arena: 'ground', power: 1, hp: 1,
    abilities: [{ type: 'triggered', on: 'event.card_burped', do: { effect: 'noop' } }],
  } as unknown as CardSpec, 'on');
});

scenario('Damage effect missing amount is rejected', () => {
  expectError({
    id: 'X', name: 'X', type: 'unit', arena: 'ground', power: 1, hp: 1,
    abilities: [{ type: 'triggered', on: 'event.card_played', do: { effect: 'damage', target: { self: true } } }],
  } as unknown as CardSpec, 'amount');
});

scenario('Unknown predicate field is rejected (deep path)', () => {
  expectError({
    id: 'X', name: 'X', type: 'unit', arena: 'ground', power: 1, hp: 1,
    abilities: [{
      type: 'constant',
      grant: {
        target: { zone: 'any_arena', controller: 'self', filter: { card_colour: 'blue' } },
        modifier: { power: 1 },
      },
    }],
  } as unknown as CardSpec, 'card_colour');
});

scenario('Unknown modifier field is rejected', () => {
  expectError({
    id: 'X', name: 'X', type: 'unit', arena: 'ground', power: 1, hp: 1,
    abilities: [{
      type: 'constant',
      grant: { target: { self: true }, modifier: { pwoer: 1 } },
    }],
  } as unknown as CardSpec, 'pwoer');
});

scenario('Bad replacement `on` is rejected', () => {
  expectError({
    id: 'X', name: 'X', type: 'unit', arena: 'ground', power: 1, hp: 1,
    abilities: [{ type: 'replacement', on: 'heal_unit', with: { effect: 'noop' } }],
  } as unknown as CardSpec, 'on');
});

scenario('Bad move target arena is rejected', () => {
  expectError({
    id: 'X', name: 'X', type: 'unit', arena: 'ground', power: 1, hp: 1,
    abilities: [{ type: 'action', do: { effect: 'move', target: { self: true }, to: 'hyperspace' } }],
  } as unknown as CardSpec, 'to');
});

scenario('Nested effect error reports a precise path', () => {
  const r = validateCardSpec({
    id: 'X', name: 'X', type: 'unit', arena: 'ground', power: 1, hp: 1,
    abilities: [{
      type: 'triggered', on: 'event.attack_declared',
      do: { effect: 'sequence', steps: [
        { effect: 'noop' },
        { effect: 'damage', amount: 2, target: { selector: 'chosen', count: 1, badkey: true } },
      ] },
    }],
  } as unknown as CardSpec);
  assert(!r.ok, 'should have an error');
  assert(r.errors.some(e => e.path.includes('abilities[0].do.steps[1].target.badkey')),
    `expected precise nested path, got: ${r.errors.map(e => e.path).join(', ')}`);
});

scenario('Unimplemented keyword is a WARNING, not an error', () => {
  const r = validateCardSpec({
    id: 'X', name: 'X', type: 'unit', arena: 'ground', power: 1, hp: 1,
    keywords: [{ name: 'Bounty' }],
  } as unknown as CardSpec);
  assert(r.ok, `unimplemented keyword should not be an error: ${r.errors.map(e => e.message).join(', ')}`);
  assert(r.warnings.some(w => w.message.includes('Bounty')), 'expected a warning about Bounty');
});

scenario('Implemented keyword produces no warning', () => {
  const r = validateCardSpec({
    id: 'X', name: 'X', type: 'unit', arena: 'ground', power: 1, hp: 1,
    keywords: [{ name: 'Sentinel' }, { name: 'Raid', value: 2 }],
  } as unknown as CardSpec);
  assert(r.ok, 'should be clean');
  assert(r.warnings.length === 0, `expected no warnings, got: ${r.warnings.map(w => w.message).join(', ')}`);
});

scenario('Base spec with non-numeric hp is rejected', () => {
  const r = validateBaseSpec({ id: 'B', name: 'B', type: 'base', hp: 'lots' } as unknown as Parameters<typeof validateBaseSpec>[0]);
  assert(!r.ok, 'should reject non-numeric base hp');
});

// ---------------------------------------------------------------------------
console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
