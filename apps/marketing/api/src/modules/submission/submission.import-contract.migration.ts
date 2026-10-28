import { sql, type Kysely } from "kysely";
import type { MarketingDatabase } from "../../context.js";

export async function migrateSubmissionImportContract(database: Kysely<MarketingDatabase>) {
  await sql.raw(`ALTER TABLE marketing_submission_imports
    ADD COLUMN IF NOT EXISTS status VARCHAR(24) NOT NULL DEFAULT 'active',
    ADD COLUMN IF NOT EXISTS created_by VARCHAR(191) NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`).execute(database);
  await sql`UPDATE marketing_submission_imports SET created_by=actor_email WHERE created_by=''`.execute(database);
  await sql.raw(`ALTER TABLE marketing_submission_import_receipts
    ADD COLUMN IF NOT EXISTS uuid CHAR(36) NULL,
    ADD COLUMN IF NOT EXISTS status VARCHAR(24) NOT NULL DEFAULT 'active',
    ADD COLUMN IF NOT EXISTS created_by VARCHAR(191) NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ADD COLUMN IF NOT EXISTS updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`).execute(database);
  await sql`UPDATE marketing_submission_import_receipts r JOIN marketing_submission_imports i ON i.uuid=r.import_uuid
    SET r.uuid=COALESCE(r.uuid, UUID()), r.created_by=IF(r.created_by='', i.actor_email, r.created_by)
    WHERE r.uuid IS NULL OR r.created_by=''`.execute(database);
  await sql`UPDATE marketing_submission_import_receipts SET uuid=UUID(), created_by='system:migration' WHERE uuid IS NULL`.execute(database);
  await sql.raw(`ALTER TABLE marketing_submission_import_receipts MODIFY COLUMN uuid CHAR(36) NOT NULL,
    ADD UNIQUE INDEX IF NOT EXISTS import_receipt_uuid (uuid)`).execute(database);
}
