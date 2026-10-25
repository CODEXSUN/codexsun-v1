import { Capacitor } from "@capacitor/core";
import { HostVerifier } from "../session/host-verifier.js";
import { NativeSessionManager } from "../session/native-session-manager.js";
import { NativeSecureKeyStore } from "./storage.js";
import {
  type Desk,
  PlatformApiError,
  StaleResponseError,
  TenantIsolationError
} from "../session/session-types.js";
export {
  PlatformApiError,
  StaleResponseError,
  TenantIsolationError
};

export interface HttpRequestOptions {
  body?: unknown;
  desk?: Desk;
  expectedGeneration?: number;
  headers?: Record<string, string>;
  method?: string;
  signal?: AbortSignal;
  skipEnvelopeUnwrap?: boolean;
  tenantId?: string;
  timeoutMs?: number;
}

export type NativeHttpDispatcher = (options: {
  body?: string | undefined;
  bodyBase64?: string | undefined;
  headers?: Record<string, string> | undefined;
  method?: string | undefined;
  responseType?: "text" | "base64" | "binary" | undefined;
  secretKey?: string | undefined;
  timeoutMs?: number | undefined;
  url: string;
}) => Promise<{
  data: string;
  headers: Record<string, string>;
  isBase64?: boolean;
  status: number;
}>;

export interface NativeHttpTransportOptions {
  defaultTimeoutMs?: number;
  fetchImpl?: typeof fetch;
  hostVerifier?: HostVerifier;
  nativeHttpDispatcher?: NativeHttpDispatcher | undefined;
  sessionManager: NativeSessionManager;
}

interface ApiEnvelope<T> {
  data?: T;
  error?: {
    code?: string;
    message?: string;
  };
  success: boolean;
}

export class NativeHttpTransport {
  private readonly sessionManager: NativeSessionManager;
  private readonly hostVerifier: HostVerifier;
  private readonly fetchImpl: typeof fetch;
  private readonly defaultTimeoutMs: number;
  private readonly nativeHttpDispatcher?: NativeHttpDispatcher | undefined;

  constructor(options: NativeHttpTransportOptions) {
    this.sessionManager = options.sessionManager;
    this.hostVerifier = options.hostVerifier ?? new HostVerifier({ allowLoopback: true });
    this.fetchImpl = options.fetchImpl ?? globalThis.fetch;
    this.defaultTimeoutMs = options.defaultTimeoutMs ?? 15_000;
    this.nativeHttpDispatcher = options.nativeHttpDispatcher;
  }

  private resolveUrl(path: string): string {
    const rawPath = path.trim();
    if (/^[a-z]+:\/\//i.test(rawPath)) {
      this.hostVerifier.assertHostAllowed(rawPath);
      return rawPath;
    }

    const apiBase = this.sessionManager.apiBaseUrl ?? this.sessionManager.apiOrigin;
    if (!apiBase) {
      throw new PlatformApiError(
        "Cannot execute HTTP request without configured API origin or active session.",
        400
      );
    }

    this.hostVerifier.assertHostAllowed(apiBase);
    const normalizedBase = apiBase.replace(/\/+$/u, "");
    const normalizedPath = rawPath.startsWith("/") ? rawPath : `/${rawPath}`;

    try {
      const parsedBase = new URL(normalizedBase);
      const basePath = parsedBase.pathname.replace(/\/+$/u, "");
      if (basePath && (normalizedPath === basePath || normalizedPath.startsWith(`${basePath}/`))) {
        return `${parsedBase.origin}${normalizedPath}`;
      }
    } catch {
      // Ignore URL parse error and fall back to concatenation
    }

    return `${normalizedBase}${normalizedPath}`;
  }

