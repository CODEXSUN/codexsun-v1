import { sql } from "kysely";
import { getCoreDatabase } from "../../../database/core-database.js";
import type {
  ApplicationCompanyBranding,
  DefaultCompanyRecord,
  DefaultCompanySavePayload
} from "./default-company.types.js";

type Row = {
  id: number | string;
  company_id: number | string;
  company_code: string;
  company_name: string;
  financial_year_id: number | string;
  financial_year_name: string;
  financial_year_start_date: string;
  financial_year_end_date: string;
  landing_app: string;
  status: string;
  created_at: string;
  updated_at: string;
};

type BrandingRow = {
  company_id: number | string;
  legal_name: string | null;
  logo_dark_path: string | null;
  logo_path: string | null;
  favicon_path: string | null;
  name: string;
  updated_at: string;
};

export class DefaultCompanyRepository {
  async get() {
    const rows =
      await sql<Row>`SELECT d.id,d.company_id,c.code AS company_code,c.name AS company_name,d.financial_year_id,f.name AS financial_year_name,DATE_FORMAT(f.start_date,'%Y-%m-%d') AS financial_year_start_date,DATE_FORMAT(f.end_date,'%Y-%m-%d') AS financial_year_end_date,d.landing_app,d.status,d.created_at,d.updated_at FROM core_default_company_settings d INNER JOIN core_companies c ON c.id=d.company_id INNER JOIN core_financial_years f ON f.id=d.financial_year_id WHERE d.singleton_key=1 LIMIT 1`.execute(
        getCoreDatabase()
      );
    return rows.rows[0] ? mapRow(rows.rows[0]) : null;
  }
  async save(input: DefaultCompanySavePayload, seedPlaceholder = false) {
    if (seedPlaceholder) {
      await sql`INSERT INTO core_default_company_settings(singleton_key,company_id,financial_year_id,landing_app,status,seed_placeholder)
        VALUES (1,${input.companyId},${input.financialYearId},${input.landingApp.trim()},${input.status ?? "active"},1)
        ON DUPLICATE KEY UPDATE id=id`.execute(getCoreDatabase());
      return (await this.get())!;
    }
    const current = await this.get();
    if (current) {
      await sql`UPDATE core_default_company_settings SET seed_placeholder=0, company_id=${input.companyId},financial_year_id=${input.financialYearId},landing_app=${input.landingApp.trim()},status=${input.status ?? "active"},updated_at=CURRENT_TIMESTAMP WHERE singleton_key=1`.execute(
        getCoreDatabase()
      );
    } else {
      await sql`INSERT INTO core_default_company_settings (singleton_key,company_id,financial_year_id,landing_app,status) VALUES (1,${input.companyId},${input.financialYearId},${input.landingApp.trim()},${input.status ?? "active"})`.execute(
        getCoreDatabase()
      );
    }
    return (await this.get())!;
  }
  async getApplicationBranding(): Promise<ApplicationCompanyBranding | null> {
    const rows = await sql<BrandingRow>`
      SELECT c.id AS company_id,c.name,c.legal_name,c.logo_path,c.logo_dark_path,c.favicon_path,c.updated_at
      FROM core_default_company_settings d
      INNER JOIN core_companies c ON c.id=d.company_id
      WHERE d.singleton_key=1 AND d.status='active' AND c.status='active'
      LIMIT 1
    `.execute(getCoreDatabase());
    const row = rows.rows[0];
    if (!row) return null;
    const name = row.name.trim();
    const legalName = nullableText(row.legal_name);
    return {
      brandName: name,
      companyId: Number(row.company_id),
      legalName,
      logoDarkPath: nullableText(row.logo_dark_path),
      logoPath: nullableText(row.logo_path),
      faviconPath: nullableText(row.favicon_path),
      name,
      updatedAt: String(row.updated_at)
    };
  }
  async findCompany(id: number) {
    const rows = await sql<{
      id: number | string;
      name: string;
      code: string;
    }>`SELECT id,name,code FROM core_companies WHERE id=${id} AND status='active' LIMIT 1`.execute(
      getCoreDatabase()
    );
    return rows.rows[0] ?? null;
  }
  async findFinancialYear(id: number) {
    const rows = await sql<{
      id: number | string;
      name: string;
    }>`SELECT id,name FROM core_financial_years WHERE id=${id} AND status='active' LIMIT 1`.execute(
      getCoreDatabase()
    );
    return rows.rows[0] ?? null;
  }
  async firstActiveCompany() {
    const rows = await sql<{
      id: number | string;
      name: string;
      code: string;
    }>`SELECT id,name,code FROM core_companies WHERE status='active' AND name<>'-' ORDER BY id LIMIT 1`.execute(
      getCoreDatabase()
    );
    const row = rows.rows[0];
    return row ? { id: Number(row.id), label: row.name, code: row.code } : null;
  }
  async currentActiveFinancialYear() {
    const rows = await sql<{
      id: number | string;
      name: string;
    }>`SELECT id,name FROM core_financial_years WHERE status='active' ORDER BY is_current DESC,start_date DESC,id LIMIT 1`.execute(
      getCoreDatabase()
    );
    const row = rows.rows[0];
    return row ? { id: Number(row.id), label: row.name } : null;
  }
  async companyLookups() {
    const rows = await sql<{
      id: number | string;
      name: string;
      code: string;
    }>`SELECT id,name,code FROM core_companies WHERE status='active' AND name<>'-' ORDER BY name`.execute(
      getCoreDatabase()
    );
    return rows.rows.map((row) => ({ id: Number(row.id), label: row.name, code: row.code }));
  }
  async financialYearLookups() {
    const rows = await sql<{
      id: number | string;
      name: string;
    }>`SELECT id,name FROM core_financial_years WHERE status='active' ORDER BY start_date DESC`.execute(
      getCoreDatabase()
    );
    return rows.rows.map((row) => ({ id: Number(row.id), label: row.name }));
  }
}

function nullableText(value: string | null) {
  const normalized = value?.trim() ?? "";
  return normalized || null;
}
function mapRow(row: Row): DefaultCompanyRecord {
  return {
    id: Number(row.id),
    companyId: Number(row.company_id),
    companyCode: row.company_code,
    companyName: row.company_name,
    financialYearId: Number(row.financial_year_id),
    financialYearName: row.financial_year_name,
    financialYearStartDate: String(row.financial_year_start_date),
    financialYearEndDate: String(row.financial_year_end_date),
    landingApp: row.landing_app,
    status: row.status === "active" ? "active" : "inactive",
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at)
  };
}
