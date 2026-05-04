# CLAUDE.md — Twin Suns Deck Builder

## What is this?

A personal web application for playing Star Wars Unlimited in the Twin Suns format. It provides card browsing, deck building, and collection tracking backed by live card data from the official SWU API. It is **not** a general-purpose TCG tool, a production SaaS product, or officially affiliated with Star Wars or FFG/Asmodee.

Deeper docs: `README.md` (setup/deploy), `PROGRESS.md` (current work state), `CHANGELOG.md` (decisions/history).

---

## Quick Reference

```bash
# Development (starts both frontend + backend via Docker or native)
./dev.sh

# Backend only (native)
cd backend && source venv/bin/activate && uvicorn src.api.main:app --reload --host 0.0.0.0 --port 8000

# Frontend only (native)
cd frontend && npm run dev   # runs on :3000 (proxied externally to :4000)

# Build + push Docker images for production
./deploy.sh

# Backend tests (minimal coverage currently)
cd backend && python -m pytest tests/

# Type check frontend
cd frontend && npx tsc --noEmit

# Lint frontend
cd frontend && npm run lint
```

**URLs (dev):**
- Frontend: http://localhost:4000
- Backend API: http://localhost:8000
- Backend docs (Swagger): http://localhost:8000/docs
- Health check: http://localhost:8000/health

---

## Session Orientation

**Start of every session:**
1. Read `PROGRESS.md` first — know what's broken and what's next before touching code
2. Check `CHANGELOG.md` for recent decisions that affect your area
3. Run `npx tsc --noEmit` in frontend and `uvicorn` startup in backend to verify the baseline compiles
4. Pick the top unblocked item from PROGRESS.md "What's next"

**Before stopping:**
1. Update `PROGRESS.md` — current status, what you completed, what's next
2. Add a `CHANGELOG.md` entry for anything non-trivial decided or discovered
3. Verify frontend compiles (`npx tsc --noEmit`) and backend starts without error
4. Never leave the decks router commented out without documenting why in PROGRESS.md

---

## Architecture

```
Browser
  └─ Next.js Frontend (:4000 / :3000 internal)
       ├─ App Router pages: /cards, /deck-builder, /decks/[id], /profile, /login, /signup
       ├─ src/app/api/** — server-side route handlers that PROXY to backend
       ├─ src/components/ — UI components (Radix UI + Tailwind)
       ├─ src/contexts/ — AuthContext (JWT token), DeckBuilderContext (deck state)
       └─ src/lib/ — client-side API wrappers + fetch utilities [MUST EXIST — see Critical Rules]
            ├─ api.ts — typed fetch functions for all endpoints
            ├─ fetch-utils.ts — fetchWithAuth helper using localStorage token
            └─ utils.ts — cn() and other utilities

FastAPI Backend (:8000)
  ├─ src/api/main.py — router registration (CORS, logging)
  ├─ src/routes/ — cards, me, aspects, types, keywords, sets, stats (decks currently disabled)
  ├─ src/auth/ — JWT auth, bcrypt hashing
  └─ src/database/
       ├─ swu_cards.db — static card data (Card, CardAspect, CardKeyword, CardTrait, CardArena)
       └─ swu_app.db — application data (User, Deck, DeckCard, UserCollection)

Production:
  MacBook → ./deploy.sh → Docker Hub → TrueNAS Portainer stack (docker-compose.prod.yaml)
  Databases mounted at /mnt/volume1/docker/twinsuns/databases/
```

**Key pattern**: The Next.js API routes (`src/app/api/**/route.ts`) are thin server-side proxies. They forward requests to the FastAPI backend using `INTERNAL_API_URL` (container-to-container). The browser never calls the FastAPI backend directly — all calls go through Next.js first. This is why two API URL env vars exist: `NEXT_PUBLIC_API_URL` (browser → Next.js) and `INTERNAL_API_URL` (Next.js server → FastAPI).

**Card data flow**: Official SWU API → `scripts/import_swu_data.py` → `swu_cards.db`. Cards are static in the DB; the backend groups them by name+subtitle+type to merge art variants into single "card" entries.

---

## Principles

**The oracle for correctness is the browser + API docs.** There are no meaningful automated tests. Verify changes by running the app and exercising the feature. Use `http://localhost:8000/docs` to test backend endpoints directly. TypeScript compilation (`tsc --noEmit`) is the secondary check.

**Keep the proxy pattern consistent.** All frontend data fetching goes through `src/app/api/**/route.ts` server-side proxies, then client components use `src/lib/api.ts` + `src/lib/fetch-utils.ts`. Never add direct `fetch()` calls to external URLs in client components — it breaks the auth token forwarding pattern and CORS.

**Dual database, dual concern.** `swu_cards.db` is read-only from the app's perspective (only `scripts/` write to it). `swu_app.db` holds all mutable user data. Don't mix queries across them — each has its own SQLAlchemy engine and session in `src/database/db.py`.

**The decks router must be explicitly enabled or explicitly disabled — never left ambiguous.** It is currently commented out in `main.py`. If you enable it, fix the variable bug in `decks.py` first. If you leave it disabled, document the reason in PROGRESS.md.

**Don't add AI features yet.** The `src/utils/vector_db.py` and `build_vector_db.py` are stubbed for future use. `qdrant-client`, `sentence-transformers`, and `torch` are in requirements.txt but not actively used. Don't wire them up without a clear spec — the dependency weight is already high.

**Environment files are configuration, not secrets storage.** `.env.prod` currently contains the live JWT secret — this is a known security issue logged in PROGRESS.md. Never add new secrets to committed files.

---

## Conventions

**Frontend imports use `@/` path aliases** — `@/components/`, `@/contexts/`, `@/lib/`. The `src/lib/` directory is imported widely but must be kept in sync if files are added/renamed.

**Backend router registration uses try/except** in `main.py` — a router that fails to import logs an error but doesn't crash the app. This is intentional for graceful degradation, but means you must check logs to confirm a router actually loaded.

**Card grouping happens in the backend** (`src/routes/cards.py`) — cards are grouped by `(name, subtitle, type, aspects, keywords)` to merge art variants. The frontend receives grouped cards with `variants` arrays. Don't re-implement grouping on the frontend.

**Auth token lives in localStorage** under a key managed by `AuthContext`. The frontend API proxy routes extract it from the `Authorization` header passed by `fetchWithAuth`. Backend validates JWT on every protected endpoint.

**Pydantic v1 syntax** — `requirements.txt` pins `pydantic==1.10.21`. Use v1 syntax (`.dict()` not `.model_dump()`, `class Config:` not `model_config`). Do not upgrade to v2 without a migration plan.

---

## Critical Rules

- **Never commit secrets to git.** `.env.prod` currently has a live JWT secret — this is a known debt, not permission to add more. New secrets go in a password manager or TrueNAS vault.
- **Never delete or modify `swu_cards.db` via app code.** It is populated by scripts only. Accidental schema migration on the card DB will require a full re-import from the SWU API.
- **Never bypass TypeScript errors with `// @ts-ignore` or `as any` without a comment explaining why.** The lib/ module is already fragile — type safety is the primary correctness check.
- **Don't add new npm packages or Python packages without updating both `package.json`/`requirements.txt` and documenting in CHANGELOG.md.** The backend already has heavyweight ML deps (torch, sentence-transformers) that slow Docker builds significantly.
- **The dev and prod Docker networks are different** (`twinsuns_network` vs `twinsuns`). Don't mix compose files across environments.
