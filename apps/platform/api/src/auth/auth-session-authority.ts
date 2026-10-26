import type { AuthSessionRecord } from "./auth-session.repository.js";
import type { AuthTokenPayload, AuthUserType, TenantAccessMode } from "./jwt.js";

export function claimsMatchSession(
  payload: AuthTokenPayload,
  session: AuthSessionRecord | null
): session is AuthSessionRecord {
  if (!session) return false;
  return (
    session.jti === payload.jti &&
    session.userUuid === payload.userId &&
    session.userType === payload.userType &&
    session.tenantId === (payload.tenantId ?? null) &&
    session.tenantDbName === (payload.tenantDbName ?? null) &&
    session.loginHost === payload.loginHost &&
    session.tenantAccessMode === payload.tenantAccessMode
  );
}

export function hasActiveSuperAdminSession(
  context:
    | {
        payload: AuthTokenPayload;
        session: AuthSessionRecord;
      }
    | undefined
) {
  const payload = context?.payload;
  const session = context?.session;
  return Boolean(
    payload?.userType === "super_admin" &&
    typeof payload.jti === "string" &&
    payload.jti.length > 0 &&
    typeof payload.userId === "string" &&
    payload.userId.length > 0 &&
    typeof payload.exp === "number" &&
    payload.tenantAccessMode === "platform" &&
    session &&
    claimsMatchSession(payload, session) &&
    session.revokedAt === null &&
    session.expiresAt instanceof Date &&
    session.expiresAt.getTime() > Date.now() &&
    payload.exp * 1000 > Date.now() &&
    session.tenantId === null &&
    session.tenantDbName === null
  );
}

export function parseSessionAuthority(
  userType: string,
  accessMode: string
): {
  userType: AuthUserType;
  tenantAccessMode: TenantAccessMode;
} | null {
  if (userType !== "super_admin" && userType !== "staff" && userType !== "tenant") return null;
  if (accessMode !== "platform" && accessMode !== "shared_domain" && accessMode !== "custom_domain")
    return null;
  return { userType, tenantAccessMode: accessMode };
}
