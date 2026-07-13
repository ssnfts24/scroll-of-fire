# Codex of Reality — Maintenance Guide

Written for Aaron, not only for developers.

---

## How the Living Codex State Works

The Living Codex is driven by **`docs/assets/js/living-codex.js`**.

When any page loads, the script:

1. Reads the current local time.
2. Determines the daypart: **Dawn** (5–10 am), **Day** (10 am–5 pm), **Dusk** (5–9 pm), **Night** (9 pm–5 am).
3. Reads the Remnant 13 Moons calendar state from `docs/assets/js/calendar-cor.js`.
4. Reads saved witness records and return-path data from `localStorage`.
5. Fetches the latest Codex updates from `docs/assets/data/codex-updates.json`.
6. Renders the signal bar, Today panel, Continue Your Path panel, and Recent Signals list.

The script refreshes every 60 seconds and also refreshes when the browser tab becomes visible again.

---

## Where Date and Moon State Come From

- **Current date:** `new Date()` in the visitor's browser (local time, no server required).
- **Moon cycle:** `docs/assets/js/calendar-cor.js` — the `SOFCalendar` module calculates the current Remnant 13 Moons position from the epoch date.
- **Moon catalog:** `docs/assets/data/moons.json` — the full list of 13 moons with names, essences, and tones. This file is fetched at runtime.
- **Moon phase (illumination):** calculated from astronomical formulas in `calendar-cor.js`.

---

## localStorage Keys

All keys are namespaced with a version suffix so they can be cleanly reset after major changes.

| Key | Purpose |
|-----|---------|
| `sof.codex.last-visit.v1` | ISO timestamp of the last page load. Used to detect first visits and show "Last visit: X days ago." |
| `sof.codex.last-gate.v1` | JSON object: `{ href, title, timestamp }` for the Continue Your Path panel. |
| `scroll_of_fire_witness_ledger_v3` | Array of witness ledger entries (Manifest / teach.html). |
| `sof_moon_logs_v3` | Array of moon cycle log entries (13 Moons / moons.html). |
| `covenant-caravan.notes` | Plaintext field notes from the Covenant Caravan page. |
| `sof.theory.settings.v3` | Theory page panel preferences (font size, sections open). |
| `sof_frequency_governance_journal_v2` | Frequency Governance journal entries. |
| `sof_moons_tz_v2` | User's timezone preference for the 13 Moons calendar. |
| `sof_moons_boundary_v1` | Day-boundary preference (midnight vs sunset). |

To clear all Codex data in the browser: open DevTools → Application → Storage → Clear Site Data.

---

## How Continue Your Path Works

When a visitor navigates to a Codex gate (13 Moons, Ledger, Hub, etc.), `living-codex.js` saves the gate URL, title, and timestamp to `localStorage` under `sof.codex.last-gate.v1`.

On the next visit to the homepage, the Continue Your Path panel becomes visible and links directly to that gate.

The visitor can clear the path with the **Clear path** button, which removes `sof.codex.last-gate.v1`.

---

## How to Add a Codex Update

Open `docs/assets/data/codex-updates.json`.

Add a new object at the top of the array:

```json
{
  "date": "YYYY-MM-DD",
  "type": "system",
  "title": "Short title — one sentence.",
  "summary": "One or two sentences describing what changed.",
  "url": "./hub.html",
  "symbol": "☲"
}
```

**Required fields:** `date`, `type`, `title`.  
**Optional fields:** `summary`, `url`, `symbol`.

Valid `type` values: `system`, `calendar`, `artifact`, `build log`, `field note`, `theory`, `caravan`.

The homepage Recent Codex Activity panel shows the most recent entries sorted by date.

---

## How to Add a Field Note

Field notes are currently authored as Codex updates with `"type": "field note"` in `codex-updates.json`.

If a separate `field-notes.json` is created in the future, it should use this structure:

```json
{
  "id": "fn-001",
  "date": "YYYY-MM-DD",
  "title": "Short title",
  "body": "One paragraph of plain text.",
  "tags": ["caravan", "horse", "water"]
}
```

---

## How to Add or Update an Artifact

Artifacts are listed in `docs/shop.html` as HTML cards. There is no separate JSON for artifacts yet.

To add an artifact:

