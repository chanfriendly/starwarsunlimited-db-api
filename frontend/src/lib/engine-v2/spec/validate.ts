// Spec validator — the gate between any spec source (hand-authored fixtures,
// the real-card translator, or a future LLM cascade) and the engine registry.
//
// Walks a CardSpec/BaseSpec AST against the engine's CLOSED vocabularies:
// effect kinds, selector forms, predicate fields, modifier fields, ability
// types, trigger conditions, zones, aspects, player refs, etc. The engine's
// interpreter/selectors/predicate evaluator treat unknown discriminators as
// no-ops (silently), so an LLM or a typo can produce a spec that loads fine
// and then does nothing at the table. This validator turns that silent
// failure into a loud one with a precise path.
//
// Severity:
//   error   — not in the closed vocabulary, or a required field missing/
//             wrong-typed. The spec would misbehave; reject it.
//   warning — valid SWU but inert in the current engine (e.g. an unimplemented
//             keyword like Bounty/Coordinate). Loads fine; just does nothing
//             until the mechanic ships.
//
// Pure: no runtime/state imports. The one engine import is the KEYWORDS
// registry, used only to decide warn-vs-accept on keyword names (auto-syncs as
// keywords are implemented).

import type {
  Ability, Effect, Modifier, Predicate, Selector, TriggerPredicate, Range,
} from './ast';
import type { BaseSpec, CardSpec, KeywordRef } from './types';
import { KEYWORDS } from '../primitives/keywords';

// ---------------------------------------------------------------------------
// Closed vocabularies (kept in sync with ast.ts / types.ts / state types)
// ---------------------------------------------------------------------------

const CARD_TYPES = new Set(['unit', 'event', 'upgrade', 'leader', 'base', 'token']);
const ASPECTS = new Set(['villainy', 'heroism', 'command', 'aggression', 'vigilance', 'cunning']);
const ARENAS = new Set(['ground', 'space']);
const ZONES = new Set([
  'hand', 'deck', 'discard', 'resource_zone', 'ground_arena', 'space_arena',
  'base_zone', 'leader_unit', 'capture_zone', 'set_aside',
]);
const ZONE_FILTER_EXTRA = new Set(['any_arena', 'any_zone']);
const PLAYER_REFS = new Set(['self', 'opponent', 'any', 'controller_of_trigger']);
const EFFECT_KINDS = new Set([
  'damage', 'heal', 'defeat', 'give_shield', 'give_experience', 'draw', 'discard',
  'exhaust', 'ready', 'give', 'sequence', 'if', 'noop', 'choose_one', 'optional',
  'create_token', 'capture', 'rescue', 'move', 'look_at', 'disclose',
  'search', 'divided_damage', 'return_to_hand', 'use_force', 'gain_force',
  'power_damage_from_each',
]);
const ABILITY_TYPES = new Set(['triggered', 'action', 'constant', 'replacement']);
const TRIGGER_CONDITIONS = new Set([
  'event.card_played', 'event.card_drawn', 'event.attack_declared',
  'event.attack_ended', 'event.defeated', 'event.damage_dealt',
  'event.leader_deployed', 'event.token_created', 'event.phase_started',
  'event.phase_ended', 'event.round_started', 'event.round_ended',
]);
const LIMITS = new Set(['once_per_phase', 'once_per_round', 'once_per_game']);
const DURATIONS = new Set([
  'permanent', 'while_source_in_play', 'end_of_attack', 'end_of_phase',
  'end_of_round', 'until_condition',
]);
const RESTRICTIONS = new Set(['attack', 'be_attacked', 'ready', 'exhaust', 'attack_base']);
const SELECTOR_MODES = new Set(['chosen', 'all', 'random', 'self_choose', 'opponent_choose']);
const REPLACEMENT_ON = new Set(['damage_unit', 'damage_base', 'defeat_unit']);
const MOVE_TO = new Set(['ground_arena', 'space_arena', 'other_arena']);
const LOOKAT_SOURCE = new Set(['deck_top', 'opponent_hand']);
const SEARCH_TO = new Set(['hand', 'discard']);

