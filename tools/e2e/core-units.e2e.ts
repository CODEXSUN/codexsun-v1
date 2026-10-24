import assert from "node:assert/strict";
import test from "node:test";
import { randomBytes } from "node:crypto";
import { createConnection, type Connection, type RowDataPacket } from "mysql2/promise";
import { createPool } from "mysql2";
import { Kysely, MysqlDialect } from "kysely";
import { runMigrationBatch } from "@codexsun/framework/db";
import {
  coreMigrationBatch,
  closeCoreDatabase,
  runWithCoreDatabase,
  seedCoreTenantDatabase
} from "../../apps/core/api/src/database/core-database.js";
import {
  migrateUnits,
  ensureUnitDefaults,
  unitsDefaultsMigration
} from "../../apps/core/api/src/modules/common/products/units/units.migration.js";
import { ProductRepository } from "../../apps/core/api/src/modules/master/product/product.repository.js";
import { ProductService } from "../../apps/core/api/src/modules/master/product/product.service.js";
import { UnitsService } from "../../apps/core/api/src/modules/common/products/units/units.service.js";
import { migrateDataBridgeDatabase } from "../../devkits/data-bridge/api/src/modules/data-bridge/data-bridge.migration.js";
import { TransferService } from "../../devkits/data-bridge/api/src/modules/transfer-session/transfer-session.service.js";
import type { CommonTableImportHost } from "../../devkits/data-bridge/api/src/modules/import-review/import-review.types.js";

const config = {
  host: process.env.DB_HOST!,
  port: Number(process.env.DB_PORT),
  user: process.env.DB_USER!,
  password: process.env.DB_PASSWORD!
};
const children = [
  "billing_sales_items",
  "billing_quotation_items",
  "billing_purchase_items",
  "billing_export_sales_items"
];
const rows = async (connection: Connection, query: string) =>
  (await connection.query<RowDataPacket[]>(query))[0];

