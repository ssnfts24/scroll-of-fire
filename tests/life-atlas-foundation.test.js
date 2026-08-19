const test = require("node:test");
const assert = require("node:assert/strict");

const LifeAtlas = require(
  "../docs/assets/js/life-atlas/life-atlas-schema.js"
);

test("Life Atlas schema exports canonical version", () => {
  assert.equal(LifeAtlas.SCHEMA_VERSION, "1.0.0");
});

test("creates a normalized private LifeRecord", () => {
  const record = LifeAtlas.createLifeRecord({
    type: "witness",
    title: "Stone Witness",
    tags: ["moon-4", "witness", "moon-4"],
    temporal: {
      moon: 4,
      moonDay: 14,
      week: 2
    }
  });

  assert.ok(record.id);
  assert.equal(record.type, "witness");
  assert.equal(record.title, "Stone Witness");

  assert.deepEqual(
    record.tags,
    ["moon-4", "witness"]
  );

  assert.equal(record.temporal.moon, 4);
  assert.equal(record.temporal.moonDay, 14);
  assert.equal(record.temporal.week, 2);

  assert.equal(record.privacy.visibility, "private");
  assert.equal(record.privacy.shareAllowed, false);
});

test("invalid coordinates are not retained", () => {
  const record = LifeAtlas.createLifeRecord({
    type: "place",
    spatial: {
      latitude: 120,
      longitude: -300
    }
  });

  assert.equal(record.spatial.latitude, null);
  assert.equal(record.spatial.longitude, null);
});

test("public personal records require explicit sharing permission", () => {
  assert.throws(
    () =>
      LifeAtlas.createLifeRecord({
        type: "person",
        privacy: {
          visibility: "public",
          containsPersonalData: true,
          shareAllowed: false
        }
      }),
    /explicit shareAllowed/
  );
});

test("relation strings normalize into canonical relations", () => {
  const record = LifeAtlas.createLifeRecord({
    type: "event",
    relations: ["project:scroll-of-fire"]
  });

  assert.equal(record.relations.length, 1);
  assert.equal(
    record.relations[0].targetId,
    "project:scroll-of-fire"
  );

  assert.equal(
    record.relations[0].type,
    "related"
  );
});

test("payload remains extensible without contaminating core schema", () => {
  const record = LifeAtlas.createLifeRecord({
    type: "artifact",
    payload: {
      artifactId: "T7-000",
      experimentalField: {
        value: 963
      }
    }
  });

  assert.equal(record.payload.artifactId, "T7-000");
  assert.equal(
    record.payload.experimentalField.value,
    963
  );
});

const Repository = require(
  "../docs/assets/js/life-atlas/life-atlas-repository.js"
);

test("repository stores and retrieves canonical records", async () => {
  const repository = Repository.createRepository();

  const saved = await repository.put({
    id: "witness:stone-1",
    type: "witness",
    title: "Stone Witness",
    temporal: {
      moon: 4,
      moonDay: 14
    }
  });

  const loaded = await repository.get(saved.id);

  assert.equal(loaded.id, "witness:stone-1");
  assert.equal(loaded.type, "witness");
  assert.equal(loaded.temporal.moon, 4);
  assert.equal(await repository.count(), 1);
});

test("repository queries canonical temporal coordinates", async () => {
  const repository = Repository.createRepository();

  await repository.put({
    id: "record:a",
    type: "journal",
    title: "Moon Four record",
    temporal: {
      moon: 4,
      moonDay: 14
    }
  });

  await repository.put({
    id: "record:b",
    type: "journal",
    title: "Moon Five record",
    temporal: {
      moon: 5,
      moonDay: 1
    }
  });

  const results = await repository.query({
    moon: 4,
    moonDay: 14
  });

  assert.equal(results.length, 1);
  assert.equal(results[0].id, "record:a");
});

test("repository searches title summary and tags", async () => {
  const repository = Repository.createRepository();

  await repository.put({
    id: "artifact:t7",
    type: "artifact",
    title: "T7 Artifact",
    summary: "Experimental Codex artifact",
    tags: ["963", "artifact"]
  });

  const results = await repository.query({
    text: "963"
  });

  assert.equal(results.length, 1);
  assert.equal(results[0].id, "artifact:t7");
});

test("repository returns clones instead of mutable internal state", async () => {
  const repository = Repository.createRepository();

  await repository.put({
    id: "record:immutable",
    type: "note",
    title: "Original"
  });

  const loaded = await repository.get("record:immutable");
  loaded.title = "Mutated";

  const loadedAgain =
    await repository.get("record:immutable");

  assert.equal(loadedAgain.title, "Original");
});

test("repository import isolates rejected records", async () => {
  const repository = Repository.createRepository();

  const result = await repository.importRecords([
    {
      id: "record:valid",
      type: "note",
      title: "Valid"
    },
    {
      id: "record:private-safe",
      type: "person",
      privacy: {
        visibility: "private",
        containsPersonalData: true
      }
    },
    {
      id: "record:unsafe-public",
      type: "person",
      privacy: {
        visibility: "public",
        containsPersonalData: true,
        shareAllowed: false
      }
    }
  ]);

  assert.equal(result.imported.length, 2);
  assert.equal(result.rejected.length, 1);
  assert.equal(await repository.count(), 2);
});

test("repository supports removal without affecting unrelated records", async () => {
  const repository = Repository.createRepository();

  await repository.put({
    id: "record:one",
    type: "note"
  });

  await repository.put({
    id: "record:two",
    type: "note"
  });

  assert.equal(
    await repository.remove("record:one"),
    true
  );

  assert.equal(
    await repository.get("record:one"),
    null
  );

  assert.ok(
    await repository.get("record:two")
  );

  assert.equal(await repository.count(), 1);
});

const Relations = require(
  "../docs/assets/js/life-atlas/life-atlas-relations.js"
);

test("creates a canonical directed relation", () => {
  const relation = Relations.createRelation({
    fromId: "project:scroll-of-fire",
    toId: "artifact:t7",
    type: "created"
  });

  assert.ok(relation.id);

  assert.equal(
    relation.fromId,
    "project:scroll-of-fire"
  );

  assert.equal(
    relation.toId,
    "artifact:t7"
  );

  assert.equal(
    relation.type,
    "created"
  );

  assert.equal(
    relation.direction,
    "directed"
  );
});

test("relations reject self-connections", () => {
  assert.throws(
    () =>
      Relations.createRelation({
        fromId: "record:a",
        toId: "record:a",
        type: "related-to"
      }),
    /cannot connect a record to itself/
  );
});

test("relation repository deduplicates identical edges", async () => {
  const repository =
    Relations.createRelationRepository();

  const first = await repository.put({
    id: "relation:first",
    fromId: "project:scroll",
    toId: "artifact:t7",
    type: "created"
  });

  const second = await repository.put({
    id: "relation:second",
    fromId: "project:scroll",
    toId: "artifact:t7",
    type: "created"
  });

  assert.equal(
    first.id,
    "relation:first"
  );

  assert.equal(
    second.id,
    "relation:first"
  );

  assert.equal(
    await repository.count(),
    1
  );
});

test("bidirectional relations deduplicate reversed endpoints", async () => {
  const repository =
    Relations.createRelationRepository();

  const first = await repository.put({
    id: "relation:one",
    fromId: "person:aaron",
    toId: "project:scroll",
    type: "related-to",
    direction: "bidirectional"
  });

  const second = await repository.put({
    id: "relation:two",
    fromId: "project:scroll",
    toId: "person:aaron",
    type: "related-to",
    direction: "bidirectional"
  });

  assert.equal(
    first.id,
    second.id
  );

  assert.equal(
    await repository.count(),
    1
  );
});

test("relation repository finds every edge touching a record", async () => {
  const repository =
    Relations.createRelationRepository();

  await repository.put({
    fromId: "project:scroll",
    toId: "artifact:t7",
    type: "created"
  });

  await repository.put({
    fromId: "person:aaron",
    toId: "project:scroll",
    type: "involves"
  });

  const results =
    await repository.forRecord("project:scroll");

  assert.equal(
    results.length,
    2
  );
});

