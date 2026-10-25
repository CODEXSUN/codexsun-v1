/**
 * Safe Docker Disposable Test Tenant Fixture Tooling
 *
 * SAFETY CONTRACT:
 * 1. Zero hardcoded database secrets: Reads credentials dynamically from the internal container
 *    environment (or process.env) without logging, printing, or persisting them.
 * 2. Run-unique reserved tenant & database identity: Generates a run-unique hexadecimal token
 *    (e.g., corporateId: CXT[HEX], db_name: codexsun_cxtest_[hex]).
 * 3. Collision fail-closed: Asserts that neither the database nor the corporate ID exists before
 *    touching anything. Never pre-drops or deletes existing entities.
 * 4. Official owner migrations for new empty schema: Invokes the official platform
 *    provisionTenantDatabase() migration and seed pipeline via the container runtime loader.
 *    Zero customer row cloning, zero customer tenant mutation.
 * 5. Strict ownership-verified cleanup: Records the exact inserted tenant row ID and ownership tag
 *    (payload_settings containing run-unique signature). Cleanup deletes only that verified ID
 *    and drops only the exact run-matching database name.
 */
import assert from "node:assert/strict";
import { execSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { createConnection, type Connection } from "mysql2/promise";
import { hashPassword } from "../../../platform/api/src/auth/password-hash.js";

const DOCKER_API_BASE = "http://127.0.0.1:18010/api/app";
const DOCKER_DB_HOST = "127.0.0.1";
const DOCKER_DB_PORT = 13306;

/**
 * Discovers database credentials safely from container or process environment
 * without printing, persisting, or leaking secrets to logs.
 */
function getDatabaseCredentials(): { host: string; password: string; port: number; user: string } {
  if (process.env.DB_PASSWORD) {
    const host = process.env.DB_HOST || DOCKER_DB_HOST;
    const port = Number(process.env.DB_PORT || DOCKER_DB_PORT);
    if (host !== "127.0.0.1" && host !== "localhost") {
      throw new Error(
        `Safety violation: Non-local database host "${host}" refused. Fixture runner is strictly restricted to local loopback.`
      );
    }
    if (port !== DOCKER_DB_PORT) {
      throw new Error(
        `Safety violation: Non-standard database port "${port}" refused. Expected local container port ${DOCKER_DB_PORT}.`
      );
    }
    return {
      host,
      password: process.env.DB_PASSWORD,
      port,
      user: process.env.DB_USER || "root"
    };
  }

  // Extract root password internally from the running MariaDB container without printing it
  try {
    const rawSecret = execSync("docker exec cxapp-mariadb printenv MARIADB_ROOT_PASSWORD", {
      encoding: "utf8",
      stdio: ["pipe", "pipe", "ignore"]
    }).trim();

    if (!rawSecret) {
      throw new Error("Empty secret received from cxapp-mariadb container.");
    }

    return {
      host: DOCKER_DB_HOST,
      password: rawSecret,
      port: DOCKER_DB_PORT,
      user: "root"
    };
  } catch (err) {
    throw new Error(
      "Safety failure: Could not discover local Docker database credentials from container environment. " +
      "Process aborted to prevent insecure fallback."
    );
  }
}

export async function countMasterTenants(): Promise<number> {
  const creds = getDatabaseCredentials();
  const conn = await createConnection({
    database: "codexsun_master_db",
    host: creds.host,
    password: creds.password,
    port: creds.port,
    user: creds.user
  });
  try {
    const [rows] = await conn.query<any[]>("SELECT COUNT(*) as count FROM tenants");
    return Number(rows[0].count);
  } finally {
    await conn.end();
  }
}

export interface SafeProvisionedFixture {
  cleanup: () => Promise<void>;
  corporateId: string;
  disposableDb: string;
  password: string;
  runId: string;
  tenantId: number;
  userEmail: string;
  userTwoEmail: string;
}

/**
 * Prepares an idempotent, isolated test tenant using run-unique identifiers,
 * official owner migrations, and ownership-verified cleanup.
 */
export async function prepareSafeDisposableTenant(): Promise<SafeProvisionedFixture> {
  const creds = getDatabaseCredentials();

  // 1. Generate run-unique identity and ownership signature
  const runId = randomBytes(4).toString("hex").toLowerCase(); // 8 hex chars
  const corporateId = `CXT${runId.slice(0, 5).toUpperCase()}`; // Exactly 8 chars, e.g. "CXT1A2B3"
  const disposableDb = `codexsun_cxtest_${runId}`;
  const ownershipSignature = `cxmobile-fixture-${runId}`;
  const tenantUuid = randomBytes(4).toString("hex"); // Exactly 8 chars (char(8))

  const userEmail = `cxtest-staff-${runId}@codexsun.invalid`;
  const userTwoEmail = `cxtest-chat-${runId}@codexsun.invalid`;
  const disposableUserPassword = `TestPass_${randomBytes(8).toString("hex")}!`;
  const passwordHash = hashPassword(disposableUserPassword);

  const masterConn = await createConnection({
    database: "codexsun_master_db",
    host: creds.host,
    password: creds.password,
    port: creds.port,
    user: creds.user
  });

  let createdDb = false;
  let insertedTenantId: number | null = null;

  try {
    // 2. Collision Check: Verify neither the corporate ID nor database exists.
    // If ANY match is found, FAIL CLOSED immediately without dropping or deleting!
    const [existingTenants] = await masterConn.query<any[]>(
      "SELECT id, corporate_id, db_name FROM tenants WHERE corporate_id = ? OR db_name = ?",
      [corporateId, disposableDb]
    );
    if (existingTenants && existingTenants.length > 0) {
      throw new Error(
        `Safety collision: Tenant with corporateId "${corporateId}" or db_name "${disposableDb}" already exists. Aborting.`
      );
    }

    const [existingSchemas] = await masterConn.query<any[]>(
      "SELECT SCHEMA_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME = ?",
      [disposableDb]
    );
    if (existingSchemas && existingSchemas.length > 0) {
      throw new Error(
        `Safety collision: Database "${disposableDb}" already exists in MariaDB. Aborting.`
      );
    }

    // 3. Register tenant in codexsun_master_db.tenants with explicit ownership metadata
    const enabledModules = JSON.stringify([
      "crm",
      "crm.enquiry",
      "billing",
      "billing.sales",
      "billing.quotation",
      "chat",
      "ecommerce",
      "ecommerce.catalog.product-information"
    ]);

    const payloadSettings = JSON.stringify({
      _owner: "cxmobile-fixture",
      createdAt: new Date().toISOString(),
      runId,
      signature: ownershipSignature
    });

    const [insertResult] = await masterConn.query<any>(
      `INSERT INTO tenants (
        uuid, tenant_code, tenant_name, corporate_id, slug, status,
        db_type, db_host, db_port, db_name, db_user, db_secret_ref,
        enabled_module_keys, default_landing_app, payload_settings,
        storage_root, storage_public_root, storage_private_root,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, 'active', 'mariadb', 'cxapp-mariadb', 3306, ?, 'root', 'DB_PASSWORD', ?, 'crm', ?, '', '', '', NOW(), NOW())`,
      [
        tenantUuid,
        corporateId,
        `CX Mobile Fixture ${runId}`,
        corporateId,
        `cxtest-${runId}`,
        disposableDb,
        enabledModules,
        payloadSettings
      ]
    );

    insertedTenantId = Number(insertResult.insertId);
    assert.ok(insertedTenantId > 0, "Failed to insert tenant registration row.");

    // 4. Create empty schema for the new tenant
    await masterConn.query(
      `CREATE DATABASE \`${disposableDb}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
    );
    createdDb = true;

    // 5. Execute official owner migrations in the container runtime for the new tenant
    // Uses the platform's own production resolution loader and provisionTenantDatabase()
    const containerProvisionScript = `
      import { getTenantDatabase, closeTenantDatabase } from '/app/dist/apps/platform/api/database/tenant-database.js';
      import { migrateTenantRuntimeModule } from '/app/dist/apps/platform/api/modules/tenant/tenant.migration.js';
      import { seedTenantRuntimeModule } from '/app/dist/apps/platform/api/modules/tenant/tenant.seed.js';
      import { migrateCoreTenantDatabase, seedCoreTenantDatabase } from '@codexsun/core-api';
      import { migrateCrmTenantDatabase, seedCrmTenantDatabase } from '@codexsun/crm-api';
      import { migrateBillingTenantDatabase, seedBillingTenantDatabase } from '@codexsun/billing-api';
      import { migrateChatModule, seedChatModule } from '@codexsun/chat-api';
      import { migrateEcommerceTenantDatabase, seedEcommerceTenantModules } from '@codexsun/ecommerce-api';

      const tenant = {
        id: ${insertedTenantId},
        uuid: '${tenantUuid}',
        tenantCode: '${corporateId}',
        tenantName: 'CX Mobile Fixture ${runId}',
        corporateId: '${corporateId}',
        slug: 'cxtest-${runId}',
        status: 'active',
        dbType: 'mariadb',
        dbHost: 'cxapp-mariadb',
        dbPort: 3306,
        dbName: '${disposableDb}',
        dbUser: 'root',
        dbSecretRef: 'DB_PASSWORD',
        enabledModuleKeys: ${enabledModules},
        defaultLandingApp: 'crm',
        payloadSettings: {},
        storageRoot: '',
        storagePublicRoot: '',
        storagePrivateRoot: ''
      };

      const database = getTenantDatabase(tenant);
      try {
        await migrateTenantRuntimeModule(database);
        await migrateCoreTenantDatabase(tenant.dbName);
        await migrateCrmTenantDatabase(database);
        await migrateBillingTenantDatabase(tenant.dbName);
        await migrateChatModule(database);
        await migrateEcommerceTenantDatabase(database);

        await seedTenantRuntimeModule(database, tenant);
        await seedCoreTenantDatabase(tenant.dbName);
        await seedCrmTenantDatabase(database);
        await seedBillingTenantDatabase(tenant.dbName);
        await seedChatModule(database);
        await seedEcommerceTenantModules(database, tenant.uuid);

        console.log('CONTAINER_PROVISION_OK');
        process.exit(0);
      } catch (err) {
        console.error('PROVISION_ERROR:', err);
        process.exit(1);
      } finally {
        await closeTenantDatabase(tenant);
      }
    `;

    const b64 = Buffer.from(containerProvisionScript, "utf8").toString("base64");
    const scriptPath = `/tmp/provision-${runId}.mjs`;

    execSync(`docker exec codexsun-api sh -c "echo '${b64}' | base64 -d > ${scriptPath}"`, {
      encoding: "utf8"
    });

    try {
      const provisionOutput = execSync(
        `docker exec codexsun-api node --import ./tools/register-production-package-resolution.mjs ${scriptPath}`,
        { encoding: "utf8", timeout: 300_000 }
      );

      if (!provisionOutput.includes("CONTAINER_PROVISION_OK")) {
        throw new Error(`Container migration failed: ${provisionOutput}`);
      }
    } finally {
      try {
        execSync(`docker exec codexsun-api rm -f ${scriptPath}`, { stdio: "ignore" });
      } catch {}
    }

    // 6. Connect to newly provisioned tenant DB and insert verified disposable test users
    const tenantConn = await createConnection({
      database: disposableDb,
      host: creds.host,
      password: creds.password,
      port: creds.port,
      user: creds.user
    });

    try {
      // Find admin role ID provisioned by seedTenantRuntimeModule
      const [roles] = await tenantConn.query<any[]>(
        "SELECT id, `key` FROM app_roles WHERE `key` = 'admin' LIMIT 1"
      );
      const adminRoleId = roles && roles[0] ? roles[0].id : 1;

      // Seed Staff Field User
      await tenantConn.query(
        `INSERT INTO app_users (
          uuid, name, email, username, password_hash, role, status, is_protected, created_at, updated_at
        ) VALUES (lcase(substr(md5(uuid()),1,8)), 'Staff Field Agent', ?, 'cxteststaff', ?, 'admin', 'active', 0, NOW(), NOW())`,
        [userEmail, passwordHash]
      );

      const [staffUsers] = await tenantConn.query<any[]>(
        "SELECT id FROM app_users WHERE email = ? LIMIT 1",
        [userEmail]
      );
      if (staffUsers && staffUsers[0]) {
        await tenantConn.query(
          "INSERT INTO app_user_roles (uuid, user_id, role_id, status, created_at, updated_at) VALUES (lcase(substr(md5(uuid()),1,8)), ?, ?, 'active', NOW(), NOW())",
          [staffUsers[0].id, adminRoleId]
        );
      }

      // Seed Chat Colleague User
      const [staffRoles] = await tenantConn.query<any[]>(
        "SELECT id, `key` FROM app_roles WHERE `key` = 'staff' LIMIT 1"
      );
      const staffRoleId = staffRoles && staffRoles[0] ? staffRoles[0].id : adminRoleId;

      await tenantConn.query(
        `INSERT INTO app_users (
          uuid, name, email, username, password_hash, role, status, is_protected, created_at, updated_at
        ) VALUES (lcase(substr(md5(uuid()),1,8)), 'Chat Colleague User', ?, 'cxtestchat', ?, 'staff', 'active', 0, NOW(), NOW())`,
        [userTwoEmail, passwordHash]
      );

      const [chatUsers] = await tenantConn.query<any[]>(
        "SELECT id FROM app_users WHERE email = ? LIMIT 1",
        [userTwoEmail]
      );
      if (chatUsers && chatUsers[0]) {
        await tenantConn.query(
          "INSERT INTO app_user_roles (uuid, user_id, role_id, status, created_at, updated_at) VALUES (lcase(substr(md5(uuid()),1,8)), ?, ?, 'active', NOW(), NOW())",
          [chatUsers[0].id, staffRoleId]
        );
      }
    } finally {
      await tenantConn.end();
    }

    // 7. Define ownership-verified cleanup function
    const cleanup = async () => {
      const cleanupConn = await createConnection({
        database: "codexsun_master_db",
        host: creds.host,
        password: creds.password,
        port: creds.port,
        user: creds.user
      });

      try {
        // Drop database ONLY if it strictly matches our run's exact disposable DB pattern
        if (createdDb && disposableDb.startsWith("codexsun_cxtest_") && disposableDb.length === 24) {
          await cleanupConn.query(`DROP DATABASE IF EXISTS \`${disposableDb}\``);
        }

        // Delete tenant row ONLY by exact inserted ID, corporateId, and verified ownership tag
        if (insertedTenantId) {
          await cleanupConn.query(
            "DELETE FROM tenants WHERE id = ? AND corporate_id = ? AND payload_settings LIKE ?",
            [insertedTenantId, corporateId, `%${ownershipSignature}%`]
          );
        }
      } catch (err) {
        console.error("Safe cleanup error:", (err as Error).message);
      } finally {
        await cleanupConn.end();
      }
    };

    return {
      cleanup,
      corporateId,
      disposableDb,
      password: disposableUserPassword,
      runId,
      tenantId: insertedTenantId,
      userEmail,
      userTwoEmail
    };
  } catch (err) {
    // Fail-safe cleanup if an error occurred midway during setup
    if (createdDb && disposableDb.startsWith("codexsun_cxtest_") && disposableDb.length === 24) {
      try {
        await masterConn.query(`DROP DATABASE IF EXISTS \`${disposableDb}\``);
      } catch {}
    }
    if (insertedTenantId) {
      try {
        await masterConn.query(
          "DELETE FROM tenants WHERE id = ? AND corporate_id = ? AND payload_settings LIKE ?",
          [insertedTenantId, corporateId, `%${ownershipSignature}%`]
        );
      } catch {}
    }
    throw err;
  } finally {
    await masterConn.end();
  }
}
