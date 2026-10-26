import assert from "node:assert/strict";
import test from "node:test";
import {
  migrationChecksum,
  runMigrationBatch,
  type MigrationLedgerEntry
} from "@codexsun/framework/db";
import { historicalLedger, MigrationFixture } from "./ecommerce-composition.migration.fixture.js";
import {
  migrateEcommerceTenantDatabase,
  planEcommerceTenantMigrations
} from "./ecommerce-composition.migration.js";

for (const [lineage, pending] of [
  ["legacy31", 10],
  ["stable34", 7]
] as const) {
  test(`${lineage} retains every historical identity and appends only ${pending} steps`, () => {
    const rows = historicalLedger(lineage);
    const before = structuredClone(rows);
    const plan = planEcommerceTenantMigrations(rows);
    assert.equal(plan.lineage, lineage);
    assert.equal(plan.steps.length, 41);
    assert.equal(plan.steps.filter((step) => !step.applied).length, pending);
    for (const row of rows) {
      const step = plan.steps.find((step) => step.name === row.name)!;
      assert.equal(step.version, row.version);
      assert.equal(step.checksum, row.checksum);
      assert.equal(step.applied, true);
    }
    const highestApplied = Math.max(...rows.map((row) => row.version));
    assert.ok(
      plan.steps.filter((step) => !step.applied).every((step) => step.version > highestApplied)
    );
    assert.deepEqual(rows, before);
  });

  test(`${lineage} actual upgrade callbacks preserve old ledger rows and repeat without writes`, async () => {
    const fixture = new MigrationFixture(historicalLedger(lineage));
    const before = structuredClone([...fixture.rows]);
    const database = fixture.database();
    try {
      const result = await migrateEcommerceTenantDatabase(database);
      assert.equal(result.applied.length, pending);
      assert.equal(result.skipped.length, before.length);
      assert.ok(fixture.scopeReads > 0);
      for (const [name, row] of before) {
        assert.deepEqual(fixture.rows.get(name), row);
        assert.ok(!fixture.ledgerWrites.includes(name));
      }
      if (lineage === "legacy31") {
        assert.ok(
          fixture.statements.some((sql) => sql.includes("ADD COLUMN IF NOT EXISTS revision"))
        );
        assert.ok(
          fixture.statements.some((sql) =>
            sql.includes("ADD UNIQUE KEY ecommerce_product_variants_option_unique")
          )
        );
      }
      const writes = fixture.statements.length;
      const ledgerWrites = fixture.ledgerWrites.length;
      const repeated = await migrateEcommerceTenantDatabase(database);
      assert.deepEqual(repeated.applied, []);
      assert.equal(repeated.skipped.length, 41);
      assert.equal(fixture.ledgerWrites.length, ledgerWrites);
      assert.ok(!fixture.statements.slice(writes).some((sql) => /^(ALTER|UPDATE|DROP)/.test(sql)));
      assert.equal(fixture.locks.size, 0);
    } finally {
      await database.destroy();
    }
  });
}

test("fresh installation chooses the stable manifest and has no accepted checksum aliases", async () => {
  const fixture = new MigrationFixture([]);
  const database = fixture.database();
  assert.equal(planEcommerceTenantMigrations([]).lineage, "stable34");
  try {
    const result = await migrateEcommerceTenantDatabase(database);
    assert.equal(result.applied.length, 41);
    assert.equal(fixture.rows.size, 41);
    assert.equal(planEcommerceTenantMigrations([...fixture.rows.values()]).lineage, "stable34");
  } finally {
    await database.destroy();
  }
});

