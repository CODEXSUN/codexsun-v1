export type RuntimeConfig = Record<string, string>;

declare global {
  var __CODEXSUN_RUNTIME_CONFIG__: Readonly<RuntimeConfig> | undefined;
  interface Window {
    __CODEXSUN_RUNTIME_CONFIG__?: Readonly<RuntimeConfig>;
  }
}

/**
 * Local debug and development defaults for local Platform Docker integration.
 * Only applied in development and test environments.
 */
export const LOCAL_DEBUG_CONFIG: RuntimeConfig = {
  VITE_PLATFORM_API_URL: "http://127.0.0.1:18010/api/app",
  VITE_APP_NAME: "cxmobile",
  VITE_TENANT_NAME: "CODEXSUN",
  VITE_TENANCY_MODE: "multi",
  VITE_DEV_AUTO_TENANT_LOGIN: "0"
};

/**
 * Returns true if running in a production release build or environment.
 * In release mode, the client strictly rejects missing or insecure/loopback endpoints.
 * Production release builds (MODE === "production", import.meta.env.PROD === true,
 * VITE_RELEASE="1", or VITE_APP_ENV="production") strictly enforce release mode and CANNOT
 * be downgraded to debug through mutable runtime debug flags.
 * Local debug mode is only enabled when no release indicator is active and debug is requested.
 */
export function isReleaseEnvironment(): boolean {
  try {
    const runtime =
      typeof window !== "undefined"
        ? window.__CODEXSUN_RUNTIME_CONFIG__
        : globalThis.__CODEXSUN_RUNTIME_CONFIG__;

    const hasImportMetaEnv = typeof import.meta !== "undefined" && Boolean(import.meta.env);
    const env = hasImportMetaEnv ? import.meta.env : undefined;

    // 1. Explicit production release flags take strict precedence over any runtime debug flag.
    // If flagged as release or production, runtime debug flags CANNOT downgrade the policy.
    const hasReleaseFlag =
      runtime?.VITE_RELEASE === "1" ||
      runtime?.VITE_APP_ENV === "production" ||
      runtime?.MODE === "production" ||
      runtime?.MODE === "release" ||
      env?.VITE_RELEASE === "1" ||
      env?.VITE_APP_ENV === "production" ||
      env?.MODE === "production" ||
      env?.MODE === "release";

    if (hasReleaseFlag) {
      return true;
    }

    // 2. Explicit debug indicators (only evaluated when no explicit release flag is active)
    const isExplicitDebug =
      runtime?.VITE_DEBUG === "1" ||
      runtime?.VITE_DEBUG === "true" ||
      runtime?.MODE === "debug" ||
      runtime?.VITE_APP_ENV === "development" ||
      env?.VITE_DEBUG === "1" ||
      env?.VITE_DEBUG === "true" ||
      env?.MODE === "debug" ||
      env?.MODE === "development";

    if (isExplicitDebug) {
      return false;
    }

    // 3. Ordinary Vite production build fallback (when not in explicit debug mode)
    if (env?.PROD === true) {
      return true;
    }
  } catch {
    // Non-vite environments
  }
  return false;
}

/**
 * Validates the API endpoint URL.
 * In release mode, strictly fails closed if the URL is missing, malformed, plain HTTP, contains credentials,
 * or points to IPv4/IPv6 loopback, internal, or non-routable domains.
 */
