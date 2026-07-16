# Remnant 13 Moons Recovery

The protected pre-upgrade version is commit
`d2c42a174293373d34e9c1d002f99a3135d23d5c`, preserved as branch
`preserve/13-moons-best-working` and tag `13-moons-working-baseline`.

## Repository rollback

1. Export user records before changing deployed files when the app remains
   accessible.
2. Create a new recovery branch at `13-moons-working-baseline`.
3. Open and review a pull request that restores the baseline files.
4. Deploy through the repository's normal GitHub Pages process.
5. Verify `moons.html` on the custom domain and GitHub Pages project path.

The preservation branch and tag are permanent recovery references. Never
delete, overwrite, or force-update them.

## Device recovery

Try **Check for Updates**, then **Refresh App Files**, before reinstalling.
Refreshing app files removes only 13 Moons caches and does not remove saved
logs or settings. It is disabled offline and verifies that `moons.html` is
available from the network before cleanup. Export important records before
destructive recovery.

Removing an installed Home Screen icon does not reliably erase browser
storage. Reinstallation is a recovery step, not the normal update process.
