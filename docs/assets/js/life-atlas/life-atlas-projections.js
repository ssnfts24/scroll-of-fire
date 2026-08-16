/**
 * Codex Life Atlas
 * Shared projection adapters.
 *
 * These adapters transform canonical LifeRecords into lightweight
 * projection-safe data without mutating or owning the records.
 */
(function (root, factory) {
  if (
    typeof module === "object" &&
    module.exports
  ) {
    module.exports = factory();
    return;
  }

  root.CodexLifeAtlasProjections =
    factory();
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const PROJECTIONS = Object.freeze([
    "sphere",
    "calendar",
    "timeline",
    "map",
    "ledger",
    "network"
  ]);

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function sortTemporal(records = []) {
    return [...records].sort((a, b) => {
      const aTime =
        Date.parse(
          a.temporal?.instant ||
          a.temporal?.start ||
          (
            a.temporal?.civilDate
              ? `${a.temporal.civilDate}T12:00:00Z`
              : ""
          ) ||
          a.provenance?.createdAt ||
          ""
        ) || 0;

      const bTime =
        Date.parse(
          b.temporal?.instant ||
          b.temporal?.start ||
          (
            b.temporal?.civilDate
              ? `${b.temporal.civilDate}T12:00:00Z`
              : ""
          ) ||
          b.provenance?.createdAt ||
          ""
        ) || 0;

      return aTime - bTime;
    });
  }

  function recordSummary(record) {
    return {
      id: record.id,
      type: record.type,
      subtype: record.subtype || null,
      title: record.title || "",
      summary: record.summary || "",
      tags: [...(record.tags || [])],
      privacy: {
        visibility:
          record.privacy?.visibility ||
          "private"
      },
      temporal: {
        civilDate:
          record.temporal?.civilDate ||
          null,

        patternYear:
          record.temporal?.patternYear ??
          null,

        patternDay:
          record.temporal?.patternDay ??
          null,

        moon:
          record.temporal?.moon ??
          null,

        moonDay:
          record.temporal?.moonDay ??
          null,

        week:
          record.temporal?.week ??
          null
      }
    };
  }

  function sphereProjection(records = []) {
    return records.map(record => ({
      ...recordSummary(record),

      marker: {
        layer: record.type,
        patternDay:
          record.temporal?.patternDay ??
          null,
        moon:
          record.temporal?.moon ??
          null,
        moonDay:
          record.temporal?.moonDay ??
          null,

        hasLocation:
          Number.isFinite(
            record.spatial?.latitude
          ) &&
          Number.isFinite(
            record.spatial?.longitude
          )
      }
    }));
  }

  function calendarProjection(records = []) {
    const days = new Map();

    for (const record of records) {
      const key =
        record.temporal?.civilDate ||
        (
          record.temporal?.patternYear &&
          record.temporal?.patternDay
            ? `${record.temporal.patternYear}:${record.temporal.patternDay}`
            : null
        );

      if (!key) continue;

      if (!days.has(key)) {
        days.set(key, {
          key,
          civilDate:
            record.temporal?.civilDate ||
            null,
          patternYear:
            record.temporal?.patternYear ??
            null,
          patternDay:
            record.temporal?.patternDay ??
            null,
          moon:
            record.temporal?.moon ??
            null,
          moonDay:
            record.temporal?.moonDay ??
            null,
          count: 0,
          types: {},
          records: []
        });
      }

      const day = days.get(key);

      day.count += 1;
      day.types[record.type] =
        (day.types[record.type] || 0) + 1;

      day.records.push(
        recordSummary(record)
      );
    }

    return [...days.values()];
  }

  function timelineProjection(records = []) {
    return sortTemporal(records)
      .map(record => ({
        ...recordSummary(record),

        instant:
          record.temporal?.instant ||
          record.temporal?.start ||
          (
            record.temporal?.civilDate
              ? `${record.temporal.civilDate}T12:00:00Z`
              : null
          ),

        end:
          record.temporal?.end ||
          null
      }));
  }

  function mapProjection(records = []) {
    return records
      .filter(record =>
        Number.isFinite(
          record.spatial?.latitude
        ) &&
        Number.isFinite(
          record.spatial?.longitude
        )
      )
      .map(record => ({
        ...recordSummary(record),

        location: {
          latitude:
            record.spatial.latitude,

          longitude:
            record.spatial.longitude,

          altitude:
            record.spatial.altitude ??
            null,

          placeId:
            record.spatial.placeId ||
            null,

          placeLabel:
            record.spatial.placeLabel ||
            null,

          precision:
            record.spatial.precision ||
            "unknown"
        }
      }));
  }

  function ledgerProjection(records = []) {
    return sortTemporal(records)
      .map(record => ({
        ...recordSummary(record),

        provenance:
          clone(
            record.provenance || {}
          ),

        payload:
          clone(
            record.payload || {}
          )
      }));
  }

  function networkProjection(
    records = [],
    relations = []
  ) {
    const ids = new Set(
      records.map(record => record.id)
    );

    return {
      nodes:
        records.map(record =>
          recordSummary(record)
        ),

      edges:
        relations
          .filter(edge =>
            ids.has(edge.fromId) &&
            ids.has(edge.toId)
          )
          .map(edge => ({
            id: edge.id,
            fromId: edge.fromId,
            toId: edge.toId,
            type: edge.type,
            direction:
              edge.direction ||
              "directed"
          }))
    };
  }

  function project(
    name,
    records = [],
    options = {}
  ) {
    if (!PROJECTIONS.includes(name)) {
      throw new Error(
        `Unknown Life Atlas projection: ${name}`
      );
    }

    switch (name) {
      case "sphere":
        return sphereProjection(records);

      case "calendar":
        return calendarProjection(records);

      case "timeline":
        return timelineProjection(records);

      case "map":
        return mapProjection(records);

      case "ledger":
        return ledgerProjection(records);

      case "network":
        return networkProjection(
          records,
          options.relations || []
        );

      default:
        return [];
    }
  }

  return Object.freeze({
    PROJECTIONS,

    recordSummary,
    sphereProjection,
    calendarProjection,
    timelineProjection,
    mapProjection,
    ledgerProjection,
    networkProjection,
    project
  });
});
