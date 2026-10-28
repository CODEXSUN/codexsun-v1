import { seedCoreStandardUserAccess } from "../../apps/core/api/src/auth/tenant-permission.seed.js";
import { seedBillingStandardUserAccess } from "../../apps/billing/api/src/auth/tenant-permission.seed.js";
import { runMigrationBatch } from "@codexsun/framework/db";
import { coreMigrationBatch } from "../../apps/core/api/src/database/core-database.js";
import { BusinessImportService } from "../../devkits/data-bridge/api/src/modules/business-import/business-import.service.js";
import { BusinessImportQueries } from "../../devkits/data-bridge/api/src/modules/business-import/business-import.queries.js";
import {
  businessSummarySchema,
  businessRowSchema
} from "../../devkits/data-bridge/api/src/modules/business-import/business-import.routes.js";
import { selectUserRole } from "../../apps/platform/api/src/modules/tenant-user-role/tenant-user-role.repository.js";
import assert from "node:assert/strict";
import test from "node:test";
import { randomBytes } from "node:crypto";
import { createConnection, type RowDataPacket } from "mysql2/promise";
import { createPool } from "mysql2";
import { Kysely, MysqlDialect } from "kysely";
import {
  seedCoreTenantDatabase,
  closeCoreDatabase
} from "../../apps/core/api/src/database/core-database.js";
import { isUntouchedCompanySeed } from "../../apps/core/api/src/modules/organisation/company/company.seed-policy.js";
import { migrateDataBridgeDatabase } from "../../devkits/data-bridge/api/src/modules/data-bridge/data-bridge.migration.js";
import { TransferService } from "../../devkits/data-bridge/api/src/modules/transfer-session/transfer-session.service.js";
import type { CommonTableImportHost } from "../../devkits/data-bridge/api/src/modules/import-review/import-review.types.js";
import { copyBridgeUsers } from "../../apps/platform/api/src/modules/tenant-user/tenant-user.bridge.js";
import { hashPassword, verifyPassword } from "../../apps/platform/api/src/auth/password-hash.js";
import { migrateTenantUserModule } from "../../apps/platform/api/src/modules/tenant-user/tenant-user.migration.js";
import { migrateTenantRoleModule } from "../../apps/platform/api/src/modules/tenant-role/tenant-role.migration.js";
import { migrateTenantUserRoleModule } from "../../apps/platform/api/src/modules/tenant-user-role/tenant-user-role.migration.js";
import { migrateTenantPermissionModule } from "../../apps/platform/api/src/modules/tenant-permission/tenant-permission.migration.js";
import { migrateTenantRolePermissionModule } from "../../apps/platform/api/src/modules/tenant-role-permission/tenant-role-permission.migration.js";
import { seedTenantRoleModule } from "../../apps/platform/api/src/modules/tenant-role/tenant-role.seed.js";
import type { TenantDatabase } from "../../apps/platform/api/src/database/schema.js";

const config = {
  host: process.env.DB_HOST!,
  port: Number(process.env.DB_PORT),
  user: process.env.DB_USER!,
  password: process.env.DB_PASSWORD!
};

