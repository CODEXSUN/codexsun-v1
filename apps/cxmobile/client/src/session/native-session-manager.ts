import { Capacitor } from "@capacitor/core";
import { HostVerifier } from "./host-verifier.js";
import {
  type Desk,
  type LoginCredentials,
  PlatformApiError,
  type SessionContext,
  type SessionRecord,
  type SessionState,
  type SessionStatus,
  TenantIsolationError
} from "./session-types.js";
import { NativeSecureKeyStore, NativeSecureStorage } from "../native/storage.js";

export interface NativeSessionManagerOptions {
  apiOrigin?: string;
  fetchImpl?: typeof fetch;
  hostVerifier?: HostVerifier;
  storage?: NativeSecureStorage;
}

interface ServerApiResponse<T> {
  data?: T;
  error?: {
    code?: string;
    message?: string;
  };
  success: boolean;
}

interface ServerLoginData {
  accessToken?: string;
  authenticated: boolean;
  context?: SessionContext;
  corporateId?: string;
  email: string;
  expiresAt: string;
  name?: string;
  role?: string;
  sessionIssuedAt?: number;
  sessionSlot?: string;
  tenantCode?: string;
  tenantDbName?: string;
  tenantId?: string;
  tenantUuid?: string;
  token?: string;
  userType: string;
}

export class NativeSessionManager {
  private readonly storage: NativeSecureStorage;
  private readonly hostVerifier: HostVerifier;
  private readonly fetchImpl: typeof fetch;
  private configuredApiOrigin: string | null = null;
  private configuredApiBaseUrl: string | null = null;

  private _activeSession: SessionRecord | null = null;
  private _generation = 1;
  private _status: SessionStatus = "unauthenticated";
  private readonly listeners = new Set<(state: SessionState) => void>();

  constructor(options: NativeSessionManagerOptions = {}) {
    this.storage = options.storage ?? new NativeSecureStorage();
    this.hostVerifier = options.hostVerifier ?? new HostVerifier({ allowLoopback: true });
    this.fetchImpl = options.fetchImpl ?? globalThis.fetch;
    if (options.apiOrigin) {
      this.setApiOrigin(options.apiOrigin);
    }
  }

  setApiOrigin(originOrUrl: string): void {
    const { baseUrl, origin: verifiedOrigin } = this.hostVerifier.assertHostAllowed(originOrUrl);
    this.configuredApiOrigin = verifiedOrigin;
    this.configuredApiBaseUrl = baseUrl;
  }

  get apiOrigin(): string | null {
    return this._activeSession?.apiOrigin ?? this.configuredApiOrigin;
  }

  get apiBaseUrl(): string | null {
    return this._activeSession?.apiBaseUrl ?? this.configuredApiBaseUrl ?? this.configuredApiOrigin;
  }

  get activeSession(): SessionRecord | null {
    return this._activeSession;
  }

  get currentGeneration(): number {
    return this._generation;
  }

  get sessionSlot(): string | null {
    return this._activeSession?.sessionSlot ?? null;
  }

  get status(): SessionStatus {
    return this._status;
  }

  get state(): SessionState {
    return {
      generation: this._generation,
      session: this._activeSession,
      status: this._status
    };
  }

  subscribe(listener: (state: SessionState) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    const currentState = this.state;
    for (const listener of this.listeners) {
      try {
        listener(currentState);
      } catch {
        // Prevent listener error from disrupting session coordination
      }
    }
  }

  isResponseStale(requestGeneration: number, requestSlot?: string): boolean {
    if (requestGeneration !== this._generation) return true;
    if (requestSlot && this._activeSession && requestSlot !== this._activeSession.sessionSlot) {
      return true;
    }
    return false;
  }

  assertTenantAccess(targetTenantId: string): void {
    if (!this._activeSession) {
      throw new PlatformApiError("No active session found.", 401);
    }
    const currentTenant = this._activeSession.tenantId ?? this._activeSession.tenantUuid;
    if (!currentTenant || currentTenant !== targetTenantId) {
      throw new TenantIsolationError(
        `Cross-tenant access denied: current tenant (${currentTenant ?? "none"}) does not match target (${targetTenantId}).`
      );
    }
  }