  private buildContextHeaders(options: HttpRequestOptions): Record<string, string> {
    const session = this.sessionManager.activeSession;
    const headers: Record<string, string> = {
      Accept: "application/json",
      ...(options.headers ?? {})
    };

    if (session) {
      if (session.sessionSlot) {
        headers["x-codexsun-session-slot"] = session.sessionSlot;
      }
      if (session.tenantId || session.tenantUuid) {
        headers["x-tenant-id"] = session.tenantId ?? session.tenantUuid!;
      }
      if (session.tenantDbName) {
        headers["x-tenant-db"] = session.tenantDbName;
      }
      if (session.activeCompanyId !== undefined) {
        headers["x-company-id"] = String(session.activeCompanyId);
      } else if (session.context?.defaultCompany?.companyId !== undefined) {
        headers["x-company-id"] = String(session.context.defaultCompany.companyId);
      }
      if (session.activeFinancialYearId !== undefined) {
        headers["x-financial-year-id"] = String(session.activeFinancialYearId);
      } else if (session.context?.defaultCompany?.financialYearId !== undefined) {
        headers["x-financial-year-id"] = String(session.context.defaultCompany.financialYearId);
      }
      if (session.desk || options.desk) {
        headers["x-auth-desk"] = options.desk ?? session.desk;
      }
      if (session.token && session.token !== "[native-isolated]") {
        headers["Authorization"] = `Bearer ${session.token}`;
      }
    } else if (options.desk) {
      headers["x-auth-desk"] = options.desk;
    }

    // Two-tenant denial check at transport boundary
    if (options.tenantId && session) {
      const activeTenant = session.tenantId ?? session.tenantUuid;
      if (activeTenant && activeTenant !== options.tenantId) {
        throw new TenantIsolationError(
          `Tenant mismatch: request tenant "${options.tenantId}" does not match active session tenant "${activeTenant}".`
        );
      }
    }

    return headers;
  }

  private async executeFetch(
    url: string,
    init: RequestInit,
    timeoutMs: number,
    callerSignal?: AbortSignal
  ): Promise<Response> {
    const timeoutController = new AbortController();
    const timer = setTimeout(() => {
      timeoutController.abort(new Error(`HTTP request timed out after ${timeoutMs}ms.`));
    }, timeoutMs);

    let signal: AbortSignal;
    if (callerSignal) {
      signal = AbortSignal.any([callerSignal, timeoutController.signal]);
    } else {
      signal = timeoutController.signal;
    }

    try {
      const response = await this.fetchImpl(url, {
        ...init,
        signal
      });
      return response;
    } finally {
      clearTimeout(timer);
    }
  }

