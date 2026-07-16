Shared

Purpose

This folder contains visual assets used across multiple Codex of Reality pages.

Do not place an image here simply because it might be reused someday. Place it here after it is genuinely shared by more than one page or system.

Public Path

/assets/img/shared/

Planned Assets

codex-seal.webp
codex-mark.webp
codex-divider.webp
codex-frame.webp

Subfolders

icons/
textures/

Asset Definitions

Codex Seal

codex-seal.webp

The complete Codex of Reality identity seal.

Codex Mark

codex-mark.webp

A simplified symbol suitable for small placements.

Codex Divider

codex-divider.webp

A reusable ornamental divider between sections.

Codex Frame

codex-frame.webp

A reusable border or framing element for cards, images, and featured sections.

Rules

- Use this folder only for genuinely reusable assets.
- Avoid duplicating the same image in multiple page folders.
- Keep file names broad enough to reflect their shared role.
- Use SVG for simple line-based marks where possible.
- Keep shared assets lightweight because they may appear on many pages.
- Do not place page-specific hero images here.
- Do not place social media exports here.

Naming Standard

codex-purpose-variant.webp

Examples:

codex-seal.webp
codex-seal-small.webp
codex-frame-gold.webp
codex-divider-cyan.webp

Completion Checklist

- [ ] Asset is used on more than one page
- [ ] Duplicate versions removed
- [ ] File naming is reusable
- [ ] Converted to the correct format
- [ ] Compressed
- [ ] Display size tested
- [ ] Mobile rendering tested
- [ ] Accessibility usage reviewed

Shared / Icons

Purpose

This folder contains small interface icons, seals, and symbolic navigation marks used across the website.

Public Path

/assets/img/shared/icons/

Planned Assets

icon-moons.svg
icon-frequency.svg
icon-artifacts.svg
icon-caravan.svg
icon-ledger.svg
icon-oracle.svg

Icon Definitions

Moons

icon-moons.svg

Represents the Remnant 13 Moons calendar.

Frequency

icon-frequency.svg

Represents Frequency Governance and resonant tools.

Artifacts

icon-artifacts.svg

Represents the Artifact Registry and crafted living technology.

Caravan

icon-caravan.svg

Represents the Covenant Caravan.

Ledger

icon-ledger.svg

Represents the Witness Ledger and daily entries.

Oracle

icon-oracle.svg

Represents the Genesis Oracle.

Rules

- Prefer SVG for simple icons.
- Keep a consistent "viewBox".
- Keep line weights visually related.
- Avoid detailed cinematic artwork inside icons.
- Make icons understandable at small sizes.
- Use "currentColor" where possible so CSS controls the icon color.
- Avoid hardcoding unnecessary fill colors.
- Test icons at 16px, 24px, 32px, and 48px.
- Provide an accessible label when the icon is used without visible text.

Suggested SVG Pattern

<svg
  viewBox="0 0 24 24"
  aria-hidden="true"
  focusable="false"
>
  <path
    d="..."
    fill="none"
    stroke="currentColor"
    stroke-width="1.5"
  />
</svg>

Accessibility

Decorative icon beside visible text:

<img
  src="/assets/img/shared/icons/icon-moons.svg"
  alt=""
  aria-hidden="true"
>

Icon without visible text:

<a href="/moons" aria-label="Open Remnant 13 Moons">
  <img
    src="/assets/img/shared/icons/icon-moons.svg"
    alt=""
  >
</a>

Completion Checklist

- [ ] Symbol is recognizable
- [ ] SVG viewBox is consistent
- [ ] Line weight matches the system
- [ ] Works with "currentColor"
- [ ] Tested at small size
- [ ] Tested on dark background
- [ ] Tested on light fallback background
- [ ] Accessible label added where needed

Shared / Textures

Purpose

This folder contains reusable material and atmosphere textures used throughout the Codex of Reality website.

Public Path

/assets/img/shared/textures/

Planned Assets

texture-copper.webp
texture-stone.webp
texture-parchment-dark.webp
texture-stars.webp

Texture Definitions

Copper

texture-copper.webp

Use for:

- Artifact Registry
- Living Technology
- Frames
- Dividers
- Subtle interface surfaces

Stone

texture-stone.webp

Use for:

- Moon imagery
- Witness sections
- Theory sections
- Grounded physical surfaces

Dark Parchment

texture-parchment-dark.webp

Use for:

- Scrolls
- Ledger surfaces
- Canon sections
- Written teachings

Stars

texture-stars.webp

Use for:

- Celestial backgrounds
- Calendar sections
- Hero atmosphere
- Gateway fields

Rules

- Keep textures subtle.
- Compress aggressively.
- Create seamless versions where possible.
- Avoid high contrast behind text.
- Do not use a texture at full intensity by default.
- Blend textures with gradients or opacity.
- Test repeating behavior.
- Avoid obvious tiling patterns.
- Keep reusable textures neutral enough to work across multiple pages.

CSS Example

.codex-panel {
  background:
    linear-gradient(
      rgba(5, 7, 13, 0.92),
      rgba(5, 7, 13, 0.96)
    ),
    url("/assets/img/shared/textures/texture-copper.webp");
}

Blend Example

.codex-scroll {
  position: relative;
  background-color: #08101a;
}

.codex-scroll::before {
  content: "";
  position: absolute;
  inset: 0;
  background-image:
    url("/assets/img/shared/textures/texture-parchment-dark.webp");
  background-size: cover;
  opacity: 0.16;
  pointer-events: none;
}

Completion Checklist

- [ ] Texture is reusable
- [ ] Contrast is restrained
- [ ] Seamless behavior tested
- [ ] File compressed
- [ ] Converted to WebP
- [ ] Works behind text
- [ ] Mobile performance tested
- [ ] No visible repeating seams
- [ ] Opacity guidance documented
