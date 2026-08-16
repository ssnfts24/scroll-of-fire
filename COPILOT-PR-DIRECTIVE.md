# Copilot Pull Request Directive

Preferred route: check out the pushed branch locally, start an interactive GitHub Copilot CLI session from the repository root, replace `<BRANCH>` below, and paste the complete directive. The leading `/pr create` tells Copilot to push the current branch if necessary and open its pull request.

GitHub's cloud agent normally creates a new work branch from the selected base branch. For this already-built overlay, use Copilot CLI on the current branch so the pull request head remains `<BRANCH>` and the base remains `main`.

```text
/pr create Create a pull request from the current branch <BRANCH> into main for the Scroll of Fire advanced site rebuild. Do not create a replacement implementation branch.

First inspect ADVANCED-REBUILD-HANDOFF.md and docs/reports/site-advanced-rebuild-2026-08-15.md. Review the complete branch diff against main; do not regenerate the project, replace established calendar/astronomy equations, or discard files from the overlay.

Required verification:
1. Confirm Netlify still publishes docs/ and the app/service-worker version is 2026.08.15.4.
2. Run npm run validate with Node 20 or newer. Do not open the PR if any test or site-audit check fails.
3. Verify the homepage uses the actual shared LivingTimeSphere mount with renderer auto and does not expose the full location, layer, date, or mode controls.
4. Verify the 3D dependency order and renderer lifecycle preserve a working SVG/Canvas fallback with an explicit reason for capability failure, timeout, initialization failure, or WebGL context loss. Confirm diagnostics reuse a cached WebGL capability result and every retry leaves exactly one renderer-owned canvas.
5. Verify location/weather refreshes are re-entry safe: snapshot construction is side-effect free, one provider operation is shared per location, network waits are bounded, and loading a location cannot recursively dispatch environment updates or freeze the UI.
6. Verify witness/activity dates remain on the visitor's local calendar day during UTC rollover hours.
7. Move the selected date away from Today, then verify the top Today mode, sidebar Now/Today chips, browser history, and Temporal Lens all restore the same canonical day/year/marker/URL without changing unrelated layer preferences.
8. Exercise the Temporal Lens scrubber, circular day/week/Moon jumps, scoped playback, selected-versus-Today comparison metrics/connection, populated Data Table/Text renderers, and camera-only presets. Confirm rapid selection uses the lightweight renderer update and solar-only snapshot path.
9. Verify the full Observatory's records, JSON import/export, questions, recurring quests, recurrence explanations, and 200-year map remain local-first and functional.
10. Review service-worker/network cache changes carefully so old stable JS/CSS cannot persist after deployment and optional workspace assets cannot block installation.
11. Confirm all images and local references included in the overlay are committed.

Keep the change set focused. Preserve the local-first privacy model, explicit location consent, existing canonical calendar/astronomy engines, graceful provider fallbacks, and the rule that recurrence is not presented as causation. Do not introduce a CDN dependency for Three.js.

Create a pull request from <BRANCH> to main with:
- title: feat: rebuild the Living Time Observatory and stabilize the full site
- a phase-by-phase summary;
- the exact npm run validate result (630 tests);
- the 69-page/34-stylesheet/4,092-reference audit result;
- a deployment cache-migration note for returning service-worker users;
- explicit post-deploy checks for desktop/mobile, WebGL/fallback, record export, quests, and the century map;
- known provider limitations for historical reanalysis and optional air-quality/space-weather layers.

If repository permissions do not permit opening the PR, prepare the final PR title and body verbatim and report the precise permission blocker. Do not silently change scope to make the PR pass.
```

If Copilot CLI is not available, select `<BRANCH>` on GitHub.com and use **Compare & pull request**, with `main` as the base. Paste the phase summary and verification evidence from this directive into the PR body; do not start a cloud-agent task merely to wrap the existing commits, because that flow creates another branch by default.
