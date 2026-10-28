import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import test from "node:test";
import { Kysely, MysqlDialect, sql } from "kysely";
import { createPool } from "mysql2";
import { createConnection } from "mysql2/promise";
import { runMigrationBatch } from "@codexsun/framework/db";
import { migrateAccountingTablePrefixModule } from "../../apps/accounts/api/src/modules/accounting/accounting.migration.ts";
import {
  frappeTenantMigrationBatch,
  migrateFrappeTenantDatabase
} from "../../apps/frappe/api/src/modules/connection/connection.migration.ts";
import {
  mailMigrationBatch,
  migrateMailModule
} from "../../apps/mail/api/src/modules/mail/mail.migration.ts";
import {
  upgradeProductVariantOptions,
  upgradeProductVariantCanonicalOptions
} from "../../apps/ecommerce/api/src/modules/product-variant/product-variant.migration.ts";

if (
  process.env.CODEXSUN_DISPOSABLE_MIGRATION_FIXTURE !== "1" ||
  process.env.NODE_ENV !== "test" ||
  process.env.DB_HOST !== "host.docker.internal"
) {
  throw new Error("This test requires a disposable local Docker database.");
}
const settings = {
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  user: "root",
  password: "codexsun_local_test_only"
};
if (!Number.isInteger(settings.port) || settings.port < 1024)
  throw new Error("Invalid fixture port.");

async function withFixture(name, run) {
  const admin = await createConnection(settings);
  const databaseName = `codexsun_historical_${name}_${randomBytes(4).toString("hex")}`;
  let database;
  let created = false;
  try {
    await admin.query(`CREATE DATABASE \`${databaseName}\``);
    created = true;
    database = new Kysely({
      dialect: new MysqlDialect({ pool: createPool({ ...settings, database: databaseName }) })
    });
    await run(database);
  } finally {
    await database?.destroy();
    if (created) await admin.query(`DROP DATABASE \`${databaseName}\``);
    await admin.end();
  }
}

test("Accounts legacy table prefix migration preserves populated related records", async () => {
  await withFixture("accounts", async (db) => {
    await sql`CREATE TABLE acc_account_groups (id INT PRIMARY KEY, name VARCHAR(80) NOT NULL) ENGINE=InnoDB`.execute(
      db
    );
    await sql`CREATE TABLE acc_accounts (id INT PRIMARY KEY, group_id INT NOT NULL, name VARCHAR(80) NOT NULL, FOREIGN KEY (group_id) REFERENCES acc_account_groups(id)) ENGINE=InnoDB`.execute(
      db
    );
    await sql`INSERT INTO acc_account_groups VALUES (1,'Legacy group')`.execute(db);
    await sql`INSERT INTO acc_accounts VALUES (2,1,'Legacy account')`.execute(db);
    await migrateAccountingTablePrefixModule(db);
    await migrateAccountingTablePrefixModule(db);
    const result =
      await sql`SELECT a.id,a.name,g.name AS group_name FROM accounts_accounts a JOIN accounts_account_groups g ON g.id=a.group_id`.execute(
        db
      );
    assert.deepEqual(result.rows, [{ id: 2, name: "Legacy account", group_name: "Legacy group" }]);
    const fk =
      await sql`SELECT REFERENCED_TABLE_NAME AS parent FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='accounts_accounts' AND REFERENCED_TABLE_NAME IS NOT NULL`.execute(
        db
      );
    assert.equal(fk.rows[0]?.parent, "accounts_account_groups");
  });
});

