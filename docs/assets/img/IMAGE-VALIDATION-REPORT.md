# IMAGE-VALIDATION-REPORT.md — Codex of Reality

**Generated:** 2026-07-15
**Validation scope:** All `.html`, `.css`, `.js`, `.json`, `.webmanifest` files under `docs/`

---

## Summary

```
Total image files:              138
  Active (non-archive):         101
  Archived:                      37
Total references scanned:       180
Valid references:               180
Broken references:                0  ✓
Archive references from live:     0  ✓
Exact duplicate groups:          22
Near-duplicate groups:            0
Files moved:                     34
Files renamed:                   20
Archived files:                  37
Files updated (references):      60
Planned images not yet created:   5
Planned image locations prepared: 5
Planned image references enabled: 0  ✓
```

---

## Broken References

**None.** All local image references resolve to existing files.

---

## Planned Images (not yet enabled)

These images do not yet exist. No live website code references them. Their intended locations are documented and their HTML/CSS/JS insertion points are disabled.

| Planned path | Documented in | Enabled |
|-------------|---------------|---------|
| `assets/img/home/gates/home-gate-genesis-oracle.webp` | `home/gates/README.md`, `image-manifest.json` | No |
| `assets/img/home/social/home-og-cover.webp` | `home/social/README.md`, `image-manifest.json` | No |
| `assets/img/home/backgrounds/home-bg-witness-field.webp` | `home/backgrounds/README.md`, `image-manifest.json` | No |
| `assets/icons/icon-192.png` | `shared/branding/README.md`, `manifest.webmanifest` (removed) | No |
| `assets/share/moon-card.png` | `image-manifest.json`, `manifest.webmanifest` (removed) | No |

---

## Images Awaiting Integration

These images **exist** but are not yet referenced from any live HTML page:

| Path | Notes |
|------|-------|
| `assets/img/home/hero/home-codex-living-system-EXACT-13-FINAL.webp` | Intended homepage hero; insertion point documented in `home/hero/README.md` |
| `assets/img/home/gates/home-gate-13-moons.webp` | Ready for homepage gates section |
| `assets/img/home/gates/home-gate-artifact-registry.webp` | Ready for homepage gates section |
| `assets/img/home/gates/home-gate-frequency-governance.webp` | Ready for homepage gates section |
| `assets/img/home/gates/home-gate-witness-ledger.webp` | Ready for homepage gates section |
| `assets/img/home/sections/home-core-gates.webp` | Ready for homepage sections |
| `assets/img/home/sections/home-daily-return.webp` | Ready for homepage sections |
| `assets/img/home/posters/home-breath-field-poster.webp` | Ready for homepage poster area |
| `assets/img/artifacts/registry/moon-stone-ring.png` | Needs registry ID and shop integration |
| `assets/img/artifacts/registry/artifact-photo-20260617.jpg` | Needs visual identification and registry assignment |
| `assets/img/artifacts/registry/cb-01.png` | Needs shop.html integration |
| `assets/img/artifacts/registry/cb-02-green-tide-v1.png` | Earlier photo; compare with v2 |
| `assets/img/artifacts/social/hand-ring-chain-advertisement.png` | Promotional photo; needs placement |

---

## Duplicate Groups

### Exact Duplicate Groups (archived)

All duplicates have been moved to `archive/duplicates/`. No live page references any archived file.

| Canonical | Former duplicates |
|-----------|-------------------|
| `moons/moons/moon-01..13-*.webp` | 13 files from `moons/` root |
| `moons/app/app-bg-dark.webp` | `home/hero/`, `shared/` copies |
| `moons/app/empty-state.webp` | `home/hero/`, `shared/` copies |
| `moons/app/icon-512.webp` | `home/hero/`, `shared/` copies |
| `moons/app/nav-gold-ring.webp` | `home/hero/`, `shared/` copies |
| `moons/app/og-image-1200x630.webp` | `home/hero/`, `shared/`, `moons/app/` copies |
| `moons/app/splash-2732.webp` | `home/hero/`, `shared/` copies |
| `shared/branding/icon-1024.png` | `home/hero/`, `shared/` root, `moons/app/` copies |
| `moons/sections/transmission.webp` | Social-filename copy (`748053...n.webp`) |
| Artifacts (5 files) | Removed from `docs/` root |

---

## Path Standard Verified

- Custom domain (`codexofreality.org`): ✓ paths resolve correctly
- GitHub Pages (`ssnfts24.github.io/scroll-of-fire/`): ✓ uses base href `/scroll-of-fire/` with relative paths
- Nested pages (`docs/theory/`, `docs/systems/`): ✓ use `../assets/img/` prefix correctly
- Archive folder: ✓ no live page references any archive path

---

## Required Final State

| Check | Result |
|-------|--------|
| Broken local image references | **0** ✓ |
| Live pages referencing archive/ | **0** ✓ |
| Old filenames remaining in live HTML | **0** ✓ |
| Planned image references enabled | **0** ✓ |
