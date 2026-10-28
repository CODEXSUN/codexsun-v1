import "./marketing-import-migration-contract.test.mjs";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  legacyMigrationSchemaTableName,
  migrationChecksum,
  migrationSchemaTableName,
  planMigrationSchemaAdoption,
  planTablePrefixChanges,
  planTablePrefixRollback
} from "../dist/packages/framework/db/migrations.js";

const platformMasterTables = new Set([
  "access_permissions",
  "access_roles",
  "access_users",
  "auth_sessions",
  "auth_login_attempts",
  "database_maintenance_runs",
  "entitlements",
  "industries",
  "password_reset_requests",
  "plans",
  "platform_activity",
  "platform_apps",
  "platform_auth_users",
  "queue_jobs",
  "queue_runtime_settings",
  "storage_objects",
  "subscriptions",
  "task_manager_lookups",
  "task_manager_todos",
  "tenant_audit_events",
  "tenant_domains",
  "tenants"
]);

const frappeLegacyKeyedTables = new Set([
  "frappe_data_sources",
  "frappe_connection_settings",
  "frappe_enquiry_sync",
  "frappe_user_mappings"
]);

function hasTenantOwnerPrefix(file, table) {
  if (
    /^(app|accounts|auditor|core|billing|chat|crm|codexsun|devkit|ecommerce|frappe|mail|notes|logicx_erp|project_manager|zetro|zuno)_/.test(
      table
    )
  ) {
    return true;
  }
  // Contact 360 shipped these names before the CRM owner prefix contract existed.
  return file.replaceAll("\\", "/").startsWith("apps/crm/") && table.startsWith("contact_");
}

const migrationFiles = execFileSync("rg", ["--files", "apps", "devkits", "-g", "*.migration.ts"], {
  encoding: "utf8"
})
  .trim()
  .split(/\r?\n/)
  .filter(Boolean);
const runtimeDatabaseFiles = execFileSync(
  "rg",
  [
    "--files",
    "apps/platform/api/src",
    "apps/core/api/src",
    "apps/billing/api/src",
    "apps/mail/api/src",
    "tools/e2e",
    "-g",
    "*.ts"
  ],
  { encoding: "utf8" }
)
  .trim()
  .split(/\r?\n/)
  .filter(Boolean);

