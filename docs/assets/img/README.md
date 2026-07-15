# Codex of Reality — Image Library

**Public path root:** `/assets/img/`
**Repository path:** `docs/assets/img/`
**Serves from:** custom domain `https://codexofreality.org/` and GitHub Pages `https://ssnfts24.github.io/scroll-of-fire/`

---

## Path Standard

The site uses `<base href="/">` with JavaScript that switches it to `/scroll-of-fire/` on GitHub Pages. All image paths in HTML are written relative to the site root without a leading slash:

```
assets/img/shared/branding/favicon.png
```

This resolves correctly under both deployment contexts. Do **not** hard-code `/assets/img/...` with a leading slash in `src` or `href` attributes, as this will break on GitHub Pages.

Absolute URLs (`https://codexofreality.org/assets/img/...`) are used only in Open Graph `content=` meta tags and structured-data JSON where an absolute URL is required by the spec.

---

## Directory Architecture

```
docs/assets/img/
├── home/           Homepage-only images (hero, gates, sections, posters, social)
├── shared/         Site-wide reusable assets (branding, icons, placeholders, social)
├── moons/          Remnant 13 Moons calendar assets (app, moons, gates, days, phases, sections)
├── artifacts/      Artifact Registry images (registry photos, social)
└── archive/        Duplicates and unused files (not served from any live page)
```

---

## Naming Convention

All files use **lowercase kebab-case**: `subject-purpose-variant.ext`

Examples:
- `en-007-ember-node-7.png` — artifact with registry ID prefix
- `home-gate-covenant-caravan.webp` — section-specific gateway image
- `moon-01-seed-flame.webp` — numbered series
- `codex-og-cover.jpg` — purpose-qualified shared asset

Do **not** use spaces, uppercase letters, parentheses, tildes, or camera-generated filenames.

---

## Format Rules

| Format | Use when |
|--------|----------|
| WebP   | Photographs, cinematic artwork, backgrounds, hero images |
| PNG    | Full transparency required, or when PNG is the only available source |
| JPG    | Already-efficient photographs; no transparency |
| SVG    | Interface icons, seals, dividers, line diagrams |

---

## Accessibility

- Add meaningful `alt` text when the image communicates content.
- Use `alt=""` for purely decorative images.
- Do not repeat nearby headings word-for-word.
- Add `width` and `height` attributes when known.
- Lazy-load all below-the-fold images (`loading="lazy"`).
- Do not lazy-load the primary above-the-fold hero (`loading="eager" fetchpriority="high"`).

---

## Planned Images

When an image does not yet exist:

1. Create the destination folder and document the planned asset in that folder's `README.md`.
2. Add it to `image-manifest.json` with `"status": "planned"`.
3. Do **not** add live `<img>`, CSS `url()`, or JS references to the missing file.
4. Prepare the insertion point as a commented HTML block or disabled code entry.
5. Display no broken icons, empty boxes, or placeholder artwork to visitors.

---

## This Document Is Authoritative

Per-folder `README.md` files must not contradict this policy. When in doubt, this root `README.md` takes precedence.
