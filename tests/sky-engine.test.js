"use strict";

/*
 * CodexSkyEngine — pinned against published reference values.
 *
 * References used (stated in the Phase C sky build note):
 *   - timeanddate.com sun tables for Seattle, June + November 2026
 *     (read 2026-11-23): sunrise/sunset/solar noon/day length, and
 *     the live Sun/Moon altitude-azimuth readouts for
 *     2026-11-23T12:28:42Z.
 *   - timeanddate.com moon tables for Seattle, 2026 (read
 *     2026-11-23): quarter instants for the year, moonrise/moonset
 *     and illumination for November 2026.
 *   - The repo's own U.S. Naval Observatory season table
 *     (SEASON_TURNS in sphere-armillary.js, 2026–2027) and the
 *     repo's Skyfield/JPL March-equinox reference table
 *     (equinox-reference-data.js, 2014–2027).
 *   - The Yale Bright Star Catalogue values as carried in the
 *     Astronomical Almanac Bright Star List (epoch 2016.5) — the
 *     catalog data test pins the file's own brightest stars.
 *   - Cross-check (labelled as such): planet longitudes against
 *     the Sphere's existing planetary module, an independent
 *     implementation of the same published Schlyter elements.
 *
 * Tolerances are the engine's stated accuracy classes, set from
 * the residuals measured when this suite was written — not wished
 * for. If a tolerance here ever fails, the class statement in
 * sky-engine.js must change with it, in the open.
 */

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");

function loadSkyContext(withCatalog = true) {
  const context = { Intl, Date, URL, console };
  context.globalThis = context;
  context.window = context;
  const scripts = [];
  if (withCatalog) scripts.push("docs/assets/js/astronomy/bright-stars.js");
  scripts.push("docs/assets/js/astronomy/sky-engine.js");
  scripts.push("docs/assets/js/astronomy/equinox-reference-data.js");
  scripts.push("docs/assets/js/sphere/living-time-sphere-planetary-positions.js");
  for (const rel of scripts) {
    vm.runInNewContext(read(rel), context);
  }
  return context;
}

const SEATTLE = { lat: 47.6062, lon: -122.3321 };
const minutesOff = (a, b) => Math.abs(a.getTime() - b.getTime()) / 60000;

test("bright-stars catalog: the subset is the catalog, credited and bounded", () => {
  const ctx = loadSkyContext();
  const catalog = ctx.CodexBrightStars;
  assert.equal(catalog.sourceClass, "catalog");
  assert.equal(catalog.epoch, 2016.5);
  assert.equal(catalog.count, 510);
  assert.equal(catalog.stars.length, 510);
  for (const row of catalog.stars) {
    assert.ok(row[3] <= 4.0, `HR ${row[0]} above the magnitude limit`);
  }
  const byHr = new Map(catalog.stars.map((r) => [r[0], r]));
  // The three restored minus signs (see bright-stars.js header).
  assert.equal(byHr.get(2491)[3], -1.46); // Sirius
  assert.equal(byHr.get(2326)[3], -0.72); // Canopus
  assert.equal(byHr.get(5340)[3], -0.04); // Arcturus
  // Epoch-2016.5 positions as published in the Almanac list.
  assert.ok(Math.abs(byHr.get(2491)[1] - 101.47) < 0.01); // Sirius RA
  assert.ok(Math.abs(byHr.get(2491)[2] - -16.7389) < 0.01); // Sirius Dec
  assert.ok(Math.abs(byHr.get(7001)[1] - 279.3746) < 0.01); // Vega RA
  assert.ok(Math.abs(byHr.get(7001)[3] - 0.03) < 1e-9); // Vega V
  assert.ok(Math.abs(byHr.get(8728)[3] - 1.16) < 1e-9); // Fomalhaut V
  // Mira is listed with a magnitude range (2-10): not carried.
  assert.equal(byHr.has(681), false);
});

test("stars: no catalog loaded means no stars, said plainly", () => {
  const ctx = loadSkyContext(false);
  const result = ctx.CodexSkyEngine.starsAboveHorizon(
    new Date(Date.UTC(2026, 0, 15, 6)), SEATTLE.lat, SEATTLE.lon
  );
  assert.equal(result.available, false);
  assert.equal(result.stars.length, 0);
});