test("relation repository removes graph edges for deleted records", async () => {
  const repository =
    Relations.createRelationRepository();

  await repository.put({
    fromId: "project:scroll",
    toId: "artifact:t7",
    type: "created"
  });

  await repository.put({
    fromId: "artifact:t7",
    toId: "place:workbench",
    type: "occurred-at"
  });

  await repository.put({
    fromId: "person:someone",
    toId: "place:other",
    type: "occurred-at"
  });

  const removed =
    await repository.removeForRecord("artifact:t7");

  assert.equal(
    removed,
    2
  );

  assert.equal(
    await repository.count(),
    1
  );
});

test("Life Atlas reconstructs a connected life moment from canonical records", async () => {
  const repository = Repository.createRepository();
  const graph = Relations.createRelationRepository();

  const temporal = {
    civilDate: "2026-08-16",
    patternYear: 2026,
    moon: 5,
    moonDay: 10,
    patternDay: 122,
    week: 2,
    weekGate: null,
    timezone: "America/Los_Angeles",
    boundaryMode: "sunset"
  };

  const records = [
    LifeAtlas.createLifeRecord({
      id: "project:scroll-of-fire",
      type: "project",
      title: "Scroll of Fire / Codex of Reality",
      temporal,
      tags: ["codex", "life-atlas"],
      payload: {
        status: "active"
      }
    }),

    LifeAtlas.createLifeRecord({
      id: "artifact:t7",
      type: "artifact",
      title: "T7 Artifact",
      temporal,
      tags: ["artifact", "created"],
      payload: {
        artifactId: "T7-000"
      }
    }),

    LifeAtlas.createLifeRecord({
      id: "witness:atlas-foundation",
      type: "witness",
      title: "Life Atlas Foundation Witness",
      temporal,
      tags: ["witness", "development"],
      payload: {
        note: "Canonical Life Atlas foundation became operational."
      }
    }),

    LifeAtlas.createLifeRecord({
      id: "place:workbench",
      type: "place",
      title: "Workbench",
      temporal,
      spatial: {
        placeId: "place:workbench",
        placeLabel: "Workbench",
        precision: "label"
      },
      tags: ["place"]
    }),

    LifeAtlas.createLifeRecord({
      id: "event:atlas-foundation",
      type: "event",
      title: "Life Atlas Foundation Development",
      temporal,
      tags: ["development", "life-atlas"]
    })
  ];

  for (const record of records) {
    await repository.put(record);
  }

  await graph.put({
    fromId: "event:atlas-foundation",
    toId: "project:scroll-of-fire",
    type: "part-of"
  });

  await graph.put({
    fromId: "event:atlas-foundation",
    toId: "artifact:t7",
    type: "involves"
  });

  await graph.put({
    fromId: "event:atlas-foundation",
    toId: "witness:atlas-foundation",
    type: "involves"
  });

  await graph.put({
    fromId: "event:atlas-foundation",
    toId: "place:workbench",
    type: "occurred-at"
  });

  const dayRecords = await repository.query({
    civilDate: "2026-08-16"
  });

  assert.equal(dayRecords.length, 5);

  const event = await repository.get(
    "event:atlas-foundation"
  );

  assert.ok(event);

  const edges = await graph.forRecord(event.id);

  assert.equal(edges.length, 4);

  const connectedIds = edges.map(edge =>
    edge.fromId === event.id
      ? edge.toId
      : edge.fromId
  );

  const connectedRecords = [];

  for (const id of connectedIds) {
    const record = await repository.get(id);

    if (record) {
      connectedRecords.push(record);
    }
  }

  assert.equal(connectedRecords.length, 4);

  const connectedTypes = connectedRecords
    .map(record => record.type)
    .sort();

  assert.deepEqual(
    connectedTypes,
    [
      "artifact",
      "place",
      "project",
      "witness"
    ]
  );

  assert.ok(
    connectedRecords.some(
      record =>
        record.id === "project:scroll-of-fire"
    )
  );

  assert.ok(
    connectedRecords.some(
      record =>
        record.id === "artifact:t7"
    )
  );

  assert.ok(
    connectedRecords.some(
      record =>
        record.id === "witness:atlas-foundation"
    )
  );

  assert.ok(
    connectedRecords.some(
      record =>
        record.id === "place:workbench"
    )
  );
});

test("the same canonical life moment can be projected by temporal coordinate", async () => {
  const repository = Repository.createRepository();

  const sharedTemporal = {
    civilDate: "2026-08-16",
    patternYear: 2026,
    moon: 5,
    moonDay: 10,
    patternDay: 122,
    week: 2,
    timezone: "America/Los_Angeles",
    boundaryMode: "sunset"
  };

  await repository.put(
    LifeAtlas.createLifeRecord({
      id: "event:one",
      type: "event",
      title: "First Event",
      temporal: sharedTemporal
    })
  );

  await repository.put(
    LifeAtlas.createLifeRecord({
      id: "witness:one",
      type: "witness",
      title: "First Witness",
      temporal: sharedTemporal
    })
  );

  await repository.put(
    LifeAtlas.createLifeRecord({
      id: "artifact:other-day",
      type: "artifact",
      title: "Other Day",
      temporal: {
        ...sharedTemporal,
        civilDate: "2026-08-17",
        moonDay: 11,
        patternDay: 123
      }
    })
  );

  const byCivilDay = await repository.query({
    civilDate: "2026-08-16"
  });

  assert.equal(byCivilDay.length, 2);

  const byMoonDay = await repository.query({
    moon: 5,
    moonDay: 10
  });

  assert.equal(byMoonDay.length, 2);

  const byPatternDay = await repository.query({
    patternDay: 122
  });

  assert.equal(byPatternDay.length, 2);

  assert.deepEqual(
    byCivilDay
      .map(record => record.id)
      .sort(),
    byMoonDay
      .map(record => record.id)
      .sort()
  );
});

test("repository filters civilDate patternDay and week independently", async () => {
  const repository = Repository.createRepository();

  await repository.put({
    id: "record:target",
    type: "event",
    temporal: {
      civilDate: "2026-08-16",
      patternYear: 2026,
      moon: 5,
      moonDay: 10,
      patternDay: 122,
      week: 2
    }
  });

  await repository.put({
    id: "record:other",
    type: "event",
    temporal: {
      civilDate: "2026-08-17",
      patternYear: 2026,
      moon: 5,
      moonDay: 11,
      patternDay: 123,
      week: 2
    }
  });

  assert.equal(
    (await repository.query({
      civilDate: "2026-08-16"
    })).length,
    1
  );

  assert.equal(
    (await repository.query({
      patternDay: 122
    })).length,
    1
  );

  assert.equal(
    (await repository.query({
      week: 2
    })).length,
    2
  );
});

const Query = require(
  "../docs/assets/js/life-atlas/life-atlas-query.js"
);

const Projections = require(
  "../docs/assets/js/life-atlas/life-atlas-projections.js"
);

test("query engine resolves records for one temporal selection", async () => {
  const repository =
    Repository.createRepository();

  const relations =
    Relations.createRelationRepository();

  const engine =
    Query.createQueryEngine({
      repository,
      relations
    });

  await repository.put({
    id: "event:selected-day",
    type: "event",
    temporal: {
      civilDate: "2026-08-16",
      patternYear: 2026,
      moon: 5,
      moonDay: 10,
      patternDay: 122
    }
  });

  await repository.put({
    id: "event:other-day",
    type: "event",
    temporal: {
      civilDate: "2026-08-17",
      patternYear: 2026,
      moon: 5,
      moonDay: 11,
      patternDay: 123
    }
  });

  const records =
    await engine.forTemporalSelection({
      civilDate: "2026-08-16"
    });

  assert.equal(records.length, 1);

  assert.equal(
    records[0].id,
    "event:selected-day"
  );
});

test("query engine reconstructs connected context", async () => {
  const repository =
    Repository.createRepository();

  const relations =
    Relations.createRelationRepository();

  const engine =
    Query.createQueryEngine({
      repository,
      relations
    });

  await repository.put({
    id: "project:scroll",
    type: "project",
    title: "Scroll"
  });

  await repository.put({
    id: "artifact:t7",
    type: "artifact",
    title: "T7"
  });

  await relations.put({
    fromId: "project:scroll",
    toId: "artifact:t7",
    type: "created"
  });

  const context =
    await engine.connected(
      "project:scroll"
    );

  assert.equal(
    context.root.id,
    "project:scroll"
  );

  assert.equal(
    context.edges.length,
    1
  );

  assert.equal(
    context.records.length,
    1
  );

  assert.equal(
    context.records[0].id,
    "artifact:t7"
  );
});