test("every fresh SQL table follows its database ownership naming contract", () => {
  const failures = [];
  for (const file of migrationFiles) {
    const source = readFileSync(file, "utf8");
    for (const { table, body } of sqlTableDefinitions(source)) {
      if (table.startsWith("app_") && platformMasterTables.has(table.slice(4))) {
        failures.push(`${file}: ${table} prefixes a master table`);
      } else if (platformMasterTables.has(table)) {
        // Platform master tables are intentionally unprefixed.
      } else if (!hasTenantOwnerPrefix(file, table)) {
        failures.push(`${file}: ${table} has no tenant owner prefix`);
      }
      const columnNames = sqlColumnNames(body);
      for (const name of new Set(columnNames)) {
        if (columnNames.filter((candidate) => candidate === name).length > 1) {
          failures.push(`${file}: ${table} declares ${name} more than once`);
        }
      }
      // The Frappe v1 definitions adopt tables with natural keys. A recorded v2
      // step converts them in place and adds the standard columns.
      if (
        frappeLegacyKeyedTables.has(table) &&
        file.replaceAll("\\", "/").startsWith("apps/frappe/")
      ) {
        if (!source.includes("ensureStandardTableColumns")) {
          failures.push(`${file}: ${table} has no standard-column upgrade`);
        }
        continue;
      }
      for (const [column, pattern] of [
        ["id", /\bid\s+INT\s+NOT NULL\s+AUTO_INCREMENT\s+PRIMARY KEY\b/i],
        ["uuid", /\buuid\s+(?:VAR)?CHAR\((?:8|36)\)\s+NOT NULL\b/i],
        ["status", /\bstatus\s+VARCHAR\(/i],
        ["created_by", /\bcreated_by\s+/i],
        ["created_at", /\bcreated_at\s+/i],
        ["updated_at", /\bupdated_at\s+/i]
      ]) {
        if (!pattern.test(body)) failures.push(`${file}: ${table} is missing valid ${column}`);
      }
    }
    for (const match of source.matchAll(/\.createTable\("([^"]+)"\)([\s\S]*?)\.execute\(\);/g)) {
      const [, table, body] = match;
      if (table.startsWith("app_") && platformMasterTables.has(table.slice(4))) {
        failures.push(`${file}: ${table} prefixes a master table`);
      } else if (platformMasterTables.has(table)) {
        // Platform master tables are intentionally unprefixed.
      } else if (!hasTenantOwnerPrefix(file, table)) {
        failures.push(`${file}: ${table} has no tenant owner prefix`);
      }
      for (const column of ["id", "uuid", "status", "created_by", "created_at", "updated_at"]) {
        if (!body.includes(`.addColumn("${column}"`))
          failures.push(`${file}: ${table} is missing ${column}`);
      }
    }
    // These recorded Task Manager steps predate this baseline check.
    const sourceForDropCheck = file
      .replaceAll("\\", "/")
      .endsWith("/task-manager/task-manager.migration.ts")
      ? source
          .replaceAll("ALTER TABLE task_manager_todos DROP COLUMN IF EXISTS visibility", "")
          .replaceAll("ALTER TABLE task_manager_todos DROP COLUMN IF EXISTS description", "")
      : source;
    if (/\bDROP\s+(?:TABLE|COLUMN)\b/i.test(sourceForDropCheck)) {
      failures.push(`${file}: destructive DROP is forbidden in the consolidated baseline`);
    }
  }
  assert.deepEqual(failures, []);
});

function sqlTableDefinitions(source) {
  const definitions = [];
  const marker = "CREATE TABLE IF NOT EXISTS ";
  for (let cursor = 0; (cursor = source.indexOf(marker, cursor)) >= 0;) {
    const tableStart = cursor + marker.length;
    const open = source.indexOf("(", tableStart);
    if (open < 0) break;
    const table = source.slice(tableStart, open).trim();
    let depth = 0;
    let end = -1;
    let quote = "";
    for (let index = open; index < source.length; index += 1) {
      const character = source[index];
      if (quote) {
        if (character === quote && source[index - 1] !== "\\") quote = "";
        continue;
      }
      if (character === "'" || character === '"' || character === "`") {
        quote = character;
        continue;
      }
      if (character === "(") depth += 1;
      if (character === ")" && --depth === 0) {
        end = index;
        break;
      }
    }
    assert.notEqual(end, -1, `Unbalanced CREATE TABLE for ${table}`);
    definitions.push({ body: source.slice(open + 1, end), table });
    cursor = end + 1;
  }
  return definitions;
}

function sqlColumnNames(body) {
  const definitions = [];
  let current = "";
  let depth = 0;
  let quote = "";
  for (const character of body) {
    if (quote) {
      current += character;
      if (character === quote) quote = "";
      continue;
    }
    if (character === "'" || character === '"' || character === "`") {
      quote = character;
      current += character;
      continue;
    }
    if (character === "(") depth += 1;
    if (character === ")") depth -= 1;
    if (character === "," && depth === 0) {
      definitions.push(current);
      current = "";
      continue;
    }
    current += character;
  }
  definitions.push(current);
  return definitions
    .map((definition) => definition.trim().match(/^([A-Za-z_][A-Za-z0-9_]*)\s+/u)?.[1])
    .filter(
      (name) =>
        name &&
        !["PRIMARY", "UNIQUE", "INDEX", "KEY", "CONSTRAINT", "FOREIGN", "CHECK"].includes(
          name.toUpperCase()
        )
    );
}

test("prefix plans are reversible and reject ambiguous coexistence", () => {
  const policy = { include: ["users", "roles"], prefix: "app_" };
  const forward = planTablePrefixChanges(["users", "roles", "billing_sales"], policy);
  assert.deepEqual(forward, [
    { from: "roles", to: "app_roles" },
    { from: "users", to: "app_users" }
  ]);
  const backward = planTablePrefixRollback(["app_roles", "app_users", "billing_sales"], policy);
  assert.deepEqual(backward, [
    { from: "app_users", to: "users" },
    { from: "app_roles", to: "roles" }
  ]);
  assert.throws(() => planTablePrefixChanges(["users", "app_users"], policy), /both tables exist/);
});

test("migration schema adopts the legacy ledger and refuses ambiguous coexistence", () => {
  assert.equal(migrationSchemaTableName, "migration_schema");
  assert.equal(legacyMigrationSchemaTableName, "app_migration_batches");
  assert.deepEqual(planMigrationSchemaAdoption(["app_migration_batches", "tenants"]), {
    from: "app_migration_batches",
    to: "migration_schema"
  });
  assert.equal(planMigrationSchemaAdoption(["migration_schema", "tenants"]), null);
  assert.equal(planMigrationSchemaAdoption(["tenants"]), null);
  assert.throws(
    () => planMigrationSchemaAdoption(["app_migration_batches", "migration_schema"]),
    /ledger collision/
  );
});

test("runtime SQL no longer references legacy unprefixed app or core tables", () => {
  const legacyNames = new Set();
  for (const file of migrationFiles) {
    const source = readFileSync(file, "utf8");
    for (const { table } of sqlTableDefinitions(source)) {
      if (/^(app|core)_/.test(table)) legacyNames.add(table.replace(/^(app|core)_/, ""));
    }
    for (const match of source.matchAll(/\.createTable\("((?:app|core)_[^"]+)"\)/g)) {
      legacyNames.add(match[1].replace(/^(app|core)_/, ""));
    }
  }
  const failures = [];
  for (const file of runtimeDatabaseFiles) {
    const source = readFileSync(file, "utf8");
    for (const table of legacyNames) {
      const escaped = table.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const legacyReference = new RegExp(
        `(?:\\.(?:createTable|alterTable|dropTable|selectFrom|insertInto|updateTable|deleteFrom|innerJoin|leftJoin|rightJoin|on|references)\\(\\s*["']${escaped}(?:[."']| as )|\\b(?:FROM|JOIN|INTO|UPDATE|TABLE|REFERENCES)\\s+${escaped}\\b)`,
        "i"
      );
      if (legacyReference.test(source)) failures.push(`${file}: ${table}`);
    }
  }
  assert.deepEqual(failures, []);
});

test("migration checksums change with schema source or version", () => {
  const step = {
    checksum: "CREATE TABLE app_example (id INT)",
    description: "example",
    name: "example",
    up: async () => {},
    version: 1
  };
  const batch = {
    batch: 1,
    description: "test",
    scope: "test",
    steps: [step],
    version: "1"
  };
  const initial = migrationChecksum(batch, step);
  assert.notEqual(
    initial,
    migrationChecksum(batch, { ...step, checksum: `${step.checksum}, status VARCHAR(24)` })
  );
  assert.notEqual(initial, migrationChecksum(batch, { ...step, version: 2 }));
});

test("migration owners use build-mode-stable checksum sources", () => {
  for (const file of [
    "apps/platform/api/src/database/platform-database.ts",
    "apps/platform/api/src/modules/tenant/tenant.migration.ts",
    "apps/core/api/src/database/core-database.ts",
    "apps/billing/api/src/database/billing-database.ts",
    "apps/mail/api/src/modules/mail/mail.migration.ts"
  ]) {
    assert.doesNotMatch(
      readFileSync(file, "utf8"),
      /checksum:\s*[\w.]+\.toString\(\)/u,
      `${file} must use an explicit checksum source`
    );
  }
});

test("company child definitions do not duplicate shared audit columns", () => {
  const source = readFileSync(
    "apps/core/api/src/modules/organisation/company/company.migration.ts",
    "utf8"
  );
  const childDefinitions = source.slice(source.indexOf("const children ="));
  assert.doesNotMatch(
    childDefinitions,
    /\b(?:status|uuid|created_by|created_at|updated_at)\s+(?:VAR)?CHAR|\b(?:created_at|updated_at)\s+DATETIME/u
  );
});

test("insert-select seeds qualify no-op duplicate updates", () => {
  const source = readFileSync("apps/core/api/src/modules/master/contact/contact.seed.ts", "utf8");
  assert.doesNotMatch(source, /ON DUPLICATE KEY UPDATE id=id/u);
});