test("Accounts prefix collisions stop before renaming populated tables", async () => {
  await withFixture("accounts_collision", async (db) => {
    await sql`CREATE TABLE acc_account_groups (id INT PRIMARY KEY, name VARCHAR(80) NOT NULL)`.execute(
      db
    );
    await sql`CREATE TABLE accounts_account_groups (id INT PRIMARY KEY, name VARCHAR(80) NOT NULL)`.execute(
      db
    );
    await sql`INSERT INTO acc_account_groups VALUES (1,'Legacy')`.execute(db);
    await sql`INSERT INTO accounts_account_groups VALUES (2,'Current')`.execute(db);
    await assert.rejects(
      migrateAccountingTablePrefixModule(db),
      /both legacy and current tables exist/
    );
    assert.deepEqual((await sql`SELECT * FROM acc_account_groups`.execute(db)).rows, [
      { id: 1, name: "Legacy" }
    ]);
    assert.deepEqual((await sql`SELECT * FROM accounts_account_groups`.execute(db)).rows, [
      { id: 2, name: "Current" }
    ]);
  });
});

test("Frappe natural-key history gains identity without losing source and enquiry links", async () => {
  await withFixture("frappe", async (db) => {
    await sql`CREATE TABLE crm_enquiries (id INT PRIMARY KEY) ENGINE=InnoDB`.execute(db);
    await sql`INSERT INTO crm_enquiries VALUES (7)`.execute(db);
    const baseline = {
      ...frappeTenantMigrationBatch,
      steps: frappeTenantMigrationBatch.steps.slice(0, 1)
    };
    await runMigrationBatch(db, baseline);
    await sql`INSERT INTO frappe_data_sources (module_key,provider,updated_by) VALUES ('crm.enquiries','frappe','fixture')`.execute(
      db
    );
    await sql`INSERT INTO frappe_enquiry_sync (enquiry_id,remote_name) VALUES (7,'LEGACY-ENQUIRY')`.execute(
      db
    );
    const first = await migrateFrappeTenantDatabase(db);
    assert.ok(first.applied.includes("frappe.connection.standard-columns-v2"));
    const sources =
      await sql`SELECT id,uuid,module_key,provider,updated_by FROM frappe_data_sources`.execute(db);
    assert.equal(sources.rows[0]?.module_key, "crm.enquiries");
    assert.equal(sources.rows[0]?.provider, "frappe");
    assert.equal(sources.rows[0]?.updated_by, "fixture");
    assert.ok(Number(sources.rows[0]?.id) > 0 && sources.rows[0]?.uuid);
    const links = await sql`SELECT enquiry_id,remote_name FROM frappe_enquiry_sync`.execute(db);
    assert.deepEqual(links.rows, [{ enquiry_id: 7, remote_name: "LEGACY-ENQUIRY" }]);
    assert.equal((await migrateFrappeTenantDatabase(db)).applied.length, 0);
  });
});

test("Mail retirement preserves populated provider metadata and secrets", async () => {
  await withFixture("mail", async (db) => {
    await runMigrationBatch(db, {
      ...mailMigrationBatch,
      steps: mailMigrationBatch.steps.slice(0, 4)
    });
    await sql`INSERT INTO mail_settings (uuid,company_id,provider,hostinger_mailbox_id,hostinger_api_token_secret,smtp_password_secret,inbound_password_secret) VALUES ('feedcafe',42,'hostinger-api','legacy-mailbox','encrypted-fixture','smtp-fixture','imap-fixture')`.execute(
      db
    );
    const first = await runMigrationBatch(db, mailMigrationBatch);
    assert.ok(first.applied.includes("mail.smtp-only-provider-v1"));
    const rows =
      await sql`SELECT company_id,provider,retired_provider_kind,retired_provider_mailbox_id,retired_provider_api_token_secret,smtp_password_secret,inbound_password_secret FROM mail_settings WHERE uuid='feedcafe'`.execute(
        db
      );
    assert.deepEqual(rows.rows, [
      {
        company_id: 42,
        provider: "smtp",
        retired_provider_kind: "hostinger-api",
        retired_provider_mailbox_id: "legacy-mailbox",
        retired_provider_api_token_secret: "encrypted-fixture",
        smtp_password_secret: "smtp-fixture",
        inbound_password_secret: "imap-fixture"
      }
    ]);
    assert.equal((await runMigrationBatch(db, mailMigrationBatch)).applied.length, 0);
    await migrateMailModule(db);
  });
});

