# CHANGELOG

Most recent entry first. Captures *why*, not just *what* — decisions, root causes, alternatives rejected.

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
