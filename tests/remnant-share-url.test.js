"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function loadUrlModule() {
  const context = {
    URL,
    location: {
      href: "https://codexofreality.org/moons.html",
      origin: "https://codexofreality.org",
      pathname: "/genesis-oracle.html"
    }
  };
  context.globalThis = context;
  context.window = context;
  vm.runInNewContext(read("docs/assets/js/share/remnant-share-url.js"), context);
  return context.RemnantShareUrl;
}

test("permanent share links preserve required remnant parameters", () => {
  const api = loadUrlModule();
  const link = api.buildPermanentLink({
    baseUrl: "https://codexofreality.org/moons.html",
    date: "2026-07-17",
    timeZone: "America/Los_Angeles",
    boundaryMode: "manual",
    manualSunset: "18:45",
    selectedTab: "daily-mirror",
    readingVersion: "mirror-reading/2.0.0",
    displayMode: "standard",
    source: "today"
  });

  const parsed = api.parsePermanentLink(link);
  assert.equal(JSON.stringify(parsed), JSON.stringify({
    date: "2026-07-17",
    timeZone: "America/Los_Angeles",
    boundaryMode: "manual",
    manualSunset: "18:45",
    selectedTab: "daily-mirror",
    readingVersion: "mirror-reading/2.0.0",
    displayMode: "standard",
    source: "today"
  }));
});

test("oracle default share link excludes personal profile data", () => {
  const api = loadUrlModule();
  const link = api.buildOracleShareLink({
    baseUrl: "https://codexofreality.org/genesis-oracle.html",
    timeZone: "America/Los_Angeles",
    boundaryMode: "sunset",
    sunsetTime: "18:00",
    view: "quick",
    oracleVersion: "genesis-oracle/2.0.0"
  });

  const url = new URL(link);
  const query = url.searchParams.toString();
  assert.equal(url.searchParams.get("tz"), "America/Los_Angeles");
  assert.equal(url.searchParams.get("boundary"), "sunset");
  assert.equal(url.searchParams.get("sunset"), "18:00");
  assert.equal(url.searchParams.get("view"), "quick");
  assert.equal(url.searchParams.get("oracleVersion"), "genesis-oracle/2.0.0");
  assert.equal(query.includes("name="), false);
  assert.equal(query.includes("birthDate="), false);
  assert.equal(query.includes("birthTime="), false);
  assert.equal(query.includes("profile="), false);
});
