import { isUntouchedCompanySeed } from "./company.seed-policy.js";
import { sql, type Kysely } from "kysely";
import type { CoreDatabase } from "../../../database/core-database.js";
export const companySeedMarkerMigration = {
  name: "core.organisation.company-seed-marker-v3",
  description: "Track owner-created company seed placeholders for reviewed migration reuse.",
  checksum: "core_companies:seed-placeholder-v1",
  version: 3,
  up: async (database: Kysely<CoreDatabase>) => {
    await sql`ALTER TABLE core_companies ADD COLUMN IF NOT EXISTS seed_placeholder TINYINT(1) NOT NULL DEFAULT 0`.execute(
      database
    );
    const records = await sql<
      Record<string, unknown>
    >`SELECT * FROM core_companies ORDER BY id LIMIT 2`.execute(database);
    const row = records.rows[0];
    if (
      records.rows.length === 1 &&
      row?.created_by === "system:migration" &&
      String(row.created_at) === String(row.updated_at) &&
      isUntouchedCompanySeed({ ...row, seed_placeholder: 1 })
    ) {
      await sql`UPDATE core_companies SET seed_placeholder=1,updated_at=updated_at WHERE id=${Number(row.id)}`.execute(
        database
      );
    }
  }
} as const;
