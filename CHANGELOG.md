# CHANGELOG

Most recent entry first. Captures *why*, not just *what* — decisions, root causes, alternatives rejected.

---

### 2026-05-21: Production readiness hardening — auth, security headers, deploy

**`PATCH /api/me/password`** — New endpoint in `me.py`. Requires `current_password` (verified via bcrypt) + `new_password` (same validation rules as registration: 8–100 chars, at least one letter, one digit). On success, calls `revoke_user_tokens` to bump `token_version`, which invalidates all other active sessions — important so that a password change from a trusted device closes any stolen sessions. Frontend proxy at `PATCH /api/me/password/route.ts`. Profile page UI is not yet wired; that's a separate task (item 22 in checklist).

**`PATCH /api/me/email`** — New endpoint in `me.py`. Requires `current_password` as confirmation (prevents a stolen session from locking the real user out of their email). Validates format via regex, enforces uniqueness, sets `email_verified=False`, and sends a new verification email. Why require current_password for email change but not profile update: email is the recovery channel — if someone can silently reroute it they own the account. Frontend proxy at `PATCH /api/me/email/route.ts`. Profile page UI deferred (item 22).

**`avatar_url` validation** — `PATCH /api/me/profile` now rejects any `avatar_url` that doesn't start with `https://`. Previously any URL string was accepted. Without this, users could supply `http://` URLs that they control to beacon profile views (any browser rendering the avatar makes a request to that URL, leaking IP + timing). The fix is minimal: a string prefix check before committing.

**`me.py` new imports** — `verify_password`, `get_password_hash`, `revoke_user_tokens`, `create_email_verification_token` from `src.auth.auth`; `_send_verification_email` from `src.auth.routes`; `re` stdlib. The cross-module import from `auth.routes` is a minor coupling smell — if the email send helpers are ever needed in more places, move them to a shared `src/auth/email.py`. Not worth the refactor now.

**`typescript: { ignoreBuildErrors: true }` removed** — This flag was silently suppressing TypeScript errors during `next build`. `tsc --noEmit` confirms 0 errors, so the flag was a leftover from an earlier debugging session. Removed. Builds will now correctly fail on type errors.

**Security headers** — Added `Referrer-Policy: strict-origin-when-cross-origin` and `Permissions-Policy: camera=(), microphone=(), geolocation=()` to `next.config.ts`. The existing three headers (X-Content-Type-Options, X-Frame-Options, X-XSS-Protection) are unchanged. Still missing: HSTS (must be set in NPM, not Next.js — see PROGRESS item 27) and CSP (complex with Next.js inline scripts — see item 30).

**`deploy.sh` SHA tagging** — Each build now produces two Docker tags: `:latest` (for Portainer auto-pull) and `:<git-sha>` (for rollback). Previously only `:latest` was pushed, meaning a bad deploy had no rollback path. To roll back: `docker pull <image>:<sha>` on TrueNAS, retag as `:latest`, trigger Portainer redeploy. The SHA is derived from `git rev-parse --short HEAD` at deploy time.

**Fan-site disclaimer** — Added to homepage footer: "Fan-made tool. Not affiliated with or endorsed by Fantasy Flight Games, Asmodee, or Lucasfilm Ltd. Star Wars: Unlimited and all related properties are trademarks of Lucasfilm Ltd." Standard convention for fan/community tools built on IP-licensed games. Required the moment the URL is shared with anyone outside the household.

---

### 2026-05-19: Achievements system and Pilot Training

**Achievement catalog** — 14 auto-detected achievements across four categories (Deck Building, Collection, Social, Pilot Training). Definitions are hardcoded Python dicts in `backend/src/routes/achievements.py` — no DB table for definitions, which keeps them easy to add or adjust without migrations. Earned state is stored in `user_achievements` with an `earned_at` timestamp.

**Lazy evaluation model** — `GET /api/me/achievements` computes all conditions fresh from existing data (deck count, collection count, wishlist count, shared decks, all-aspects check) on every call. Newly earned achievements are inserted with `INSERT OR IGNORE` so the endpoint is idempotent. This means `earned_at` reflects when the user first fetched achievements after meeting a condition, not the exact moment they triggered it — acceptable for this scale.

**`all_aspects` condition** — queries `deck_cards` in `app_db` to get all card IDs across the user's decks, then queries `card_aspects` in `card_db` to check if all 6 aspects (Heroism, Villainy, Command, Aggression, Cunning, Vigilance) are covered. Heroism/Villainy only appear on leaders, so this requires having at least one Heroism deck and one Villainy deck in the user's collection. The cross-database query uses parameterized IN clauses since SQLite can't join across attached databases.

**Rank gates (cumulative)** — K1 = `first_deck`; K2 = K1 + `three_decks`; K3 = K2 + `all_aspects`; K4 = K3 + `ten_decks`. The `rank` field in the response returns the highest earned rank key (`K4 > K3 > K2 > K1 > null`).

**Karabast stub** — `source TEXT` column on `user_achievements` is the extension point. A future `POST /api/me/achievements/external` route can insert rows with `source='karabast'`. No schema change required. The column is nullable; all in-app earned rows get `source=NULL`.

**Pilot Training lesson content** — static strings embedded in `profile/page.tsx` as `RANK_LESSONS`. Each K1–K4 rank row in the profile Achievements tab is expandable (toggle open/close). Content covers: K1 Twin Suns rules and deck structure; K2 resources, aspect penalties, mulligan decisions, initiative; K3 the six aspects and their identities, deckbuilding philosophy; K4 card advantage, win conditions, testing methodology, organized play prep.