test("unit defaults safely upgrade legacy references and support Data Bridge import", async (t) => {
  assert.ok(
    ["127.0.0.1", "localhost", "::1"].includes(config.host),
    "This write test requires local MariaDB."
  );
  const suffix = randomBytes(5).toString("hex");
  const names = ["fresh", "upgrade", "source", "master"].map(
    (side) => `codexsun_units_${side}_${suffix}`
  );
  const admin = await createConnection(config);
  const connections: Connection[] = [];
  const databases: Kysely<Record<string, unknown>>[] = [];
  try {
    for (const name of names) {
      await admin.query(`CREATE DATABASE \`${name}\``);
      connections.push(await createConnection({ ...config, database: name }));
      databases.push(
        new Kysely({
          dialect: new MysqlDialect({ pool: createPool({ ...config, database: name }) })
        })
      );
    }
    const [fresh, legacy, source] = connections as [Connection, Connection, Connection, Connection];
    await t.test(
      "fresh initialization reserves hyphen ID 1 and product defaults resolve it",
      async () => {
        await seedCoreTenantDatabase(names[0]!);
        assert.deepEqual(
          (await rows(fresh, "SELECT id,name FROM core_units ORDER BY id LIMIT 3")).map((r) => [
            r.id,
            r.name
          ]),
          [
            [1, "-"],
            [2, "pcs"],
            [3, "nos"]
          ]
        );
        assert.equal(
          (await rows(fresh, "SELECT unit_id FROM core_products WHERE name='-'"))[0]!.unit_id,
          1
        );
        assert.equal(
          (await runWithCoreDatabase(names[0]!, () => new ProductRepository().defaultReferences()))
            .unitId,
          1
        );
        await runWithCoreDatabase(names[0]!, async () => {
          assert.equal(
            (await new ProductService().create({ name: "Default unit product" })).unitId,
            1
          );
          assert.equal(
            (await new ProductService().create({ name: "Explicit unit product", unitId: 3 }))
              .unitId,
            3
          );
          for (const work of [
            () => new UnitsService().update("1", { name: "Changed" }),
            () => new UnitsService().setActive("1", false),
            () => new UnitsService().forceDelete("1")
          ]) {
            await assert.rejects(work(), /protected/u);
          }
        });
        const before = await rows(fresh, "SELECT * FROM core_units ORDER BY id");
        await seedCoreTenantDatabase(names[0]!);
        assert.deepEqual(await rows(fresh, "SELECT * FROM core_units ORDER BY id"), before);
      }
    );
    await t.test(
      "ledger upgrade preserves occupied ID 1, every existing unit and document reference",
      async () => {
        await runMigrationBatch(databases[1]!, {
          ...coreMigrationBatch,
          steps: coreMigrationBatch.steps.filter((step) => step.name !== unitsDefaultsMigration.key)
        });
        await legacy.query(
          "INSERT INTO core_units(id,name,status,sort_order) VALUES(1,'Nos','active',10),(2,'Kg','active',11),(9,'-','active',12),(12,'Custom','inactive',13)"
        );
        await legacy.query(
          "INSERT INTO core_products(uuid,name,unit_id) VALUES('aaaa0001','-',1),('aaaa0002','Historical',2)"
        );
        for (const table of children) {
          await legacy.query(
            `CREATE TABLE ${table}(id INT PRIMARY KEY,unit_id INT NOT NULL,FOREIGN KEY(unit_id) REFERENCES core_units(id))`
          );
          await legacy.query(`INSERT INTO ${table} VALUES(1,1),(2,2),(3,9)`);
        }
        const before = await rows(legacy, "SELECT * FROM core_units ORDER BY id");
        await runMigrationBatch(databases[1]!, coreMigrationBatch);
        await seedCoreTenantDatabase(names[1]!);
        assert.deepEqual(
          await rows(legacy, "SELECT * FROM core_units WHERE id IN(1,2,9,12) ORDER BY id"),
          before
        );
        assert.equal(
          (
            await rows(legacy, "SELECT COUNT(*) AS n FROM core_units WHERE LOWER(TRIM(name))='nos'")
          )[0]!.n,
          1
        );
        assert.equal(
          (await rows(legacy, "SELECT COUNT(*) AS n FROM core_units WHERE name='pcs'"))[0]!.n,
          1
        );
        assert.deepEqual(
          (await rows(legacy, "SELECT name,unit_id FROM core_products ORDER BY id")).map((r) => [
            r.name,
            r.unit_id
          ]),
          [
            ["-", 1],
            ["Historical", 2]
          ]
        );
        for (const table of children)
          assert.deepEqual(
            (await rows(legacy, `SELECT unit_id FROM ${table} ORDER BY id`)).map((r) => r.unit_id),
            [1, 2, 9]
          );
        assert.equal(
          (await runWithCoreDatabase(names[1]!, () => new ProductRepository().defaultReferences()))
            .unitId,
          9
        );
        assert.equal(
          (await runWithCoreDatabase(names[1]!, () => new UnitsService().list()))[0]!.id,
          9
        );
        const after = await rows(legacy, "SELECT * FROM core_units ORDER BY id");
        await runMigrationBatch(databases[1]!, coreMigrationBatch);
        await seedCoreTenantDatabase(names[1]!);
        assert.deepEqual(await rows(legacy, "SELECT * FROM core_units ORDER BY id"), after);
      }
    );
    await t.test(
      "existing table without hyphen gains defaults without repurposing ID 1",
      async () => {
        await migrateUnits(databases[2]!);
        await source.query(
          "INSERT INTO core_units(id,name,status,sort_order) VALUES(1,'Nos','active',5)"
        );
        await ensureUnitDefaults(databases[2]!);
        assert.equal(
          (await rows(source, "SELECT name FROM core_units WHERE id=1"))[0]!.name,
          "Nos"
        );
        assert.notEqual((await rows(source, "SELECT id FROM core_units WHERE name='-'"))[0]!.id, 1);
        await ensureUnitDefaults(databases[2]!);
        assert.equal(
          (await rows(source, "SELECT COUNT(*) n FROM core_units WHERE name='-'"))[0]!.n,
          1
        );
      }
    );
    await t.test(
      "Data Bridge prepares translated unit IDs, preserves conflicts, commits missing product and repeats without duplicates",
      async () => {
        await source.query(
          "CREATE TABLE core_products(id INT PRIMARY KEY,name VARCHAR(191) NOT NULL UNIQUE,unit_id INT NOT NULL,status VARCHAR(24) NOT NULL,FOREIGN KEY(unit_id) REFERENCES core_units(id))"
        );
        const hyphen = (await rows(source, "SELECT id FROM core_units WHERE name='-'"))[0]!.id;
        await source.query(
          "INSERT INTO core_products VALUES(20,'Imported product',1,'active'),(21,'-',?,'active')",
          [hyphen]
        );
        const snapshot = JSON.stringify(
          await rows(source, "SELECT * FROM core_products ORDER BY id")
        );
        const units = JSON.stringify(await rows(source, "SELECT * FROM core_units ORDER BY id"));
        await migrateDataBridgeDatabase(databases[3]!);
        let queued = 0;
        const host: CommonTableImportHost = {
          database: databases[3]!,
          authorize: () => "test",
          listTenants: async () => [],
          resolveTenant: async () => ({ ...config, id: 2, label: "Target", database: names[0]! }),
          dataMigration: {
            listSources: async () => [],
            resolveSource: async () => ({
              ...config,
              id: 1,
              label: "Source",
              database: names[2]!,
              tlsMode: "disabled" as const
            })
          },
          enqueueTransfer: async () => {
            queued++;
          }
        };
        const service = new TransferService(host);
        const prepare = async () => {
          let session = await service.create(1, 2, "test");
          session = await service.mapTables(
            session.id,
            session.revision,
            "core_products",
            "core_products",
            "test"
          );
          session = await service.mapFields(
            session.id,
            session.revision,
            [
              { target: "name", source: "name", mode: "source", value: null },
              { target: "unit_id", source: "unit_id", mode: "source", value: null },
              { target: "status", source: "status", mode: "source", value: null },
              { target: "uuid", source: null, mode: "uuid", value: null }
            ],
            "test"
          );
          return service.prepare(session.id, session.revision, [20, 21], "test");
        };
        let session = await prepare();
        assert.equal(session.rows[0]!.status, "ready");
        assert.equal(session.rows[0]!.data.unit_id, 3);
        assert.equal(session.rows[1]!.data.unit_id, 1);
        session = await service.commit(session.id, session.revision, "test", "units-test");
        session = await service.run(session.id, 2);
        assert.equal(session.rows[0]!.status, "imported");
        assert.equal(queued, 1);
        assert.equal(
          (await rows(fresh, "SELECT unit_id FROM core_products WHERE name='Imported product'"))[0]!
            .unit_id,
          3
        );
        const repeat = await prepare();
        assert.equal(repeat.rows[0]!.status, "existing");
        assert.equal(
          (
            await rows(fresh, "SELECT COUNT(*) n FROM core_products WHERE name='Imported product'")
          )[0]!.n,
          1
        );
        const legacyService = new TransferService({
          ...host,
          resolveTenant: async () => ({
            ...config,
            id: 2,
            label: "Legacy target",
            database: names[1]!
          })
        });
        let conflict = await legacyService.create(1, 2, "test");
        conflict = await legacyService.mapTables(
          conflict.id,
          conflict.revision,
          "core_products",
          "core_products",
          "test"
        );
        conflict = await legacyService.mapFields(
          conflict.id,
          conflict.revision,
          session.fields,
          "test"
        );
        conflict = await legacyService.prepare(conflict.id, conflict.revision, [21], "test");
        assert.equal(conflict.rows[0]!.status, "warning");
        assert.equal(
          (await rows(legacy, "SELECT unit_id FROM core_products WHERE name='-'"))[0]!.unit_id,
          1
        );
        assert.equal(
          JSON.stringify(await rows(source, "SELECT * FROM core_products ORDER BY id")),
          snapshot
        );
        assert.equal(
          JSON.stringify(await rows(source, "SELECT * FROM core_units ORDER BY id")),
          units
        );
      }
    );
  } finally {
    await closeCoreDatabase();
    await Promise.all(connections.map((connection) => connection.end()));
    await Promise.all(databases.map((database) => database.destroy()));
    for (const name of names) await admin.query(`DROP DATABASE IF EXISTS \`${name}\``);
    await admin.end();
  }
});
