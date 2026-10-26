import assert from "node:assert/strict";
import test from "node:test";
import unicode from "./product-variant.unicode.json" with { type: "json" };
import { variantWriterRoutines, variantWriterTrigger } from "./product-variant.writer-sql.js";
import { variantWriterParityCases } from "./product-variant.writer-cases.js";
import {
  historicalLedger,
  MigrationFixture
} from "../ecommerce-composition/ecommerce-composition.migration.fixture.js";
import {
  migrateEcommerceTenantDatabase,
  planEcommerceTenantMigrations
} from "../ecommerce-composition/ecommerce-composition.migration.js";

test("frozen Unicode normalization matches the application runtime for all scalar values", () => {
  const lower: Record<string, string> = unicode.lower;
  const cased = new Set(Array.from(unicode.cased));
  const ignorable = new Set(Array.from(unicode.ignorable));
  for (let code = 0; code <= 0x10ffff; code++) {
    if (code >= 0xd800 && code <= 0xdfff) continue;
    const letter = String.fromCodePoint(code);
    assert.equal(lower[letter] ?? letter, letter.toLowerCase());
    assert.equal(cased.has(letter), /\p{Cased}/u.test(letter));
    assert.equal(ignorable.has(letter), /\p{Case_Ignorable}/u.test(letter));
  }
});

test("old and new writers share canonical signatures and retain database uniqueness", () => {
  assert.equal(
    variantWriterParityCases[0]?.expectedSignature,
    variantWriterParityCases[1]?.expectedSignature
  );
  assert.equal(
    new Set(variantWriterParityCases.map((row) => row.expectedSignature)).size,
    variantWriterParityCases.length - 1
  );
  const routines = variantWriterRoutines();
  assert.equal(routines.length, 3);
  for (const routine of routines) assert.match(routine, /DETERMINISTIC NO SQL/);
  for (const event of ["INSERT", "UPDATE"] as const) {
    assert.match(variantWriterTrigger(event), new RegExp(`BEFORE ${event}`));
    assert.match(
      variantWriterTrigger(event),
      /SET NEW.option_signature=ecommerce_variant_signature_v1/
    );
  }
  assert.ok(!routines.some((sql) => /DROP|GRANT|SET GLOBAL/.test(sql)));
});

for (const lineage of ["legacy31", "stable34"] as const) {
  test(`${lineage} already-upgraded 40-step ledger needs only forward writer repair`, async () => {
    const before = planEcommerceTenantMigrations(historicalLedger(lineage))
      .steps.filter((step) => step.version <= 40)
      .map((step) => ({
        scope: "ecommerce.modules",
        batch: 1,
        name: step.name,
        version: step.version,
        checksum: step.checksum,
        status: "applied" as const
      }));
    const fixture = new MigrationFixture(before);
    const original = structuredClone([...fixture.rows]);
    const database = fixture.database();
    try {
      const result = await migrateEcommerceTenantDatabase(database);
      assert.equal(result.applied.length, 1);
      assert.equal(result.skipped.length, 40);
      for (const [name, row] of original) assert.deepEqual(fixture.rows.get(name), row);
      assert.equal(
        fixture.statements.filter((text) => text.startsWith("CREATE TRIGGER")).length,
        2
      );
      assert.ok(fixture.statements.some((text) => text.includes("CHAR(64) NOT NULL DEFAULT ''")));
      assert.ok(
        !fixture.statements.some((text) =>
          /DROP INDEX|DELETE FROM ecommerce_product_variants/.test(text)
        )
      );
      const again = await migrateEcommerceTenantDatabase(database);
      assert.equal(again.applied.length, 0);
      assert.equal(again.skipped.length, 41);
    } finally {
      await database.destroy();
    }
  });
}
