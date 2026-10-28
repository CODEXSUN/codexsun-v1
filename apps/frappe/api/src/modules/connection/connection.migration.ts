import { addFrappeAvailability } from "../live-sync/index.js";
import { sql, type Kysely } from "kysely";
import {
  ensureStandardTableColumns,
  runMigrationBatch,
  type MigrationBatch
} from "@codexsun/framework/db";
import type { FrappeDatabase } from "./connection.types.js";

export const frappeTenantMigrationBatch: MigrationBatch<FrappeDatabase> = {
  batch: 1,
  scope: "frappe.connection",
  version: "1.0.87",
  description: "Adopt Frappe integration tables and standardize their audit columns.",
  steps: [
    {
      name: "frappe.connection.baseline-v1",
      checksum: "frappe.connection.baseline-v1",
      description: "Adopt existing Frappe connection and enquiry sync tables.",
      version: 1,
      up: applyFrappeTenantSchema
    },
    {
      name: "frappe.connection.standard-columns-v2",
      checksum: "frappe.connection.standard-columns-v2",
      description: "Add standard identity and audit columns without replacing integration keys.",
      version: 2,
      up: standardizeFrappeTenantSchema
    },
    {
      name: "frappe.connection.initial-import-links-v3",
      checksum: "frappe.connection.initial-import-links-v3",
      description: "Track Frappe contacts and enquiry activities imported into local CRM.",
      version: 3,
      up: addInitialImportLinks
    },
    {
      name: "frappe.connection.local-cutover-v4",
      checksum: "frappe.connection.local-cutover-v4",
      description: "Record when Frappe imports end and CRM becomes fully local.",
      version: 4,
      up: addLocalCutover
    },
    {
      name: "frappe.connection.live-sync-v5",
      checksum: "frappe.connection.live-sync-v5",
      description: "Store scheduled live Frappe sync controls.",
      version: 5,
      up: addLiveSyncSettings
    },
    {
      name: "frappe.connection.contact-exports-v6",
      checksum: "frappe.connection.contact-exports-v6",
      description:
        "Keep outbound Mobile Contact links separate from imported customer associations.",
      version: 6,
      up: addContactExports
    },
    {
      name: "frappe.connection.shared-mobile-contact-links-v7",
      checksum: "frappe.connection.shared-mobile-contact-links-v7",
      description: "Allow multiple local contacts to share one Frappe Mobile Contact identity.",
      version: 7,
      up: allowSharedMobileContactExports
    },
    {
      name: "frappe.connection.customer-identities-v8",
      checksum: "frappe.connection.customer-identities-v8",
      description: "Scope Frappe customer document identity links to their source site.",
      version: 8,
      up: addCustomerIdentityLinks
    },
    {
      name: "frappe.connection.inbound-checkpoint-v9",
      checksum: "frappe.connection.inbound-checkpoint-v9",
      description: "Add inbound direction, successful checkpoints, and retained source documents.",
      version: 9,
      up: addInboundCheckpoint
    },
    {
      name: "frappe.connection.contact-export-start-v10",
      checksum: "frappe.connection.contact-export-start-v10",
      description: "Recover contact exports created or edited after this feature starts.",
      version: 10,
      up: async (database) => {
        await sql`ALTER TABLE frappe_live_sync_settings ADD COLUMN IF NOT EXISTS contact_export_started_at DATETIME(3) NULL`.execute(
          database
        );
        await sql`UPDATE frappe_live_sync_settings SET contact_export_started_at=UTC_TIMESTAMP(3) WHERE id=1 AND contact_export_started_at IS NULL`.execute(
          database
        );
      }
    },
    {
      name: "frappe.connection.availability-v11",
      checksum: "frappe.connection.availability-v11",
      description: "Hold sync outside tenant server hours and cache live connectivity.",
      version: 11,
      up: addFrappeAvailability
    },
    {
      name: "frappe.connection.enquiry-source-key-v12",
      checksum: "frappe.connection.enquiry-source-key-v12",
      description: "Retain unambiguous Frappe enquiry source identities without changing links.",
      version: 12,
      up: addEnquirySourceKeys
    }
  ]
};

async function addEnquirySourceKeys(database: Kysely<FrappeDatabase>) {
  await sql`ALTER TABLE frappe_enquiry_sync
    ADD COLUMN IF NOT EXISTS source_site_key CHAR(64) NULL`.execute(database);
  await sql`CREATE INDEX IF NOT EXISTS frappe_enquiry_sync_site_remote
    ON frappe_enquiry_sync (source_site_key, remote_name)`.execute(database);
  await sql`UPDATE frappe_enquiry_sync AS link
    JOIN (
      SELECT enquiry_id, MIN(LOWER(base_url)) AS source_url
      FROM frappe_enquiry_snapshots
      WHERE enquiry_id IS NOT NULL
      GROUP BY enquiry_id
      HAVING COUNT(DISTINCT LOWER(base_url)) = 1
    ) AS source ON source.enquiry_id = link.enquiry_id
    SET link.source_site_key = SHA2(source.source_url, 256)
    WHERE link.source_site_key IS NULL`.execute(database);
}