  async request<T>(path: string, options: HttpRequestOptions = {}): Promise<T> {
    const startGeneration = this.sessionManager.currentGeneration;
    const startSlot = this.sessionManager.sessionSlot;
    const targetUrl = this.resolveUrl(path);

    const headers = this.buildContextHeaders(options);
    const method = (options.method ?? "GET").toUpperCase();
    const timeoutMs = options.timeoutMs ?? this.defaultTimeoutMs;

    let bodyData: BodyInit | undefined;
    if (options.body !== undefined) {
      if (options.body instanceof FormData || options.body instanceof Blob || typeof options.body === "string") {
        bodyData = options.body;
      } else {
        headers["Content-Type"] = "application/json";
        bodyData = JSON.stringify(options.body);
      }
    }

    let responseText: string;
    let responseStatus: number;
    let responseOk: boolean;

    const isNative = Capacitor.isNativePlatform() || Boolean(this.nativeHttpDispatcher);
    const canUseNativeTransport =
      isNative &&
      !(options.body instanceof FormData) &&
      !(options.body instanceof Blob);

    // On native platforms with NativeSecureKeyStore available, execute request natively
    // so decrypted session tokens NEVER cross the JavaScript bridge into web memory!
    if (canUseNativeTransport) {
      delete headers["Authorization"];
      const dispatcher =
        this.nativeHttpDispatcher ??
        ((opts) =>
          NativeSecureKeyStore.executeAuthenticatedRequest
            ? NativeSecureKeyStore.executeAuthenticatedRequest(opts)
            : NativeSecureKeyStore.performAuthenticatedRequest!(opts));

      const nativeRes = await dispatcher({
        body: typeof bodyData === "string" ? bodyData : undefined,
        headers,
        method,
        timeoutMs,
        url: targetUrl
      });
      responseStatus = nativeRes.status;
      responseOk = nativeRes.status >= 200 && nativeRes.status < 300;
      responseText = nativeRes.data;
    } else {
      const fetchInit: RequestInit = {
        credentials: "include",
        headers,
        method,
        ...(bodyData !== undefined ? { body: bodyData } : {})
      };

      const response = await this.executeFetch(
        targetUrl,
        fetchInit,
        timeoutMs,
        options.signal
      );
      responseStatus = response.status;
      responseOk = response.ok;
      responseText = await response.text();
    }

    // Check if session changed or was revoked/reset while request was in flight
    if (
      this.sessionManager.isResponseStale(
        options.expectedGeneration ?? startGeneration,
        startSlot ?? undefined
      )
    ) {
      throw new StaleResponseError();
    }

    let parsedEnvelope: ApiEnvelope<T> | null = null;
    if (responseText) {
      try {
        parsedEnvelope = JSON.parse(responseText) as ApiEnvelope<T>;
      } catch {
        // Non-JSON response
      }
    }

    // Server revocation / expiration detection
    if (responseStatus === 401) {
      const errorCode = parsedEnvelope?.error?.code ?? "AUTH_SESSION_EXPIRED";
      await this.sessionManager.handleServerRevocation(
        parsedEnvelope?.error?.message ?? "Session expired."
      );
      throw new PlatformApiError(
        parsedEnvelope?.error?.message ?? "Session expired. Please sign in again.",
        401,
        errorCode
      );
    }

    if (options.skipEnvelopeUnwrap) {
      if (!responseOk) {
        throw new PlatformApiError(
          parsedEnvelope?.error?.message ?? `Request failed with status ${responseStatus}`,
          responseStatus,
          parsedEnvelope?.error?.code
        );
      }
      return (parsedEnvelope ?? responseText) as T;
    }

    if (parsedEnvelope) {
      if (!responseOk || !parsedEnvelope.success) {
        throw new PlatformApiError(
          parsedEnvelope.error?.message ?? `Request failed with status ${responseStatus}`,
          responseStatus,
          parsedEnvelope.error?.code
        );
      }
      return parsedEnvelope.data as T;
    }

    if (!responseOk) {
      throw new PlatformApiError(
        `Request failed with status ${responseStatus}`,
        responseStatus
      );
    }

    return (responseText as unknown) as T;
  }

  async get<T>(path: string, options: HttpRequestOptions = {}): Promise<T> {
    return this.request<T>(path, { ...options, method: "GET" });
  }

  async post<T>(path: string, body?: unknown, options: HttpRequestOptions = {}): Promise<T> {
    return this.request<T>(path, { ...options, body, method: "POST" });
  }

  async put<T>(path: string, body?: unknown, options: HttpRequestOptions = {}): Promise<T> {
    return this.request<T>(path, { ...options, body, method: "PUT" });
  }

  async patch<T>(path: string, body?: unknown, options: HttpRequestOptions = {}): Promise<T> {
    return this.request<T>(path, { ...options, body, method: "PATCH" });
  }

  async delete<T>(path: string, options: HttpRequestOptions = {}): Promise<T> {
    return this.request<T>(path, { ...options, method: "DELETE" });
  }