const PREDICATE_LEAF_FIELDS = new Set([
  'card_trait', 'card_traits_any', 'card_type', 'card_aspect', 'card_cost',
  'card_is_unique', 'card_is_token', 'card_is_leader_unit', 'stat_power',
  'stat_hp', 'controller', 'zone', 'self_damage', 'self_exhausted',
  'self_upgraded', 'player_has_force_token', 'controller_unit_count',
  'controller_resource_count', 'controller_controls_trait', 'has_shield_token',
  'remaining_hp',
]);
const MODIFIER_FIELDS = new Set([
  'duration', 'until', 'power', 'health', 'per', 'keyword', 'keyword_value',
  'keywords', 'lose_keyword', 'lose_all_abilities', 'cant', 'must',
]);
const PER_COUNTS = new Set(['controller_resources', 'controller_units', 'self_upgrades']);
const TRIGGER_PREDICATE_FIELDS = new Set([
  'card', 'controller', 'attacker', 'defender', 'card_trait', 'card_type',
  'card_aspect', 'combat', 'base_controller', 'and', 'or', 'not',
]);

// Boolean-flag selector forms (e.g. { self: true }). The presence of one of
// these keys means "this is a named selector, not a scoped one."
const SELECTOR_FLAG_KEYS = new Set([
  'self', 'trigger_source', 'self_base', 'opponent_base', 'trigger_controller_base', 'all_friendly_units',
  'attached_to_self',
]);
const SCOPED_SELECTOR_KEYS = new Set(['zone', 'controller', 'filter', 'selector', 'count']);

// ---------------------------------------------------------------------------
// Result types
// ---------------------------------------------------------------------------

export type Severity = 'error' | 'warning';
export interface ValidationIssue { path: string; message: string; severity: Severity }
export interface ValidationResult {
  ok: boolean;            // true when there are no errors (warnings allowed)
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
}

class V {
  errors: ValidationIssue[] = [];
  warnings: ValidationIssue[] = [];
  err(path: string, message: string) { this.errors.push({ path, message, severity: 'error' }); }
  warn(path: string, message: string) { this.warnings.push({ path, message, severity: 'warning' }); }
  result(): ValidationResult { return { ok: this.errors.length === 0, errors: this.errors, warnings: this.warnings }; }
}

// ---------------------------------------------------------------------------
// Small field helpers
// ---------------------------------------------------------------------------

function isObj(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x);
}
function isNum(x: unknown): x is number { return typeof x === 'number' && !Number.isNaN(x); }
function isStr(x: unknown): x is string { return typeof x === 'string'; }

function checkEnum(v: V, path: string, val: unknown, set: Set<string>, label: string) {
  if (!isStr(val) || !set.has(val)) v.err(path, `${label} must be one of {${[...set].join(', ')}}, got ${JSON.stringify(val)}`);
}

function checkRange(v: V, path: string, r: unknown) {
  if (r === undefined) return;
  if (!isObj(r)) { v.err(path, `range must be an object {min?, max?}, got ${JSON.stringify(r)}`); return; }
  for (const k of Object.keys(r)) {
    if (k !== 'min' && k !== 'max') v.err(`${path}.${k}`, `unknown range field "${k}"`);
    else if (r[k] !== undefined && !isNum(r[k])) v.err(`${path}.${k}`, `range.${k} must be a number`);
  }
}

// ---------------------------------------------------------------------------
// Predicate
// ---------------------------------------------------------------------------

