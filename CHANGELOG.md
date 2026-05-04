# CHANGELOG

Most recent entry first. Captures *why*, not just *what* — decisions, root causes, alternatives rejected.

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