**Homepage rank track** — previously hardcoded with fake progress values. Now uses `fetchUserAchievements()` in a `useEffect` when authenticated; progress per track is derived from earned achievement keys. Logged-out users see all-0% demo values (was previously misleading fake 100%/60%/33%/0% data). `COMING_SOON` updated: "Achievements" removed (it now exists), "Karabast Import" added.

**Export format correction** — `DeckExportModal` text export format updated for TCGPlayer compatibility: quantity is now a plain integer (no `x` suffix), card name includes subtitle when present (`Name - Subtitle`), set code appended in `[brackets]`. Old `cardRef()` helper removed; new `cardLine()` helper handles all three fields.

**Set code grouping fix** — card browser query previously sorted by `c.name ASC` with no tiebreaker. Cards reprinted across sets (e.g., "Open Fire" in SOR and TWI) had undefined primary selection, causing decks to randomly receive the wrong set's card ID. Fixed by adding a canonical tiebreaker (`set_order_case ASC, CAST(card_number AS INTEGER) ASC`) to every sort mode. SOR (1) now always beats TWI (3), so original printings are consistently the grouped primary. 11 affected cards confirmed (Daring Raid, Open Fire, Outflank, Padawan Starfighter, Patrolling V-Wing, Resupply, Tactical Advantage, Take Captive, Vanquish, Volunteer Soldier, Waylay).

---

### 2026-05-19: Deck analysis, public sharing, and export with marketplace links

**Deck Analysis panel** — New `DeckAnalysisPanel` component renders below the card grid on both the authenticated deck view and the public share view. All computation is client-side via `useMemo` — no additional fetch calls. Cost curve uses the existing `ts-curve-chart`/`ts-curve-bar`/`ts-curve-bar-fill` CSS classes defined in `globals.css`. Price total covers leaders + base + main deck; shows "(N/M priced)" when some cards lack price data. Aspects use the `ts-aspect-pip` design system element.

**Public deck sharing** — `share_token TEXT` column added to the `decks` table via `PRAGMA table_info()` startup migration (same pattern as the `token_version` migration in session 12). `share_token` is nullable and unique; `NULL` means the deck is not currently shared. Two new backend endpoints in `me.py`: `POST /api/me/decks/{id}/share` (idempotent — returns existing token if one already exists, generates `str(uuid.uuid4())` if not) and `DELETE /api/me/decks/{id}/share` (sets to NULL, returns 204). New `backend/src/routes/public_decks.py` with `GET /api/decks/share/{token}` — no auth, uses `enrich_card_with_relationships` from `db_helpers.py` (the fuller version with traits/arenas). Returns same shape as the authenticated deck endpoint.

**Export modal** — `DeckExportModal` component follows the same `ts-modal-backdrop`/`ts-modal` pattern as `HandSimModal`. Text deck list groups cards by type (Unit → Event → Upgrade → Other), sorts within each group by `energy_cost` ascending. TCGPlayer URL: `https://www.tcgplayer.com/search/star-wars-unlimited/product?productLineName=star-wars-unlimited&q={name}&view=grid`. Card Kingdom URL: `https://www.cardkingdom.com/catalog/search?search=NM&filter[name]={name}&filter[game]=swu`. "Buy What You're Missing" section computes `needed = deck_quantity - owned_count` per card; only appears when the `collection` prop is passed (i.e., when the user is authenticated and collection has loaded lazily).

**Pre-existing proxy bug fixed** — `DeckViewClient` was calling `fetchWithAuth('/api/me/decks/${deckId}')` but no Next.js route handler existed at `/api/me/decks/[id]`. This meant the individual deck view was broken before this session. Fixed by creating `app/api/me/decks/[id]/route.ts` as a GET proxy.

**Why analysis is client-side** — The deck data is already fetched by `DeckViewClient`/`PublicDeckViewClient` on mount. Adding a second endpoint for analysis would require a round-trip for data already in memory. Client-side `useMemo` is faster, simpler, and keeps the backend stateless.

**Why public sharing uses `share_token` not deck ID** — Exposing deck IDs in public URLs would allow enumeration of all decks in the database. A random UUID token is unguessable and revocable independently of the deck itself.

---

### 2026-05-16: UX pass, email verification, design system completion, uptime monitoring

**Collection completion % fix** — Profile header was always showing 100% because the collection endpoint only returned owned cards when `all_cards=false`, making numerator === denominator. Fix: always fetch `?all_cards=true`; the `showAllCards` toggle now only affects display filtering, not the fetch.

**Profile avatar** — `avatar_url` column added to `User` model with startup auto-migration. `PATCH /api/me/profile` endpoint in `me.py`. Next.js proxy at `PATCH /api/me/profile`. Profile header shows avatar image when set, falls back to initials. Edit mode exposes a URL input field. `UserResponse` updated to include `avatar_url`.

**Set filter merging** — "Secrets of Power Weekly Play", "A Lawless Time Weekly Play", "Jump to Lightspeed Weekly Play", and "Legends of the Force Weekly Play" now merged into their parent sets in the filter UI. The merge is computed dynamically from the API response — any future set that has a Weekly Play sibling is handled automatically. When a merged set is selected, the query param expands to both set names.