function validatePredicate(v: V, path: string, p: unknown) {
  if (p === undefined) return;
  if (!isObj(p)) { v.err(path, 'predicate must be an object'); return; }

  if ('and' in p) {
    if (!Array.isArray(p.and)) v.err(`${path}.and`, 'and must be an array');
    else p.and.forEach((sub, i) => validatePredicate(v, `${path}.and[${i}]`, sub));
    return;
  }
  if ('or' in p) {
    if (!Array.isArray(p.or)) v.err(`${path}.or`, 'or must be an array');
    else p.or.forEach((sub, i) => validatePredicate(v, `${path}.or[${i}]`, sub));
    return;
  }
  if ('not' in p) { validatePredicate(v, `${path}.not`, p.not); return; }

  // Leaf
  for (const key of Object.keys(p)) {
    if (!PREDICATE_LEAF_FIELDS.has(key)) { v.err(`${path}.${key}`, `unknown predicate field "${key}"`); continue; }
    const val = (p as Record<string, unknown>)[key];
    switch (key) {
      case 'card_type': checkEnum(v, `${path}.card_type`, val, CARD_TYPES, 'card_type'); break;
      case 'card_aspect': checkEnum(v, `${path}.card_aspect`, val, ASPECTS, 'card_aspect'); break;
      case 'controller': checkEnum(v, `${path}.controller`, val, PLAYER_REFS, 'controller'); break;
      case 'zone': checkEnum(v, `${path}.zone`, val, ZONES, 'zone'); break;
      case 'card_cost': case 'stat_power': case 'stat_hp': case 'self_damage':
      case 'controller_unit_count': case 'controller_resource_count': case 'remaining_hp':
        checkRange(v, `${path}.${key}`, val as Range); break;
      case 'card_traits_any':
        if (!Array.isArray(val)) v.err(`${path}.card_traits_any`, 'must be an array of strings'); break;
      // booleans / strings — light touch
    }
  }
}

// ---------------------------------------------------------------------------
// Selector
// ---------------------------------------------------------------------------

function validateSelector(v: V, path: string, sel: unknown) {
  if (!isObj(sel)) { v.err(path, 'selector must be an object'); return; }
  const keys = Object.keys(sel);

  // exclude/from form
  if ('exclude' in sel || 'from' in sel) {
    if (!('exclude' in sel) || !('from' in sel)) v.err(path, 'exclude-selector needs both `exclude` and `from`');
    else { validateSelector(v, `${path}.exclude`, sel.exclude); validateSelector(v, `${path}.from`, sel.from); }
    return;
  }

  // boolean-flag forms
  const flag = keys.find(k => SELECTOR_FLAG_KEYS.has(k));
  if (flag) {
    // all_friendly_units may carry a filter
    if (flag === 'all_friendly_units' && 'filter' in sel) validatePredicate(v, `${path}.filter`, sel.filter);
    return;
  }

  // scoped form — any subset of the scoped keys (empty object = "all matching")
  for (const k of keys) {
    if (!SCOPED_SELECTOR_KEYS.has(k)) { v.err(`${path}.${k}`, `unknown selector field "${k}"`); continue; }
  }
  if ('controller' in sel) checkEnum(v, `${path}.controller`, sel.controller, PLAYER_REFS, 'controller');
  if ('selector' in sel) checkEnum(v, `${path}.selector`, sel.selector, SELECTOR_MODES, 'selector');
  if ('filter' in sel) validatePredicate(v, `${path}.filter`, sel.filter);
  if ('zone' in sel) validateZoneFilter(v, `${path}.zone`, sel.zone);
  if ('count' in sel) {
    const c = sel.count;
    if (c !== 'all' && !isNum(c) && !(isObj(c))) v.err(`${path}.count`, 'count must be a number, a {min?,max?} range, or "all"');
    else if (isObj(c)) checkRange(v, `${path}.count`, c);
  }
}

function validateZoneFilter(v: V, path: string, zf: unknown) {
  if (Array.isArray(zf)) { zf.forEach((z, i) => checkEnum(v, `${path}[${i}]`, z, ZONES, 'zone')); return; }
  if (isStr(zf) && (ZONES.has(zf) || ZONE_FILTER_EXTRA.has(zf))) return;
  v.err(path, `zone filter must be a zone, zone[], or one of {${[...ZONE_FILTER_EXTRA].join(', ')}}, got ${JSON.stringify(zf)}`);
}

// ---------------------------------------------------------------------------
// Modifier
// ---------------------------------------------------------------------------

