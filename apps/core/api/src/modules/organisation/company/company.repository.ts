import { sql } from "kysely";
import { getCoreDatabase } from "../../../database/core-database.js";
import type { CompanyRecord, CompanySaveInput } from "./company.types.js";
type Row = Record<string, unknown>;
export class CompanyRepository {
  async list(search = "") {
    const term = search.trim().toLowerCase();
    const rows =
      await sql<Row>`SELECT * FROM core_companies WHERE (${term}='' OR LOWER(name) LIKE ${`%${term}%`} OR LOWER(code) LIKE ${`%${term}%`}) ORDER BY code`.execute(
        getCoreDatabase()
      );
    return rows.rows.map(map);
  }
  async find(id: string | number) {
    const rows =
      await sql<Row>`SELECT * FROM core_companies WHERE id=${Number(id)} LIMIT 1`.execute(
        getCoreDatabase()
      );
    return rows.rows[0] ? map(rows.rows[0]) : null;
  }
  async create(input: CompanySaveInput, seedPlaceholder = false) {
    const value = await normalize(input);
    const result =
      await sql`INSERT INTO core_companies (seed_placeholder,code,name,legal_name,primary_phone,primary_email,gstin,pan,msme_no,msme_category,tan_no,tds_available,tcs_available,website,description,logo_path,logo_dark_path,favicon_path,industry_id,industry_name,status,emails_json,phones_json,addresses_json,bank_accounts_json,social_links_json) VALUES (${seedPlaceholder ? 1 : 0},${value.code},${value.name},${value.legalName},${value.primaryPhone},${value.primaryEmail},${value.gstin},${value.pan},${value.msmeNo},${value.msmeCategory},${value.tanNo},${value.tdsAvailable},${value.tcsAvailable},${value.website},${value.description},${value.logoPath},${value.logoDarkPath},${value.faviconPath},${value.industryId},${value.industryName},${value.status},${JSON.stringify(value.emails)},${JSON.stringify(value.phones)},${JSON.stringify(value.addresses)},${JSON.stringify(value.bankAccounts)},${JSON.stringify(value.socialLinks)})`.execute(
        getCoreDatabase()
      );
    return (await this.find(Number(result.insertId)))!;
  }
  async update(id: string | number, input: CompanySaveInput) {
    const current = await this.find(id);
    if (!current || current.name === "-") return null;
    const value = await normalize(input, current);
    await sql`UPDATE core_companies SET seed_placeholder=0,code=${value.code},name=${value.name},legal_name=${value.legalName},primary_phone=${value.primaryPhone},primary_email=${value.primaryEmail},gstin=${value.gstin},pan=${value.pan},msme_no=${value.msmeNo},msme_category=${value.msmeCategory},tan_no=${value.tanNo},tds_available=${value.tdsAvailable},tcs_available=${value.tcsAvailable},website=${value.website},description=${value.description},logo_path=${value.logoPath},logo_dark_path=${value.logoDarkPath},favicon_path=${value.faviconPath},industry_id=${value.industryId},industry_name=${value.industryName},status=${value.status},emails_json=${JSON.stringify(value.emails)},phones_json=${JSON.stringify(value.phones)},addresses_json=${JSON.stringify(value.addresses)},bank_accounts_json=${JSON.stringify(value.bankAccounts)},social_links_json=${JSON.stringify(value.socialLinks)},updated_at=CURRENT_TIMESTAMP WHERE id=${Number(id)}`.execute(
      getCoreDatabase()
    );
    return this.find(id);
  }
  async setActive(id: string | number, active: boolean) {
    const current = await this.find(id);
    if (!current || current.name.trim() === "-") return null;
    await sql`UPDATE core_companies SET seed_placeholder=0,status=${active ? "active" : "suspend"},updated_at=CURRENT_TIMESTAMP WHERE id=${Number(id)}`.execute(
      getCoreDatabase()
    );
    return this.find(id);
  }
  async forceDelete(id: string | number) {
    const current = await this.find(id);
    if (!current || current.name.trim() === "-") return null;
    await sql`DELETE FROM core_companies WHERE id=${Number(id)}`.execute(getCoreDatabase());
    return current;
  }
  async isDefaultCompany(id: string | number) {
    const rows = await sql<{
      count: number | string;
    }>`SELECT COUNT(*) AS count FROM core_default_company_settings WHERE company_id=${Number(id)}`.execute(
      getCoreDatabase()
    );
    return Number(rows.rows[0]?.count ?? 0) > 0;
  }
  async findAddressType(id: number) {
    const rows = await sql<{
      id: number | string;
      name: string;
    }>`SELECT id,name FROM core_address_types WHERE id=${id} AND status='active' LIMIT 1`.execute(
      getCoreDatabase()
    );
    return rows.rows[0] ? { id: Number(rows.rows[0].id), name: rows.rows[0].name } : null;
  }
  async findBankName(id: number) {
    const rows = await sql<{
      id: number | string;
      name: string;
    }>`SELECT id,name FROM core_bank_names WHERE id=${id} AND status='active' LIMIT 1`.execute(
      getCoreDatabase()
    );
    return rows.rows[0] ? { id: Number(rows.rows[0].id), name: rows.rows[0].name } : null;
  }
  async findCountry(id: number) {
    const rows = await sql<{
      id: number | string;
      name: string;
    }>`SELECT id,name FROM core_countries WHERE id=${id} AND status='active' LIMIT 1`.execute(
      getCoreDatabase()
    );
    return rows.rows[0] ? { id: Number(rows.rows[0].id), name: rows.rows[0].name } : null;
  }
  async findState(id: number) {
    const rows = await sql<{
      country_id: number | string;
      id: number | string;
      name: string;
    }>`SELECT id,name,country_id FROM core_states WHERE id=${id} AND status='active' LIMIT 1`.execute(
      getCoreDatabase()
    );
    return rows.rows[0]
      ? {
          id: Number(rows.rows[0].id),
          name: rows.rows[0].name,
          parentId: Number(rows.rows[0].country_id)
        }
      : null;
  }
  async findDistrict(id: number) {
    const rows = await sql<{
      id: number | string;
      name: string;
      state_id: number | string;
    }>`SELECT id,name,state_id FROM core_districts WHERE id=${id} AND status='active' LIMIT 1`.execute(
      getCoreDatabase()
    );
    return rows.rows[0]
      ? {
          id: Number(rows.rows[0].id),
          name: rows.rows[0].name,
          parentId: Number(rows.rows[0].state_id)
        }
      : null;
  }
  async findCity(id: number) {
    const rows = await sql<{
      district_id: number | string;
      id: number | string;
      name: string;
    }>`SELECT id,name,district_id FROM core_cities WHERE id=${id} AND status='active' LIMIT 1`.execute(
      getCoreDatabase()
    );
    return rows.rows[0]
      ? {
          id: Number(rows.rows[0].id),
          name: rows.rows[0].name,
          parentId: Number(rows.rows[0].district_id)
        }
      : null;
  }
  async findPincode(id: number) {
    const rows = await sql<{
      city_id: number | string;
      id: number | string;
      name: string;
    }>`SELECT id,name,city_id FROM core_pincodes WHERE id=${id} AND status='active' LIMIT 1`.execute(
      getCoreDatabase()
    );
    return rows.rows[0]
      ? {
          id: Number(rows.rows[0].id),
          name: rows.rows[0].name,
          parentId: Number(rows.rows[0].city_id)
        }
      : null;
  }
}
async function normalize(input: CompanySaveInput, current?: CompanyRecord) {
  const name = text(input.name ?? current?.name);
  if (!name) throw new Error("Company name is required.");
  const industryId = num(provided(input.industryId, current?.industryId));
  const industryName = industryId ? nil(provided(input.industryName, current?.industryName)) : null;
  const emails = input.emails ?? current?.emails ?? [];
  const phones = input.phones ?? current?.phones ?? [];
  return {
    code:
      text(input.code ?? current?.code) ||
      name
        .toUpperCase()
        .replace(/[^A-Z0-9]+/g, "-")
        .slice(0, 24),
    name,
    legalName: nil(provided(input.legalName, current?.legalName)),
    primaryPhone: nil(phones.find((item) => item.isPrimary)?.phone ?? phones[0]?.phone),
    primaryEmail: nil(emails.find((item) => item.isPrimary)?.email ?? emails[0]?.email),
    gstin: nil(provided(input.gstin, current?.gstin)),
    pan: nil(provided(input.pan, current?.pan)),
    msmeNo: nil(provided(input.msmeNo, current?.msmeNo)),
    msmeCategory: nil(provided(input.msmeCategory, current?.msmeCategory)),
    tanNo: nil(provided(input.tanNo, current?.tanNo)),
    tdsAvailable: input.tdsAvailable ?? current?.tdsAvailable ?? false,
    tcsAvailable: input.tcsAvailable ?? current?.tcsAvailable ?? false,
    website: nil(provided(input.website, current?.website)),
    description: nil(provided(input.description, current?.description)),
    logoPath: nil(provided(input.logoPath, current?.logoPath)),
    logoDarkPath: nil(provided(input.logoDarkPath, current?.logoDarkPath)),
    faviconPath: nil(provided(input.faviconPath, current?.faviconPath)),
    industryId,
    industryName,
    status: input.status ?? (input.isActive === false ? "suspend" : current?.status) ?? "active",
    emails,
    phones,
    addresses: input.addresses ?? current?.addresses ?? [],
    bankAccounts: input.bankAccounts ?? current?.bankAccounts ?? [],
    socialLinks: input.socialLinks ?? current?.socialLinks ?? []
  };
}
function map(row: Row): CompanyRecord {
  return {
    id: Number(row.id),
    code: String(row.code),
    name: String(row.name),
    legalName: nil(row.legal_name),
    primaryPhone: nil(row.primary_phone),
    primaryEmail: nil(row.primary_email),
    gstin: nil(row.gstin),
    pan: nil(row.pan),
    msmeNo: nil(row.msme_no),
    msmeCategory: nil(row.msme_category),
    tanNo: nil(row.tan_no),
    tdsAvailable: Boolean(row.tds_available),
    tcsAvailable: Boolean(row.tcs_available),
    website: nil(row.website),
    description: nil(row.description),
    logoPath: nil(row.logo_path),
    logoDarkPath: nil(row.logo_dark_path),
    faviconPath: nil(row.favicon_path),
    industryId: num(row.industry_id),
    industryName: nil(row.industry_name),
    status: row.status === "active" ? "active" : "suspend",
    isActive: row.status === "active",
    emails: normalizeEmails(arr<Row[]>(row.emails_json)),
    phones: normalizePhones(arr<Row[]>(row.phones_json)),
    addresses: normalizeAddresses(arr<Row[]>(row.addresses_json)),
    bankAccounts: normalizeBankAccounts(arr<Row[]>(row.bank_accounts_json)),
    socialLinks: normalizeSocialLinks(arr<Row[]>(row.social_links_json)),
    createdAt: date(row.created_at),
    updatedAt: date(row.updated_at)
  };
}
function text(v: unknown) {
  return String(v ?? "").trim();
}
function nil(v: unknown) {
  return text(v) || null;
}
function num(v: unknown) {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
function provided<T>(value: T | undefined, current: T | undefined): T | undefined {
  return value === undefined ? current : value;
}
function arr<T>(v: unknown): T {
  try {
    return (Array.isArray(v) ? v : JSON.parse(String(v ?? "[]"))) as T;
  } catch {
    return [] as T;
  }
}
function date(v: unknown) {
  return v instanceof Date ? v.toISOString() : new Date(String(v)).toISOString();
}

function normalizeEmails(items: Row[]): CompanyRecord["emails"] {
  return items.map((item, index) => ({
    id: Number(item.id ?? 0),
    email: text(item.email),
    emailType: text(item.emailType ?? item.email_type) || "Primary",
    isPrimary: Boolean(item.isPrimary ?? item.is_primary),
    sortOrder: Number(item.sortOrder ?? item.sort_order ?? index + 1)
  }));
}
function normalizePhones(items: Row[]): CompanyRecord["phones"] {
  return items.map((item, index) => ({
    id: Number(item.id ?? 0),
    phone: text(item.phone),
    phoneType: text(item.phoneType ?? item.phone_type) || "Mobile",
    isPrimary: Boolean(item.isPrimary ?? item.is_primary),
    sortOrder: Number(item.sortOrder ?? item.sort_order ?? index + 1)
  }));
}
function normalizeAddresses(items: Row[]): CompanyRecord["addresses"] {
  return items.map((item, index) => ({
    id: Number(item.id ?? 0),
    addressTypeId: num(item.addressTypeId ?? item.address_type_id),
    addressTypeName: nil(item.addressTypeName ?? item.address_type_name),
    addressLine1: text(item.addressLine1 ?? item.address_line1),
    addressLine2: nil(item.addressLine2 ?? item.address_line2),
    countryId: num(item.countryId ?? item.country_id),
    countryName: nil(item.countryName ?? item.country_name),
    stateId: num(item.stateId ?? item.state_id),
    stateName: nil(item.stateName ?? item.state_name),
    districtId: num(item.districtId ?? item.district_id),
    districtName: nil(item.districtName ?? item.district_name),
    cityId: num(item.cityId ?? item.city_id),
    cityName: nil(item.cityName ?? item.city_name),
    pincodeId: num(item.pincodeId ?? item.pincode_id),
    pincodeName: nil(item.pincodeName ?? item.pincode_name),
    isDefault: Boolean(item.isDefault ?? item.is_default),
    sortOrder: Number(item.sortOrder ?? item.sort_order ?? index + 1)
  }));
}
function normalizeBankAccounts(items: Row[]): CompanyRecord["bankAccounts"] {
  return items.map((item, index) => ({
    id: Number(item.id ?? 0),
    bankNameId: num(item.bankNameId ?? item.bank_name_id),
    bankName: nil(item.bankName ?? item.bank_name),
    accountType: nil(item.accountType ?? item.account_type),
    accountNumber: text(item.accountNumber ?? item.account_number),
    holderName: nil(item.holderName ?? item.holder_name),
    ifsc: nil(item.ifsc),
    branch: nil(item.branch),
    isPrimary: Boolean(item.isPrimary ?? item.is_primary),
    sortOrder: Number(item.sortOrder ?? item.sort_order ?? index + 1)
  }));
}
function normalizeSocialLinks(items: Row[]): CompanyRecord["socialLinks"] {
  return items.map((item, index) => {
    const status = item.status === "inactive" || item.isActive === false ? "inactive" : "active";
    return {
      id: Number(item.id ?? 0),
      platform: text(item.platform) || "Website",
      url: text(item.url),
      status,
      isActive: status === "active",
      sortOrder: Number(item.sortOrder ?? item.sort_order ?? index + 1)
    };
  });
}