**Email verification** — `EmailVerificationToken` model (mirrors `PasswordResetToken`). `create_email_verification_token` / `consume_email_verification_token` helpers. Register endpoint creates a token and emails it when SMTP is configured; falls back to returning the token in the response body for dev/no-SMTP. `POST /api/auth/verify-email` and `POST /api/auth/resend-verification` endpoints. Next.js proxies for both. `/verify-email?token=...` page handles loading/success/error. Signup success message updated. Profile page shows amber banner with "Resend link" button when `email_verified=false`. Login not blocked for unverified users — warning only (right call for a household app where lockout would be disruptive). `email_verified` added to `UserResponse` and `AuthContext` `User` interface.

**CSS cleanup** — `@keyframes spin`, `.xl-show`, `.xl-hide` moved from an inline `<style>` block in `cards/page.tsx` into `globals.css`. `@keyframes ts-shimmer` and `.ts-skeleton` added to `globals.css` for the new loading skeletons.

**Loading skeletons** — Card browser loading state replaced with a 24-card shimmer grid matching the real card grid layout. Profile decks tab gets 6 skeleton deck cards. Profile collection tab gets 24 skeleton card thumbnails. Shimmer uses a gradient sweep animation on `--ts-bg-2`/`--ts-bg-3` colors — visible but not distracting against the dark theme.

**Deck name validation** — Both `create_user_deck` and `update_user_deck` now enforce: required, non-empty after strip, max 100 characters. 400 with a clear message on violation.

**CardDetail.tsx design system migration** — Full rewrite removing the last shadcn and Lucide dependencies in the app. `Button` from `@/components/ui/button` replaced with `ts-btn`. `ChevronLeft`/`ChevronRight` from `lucide-react` replaced with `‹`/`›` characters. All Tailwind color classes replaced with `ts-*` CSS vars. Art nav, flip button, stats block, keywords, card text, empty state, and action button all on the design system. No new dependencies added or removed.

**Uptime monitoring** — `.github/workflows/uptime_check.yaml` pings `https://twinsuns.chanfriendly.duckdns.org/health` every 15 minutes via GitHub Actions cron. On failure (non-200 or timeout), sends email via `dawidd6/action-send-mail`. Requires three GitHub secrets to be set: `SMTP_USER`, `SMTP_PASSWORD` (same Gmail app password in Bitwarden as `twinsuns-smtp-*`), `ALERT_EMAIL`.

---

### 2026-05-16: Password reset emails — switched from Resend to Gmail SMTP

**What changed:**

**Replaced Resend HTTP API with Gmail SMTP** — `_send_password_reset_email()` in `backend/src/auth/routes.py` was rewritten to use Python stdlib `smtplib` with STARTTLS. No new dependencies. Reads `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM`, and `APP_BASE_URL` from env vars. Defaults: `smtp.gmail.com:587`, from address falls back to `SMTP_USER` if `SMTP_FROM` is not set. `requests` import and all Resend HTTP logic removed.

**Why Resend was abandoned:**
1. Resend's `onboarding@resend.dev` sender (available without a verified domain) can only deliver to the Resend account owner's email address — it cannot send to arbitrary users. This made it fundamentally unsuitable for a password reset feature where the recipient is whoever registered the account.
2. Even with the correct API key, emails to other users would silently fail or be blocked by Resend's sandbox restrictions.

