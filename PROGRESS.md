# PROGRESS.md

**Update this at the end of every session. A stale PROGRESS.md is actively harmful.**

---

## Current Status

*(2026-05-20 session 24)* **Event parser + attack-event flow (PLAY_ATTACK_EVENT) implemented. ~47 additional events auto-parsed, defeat/debuff/direct-base-damage effects live.**

Six files modified, zero new dependencies. TypeScript: 0 errors.

1. **`abilities.ts`** — Three new `AbilityEffect` variants:
   - `DEFEAT_UNIT` — immediately defeats chosen non-leader unit (no damage path)
   - `DEAL_DAMAGE_OPP_BASE` — deals N damage directly to opponent's base (no target selection)
   - `TRIGGER_ATTACK_WITH` — triggers the PLAY_ATTACK_EVENT two-step UI flow (atkBonus, hpBonus, optional grantKeywords note)
   - `EVENT_EFFECTS` registry extended: Vanquish, Lost and Forgotten, It's Worse, Lethal Crackdown (all `DEFEAT_UNIT`)
   - `parseEventText(text)` — regex fallback covering: Draw, DEAL_DAMAGE_ANY, DEAL_DAMAGE_UNIT, DEAL_DAMAGE_OPP_BASE, HEAL_BASE, PHASE_BUFF_UNIT (positive and negative, en-dash aware), EXHAUST_UNIT, GIVE_SHIELD_FRIENDLY, DEFEAT_UNIT, TRIGGER_ATTACK_WITH (with and without keyword grant)
   - `getEventEffect(name, text)` — tries registry first, falls back to parser
   - `needsEventTarget(name, text?)` — updated to use `getEventEffect`

2. **`actions.ts`** — New `PLAY_ATTACK_EVENT { iid, attackerIid, defenderIid }` action type. One action per legal (event × attack) combination. Inherits Sentinel filtering automatically.

3. **`keywords.ts`** — `computePower` now clamps to `Math.max(0, power)` so debuffs can't push attack below zero.

4. **`engine.ts`** — Multiple additions:
   - `defeatUnitByIid(state, iid)` — helper shared by DEFEAT_UNIT effect and future use
   - `applyAbilityEffect` — new cases for `DEAL_DAMAGE_OPP_BASE`, `DEFEAT_UNIT`, `TRIGGER_ATTACK_WITH` (no-op sentinel), fixed negative stat log formatting
   - `getLegalActions` — updated event branch to use `getEventEffect`; TRIGGER_ATTACK_WITH events skip PLAY_CARD actions; post-filter PLAY_ATTACK_EVENT actions generated for each (event × filtered-attack) pair
   - `applyPlayCard` — uses `getEventEffect` fallback; guards against routing TRIGGER_ATTACK_WITH through PLAY_CARD
   - `applyPlayAttackEvent` — pays for event, applies temporary phaseAtk/phaseHp buff, calls `applyAttack` (which handles exhaustion + turn switch), then removes buff (no-op if attacker died)
   - Dispatcher: `PLAY_ATTACK_EVENT` → `applyPlayAttackEvent`

5. **`GameBoard.tsx`** — Full two-step attack-event state machine:
   - New state: `pendingAttackEventIid`
   - New derived sets: `canPlayAttackEventIids`, `attackEventAttackerIids`, `attackEventTargetIids`, `canAttackEventTargetBase`
   - `effectiveOppTargetIids`: step 2 uses `attackEventTargetIids`
   - `friendlyTargetIids`: step 1 uses `attackEventAttackerIids` (so valid attackers highlight)
   - `effectiveCanTargetBase`: routes through attack-event base check in step 2
   - All click handlers updated for attack-event priority routing
   - `handleHandCardClick` recognizes `canPlayAttackEventIids` cards as clickable
   - New props passed to `YourMat`

6. **`YourMat.tsx`** — New props `canPlayAttackEventIids`, `pendingAttackEventIid`. Hand cards with attack-event actions are clickable. Attack-event pending card shows `selected` state. Banner shows "▸ Select a unit to attack with — click the card again to cancel" in step 1.

*(2026-05-20 session 23)* **Leader abilities, event card effects, and targeting mode UI fully implemented.**

Seven files modified, zero new dependencies. TypeScript: 0 errors.

1. **`types.ts`** — `CardInstance.phaseAtk/phaseHp` (cleared at regroup); `LeaderInstance.exhausted` (cleared at regroup).

2. **`actions.ts`** — New `LEADER_ABILITY` action type (`leaderCardId`, optional `targetIid`).

3. **`abilities.ts`** — Three new systems added above the Coordinate registry:
   - `AbilityEffect` union: `DRAW`, `PHASE_BUFF_UNIT`, `DEAL_DAMAGE_UNIT`, `DEAL_DAMAGE_ANY`, `HEAL_BASE`, `EXHAUST_UNIT`, `GIVE_SHIELD_FRIENDLY`
   - `TargetKind`: `FRIENDLY_UNIT`, `ENEMY_UNIT`, `ANY_UNIT`, `ENEMY_UNIT_OR_BASE`
   - `LEADER_ABILITIES` registry: Chirrut Îmwe (+0/+2 to unit for phase), Admiral Ackbar (exhaust enemy unit for 1 resource)
   - `EVENT_EFFECTS` registry: Strategic Analysis (draw 3), Daring Raid (2 to unit/base), Open Fire (4 to unit), We're In Trouble, Shoot First, Precision Fire, Force Lightning, Orbital Bombardment, Tactical Advantage, Battle Meditation, and ~10 more

4. **`keywords.ts`** — `computePower` adds `phaseAtk`, `effectiveHealth` adds `phaseHp`.

5. **`engine.ts`** — `mapCardInArenas`, `getValidTargets(state, playerId, targetKind)`, `applyAbilityEffect` (unified resolver), `applyLeaderAbility` (pays cost, exhausts leader, resolves effect, switches turn). `getLegalActions` now offers `LEADER_ABILITY` with one action per valid target for targeted abilities; events in `EVENT_EFFECTS` with `targetKind` generate `PLAY_CARD { iid, targetIid }` per valid target. `applyPlayCard` resolves registered event effects. `resolveRegroup` clears `phaseAtk/phaseHp` and un-exhausts all leaders.

6. **`PlayCard.tsx`** — `LeaderData.exhausted` field; `toLeaderData` passes it; `LeaderCard` shows dimmed border + bottom "exhausted" strip when ability used.

7. **`GameBoard.tsx`** — Full targeting state machine: `pendingLeaderAbilityId`, `pendingEventIid`; derived sets (`leaderAbilityTargetIids`, `eventTargetIids`, `effectiveOppTargetIids`, `friendlyTargetIids`); all click handlers updated to route through ability/event targeting before normal attack logic.

8. **`YourMat.tsx`** — ABILITY button on leaders (toggles to CANCEL while targeting). Friendly units highlight as targets. Hand banner turns amber "▸ Select a target" when event targeting mode is active.

*(2026-05-20 session 22)* **Coordinate keyword implemented — abilities registry, engine hooks, UI indicator.**

Four files added/modified, zero new dependencies:

1. **`abilities.ts` (new)** — Per-card ability registry keyed by card name. Maps 12 Coordinate cards to typed effects: `STAT_BUFF`, `KEYWORD` grant, `ON_ATTACK_DRAW`, `ON_ATTACK_PREVENT_DAMAGE`. 10 more cards deferred (need target selection or event triggers — see registry comments).

