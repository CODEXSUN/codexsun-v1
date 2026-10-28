import assert from "node:assert/strict";
import test from "node:test";
import { Kysely, MysqlDialect, sql } from "kysely";
import { createPool } from "mysql2";
import { migrateSiteModule } from "../../apps/sites/api/src/modules/site/site.migration.ts";
import { migrateSportsclubDatabase } from "../../apps/sportsclub/api/src/sportsclub.migration.ts";

if (process.env.CODEXSUN_DISPOSABLE_MIGRATION_FIXTURE !== "1") throw new Error("Disposable fixture required.");
const port = Number(process.env.CODEXSUN_MIGRATION_TEST_PORT);
if (!Number.isInteger(port) || port < 1024) throw new Error("Invalid Docker fixture port.");
const db = new Kysely({ dialect: new MysqlDialect({ pool: createPool({
  host: "host.docker.internal", port, user: "root", password: "codexsun_local_test_only",
  database: "codexsun_migration_populated_fixture"
}) }) });

test("adopts populated legacy Sites and Sportsclub tables without losing rows", async () => {
  try {
    await migrateSiteModule(db);
    await migrateSportsclubDatabase(db);
    await sql`INSERT INTO sites_portfolio_sites (uuid,name,slug,primary_domain,theme_key)
      VALUES ('fixture1','Existing site','existing-site','existing.example','default')`.execute(db);
    await sql`INSERT INTO sportsclub_programs (uuid,code,name,discipline,description)
      VALUES ('fixture2','EXISTING','Existing program','sport','Preserve this record')`.execute(db);
    await sql`DELETE FROM migration_schema WHERE scope IN ('sites','sportsclub')`.execute(db);
    await migrateSiteModule(db);
    await migrateSportsclubDatabase(db);
    await migrateSiteModule(db);
    await migrateSportsclubDatabase(db);
    const sites = await sql`SELECT uuid,name,slug,primary_domain,theme_key FROM sites_portfolio_sites`.execute(db);
    assert.deepEqual(sites.rows, [{ uuid: "fixture1", name: "Existing site", slug: "existing-site", primary_domain: "existing.example", theme_key: "default" }]);
    const programs = await sql`SELECT uuid,code,name,description FROM sportsclub_programs`.execute(db);
    assert.deepEqual(programs.rows, [{ uuid: "fixture2", code: "EXISTING", name: "Existing program", description: "Preserve this record" }]);
    const ledger = await sql`SELECT name FROM migration_schema WHERE scope IN ('sites','sportsclub') AND status='applied'`.execute(db);
    assert.deepEqual(new Set(ledger.rows.map((row) => row.name)), new Set([
      "sites.site.portfolio", "sportsclub.tenant.baseline", "sportsclub.member.photos"
    ]));
  } finally {
    await db.destroy();
  }
});
