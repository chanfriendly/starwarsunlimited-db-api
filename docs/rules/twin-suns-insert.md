# Twin Suns (Multiplayer Format) — Rules Insert

> **Source:** Star Wars: Unlimited Comprehensive Rules, **V 7.0 — 3/6/26**, Section 12
> (`comprehensive-rules.pdf`, pages 52–53). This is the canonical, format-specific
> ruleset the engine (`frontend/src/lib/engine-v2/`) is verified against. When a rule
> is format-sensitive, **this insert wins over the base 1v1 Comprehensive Rules.**

Rule numbers below mirror the Comprehensive Rules so they can be cited directly
(e.g. §12.5.3 = the Take an Available Counter action).

---

## 12.1 — General

1. Twin Suns is a special multiplayer format with unique rules, counters, and
   deckbuilding requirements. In the Twin Suns multiplayer format, **each player's
   deck has two leaders instead of one**, and **each deck can only contain one copy
   of each card**.
2. All of the rules for playing with more than two players also apply to the Twin
   Suns format unless otherwise specified.

## 12.2 — Deckbuilding

1. The Twin Suns format features unique deckbuilding rules that allow players to put
   more than one leader into their deck. Each Twin Suns deck must include:
   - Exactly **2 different leaders** whose faceup sides at the start of the game
     cannot have **both** of two opposing aspects (i.e. the two leaders' starting
     faceup sides may not combine the two conflicting aspect icons).
   - Exactly **1 base**.
   - At least **80 other cards** (units, events, and upgrades).
2. Players cannot have more than one copy of any card in their deck, unless otherwise
   specified. **This limit applies to leaders as well as** units, events, and upgrades.
   - Though a deck cannot *start* with more than one copy of any card, a player may
     still **control** multiple copies of the same non-unique card through game effects.

## 12.3 — Two Leaders

1. Each player's deck must contain two leaders, whose faceup starting sides cannot
   have both opposing aspects. The leaders **may have the same name**, but must not be
   copies of each other (to avoid violating the uniqueness rule).
2. **Both leaders provide their aspect icons** to the player's deck.
3. A player's leaders can be **exhausted, deployed, and defeated independently** of
   each other. A player may have **both** of their leaders deployed at the same time.

## 12.4 — Setup

1. Setup is the same as a multiplayer game (section 11), with two adjustments:
   - During **Step 2**, players put **both** leaders into play below their base,
     Leader side faceup.
   - During **Step 3**, after giving the initiative counter to the first player, place
     the **blast counter** and **plan counter** in the center of the game area, within
     reach of all players.

## 12.5 — Counters

1. Twin Suns games require two additional counters: the **blast counter** and the
   **plan counter**. Like the initiative counter, a player can use their action to take
   control of one of them, **effectively ending that player's participation in a round**.
2. Both the blast and plan counters have an **additional effect when taken**. Resolve
   this effect **immediately** when the counter is taken:
   - **Blast counter:** the taker deals **1 damage to each opponent's base**.
   - **Plan counter:** the taker **draws 1 card**, then **places 1 card from their hand
     on the bottom of their deck** (they may place the just-drawn card).
3. **Take an Available Counter** action — in multiplayer games, this replaces the
   two-player "Take the Initiative" action. When a player takes this action, they take
   control of **any one counter that has not been taken** (initiative, blast, or plan)
   and flip it to its "taken" side. The player is considered to have **"passed"** for
   their action and must pass for any subsequent actions that round, **though they
   still resolve any abilities triggered on cards they control during that round**. A
   player can only take this action if they **haven't yet taken a counter that round**.
4. A player **cannot take more than one counter in a single round**; however, a player
   **may control more than one counter at the same time** (e.g. if they still hold the
   initiative from a previous round when they take a different counter).
5. At the start of each **regroup phase**, return the blast counter and plan counter
   to the center of the game area, **"available" side up**.

## 12.6 — Action Phase

1. Players may take one of the following actions during each of their turns:
   **Play a Card, Attack With a Unit, Use an Action Ability,** or **Take an Available
   Counter** (once per player per round).
   - Players may **not** choose the Pass action available in other formats in place of
     a different action. In Twin Suns, players may only pass if **there are no counters
     available to take**, and **must** pass if they took a counter earlier in the round.
   - Once a player has taken a counter, that player **cannot take additional actions**
     for the phase and must pass any time they would take an action. A player cannot
     take a counter if they already took one that phase, or if all counters were
     already taken that phase.
   - In a **three-player** game, the third player will necessarily take the last
     counter, ending the phase. In a **four-player** game, once all three counters have
     been taken, the last remaining player may pass to end the phase.
2. When a player **eliminates another player** from the game (e.g. by being the last to
   damage the eliminated player's base), that player **heals 5 damage from their own
   base**, after resolving player elimination per 11.3. If a player eliminates *themself*
   through an ability, no player heals damage this way.

## 12.7 — Ending the Game

1. Once one player is eliminated, the game ends **once the current phase ends**. The
   player with the **most HP remaining on their base** at the end of the current phase
   wins.
2. At the end of the phase, any "for this phase" / "until the end of the phase"
   abilities still expire, and players still resolve any abilities triggered "at the
   end of the phase."
3. If multiple players are tied for the most HP remaining at the end of the game, they
   **share the victory**.

---

*© & ™ Lucasfilm Ltd. Fantasy Flight Games and the FFG logo are ® of Fantasy Flight
Games. Reproduced here for reference; not affiliated with or endorsed by Lucasfilm or
FFG/Asmodee.*
