# Remnant 13 Moons Version History

## 2026.07.16.2

- Split mandatory app-shell and optional artwork precaching.
- Guarded Refresh App Files while offline and added a network preflight.
- Preserved recovery caches until a versioned service-worker readiness and startup check completes.
- Verified current-core promotion and removed stale version caches during normal activation.
- Made asset lookup prefer the current version's named caches.
- Made Merge imports preserve settings, deduplicate arrays, and report conflicts.

## Working baseline

- Protected commit: `d2c42a174293373d34e9c1d002f99a3135d23d5c`
- Preservation branch: `preserve/13-moons-best-working`
- Preservation tag: `13-moons-working-baseline`
- Recorded: 2026-07-16

This commit is the preserved best-working version from before the mobile app
installation upgrade. Do not move, delete, or overwrite the preservation
branch or tag.

## Rollback

1. Export any current 13 Moons records from the app.
2. Create a recovery branch from `13-moons-working-baseline`.
3. Deploy the recovery branch through the normal review process.
4. Confirm the calendar result, saved-record access, and custom-domain paths.
5. Keep the failed upgrade branch available for diagnosis.

Do not rewrite the default branch or force-push the baseline tag.