  async login(credentials: LoginCredentials, targetApiOrigin?: string): Promise<SessionRecord> {
    const originToUse = targetApiOrigin ?? this.configuredApiBaseUrl ?? this.configuredApiOrigin;
    if (!originToUse) {
      throw new PlatformApiError("No API origin specified for login.", 400);
    }

    const { baseUrl, origin: verifiedOrigin, host: verifiedHost } =
      this.hostVerifier.assertHostAllowed(originToUse);

    const desk = credentials.desk;
    const corporateId = credentials.corporateId ?? credentials.tenantCode;

    // Corporate ID requirement for tenant desk on shared application domain
    if (desk === "tenant" && !corporateId) {
      // If host is not a verified custom domain, corporate ID is strictly required
      const isCustom = this.hostVerifier.isCustomDomainVerified(verifiedHost);
      if (!isCustom) {
        throw new PlatformApiError(
          "Corporate ID is required to select your workspace on shared domains.",
          400,
          "AUTH_CORPORATE_ID_REQUIRED"
        );
      }
    }

    this._status = "authenticating";
    this.notify();

    let data: ServerLoginData;
    let token: string | undefined;

    // On native platforms with hardware vault plugin, execute login natively
    // so credentials are exchanged and bearer tokens encrypted directly in KeyStore
    // without ever exposing raw secrets to JavaScript web memory (XR01).
    if (Capacitor.isNativePlatform() && NativeSecureKeyStore.performNativeLogin) {
      try {
        const nativeRes = await NativeSecureKeyStore.performNativeLogin({
          credentials: {
            corporateId,
            email: credentials.email,
            identifier: credentials.identifier,
            password: credentials.password
          },
          desk,
          url: `${baseUrl}/auth/login`
        });
        data = nativeRes.data as unknown as ServerLoginData;
        token = undefined; // Kept native-isolated
      } catch (err: unknown) {
        this._status = "unauthenticated";
        this.notify();
        const message = err instanceof Error ? err.message : "Native login failed.";
        throw new PlatformApiError(message, 401, "AUTH_INVALID_CREDENTIALS");
      }
    } else {
      const requestBody = {
        desk,
        ...(credentials.identifier ? { identifier: credentials.identifier } : {}),
        ...(credentials.email ? { email: credentials.email } : {}),
        password: credentials.password,
        ...(corporateId ? { corporateId, tenantCode: corporateId } : {})
      };

      let response: Response;
      try {
        response = await this.fetchImpl(`${baseUrl}/auth/login`, {
          body: JSON.stringify(requestBody),
          headers: {
            "Accept": "application/json",
            "Content-Type": "application/json",
            "x-auth-desk": desk,
            "x-auth-token-delivery": "bearer"
          },
          method: "POST"
        });
      } catch (err: unknown) {
        this._status = "unauthenticated";
        this.notify();
        const message = err instanceof Error ? err.message : "Network error during login.";
        throw new PlatformApiError(`Login failed: ${message}`, 503);
      }

      const responseText = await response.text();
      let body: ServerApiResponse<ServerLoginData>;
      try {
        body = JSON.parse(responseText) as ServerApiResponse<ServerLoginData>;
      } catch {
        this._status = "unauthenticated";
        this.notify();
        throw new PlatformApiError("Failed to parse login response from server.", response.status);
      }

      if (!response.ok || !body.success || !body.data) {
        this._status = "unauthenticated";
        this.notify();
        const message = body.error?.message ?? "Invalid credentials or workspace.";
        const code = body.error?.code ?? "AUTH_INVALID_CREDENTIALS";
        throw new PlatformApiError(message, response.status, code);
      }

      data = body.data;
      token = data.accessToken ?? data.token;
    }

    if (desk === "tenant" && (!data.tenantId || !data.tenantDbName)) {
      this._status = "unauthenticated";
      this.notify();
      throw new PlatformApiError("Tenant login response is incomplete.", 502);
    }

    // Require valid server-issued session slot; never manufacture random slot (XR03)
    const slot = data.sessionSlot;
    if (!slot) {
      this._status = "unauthenticated";
      this.notify();
      throw new PlatformApiError("Server did not issue an authorized session slot.", 401);
    }

    // Advance session generation to invalidate any previous session in-flight operations
    this._generation += 1;

    const defaultComp = data.context?.defaultCompany;

    const isNative = Capacitor.isNativePlatform();
    const rawToken = token ?? undefined;
    const sessionToken = isNative && rawToken ? "[native-isolated]" : rawToken;

    const sessionPermissions =
      (data as { permissions?: string[] }).permissions ??
      (data as { grantedPermissions?: string[] }).grantedPermissions ??
      (data.context as { permissions?: string[] } | undefined)?.permissions ??
      [];

    const session: SessionRecord = {
      activeCompanyId: defaultComp?.companyId,
      activeFinancialYearId: defaultComp?.financialYearId,
      apiBaseUrl: baseUrl,
      apiOrigin: verifiedOrigin,
      authenticated: true,
      context: data.context,
      desk,
      email: data.email,
      expiresAt: data.expiresAt,
      loginHost: verifiedHost,
      name: data.name,
      permissions: sessionPermissions,
      role: data.role,
      sessionGeneration: this._generation,
      sessionIssuedAt: data.sessionIssuedAt,
      sessionSlot: slot,
      tenantCode: data.tenantCode ?? corporateId,
      tenantDbName: data.tenantDbName,
      tenantId: data.tenantId,
      tenantUuid: data.tenantUuid ?? data.tenantId,
      token: sessionToken,
      userType: data.userType
    };

    // Store in secure storage: on non-native environments, store into adapter;
    // on native devices with hardware vault, performNativeLogin already established the immutable KeyStore record.
    if (!(isNative && Boolean(NativeSecureKeyStore.performNativeLogin))) {
      await this.storage.storeSession(session, rawToken);
    }

    this._activeSession = session;
    this._status = "authenticated";
    this.notify();

    return session;
  }

