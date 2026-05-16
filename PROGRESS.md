# PROGRESS.md

**Update this at the end of every session. A stale PROGRESS.md is actively harmful.**

---

## Current Status

*(2026-05-15 session 13)* **Password reset email delivery wired. Frontend reset flow added.**

Backend `password_reset_request` endpoint now sends via Resend when `RESEND_API_KEY` env var is set. Falls back to returning token in response body when unset (dev mode / no email on account). Uses `requests` lib (already in deps — no new packages). New frontend pages: `/forgot-password` (username form → request reset) and `/reset-password` (token + new password form → confirm reset). Login page has "Forgot password?" link. Zero TypeScript errors. **To activate email delivery**: sign up at resend.com, add `RESEND_API_KEY` and `APP_BASE_URL` to Portainer env vars, redeploy. Two infrastructure items still require manual setup — see checklist items 1 and 8.

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

1. **[SECURITY] Email verification on signup** — No email verification. Anyone can register with any string as their email. Now that Resend is wired in, this is a small addition: generate a verification token at register, send via `_send_password_reset_email`-style call, add a `POST /api/auth/verify-email` endpoint. Low urgency while the app is household-only.

2. **[ENHANCEMENT] Cards page sidebar CSS cleanup** — The `.xl-show` media query lives in an inline `<style>` block in `cards/page.tsx`. Should be moved to `globals.css`.

3. **[ENHANCEMENT] Deck name input validation** — Username max_length is now 32 via Pydantic. Deck name has no server-side length limit yet. Add `Field(..., max_length=100)` to the deck create/update schema in `me.py`.

4. **[UX] Loading skeletons** — Card grids flash empty on slow connections. A simple `ts-*`-styled skeleton shimmer would improve perceived performance.

5. **[FEATURE] Activate Resend in production** — Set `RESEND_API_KEY` and `APP_BASE_URL=https://twinsuns.chanfriendly.duckdns.org` in Portainer env vars and redeploy. Password reset emails will then deliver instead of returning token in response body. Users without an email on their account still get token-in-response — consider prompting them to add one.

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
| 5 | **Auth** | **Password reset — email delivery wired, needs env vars set in prod.** | Backend sends via Resend when `RESEND_API_KEY` is set; falls back to token-in-response otherwise. Frontend pages `/forgot-password` and `/reset-password` added. **To activate**: set `RESEND_API_KEY` + `APP_BASE_URL` in Portainer, redeploy. Users without an email on their account always get token-in-response fallback. |

### 🟡 Should-fix before calling this "done"

| # | Area | Issue | Fix |
|---|------|-------|-----|
| 6 | **Auth** | **No email verification.** Anyone can register with any string as their email. | Add email verification on signup, or drop the email field. Not yet implemented. |
| 7 | **Auth** | ~~No account deletion.~~ **✅ DONE** | `DELETE /api/me/account` added to backend (cascades all user data, bumps token_version). Proxy route at `DELETE /api/me/account` added. |
| 8 | **Data** | ~~**`swu_app.db` has no production backup schedule.**~~ **✅ DONE** | Cron added to `truenas_admin` crontab on TrueNAS: `0 3 * * * docker exec twinsuns-backend python /app/scripts/backup_db.py >> /mnt/volume1/docker/twinsuns/backup.log 2>&1`. Runs daily at 3 AM. Backup log at `/mnt/volume1/docker/twinsuns/backup.log`. |
| 9 | **Input validation** | **No length limits on user-submitted strings.** | Username max_length reduced to 32 in `UserCreate`. Deck name limit not yet added. |
| 10 | **Frontend** | ~~52 `console.log` calls.~~ **✅ DONE** | All `console.log/warn/debug` stripped. `console.error` in catch blocks retained. |
| 11 | **Frontend** | ~~No error boundary.~~ **✅ DONE** | `ErrorBoundary` component added at `src/components/ErrorBoundary.tsx`, wired into `layout.tsx`. |
| 12 | **Fake data** | ~~Fake STATUS_ITEMS and SPOTLIGHT.~~ **✅ DONE** | `STATUS_ITEMS` replaced with accurate copy. `SPOTLIGHT` fake deck stats removed; replaced with "coming soon" placeholder. `COMING_SOON` list updated (Collection Tracker and Wishlist removed — they exist now). |
| 13 | **Fake data** | ~~`GalacticGamer77` flash.~~ **✅ DONE** | `defaultUserProfile` now initializes with empty strings. |

### 🟢 Nice-to-have / polish

| # | Area | Issue |
|---|------|-------|
| 14 | **UX** | Cards page sidebar always-visible at ≥1280px needs CSS cleanup (inline `<style>` block → globals.css). |
| 15 | **UX** | `CardDetail.tsx` (deck builder side panel) still uses shadcn `Button` and Lucide icons — not fully on the Twin Suns design system. |
| 16 | **UX** | No loading skeleton / placeholder images — card grids flash empty on slow connections. |
| 17 | **Ops** | No structured logging or request tracing. Errors surface only in container stdout. |
| 18 | **Ops** | No uptime monitoring — no alert if the stack goes down. Healthcheck endpoints exist but nothing watches them externally. |

---

## Notes for Next Session

- **Deploy is now fully automated**: `./deploy.sh` builds, pushes to Docker Hub, and triggers Portainer redeploy. No manual steps. Portainer credentials are in `.env.prod`.
- **Production Portainer stack** is ID 94, endpointId 3, at `https://192.168.1.124:9004`. The compose file in Portainer is now synced with `docker-compose.prod.yaml` on disk. `deploy.sh` overwrites the Portainer compose on every deploy — so always edit on disk, not in the Portainer UI.
- **Portainer stack env vars** (set in Portainer UI, not the compose file): `JWT_SECRET`, `DATABASE_PATH`, `ACCESS_TOKEN_EXPIRE_MINUTES`, `CORS_ALLOWED_ORIGINS`. These are preserved by `deploy.sh` (fetched via API and re-submitted). Don't add new required vars here without updating `deploy.sh` or the compose defaults.
- **Database layout on TrueNAS**: `swu_app.db` lives at `/mnt/volume1/docker/twinsuns/databases/app_db/swu_app.db`, card DB at `.../cards_db/swu_cards.db`. These paths are hardcoded in `docker-compose.prod.yaml` since they're TrueNAS-specific.
- `.env.prod` secrets (`JWT_SECRET`, `PORTAINER_PASSWORD`) now stored in Bitwarden as `twinsuns-jwt-secret` and `twinsuns-portainer`. `.env.prod` contains placeholder values. `deploy.sh` fetches from Bitwarden when `BW_SESSION` is set; falls back to `.env.prod` for backwards compatibility.
- When testing decks, use Swagger at `:8000/docs` to test backend directly before testing via the frontend proxy.
- The `_cleanup_backup/` directory at project root is safe to delete — old pre-architecture files, nothing recoverable.
