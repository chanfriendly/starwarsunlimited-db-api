# Achievement Badge Design Brief & System Reference
## Twin Suns Deck Builder — Hexagonal Insignia Set

> **Status:** Implemented. `frontend/src/components/AchievementBadge.tsx` contains all 14 badges as inline SVG React components, ported from the Claude Design prototype at `vAnlPmWS6SVlofjeH_fkQQ`. This document is the canonical design reference.

---

## Design System Overview

### Three Design Principles

**I. Hexagonal frame** — Every badge sits in the same hex shape as the site's `.ts-aspect-pip` clip path. This ties achievements into the existing visual language. Each hex has:
- Outer polygon (64×64 viewbox): `32,2 60,17 60,47 32,62 4,47 4,17`
- Inner amber rim (4px inset): `32,6 56,19 56,45 32,58 8,45 8,19`
- Vertex ticks at all 6 corners (1px amber dots)
- Charcoal panel fill (`#1f1a12`)

**II. Iconography** — Milestone badges (Decks, Collection, Social) carry illustrative silhouettes: X-wing ships, delta fighters, card rectangles, padlocks, hilts, supply crates, targeting reticles. Linework in amber (`#ffb454`) at stroke weight 0.8–1.4px.

**III. Rank progression** — Pilot Training uses rebel rank squares (like the colored pips on officer uniforms in the films) accumulating through K-1 → K-4. K-1 single red pip, K-3 introduces aspect colors (gated by the Full Spectrum achievement), K-4 fills all six squares in amber with an apex star and wing chevrons.

---

## Color Tokens

| Token | Hex | Use |
|-------|-----|-----|
| AMBER | `#ffb454` | Primary accent, all badge iconography |
| PANEL | `#1f1a12` | Hex background fill |
| PANEL2 | `#2c251a` | Secondary fill |
| LINE2 | `#4d4332` | Hex border, rank grid border |
| INK3 | `#8a7a5d` | Muted iconography |

### Aspect Colors (rank badges + all_aspects wedges)

| Aspect | Hex |
|--------|-----|
| Command | `#c2453a` |
| Aggression | `#d96f2d` |
| Cunning | `#e2b342` |
| Heroism | `#ead7a8` |
| Vigilance | `#4a90c4` |
| Villainy | `#2c2a26` |

---

## Badge Anatomy

```
       ● ─── vertex tick (1px amber dot at each of 6 corners)
      ╱ ╲
    ●     ●
    │ hex  │ ← outer polygon (stroke: #4d4332, 1.2px)
    │ fill │ ← inner amber rim (stroke: amber, 0.7px, 55% opacity)
    │      │ ← badge iconography lives here (center ~32,32)
    ●     ●
      ╲ ╱
       ●

Viewbox: 0 0 64 64
Default render size: 64px (scales via `size` prop, SVG is vector)
Supported display sizes: 24 · 48 · 64 · 96 · 128px
```

---

## Component API

File: `frontend/src/components/AchievementBadge.tsx`

```tsx
import { AchievementBadge } from '@/components/AchievementBadge';

// Earned — full opacity
<AchievementBadge name="first_deck" size={64} />

// Locked — 35% opacity + 85% grayscale (CSS only, no SVG change)
<AchievementBadge name="all_aspects" size={48} locked />
```

**Props:**
- `name: string` — achievement key (see catalog below)
- `size?: number` — pixel size, default 64
- `locked?: boolean` — applies locked visual state
- `className?: string` — wrapper class

**Locked state CSS** (applied inline via the component):
```css
opacity: 0.35;
filter: grayscale(0.85);
transition: opacity 0.2s, filter 0.2s;
```

---

## Badge Catalog — 14 Insignia

### Category: Decks

