import assert from "node:assert/strict";
import test from "node:test";
import { randomBytes } from "node:crypto";
import { createConnection } from "mysql2/promise";
import { createPool } from "mysql2";
import { Kysely, MysqlDialect } from "kysely";
import { ConflictResolutionService } from "../../devkits/data-bridge/api/src/modules/report/report.resolution.service.js";
import { CommonBulkService } from "../../devkits/data-bridge/api/src/modules/report/report.bulk.service.js";
import { migrateDataBridgeDatabase } from "../../devkits/data-bridge/api/src/modules/data-bridge/data-bridge.migration.js";
import {
  commonTableNames,
  coreMasterTableNames,
  type CommonTableImportHost
} from "../../devkits/data-bridge/api/src/modules/import-review/import-review.types.js";
import { parentOrder } from "../../devkits/data-bridge/api/src/modules/report/report.bulk.order.js";

test("bulk order places parents first and rejects cycles", () => {
  assert.deepEqual(
    parentOrder(
      ["core_cities", "core_districts", "core_states"],
      new Map([
        ["core_cities", ["core_districts"]],
        ["core_districts", ["core_states"]]
      ])
    ),
    ["core_states", "core_districts", "core_cities"]
  );
  assert.throws(
    () => parentOrder(["core_states"], new Map([["core_states", ["core_states"]]])),
    /cycle/u
  );
});