async function addInboundCheckpoint(database: Kysely<FrappeDatabase>) {
  await sql`ALTER TABLE frappe_enquiry_sync
    ADD COLUMN IF NOT EXISTS source_modified_at DATETIME(3) NULL`.execute(database);
  await sql`ALTER TABLE frappe_live_sync_settings
    ADD COLUMN IF NOT EXISTS direction VARCHAR(24) NOT NULL DEFAULT 'inbound',
    ADD COLUMN IF NOT EXISTS inbound_base_url VARCHAR(2048) NULL,
    ADD COLUMN IF NOT EXISTS inbound_checkpoint_at DATETIME NULL`.execute(database);
  await sql`CREATE TABLE IF NOT EXISTS frappe_enquiry_snapshots (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    uuid CHAR(8) NOT NULL DEFAULT (LOWER(SUBSTRING(MD5(UUID()), 1, 8))) UNIQUE,
    source_key CHAR(64) NOT NULL,
    base_url VARCHAR(2048) NOT NULL,
    remote_name VARCHAR(191) NOT NULL,
    enquiry_id INT NULL,
    document_json LONGTEXT NOT NULL,
    status VARCHAR(24) NOT NULL DEFAULT 'active',
    created_by VARCHAR(191) NOT NULL DEFAULT 'system:frappe-import',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY frappe_snapshot_content (source_key),
    KEY frappe_snapshot_remote (remote_name, id),
    KEY frappe_snapshot_enquiry (enquiry_id, id)
  ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`.execute(database);
}

export const frappeTenantMigrations = frappeTenantMigrationBatch.steps.map(
  ({ name, description }) => ({ name, description })
);

export async function migrateFrappeTenantDatabase(database: Kysely<FrappeDatabase>) {
  return runMigrationBatch(database, frappeTenantMigrationBatch);
}

