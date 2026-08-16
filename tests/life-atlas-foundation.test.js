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
