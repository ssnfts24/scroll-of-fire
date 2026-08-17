/**
 * Codex Life Atlas — portable archive import adapters.
 * Parses user-supplied files locally. No network calls and no automatic publishing.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.CodexLifeAtlasImporters = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const VERSION = "1.1.0";
  const MAX_TEXT_BYTES = 24 * 1024 * 1024;

  function clean(value) { return value == null ? "" : String(value).trim(); }
  function asArray(value) { return Array.isArray(value) ? value : value == null ? [] : [value]; }
  function iso(value) {
    if (value == null || value === "") return null;
    if (typeof value === "number") {
      const ms = value < 1e12 ? value * 1000 : value;
      const d = new Date(ms);
      return Number.isNaN(d.getTime()) ? null : d.toISOString();
    }
    const text = clean(value);
    if (!text) return null;
    if (/^\d{10,13}$/.test(text)) return iso(Number(text));
    const d = new Date(text);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }

  function first(obj, keys) {
    for (const key of keys) {
      const parts = key.split(".");
      let value = obj;
      for (const part of parts) value = value && typeof value === "object" ? value[part] : undefined;
      if (value !== undefined && value !== null && value !== "") return value;
    }
    return null;
  }

  function detectSource(filename = "", value = null) {
    const name = filename.toLowerCase();
    const hay = JSON.stringify(value || {}).slice(0, 12000).toLowerCase();
    if (name.endsWith(".ics")) return "calendar-ics";
    if (name.includes("tweet") || name.includes("twitter") || name.includes("x-") || hay.includes("tweet_create_events")) return "x-archive";
    if (name.includes("instagram") || hay.includes("instagram")) return "instagram-archive";
    if (name.includes("facebook") || name.includes("posts_and_comments") || hay.includes("facebook")) return "facebook-archive";
    if (name.includes("tiktok") || hay.includes("tiktok")) return "tiktok-archive";
    if (name.includes("location") || name.includes("timeline") || hay.includes("latitudee7") || hay.includes("semanticsegments")) return "google-location";
    if (name.endsWith(".csv")) return "csv";
    if (name.endsWith(".json") || name.endsWith(".js")) return "json-archive";
    return "unknown";
  }

  function unfold(value, path = "$", out = [], depth = 0) {
    if (depth > 10 || out.length > 200000) return out;
    if (Array.isArray(value)) {
      value.forEach((item, i) => unfold(item, `${path}[${i}]`, out, depth + 1));
      return out;
    }
    if (!value || typeof value !== "object") return out;
    out.push({ value, path });
    Object.keys(value).forEach(key => {
      const child = value[key];
      if (child && typeof child === "object") unfold(child, `${path}.${key}`, out, depth + 1);
    });
    return out;
  }

  function objectCandidate(obj, sourceType, sourcePath) {
    if (!obj || typeof obj !== "object" || Array.isArray(obj)) return null;
    const timestamp = iso(first(obj, [
      "timestamp", "timestamp_ms", "time", "date", "created_at", "createdAt", "creation_timestamp",
      "creationTimestamp", "taken_at", "takenAt", "startTime", "start_time", "visit.topCandidate.placeLocation.latLng"
    ]));

    // Google semantic timeline records often keep timestamps under nested visit/activity keys.
    const nestedTime = iso(first(obj, [
      "visit.startTime", "activity.startTime", "timelinePathPoint.time", "startTime", "endTime"
    ]));
    const instant = timestamp || nestedTime;
    if (!instant) return null;

    const text = clean(first(obj, [
      "title", "name", "text", "full_text", "tweet.full_text", "tweet.text", "content", "caption", "description",
      "data.0.post", "data.0.comment.comment", "media.0.title", "attachments.0.data.0.media.description"
    ]));
    const uri = clean(first(obj, ["uri", "url", "media_uri", "mediaUri", "attachments.0.data.0.media.uri"]));
    const place = clean(first(obj, [
      "place", "location", "location_name", "locationName", "address", "placeName",
      "visit.topCandidate.placeLocation.name", "visit.topCandidate.placeLocation.address"
    ]));

    const numeric = value => value === null || value === undefined || value === "" ? NaN : Number(value);
    let latitude = numeric(first(obj, ["latitude", "lat", "location.latitude", "place.latitude", "visit.topCandidate.placeLocation.latitude"]));
    let longitude = numeric(first(obj, ["longitude", "lng", "lon", "location.longitude", "place.longitude", "visit.topCandidate.placeLocation.longitude"]));
    const latitudeE7 = numeric(first(obj, ["latitudeE7", "location.latitudeE7"]));
    const longitudeE7 = numeric(first(obj, ["longitudeE7", "location.longitudeE7"]));
    if (!Number.isFinite(latitude) && Number.isFinite(latitudeE7)) latitude = latitudeE7 / 1e7;
    if (!Number.isFinite(longitude) && Number.isFinite(longitudeE7)) longitude = longitudeE7 / 1e7;
    if (!Number.isFinite(latitude) || Math.abs(latitude) > 90) latitude = null;
    if (!Number.isFinite(longitude) || Math.abs(longitude) > 180) longitude = null;

    const sourceId = clean(first(obj, ["id", "id_str", "post_id", "tweet.id", "media.id", "activitySegmentId", "visitId"])) || null;
    const hasContext = Boolean(text || place || uri || sourceId || latitude != null || longitude != null);
    if (!hasContext) return null;

    const type = uri ? "media" : place || latitude != null ? "journey" : "event";
    return {
      sourceType,
      sourcePath,
      sourceId,
      type,
      title: text ? text.slice(0, 140) : place ? `Visit · ${place}` : `${sourceType} record`,
      summary: text,
      instant,
      placeLabel: place || null,
      latitude,
      longitude,
      payload: { uri: uri || null },
      confidence: latitude != null && longitude != null ? 0.96 : place ? 0.78 : text ? 0.68 : 0.55
    };
  }

  function parseAssignedJs(text) {
    const trimmed = text.trim();
    if (trimmed.startsWith("{") || trimmed.startsWith("[")) return JSON.parse(trimmed);
    const eq = trimmed.indexOf("=");
    if (eq >= 0) {
      const body = trimmed.slice(eq + 1).trim().replace(/;\s*$/, "");
      return JSON.parse(body);
    }
    throw new Error("Unsupported JavaScript archive wrapper.");
  }

  function parseJsonArchive(text, filename) {
    const value = parseAssignedJs(text);
    const sourceType = detectSource(filename, value);
    const candidates = unfold(value).map(item => objectCandidate(item.value, sourceType, item.path)).filter(Boolean);
    return { sourceType, candidates, rawCount: candidates.length };
  }

  function unescapeIcs(value) {
    return clean(value).replace(/\\n/gi, "\n").replace(/\\,/g, ",").replace(/\\;/g, ";").replace(/\\\\/g, "\\");
  }
  function icsDate(value) {
    const v = clean(value);
    if (/^\d{8}T\d{6}Z$/.test(v)) return `${v.slice(0,4)}-${v.slice(4,6)}-${v.slice(6,8)}T${v.slice(9,11)}:${v.slice(11,13)}:${v.slice(13,15)}Z`;
    if (/^\d{8}T\d{6}$/.test(v)) return `${v.slice(0,4)}-${v.slice(4,6)}-${v.slice(6,8)}T${v.slice(9,11)}:${v.slice(11,13)}:${v.slice(13,15)}`;
    if (/^\d{8}$/.test(v)) return `${v.slice(0,4)}-${v.slice(4,6)}-${v.slice(6,8)}T12:00:00`;
    return v;
  }
  function parseIcs(text) {
    const unfolded = text.replace(/\r?\n[ \t]/g, "");
    const blocks = unfolded.match(/BEGIN:VEVENT[\s\S]*?END:VEVENT/g) || [];
    const candidates = blocks.map((block, index) => {
      const fields = {};
      block.split(/\r?\n/).forEach(line => {
        const colon = line.indexOf(":"); if (colon < 0) return;
        const key = line.slice(0, colon).split(";")[0].toUpperCase();
        fields[key] = line.slice(colon + 1);
      });
      const instant = iso(icsDate(fields.DTSTART));
      if (!instant) return null;
      return {
        sourceType: "calendar-ics", sourcePath: `VEVENT[${index}]`, sourceId: clean(fields.UID) || null,
        type: "event", title: unescapeIcs(fields.SUMMARY) || "Calendar event",
        summary: unescapeIcs(fields.DESCRIPTION), instant,
        end: iso(icsDate(fields.DTEND)), placeLabel: unescapeIcs(fields.LOCATION) || null,
        latitude: null, longitude: null, payload: { status: clean(fields.STATUS) || null }, confidence: 0.99
      };
    }).filter(Boolean);
    return { sourceType: "calendar-ics", candidates, rawCount: candidates.length };
  }

  function parseCsv(text, filename) {
    const lines = text.split(/\r?\n/).filter(Boolean);
    if (lines.length < 2) return { sourceType: "csv", candidates: [], rawCount: 0 };
    const split = line => { const out=[]; let cur="", q=false; for(let i=0;i<line.length;i++){ const c=line[i]; if(c==='"'){ if(q&&line[i+1]==='"'){cur+='"';i++;} else q=!q; } else if(c===','&&!q){out.push(cur);cur="";} else cur+=c;} out.push(cur); return out; };
    const headers = split(lines[0]).map(h => clean(h));
    const rows = lines.slice(1).map((line, index) => Object.fromEntries(headers.map((h, i) => [h, split(line)[i] || ""])));
    const sourceType = detectSource(filename, rows[0]);
    const candidates = rows.map((row, i) => objectCandidate(row, sourceType, `row[${i + 2}]`)).filter(Boolean);
    return { sourceType, candidates, rawCount: candidates.length };
  }

  function sniffTextType(text, filename = "") {
    const lower = filename.toLowerCase();
    const head = text.slice(0, 16384).replace(/^\uFEFF/, "").trimStart();
    if (lower.endsWith(".ics") || /BEGIN:VCALENDAR|BEGIN:VEVENT/i.test(head)) return "ics";
    if (lower.endsWith(".csv")) return "csv";
    if (lower.endsWith(".json") || lower.endsWith(".js")) return "json";
    if (head.startsWith("{") || head.startsWith("[") || /^[A-Za-z_$][\w$.[\]'"]*\s*=\s*[\[{]/.test(head)) return "json";
    const firstLine = head.split(/\r?\n/, 1)[0] || "";
    if (firstLine.includes(",") && /date|time|timestamp|title|name|location|lat|lon|text|caption|event/i.test(firstLine)) return "csv";
    return "unknown";
  }

  function parseText({ text, filename = "archive" } = {}) {
    if (typeof text !== "string") throw new TypeError("Import text is required.");
    if (text.length > MAX_TEXT_BYTES) throw new Error("Archive text exceeds the safe 24 MB mobile parsing limit. Split the export into smaller files.");
    const kind = sniffTextType(text, filename);
    if (kind === "ics") return parseIcs(text);
    if (kind === "csv") return parseCsv(text, filename);
    if (kind === "json") return parseJsonArchive(text, filename);
    throw new Error(`Codex could not identify the data format in ${filename}.`);
  }

  return Object.freeze({ VERSION, MAX_TEXT_BYTES, detectSource, sniffTextType, parseText, parseIcs, parseCsv, parseJsonArchive, objectCandidate });
});
