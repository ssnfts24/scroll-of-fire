/**
 * Codex Life Atlas
 * Shared query and connected-record engine.
 *
 * This layer sits above repositories and below visual projections.
 */
(function (root, factory) {
  let Repository = root.CodexLifeAtlasRepository;
  let Relations = root.CodexLifeAtlasRelations;

  if (typeof module === "object" && module.exports) {
    Repository = require("./life-atlas-repository.js");
    Relations = require("./life-atlas-relations.js");
    module.exports = factory(Repository, Relations);
    return;
  }

  root.CodexLifeAtlasQuery = factory(
    Repository,
    Relations
  );
})(typeof globalThis !== "undefined" ? globalThis : this, function (
  Repository,
  Relations
) {
  "use strict";

  if (!Repository) {
    throw new Error(
      "CodexLifeAtlasRepository is required."
    );
  }

  if (!Relations) {
    throw new Error(
      "CodexLifeAtlasRelations is required."
    );
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function cleanString(value) {
    if (value === null || value === undefined) {
      return "";
    }

    return String(value).trim();
  }

  function nullableNumber(value) {
    if (
      value === null ||
      value === undefined ||
      value === ""
    ) {
      return null;
    }

    const number = Number(value);

    return Number.isFinite(number)
      ? number
      : null;
  }

  function normalizeTemporalSelection(input = {}) {
    const source =
      input && typeof input === "object"
        ? input
        : {};

    return {
      civilDate:
        cleanString(
          source.civilDate ||
          source.date
        ) || null,

      patternYear:
        nullableNumber(
          source.patternYear
        ),

      patternDay:
        nullableNumber(
          source.patternDay ??
          source.dayOfPatternYear
        ),

      moon:
        nullableNumber(
          source.moon
        ),

      moonDay:
        nullableNumber(
          source.moonDay ??
          source.day
        ),

      week:
        nullableNumber(
          source.week
        )
    };
  }

  function temporalCriteria(selection = {}) {
    const normalized =
      normalizeTemporalSelection(selection);

    const criteria = {};

    for (const key of [
      "civilDate",
      "patternYear",
      "patternDay",
      "moon",
      "moonDay",
      "week"
    ]) {
      if (
        normalized[key] !== null &&
        normalized[key] !== ""
      ) {
        criteria[key] =
          normalized[key];
      }
    }

    return criteria;
  }

  async function recordsForTemporalSelection(
    repository,
    selection = {}
  ) {
    if (
      !repository ||
      typeof repository.query !== "function"
    ) {
      throw new TypeError(
        "A Life Atlas repository is required."
      );
    }

    return repository.query(
      temporalCriteria(selection)
    );
  }

  async function recordsForEntity(
    repository,
    graph,
    recordId
  ) {
    const id = cleanString(recordId);

    if (!id) return [];

    const rootRecord =
      await repository.get(id);

    if (!rootRecord) return [];

    const edges =
      await graph.forRecord(id);

    const connectedIds =
      new Set();

    for (const edge of edges) {
      if (edge.fromId === id) {
        connectedIds.add(edge.toId);
      }

      if (edge.toId === id) {
        connectedIds.add(edge.fromId);
      }
    }

    const connected = [];

    for (const connectedId of connectedIds) {
      const record =
        await repository.get(connectedId);

      if (record) {
        connected.push(record);
      }
    }

    return connected;
  }

  async function connectedContext(
    repository,
    graph,
    recordId,
    options = {}
  ) {
    const id = cleanString(recordId);

    if (!id) {
      return {
        root: null,
        edges: [],
        records: []
      };
    }

    const root =
      await repository.get(id);

    if (!root) {
      return {
        root: null,
        edges: [],
        records: []
      };
    }

    const edges =
      await graph.forRecord(id);

    const relatedIds = new Set();

    for (const edge of edges) {
      if (edge.fromId === id) {
        relatedIds.add(edge.toId);
      }

      if (edge.toId === id) {
        relatedIds.add(edge.fromId);
      }
    }

    const records = [];

    for (const relatedId of relatedIds) {
      const record =
        await repository.get(relatedId);

      if (!record) continue;

      if (
        options.type &&
        record.type !== options.type
      ) {
        continue;
      }

      records.push(record);
    }

    return {
      root: clone(root),
      edges: clone(edges),
      records: clone(records)
    };
  }

  async function recordsForRange(
    repository,
    startDate,
    endDate
  ) {
    const start =
      Date.parse(startDate);

    const end =
      Date.parse(endDate);

    if (
      !Number.isFinite(start) ||
      !Number.isFinite(end)
    ) {
      return [];
    }

    const lower =
      Math.min(start, end);

    const upper =
      Math.max(start, end);

    const records =
      await repository.all();

    return records.filter(record => {
      const candidate =
        Date.parse(
          record.temporal.instant ||
          record.temporal.start ||
          (
            record.temporal.civilDate
              ? `${record.temporal.civilDate}T12:00:00Z`
              : ""
          )
        );

      return (
        Number.isFinite(candidate) &&
        candidate >= lower &&
        candidate <= upper
      );
    });
  }

  async function samePatternCoordinate(
    repository,
    selection = {}
  ) {
    const normalized =
      normalizeTemporalSelection(selection);

    if (
      normalized.moon === null ||
      normalized.moonDay === null
    ) {
      return [];
    }

    return repository.query({
      moon: normalized.moon,
      moonDay: normalized.moonDay
    });
  }

  async function samePatternDay(
    repository,
    patternDay
  ) {
    const day =
      Number(patternDay);

    if (!Number.isFinite(day)) {
      return [];
    }

    return repository.query({
      patternDay: day
    });
  }

  async function search(
    repository,
    text,
    options = {}
  ) {
    const queryText =
      cleanString(text);

    if (!queryText) {
      return [];
    }

    const criteria = {
      text: queryText
    };

    if (options.type) {
      criteria.type = options.type;
    }

    if (options.tag) {
      criteria.tag = options.tag;
    }

    if (options.visibility) {
      criteria.visibility =
        options.visibility;
    }

    return repository.query(criteria);
  }

  function createQueryEngine({
    repository,
    relations
  } = {}) {
    if (
      !repository ||
      typeof repository.query !== "function"
    ) {
      throw new TypeError(
        "createQueryEngine requires repository."
      );
    }

    if (
      !relations ||
      typeof relations.forRecord !== "function"
    ) {
      throw new TypeError(
        "createQueryEngine requires relation repository."
      );
    }

    return Object.freeze({
      repository,
      relations,

      forTemporalSelection(selection) {
        return recordsForTemporalSelection(
          repository,
          selection
        );
      },

      forEntity(recordId) {
        return recordsForEntity(
          repository,
          relations,
          recordId
        );
      },

      connected(recordId, options) {
        return connectedContext(
          repository,
          relations,
          recordId,
          options
        );
      },

      forRange(startDate, endDate) {
        return recordsForRange(
          repository,
          startDate,
          endDate
        );
      },

      samePatternCoordinate(selection) {
        return samePatternCoordinate(
          repository,
          selection
        );
      },

      samePatternDay(patternDay) {
        return samePatternDay(
          repository,
          patternDay
        );
      },

      search(text, options) {
        return search(
          repository,
          text,
          options
        );
      }
    });
  }

  return Object.freeze({
    normalizeTemporalSelection,
    temporalCriteria,

    recordsForTemporalSelection,
    recordsForEntity,
    connectedContext,
    recordsForRange,
    samePatternCoordinate,
    samePatternDay,
    search,

    createQueryEngine
  });
});
