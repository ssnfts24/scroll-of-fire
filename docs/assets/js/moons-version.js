const APP_VERSION = "2026.07.16.3";
const DATA_SCHEMA_VERSION = 1;
const PAGE_BUILD = "20260716-3";
const CSS_RELEASE = "20260716-3";
const SERVICE_WORKER_BUILD = APP_VERSION;
const DEPLOYMENT_COMMIT = "not-embedded";

globalThis.SOF_13_MOONS = Object.freeze({
  APP_VERSION,
  DATA_SCHEMA_VERSION,
  PAGE_BUILD,
  CSS_RELEASE,
  SERVICE_WORKER_BUILD,
  DEPLOYMENT_COMMIT,
  START_URL: "./moons.html?source=installed",
  APP_SCOPE: "./",
  MANIFEST_PATH: "manifest.webmanifest",
  CACHE_PREFIX: "sof-13-moons-"
});