test("same Pattern coordinate can return records across years", async () => {
  const repository =
    Repository.createRepository();

  const relations =
    Relations.createRelationRepository();

  const engine =
    Query.createQueryEngine({
      repository,
      relations
    });

  await repository.put({
    id: "event:2025",
    type: "event",
    temporal: {
      patternYear: 2025,
      moon: 5,
      moonDay: 10
    }
  });

  await repository.put({
    id: "event:2026",
    type: "event",
    temporal: {
      patternYear: 2026,
      moon: 5,
      moonDay: 10
    }
  });

  const records =
    await engine.samePatternCoordinate({
      moon: 5,
      moonDay: 10
    });

  assert.equal(records.length, 2);
});

test("calendar projection groups multiple records into one day", () => {
  const records = [
    LifeAtlas.createLifeRecord({
      id: "event:day",
      type: "event",
      temporal: {
        civilDate: "2026-08-16",
        patternDay: 122,
        moon: 5,
        moonDay: 10
      }
    }),

    LifeAtlas.createLifeRecord({
      id: "witness:day",
      type: "witness",
      temporal: {
        civilDate: "2026-08-16",
        patternDay: 122,
        moon: 5,
        moonDay: 10
      }
    })
  ];

  const days =
    Projections.calendarProjection(
      records
    );

  assert.equal(days.length, 1);
  assert.equal(days[0].count, 2);
  assert.equal(days[0].types.event, 1);
  assert.equal(days[0].types.witness, 1);
});

test("timeline projection orders records by time", () => {
  const records = [
    LifeAtlas.createLifeRecord({
      id: "event:later",
      type: "event",
      temporal: {
        instant:
          "2026-08-16T20:00:00Z"
      }
    }),

    LifeAtlas.createLifeRecord({
      id: "event:earlier",
      type: "event",
      temporal: {
        instant:
          "2026-08-16T18:00:00Z"
      }
    })
  ];

  const timeline =
    Projections.timelineProjection(
      records
    );

  assert.equal(
    timeline[0].id,
    "event:earlier"
  );

  assert.equal(
    timeline[1].id,
    "event:later"
  );
});

test("map projection includes only spatial records", () => {
  const records = [
    LifeAtlas.createLifeRecord({
      id: "place:located",
      type: "place",
      spatial: {
        latitude: 47.6,
        longitude: -122.3,
        precision: "exact"
      }
    }),

    LifeAtlas.createLifeRecord({
      id: "note:no-location",
      type: "note"
    })
  ];

  const map =
    Projections.mapProjection(
      records
    );

  assert.equal(map.length, 1);

  assert.equal(
    map[0].id,
    "place:located"
  );
});

test("network projection preserves canonical relation edges", () => {
  const records = [
    LifeAtlas.createLifeRecord({
      id: "project:scroll",
      type: "project"
    }),

    LifeAtlas.createLifeRecord({
      id: "artifact:t7",
      type: "artifact"
    })
  ];

  const relation =
    Relations.createRelation({
      id: "relation:created",
      fromId: "project:scroll",
      toId: "artifact:t7",
      type: "created"
    });

  const network =
    Projections.networkProjection(
      records,
      [relation]
    );

  assert.equal(
    network.nodes.length,
    2
  );

  assert.equal(
    network.edges.length,
    1
  );

  assert.equal(
    network.edges[0].type,
    "created"
  );
});

const TemporalBridge = require(
  "../docs/assets/js/life-atlas/life-atlas-temporal-bridge.js"
);

test("temporal bridge converts cursor coordinate into Life Atlas selection", () => {
  const selection =
    TemporalBridge.coordinateSelection(
      {
        remnant13Moons: {
          patternYear: 2026,
          patternDay: 122,
          moon: 5,
          moonDay: 10,
          week: 2,
          civilDate: "2026-08-16"
        }
      }
    );

  assert.equal(
    selection.civilDate,
    "2026-08-16"
  );

  assert.equal(
    selection.patternYear,
    2026
  );

  assert.equal(
    selection.patternDay,
    122
  );

  assert.equal(selection.moon, 5);
  assert.equal(selection.moonDay, 10);
  assert.equal(selection.week, 2);
});

test("temporal bridge reads existing SOF cursor contract", () => {
  const cursor = {
    getState() {
      return {
        source: "test",
        revision: 7
      };
    },

    getDate() {
      return new Date(
        "2026-08-16T12:00:00Z"
      );
    },

    getCoordinate() {
      return {
        remnant13Moons: {
          patternYear: 2026,
          patternDay: 122,
          moon: 5,
          moonDay: 10
        }
      };
    }
  };

  const snapshot =
    TemporalBridge.cursorSnapshot(
      cursor
    );

  assert.equal(
    snapshot.selection.civilDate,
    "2026-08-16"
  );

  assert.equal(
    snapshot.selection.patternDay,
    122
  );

  assert.equal(
    snapshot.state.revision,
    7
  );
});

test("temporal bridge queries canonical records for selected cursor coordinate", async () => {
  const repository =
    Repository.createRepository();

  const relations =
    Relations.createRelationRepository();

  await repository.put({
    id: "witness:selected",
    type: "witness",
    title: "Selected witness",
    temporal: {
      civilDate: "2026-08-16",
      patternYear: 2026,
      patternDay: 122,
      moon: 5,
      moonDay: 10,
      week: 2
    }
  });

  await repository.put({
    id: "witness:other",
    type: "witness",
    title: "Other witness",
    temporal: {
      civilDate: "2026-08-17",
      patternYear: 2026,
      patternDay: 123,
      moon: 5,
      moonDay: 11,
      week: 2
    }
  });

  const cursor = {
    getState() {
      return {
        revision: 1
      };
    },

    getDate() {
      return new Date(
        "2026-08-16T12:00:00Z"
      );
    },

    getCoordinate() {
      return {
        remnant13Moons: {
          civilDate: "2026-08-16",
          patternYear: 2026,
          patternDay: 122,
          moon: 5,
          moonDay: 10,
          week: 2
        }
      };
    }
  };

  const bridge =
    TemporalBridge.createTemporalBridge({
      repository,
      relations,
      cursor
    });

  const context =
    await bridge.context();

  assert.equal(
    context.records.length,
    1
  );

  assert.equal(
    context.records[0].id,
    "witness:selected"
  );
});

test("temporal bridge projects selected records without owning renderer state", async () => {
  const repository =
    Repository.createRepository();

  const relations =
    Relations.createRelationRepository();

  await repository.put({
    id: "event:selected",
    type: "event",
    temporal: {
      civilDate: "2026-08-16",
      patternYear: 2026,
      patternDay: 122,
      moon: 5,
      moonDay: 10,
      week: 2
    }
  });

  await repository.put({
    id: "witness:selected",
    type: "witness",
    temporal: {
      civilDate: "2026-08-16",
      patternYear: 2026,
      patternDay: 122,
      moon: 5,
      moonDay: 10,
      week: 2
    }
  });

  const cursor = {
    getState() {
      return {};
    },

    getDate() {
      return new Date(
        "2026-08-16T12:00:00Z"
      );
    },

    getCoordinate() {
      return {
        civilDate: "2026-08-16"
      };
    }
  };

  const bridge =
    TemporalBridge.createTemporalBridge({
      repository,
      relations,
      cursor
    });

  const result =
    await bridge.projection(
      "calendar"
    );

  assert.equal(
    result.records.length,
    2
  );

  assert.equal(
    result.projection.length,
    1
  );

  assert.equal(
    result.projection[0].count,
    2
  );
});

test("temporal bridge subscriber receives refreshed canonical context", async () => {
  const repository =
    Repository.createRepository();

  const relations =
    Relations.createRelationRepository();

  await repository.put({
    id: "event:refresh",
    type: "event",
    temporal: {
      civilDate: "2026-08-16",
      patternYear: 2026,
      patternDay: 122,
      moon: 5,
      moonDay: 10,
      week: 2
    }
  });

  const cursor = {
    getState() {
      return {};
    },

    getDate() {
      return new Date(
        "2026-08-16T12:00:00Z"
      );
    },

    getCoordinate() {
      return {
        civilDate: "2026-08-16"
      };
    }
  };

  const bridge =
    TemporalBridge.createTemporalBridge({
      repository,
      relations,
      cursor
    });

  let received = null;

  const unsubscribe =
    bridge.subscribe(detail => {
      received = detail;
    });

  const result =
    await bridge.refresh(
      "test-refresh"
    );

  assert.equal(
    result.reason,
    "test-refresh"
  );

  assert.equal(
    received.reason,
    "test-refresh"
  );

  assert.equal(
    received.context.records.length,
    1
  );

  unsubscribe();
});