1. Open `docs/shop.html`.
2. Copy an existing artifact card block.
3. Update the name, description, price, and image reference.
4. Add the image to `docs/assets/img/`.
5. Use descriptive `alt` text on all images.

If an `artifacts.json` file is created in the future, run `node scripts/validate-codex-data.js` to check it.

---

## How to Change System Relationships

The Hub (`docs/hub.html`) lists system cards in a grid. Relationships between systems are described in card metadata text.

There is no separate `system-map.json` file at this time. If one is created, it should follow this pattern:

```json
{
  "id": "t7",
  "label": "Resonant Physics Engine (T-7)",
  "href": "systems/t-7.html",
  "relatedTo": ["frequency-governance", "manifest", "ethics"]
}
```

---

## How to Add a Next Gate

Next Gate links are `<a>` elements at the bottom of major pages pointing to the logical following page.

Example:
```html
<a class="btn primary" href="./moons.html">Next Gate: 13 Moons</a>
```

Place them inside `.hero-actions` at the bottom of the main content.

---

## How to Test Custom-Domain Paths

The custom domain is `https://codexofreality.org/`.

All pages use `<base href="/">` so asset paths are relative to the root.

To test on the custom domain:

1. Deploy to GitHub Pages.
2. Navigate to `https://codexofreality.org/` and check for console errors.
3. Verify that `assets/data/codex-updates.json` and `assets/data/moons.json` load without 404 errors.
4. Check that images load correctly (no broken `src` paths).

---

## How to Test GitHub Pages Project Paths

The GitHub Pages URL is `https://ssnfts24.github.io/scroll-of-fire/`.

The `<head>` of every page includes this snippet:

```html
<script>
  if (location.hostname === "ssnfts24.github.io") {
    const base = document.querySelector("base");
    if (base) base.setAttribute("href", "/scroll-of-fire/");
  }
</script>
```

This adjusts the `<base>` tag so all relative asset paths resolve correctly under the `/scroll-of-fire/` prefix.

When testing on the GitHub Pages URL, verify:

- Navigation links resolve correctly (no 404).
- JSON data files load from `scroll-of-fire/assets/data/`.
- Images load from `scroll-of-fire/assets/img/`.
- The signal bar populates with real data.

---

## How to Disable or Adjust Motion

**Disable all motion (user preference):**  
The browser's **prefers-reduced-motion** setting disables all animations and transitions site-wide. Animations in `animations.css` and `motion.js` both check this preference.

**Disable a specific animation in CSS:**  
Open `docs/assets/css/animations.css`. Comment out or remove the relevant `animation:` rule.

**Disable canvas breath animation:**  
The canvas breath loop runs only on the homepage (`index.html`) when `#codexExerciseCanvas` is present. It is initialized in `docs/assets/js/motion.js` → `initBreathCanvas()`. To disable it, remove the canvas element from `index.html`, or add an early return in `initBreathCanvas()`.

**Disable section reveals:**  
Remove the `.reveal` class from elements, or add an early return in `motion.js` → `initReveal()`.

---

## How Reduced-Motion Behavior Works

All motion follows the CSS `prefers-reduced-motion: reduce` media query.

In reduced-motion mode:

- All CSS `animation` and `transition` rules are set to `none` via `animations.css`.
- The `.reveal` opacity animation is bypassed; content is immediately visible.
- The canvas breath loop renders one static frame and stops.
- The ambient field drift stops.
- Seal rotation stops.
- Connection flow stops.
- View Transitions are disabled.
- Stagger delays are removed.

The `prefersReducedMotion()` function in `site.js` and `motion.js` reads this preference in JavaScript.

---

## How to Troubleshoot Failed JSON Loading

The Living Codex fetches two JSON files at runtime:

- `docs/assets/data/codex-updates.json`
- `docs/assets/data/moons.json`

**Symptoms of a failed fetch:**

- Recent Codex Activity panel shows the empty-state message.
- Moon state shows "Visible in the 13 Moons gate" instead of real moon data.

**To diagnose:**

1. Open browser DevTools → Network tab.
2. Reload the page.
3. Look for requests to `codex-updates.json` and `moons.json`.
4. Check the status code:
   - `200` — file loaded correctly.
   - `404` — file not found (check the path).
   - `0` / CORS error — check the server configuration.

**To validate JSON locally:**

```bash
node scripts/validate-codex-data.js
```

This checks for required fields, valid dates, and malformed structures in all data files.
