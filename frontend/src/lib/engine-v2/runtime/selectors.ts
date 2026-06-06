// Selector → ResolvedTarget[] resolution.
//
// Selectors that name a single object ("self", "self_base") resolve
// deterministically. Scoped selectors with selector="chosen" return all
// CANDIDATES; the caller is responsible for prompting the player and filtering
// to the chosen subset. (Choice prompts land in a later phase; for now
// "chosen" with count=1 in non-interactive contexts auto-picks the first
// candidate, which is fine for deterministic demos.)

import type { CardInstance, CardRegistry, GameState, PlayerId, Zone } from '../state/types';
import type { ResolvedTarget, ScopedSelector, Selector, ZoneFilter } from '../spec/ast';
import { getZoneArr } from '../state/zones';
import { evalCardPredicate, resolvePlayer, type EvalCtx } from './predicates';
import { defaultChooser } from './chooser';

const ARENA_ZONES: Zone[] = ['ground_arena', 'space_arena'];

function expandZones(zf: ZoneFilter | undefined): Zone[] {
  if (zf === undefined) return ARENA_ZONES; // sensible default for unit-targeted effects
  if (zf === 'any_arena') return ARENA_ZONES;
  if (zf === 'any_zone') return ['hand', 'deck', 'discard', 'resource_zone', ...ARENA_ZONES];
  // 'host_arena' is resolved dynamically by the caller (resolveSelector) before
  // expandZones runs; never reaches here. Fall back to arenas defensively.
  if (zf === 'host_arena') return ARENA_ZONES;
  if (Array.isArray(zf)) return zf;
  return [zf];
}

function resolveScopedPlayers(ctx: EvalCtx, controller: ScopedSelector['controller']): PlayerId[] {
  if (!controller || controller === 'any') return ctx.state.playerOrder;
  const want = resolvePlayer(controller, ctx);
  return ctx.state.playerOrder.filter(p => p === want);
}