test("temporal bridge start and stop use canonical cursor events", () => {
  const repository =
    Repository.createRepository();

  const relations =
    Relations.createRelationRepository();

  const added = [];
  const removed = [];

  const eventTarget = {
    addEventListener(name) {
      added.push(name);
    },

    removeEventListener(name) {
      removed.push(name);
    }
  };

  const cursor = {
    getState() {
      return {};
    },

    getDate() {
      return new Date(
        "2026-08-16T12:00:00Z"
      );
    },

    getCoordinate() {
      return {
        civilDate: "2026-08-16"
      };
    }
  };

  const bridge =
    TemporalBridge.createTemporalBridge({
      repository,
      relations,
      cursor,
      eventTarget
    });

  assert.equal(
    bridge.start(),
    true
  );

  assert.equal(
    bridge.isListening(),
    true
  );

  assert.deepEqual(
    added.sort(),
    [
      "sof:temporal-cursor-change",
      "sof:temporal-cursor-ready"
    ].sort()
  );

  assert.equal(
    bridge.stop(),
    true
  );

  assert.equal(
    bridge.isListening(),
    false
  );

  assert.deepEqual(
    removed.sort(),
    [
      "sof:temporal-cursor-change",
      "sof:temporal-cursor-ready"
    ].sort()
  );
});

test("temporal query normalization preserves missing numeric coordinates as null", () => {
  const once =
    Query.normalizeTemporalSelection({
      civilDate: "2026-08-16"
    });

  const twice =
    Query.normalizeTemporalSelection(
      once
    );

  assert.equal(
    twice.civilDate,
    "2026-08-16"
  );

  assert.equal(
    twice.patternYear,
    null
  );

  assert.equal(
    twice.patternDay,
    null
  );

  assert.equal(
    twice.moon,
    null
  );

  assert.equal(
    twice.moonDay,
    null
  );

  assert.equal(
    twice.week,
    null
  );

  assert.deepEqual(
    twice,
    once
  );
});

const IndexedDb = require(
  "../docs/assets/js/life-atlas/life-atlas-indexeddb.js"
);

test("Life Atlas IndexedDB exposes versioned local-first stores", () => {
  assert.equal(
    IndexedDb.DB_NAME,
    "codex-life-atlas"
  );

  assert.equal(
    IndexedDb.DB_VERSION,
    1
  );

  assert.deepEqual(
    IndexedDb.STORES,
    {
      records: "records",
      relations: "relations",
      media: "media",
      settings: "settings",
      migrations: "migrations"
    }
  );
});

test("Life Atlas IndexedDB capability detection is explicit", () => {
  assert.equal(
    IndexedDb.hasIndexedDb(null),
    false
  );

  assert.equal(
    IndexedDb.hasIndexedDb({}),
    false
  );

  assert.equal(
    IndexedDb.hasIndexedDb({
      open() {}
    }),
    true
  );
});

test("IndexedDB diagnostics degrade safely when storage is unavailable", async () => {
  const result =
    await IndexedDb.diagnostics({
      indexedDB: null
    });

  assert.equal(
    result.available,
    false
  );

  assert.equal(
    result.opened,
    false
  );

  assert.equal(
    result.error,
    null
  );
});

test("persistent repository creation requires IndexedDB adapter", () => {
  assert.throws(
    () =>
      Repository.createPersistentRepository({
        IndexedDb: null
      }),
    /IndexedDb adapter is required/
  );
});

test("persistent repository can be created with an IndexedDB-compatible adapter", async () => {
  const memory =
    Repository.createMemoryAdapter();

  const fakeIndexedDb = {
    createRecordAdapter() {
      return memory;
    }
  };

  const repository =
    Repository.createPersistentRepository({
      IndexedDb: fakeIndexedDb
    });

  await repository.put({
    id: "event:persistent-contract",
    type: "event",
    title: "Persistent contract"
  });

  assert.equal(
    await repository.count(),
    1
  );

  assert.equal(
    (
      await repository.get(
        "event:persistent-contract"
      )
    ).title,
    "Persistent contract"
  );
});

const Migrations = require(
  "../docs/assets/js/life-atlas/life-atlas-migrations.js"
);

test("Life Atlas migration policy never deletes legacy data", () => {
  assert.equal(
    Migrations.MIGRATION_POLICY
      .deleteLegacyData,
    false
  );

  assert.equal(
    Migrations.MIGRATION_POLICY
      .overwriteLegacyData,
    false
  );

  assert.equal(
    Migrations.MIGRATION_POLICY
      .requirePreviewBeforeImport,
    true
  );
});

test("migration storage reader safely detects legacy keys", () => {
  const values = new Map([
    [
      "sof.codexMemory.v1",
      JSON.stringify({
        version: 1
      })
    ]
  ]);

  const storage = {
    getItem(key) {
      return values.has(key)
        ? values.get(key)
        : null;
    }
  };

  const reader =
    Migrations.createStorageReader(
      storage
    );

  assert.equal(
    reader.available(),
    true
  );

  assert.equal(
    reader.has(
      "sof.codexMemory.v1"
    ),
    true
  );

  assert.equal(
    reader.has("missing"),
    false
  );

  assert.equal(
    reader.json(
      "sof.codexMemory.v1"
    ).value.version,
    1
  );
});

test("migration registry rejects incomplete adapters", () => {
  const registry =
    Migrations.createRegistry();

  assert.throws(
    () =>
      registry.register({
        id: "broken"
      }),
    /Invalid Life Atlas migration adapter/
  );
});

test("migration registry detects and previews canonical records", async () => {
  const registry =
    Migrations.createRegistry();

  registry.register({
    id: "test-source",
    label: "Test Source",

    detect() {
      return {
        detected: true,
        count: 1,
        sourceKeys: [
          "legacy:test"
        ]
      };
    },

    preview() {
      return {
        records: [
          {
            id:
              "legacy:test:1",
            type: "note",
            title:
              "Legacy Test",
            provenance: {
              sourceType:
                "legacy-localStorage",
              sourceId:
                "legacy:test"
            }
          }
        ]
      };
    }
  });

  const detected =
    await Migrations.detectAll(
      registry
    );

  assert.equal(
    detected.length,
    1
  );

  assert.equal(
    detected[0].detected,
    true
  );

  const preview =
    await Migrations.previewAdapter(
      registry.get(
        "test-source"
      )
    );

  assert.equal(
    preview.records.length,
    1
  );

  assert.equal(
    preview.records[0].id,
    "legacy:test:1"
  );
});

test("migration import preserves source data and verifies destination records", async () => {
  const repository =
    Repository.createRepository();

  const source =
    new Map([
      [
        "legacy:test",
        JSON.stringify({
          note: "preserve me"
        })
      ]
    ]);

  const preview = {
    id: "test-source",
    sourceKeys: [
      "legacy:test"
    ],

    records: [
      LifeAtlas.createLifeRecord({
        id:
          "legacy:test:record",
        type: "note",
        title:
          "Imported legacy record",
        provenance: {
          sourceType:
            "legacy-localStorage",
          sourceId:
            "legacy:test"
        }
      })
    ]
  };

  const before =
    source.get(
      "legacy:test"
    );

  const receipt =
    await Migrations.importPreview({
      preview,
      repository,
      migrationId:
        "migration:test"
    });

  const verification =
    await Migrations.verifyImport({
      receipt,
      repository
    });

  assert.equal(
    verification.verified,
    true
  );

  assert.equal(
    verification.checked,
    1
  );

  assert.equal(
    source.get(
      "legacy:test"
    ),
    before
  );

  assert.equal(
    receipt.policy
      .deleteLegacyData,
    false
  );
});