export function resolveApiUrl(rawUrl: string | undefined, isRelease: boolean): string {
  if (!rawUrl || typeof rawUrl !== "string" || !rawUrl.trim()) {
    if (isRelease) {
      throw new Error(
        "Release configuration failure: VITE_PLATFORM_API_URL is missing. Release builds require an explicit secure endpoint."
      );
    }
    // In local debug browser development/preview on ports 18090 or 18190,
    // use the same-origin Vite proxy to prevent CORS blocks while preserving the /api/app prefix
    if (typeof window !== "undefined" && window.location) {
      const port = window.location.port;
      if (port === "18090" || port === "18190") {
        return `${window.location.origin}/api/app`;
      }
    }
    return LOCAL_DEBUG_CONFIG.VITE_PLATFORM_API_URL ?? "http://127.0.0.1:18010/api/app";
  }

  const url = rawUrl.trim();

  // In local debug mode, when running inside a browser dev/preview server (port 18090 or 18190),
  // route local loopback 18010 requests through the Vite debug proxy on the same origin.
  // This preserves the full /api/app prefix and tenant/host headers without requiring CORS changes on Docker.
  if (!isRelease && typeof window !== "undefined" && window.location) {
    const port = window.location.port;
    if (port === "18090" || port === "18190") {
      try {
        const parsed = new URL(url);
        if (
          (parsed.hostname === "127.0.0.1" || parsed.hostname === "localhost") &&
          parsed.port === "18010" &&
          (parsed.pathname === "/api/app" || parsed.pathname.startsWith("/api/app/"))
        ) {
          return `${window.location.origin}${parsed.pathname}`;
        }
      } catch {
        // Non-standard URL, proceed to ordinary validation
      }
    }
  }
  if (isRelease) {
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      throw new Error(
        `Release configuration failure: Malformed API endpoint '${url}' cannot be parsed as a valid URL.`
      );
    }

    // Protocol must strictly be https:
    if (parsed.protocol !== "https:") {
      throw new Error(
        `Release configuration failure: Insecure protocol '${parsed.protocol}' for endpoint '${url}' is rejected. Release builds require HTTPS.`
      );
    }

    // Embedded user credentials (username/password) are prohibited
    if (parsed.username || parsed.password) {
      throw new Error(
        `Release configuration failure: Embedded user credentials in API endpoint '${url}' are prohibited.`
      );
    }

    // Hostname must be present and non-empty
    const hostname = parsed.hostname.toLowerCase().trim();
    if (!hostname) {
      throw new Error(
        `Release configuration failure: API endpoint '${url}' lacks a valid hostname.`
      );
    }

    // Reject IPv4 loopback (127.0.0.0/8) and unspecified host (0.0.0.0)
    if (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname.startsWith("127.") ||
      hostname === "0.0.0.0"
    ) {
      throw new Error(
        `Release configuration failure: Loopback host '${hostname}' is prohibited in release builds.`
      );
    }

    // Reject IPv6 loopback (::1, [::1], 0:0:0:0:0:0:0:1) and unspecified ([::], ::)
    const normalizedIpv6 = hostname.replace(/^\[|\]$/g, "");
    if (
      normalizedIpv6 === "::1" ||
      normalizedIpv6 === "::" ||
      normalizedIpv6 === "0:0:0:0:0:0:0:1" ||
      normalizedIpv6 === "0:0:0:0:0:0:0:0" ||
      /^0*(:0*)*:1$/.test(normalizedIpv6)
    ) {
      throw new Error(
        `Release configuration failure: IPv6 loopback host '${hostname}' is prohibited in release builds.`
      );
    }

    // Reject internal, reserved, and non-routable domains (.local, .internal, .localhost, .invalid, .test, .example)
    const internalSuffixes = [".local", ".internal", ".localhost", ".invalid", ".test", ".example"];
    if (
      internalSuffixes.some((sfx) => hostname.endsWith(sfx)) ||
      ["local", "internal", "localhost", "invalid", "test", "example"].includes(hostname)
    ) {
      throw new Error(
        `Release configuration failure: Internal or non-routable domain '${hostname}' is prohibited in release builds.`
      );
    }
  }

  return url;
}

/**
 * Initializes window.__CODEXSUN_RUNTIME_CONFIG__ before importing owner services.
 * In release builds, strictly validates secure endpoints and rejects insecure/missing fallbacks.
 */
export function initRuntimeConfig(overrides?: Partial<RuntimeConfig>): Readonly<RuntimeConfig> {
  const existing =
    typeof window !== "undefined"
      ? window.__CODEXSUN_RUNTIME_CONFIG__
      : globalThis.__CODEXSUN_RUNTIME_CONFIG__;

  let viteEnv: Record<string, string | undefined> = {};
  try {
    if (typeof import.meta !== "undefined" && import.meta.env) {
      viteEnv = {
        VITE_APP_NAME: import.meta.env.VITE_APP_NAME as string | undefined,
        VITE_PLATFORM_API_URL: import.meta.env.VITE_PLATFORM_API_URL as string | undefined,
        VITE_TENANCY_MODE: import.meta.env.VITE_TENANCY_MODE as string | undefined,
        VITE_TENANT_NAME: import.meta.env.VITE_TENANT_NAME as string | undefined
      };
    }
  } catch {
    // Non-vite / test runner environments
  }

  const release = isReleaseEnvironment();

  const candidateApiUrl =
    overrides?.VITE_PLATFORM_API_URL ??
    existing?.VITE_PLATFORM_API_URL ??
    viteEnv.VITE_PLATFORM_API_URL;

  const validApiUrl = resolveApiUrl(candidateApiUrl, release);

  const baseConfig: RuntimeConfig = release
    ? {
        VITE_APP_NAME: viteEnv.VITE_APP_NAME ?? "cxmobile",
        VITE_DEV_AUTO_TENANT_LOGIN: "0",
        VITE_PLATFORM_API_URL: validApiUrl,
        VITE_TENANCY_MODE: viteEnv.VITE_TENANCY_MODE ?? "multi",
        VITE_TENANT_NAME: viteEnv.VITE_TENANT_NAME ?? "CODEXSUN"
      }
    : {
        ...LOCAL_DEBUG_CONFIG,
        VITE_PLATFORM_API_URL: validApiUrl
      };

  const merged: RuntimeConfig = {
    ...baseConfig,
    ...(existing ?? {}),
    ...(overrides ?? {}),
    VITE_PLATFORM_API_URL: validApiUrl
  };

  const frozen = Object.freeze(merged);
  if (typeof window !== "undefined") {
    window.__CODEXSUN_RUNTIME_CONFIG__ = frozen;
  }
  globalThis.__CODEXSUN_RUNTIME_CONFIG__ = frozen;

  return frozen;
}

export function getRuntimeConfig(name: string, fallback = ""): string {
  const runtime =
    typeof window !== "undefined"
      ? window.__CODEXSUN_RUNTIME_CONFIG__
      : globalThis.__CODEXSUN_RUNTIME_CONFIG__;

  if (!runtime) {
    if (isReleaseEnvironment() && name === "VITE_PLATFORM_API_URL") {
      throw new Error("Release configuration failure: Runtime configuration has not been initialized.");
    }
    return LOCAL_DEBUG_CONFIG[name] ?? fallback;
  }
  return runtime[name] ?? fallback;
}