function validateModifier(v: V, path: string, m: unknown) {
  if (!isObj(m)) { v.err(path, 'modifier must be an object'); return; }
  for (const k of Object.keys(m)) {
    if (!MODIFIER_FIELDS.has(k)) v.err(`${path}.${k}`, `unknown modifier field "${k}"`);
  }
  if ('duration' in m) checkEnum(v, `${path}.duration`, m.duration, DURATIONS, 'duration');
  if ('until' in m) validatePredicate(v, `${path}.until`, m.until);
  if ('per' in m) {
    const p = m.per;
    if (!isObj(p)) v.err(`${path}.per`, 'per must be an object {count, power?, health?}');
    else {
      checkEnum(v, `${path}.per.count`, p.count, PER_COUNTS, 'count');
      if ('power' in p && !isNum(p.power)) v.err(`${path}.per.power`, 'per.power must be a number');
      if ('health' in p && !isNum(p.health)) v.err(`${path}.per.health`, 'per.health must be a number');
    }
  }
  if ('cant' in m) {
    if (!Array.isArray(m.cant)) v.err(`${path}.cant`, 'cant must be an array');
    else m.cant.forEach((r, i) => checkEnum(v, `${path}.cant[${i}]`, r, RESTRICTIONS, 'restriction'));
  }
  if ('keyword' in m && isStr(m.keyword)) warnUnknownKeyword(v, `${path}.keyword`, m.keyword);
  if ('keywords' in m && Array.isArray(m.keywords)) {
    (m.keywords as KeywordGrantLike[]).forEach((kw, i) => {
      if (isObj(kw) && isStr(kw.name)) warnUnknownKeyword(v, `${path}.keywords[${i}].name`, kw.name);
    });
  }
}
interface KeywordGrantLike { name?: string; value?: number }

function warnUnknownKeyword(v: V, path: string, name: string) {
  if (!KEYWORDS[name.toLowerCase()]) {
    v.warn(path, `keyword "${name}" is not implemented — it will load but have no engine effect`);
  }
}

// ---------------------------------------------------------------------------
// Trigger predicate (for where: clauses)
// ---------------------------------------------------------------------------

function validateTriggerPredicate(v: V, path: string, p: unknown) {
  if (p === undefined) return;
  if (!isObj(p)) { v.err(path, 'trigger predicate must be an object'); return; }
  for (const k of Object.keys(p)) {
    if (!TRIGGER_PREDICATE_FIELDS.has(k)) { v.err(`${path}.${k}`, `unknown trigger-predicate field "${k}"`); continue; }
  }
  if ('and' in p && Array.isArray(p.and)) (p.and as unknown[]).forEach((s, i) => validateTriggerPredicate(v, `${path}.and[${i}]`, s));
  if ('or' in p && Array.isArray(p.or)) (p.or as unknown[]).forEach((s, i) => validateTriggerPredicate(v, `${path}.or[${i}]`, s));
  if ('not' in p) validateTriggerPredicate(v, `${path}.not`, p.not);
  if ('controller' in p) checkEnum(v, `${path}.controller`, p.controller, PLAYER_REFS, 'controller');
  if ('base_controller' in p) checkEnum(v, `${path}.base_controller`, p.base_controller, PLAYER_REFS, 'base_controller');
  if ('card_aspect' in p) checkEnum(v, `${path}.card_aspect`, p.card_aspect, ASPECTS, 'card_aspect');
}

// ---------------------------------------------------------------------------
// Effect (recursive)
// ---------------------------------------------------------------------------