test("invalid migration records are isolated during preview", async () => {
  const adapter = {
    id: "mixed-source",
    label: "Mixed Source",

    detect() {
      return {
        detected: true
      };
    },

    preview() {
      return {
        records: [
          {
            id: "valid:1",
            type: "note"
          },

          {
            id: "unsafe:1",
            type: "person",
            privacy: {
              visibility:
                "public",
              containsPersonalData:
                true,
              shareAllowed:
                false
            }
          }
        ]
      };
    }
  };

  const preview =
    await Migrations.previewAdapter(
      adapter
    );

  assert.equal(
    preview.records.length,
    1
  );

  assert.equal(
    preview.rejected.length,
    1
  );
});

const Scheduling = require(
  "../docs/assets/js/life-atlas/life-atlas-scheduling.js"
);

test("Life Atlas scheduling exposes regular calendar capabilities", () => {
  assert.ok(
    Scheduling.SCHEDULE_KINDS.includes(
      "appointment"
    )
  );

  assert.ok(
    Scheduling.SCHEDULE_KINDS.includes(
      "task"
    )
  );

  assert.ok(
    Scheduling.SCHEDULE_KINDS.includes(
      "reminder"
    )
  );

  assert.ok(
    Scheduling.SCHEDULE_KINDS.includes(
      "deadline"
    )
  );

  assert.ok(
    Scheduling.SCHEDULE_KINDS.includes(
      "availability"
    )
  );
});

test("timed schedule normalizes start end timezone and reminders", () => {
  const schedule =
    Scheduling.createSchedule({
      kind: "appointment",
      status: "confirmed",
      priority: "high",

      start:
        "2026-08-17T18:00:00Z",

      end:
        "2026-08-17T19:30:00Z",

      timezone:
        "America/Los_Angeles",

      reminders: [
        {
          offsetMinutes: -60,
          method:
            "notification"
        },

        {
          offsetMinutes: -10,
          method:
            "sound"
        }
      ]
    });

  assert.equal(
    schedule.kind,
    "appointment"
  );

  assert.equal(
    schedule.status,
    "confirmed"
  );

  assert.equal(
    schedule.priority,
    "high"
  );

  assert.equal(
    schedule.reminders.length,
    2
  );
});

test("all-day schedules use civil date boundaries", () => {
  const schedule =
    Scheduling.createSchedule({
      kind: "deadline",
      allDay: true,
      startDate:
        "2026-08-20",
      endDate:
        "2026-08-20"
    });

  assert.equal(
    schedule.allDay,
    true
  );

  assert.equal(
    schedule.startDate,
    "2026-08-20"
  );

  assert.equal(
    schedule.start,
    null
  );
});

test("recurrence supports normal weekly calendar schedules", () => {
  const schedule =
    Scheduling.createSchedule({
      kind: "event",

      start:
        "2026-08-17T18:00:00Z",

      recurrence: {
        frequency:
          "weekly",
        interval: 1,
        byWeekday: [
          "MO",
          "WE",
          "FR",
          "MO"
        ]
      }
    });

  assert.equal(
    schedule.recurrence
      .frequency,
    "weekly"
  );

  assert.deepEqual(
    schedule.recurrence
      .byWeekday,
    [
      "MO",
      "WE",
      "FR"
    ]
  );
});

test("scheduled LifeRecord keeps schedule and canonical temporal fields together", () => {
  const record =
    Scheduling.attachSchedule(
      {
        id:
          "event:appointment-1",
        type: "event",
        title:
          "Calendar appointment"
      },

      {
        kind:
          "appointment",

        start:
          "2026-08-17T18:00:00Z",

        end:
          "2026-08-17T19:00:00Z",

        timezone:
          "America/Los_Angeles"
      }
    );

  assert.equal(
    record.subtype,
    "appointment"
  );

  assert.equal(
    record.temporal.start,
    "2026-08-17T18:00:00.000Z"
  );

  assert.equal(
    record.payload
      .schedule.kind,
    "appointment"
  );

  assert.equal(
    Scheduling.isScheduled(
      record
    ),
    true
  );
});

test("schedule validation rejects events without a usable date", () => {
  assert.throws(
    () =>
      Scheduling.createSchedule({
        kind: "event"
      }),
    /Timed schedules require start/
  );
});

test("schedule validation prevents end before start", () => {
  assert.throws(
    () =>
      Scheduling.createSchedule({
        kind: "event",

        start:
          "2026-08-17T20:00:00Z",

        end:
          "2026-08-17T19:00:00Z"
      }),
    /end cannot precede start/
  );
});

test("scheduled records support attendees and future external calendar sync metadata", () => {
  const record =
    Scheduling.attachSchedule(
      {
        id:
          "event:meeting-1",
        type: "event"
      },

      {
        kind: "appointment",

        start:
          "2026-08-17T18:00:00Z",

        attendees: [
          {
            id:
              "person:one",
            name:
              "Person One",
            role:
              "attendee"
          }
        ],

        external: {
          provider:
            "future-calendar-provider",

          calendarId:
            "primary",

          eventId:
            "external-123"
        }
      }
    );

  const schedule =
    Scheduling.getSchedule(
      record
    );

  assert.equal(
    schedule.attendees.length,
    1
  );

  assert.equal(
    schedule.external
      .calendarId,
    "primary"
  );

  assert.equal(
    schedule.external
      .eventId,
    "external-123"
  );
});

const WorldModel = require(
  "../docs/assets/js/life-atlas/life-atlas-world-model.js"
);

test("Temporal World Model defines recursive fly-through levels", () => {
  assert.deepEqual(
    WorldModel.LEVELS,
    [
      "global",
      "collective",
      "lifetime",
      "multi-year",
      "year",
      "moon",
      "week",
      "day",
      "hour",
      "event",
      "record"
    ]
  );
});

test("Temporal World Model navigates inward and outward", () => {
  assert.equal(
    WorldModel.childLevel("year"),
    "moon"
  );

  assert.equal(
    WorldModel.childLevel("moon"),
    "week"
  );

  assert.equal(
    WorldModel.childLevel("week"),
    "day"
  );

  assert.equal(
    WorldModel.childLevel("day"),
    "hour"
  );

  assert.equal(
    WorldModel.childLevel("hour"),
    "event"
  );

  assert.equal(
    WorldModel.childLevel("event"),
    "record"
  );

  assert.equal(
    WorldModel.parentLevel("day"),
    "week"
  );

  assert.equal(
    WorldModel.parentLevel("year"),
    "multi-year"
  );
});

test("multi-year field distributes years through three dimensional helix space", () => {
  const field =
    WorldModel.buildYearField({
      years: [
        2023,
        2024,
        2025,
        2026,
        2027,
        2028
      ],

      anchorYear: 2026
    });

  assert.equal(
    field.length,
    6
  );

  const current =
    field.find(
      node =>
        node.temporal
          .patternYear === 2026
    );

  const previous =
    field.find(
      node =>
        node.temporal
          .patternYear === 2025
    );

  assert.equal(
    current.metadata.isAnchor,
    true
  );

  assert.notDeepEqual(
    current.position,
    previous.position
  );

  assert.notEqual(
    current.position.y,
    previous.position.y
  );
});

test("year expands into thirteen Moon worlds", () => {
  const nodes =
    WorldModel.buildMoonField({
      year: 2026
    });

  assert.equal(
    nodes.length,
    13
  );

  assert.equal(
    nodes[0].level,
    "moon"
  );

  assert.equal(
    nodes[12].temporal.moon,
    13
  );
});

test("Moon expands into four week worlds", () => {
  const nodes =
    WorldModel.buildWeekField({
      year: 2026,
      moon: 5
    });

  assert.equal(
    nodes.length,
    4
  );

  assert.equal(
    nodes[0].temporal.week,
    1
  );

  assert.equal(
    nodes[3].temporal.week,
    4
  );
});

test("Moon expands into twenty eight Day worlds", () => {
  const nodes =
    WorldModel.buildDayField({
      year: 2026,
      moon: 5
    });

  assert.equal(
    nodes.length,
    28
  );

  assert.equal(
    nodes[0].temporal.patternDay,
    113
  );

  assert.equal(
    nodes[27].temporal.patternDay,
    140
  );

  assert.equal(
    nodes[27].temporal.week,
    4
  );
});

test("Day expands into twenty four Hour worlds", () => {
  const nodes =
    WorldModel.buildHourField({
      year: 2026,
      moon: 5,
      day: 10
    });

  assert.equal(
    nodes.length,
    24
  );

  assert.equal(
    nodes[0].temporal.hour,
    0
  );

  assert.equal(
    nodes[23].temporal.hour,
    23
  );
});