test("Ecommerce legacy option rows gain distinct canonical signatures", async () => {
  await withFixture("ecommerce", async (db) => {
    await sql`CREATE TABLE ecommerce_product_variants (id INT PRIMARY KEY, product_information_id INT NOT NULL, sku VARCHAR(120) NOT NULL, option_1_name VARCHAR(80) NOT NULL, option_1_value VARCHAR(120) NOT NULL, option_2_name VARCHAR(80) NOT NULL DEFAULT '', option_2_value VARCHAR(120) NOT NULL DEFAULT '', option_3_name VARCHAR(80) NOT NULL DEFAULT '', option_3_value VARCHAR(120) NOT NULL DEFAULT '') ENGINE=InnoDB`.execute(
      db
    );
    await sql`INSERT INTO ecommerce_product_variants (id,product_information_id,sku,option_1_name,option_1_value) VALUES (1,10,'RED','Color','Red'),(2,10,'BLUE','Color','Blue')`.execute(
      db
    );
    const batch = {
      batch: 1,
      scope: "ecommerce.historical-fixture",
      version: "1",
      description: "Legacy variant upgrade",
      steps: [
        {
          name: "options",
          checksum: "fixture-options-v1",
          version: 1,
          description: "Add option fields",
          up: upgradeProductVariantOptions
        },
        {
          name: "canonical",
          checksum: "fixture-canonical-v1",
          version: 2,
          description: "Canonicalize options",
          up: upgradeProductVariantCanonicalOptions
        }
      ]
    };
    assert.equal((await runMigrationBatch(db, batch)).applied.length, 2);
    const rows =
      await sql`SELECT id,sku,option_1_name,option_1_value,option_signature FROM ecommerce_product_variants ORDER BY id`.execute(
        db
      );
    assert.deepEqual(
      rows.rows.map(({ id, sku, option_1_name, option_1_value }) => ({
        id,
        sku,
        option_1_name,
        option_1_value
      })),
      [
        { id: 1, sku: "RED", option_1_name: "Color", option_1_value: "Red" },
        { id: 2, sku: "BLUE", option_1_name: "Color", option_1_value: "Blue" }
      ]
    );
    for (const row of rows.rows) assert.match(row.option_signature, /^[a-f0-9]{64}$/u);
    assert.notEqual(rows.rows[0].option_signature, rows.rows[1].option_signature);
    assert.equal((await runMigrationBatch(db, batch)).skipped.length, 2);
  });
});

test("Ecommerce duplicate legacy options fail before rewriting populated records", async () => {
  await withFixture("ecommerce_collision", async (db) => {
    await sql`CREATE TABLE ecommerce_product_variants (id INT PRIMARY KEY, product_information_id INT NOT NULL, sku VARCHAR(120) NOT NULL, option_1_name VARCHAR(80) NOT NULL, option_1_value VARCHAR(120) NOT NULL, option_2_name VARCHAR(80) NOT NULL DEFAULT '', option_2_value VARCHAR(120) NOT NULL DEFAULT '', option_3_name VARCHAR(80) NOT NULL DEFAULT '', option_3_value VARCHAR(120) NOT NULL DEFAULT '') ENGINE=InnoDB`.execute(
      db
    );
    await sql`INSERT INTO ecommerce_product_variants (id,product_information_id,sku,option_1_name,option_1_value) VALUES (1,10,'ONE','Color','Red'),(2,10,'TWO',' color ',' red ')`.execute(
      db
    );
    await upgradeProductVariantOptions(db);
    await assert.rejects(
      upgradeProductVariantCanonicalOptions(db),
      /canonical product option duplicate/
    );
    const rows =
      await sql`SELECT id,sku,option_1_name,option_1_value,option_signature FROM ecommerce_product_variants ORDER BY id`.execute(
        db
      );
    assert.deepEqual(rows.rows, [
      { id: 1, sku: "ONE", option_1_name: "Color", option_1_value: "Red", option_signature: "" },
      { id: 2, sku: "TWO", option_1_name: " color ", option_1_value: " red ", option_signature: "" }
    ]);
  });
});
