import { Card, SavedDeck } from '@/lib/api';
import {
  GameConfig, GameState, PlayerConfig, PlayerState,
  CardInstance, LeaderInstance, BaseInstance,
  PlayerId, ArenaId, LogEntry,
} from './types';
import { GameAction } from './actions';
import {
  hasKeyword, getKeywordValue, computePower, effectiveHealth,
  hasEffectiveKeyword, getEffectiveKeywordValue, getActiveCoordinateEffects,
  dispatchOnPlay, dispatchOnDefeated, applyAttackFilters,
} from './keywords';
import {
  LEADER_ABILITIES, AbilityEffect, TargetKind, getEventEffect,
} from './abilities';

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

function uid(state: GameState): [string, GameState] {
  const iid = `i${state._nextIid}`;
  return [iid, { ...state, _nextIid: state._nextIid + 1 }];
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function opponent(p: PlayerId): PlayerId {
  return p === 'player1' ? 'player2' : 'player1';
}

function log(state: GameState, player: PlayerId | undefined, message: string): GameState {
  const isDestroy = message.includes('destroyed') || message.includes('eliminated') || message.includes('defeated');
  const entry: LogEntry = {
    round: state.round,
    player,
    message,
    time: new Date().toLocaleTimeString(),
    ...(isDestroy ? { kind: 'critical' as const } : {}),
  };
  return { ...state, actionLog: [...state.actionLog, entry] };
}

function cardInstance(card: Card, iid: string): CardInstance {
  return { iid, card, exhausted: false, damage: 0, upgrades: [], shieldTokens: 0 };
}

/** Ground unless the card only lists Space */
function arenaFor(card: Card): ArenaId {
  const arenas = card.arenas ?? [];
  if (arenas.length === 1 && arenas[0].toLowerCase() === 'space') return 'space';
  return 'ground';
}

function baseHealth(card: Card): number {
  return card.health ?? 30;
}

// Mutate helpers — always return new state (never mutate in place)

function updatePlayer(state: GameState, id: PlayerId, fn: (p: PlayerState) => PlayerState): GameState {
  return { ...state, players: { ...state.players, [id]: fn(state.players[id]) } };
}

function mapArena(
  state: GameState,
  ownerId: PlayerId,
  arena: ArenaId,
  fn: (c: CardInstance) => CardInstance,
): GameState {
  return updatePlayer(state, ownerId, p => ({
    ...p,
    groundArena: arena === 'ground' ? p.groundArena.map(fn) : p.groundArena,
    spaceArena:  arena === 'space'  ? p.spaceArena.map(fn)  : p.spaceArena,
  }));
}

function findCard(
  state: GameState,
  iid: string,
): { card: CardInstance; owner: PlayerId; arena: ArenaId | 'hand' | 'discard' } | undefined {
  for (const pid of ['player1', 'player2'] as PlayerId[]) {
    const p = state.players[pid];
    for (const c of p.groundArena) if (c.iid === iid) return { card: c, owner: pid, arena: 'ground' };
    for (const c of p.spaceArena)  if (c.iid === iid) return { card: c, owner: pid, arena: 'space' };
    for (const c of p.hand)        if (c.iid === iid) return { card: c, owner: pid, arena: 'hand' };
    for (const c of p.discard)     if (c.iid === iid) return { card: c, owner: pid, arena: 'discard' };
  }
  return undefined;
}

function removeFromArena(state: GameState, ownerId: PlayerId, iid: string): GameState {
  return updatePlayer(state, ownerId, p => ({
    ...p,
    groundArena: p.groundArena.filter(c => c.iid !== iid),
    spaceArena:  p.spaceArena.filter(c => c.iid !== iid),
  }));
}

function addToArena(state: GameState, ownerId: PlayerId, arena: ArenaId, inst: CardInstance): GameState {
  return updatePlayer(state, ownerId, p => ({
    ...p,
    groundArena: arena === 'ground' ? [...p.groundArena, inst] : p.groundArena,
    spaceArena:  arena === 'space'  ? [...p.spaceArena, inst]  : p.spaceArena,
  }));
}

function addToDiscard(state: GameState, ownerId: PlayerId, inst: CardInstance): GameState {
  return updatePlayer(state, ownerId, p => ({ ...p, discard: [...p.discard, inst] }));
}

function removeFromHand(state: GameState, ownerId: PlayerId, iid: string): GameState {
  return updatePlayer(state, ownerId, p => ({ ...p, hand: p.hand.filter(c => c.iid !== iid) }));
}

/** Map a CardInstance anywhere in both players' arenas (by iid). */
function mapCardInArenas(
  state: GameState,
  iid: string,
  fn: (c: CardInstance) => CardInstance,
): GameState {
  const mapArr = (arr: CardInstance[]) => arr.map(c => c.iid === iid ? fn(c) : c);
  return {
    ...state,
    players: {
      player1: {
        ...state.players.player1,
        groundArena: mapArr(state.players.player1.groundArena),
        spaceArena:  mapArr(state.players.player1.spaceArena),
      },
      player2: {
        ...state.players.player2,
        groundArena: mapArr(state.players.player2.groundArena),
        spaceArena:  mapArr(state.players.player2.spaceArena),
      },
    },
  };
}

/**
 * Returns the iids (or the string 'base') of all units that satisfy targetKind
 * from the perspective of playerId.
 */
function getValidTargets(
  state: GameState,
  playerId: PlayerId,
  targetKind: TargetKind,
): string[] {
  const opp = opponent(playerId);
  const me  = state.players[playerId];
  const oppPlayer = state.players[opp];

  switch (targetKind) {
    case 'FRIENDLY_UNIT':
      return [...me.groundArena, ...me.spaceArena].map(c => c.iid);
    case 'ENEMY_UNIT':
      return [...oppPlayer.groundArena, ...oppPlayer.spaceArena].map(c => c.iid);
    case 'ANY_UNIT':
      return [
        ...me.groundArena, ...me.spaceArena,
        ...oppPlayer.groundArena, ...oppPlayer.spaceArena,
      ].map(c => c.iid);
    case 'ENEMY_UNIT_OR_BASE':
      return [
        ...oppPlayer.groundArena, ...oppPlayer.spaceArena,
      ].map(c => c.iid).concat(['base']);
  }
}

/**
 * Immediately defeat a unit by iid — bypasses damage thresholds, goes straight
 * to discard. Calls dispatchOnDefeated, clears deployed-leader link, and checks
 * win condition. Callers log the action before calling this.
 */
function defeatUnitByIid(state: GameState, iid: string): GameState {
  const found = findCard(state, iid);
  if (!found || (found.arena !== 'ground' && found.arena !== 'space')) return state;
  let s = state;
  s = dispatchOnDefeated(s, found.card, found.owner);
  s = removeFromArena(s, found.owner, iid);
  s = addToDiscard(s, found.owner, found.card);
  s = log(s, undefined, `${found.card.card.name} is defeated.`);
  s = updatePlayer(s, found.owner, p => ({
    ...p,
    leaders: p.leaders.map(l =>
      l.unitIid === iid ? { ...l, unitIid: undefined, isDeployed: false } : l,
    ),
  }));
  return checkWinCondition(s);
}

/**
 * Resolve a single AbilityEffect in the current state.
 * playerId is the player who triggered the effect.
 * targetIid is the chosen target iid (or 'base' for opponent's base).
 */
function applyAbilityEffect(
  state: GameState,
  playerId: PlayerId,
  effect: AbilityEffect,
  targetIid?: string,
): GameState {
  const opp = opponent(playerId);
  let s = state;

  switch (effect.type) {
    case 'DRAW': {
      s = updatePlayer(s, playerId, p => {
        const draws = Math.min(effect.count, p.deck.length);
        return {
          ...p,
          hand: [...p.hand, ...p.deck.slice(0, draws)],
          deck: p.deck.slice(draws),
        };
      });
      s = log(s, playerId, `Drew ${effect.count} card(s).`);
      break;
    }
    case 'PHASE_BUFF_UNIT': {
      if (!targetIid) break;
      s = mapCardInArenas(s, targetIid, c => ({
        ...c,
        phaseAtk: (c.phaseAtk ?? 0) + effect.atk,
        phaseHp:  (c.phaseHp  ?? 0) + effect.hp,
      }));
      const fmtStat = (n: number) => (n >= 0 ? `+${n}` : `${n}`);
      const parts: string[] = [];
      if (effect.atk !== 0) parts.push(`${fmtStat(effect.atk)} attack`);
      if (effect.hp  !== 0) parts.push(`${fmtStat(effect.hp)} HP`);
      s = log(s, playerId, `Gave unit ${parts.join(', ')} until end of phase.`);
      break;
    }
    case 'DEAL_DAMAGE_UNIT': {
      if (!targetIid) break;
      s = mapCardInArenas(s, targetIid, c => ({ ...c, damage: c.damage + effect.amount }));
      s = log(s, playerId, `Dealt ${effect.amount} damage to a unit.`);
      s = checkDefeated(s);
      break;
    }
    case 'DEAL_DAMAGE_ANY': {
      if (!targetIid) break;
      if (targetIid === 'base') {
        s = updatePlayer(s, opp, p => ({
          ...p, base: { ...p.base, damage: p.base.damage + effect.amount },
        }));
        s = log(s, playerId, `Dealt ${effect.amount} damage to opponent's base.`);
      } else {
        s = mapCardInArenas(s, targetIid, c => ({ ...c, damage: c.damage + effect.amount }));
        s = log(s, playerId, `Dealt ${effect.amount} damage to a unit.`);
        s = checkDefeated(s);
      }
      break;
    }
    case 'HEAL_BASE': {
      s = updatePlayer(s, playerId, p => ({
        ...p, base: { ...p.base, damage: Math.max(0, p.base.damage - effect.amount) },
      }));
      s = log(s, playerId, `Healed own base for ${effect.amount}.`);
      break;
    }
    case 'EXHAUST_UNIT': {
      if (!targetIid) break;
      s = mapCardInArenas(s, targetIid, c => ({ ...c, exhausted: true }));
      s = log(s, playerId, `Exhausted a unit.`);
      break;
    }
    case 'GIVE_SHIELD_FRIENDLY': {
      if (!targetIid) break;
      s = mapCardInArenas(s, targetIid, c => ({ ...c, shieldTokens: c.shieldTokens + 1 }));
      s = log(s, playerId, `Gave a shield token to a unit.`);
      break;
    }
    case 'DEAL_DAMAGE_OPP_BASE': {
      // No target selection — always damages the opponent's base directly.
      s = updatePlayer(s, opp, p => ({
        ...p, base: { ...p.base, damage: p.base.damage + effect.amount },
      }));
      s = log(s, playerId, `Dealt ${effect.amount} damage to opponent's base.`);
      s = checkWinCondition(s);
      break;
    }
    case 'DEFEAT_UNIT': {
      if (!targetIid) break;
      s = log(s, playerId, `Defeated a unit with an event.`);
      s = defeatUnitByIid(s, targetIid);
      break;
    }
    case 'TRIGGER_ATTACK_WITH': {
      // Handled entirely by applyPlayAttackEvent — should never reach here.
      break;
    }
  }

  return s;
}

// ---------------------------------------------------------------------------
// Initialisation
// ---------------------------------------------------------------------------

function initPlayer(config: PlayerConfig, baseIid: number): [PlayerState, number] {
  let iidCounter = baseIid;
  const nextIid = () => `i${iidCounter++}`;

  const deckInstances: CardInstance[] = shuffle(config.deck).map(c =>
    cardInstance(c, nextIid()),
  );
  const hand = deckInstances.slice(0, 6);
  const deck  = deckInstances.slice(6);

  const leaders: LeaderInstance[] = config.leaders.map(c => ({
    card: c,
    isDeployed: false,
  }));

  const baseInst: BaseInstance = {
    card: config.base,
    damage: 0,
  };

  const player: PlayerState = {
    id: config.playerId,
    deck,
    hand,
    discard: [],
    resources: { total: 0, available: 0 },
    groundArena: [],
    spaceArena: [],
    leaders,
    base: baseInst,
    hasCountered: false,
    hasResourced: false,
    setupResourcesLeft: 2,
  };

  return [player, iidCounter];
}

function initState(config: GameConfig): GameState {
  let iidCounter = 0;

  const [p1, c1] = initPlayer(config.player1, iidCounter);
  const [p2, c2] = initPlayer(config.player2, c1);

  return {
    id: config.gameId ?? `game-${Date.now()}`,
    round: 1,
    activePlayer: 'player1',
    initiative: 'player1',
    phase: 'setup',
    players: { player1: p1, player2: p2 },
    actionLog: [{ round: 1, message: 'Setup — each player selects up to 2 cards to resource.', time: new Date().toLocaleTimeString() }],
    _nextIid: c2,
  };
}

// ---------------------------------------------------------------------------
// Win condition + cleanup
// ---------------------------------------------------------------------------

function checkWinCondition(state: GameState): GameState {
  const p1Dead = state.players.player1.base.damage >= baseHealth(state.players.player1.base.card);
  const p2Dead = state.players.player2.base.damage >= baseHealth(state.players.player2.base.card);
  if (p1Dead && p2Dead) return { ...state, winner: 'draw' };
  if (p1Dead) return { ...state, winner: 'player2' };
  if (p2Dead) return { ...state, winner: 'player1' };
  return state;
}

function checkDefeated(state: GameState): GameState {
  let s = state;

  for (const pid of ['player1', 'player2'] as PlayerId[]) {
    for (const arena of ['ground', 'space'] as ArenaId[]) {
      const units = arena === 'ground'
        ? s.players[pid].groundArena
        : s.players[pid].spaceArena;

      const defeated = units.filter(c => c.damage >= effectiveHealth(s, c, pid));

      for (const c of defeated) {
        s = dispatchOnDefeated(s, c, pid);
        s = removeFromArena(s, pid, c.iid);
        s = addToDiscard(s, pid, c);
        s = log(s, undefined, `${c.card.name} is defeated.`);

        // Clear deployed leader unit link
        s = updatePlayer(s, pid, p => ({
          ...p,
          leaders: p.leaders.map(l =>
            l.unitIid === c.iid ? { ...l, unitIid: undefined, isDeployed: false } : l,
          ),
        }));
      }
    }
  }

  return s;
}

// ---------------------------------------------------------------------------
// Legal actions
// ---------------------------------------------------------------------------

function getLegalActions(state: GameState, playerId: PlayerId): GameAction[] {
  if (state.winner) return [];

  // Setup phase: each player selects 0–2 cards before round 1 begins
  if (state.phase === 'setup') {
    if (state.activePlayer !== playerId) return [];
    const me = state.players[playerId];
    // Always offer "done" even if slots remain (player may choose to skip)
    const actions: GameAction[] = [{ type: 'END_REGROUP' }];
    if (me.setupResourcesLeft > 0) {
      for (const c of me.hand) {
        actions.push({ type: 'RESOURCE_CARD', iid: c.iid });
      }
    }
    return actions;
  }

  if (state.phase === 'regroup') {
    if (state.activePlayer !== playerId) return [];
    const me = state.players[playerId];
    const actions: GameAction[] = [{ type: 'END_REGROUP' }];
    if (!me.hasResourced) {
      for (const c of me.hand) {
        actions.push({ type: 'RESOURCE_CARD', iid: c.iid });
      }
    }
    return actions;
  }
  if (state.activePlayer !== playerId) return [];
  if (state.players[playerId].hasCountered) return [];

  const actions: GameAction[] = [];
  const me = state.players[playerId];

  // Always can take the counter
  actions.push({ type: 'TAKE_COUNTER' });

  // Play cards from hand
  for (const c of me.hand) {
    const cost = c.card.cost ?? c.card.energy_cost ?? 0;
    if (me.resources.available >= cost) {
      const cardType = c.card.type?.toLowerCase() ?? '';
      if (cardType === 'upgrade') {
        // Find friendly units to attach to
        const targets = [...me.groundArena, ...me.spaceArena];
        if (targets.length > 0) {
          for (const t of targets) {
            actions.push({ type: 'PLAY_CARD', iid: c.iid, targetIid: t.iid });
          }
        }
      } else if (cardType === 'event') {
        const evtDef = getEventEffect(c.card.name, c.card.text ?? '');
        if (!evtDef) {
          // Unknown event — allow playing but no effect
          actions.push({ type: 'PLAY_CARD', iid: c.iid });
        } else if (evtDef.effect.type === 'TRIGGER_ATTACK_WITH') {
          // Attack-event: PLAY_ATTACK_EVENT actions generated after attack filtering below.
          // Do NOT add a PLAY_CARD action for these — the two-step UI uses PLAY_ATTACK_EVENT.
        } else if (evtDef.targetKind) {
          // Targeted event — generate one action per valid target
          const targets = getValidTargets(state, playerId, evtDef.targetKind);
          for (const targetId of targets) {
            actions.push({ type: 'PLAY_CARD', iid: c.iid, targetIid: targetId });
          }
        } else {
          // No-target event
          actions.push({ type: 'PLAY_CARD', iid: c.iid });
        }
      } else {
        actions.push({ type: 'PLAY_CARD', iid: c.iid });
      }
    }
  }

  // Deploy leaders
  for (const leader of me.leaders) {
    if (!leader.isDeployed) {
      const cost = leader.card.cost ?? leader.card.energy_cost ?? 5;
      if (me.resources.available >= cost) {
        actions.push({ type: 'DEPLOY_LEADER', leaderCardId: leader.card.id });
      }
    }
  }

  // Leader abilities (non-deployed, non-exhausted, affordable)
  for (const leader of me.leaders) {
    if (leader.isDeployed || leader.exhausted) continue;
    const ability = LEADER_ABILITIES[leader.card.name];
    if (!ability) continue;
    if (me.resources.available < ability.resourceCost) continue;

    if (ability.targetKind) {
      const targets = getValidTargets(state, playerId, ability.targetKind);
      for (const targetId of targets) {
        actions.push({ type: 'LEADER_ABILITY', leaderCardId: leader.card.id, targetIid: targetId });
      }
    } else {
      actions.push({ type: 'LEADER_ABILITY', leaderCardId: leader.card.id });
    }
  }

  // Attack actions
  const opp = state.players[opponent(playerId)];
  const groundAttackers = me.groundArena.filter(c => !c.exhausted && !c.deployedThisTurn);
  const spaceAttackers  = me.spaceArena.filter(c => !c.exhausted && !c.deployedThisTurn);

  // Ground attackers → ground defenders or base
  for (const attacker of groundAttackers) {
    for (const defender of opp.groundArena) {
      actions.push({ type: 'ATTACK', attackerIid: attacker.iid, defenderIid: defender.iid });
    }
    actions.push({ type: 'ATTACK', attackerIid: attacker.iid, defenderIid: 'base' });
  }

  // Space attackers → space defenders or base
  for (const attacker of spaceAttackers) {
    for (const defender of opp.spaceArena) {
      actions.push({ type: 'ATTACK', attackerIid: attacker.iid, defenderIid: defender.iid });
    }
    actions.push({ type: 'ATTACK', attackerIid: attacker.iid, defenderIid: 'base' });
  }

  // Apply Sentinel and other attack filters first so PLAY_ATTACK_EVENT inherits constraints.
  const filteredActions = applyAttackFilters(state, actions, playerId);
  const filteredAttacks = filteredActions.filter(
    (a): a is Extract<GameAction, { type: 'ATTACK' }> => a.type === 'ATTACK',
  );

  // "Attack with a unit" events — generate one PLAY_ATTACK_EVENT per (event × attack) pair.
  const attackEventActions: GameAction[] = [];
  for (const c of me.hand) {
    if (c.card.type?.toLowerCase() !== 'event') continue;
    const cost = c.card.cost ?? c.card.energy_cost ?? 0;
    if (me.resources.available < cost) continue;
    const evtDef = getEventEffect(c.card.name, c.card.text ?? '');
    if (evtDef?.effect.type !== 'TRIGGER_ATTACK_WITH') continue;
    for (const atk of filteredAttacks) {
      attackEventActions.push({
        type: 'PLAY_ATTACK_EVENT',
        iid: c.iid,
        attackerIid: atk.attackerIid,
        defenderIid: atk.defenderIid,
      });
    }
  }

  return [...filteredActions, ...attackEventActions];
}

// ---------------------------------------------------------------------------
// Action handlers
// ---------------------------------------------------------------------------

function applyPlayCard(state: GameState, playerId: PlayerId, iid: string, targetIid?: string): GameState {
  const found = findCard(state, iid);
  if (!found || found.arena !== 'hand' || found.owner !== playerId) return state;

  const { card } = found;
  const cost = card.card.cost ?? card.card.energy_cost ?? 0;

  // Deduct resources
  let s = updatePlayer(state, playerId, p => ({
    ...p,
    resources: { ...p.resources, available: p.resources.available - cost },
  }));

  s = removeFromHand(s, playerId, iid);

  const type = card.card.type?.toLowerCase() ?? '';

  if (type === 'event') {
    // Look up effect via registry + parser fallback — if none, just discard with a note.
    const evtDef = getEventEffect(card.card.name, card.card.text ?? '');
    if (evtDef && evtDef.effect.type !== 'TRIGGER_ATTACK_WITH') {
      s = applyAbilityEffect(s, playerId, evtDef.effect, targetIid);
      s = log(s, playerId, `Played event: ${card.card.name}.`);
    } else if (!evtDef) {
      s = log(s, playerId, `Played event: ${card.card.name} (effect not yet implemented).`);
    }
    // TRIGGER_ATTACK_WITH events go through PLAY_ATTACK_EVENT — should not reach here.
    s = addToDiscard(s, playerId, { ...card, exhausted: true });
  } else if (type === 'upgrade' && targetIid) {
    // Attach upgrade to target unit
    const target = findCard(s, targetIid);
    if (target && target.owner === playerId) {
      s = mapArena(s, playerId, target.arena as ArenaId, c =>
        c.iid === targetIid
          ? { ...c, upgrades: [...c.upgrades, { ...card, exhausted: false }] }
          : c,
      );
      s = log(s, playerId, `Played upgrade ${card.card.name} on ${target.card.card.name}.`);
    }
  } else {
    // Unit (or unknown type) → place in arena, exhausted
    const arena = arenaFor(card.card);
    const inst: CardInstance = { ...card, exhausted: true };
    s = addToArena(s, playerId, arena, inst);
    s = dispatchOnPlay(s, inst, playerId);
    s = log(s, playerId, `Played unit: ${card.card.name} → ${arena} arena.`);
  }

  return switchActivePlayer(s, playerId);
}

function applyAttack(
  state: GameState,
  playerId: PlayerId,
  attackerIid: string,
  defenderIid: string | 'base',
): GameState {
  const attackerRef = findCard(state, attackerIid);
  if (!attackerRef || attackerRef.owner !== playerId) return state;

  const attacker = attackerRef.card;
  const opp = opponent(playerId);

  // Compute attacker power — base + Grit (live damage) + Raid (on-attack bonus)
  // Both Raid and Grit may be granted natively or via active Coordinate.
  const raidBonus   = getEffectiveKeywordValue(state, attacker, playerId, 'Raid') ?? 0;
  const attackPower = computePower(state, attacker, playerId) + raidBonus;

  // Coordinate on-attack effects — evaluated before damage so draw happens
  // at attack declaration and damage prevention is known before resolution.
  const coordEffects = getActiveCoordinateEffects(state, attacker, playerId);
  let preventSelfDamage = false;

  let s = state;

  for (const e of coordEffects) {
    if (e.type === 'ON_ATTACK_PREVENT_DAMAGE') {
      preventSelfDamage = true;
    }
    if (e.type === 'ON_ATTACK_DRAW') {
      // Draw cards from deck into hand (respects empty deck)
      s = updatePlayer(s, playerId, p => {
        const draws = Math.min(e.count, p.deck.length);
        return {
          ...p,
          hand: [...p.hand, ...p.deck.slice(0, draws)],
          deck: p.deck.slice(draws),
        };
      });
      s = log(s, playerId, `Coordinate — ${attacker.card.name}: drew ${e.count} card(s).`);
    }
  }

  // Exhaust attacker
  s = mapArena(s, playerId, attackerRef.arena as ArenaId, c =>
    c.iid === attackerIid ? { ...c, exhausted: true } : c,
  );

  if (defenderIid === 'base') {
    // Attack opponent's base directly
    let damage = attackPower;

    // Reduce by shield tokens if any on... base doesn't have shields, skip
    s = updatePlayer(s, opp, p => ({
      ...p,
      base: { ...p.base, damage: p.base.damage + damage },
    }));
    s = log(s, playerId, `${attacker.card.name} attacks base for ${damage} damage.`);

    // Restore: heal own base
    const restoreAmt = getKeywordValue(attacker.card, 'Restore') ?? 0;
    if (restoreAmt > 0) {
      s = updatePlayer(s, playerId, p => ({
        ...p,
        base: { ...p.base, damage: Math.max(0, p.base.damage - restoreAmt) },
      }));
      s = log(s, playerId, `Restore ${restoreAmt}: healed own base.`);
    }
  } else {
    // Attack a unit
    const defenderRef = findCard(s, defenderIid);
    if (!defenderRef || defenderRef.owner !== opp) return state;

    const defender = defenderRef.card;
    const defenderPower = defender.card.attack ?? 0;
    const defArena = defenderRef.arena as ArenaId;

    // Saboteur (native or Coordinate-granted): strip ALL shield tokens from the
    // defender before damage resolves. Track effective shield counts in locals
    // so absorption checks see the post-Saboteur values without stale reads.
    let defenderShields = defender.shieldTokens;
    if (hasEffectiveKeyword(s, attacker, playerId, 'Saboteur') && defenderShields > 0) {
      s = mapArena(s, opp, defArena, c =>
        c.iid === defenderIid ? { ...c, shieldTokens: 0 } : c,
      );
      s = log(s, playerId, `Saboteur: stripped ${defenderShields} shield(s) from ${defender.card.name}.`);
      defenderShields = 0;
    }

    // Shield absorption — attacker side
    // Aayla Secura's Coordinate effect prevents ALL combat damage to self.
    let attackerDamage = preventSelfDamage ? 0 : defenderPower;
    if (!preventSelfDamage && attacker.shieldTokens > 0) {
      s = mapArena(s, playerId, attackerRef.arena as ArenaId, c =>
        c.iid === attackerIid ? { ...c, shieldTokens: c.shieldTokens - 1 } : c,
      );
      attackerDamage = 0;
    }

    // Shield absorption — defender side
    let defenderDamage = attackPower;
    if (defenderShields > 0) {
      s = mapArena(s, opp, defArena, c =>
        c.iid === defenderIid ? { ...c, shieldTokens: c.shieldTokens - 1 } : c,
      );
      defenderDamage = 0;
    }

    // Apply damage simultaneously
    if (defenderDamage > 0) {
      s = mapArena(s, opp, defArena, c =>
        c.iid === defenderIid ? { ...c, damage: c.damage + defenderDamage } : c,
      );
    }
    if (attackerDamage > 0) {
      s = mapArena(s, playerId, attackerRef.arena as ArenaId, c =>
        c.iid === attackerIid ? { ...c, damage: c.damage + attackerDamage } : c,
      );
    }

    s = log(
      s, playerId,
      `${attacker.card.name} (${attackPower}) attacks ${defender.card.name} (${defenderPower}).`,
    );

    // Overwhelm: excess damage carries to opponent's base
    if (hasKeyword(attacker.card, 'Overwhelm')) {
      const defHealth = defender.card.health ?? 1;
      const defCurrentDamage = (defenderRef.card.damage) + defenderDamage;
      const excess = Math.max(0, defCurrentDamage - defHealth);
      if (excess > 0) {
        s = updatePlayer(s, opp, p => ({
          ...p,
          base: { ...p.base, damage: p.base.damage + excess },
        }));
        s = log(s, playerId, `Overwhelm: ${excess} excess damage to base.`);
      }
    }

    // Restore
    const restoreAmt = getKeywordValue(attacker.card, 'Restore') ?? 0;
    if (restoreAmt > 0) {
      s = updatePlayer(s, playerId, p => ({
        ...p,
        base: { ...p.base, damage: Math.max(0, p.base.damage - restoreAmt) },
      }));
      s = log(s, playerId, `Restore ${restoreAmt}: healed own base.`);
    }

    s = checkDefeated(s);
  }

  s = checkWinCondition(s);
  return switchActivePlayer(s, playerId);
}

function applyDeployLeader(state: GameState, playerId: PlayerId, leaderCardId: string): GameState {
  const me = state.players[playerId];
  const leader = me.leaders.find(l => l.card.id === leaderCardId && !l.isDeployed);
  if (!leader) return state;

  const cost = leader.card.cost ?? leader.card.energy_cost ?? 5;
  if (me.resources.available < cost) return state;

  let s = state;
  let iid: string;
  [iid, s] = uid(s);

  const arena = arenaFor(leader.card);
  const inst: CardInstance = {
    iid,
    card: { ...leader.card, image_uri: leader.card.image_back_uri ?? leader.card.image_uri },
    exhausted: true,
    damage: 0,
    upgrades: [],
    shieldTokens: 0,
    deployedThisTurn: true,
  };

  s = updatePlayer(s, playerId, p => ({
    ...p,
    resources: { ...p.resources, available: p.resources.available - cost },
    leaders: p.leaders.map(l =>
      l.card.id === leaderCardId ? { ...l, isDeployed: true, unitIid: iid } : l,
    ),
  }));

  s = addToArena(s, playerId, arena, inst);
  s = log(s, playerId, `${leader.card.name} deployed to ${arena} arena.`);
  return switchActivePlayer(s, playerId);
}

function applyLeaderAbility(
  state: GameState,
  playerId: PlayerId,
  leaderCardId: string,
  targetIid?: string,
): GameState {
  const me = state.players[playerId];
  const leader = me.leaders.find(l => l.card.id === leaderCardId && !l.isDeployed && !l.exhausted);
  if (!leader) return state;

  const ability = LEADER_ABILITIES[leader.card.name];
  if (!ability) return state;

  if (me.resources.available < ability.resourceCost) return state;

  let s = state;

  // Pay resource cost
  if (ability.resourceCost > 0) {
    s = updatePlayer(s, playerId, p => ({
      ...p,
      resources: { ...p.resources, available: p.resources.available - ability.resourceCost },
    }));
  }

  // Exhaust the leader
  s = updatePlayer(s, playerId, p => ({
    ...p,
    leaders: p.leaders.map(l =>
      l.card.id === leaderCardId ? { ...l, exhausted: true } : l,
    ),
  }));

  // Resolve the effect
  s = applyAbilityEffect(s, playerId, ability.effect, targetIid);
  s = log(s, playerId, `${leader.card.name}: used leader ability.`);
  s = checkWinCondition(s);

  return switchActivePlayer(s, playerId);
}

function applyTakeCounter(state: GameState, playerId: PlayerId): GameState {
  let s = updatePlayer(state, playerId, p => ({ ...p, hasCountered: true }));
  s = log(s, playerId, `${playerId} takes the counter.`);

  // If both players have countered → regroup phase
  if (s.players.player1.hasCountered && s.players.player2.hasCountered) {
    s = { ...s, phase: 'regroup', activePlayer: s.initiative };
    s = log(s, undefined, 'Both players countered — regroup phase begins.');
  } else {
    // Switch to opponent for their remaining actions
    s = { ...s, activePlayer: opponent(playerId) };
  }

  return s;
}

function applyResourceCard(state: GameState, playerId: PlayerId, iid: string): GameState {
  const found = findCard(state, iid);
  if (!found || found.arena !== 'hand' || found.owner !== playerId) return state;

  const cardName = found.card.card.name;
  let s = removeFromHand(state, playerId, iid);

  if (s.phase === 'setup') {
    const newLeft = s.players[playerId].setupResourcesLeft - 1;
    const done = newLeft <= 0;
    s = updatePlayer(s, playerId, p => ({
      ...p,
      resources: { total: p.resources.total + 1, available: p.resources.available },
      setupResourcesLeft: newLeft,
      hasResourced: done,
    }));
    s = log(s, playerId, `Setup resource ${3 - newLeft}/2: ${cardName}.`);

    if (done) {
      const opp = opponent(playerId);
      if (!s.players[opp].hasResourced) {
        return { ...s, activePlayer: opp };
      }
      return resolveSetup(s);
    }
    // Still has slots — player stays active to place a second card
    return s;
  }

  // Regroup phase
  s = updatePlayer(s, playerId, p => ({
    ...p,
    resources: { total: p.resources.total + 1, available: p.resources.available },
    hasResourced: true,
  }));
  s = log(s, playerId, `Resourced ${cardName}.`);

  const opp = opponent(playerId);
  if (!s.players[opp].hasResourced) {
    return { ...s, activePlayer: opp };
  }
  return resolveRegroup(s);
}

function applyEndRegroup(state: GameState, playerId: PlayerId): GameState {
  let s = updatePlayer(state, playerId, p => ({ ...p, hasResourced: true }));

  if (s.phase === 'setup') {
    const opp = opponent(playerId);
    if (!s.players[opp].hasResourced) {
      return { ...s, activePlayer: opp };
    }
    return resolveSetup(s);
  }

  const opp = opponent(playerId);
  if (!s.players[opp].hasResourced) {
    return { ...s, activePlayer: opp };
  }
  return resolveRegroup(s);
}

function resolveSetup(state: GameState): GameState {
  // Both players have finished placing setup resources.
  // Ready all resources they placed, then begin round 1 action phase.
  let s: GameState = {
    ...state,
    phase: 'action',
    activePlayer: state.initiative,
    players: {
      player1: {
        ...state.players.player1,
        resources: { total: state.players.player1.resources.total, available: state.players.player1.resources.total },
        hasResourced: false,
        setupResourcesLeft: 2,
      },
      player2: {
        ...state.players.player2,
        resources: { total: state.players.player2.resources.total, available: state.players.player2.resources.total },
        hasResourced: false,
        setupResourcesLeft: 2,
      },
    },
  };
  s = log(s, undefined, 'Setup complete — Round 1 begins!');
  return s;
}

function resolveRegroup(state: GameState): GameState {
  let s = state;

  for (const pid of ['player1', 'player2'] as PlayerId[]) {
    s = updatePlayer(s, pid, p => {
      const draws = Math.min(2, p.deck.length);
      const drawn  = p.deck.slice(0, draws);
      const newDeck = p.deck.slice(draws);

      const ready = (arr: CardInstance[]) =>
        arr.map(c => ({
          ...c,
          exhausted: false,
          deployedThisTurn: false,
          phaseAtk: undefined,
          phaseHp:  undefined,
        }));

      return {
        ...p,
        deck: newDeck,
        hand: [...p.hand, ...drawn],
        resources: { total: p.resources.total, available: p.resources.total },
        groundArena: ready(p.groundArena),
        spaceArena:  ready(p.spaceArena),
        // Un-exhaust all leaders so their abilities are available next round
        leaders: p.leaders.map(l => ({ ...l, exhausted: false })),
        hasCountered: false,
        hasResourced: false,
      };
    });
  }

  s = {
    ...s,
    round: s.round + 1,
    phase: 'action',
    activePlayer: s.initiative,
  };

  s = log(s, undefined, `Round ${s.round} begins.`);
  return s;
}

function applyPlayAttackEvent(
  state: GameState,
  playerId: PlayerId,
  iid: string,
  attackerIid: string,
  defenderIid: string | 'base',
): GameState {
  const found = findCard(state, iid);
  if (!found || found.arena !== 'hand' || found.owner !== playerId) return state;

  const { card } = found;
  const cost = card.card.cost ?? card.card.energy_cost ?? 0;
  const me = state.players[playerId];
  if (me.resources.available < cost) return state;

  const evtDef = getEventEffect(card.card.name, card.card.text ?? '');
  if (!evtDef || evtDef.effect.type !== 'TRIGGER_ATTACK_WITH') return state;

  const effect = evtDef.effect; // TRIGGER_ATTACK_WITH

  // Pay resource cost and move event to discard.
  let s = updatePlayer(state, playerId, p => ({
    ...p,
    resources: { ...p.resources, available: p.resources.available - cost },
  }));
  s = removeFromHand(s, playerId, iid);
  s = addToDiscard(s, playerId, { ...card, exhausted: true });
  s = log(s, playerId, `Played event: ${card.card.name}.`);

  // Apply temporary stat bonus to the attacker ("for this attack").
  if (effect.atkBonus !== 0 || effect.hpBonus !== 0) {
    s = mapCardInArenas(s, attackerIid, c => ({
      ...c,
      phaseAtk: (c.phaseAtk ?? 0) + effect.atkBonus,
      phaseHp:  (c.phaseHp  ?? 0) + effect.hpBonus,
    }));
  }

  // Execute the attack (exhausts attacker, deals damage, checks defeat, switches player).
  s = applyAttack(s, playerId, attackerIid, defenderIid);

  // Remove the temporary bonus (if the unit survived — mapCardInArenas is a no-op otherwise).
  if (effect.atkBonus !== 0 || effect.hpBonus !== 0) {
    s = mapCardInArenas(s, attackerIid, c => ({
      ...c,
      phaseAtk: (c.phaseAtk ?? 0) - effect.atkBonus,
      phaseHp:  (c.phaseHp  ?? 0) - effect.hpBonus,
    }));
  }

  return s;
}

// ---------------------------------------------------------------------------
// Turn management
// ---------------------------------------------------------------------------

function switchActivePlayer(state: GameState, currentPlayer: PlayerId): GameState {
  const opp = opponent(currentPlayer);
  // If opponent has countered, stay with current player (they keep acting)
  if (state.players[opp].hasCountered) return state;
  return { ...state, activePlayer: opp };
}

// ---------------------------------------------------------------------------
// Public engine class
// ---------------------------------------------------------------------------

export class GameEngine {
  private state: GameState;

  constructor(config: GameConfig) {
    this.state = initState(config);
  }

  getState(): Readonly<GameState> {
    return this.state;
  }

  getLegalActions(playerId: PlayerId): GameAction[] {
    return getLegalActions(this.state, playerId);
  }

  applyAction(playerId: PlayerId, action: GameAction): GameState {
    this.state = this._applyAction(this.state, playerId, action);
    return this.state;
  }

  isGameOver(): boolean {
    return !!this.state.winner;
  }

  private _applyAction(state: GameState, playerId: PlayerId, action: GameAction): GameState {
    switch (action.type) {
      case 'PLAY_CARD':
        return applyPlayCard(state, playerId, action.iid, action.targetIid);
      case 'PLAY_ATTACK_EVENT':
        return applyPlayAttackEvent(state, playerId, action.iid, action.attackerIid, action.defenderIid);
      case 'ATTACK':
        return applyAttack(state, playerId, action.attackerIid, action.defenderIid);
      case 'DEPLOY_LEADER':
        return applyDeployLeader(state, playerId, action.leaderCardId);
      case 'LEADER_ABILITY':
        return applyLeaderAbility(state, playerId, action.leaderCardId, action.targetIid);
      case 'TAKE_COUNTER':
      case 'PASS_PRIORITY':
        return applyTakeCounter(state, playerId);
      case 'RESOURCE_CARD':
        return applyResourceCard(state, playerId, action.iid);
      case 'END_REGROUP':
        return applyEndRegroup(state, playerId);
      case 'USE_ABILITY':
        return log(state, playerId, `${action.iid}: ability use not yet implemented.`);
      default:
        return state;
    }
  }
}

// ---------------------------------------------------------------------------
// Convenience: build PlayerConfig from a SavedDeck
// ---------------------------------------------------------------------------

export function deckToPlayerConfig(deck: SavedDeck, playerId: PlayerId, displayName: string): PlayerConfig {
  const expanded: Card[] = [];
  for (const entry of deck.cards) {
    for (let i = 0; i < entry.quantity; i++) {
      expanded.push(entry.card);
    }
  }

  return {
    playerId,
    displayName,
    leaders: deck.leaders,
    base: deck.base!,
    deck: expanded,
  };
}