test("bulk imports all common tables in parent order, persists attention and repeats without duplicates", async () => {
  const config = {
    host: process.env.DB_HOST!,
    port: Number(process.env.DB_PORT),
    user: process.env.DB_USER!,
    password: process.env.DB_PASSWORD!
  };
  const suffix = randomBytes(4).toString("hex");
  const sourceUser = `br_${suffix}`;
  const sourcePassword = randomBytes(16).toString("hex");
  const names = ["source", "target", "master"].map(
    (part) => `codexsun_bridge_bulk_${part}_${suffix}`
  );
  const admin = await createConnection(config);
  let database: Kysely<unknown> | undefined;
  try {
    for (const name of names) await admin.query(`CREATE DATABASE \`${name}\``);
    await admin.query(`CREATE USER '${sourceUser}'@'%' IDENTIFIED BY '${sourcePassword}'`);
    await admin.query(`GRANT SELECT ON \`${names[0]}\`.* TO '${sourceUser}'@'%'`);
    const source = await createConnection({ ...config, database: names[0] });
    const target = await createConnection({ ...config, database: names[1] });
    database = new Kysely({
      dialect: new MysqlDialect({ pool: createPool({ ...config, database: names[2] }) })
    });
    try {
      await migrateDataBridgeDatabase(database);
      const parents = new Map<string, { field: string; table: string }>([
        ["core_states", { field: "country_id", table: "core_countries" }],
        ["core_districts", { field: "state_id", table: "core_states" }],
        ["core_cities", { field: "district_id", table: "core_districts" }],
        ["core_pincodes", { field: "city_id", table: "core_cities" }],
        ["core_ledgers", { field: "ledger_group_id", table: "core_ledger_groups" }]
      ]);
      const order = parentOrder(
        commonTableNames,
        new Map([...parents].map(([table, parent]) => [table, [parent.table]]))
      );
      for (const table of order) {
        const parent = parents.get(table);
        for (const connection of [source, target]) {
          if (connection === source && table === "core_transports") continue;
          await connection.query(
            `CREATE TABLE \`${table}\` (id INT AUTO_INCREMENT PRIMARY KEY,name VARCHAR(32) NOT NULL UNIQUE,status VARCHAR(24) NOT NULL DEFAULT 'active'${parent ? `, ${parent.field} INT NOT NULL, FOREIGN KEY (${parent.field}) REFERENCES ${parent.table}(id)` : ""})`
          );
          if (parent)
            await connection.query(
              `INSERT INTO \`${table}\` (id,name,${parent.field}) VALUES (?,?,?)`,
              [connection === source ? 1 : 50, "Existing", connection === source ? 1 : 50]
            );
          else
            await connection.query(`INSERT INTO \`${table}\` (id,name) VALUES (?,?)`, [
              connection === source ? 1 : 50,
              "Existing"
            ]);
          if (connection === source) {
            if (parent)
              await connection.query(
                `INSERT INTO \`${table}\` (id,name,${parent.field}) VALUES (2,'Missing',2)`
              );
            else await connection.query(`INSERT INTO \`${table}\` (id,name) VALUES (2,'Missing')`);
          }
        }
      }
      await source.query("UPDATE core_colours SET status='inactive' WHERE id=1");
      let queued = 0;
      const host: CommonTableImportHost = {
        database,
        authorize: () => "test",
        listTenants: async () => [],
        resolveTenant: async () => ({ ...config, id: 2, label: "Target", database: names[1]! }),
        dataMigration: {
          listSources: async () => [],
          resolveSource: async () => ({
            ...config,
            user: sourceUser,
            password: sourcePassword,
            id: 1,
            label: "Source",
            database: names[0]!,
            tlsMode: "disabled" as const
          })
        },
        enqueueBulk: async () => {
          queued++;
        }
      };
      const service = new CommonBulkService(host);
      const pending = await service.start(1, 2, "test", "correlation-test");
      assert.equal((await service.start(1, 2, "test", "correlation-test")).id, pending.id);
      assert.equal(queued, 1);
      await assert.rejects(service.run(pending.id, 999), /target/u);
      const report = await service.run(pending.id, 2);
      assert.equal(report.status, "warning");
      assert.equal(report.tables.length, 31);
      assert.equal(
        report.tables.find((row) => row.table === "core_colours")?.attention[0]?.rowId,
        1
      );
      assert.equal(report.tables.find((row) => row.table === "core_transports")?.status, "warning");
      assert.equal(report.tables.filter((row) => row.status === "success").length, 29);
      assert.equal(
        report.tables.reduce((sum, row) => sum + row.inserted, 0),
        30
      );
      const colourRows = report.tables.find((row) => row.table === "core_colours")!.rows!;
      assert.equal(colourRows.find((row) => row.rowId === 1)?.status, "warning");
      assert.equal(colourRows.find((row) => row.rowId === 1)?.source.status, "inactive");
      assert.equal(colourRows.find((row) => row.rowId === 1)?.target?.status, "active");
      assert.equal(colourRows.find((row) => row.rowId === 2)?.status, "imported");
      assert.equal(colourRows.find((row) => row.rowId === 2)?.target?.name, "Missing");
      assert.equal(
        report.tables.find((row) => row.table === "core_countries")?.rows?.[0]?.status,
        "existing"
      );
      assert.equal(colourRows[0]?.source.id, undefined);
      assert.deepEqual(
        (await service.get(report.id)).tables.find((row) => row.table === "core_colours")?.rows,
        colourRows
      );
      const [cities] = await target.query<any[]>(
        "SELECT city.id, district_id, district.name AS district FROM core_cities city JOIN core_districts district ON district.id=city.district_id WHERE city.name='Missing'"
      );
      assert.equal(cities[0].district, "Missing");
      assert.notEqual(cities[0].district_id, 2);
      assert.equal((await service.latest(1, 2))?.id, report.id);
      assert.equal(
        (await service.run(report.id, 2)).tables.reduce((sum, row) => sum + row.inserted, 0),
        30
      );
      const repeat = await service.start(1, 2, "test", "repeat");
      const repeated = await service.run(repeat.id, 2);
      assert.equal(
        repeated.tables.reduce((sum, row) => sum + row.inserted, 0),
        0
      );
      const [original] = await target.query<any[]>("SELECT status FROM core_colours WHERE id=50");
      assert.equal(original[0].status, "active");
      // Master child rows have no natural unique index and resolve a parent with a different target ID.
      for (const table of coreMasterTableNames) {
        for (const connection of [source, target]) {
          await connection.query(
            `CREATE TABLE ${table} (id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(32) NOT NULL, status VARCHAR(24) NOT NULL DEFAULT 'active'${table === "core_contacts_phones" ? ", contact_id INT NOT NULL, FOREIGN KEY (contact_id) REFERENCES core_contacts(id)" : table === "core_products" ? ", unit_id INT NOT NULL, UNIQUE(name), FOREIGN KEY (unit_id) REFERENCES core_units(id)" : ""})`
          );
        }
        await source.query(
          `INSERT INTO ${table} (id,name${table === "core_contacts_phones" ? ", contact_id" : table === "core_products" ? ", unit_id" : ""}) VALUES (1,'Master'${table === "core_contacts_phones" || table === "core_products" ? ", 1" : ""})`
        );
      }
      await target.query("INSERT INTO core_contacts (id,name) VALUES (50,'Master')");
      const masters = await service.start(1, 2, "test", "masters", "masters");
      const masterReport = await service.run(masters.id, 2);
      assert.equal(masterReport.tables.length, 47);
      assert.equal(
        masterReport.tables.find((row) => row.table === "core_contacts_phones")?.status,
        "success"
      );
      const [phones] = await target.query<any[]>("SELECT contact_id FROM core_contacts_phones");
      assert.equal(phones[0].contact_id, 50);
      const preparedPhone = masterReport.tables.find((row) => row.table === "core_contacts_phones")!
        .rows![0]!;
      assert.equal(preparedPhone.collection?.contact_name, "Master");
      assert.equal(preparedPhone.prepared?.contact_id, 50);
      assert.equal(preparedPhone.collection?.contact_id, undefined);
      assert.equal(
        masterReport.tables
          .filter((row) => coreMasterTableNames.includes(row.table as any))
          .reduce((n, row) => n + row.inserted, 0),
        15
      );
      assert.equal((await service.latest(1, 2, "masters"))?.id, masters.id);
      assert.equal((await service.latest(1, 2))?.id, repeated.id);
      const masterRepeat = await service.start(1, 2, "test", "masters-repeat", "masters");
      const masterRepeated = await service.run(masterRepeat.id, 2);
      assert.equal(
        masterRepeated.tables.reduce((n, row) => n + row.inserted, 0),
        0
      );
      await target.query(
        "UPDATE core_products SET unit_id=51,status='inactive' WHERE name='Master'"
      );
      const conflictRun = await service.start(1, 2, "test", "correction", "masters");
      await service.run(conflictRun.id, 2);
      const corrections = new ConflictResolutionService(host);
      let plan = await corrections.prepare(conflictRun.id, "core_products", 1, "test");
      assert.equal(plan.collection.unit_name, "Existing");
      assert.equal(plan.prepared.unit_id, 50);
      assert.equal(plan.references[0]?.sourceId, 1);
      assert.equal(plan.references[0]?.targetId, 50);
      assert.deepEqual(plan.changes.sort(), ["status", "unit_id"]);
      await assert.rejects(
        corrections.commit(conflictRun.id, plan.id, "0".repeat(64), "test"),
        /Prepare/u
      );
      await target.query("UPDATE core_products SET status='pending' WHERE name='Master'");
      await assert.rejects(
        corrections.commit(conflictRun.id, plan.id, plan.fingerprint, "test"),
        /changed/u
      );
      plan = await corrections.prepare(conflictRun.id, "core_products", 1, "test");
      await source.query("UPDATE core_products SET status='suspended' WHERE id=1");
      await assert.rejects(
        corrections.commit(conflictRun.id, plan.id, plan.fingerprint, "test"),
        /changed/u
      );
      await source.query("UPDATE core_products SET status='active' WHERE id=1");
      await target.query(
        "CREATE TRIGGER reject_product_update BEFORE UPDATE ON core_products FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Rejected update'"
      );
      await assert.rejects(corrections.commit(conflictRun.id, plan.id, plan.fingerprint, "test"));
      const [unchanged] = await target.query<any[]>(
        "SELECT status,unit_id FROM core_products WHERE id=?",
        [plan.targetId]
      );
      assert.equal(unchanged[0].status, "pending");
      assert.equal(unchanged[0].unit_id, 51);
      await target.query("DROP TRIGGER reject_product_update");
      const committed = await corrections.commit(conflictRun.id, plan.id, plan.fingerprint, "test");
      assert.equal(committed.status, "committed");
      assert.equal(
        (await corrections.commit(conflictRun.id, plan.id, plan.fingerprint, "test")).status,
        "committed"
      );
      const [corrected] = await target.query<any[]>(
        "SELECT status,unit_id FROM core_products WHERE id=?",
        [plan.targetId]
      );
      assert.equal(corrected[0].status, "active");
      assert.equal(corrected[0].unit_id, 50);
    } finally {
      await source.end();
      await target.end();
    }
  } finally {
    await database?.destroy();
    await admin.query(`DROP USER IF EXISTS '${sourceUser}'@'%'`);
    for (const name of names) await admin.query(`DROP DATABASE IF EXISTS \`${name}\``);
    await admin.end();
  }
});
