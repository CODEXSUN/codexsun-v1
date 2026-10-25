import { Capacitor, registerPlugin } from "@capacitor/core";
import type { SessionRecord } from "../session/session-types.js";

export interface NativeStorageAdapter {
  clear(): Promise<void>;
  executeAuthenticatedRequest?(options: {
    body?: string | undefined;
    headers?: Record<string, string> | undefined;
    method?: string | undefined;
    secretKey?: string | undefined;
    timeoutMs?: number | undefined;
    url: string;
  }): Promise<{
    data: string;
    headers: Record<string, string>;
    status: number;
  }>;
  getItem(key: string): Promise<string | null>;
  removeItem(key: string): Promise<void>;
  setItem(key: string, value: string): Promise<void>;
}

export interface NativeHardwareKeystorePlugin {
  clearSecrets(): Promise<{ success: boolean }>;
  executeAuthenticatedRequest?(options: {
    body?: string | undefined;
    headers?: Record<string, string> | undefined;
    method?: string | undefined;
    secretKey?: string | undefined;
    timeoutMs?: number | undefined;
    url: string;
  }): Promise<{
    data: string;
    headers: Record<string, string>;
    status: number;
  }>;
  getSecret(options: { key: string }): Promise<{ value: string | null }>;
  performAuthenticatedRequest?(options: {
    body?: string | undefined;
    headers?: Record<string, string> | undefined;
    method?: string | undefined;
    secretKey?: string | undefined;
    timeoutMs?: number | undefined;
    url: string;
  }): Promise<{
    data: string;
    headers: Record<string, string>;
    status: number;
  }>;
  performNativeLogin?(options: {
    credentials: Record<string, unknown>;
    desk: string;
    timeoutMs?: number | undefined;
    url: string;
  }): Promise<{ data: Record<string, unknown>; success: boolean }>;
  performNativeLogout?(options: {
    timeoutMs?: number | undefined;
    url?: string | undefined;
  }): Promise<{ success: boolean }>;
  performNativeRestore?(): Promise<{ session: Record<string, unknown> | null }>;
  performNativeRevoke?(): Promise<{ success: boolean }>;
  removeSecret(options: { key: string }): Promise<{ success: boolean }>;
  setSecret(options: { key: string; value: string }): Promise<{ success: boolean }>;
  updateSessionMetadata?(options: {
    activeCompanyId?: number | undefined;
    activeFinancialYearId?: number | undefined;
    context?: Record<string, unknown> | undefined;
    expiresAt?: string | undefined;
    name?: string | undefined;
    role?: string | undefined;
  }): Promise<{ session: Record<string, unknown>; success: boolean }>;
}

export const NativeSecureKeyStore = registerPlugin<NativeHardwareKeystorePlugin>("NativeSecureStorage");

/**
 * Native hardware-isolated secure storage adapter backed by Android KeyStore (AES-256-GCM hardware key)
 * and iOS Keychain Services.
 * Completely isolates secrets from web storage, localStorage, and unencrypted preferences.
 */
export class NativeHardwareKeystoreAdapter implements NativeStorageAdapter {
  async getItem(key: string): Promise<string | null> {
    try {
      const res = await NativeSecureKeyStore.getSecret({ key });
      return res.value ?? null;
    } catch {
      return null;
    }
  }

  async setItem(key: string, value: string): Promise<void> {
    await NativeSecureKeyStore.setSecret({ key, value });
  }

  async removeItem(key: string): Promise<void> {
    await NativeSecureKeyStore.removeSecret({ key });
  }

  async clear(): Promise<void> {
    await NativeSecureKeyStore.clearSecrets();
  }

  async executeAuthenticatedRequest(options: {
    body?: string | undefined;
    headers?: Record<string, string> | undefined;
    method?: string | undefined;
    secretKey?: string | undefined;
    timeoutMs?: number | undefined;
    url: string;
  }): Promise<{
    data: string;
    headers: Record<string, string>;
    status: number;
  }> {
    if (NativeSecureKeyStore.executeAuthenticatedRequest) {
      return await NativeSecureKeyStore.executeAuthenticatedRequest(options);
    }
    if (NativeSecureKeyStore.performAuthenticatedRequest) {
      return await NativeSecureKeyStore.performAuthenticatedRequest(options);
    }
    throw new Error("Native authenticated HTTP transport is unavailable.");
  }
}

/**
 * Non-production in-memory adapter explicitly for tests, Node harnesses, and web sandboxes.
 * Never writes to browser localStorage, window properties, unencrypted preferences, or plaintext files.
 */
export class InMemorySecureStorageAdapter implements NativeStorageAdapter {
  private readonly vault = new Map<string, string>();

  async getItem(key: string): Promise<string | null> {
    return this.vault.get(key) ?? null;
  }

  async setItem(key: string, value: string): Promise<void> {
    this.vault.set(key, value);
  }

  async removeItem(key: string): Promise<void> {
    this.vault.delete(key);
  }

  async clear(): Promise<void> {
    this.vault.clear();
  }
}

export interface NativeSecureStorageOptions {
  adapter?: NativeStorageAdapter | undefined;
  namespace?: string | undefined;
}

export class NativeSecureStorage {
  private readonly adapter: NativeStorageAdapter;
  private readonly namespace: string;

  private static readonly SESSION_RECORD_KEY = "auth.session_record";
  private static readonly SESSION_SLOT_KEY = "auth.session_slot";
  private static readonly SESSION_SECRET_KEY = "auth.session_secret";
  private static readonly ACTIVE_HOST_KEY = "auth.active_host";
  private static readonly DEVICE_PUSH_TOKEN_KEY = "auth.device_push_token";

