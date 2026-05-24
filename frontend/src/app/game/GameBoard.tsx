'use client';
import React, { useState, useCallback, useEffect, useMemo } from 'react';
import type { GameAction } from '@/lib/game-engine/actions';
import { computePower, effectiveHealth } from '@/lib/game-engine';
import type { UseGameResult } from './useGame';
import { TopOppMat } from './TopOppMat';
import { DividerBar } from './DividerBar';
import { YourMat } from './YourMat';
import { CardPreview } from './CardPreview';
import { TweaksPanel } from './TweaksPanel';

interface GameBoardProps extends UseGameResult {
  playerName: string;
  onGameEnd: (result: 'win' | 'loss' | 'draw') => void;
}


export function GameBoard({
  state, selectedIid, setSelectedIid, handleAction, isAiThinking, isSetupPhase, isResourcePhase,
  playerCoordinateActive, legalActions,
  playerName, onGameEnd,
}: GameBoardProps) {
  const [pendingAttackerIid,      setPendingAttackerIid]      = useState<string | null>(null);
  /** leaderCardId of the leader whose ability is waiting for a target */
  const [pendingLeaderAbilityId,  setPendingLeaderAbilityId]  = useState<string | null>(null);
  /** iid of the targeted event card waiting for a target (non-attack events) */
  const [pendingEventIid,         setPendingEventIid]         = useState<string | null>(null);
  /**
   * iid of the "Attack with a unit" event card that was clicked.
   * Step 1: event selected (pendingAttackEventIid set, pendingAttackerIid null) → pick attacker.
   * Step 2: attacker selected (both set) → pick defender via effectiveOppTargetIids.
   */
  const [pendingAttackEventIid,   setPendingAttackEventIid]   = useState<string | null>(null);
  /**
   * Coord-on-attack target selection state. Active when pendingAttackerIid is
   * a unit with an active ON_ATTACK_DEAL_DAMAGE_TARGET or ON_ATTACK_DEBUFF_TARGET
   * Coordinate effect and the user hasn't picked/skipped yet.
   * - coordChoiceMade: true once user has either picked a target or skipped.
   * - chosenCoordTargetIid: the picked target's iid, or null if skipped.
   */
  const [coordChoiceMade,         setCoordChoiceMade]         = useState(false);
  const [chosenCoordTargetIid,    setChosenCoordTargetIid]    = useState<string | null>(null);
  /**
   * Dual-target play state (Reckless Torrent's WHEN_PLAYED_DAMAGE_DUAL).
   * - pendingDualPlayIid: card-in-hand iid awaiting target selection.
   * - pendingDualFriendlyIid: chosen friendly target after step 1; null in step 1.
   */
  const [pendingDualPlayIid,      setPendingDualPlayIid]      = useState<string | null>(null);
  const [pendingDualFriendlyIid,  setPendingDualFriendlyIid]  = useState<string | null>(null);
  /**
   * iid of an upgrade card in hand that's been selected and is waiting for
   * the player to click a friendly unit to attach it to.
   * Two-step: click upgrade card → click any friendly unit → attach.
   * Click the upgrade card again to cancel.
   */
  const [pendingUpgradeIid,       setPendingUpgradeIid]       = useState<string | null>(null);
  /**
   * leaderCardId of a leader whose TRIGGER_ATTACK_WITH ability is in progress.
   * Step 1: leader ABILITY clicked → set this, pick attacker (pendingAttackerIid).
   * Step 2: attacker picked → pick defender via leaderAttackAbilityTargetIids.
   * Click ABILITY again to cancel.
   */
  const [pendingLeaderAttackAbilityId, setPendingLeaderAttackAbilityId] = useState<string | null>(null);

  const p1 = state.players.player1;
  const p2 = state.players.player2;
  const isMyTurn = state.activePlayer === 'player1' && !p1.hasCountered && state.phase === 'action';

  // Pre-compute effective (Coordinate-aware) stats for all arena units so the
  // display reflects buffs like Echo's +2/+2 without threading GameState deep
  // into the card-rendering components.
  const p1UnitEffectiveStats = useMemo(() => {
    const map = new Map<string, { power: number; hp: number }>();
    for (const ci of [...p1.groundArena, ...p1.spaceArena]) {
      map.set(ci.iid, {
        power: computePower(state, ci, 'player1'),
        hp:    effectiveHealth(state, ci, 'player1'),
      });
    }
    return map;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const p2UnitEffectiveStats = useMemo(() => {
    const map = new Map<string, { power: number; hp: number }>();
    for (const ci of [...p2.groundArena, ...p2.spaceArena]) {
      map.set(ci.iid, {
        power: computePower(state, ci, 'player2'),
        hp:    effectiveHealth(state, ci, 'player2'),
      });
    }
    return map;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  // Notify parent when game ends
  useEffect(() => {
    if (!state.winner) return;
    const result = state.winner === 'player1' ? 'win'
                 : state.winner === 'player2' ? 'loss'
                 : 'draw';
    onGameEnd(result);
  }, [state.winner, onGameEnd]);

  // ── Derived legal-action sets ────────────────────────────────────────────

  /**
   * Valid coord-effect targets for the pending attacker, before the user has
   * picked one. Empty when no coord-on-attack target effect is active.
   */
  const coordTargetIids = useMemo((): Set<string> => {
    if (!pendingAttackerIid || coordChoiceMade) return new Set();
    const targets = new Set<string>();
    for (const a of legalActions) {
      if (a.type !== 'ATTACK' || a.attackerIid !== pendingAttackerIid) continue;
      if (a.coordDamageTarget)  targets.add(a.coordDamageTarget);
      if (a.coordDebuffTarget) targets.add(a.coordDebuffTarget);
    }
    return targets;
  }, [pendingAttackerIid, coordChoiceMade, legalActions]);

  /** Whether the pending attacker's coord-on-attack effect is OPTIONAL (Kit Fisto "You may"). */
  const coordIsOptional = useMemo(() => {
    if (!pendingAttackerIid || coordChoiceMade) return false;
    // Optional = a legal ATTACK exists for this attacker WITHOUT any coord target,
    //           even though coord targets are also available.
    const hasCoordVariant = legalActions.some(
      a => a.type === 'ATTACK' && a.attackerIid === pendingAttackerIid &&
        (a.coordDamageTarget || a.coordDebuffTarget),
    );
    const hasPlainVariant = legalActions.some(
      a => a.type === 'ATTACK' && a.attackerIid === pendingAttackerIid &&
        !a.coordDamageTarget && !a.coordDebuffTarget,
    );
    return hasCoordVariant && hasPlainVariant;
  }, [pendingAttackerIid, coordChoiceMade, legalActions]);

  /** True when we should be showing coord targets, NOT defenders. */
  const coordTargetingPhase = coordTargetIids.size > 0;

  /**
   * Match an ATTACK action to the user's chosen coord state. Returns true if
   * `a` is consistent with chosenCoordTargetIid (either both as the damage
   * target or both as the debuff target, or both as no coord target).
   */
  const attackMatchesCoord = useCallback((a: Extract<GameAction, { type: 'ATTACK' }>) => {
    const aHasCoord = !!(a.coordDamageTarget || a.coordDebuffTarget);
    if (!coordChoiceMade) return !aHasCoord; // pre-choice: only show plain variant defenders
    if (chosenCoordTargetIid === null) return !aHasCoord; // user skipped
    return a.coordDamageTarget === chosenCoordTargetIid || a.coordDebuffTarget === chosenCoordTargetIid;
  }, [coordChoiceMade, chosenCoordTargetIid]);

  const attackTargetIids = useMemo((): Set<string> => {
    if (!pendingAttackerIid) return new Set();
    if (coordTargetingPhase) return new Set(); // hide defenders until coord target picked / skipped
    return new Set(
      legalActions
        .filter(a => a.type === 'ATTACK' && a.attackerIid === pendingAttackerIid && a.defenderIid !== 'base' && attackMatchesCoord(a))
        .map(a => (a as Extract<GameAction, { type: 'ATTACK' }>).defenderIid as string),
    );
  }, [pendingAttackerIid, coordTargetingPhase, legalActions, attackMatchesCoord]);

  const canAttackBase = useMemo(() => {
    if (!pendingAttackerIid || coordTargetingPhase) return false;
    return legalActions.some(
      a => a.type === 'ATTACK' && a.attackerIid === pendingAttackerIid && a.defenderIid === 'base' && attackMatchesCoord(a),
    );
  }, [pendingAttackerIid, coordTargetingPhase, legalActions, attackMatchesCoord]);

  // ── Dual-target play (Reckless Torrent) ──────────────────────────────────

  /** Hand-card iids whose play has dual-target variants. */
  const canPlayDualIids = useMemo(
    () => new Set(
      legalActions
        .filter((a): a is Extract<GameAction, { type: 'PLAY_CARD' }> =>
          a.type === 'PLAY_CARD' && Array.isArray((a as Extract<GameAction, { type: 'PLAY_CARD' }>).targetIids))
        .map(a => a.iid),
    ),
    [legalActions],
  );

  /** Step 1: friendly iids that are valid first-targets for the pending dual play. */
  const dualFriendlyIids = useMemo((): Set<string> => {
    if (!pendingDualPlayIid || pendingDualFriendlyIid) return new Set();
    const out = new Set<string>();
    for (const a of legalActions) {
      if (a.type !== 'PLAY_CARD' || a.iid !== pendingDualPlayIid) continue;
      if (a.targetIids && a.targetIids.length >= 1) out.add(a.targetIids[0]);
    }
    return out;
  }, [pendingDualPlayIid, pendingDualFriendlyIid, legalActions]);

  /** Step 2: enemy iids valid as second-target given the chosen friendly. */
  const dualEnemyIids = useMemo((): Set<string> => {
    if (!pendingDualPlayIid || !pendingDualFriendlyIid) return new Set();
    const out = new Set<string>();
    for (const a of legalActions) {
      if (a.type !== 'PLAY_CARD' || a.iid !== pendingDualPlayIid) continue;
      if (a.targetIids && a.targetIids.length >= 2 && a.targetIids[0] === pendingDualFriendlyIid) {
        out.add(a.targetIids[1]);
      }
    }
    return out;
  }, [pendingDualPlayIid, pendingDualFriendlyIid, legalActions]);

  const canPlayIids = useMemo(
    () => new Set(legalActions.filter(a => a.type === 'PLAY_CARD').map(a => (a as Extract<GameAction, { type: 'PLAY_CARD' }>).iid)),
    [legalActions],
  );

  const legalDeployIds = useMemo(
    () => new Set(legalActions.filter(a => a.type === 'DEPLOY_LEADER').map(a => (a as Extract<GameAction, { type: 'DEPLOY_LEADER' }>).leaderCardId)),
    [legalActions],
  );

  /** Leader card ids that have a usable ability this turn */
  const legalLeaderAbilityIds = useMemo(
    () => new Set(
      legalActions
        .filter(a => a.type === 'LEADER_ABILITY')
        .map(a => (a as Extract<GameAction, { type: 'LEADER_ABILITY' }>).leaderCardId),
    ),
    [legalActions],
  );

  /** Valid target iids for the pending leader ability */
  const leaderAbilityTargetIids = useMemo((): Set<string> => {
    if (!pendingLeaderAbilityId) return new Set();
    return new Set(
      legalActions
        .filter(a =>
          a.type === 'LEADER_ABILITY' &&
          (a as Extract<GameAction, { type: 'LEADER_ABILITY' }>).leaderCardId === pendingLeaderAbilityId &&
          (a as Extract<GameAction, { type: 'LEADER_ABILITY' }>).targetIid,
        )
        .map(a => (a as Extract<GameAction, { type: 'LEADER_ABILITY' }>).targetIid as string),
    );
  }, [pendingLeaderAbilityId, legalActions]);

  /** Leader card ids with LEADER_ATTACK_ABILITY actions (attack-type leader abilities) */
  const legalLeaderAttackAbilityIds = useMemo(
    () => new Set(
      legalActions
        .filter(a => a.type === 'LEADER_ATTACK_ABILITY')
        .map(a => (a as Extract<GameAction, { type: 'LEADER_ATTACK_ABILITY' }>).leaderCardId),
    ),
    [legalActions],
  );

  /**
   * Step 1: friendly unit iids that can attack for pendingLeaderAttackAbilityId.
   * Derived from LEADER_ATTACK_ABILITY actions for the selected leader.
   */
  const leaderAttackAbilityAttackerIids = useMemo((): Set<string> => {
    if (!pendingLeaderAttackAbilityId) return new Set();
    return new Set(
      legalActions
        .filter(a =>
          a.type === 'LEADER_ATTACK_ABILITY' &&
          (a as Extract<GameAction, { type: 'LEADER_ATTACK_ABILITY' }>).leaderCardId === pendingLeaderAttackAbilityId,
        )
        .map(a => (a as Extract<GameAction, { type: 'LEADER_ATTACK_ABILITY' }>).attackerIid),
    );
  }, [pendingLeaderAttackAbilityId, legalActions]);

  /**
   * Step 2: valid defender iids for pending leader attack ability + chosen attacker.
   * Excludes 'base' (handled by canLeaderAttackAbilityTargetBase).
   */
  const leaderAttackAbilityTargetIids = useMemo((): Set<string> => {
    if (!pendingLeaderAttackAbilityId || !pendingAttackerIid) return new Set();
    return new Set(
      legalActions
        .filter(a =>
          a.type === 'LEADER_ATTACK_ABILITY' &&
          (a as Extract<GameAction, { type: 'LEADER_ATTACK_ABILITY' }>).leaderCardId === pendingLeaderAttackAbilityId &&
          (a as Extract<GameAction, { type: 'LEADER_ATTACK_ABILITY' }>).attackerIid === pendingAttackerIid &&
          (a as Extract<GameAction, { type: 'LEADER_ATTACK_ABILITY' }>).defenderIid !== 'base',
        )
        .map(a => (a as Extract<GameAction, { type: 'LEADER_ATTACK_ABILITY' }>).defenderIid as string),
    );
  }, [pendingLeaderAttackAbilityId, pendingAttackerIid, legalActions]);

  const canLeaderAttackAbilityTargetBase = useMemo(() => {
    if (!pendingLeaderAttackAbilityId || !pendingAttackerIid) return false;
    return legalActions.some(
      a =>
        a.type === 'LEADER_ATTACK_ABILITY' &&
        (a as Extract<GameAction, { type: 'LEADER_ATTACK_ABILITY' }>).leaderCardId === pendingLeaderAttackAbilityId &&
        (a as Extract<GameAction, { type: 'LEADER_ATTACK_ABILITY' }>).attackerIid === pendingAttackerIid &&
        (a as Extract<GameAction, { type: 'LEADER_ATTACK_ABILITY' }>).defenderIid === 'base',
    );
  }, [pendingLeaderAttackAbilityId, pendingAttackerIid, legalActions]);

  /** Map of event iid → targetIids[] for events that need a target */
  const canPlayEventTargeted = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const a of legalActions) {
      if (a.type !== 'PLAY_CARD') continue;
      const action = a as Extract<GameAction, { type: 'PLAY_CARD' }>;
      if (!action.targetIid) continue;
      // Only events, not upgrades
      const ci = p1.hand.find(c => c.iid === action.iid);
      if (!ci || ci.card.type?.toLowerCase() !== 'event') continue;
      const existing = map.get(action.iid) ?? [];
      map.set(action.iid, [...existing, action.targetIid]);
    }
    return map;
  }, [legalActions, p1.hand]);

  /** Hand-card iids that are upgrades and are affordable/playable this turn. */
  const canPlayUpgradeIids = useMemo(
    () => new Set(
      p1.hand
        .filter(ci => ci.card.type?.toLowerCase() === 'upgrade' && canPlayIids.has(ci.iid))
        .map(ci => ci.iid),
    ),
    [p1.hand, canPlayIids],
  );

  /** Friendly unit iids that are valid attachment targets for the pending upgrade. */
  const upgradeTargetIids = useMemo((): Set<string> => {
    if (!pendingUpgradeIid) return new Set();
    return new Set(
      legalActions
        .filter(a =>
          a.type === 'PLAY_CARD' &&
          (a as Extract<GameAction, { type: 'PLAY_CARD' }>).iid === pendingUpgradeIid &&
          (a as Extract<GameAction, { type: 'PLAY_CARD' }>).targetIid !== undefined,
        )
        .map(a => (a as Extract<GameAction, { type: 'PLAY_CARD' }>).targetIid as string),
    );
  }, [pendingUpgradeIid, legalActions]);

  /** Valid target iids for the pending event */
  const eventTargetIids = useMemo((): Set<string> => {
    if (!pendingEventIid) return new Set();
    return new Set(
      legalActions
        .filter(a =>
          a.type === 'PLAY_CARD' &&
          (a as Extract<GameAction, { type: 'PLAY_CARD' }>).iid === pendingEventIid &&
          (a as Extract<GameAction, { type: 'PLAY_CARD' }>).targetIid,
        )
        .map(a => (a as Extract<GameAction, { type: 'PLAY_CARD' }>).targetIid as string),
    );
  }, [pendingEventIid, legalActions]);

  const canEventTargetBase = useMemo(() => {
    if (!pendingEventIid) return false;
    return legalActions.some(
      a =>
        a.type === 'PLAY_CARD' &&
        (a as Extract<GameAction, { type: 'PLAY_CARD' }>).iid === pendingEventIid &&
        (a as Extract<GameAction, { type: 'PLAY_CARD' }>).targetIid === 'base',
    );
  }, [pendingEventIid, legalActions]);

  /** Set of event-card iids that have PLAY_ATTACK_EVENT actions (i.e. "Attack with" events). */
  const canPlayAttackEventIids = useMemo(
    () => new Set(
      legalActions
        .filter(a => a.type === 'PLAY_ATTACK_EVENT')
        .map(a => (a as Extract<GameAction, { type: 'PLAY_ATTACK_EVENT' }>).iid),
    ),
    [legalActions],
  );

  /**
   * Step 1: friendly unit iids that can be the attacker for pendingAttackEventIid.
   * Derived from PLAY_ATTACK_EVENT actions for the selected event card.
   */
  const attackEventAttackerIids = useMemo((): Set<string> => {
    if (!pendingAttackEventIid) return new Set();
    return new Set(
      legalActions
        .filter(a =>
          a.type === 'PLAY_ATTACK_EVENT' &&
          (a as Extract<GameAction, { type: 'PLAY_ATTACK_EVENT' }>).iid === pendingAttackEventIid,
        )
        .map(a => (a as Extract<GameAction, { type: 'PLAY_ATTACK_EVENT' }>).attackerIid),
    );
  }, [pendingAttackEventIid, legalActions]);

  /**
   * Step 2: valid defender iids for the chosen event + chosen attacker.
   * Excludes 'base' (handled by canAttackEventTargetBase).
   */
  const attackEventTargetIids = useMemo((): Set<string> => {
    if (!pendingAttackEventIid || !pendingAttackerIid) return new Set();
    return new Set(
      legalActions
        .filter(a =>
          a.type === 'PLAY_ATTACK_EVENT' &&
          (a as Extract<GameAction, { type: 'PLAY_ATTACK_EVENT' }>).iid === pendingAttackEventIid &&
          (a as Extract<GameAction, { type: 'PLAY_ATTACK_EVENT' }>).attackerIid === pendingAttackerIid &&
          (a as Extract<GameAction, { type: 'PLAY_ATTACK_EVENT' }>).defenderIid !== 'base',
        )
        .map(a => (a as Extract<GameAction, { type: 'PLAY_ATTACK_EVENT' }>).defenderIid as string),
    );
  }, [pendingAttackEventIid, pendingAttackerIid, legalActions]);

  const canAttackEventTargetBase = useMemo(() => {
    if (!pendingAttackEventIid || !pendingAttackerIid) return false;
    return legalActions.some(
      a =>
        a.type === 'PLAY_ATTACK_EVENT' &&
        (a as Extract<GameAction, { type: 'PLAY_ATTACK_EVENT' }>).iid === pendingAttackEventIid &&
        (a as Extract<GameAction, { type: 'PLAY_ATTACK_EVENT' }>).attackerIid === pendingAttackerIid &&
        (a as Extract<GameAction, { type: 'PLAY_ATTACK_EVENT' }>).defenderIid === 'base',
    );
  }, [pendingAttackEventIid, pendingAttackerIid, legalActions]);

  // ── Effective targeting sets (attack, ability, or event) ─────────────────

  /** Enemy unit iids that should be highlighted/clickable right now */
  const effectiveOppTargetIids = useMemo((): Set<string> => {
    const oppUnitIids = new Set([...p2.groundArena, ...p2.spaceArena].map(c => c.iid));
    if (pendingLeaderAbilityId) {
      return new Set([...leaderAbilityTargetIids].filter(id => oppUnitIids.has(id)));
    }
    if (pendingEventIid) {
      return new Set([...eventTargetIids].filter(id => id !== 'base'));
    }
    // Leader attack ability step 2: show valid defenders for leader + chosen attacker
    if (pendingLeaderAttackAbilityId && pendingAttackerIid) {
      return leaderAttackAbilityTargetIids;
    }
    // Attack-event step 2: show valid defenders for event + chosen attacker
    if (pendingAttackEventIid && pendingAttackerIid) {
      return attackEventTargetIids;
    }
    // Dual-target play step 2: show enemy targets after friendly has been chosen
    if (pendingDualPlayIid && pendingDualFriendlyIid) {
      return dualEnemyIids;
    }
    // Coord-on-attack targeting phase: highlight valid coord targets (enemies)
    if (coordTargetingPhase) {
      return coordTargetIids;
    }
    return attackTargetIids;
  }, [
    pendingLeaderAbilityId, pendingEventIid,
    pendingLeaderAttackAbilityId, pendingAttackEventIid, pendingAttackerIid,
    pendingDualPlayIid, pendingDualFriendlyIid, coordTargetingPhase,
    leaderAbilityTargetIids, eventTargetIids,
    leaderAttackAbilityTargetIids, attackEventTargetIids,
    attackTargetIids, dualEnemyIids, coordTargetIids, p2,
  ]);

  /** My unit iids that should be highlighted as ability/event/attacker targets */
  const friendlyTargetIids = useMemo((): Set<string> => {
    const myUnitIids = new Set([...p1.groundArena, ...p1.spaceArena].map(c => c.iid));
    if (pendingLeaderAbilityId) {
      return new Set([...leaderAbilityTargetIids].filter(id => myUnitIids.has(id)));
    }
    if (pendingEventIid) {
      return new Set([...eventTargetIids].filter(id => myUnitIids.has(id)));
    }
    // Leader attack ability step 1: highlight valid attackers
    if (pendingLeaderAttackAbilityId && !pendingAttackerIid) {
      return new Set([...leaderAttackAbilityAttackerIids].filter(id => myUnitIids.has(id)));
    }
    // Attack-event step 1: highlight valid attackers so player knows who can use the event
    if (pendingAttackEventIid && !pendingAttackerIid) {
      return attackEventAttackerIids;
    }
    // Dual-target play step 1: highlight valid friendly first-targets
    if (pendingDualPlayIid && !pendingDualFriendlyIid) {
      return dualFriendlyIids;
    }
    // Upgrade targeting: highlight valid attachment targets (all friendly units)
    if (pendingUpgradeIid) {
      return new Set([...upgradeTargetIids].filter(id => myUnitIids.has(id)));
    }
    return new Set();
  }, [
    pendingLeaderAbilityId, pendingEventIid,
    pendingLeaderAttackAbilityId, pendingAttackEventIid, pendingAttackerIid,
    pendingDualPlayIid, pendingDualFriendlyIid, pendingUpgradeIid,
    leaderAbilityTargetIids, eventTargetIids,
    leaderAttackAbilityAttackerIids, attackEventAttackerIids, dualFriendlyIids,
    upgradeTargetIids, p1,
  ]);

  /** Whether the opponent's base is a valid target right now */
  const effectiveCanTargetBase =
    pendingLeaderAttackAbilityId && pendingAttackerIid ? canLeaderAttackAbilityTargetBase :
    pendingAttackEventIid && pendingAttackerIid ? canAttackEventTargetBase :
    pendingEventIid ? canEventTargetBase :
    coordTargetingPhase ? false :
    canAttackBase;

  const canTakeCounter = !state.winner && isMyTurn && legalActions.some(a => a.type === 'TAKE_COUNTER');

  // ── Interaction handlers ─────────────────────────────────────────────────

  const clearPending = useCallback(() => {
    setPendingAttackerIid(null);
    setPendingLeaderAbilityId(null);
    setPendingLeaderAttackAbilityId(null);
    setPendingEventIid(null);
    setPendingAttackEventIid(null);
    setCoordChoiceMade(false);
    setChosenCoordTargetIid(null);
    setPendingDualPlayIid(null);
    setPendingDualFriendlyIid(null);
    setPendingUpgradeIid(null);
  }, []);

  const handleMyUnitClick = useCallback((iid: string) => {
    // Upgrade targeting: attach upgrade to the clicked friendly unit
    if (pendingUpgradeIid && upgradeTargetIids.has(iid)) {
      handleAction({ type: 'PLAY_CARD', iid: pendingUpgradeIid, targetIid: iid });
      setPendingUpgradeIid(null);
      return;
    }
    // Leader attack ability step 1: select which friendly unit will attack
    if (pendingLeaderAttackAbilityId && !pendingAttackerIid && leaderAttackAbilityAttackerIids.has(iid)) {
      setPendingAttackerIid(iid);
      return;
    }
    // Attack-event step 1: select which friendly unit will attack
    if (pendingAttackEventIid && !pendingAttackerIid && attackEventAttackerIids.has(iid)) {
      setPendingAttackerIid(iid);
      return;
    }
    // Dual-target play step 1: pick the friendly target
    if (pendingDualPlayIid && !pendingDualFriendlyIid && dualFriendlyIids.has(iid)) {
      setPendingDualFriendlyIid(iid);
      return;
    }
    // Leader ability targeting a friendly unit
    if (pendingLeaderAbilityId && leaderAbilityTargetIids.has(iid)) {
      handleAction({ type: 'LEADER_ABILITY', leaderCardId: pendingLeaderAbilityId, targetIid: iid });
      setPendingLeaderAbilityId(null);
      return;
    }
    // Event targeting a friendly unit
    if (pendingEventIid && eventTargetIids.has(iid)) {
      handleAction({ type: 'PLAY_CARD', iid: pendingEventIid, targetIid: iid });
      setPendingEventIid(null);
      return;
    }
    // Coord-on-attack: clicking the attacker again skips (optional) or cancels (mandatory)
    if (pendingAttackerIid === iid && coordTargetingPhase) {
      if (coordIsOptional) {
        setCoordChoiceMade(true);
        setChosenCoordTargetIid(null);
      } else {
        setPendingAttackerIid(null);
        setCoordChoiceMade(false);
        setChosenCoordTargetIid(null);
      }
      return;
    }
    // Normal attack selection
    if (!isMyTurn) return;
    if (!legalActions.some(a => a.type === 'ATTACK' && a.attackerIid === iid)) return;
    setPendingAttackerIid(prev => prev === iid ? null : iid);
    setCoordChoiceMade(false);
    setChosenCoordTargetIid(null);
    setPendingLeaderAbilityId(null);
    setPendingEventIid(null);
    setPendingAttackEventIid(null);
    setSelectedIid(null);
  }, [
    pendingUpgradeIid, upgradeTargetIids,
    pendingLeaderAttackAbilityId, leaderAttackAbilityAttackerIids,
    pendingAttackEventIid, pendingAttackerIid, attackEventAttackerIids,
    pendingDualPlayIid, pendingDualFriendlyIid, dualFriendlyIids,
    pendingLeaderAbilityId, pendingEventIid, leaderAbilityTargetIids, eventTargetIids,
    coordTargetingPhase, coordIsOptional,
    isMyTurn, legalActions, handleAction, setSelectedIid,
  ]);

  const handleOppUnitClick = useCallback((iid: string) => {
    // Leader attack ability step 2: select the defender
    if (pendingLeaderAttackAbilityId && pendingAttackerIid && leaderAttackAbilityTargetIids.has(iid)) {
      handleAction({ type: 'LEADER_ATTACK_ABILITY', leaderCardId: pendingLeaderAttackAbilityId, attackerIid: pendingAttackerIid, defenderIid: iid });
      clearPending();
      return;
    }
    // Attack-event step 2: select the defender
    if (pendingAttackEventIid && pendingAttackerIid && attackEventTargetIids.has(iid)) {
      handleAction({ type: 'PLAY_ATTACK_EVENT', iid: pendingAttackEventIid, attackerIid: pendingAttackerIid, defenderIid: iid });
      clearPending();
      return;
    }
    // Dual-target play step 2: pick the enemy and dispatch
    if (pendingDualPlayIid && pendingDualFriendlyIid && dualEnemyIids.has(iid)) {
      handleAction({ type: 'PLAY_CARD', iid: pendingDualPlayIid, targetIids: [pendingDualFriendlyIid, iid] });
      clearPending();
      return;
    }
    // Coord-on-attack: pick the coord target, then proceed to defender selection
    if (coordTargetingPhase && coordTargetIids.has(iid)) {
      setChosenCoordTargetIid(iid);
      setCoordChoiceMade(true);
      return;
    }
    // Leader ability targeting an enemy unit
    if (pendingLeaderAbilityId && leaderAbilityTargetIids.has(iid)) {
      handleAction({ type: 'LEADER_ABILITY', leaderCardId: pendingLeaderAbilityId, targetIid: iid });
      setPendingLeaderAbilityId(null);
      return;
    }
    // Event targeting an enemy unit
    if (pendingEventIid && eventTargetIids.has(iid)) {
      handleAction({ type: 'PLAY_CARD', iid: pendingEventIid, targetIid: iid });
      setPendingEventIid(null);
      return;
    }
    // Normal attack — include the chosen coord target (if any) on the dispatched action.
    if (!pendingAttackerIid || !attackTargetIids.has(iid)) return;
    const coordAction = legalActions.find(a =>
      a.type === 'ATTACK' && a.attackerIid === pendingAttackerIid && a.defenderIid === iid && attackMatchesCoord(a),
    ) as Extract<GameAction, { type: 'ATTACK' }> | undefined;
    handleAction(coordAction ?? { type: 'ATTACK', attackerIid: pendingAttackerIid, defenderIid: iid });
    setPendingAttackerIid(null);
    setCoordChoiceMade(false);
    setChosenCoordTargetIid(null);
  }, [
    pendingLeaderAttackAbilityId, pendingAttackerIid, leaderAttackAbilityTargetIids,
    pendingAttackEventIid, attackEventTargetIids,
    pendingDualPlayIid, pendingDualFriendlyIid, dualEnemyIids,
    coordTargetingPhase, coordTargetIids,
    pendingLeaderAbilityId, pendingEventIid, leaderAbilityTargetIids, eventTargetIids,
    attackTargetIids, attackMatchesCoord,
    legalActions, handleAction, clearPending,
  ]);

  const handleAttackBase = useCallback(() => {
    // Leader attack ability step 2: the base is the defender
    if (pendingLeaderAttackAbilityId && pendingAttackerIid && canLeaderAttackAbilityTargetBase) {
      handleAction({ type: 'LEADER_ATTACK_ABILITY', leaderCardId: pendingLeaderAttackAbilityId, attackerIid: pendingAttackerIid, defenderIid: 'base' });
      clearPending();
      return;
    }
    // Attack-event step 2: the base is the defender
    if (pendingAttackEventIid && pendingAttackerIid && canAttackEventTargetBase) {
      handleAction({ type: 'PLAY_ATTACK_EVENT', iid: pendingAttackEventIid, attackerIid: pendingAttackerIid, defenderIid: 'base' });
      clearPending();
      return;
    }
    // Targeted event that can hit the opponent's base
    if (pendingEventIid && canEventTargetBase) {
      handleAction({ type: 'PLAY_CARD', iid: pendingEventIid, targetIid: 'base' });
      setPendingEventIid(null);
      return;
    }
    if (!pendingAttackerIid || !canAttackBase) return;
    // Match the legal action that's consistent with the chosen coord state so
    // the chosen coord target rides along with the attack.
    const coordAction = legalActions.find(a =>
      a.type === 'ATTACK' && a.attackerIid === pendingAttackerIid && a.defenderIid === 'base' && attackMatchesCoord(a),
    ) as Extract<GameAction, { type: 'ATTACK' }> | undefined;
    handleAction(coordAction ?? { type: 'ATTACK', attackerIid: pendingAttackerIid, defenderIid: 'base' });
    setPendingAttackerIid(null);
    setCoordChoiceMade(false);
    setChosenCoordTargetIid(null);
  }, [
    pendingLeaderAttackAbilityId, canLeaderAttackAbilityTargetBase,
    pendingAttackEventIid, pendingAttackerIid, canAttackEventTargetBase,
    pendingEventIid, canEventTargetBase, canAttackBase,
    legalActions, attackMatchesCoord, handleAction, clearPending,
  ]);

  const handleHandCardClick = useCallback((iid: string) => {
    const isNormalPlayable    = canPlayIids.has(iid);
    const isAttackEventCard   = canPlayAttackEventIids.has(iid);
    const isDualPlayCard      = canPlayDualIids.has(iid);
    const isUpgradeCard       = canPlayUpgradeIids.has(iid);
    if (!isMyTurn || (!isNormalPlayable && !isAttackEventCard && !isDualPlayCard && !isUpgradeCard)) return;

    // Cancel upgrade selection if same card tapped again
    if (pendingUpgradeIid === iid) {
      setPendingUpgradeIid(null);
      return;
    }

    // Upgrade card → enter targeting mode (always needs a unit to attach to)
    if (isUpgradeCard) {
      setPendingUpgradeIid(iid);
      setPendingAttackerIid(null);
      setPendingLeaderAbilityId(null);
      setPendingEventIid(null);
      setPendingAttackEventIid(null);
      setPendingDualPlayIid(null);
      setPendingDualFriendlyIid(null);
      setSelectedIid(null);
      return;
    }

    // Cancel attack-event if same card tapped again
    if (pendingAttackEventIid === iid) {
      setPendingAttackEventIid(null);
      setPendingAttackerIid(null);
      return;
    }

    // Dual-target play, second tap:
    //   - If a friendly was already chosen, step back to step 1 (re-pick friendly).
    //   - If no friendly is chosen yet, treat the second tap as "decline the
    //     optional effect" and play the card with no targets. This is the
    //     in-place skip path for cards like Reckless Torrent ("You may ...").
    if (pendingDualPlayIid === iid) {
      if (pendingDualFriendlyIid) {
        setPendingDualFriendlyIid(null);
      } else {
        handleAction({ type: 'PLAY_CARD', iid });
        setPendingDualPlayIid(null);
      }
      return;
    }

    // "Attack with a unit" event → enter two-step attack-event mode
    if (isAttackEventCard) {
      setPendingAttackEventIid(iid);
      setPendingAttackerIid(null);
      setPendingLeaderAbilityId(null);
      setPendingEventIid(null);
      setPendingDualPlayIid(null);
      setPendingDualFriendlyIid(null);
      setSelectedIid(null);
      return;
    }

    // Cancel targeted event if same card tapped again
    if (pendingEventIid === iid) {
      setPendingEventIid(null);
      return;
    }

    // Targeted events → enter targeting mode
    if (canPlayEventTargeted.has(iid)) {
      setPendingEventIid(iid);
      setPendingAttackerIid(null);
      setPendingLeaderAbilityId(null);
      setPendingAttackEventIid(null);
      setPendingDualPlayIid(null);
      setPendingDualFriendlyIid(null);
      setSelectedIid(null);
      return;
    }

    // Dual-target unit → enter dual-target play mode (friendly first, then enemy).
    // The "decline" path (no targets) is reachable by double-tapping the card
    // before picking — same UX as "select, then play" for normal units below.
    if (isDualPlayCard) {
      setPendingDualPlayIid(iid);
      setPendingDualFriendlyIid(null);
      setPendingAttackerIid(null);
      setPendingLeaderAbilityId(null);
      setPendingEventIid(null);
      setPendingAttackEventIid(null);
      setSelectedIid(null);
      return;
    }

    if (selectedIid === iid) {
      // Second tap = play it
      handleAction({ type: 'PLAY_CARD', iid });
      setSelectedIid(null);
    } else {
      setSelectedIid(iid);
      setPendingAttackerIid(null);
      setPendingLeaderAbilityId(null);
      setPendingEventIid(null);
      setPendingAttackEventIid(null);
      setPendingDualPlayIid(null);
      setPendingDualFriendlyIid(null);
      setPendingUpgradeIid(null);
    }
  }, [
    isMyTurn, canPlayIids, canPlayAttackEventIids, canPlayDualIids, canPlayUpgradeIids, selectedIid,
    pendingUpgradeIid, pendingEventIid, pendingAttackEventIid, pendingDualPlayIid, pendingDualFriendlyIid,
    canPlayEventTargeted,
    handleAction, setSelectedIid,
  ]);

  const handleDeployLeader = useCallback((cardId: string) => {
    handleAction({ type: 'DEPLOY_LEADER', leaderCardId: cardId });
  }, [handleAction]);

  const handleLeaderAbility = useCallback((cardId: string) => {
    // Cancel if same leader clicked again (either type)
    if (pendingLeaderAbilityId === cardId) {
      setPendingLeaderAbilityId(null);
      return;
    }
    if (pendingLeaderAttackAbilityId === cardId) {
      setPendingLeaderAttackAbilityId(null);
      setPendingAttackerIid(null);
      return;
    }

    // Check if this is a TRIGGER_ATTACK_WITH leader ability
    const isAttackAbility = legalActions.some(
      a => a.type === 'LEADER_ATTACK_ABILITY' &&
        (a as Extract<GameAction, { type: 'LEADER_ATTACK_ABILITY' }>).leaderCardId === cardId,
    );
    if (isAttackAbility) {
      setPendingLeaderAttackAbilityId(cardId);
      setPendingAttackerIid(null);
      setPendingLeaderAbilityId(null);
      setPendingEventIid(null);
      setPendingAttackEventIid(null);
      setSelectedIid(null);
      return;
    }

    // Check whether this standard ability needs a target
    const hasTarget = legalActions.some(
      a =>
        a.type === 'LEADER_ABILITY' &&
        (a as Extract<GameAction, { type: 'LEADER_ABILITY' }>).leaderCardId === cardId &&
        (a as Extract<GameAction, { type: 'LEADER_ABILITY' }>).targetIid !== undefined,
    );
    if (hasTarget) {
      setPendingLeaderAbilityId(cardId);
      setPendingAttackerIid(null);
      setPendingEventIid(null);
      setSelectedIid(null);
    } else {
      // No target needed — dispatch immediately
      handleAction({ type: 'LEADER_ABILITY', leaderCardId: cardId });
    }
  }, [pendingLeaderAbilityId, pendingLeaderAttackAbilityId, legalActions, handleAction, setSelectedIid]);

  const handleTakeCounter = useCallback(() => {
    handleAction({ type: 'TAKE_COUNTER' });
    clearPending();
    setSelectedIid(null);
  }, [handleAction, clearPending, setSelectedIid]);

  const handleResourceCard = useCallback((iid: string) => {
    clearPending();
    handleAction({ type: 'RESOURCE_CARD', iid });
  }, [handleAction, clearPending]);

  const handleSkipResource = useCallback(() => {
    clearPending();
    handleAction({ type: 'END_REGROUP' });
  }, [handleAction, clearPending]);

  // ── Layout ───────────────────────────────────────────────────────────────

  return (
    <div style={{
      position: 'fixed', inset: 0,
      display: 'flex', flexDirection: 'column',
      background: 'var(--bg)',
      color: 'var(--ink)',
      overflow: 'hidden',
    }}>
      {/* ── Top chrome rail ───────────────────────────────────────── */}
      <div className="table-rail">
        <div className="table-chrome is-tl">
          <a href="/decks" className="chrome-btn">← DECKS</a>
        </div>
        <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 16 }}>
          <span style={{
            fontFamily: 'var(--font-mono)', fontSize: 9,
            letterSpacing: '0.28em', color: 'var(--ink-4)', textTransform: 'uppercase',
          }}>
            Twin Suns · 2P
          </span>
          <span style={{
            fontFamily: 'var(--font-mono)', fontSize: 8,
            letterSpacing: '0.14em', color: 'var(--saber-amber)', textTransform: 'uppercase',
            border: '1px solid var(--saber-amber)', padding: '1px 7px', borderRadius: 2, opacity: 0.75,
          }}>
            ⚠ Simulator β — card effects approximate, some unimplemented
          </span>
        </div>
        <div className="table-chrome is-tr">
          <TweaksPanel />
        </div>
      </div>

      {/* ── Opponent mat ──────────────────────────────────────────── */}
      <TopOppMat
        player={p2}
        round={state.round}
        hasInitiative={state.initiative === 'player2'}
        attackTargetIids={effectiveOppTargetIids}
        canAttackBase={effectiveCanTargetBase}
        onUnitClick={handleOppUnitClick}
        onAttackBase={handleAttackBase}
        displayName="AI Opponent"
        unitEffectiveStats={p2UnitEffectiveStats}
      />

      {/* ── Divider bar ───────────────────────────────────────────── */}
      <DividerBar
        round={state.round}
        phase={state.phase}
        activePlayer={state.activePlayer}
        initiative={state.initiative}
        playerName={playerName}
        isMyTurn={isMyTurn}
        isAiThinking={isAiThinking}
        isSetupPhase={isSetupPhase}
        isResourcePhase={isResourcePhase}
        canTakeCounter={canTakeCounter}
        onTakeCounter={handleTakeCounter}
        actionLog={state.actionLog}
        winner={state.winner}
      />

      {/* ── Player mat ────────────────────────────────────────────── */}
      <YourMat
        player={p1}
        round={state.round}
        hasInitiative={state.initiative === 'player1'}
        selectedIid={selectedIid}
        pendingAttackerIid={pendingAttackerIid}
        pendingEventIid={pendingEventIid}
        pendingAttackEventIid={pendingAttackEventIid}
        canPlayIids={canPlayIids}
        canPlayAttackEventIids={canPlayAttackEventIids}
        canPlayDualIids={canPlayDualIids}
        canPlayUpgradeIids={canPlayUpgradeIids}
        pendingDualPlayIid={pendingDualPlayIid}
        pendingDualFriendlyIid={pendingDualFriendlyIid}
        pendingUpgradeIid={pendingUpgradeIid}
        legalDeployIds={legalDeployIds}
        legalLeaderAbilityIds={legalLeaderAbilityIds}
        legalLeaderAttackAbilityIds={legalLeaderAttackAbilityIds}
        pendingLeaderAbilityId={pendingLeaderAbilityId}
        pendingLeaderAttackAbilityId={pendingLeaderAttackAbilityId}
        abilityTargetIids={friendlyTargetIids}
        isSetupPhase={isSetupPhase}
        isResourcePhase={isResourcePhase}
        coordinateActive={playerCoordinateActive}
        unitEffectiveStats={p1UnitEffectiveStats}
        onUnitClick={handleMyUnitClick}
        onHandCardClick={handleHandCardClick}
        onDeployLeader={handleDeployLeader}
        onLeaderAbility={handleLeaderAbility}
        onResourceCard={handleResourceCard}
        onSkipResource={handleSkipResource}
      />

      {/* ── Hover preview ─────────────────────────────────────────── */}
      <CardPreview />
    </div>
  );
}