2. **`keywords.ts`** — New public API:
   - `isCoordinateActive(state, ownerId)` — true when ≥3 units in both arenas combined.
   - `getActiveCoordinateEffects(state, inst, ownerId)` — returns effects from registry if card has Coordinate keyword and threshold is met.
   - `hasEffectiveKeyword(state, inst, ownerId, kw)` — checks native OR Coordinate-granted keyword.
   - `getEffectiveKeywordValue(state, inst, ownerId, kw)` — native value, then Coordinate-granted.
   - `effectiveHealth(state, inst, ownerId)` — card.health + STAT_BUFF HP bonus.
   - `computePower` updated: Grit check uses `hasEffectiveKeyword`; Coordinate STAT_BUFF attack bonus added.
   - `sentinelFilter` updated: uses `hasEffectiveKeyword` for Sentinel (catches Infantry of the 212th) and Saboteur bypass.
   - `dispatchOnPlay` updated: triggers Coordinate keyword grants (e.g. Coruscant Guard Ambush) after native handlers, if threshold is met.
   - `applyAttackFilters` updated: also runs filter handlers for Coordinate-granted keywords (dedup via `ranFilters` set).

3. **`engine.ts`** — In `applyAttack`:
   - `raidBonus` uses `getEffectiveKeywordValue` (catches Hevy Raid 2, Plo Koon Raid 3).
   - Coordinate `ON_ATTACK_DRAW` fires at attack declaration — draws cards into hand.
   - Coordinate `ON_ATTACK_PREVENT_DAMAGE` sets `preventSelfDamage` flag — attacker skips shield burn and takes 0 damage.
   - Saboteur check uses `hasEffectiveKeyword` (catches Republic Commando).
   - `checkDefeated` uses `effectiveHealth` (accounts for STAT_BUFF HP bonuses from 332nd Stalwart, Echo, 41st Elite Corps).

4. **UI** — `useGame.ts` exposes `playerCoordinateActive: boolean`. `GameBoard` threads it to `YourMat`. `YourMat` shows a green `COORDINATE` badge in the Ground Arena zone label when active.

**Implemented cards (12):**
- STAT_BUFF: 332nd Stalwart (+1/+1), 41st Elite Corps (+0/+3), Clone Heavy Gunner (+2/+0), Echo (+2/+2)
- KEYWORD: Coruscant Guard (Ambush), Hevy (Raid 2), Infantry of the 212th (Sentinel), Luminara Unduli (Grit), Plo Koon (Raid 3), Republic Commando (Saboteur)
- ON_ATTACK_DRAW: Anakin Skywalker (draw 1)
- ON_ATTACK_PREVENT_DAMAGE: Aayla Secura

**Deferred (10 cards) — see `abilities.ts` comments and plan below.**

TypeScript: 0 errors.

*(2026-05-20 session 21)* **Game rules pass: resource mechanic, draw fix, Grit, Saboteur, visual card redesigns.**

Six items implemented:

1. **Regroup draw fix** — `resolveRegroup` now draws exactly 2 cards (`Math.min(2, p.deck.length)`) instead of "draw up to 6."

2. **Resource selection mechanic** — Players now exhaust a hand card face-down during regroup to grow their resource pool. New `RESOURCE_CARD` action type. `hasResourced: boolean` added to `PlayerState`. `getLegalActions` (regroup branch) offers RESOURCE_CARD for each hand card + END_REGROUP (skip). `applyResourceCard` removes the card from hand, increments `resources.total`, marks `hasResourced`, then switches to AI or resolves. `applyEndRegroup` does the same two-phase handoff. AI auto-resources (random pick or skip). `isResourcePhase` exposed from `useGame.ts` — drives amber banner in `YourMat` and "SELECT RESOURCE ↓" status in `DividerBar`.

3. **Grit keyword** — `computePower(state, inst, ownerId)` added to `keywords.ts`. Returns `base_attack + inst.damage` when unit has Grit (live computation so mid-combat pings apply). `applyAttack` in `engine.ts` uses `computePower(...) + raidBonus` instead of raw `card.attack + raidBonus`.

4. **Saboteur keyword** — Two parts: (a) `sentinelFilter` in `keywords.ts` carves out Saboteur attackers before applying Sentinel targeting restriction. (b) `applyAttack` in `engine.ts` strips all defender shield tokens before damage when attacker has Saboteur — tracked via `let defenderShields` local so post-strip value propagates to the shield absorption check without re-reading stale state.

5. **Native landscape BaseCard + LeaderCard** — Eliminated CSS rotation hacks. Both cards redesigned as natively horizontal (flex row: art left, info panel right). `sideways` prop removed from both. `TopOppMat` and `YourMat` callers updated.

6. **Official SWU card back** — `CardBack` rewritten as SVG: deep navy gradient background, two crossing lightsaber beams with gradient strokes + glow filter, "STAR WARS / UNLIMITED" text centered. Old custom "Twin Suns Field Manual" design replaced.

TypeScript: 0 errors after all changes.

*(2026-05-20 session 20)* **Tabletop simulator — full board UI ported from Claude Design.**

Ported the Claude Design prototype (`play-area.html`) into production React components. All interaction still wired to the real 2-player game engine from `useGame.ts`.

New files:
- `frontend/src/app/game/layout.tsx` — imports `play.css` scoped to the game route
- `frontend/src/app/game/PlayCard.tsx` — `PlayCard`, `CardBack`, `BaseCard`, `LeaderCard`, `InitToken`; adapters `toPlayCardProps`, `toBaseData`, `toLeaderData`; hover event bus (`emitHoverCard`)
- `frontend/src/app/game/BoardParts.tsx` — `ResourceLattice`, `CardPile`, `HpReadout`, `Counter`, `Stamp`
- `frontend/src/app/game/DividerBar.tsx` — center bar with round/phase, initiative token, Take Counter button, resource readout, expandable action log
- `frontend/src/app/game/YourMat.tsx` — full player mat (ground arena, base+leaders, space arena, resources, deck/discard/init, hand)
- `frontend/src/app/game/TopOppMat.tsx` — opponent mat with compact header, face-down hand, small arena cards
- `frontend/src/app/game/CardPreview.tsx` — hover preview overlay listening on `twin-suns:hover-card` custom event
- `frontend/src/app/game/TweaksPanel.tsx` — palette (desert/imperial/cantina), vibe (manual/print/holo), exhaust angle slider; persists to `twin_suns_play_tweaks` in localStorage

Rewrote: `frontend/src/app/game/GameBoard.tsx` — orchestrator using all above components; same interaction contract (attack select, play card, deploy leader, take counter).

Modified earlier this session: `engine.ts` `log()` now adds timestamps + critical detection; `types.ts` `LogEntry` gets `time?` and `kind?` fields.

Key implementation decisions:
- `card.aspects.map(a => a.aspect_name)` → Title Case strings for `ts-aspect-pip` data-aspect; lowercase for CSS art gradient variables
- Real card art images used when `image_uri` is present; falls back to aspect-gradient `CardArtFill` 
- Hand card: single tap to select, second tap to play (no separate PLAY button)
- `GameCard.tsx` is now unused (superseded by PlayCard.tsx) but left in place for safety

TypeScript: 0 errors.

*(2026-05-19 session 19)* **Achievements system and Pilot Training.**

14 auto-detected achievements across 4 categories (deck building, collection, social, training). `UserAchievement` model + `user_achievements` table with startup auto-migration. `GET /api/me/achievements` endpoint computes earned state from existing data (deck count, collection size, wishlist, shared decks, all-aspects cross-deck check), persists newly earned rows with `earned_at` timestamp, and returns the full catalog with earned/locked status + total points + current rank. Karabast future hook: `source` field on `UserAchievement` rows, no schema change needed later.

