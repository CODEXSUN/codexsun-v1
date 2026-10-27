import { randomBytes } from "node:crypto";
import type { Tenant, TenantSavePayload } from "./tenant.types.js";
import { sql } from "kysely";
import { getPlatformDatabase } from "../../database/platform-database.js";
import { getTenantDatabase } from "../../database/tenant-database.js";
import { findTenantUserForLogin } from "../tenant-user/index.js";
import {
  defaultTenantDomainForSlug,
  normalizeTenantDomain,
  TenantDomainRepository
} from "../tenant-domain/tenant-domain.repository.js";
import { seedTenantDomain } from "../tenant-domain/tenant-domain.seed.js";
import { parseTenantModuleKeys } from "./tenant-module-keys.js";
import {
  tenantPrivateStorageRoot,
  tenantPublicStorageRoot,
  tenantStorageRoot
} from "../storage-manager/storage-manager.paths.js";

export class TenantRepository {
  constructor(private readonly domains = new TenantDomainRepository()) {}

  async list() {
    const rows = await getPlatformDatabase()
      .selectFrom("tenants")
      .selectAll()
      .orderBy("tenant_name", "asc")
      .execute();
    return this.withPrimaryDomains(rows.map(toTenant));
  }

  async findByIdOrCode(value: string) {
    const normalized = value.trim().toLowerCase();
    const code = normalized.startsWith("tenant-") ? normalized.slice("tenant-".length) : normalized;
    const numericId = parseNumericTenantId(normalized);

    const row = await getPlatformDatabase()
      .selectFrom("tenants")
      .selectAll()
      .where(
        sql<boolean>`
          ${numericId === null ? sql<boolean>`false` : sql<boolean>`id = ${numericId}`}
          OR LOWER(uuid) = ${normalized}
          OR LOWER(tenant_code) = ${normalized}
          OR LOWER(tenant_code) = ${code}
          OR LOWER(slug) = ${code}
        `
      )
      .executeTakeFirst();

    return row ? this.withPrimaryDomain(toTenant(row)) : null;
  }

  async create(input: TenantSavePayload) {
    const uuid = normalizeUuid(input.uuid) || createPublicUuid();
    const resolvedTenantKey = uuid;
    const tenantInput = {
      ...input,
      primaryDomain: normalizeTenantDomain(
        input.primaryDomain || defaultTenantDomainForSlug(input.slug || input.tenantCode)
      ),
      storagePrivateRoot: input.storagePrivateRoot || tenantPrivateStorageRoot(resolvedTenantKey),
      storagePublicRoot: input.storagePublicRoot || tenantPublicStorageRoot(resolvedTenantKey),
      storageRoot: input.storageRoot || tenantStorageRoot(resolvedTenantKey),
      uuid
    };
    const result = await getPlatformDatabase()
      .insertInto("tenants")
      .values(toTenantRow(tenantInput))
      .executeTakeFirst();
    const tenant: Tenant = {
      ...tenantInput,
      id: Number(result.insertId)
    };
    try {
      tenant.primaryDomain = await this.ensurePrimaryDomain(tenant.id, tenant.primaryDomain);
      await this.audit(tenant.id, "tenant.created");
      return tenant;
    } catch (error) {
      try {
        await getPlatformDatabase().deleteFrom("tenants").where("id", "=", tenant.id).execute();
      } catch (cleanupError) {
        throw new Error(
          `${errorMessage(error)} Registry cleanup also failed: ${errorMessage(cleanupError)}`,
          { cause: cleanupError }
        );
      }
      throw error;
    }
  }

  async update(id: string, input: TenantSavePayload) {
    const existing = await this.findByIdOrCode(id);
    if (!existing) return null;
    const tenant = { ...existing, ...input, id: existing.id };
    await getPlatformDatabase()
      .updateTable("tenants")
      .set(toTenantRow(tenant))
      .where("id", "=", tenant.id)
      .execute();
    tenant.primaryDomain = await this.ensurePrimaryDomain(tenant.id, tenant.primaryDomain);
    await this.audit(tenant.id, "tenant.updated");
    return tenant;
  }

  async findByCorporateId(value: string) {
    const corporateId = normalizeIdentity(value);
    if (!corporateId) return null;
    const row = await getPlatformDatabase()
      .selectFrom("tenants")
      .selectAll()
      .where("status", "=", "active")
      .where(sql<string>`LOWER(corporate_id)`, "=", corporateId)
      .executeTakeFirst();
    return row ? this.withPrimaryDomain(toTenant(row)) : null;
  }

  async ensurePrimaryDomain(tenantId: number, domain: string) {
    return seedTenantDomain({ domain, tenantId }, (input) =>
      this.domains.upsertPrimaryDomain(input)
    );
  }