  async uploadMultipart<T>(path: string, formData: FormData, options: HttpRequestOptions = {}): Promise<T> {
    const startGeneration = this.sessionManager.currentGeneration;
    const startSlot = this.sessionManager.sessionSlot;
    const targetUrl = this.resolveUrl(path);

    const headers = this.buildContextHeaders(options);
    // Explicitly delete Content-Type so browser / node-fetch creates proper multipart boundary
    delete headers["Content-Type"];

    const timeoutMs = options.timeoutMs ?? this.defaultTimeoutMs;
    const isNative = Capacitor.isNativePlatform() || Boolean(this.nativeHttpDispatcher);

    if (isNative) {
      delete headers["Authorization"];
      try {
        const dummyRequest = new Request("http://localhost", { body: formData, method: "POST" });
        const contentType = dummyRequest.headers.get("content-type");
        if (contentType) {
          headers["Content-Type"] = contentType;
        }
        const buffer = await dummyRequest.arrayBuffer();
        const bytes = new Uint8Array(buffer);
        let binary = "";
        for (let i = 0; i < bytes.byteLength; i++) {
          binary += String.fromCharCode(bytes[i]!);
        }
        const bodyBase64 = btoa(binary);

        const dispatcher =
          this.nativeHttpDispatcher ??
          ((opts) =>
            NativeSecureKeyStore.executeAuthenticatedRequest
              ? NativeSecureKeyStore.executeAuthenticatedRequest(opts)
              : NativeSecureKeyStore.performAuthenticatedRequest!(opts));

        const nativeRes = await dispatcher({
          bodyBase64,
          headers,
          method: "POST",
          timeoutMs,
          url: targetUrl
        });

        if (this.sessionManager.isResponseStale(startGeneration, startSlot ?? undefined)) {
          throw new StaleResponseError();
        }

        let parsedEnvelope: ApiEnvelope<T> | null = null;
        if (nativeRes.data) {
          try {
            parsedEnvelope = JSON.parse(nativeRes.data) as ApiEnvelope<T>;
          } catch {}
        }

        if (nativeRes.status === 401) {
          await this.sessionManager.handleServerRevocation();
          throw new PlatformApiError(
            parsedEnvelope?.error?.message ?? "Session expired during upload.",
            401,
            parsedEnvelope?.error?.code ?? "AUTH_SESSION_EXPIRED"
          );
        }

        if (nativeRes.status < 200 || nativeRes.status >= 300 || (parsedEnvelope && !parsedEnvelope.success)) {
          throw new PlatformApiError(
            parsedEnvelope?.error?.message ?? `Upload failed with status ${nativeRes.status}`,
            nativeRes.status,
            parsedEnvelope?.error?.code
          );
        }

        return (parsedEnvelope ? parsedEnvelope.data : nativeRes.data) as T;
      } catch (err) {
        if (err instanceof PlatformApiError || err instanceof StaleResponseError) throw err;
        if (Capacitor.isNativePlatform()) {
          throw new PlatformApiError(
            `Native multipart transport error: ${err instanceof Error ? err.message : String(err)}`,
            500
          );
        }
        // In non-native test mock environments where native dispatcher is unmocked, allow fallback
      }
    }

    const response = await this.executeFetch(
      targetUrl,
      {
        body: formData,
        credentials: "include",
        headers,
        method: "POST"
      },
      timeoutMs,
      options.signal
    );

    if (this.sessionManager.isResponseStale(startGeneration, startSlot ?? undefined)) {
      throw new StaleResponseError();
    }

    const responseText = await response.text();
    let parsedEnvelope: ApiEnvelope<T> | null = null;
    if (responseText) {
      try {
        parsedEnvelope = JSON.parse(responseText) as ApiEnvelope<T>;
      } catch {}
    }

    if (response.status === 401) {
      await this.sessionManager.handleServerRevocation();
      throw new PlatformApiError(
        parsedEnvelope?.error?.message ?? "Session expired during upload.",
        401,
        parsedEnvelope?.error?.code ?? "AUTH_SESSION_EXPIRED"
      );
    }

    if (!response.ok || (parsedEnvelope && !parsedEnvelope.success)) {
      throw new PlatformApiError(
        parsedEnvelope?.error?.message ?? `Upload failed with status ${response.status}`,
        response.status,
        parsedEnvelope?.error?.code
      );
    }

    return (parsedEnvelope ? parsedEnvelope.data : responseText) as T;
  }