function validateEffect(v: V, path: string, e: unknown) {
  if (!isObj(e)) { v.err(path, 'effect must be an object'); return; }
  const kind = e.effect;
  if (!isStr(kind) || !EFFECT_KINDS.has(kind)) {
    v.err(`${path}.effect`, `unknown effect kind ${JSON.stringify(kind)}`);
    return;
  }
  const need = (field: string, ok: boolean) => { if (!ok) v.err(`${path}.${field}`, `${kind} requires "${field}"`); };

  switch (kind) {
    case 'damage':
      // Either a fixed `amount` OR dynamic `amountFromPower` (a selector).
      need('amount|amountFromPower', isNum(e.amount) || 'amountFromPower' in e);
      if ('amountFromPower' in e) validateSelector(v, `${path}.amountFromPower`, e.amountFromPower);
      need('target', 'target' in e);
      if ('target' in e) validateSelector(v, `${path}.target`, e.target); break;
    case 'heal':
      need('amount', isNum(e.amount)); need('target', 'target' in e);
      if ('target' in e) validateSelector(v, `${path}.target`, e.target); break;
    case 'defeat': case 'exhaust': case 'ready': case 'rescue':
      need('target', 'target' in e);
      if ('target' in e) validateSelector(v, `${path}.target`, e.target); break;
    case 'give_shield':
      need('target', 'target' in e);
      if ('target' in e) validateSelector(v, `${path}.target`, e.target);
      if ('count' in e && !isNum(e.count)) v.err(`${path}.count`, 'count must be a number'); break;
    case 'give_experience':
      need('target', 'target' in e);
      if ('target' in e) validateSelector(v, `${path}.target`, e.target);
      if ('count' in e && !isNum(e.count)) v.err(`${path}.count`, 'count must be a number'); break;
    case 'draw':
      need('player', 'player' in e); need('count', isNum(e.count));
      if ('player' in e) checkEnum(v, `${path}.player`, e.player, PLAYER_REFS, 'player'); break;
    case 'discard':
      need('player', 'player' in e); need('count', isNum(e.count)); need('chooser', 'chooser' in e);
      if ('player' in e) checkEnum(v, `${path}.player`, e.player, PLAYER_REFS, 'player');
      if ('chooser' in e) checkEnum(v, `${path}.chooser`, e.chooser, PLAYER_REFS, 'chooser'); break;
    case 'give':
      need('target', 'target' in e); need('modifier', 'modifier' in e);
      if ('target' in e) validateSelector(v, `${path}.target`, e.target);
      if ('modifier' in e) validateModifier(v, `${path}.modifier`, e.modifier); break;
    case 'sequence':
      if (!Array.isArray(e.steps)) v.err(`${path}.steps`, 'sequence requires "steps" array');
      else e.steps.forEach((s, i) => validateEffect(v, `${path}.steps[${i}]`, s)); break;
    case 'if':
      need('condition', 'condition' in e); need('then', 'then' in e);
      validatePredicate(v, `${path}.condition`, e.condition);
      if ('then' in e) validateEffect(v, `${path}.then`, e.then);
      if ('else' in e) validateEffect(v, `${path}.else`, e.else); break;
    case 'noop': break;
    case 'choose_one':
      if (!Array.isArray(e.options)) v.err(`${path}.options`, 'choose_one requires "options" array');
      else e.options.forEach((o, i) => {
        if (!isObj(o)) { v.err(`${path}.options[${i}]`, 'option must be an object'); return; }
        if (!isStr(o.label)) v.err(`${path}.options[${i}].label`, 'option needs string label');
        if (!isStr(o.value)) v.err(`${path}.options[${i}].value`, 'option needs string value');
        need(`options[${i}].do`, 'do' in o);
        if ('do' in o) validateEffect(v, `${path}.options[${i}].do`, o.do);
      });
      if ('chooser' in e) checkEnum(v, `${path}.chooser`, e.chooser, PLAYER_REFS, 'chooser'); break;
    case 'optional':
      need('do', 'do' in e);
      if ('do' in e) validateEffect(v, `${path}.do`, e.do);
      if ('chooser' in e) checkEnum(v, `${path}.chooser`, e.chooser, PLAYER_REFS, 'chooser'); break;
    case 'create_token':
      need('token_id', isStr(e.token_id)); need('controller', 'controller' in e); need('zone', 'zone' in e);
      if ('controller' in e) checkEnum(v, `${path}.controller`, e.controller, PLAYER_REFS, 'controller');
      if ('zone' in e) checkEnum(v, `${path}.zone`, e.zone, ZONES, 'zone'); break;
    case 'capture':
      need('target', 'target' in e); need('captor', 'captor' in e);
      if ('target' in e) validateSelector(v, `${path}.target`, e.target);
      if ('captor' in e) validateSelector(v, `${path}.captor`, e.captor); break;
    case 'move':
      need('target', 'target' in e); need('to', 'to' in e);
      if ('target' in e) validateSelector(v, `${path}.target`, e.target);
      if ('to' in e) checkEnum(v, `${path}.to`, e.to, MOVE_TO, 'to'); break;
    case 'return_to_hand':
      need('target', 'target' in e);
      if ('target' in e) validateSelector(v, `${path}.target`, e.target); break;
    case 'use_force':
      need('do', 'do' in e);
      if ('do' in e) validateEffect(v, `${path}.do`, e.do); break;
    case 'gain_force':
      if ('player' in e) checkEnum(v, `${path}.player`, e.player, PLAYER_REFS, 'player'); break;
    case 'power_damage_from_each':
      need('sources', 'sources' in e); need('target', 'target' in e);
      if ('sources' in e) validateSelector(v, `${path}.sources`, e.sources);
      if ('target' in e) validateSelector(v, `${path}.target`, e.target); break;
    case 'look_at':
      need('player', 'player' in e); need('source', 'source' in e);
      if ('player' in e) checkEnum(v, `${path}.player`, e.player, PLAYER_REFS, 'player');
      if ('source' in e) checkEnum(v, `${path}.source`, e.source, LOOKAT_SOURCE, 'source'); break;
    case 'disclose':
      need('player', 'player' in e);
      if ('player' in e) checkEnum(v, `${path}.player`, e.player, PLAYER_REFS, 'player');
      if ('filter' in e) validatePredicate(v, `${path}.filter`, e.filter); break;
    case 'search':
      need('player', 'player' in e); need('count', isNum(e.count)); need('to', 'to' in e);
      if ('player' in e) checkEnum(v, `${path}.player`, e.player, PLAYER_REFS, 'player');
      if ('to' in e) checkEnum(v, `${path}.to`, e.to, SEARCH_TO, 'to');
      if ('filter' in e) validatePredicate(v, `${path}.filter`, e.filter); break;
    case 'divided_damage':
      need('amount', isNum(e.amount)); need('pool', 'pool' in e);
      if ('pool' in e) validateSelector(v, `${path}.pool`, e.pool); break;
  }
}

