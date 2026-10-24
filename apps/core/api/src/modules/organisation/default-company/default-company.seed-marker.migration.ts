import { sql, type Kysely } from "kysely";
import type { CoreDatabase } from "../../../database/core-database.js";
export const defaultCompanySeedMarkerMigration = {
  name: "core.organisation.default-company-seed-marker-v3",
  description: "Track owner-created company seed placeholders for reviewed migration reuse.",
  checksum: "core_default_company_settings:seed-placeholder-v1",
  version: 3,
  up: async (database: Kysely<CoreDatabase>) => {
    await sql`ALTER TABLE core_default_company_settings ADD COLUMN IF NOT EXISTS seed_placeholder TINYINT(1) NOT NULL DEFAULT 0`.execute(
      database
    );
    await sql`UPDATE core_default_company_settings d JOIN core_companies c ON c.id=d.company_id
      SET d.seed_placeholder=1,d.updated_at=d.updated_at
      WHERE c.seed_placeholder=1 AND d.singleton_key=1 AND d.landing_app='application'
        AND d.status='active' AND d.created_by='system:migration' AND d.created_at=d.updated_at`.execute(
      database
    );
  }
} as const;