test("Data Bridge reuses one company seed, preserves references and copies supported user credentials", async (t) => {
  assert.ok(["127.0.0.1", "localhost", "::1"].includes(config.host));
  const sourceUser = `br_${randomBytes(4).toString("hex")}`;
  const sourcePassword = randomBytes(16).toString("hex");
  const names = ["source", "target", "master", "legacy", "business"].map(
    (side) => `codexsun_company_${side}_${randomBytes(5).toString("hex")}`
  );
  const admin = await createConnection(config);
  const pools: Kysely<TenantDatabase>[] = [];
  const connections: Awaited<ReturnType<typeof createConnection>>[] = [];
  try {
    for (const name of names) {
      await admin.query(`CREATE DATABASE \`${name}\``);
      connections.push(await createConnection({ ...config, database: name, timezone: "Z" }));
      pools.push(
        new Kysely<TenantDatabase>({
          dialect: new MysqlDialect({
            pool: createPool({ ...config, database: name, timezone: "Z" })
          })
        })
      );
    }
    await admin.query(`CREATE USER '${sourceUser}'@'%' IDENTIFIED BY '${sourcePassword}'`);
    await admin.query(`GRANT SELECT ON \`${names[0]}\`.* TO '${sourceUser}'@'%'`);
    const source = connections[0]!,
      target = connections[1]!;
    const rows = async (connection: typeof source, sql: string) =>
      (await connection.query<RowDataPacket[]>(sql))[0];
    await seedCoreTenantDatabase(names[1]!);
    await migrateDataBridgeDatabase(pools[2]!);
    await source.query(
      "CREATE TABLE core_companies(id INT PRIMARY KEY,code VARCHAR(80) NOT NULL UNIQUE,name VARCHAR(191) NOT NULL,status VARCHAR(24) NOT NULL)"
    );
    await source.query("INSERT INTO core_companies VALUES(20,'CLIENT','Client company','active')");
    await target.query(
      "CREATE TABLE company_reference_proof(id INT PRIMARY KEY,company_id INT NOT NULL,FOREIGN KEY(company_id) REFERENCES core_companies(id))"
    );
    await target.query("INSERT INTO company_reference_proof VALUES(1,1)");
    const companyBefore = (await rows(target, "SELECT * FROM core_companies"))[0]!;
    assert.equal(isUntouchedCompanySeed(companyBefore), true, JSON.stringify(companyBefore));
    const host: CommonTableImportHost = {
      database: pools[2]!,
      isCompanySeed: isUntouchedCompanySeed,
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
      enqueueTransfer: async () => {}
    };
    const service = new TransferService(host);
    const prepare = async (table: string, ids: number[], fields: string[]) => {
      let session = await service.create(1, 2, "test");
      session = await service.mapTables(session.id, session.revision, table, table, "test");
      session = await service.mapFields(
        session.id,
        session.revision,
        [
          ...fields.map((field) => ({
            target: field,
            source: field,
            mode: "source" as const,
            value: null
          })),
          { target: "uuid", source: null, mode: "uuid", value: null }
        ],
        "test"
      );
      return service.prepare(session.id, session.revision, ids, "test");
    };
    const execute = async (session: Awaited<ReturnType<typeof prepare>>) => {
      session = await service.commit(session.id, session.revision, "test", "company-test");
      return service.run(session.id, 2);
    };
    await t.test(
      "older seed rows gain provenance without changing identities or default references",
      async () => {
        const legacy = connections[3]!;
        const old = {
          ...coreMigrationBatch,
          steps: coreMigrationBatch.steps.filter((step) => !step.name.includes("seed-marker-v3"))
        };
        await runMigrationBatch(pools[3]!, old);
        await legacy.query("INSERT INTO core_companies(code,name) VALUES('CODEXSUN','codexsun')");
        await legacy.query(
          "INSERT INTO core_financial_years(name,start_date,end_date,is_current,status) VALUES('2026-2027','2026-04-01','2027-03-31',1,'active')"
        );
        await legacy.query(
          "INSERT INTO core_default_company_settings(company_id,financial_year_id,landing_app) VALUES(1,1,'application')"
        );
        const before = (await rows(legacy, "SELECT * FROM core_companies"))[0]!;
        await runMigrationBatch(pools[3]!, coreMigrationBatch);
        const after = (await rows(legacy, "SELECT * FROM core_companies"))[0]!;
        const { seed_placeholder, ...unchanged } = after;
        assert.equal(seed_placeholder, 1);
        assert.deepEqual(unchanged, before);
        assert.equal(
          (await rows(legacy, "SELECT seed_placeholder FROM core_default_company_settings"))[0]!
            .seed_placeholder,
          1
        );
        await runMigrationBatch(pools[3]!, coreMigrationBatch);
        assert.equal((await rows(legacy, "SELECT COUNT(*) n FROM core_companies"))[0]!.n, 1);
      }
    );
    await t.test(
      "an existing business match wins over the seed without creating another company",
      async () => {
        await target.query(
          "INSERT INTO core_companies(code,name,status) VALUES('CLIENT','Client company','active')"
        );
        const found = await prepare("core_companies", [20], ["code", "name", "status"]);
        assert.equal(found.rows[0]!.status, "existing");
        assert.equal(found.rows[0]!.reuse, undefined);
        await execute(found);
        assert.equal((await rows(target, "SELECT COUNT(*) n FROM core_companies"))[0]!.n, 2);
        assert.equal(
          (await rows(target, "SELECT name FROM core_companies WHERE id=1"))[0]!.name,
          "codexsun"
        );
        await target.query("DELETE FROM core_companies WHERE code='CLIENT'");
      }
    );
    await t.test(
      "multiple source companies do not create a duplicate or guess a seed mapping",
      async () => {
        await source.query(
          "INSERT INTO core_companies VALUES(21,'OTHER','Other company','active')"
        );
        const planned = await prepare("core_companies", [20, 21], ["code", "name", "status"]);
        assert.ok(planned.rows.every((row) => row.status === "warning"));
        await execute(planned);
        assert.deepEqual(await rows(target, "SELECT * FROM core_companies"), [companyBefore]);
        await source.query("DELETE FROM core_companies WHERE id=21");
      }
    );
    await t.test(
      "single-company preparation is read-only and detects target changes before writing",
      async () => {
        const planned = await prepare("core_companies", [20], ["code", "name", "status"]);
        assert.equal(planned.rows[0]!.reuse?.targetId, 1, planned.rows[0]!.message);
        assert.equal(planned.rows[0]!.reuse?.sourceCount, 1);
        assert.deepEqual(await rows(target, "SELECT * FROM core_companies"), [companyBefore]);
        await target.query("UPDATE core_companies SET legal_name='Operator change' WHERE id=1");
        const failed = await execute(planned);
        assert.equal(failed.status, "failed");
        assert.equal((await rows(target, "SELECT name FROM core_companies"))[0]!.name, "codexsun");
        await target.query("UPDATE core_companies SET legal_name=NULL WHERE id=1");
      }
    );
    await t.test(
      "confirmed reuse keeps company ID, UUID, creation metadata and foreign references",
      async () => {
        const planned = await prepare("core_companies", [20], ["code", "name", "status"]);
        const imported = await execute(planned);
        assert.equal(imported.status, "completed");
        assert.equal(imported.rows[0]!.status, "imported");
        const companies = await rows(target, "SELECT * FROM core_companies");
        assert.equal(companies.length, 1);
        for (const name of ["id", "uuid", "created_by", "created_at"])
          assert.deepEqual(companies[0]![name], companyBefore[name]);
        assert.equal(companies[0]!.name, "Client company");
        assert.equal(companies[0]!.seed_placeholder, 0);
        assert.equal(
          (await rows(target, "SELECT company_id FROM company_reference_proof"))[0]!.company_id,
          1
        );
        assert.equal(
          (await prepare("core_companies", [20], ["code", "name", "status"])).rows[0]!.status,
          "existing"
        );
      }
    );
    await t.test(
      "default-company seed is updated in place after target company and financial-year resolution",
      async () => {
        const before = (await rows(target, "SELECT * FROM core_default_company_settings"))[0]!;
        const year = (
          await rows(
            target,
            "SELECT name,DATE_FORMAT(start_date,'%Y-%m-%d') start_date,DATE_FORMAT(end_date,'%Y-%m-%d') end_date FROM core_financial_years WHERE id=" +
              before.financial_year_id
          )
        )[0]!;
        await source.query(
          "CREATE TABLE core_financial_years(id INT PRIMARY KEY,name VARCHAR(120) NOT NULL UNIQUE,start_date DATE NOT NULL,end_date DATE NOT NULL)"
        );
        await source.query("INSERT INTO core_financial_years VALUES(90,?,?,?)", [
          year.name,
          year.start_date,
          year.end_date
        ]);
        await source.query(
          "CREATE TABLE core_default_company_settings(id INT PRIMARY KEY,singleton_key TINYINT UNIQUE,company_id INT NOT NULL,financial_year_id INT NOT NULL,landing_app VARCHAR(80) NOT NULL,status VARCHAR(24) NOT NULL,FOREIGN KEY(company_id) REFERENCES core_companies(id),FOREIGN KEY(financial_year_id) REFERENCES core_financial_years(id))"
        );
        await source.query(
          "INSERT INTO core_default_company_settings VALUES(4,1,20,90,'billing','active')"
        );
        const prepared = await prepare(
          "core_default_company_settings",
          [4],
          ["singleton_key", "company_id", "financial_year_id", "landing_app", "status"]
        );
        assert.equal(prepared.rows[0]!.data.company_id, 1);
        assert.equal(prepared.rows[0]!.data.financial_year_id, before.financial_year_id);
        const saved = await execute(prepared);
        assert.equal(saved.status, "completed");
        const current = (await rows(target, "SELECT * FROM core_default_company_settings"))[0]!;
        assert.equal(current.id, before.id);
        assert.equal(current.uuid, before.uuid);
        assert.equal(current.company_id, 1);
        assert.equal(current.landing_app, "billing");
      }
    );
    await t.test(
      "user copy keeps supported hashes, lowers source admins to User and preserves existing accounts",
      async () => {
        for (const pool of [pools[0]!, pools[1]!]) {
          await migrateTenantUserModule(pool);
          await migrateTenantRoleModule(pool);
          await migrateTenantUserRoleModule(pool);
          await migrateTenantPermissionModule(pool);
          await migrateTenantRolePermissionModule(pool);
          await seedTenantRoleModule(pool);
        }
        const originalHash = hashPassword("Fixture-password-1!");
        const targetHash = hashPassword("Keep-target-password-2!");
        for (const [id, name, email, hash, role] of [
          [1, "New", "new@example.test", originalHash, "user"],
          [2, "Source admin", "source-admin@example.test", originalHash, "admin"],
          [3, "Existing", "existing@example.test", originalHash, "user"],
          [4, "Unsupported", "invalid@example.test", "unsupported-hash", "user"]
        ])
          await source.query(
            "INSERT INTO app_users(id,uuid,name,email,password_hash,role,status) VALUES(?,?,?,?,?,?,'active')",
            [id, String(id).padStart(8, "0"), name, email, hash, role]
          );
        await target.query(
          "INSERT INTO app_users(uuid,name,email,password_hash,role,status,is_protected) VALUES('00000099','Existing target','existing@example.test',?,'admin','active',1)",
          [targetHash]
        );
        const assignmentsBefore = await rows(target, "SELECT * FROM app_user_roles ORDER BY id");
        await seedCoreStandardUserAccess(pools[1]! as unknown as Kysely<unknown>);
        await seedBillingStandardUserAccess(pools[1]! as unknown as Kysely<unknown>);
        assert.deepEqual(
          await rows(target, "SELECT * FROM app_user_roles ORDER BY id"),
          assignmentsBefore
        );
        const original = await rows(source, "SELECT * FROM app_users ORDER BY id");
        const existing = (
          await rows(target, "SELECT * FROM app_users WHERE email='existing@example.test'")
        )[0]!;
        await assert.rejects(
          copyBridgeUsers(
            source,
            pools[1]!,
            async () => {
              throw Error("Denied");
            },
            selectUserRole
          ),
          /Denied/u
        );
        const report = await copyBridgeUsers(source, pools[1]!, async () => {}, selectUserRole);
        assert.deepEqual([report.imported, report.existing, report.warnings], [2, 1, 1]);
        for (const email of ["new@example.test", "source-admin@example.test"]) {
          const account = (
            await target.query<RowDataPacket[]>("SELECT * FROM app_users WHERE email=?", [email])
          )[0][0]!;
          assert.equal(account.password_hash, originalHash);
          assert.equal(verifyPassword("Fixture-password-1!", account.password_hash), true);
          assert.equal(account.role, "user");
          assert.equal(account.is_protected, 0);
          const [roles] = await target.query<RowDataPacket[]>(
            "SELECT r.`key` FROM app_user_roles ur JOIN app_roles r ON r.id=ur.role_id WHERE ur.user_id=? AND ur.status='active'",
            [account.id]
          );
          assert.deepEqual(
            roles.map((role) => role.key),
            ["user"]
          );
        }
        assert.deepEqual(
          (await rows(target, "SELECT * FROM app_users WHERE email='existing@example.test'"))[0],
          existing
        );
        assert.equal(JSON.stringify(report).includes(originalHash), false);
        const repeat = await copyBridgeUsers(source, pools[1]!, async () => {}, selectUserRole);
        assert.equal(repeat.imported, 0);
        assert.equal(repeat.existing, 3);
        assert.deepEqual(await rows(source, "SELECT * FROM app_users ORDER BY id"), original);
      }
    );
    await t.test(
      "ordered business run persists sanitized user outcomes and exposes user warnings",
      async () => {
        const businessHost: CommonTableImportHost = {
          ...host,
          enqueueBusiness: async () => {},
          copyUsers: async () => copyBridgeUsers(source, pools[1]!, async () => {}, selectUserRole)
        };
        const business = new BusinessImportService(businessHost);
        const queued = await business.start(1, 2, "test", "company-users-business");
        const result = await business.run(queued.id, 2);
        assert.equal(result.users?.imported, 0);
        assert.equal(result.users?.existing, 3);
        assert.equal(result.users?.warnings, 1);
        assert.equal(result.status, "warning");
        businessSummarySchema.parse(result);
        const warnings = await new BusinessImportQueries(businessHost).warnings(result.id, 1);
        assert.ok(warnings.rows.some((row) => row.group === "users" && row.table === "app_users"));
        assert.equal(JSON.stringify(result).includes("pbkdf2$"), false);
      }
    );
    await t.test(
      "unresolved company mapping holds user credentials without calling the account writer",
      async () => {
        await source.query(
          "INSERT INTO core_companies VALUES(21,'UNRESOLVED','Unresolved company','active')"
        );
        let called = false;
        const blockedHost: CommonTableImportHost = {
          ...host,
          enqueueBusiness: async () => {},
          copyUsers: async () => {
            called = true;
            return copyBridgeUsers(source, pools[1]!, async () => {}, selectUserRole);
          }
        };
        const business = new BusinessImportService(blockedHost);
        const started = await business.start(1, 2, "test", "blocked-company-users");
        const result = await business.run(started.id, 2);
        assert.equal(called, false);
        assert.equal(result.users?.imported, 0);
        assert.equal(result.users?.warnings, 1);
        assert.match(result.users!.rows[0]!.message, /company\/default-company/u);
        await source.query("DELETE FROM core_companies WHERE id=21");
      }
    );
    await t.test(
      "ordered import reuses fresh company/default seeds and reports updates separately from inserts",
      async () => {
        await source.query(
          "CREATE TABLE core_units(id INT PRIMARY KEY,name VARCHAR(255) NOT NULL UNIQUE,status VARCHAR(24) NOT NULL,sort_order INT NOT NULL)"
        );
        await source.query(
          "INSERT INTO core_units VALUES(10,'Nos','active',9),(99,'-','active',1)"
        );
        await source.query(
          "CREATE TABLE core_products(id INT PRIMARY KEY,name VARCHAR(191) NOT NULL UNIQUE,unit_id INT NOT NULL,status VARCHAR(24) NOT NULL,FOREIGN KEY(unit_id) REFERENCES core_units(id))"
        );
        await source.query(
          "INSERT INTO core_products VALUES(12,'Unit-referenced product',10,'active'),(13,'-',99,'active')"
        );

        await seedCoreTenantDatabase(names[4]!);
        for (const migrate of [
          migrateTenantUserModule,
          migrateTenantRoleModule,
          migrateTenantUserRoleModule,
          migrateTenantPermissionModule,
          migrateTenantRolePermissionModule
        ])
          await migrate(pools[4]!);
        await seedTenantRoleModule(pools[4]!);
        const snapshots = await Promise.all(
          [
            "core_companies",
            "core_default_company_settings",
            "core_financial_years",
            "app_users"
          ].map((table) => rows(source, `SELECT * FROM ${table} ORDER BY id`))
        );
        const businessHost: CommonTableImportHost = {
          ...host,
          resolveTenant: async () => ({
            ...config,
            id: 3,
            label: "Fresh target",
            database: names[4]!
          }),
          enqueueBusiness: async () => {},
          copyUsers: async () => copyBridgeUsers(source, pools[4]!, async () => {}, selectUserRole)
        };
        const business = new BusinessImportService(businessHost);
        const started = await business.start(1, 3, "test", "fresh-company-business");
        const result = await business.run(started.id, 3);
        assert.equal(result.tables.find((table) => table.table === "core_companies")?.updated, 1);
        assert.equal(result.tables.find((table) => table.table === "core_companies")?.imported, 0);
        const companyRows = await new BusinessImportQueries(businessHost).rows(
          result.id,
          "core_companies",
          1,
          "all"
        );
        companyRows.rows.forEach((row) => businessRowSchema.parse(row));
        assert.equal(companyRows.rows[0]!.reuse?.targetId, 1);
        assert.equal(
          result.tables.find((table) => table.table === "core_default_company_settings")?.updated,
          1
        );
        assert.equal(result.users?.imported, 3);
        assert.equal(result.users?.warnings, 1);
        assert.equal(result.tables.find((table) => table.table === "core_units")?.warnings, 0);
        assert.equal(result.tables.find((table) => table.table === "core_products")?.warnings, 0);
        assert.equal(
          (
            await rows(
              connections[4]!,
              "SELECT unit_id FROM core_products WHERE name='Unit-referenced product'"
            )
          )[0]!.unit_id,
          3
        );
        const unitRows = await new BusinessImportQueries(businessHost).rows(
          result.id,
          "core_units",
          1,
          "all"
        );
        const nos = unitRows.rows.find((row) => row.source.name === "Nos")!;
        assert.equal(nos.status, "existing");
        assert.equal(nos.data.name, "nos");
        assert.equal(nos.data.sort_order, 2);
        assert.equal(
          (await rows(source, "SELECT sort_order FROM core_units WHERE name='Nos'"))[0]!.sort_order,
          9
        );

        assert.equal(
          (await rows(connections[4]!, "SELECT COUNT(*) n FROM core_companies"))[0]!.n,
          1
        );
        assert.equal(
          (await rows(connections[4]!, "SELECT company_id FROM core_default_company_settings"))[0]!
            .company_id,
          1
        );
        assert.deepEqual(
          await Promise.all(
            [
              "core_companies",
              "core_default_company_settings",
              "core_financial_years",
              "app_users"
            ].map((table) => rows(source, `SELECT * FROM ${table} ORDER BY id`))
          ),
          snapshots
        );
      }
    );
    await t.test(
      "confirmed exact seed matches are claimed and cannot be renamed by a later source",
      async () => {
        await source.query(
          "CREATE TABLE exact_company_source(id INT PRIMARY KEY,code VARCHAR(80) NOT NULL UNIQUE,name VARCHAR(191) NOT NULL,status VARCHAR(24) NOT NULL)"
        );
        await source.query(
          "INSERT INTO exact_company_source VALUES(77,'CODEXSUN','codexsun','active')"
        );
        const legacyService = new TransferService({
          ...host,
          resolveTenant: async () => ({
            ...config,
            id: 4,
            label: "Legacy target",
            database: names[3]!
          })
        });
        const review = async (table: string, id: number) => {
          let session = await legacyService.create(1, 4, "test");
          session = await legacyService.mapTables(
            session.id,
            session.revision,
            table,
            "core_companies",
            "test"
          );
          session = await legacyService.mapFields(
            session.id,
            session.revision,
            ["code", "name", "status"].map((field) => ({
              source: field,
              target: field,
              mode: "source" as const,
              value: null
            })),
            "test"
          );
          return legacyService.prepare(session.id, session.revision, [id], "test");
        };
        let matching = await review("exact_company_source", 77);
        assert.equal(matching.rows[0]!.status, "existing");
        matching = await legacyService.commit(matching.id, matching.revision, "test", "claim-seed");
        await legacyService.run(matching.id, 4);
        assert.equal(
          (await rows(connections[3]!, "SELECT seed_placeholder FROM core_companies"))[0]!
            .seed_placeholder,
          0
        );
        const different = await review("core_companies", 20);
        assert.equal(different.rows[0]!.status, "warning");
        assert.equal(
          (await rows(connections[3]!, "SELECT name FROM core_companies"))[0]!.name,
          "codexsun"
        );
      }
    );
  } finally {
    await closeCoreDatabase();
    await Promise.all(connections.map((c) => c.end()));
    await Promise.all(pools.map((p) => p.destroy()));
    await admin.query(`DROP USER IF EXISTS '${sourceUser}'@'%'`);
    for (const name of names) await admin.query(`DROP DATABASE IF EXISTS \`${name}\``);
    await admin.end();
  }
});
