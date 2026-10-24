import { createHash, randomBytes } from "node:crypto";
import type { Kysely } from "kysely";
import { getPlatformDatabase } from "../../database/platform-database.js";
import type { TenantDatabase } from "../../database/schema.js";
import type {
  PasswordResetRequestRecord,
  PlatformCredential,
  RecoveryDesk
} from "./credential-recovery.types.js";

export class CredentialRecoveryRepository {
  async isActiveSuperAdmin(email: string) {
    const row = await getPlatformDatabase()
      .selectFrom("platform_auth_users")
      .select("id")
      .where("user_type", "=", "super_admin")
      .where("email", "=", normalizeEmail(email))
      .where("status", "=", "active")
      .executeTakeFirst();
    return Boolean(row);
  }
  async findPlatformCredential(userType: "staff" | "super_admin", email: string) {
    const row = await getPlatformDatabase()
      .selectFrom("platform_auth_users")
      .selectAll()
      .where("user_type", "=", userType)
      .where("email", "=", normalizeEmail(email))
      .executeTakeFirst();
    return row ? toCredential(row) : null;
  }

  async updatePlatformCredentialPasswordHash(
    userType: "staff" | "super_admin",
    userUuid: string,
    passwordHash: string
  ) {
    await getPlatformDatabase()
      .updateTable("platform_auth_users")
      .set({ password_hash: passwordHash, updated_at: new Date() })
      .where("user_type", "=", userType)
      .where("uuid", "=", userUuid)
      .execute();
  }

  async createRequest(input: {
    desk: RecoveryDesk;
    email: string;
    expiresAt: Date;
    tenantDatabase?: string;
    tenantId?: string;
    tokenHash: string;
    userUuid: string;
  }) {
    await getPlatformDatabase()
      .updateTable("password_reset_requests")
      .set({ consumed_at: new Date() })
      .where("email", "=", normalizeEmail(input.email))
      .where("desk", "=", input.desk)
      .where("consumed_at", "is", null)
      .execute();
    const result = await getPlatformDatabase()
      .insertInto("password_reset_requests")
      .values({
        consumed_at: null,
        desk: input.desk,
        email: normalizeEmail(input.email),
        expires_at: input.expiresAt,
        tenant_database: input.tenantDatabase ?? null,
        tenant_id: input.tenantId ?? null,
        token_hash: input.tokenHash,
        user_uuid: input.userUuid,
        uuid: randomBytes(4).toString("hex")
      })
      .executeTakeFirst();
    return this.findRequestById(Number(result.insertId));
  }

  async findActiveRequest(tokenHash: string) {
    const row = await getPlatformDatabase()
      .selectFrom("password_reset_requests")
      .selectAll()
      .where("token_hash", "=", tokenHash)
      .where("consumed_at", "is", null)
      .where("expires_at", ">", new Date())
      .executeTakeFirst();
    return row ? toRequest(row) : null;
  }

  async updatePassword(
    request: PasswordResetRequestRecord,
    passwordHash: string,
    tenantDatabase?: Kysely<TenantDatabase>
  ) {
    if (request.desk === "tenant") {
      if (!tenantDatabase) return false;
      const result = await tenantDatabase
        .updateTable("app_users")
        .set({ password_hash: passwordHash, updated_at: new Date() })
        .where("uuid", "=", request.userUuid)
        .where("email", "=", request.email)
        .executeTakeFirst();
      return Number(result.numUpdatedRows ?? 0) === 1;
    }
    const userType = request.desk === "sa" ? "super_admin" : "staff";
    const result = await getPlatformDatabase()
      .updateTable("platform_auth_users")
      .set({ password_hash: passwordHash, updated_at: new Date() })
      .where("user_type", "=", userType)
      .where("uuid", "=", request.userUuid)
      .where("email", "=", request.email)
      .executeTakeFirst();
    return Number(result.numUpdatedRows ?? 0) === 1;
  }

  async consume(id: number) {
    const result = await getPlatformDatabase()
      .updateTable("password_reset_requests")
      .set({ consumed_at: new Date() })
      .where("id", "=", id)
      .where("consumed_at", "is", null)
      .where("expires_at", ">", new Date())
      .executeTakeFirst();
    return Number(result.numUpdatedRows ?? 0) === 1;
  }

  async purgeExpired() {
    await getPlatformDatabase()
      .deleteFrom("password_reset_requests")
      .where("expires_at", "<", new Date(Date.now() - 24 * 60 * 60 * 1000))
      .execute();
  }

  private async findRequestById(id: number) {
    const row = await getPlatformDatabase()
      .selectFrom("password_reset_requests")
      .selectAll()
      .where("id", "=", id)
      .executeTakeFirst();
    return row ? toRequest(row) : null;
  }
}

export function stableCredentialUuid(userType: string, email: string) {
  return createHash("sha256")
    .update(`${userType}:${normalizeEmail(email)}`)
    .digest("hex")
    .slice(0, 8);
}

function toCredential(row: {
  email: string;
  name: string;
  password_hash: string;
  status: string;
  user_type: string;
  uuid: string;
}): PlatformCredential {
  return {
    email: row.email,
    name: row.name,
    passwordHash: row.password_hash,
    status: row.status === "active" ? "active" : "inactive",
    userType: row.user_type === "super_admin" ? "super_admin" : "staff",
    uuid: row.uuid
  };
}

function toRequest(row: {
  consumed_at: Date | string | null;
  desk: string;
  email: string;
  expires_at: Date | string;
  id: number;
  tenant_database: string | null;
  tenant_id: string | null;
  token_hash: string;
  user_uuid: string;
  uuid: string;
}): PasswordResetRequestRecord {
  return {
    consumedAt: row.consumed_at ? new Date(row.consumed_at) : null,
    desk: row.desk === "sa" || row.desk === "admin" ? row.desk : "tenant",
    email: row.email,
    expiresAt: new Date(row.expires_at),
    id: Number(row.id),
    tenantDatabase: row.tenant_database,
    tenantId: row.tenant_id,
    tokenHash: row.token_hash,
    userUuid: row.user_uuid,
    uuid: row.uuid
  };
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}
