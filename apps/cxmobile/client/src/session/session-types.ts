export type Desk = "tenant" | "admin" | "sa" | "staff" | "super_admin";

export class PlatformApiError extends Error {
  constructor(
    message: string,
    readonly statusCode: number,
    readonly code?: string
  ) {
    super(message);
    this.name = "PlatformApiError";
  }
}

export class TenantIsolationError extends Error {
  constructor(message = "Cross-tenant access denied.") {
    super(message);
    this.name = "TenantIsolationError";
  }
}

export class HostVerificationError extends Error {
  constructor(message = "API host verification failed. Host is not allowed.") {
    super(message);
    this.name = "HostVerificationError";
  }
}

export class StaleResponseError extends Error {
  constructor(message = "Response was discarded because session context changed.") {
    super(message);
    this.name = "StaleResponseError";
  }
}

export interface LoginCredentials {
  desk: Desk;
  identifier?: string;
  email?: string;
  password: string;
  corporateId?: string;
  tenantCode?: string;
}

export interface SessionCompanyContext {
  code: string;
  id: number;
  name: string;
}

export interface SessionDefaultCompanyContext {
  companyId: number;
  companyName: string;
  financialYearId: number;
  financialYearName: string;
  landingApp: string;
}

export interface SessionTenantContext {
  code: string;
  id: string;
  name: string;
}

export interface SessionContext {
  cachedAt: string;
  company: SessionCompanyContext | null;
  defaultCompany: SessionDefaultCompanyContext | null;
  enabledModuleKeys: string[];
  landingPage: string;
  safeSettings: Record<string, unknown>;
  tenant: SessionTenantContext | null;
}

export interface SessionRecord {
  activeCompanyId?: number | undefined;
  activeFinancialYearId?: number | undefined;
  apiBaseUrl?: string | undefined;
  apiOrigin: string;
  authenticated: boolean;
  context?: SessionContext | undefined;
  desk: Desk;
  email: string;
  expiresAt: string;
  loginHost: string;
  name?: string | undefined;
  permissions?: string[] | undefined;
  role?: string | undefined;
  sessionGeneration: number;
  sessionIssuedAt?: number | undefined;
  sessionSlot: string;
  tenantCode?: string | undefined;
  tenantDbName?: string | undefined;
  tenantId?: string | undefined;
  tenantUuid?: string | undefined;
  token?: string | undefined;
  userType: string;
}

export type SessionStatus = "unauthenticated" | "authenticating" | "authenticated" | "expired";

export interface SessionState {
  generation: number;
  session: SessionRecord | null;
  status: SessionStatus;
}