const invalid: [string, (rows: MigrationLedgerEntry[]) => MigrationLedgerEntry[]][] = [
  [
    "checksum tampering",
    (rows) => rows.map((row, i) => (i === 0 ? { ...row, checksum: "0".repeat(64) } : row))
  ],
  ["unknown migration", (rows) => [...rows, { ...rows[0]!, name: "ecommerce.modules.unknown" }]],
  [
    "mixed lineages",
    (rows) =>
      rows.map((row) =>
        row.name.endsWith("product-variant")
          ? historicalLedger("stable34").find((item) => item.name === row.name)!
          : row
      )
  ],
  ["incomplete history", (rows) => rows.slice(0, 2)],
  ["wrong batch", (rows) => rows.map((row, i) => (i === 0 ? { ...row, batch: 2 } : row))],
  ...(["failed", "running", "rolled_back"] as const).map(
    (status): [string, (rows: MigrationLedgerEntry[]) => MigrationLedgerEntry[]] => [
      status,
      (rows) => rows.map((row, i) => (i === 0 ? { ...row, status } : row))
    ]
  )
];
test("duplicate or foreign-scope metadata is rejected by the public planner", () => {
  const rows = historicalLedger("legacy31");
  assert.throws(() => planEcommerceTenantMigrations([...rows, rows[0]!]), /duplicated/);
  assert.throws(
    () => planEcommerceTenantMigrations(rows.map((row) => ({ ...row, scope: "another.scope" }))),
    /outside its scope/
  );
});
for (const [label, change] of invalid) {
  test(`${label} fails before any migration step or ledger write`, async () => {
    const fixture = new MigrationFixture(change(historicalLedger("legacy31")));
    const before = structuredClone([...fixture.rows]);
    const database = fixture.database();
    try {
      await assert.rejects(migrateEcommerceTenantDatabase(database), /Ecommerce migration history/);
      assert.deepEqual([...fixture.rows], before);
      assert.deepEqual(fixture.ledgerWrites, []);
      assert.ok(!fixture.statements.some((sql) => /^(ALTER|UPDATE|DROP)/.test(sql)));
      assert.equal(fixture.locks.size, 0);
    } finally {
      await database.destroy();
    }
  });
}

test("the framework still rejects a changed version with an accepted checksum", async () => {
  const row = historicalLedger("legacy31")[0]!;
  const fixture = new MigrationFixture([row]);
  const database = fixture.database();
  const step = {
    name: row.name,
    version: row.version + 1,
    checksum: row.name + ":v1",
    description: "Reject mutation",
    acceptedAppliedChecksums: [row.checksum],
    up: async () => {
      throw new Error("Must not execute");
    }
  };
  const batch = { batch: 1, scope: row.scope, version: "1", description: "Guard", steps: [step] };
  assert.notEqual(migrationChecksum(batch, step), row.checksum);
  try {
    await assert.rejects(runMigrationBatch(database, batch), /checksum mismatch/);
    assert.deepEqual(fixture.ledgerWrites, []);
  } finally {
    await database.destroy();
  }
});

test("populated legacy variants receive bounded signatures without deletion", async () => {
  const fixture = new MigrationFixture(historicalLedger("legacy31"));
  fixture.variantRows = [
    { id: 1, productInformationId: 10, sku: "RED", option1Name: "Color", option1Value: "Red" },
    { id: 2, productInformationId: 10, sku: "BLUE", option1Name: "Color", option1Value: "Blue" }
  ];
  const database = fixture.database();
  try {
    await migrateEcommerceTenantDatabase(database);
    const updates = fixture.queries.filter(
      (query) =>
        query.parameters.length > 0 &&
        query.sql.includes("UPDATE ecommerce_product_variants SET option_signature=")
    );
    assert.equal(updates.length, 2);
    assert.deepEqual(
      updates.map((query) => query.parameters[1]),
      [1, 2]
    );
    for (const query of updates) assert.match(String(query.parameters[0]), /^[a-f0-9]{64}$/);
    assert.notEqual(updates[0]!.parameters[0], updates[1]!.parameters[0]);
    assert.ok(!fixture.statements.some((sql) => /^(DELETE|TRUNCATE|DROP TABLE)/.test(sql)));
  } finally {
    await database.destroy();
  }
});

test("legacy canonical collisions abort before variant rewrites and preserve historical rows", async () => {
  const fixture = new MigrationFixture(historicalLedger("legacy31"));
  const before = structuredClone([...fixture.rows]);
  fixture.variantRows = [
    { id: 1, productInformationId: 10, sku: "ONE", option1Name: "Color", option1Value: "Red" },
    { id: 2, productInformationId: 10, sku: "TWO", option1Name: "color", option1Value: " red " }
  ];
  const database = fixture.database();
  try {
    await assert.rejects(
      migrateEcommerceTenantDatabase(database),
      /canonical product option duplicate/
    );
    assert.ok(
      !fixture.statements.some(
        (sql) => sql.startsWith("UPDATE ecommerce_product_variants") || sql.includes("DROP INDEX")
      )
    );
    for (const [name, row] of before) assert.deepEqual(fixture.rows.get(name), row);
    assert.throws(() => planEcommerceTenantMigrations([...fixture.rows.values()]), /failed/);
  } finally {
    await database.destroy();
  }
});
