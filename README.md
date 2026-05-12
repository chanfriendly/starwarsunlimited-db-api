# Twin Suns — Star Wars Unlimited Deck Builder

![Twin Suns splash page](docs/splash.png)

A personal web application for playing **Star Wars: Unlimited** in the Twin Suns format. Browse every card ever printed, build decks, track your collection, and drill mulligans with the hand simulator. Built on a live card database that auto-updates from the official SWU API every Monday.

Not affiliated with Fantasy Flight Games, Asmodee, or Lucasfilm.

---

## What it does

### Card Browser
- **2,360+ cards** across all released sets, updated automatically each Monday
- Full-text search with debounced real-time filtering
- Filter by aspect, type, keyword, cost, set, and trait — all combinable
- Smart grouping by name + subtitle + type merges art variants into single entries
- "My Collection" toggle — one click to view only cards you own
- Double-click any card to add it to your collection instantly

### Card Detail
- High-resolution card art with back-side flip for double-sided cards
- Aspect pips, stat blocks, card text, keywords, and set info
- Add to collection with `+`/`−` count controls; remove with a single click
- Wishlist toggle for cards you're hunting

### Deck Builder
- **Twin Suns format**: two leaders, one base, ten cards
- Three-stage flow: pick leaders → pick base → build your deck
- Tabbed card browser (Units / Events / Upgrades) grouped by cost within each tab
- **Suggested tab** — synergy-scored card recommendations based on your leaders' keywords and traits
- Aspect compatibility filtering — only legal cards shown for your leader pair
- "My cards only" toggle to build from your collection
- Full CRUD: create, edit, save, delete

### Deck Management
- `/decks` — dedicated deck list with leader image strips, aspect pips, and sort by date or name
- `/decks/[id]` — full deck view with leader and base art, card grid, and deck stats
- Inline delete with confirmation step

### Collection & Profile
- Collection tab on your profile with per-card count badges
- Wishlist tracking with add/remove from the card detail dialog
- Collection completion percentage shown in your profile header

### Hand Simulator
- Draws a random 6-card opening hand from any saved deck
- Mulligan mode with editable opponent leader field for note-taking

---

## Design

Twin Suns uses the **Imperial Field Manual** design system — a custom set of CSS custom properties built around a dark amber-and-parchment palette with three typefaces:

- **Cormorant Garamond** — display headers
- **Spectral** — body text
- **JetBrains Mono** — data, labels, eyebrows

No component libraries. All UI is hand-rolled with `var(--ts-*)` tokens, with zero Tailwind in production components. The splash page features a twin suns radial gradient background, scanline overlay, left vignette, and a live "Deck of the Cycle" spotlight panel.

---

## Stack

| Layer | Tech |
|---|---|
| Frontend | Next.js 15 (App Router), TypeScript |
| Backend | FastAPI, SQLAlchemy, Pydantic v1 |
| Databases | SQLite — `swu_cards.db` (cards) + `swu_app.db` (users/decks) |
| Auth | JWT (bcrypt, configurable expiry) |
| Deployment | Docker → Docker Hub → TrueNAS/Portainer |
| Card data | Official SWU API, rebuilt weekly via GitHub Actions |

**Key architecture pattern:** Next.js API routes (`src/app/api/**/route.ts`) are thin server-side proxies. The browser never calls the FastAPI backend directly — all requests go through Next.js first, which forwards them with the auth token. Two API URL env vars exist for this reason: `NEXT_PUBLIC_API_URL` (browser → Next.js) and `INTERNAL_API_URL` (Next.js server → FastAPI).

---

## Running locally

```bash
# Start both frontend + backend (sets DB_DIR automatically)
./dev.sh
```

**Prerequisites:** Node.js 20+, Python 3.10+, pip.

The script activates the Python venv, sets `DB_DIR=./databases/`, and starts uvicorn on `:8000` and Next.js on `:3000` (proxied to `:4000`). On first run you'll need to build the card database:

```bash
DB_DIR=$(pwd)/databases python backend/scripts/build_database.py
```

Dev URLs:
- Frontend: http://localhost:4000
- Backend API: http://localhost:8000
- Swagger docs: http://localhost:8000/docs

---

## Production deployment

```bash
./deploy.sh
```

Builds both Docker images, pushes them to Docker Hub, and triggers a Portainer stack redeploy via API. No manual steps. Requires `.env.prod` with `JWT_SECRET`, `PORTAINER_URL`, `PORTAINER_USER`, `PORTAINER_PASSWORD`, and `PORTAINER_ENDPOINT_ID`.

The production stack (`docker-compose.prod.yaml`) mounts SQLite databases from a TrueNAS path. `DB_DIR` is the single source of truth for database location — set in the compose file for production, in `dev.sh` for local dev.

---

## Security notes

- Rate limiting: 120 req/min globally, 10/min on auth endpoints
- JWT secret lives in Bitwarden, not committed to the repo
- Backend port 8000 is internal-only in production (not host-bound)
- No unauthenticated debug or admin endpoints

---

## Disclaimer

Star Wars: Unlimited card images and game content are property of Fantasy Flight Games / Asmodee. This project uses the official card API for personal, non-commercial use. Card data auto-syncs weekly but may lag behind new releases.