test("semantic zoom reveals deeper worlds as camera approaches", () => {
  assert.equal(
    WorldModel.semanticBand(30),
    "global"
  );

  assert.equal(
    WorldModel.semanticBand(20),
    "collective"
  );

  assert.equal(
    WorldModel.semanticBand(15),
    "lifetime"
  );

  assert.equal(
    WorldModel.semanticBand(10),
    "multi-year"
  );

  assert.equal(
    WorldModel.semanticBand(8),
    "year"
  );

  assert.equal(
    WorldModel.semanticBand(5),
    "moon"
  );

  assert.equal(
    WorldModel.semanticBand(3.5),
    "week"
  );

  assert.equal(
    WorldModel.semanticBand(2.5),
    "day"
  );

  assert.equal(
    WorldModel.semanticBand(1.6),
    "hour"
  );

  assert.equal(
    WorldModel.semanticBand(1),
    "event"
  );

  assert.equal(
    WorldModel.semanticBand(0.4),
    "record"
  );
});

test("events and records can occupy local three dimensional worlds", () => {
  const eventA =
    WorldModel.eventWorldPosition(
      0,
      3
    );

  const eventB =
    WorldModel.eventWorldPosition(
      1,
      3
    );

  assert.notDeepEqual(
    eventA,
    eventB
  );

  const recordA =
    WorldModel.recordWorldPosition(
      0,
      5,
      eventA
    );

  const recordB =
    WorldModel.recordWorldPosition(
      1,
      5,
      eventA
    );

  assert.notDeepEqual(
    recordA,
    recordB
  );

  assert.ok(
    WorldModel.distanceBetween(
      recordA,
      eventA
    ) > 0
  );
});

const WorldNavigation = require(
  "../docs/assets/js/life-atlas/life-atlas-world-navigation.js"
);

test("world navigation starts at Year World", () => {
  const navigation =
    WorldNavigation.createNavigation();

  assert.equal(
    navigation.getLevel(),
    "year"
  );

  assert.equal(
    navigation.getState().flight.active,
    false
  );
});

test("world navigation focuses canonical spatial nodes", () => {
  const navigation =
    WorldNavigation.createNavigation();

  const node =
    WorldModel.createWorldNode({
      id: "year:2026:moon:5",
      level: "moon",
      position: {
        x: 2,
        y: 1,
        z: -3
      },
      temporal: {
        patternYear: 2026,
        moon: 5
      }
    });

  navigation.setFocus(node);

  assert.equal(
    navigation.getLevel(),
    "moon"
  );

  assert.equal(
    navigation.getFocus().id,
    node.id
  );

  assert.deepEqual(
    navigation.getCamera().target,
    node.position
  );
});

test("world navigation maintains temporal breadcrumb path", () => {
  const navigation =
    WorldNavigation.createNavigation();

  const year =
    WorldModel.createWorldNode({
      id: "year:2026",
      level: "year"
    });

  const moon =
    WorldModel.createWorldNode({
      id: "year:2026:moon:5",
      level: "moon"
    });

  const day =
    WorldModel.createWorldNode({
      id: "year:2026:moon:5:day:10",
      level: "day"
    });

  navigation.pushPath(year);
  navigation.pushPath(moon);
  navigation.pushPath(day);

  assert.deepEqual(
    navigation
      .breadcrumb()
      .map(item => item.level),
    [
      "year",
      "moon",
      "day"
    ]
  );

  navigation.popPath();

  assert.deepEqual(
    navigation
      .breadcrumb()
      .map(item => item.level),
    [
      "year",
      "moon"
    ]
  );
});

test("world navigation can enter deeper temporal worlds", () => {
  let clock = 1000;

  const navigation =
    WorldNavigation.createNavigation({
      now: () => clock
    });

  const moon =
    WorldModel.createWorldNode({
      id: "year:2026:moon:5",
      level: "moon",
      position: {
        x: 2,
        y: 0,
        z: 1
      }
    });

  navigation.enter(
    moon,
    {
      duration: 1000
    }
  );

  assert.equal(
    navigation.getLevel(),
    "moon"
  );

  assert.equal(
    navigation.getFlight().active,
    true
  );

  assert.equal(
    navigation.breadcrumb().length,
    1
  );

  clock = 2000;

  navigation.updateFlight(
    clock
  );

  assert.equal(
    navigation.getFlight().active,
    false
  );

  assert.equal(
    navigation.getFlight().progress,
    1
  );
});

test("world flight interpolates camera through three dimensional space", () => {
  let clock = 0;

  const navigation =
    WorldNavigation.createNavigation({
      now: () => clock,
      camera: {
        position: {
          x: 0,
          y: 0,
          z: 10
        },
        target: {
          x: 0,
          y: 0,
          z: 0
        },
        distance: 10
      }
    });

  navigation.beginFlight(
    {
      position: {
        x: 10,
        y: 4,
        z: 2
      },

      target: {
        x: 5,
        y: 2,
        z: 1
      },

      distance: 2
    },
    {
      duration: 1000
    }
  );

  clock = 500;

  navigation.updateFlight(
    clock
  );

  const middle =
    navigation.getCamera();

  assert.ok(
    middle.position.x > 0 &&
      middle.position.x < 10
  );

  assert.ok(
    middle.distance > 2 &&
      middle.distance < 10
  );

  clock = 1000;

  navigation.updateFlight(
    clock
  );

  assert.deepEqual(
    navigation.getCamera().position,
    {
      x: 10,
      y: 4,
      z: 2
    }
  );
});

test("world zoom changes semantic depth", () => {
  const navigation =
    WorldNavigation.createNavigation();

  navigation.setCamera(
    {
      distance: 30
    },
    {
      silent: true
    }
  );

  navigation.zoom(
    0,
    {
      silent: true
    }
  );

  assert.equal(
    navigation.getLevel(),
    "global"
  );

  navigation.setCamera(
    {
      distance: 2.5
    },
    {
      silent: true
    }
  );

  navigation.zoom(
    0,
    {
      silent: true
    }
  );

  assert.equal(
    navigation.getLevel(),
    "day"
  );
});

test("world navigation observers receive renderer-independent state changes", () => {
  const navigation =
    WorldNavigation.createNavigation();

  const reasons = [];

  const unsubscribe =
    navigation.subscribe(
      detail => {
        reasons.push(
          detail.reason
        );
      }
    );

  navigation.setLevel(
    "moon"
  );

  navigation.setCamera({
    distance: 4
  });

  unsubscribe();

  navigation.setLevel(
    "day"
  );

  assert.deepEqual(
    reasons,
    [
      "set-level",
      "camera"
    ]
  );
});

test("world navigation reset returns safely to Year World", () => {
  const navigation =
    WorldNavigation.createNavigation({
      level: "event"
    });

  navigation.reset();

  const state =
    navigation.getState();

  assert.equal(
    state.level,
    "year"
  );

  assert.equal(
    state.focusId,
    null
  );

  assert.equal(
    state.path.length,
    0
  );

  assert.equal(
    state.flight.active,
    false
  );
});

const SceneGraph = require(
  "../docs/assets/js/life-atlas/life-atlas-scene-graph.js"
);

test("Temporal Scene Graph stores nested worlds", () => {
  const graph =
    SceneGraph.createSceneGraph();

  graph.addNode({
    id: "year:2026",
    level: "year"
  });

  graph.addNode({
    id: "year:2026:moon:5",
    level: "moon",
    parentId: "year:2026"
  });

  graph.addNode({
    id: "year:2026:moon:5:day:10",
    level: "day",
    parentId: "year:2026:moon:5"
  });

  assert.equal(
    graph.stats().nodes,
    3
  );

  assert.equal(
    graph.getParent(
      "year:2026:moon:5"
    ).id,
    "year:2026"
  );
});

test("Temporal Scene Graph traverses ancestors and descendants", () => {
  const graph =
    SceneGraph.createSceneGraph();

  graph.addNodes([
    {
      id: "year:2026",
      level: "year"
    },
    {
      id: "moon:5",
      level: "moon",
      parentId: "year:2026"
    },
    {
      id: "day:10",
      level: "day",
      parentId: "moon:5"
    },
    {
      id: "event:a",
      level: "event",
      parentId: "day:10"
    }
  ]);

  assert.deepEqual(
    graph
      .ancestors("event:a")
      .map(node => node.id),
    [
      "day:10",
      "moon:5",
      "year:2026"
    ]
  );

  assert.deepEqual(
    graph
      .descendants("year:2026")
      .map(node => node.id),
    [
      "moon:5",
      "day:10",
      "event:a"
    ]
  );
});

