// combat.damage / combat.heal / combat.defeat for units and bases.
// Defeat-on-zero-hp is enforced by the state-based fixpoint, not here —
// these primitives only place damage counters.

import type { CardInstance, CardRegistry, GameState, PlayerId } from '../state/types';
import type { CardSnapshot, GameEvent } from '../state/bus';
import { findCard, mapInstance, withPlayer } from '../state/zones';
import { effectivePower, effectiveHp } from '../runtime/modifiers';

export interface DamageOpts { combat?: boolean; indirect?: boolean; unpreventable?: boolean }

export function damageUnit(
  state: GameState,
  _reg: CardRegistry,
  targetIid: string,
  amount: number,
  opts: DamageOpts = {},
  sourceIid?: string,
): { state: GameState; events: GameEvent[] } {
  if (amount <= 0) return { state, events: [] };

  const found = findCard(state, targetIid);
  if (!found) return { state, events: [] };

  const combat = !!opts.combat;
  const indirect = !!opts.indirect;
  let appliedAmount = amount;
  const events: GameEvent[] = [];

  // Shield absorption (Week 1: each shield blocks 1 instance of damage entirely
  // per §v7 7.5.12 — Shield is a token upgrade with a replacement effect; the
  // replacement layer doesn't ship until Week 3 so we implement the common
  // case here as a hard-coded primitive shortcut.
  // Indirect damage ignores shields per §v7 8.35.2.A.)
  if (!indirect && found.inst.shieldTokens > 0) {
    appliedAmount = 0;
    const next = mapInstance(state, targetIid, c => ({ ...c, shieldTokens: c.shieldTokens - 1 }));
    events.push({ kind: 'DAMAGE_PREVENTED', targetIid, amount, by: 'shield' });
    events.push({ kind: 'SHIELD_DEFEATED', iid: targetIid });
    return { state: next, events };
  }

  const next = mapInstance(state, targetIid, c => ({ ...c, damage: c.damage + appliedAmount }));
  events.push({ kind: 'DAMAGE_DEALT', sourceIid, targetIid, amount: appliedAmount, combat, indirect });
  return { state: next, events };
}

export function damageBase(
  state: GameState,
  _reg: CardRegistry,
  basePlayer: PlayerId,
  amount: number,
  opts: DamageOpts = {},
  sourceIid?: string,
): { state: GameState; events: GameEvent[] } {
  if (amount <= 0) return { state, events: [] };
  const p = state.players[basePlayer];
  const newP = { ...p, base: { ...p.base, damage: p.base.damage + amount } };
  const next = withPlayer(state, basePlayer, newP);
  return {
    state: next,
    events: [{
      kind: 'DAMAGE_DEALT',
      sourceIid,
      targetIid: { base: basePlayer },
      amount,
      combat: !!opts.combat,
      indirect: !!opts.indirect,
    }],
  };
}

export function healUnit(
  state: GameState,
  targetIid: string,
  amount: number,
): { state: GameState; events: GameEvent[] } {
  if (amount <= 0) return { state, events: [] };
  const next = mapInstance(state, targetIid, c => ({ ...c, damage: Math.max(0, c.damage - amount) }));
  return { state: next, events: [{ kind: 'HEALED', targetIid, amount }] };
}

export function healBase(
  state: GameState,
  basePlayer: PlayerId,
  amount: number,
  reg: CardRegistry,
): { state: GameState; events: GameEvent[] } {
  if (amount <= 0) return { state, events: [] };
  const p = state.players[basePlayer];
  const baseSpec = reg.bases[p.base.cardId];
  const maxHp = baseSpec?.hp ?? 30;
  const newDamage = Math.max(0, p.base.damage - amount);
  const cappedDelta = Math.min(amount, p.base.damage);
  if (cappedDelta === 0) return { state, events: [] };
  const next = withPlayer(state, basePlayer, { ...p, base: { ...p.base, damage: Math.min(maxHp, newDamage) } });
  return { state: next, events: [{ kind: 'HEALED', targetIid: { base: basePlayer }, amount: cappedDelta }] };
}

// Snapshot a card's effective stats for "When Defeated" abilities per §v7 8.11.
export function snapshot(
  state: GameState,
  reg: CardRegistry,
  inst: CardInstance,
  ownerId: PlayerId,
): CardSnapshot {
  return {
    cardId: inst.cardId,
    power: effectivePower(state, reg, inst, ownerId),
    hp: effectiveHp(state, reg, inst, ownerId),
    damage: inst.damage,
    controller: ownerId,
  };
}
