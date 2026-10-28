import assert from "node:assert/strict";
import test from "node:test";
import { Kysely, MysqlDialect, sql } from "kysely";
import { createPool } from "mysql2";
import { migrateSiteModule } from "../../apps/sites/api/src/modules/site/site.migration.ts";
import { migrateSportsclubDatabase } from "../../apps/sportsclub/api/src/sportsclub.migration.ts";

if (process.env.CODEXSUN_DISPOSABLE_MIGRATION_FIXTURE !== "1") throw new Error("Disposable fixture required.");
const database = process.env.CODEXSUN_MIGRATION_FIXTURE_DATABASE;
if (!/^codexsun_all_fresh_[a-f0-9]{8}$/.test(database || "")) throw new Error("Invalid disposable fixture database.");
const db = new Kysely({ dialect: new MysqlDialect({ pool: createPool({
  host: "host.docker.internal", port: Number(process.env.CODEXSUN_MIGRATION_TEST_PORT),
  user: "root", password: "codexsun_local_test_only", database
}) }) });

test("existing Sites and Sportsclub schemas adopt tracked migrations", async () => {
  try {
    const before = await sql`SELECT COUNT(*) AS count FROM sportsclub_members`.execute(db);
    await migrateSiteModule(db);
    await migrateSportsclubDatabase(db);
    await migrateSiteModule(db);
    await migrateSportsclubDatabase(db);
    const after = await sql`SELECT COUNT(*) AS count FROM sportsclub_members`.execute(db);
    assert.deepEqual(after.rows, before.rows);
    const ledger = await sql`SELECT name FROM migration_schema WHERE scope IN ('sites', 'sportsclub') AND status='applied'`.execute(db);
    assert.deepEqual(new Set(ledger.rows.map((row) => row.name)), new Set([
      "sites.site.portfolio", "sportsclub.tenant.baseline", "sportsclub.member.photos"
    ]));
  } finally {
    await db.destroy();
  }
});