test("Temporal Scene Graph supports cross-year relation edges", () => {
  const graph =
    SceneGraph.createSceneGraph();

  graph.addNodes([
    {
      id: "event:2024:a",
      level: "event"
    },
    {
      id: "event:2026:b",
      level: "event"
    }
  ]);

  const edge =
    graph.addEdge({
      sourceId:
        "event:2024:a",

      targetId:
        "event:2026:b",

      type:
        "pattern-recurrence",

      weight: 0.82
    });

  assert.equal(
    edge.type,
    "pattern-recurrence"
  );

  assert.equal(
    graph.stats().edges,
    1
  );

  assert.equal(
    graph.getEdgesFor(
      "event:2024:a"
    ).length,
    1
  );
});

test("Temporal Scene Graph finds relation paths through time", () => {
  const graph =
    SceneGraph.createSceneGraph();

  graph.addNodes([
    {
      id: "person:a",
      level: "record"
    },
    {
      id: "event:2024",
      level: "event"
    },
    {
      id: "place:a",
      level: "record"
    },
    {
      id: "event:2026",
      level: "event"
    }
  ]);

  graph.addEdge({
    sourceId: "person:a",
    targetId: "event:2024",
    type: "participant"
  });

  graph.addEdge({
    sourceId: "event:2024",
    targetId: "place:a",
    type: "place"
  });

  graph.addEdge({
    sourceId: "place:a",
    targetId: "event:2026",
    type: "place"
  });

  assert.deepEqual(
    graph.shortestRelationPath(
      "person:a",
      "event:2026"
    ),
    [
      "person:a",
      "event:2024",
      "place:a",
      "event:2026"
    ]
  );
});

test("Temporal Scene Graph returns relation neighborhoods", () => {
  const graph =
    SceneGraph.createSceneGraph();

  graph.addNodes([
    {
      id: "a",
      level: "record"
    },
    {
      id: "b",
      level: "record"
    },
    {
      id: "c",
      level: "record"
    }
  ]);

  graph.addEdge({
    sourceId: "a",
    targetId: "b"
  });

  graph.addEdge({
    sourceId: "b",
    targetId: "c"
  });

  assert.deepEqual(
    graph
      .relatedNeighborhood(
        "a",
        {
          depth: 1
        }
      )
      .map(node => node.id),
    [
      "a",
      "b"
    ]
  );

  assert.deepEqual(
    graph
      .relatedNeighborhood(
        "a",
        {
          depth: 2
        }
      )
      .map(node => node.id),
    [
      "a",
      "b",
      "c"
    ]
  );
});

test("Temporal Scene Graph supports semantic visibility windows", () => {
  const graph =
    SceneGraph.createSceneGraph();

  graph.addNodes([
    {
      id: "year:2026",
      level: "year"
    },
    {
      id: "moon:5",
      level: "moon",
      parentId: "year:2026"
    },
    {
      id: "day:10",
      level: "day",
      parentId: "moon:5"
    }
  ]);

  const visible =
    graph.visibleFrom(
      "moon:5",
      {
        depth: 2
      }
    );

  const ids =
    visible.map(
      node => node.id
    );

  assert.ok(
    ids.includes(
      "year:2026"
    )
  );

  assert.ok(
    ids.includes(
      "moon:5"
    )
  );
});

test("Temporal Scene Graph safely cascades deleted worlds", () => {
  const graph =
    SceneGraph.createSceneGraph();

  graph.addNodes([
    {
      id: "year",
      level: "year"
    },
    {
      id: "moon",
      level: "moon",
      parentId: "year"
    },
    {
      id: "day",
      level: "day",
      parentId: "moon"
    }
  ]);

  assert.throws(
    () =>
      graph.removeNode(
        "year"
      ),
    /children/
  );

  assert.equal(
    graph.removeNode(
      "year",
      {
        cascade: true
      }
    ),
    true
  );

  assert.equal(
    graph.stats().nodes,
    0
  );
});

const WorldBuilder = require(
  "../docs/assets/js/life-atlas/life-atlas-world-builder.js"
);

test("World Builder exposes semantic detail levels", () => {
  assert.equal(
    WorldBuilder.resolveDetail(
      "multi-year"
    ),
    "structure"
  );

  assert.equal(
    WorldBuilder.resolveDetail(
      "moon"
    ),
    "full"
  );
});

test("World Builder creates multi-year fields without duplicate year nodes", () => {
  const builder =
    WorldBuilder.createBuilder();

  builder.ensureYearField({
    years: [
      2024,
      2025,
      2026
    ],
    anchorYear: 2026
  });

  builder.ensureYearField({
    years: [
      2025,
      2026,
      2027
    ],
    anchorYear: 2026
  });

  const years =
    builder
      .getGraph()
      .nodesAtLevel(
        "year"
      );

  assert.deepEqual(
    years
      .map(
        node =>
          node.temporal
            .patternYear
      )
      .sort(),
    [
      2024,
      2025,
      2026,
      2027
    ]
  );
});

test("World Builder expands Year World into Moon worlds", () => {
  const builder =
    WorldBuilder.createBuilder();

  const year =
    WorldModel.createWorldNode({
      id: "year:2026",
      level: "year",
      position: {
        x: 0,
        y: 0,
        z: 0
      },
      temporal: {
        patternYear: 2026
      }
    });

  builder
    .getGraph()
    .addNode(year);

  const result =
    builder.buildForFocus({
      level: "year",
      focusNode: year
    });

  assert.equal(
    result.created.length,
    13
  );

  assert.equal(
    builder
      .getGraph()
      .nodesAtLevel(
        "moon"
      ).length,
    13
  );
});

test("World Builder expands Moon World into weeks and twenty-eight days", () => {
  const builder =
    WorldBuilder.createBuilder();

  const moon =
    WorldModel.createWorldNode({
      id: "year:2026:moon:5",
      level: "moon",
      temporal: {
        patternYear: 2026,
        moon: 5
      }
    });

  builder
    .getGraph()
    .addNode(moon);

  const result =
    builder.buildForFocus({
      level: "moon",
      focusNode: moon
    });

  assert.equal(
    result.created.length,
    32
  );

  assert.equal(
    builder
      .getGraph()
      .nodesAtLevel(
        "week"
      ).length,
    4
  );

  assert.equal(
    builder
      .getGraph()
      .nodesAtLevel(
        "day"
      ).length,
    28
  );
});

test("World Builder expands Day World into twenty-four hour nodes", () => {
  const builder =
    WorldBuilder.createBuilder();

  const day =
    WorldModel.createWorldNode({
      id:
        "year:2026:moon:5:day:10",

      level: "day",

      temporal: {
        patternYear: 2026,
        moon: 5,
        moonDay: 10
      }
    });

  builder
    .getGraph()
    .addNode(day);

  const result =
    builder.buildForFocus({
      level: "day",
      focusNode: day
    });

  assert.equal(
    result.created.length,
    24
  );

  assert.equal(
    builder
      .getGraph()
      .nodesAtLevel(
        "hour"
      ).length,
    24
  );
});

test("World Builder keeps renderer-independent visible windows", () => {
  const builder =
    WorldBuilder.createBuilder();

  builder
    .getGraph()
    .addNodes([
      {
        id: "year",
        level: "year"
      },
      {
        id: "moon",
        level: "moon",
        parentId: "year"
      },
      {
        id: "day",
        level: "day",
        parentId: "moon"
      }
    ]);

  const visible =
    builder.visibleWindow(
      "moon",
      {
        depth: 2
      }
    );

  assert.ok(
    visible.some(
      node =>
        node.id === "year"
    )
  );

  assert.ok(
    visible.some(
      node =>
        node.id === "moon"
    )
  );
});

const RenderProjection = require(
  "../docs/assets/js/life-atlas/life-atlas-render-projection.js"
);

