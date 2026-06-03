// Combat core — the "Attack With a Unit" resolution (§ Attack steps: Declare,
// Deal combat damage, Complete). Extracted so BOTH callers share one code path:
//   • reducer.applyAttack — the player's ATTACK action (validates active-player /
//     phase / ready, then advances the turn around this core).
//   • interpret `attack` effect — a NESTED attack from an ability (§7.6.12);
//     resolves sequentially and does NOT advance the turn. Per § "If an ability
//     triggers multiple attacks, resolve them sequentially" and "only ready units
//     may perform an attack, unless otherwise specified" — a nested attack may be
//     made by an already-exhausted attacker (the ability is the "otherwise").
//
// This core does NOT run state-based actions or settle triggers itself; the
// surrounding step()/settle() (reducer) or the enclosing effect resolution
// (interpreter, whose events bubble up to settle()) handles that. It returns the
// raw ATTACK_DECLARED / combat / ATTACK_ENDED events.

import type { CardRegistry, GameState, PlayerId } from '../state/types';
import type { GameEvent } from '../state/bus';
import type { LastingEffectRec } from '../state/effects';
import type { CardSpec } from '../spec/types';
import { findCard, getZoneArr, mapInstance } from '../state/zones';
import { exhaust } from '../primitives/state';
import { dealDamageToBase, dealDamageToUnit } from './damage';
import { effectivePower, effectiveHp, hasEffectiveKeyword, effectiveKeywordValue } from './modifiers';
import { KEYWORDS, defeatDefenderShields } from '../primitives/keywords';
import { defaultChooser, type Chooser } from './chooser';

function log(state: GameState, message: string, player?: PlayerId, kind: 'info' | 'critical' = 'info'): GameState {
  return { ...state, log: [...state.log, { round: state.round, player, message, kind }] };
}

function specKeywords(spec: CardSpec | undefined): { name: string; value?: number }[] {
  if (!spec) return [];
  if (spec.type === 'unit' || spec.type === 'upgrade' || spec.type === 'token') {
    return (spec.keywords ?? []).map(k => ({ name: k.name.toLowerCase(), value: k.value }));
  }
  return [];
}

function expireLastingEffects(state: GameState, kind: LastingEffectRec['expiry']): GameState {
  const before = state.lastingEffects as LastingEffectRec[];
  const after = before.filter(le => le.expiry !== kind);
  if (after.length === before.length) return state;
  return { ...state, lastingEffects: after };
}

/** Is this attack legal to even declare? (Sentinel restriction.) Returns an
 *  error string, or null if legal. Used by callers that want to skip rather than
 *  throw (the nested-attack effect). */
export function attackIllegalReason(
  state: GameState, pid: PlayerId, reg: CardRegistry,
  attackerIid: string, defenderIid: string | 'base',
): string | null {
  const attackerFound = findCard(state, attackerIid);
  if (!attackerFound) return `Attacker ${attackerIid} not found`;
  if (attackerFound.loc.controller !== pid) return `${pid} does not control attacker`;
  const attackerZone = attackerFound.loc.zone;
  if (attackerZone !== 'ground_arena' && attackerZone !== 'space_arena') return `Attacker must be in an arena`;
  const oppId = state.playerOrder.find(p => p !== pid);
  if (!oppId) return `No opponent`;

  const attackerHasSaboteur = hasEffectiveKeyword(state, reg, attackerFound.inst, pid, 'saboteur');
  if (!attackerHasSaboteur) {
    const oppArena = getZoneArr(state.players[oppId], attackerZone);
    const sentinels = oppArena.filter(c => hasEffectiveKeyword(state, reg, c, oppId, 'sentinel'));
    if (sentinels.length > 0) {
      const sentinelIids = new Set(sentinels.map(c => c.iid));
      if (defenderIid === 'base' || !sentinelIids.has(defenderIid)) {
        return `Sentinel forces attack at a Sentinel unit`;
      }
    }
  }
  if (defenderIid !== 'base') {
    const defenderFound = findCard(state, defenderIid);
    if (!defenderFound) return `Defender ${defenderIid} not found`;
    if (defenderFound.loc.controller === pid) return `Cannot attack friendly unit`;
    if (defenderFound.loc.zone !== attackerZone) return `Defender must share attacker's arena`;
  }
  return null;
}

