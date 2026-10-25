import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from "react";
import { Capacitor } from "@capacitor/core";
import { NativeHttpTransport, PlatformApiError } from "../native/http.js";
import { NativeSessionManager } from "../session/native-session-manager.js";
import type {
  Desk,
  LoginCredentials,
  SessionRecord,
  SessionStatus
} from "../session/session-types.js";
import { getRuntimeConfig } from "./runtime-config.js";

export type SupportedApp = "crm" | "billing" | "chat" | "ecommerce";

export interface NativeSessionContextValue {
  activeApp: SupportedApp;
  generation: number;
  hasPermission: (permissionOrApp: SupportedApp | string) => boolean;
  isAppEnabled: (app: SupportedApp | string) => boolean;
  login: (credentials: LoginCredentials, targetOrigin?: string) => Promise<SessionRecord>;
  logout: () => Promise<void>;
  restoreSession: (desk?: Desk) => Promise<SessionRecord | null>;
  session: SessionRecord | null;
  sessionManager: NativeSessionManager;
  setActiveApp: (app: SupportedApp) => void;
  status: SessionStatus;
  switchCompany: (companyId: number, financialYearId?: number) => Promise<void>;
  transport: NativeHttpTransport;
}

const NativeSessionContext = createContext<NativeSessionContextValue | null>(null);

function syncWebSessionStorage(session: SessionRecord | null): void {
  if (typeof window === "undefined" || !window.sessionStorage) return;

  try {
    if (session && session.authenticated) {
      if (session.tenantId || session.tenantUuid) {
        window.sessionStorage.setItem(
          "codexsun_tenant_id",
          session.tenantId ?? session.tenantUuid!
        );
      }
      if (session.tenantDbName) {
        window.sessionStorage.setItem("codexsun_tenant_db_name", session.tenantDbName);
      }
      if (session.sessionSlot) {
        window.sessionStorage.setItem("codexsun.auth.slot", session.sessionSlot);
        window.sessionStorage.setItem("x-codexsun-session-slot", session.sessionSlot);
      }
      const companyId = session.activeCompanyId ?? session.context?.defaultCompany?.companyId;
      if (companyId !== undefined) {
        window.sessionStorage.setItem("codexsun.tenant.company-id", String(companyId));
      }
      const finYearId =
        session.activeFinancialYearId ?? session.context?.defaultCompany?.financialYearId;
      if (finYearId !== undefined) {
        window.sessionStorage.setItem("codexsun.tenant.financial-year-id", String(finYearId));
      }
    } else {
      window.sessionStorage.removeItem("codexsun_tenant_id");
      window.sessionStorage.removeItem("codexsun_tenant_db_name");
      window.sessionStorage.removeItem("codexsun.auth.slot");
      window.sessionStorage.removeItem("x-codexsun-session-slot");
      window.sessionStorage.removeItem("codexsun.tenant.company-id");
      window.sessionStorage.removeItem("codexsun.tenant.financial-year-id");
    }
  } catch {
    // Storage access might be restricted in some test or strict sandboxes
  }
}

export interface NativeSessionProviderProps {
  children: ReactNode;
  initialApp?: SupportedApp;
  sessionManager?: NativeSessionManager;
  transport?: NativeHttpTransport;
}

export function evaluateSessionPermission(
  session: SessionRecord | null,
  permissionOrApp: SupportedApp | string
): boolean {
  if (!session || !session.authenticated) return false;

  const target = permissionOrApp.toLowerCase().trim();

  // App-level check delegates strictly to enabled modules
  const supportedApps = ["crm", "billing", "chat", "ecommerce"];
  if (supportedApps.includes(target)) {
    const enabledModules = session.context?.enabledModuleKeys;
    if (!enabledModules || !Array.isArray(enabledModules) || enabledModules.length === 0) {
      return false;
    }
    return enabledModules.some(
      (m) =>
        m === target ||
        m === `codexsun.${target}` ||
        m.startsWith(`${target}.`) ||
        m.startsWith(`codexsun.${target}.`) ||
        m === "all"
    );
  }

  // Granular resource permissions: role labels alone NEVER bypass explicit grants.
  // Strictly fail closed if no explicit permission grants exist in session metadata.
  const explicitPermissions =
    (session as unknown as { permissions?: string[] }).permissions ??
    (session as unknown as { grantedPermissions?: string[] }).grantedPermissions ??
    (session.context as unknown as { permissions?: string[] })?.permissions;

  if (
    !explicitPermissions ||
    !Array.isArray(explicitPermissions) ||
    explicitPermissions.length === 0
  ) {
    return false;
  }

  const normalizedGrants = explicitPermissions.map((p) => String(p).toLowerCase().trim());
  return normalizedGrants.includes(target) || normalizedGrants.includes("all");
}

/**
 * Installs a transport seam on window.fetch for Platform API requests.
 * Connects leaf owner workspaces (CRM crmRequest, Billing billingApiRequest, etc.)
 * to the NativeHttpTransport, ensuring hardware KeyStore bearer tokens and native
 * origin/path binding are enforced without leaking decrypted tokens to JavaScript.
 */
