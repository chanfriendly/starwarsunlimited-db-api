# PROGRESS.md

**Update this at the end of every session. A stale PROGRESS.md is actively harmful.**

---

## Current Status

*(2026-05-04)* Critical frontend breakage repaired. `src/lib/` (utils, fetch-utils, api) was reconstructed from scratch — it was never committed to git. Four `cookies()` calls now properly awaited in Next.js 15 route handlers. Two route handlers were using `NEXT_PUBLIC_API_URL` instead of `INTERNAL_API_URL` for server-side proxy requests (would break in Docker where internal URLs differ). `decks.py` variable bug fixed; router stays disabled since `me.py` already handles all deck CRUD. TypeScript compiles clean with zero errors. The app should be functionally runnable but needs a smoke test. Production JWT secret rotation is still outstanding.

---

## What's Done

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

1. **[SECURITY] Rotate the production JWT secret** — Generate new: `openssl rand -hex 32`. Update in Portainer env vars directly (not via committed .env.prod). Remove secret from `.env.prod`, add `.env.prod` to `.gitignore` or replace with `.env.prod.example`.

2. **[SMOKE TEST] Full feature test after starting the app** — Run `./dev.sh`, test: card browsing, search, filter, login, collection add (double-click), deck create/save/delete, profile page. This is the first functional test session in ~1 year.

5. **[VERIFICATION] Full feature smoke test** — After lib/ restored: test card browsing, search, filter, deck create/edit/delete, collection add, auth login/logout on both dev and production.

6. **[CLEANUP] Review `requirements.txt` ML dependencies** — `torch`, `sentence-transformers`, `qdrant-client` are unused in the current app. They add significant Docker build time. Consider moving to a separate `requirements-ml.txt` until the AI features are actually built.

7. **[ENHANCEMENT] Add meaningful test coverage** — Current tests don't use standard pytest patterns. Add at minimum: auth endpoint tests, card search tests, deck CRUD tests.

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