/** Resolve one attack (combat core). Assumes the caller has validated turn /
 *  phase. Exhausts the attacker (no-op if already exhausted — the nested case).
 *  Does NOT advance the turn or run state-based / triggers. */
export function resolveAttack(
  state: GameState, pid: PlayerId,
  attackerIid: string, defenderIid: string | 'base',
  reg: CardRegistry,
  chooser?: Chooser,
): { state: GameState; events: GameEvent[] } {
  const attackerFound = findCard(state, attackerIid);
  if (!attackerFound) throw new Error(`Attacker ${attackerIid} not found`);
  const attackerZone = attackerFound.loc.zone;
  if (attackerZone !== 'ground_arena' && attackerZone !== 'space_arena') {
    throw new Error(`Attacker must be in an arena`);
  }
  const oppId = state.playerOrder.find(p => p !== pid)!;

  let s = state;
  const events: GameEvent[] = [];

  s = exhaust(s, attackerIid).state;

  // Raid: extra power while attacking.
  const raidVal = effectiveKeywordValue(s, reg, attackerFound.inst, pid, 'raid') ?? 0;
  const basePower = effectivePower(s, reg, attackerFound.inst, pid);
  const attackerPower = basePower + raidVal;

  events.push({ kind: 'ATTACK_DECLARED', attackerIid, defenderIid, defendingPlayer: oppId });

  // Keyword onAttack hooks fire BEFORE combat damage per §v7 7.6.15.A.
  for (const kw of specKeywords(reg.cards[attackerFound.inst.cardId])) {
    const def = KEYWORDS[kw.name];
    if (def?.onAttack) {
      const here = findCard(s, attackerIid);
      if (!here) continue;
      const r = def.onAttack({ state: s, reg, inst: here.inst, owner: pid, value: kw.value });
      s = r.state;
      events.push(...r.events);
    }
  }
  const attackerHasSaboteur = hasEffectiveKeyword(s, reg, attackerFound.inst, pid, 'saboteur');
  if (attackerHasSaboteur && defenderIid !== 'base') {
    const r = defeatDefenderShields(s, defenderIid);
    s = r.state;
    events.push(...r.events);
  }

  if (defenderIid === 'base') {
    const dmg = dealDamageToBase(s, reg, oppId, attackerPower, { combat: true }, attackerIid, chooser);
    s = dmg.state;
    events.push(...dmg.events);
    events.push({ kind: 'ATTACK_ENDED', attackerIid, defenderIid: 'base', damageDealt: attackerPower });
    s = log(s, `${pid} attacks base for ${attackerPower}${raidVal ? ` (Raid ${raidVal})` : ''}.`, pid, attackerPower >= 5 ? 'critical' : 'info');
  } else {
    const defenderFound = findCard(s, defenderIid);
    if (!defenderFound) throw new Error(`Defender ${defenderIid} not found`);
    // Power snapshot for the SIMULTANEOUS case (§7.5.6c): both deal damage
    // computed BEFORE any lands, so a defender with Grit gets no bonus.
    const defenderPower = effectivePower(s, reg, defenderFound.inst, oppId);
    const defenderHpBefore = effectiveHp(s, reg, defenderFound.inst, oppId) - defenderFound.inst.damage;

    // "Deals combat damage before the defender" (§1618c / §7.5.6d): the attacker
    // deals first; the defender (the unit dealing second) must SURVIVE that damage
    // to deal combat damage back. If defeated, it deals none.
    const attackerDealsFirst = hasEffectiveKeyword(s, reg, attackerFound.inst, pid, 'attacker_combat_first');

    const d1 = dealDamageToUnit(s, reg, defenderIid, attackerPower, { combat: true }, attackerIid, chooser);
    s = d1.state;
    events.push(...d1.events);

    if (attackerDealsFirst) {
      // Did the defender survive the first damage?
      const dn = findCard(s, defenderIid);
      const defenderSurvives = !!dn && (effectiveHp(s, reg, dn.inst, oppId) - dn.inst.damage) > 0;
      if (defenderSurvives) {
        // Recompute the defender's power AFTER taking damage so a Grit defender
        // gets the bonus from the damage just dealt to it (§7.5.6d).
        const returnPower = effectivePower(s, reg, dn!.inst, oppId);
        const d2 = dealDamageToUnit(s, reg, attackerIid, returnPower, { combat: true }, defenderIid, chooser);
        s = d2.state;
        events.push(...d2.events);
      }
      // else: defender defeated by the first damage → no combat damage in return.
    } else {
      const d2 = dealDamageToUnit(s, reg, attackerIid, defenderPower, { combat: true }, defenderIid, chooser);
      s = d2.state;
      events.push(...d2.events);
    }

    const attackerHasOverwhelm = hasEffectiveKeyword(s, reg, attackerFound.inst, pid, 'overwhelm');
    if (attackerHasOverwhelm) {
      const shieldBlocked = d1.events.some(e => e.kind === 'DAMAGE_PREVENTED');
      const excess = attackerPower - Math.max(0, defenderHpBefore);
      if (!shieldBlocked && excess > 0 && defenderHpBefore <= attackerPower) {
        const ow = dealDamageToBase(s, reg, oppId, excess, { combat: true }, attackerIid, chooser);
        s = ow.state;
        events.push(...ow.events);
        s = log(s, `Overwhelm: ${excess} excess damage to base.`, pid);
      }
    }

    events.push({ kind: 'ATTACK_ENDED', attackerIid, defenderIid, damageDealt: attackerPower });
    s = log(s, `${pid} attacks ${defenderIid} (${attackerPower} vs ${defenderPower})${attackerDealsFirst ? ' — deals damage first' : ''}.`, pid);
  }

  s = expireLastingEffects(s, 'end_of_attack');
  return { state: s, events };
}

