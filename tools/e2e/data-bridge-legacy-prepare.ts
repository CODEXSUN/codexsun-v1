import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { createPool } from "mysql2";
import { createConnection, type Connection, type RowDataPacket } from "mysql2/promise";
import { Kysely, MysqlDialect } from "kysely";
import {
  seedCoreTenantDatabase,
  registerCoreTenantDatabaseConnection,
  closeCoreDatabase
} from "@codexsun/core-api";
import {
  seedBillingTenantDatabase,
  registerBillingTenantDatabaseConnection,
  closeAllBillingDatabases
} from "@codexsun/billing-api";
import { migrateTenantRuntimeModule } from "../../apps/platform/api/src/modules/tenant/tenant.migration.js";
import type { TenantDatabase } from "../../apps/platform/api/src/database/schema.js";
import {
  LegacyPreparationRepository,
  LegacyPreparationService,
  hydrateLegacyPreparation
} from "../../devkits/data-bridge/api/src/modules/legacy-cxapp/index.js";
import { legacyPreparationReport } from "../../devkits/data-bridge/api/src/modules/legacy-cxapp/legacy-cxapp.report.js";
import {
  legacySchemaManifest,
  legacySchemaCsv
} from "../../devkits/data-bridge/api/src/modules/legacy-cxapp/legacy-cxapp.schema.js";
import { auditLegacyPreparation } from "../../devkits/data-bridge/api/src/modules/legacy-cxapp/legacy-cxapp.audit.js";

assert.equal(process.env.CODEXSUN_BRIDGE_LEGACY_PREPARE, "local-docker-only");
assert.equal(process.env.DB_HOST, "127.0.0.1");
assert.equal(Number(process.env.DB_PORT), 13306);
const phase = process.argv.find((a) => a.startsWith("--phase="))?.slice(8) ?? "core";
assert.ok(
  ["core", "core-refresh", "masters", "billing", "billing-refresh", "report"].includes(phase)
);
const config = {
  host: process.env.DB_HOST,
  port: 13306,
  user: process.env.DB_USER!,
  password: process.env.DB_PASSWORD!,
  dateStrings: true as const
};
const sourceName = "codexsun_bridge_thirumurugan_legacy";
const output = "dist/verification/thirumurugan-legacy/preparation";
await mkdir(output, { recursive: true });
const previousManifest =
  phase === "core" ? null : JSON.parse(await readFile(`${output}/manifest.json`, "utf8"));
if (previousManifest) {
  assert.equal(previousManifest.source, sourceName);
  assert.equal(previousManifest.executionAuthorized, false);
  if (phase === "masters" || phase === "core-refresh") assert.equal(previousManifest.phase, "core");
  if (phase === "billing") assert.equal(previousManifest.phase, "masters");
  if (phase === "billing-refresh") assert.equal(previousManifest.phase, "billing");
}
const suffix = Date.now();
const stageName: string = previousManifest?.stage ?? `codexsun_bridge_thirumurugan_stage_${suffix}`;
const targetName: string =
  previousManifest?.target ?? `codexsun_bridge_thirumurugan_target_${suffix}`;