  async findByDomain(value: string) {
    const tenantId = await this.domains.findVerifiedTenantIdByDomain(value);
    if (!tenantId) return null;
    const tenant = await this.findByIdOrCode(String(tenantId));
    return tenant?.status === "active" ? tenant : null;
  }

  async setStatus(id: string, status: Tenant["status"]) {
    const existing = await this.findByIdOrCode(id);
    if (!existing) return null;
    const tenant = { ...existing, status };
    await getPlatformDatabase()
      .updateTable("tenants")
      .set({ status })
      .where("id", "=", tenant.id)
      .execute();
    await this.audit(tenant.id, status === "active" ? "tenant.restored" : "tenant.suspended");
    return tenant;
  }

  async updateAccess(
    tenant: Tenant,
    enabledModuleKeys: string[],
    defaultLandingApp: Tenant["defaultLandingApp"]
  ) {
    const manuallyEnabledKeys = parseStringArrayFromRecord(tenant.payloadSettings.apps, "enabled");
    const manuallyDisabledKeys = parseStringArrayFromRecord(
      tenant.payloadSettings.apps,
      "disabled"
    );
    const normalizedKeys = Array.from(
      new Set(
        [
          "platform.application",
          ...tenant.enabledModuleKeys,
          ...manuallyEnabledKeys,
          ...enabledModuleKeys
        ].map((key) => {
          if (key === "platform.tenant") return "platform.application";
          if (key === "accounts.accounting") return "accounts.overview";
          return key;
        })
      )
    )
      .filter((key) => key === "platform.application" || !manuallyDisabledKeys.includes(key))
      .filter((key) => key !== "devkit" && key !== "project-manager")
      .sort();
    const payloadSettings = {
      ...tenant.payloadSettings,
      apps: {
        ...(isRecord(tenant.payloadSettings.apps) ? tenant.payloadSettings.apps : {}),
        disabled: manuallyDisabledKeys.filter((key) => key !== "platform.application"),
        enabled: normalizedKeys
      },
      landing: {
        ...(isRecord(tenant.payloadSettings.landing) ? tenant.payloadSettings.landing : {}),
        app: defaultLandingApp,
        mode: "tenant"
      }
    };

    await getPlatformDatabase()
      .updateTable("tenants")
      .set({
        default_landing_app: defaultLandingApp,
        enabled_module_keys: JSON.stringify(normalizedKeys),
        payload_settings: JSON.stringify(payloadSettings)
      })
      .where("id", "=", tenant.id)
      .execute();
    await this.audit(tenant.id, "tenant.access.updated");

    return {
      ...tenant,
      defaultLandingApp,
      enabledModuleKeys: normalizedKeys,
      payloadSettings
    };
  }

  async activity(id: string) {
    const tenant = await this.findByIdOrCode(id);
    if (!tenant) return [];
    const rows = await getPlatformDatabase()
      .selectFrom("tenant_audit_events")
      .select(["id", "actor_email", "event_name", "created_at"])
      .where("tenant_id", "=", tenant.id)
      .orderBy("created_at", "desc")
      .orderBy("id", "desc")
      .execute();
    return rows.map((row) => ({
      actor_email: row.actor_email,
      created_at: toIsoDate(row.created_at),
      event_name: row.event_name,
      id: String(row.id)
    }));
  }

  async findTenantUserByEmail(tenant: Tenant, email: string) {
    const database = getTenantDatabase(tenant);
    const row = await database
      .selectFrom("app_users")
      .select(["id", "uuid", "name", "email", "password_hash", "role", "status"])
      .where(sql<string>`LOWER(email)`, "=", email.trim().toLowerCase())
      .executeTakeFirst();
    return row as TenantUserRow | undefined;
  }

  findTenantUserByLogin(tenant: Tenant, identifier: string) {
    return findTenantUserForLogin(getTenantDatabase(tenant), identifier);
  }

  async updateTenantUserPasswordHash(tenant: Tenant, userUuid: string, passwordHash: string) {
    await getTenantDatabase(tenant)
      .updateTable("app_users")
      .set({ password_hash: passwordHash, updated_at: new Date() })
      .where("uuid", "=", userUuid)
      .execute();
  }

  private async audit(tenantId: number, eventName: string) {
    await getPlatformDatabase()
      .insertInto("tenant_audit_events")
      .values({
        actor_email: "system@codexsun.app",
        event_name: eventName,
        tenant_id: tenantId,
        uuid: createPublicUuid()
      })
      .execute();
  }

  private async withPrimaryDomains(tenants: Tenant[]) {
    return Promise.all(tenants.map((tenant) => this.withPrimaryDomain(tenant)));
  }