async function applyFrappeTenantSchema(database: Kysely<FrappeDatabase>) {
  await sql
    .raw(
      `CREATE TABLE IF NOT EXISTS frappe_data_sources (
    module_key VARCHAR(191) NOT NULL PRIMARY KEY,
    provider ENUM('local','frappe') NOT NULL DEFAULT 'local',
    updated_by VARCHAR(191) NOT NULL,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
    )
    .execute(database);
  await sql
    .raw(
      `CREATE TABLE IF NOT EXISTS frappe_connection_settings (
    id INT NOT NULL PRIMARY KEY,
    connection_name VARCHAR(191) NOT NULL,
    base_url VARCHAR(2048) NOT NULL,
    api_key_ciphertext TEXT NULL,
    api_secret_ciphertext TEXT NULL,
    enabled BOOLEAN NOT NULL DEFAULT FALSE,
    verification_status ENUM('unverified','verified','failed') NOT NULL DEFAULT 'unverified',
    last_checked_at DATETIME NULL,
    last_verified_at DATETIME NULL,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
    )
    .execute(database);
  await sql
    .raw(
      `CREATE TABLE IF NOT EXISTS frappe_enquiry_sync (
    enquiry_id INT NOT NULL PRIMARY KEY,
    remote_name VARCHAR(191) NOT NULL,
    synced_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY frappe_enquiry_sync_remote (remote_name),
    CONSTRAINT frappe_enquiry_sync_enquiry_fk FOREIGN KEY (enquiry_id)
      REFERENCES crm_enquiries (id) ON DELETE CASCADE
  ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
    )
    .execute(database);
}

export async function rollbackFrappeTenantDatabase(database: Kysely<FrappeDatabase>) {
  void database;
  throw new Error("Frappe rollback requires a reviewed, data-preserving migration plan.");
}

async function standardizeFrappeTenantSchema(database: Kysely<FrappeDatabase>) {
  await convertNaturalPrimaryKey(database, "frappe_data_sources", "module_key");
  await convertNaturalPrimaryKey(database, "frappe_enquiry_sync", "enquiry_id");
  await sql
    .raw("ALTER TABLE frappe_connection_settings MODIFY COLUMN id INT NOT NULL AUTO_INCREMENT")
    .execute(database);
  await ensureStandardTableColumns(database, [
    "frappe_data_sources",
    "frappe_connection_settings",
    "frappe_enquiry_sync"
  ]);
}

async function addInitialImportLinks(database: Kysely<FrappeDatabase>) {
  await sql
    .raw(
      `CREATE TABLE IF NOT EXISTS frappe_contact_imports (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    uuid CHAR(8) NOT NULL DEFAULT (LOWER(SUBSTRING(MD5(UUID()),1,8))) UNIQUE,
    remote_name VARCHAR(191) NOT NULL UNIQUE,
    local_contact_id INT NOT NULL,
    status VARCHAR(24) NOT NULL DEFAULT 'active',
    created_by VARCHAR(191) NOT NULL DEFAULT 'system:frappe-import',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
    )
    .execute(database);
  await sql
    .raw(
      `CREATE TABLE IF NOT EXISTS frappe_activity_imports (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    uuid CHAR(8) NOT NULL DEFAULT (LOWER(SUBSTRING(MD5(UUID()),1,8))) UNIQUE,
    remote_name VARCHAR(191) NOT NULL UNIQUE,
    local_activity_id INT NOT NULL,
    status VARCHAR(24) NOT NULL DEFAULT 'active',
    created_by VARCHAR(191) NOT NULL DEFAULT 'system:frappe-import',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
    )
    .execute(database);
}

async function addContactExports(database: Kysely<FrappeDatabase>) {
  await sql
    .raw(
      `CREATE TABLE IF NOT EXISTS frappe_contact_exports (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    uuid CHAR(8) NOT NULL DEFAULT (LOWER(SUBSTRING(MD5(UUID()),1,8))) UNIQUE,
    remote_name VARCHAR(191) NOT NULL UNIQUE,
    local_contact_id INT NOT NULL UNIQUE,
    created_by VARCHAR(191) NOT NULL DEFAULT 'system:frappe-export',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
    )
    .execute(database);
}

async function allowSharedMobileContactExports(database: Kysely<FrappeDatabase>) {
  await sql
    .raw(
      "ALTER TABLE frappe_contact_exports DROP INDEX remote_name, ADD INDEX frappe_contact_exports_remote (remote_name)"
    )
    .execute(database);
}

async function addCustomerIdentityLinks(database: Kysely<FrappeDatabase>) {
  await sql
    .raw(
      `CREATE TABLE IF NOT EXISTS frappe_contact_customer_identity (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    source_key CHAR(64) NOT NULL UNIQUE,
    remote_name VARCHAR(191) NOT NULL,
    local_contact_id INT NOT NULL UNIQUE,
    created_by VARCHAR(191) NOT NULL DEFAULT 'system:frappe-import',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX frappe_contact_customer_identity_remote (remote_name)
  ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
    )
    .execute(database);
}

async function addLocalCutover(database: Kysely<FrappeDatabase>) {
  await sql
    .raw(
      `CREATE TABLE IF NOT EXISTS frappe_import_state (
    id INT NOT NULL PRIMARY KEY,
    completed_at DATETIME NULL,
    completed_by VARCHAR(191) NULL,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
    )
    .execute(database);
  await sql`INSERT INTO frappe_import_state (id) VALUES (1) ON DUPLICATE KEY UPDATE id=id`.execute(
    database
  );
}

async function addLiveSyncSettings(database: Kysely<FrappeDatabase>) {
  await sql
    .raw(
      `CREATE TABLE IF NOT EXISTS frappe_live_sync_settings (
    id INT NOT NULL PRIMARY KEY, enabled BOOLEAN NOT NULL DEFAULT FALSE,
    paused BOOLEAN NOT NULL DEFAULT FALSE, schedule_minutes INT NOT NULL DEFAULT 15,
    contacts_enabled BOOLEAN NOT NULL DEFAULT TRUE, enquiries_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    activities_enabled BOOLEAN NOT NULL DEFAULT TRUE, call_logs_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    last_scheduled_at DATETIME NULL, updated_by VARCHAR(191) NOT NULL DEFAULT 'system:frappe-live-sync',
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
    )
    .execute(database);
  await sql`INSERT INTO frappe_live_sync_settings (id) VALUES (1) ON DUPLICATE KEY UPDATE id=id`.execute(
    database
  );
}

export async function convertNaturalPrimaryKey(
  database: Kysely<FrappeDatabase>,
  table: "frappe_data_sources" | "frappe_enquiry_sync" | "frappe_user_mappings",
  column: "module_key" | "enquiry_id" | "local_user_id"
) {
  const result = await sql<{
    count: number;
  }>`SELECT COUNT(*) AS count FROM information_schema.columns
    WHERE table_schema=DATABASE() AND table_name=${table} AND column_name='id'`.execute(database);
  if (Number(result.rows[0]?.count ?? 0) > 0) return;
  await sql
    .raw(
      `ALTER TABLE ${table} DROP PRIMARY KEY, ADD COLUMN id INT NOT NULL AUTO_INCREMENT PRIMARY KEY FIRST, ADD UNIQUE KEY ${table}_${column}_unique (${column})`
    )
    .execute(database);
}
