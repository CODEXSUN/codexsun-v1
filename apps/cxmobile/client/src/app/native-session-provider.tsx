import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from "react";
import { NativeHttpTransport } from "../native/http.js";
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
        window.sessionStorage.setItem("codexsun_tenant_id", session.tenantId ?? session.tenantUuid!);
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
      const finYearId = session.activeFinancialYearId ?? session.context?.defaultCompany?.financialYearId;
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
    return (
      enabledModules.includes(target) ||
      enabledModules.includes(`codexsun.${target}`) ||
      enabledModules.includes("all")
    );
  }

  // Granular resource permissions: role labels alone NEVER bypass explicit grants.
  // Strictly fail closed if no explicit permission grants exist in session metadata.
  const explicitPermissions =
    (session as unknown as { permissions?: string[] }).permissions ??
    (session as unknown as { grantedPermissions?: string[] }).grantedPermissions ??
    (session.context as unknown as { permissions?: string[] })?.permissions;

  if (!explicitPermissions || !Array.isArray(explicitPermissions) || explicitPermissions.length === 0) {
    return false;
  }

  const normalizedGrants = explicitPermissions.map((p) => String(p).toLowerCase().trim());
  return normalizedGrants.includes(target) || normalizedGrants.includes("all");
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
      const session = sessionManager.activeSession;
      if (!session || !session.authenticated) return false;

      const enabledModules = session.context?.enabledModuleKeys;
      if (!enabledModules || !Array.isArray(enabledModules) || enabledModules.length === 0) {
        // Fail closed: if module list is absent or empty, do not grant access
        return false;
      }

      // Check whether app key or wildcard is enabled
      const normalizedKey = appKey.toLowerCase().trim();
      return (
        enabledModules.includes(normalizedKey) ||
        enabledModules.includes(`codexsun.${normalizedKey}`) ||
        enabledModules.includes("all")
      );
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
    <NativeSessionContext.Provider value={contextValue}>
      {children}
    </NativeSessionContext.Provider>
  );
}

export function useNativeSession(): NativeSessionContextValue {
  const context = useContext(NativeSessionContext);
  if (!context) {
    throw new Error("useNativeSession must be used within a NativeSessionProvider.");
  }
  return context;
}
