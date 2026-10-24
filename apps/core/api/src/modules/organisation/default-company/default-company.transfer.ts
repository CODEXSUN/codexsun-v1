import { sql, type Kysely } from "kysely";
export async function hasActiveTransferCompanyContext(database: Kysely<unknown>) {
  const available = await sql<{
    n: number;
  }>`SELECT COUNT(*) n FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME IN ('core_companies','core_default_company_settings','core_financial_years')`.execute(
    database
  );
  if (Number(available.rows[0]?.n) !== 3) return false;
  const active = await sql<{
    id: number;
  }>`SELECT d.id FROM core_default_company_settings d JOIN core_companies c ON c.id=d.company_id JOIN core_financial_years f ON f.id=d.financial_year_id WHERE d.singleton_key=1 AND d.status='active' AND c.status='active' AND f.status='active' LIMIT 1`.execute(
    database
  );
  return Boolean(active.rows.length);
}
