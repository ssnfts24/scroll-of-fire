# Remnant 13 Moons Mobile App Release Checklist

## Release identity

- App version: `2026.07.16.1`
- Data schema version: `1`
- Manifest: `docs/manifest.webmanifest`
- Service worker: `docs/service-worker.js`
- Entry point: `docs/moons.html`
- Baseline: `d2c42a174293373d34e9c1d002f99a3135d23d5c`
- Rollback tag: `13-moons-working-baseline`

## Release checks

- [x] One active manifest and one service worker
- [x] Relative paths support the custom domain and GitHub Pages project path
- [x] 192px, 512px, maskable, and Apple touch icons exist
- [x] Manifest phone screenshots exist and match their declared dimensions
- [x] Default opening view is Today
- [x] Today, Shabbat, Mirror, Witness, and More phone navigation is available
- [x] Deep links use `?tab=todayPanel`, `shabbatPanel`, `mirrorPanel`, or `witnessPanel`
- [x] Browser back returns to the prior app section
- [x] Android install prompt is user initiated and has a browser-menu fallback
- [x] Safari and iOS in-app-browser instructions are visible when applicable
- [x] Safe-area padding and 16px mobile form controls are present
- [x] No document-level horizontal overflow at 320px, 390px, or 430px
- [x] Essential files open from the service-worker cache without the server
- [x] Available updates wait for user activation and reload once
- [x] Update activation warns when a witness entry contains unsaved text
- [x] Refresh App Files preserves local records and clears only 13 Moons caches
- [x] Export/import validates records and creates a rollback backup
- [x] Destructive erase requires a checkbox and two confirmations
- [x] Unrelated local-storage records and unrelated caches are not erased
- [x] JavaScript syntax, manifest JSON, and Codex data validation pass

## Installation

### Android

1. Open `https://codexofreality.org/moons.html` in Chrome.
2. Wait for the page to finish loading.
3. Select **Install 13 Moons**.
4. If no button is offered, use **Chrome menu → Add to Home screen** or
   **Install app**.

### iPhone and iPad

1. Open `https://codexofreality.org/moons.html` in Safari.
2. Tap **Share**.
3. Select **Add to Home Screen**.
4. Confirm **13 Moons**, tap **Add**, and open the new icon.

## Screenshots

- `assets/img/moons/app/screenshot-mobile-390x844.png`
- `assets/img/moons/app/screenshot-mobile-430x932.png`

## Rollback

Export current records, create a recovery branch from
`13-moons-working-baseline`, review the restoration, and deploy through the
normal GitHub Pages process. Never move or delete the preservation branch or
tag.

## Known limitations

- iOS, iPadOS, Samsung Internet, and installed Android behavior require final
  confirmation on physical devices.
- Browser security rules decide when the automatic Android install prompt is
  offered.
- The custom domain could not be reached from the restricted development
  environment; relative-path behavior was verified locally.
- A website cannot silently remove an installed Home Screen icon.