  async restoreSession(desk?: Desk): Promise<SessionRecord | null> {
    const stored = await this.storage.getStoredSession();
    if (!stored || !stored.sessionSlot) {
      this._activeSession = null;
      this._status = "unauthenticated";
      return null;
    }

    // Check client-side expiration
    if (new Date(stored.expiresAt).getTime() <= Date.now()) {
      await this.storage.clearSession();
      this._activeSession = null;
      this._status = "expired";
      this.notify();
      return null;
    }

    // Verify host
    try {
      this.hostVerifier.assertHostAllowed(stored.apiOrigin);
    } catch {
      await this.storage.clearSession();
      this._activeSession = null;
      this._status = "unauthenticated";
      return null;
    }

    // Verify with server GET /auth/session
    const headers: Record<string, string> = {
      "Accept": "application/json",
      "x-codexsun-session-slot": stored.sessionSlot
    };
    if (stored.desk || desk) {
      headers["x-auth-desk"] = stored.desk || desk!;
    }
    if (stored.token && stored.token !== "[native-isolated]") {
      headers["Authorization"] = `Bearer ${stored.token}`;
    }

    let response: Response;
    try {
      if (Capacitor.isNativePlatform()) {
        const nativeRes = await this.storage.executeAuthenticatedRequest({
          headers,
          method: "GET",
          url: `${stored.apiBaseUrl ?? stored.apiOrigin}/auth/session`
        });
        response = new Response(nativeRes.data, {
          headers: nativeRes.headers,
          status: nativeRes.status
        });
      } else {
        response = await this.fetchImpl(`${stored.apiBaseUrl ?? stored.apiOrigin}/auth/session`, {
          headers,
          method: "GET"
        });
      }
    } catch {
      // In case of temporary offline/network error, retain stored session if not yet expired
      this._activeSession = stored;
      this._status = "authenticated";
      this.notify();
      return stored;
    }

    if (response.status === 401) {
      // Server revoked or expired the session
      await this.handleServerRevocation("Session revoked by server.");
      return null;
    }

    if (!response.ok) {
      // Other error (e.g. 500)
      return null;
    }

    const responseText = await response.text();
    let body: ServerApiResponse<ServerLoginData>;
    try {
      body = JSON.parse(responseText) as ServerApiResponse<ServerLoginData>;
    } catch {
      return null;
    }

    if (!body.success || !body.data) {
      await this.handleServerRevocation("Server rejected restored session.");
      return null;
    }

    const data = body.data;
    const restoredPermissions =
      (data as { permissions?: string[] }).permissions ??
      (data as { grantedPermissions?: string[] }).grantedPermissions ??
      (data.context as { permissions?: string[] } | undefined)?.permissions ??
      stored.permissions ??
      [];

    const updatedSession: SessionRecord = {
      ...stored,
      authenticated: true,
      context: data.context ?? stored.context,
      expiresAt: data.expiresAt ?? stored.expiresAt,
      name: data.name ?? stored.name,
      permissions: restoredPermissions,
      role: data.role ?? stored.role,
      sessionIssuedAt: data.sessionIssuedAt ?? stored.sessionIssuedAt,
      tenantCode: data.tenantCode ?? stored.tenantCode,
      tenantDbName: data.tenantDbName ?? stored.tenantDbName,
      tenantId: data.tenantId ?? stored.tenantId,
      tenantUuid: data.tenantUuid ?? stored.tenantUuid,
      userType: data.userType ?? stored.userType
    };

    await this.storage.storeSession(updatedSession);
    this._activeSession = updatedSession;
    this._status = "authenticated";
    this.notify();

    return updatedSession;
  }