export function resolveSelector(ctx: EvalCtx, sel: Selector): ResolvedTarget[] {
  if ('self' in sel && sel.self) {
    if (!ctx.sourceIid) return [];
    return [{ kind: 'unit', iid: ctx.sourceIid, controller: ctx.sourcePlayer }];
  }
  if ('trigger_source' in sel && sel.trigger_source) {
    const iid = triggerSourceIid(ctx);
    if (!iid) return [];
    return [{ kind: 'unit', iid, controller: ctx.sourcePlayer /* approximated; refined when event payload carries controller */ }];
  }
  if ('trigger_defender' in sel && sel.trigger_defender) {
    const e = ctx.triggerEvent;
    const iid = (e && (e.kind === 'ATTACK_DECLARED' || e.kind === 'ATTACK_ENDED')) ? e.defenderIid : undefined;
    if (!iid) return [];
    // The defender may be a base ("attack the base") — only units are returnable
    // targets here; resolve the controller by locating the unit in the arenas.
    for (const pid of ctx.state.playerOrder) {
      const ps = ctx.state.players[pid];
      if (!ps) continue;
      for (const z of ARENA_ZONES) {
        if (ps[z === 'ground_arena' ? 'groundArena' : 'spaceArena'].some(c => c.iid === iid)) {
          return [{ kind: 'unit', iid, controller: pid }];
        }
      }
    }
    return [];
  }
  if ('self_base' in sel && sel.self_base) {
    return [{ kind: 'base', controller: ctx.sourcePlayer }];
  }
  if ('opponent_base' in sel && sel.opponent_base) {
    const opp = ctx.state.playerOrder.find(p => p !== ctx.sourcePlayer);
    if (!opp) return [];
    return [{ kind: 'base', controller: opp }];
  }
  if ('chosen_base' in sel && sel.chosen_base) {
    // "a base" — choose any base; offer the opponent's first so the default/AI
    // chooser (leftmost) picks it (the sane aggressive default).
    const opp = ctx.state.playerOrder.find(p => p !== ctx.sourcePlayer);
    const order = opp ? [opp, ctx.sourcePlayer] : [ctx.sourcePlayer];
    const chooser = ctx.chooser ?? defaultChooser;
    const result = chooser({
      kind: 'choose_one', prompt: 'Choose a base',
      options: order.map(p => ({ label: `${p}'s base`, value: p })),
      player: ctx.sourcePlayer, canPass: false,
    });
    const pick = result.kind === 'option' ? (result.value as PlayerId) : order[0];
    return [{ kind: 'base', controller: pick }];
  }
  if ('trigger_controller_base' in sel && sel.trigger_controller_base) {
    // "its controller's base" — the base of the controller of the unit named by
    // the triggering event (currently DEFEATED, via lastKnown.controller).
    const e = ctx.triggerEvent;
    const owner = e && e.kind === 'DEFEATED' ? e.lastKnown.controller : undefined;
    const controller = owner ?? ctx.state.playerOrder.find(p => p !== ctx.sourcePlayer);
    if (!controller) return [];
    return [{ kind: 'base', controller }];
  }
  if ('all_friendly_units' in sel && sel.all_friendly_units) {
    return collectArena(ctx, [ctx.sourcePlayer], ARENA_ZONES, sel.filter);
  }
  if ('attached_to_self' in sel && sel.attached_to_self) {
    // Upgrade abilities target their host. The "self" of an upgrade is the
    // upgrade itself; the host is the unit whose `upgrades[]` contains it.
    if (!ctx.sourceIid) return [];
    for (const pid of ctx.state.playerOrder) {
      const ps = ctx.state.players[pid];
      if (!ps) continue;
      for (const z of ARENA_ZONES) {
        const arr = ps[z === 'ground_arena' ? 'groundArena' : 'spaceArena'];
        for (const host of arr) {
          if (host.upgrades.some(u => u.iid === ctx.sourceIid)) {
            // Optional host gate ("If attached unit is a Sith, …").
            if (sel.filter && !evalCardPredicate(sel.filter, ctx, host, pid, z)) return [];
            return [{ kind: 'unit', iid: host.iid, controller: pid }];
          }
        }
      }
    }
    return [];
  }
  if ('exclude' in sel && sel.exclude) {
    const from = resolveSelector(ctx, sel.from);
    const excl = new Set(resolveSelector(ctx, sel.exclude).map(t => keyOf(t)));
    return from.filter(t => !excl.has(keyOf(t)));
  }

  // Scoped form
  const scoped = sel as ScopedSelector;
  const players = resolveScopedPlayers(ctx, scoped.controller);
  // `host_arena` (upgrade abilities: "a unit in attached unit's arena") resolves
  // to whichever arena the upgrade's host sits in. Empty if no host found.
  let zones: Zone[];
  if (scoped.zone === 'host_arena') {
    const hostZone = upgradeHostArena(ctx);
    zones = hostZone ? [hostZone] : [];
  } else {
    zones = expandZones(scoped.zone);
  }
  const candidates = collectArena(ctx, players, zones, scoped.filter);

  if (scoped.selector === 'all' || scoped.count === 'all') return candidates;

  // If no selector mode is given, default to ALL matching (the natural reading
  // of "each friendly clone unit gets +1/+1" or "all enemy units take 1
  // damage"). The selector becomes restrictive only when the spec explicitly
  // says "chosen" (which forces a count and surfaces a choice prompt).
  if (!scoped.selector && !scoped.count) return candidates;

  // 'chosen' goes through the configured Chooser. If a candidate list is
  // empty the chooser doesn't run — caller treats as no-op.
  if (scoped.selector === 'chosen' || scoped.selector === 'self_choose' || scoped.selector === 'opponent_choose') {
    if (candidates.length === 0) return [];
    const desiredCount = countOf(scoped.count) ?? 1;
    const chooser = ctx.chooser ?? defaultChooser;
    const who = (scoped.selector === 'opponent_choose')
      ? (ctx.state.playerOrder.find(p => p !== ctx.sourcePlayer) ?? ctx.sourcePlayer)
      : ctx.sourcePlayer;
    // A numeric `count: N` is a MANDATORY pick ("Give a token to an Imperial
    // unit" / "Deal 2 damage to an enemy unit") — the player must select N
    // targets (or all candidates if fewer than N). A range `{ min, max }`
    // carries its own explicit minimum (min 0 = optional, e.g. "up to N").
    // Without this, a numeric count produced minCount 0, which let the UI
    // confirm a mandatory single-target effect with NOTHING selected — the
    // effect silently fizzled while the cost was still paid (UAT: Tarkin's
    // Experience action spent a resource but assigned no token).
    const countRange = (typeof scoped.count === 'object' && scoped.count !== null) ? scoped.count : null;
    const minCount = countRange ? (countRange.min ?? 0) : Math.min(desiredCount, candidates.length);
    const canPass = countRange !== null && (countRange.min ?? 0) === 0;
    const result = chooser({
      kind: 'prompt_target',
      prompt: `Choose ${desiredCount} target${desiredCount > 1 ? 's' : ''}`,
      candidates,
      count: desiredCount,
      minCount,
      player: who,
      canPass,
    });
    if (result.kind === 'pass' || result.kind === 'no') return [];
    if (result.kind === 'targets') return result.targets.slice(0, desiredCount);
    return candidates.slice(0, desiredCount);
  }

  // 'random' / explicit count without selector → take first N for now;
  // random ships when we add an RNG-aware chooser.
  const count = countOf(scoped.count) ?? 1;
  return candidates.slice(0, count);
}