// ---------------------------------------------------------------------------
// Ability (recursive via effects)
// ---------------------------------------------------------------------------

function validateAbility(v: V, path: string, a: unknown) {
  if (!isObj(a)) { v.err(path, 'ability must be an object'); return; }
  const t = a.type;
  if (!isStr(t) || !ABILITY_TYPES.has(t)) { v.err(`${path}.type`, `unknown ability type ${JSON.stringify(t)}`); return; }

  switch (t) {
    case 'triggered':
      checkEnum(v, `${path}.on`, a.on, TRIGGER_CONDITIONS, 'on');
      if ('where' in a) validateTriggerPredicate(v, `${path}.where`, a.where);
      if ('limit' in a) checkEnum(v, `${path}.limit`, a.limit, LIMITS, 'limit');
      if ('controlled_by' in a) checkEnum(v, `${path}.controlled_by`, a.controlled_by, PLAYER_REFS, 'controlled_by');
      if (!('do' in a)) v.err(`${path}.do`, 'triggered ability requires "do"');
      else validateEffect(v, `${path}.do`, a.do);
      break;
    case 'action':
      if ('limit' in a) checkEnum(v, `${path}.limit`, a.limit, LIMITS, 'limit');
      if ('cost' in a) validateActionCost(v, `${path}.cost`, a.cost);
      if (!('do' in a)) v.err(`${path}.do`, 'action ability requires "do"');
      else validateEffect(v, `${path}.do`, a.do);
      break;
    case 'constant':
      if ('active_in_zone' in a) checkEnum(v, `${path}.active_in_zone`, a.active_in_zone, ZONES, 'active_in_zone');
      if ('while' in a) validatePredicate(v, `${path}.while`, a.while);
      if (!isObj(a.grant)) v.err(`${path}.grant`, 'constant ability requires "grant" object');
      else {
        if (!('target' in a.grant)) v.err(`${path}.grant.target`, 'grant requires "target"');
        else validateSelector(v, `${path}.grant.target`, (a.grant as Record<string, unknown>).target);
        if (!('modifier' in a.grant)) v.err(`${path}.grant.modifier`, 'grant requires "modifier"');
        else validateModifier(v, `${path}.grant.modifier`, (a.grant as Record<string, unknown>).modifier);
      }
      break;
    case 'replacement':
      checkEnum(v, `${path}.on`, a.on, REPLACEMENT_ON, 'on');
      if ('where' in a) validateTriggerPredicate(v, `${path}.where`, a.where);
      if (!('with' in a)) v.err(`${path}.with`, 'replacement ability requires "with"');
      else validateEffect(v, `${path}.with`, a.with);
      break;
  }
}

