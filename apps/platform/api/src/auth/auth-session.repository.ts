import { randomBytes } from "node:crypto";
import { getPlatformDatabase } from "../database/platform-database.js";
import type { AuthUserType, TenantAccessMode } from "./jwt.js";
import { parseSessionAuthority } from "./auth-session-authority.js";

export type TenantSessionCache = {
  cachedAt: string;
  company: {
    code: string;
    id: number;
    name: string;
  } | null;
  defaultCompany: {
    companyId: number;
    companyName: string;
    financialYearId: number;
    financialYearName: string;
    landingApp: string;
  } | null;
  enabledModuleKeys: string[];
  landingPage: string;
  safeSettings: Record<string, unknown>;
  tenant: {
    code: string;
    id: string;
    name: string;
  } | null;
};

export type AuthSessionRecord = {
  context: TenantSessionCache;
  expiresAt: Date;
  jti: string;
  lastSeenAt: Date;
  loginHost: string;
  revokedAt: Date | null;
  tenantAccessMode: TenantAccessMode;
  tenantCode: string | null;
  tenantDbName: string | null;
  tenantId: string | null;
  userEmail: string;
  userName: string | null;
  userType: AuthUserType;
  userUuid: string;
  uuid: string;
};

export class AuthSessionRepository {
  async create(input: Omit<AuthSessionRecord, "lastSeenAt" | "revokedAt" | "uuid">) {
    const now = new Date();
    const uuid = randomBytes(4).toString("hex");
    await getPlatformDatabase()
      .insertInto("auth_sessions")
      .values({
        context_json: JSON.stringify(input.context),
        expires_at: input.expiresAt,
        jti: input.jti,
        last_seen_at: now,
        login_host: input.loginHost,
        revoked_at: null,
        tenant_access_mode: input.tenantAccessMode,
        tenant_code: input.tenantCode,
        tenant_db_name: input.tenantDbName,
        tenant_id: input.tenantId,
        user_email: input.userEmail,
        user_name: input.userName,
        user_type: input.userType,
        user_uuid: input.userUuid,
        uuid
      })
      .execute();
    return this.findActive(input.jti);
  }

  async findActive(jti: string) {
    const row = await getPlatformDatabase()
      .selectFrom("auth_sessions")
      .selectAll()
      .where("jti", "=", jti)
      .where("revoked_at", "is", null)
      .where("expires_at", ">", new Date())
      .executeTakeFirst();
    return row ? toRecord(row) : null;
  }

  async revoke(jti: string) {
    await getPlatformDatabase()
      .updateTable("auth_sessions")
      .set({ revoked_at: new Date(), updated_at: new Date() })
      .where("jti", "=", jti)
      .where("revoked_at", "is", null)
      .execute();
  }

  async touch(jti: string) {
    await getPlatformDatabase()
      .updateTable("auth_sessions")
      .set({ last_seen_at: new Date(), updated_at: new Date() })
      .where("jti", "=", jti)
      .where("revoked_at", "is", null)
      .execute();
  }

  async purgeExpired() {
    await getPlatformDatabase()
      .deleteFrom("auth_sessions")
      .where("expires_at", "<", new Date(Date.now() - 24 * 60 * 60 * 1000))
      .execute();
  }
}

function toRecord(row: {
  context_json: string;
  expires_at: Date | string;
  jti: string;
  last_seen_at: Date | string;
  login_host: string;
  revoked_at: Date | string | null;
  tenant_access_mode: string;
  tenant_code: string | null;
  tenant_db_name: string | null;
  tenant_id: string | null;
  user_email: string;
  user_name: string | null;
  user_type: string;
  user_uuid: string;
  uuid: string;
}): AuthSessionRecord | null {
  const authority=parseSessionAuthority(row.user_type,row.tenant_access_mode);
  if (!authority) return null;
  return {
    context: parseContext(row.context_json),
    expiresAt: new Date(row.expires_at),
    jti: row.jti,
    lastSeenAt: new Date(row.last_seen_at),
    loginHost: row.login_host,
    revokedAt: row.revoked_at ? new Date(row.revoked_at) : null,
    tenantAccessMode: authority.tenantAccessMode,
    tenantCode: row.tenant_code,
    tenantDbName: row.tenant_db_name,
    tenantId: row.tenant_id,
    userEmail: row.user_email,
    userName: row.user_name,
    userType: authority.userType,
    userUuid: row.user_uuid,
    uuid: row.uuid
  };
}

function parseContext(value: string): TenantSessionCache {
  try {
    return JSON.parse(value) as TenantSessionCache;
  } catch {
    return emptySessionCache();
  }
}

export function emptySessionCache(): TenantSessionCache {
  return {
    cachedAt: new Date(0).toISOString(),
    company: null,
    defaultCompany: null,
    enabledModuleKeys: [],
    landingPage: "application",
    safeSettings: {},
    tenant: null
  };
}