Pilot Training: K1–K4 rank track on the profile Achievements tab now has real lesson content (expandable per rank, toggle open/close). Each rank's gate condition is derived from achievements: K1=first_deck, K2=K1+three_decks, K3=K2+all_aspects, K4=K3+ten_decks. Homepage rank track now connects to live achievement data for authenticated users; shows demo (all-0%) when logged out. `COMING_SOON` updated: Achievements removed (it exists), Karabast Import added.

TypeScript: 0 errors. Backend: achievements router imports clean, 14 achievements defined.

*(2026-05-19 session 18)* **Deck analysis panel, public deck sharing, and export modal with marketplace links.**

Three new features fully implemented across backend and frontend. TypeScript compiles clean (0 errors).

**Deck Analysis** — `DeckAnalysisPanel` component (`src/components/DeckAnalysisPanel.tsx`) added. Computed client-side via `useMemo` from already-loaded deck data. Shows: cost curve (8 buckets, 0–7+, bar chart using `ts-curve-chart` CSS classes), type breakdown (Unit/Event/Upgrade/Other with stacked bar and percentages), aspect distribution (`ts-aspect-pip` per aspect with count), rarity counts (`ts-chip`), weighted average cost, and estimated price total. Price total includes leaders + base + main deck.

**Public deck sharing** — `share_token` UUID column added to `Deck` model with startup auto-migration. Backend: `POST /api/me/decks/{id}/share` (generates/returns token) and `DELETE /api/me/decks/{id}/share` (revokes) in `me.py`. New `backend/src/routes/public_decks.py`: `GET /api/decks/share/{token}` (no auth required). Frontend: Share button in `DeckViewClient` generates token, copies URL to clipboard, shows "✓ Copied!" feedback for 3s; Revoke Link button appears when token is active. New proxy routes: `POST/DELETE /api/me/decks/[id]/share/route.ts` and `GET /api/decks/share/[token]/route.ts`. New pages: `app/decks/share/[token]/page.tsx` (server wrapper) + `PublicDeckViewClient.tsx` (read-only deck view, no auth).

**Export with marketplace links** — `DeckExportModal` component (`src/components/DeckExportModal.tsx`). Three sections: (1) Plain-text deck list grouped by type, sorted by cost, with "Copy to Clipboard" button. (2) "Find Cards" — deduplicated list of all deck cards (leaders + base + main) with per-card TCGPlayer and Card Kingdom search links and price. (3) "Buy What You're Missing" — shown only when authenticated; compares deck quantities against user's collection, lists missing cards with "need Nx" label and estimated cost.

**Pre-existing bug fixed** — `DeckViewClient` was calling `/api/me/decks/${deckId}` but no Next.js proxy route existed there. Created `app/api/me/decks/[id]/route.ts` as the GET proxy.

**Note on UI verification** — Automated preview verification was blocked by a dev environment quirk: the preview backend runs from `backend/` without `DB_DIR` set, so it uses `~/.swu/swu_app.db` (not `./databases/swu_app.db`) with an unknown JWT secret. TypeScript compilation passed clean; backend logs confirmed migration and router load; public 404 endpoint verified. Production deploy will confirm UI correctness.

*(2026-05-16 session 17)* **CardDetail design system migration, uptime monitoring, production deploy.**

`CardDetail.tsx` (deck builder side panel) fully migrated off shadcn `Button` and Lucide icons. All Tailwind classes replaced with `ts-*` CSS vars and inline styles matching the design system. Art variant navigation uses `‹`/`›` characters instead of Lucide chevrons. Flip button uses amber border. Stats block uses amber/red/green `ts-*` accent colors. Keywords and card text use design system typography. Action button uses `ts-btn` with conditional amber/red/disabled states. Empty state uses design system placeholder. Zero new dependencies. Uptime monitoring added as `.github/workflows/uptime_check.yaml` — pings `/health` every 15 minutes via GitHub Actions cron; on failure, sends email via `dawidd6/action-send-mail`. Requires three GitHub secrets: `SMTP_USER`, `SMTP_PASSWORD` (same Gmail app password already in Bitwarden), `ALERT_EMAIL` (chanfriendly@gmail.com). All 🟡 and 🟢 production readiness items now resolved.

*(2026-05-16 session 16)* **Email verification, CSS cleanup, deck name validation, loading skeletons.**

Four items from the backlog: (1) Email verification — `EmailVerificationToken` model + startup migration; `create_email_verification_token` / `consume_email_verification_token` helpers in `auth.py`; `_send_verification_email` in `routes.py`; register now creates + emails a token when an address is provided; `POST /api/auth/verify-email` and `POST /api/auth/resend-verification` endpoints added; Next.js proxy routes for both; `/verify-email?token=...` page (handles loading/success/error states); signup success message updated; profile page shows amber banner with "Resend link" button when email is unverified; `email_verified` added to `UserResponse` and `User` interface in `AuthContext`. Login not blocked for unverified users — warning only (appropriate for household app). (2) Cards page inline `<style>` block moved to `globals.css` — `@keyframes spin`, `.xl-show`, `.xl-hide`. (3) Deck name length validation added to both `create_user_deck` and `update_user_deck` — required, non-empty after strip, max 100 chars. (4) Loading skeletons — shimmer animation (`@keyframes ts-shimmer`, `.ts-skeleton` class) added to `globals.css`; card browser loading state replaced with 24 shimmer cards matching the real grid layout; profile decks tab loading replaced with 6 skeleton deck cards; profile collection tab loading replaced with 24 skeleton card thumbnails. Zero TypeScript errors.

*(2026-05-16 session 15)* **Collection % fix, profile avatar, set filter merging.**

Three UX fixes: (1) Collection completion % on the profile header now shows accurately (was always 100% because the collection endpoint returned owned-only cards, making numerator = denominator). Fix: always fetch `?all_cards=true` for collection data; `showAllCards` toggle now only controls display filtering. (2) Profile avatar feature: `avatar_url` column added to `User` model with startup auto-migration; `PATCH /api/me/profile` endpoint added to `me.py`; Next.js proxy at `PATCH /api/me/profile`; profile header shows avatar image when set, falls back to initials; edit mode has URL input field. (3) Sets filter now merges "X Weekly Play" variants into the parent set display name (Secrets of Power, A Lawless Time, Jump to Lightspeed, Legends of the Force). Merging is dynamic from API data — no hardcoding. Query expansion sends both set names to the backend. Zero TypeScript errors.

*(2026-05-16 session 14)* **Password reset emails working. deploy.sh Portainer redeploy fixed.**

Replaced Resend HTTP API with stdlib `smtplib` + Gmail App Password. Resend was abandoned because `onboarding@resend.dev` can only deliver to the Resend account owner — not arbitrary users. The Portainer YAML was also missing `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, and `SMTP_FROM` (only `SMTP_PASSWORD` was present), so those vars never reached the container. Fixed by syncing `docker-compose.prod.yaml` to Portainer. Password reset emails now deliver to any user's email address. No new Python deps — `smtplib` is stdlib. `deploy.sh` Portainer redeploy also fixed: `.env.prod` had placeholder `REPLACE_WITH_SECRET_FROM_BITWARDEN` for `PORTAINER_PASSWORD` instead of the real value. Updated with actual credentials (single-quoted to handle embedded `"`). Full deploy now automated again.

*(2026-05-15 session 13)* **Password reset email delivery wired. Frontend reset flow added.**

