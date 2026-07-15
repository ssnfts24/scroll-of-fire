# moons/

**Public path:** `assets/img/moons/`
**Purpose:** All imagery for the Remnant 13 Moons calendar system.

## Sub-folders

| Folder | Purpose |
|--------|---------|
| `app/` | PWA and UI assets (splash, icons, OG, nav ring, empty state) |
| `moons/` | Canonical moon artwork (one per moon, 13 total) |
| `gates/` | Gate artwork (8 Shabbat-cycle gates) |
| `days/` | Day artwork (28 days per moon cycle) |
| `phase/` | Moon phase artwork (8 phases) |
| `sections/` | Section panel artwork for the moons.html interface |

## JavaScript integration

`docs/assets/js/moons-images.js` uses `assets/img/moons` as its root.  
Moon artwork is loaded from `moons/moons/moon-{01-13}-*.webp`.  
App splash is loaded from `moons/app/splash-2732.webp`.
