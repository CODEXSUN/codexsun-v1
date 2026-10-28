import assert from "node:assert/strict";
import test from "node:test";
import { randomBytes } from "node:crypto";
import { createConnection, type RowDataPacket } from "mysql2/promise";
import { createPool } from "mysql2";
import { Kysely, MysqlDialect } from "kysely";
import Fastify from "fastify";
import { AppError } from "@codexsun/framework/errors";
import {
  migrateDataBridgeDatabase,
  registerDataBridgeApi,
  TransferService,
  BusinessImportService,
  businessImportWorker,
  type CommonTableImportHost
} from "../../devkits/data-bridge/api/src/index.js";

test("business import orders groups, maps renamed invoice descendants, preserves conflicts and paginates its report", async () => {
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
    (part) => `codexsun_bridge_business_${part}_${suffix}`
  );
  const admin = await createConnection(config);
  const app = Fastify();
  let database: Kysely<unknown> | undefined;
  let source: Awaited<ReturnType<typeof createConnection>> | undefined;
  let target: Awaited<ReturnType<typeof createConnection>> | undefined;
  try {
    for (const name of names) await admin.query(`CREATE DATABASE \`${name}\``);
    await admin.query(`CREATE USER '${sourceUser}'@'%' IDENTIFIED BY '${sourcePassword}'`);
    await admin.query(`GRANT SELECT ON \`${names[0]}\`.* TO '${sourceUser}'@'%'`);
    source = await createConnection({ ...config, database: names[0] });
    target = await createConnection({ ...config, database: names[1] });
    database = new Kysely({
      dialect: new MysqlDialect({ pool: createPool({ ...config, database: names[2] }) })
    });
    await migrateDataBridgeDatabase(database);
    for (const db of [source, target]) {
      await db.query(
        "CREATE TABLE core_units(id INT AUTO_INCREMENT PRIMARY KEY,name VARCHAR(32) NOT NULL UNIQUE) ENGINE=InnoDB"
      );
      await db.query(
        "CREATE TABLE core_products(id INT AUTO_INCREMENT PRIMARY KEY,name VARCHAR(32) NOT NULL UNIQUE,unit_id INT NOT NULL,FOREIGN KEY(unit_id) REFERENCES core_units(id)) ENGINE=InnoDB"
      );
    }
    await source.query("INSERT INTO core_units VALUES(4,'kg'),(5,'piece')");
    await target.query("INSERT INTO core_units VALUES(41,'kg')");
    await source.query("INSERT INTO core_products VALUES(20,'shirt',4),(21,'preserved',4)");
    await target.query("INSERT INTO core_products VALUES(80,'preserved',41)");
    await source.query(
      "CREATE TABLE legacy_invoices(id INT AUTO_INCREMENT PRIMARY KEY,old_number VARCHAR(32) NOT NULL UNIQUE,amount DECIMAL(12,2) NOT NULL,deleted_at DATETIME NULL) ENGINE=InnoDB"
    );
    await target.query(
      "CREATE TABLE billing_sales(id INT AUTO_INCREMENT PRIMARY KEY,invoice_number VARCHAR(32) NOT NULL UNIQUE,total DECIMAL(12,2) NOT NULL,deleted_at DATETIME NULL) ENGINE=InnoDB"
    );
    await source.query(
      "CREATE TABLE legacy_lines(id INT AUTO_INCREMENT PRIMARY KEY,document_id INT NOT NULL,sequence_no INT NOT NULL,legacy_product INT NOT NULL,quantity DECIMAL(12,2) NOT NULL,UNIQUE(document_id,sequence_no),FOREIGN KEY(document_id) REFERENCES legacy_invoices(id),FOREIGN KEY(legacy_product) REFERENCES core_products(id)) ENGINE=InnoDB"
    );
    await target.query(
      "CREATE TABLE billing_sales_items(id INT AUTO_INCREMENT PRIMARY KEY,sales_id INT NOT NULL,line_number INT NOT NULL,product_id INT NOT NULL,qty DECIMAL(12,2) NOT NULL,UNIQUE(sales_id,line_number),FOREIGN KEY(sales_id) REFERENCES billing_sales(id),FOREIGN KEY(product_id) REFERENCES core_products(id)) ENGINE=InnoDB"
    );
    await source.query(
      "CREATE TABLE legacy_assets(id INT AUTO_INCREMENT PRIMARY KEY,line_id INT NOT NULL,asset VARCHAR(128) NOT NULL,UNIQUE(line_id,asset),FOREIGN KEY(line_id) REFERENCES legacy_lines(id)) ENGINE=InnoDB"
    );
    await target.query(
      "CREATE TABLE billing_sales_item_assets(id INT AUTO_INCREMENT PRIMARY KEY,item_id INT NOT NULL,asset VARCHAR(128) NOT NULL,UNIQUE(item_id,asset),FOREIGN KEY(item_id) REFERENCES billing_sales_items(id)) ENGINE=InnoDB"
    );
    await target.query("CREATE TABLE billing_outbox_jobs(id INT PRIMARY KEY) ENGINE=InnoDB");
    await source.query(
      "INSERT INTO legacy_invoices VALUES(7,'INV-7',125.50,'2026-01-01'),(8,'INV-8',50,NULL)"
    );
    await source.query("INSERT INTO legacy_lines VALUES(17,7,1,20,2),(18,8,1,20,1)");
    await source.query(
      "INSERT INTO legacy_assets VALUES(27,17,'signed-asset'),(28,18,'active-asset')"
    );
    for (let id = 100; id < 201; id++) {
      await source.query("INSERT INTO legacy_invoices VALUES(?,?,10,NULL)", [id, `PAGE-${id}`]);
      await source.query("INSERT INTO core_units VALUES(?,?)", [id, `unit-${id}`]);
    }
    let denied = true,
      queued = "";
    const host: CommonTableImportHost = {
      database,
      authorize: () => {
        if (denied) throw AppError.forbidden("Super Admin required");
        return "test:business";
      },
      listTenants: async () => [{ id: 9, label: "Disposable target", database: names[1] }],
      resolveTenant: async (id) => {
        assert.equal(id, 9);
        return { ...config, id, label: "Disposable target", database: names[1]! };
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
            label: "Disposable source",
            database: names[0]!,
            tlsMode: "disabled" as const
          };
        }
      },
      enqueueBusiness: async (payload) => {
        queued = payload.runId;
      },
      enqueueTransfer: async () => {}
    };
    await registerDataBridgeApi(app, host);
    const prefix = "/api/data-bridge/business-imports";
    for (const path of [
      "/latest?sourceId=1&targetTenantId=9",
      "/00000000-0000-4000-8000-000000000001",
      "/00000000-0000-4000-8000-000000000001/rows?table=billing_sales",
      "/00000000-0000-4000-8000-000000000001/invoices",
      "/00000000-0000-4000-8000-000000000001/warnings"
    ])
      assert.equal((await app.inject({ method: "GET", url: prefix + path })).statusCode, 403);
    denied = false;
    assert.equal(
      (
        await app.inject({
          method: "POST",
          url: prefix,
          payload: { sourceId: 1, targetTenantId: 9 }
        })
      ).statusCode,
      400
    );
    const transfers = new TransferService(host);
    for (const [origin, destination, pairs] of [
      [
        "legacy_invoices",
        "billing_sales",
        [
          ["old_number", "invoice_number"],
          ["amount", "total"],
          ["deleted_at", "deleted_at"]
        ]
      ],
      [
        "legacy_lines",
        "billing_sales_items",
        [
          ["document_id", "sales_id"],
          ["sequence_no", "line_number"],
          ["legacy_product", "product_id"],
          ["quantity", "qty"]
        ]
      ],
      [
        "legacy_assets",
        "billing_sales_item_assets",
        [
          ["line_id", "item_id"],
          ["asset", "asset"]
        ]
      ]
    ] as const) {
      let mapping = await transfers.create(1, 9, "test:business");
      mapping = await transfers.mapTables(
        mapping.id,
        mapping.revision,
        origin,
        destination,
        "test:business"
      );
      await transfers.mapFields(
        mapping.id,
        mapping.revision,
        [
          { target: "id", source: null, mode: "default", value: null },
          ...pairs.map(([from, to]) => ({
            target: to,
            source: from,
            mode: "source" as const,
            value: null
          }))
        ],
        "test:business"
      );
    }
    const service = new BusinessImportService(host);
    await assert.rejects(
      businessImportWorker(host)(
        { payload: { runId: "invalid", targetTenantId: 9 }, tenantId: "9" },
        async () => {}
      ),
      /target context/u
    );
    const [sourceBefore] = await source.query(
      "CHECKSUM TABLE core_units, core_products, legacy_invoices, legacy_lines"
    );
    const started = await service.start(1, 9, "test:business", "fixture");
    assert.equal(started.id, queued);
    assert.equal((await service.start(1, 9, "test:business", "fixture")).id, started.id);
    await assert.rejects(service.run(started.id, 10), /target/u);
    const phases: string[] = [];
    const result = await service.run(started.id, 9, async (p) => {
      if (phases.at(-1) !== p.phase) phases.push(p.phase);
    });
    const [sourceAfter] = await source.query(
      "CHECKSUM TABLE core_units, core_products, legacy_invoices, legacy_lines"
    );
    assert.deepEqual(sourceAfter, sourceBefore);
    assert.deepEqual(phases, ["common", "masters", "billing", "invoices", "complete"]);
    assert.equal(
      result.status,
      "success",
      JSON.stringify(result.tables.filter((t) => t.status === "warning"))
    );
    assert.equal(result.invoiceMatched, 103);
    assert.equal(result.invoiceWarnings, 0);
    assert.equal(result.orphans, 0);
    assert.ok(!result.tables.some((t) => t.table === "billing_outbox_jobs"));
    const [saved] = await target.query<RowDataPacket[]>(
      "SELECT s.invoice_number,s.deleted_at,i.product_id,i.qty,p.name,p.unit_id,a.asset FROM billing_sales s JOIN billing_sales_items i ON i.sales_id=s.id JOIN core_products p ON p.id=i.product_id JOIN billing_sales_item_assets a ON a.item_id=i.id ORDER BY s.invoice_number"
    );
    assert.equal(saved.length, 2);
    assert.equal(saved[0]!.name, "shirt");
    assert.equal(saved[0]!.unit_id, 41);
    assert.equal(saved[0]!.asset, "signed-asset");
    assert.ok(saved[0]!.deleted_at);
    const invoices = await app.inject({ method: "GET", url: `${prefix}/${started.id}/invoices` });
    assert.equal(invoices.statusCode, 200, invoices.body);
    assert.equal(invoices.json().data.rows[0].children.length, 2);
    assert.equal(invoices.json().data.total, 103);
    assert.equal(invoices.json().data.rows.length, 100);
    const nextInvoices = await app.inject({
      method: "GET",
      url: `${prefix}/${started.id}/invoices?page=2`
    });
    assert.equal(nextInvoices.json().data.rows.length, 3);
    const nextUnits = await app.inject({
      method: "GET",
      url: `${prefix}/${started.id}/rows?table=core_units&page=2`
    });
    assert.equal(nextUnits.json().data.total, 103);
    assert.equal(nextUnits.json().data.rows.length, 3);
    const rows = await app.inject({
      method: "GET",
      url: `${prefix}/${started.id}/rows?table=billing_sales_items&invoiceTable=billing_sales&invoiceSourceId=7`
    });
    assert.equal(rows.statusCode, 200, rows.body);
    assert.equal(rows.json().data.total, 1);
    assert.equal(rows.json().data.rows[0].data.product_id, saved[0]!.product_id);
    assert.equal(
      (
        await app.inject({
          method: "GET",
          url: `${prefix}/${started.id}/rows?table=billing_sales&invoiceTable=billing_sales`
        })
      ).statusCode,
      400
    );
    const repeated = await service.run(started.id, 9);
    assert.equal(repeated.invoiceCount, 103);
    const second = await service.start(1, 9, "test:business", "rerun");
    const rerun = await service.run(second.id, 9);
    assert.equal(rerun.status, "success");
    assert.equal(
      rerun.tables.reduce((n, t) => n + t.imported, 0),
      0
    );
    await target.query("UPDATE billing_sales SET total=999 WHERE invoice_number='INV-7'");
    await source.query("INSERT INTO legacy_lines VALUES(19,7,2,20,3)");
    const third = await service.start(1, 9, "test:business", "conflict");
    const conflict = await service.run(third.id, 9);
    assert.equal(conflict.status, "warning");
    assert.equal(conflict.invoiceWarnings, 1);
    const [totals] = await target.query<RowDataPacket[]>(
      "SELECT total FROM billing_sales WHERE invoice_number='INV-7'"
    );
    assert.equal(Number(totals[0]!.total), 999);
    const [lines] = await target.query<RowDataPacket[]>(
      "SELECT COUNT(*) total FROM billing_sales_items"
    );
    assert.equal(Number(lines[0]!.total), 2);
    const warnings = await app.inject({ method: "GET", url: `${prefix}/${third.id}/warnings` });
    assert.equal(warnings.statusCode, 200, warnings.body);
    assert.ok(warnings.json().data.total >= 2);
    const reports = await app.inject({ method: "GET", url: "/api/data-bridge/reports" });
    assert.equal(reports.statusCode, 200, reports.body);
    assert.ok(
      reports
        .json()
        .data.some((r: { type: string; id: string }) => r.type === "business" && r.id === third.id)
    );
    assert.equal(
      reports.json().data.filter((r: { type: string }) => r.type === "business").length,
      3
    );
    const internalIds = new Set(conflict.tables.flatMap((t) => t.sessions));
    assert.ok(!reports.json().data.some((r: { id: string }) => internalIds.has(r.id)));
    const fourth = await service.start(1, 9, "test:business", "source-drift");
    let changed = false;
    const drift = await service.run(fourth.id, 9, async (progress) => {
      if (progress.phase === "invoices" && !changed) {
        changed = true;
        await source!.query("UPDATE core_units SET name='changed-during-import' WHERE id=4");
      }
    });
    assert.equal(drift.status, "warning");
    assert.equal(drift.tables.find((t) => t.table === "core_units")!.sourceChanged, true);
    const [preservedUnit] = await target.query<RowDataPacket[]>(
      "SELECT name FROM core_units WHERE id=41"
    );
    assert.equal(preservedUnit[0]!.name, "kg");
  } finally {
    await app.close();
    await source?.end();
    await target?.end();
    await database?.destroy();
    await admin.query(`DROP USER IF EXISTS '${sourceUser}'@'%'`);
    for (const name of names) await admin.query(`DROP DATABASE IF EXISTS \`${name}\``);
    await admin.end();
  }
});
