# Remnant 13 Moons Mobile Testing

## Automated and browser results

| Test | Result |
| --- | --- |
| JavaScript syntax | Pass |
| Manifest JSON | Pass |
| Codex data validator | Pass |
| Service-worker registration | Pass |
| Core cache creation | Pass |
| Offline shell with server stopped | Pass |
| User-controlled service-worker update | Pass |
| Single update reload | Pass |
| Export/replace-import round trip | Pass: 1 record before and after |
| Import rollback backup | Pass |
| Unrelated local storage preservation | Pass |
| 320px document overflow | Pass: 320px content on 320px viewport |
| 360px document overflow | Pass: 360px content on 360px viewport |
| 375px document overflow | Pass: 375px content on 375px viewport |
| 390px document overflow | Pass: 390px content on 390px viewport |
| 412px document overflow | Pass: 412px content on 412px viewport |
| 430px document overflow | Pass: 430px content on 430px viewport |
| iPhone form input sizing | Pass: 16px |
| Mobile primary navigation | Pass: five destinations |
| Android-style back navigation | Pass |
| Deep-link default | Pass: Today |

The offline run loaded the calendar shell, CSS, JavaScript, core imagery, Moon
Day, visible Moon phase, sunset boundary, and Shabbat state after the local
server was stopped. Optional network data requests failed without blocking the
calendar.

## Manual device matrix

Complete these checks before production approval:

- [ ] Android Chrome browser mode
- [ ] Android Chrome installed mode
- [ ] Samsung Internet
- [ ] iPhone Safari
- [ ] iPhone Add to Home Screen mode
- [ ] iPad Safari
- [ ] Desktop Chrome
- [ ] Desktop Edge
- [ ] Portrait and landscape orientation
- [ ] Display cutout, notch, Dynamic Island, and Home indicator
- [ ] Android keyboard and back button
- [ ] Larger device text
- [ ] Slow connection
- [ ] App force-close and reopen
- [ ] Custom-domain install
- [ ] GitHub Pages project-path install

For each device, verify first visit, install, already-installed state, update,
old worker replacement, stale cached HTML, offline startup, saved records after
update and Refresh App Files, reset settings, destructive erase, export/import,
reinstall instructions, and icon cropping.

## Data-preservation procedure

1. Create a witness record and save nondefault sunset, boundary, and time-zone
   settings.
2. Export all data.
3. Apply an app update and confirm the record count and settings.
4. Run Refresh App Files and confirm them again.
5. Import with Merge, then with Replace.
6. Confirm counts, the rollback backup, and malformed-file error reporting.
7. Confirm unrelated site storage remains unchanged.

## Recovery procedure

Try Check for Updates, then Refresh App Files. Export records before removing
the Home Screen icon or erasing local app data. Repository rollback instructions
are in `13-moons-recovery.md`.
