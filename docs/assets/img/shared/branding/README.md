# shared/branding/

**Public path:** `assets/img/shared/branding/`
**Purpose:** Site-wide brand assets used across all pages.

## Current assets

| File | Purpose | Used by |
|------|---------|---------|
| `favicon.png` | Site favicon and Apple touch icon | All HTML pages |
| `favicon.svg` | SVG favicon variant | `lab.html` |
| `icon-1024.png` | High-res app icon | `moons.html` manifest, `moons/app/` |
| `codex-sigil-banner.png` | Codex sigil banner (2100×900) | `circle.html`, `teach.html`, `invoke.html`, `ab.html` |

## Planned Assets

### `icon-192.png`
Status: Planned

Purpose: 192×192 PWA icon for the Remnant 13 Moons web app manifest.  
Dimensions: 192 × 192  
Used by: `assets/js/manifest.webmanifest`  
Integration: Insertion point exists in manifest but disabled until file is added.

### `favicon.ico`
Status: Planned

Purpose: Legacy `.ico` favicon for older browsers.  
Dimensions: 32×32 / 16×16 multi-size  
Used by: All HTML pages (add `<link rel="icon" type="image/x-icon">` when available).