test("stars: Polaris stands over the pole — altitude ≈ latitude, azimuth ≈ north", () => {
  const ctx = loadSkyContext();
  const E = ctx.CodexSkyEngine;
  // A navigational fact printed in every almanac: the pole star's
  // altitude equals the observer's latitude, within its polar
  // distance (about 0.65 degrees in this era).
  for (const iso of ["2026-01-15T06:00:00Z", "2026-07-15T06:00:00Z", "2026-11-23T12:00:00Z"]) {
    const found = E.starsAboveHorizon(new Date(iso), 47.83, -122.3)
      .stars.find((s) => s.hr === 424);
    assert.ok(found, `Polaris above the horizon at ${iso}`);
    assert.ok(Math.abs(found.altitude - 47.83) < 0.8, `altitude ${found.altitude}`);
    const azOff = Math.min(Math.abs(found.azimuth), Math.abs(found.azimuth - 360));
    assert.ok(azOff < 2, `azimuth ${found.azimuth}`);
    assert.equal(found.source, "catalog");
  }
});

test("stars: Sirius transits due south when sidereal time meets its right ascension", () => {
  const ctx = loadSkyContext();
  const E = ctx.CodexSkyEngine;
  // Geometric identity check (labelled as such): at transit a star
  // south of the zenith crosses the meridian at azimuth 180.
  const sirius = ctx.CodexBrightStars.stars.find((r) => r[0] === 2491);
  // Find the transit on 2026-01-15 by walking LST to the star's RA.
  let t = Date.UTC(2026, 0, 15, 0, 0, 0);
  let best = null;
  for (let mins = 0; mins < 24 * 60; mins += 2) {
    const date = new Date(t + mins * 60000);
    const found = E.starsAboveHorizon(date, SEATTLE.lat, SEATTLE.lon)
      .stars.find((s) => s.hr === 2491);
    if (found && (!best || found.altitude > best.altitude)) best = found;
  }
  assert.ok(best, "Sirius above the horizon that night");
  assert.ok(Math.abs(best.azimuth - 180) < 3, `transit azimuth ${best.azimuth}`);
  assert.ok(sirius, "catalog carries Sirius");
});

test("sun: Seattle, June 21 2026 — published rise, set, noon, day length", () => {
  const ctx = loadSkyContext();
  const E = ctx.CodexSkyEngine;
  const s = E.sunForCivilDate({ year: 2026, month: 6, day: 21 }, SEATTLE.lat, SEATTLE.lon, -420);
  assert.ok(minutesOff(s.sunrise, new Date(Date.UTC(2026, 5, 21, 12, 11))) <= 3, `sunrise ${s.sunrise}`);
  assert.ok(minutesOff(s.sunset, new Date(Date.UTC(2026, 5, 22, 4, 10))) <= 3, `sunset ${s.sunset}`);
  assert.ok(minutesOff(s.solarNoon, new Date(Date.UTC(2026, 5, 21, 20, 11))) <= 3, `noon ${s.solarNoon}`);
  assert.ok(Math.abs(s.daylightMinutes - 959.28) <= 6, `day length ${s.daylightMinutes}`);
  assert.equal(s.polar, null);
  assert.equal(s.source, "computed");
});

test("sun: Seattle, November 23 2026 — published rise and set", () => {
  const ctx = loadSkyContext();
  const E = ctx.CodexSkyEngine;
  const s = E.sunForCivilDate({ year: 2026, month: 11, day: 23 }, SEATTLE.lat, SEATTLE.lon, -480);
  assert.ok(minutesOff(s.sunrise, new Date(Date.UTC(2026, 10, 23, 15, 26))) <= 3, `sunrise ${s.sunrise}`);
  assert.ok(minutesOff(s.sunset, new Date(Date.UTC(2026, 10, 24, 0, 24))) <= 3, `sunset ${s.sunset}`);
});

