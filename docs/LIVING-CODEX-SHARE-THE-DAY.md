# LIVING CODEX — SHARE THE DAY

## Scope
Focused Share the Day update for:
- `docs/moons.html` (13 Moons Today view)
- `docs/index.html` (homepage Living Day panel)
- expanded Living Signal panel rendered by `docs/assets/js/living-codex.js`

No unrelated page redesigns were introduced.

## Files created
- `docs/assets/js/share-day.js`
- `docs/assets/css/share-day.css`
- `docs/LIVING-CODEX-SHARE-THE-DAY.md`
- `tests/share-day.test.js`

## Files modified
- `docs/index.html`
- `docs/moons.html`
- `docs/assets/js/living-codex.js`
- `docs/assets/js/moons.js`
- `docs/assets/css/living-day.css`

## Rendering approach
- Browser-side Canvas API (local-only generation, no external image service).
- High-resolution render targets:
  - Square: `1080 × 1080`
  - Story: `1080 × 1920`
- Preview is responsive and scaled in modal.
- Rendering occurs only when share tool is opened.
- Moon artwork is reused when available and cached in memory; atmospheric fallback is canvas-only.

## Data source and source-of-truth
- Uses existing state from:
  - `window.ScrollOfFireMoons.effectiveContext()` + `sof:moon-render` detail on 13 Moons page
  - `window.CodexState` fallback on homepage
- No duplicate calendar engine was added.
- Shared date deep links use existing query style: `moons.html?date=YYYY-MM-DD`.

## Share button placement
- 13 Moons Today controls (`#shareDayBtn`)
- Homepage Today in the Codex action row
- Expanded Living Signal panel content (`renderLivingDayPanel()`)

## Labels
- 13 Moons selected-date awareness:
  - `Share Today` when current date is selected
  - `Share This Day` when selected date differs

## Share card content
Included fields (when available):
- moon number/name
- moon day
- day in 364-day cycle
- week gate
- visible lunar phase + illumination
- day-state (Preparation/Shabbat/Return/Ordinary)
- deterministic movement line
- optional mirror line
- readable date
- Codex branding + URL

## Optional customization
Modal toggles:
- Include phase
- Include movement
- Include sunset boundary
- Format switch (Square/Story)

## Native share support
- Uses Web Share API when available (`navigator.share`).
- Uses file sharing when supported (`navigator.canShare({ files })`).
- Does not claim completion; records only share-sheet open intent.

## Fallback behavior
When native image share is unavailable:
- Download Square
- Download Story
- Copy Daily Text
- Copy Link
- Clear status message instructs manual image attachment.

## Copied text format
Generated deterministic short format:
- moon headline
- moon/day/year-day line
- phase (optional)
- movement section (optional)
- deep link
- compact hashtags

## Moon theme mapping
- All 13 moons map to controlled theme accents/atmospheres/symbols in `share-day.js` (`MOON_THEMES`).
- Artwork mapping uses existing moon image assets (`MOON_ARTWORK`); missing assets fallback to canvas atmosphere.

## Privacy boundaries
- Share card only uses public day-state fields.
- Private witness/journal text is not included automatically.
- Generated image is not stored in Codex Memory.
- No location coordinates are rendered.

## Codex Memory activity logging
Lightweight action records only:
- `share_day_open`
- `share_day_native_open`
- `share_day_download_square`
- `share_day_download_story`
- `share_day_copy_text`
- `share_day_copy_link`

Recorded metadata is limited to date/format/method/status/source.

## Analytics events
Uses existing GA4 installation (`gtag`) and adds:
- `share_day_open`
- `share_day_native_open`
- `share_day_download_square`
- `share_day_download_story`
- `share_day_copy_text`
- `share_day_copy_link`

No private text payloads are sent.

## Accessibility behavior
- Modal with `role="dialog"`, `aria-modal="true"`
- Escape closes
- Focus enters modal on open and returns to trigger on close
- Focus trap inside modal
- Background scrolling disabled while open and restored on close
- Responsive controls with touch-friendly minimum height

## Deep-link behavior
- Deep links resolve date in `moons.html?date=YYYY-MM-DD`
- Works from production root and GitHub Pages project-base relative paths
- No date param continues normal current-day behavior

## SEO/social preview note
- Existing default OG/Twitter metadata for homepage and `moons.html` remains in place.
- Personalized client-generated share images are local/manual/native-share artifacts and do not replace OG image per-date on crawlers without server/build generation.

## Browser limitations
- Native file-sharing support varies by browser and platform.
- Some browsers support `navigator.share` but not file sharing; manual attach fallback remains required.
- Clipboard APIs may require user gesture/secure context; fallback copy path is used where possible.

## Future extension (not implemented here)
- Optional build/deploy pipeline for static daily social card files for crawler-level per-day OG assets.