| Key | Title | Icon Logic | Unlock |
|-----|-------|-----------|--------|
| `first_deck` | First Flight | X-wing silhouette with atmosphere wisps beneath | Build your first deck |
| `three_decks` | Wing Formation | 3 delta-ship silhouettes in V formation | Save three decks |
| `ten_decks` | Squadron Leader | 6 delta ships in pyramid (1+2+3), lead ship has rank stripe | Save ten decks |
| `all_aspects` | Full Spectrum | 6 aspect-colored wedges radiating from center with amber hub | Deck using all 6 aspects |
| `first_share` | Broadcast | Holocomm transmitter + 3 radiating arcs (decreasing opacity) | Share a deck publicly |

### Category: Collection

| Key | Title | Icon Logic | Unlock |
|-----|-------|-----------|--------|
| `first_card` | In the Vault | Card silhouette with padlock (shackle + body) centered on it | Add a card to collection |
| `fifty_cards` | Growing Arsenal | 3 cards fanned, center card has amber circle with "50" label | Own 50 cards |
| `hundred_cards` | Armory | Two crossed lightsaber hilts (with grip ridges, pommel, emitter) | Own 100 cards |
| `five_hundred_cards` | War Chest | Trapezoidal supply crate with lid, reinforcement bands, Imperial cog seal | Own 500 cards |

### Category: Social

| Key | Title | Icon Logic | Unlock |
|-----|-------|-----------|--------|
| `first_wishlist` | Target Acquired | Card behind targeting reticle (two rings, 4 crosshair ticks, corner lock-on brackets) | Add to wishlist |

### Category: Pilot Training (Rank Gates)

All use `RankGrid` — 3×2 grid of rebel rank squares on a backing plate.

| Key | Title | Grid Fill | Unlock Gate |
|-----|-------|-----------|-------------|
| `rank_k1` | Cadet | 1 red (Command) pip | first_deck |
| `rank_k2` | Pilot | 2 red pips | rank_k1 + three_decks |
| `rank_k3` | Flight Lead | Top row: vigilance/command/cunning | rank_k2 + all_aspects |
| `rank_k4` | Squadron | All 6 amber + apex 5-pointed star + wing chevrons (×2 per side) | rank_k3 + ten_decks |

---

## Shared Atoms

These internal components build up the badge iconography:

| Atom | Description |
|------|-------------|
| `HexFrame` | The universal hex container. Accepts `fill`, `rim`, `rimOpacity`, `ticks`, `size`. |
| `ShipGlyph` | Top-down X-wing with fuselage, S-foils, cannons, optional engine trail. `foilOpen` toggles S-foil state. |
| `DeltaShip` | Simplified filled triangle ship. Cleaner at small sizes / in formations. |
| `RankSquare` | Single rank pip: filled = solid color with subtle gloss/shadow; empty = hairline outline. |
| `CardGlyph` | Card silhouette rectangle with optional corner accent lines. |
| `RankGrid` | 3×2 backing plate with 6 `RankSquare` positions. Accepts `fills` array and optional `label` text. |

---

## Implementation Notes

### Where badges are rendered

**Profile page** (`frontend/src/app/profile/page.tsx`):
- **Rank rows** — 48px badge left of rank title/label, `locked={!earned}`
- **Achievement grid** — 64px badge left of title+desc block, `locked={!ach.earned}`
- Layout mirrors the design prototype's `AchievementsTab` in `profile.html`

### Integration with `AchievementDef`

The backend `icon` field on `AchievementDef` still holds the original emoji (e.g. `"🚀"`). The frontend ignores it in favor of the `key` field — `<AchievementBadge name={ach.key} />` dispatches to the correct SVG component. The emoji field can be removed from the backend schema in a future cleanup pass.

### Karabast extension point

`UserAchievement.source` column (NULL = in-app, `'karabast'` = future external hook). No schema change required to add external achievement sources.

---

## Future: Additional Badges

When adding a new achievement:
1. Add entry to `BADGES` in `backend/src/routes/achievements.py`
2. Add condition in `_compute_earned_keys()`
3. Create a new `BadgeXxx` component in `AchievementBadge.tsx` following the `HexFrame` + atom pattern
4. Add to `BADGE_COMPONENTS` dispatcher

Keep SVG paths within the 64×64 viewbox. Use the AMBER/PANEL/LINE2 constants. Aim for legibility at 48px.