test("Render Projection translates temporal worlds into renderer primitives", () => {
  const year =
    WorldModel.createWorldNode({
      id: "year:2026",
      level: "year",
      position: {
        x: 1,
        y: 2,
        z: 3
      },
      temporal: {
        patternYear: 2026
      }
    });

  const projected =
    RenderProjection.projectNode(
      year
    );

  assert.equal(
    projected.id,
    "year:2026"
  );

  assert.equal(
    projected.role,
    "year-world"
  );

  assert.equal(
    projected.primitive,
    "shell"
  );

  assert.deepEqual(
    projected.position,
    {
      x: 1,
      y: 2,
      z: 3
    }
  );
});

test("Render Projection increases selected world emphasis", () => {
  const node =
    WorldModel.createWorldNode({
      id: "day:10",
      level: "day",
      radius: 0.2
    });

  const normal =
    RenderProjection.projectNode(
      node
    );

  const selected =
    RenderProjection.projectNode(
      node,
      {
        selected: true
      }
    );

  assert.ok(
    selected.scale >
      normal.scale
  );

  assert.equal(
    selected.opacity,
    1
  );

  assert.ok(
    selected.labelPriority >
      normal.labelPriority
  );
});

test("Render Projection preserves interaction identity", () => {
  const node =
    WorldModel.createWorldNode({
      id:
        "year:2026:moon:5:day:10",

      level: "day",

      temporal: {
        patternYear: 2026,
        moon: 5,
        moonDay: 10,
        patternDay: 122
      }
    });

  const projected =
    RenderProjection.projectNode(
      node
    );

  assert.equal(
    projected.interaction.id,
    node.id
  );

  assert.equal(
    projected.interaction.temporal
      .patternDay,
    122
  );
});

test("Render Projection converts cross-time relations into connection geometry", () => {
  const first =
    WorldModel.createWorldNode({
      id: "event:2024",
      level: "event",
      position: {
        x: -2,
        y: 1,
        z: 0
      }
    });

  const second =
    WorldModel.createWorldNode({
      id: "event:2026",
      level: "event",
      position: {
        x: 3,
        y: 2,
        z: 1
      }
    });

  const connection =
    RenderProjection.projectConnection(
      {
        id: "edge:1",
        sourceId: first.id,
        targetId: second.id,
        type:
          "pattern-recurrence",
        weight: 0.8,
        metadata: {
          dashed: true
        }
      },
      first,
      second
    );

  assert.deepEqual(
    connection.start,
    first.position
  );

  assert.deepEqual(
    connection.end,
    second.position
  );

  assert.equal(
    connection.dashed,
    true
  );
});

test("Render Projection builds complete renderer-independent scene payload", () => {
  const nodes = [
    WorldModel.createWorldNode({
      id: "year:2025",
      level: "year",
      position: {
        x: -2,
        y: -1,
        z: 0
      }
    }),

    WorldModel.createWorldNode({
      id: "year:2026",
      level: "year",
      position: {
        x: 0,
        y: 0,
        z: 0
      }
    })
  ];

  const scene =
    RenderProjection.projectScene({
      nodes,

      edges: [
        {
          id: "recurrence",
          sourceId:
            "year:2025",
          targetId:
            "year:2026",
          type:
            "pattern-recurrence",
          weight: 1
        }
      ],

      selectedId:
        "year:2026"
    });

  assert.equal(
    scene.stats.nodes,
    2
  );

  assert.equal(
    scene.stats.connections,
    1
  );

  assert.equal(
    scene.nodes.find(
      node =>
        node.id ===
        "year:2026"
    ).selected,
    true
  );

  assert.equal(
    scene.connections[0]
      .dashed,
    true
  );
});

test("Render Projection safely ignores edges whose visible endpoint is absent", () => {
  const nodes = [
    WorldModel.createWorldNode({
      id: "year:2026",
      level: "year"
    })
  ];

  const scene =
    RenderProjection.projectScene({
      nodes,

      edges: [
        {
          sourceId:
            "year:2026",
          targetId:
            "year:2025",
          type: "related"
        }
      ]
    });

  assert.equal(
    scene.stats.nodes,
    1
  );

  assert.equal(
    scene.stats.connections,
    0
  );
});

const SphereExtensionHost = require(
  "../docs/assets/js/sphere/living-time-sphere-extension-host.js"
);

test("Sphere extension host registers isolated renderer extensions", () => {
  SphereExtensionHost._internals.clearRegistry();

  const result =
    SphereExtensionHost.register({
      id:
        "test-extension"
    });

  assert.equal(
    result,
    true
  );

  assert.equal(
    SphereExtensionHost.has(
      "test-extension"
    ),
    true
  );

  assert.equal(
    SphereExtensionHost.register({
      id:
        "test-extension"
    }),
    false
  );
});

test("Sphere extension host mounts updates renders and disposes an extension", async () => {
  SphereExtensionHost._internals.clearRegistry();

  const calls = [];

  SphereExtensionHost.register({
    id:
      "lifecycle-test",

    mount(context) {
      calls.push([
        "mount",
        context.token
      ]);
    },

    update(context) {
      calls.push([
        "update",
        context.token
      ]);
    },

    render(
      context,
      nowMs
    ) {
      calls.push([
        "render",
        context.token,
        nowMs
      ]);
    },

    dispose(context) {
      calls.push([
        "dispose",
        context.token
      ]);
    }
  });

  await SphereExtensionHost.mountAll({
    token: "atlas"
  });

  await SphereExtensionHost.updateAll({
    token: "atlas"
  });

  SphereExtensionHost.renderAll(
    {
      token: "atlas"
    },
    123
  );

  await SphereExtensionHost.disposeAll({
    token: "atlas"
  });

  assert.deepEqual(
    calls,
    [
      [
        "mount",
        "atlas"
      ],
      [
        "update",
        "atlas"
      ],
      [
        "render",
        "atlas",
        123
      ],
      [
        "dispose",
        "atlas"
      ]
    ]
  );

  assert.equal(
    SphereExtensionHost.isMounted(
      "lifecycle-test"
    ),
    false
  );
});

test("Sphere extension host contains extension failures instead of breaking renderer lifecycle", async () => {
  SphereExtensionHost._internals.clearRegistry();

  SphereExtensionHost.register({
    id:
      "broken-extension",

    mount() {
      throw new Error(
        "synthetic extension failure"
      );
    }
  });

  const result =
    await SphereExtensionHost.mountAll({});

  assert.equal(
    result[0].mounted,
    false
  );

  assert.equal(
    SphereExtensionHost
      .diagnostics()
      .errors.length,
    1
  );
});

test("Sphere extension host supports feature-gated extensions", async () => {
  SphereExtensionHost._internals.clearRegistry();

  let mounted = 0;

  SphereExtensionHost.register({
    id:
      "guarded-world",

    enabled(context) {
      return (
        context.lifeAtlasEnabled ===
        true
      );
    },

    mount() {
      mounted += 1;
    }
  });

  await SphereExtensionHost.mountAll({
    lifeAtlasEnabled:
      false
  });

  assert.equal(
    mounted,
    0
  );

  await SphereExtensionHost.mountAll({
    lifeAtlasEnabled:
      true
  });

  assert.equal(
    mounted,
    1
  );
});

test("temporal bridge suppresses stale overlapping refresh publication", async () => {
  const repository = Repository.createRepository();
  const relations = Relations.createRelationRepository();

  const cursor = {
    getState() { return {}; },
    getDate() { return new Date("2026-08-16T12:00:00Z"); },
    getCoordinate() { return { civilDate: "2026-08-16" }; }
  };

  const bridge = TemporalBridge.createTemporalBridge({
    repository,
    relations,
    cursor
  });

  const original = bridge.engine.forTemporalSelection.bind(bridge.engine);
  let call = 0;

  bridge.engine.forTemporalSelection = async selection => {
    call += 1;
    const delay = call === 1 ? 40 : 0;
    await new Promise(resolve => setTimeout(resolve, delay));
    return original(selection);
  };

  const published = [];
  bridge.subscribe(detail => published.push(detail.reason));

  const first = bridge.refresh("older");
  const second = bridge.refresh("newer");

  const [older, newer] = await Promise.all([first, second]);

  assert.equal(older.stale, true);
  assert.equal(newer.stale, false);
  assert.deepEqual(published, ["newer"]);
  assert.equal(bridge.getRevision(), 2);
  assert.equal(bridge.getLastContext().revision, 2);
});
