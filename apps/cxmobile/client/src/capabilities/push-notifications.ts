import { registerPlugin, Capacitor } from "@capacitor/core";
import type { NativeHttpTransport } from "../native/http.js";
import { NativeSecureStorage } from "../native/storage.js";
import type { NativeSessionManager } from "../session/native-session-manager.js";

export interface PushNotificationToken {
  value: string;
}

export interface PushNotificationPayload {
  body?: string | undefined;
  data?: Record<string, unknown> | undefined;
  id?: string | undefined;
  subtitle?: string | undefined;
  title?: string | undefined;
}

export interface ActionPerformed {
  actionId: string;
  inputValue?: string | undefined;
  notification: PushNotificationPayload;
}

export interface PushNotificationsPlugin {
  addListener(
    eventName: "registration",
    listenerFunc: (token: PushNotificationToken) => void
  ): Promise<{ remove: () => Promise<void> }>;
  addListener(
    eventName: "registrationError",
    listenerFunc: (error: { error: string }) => void
  ): Promise<{ remove: () => Promise<void> }>;
  addListener(
    eventName: "pushNotificationReceived",
    listenerFunc: (notification: PushNotificationPayload) => void
  ): Promise<{ remove: () => Promise<void> }>;
  addListener(
    eventName: "pushNotificationActionPerformed",
    listenerFunc: (action: ActionPerformed) => void
  ): Promise<{ remove: () => Promise<void> }>;
  checkPermissions(): Promise<{ receive: "prompt" | "prompt-with-fallback" | "granted" | "denied" }>;
  getDeliveredNotifications?(): Promise<{ notifications: PushNotificationPayload[] }>;
  register(): Promise<void>;
  removeAllDeliveredNotifications?(): Promise<void>;
  requestPermissions(): Promise<{ receive: "prompt" | "prompt-with-fallback" | "granted" | "denied" }>;
  unregister(): Promise<void>;
}

export type SupportedTargetApp = "crm" | "billing" | "chat" | "ecommerce";

export interface NotificationRouteTarget {
  actionId: string;
  app: SupportedTargetApp;
  channelUuid?: string | undefined;
  documentId?: string | number | undefined;
  enquiryId?: string | number | undefined;
  originalData?: Record<string, unknown> | undefined;
  route?: string | undefined;
}

export interface PushRegistrationPayload {
  appId: string;
  clientVersion: string;
  deviceToken: string;
  model?: string | undefined;
  osVersion?: string | undefined;
  platform: "android" | "ios" | "web";
}

export interface PushCoordinatorOptions {
  httpTransport?: NativeHttpTransport | undefined;
  plugin?: PushNotificationsPlugin | undefined;
  secureStorage?: NativeSecureStorage | undefined;
  sessionManager?: NativeSessionManager | undefined;
}

export class PushNotificationCoordinator {
  private readonly plugin: PushNotificationsPlugin;
  private readonly httpTransport?: NativeHttpTransport | undefined;
  private readonly storage: NativeSecureStorage;
  private readonly sessionManager?: NativeSessionManager | undefined;

  private isRegisteredWithNative = false;
  private cleanupListeners: Array<() => Promise<void>> = [];
  private readonly foregroundListeners = new Set<(notification: PushNotificationPayload) => void>();
  private readonly tapRoutingListeners = new Set<(target: NotificationRouteTarget) => void>();
  private unsubscribeSession: (() => void) | null = null;

  constructor(options: PushCoordinatorOptions = {}) {
    this.httpTransport = options.httpTransport;
    this.storage = options.secureStorage ?? new NativeSecureStorage();
    this.sessionManager = options.sessionManager;

    if (options.plugin) {
      this.plugin = options.plugin;
    } else if (Capacitor.isNativePlatform()) {
      this.plugin = registerPlugin<PushNotificationsPlugin>("PushNotifications");
    } else {
      this.plugin = {
        addListener: async () => ({ remove: async () => {} }),
        checkPermissions: async () => ({ receive: "prompt" }),
        register: async () => {},
        requestPermissions: async () => ({ receive: "granted" }),
        unregister: async () => {}
      };
    }

    // Auto cleanup device token upon logout
    if (this.sessionManager) {
      this.unsubscribeSession = this.sessionManager.subscribe((state) => {
        if (state.status === "unauthenticated" || state.status === "expired") {
          void this.cleanupOnLogout().catch(() => {});
        }
      });
    }
  }

  get isRegistered(): boolean {
    return this.isRegisteredWithNative;
  }

  async initialize(): Promise<void> {
    try {
      const regHandle = await this.plugin.addListener("registration", (token) => {
        void this.handleTokenRegistration(token.value);
      });
      this.cleanupListeners.push(regHandle.remove);

      const errHandle = await this.plugin.addListener("registrationError", (_err) => {
        this.isRegisteredWithNative = false;
      });
      this.cleanupListeners.push(errHandle.remove);

      const recvHandle = await this.plugin.addListener("pushNotificationReceived", (notification) => {
        for (const listener of this.foregroundListeners) {
          try {
            listener(notification);
          } catch {
            // Listener error
          }
        }
      });
      this.cleanupListeners.push(recvHandle.remove);

      const actionHandle = await this.plugin.addListener(
        "pushNotificationActionPerformed",
        (action) => {
          this.handleNotificationTap(action);
        }
      );
      this.cleanupListeners.push(actionHandle.remove);
    } catch {
      // Listener registration fallback on unsupported platforms
    }
  }

