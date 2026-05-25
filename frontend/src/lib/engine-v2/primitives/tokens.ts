// tokens.create_token primitive. Tokens are CREATED (per §v7 3.7.2) — they
// emit TOKEN_CREATED, not CARD_PLAYED. Their "When Played" keyword abilities
// (Shielded/Ambush) fire via the onCreate hook, NOT onPlay (the keyword
// registry exposes both; the reducer/interpreter routes here uses onCreate).

import type { CardInstance, CardRegistry, GameState, PlayerId, Zone } from '../state/types';
import type { GameEvent } from '../state/bus';
import { getTokenSpec } from '../state/tokens';
import { withPlayer } from '../state/zones';
import { getZoneArr, withZoneArr } from '../state/zones';
import { KEYWORDS } from './keywords';

let _tokIid = 1_000_000;

function nextIid(state: GameState): { state: GameState; iid: string } {
  // Tokens use the same iid stream so findCard stays consistent.
  const iid = `t${state._nextIid}`;
  return { state: { ...state, _nextIid: state._nextIid + 1 }, iid };
}

export function createToken(
  state: GameState,
  reg: CardRegistry,
  tokenId: string,
  controller: PlayerId,
  zone: Zone,
  count: number = 1,
): { state: GameState; events: GameEvent[] } {
  const spec = getTokenSpec(tokenId);
  if (!spec) throw new Error(`Unknown token: ${tokenId}`);

  // Inject the token spec into the registry (idempotent — it's the same object
  // each time). Lets effectivePower / effectiveHp / triggers etc. find it.
  // Token specs are not in reg.cards initially because they live in the token
  // registry; we mirror them in reg.cards on first use.
  if (!reg.cards[spec.id]) {
    reg.cards[spec.id] = spec;
  }

  let s = state;
  const events: GameEvent[] = [];

  for (let i = 0; i < count; i++) {
    const next = nextIid(s);
    s = next.state;
    const inst: CardInstance = {
      iid: next.iid,
      cardId: spec.id,
      damage: 0,
      exhausted: false,
      upgrades: [],
      shieldTokens: 0,
      isToken: true,
      enteredZoneAt: s.step,
    };
    // Drop into the requested zone.
    const p = s.players[controller];
    const arr = getZoneArr(p, zone).slice();
    arr.push(inst);
    s = withPlayer(s, controller, withZoneArr(p, zone, arr));
    events.push({ kind: 'TOKEN_CREATED', iid: next.iid, tokenId: spec.id, controller, zone });

    // onCreate keyword hooks (Shielded / Ambush on token units).
    for (const kw of (spec.keywords ?? [])) {
      const def = KEYWORDS[kw.name.toLowerCase()];
      if (!def?.onCreate) continue;
      const r = def.onCreate({ state: s, reg, inst, owner: controller, value: kw.value });
      s = r.state;
      events.push(...r.events);
    }
  }

  // suppress unused warning
  void _tokIid;
  return { state: s, events };
}