  private async withPrimaryDomain(tenant: Tenant) {
    return {
      ...tenant,
      primaryDomain: await this.domains.primaryDomainForTenant(tenant.id, tenant.slug)
    };
  }
}

function parseStringArrayFromRecord(value: unknown, key: string) {
  if (!isRecord(value)) return [];
  const entry = value[key];
  return Array.isArray(entry)
    ? entry.filter((item): item is string => typeof item === "string")
    : [];
}

type TenantRow = {
  corporate_id: string | null;
  db_host: string;
  db_name: string;
  db_port: number;
  db_secret_ref: string;
  db_type: string;
  db_user: string;
  default_landing_app: Tenant["defaultLandingApp"];
  enabled_module_keys: string;
  id: number;
  mobile: string | null;
  payload_settings: string;
  primary_domain?: string;
  slug: string;
  status: Tenant["status"];
  storage_private_root: string;
  storage_public_root: string;
  storage_root: string;
  tenant_code: string;
  tenant_name: string;
  uuid: string;
};

type TenantWriteRow = Omit<TenantRow, "id" | "primary_domain">;

type TenantUserRow = {
  email: string;
  id: number;
  name: string;
  password_hash: string;
  role: string;
  status: "active" | "inactive" | "suspended";
  uuid: string;
};

function toTenantRow(tenant: TenantSavePayload | Tenant): TenantWriteRow {
  const tenantKey = tenant.slug || tenant.tenantCode;
  return {
    corporate_id: tenant.corporateId,
    db_host: tenant.dbHost,
    db_name: tenant.dbName,
    db_port: tenant.dbPort,
    db_secret_ref: tenant.dbSecretRef,
    db_type: tenant.dbType,
    db_user: tenant.dbUser,
    default_landing_app: tenant.defaultLandingApp,
    enabled_module_keys: JSON.stringify(tenant.enabledModuleKeys),
    mobile: tenant.mobile,
    payload_settings: JSON.stringify(tenant.payloadSettings),
    slug: tenant.slug,
    status: tenant.status,
    storage_private_root: tenant.storagePrivateRoot || tenantPrivateStorageRoot(tenantKey),
    storage_public_root: tenant.storagePublicRoot || tenantPublicStorageRoot(tenantKey),
    storage_root: tenant.storageRoot || tenantStorageRoot(tenantKey),
    tenant_code: tenant.tenantCode,
    tenant_name: tenant.tenantName,
    uuid: normalizeUuid(tenant.uuid) || createPublicUuid()
  };
}

function toTenant(row: TenantRow): Tenant {
  const tenantKey = row.slug || row.tenant_code;
  return {
    corporateId: row.corporate_id,
    dbHost: row.db_host,
    dbName: row.db_name,
    dbPort: Number(row.db_port),
    dbSecretRef: row.db_secret_ref,
    dbType: row.db_type,
    dbUser: row.db_user,
    defaultLandingApp: row.default_landing_app,
    enabledModuleKeys: parseTenantModuleKeys(row.enabled_module_keys),
    id: Number(row.id),
    mobile: row.mobile,
    payloadSettings: parseRecord(row.payload_settings),
    primaryDomain: normalizeTenantDomain(
      row.primary_domain ?? defaultTenantDomainForSlug(row.slug)
    ),
    slug: row.slug,
    status: row.status,
    storagePrivateRoot: row.storage_private_root || tenantPrivateStorageRoot(tenantKey),
    storagePublicRoot: row.storage_public_root || tenantPublicStorageRoot(tenantKey),
    storageRoot: row.storage_root || tenantStorageRoot(tenantKey),
    tenantCode: row.tenant_code,
    tenantName: row.tenant_name,
    uuid: row.uuid
  };
}

function parseRecord(value: unknown): Record<string, unknown> {
  if (isRecord(value)) return value;
  if (typeof value !== "string") return {};
  try {
    const parsed = JSON.parse(value);
    return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toIsoDate(value: Date | string) {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function normalizeIdentity(value: string) {
  return value.trim().toLowerCase();
}

export function parseNumericTenantId(value: string) {
  const normalized = value.trim();
  if (!/^\d+$/u.test(normalized)) return null;
  const numericId = Number(normalized);
  return Number.isSafeInteger(numericId) && numericId > 0 ? numericId : null;
}

function errorMessage(error: unknown) {
  return error instanceof Error && error.message ? error.message : String(error);
}

function createPublicUuid() {
  return randomBytes(4).toString("hex");
}

function normalizeUuid(value: string | undefined) {
  return (
    value
      ?.trim()
      .toLowerCase()
      .replace(/[^a-f0-9]/g, "")
      .slice(0, 8) ?? ""
  );
}