/** The arena (ground/space) the upgrade source's host unit sits in, or undefined
 *  if the source isn't an attached upgrade. */
function upgradeHostArena(ctx: EvalCtx): Zone | undefined {
  if (!ctx.sourceIid) return undefined;
  for (const pid of ctx.state.playerOrder) {
    const ps = ctx.state.players[pid];
    if (!ps) continue;
    for (const z of ARENA_ZONES) {
      const arr = ps[z === 'ground_arena' ? 'groundArena' : 'spaceArena'];
      if (arr.some(host => host.upgrades.some(u => u.iid === ctx.sourceIid))) return z;
    }
  }
  return undefined;
}

function keyOf(t: ResolvedTarget): string {
  return t.kind === 'unit' ? `u:${t.iid}` : `b:${t.controller}`;
}

function collectArena(ctx: EvalCtx, players: PlayerId[], zones: Zone[], filter: Predicate | undefined): ResolvedTarget[] {
  const out: ResolvedTarget[] = [];
  for (const pid of players) {
    const ps = ctx.state.players[pid];
    if (!ps) continue;
    for (const z of zones) {
      if (z === 'base_zone' || z === 'leader_unit' || z === 'capture_zone' || z === 'set_aside') continue;
      const arr = getZoneArr(ps, z);
      for (const c of arr) {
        if (evalCardPredicate(filter, ctx, c, pid, z)) {
          out.push({ kind: 'unit', iid: c.iid, controller: pid });
        }
      }
    }
  }
  return out;
}

function countOf(c: ScopedSelector['count']): number | undefined {
  if (typeof c === 'number') return c;
  if (c === 'all' || c === undefined) return undefined;
  return c.max ?? c.min;
}

function triggerSourceIid(ctx: EvalCtx): string | undefined {
  const e = ctx.triggerEvent;
  if (!e) return undefined;
  switch (e.kind) {
    case 'CARD_PLAYED':       return e.iid;
    case 'DEFEATED':          return e.iid;
    case 'ATTACK_DECLARED':   return e.attackerIid;
    case 'ATTACK_ENDED':      return e.attackerIid;
    default: return undefined;
  }
}

import type { Predicate } from '../spec/ast';
import type { CardSpec } from '../spec/types';
// Helper used by other runtime files — find a unit instance and its controller
// given a ResolvedTarget. Kept here because selectors + this lookup form one
// "address book" concern.
export function lookupTarget(state: GameState, target: ResolvedTarget): { inst?: CardInstance; controller: PlayerId } {
  if (target.kind === 'base') return { controller: target.controller };
  const ps = state.players[target.controller];
  if (!ps) return { controller: target.controller };
  for (const z of ARENA_ZONES) {
    const arr = getZoneArr(ps, z);
    const f = arr.find(c => c.iid === target.iid);
    if (f) return { inst: f, controller: target.controller };
  }
  return { controller: target.controller };
}

// Re-export for consumers that need to read card specs from a target without
// importing types separately.
export type { CardSpec };