**`docker-compose.prod.yaml` updated** — Backend environment block now has all 6 SMTP vars (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM`, `APP_BASE_URL`) using `${VAR:-default}` Portainer substitution syntax. Old Resend vars removed.

**Root cause of the multi-session debug loop** — Two separate issues compounded:
1. The Portainer YAML was only passing `SMTP_PASSWORD` — `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, and `SMTP_FROM` were never in the environment block and never reached the container. The code couldn't log in without `SMTP_USER`.
2. The `deploy.sh` Portainer redeploy step fails with HTTP 422 "Invalid credentials", so new images weren't being pulled automatically. After pushing, a manual "Update the stack" in the Portainer UI was required. This is a known open issue.

**Key lesson** — When adding new env vars to a service, the `docker-compose.prod.yaml` file AND the Portainer stack editor must both be updated. The compose file is the local source of truth, but Portainer uses its own stored copy — they diverge silently when the deploy step fails. Always verify env vars are present in the running container after a config change (`docker exec twinsuns-backend env | grep SMTP`).

---

### 2026-05-15: Full production readiness pass — security, cleanup, infrastructure

**What changed:**

**Token revocation via `token_version`** — Added an integer column to the `User` table. Logging out (or resetting a password) increments it. JWTs now carry a `tv` claim; `get_current_user` rejects tokens where the claim doesn't match the DB value. This means a stolen session token is invalidated the moment the user logs out. No blocklist needed — a single DB read per request handles it. Startup migration auto-adds the column to existing databases via `PRAGMA table_info` check + `ALTER TABLE ADD COLUMN`.

**JWT expiry reduced 10,080 → 1,440 minutes (7 days → 24 hours)** — Combined with revocation, the worst-case stolen-token window is now 24h and shrinks to zero on explicit logout. `docker-compose.prod.yaml` updated to match.

**`SameSite=strict` on auth cookie** — Prevents the cookie from being sent on cross-site requests, mitigating CSRF attacks against state-mutating endpoints. Also tightened `maxAge` to match the 24h JWT lifetime.

**Authenticated logout with server-side revocation** — The Next.js `/api/auth/logout` route now forwards the token to `POST /api/auth/logout` on the backend (which increments `token_version`) before clearing the cookie. Previously it only cleared the client-side cookie, leaving the JWT valid until expiry.

**Password reset — full stack** — `PasswordResetToken` DB model (UUID primary key, 1h expiry, one-time use). `POST /api/auth/password-reset-request` creates a token; `POST /api/auth/password-reset-confirm` validates, updates the password, and bumps `token_version` to invalidate all existing sessions. Next.js proxy routes added for both. Email delivery via Resend when `RESEND_API_KEY` is set; falls back to token-in-response for dev / users without an email. Frontend: `/forgot-password` and `/reset-password` pages on design system; "Forgot password?" link on login page.

**`DELETE /api/me/account`** — Backend cascades all user data (`Deck`, `DeckCard`, `UserCollection`, `UserWishlist`), bumps `token_version`, returns 204. Next.js proxy at `DELETE /api/me/account` clears the auth cookie on success.

**All 52 `console.log/warn/debug` calls stripped** — Removed from `AuthContext.tsx`, `DeckBuilderContext.tsx`, `profile/page.tsx`, `CardDetailDialog.tsx`, `DeckBuilderClient.tsx`, `Navbar.tsx`, `SaveDeckDialog.tsx`, `lib/api.ts`, and all `src/app/api/**/route.ts` files. `console.error` in catch blocks retained.

**`ErrorBoundary` component** — `src/components/ErrorBoundary.tsx` (React class component with "Try Again" reset). Wraps `{children}` in `layout.tsx` so an unhandled render error shows a styled error panel instead of a blank page.

**Fake data removed** — `SPOTLIGHT` fake deck stats replaced with a "coming soon" placeholder. `STATUS_ITEMS` in Navbar replaced with accurate copy. `COMING_SOON` on home page updated (Collection Tracker and Wishlist removed — they're live now). `defaultUserProfile.username` was `'GalacticGamer77'`; now initializes empty to eliminate the flash before auth resolves.

**Infrastructure (confirmed operational):**
- HTTPS: Let's Encrypt cert via Nginx Proxy Manager for `twinsuns.chanfriendly.duckdns.org`. TLS 1.3, valid until 2026-07-01.
- App DB backup cron: `0 3 * * * docker exec twinsuns-backend python /app/scripts/backup_db.py` on TrueNAS `truenas_admin` crontab, logging to `/mnt/volume1/docker/twinsuns/backup.log`.

---

### 2026-05-15: Password reset email delivery + frontend reset flow

**What changed:**

**Backend email sending via Resend** — `backend/src/auth/routes.py` now has `_send_password_reset_email()` using the Resend HTTP API (`POST https://api.resend.com/emails`). Uses `requests` (already in `requirements.txt` — no new dep). When `RESEND_API_KEY` env var is set, the `password-reset-request` endpoint emails the reset link to the user's address instead of returning the token in the response. Falls back to token-in-response when: the env var is not set, the user has no email on their account, or the Resend call fails. Failures are logged but don't surface as errors (always 200 to avoid enumeration).

**Why Resend over SMTP** — Resend's API is HTTP + one API key, no SMTP ports/TLS config, and `requests` is already a dep. Mailgun/SES are equivalent but require more setup. Resend free tier (3,000/month) is more than sufficient for this use case.

**`APP_BASE_URL` env var** — Used to build the reset link (`{APP_BASE_URL}/reset-password?token={token}`). Defaults to `http://localhost:3000` if not set. Set to `https://twinsuns.chanfriendly.duckdns.org` in production.

**Frontend `/forgot-password`** — Username form. POSTs to `/api/auth/password-reset-request`. Always shows success message after submit (no enumeration). Design system consistent with login/signup.

**Frontend `/reset-password`** — Reads `?token` from URL query string; falls back to a manual token paste field if not present. POSTs to `/api/auth/password-reset-confirm`. On success redirects to `/login` after 3s. Client-side validation: passwords must match and be ≥8 chars before hitting the API.

**Login page** — "Forgot password?" link added next to "Enlist now".

---

### 2026-05-11: Cards page + components — full Twin Suns design system rewrite

**What changed:**

**All shadcn and Lucide deps removed from the cards flow** — `cards/page.tsx`, `CardGrid`, `CardFilters`, `CardSearch`, and `CardDetailDialog` were all using the old purple/gray shadcn theme (`bg-gray-900`, `border-gray-700`, `text-purple-500`, Lucide icons). All five files rewritten to use `ts-*` CSS custom properties and the Imperial Field Manual design system. No new packages added.

**`CardDetailDialog` decoupled from shadcn Dialog** — Previously rendered inside a shadcn `<Dialog>`/`<DialogContent>` wrapper in `cards/page.tsx`, importing `DialogTitle`/`DialogHeader`/`DialogFooter`. Now self-contained; `cards/page.tsx` provides a fixed-overlay custom modal (`position: fixed`, `rgba(26,22,17,0.92)` backdrop, `var(--ts-panel)` inner panel with `border: 1px solid var(--ts-line)`). This removes the dependency and makes the component portable.

**Design specifics:** `CardGrid` — amber owned badge, ts-stamp "In Deck" overlay, mono set-code + amber cost in card footer, hover border on `var(--ts-line-2)`. `CardFilters` — custom amber checkbox squares (no shadcn Checkbox), native `<select>` for cost range, ts-eyebrow section headers. `CardSearch` — ts-input search bar, ts-filter-pill active-tag chips with × dismiss, expandable inline panel for mobile. `CardDetailDialog` — `ts-aspect-pip` hexagons, stat blocks with `var(--ts-amber/red/green)` accent values, ts-btn action row. `cards/page.tsx` — display font title with eyebrow, native `<select>` sort dropdown, ts-btn mobile filter button.

**Why shadcn was removed rather than restyled** — The shadcn components use Tailwind utility classes internally; overriding them with `ts-*` vars requires fighting specificity across both layers. Replacing with native HTML + inline styles using the CSS vars is simpler, more predictable, and matches the pattern already established by the profile page and deck builder redesigns.

---

### 2026-05-07: Login bug fixed, card database rebuilt (2,360 cards), deploy.sh hardened

**Login was broken — root cause: `Secure` cookie flag on HTTP connection**

`/api/auth/token` and `/api/auth/login` both set the `auth_token` cookie with `secure: process.env.NODE_ENV === 'production'`. In the Docker container `NODE_ENV=production`, so `Secure: true` was always set. Browsers silently drop `Secure` cookies on non-HTTPS connections (the app runs over plain HTTP at `192.168.1.124:4000`). The cookie was never stored, so every subsequent `/api/auth/me` check (which reads the cookie, not the `Authorization` header) returned "Not authenticated". Fixed by setting `secure: false` in both route handlers — this app runs on a local network without TLS.

**`/api/auth/me` only reads cookies, not `Authorization` header** — The `fetchWithAuth` utility sends `Authorization: Bearer token`, but the `/api/auth/me` route handler only reads `cookieStore.get('auth_token')`. This works because after the token response sets the cookie, browsers send it automatically. The `Authorization` header in `fetchWithAuth` calls to `/api/auth/me` is redundant but harmless.

**Card database rebuilt: 1,398 → 2,360 cards** — Last rebuild was `2025-06-26`. Two new main sets released since: Set 5 (A Lawless Time / LAW, 267 cards) and Set 6 (Secrets of Power / SEC, 266 cards). Also new: Intro Battle: Hoth (IBH, 104), 2026 Promo (P26, 66), 2026 Twin Suns (TS26, 88), weekly play sets. Rebuild run locally via `build_database.py`, then exec'd inside the backend container via Portainer API to write to the TrueNAS volume mount (`/databases/cards_db/swu_cards.db`).

**`deploy.sh` Portainer redeploy was silently failing** — Two bugs: (1) `PORTAINER_PASSWORD` in `.env.prod` contains `"` and `:` — shell `source` via `grep | source <(...)` produced `unmatched "`, leaving the variable empty. Fixed by quoting the value in `.env.prod` with single quotes. (2) Even with the password fixed, using the password in shell string interpolation (`-d "{...\"password\":\"${pass}\"..."`) broke JSON when the value contained `"`. Rewrote `portainer_redeploy()` as an embedded Python script that reads `.env.prod` directly and uses `json.dumps` for all request bodies. Also fixed: was using `StackFileContent` from the stack GET response (empty in newer Portainer) — now reads compose from `/api/stacks/{id}/file`.

**Frontend healthcheck `localhost` → `127.0.0.1`** — Docker's Alpine `wget` resolved `localhost` to `[::1]` (IPv6) but Next.js standalone listens on `0.0.0.0` (IPv4 only). Health check always failed even though the app was serving correctly. Fixed in `docker-compose.prod.yaml`.

---

### 2026-05-06: Security hardening — close cryptominer follow-up gaps

**What changed:**

**Backend port 8000 unexposed in prod** — Removed `ports: "8000:8000"` from `docker-compose.prod.yaml`. The backend is reachable by the frontend container over the internal Docker network (`http://backend:8000`) — it never needed to be host-bound. Exposing it meant FastAPI was directly reachable on the host, bypassing the Next.js proxy and all application-level controls. Only port 4000 (frontend) is now host-exposed.

**Debug/test endpoints deleted** — `GET /api/auth/create-test-user` (created `testuser`/`password123` with no auth) and `GET /api/auth/debug-login` (returned a bcrypt hash of `password123` in plain text) were both publicly accessible with no authentication. Both removed from `auth/routes.py`.

**Rate limiter activated** — `RateLimitMiddleware` (in `src/utils/rate_limiter.py`) was never wired in despite existing. Added to `main.py` at 120 req/min per IP across all endpoints. Additionally added a stricter in-route dependency (`_check_auth_rate_limit`) on `/api/auth/token` and `/api/auth/register` at 10 attempts/60s per IP. The middleware's `X-Forwarded-For` trust was also removed — only the direct connection IP is used, since that header is attacker-controlled with no trusted upstream proxy.

**`/debug-routes` removed** — Endpoint that listed all registered API routes. Unnecessary info disclosure.

**Note: Portainer (port 9004) firewall state unknown** — If 9004 is internet-accessible, that remains the highest-risk item (anyone with the Portainer password can spin up any container). Must be verified at the router/firewall level — not addressable in this codebase.

---

### 2026-05-06: Repo Cleanup — ML stubs deleted, stale docs updated

**What changed:**

**ML stub files deleted** — `backend/src/utils/vector_db.py`, `backend/scripts/build_vector_db.py`, and `backend/scripts/rules_parser.py` removed. None of these were imported by any active route or referenced in the running app. `requirements-ml.txt` retains the deps for the future; its comment updated to not reference the deleted files. CLAUDE.md updated to match.

**`docker-compose.prod.yaml` comment removed** — Stale comment about `NEXT_PUBLIC_API_URL` removed from the frontend service env block. The var is not needed at runtime (client code uses relative URLs; confirmed not present in any source file or env config).

**`frontend/src/lib/utils.ts` kept** — Verified still used by `src/components/ui/` shadcn components (`cn()` called in label, card, dialog, tabs, select, alert, switch, button, badge, avatar, slider, input, checkbox).

---

### 2026-05-06: Profile Page Design Pass + ML Dep Cleanup

**What changed:**

**Profile page — full design system rewrite** — The profile page (`profile/page.tsx`) was completely rewritten from the old Tailwind/shadcn purple theme to the Twin Suns `ts-*` design system. All shadcn imports removed: `Button`, `Card`/`CardContent`/`CardHeader`/`CardTitle`, `Badge`, `Avatar`/`AvatarFallback`/`AvatarImage`, `Tabs`/`TabsList`/`TabsTrigger`/`TabsContent` (only the last four are kept — the Radix Tabs primitives are kept for tab state management with `ts-tabs-list` / `ts-tab-trigger` CSS classes applied), `Input`, `Switch`, `Label`. `framer-motion` removed. Lucide icon imports removed. Logic layer (data loading, auth redirect, deck delete, collection add, wishlist remove) is unchanged.

**Profile `handleAddToCollection` bug fixed** — Previously the function was defined as a module-level export outside the component and checked `response.ok` on the return value of `fetchWithAuth` — which returns parsed JSON, not a `Response` object, so `response.ok` was always `undefined` (falsy) and the collection never reloaded after adding a card. Fixed: moved the function inside the component as `handleAddToCollection`, use try/catch around `fetchWithAuth` (success = no throw), call `loadData()` on success.

**`.env.dev` / `.env.prod` unstaged** — Both files were accidentally staged or in an unmerged state from a prior commit. Removed from git index with `git rm --cached`. Both are in `.gitignore` and should never be tracked.

**ML deps split to `requirements-ml.txt`** — `torch`, `sentence-transformers`, `qdrant-client`, `transformers`, `numpy` moved from `requirements.txt` to `backend/requirements-ml.txt`. These are only needed for `build_vector_db.py` and `src/utils/vector_db.py`, neither of which is imported by any active route. Removing them from the core requirements reduces Docker build time significantly (torch alone is ~2 GB). Install with `pip install -r requirements-ml.txt` when AI features are being developed.

---

### 2026-05-06: Twin Suns Design System + Wishlist Feature (PR #3)

**What changed:**

**Full design system replacement** — The original Tailwind/shadcn purple theme was replaced with the "Imperial Field Manual" Twin Suns visual identity. Root motivation: the prior design used generic shadcn components (Card, Button, Badge, Avatar, Tabs, etc.) with a gray-950/purple-600 palette that had no relation to the Star Wars Unlimited aesthetic. The new system is built on `--ts-*` CSS custom properties with three custom font stacks (Cormorant Garamond for display headers, Spectral for body copy, JetBrains Mono for data/labels), all loaded via Google Fonts in `layout.tsx`. This means zero reliance on Tailwind utility classes for the redesigned pages — components use inline `style` props against the CSS vars instead.

**Hero section layering approach** — The twin suns are implemented as `position: absolute` radial-gradient `<div>` elements (not SVG or images) bleeding off the top-right of the hero section at z-index 1–2. Scanlines (`repeating-linear-gradient`) sit at z-index 3, the left vignette (`linear-gradient` to right) at z-index 4, and the content grid at z-index 5. This avoids a separate image asset and makes the suns purely CSS. The left vignette starts opaque at 38% and fades to transparent at 75%, keeping the left-side copy legible without blocking the suns on the right.

**Favicon** — `frontend/src/app/icon.svg` is the twin suns mark (amber circle + red circle). Next.js App Router automatically serves any `icon.*` file in `src/app/` as the browser tab favicon — no manual `<link rel="icon">` needed.

**Login/Signup pages** — Both pages were rebuilt from scratch (removed all shadcn imports: Button, Card, Input, Label, Alert, AlertTriangle, lucide-react icons). All auth logic (`login`, `register`, validation, error handling, redirect on success) was preserved exactly. The decision to do a full rewrite rather than patch the existing components was driven by the depth of shadcn dependency — the component tree was so intertwined that incremental edits would have left orphan imports.

**HandSimModal extracted** — The hand simulator was inlined inside `DeckBuilderClient.tsx`. Extracted to `frontend/src/app/deck-builder/HandSimModal.tsx` to keep the deck builder file manageable. Added `useState` for opponent leader name with a controlled `<input>` styled as borderBottom-only (no background/border box) so it reads as an inline editable label rather than a form field.

**Wishlist — backend design decisions:**
- `UserWishlist` uses a composite primary key (`user_id` + `card_id`) rather than a separate autoincrement `id`. This enforces uniqueness at the DB level and the `POST /me/wishlist` route does an idempotent add (check → skip if exists) rather than relying solely on a DB unique constraint, which would surface as a 500 error to the client.
- No `count` column — unlike `UserCollection`, you either want a card or you don't. This could change if "want N copies" is ever needed, but the simpler model is correct for now.
- SQLAlchemy `create_all` auto-creates the table on first backend start. No Alembic migration needed because the app DB schema is managed this way throughout (no migration framework is in use).

**Wishlist — frontend proxy pattern:**
- `wishlist/[cardId]/route.ts` uses `Promise<{ cardId: string }>` for the `params` type — the correct Next.js 15 pattern. The existing `decks/[id]/route.ts` does NOT use this pattern (pre-existing issue, not introduced here).
- The wishlist fetch in `profile/page.tsx` uses plain `fetch('/api/me/wishlist')` (not `fetchWithAuth`) — the route handler reads from the cookie just like the collection route does.

**Profile page — partial design update** — The wishlist tab and collection completion stat chip are on the new design system. The rest of the profile page (header, decks tab, collection tab) still uses the old Tailwind/shadcn purple theme. A full profile rewrite was scoped out of this session to avoid a massive single-session PR. The mixed state is intentional and documented in What's Next.

---

### 2026-05-05: Local Dev Smoke Test + PORT Conflict Fix

**What changed:**

**`.env.dev` `PORT=8000` removed** — `dev.sh` loads `.env.dev` via `export $(...)`. The file had a bare `PORT=8000` line which Next.js (and many Node processes) automatically pick up as the port to listen on. When `npm run dev` started, it saw `PORT=8000` in the environment and bound to 8000 instead of the default 3000. Since uvicorn was already on 8000, the two processes raced for the same port — whichever started second would either crash or shadow the first. Fixed by removing the `PORT` line (the backend port is hardcoded in `dev.sh` via `uvicorn ... --port 8000`; Next.js defaults to 3000 without it). The `BACKEND_PORT=8000` and `FRONTEND_PORT=4000` named vars remain as documentation.

**Root cause of the confusion:** `dev.sh` said "backend failed to start (port already in use)" then said "backend started successfully" (because the health check hit the still-running *old* uvicorn). Then the new Next.js inherited `PORT=8000` and started there, shadowing the old uvicorn. Result: `GET /health` returned Next.js HTML, all FastAPI endpoints unreachable.

**Local dev smoke test results:**
- Frontend: `http://localhost:3000` — 200 OK, all pages render
- Backend: `http://localhost:8000` — all API endpoints healthy
- Proxy pattern confirmed: browser calls go through `:3000/api/...`, Next.js forwards to `:8000/api/...`
- Cards page: 2,360 cards, full filter sidebar (type, aspects, keywords, sets, cost range)
- Deck builder: leaders grid loads, aspect compatibility filtering logic confirmed in code
- Auth flow: register, login, JWT, protected routes all work
- Deck CRUD: create/read/delete via `GET|POST|DELETE /api/me/decks` all return correct status codes
- TypeScript: 0 errors

---

### 2026-05-04: Session 0 Part 3 — JWT Rotation, Production Smoke Test, Full Stack Repair

**What changed:**

**JWT secret rotated** — Old secret (`e21bb8c4...`) was committed in `.env.prod` AND hardcoded in the server's `docker-compose.prod.yaml` (which itself had a third secret value, `356aefd7...`, indicating the file had diverged from git). New secret generated via `openssl rand -hex 32`, applied to both local `.env.prod` and server `docker-compose.prod.yaml` + `stack.env`. Backend restarted with new secret. `.env.prod` removed from git tracking and added to `.gitignore`.

**`lib/` gitignore fix** — `.gitignore` had `lib/` as a bare pattern, which matched `frontend/src/lib/` and blocked git from tracking the new files. Changed to `/lib/` (root-scoped) to only exclude Python build artifacts.

**Production smoke test revealed multiple server-side issues:**

**`DB_DIR` missing from server compose** — Backend code (db.py) falls back to `~/.swu` if `DB_DIR` env var is not set. `~/.swu` didn't exist in the container and `appuser` had no permission to create it. Fixed by adding `DB_DIR=/databases` to the backend environment in the server's `docker-compose.prod.yaml`.

**Database directory permissions** — Databases at `/mnt/volume1/docker/twinsuns/databases/` were `drwxrwx---` owned by `truenas_admin`. Container's `appuser` (uid=999) had no access. Fixed with `chmod o+rwx` on the database directories.

**`types.py` import bug on server** — Server-side `backend/src/routes/types.py` imported `get_app_db` but the endpoint used `get_card_db` (not imported). Fixed via `sed` on the server source and `docker cp` into the running container. **Note: the backend image was NOT rebuilt** — the fix is only in the running container and server source. Image rebuild required before next container restart.

**Old frontend image had broken `localhost:8000` rewrite** — The `twinsuns-frontend:local` image (built 12 days ago) had `next.config.ts` with `async rewrites()` pointing to `http://localhost:8000`. Inside Docker, `localhost` is the frontend container itself. Fixed by: (1) updating server's `next.config.ts` to match local version (no rewrites, route handlers only), (2) rsyncing all 35 route handler files from local to server, (3) rebuilding the frontend image on TrueNAS.

**Containers on separate Docker networks** — Multiple `docker restart` and single-service `docker compose up` calls left the backend with an empty `EndpointID` (not actually connected to the network). Fixed by running `docker compose up --force-recreate` for both services together, which Compose managed as a unit.

**Final smoke test results** — All endpoints healthy:
- `GET /api/cards?limit=2` → 200, total: 1398 cards
- `GET /api/aspects` → 200, 10 aspects
- `GET /api/types` → 200, 8 types
- `GET /api/collection` → 401 (correct, requires auth)
- `GET /api/decks` → 401 (correct, requires auth)
- `POST /api/auth/login` (bad creds) → 401 with `{"detail": "Incorrect username or password"}`

**Server state divergence note** — The TrueNAS server has a `/mnt/volume1/docker/twinsuns/` directory containing a copy of the frontend/backend source. This copy is NOT in sync with the git repo — it was never designed to be. Changes applied to the server should be treated as production hotfixes, with the canonical code in git. The proper deployment flow is: local git → `deploy.sh` (build + push to Docker Hub) → TrueNAS (pull + restart). Currently the server uses locally-built images (`twinsuns-*:local`) instead of Hub images, which creates this divergence risk.

---

### 2026-05-04: Session 0 Part 2 — Critical Bug Fixes

**What changed:**

**`frontend/src/lib/` created from scratch** — files were never committed to git (`git log --all --diff-filter=D` confirmed no history). Reconstructed three files by reading all import sites across the codebase:
- `utils.ts`: `cn()` helper (clsx + tailwind-merge)
- `fetch-utils.ts`: `fetchWithAuth()` — reads JWT from localStorage, syncs to a browser cookie so Next.js server-side route handlers (`cookies()`) can find it, also sends as `Authorization` header
- `api.ts`: All types (`Card`, `ApiCard`, `AlternateArt`, `SavedDeck`, etc.) and fetch functions (`fetchCards`, `fetchUserCollection`, `saveUserDeck`, `deleteUserDeck`, etc.)

**Auth token mismatch resolved** — `AuthContext` stored JWT in localStorage but server-side route handlers read from `cookies()`. `fetchWithAuth` now syncs the token to a cookie before each call, bridging the gap without requiring a server-side architecture change.

**`cookies()` awaiting fixed** — In Next.js 15, `cookies()` is async and must be awaited. Fixed in 4 files: `api/collection/route.ts`, `api/decks/route.ts`, `api/decks/[id]/route.ts` (3 occurrences).

**Wrong env var for server-side proxying** — `api/collection/route.ts` and `api/decks/[id]/route.ts` were using `NEXT_PUBLIC_API_URL` (browser-facing URL) instead of `INTERNAL_API_URL` (container-to-container URL) for server-side fetch calls to the backend. Fixed both.

**`decks.py` status clarified** — Router is intentionally disabled because `me.py` already implements the same deck CRUD at `/api/me/decks`. The frontend proxy routes (`/api/decks/**`) all forward to `/api/me/decks` on the backend. Enabling `decks.py` would create a conflicting duplicate. Fixed the variable name bug (`get_current_user` → `current_user` at line 24) for cleanliness but kept router disabled.

**Collection item mapping bug** — `cards/page.tsx` mapped collection items via `item.card_id` but the API returns `{ card: { id: ... }, count, in_collection }`. Fixed to `item.card.id`.

**TypeScript: 0 errors** after all fixes.

**`twin-suns-databases` relationship** — Separate repo containing standalone scripts and the actual `.db` files (`app_db/swu_app.db`, `cards_db/swu_cards.db`). Has a GitHub Actions workflow (`update_dbs.yaml`) that runs weekly (Monday 2AM) to pull fresh card data from the SWU API. It's the canonical source for card data. The main app's backend scripts are copies/variants of these scripts. The relationship is: twin-suns-databases generates the databases → databases are copied/mounted into the main app's Docker containers.

---

### 2026-05-04: Session 0 — Project Audit & Documentation Bootstrap

**What happened:** First structured documentation session. Performed a full codebase audit. Created CLAUDE.md, CHANGELOG.md, and PROGRESS.md.

**Audit findings:**

#### CRITICAL — Missing `src/lib/` directory (frontend is broken)
Multiple frontend pages and contexts import from `@/lib/api`, `@/lib/fetch-utils`, and `@/lib/utils` — a directory that does not exist in the repo. Affected files:
- `src/contexts/AuthContext.tsx` → imports `fetchWithAuth` from `@/lib/fetch-utils`
- `src/contexts/DeckBuilderContext.tsx` → imports `Card` type from `@/lib/api`
- `src/app/cards/page.tsx` → imports `fetchCards`, `fetchAspects`, etc.
- `src/app/profile/page.tsx`, `src/app/deck-builder/DeckBuilderClient.tsx`

The frontend cannot function without this module. Root cause: likely extracted at some point during a refactor or the files were never committed. Priority: fix first before anything else.

#### CRITICAL — Backend decks router commented out
`backend/src/api/main.py` lines 24–29 have the decks router registration fully commented out. The route file (`src/routes/decks.py`) exists and implements full CRUD, but `/api/decks` is not accessible. Deck creation and management features in the frontend are silently broken.

#### CRITICAL — Variable name bug in `backend/src/routes/decks.py`
Line 35 references `current_user.id` but the dependency parameter is named `get_current_user` at line 24. This will raise `NameError` at runtime when the router is re-enabled. Must be fixed before enabling the decks router.

#### SECURITY — Live JWT secret committed to `.env.prod`
`.env.prod` is tracked in git and contains the actual production JWT secret (`e21bb8c4...`). This means anyone with repo access can forge tokens for the production server. Short-term: rotate the secret. Long-term: move secrets to a vault (TrueNAS or environment variables set in Portainer directly, not via committed file).

**Recent git history context:** The last ~10 commits were Docker troubleshooting and search/grouping bug fixes. The `7d4eb33` "Docker finally builds correctly" commit appears to be the current stable point. The `02a92f8` "Search and grouping resolved" commit fixed card grouping. No commits address the missing lib/ directory — it appears the frontend was working at some point with a different structure.

**Alternatives considered for lib/ recovery:** Could check git history for deleted files (`git log --diff-filter=D -- 'frontend/src/lib/*'`). If the files were never committed, they must be written from scratch based on how they're used across the codebase.

---

### (Earlier history)

Pre-documentation history captured from git log. See `git log --oneline` for commit-level detail.

- `7d4eb33` — Docker builds stabilized after multi-commit troubleshooting
- `02a92f8` — Card search and grouping resolved (groups by name+subtitle+type)
- `2977015` — Beta declared complete
- `31c6f9c` — Deck edit functionality updated
- `282baff` — Beta deploy preparation
- `78c5128` — Button styling updates