  async logout(): Promise<void> {
    const current = this._activeSession;
    if (current) {
      // Best-effort server revocation with timeout
      try {
        const headers: Record<string, string> = {
          "Accept": "application/json",
          "x-codexsun-session-slot": current.sessionSlot
        };
        if (current.token && current.token !== "[native-isolated]") {
          headers["Authorization"] = `Bearer ${current.token}`;
        }
        const logoutBase = (current.apiBaseUrl ?? current.apiOrigin).replace(/\/+$/u, "");
        if (Capacitor.isNativePlatform()) {
          await this.storage.executeAuthenticatedRequest({
            headers,
            method: "POST",
            url: `${logoutBase}/auth/logout`
          });
        } else {
          await this.fetchImpl(`${logoutBase}/auth/logout`, {
            headers,
            method: "POST",
            signal: AbortSignal.timeout(2_000)
          });
        }
      } catch {
        // Best effort
      }
    }

    this._generation += 1;
    await this.storage.clearSession();
    this._activeSession = null;
    this._status = "unauthenticated";
    this.notify();
  }

  async handleServerRevocation(_reason = "Session expired. Please sign in again."): Promise<void> {
    this._generation += 1;
    await this.storage.clearSession();
    this._activeSession = null;
    this._status = "expired";
    this.notify();
  }

  async switchCompany(companyId: number, financialYearId?: number): Promise<void> {
    if (!this._activeSession) {
      throw new PlatformApiError("Cannot switch company without active session.", 401);
    }

    // Advance generation counter: in-flight requests for old company will be discarded!
    this._generation += 1;

    const current = this._activeSession;
    const updatedSession: SessionRecord = {
      ...current,
      activeCompanyId: companyId,
      activeFinancialYearId:
        financialYearId !== undefined ? financialYearId : current.activeFinancialYearId,
      sessionGeneration: this._generation
    };

    this._activeSession = updatedSession;
    await this.storage.storeSession(updatedSession);
    this.notify();
  }
}
