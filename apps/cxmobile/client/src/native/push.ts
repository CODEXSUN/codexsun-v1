import {
  PushNotifications,
  type PushNotificationSchema,
  type Token
} from "@capacitor/push-notifications";
import { Capacitor } from "@capacitor/core";
import type { NativeHttpTransport } from "./http.js";

export type PushNotificationCallback = (notification: PushNotificationSchema) => void;
export type DeviceTokenCallback = (token: string) => void;

export class PushNotificationsAdapter {
  private deviceToken: string | null = null;
  private readonly listeners = new Set<PushNotificationCallback>();
  private readonly tokenListeners = new Set<DeviceTokenCallback>();

  get token(): string | null {
    return this.deviceToken;
  }

  async register(transport?: NativeHttpTransport): Promise<string | null> {
    if (!Capacitor.isNativePlatform()) {
      return null;
    }

    try {
      const permStatus = await PushNotifications.requestPermissions();
      if (permStatus.receive !== "granted") {
        return null;
      }

      await PushNotifications.addListener("registration", async (token: Token) => {
        this.deviceToken = token.value;
        for (const listener of this.tokenListeners) {
          listener(token.value);
        }

        // Register token with Platform backend if transport provided
        if (transport) {
          try {
            await transport.post("/platform/devices/push-token", {
              platform: Capacitor.getPlatform(),
              token: token.value
            });
          } catch {
            // Ignore backend registration failure during initial boot
          }
        }
      });

      await PushNotifications.addListener("registrationError", () => {
        this.deviceToken = null;
      });

      await PushNotifications.addListener(
        "pushNotificationReceived",
        (notification: PushNotificationSchema) => {
          for (const listener of this.listeners) {
            listener(notification);
          }
        }
      );

      await PushNotifications.register();
      return this.deviceToken;
    } catch {
      return null;
    }
  }

  onNotification(callback: PushNotificationCallback): () => void {
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  }

  onToken(callback: DeviceTokenCallback): () => void {
    this.tokenListeners.add(callback);
    if (this.deviceToken) {
      callback(this.deviceToken);
    }
    return () => {
      this.tokenListeners.delete(callback);
    };
  }
}
