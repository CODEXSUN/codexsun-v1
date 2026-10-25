import type { BusinessRun } from "./business-import.types.js";
import type { TransferSession } from "../transfer-session/index.js";

export async function verifiedUserCompanyContext(
  run: BusinessRun,
  load: (id: string) => Promise<TransferSession>
) {
  const company = run.tables.find((table) => table.table === "core_companies");
  const defaults = run.tables.find((table) => table.table === "core_default_company_settings");
  if (
    !company ||
    company.status !== "success" ||
    !company.verified ||
    company.blocked ||
    company.sourceRows < 1
  )
    return false;
  if (
    !defaults ||
    defaults.blocked ||
    defaults.sourceChanged ||
    defaults.sourceRows !== 1 ||
    defaults.targetRows !== 1 ||
    defaults.verificationIssues.length
  )
    return false;
  if (defaults.status === "success" && defaults.verified) return true;

  const rows: TransferSession["rows"] = [];
  for (const id of defaults.sessions) {
    const session = await load(id);
    if (
      session.sourceId !== run.sourceId ||
      session.targetTenantId !== run.targetTenantId ||
      session.sourceDatabase !== run.sourceDatabase ||
      session.targetDatabase !== run.targetDatabase ||
      session.targetTable !== "core_default_company_settings" ||
      session.status !== "completed"
    )
      return false;
    for (const name of ["singleton_key", "company_id", "financial_year_id", "status"])
      if (!session.fields.some((field) => field.target === name && field.mode === "source"))
        return false;
    rows.push(...session.rows);
  }
  if (rows.length !== 1) return false;
  const row = rows[0]!;
  if (!row.target || Number(row.data.singleton_key) !== 1 || row.data.status !== "active")
    return false;
  if (
    ![row.data.company_id, row.data.financial_year_id].every(
      (id) => Number.isSafeInteger(Number(id)) && Number(id) > 0
    )
  )
    return false;
  if (
    !row.data.landing_app ||
    !row.target.landing_app ||
    row.data.landing_app === row.target.landing_app
  )
    return false;
  return Object.keys(row.data).every(
    (name) => name === "landing_app" || String(row.data[name]) === String(row.target![name])
  );
}