test("sun: altitude and azimuth at a published instant", () => {
  const ctx = loadSkyContext();
  const E = ctx.CodexSkyEngine;
  // timeanddate's live readout, 2026-11-23T12:28:42Z, Seattle:
  // Sun altitude -29.5 degrees, direction 89 degrees (east).
  const altAz = E.sunAltAz(new Date(Date.UTC(2026, 10, 23, 12, 28, 42)), SEATTLE.lat, SEATTLE.lon);
  assert.ok(Math.abs(altAz.altitude - -29.5) <= 0.5, `altitude ${altAz.altitude}`);
  assert.ok(Math.abs(altAz.azimuth - 89) <= 2, `azimuth ${altAz.azimuth}`);
});

test("sun: polar day and polar night are named, not faked", () => {
  const ctx = loadSkyContext();
  const E = ctx.CodexSkyEngine;
  const june = E.sunForCivilDate({ year: 2026, month: 6, day: 21 }, 69.68, 18.96, 120);
  assert.equal(june.polar, "day");
  assert.equal(june.sunrise, null);
  const december = E.sunForCivilDate({ year: 2026, month: 12, day: 21 }, 69.68, 18.96, 60);
  assert.equal(december.polar, "night");
  assert.equal(december.sunset, null);
});

test("season turns 2026: within 20 minutes of the repo's USNO table", () => {
  const ctx = loadSkyContext();
  const E = ctx.CodexSkyEngine;
  const usno = {
    "March Equinox": "2026-03-20T14:46:00Z",
    "June Solstice": "2026-06-21T08:24:00Z",
    "September Equinox": "2026-09-23T00:05:00Z",
    "December Solstice": "2026-12-21T20:50:00Z"
  };
  for (const turn of E.seasonTurns(2026)) {
    assert.ok(minutesOff(turn.at, new Date(usno[turn.name])) <= 20, `${turn.name} ${turn.at}`);
  }
});

test("season turns: March equinoxes 2014–2027 within 30 minutes of the JPL table", () => {
  const ctx = loadSkyContext();
  const E = ctx.CodexSkyEngine;
  const records = ctx.EquinoxReferenceData.records;
  assert.ok(records.length >= 14);
  for (const record of records) {
    const march = E.seasonTurns(record.year).find((t) => t.name === "March Equinox");
    assert.ok(
      minutesOff(march.at, new Date(record.utcInstant)) <= 30,
      `${record.year}: computed ${march.at} vs JPL ${record.utcInstant}`
    );
  }
});

test("moon: phase instants against the published 2026 quarters", () => {
  const ctx = loadSkyContext();
  const E = ctx.CodexSkyEngine;
  const cases = [
    { from: "2026-01-01T00:00:00Z", target: 180, published: "2026-01-03T10:02:00Z" }, // full
    { from: "2026-01-10T00:00:00Z", target: 0, published: "2026-01-18T19:52:00Z" }, // new
    { from: "2026-11-20T00:00:00Z", target: 180, published: "2026-11-24T14:53:00Z" }, // full
    { from: "2026-12-01T00:00:00Z", target: 0, published: "2026-12-09T00:51:00Z" } // new
  ];
  for (const c of cases) {
    const at = E.nextPhaseInstant(new Date(c.from), c.target);
    assert.ok(at, `phase instant found for ${c.published}`);
    assert.ok(minutesOff(at, new Date(c.published)) <= 180, `computed ${at} vs published ${c.published}`);
  }
});

test("moon: illumination against published values", () => {
  const ctx = loadSkyContext();
  const E = ctx.CodexSkyEngine;
  // timeanddate's November 2026 Seattle table (illumination at the
  // day's meridian passing) + the full-moon morning itself.
  const cases = [
    { at: "2026-11-24T07:33:00Z", published: 99.7 },
    { at: "2026-11-01T13:59:00Z", published: 53.2 },
    { at: "2026-11-09T20:13:00Z", published: 0.5 }
  ];
  for (const c of cases) {
    const illum = E.moonPhase(new Date(c.at)).illumination * 100;
    assert.ok(Math.abs(illum - c.published) <= 1.5, `${c.at}: computed ${illum} vs published ${c.published}`);
  }
  const nov20 = E.moonPhase(new Date(Date.UTC(2026, 10, 20, 12)));
  assert.equal(nov20.name, "Waxing Gibbous");
  assert.equal(nov20.waxing, true);
});