assert.match(stageName, /^codexsun_bridge_thirumurugan_stage_\d+$/);
assert.match(targetName, /^codexsun_bridge_thirumurugan_target_\d+$/);
const admin = await createConnection(config);
const source = await createConnection({ ...config, database: sourceName });
const baseline = await fingerprint(source);
await source.query("SET TRANSACTION READ ONLY");
await source.beginTransaction();
try {
  for (const name of phase === "core" ? [targetName, stageName] : []) {
    assert.match(name, /^codexsun_bridge_thirumurugan_(target|stage)_\d+$/);
    await admin.query(
      `CREATE DATABASE \`${name}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
    );
    const db = new Kysely<TenantDatabase>({
      dialect: new MysqlDialect({ pool: createPool({ ...config, database: name }) })
    });
    try {
      await migrateTenantRuntimeModule(db);
    } finally {
      await db.destroy();
    }
    registerCoreTenantDatabaseConnection({ ...config, database: name });
    await seedCoreTenantDatabase(name);
    console.log(JSON.stringify({ phase: "core-schema", database: name, complete: true }));
  }
  if (phase === "billing") {
    for (const name of [targetName, stageName]) {
      registerCoreTenantDatabaseConnection({ ...config, database: name });
      registerBillingTenantDatabaseConnection({ ...config, database: name });
      await seedBillingTenantDatabase(name);
      console.log(JSON.stringify({ phase: "billing-schema", database: name, complete: true }));
    }
  }
  const stage = await createConnection({ ...config, database: stageName });
  const target = await createConnection({ ...config, database: targetName });
  try {
    await target.query("SET TRANSACTION READ ONLY");
    await target.beginTransaction();
    const targetBefore = await fingerprint(target);
    const repository = new LegacyPreparationRepository(source, stage, target);
    if (phase === "core") await repository.initialize();
    await repository.bindContext(sourceName, targetName);
    await stage.beginTransaction();
    try {
      if (phase === "core-refresh") {
        await stage.query(
          "DELETE FROM bridge_legacy_prepared_rows WHERE phase='core' AND execution_authorized=0"
        );
        await stage.query("DELETE FROM bridge_legacy_mappings WHERE phase='core'");
      }
      if (phase === "billing-refresh") {
        const [[documents]] = await stage.query<RowDataPacket[]>(
          "SELECT COUNT(*) n FROM billing_sales"
        );
        assert.equal(Number(documents!.n), 0, "Cannot refresh a materialized invoice stage.");
        await stage.query(
          "DELETE FROM bridge_legacy_prepared_rows WHERE phase='billing' AND execution_authorized=0"
        );
        await stage.query("DELETE FROM bridge_legacy_mappings WHERE phase='billing'");
      }
      await hydrateLegacyPreparation(repository);
      if (phase !== "report") {
        await new LegacyPreparationService(repository).prepare(
          phase.replace("-refresh", "") as "core" | "masters" | "billing"
        );
      }
      await stage.commit();
    } catch (error) {
      await stage.rollback();
      throw error;
    }
    assert.deepEqual(
      await fingerprint(target),
      targetBefore,
      "Preparation must not import into target."
    );
    const manifest = {
      source: sourceName,
      stage: stageName,
      target: targetName,
      phase: phase === "report" ? previousManifest.phase : phase.replace("-refresh", ""),
      sourceFingerprint: baseline,
      targetFingerprint: targetBefore,
      executionAuthorized: false
    };
    await writeFile(`${output}/manifest.json`, JSON.stringify(manifest, null, 2));
    const ownPhase = phase === "report" ? previousManifest.phase : phase.replace("-refresh", "");
    const ownRows = repository.rows.filter((r) => r.phase === ownPhase);
    await writeFile(`${output}/${ownPhase}-rows.json`, JSON.stringify(ownRows, null, 2));
    await writeFile(`${output}/all-rows.json`, JSON.stringify(repository.rows, null, 2));
    await writeFile(`${output}/all-mappings.json`, JSON.stringify(repository.mappings, null, 2));
    const summary = repository.mappings.map((mapping) => {
      const rows = repository.rows.filter(
        (r) =>
          r.phase === mapping.phase &&
          r.sourceTable === mapping.sourceTable &&
          r.targetTable === mapping.targetTable
      );
      return {
        ...mapping,
        rows: rows.length,
        prepared: rows.filter((r) => !r.issues.length).length,
        blocked: rows.filter((r) => r.issues.length).length
      };
    });
    await writeFile(`${output}/table-list.json`, JSON.stringify(summary, null, 2));
    const report = legacyPreparationReport(repository.rows, repository.mappings);
    await writeFile(`${output}/full-table-list.csv`, report.tableCsv);
    await writeFile(`${output}/full-invoice-list.csv`, report.invoiceCsv);
    await writeFile(`${output}/full-item-list.csv`, report.itemCsv);
    await writeFile(`${output}/review.html`, report.html);
    const inventory = await legacySchemaManifest(target, repository.mappings);
    await writeFile(`${output}/field-list.json`, JSON.stringify(inventory, null, 2));
    const schemaLists = legacySchemaCsv(inventory);
    await writeFile(`${output}/full-field-list.csv`, schemaLists.fields);
    await writeFile(`${output}/full-reference-list.csv`, schemaLists.references);
    if (ownPhase === "billing")
      await writeFile(
        `${output}/audit.json`,
        JSON.stringify(await auditLegacyPreparation(repository), null, 2)
      );
    console.log(
      JSON.stringify({
        phase,
        rows: ownRows.length,
        prepared: ownRows.filter((r) => !r.issues.length).length,
        blocked: ownRows.filter((r) => r.issues.length).length,
        output
      })
    );
  } finally {
    await stage.end();
    await target.rollback();
    await target.end();
  }
  await source.rollback();
  assert.deepEqual(await fingerprint(source), baseline, "Raw Docker source changed.");
  const previous = JSON.parse(
    await readFile("dist/verification/thirumurugan-legacy/restore-proof.json", "utf8")
  );
  assert.equal(Object.keys(baseline).length, previous.tableCount);
} finally {
  await source.end();
  await admin.end();
  await closeCoreDatabase();
  await closeAllBillingDatabases();
}

async function fingerprint(connection: Connection) {
  const [tables] = await connection.query<RowDataPacket[]>(
    "SHOW FULL TABLES WHERE Table_type='BASE TABLE'"
  );
  const result: Record<string, string> = {};
  for (const row of tables) {
    const table = String(Object.values(row)[0]);
    const [rows] = await connection.query<RowDataPacket[]>("SELECT * FROM ??", [table]);
    result[table] = createHash("sha256")
      .update(JSON.stringify(rows.map((r) => JSON.stringify(r)).sort()))
      .digest("hex");
  }
  return result;
}
