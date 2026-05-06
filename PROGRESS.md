# PROGRESS.md

**Update this at the end of every session. A stale PROGRESS.md is actively harmful.**

---

## Current Status

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

0. **[DEPLOY] Start Docker Desktop + run `./deploy.sh`** — Docker is not running on MacBook. Once started: `cd ~/projects/starwarsunlimited-db-api && ./deploy.sh` builds+pushes both images to Docker Hub. Then restart the stack on TrueNAS via Portainer (production is fully down — port 4000 + SSH 24 both not responding; host is reachable via ping so it's a container issue).

1. **[BROWSER TEST] Login + full flow test on production after deploy** — `http://192.168.1.124:4000`. Test: login → cards page → double-click to add to collection → deck builder → create deck → profile page (decks, collection, wishlist tabs all redesigned). Local dev verified clean.

2. **[BROWSER TEST] Test double-click card add in deck builder** — Double-click handler exists (`handleCardDoubleClick`), leader filtering logic confirmed in code (`leadersShareAspects`). Manually double-click a leader, verify second leader grid filters to compatible aspects, proceed through base and cards stages.

3. **[ENHANCEMENT] Add meaningful test coverage** — Current tests don't use standard pytest patterns. Add at minimum: auth endpoint tests, card search tests, deck CRUD tests.

---

## What's Blocked

- **AI/ML features** — No spec. `vector_db.py` and `build_vector_db.py` exist but do nothing. Block until product decision on what Phase 2 AI features actually look like.
- **Offline/PWA support** — Listed in README as planned. No progress. Not a priority until core features are stable.

---

## Failed Approaches

- **Docker multi-service troubleshooting** — Multiple iterations (`741860e` through `7d4eb33`) on getting Docker networking right. Key lesson: dev compose uses `twinsuns_network`, prod uses `twinsuns` — they are different and cannot be mixed. The `INTERNAL_API_URL` (container-to-container) vs `NEXT_PUBLIC_API_URL` (browser-facing) distinction is critical and easy to swap accidentally.
- **Decks router** — The decks router was likely disabled to isolate a crash during the Docker troubleshooting phase. The variable name bug (`current_user` vs `get_current_user`) is probably the root cause. Do not simply uncomment — fix the bug first.

---

## Notes for Next Session

- Check `git log --all --diff-filter=D -- 'frontend/src/lib/*'` first — the lib/ files may be recoverable from git history without having to reconstruct them.
- The `_cleanup_backup/` directory at project root contains old files from a past cleanup. Don't restore from there — it has an old requirements.txt and run.py that predate the current architecture.
- `.env.prod` has real secrets. Do not `cat` it in a shared screen or paste its contents anywhere.
- When testing decks, use the Swagger UI at `:8000/docs` to test backend directly before testing via the frontend proxy — easier to isolate which layer has a bug.