Backend `password_reset_request` endpoint now sends via Resend when `RESEND_API_KEY` env var is set. Falls back to returning token in response body when unset (dev mode / no email on account). Uses `requests` lib (already in deps — no new packages). New frontend pages: `/forgot-password` (username form → request reset) and `/reset-password` (token + new password form → confirm reset). Login page has "Forgot password?" link. Zero TypeScript errors.

*(2026-05-15 session 12)* **Production readiness hardening — all must/should items addressed.**

Full backend security pass: token revocation via `token_version` integer on `User` (incrementing invalidates all existing JWTs); JWT now includes `jti` and `tv` claims; `get_current_user` validates `tv` against DB. `ACCESS_TOKEN_EXPIRE_MINUTES` reduced from 10080 → 1440 (24h). Password reset implemented (DB-backed token, 1-hour expiry, one-time use) — backend complete, email delivery deferred until SMTP configured. `DELETE /api/me/account` added (cascades all user data). `POST /api/auth/logout` now requires auth and calls `revoke_user_tokens`. Startup migration auto-adds `token_version` column to existing DBs. All debug `console.log/warn/debug` stripped from frontend (52 calls removed). `ErrorBoundary` added to `layout.tsx`. Auth cookie upgraded to `SameSite=strict`, 24h maxAge. Logout route now proxies token to backend for server-side revocation. `GalacticGamer77` placeholder removed from profile page. Fake `SPOTLIGHT` deck stats and misleading `STATUS_ITEMS` replaced with accurate copy. `COMING_SOON` updated to remove features that now exist (Collection Tracker, Wishlist). `docker-compose.prod.yaml` `ACCESS_TOKEN_EXPIRE_MINUTES` updated to 1440. New proxy routes: `DELETE /api/me/account`, `POST /api/auth/password-reset-request`, `POST /api/auth/password-reset-confirm`. Zero TypeScript errors.

Three items not fully addressable from code alone — see checklist:
- **HTTPS**: requires NPM configuration on TrueNAS → see checklist item 1
- **Password reset email delivery**: backend implemented, needs SMTP wired up → see checklist item 5
- **App DB backup schedule**: needs cron job on TrueNAS → see checklist item 8

*(2026-05-15 session 11)* **Leader filter fix, wishlist state on dialog open, mobile nav, production readiness audit.**

Second-leader aspect filter bug fixed: was incorrectly requiring the second leader to share a secondary aspect with the first (broke multi-aspect leaders like Tobias/Saw/DJ). Now only enforces Heroism/Villainy exclusion. `CardDetailDialog` now accepts `initialOnWishlist` and `onWishlistChange` props — wishlist state is accurate on open, not always `false`. `cards/page.tsx` fetches wishlist IDs on auth and passes them down. Mobile nav: hamburger (☰/✕) added to Navbar for ≤720px viewports with slide-down menu and outside-click dismiss; desktop nav unchanged. See **Production Readiness Checklist** below for what's left before this can be considered shippable.

*(2026-05-12 session 10)* **Deck list page, My Collection toggle, card detail collection count/remove, DeckViewClient redesign.**

`/decks/page.tsx` created: dedicated deck index with leader image strip thumbnails, aspect pips, sort (date/name), inline delete confirmation, empty state, and "+ New Deck" CTA. `DeckViewClient.tsx` fully rewritten to Twin Suns design system (removed shadcn `Button`, Lucide `AlertTriangle`, gray backgrounds). `cards/page.tsx`: added "◇ My Collection" toggle button — when active, switches card grid to full collection data source (all owned cards at once, no pagination). Collection counts now tracked in a `Map<string,number>` alongside the existing `Set`. `CardDetailDialog`: collection count display with `+`/`−` buttons to add/remove copies inline (backed by `POST /api/me/collection` with count); removing last copy drops card from `userCollection` and filters it out of the My Collection view. Navbar: "My Decks" link added for authenticated users. Zero TypeScript errors. Verified in browser.

*(2026-05-11 session 9)* **Full cards page + components redesigned to Twin Suns design system.**

`cards/page.tsx`, `CardGrid`, `CardFilters`, `CardSearch`, and `CardDetailDialog` all rewritten to use `ts-*` CSS vars and the Imperial Field Manual design system. All shadcn components removed (`Card`, `Button`, `Select`, `Dialog`, `DialogContent`, `Checkbox`, `Label`, `Badge`, `Input`). All Lucide icon imports removed. Key changes: `CardGrid` uses inline styles with `var(--ts-*)` tokens, amber owned badge, ts-stamp "In Deck" overlay; `CardFilters` has custom amber checkbox rows and native `<select>` cost dropdowns; `CardSearch` uses ts-filter-pill active tag chips; `CardDetailDialog` is now self-contained (no shadcn dialog wrappers), with aspect pips, stat blocks using amber/red/green accents, and ts-btn action row; `cards/page.tsx` replaces the shadcn Dialog with a fixed-overlay custom modal, display font page header with eyebrow, and native `<select>` sort dropdown. Zero TypeScript errors. Verified in browser: card grid, sort, filter toggle, and card detail modal all render correctly on the Twin Suns theme.

*(2026-05-07 session 7)* **GitHub workflow updated to deploy card DB to TrueNAS after rebuild.**

Added a `Deploy card database to TrueNAS via Portainer exec` step to `.github/workflows/update_dbs.yaml`. After the existing CI build + artifact upload, the new step authenticates with Portainer, finds the `twinsuns-backend` container by name, creates a Docker exec for `python /app/scripts/build_database.py` with `DB_DIR=/databases/cards_db`, then polls until it finishes (10-min timeout). `continue-on-error: true` keeps the workflow green if TrueNAS is unreachable. **Required GitHub secrets not yet set**: `PORTAINER_URL`, `PORTAINER_USER`, `PORTAINER_PASSWORD`, `PORTAINER_ENDPOINT_ID` — values are in `.env.prod`.

*(2026-05-07 session 6)* **Full production verification complete. 26 pytest tests added. All API flows confirmed working.**

Login, deck CRUD, collection, and wishlist all verified end-to-end via API on production (192.168.1.124:4000). Full deck flow confirmed: create with 2 leaders + base + 10 cards, GET list (leaders/base names resolved), GET by ID (enriched card data), PUT (card replace), DELETE. Collection add/remove confirmed (the "double-click" feature from cards page). Profile tab APIs (collection, wishlist, decks) all return authenticated `[]` for new account. 2,360 cards across all 21 sets confirmed. The `SaveDeckDialog` validates 2 leaders + base + 10 minimum cards before POSTing — correct. Deck builder uses `onClick` (single-click) for leaders/base and explicit `+ ADD` button for the cards stage; no double-click in the builder itself. Confirmed duplicate collection proxy routes (`/api/collection` and `/api/me/collection`) — both point to same backend, `api.ts` consistently uses `/api/me/collection`. No issues found.

*(2026-05-07 session 5)* **Login bug fixed. Card database rebuilt (1,398 → 2,360 cards). deploy.sh hardened.**

