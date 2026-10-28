import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import test from "node:test";
import { Kysely, MysqlDialect, sql } from "kysely";
import { createPool } from "mysql2";
import { createConnection } from "mysql2/promise";
import { migrateDataBridgeDatabase } from "../../devkits/data-bridge/api/src/modules/data-bridge/data-bridge.migration.js";
import { CommonTableImportRepository } from "../../devkits/data-bridge/api/src/modules/import-review/import-review.repository.js";
import { CommonTableImportService } from "../../devkits/data-bridge/api/src/modules/import-review/import-review.service.js";

for (const legacy of [false, true]) {
  test(`Data Bridge snapshot migration preserves ${legacy ? "legacy" : "fresh"} reviews`, async () => {
    const name = `codexsun_bridge_test_${randomBytes(5).toString("hex")}`;
    const sourceName = `${name}_source`;
    const sourceUser = `br_${randomBytes(4).toString("hex")}`;
    const sourcePassword = randomBytes(16).toString("hex");
    const config = {
      host: process.env.DB_HOST!,
      port: Number(process.env.DB_PORT),
      user: process.env.DB_USER!,
      password: process.env.DB_PASSWORD!
    };
    const admin = await createConnection(config);
    let database: Kysely<unknown> | undefined;
    try {
      await admin.query(`CREATE DATABASE \`${name}\``);
      await admin.query(`CREATE DATABASE \`${sourceName}\``);
      await admin.query(`CREATE USER '${sourceUser}'@'%' IDENTIFIED BY '${sourcePassword}'`);
      await admin.query(`GRANT SELECT ON \`${sourceName}\`.* TO '${sourceUser}'@'%'`);
      database = new Kysely<unknown>({
        dialect: new MysqlDialect({ pool: createPool({ ...config, database: name }) })
      });
      if (legacy) {
        await sql
          .raw(
            `CREATE TABLE data_bridge_common_table_imports (
          id INT AUTO_INCREMENT PRIMARY KEY, uuid CHAR(36) NOT NULL UNIQUE,
          source_id INT NOT NULL, target_tenant_id INT NOT NULL, table_name VARCHAR(191) NOT NULL,
          source_database VARCHAR(191) NOT NULL, target_database VARCHAR(191) NOT NULL,
          source_rows INT NOT NULL DEFAULT 0, copied_rows INT NOT NULL DEFAULT 0,
          status VARCHAR(24) NOT NULL DEFAULT 'reviewed',
          created_by VARCHAR(191) NOT NULL, updated_by VARCHAR(191) NOT NULL,
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          UNIQUE KEY pair (source_id, target_tenant_id, table_name)
        ) ENGINE=InnoDB`
          )
          .execute(database);
        await sql
          .raw(
            `CREATE TABLE data_bridge_common_table_import_rows (
          id INT AUTO_INCREMENT PRIMARY KEY, import_id INT NOT NULL, row_no INT NOT NULL,
          row_json JSON NOT NULL, status VARCHAR(24) NOT NULL DEFAULT 'saved',
          created_by VARCHAR(191) NOT NULL, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          UNIQUE KEY import_row (import_id, row_no),
          FOREIGN KEY (import_id) REFERENCES data_bridge_common_table_imports(id)
        ) ENGINE=InnoDB`
          )
          .execute(database);
        await sql`INSERT INTO data_bridge_common_table_imports
          (uuid, source_id, target_tenant_id, table_name, source_database, target_database,
            source_rows, copied_rows, created_by, updated_by)
          VALUES (${randomUUID()}, 1, 2, 'core_colours', 'test_source', 'test_target',
            3, 1, 'test', 'test')`.execute(database);
        await sql`INSERT INTO data_bridge_common_table_import_rows
          (import_id, row_no, row_json, created_by) VALUES (1, 1, '{"name":"Blue"}', 'test')`.execute(
          database
        );
      }
      await migrateDataBridgeDatabase(database);
      const repository = new CommonTableImportRepository(database);
      const upgraded = await repository.list();
      if (legacy) {
        assert.equal(upgraded[0]?.rowCount, 3);
        assert.equal(upgraded[0]?.importedRows, 1);
        assert.equal(upgraded[0]?.status, "failed");
        const old = await repository.get(upgraded[0]!.id);
        assert.equal(old.samples[0]?.data.name, "Blue");
        assert.match(old.error!, /save a new review/u);
      } else {
        assert.equal(upgraded.length, 0);
      }
      const saved = await repository.save({
        uuid: randomUUID(),
        sourceId: 1,
        targetTenantId: 2,
        table: "core_colours",
        sourceDatabase: "test_source",
        targetDatabase: "test_target",
        columns: ["name"],
        schemaHash: "a".repeat(64),
        rows: [{ rowNumber: 1, data: { name: "Green" } }],
        actor: "test"
      });
      const review = await repository.get(saved.id);
      assert.equal(review.status, "reviewed");
      assert.deepEqual(review.samples[0]?.data, { name: "Green" });
      const rerun = await migrateDataBridgeDatabase(database);
      assert.equal(rerun.applied.length, 0);
      assert.equal((await repository.get(saved.id)).schemaHash, "a".repeat(64));
      await sql
        .raw(
          "CREATE TABLE core_bank_names (uuid CHAR(8) NOT NULL, id INT PRIMARY KEY, name VARCHAR(32) NOT NULL, note VARCHAR(32) NULL DEFAULT 'target default')"
        )
        .execute(database);
      for (let id = 105; id > 0; id--) {
        await sql`INSERT INTO core_bank_names (uuid, id, name) VALUES
          (${String(106 - id).padStart(8, "0")}, ${id}, ${`Bank ${id}`})`.execute(database);
      }
      await admin.query(
        `CREATE TABLE \`${sourceName}\`.core_bank_names LIKE \`${name}\`.core_bank_names`
      );
      await admin.query(
        `INSERT INTO \`${sourceName}\`.core_bank_names SELECT * FROM \`${name}\`.core_bank_names`
      );
      const connection = { ...config, id: 2, label: "Test", database: name };
      const service = new CommonTableImportService({
        database,
        authorize: () => "test",
        listTenants: async () => [],
        resolveTenant: async () => connection,
        dataMigration: {
          listSources: async () => [],
          resolveSource: async () => ({
            ...connection,
            database: sourceName,
            user: sourceUser,
            password: sourcePassword,
            tlsMode: "disabled" as const
          })
        }
      });
      const first = await service.preview({
        sourceId: 1,
        targetTenantId: 2,
        table: "core_bank_names",
        page: 1
      });
      assert.equal(first.source[0]?.id, 1);
      assert.equal(first.target[99]?.id, 100);
      const second = await service.preview({
        sourceId: 1,
        targetTenantId: 2,
        table: "core_bank_names",
        page: 2
      });
      assert.deepEqual(
        second.source.map((row) => row.id),
        [101, 102, 103, 104, 105]
      );
      const snapshot = await service.save({
        sourceId: 1,
        targetTenantId: 2,
        table: "core_bank_names",
        actor: "test",
        rowIds: [103, 2],
        columns: ["id", "uuid", "name"]
      });
      const selectedSnapshot = await repository.get(snapshot.id);
      assert.equal(selectedSnapshot.rowCount, 2);
      assert.deepEqual(
        selectedSnapshot.samples.map((row) => row.data.id),
        [2, 103]
      );
      assert.deepEqual(Object.keys(selectedSnapshot.samples[0]!.data), ["id", "uuid", "name"]);
      await assert.rejects(
        service.save({
          sourceId: 1,
          targetTenantId: 2,
          table: "core_bank_names",
          actor: "test",
          rowIds: [],
          columns: ["name"]
        }),
        /Select between/u
      );
      await assert.rejects(
        service.save({
          sourceId: 1,
          targetTenantId: 2,
          table: "core_bank_names",
          actor: "test",
          rowIds: [2],
          columns: ["name"]
        }),
        /required target columns/u
      );
      await assert.rejects(
        service.save({
          sourceId: 1,
          targetTenantId: 2,
          table: "core_bank_names",
          actor: "test",
          rowIds: [999],
          columns: ["id", "uuid", "name"]
        }),
        /no longer exist/u
      );
      await assert.rejects(
        service.save({
          sourceId: 1,
          targetTenantId: 2,
          table: "core_bank_names",
          actor: "test",
          rowIds: [2],
          columns: ["injected_field"]
        }),
        /shared, non-sensitive/u
      );
      await sql`DELETE FROM core_bank_names WHERE id IN (2, 103)`.execute(database);
      await assert.rejects(service.importSaved(snapshot.id, "test"), /Audit the selected rows/u);
      const audited = await service.auditSaved(snapshot.id, "test");
      assert.deepEqual(
        audited.rows.map((row) => row.status),
        ["ready", "ready"]
      );
      const imported = await service.importSaved(snapshot.id, "test");
      assert.equal(imported.imported, 2);
      assert.equal(imported.skipped, 0);
      const inserted = await sql<{
        id: number;
        note: string;
      }>`SELECT id, note FROM core_bank_names WHERE id IN (2, 103) ORDER BY id`.execute(database);
      assert.deepEqual(
        inserted.rows.map((row) => row.id),
        [2, 103]
      );
      assert.ok(inserted.rows.every((row) => row.note === "target default"));
      assert.deepEqual(
        (await repository.get(snapshot.id)).report?.rows.map((row) => row.status),
        ["inserted", "inserted"]
      );
      const duplicate = await service.save({
        sourceId: 1,
        targetTenantId: 2,
        table: "core_bank_names",
        actor: "test",
        rowIds: [2, 103],
        columns: ["id", "uuid", "name"]
      });
      const existing = await service.auditSaved(duplicate.id, "test");
      assert.deepEqual(
        existing.rows.map((row) => row.status),
        ["existing", "existing"]
      );
      await sql`UPDATE core_bank_names SET name = 'Changed target' WHERE id = 2`.execute(database);
      const skipped = await service.importSaved(duplicate.id, "test");
      assert.equal(skipped.imported, 0);
      assert.equal(skipped.skipped, 2);
      const warning = await repository.get(duplicate.id);
      assert.deepEqual(
        warning.report?.rows.map((row) => row.status),
        ["conflict", "existing"]
      );
      assert.equal(warning.report?.phase, "complete");
      const failed = await service.save({
        sourceId: 1,
        targetTenantId: 2,
        table: "core_bank_names",
        actor: "test",
        rowIds: [2, 103],
        columns: ["id", "uuid", "name"]
      });
      await sql`DELETE FROM core_bank_names WHERE id IN (2, 103)`.execute(database);
      await service.auditSaved(failed.id, "test");
      await sql
        .raw("ALTER TABLE core_bank_names ADD CONSTRAINT test_reject_row CHECK (id <> 103)")
        .execute(database);
      // A schema constraint can change without changing column metadata.
      await assert.rejects(service.importSaved(failed.id, "test"));
      const failure = await repository.get(failed.id);
      assert.equal(failure.status, "failed");
      assert.equal(failure.report?.phase, "failed");
      assert.deepEqual(
        failure.report?.rows.map((row) => row.status),
        ["rolled_back", "rolled_back"]
      );
      const remaining = await sql<{
        count: number;
      }>`SELECT COUNT(*) AS count FROM core_bank_names WHERE id IN (2, 103)`.execute(database);
      assert.equal(Number(remaining.rows[0]?.count), 0);
      await sql
        .raw(
          "CREATE TABLE core_months (id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(32) UNIQUE, start_date DATE NOT NULL, end_date DATE NOT NULL)"
        )
        .execute(database);
      await sql`INSERT INTO core_months (name, start_date, end_date) VALUES ('January', '2026-01-01', '2026-01-31')`.execute(
        database
      );
      await admin.query(`CREATE TABLE \`${sourceName}\`.core_months LIKE \`${name}\`.core_months`);
      await admin.query(
        `INSERT INTO \`${sourceName}\`.core_months SELECT * FROM \`${name}\`.core_months`
      );
      const dates = await service.save({
        sourceId: 1,
        targetTenantId: 2,
        table: "core_months",
        actor: "test",
        rowIds: [1],
        columns: ["name", "start_date", "end_date"]
      });
      assert.equal((await repository.get(dates.id)).samples[0]?.data.start_date, "2026-01-01");
      assert.equal((await service.auditSaved(dates.id, "test")).rows[0]?.status, "existing");
    } finally {
      await database?.destroy();
      await admin.query(`DROP USER IF EXISTS '${sourceUser}'@'%'`);
      await admin.query(`DROP DATABASE IF EXISTS \`${sourceName}\``);
      await admin.query(`DROP DATABASE IF EXISTS \`${name}\``);
      await admin.end();
    }
  });
}