  constructor(options: NativeSecureStorageOptions = {}) {
    if (options.adapter) {
      this.adapter = options.adapter;
    } else if (Capacitor.isNativePlatform()) {
      // On real native devices (Android KeyStore / iOS Keychain)
      this.adapter = new NativeHardwareKeystoreAdapter();
    } else {
      // In Node, headless test runners, or standard web browser sandboxes
      this.adapter = new InMemorySecureStorageAdapter();
    }

    this.namespace = (options.namespace ?? "codexsun.cxmobile").replace(/\.+$/u, "");
  }

  private qualifyKey(key: string): string {
    return `${this.namespace}.${key}`;
  }

  async setSecret(key: string, value: string): Promise<void> {
    await this.adapter.setItem(this.qualifyKey(key), value);
  }

  async getSecret(key: string): Promise<string | null> {
    return this.adapter.getItem(this.qualifyKey(key));
  }

  async removeSecret(key: string): Promise<void> {
    await this.adapter.removeItem(this.qualifyKey(key));
  }

  async storeSession(session: SessionRecord, rawToken?: string): Promise<void> {
    const isNative = Capacitor.isNativePlatform();
    if (isNative && NativeSecureKeyStore.updateSessionMetadata) {
      try {
        await NativeSecureKeyStore.updateSessionMetadata({
          activeCompanyId: session.activeCompanyId,
          activeFinancialYearId: session.activeFinancialYearId,
          context: session.context as Record<string, unknown> | undefined,
          expiresAt: session.expiresAt,
          name: session.name,
          role: session.role
        });
        return;
      } catch {
        // Fall back to adapter write for mock or hybrid environments
      }
    }

    const tokenToPersist = rawToken ?? (session.token !== "[native-isolated]" ? session.token : undefined);

    if (tokenToPersist) {
      await this.setSecret(NativeSecureStorage.SESSION_SECRET_KEY, tokenToPersist);
    }

    const sessionRecordToStore: SessionRecord = {
      ...session,
      token: isNative && tokenToPersist ? "[native-isolated]" : session.token
    };

    const serialized = JSON.stringify(sessionRecordToStore);
    await this.setSecret(NativeSecureStorage.SESSION_RECORD_KEY, serialized);
    if (session.sessionSlot) {
      await this.setSecret(NativeSecureStorage.SESSION_SLOT_KEY, session.sessionSlot);
    }
    if (session.loginHost) {
      await this.setSecret(NativeSecureStorage.ACTIVE_HOST_KEY, session.loginHost);
    }
  }

  async getStoredSession(): Promise<SessionRecord | null> {
    if (Capacitor.isNativePlatform() && NativeSecureKeyStore.performNativeRestore) {
      try {
        const res = await NativeSecureKeyStore.performNativeRestore();
        if (res?.session) {
          return res.session as unknown as SessionRecord;
        }
      } catch {
        // Fall back to adapter
      }
    }
    const raw = await this.getSecret(NativeSecureStorage.SESSION_RECORD_KEY);
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw) as SessionRecord;
      return parsed;
    } catch {
      return null;
    }
  }

  async getSessionSlot(): Promise<string | null> {
    return this.getSecret(NativeSecureStorage.SESSION_SLOT_KEY);
  }

  async getSessionSecret(): Promise<string | null> {
    if (Capacitor.isNativePlatform()) {
      return "[native-isolated]";
    }
    return this.getSecret(NativeSecureStorage.SESSION_SECRET_KEY);
  }

  async executeAuthenticatedRequest(options: {
    body?: string | undefined;
    headers?: Record<string, string> | undefined;
    method?: string | undefined;
    secretKey?: string | undefined;
    timeoutMs?: number | undefined;
    url: string;
  }): Promise<{
    data: string;
    headers: Record<string, string>;
    status: number;
  }> {
    if (this.adapter.executeAuthenticatedRequest) {
      return await this.adapter.executeAuthenticatedRequest(options);
    }
    if (NativeSecureKeyStore.executeAuthenticatedRequest) {
      return await NativeSecureKeyStore.executeAuthenticatedRequest(options);
    }
    if (NativeSecureKeyStore.performAuthenticatedRequest) {
      return await NativeSecureKeyStore.performAuthenticatedRequest(options);
    }
    throw new Error("Native authenticated HTTP transport is unavailable.");
  }

  async getActiveHost(): Promise<string | null> {
    return this.getSecret(NativeSecureStorage.ACTIVE_HOST_KEY);
  }

  async setDevicePushToken(token: string): Promise<void> {
    await this.setSecret(NativeSecureStorage.DEVICE_PUSH_TOKEN_KEY, token);
  }

  async getDevicePushToken(): Promise<string | null> {
    return this.getSecret(NativeSecureStorage.DEVICE_PUSH_TOKEN_KEY);
  }

  async clearDevicePushToken(): Promise<void> {
    await this.removeSecret(NativeSecureStorage.DEVICE_PUSH_TOKEN_KEY);
  }

  async clearSession(): Promise<void> {
    if (Capacitor.isNativePlatform() && NativeSecureKeyStore.performNativeRevoke) {
      try {
        await NativeSecureKeyStore.performNativeRevoke();
      } catch {
        // Best effort
      }
    }
    try {
      await this.removeSecret(NativeSecureStorage.SESSION_RECORD_KEY);
    } catch {}
    try {
      await this.removeSecret(NativeSecureStorage.SESSION_SLOT_KEY);
    } catch {}
    try {
      await this.removeSecret(NativeSecureStorage.SESSION_SECRET_KEY);
    } catch {}
    try {
      await this.removeSecret(NativeSecureStorage.ACTIVE_HOST_KEY);
    } catch {}
  }

  async clearAll(): Promise<void> {
    await this.adapter.clear();
  }
}
