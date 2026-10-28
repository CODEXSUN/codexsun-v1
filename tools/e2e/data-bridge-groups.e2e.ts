import assert from "node:assert/strict";
import test from "node:test";
import { randomBytes } from "node:crypto";
import { createConnection } from "mysql2/promise";
import { createPool } from "mysql2";
import { Kysely, MysqlDialect } from "kysely";
import Fastify from "fastify";
import { AppError } from "@codexsun/framework/errors";
import {
  migrateDataBridgeDatabase,
  registerDataBridgeApi,
  TransferService,
  type CommonTableImportHost
} from "../../devkits/data-bridge/api/src/index.js";
import { CommonTablesService } from "../../devkits/data-bridge/api/src/modules/common-tables/common-tables.service.js";
import { MasterTablesService } from "../../devkits/data-bridge/api/src/modules/master-tables/master-tables.service.js";
import { BillingTablesService } from "../../devkits/data-bridge/api/src/modules/billing-tables/billing-tables.service.js";
import { ReportService } from "../../devkits/data-bridge/api/src/modules/report/report.service.js";

test("grouped workflows isolate catalogs, retain sessions and map renamed Billing fields through target parents", async () => {
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
    (part) => `codexsun_bridge_groups_${part}_${suffix}`
  );
  const admin = await createConnection(config);
  let database: Kysely<unknown> | undefined;
  const app = Fastify();
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
      for (const connection of [source, target]) {
        await connection.query(
          "CREATE TABLE core_colours (id INT AUTO_INCREMENT PRIMARY KEY,name VARCHAR(32) NOT NULL UNIQUE) ENGINE=InnoDB"
        );
        await connection.query(
          "CREATE TABLE core_contacts (id INT AUTO_INCREMENT PRIMARY KEY,code VARCHAR(32) NOT NULL UNIQUE,name VARCHAR(64) NOT NULL) ENGINE=InnoDB"
        );
        await connection.query(
          "INSERT INTO core_contacts(id,code,name) VALUES (?,'CONTACT-1','Verified contact')",
          [connection === source ? 1 : 41]
        );
      }
      await source.query(
        "CREATE TABLE legacy_invoice(id INT AUTO_INCREMENT PRIMARY KEY,old_number VARCHAR(32) NOT NULL,old_contact INT NOT NULL,amount DECIMAL(12,2) NOT NULL,FOREIGN KEY(old_contact) REFERENCES core_contacts(id)) ENGINE=InnoDB"
      );
      await source.query(
        "INSERT INTO legacy_invoice(id,old_number,old_contact,amount) VALUES(7,'INVOICE-7',1,125.50)"
      );
      await target.query(
        "CREATE TABLE billing_demo_documents(id INT AUTO_INCREMENT PRIMARY KEY,number VARCHAR(32) NOT NULL UNIQUE,contact_id INT NOT NULL,total DECIMAL(12,2) NOT NULL,FOREIGN KEY(contact_id) REFERENCES core_contacts(id)) ENGINE=InnoDB"
      );
      for (const table of [
        "billing_outbox_jobs",
        "billing_domain_events",
        "billing_sales_activities",
        "billing_sales_compliance_jobs",
        "billing_sales_entry_tools",
        "billing_dashboard_snapshots",
        "billing_opening_balance_legacy_assignments"
      ])
        await target.query(`CREATE TABLE ${table}(id INT PRIMARY KEY) ENGINE=InnoDB`);
      let denied = true;
      const host: CommonTableImportHost = {
        database,
        authorize: () => {
          if (denied) throw AppError.forbidden("Super Admin required");
          return "test:groups";
        },
        listTenants: async () => [{ id: 9, label: "Target", database: names[1] }],
        resolveTenant: async (id) => {
          assert.equal(id, 9);
          return { ...config, id, label: "Target", database: names[1]! };
        },
        dataMigration: {
          listSources: async () => [],
          resolveSource: async (id) => {
            assert.equal(id, 1);
            return {
              ...config,
              user: sourceUser,
              password: sourcePassword,
              id,
              label: "Source",
              database: names[0]!,
              tlsMode: "disabled" as const
            };
          }
        },
        enqueueTransfer: async () => {}
      };
      await registerDataBridgeApi(app, host);
      for (const url of [
        "/reports",
        "/common-tables/catalog?sourceId=1&targetTenantId=9",
        "/master-tables/transfers",
        "/billing-tables/catalog?sourceId=1&targetTenantId=9"
      ])
        assert.equal(
          (await app.inject({ method: "GET", url: `/api/data-bridge${url}` })).statusCode,
          403
        );
      assert.equal(
        (
          await app.inject({
            method: "POST",
            url: "/api/data-bridge/connections/verify",
            payload: { sourceId: 1, targetTenantId: 9 }
          })
        ).statusCode,
        403
      );
      denied = false;
      assert.equal(
        (
          await app.inject({
            method: "POST",
            url: "/api/data-bridge/connections/verify",
            payload: { sourceId: 1, targetTenantId: 9 }
          })
        ).statusCode,
        200
      );
      const common = new CommonTablesService(host),
        masters = new MasterTablesService(host),
        billing = new BillingTablesService(host),
        transfers = new TransferService(host);
      assert.equal((await common.catalog(1, 9)).length, 31);
      assert.equal((await masters.catalog(1, 9)).length, 16);
      assert.deepEqual(
        (await billing.catalog(1, 9)).map((row) => row.table),
        ["billing_demo_documents"]
      );
      const commonSession = await common.create(1, 9, "test:groups");
      await assert.rejects(
        transfers.mapTables(
          commonSession.id,
          commonSession.revision,
          "legacy_invoice",
          "billing_demo_documents",
          "test:groups"
        ),
        /import group/u
      );
      await assert.rejects(
        transfers.mapTables(
          commonSession.id,
          commonSession.revision,
          "core_contacts",
          "core_contacts",
          "test:groups"
        ),
        /import group/u
      );
      assert.deepEqual((await transfers.inspect(commonSession.id)).tables.target, ["core_colours"]);
      let session = await billing.create(1, 9, "test:groups");
      assert.equal(session.context?.group, "billing");
      assert.deepEqual((await transfers.inspect(session.id)).tables.target, [
        "billing_demo_documents"
      ]);
      session = await transfers.mapTables(
        session.id,
        session.revision,
        "legacy_invoice",
        "billing_demo_documents",
        "test:groups"
      );
      session = await transfers.mapFields(
        session.id,
        session.revision,
        [
          { target: "id", source: null, mode: "default", value: null },
          { target: "number", source: "old_number", mode: "source", value: null },
          { target: "contact_id", source: "old_contact", mode: "source", value: null },
          { target: "total", source: "amount", mode: "source", value: null }
        ],
        "test:groups"
      );
      session = await transfers.prepare(session.id, session.revision, [7], "test:groups");
      assert.equal(session.rows[0]!.data.contact_id, 41);
      session = await transfers.commit(
        session.id,
        session.revision,
        "test:groups",
        "disposable-group-test"
      );
      session = await transfers.run(session.id, 9);
      assert.equal(session.status, "completed");
      const [saved] = await target.query<any[]>(
        "SELECT number,contact_id,total FROM billing_demo_documents"
      );
      assert.equal(saved[0].number, "INVOICE-7");
      assert.equal(saved[0].contact_id, 41);
      assert.equal(Number(saved[0].total), 125.5);
      assert.equal(
        (await common.list()).some((item) => item.id === session.id),
        false
      );
      assert.equal(
        (await billing.list()).some((item) => item.id === session.id),
        true
      );
      const summary = (await new ReportService(host).list()).find((row) => row.id === session.id)!;
      assert.equal(summary.group, "billing");
      assert.equal(summary.rows, 1);
      await target.query("UPDATE billing_demo_documents SET total=126 WHERE number='INVOICE-7'");
      let conflict = await billing.create(1, 9, "test:groups");
      conflict = await transfers.mapTables(
        conflict.id,
        conflict.revision,
        "legacy_invoice",
        "billing_demo_documents",
        "test:groups"
      );
      conflict = await transfers.mapFields(
        conflict.id,
        conflict.revision,
        session.fields,
        "test:groups"
      );
      conflict = await transfers.prepare(conflict.id, conflict.revision, [7], "test:groups");
      assert.equal(conflict.rows[0]!.status, "warning");
      conflict = await transfers.commit(
        conflict.id,
        conflict.revision,
        "test:groups",
        "warning-summary-test"
      );
      await transfers.run(conflict.id, 9);
      assert.equal(
        (await new ReportService(host).list()).find((row) => row.id === conflict.id)?.status,
        "warning"
      );
      const [preserved] = await target.query<any[]>("SELECT total FROM billing_demo_documents");
      assert.equal(Number(preserved[0].total), 126);
      const [original] = await source.query<any[]>(
        "SELECT old_contact FROM legacy_invoice WHERE id=7"
      );
      assert.equal(original[0].old_contact, 1);
    } finally {
      await source.end();
      await target.end();
    }
  } finally {
    await app.close();
    await database?.destroy();
    await admin.query(`DROP USER IF EXISTS '${sourceUser}'@'%'`);
    for (const name of names) await admin.query(`DROP DATABASE IF EXISTS \`${name}\``);
    await admin.end();
  }
});