Login was broken in production: `auth_token` cookie was set with `Secure: true` but the app runs over plain HTTP, so browsers silently discarded the cookie. Every `/api/auth/me` check returned "Not authenticated". Fixed by setting `secure: false` in both `/api/auth/token/route.ts` and `/api/auth/login/route.ts`. The `deploy.sh` Portainer redeploy was also silently failing: the password in `.env.prod` contained `"` which broke both shell `source` parsing and curl JSON body construction. Rewrote `portainer_redeploy()` as an embedded Python script. Also fixed: was reading `StackFileContent` from stack GET (empty in current Portainer version) — now uses `/api/stacks/{id}/file` endpoint. Frontend healthcheck fixed: `localhost` → `127.0.0.1` (Alpine `wget` resolves `localhost` to IPv6 `[::1]` but Next.js standalone only listens on IPv4). Card DB rebuilt locally and via `build_database.py` exec'd inside the backend container — 2,360 cards across 21 sets including new Set 5 (A Lawless Time) and Set 6 (Secrets of Power). Both sets were released after the last DB build (2025-06-26).

*(2026-05-06 session 4)* **Repo cleanup + security hardening.** Deleted ML stubs. Removed backend port 8000 host-binding from prod compose (no longer publicly accessible — internal Docker network only). Deleted `create-test-user` and `debug-login` endpoints (both unauthenticated, exposed known credentials). Wired in `RateLimitMiddleware` at 120 req/min globally; added 10-attempt/min per-IP rate limit on `/api/auth/token` and `/api/auth/register`. Fixed `X-Forwarded-For` spoofability in rate limiter. **Still unverifiable from code**: whether Portainer port 9004 is firewalled at the router — if internet-accessible, that remains the highest-risk surface. Deleted `backend/src/utils/vector_db.py`, `backend/scripts/build_vector_db.py`, and `backend/scripts/rules_parser.py` (ML stubs not wired into anything). Removed stale comment about `NEXT_PUBLIC_API_URL` from `docker-compose.prod.yaml`. Updated CLAUDE.md to remove references to deleted files. `_cleanup_backup/` was already gone. `frontend/src/lib/utils.ts` kept — still used by `src/components/ui/` shadcn components. CHANGELOG.md updated. All PROGRESS.md cleanup items resolved.

*(2026-05-06 session 3)* **Production stack fully operational. Deploy workflow automated — no more manual Portainer step.** Fixed `INTERNAL_API_URL` missing from Portainer stack (was `http://localhost:8000` fallback inside container). `deploy.sh` now authenticates with Portainer API and triggers stack redeploy automatically after push. `docker-compose.prod.yaml` is now the single source of truth (synced with Portainer). Deleted dead `frontend/src/lib/config.ts` (referenced `NEXT_PUBLIC_API_URL` but was never imported — api.ts already uses relative URLs). `frontend/public/.gitkeep` added so Docker build doesn't fail on missing `public/` dir. Full smoke test passed: cards/aspects/types/sets/keywords all 200 on production at `192.168.1.124:4000`. Deploy workflow is now: `./deploy.sh` → done (no Portainer visit needed).