  async downloadBinary(path: string, options: HttpRequestOptions = {}): Promise<ArrayBuffer> {
    const startGeneration = this.sessionManager.currentGeneration;
    const startSlot = this.sessionManager.sessionSlot;
    const targetUrl = this.resolveUrl(path);

    const headers = this.buildContextHeaders(options);
    delete headers.Accept; // Allow binary / application/pdf / stream

    const timeoutMs = options.timeoutMs ?? this.defaultTimeoutMs;
    const method = (options.method ?? "GET").toUpperCase();
    const isNative = Capacitor.isNativePlatform() || Boolean(this.nativeHttpDispatcher);

    if (isNative) {
      delete headers["Authorization"];
      const dispatcher =
        this.nativeHttpDispatcher ??
        ((opts) =>
          NativeSecureKeyStore.executeAuthenticatedRequest
            ? NativeSecureKeyStore.executeAuthenticatedRequest(opts)
            : NativeSecureKeyStore.performAuthenticatedRequest!(opts));

      const nativeRes = await dispatcher({
        headers,
        method,
        responseType: "base64",
        timeoutMs,
        url: targetUrl
      });

      if (this.sessionManager.isResponseStale(startGeneration, startSlot ?? undefined)) {
        throw new StaleResponseError();
      }

      if (nativeRes.status === 401) {
        await this.sessionManager.handleServerRevocation();
        throw new PlatformApiError("Session expired during binary download.", 401, "AUTH_SESSION_EXPIRED");
      }

      if (nativeRes.status < 200 || nativeRes.status >= 300) {
        throw new PlatformApiError(`Binary download failed with status ${nativeRes.status}`, nativeRes.status);
      }

      const binaryString = atob(nativeRes.data);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      return bytes.buffer;
    }

    const response = await this.executeFetch(
      targetUrl,
      {
        credentials: "include",
        headers,
        method
      },
      timeoutMs,
      options.signal
    );

    if (this.sessionManager.isResponseStale(startGeneration, startSlot ?? undefined)) {
      throw new StaleResponseError();
    }

    if (response.status === 401) {
      await this.sessionManager.handleServerRevocation();
      throw new PlatformApiError("Session expired during binary download.", 401, "AUTH_SESSION_EXPIRED");
    }

    if (!response.ok) {
      throw new PlatformApiError(`Binary download failed with status ${response.status}`, response.status);
    }

    return response.arrayBuffer();
  }

  async loadMediaBlob(path: string, options: HttpRequestOptions = {}): Promise<Blob> {
    const startGeneration = this.sessionManager.currentGeneration;
    const startSlot = this.sessionManager.sessionSlot;
    const targetUrl = this.resolveUrl(path);

    const headers = this.buildContextHeaders(options);
    const timeoutMs = options.timeoutMs ?? this.defaultTimeoutMs;
    const method = (options.method ?? "GET").toUpperCase();
    const isNative = Capacitor.isNativePlatform() || Boolean(this.nativeHttpDispatcher);

    if (isNative) {
      delete headers["Authorization"];
      const dispatcher =
        this.nativeHttpDispatcher ??
        ((opts) =>
          NativeSecureKeyStore.executeAuthenticatedRequest
            ? NativeSecureKeyStore.executeAuthenticatedRequest(opts)
            : NativeSecureKeyStore.performAuthenticatedRequest!(opts));

      const nativeRes = await dispatcher({
        headers,
        method,
        responseType: "base64",
        timeoutMs,
        url: targetUrl
      });

      if (this.sessionManager.isResponseStale(startGeneration, startSlot ?? undefined)) {
        throw new StaleResponseError();
      }

      if (nativeRes.status === 401) {
        await this.sessionManager.handleServerRevocation();
        throw new PlatformApiError("Session expired while loading media.", 401, "AUTH_SESSION_EXPIRED");
      }

      if (nativeRes.status < 200 || nativeRes.status >= 300) {
        throw new PlatformApiError(`Media load failed with status ${nativeRes.status}`, nativeRes.status);
      }

      const binaryString = atob(nativeRes.data);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const contentType = nativeRes.headers["content-type"] || "application/octet-stream";
      return new Blob([bytes], { type: contentType });
    }

    const response = await this.executeFetch(
      targetUrl,
      {
        credentials: "include",
        headers,
        method
      },
      timeoutMs,
      options.signal
    );

    if (this.sessionManager.isResponseStale(startGeneration, startSlot ?? undefined)) {
      throw new StaleResponseError();
    }

    if (response.status === 401) {
      await this.sessionManager.handleServerRevocation();
      throw new PlatformApiError("Session expired while loading media.", 401, "AUTH_SESSION_EXPIRED");
    }

    if (!response.ok) {
      throw new PlatformApiError(`Media load failed with status ${response.status}`, response.status);
    }

    return response.blob();
  }
}