function validateActionCost(v: V, path: string, c: unknown) {
  if (!isObj(c)) { v.err(path, 'cost must be an object'); return; }
  const allowed = new Set(['exhaust', 'resources', 'discard', 'defeat', 'remove_shield']);
  for (const k of Object.keys(c)) if (!allowed.has(k)) v.err(`${path}.${k}`, `unknown cost field "${k}"`);
  if ('resources' in c && !isNum(c.resources)) v.err(`${path}.resources`, 'resources must be a number');
  if ('defeat' in c) validateSelector(v, `${path}.defeat`, c.defeat);
  if ('remove_shield' in c) validateSelector(v, `${path}.remove_shield`, c.remove_shield);
  if ('discard' in c) {
    const d = c.discard;
    if (!isObj(d)) v.err(`${path}.discard`, 'discard cost must be {player, count}');
    else {
      checkEnum(v, `${path}.discard.player`, d.player, PLAYER_REFS, 'player');
      if (!isNum(d.count)) v.err(`${path}.discard.count`, 'count must be a number');
    }
  }
}

// ---------------------------------------------------------------------------
// Top-level: card / base / registry
// ---------------------------------------------------------------------------

function validateCommon(v: V, path: string, c: Record<string, unknown>) {
  if (!isStr(c.id)) v.err(`${path}.id`, 'id must be a string');
  if (!isStr(c.name)) v.err(`${path}.name`, 'name must be a string');
  if ('cost' in c && c.cost !== undefined && !isNum(c.cost)) v.err(`${path}.cost`, 'cost must be a number');
  if ('aspects' in c && Array.isArray(c.aspects)) c.aspects.forEach((a, i) => checkEnum(v, `${path}.aspects[${i}]`, a, ASPECTS, 'aspect'));
  if ('traits' in c && c.traits !== undefined && !Array.isArray(c.traits)) v.err(`${path}.traits`, 'traits must be an array');
  if ('unique' in c && c.unique !== undefined && typeof c.unique !== 'boolean') v.err(`${path}.unique`, 'unique must be a boolean');
}

function validateKeywords(v: V, path: string, kws: unknown) {
  if (kws === undefined) return;
  if (!Array.isArray(kws)) { v.err(path, 'keywords must be an array'); return; }
  (kws as KeywordRef[]).forEach((kw, i) => {
    if (!isObj(kw)) { v.err(`${path}[${i}]`, 'keyword must be an object'); return; }
    if (!isStr(kw.name)) v.err(`${path}[${i}].name`, 'keyword needs a string name');
    else warnUnknownKeyword(v, `${path}[${i}].name`, kw.name);
    if (kw.value !== undefined && !isNum(kw.value)) v.err(`${path}[${i}].value`, 'keyword value must be a number');
    if (kw.ability !== undefined) validateAbility(v, `${path}[${i}].ability`, kw.ability);
  });
}

function validateAbilities(v: V, path: string, abs: unknown) {
  if (abs === undefined) return;
  if (!Array.isArray(abs)) { v.err(path, 'abilities must be an array'); return; }
  abs.forEach((a, i) => validateAbility(v, `${path}[${i}]`, a));
}