*(2026-05-06 session 2)* **Profile page design pass complete. ML deps split out. All TypeScript errors cleared.** Profile page fully on Twin Suns design system. `requirements-ml.txt` created. Fixed Docker `INTERNAL_API_URL` missing from dev compose (cards wouldn't load in Docker mode). Fixed `stats/route.ts` using wrong env var. Fixed `DeckBuilderClient` `power`/`hp` → `attack`/`health` — **frontend now compiles with zero TypeScript errors**. Production stack is down on TrueNAS (port 4000 connection refused, SSH 24 not responding) — needs manual restart via Portainer before `./deploy.sh` results are visible.

*(2026-05-06)* **Twin Suns Imperial Field Manual design system fully implemented. Wishlist feature live (full stack).** PR #3 merged into `development`. No regressions introduced; pre-existing TypeScript errors in `decks/[id]/route.ts` (Next.js params type) and `DeckBuilderClient.tsx` (`power`/`hp`) are unchanged. Backend `user_wishlist` table auto-creates on next startup via `create_all` — no migration script needed.

*(2026-05-05)* **Production stack rebuilt and operational after cryptominer incident.** Both `twinsuns-backend:local` and `twinsuns-frontend:local` images rebuilt from `--no-cache` using rsynced clean local source. Stack started via `docker-compose.prod.yaml`. Smoke test passed: cards/aspects/types return data, collection/decks return 401 (correct). Stack healthy at `192.168.1.124:4000`.

*(2026-05-05)* **Local dev smoke test complete.** Fixed `PORT=8000` bug in `.env.dev` that caused Next.js to start on port 8000 (conflicting with uvicorn). Local dev environment is stable: frontend on `:3000`, backend on `:8000`. Full end-to-end flow verified: login → deck builder renders → leaders load (2,360 total cards) → aspect filtering logic confirmed → deck CRUD works via API → cards page works with all filters. No console errors.

*(2026-05-04)* **Repo integration complete.** `twin-suns-databases` merged into this repo. All hardcoded `~/.swu` paths replaced with `DB_DIR`. TypeScript clean. **`twin-suns-databases` repo can now be archived.**

*(2026-05-04)* **Production stack is fully operational.** JWT secret rotated. All containers running on TrueNAS (`192.168.1.124:4000`). Smoke test passed: 1398 cards loading, aspects/types/keywords/sets all return data.

---

## What's Done

- [x] **[2026-05-20] Event parser + attack-event flow** — `parseEventText` regex parser (~47 events auto-covered); `getEventEffect` registry+fallback lookup; `TRIGGER_ATTACK_WITH` / `DEFEAT_UNIT` / `DEAL_DAMAGE_OPP_BASE` effect types; `PLAY_ATTACK_EVENT` action type; `defeatUnitByIid` helper; `applyPlayAttackEvent` (pays event, applies temporary phaseAtk/hpBonus buff, executes attack, removes buff); `getLegalActions` generates `PLAY_ATTACK_EVENT` per (event × filtered-attack) pair; `computePower` clamped to Math.max(0) so debuffs can't push attack negative; full two-step UI state machine in `GameBoard` (`pendingAttackEventIid` → pick attacker → pick defender); `YourMat` updated for attack-event card highlighting and banner.

- [x] **[2026-05-20] Leader abilities + event card effects + targeting mode** — `LEADER_ABILITY` action type; `AbilityEffect`/`TargetKind` type system; `LEADER_ABILITIES` and `EVENT_EFFECTS` registries; `applyLeaderAbility`; event effects resolved in `applyPlayCard`; `phaseAtk/phaseHp` on `CardInstance` (cleared at regroup); `LeaderInstance.exhausted` (cleared at regroup); `GameBoard` targeting state machine with `pendingLeaderAbilityId`/`pendingEventIid`; ABILITY button + targeting highlights in `YourMat`; exhausted leader visual in `LeaderCard`.

- [x] **[2026-05-20] UI polish pass** — Resources portrait/landscape orientation with card-back art (`ResCard`, SVG crossed lines, no ID collision). Opponent mat resource lattice. `BaseCard`/`LeaderCard` redesigned as full-bleed image cards (HP overlay bar on base, deployed overlay on leader). "Take Initiative" label for 1v1. Card hover text fixed (data pipeline complete: backend arenas/traits enrichment → full deck fetch on game start → `text` field through `toPlayCardProps`/`toBaseData`/`toLeaderData`).

- [x] **[2026-05-20] 5 gameplay bugs fixed** — Root cause: setup screen used slim deck list endpoint missing `type`, `energy_cost`, `arenas`, `text`. Fixed by: (1) backend `enrich_card_with_relationships` adds arenas + traits; (2) frontend fetches full deck detail (`/api/decks/{id}`) before game start; (3) `BaseCard`/`LeaderCard` hover data includes `image_uri` + `text`.

- [x] **[2026-05-20] Coordinate keyword** — `abilities.ts` registry + `isCoordinateActive` + `hasEffectiveKeyword` + `effectiveHealth`. 12 cards implemented across 4 effect types. `applyAttackFilters` extended to dispatch Coordinate-granted filter keywords. UI shows green COORDINATE badge in arena label when threshold met.

- [x] **[2026-05-20] Regroup draw fix** — `resolveRegroup` draws exactly 2 cards, not "up to 6."
- [x] **[2026-05-20] Resource selection mechanic** — `RESOURCE_CARD` action + `hasResourced` flag on `PlayerState`. Regroup phase now prompts player to exhaust a hand card face-down (or skip). AI auto-resources random card. Resource total grows by 1 per card placed; readied each round. `isResourcePhase` exposed from `useGame.ts`; drives amber banner in `YourMat` and "SELECT RESOURCE ↓" label in `DividerBar`.
- [x] **[2026-05-20] Grit keyword** — `computePower()` helper in `keywords.ts` returns `base_attack + damage_counters` when unit has Grit (continuous, live computation). `applyAttack` in `engine.ts` uses this for attack power.
- [x] **[2026-05-20] Saboteur keyword** — (1) `sentinelFilter` carves out Saboteur attackers before Sentinel restriction applies. (2) `applyAttack` strips all defender shield tokens before damage when attacker has Saboteur; uses `let defenderShields` local to propagate the post-strip value to shield absorption without stale reads.
- [x] **[2026-05-20] Native landscape BaseCard + LeaderCard** — Both redesigned as natively horizontal (flex row: art left, stats right). Removes CSS rotation hack and makes HP/stats text naturally readable. `sideways` prop removed.
- [x] **[2026-05-20] Official SWU card back** — `CardBack` rewritten as SVG with deep navy gradient, crossing lightsaber beams with glow filter, and "STAR WARS / UNLIMITED" text.

- [x] **[2026-05-19] Achievements system + Pilot Training** — `UserAchievement` model, `user_achievements` startup migration, `GET /api/me/achievements` endpoint (lazy eval, INSERT OR IGNORE), 14 achievements across 4 categories. Profile Achievements tab: rank panel with expandable K1–K4 lesson content, achievement grid with locked/earned states. Homepage rank track connected to live API. Karabast `source` hook designed in.
- [x] **[2026-05-19] Set code grouping fix** — card query sort now includes `set_order_case ASC` tiebreaker on all sort modes; original printing always wins as grouped primary. Fixes 11 reprinted cards (Open Fire, Resupply, Tactical Advantage, etc.) incorrectly showing TWI set code.
- [x] **[2026-05-19] Deck analysis panel** — `DeckAnalysisPanel` component: cost curve, type breakdown, aspect distribution, rarity counts, estimated price. Client-side `useMemo`. Used in both authenticated deck view and public share view.
- [x] **[2026-05-19] Public deck sharing** — `share_token` on `Deck` model with startup migration; `POST/DELETE /api/me/decks/{id}/share`; `GET /api/decks/share/{token}` (no auth); Share/Revoke buttons; `PublicDeckViewClient` page.
- [x] **[2026-05-19] Export modal with marketplace links** — `DeckExportModal`: plain-text deck list (TCGPlayer format: `N Name - Subtitle [SET]`), TCGPlayer + Card Kingdom per-card links, "Buy What You're Missing" collection diff.
- [x] **[2026-05-06] DeckBuilderClient `power`/`hp` → `attack`/`health` — zero TypeScript errors**
  - Frontend now compiles clean with no errors at all
- [x] **[2026-05-06] Docker dev compose: add missing `INTERNAL_API_URL=http://backend:8000`**
  - Without this, Next.js route handlers fall back to `localhost:8000` inside the container (wrong); cards/aspects/etc. all fail
  - Also fixed `stats/route.ts` which used `NEXT_PUBLIC_API_URL` server-side instead of `INTERNAL_API_URL`
- [x] **[2026-05-06] Profile page — full Twin Suns design system rewrite**
  - All shadcn components removed from `profile/page.tsx` (Avatar, Badge, Button, Card, Input, Switch, Tabs — Radix Tabs primitives kept for state, styled with `ts-tabs-list`/`ts-tab-trigger`)
  - `framer-motion` and all Lucide icon imports removed
  - `DeckCard`, `CollectionCard`, profile header, tab nav, all empty/loading/error states rewritten with `ts-*` CSS vars and design system patterns
  - `handleAddToCollection` bug fixed: was checking `.ok` on parsed JSON (always false), now uses try/catch on `fetchWithAuth`
- [x] **[2026-05-06] ML dependencies split to `requirements-ml.txt`**
  - `torch`, `sentence-transformers`, `qdrant-client`, `transformers`, `numpy` removed from `requirements.txt`
  - `backend/requirements-ml.txt` created — install separately when working on AI features
- [x] **[2026-05-06] `.env.dev` / `.env.prod` unstaged from git index**

- [x] **[2026-05-06] Twin Suns design system — Imperial Field Manual** (PR #3)
  - `globals.css` + `layout.tsx`: full `--ts-*` CSS custom property system; Cormorant Garamond (display), Spectral (body), JetBrains Mono (data/code) fonts
  - `page.tsx`: hero rewrite with absolute-positioned twin suns (radial gradient circles), scanlines overlay (`repeating-linear-gradient`), left vignette, correct copy, Deck of the Cycle spotlight, Pilot Training rank tracks
  - `Navbar.tsx`: full redesign with Twin Suns branding
  - `login/page.tsx` + `signup/page.tsx`: removed all shadcn/lucide; restyled with `ts-*` classes, Callsign/Security Code/Comm Channel labels, amber CTA buttons, red/green error/success panels
  - `DeckBuilderClient.tsx`: design system integration
  - `icon.svg`: twin suns favicon (amber + red circles); served automatically by Next.js App Router
  - `HandSimModal.tsx`: extracted as standalone component; mulligan mode adds editable opponent leader name input (`<input>` with borderBottom-only style)

- [x] **[2026-05-06] Profile — collection completion % stat**
  - `profile/page.tsx`: `completionPct` computed from `collection` state when `showAllCards=true` data is loaded; amber stat chip rendered in profile header showing `XX.X% · N / M cards`

- [x] **[2026-05-06] Wishlist — full stack** (PR #3)
  - `backend/src/database/models.py`: `UserWishlist` model (`user_id` PK, `card_id` PK, `added_at`); relationships on `User.wishlist` and `Card.wishlist_entries`
  - `backend/src/routes/me.py`: `GET /me/wishlist`, `POST /me/wishlist` (idempotent), `DELETE /me/wishlist/{card_id}`; returns enriched card data
  - `frontend/src/app/api/me/wishlist/route.ts`: GET + POST Next.js proxy
  - `frontend/src/app/api/me/wishlist/[cardId]/route.ts`: DELETE proxy (correct Next.js 15 `Promise<params>` pattern)
  - `profile/page.tsx` Wishlist tab: replaced Coming Soon panel with live card grid (`WishlistCard` mini-cards with aspect-gradient backgrounds, ✕ remove button, empty state + Browse CTA)
  - `CardDetailDialog.tsx`: "☆ Add to Wishlist" / "★ On Wishlist" toggle button in dialog footer

- [x] **[2026-05-04] Repo integration — twin-suns-databases merged in**
  - `backup_db.py` → `backend/scripts/backup_db.py` (updated to use `DB_DIR`)
  - `.github/workflows/update_dbs.yaml` created (Monday 2 AM card DB rebuild)
  - `databases/` canonical directory at repo root (`.gitkeep` tracked, `.db` files gitignored)
  - All hardcoded `~/.swu` paths eliminated — `DB_DIR` env var used everywhere
  - `swu_api_client.py` bug fixed: `_get_db_connection` was overwriting `self.database_path`
  - `docker-compose.yaml` paths updated: `/data/.swu` → `/data`
  - `dev.sh` overrides `DB_DIR` to `./databases/` for native dev after loading `.env.dev`
  - `_cleanup_backup/` deleted
  - TypeScript compiles clean

- [x] **[2026-05-05] Local dev smoke test — all pages and API flows verified**
  - `.env.dev` `PORT=8000` bug fixed — was causing Next.js to start on 8000, conflicting with uvicorn
  - Frontend `:3000`, backend `:8000`, all proxy routes verified (calls go through Next.js, not directly to FastAPI)
  - Cards page: 2,360 cards, all filter categories present (type, aspects, keywords, sets)
  - Deck builder: leaders load, `leadersShareAspects()` filtering logic confirmed in code
  - Auth: register, login, JWT token flow all work
  - Deck CRUD: create, read, delete verified via API
  - TypeScript: 0 errors

- [x] **[2026-05-04] Full production smoke test — stack operational at 192.168.1.124:4000**
- [x] JWT secret rotated on production server; `.env.prod` removed from git and gitignored
- [x] Production-side `DB_DIR` env var added to server compose (backend was falling back to `~/.swu`)
- [x] `types.py` import bug fixed on server: `get_app_db` → `get_card_db` (still needs git commit on server side — server source was patched in-place)
- [x] Old frontend image replaced: rewrote proxy approach from broken `localhost:8000` rewrites to route handlers; rebuilt image on TrueNAS
- [x] All frontend route handlers synced to TrueNAS (`rsync`); image rebuilt and deployed
- [x] Both containers now on same Docker network (`twinsuns_network`); DNS resolution working
- [x] Initial project setup (FastAPI backend + Next.js frontend) — *before 2026-05-04*
- [x] Card database import from official SWU API (1,398+ cards) — *before 2026-05-04*
- [x] Card browsing with search, filtering, sorting — *before 2026-05-04*
- [x] Card grouping by name+subtitle+type (art variant merging) — *before 2026-05-04*
- [x] JWT authentication (register, login, me, logout) — *before 2026-05-04*
- [x] User collection tracking (double-click to add) — *before 2026-05-04*
- [x] Deck builder UI and backend routes (partially — router disabled) — *before 2026-05-04*
- [x] Docker production deployment pipeline (MacBook → Docker Hub → TrueNAS/Portainer) — *2026-05-04 (stabilized)*
- [x] Session 0: CLAUDE.md, CHANGELOG.md, PROGRESS.md created — *2026-05-04*
- [x] `frontend/src/lib/` reconstructed: `utils.ts`, `fetch-utils.ts`, `api.ts` — *2026-05-04*
- [x] Auth token cookie sync added to `fetchWithAuth` (localStorage → cookie for server-side route handlers) — *2026-05-04*
- [x] Four Next.js route handlers fixed: `await cookies()` (Next.js 15 requirement) — *2026-05-04*
- [x] Two route handlers fixed: `NEXT_PUBLIC_API_URL` → `INTERNAL_API_URL` for server-side proxying — *2026-05-04*
- [x] `decks.py` variable name bug fixed (parameter was `get_current_user` instead of `current_user`) — *2026-05-04*
- [x] `main.py` clarified: decks.py disabled intentionally; me.py handles all deck CRUD at `/api/me/decks` — *2026-05-04*
- [x] `cards/page.tsx`: `item.card_id` → `item.card.id` (collection items have nested card object) — *2026-05-04*
- [x] TypeScript compiles clean (0 errors) — *2026-05-04*

---

## What's Next

**Priority order — top item is immediately actionable:**

1. **Play-test the parser** — Run a game with an "Attack with a unit" event (e.g. Improvised Detonation, Breaking In, Shoot First, One Way Out) and verify the two-step attack-event flow works. Verify debuffs (–N/–N cards) apply correctly. Verify Vanquish/Lost and Forgotten defeat instantly. The parser covers ~47 events; confirm the "effect not yet implemented" fallback is rare in practice.

2. **Expand the event registry for common misses** — After play-testing, query `swu_cards.db` for events still hitting the "not yet implemented" path. Add them to `EVENT_EFFECTS` in `abilities.ts`. Focus on cost-1 and cost-2 events (highest play frequency). Common patterns to check: "Draw 1 card." (not in registry), "Give all friendly units +1/+0 for this phase" (aura buff — not parseable, needs custom implementation).

3. **Deferred Coordinate cards now unblocked by targeting system:**
   - **Kit Fisto** — On Attack: deal 3 to a chosen ground unit → `ON_ATTACK_DEAL_DAMAGE` effect type with target selection mid-attack
   - **Reckless Torrent** — When Played: deal 2 to one friendly + one enemy unit → dual target selection in `dispatchOnPlay`
   - **Padmé (Pursuing Peace)** — On Attack: give enemy –3/–0 for this phase → negative `phaseAtk` via `applyAbilityEffect`
   - **Clone Commander Cody** — Aura: all other friendlies get +1/+1 + Overwhelm while Coordinate active → computed live in `computePower`/`effectiveHealth` (no state needed), new `AURA_BUFF` coordinate effect type

4. **AI improvements** — AI currently plays random legal actions. Basic heuristics would improve gameplay significantly: prefer attacking high-HP/attack threats over base when threatened; prefer playing high-value units early; use events efficiently. Even a 50-line priority scorer would make the game feel challenging.

5. **Deploy sessions 18–24 to production** — `./deploy.sh`. Sessions 21–24 are frontend-only (game engine + UI), no schema changes.
6. **Verify achievements in production** — navigate to Profile → Achievements tab; confirm rank panel shows with lesson content, achievement grid loads; build a deck and refresh to confirm `first_deck`/`rank_k1` earned.
7. **Consider adding `/decks/share/[token]` discoverability** — no entry point from the public side yet.

---

### Coordinate keyword — 12 of 22 cards implemented

**Implemented in session 22.** Core system is in place. Remaining cards require capabilities not yet in the engine.

**Deferred cards and what's needed:**

| Card | Effect | Blocker |
|------|--------|---------|
| Clone Commander Cody | Each other friendly unit gets +1/+1 and Overwhelm | Continuous aura buff requires re-evaluating all friendly units on state change |
| Clone Dive Trooper | While attacking, defender gets –2/–0 | Per-attack temp debuff on target requires a transient state layer |
| Padmé Amidala (Pursuing Peace) | On Attack: give enemy –3/–0 for this phase | Phase-scoped debuff on a chosen unit |
| Kit Fisto | On Attack: deal 3 damage to a chosen ground unit | Needs target selection UI |
| Ki-Adi-Mundi | When opponent plays second card each phase: draw 2 | Needs per-player card-play counter and triggered-ability dispatch |
| Pelta Supply Frigate | When Played: create a Clone Trooper token | Token creation system not yet built |
| Reckless Torrent | When Played: deal 2 damage to a friendly and an enemy unit | Needs target selection UI |
| Sanctioner's Shuttle | When Played: capture an enemy unit (cost ≤3) | Capture zone not yet modeled |
| Ahsoka Tano (Leader) | Action [Exhaust]: attack with a unit, it gets +1/+0 | New leader action type |
| Padmé Amidala (Leader) | Action [1, Exhaust]: search top 3 for Republic card | Deck search UI not yet built |
| For The Republic (Upgrade) | Attached unit gains Coordinate Restore 2; costs 2 less with 3 Republic units | Upgrade with Coordinate Restore not hooked up |

---

## What's Blocked

- **AI/ML features** — No spec. ML stub files deleted (session 4). `requirements-ml.txt` retains the deps for when this is revisited. Block until product decision on what Phase 2 AI features actually look like.
- **Offline/PWA support** — Listed in README as planned. No progress. Not a priority until core features are stable.

---

## Failed Approaches

- **Docker multi-service troubleshooting** — Multiple iterations (`741860e` through `7d4eb33`) on getting Docker networking right. Key lesson: dev compose uses `twinsuns_network`, prod uses `twinsuns` — they are different and cannot be mixed. The `INTERNAL_API_URL` (container-to-container) vs `NEXT_PUBLIC_API_URL` (browser-facing) distinction is critical and easy to swap accidentally.
- **Decks router** — The decks router was likely disabled to isolate a crash during the Docker troubleshooting phase. The variable name bug (`current_user` vs `get_current_user`) is probably the root cause. Do not simply uncomment — fix the bug first.

---

## Production Readiness Checklist

What needs to be resolved before this is genuinely shippable. Grouped by severity.

### 🔴 Must-fix before sharing with anyone outside the household

| # | Area | Issue | Fix |
|---|------|-------|-----|
| 1 | **Security** | ~~**No HTTPS.**~~ **✅ DONE** | NPM configured on TrueNAS with Let's Encrypt cert for `twinsuns.chanfriendly.duckdns.org`. |
| 2 | **Security** | ~~No CSRF protection.~~ **✅ DONE** | `SameSite=strict` added to auth cookie in both login and token routes. |
| 3 | **Security** | ~~No token revocation. 7-day JWTs.~~ **✅ DONE** | `token_version` on User model; JWT includes `tv` claim; logout bumps version; `ACCESS_TOKEN_EXPIRE_MINUTES` reduced to 1440 (24h); both backend logout and frontend logout route updated. |
| 4 | **Security** | **Portainer at `:9004` may be internet-accessible.** | Verify at router: port 9004 must NOT be in the port-forwarding table. **Confirmed not forwarded per your response.** |
| 5 | **Auth** | ~~**Password reset — email delivery wired, needs env vars set in prod.**~~ **✅ DONE** | Switched from Resend to Gmail SMTP (`smtplib`, no new deps). Portainer env vars set: `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_FROM`, `APP_BASE_URL`. Reset emails deliver to any user address. |

### 🟡 Should-fix before calling this "done"

| # | Area | Issue | Fix |
|---|------|-------|-----|
| 6 | **Auth** | ~~**No email verification.**~~ **✅ DONE** | `EmailVerificationToken` model; token sent on register (SMTP) or returned in response (dev); `POST /api/auth/verify-email` + `POST /api/auth/resend-verification`; profile page shows unverified banner; login not blocked (warning only). |
| 7 | **Auth** | ~~No account deletion.~~ **✅ DONE** | `DELETE /api/me/account` added to backend (cascades all user data, bumps token_version). Proxy route at `DELETE /api/me/account` added. |
| 8 | **Data** | ~~**`swu_app.db` has no production backup schedule.**~~ **✅ DONE** | Cron added to `truenas_admin` crontab on TrueNAS: `0 3 * * * docker exec twinsuns-backend python /app/scripts/backup_db.py >> /mnt/volume1/docker/twinsuns/backup.log 2>&1`. Runs daily at 3 AM. Backup log at `/mnt/volume1/docker/twinsuns/backup.log`. |
| 9 | **Input validation** | ~~**No length limits on user-submitted strings.**~~ **✅ DONE** | Username max 32 chars. Deck name: required, non-empty, max 100 chars — validated in both `create_user_deck` and `update_user_deck`. |
| 10 | **Frontend** | ~~52 `console.log` calls.~~ **✅ DONE** | All `console.log/warn/debug` stripped. `console.error` in catch blocks retained. |
| 11 | **Frontend** | ~~No error boundary.~~ **✅ DONE** | `ErrorBoundary` component added at `src/components/ErrorBoundary.tsx`, wired into `layout.tsx`. |
| 12 | **Fake data** | ~~Fake STATUS_ITEMS and SPOTLIGHT.~~ **✅ DONE** | `STATUS_ITEMS` replaced with accurate copy. `SPOTLIGHT` fake deck stats removed; replaced with "coming soon" placeholder. `COMING_SOON` list updated (Collection Tracker and Wishlist removed — they exist now). |
| 13 | **Fake data** | ~~`GalacticGamer77` flash.~~ **✅ DONE** | `defaultUserProfile` now initializes with empty strings. |

### 🟢 Nice-to-have / polish

| # | Area | Issue |
|---|------|-------|
| 14 | **UX** | ~~Cards page sidebar inline `<style>` block → globals.css.~~ **✅ DONE** | `@keyframes spin`, `.xl-show`, `.xl-hide` moved to `globals.css`. |
| 15 | **UX** | ~~`CardDetail.tsx` shadcn/Lucide.~~ **✅ DONE** | Full rewrite using `ts-*` CSS vars. No shadcn, no Lucide. Art nav, flip button, stats, keywords, action button all on design system. |
| 16 | **UX** | ~~No loading skeleton / placeholder images.~~ **✅ DONE** | `ts-skeleton` shimmer class in `globals.css`; card browser, profile decks tab, and profile collection tab all use skeleton grids on load. |
| 17 | **Ops** | No structured logging or request tracing. Errors surface only in container stdout. |
| 18 | **Ops** | ~~No uptime monitoring.~~ **✅ DONE** | `.github/workflows/uptime_check.yaml` — pings `/health` every 15 min, emails alert on failure. Requires GitHub secrets: `SMTP_USER`, `SMTP_PASSWORD`, `ALERT_EMAIL`. |

---

## Notes for Next Session

- **Deploy is now fully automated**: `./deploy.sh` builds, pushes to Docker Hub, and triggers Portainer redeploy. No manual steps. Portainer credentials are in `.env.prod`.
- **Production Portainer stack** is ID 94, endpointId 3, at `https://192.168.1.124:9004`. The compose file in Portainer is now synced with `docker-compose.prod.yaml` on disk. `deploy.sh` overwrites the Portainer compose on every deploy — so always edit on disk, not in the Portainer UI.
- **Portainer stack env vars** (set in Portainer UI, not the compose file): `JWT_SECRET`, `DATABASE_PATH`, `ACCESS_TOKEN_EXPIRE_MINUTES`, `CORS_ALLOWED_ORIGINS`. These are preserved by `deploy.sh` (fetched via API and re-submitted). Don't add new required vars here without updating `deploy.sh` or the compose defaults.
- **Database layout on TrueNAS**: `swu_app.db` lives at `/mnt/volume1/docker/twinsuns/databases/app_db/swu_app.db`, card DB at `.../cards_db/swu_cards.db`. These paths are hardcoded in `docker-compose.prod.yaml` since they're TrueNAS-specific.
- `.env.prod` secrets (`JWT_SECRET`, `PORTAINER_PASSWORD`) now stored in Bitwarden as `twinsuns-jwt-secret` and `twinsuns-portainer`. `.env.prod` contains placeholder values. `deploy.sh` fetches from Bitwarden when `BW_SESSION` is set; falls back to `.env.prod` for backwards compatibility.
- When testing decks, use Swagger at `:8000/docs` to test backend directly before testing via the frontend proxy.
- The `_cleanup_backup/` directory at project root is safe to delete — old pre-architecture files, nothing recoverable.
