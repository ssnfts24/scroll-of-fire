# moons/

**Public path:** `assets/img/moons/`
**Purpose:** All imagery for the Remnant 13 Moons calendar system.

## Sub-folders

| Folder | Purpose |
|--------|---------|
| `app/` | PWA and UI assets (splash, icons, OG, background, empty state) |
| `moons/` | Canonical moon artwork (one per moon, 13 total) |
| `gates/` | Live gate artwork used by the Shabbat gallery |
| `days/` | No live assets remain; unused day artwork was archived |
| `phase/` | Moon phase artwork (8 phases) |
| `sections/` | Section panel artwork for the moons.html interface |

## JavaScript integration

`docs/assets/js/moons-images.js` uses `assets/img/moons` as its root.  
Moon artwork is loaded from `moons/moons/moon-{01-13}-*.webp`.  
App splash is loaded from `moons/app/splash-2732.webp`.

## Planned assets

### `assets/share/moon-card.png`
Status: Planned

Purpose: Share-card screenshot for the PWA manifest.  
Dimensions: 1200 × 630  
Used by: `docs/assets/js/manifest.webmanifest` screenshots array (currently disabled)  
Alt text: Moon status share card.  
Integration: Keep the manifest screenshot entry disabled until the file exists and is verified.