test("moon: Seattle, November 23 2026 — published moonset and moonrise", () => {
  const ctx = loadSkyContext();
  const E = ctx.CodexSkyEngine;
  const day = E.moonForCivilDate({ year: 2026, month: 11, day: 23 }, SEATTLE.lat, SEATTLE.lon, -480);
  const set = day.events.find((e) => e.kind === "moonset");
  const rise = day.events.find((e) => e.kind === "moonrise");
  assert.ok(set && rise, `events ${JSON.stringify(day.events)}`);
  assert.ok(minutesOff(set.at, new Date(Date.UTC(2026, 10, 23, 14, 34))) <= 10, `moonset ${set.at}`);
  assert.ok(minutesOff(rise.at, new Date(Date.UTC(2026, 10, 23, 23, 21))) <= 10, `moonrise ${rise.at}`);
});

test("moon: altitude and azimuth at a published instant", () => {
  const ctx = loadSkyContext();
  const E = ctx.CodexSkyEngine;
  // timeanddate's live readout, 2026-11-23T12:28:42Z, Seattle:
  // Moon altitude 17.7 degrees, direction 282 degrees (west).
  const altAz = E.moonAltAz(new Date(Date.UTC(2026, 10, 23, 12, 28, 42)), SEATTLE.lat, SEATTLE.lon);
  assert.ok(Math.abs(altAz.altitude - 17.7) <= 1.5, `altitude ${altAz.altitude}`);
  assert.ok(Math.abs(altAz.azimuth - 282) <= 3, `azimuth ${altAz.azimuth}`);
});

test("planets: longitudes agree with the Sphere's existing Schlyter module", () => {
  const ctx = loadSkyContext();
  const E = ctx.CodexSkyEngine;
  // Cross-check between two independent implementations of the
  // same published elements — a consistency pin, not an external
  // reference (the build note says which is which).
  const date = new Date(Date.UTC(2026, 10, 23, 12));
  const theirs = new Map(ctx.LivingTimePlanetaryPositions.calculate(date).map((p) => [p.name, p]));
  for (const mine of E.planetPositions(date)) {
    const other = theirs.get(mine.name);
    assert.ok(other, `${mine.name} in both modules`);
    const lonOff = Math.abs(((mine.eclipticLongitude - other.longitude + 540) % 360) - 180);
    const tol = mine.name === "Mercury" ? 2 : 0.5;
    assert.ok(lonOff <= tol, `${mine.name} longitude ${mine.eclipticLongitude} vs ${other.longitude}`);
    assert.ok(Math.abs(mine.eclipticLatitude - other.latitude) <= 0.5, `${mine.name} latitude`);
  }
});

test("planets: the standing invariants hold", () => {
  const ctx = loadSkyContext();
  const E = ctx.CodexSkyEngine;
  // Venus never stands farther than about 47 degrees from the Sun.
  for (const iso of ["2026-01-15T00:00:00Z", "2026-06-15T00:00:00Z", "2026-11-23T00:00:00Z", "2027-03-15T00:00:00Z"]) {
    const venus = E.planetPositions(new Date(iso)).find((p) => p.name === "Venus");
    assert.ok(venus.elongationFromSun <= 47.5, `Venus elongation ${venus.elongationFromSun} at ${iso}`);
    assert.equal(venus.source, "computed");
  }
  const jupiter = E.planetPositions(new Date(Date.UTC(2026, 10, 23, 12)))
    .find((p) => p.name === "Jupiter");
  assert.ok(jupiter.magnitude >= -2.6 && jupiter.magnitude <= -1.8, `Jupiter magnitude ${jupiter.magnitude}`);
  assert.ok(jupiter.distanceAU > 4 && jupiter.distanceAU < 6.5, `Jupiter distance ${jupiter.distanceAU}`);
});

test("sidereal: GMST at J2000 is the published constant", () => {
  const ctx = loadSkyContext();
  const E = ctx.CodexSkyEngine;
  const gmst = E.gmstDegrees(new Date(Date.UTC(2000, 0, 1, 12, 0, 0)));
  assert.ok(Math.abs(gmst - 280.46061837) < 0.001, `GMST ${gmst}`);
});