/** Ambush (§7.5.5): after a unit with Ambush enters play, its controller MAY
 *  ready it and attack an enemy unit — resolved as a nested attack in the same
 *  window as When-Played. Per §7.5.5c the unit can only ready/attack if there is
 *  an enemy unit it can attack (Ambush targets a UNIT, not the base); with no
 *  legal enemy unit this is a no-op (the unit stays exhausted). The "may" is
 *  surfaced as an `optional` prompt to the chooser.
 *
 *  Called from the play / deploy / create sites (which have the chooser); the
 *  keyword's own onPlay/onDeploy/onCreate hooks no longer ready the unit so this
 *  is the single source of truth for Ambush.
 */
export function resolveAmbush(
  state: GameState, reg: CardRegistry, iid: string, pid: PlayerId, chooser?: Chooser,
): { state: GameState; events: GameEvent[] } {
  const f = findCard(state, iid);
  if (!f) return { state, events: [] };
  if (!hasEffectiveKeyword(state, reg, f.inst, pid, 'ambush')) return { state, events: [] };

  const arena = f.loc.zone;
  if (arena !== 'ground_arena' && arena !== 'space_arena') return { state, events: [] };
  const oppId = state.playerOrder.find(p => p !== pid);
  if (!oppId) return { state, events: [] };

  // Eligible enemy UNITS in this arena that the attack would be legal against
  // (honors Sentinel). Base is NOT an Ambush target (§7.5.5a "attack that enemy unit").
  const targets = getZoneArr(state.players[oppId], arena)
    .filter(c => attackIllegalReason(state, pid, reg, iid, c.iid) === null)
    .map(c => c.iid);
  if (targets.length === 0) return { state, events: [] }; // §7.5.5c: can't ready with no target

  const chooseFn = chooser ?? defaultChooser;
  // "You may" — offer to decline.
  const may = chooseFn({ kind: 'optional', prompt: 'Ambush: ready and attack an enemy unit?', player: pid });
  if (may.kind === 'no' || may.kind === 'pass') return { state, events: [] };

  // Ready, then pick a target and attack (nested — resolveAttack ignores ready).
  let s = mapInstance(state, iid, c => ({ ...c, exhausted: false }));
  const events: GameEvent[] = [{ kind: 'READIED', iid }];
  const options = targets.map(t => ({ label: reg.cards[findCard(s, t)!.inst.cardId]?.name ?? t, value: t }));
  const pick = chooseFn({ kind: 'choose_one', prompt: 'Ambush: choose an enemy unit to attack', options, player: pid, canPass: false });
  const defenderIid = pick.kind === 'option' ? pick.value : options[0].value;
  const r = resolveAttack(s, pid, iid, defenderIid, reg, chooseFn);
  s = r.state;
  events.push(...r.events);
  return { state: s, events };
}