export function installNativeFetchInterceptor(
  transport: NativeHttpTransport,
  apiUrl: string
): () => void {
  if (typeof window === "undefined" || !window.fetch) return () => {};

  const originalFetch = window.fetch.bind(window);
  const normalizedBase = apiUrl.replace(/\/+$/, "");

  const interceptor: typeof window.fetch = async (input, init) => {
    const urlString =
      typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;

    const isPlatformApi =
      urlString.startsWith(normalizedBase) ||
      urlString.startsWith("/api/app") ||
      (urlString.startsWith("/") &&
        (normalizedBase.endsWith(urlString) || urlString.startsWith("/api/app/")));

    const isNativeTransport =
      Capacitor.isNativePlatform() ||
      Boolean((transport as unknown as { nativeHttpDispatcher?: unknown }).nativeHttpDispatcher);

    if (isPlatformApi && isNativeTransport) {
      try {
        const method = (init?.method ?? "GET").toUpperCase();
        let body: unknown = init?.body;

        if (typeof body === "string") {
          try {
            body = JSON.parse(body);
          } catch {}
        }

        const headers: Record<string, string> = {};
        if (init?.headers) {
          if (init.headers instanceof Headers) {
            init.headers.forEach((v, k) => {
              headers[k] = v;
            });
          } else if (Array.isArray(init.headers)) {
            for (const [k, v] of init.headers) {
              headers[k] = v;
            }
          } else {
            Object.assign(headers, init.headers);
          }
        }

        const result = await transport.request<unknown>(urlString, {
          body,
          headers,
          method,
          ...(init?.signal ? { signal: init.signal } : {}),
          skipEnvelopeUnwrap: true
        });

        const responseText = typeof result === "string" ? result : JSON.stringify(result);
        return new Response(responseText, {
          headers: { "Content-Type": "application/json" },
          status: 200,
          statusText: "OK"
        });
      } catch (err) {
        if (err instanceof PlatformApiError) {
          return new Response(
            JSON.stringify({
              error: { code: err.code, message: err.message },
              success: false
            }),
            {
              headers: { "Content-Type": "application/json" },
              status: err.statusCode,
              statusText: err.message
            }
          );
        }
      }
    }

    return originalFetch(input, init);
  };

  window.fetch = interceptor;
  return () => {
    window.fetch = originalFetch;
  };
}

export function NativeSessionProvider({
  children,
  initialApp = "crm",
  sessionManager: customSessionManager,
  transport: customTransport
}: NativeSessionProviderProps) {
  const sessionManager = useMemo(() => {
    if (customSessionManager) return customSessionManager;
    const origin = getRuntimeConfig("VITE_PLATFORM_API_URL", "http://127.0.0.1:18080");
    return new NativeSessionManager({ apiOrigin: origin });
  }, [customSessionManager]);

  const transport = useMemo(() => {
    if (customTransport) return customTransport;
    return new NativeHttpTransport({ sessionManager });
  }, [customTransport, sessionManager]);

  const [sessionState, setSessionState] = useState(() => sessionManager.state);
  const [activeApp, setActiveApp] = useState<SupportedApp>(initialApp);

  useEffect(() => {
    const origin = getRuntimeConfig("VITE_PLATFORM_API_URL", "http://127.0.0.1:18080");
    const uninstall = installNativeFetchInterceptor(transport, origin);
    return () => {
      uninstall();
    };
  }, [transport]);

  useEffect(() => {
    // Initial sync
    syncWebSessionStorage(sessionManager.activeSession);

    const unsubscribe = sessionManager.subscribe((nextState) => {
      setSessionState(nextState);
      syncWebSessionStorage(nextState.session);
    });

    // Automatically attempt restore if unauthenticated on boot
    if (sessionManager.status === "unauthenticated") {
      void sessionManager.restoreSession().catch(() => {
        // No valid session stored; remain in unauthenticated state
      });
    }

    return () => {
      unsubscribe();
    };
  }, [sessionManager]);

  const login = useCallback(
    async (credentials: LoginCredentials, targetOrigin?: string): Promise<SessionRecord> => {
      const origin = targetOrigin ?? getRuntimeConfig("VITE_PLATFORM_API_URL");
      const record = await sessionManager.login(credentials, origin);
      syncWebSessionStorage(record);
      return record;
    },
    [sessionManager]
  );

  const logout = useCallback(async (): Promise<void> => {
    await sessionManager.logout();
    syncWebSessionStorage(null);
  }, [sessionManager]);

  const switchCompany = useCallback(
    async (companyId: number, financialYearId?: number): Promise<void> => {
      await sessionManager.switchCompany(companyId, financialYearId);
      syncWebSessionStorage(sessionManager.activeSession);
    },
    [sessionManager]
  );

  const restoreSession = useCallback(
    async (desk?: Desk): Promise<SessionRecord | null> => {
      const restored = await sessionManager.restoreSession(desk);
      syncWebSessionStorage(restored);
      return restored;
    },
    [sessionManager]
  );

  const isAppEnabled = useCallback(
    (appKey: SupportedApp | string): boolean => {
      return evaluateSessionPermission(sessionManager.activeSession, appKey);
    },
    [sessionManager]
  );

  const hasPermission = useCallback(
    (permissionOrApp: SupportedApp | string): boolean => {
      return evaluateSessionPermission(sessionManager.activeSession, permissionOrApp);
    },
    [sessionManager]
  );

  const contextValue = useMemo<NativeSessionContextValue>(
    () => ({
      activeApp,
      generation: sessionState.generation,
      hasPermission,
      isAppEnabled,
      login,
      logout,
      restoreSession,
      session: sessionState.session,
      sessionManager,
      setActiveApp,
      status: sessionState.status,
      switchCompany,
      transport
    }),
    [
      activeApp,
      sessionState.generation,
      sessionState.session,
      sessionState.status,
      hasPermission,
      isAppEnabled,
      login,
      logout,
      restoreSession,
      sessionManager,
      switchCompany,
      transport
    ]
  );

  return (
    <NativeSessionContext.Provider value={contextValue}>{children}</NativeSessionContext.Provider>
  );
}

export function useNativeSession(): NativeSessionContextValue {
  const context = useContext(NativeSessionContext);
  if (!context) {
    throw new Error("useNativeSession must be used within a NativeSessionProvider.");
  }
  return context;
}