/** Validate one card spec. `idForPath` defaults to the spec's id. */
export function validateCardSpec(spec: CardSpec): ValidationResult {
  const v = new V();
  const s = spec as unknown as Record<string, unknown>;
  const path = isStr(s.id) ? s.id : '<card>';
  checkEnum(v, `${path}.type`, s.type, CARD_TYPES, 'type');
  validateCommon(v, path, s);

  switch (s.type) {
    case 'unit':
      checkEnum(v, `${path}.arena`, s.arena, ARENAS, 'arena');
      if (!isNum(s.power)) v.err(`${path}.power`, 'unit requires numeric power');
      if (!isNum(s.hp)) v.err(`${path}.hp`, 'unit requires numeric hp');
      validateKeywords(v, `${path}.keywords`, s.keywords);
      validateAbilities(v, `${path}.abilities`, s.abilities);
      break;
    case 'event':
      validateAbilities(v, `${path}.abilities`, s.abilities);
      break;
    case 'upgrade':
      if ('powerModifier' in s && s.powerModifier !== undefined && !isNum(s.powerModifier)) v.err(`${path}.powerModifier`, 'powerModifier must be a number');
      if ('hpModifier' in s && s.hpModifier !== undefined && !isNum(s.hpModifier)) v.err(`${path}.hpModifier`, 'hpModifier must be a number');
      validateKeywords(v, `${path}.keywords`, s.keywords);
      validateAbilities(v, `${path}.abilities`, s.abilities);
      break;
    case 'leader':
      if ('arena' in s && s.arena !== undefined) checkEnum(v, `${path}.arena`, s.arena, ARENAS, 'arena');
      if ('power' in s && s.power !== undefined && !isNum(s.power)) v.err(`${path}.power`, 'power must be a number');
      if ('hp' in s && s.hp !== undefined && !isNum(s.hp)) v.err(`${path}.hp`, 'hp must be a number');
      validateAbilities(v, `${path}.leaderAbilities`, s.leaderAbilities);
      validateAbilities(v, `${path}.leaderUnitAbilities`, s.leaderUnitAbilities);
      validateAbilities(v, `${path}.leaderUpgradeAbilities`, s.leaderUpgradeAbilities);
      break;
    case 'token':
      if ('tokenType' in s) checkEnum(v, `${path}.tokenType`, s.tokenType, new Set(['unit', 'upgrade']), 'tokenType');
      validateKeywords(v, `${path}.keywords`, s.keywords);
      validateAbilities(v, `${path}.abilities`, s.abilities);
      break;
  }
  return v.result();
}

export function validateBaseSpec(spec: BaseSpec): ValidationResult {
  const v = new V();
  const s = spec as unknown as Record<string, unknown>;
  const path = isStr(s.id) ? s.id : '<base>';
  if (s.type !== 'base') v.err(`${path}.type`, `base spec must have type "base", got ${JSON.stringify(s.type)}`);
  if (!isStr(s.id)) v.err(`${path}.id`, 'id must be a string');
  if (!isStr(s.name)) v.err(`${path}.name`, 'name must be a string');
  if (!isNum(s.hp)) v.err(`${path}.hp`, 'base requires numeric hp');
  if ('aspects' in s && Array.isArray(s.aspects)) s.aspects.forEach((a, i) => checkEnum(v, `${path}.aspects[${i}]`, a, ASPECTS, 'aspect'));
  validateAbilities(v, `${path}.abilities`, s.abilities);
  return v.result();
}

/** Validate every card + base in a list. Merges all issues; `ok` is true only
 *  if no card/base produced an error. */
export function validateSpecs(cards: CardSpec[], bases: BaseSpec[]): ValidationResult {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];
  for (const c of cards) { const r = validateCardSpec(c); errors.push(...r.errors); warnings.push(...r.warnings); }
  for (const b of bases) { const r = validateBaseSpec(b); errors.push(...r.errors); warnings.push(...r.warnings); }
  return { ok: errors.length === 0, errors, warnings };
}