  /**
   * Device Registration flow:
   * Requests OS permissions and registers device with APNs / FCM.
   */
  async registerDevice(): Promise<boolean> {
    try {
      let permStatus = await this.plugin.checkPermissions();
      if (permStatus.receive === "prompt") {
        permStatus = await this.plugin.requestPermissions();
      }

      if (permStatus.receive !== "granted") {
        return false;
      }

      await this.plugin.register();
      this.isRegisteredWithNative = true;
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Token Registration & Token Rotation handling:
   * When OS issues a token, verifies whether it has changed from the stored token.
   * If rotated or new, transmits to Platform API (/api/platform/devices/register)
   * and persists in secure storage.
   */
  async handleTokenRegistration(tokenValue: string): Promise<void> {
    if (!tokenValue) return;

    const previousToken = await this.storage.getDevicePushToken();
    const isRotated = previousToken !== null && previousToken !== tokenValue;

    // Persist new token
    await this.storage.setDevicePushToken(tokenValue);

    // Register with Platform API if transport is available
    if (this.httpTransport) {
      const platformName = Capacitor.getPlatform() === "ios"
        ? "ios"
        : Capacitor.getPlatform() === "android"
        ? "android"
        : "web";

      const payload: PushRegistrationPayload = {
        appId: "in.codexsun.cxmobile",
        clientVersion: "1.1.61",
        deviceToken: tokenValue,
        model: "cxmobile-device",
        osVersion: "1.0",
        platform: platformName
      };

      try {
        await this.httpTransport.post("/api/platform/devices/register", payload);
      } catch {
        // Fallback endpoint if reverse-proxy prefix is stripped
        try {
          await this.httpTransport.post("/platform/devices/register", payload);
        } catch {
          // Keep stored token even if server sync is deferred
        }
      }
    }

    if (isRotated) {
      // Rotation completed
    }
  }

  /**
   * Logout Token Cleanup:
   * Unregisters device push token from Platform API and purges local credentials.
   */
  async cleanupOnLogout(): Promise<void> {
    const currentToken = await this.storage.getDevicePushToken();

    if (currentToken && this.httpTransport) {
      try {
        await this.httpTransport.post("/api/platform/devices/unregister", {
          deviceToken: currentToken
        });
      } catch {
        try {
          await this.httpTransport.post("/platform/devices/unregister", {
            deviceToken: currentToken
          });
        } catch {
          // Best effort server unregistration
        }
      }
    }

    await this.storage.clearDevicePushToken();

    try {
      await this.plugin.unregister();
    } catch {
      // Unregister error
    }

    this.isRegisteredWithNative = false;
  }

  /**
   * Notification Tap Routing:
   * Extracts deep-link context and routes user to the target workspace and entity.
   */
  handleNotificationTap(action: ActionPerformed): void {
    const data = action.notification.data ?? {};
    const rawApp = String(data.app ?? data.module ?? "crm").toLowerCase();

    let targetApp: SupportedTargetApp = "crm";
    if (rawApp.includes("chat")) targetApp = "chat";
    else if (rawApp.includes("bill")) targetApp = "billing";
    else if (rawApp.includes("ecom")) targetApp = "ecommerce";

    const target: NotificationRouteTarget = {
      actionId: action.actionId,
      app: targetApp,
      channelUuid: data.channelUuid ? String(data.channelUuid) : undefined,
      documentId: (data.documentId ?? data.quotationId ?? data.invoiceId) as string | number | undefined,
      enquiryId: (data.enquiryId ?? data.taskId) as string | number | undefined,
      originalData: data,
      route: data.route ? String(data.route) : undefined
    };

    for (const listener of this.tapRoutingListeners) {
      try {
        listener(target);
      } catch {
        // Listener error
      }
    }
  }

  onForegroundNotification(listener: (notification: PushNotificationPayload) => void): () => void {
    this.foregroundListeners.add(listener);
    return () => this.foregroundListeners.delete(listener);
  }

  onNotificationTap(listener: (target: NotificationRouteTarget) => void): () => void {
    this.tapRoutingListeners.add(listener);
    return () => this.tapRoutingListeners.delete(listener);
  }

  dispose(): void {
    if (this.unsubscribeSession) {
      this.unsubscribeSession();
      this.unsubscribeSession = null;
    }

    for (const remove of this.cleanupListeners) {
      void remove().catch(() => {});
    }
    this.cleanupListeners = [];
    this.foregroundListeners.clear();
    this.tapRoutingListeners.clear();
  }
}
