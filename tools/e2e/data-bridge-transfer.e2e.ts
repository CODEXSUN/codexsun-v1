import assert from "node:assert/strict";
import test from "node:test";
import { randomBytes } from "node:crypto";
import { createConnection } from "mysql2/promise";
import { createPool } from "mysql2";
import { Kysely, MysqlDialect } from "kysely";
import { migrateDataBridgeDatabase } from "../../devkits/data-bridge/api/src/modules/data-bridge/data-bridge.migration.js";
import { TransferService } from "../../devkits/data-bridge/api/src/modules/transfer-session/transfer-session.service.js";
import type { CommonTableImportHost } from "../../devkits/data-bridge/api/src/modules/import-review/import-review.types.js";
test("six-stage transfer maps different tables and fields, blocks invalid stages and preserves existing data", async () => {
  const config = {
    host: process.env.DB_HOST!,
    port: Number(process.env.DB_PORT),
    user: process.env.DB_USER!,
    password: process.env.DB_PASSWORD!
  };
  const suffix = randomBytes(4).toString("hex");
  const sourceUser = `br_${suffix}`;
  const sourcePassword = randomBytes(16).toString("hex");
  const names = ["source", "target", "master"].map((s) => `codexsun_transfer_${s}_${suffix}`);
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
      await source.query(
        "CREATE TABLE legacy_colours(id INT PRIMARY KEY,title VARCHAR(32) NOT NULL,state VARCHAR(24) NOT NULL,password VARCHAR(32))"
      );
      await source.query(
        "INSERT INTO legacy_colours VALUES(1,'Existing','active','hidden'),(2,'Missing','active','hidden'),(3,'Conflict','inactive','hidden')"
      );
      await target.query(
        "CREATE TABLE customer_colour_directory(id INT AUTO_INCREMENT PRIMARY KEY,name VARCHAR(64) NOT NULL UNIQUE,status VARCHAR(24) NOT NULL,uuid CHAR(8) NOT NULL UNIQUE)"
      );
      await target.query(
        "INSERT INTO customer_colour_directory(name,status,uuid) VALUES('Existing','active','aaaaaaaa'),('Conflict','active','bbbbbbbb')"
      );
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
        enqueueTransfer: async () => {
          queued++;
        }
      };
      const service = new TransferService(host);
      let session = await service.create(1, 2, "test");
      await assert.rejects(service.prepare(session.id, session.revision, [2], "test"), /fields/u);
      await assert.rejects(
        service.mapTables(session.id, session.revision, "legacy_colours", "users", "test"),
        /available/u
      );
      session = await service.mapTables(
        session.id,
        session.revision,
        "legacy_colours",
        "customer_colour_directory",
        "test"
      );
      await assert.rejects(
        service.mapFields(
          session.id,
          session.revision,
          [{ target: "name", source: "password", mode: "source", value: null }],
          "test"
        ),
        /required|matching/u
      );
      session = await service.mapFields(
        session.id,
        session.revision,
        [
          { target: "name", source: "title", mode: "source", value: null },
          { target: "status", source: "state", mode: "source", value: null },
          { target: "uuid", source: null, mode: "uuid", value: null }
        ],
        "test"
      );
      assert.equal((await service.preview(session.id, 1)).rows[0]?.password, undefined);
      await assert.rejects(
        service.commit(session.id, session.revision, "test", "test"),
        /Prepare/u
      );
      session = await service.prepare(session.id, session.revision, [1, 2, 3], "test");
      assert.deepEqual(
        session.rows.map((r) => r.status),
        ["existing", "ready", "warning"]
      );
      assert.equal(session.rows[1]?.data.name, "Missing");
      await assert.rejects(
        service.mapTables(session.id, 0, "legacy_colours", "customer_colour_directory", "test"),
        /changed/u
      );
      const prepared = session;
      session = await service.commit(session.id, session.revision, "test", "test");
      assert.equal(queued, 1);
      await assert.rejects(service.run(session.id, 999), /context/u);
      session = await service.run(session.id, 2);
      assert.equal(session.status, "completed");
      assert.deepEqual(
        session.rows.map((r) => r.status),
        ["existing", "imported", "warning"]
      );
      assert.equal(session.rows[1]?.target?.name, "Missing");
      assert.equal((await service.get(session.id)).rows[1]?.data.uuid, prepared.rows[1]?.data.uuid);
      await assert.rejects(
        service.mapTables(
          session.id,
          session.revision,
          "legacy_colours",
          "customer_colour_directory",
          "test"
        ),
        /cannot/u
      );
      assert.equal((await service.run(session.id, 2)).status, "completed");
      const [rows] = await target.query<any[]>(
        "SELECT name,status FROM customer_colour_directory ORDER BY id"
      );
      assert.equal(rows.length, 3);
      assert.equal(rows.find((r) => r.name === "Conflict").status, "active");
      let review = await service.create(1, 2, "test");
      review = await service.mapTables(
        review.id,
        review.revision,
        "legacy_colours",
        "customer_colour_directory",
        "test"
      );
      review = await service.mapFields(review.id, review.revision, session.fields, "test");
      review = await service.prepare(review.id, review.revision, [2], "test");
      assert.equal(review.rows[0]?.status, "existing");
      await target.query("DELETE FROM customer_colour_directory WHERE name='Missing'");
      review = await service.commit(review.id, review.revision, "test", "review-only");
      review = await service.run(review.id, 2);
      assert.equal(review.rows[0]?.status, "warning");
      const [absent] = await target.query<any[]>(
        "SELECT id FROM customer_colour_directory WHERE name='Missing'"
      );
      assert.equal(absent.length, 0);
      await target.query(
        "CREATE TABLE client_country_directory(id INT PRIMARY KEY,name VARCHAR(32) NOT NULL UNIQUE)"
      );
      await target.query("INSERT INTO client_country_directory VALUES(50,'Target parent')");
      await target.query(
        "ALTER TABLE customer_colour_directory ADD country_id INT NULL, ADD FOREIGN KEY(country_id) REFERENCES client_country_directory(id)"
      );
      let parentReview = await service.create(1, 2, "test");
      parentReview = await service.mapTables(
        parentReview.id,
        parentReview.revision,
        "legacy_colours",
        "customer_colour_directory",
        "test"
      );
      await assert.rejects(
        service.mapFields(
          parentReview.id,
          parentReview.revision,
          [...session.fields, { target: "country_id", source: "id", mode: "source", value: null }],
          "test"
        ),
        /target parent/u
      );
      assert.equal((await service.parents(parentReview.id, "country_id"))[0]?.id, 50);
      parentReview = await service.mapFields(
        parentReview.id,
        parentReview.revision,
        [...session.fields, { target: "country_id", source: null, mode: "value", value: 50 }],
        "test"
      );
      await source.query("INSERT INTO legacy_colours VALUES(4,'Broken','active','hidden')");
      await target.query(
        "ALTER TABLE customer_colour_directory ADD CONSTRAINT valid_name CHECK(name<>'Broken')"
      );
      parentReview = await service.prepare(parentReview.id, parentReview.revision, [2, 4], "test");
      assert.equal(parentReview.rows[0]?.data.country_id, 50);
      parentReview = await service.commit(
        parentReview.id,
        parentReview.revision,
        "test",
        "rollback"
      );
      parentReview = await service.run(parentReview.id, 2);
      assert.equal(parentReview.status, "failed");
      assert.ok(parentReview.rows.every((row) => row.status === "warning"));
      const [rolledBack] = await target.query<any[]>(
        "SELECT id FROM customer_colour_directory WHERE name IN ('Missing','Broken')"
      );
      assert.equal(rolledBack.length, 0);
      await source.query("INSERT INTO legacy_colours VALUES(5,'EXISTING','active','hidden')");
      let caseReview = await service.create(1, 2, "test");
      caseReview = await service.mapTables(
        caseReview.id,
        caseReview.revision,
        "legacy_colours",
        "customer_colour_directory",
        "test"
      );
      caseReview = await service.mapFields(
        caseReview.id,
        caseReview.revision,
        session.fields,
        "test"
      );
      caseReview = await service.prepare(caseReview.id, caseReview.revision, [5], "test");
      assert.equal(caseReview.rows[0]?.status, "warning");
      assert.equal(caseReview.rows[0]?.target?.name, "Existing");
      await source.query(
        "CREATE TABLE old_countries(id INT PRIMARY KEY,name VARCHAR(32) NOT NULL UNIQUE)"
      );
      await source.query("INSERT INTO old_countries VALUES(1,'Target parent'),(2,'Not imported')");
      await source.query(
        "CREATE TABLE old_offices(id INT PRIMARY KEY,title VARCHAR(32) NOT NULL,country_ref INT NOT NULL,FOREIGN KEY(country_ref) REFERENCES old_countries(id))"
      );
      await source.query("INSERT INTO old_offices VALUES(1,'Office',1),(2,'Blocked office',2)");
      await target.query(
        "CREATE TABLE client_offices(id INT AUTO_INCREMENT PRIMARY KEY,name VARCHAR(64) NOT NULL UNIQUE,country_id INT NOT NULL,FOREIGN KEY(country_id) REFERENCES client_country_directory(id))"
      );
      let office = await service.create(1, 2, "test");
      office = await service.mapTables(
        office.id,
        office.revision,
        "old_offices",
        "client_offices",
        "test"
      );
      office = await service.mapFields(
        office.id,
        office.revision,
        [
          { target: "name", source: "title", mode: "source", value: null },
          { target: "country_id", source: "country_ref", mode: "source", value: null }
        ],
        "test"
      );
      office = await service.prepare(office.id, office.revision, [1, 2], "test");
      assert.deepEqual(
        office.rows.map((row) => row.status),
        ["ready", "warning"]
      );
      assert.equal(office.rows[0]?.data.country_id, 50);
      office = await service.commit(office.id, office.revision, "test", "parents");
      office = await service.run(office.id, 2);
      assert.deepEqual(
        office.rows.map((row) => row.status),
        ["imported", "warning"]
      );
      assert.match(office.rows[1]!.message, /parent first/u);
      const [offices] = await target.query<any[]>("SELECT name,country_id FROM client_offices");
      assert.deepEqual(
        offices.map((row) => [row.name, row.country_id]),
        [["Office", 50]]
      );
      await target.query(
        "CREATE TABLE client_notes(id INT AUTO_INCREMENT PRIMARY KEY,note VARCHAR(64) NOT NULL)"
      );
      const prepareNote = async () => {
        let note = await service.create(1, 2, "test");
        note = await service.mapTables(
          note.id,
          note.revision,
          "legacy_colours",
          "client_notes",
          "test"
        );
        note = await service.mapFields(
          note.id,
          note.revision,
          [{ target: "note", source: "title", mode: "source", value: null }],
          "test"
        );
        note = await service.prepare(note.id, note.revision, [2], "test");
        return service.commit(note.id, note.revision, "test", "no-business-index");
      };
      const [noteA, noteB] = await Promise.all([prepareNote(), prepareNote()]);
      const noteResults = await Promise.all([service.run(noteA.id, 2), service.run(noteB.id, 2)]);
      assert.equal(
        noteResults.flatMap((result) => result.rows).filter((row) => row.status === "imported")
          .length,
        1
      );
      assert.equal(
        noteResults.flatMap((result) => result.rows).filter((row) => row.status === "existing")
          .length,
        1
      );
      const [notes] = await target.query<any[]>("SELECT COUNT(*) AS total FROM client_notes");
      assert.equal(Number(notes[0].total), 1);
      await source.query("ALTER TABLE old_countries ADD extra_label VARCHAR(12) NULL");
      await target.query(
        "ALTER TABLE client_country_directory DROP INDEX name, ADD extra_label VARCHAR(12) NULL"
      );
      await source.query("INSERT INTO old_offices VALUES(3,'Second office',1)");
      let noKeyParent = await service.create(1, 2, "test");
      noKeyParent = await service.mapTables(
        noKeyParent.id,
        noKeyParent.revision,
        "old_offices",
        "client_offices",
        "test"
      );
      noKeyParent = await service.mapFields(
        noKeyParent.id,
        noKeyParent.revision,
        office.fields,
        "test"
      );
      noKeyParent = await service.prepare(noKeyParent.id, noKeyParent.revision, [3], "test");
      assert.equal(noKeyParent.rows[0]?.data.country_id, 50);
      assert.equal(noKeyParent.rows[0]?.status, "ready");
      await target.query(
        "CREATE TABLE private_tokens(id INT AUTO_INCREMENT PRIMARY KEY,name VARCHAR(64) NOT NULL,password VARCHAR(64) NOT NULL)"
      );
      assert.ok((await service.inspect(noKeyParent.id)).tables.target.includes("private_tokens"));
      let sensitive = await service.create(1, 2, "test");
      sensitive = await service.mapTables(
        sensitive.id,
        sensitive.revision,
        "legacy_colours",
        "private_tokens",
        "test"
      );
      await assert.rejects(
        service.mapFields(
          sensitive.id,
          sensitive.revision,
          [{ target: "name", source: "title", mode: "source", value: null }],
          "test"
        ),
        /sensitive field password/u
      );
      await target.query(
        "CREATE TABLE custom_totals(id INT AUTO_INCREMENT PRIMARY KEY,amount INT NOT NULL,twice INT AS (amount*2) STORED)"
      );
      let generated = await service.create(1, 2, "test");
      generated = await service.mapTables(
        generated.id,
        generated.revision,
        "legacy_colours",
        "custom_totals",
        "test"
      );
      generated = await service.mapFields(
        generated.id,
        generated.revision,
        [{ target: "amount", source: null, mode: "value", value: 3 }],
        "test"
      );
      generated = await service.prepare(generated.id, generated.revision, [2], "test");
      generated = await service.commit(
        generated.id,
        generated.revision,
        "test",
        "generated-column"
      );
      generated = await service.run(generated.id, 2);
      assert.equal(generated.rows[0]?.status, "imported");
      const [totals] = await target.query<any[]>("SELECT twice FROM custom_totals");
      assert.equal(totals[0].twice, 6);
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
