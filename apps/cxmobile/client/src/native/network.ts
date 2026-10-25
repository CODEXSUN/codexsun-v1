import { Network, type ConnectionStatus } from "@capacitor/network";
import { Capacitor, type PluginListenerHandle } from "@capacitor/core";

export type NetworkStatusCallback = (status: ConnectionStatus) => void;

export class NetworkMonitor {
  private listenerHandle: PluginListenerHandle | null = null;
  private readonly listeners = new Set<NetworkStatusCallback>();
  private currentStatus: ConnectionStatus = {
    connected: true,
    connectionType: "wifi"
  };

  constructor() {
    this.init();
  }

  private async init(): Promise<void> {
    if (Capacitor.isNativePlatform()) {
      try {
        this.currentStatus = await Network.getStatus();
        this.listenerHandle = await Network.addListener("networkStatusChange", (status) => {
          this.currentStatus = status;
          this.notify(status);
        });
        return;
      } catch {
        // Fall back to web listeners
      }
    }

    if (typeof window !== "undefined") {
      this.currentStatus = {
        connected: window.navigator.onLine ?? true,
        connectionType: "unknown"
      };

      window.addEventListener("online", () => {
        this.currentStatus = { connected: true, connectionType: "wifi" };
        this.notify(this.currentStatus);
      });

      window.addEventListener("offline", () => {
        this.currentStatus = { connected: false, connectionType: "none" };
        this.notify(this.currentStatus);
      });
    }
  }

  async getStatus(): Promise<ConnectionStatus> {
    if (Capacitor.isNativePlatform()) {
      try {
        this.currentStatus = await Network.getStatus();
      } catch {
        // Return cached
      }
    } else if (typeof window !== "undefined") {
      this.currentStatus = {
        connected: window.navigator.onLine ?? true,
        connectionType: window.navigator.onLine ? "wifi" : "none"
      };
    }
    return this.currentStatus;
  }

  get isConnected(): boolean {
    return this.currentStatus.connected;
  }

  subscribe(callback: NetworkStatusCallback): () => void {
    this.listeners.add(callback);
    // Immediately invoke with current status
    callback(this.currentStatus);
    return () => {
      this.listeners.delete(callback);
    };
  }

  private notify(status: ConnectionStatus): void {
    for (const callback of this.listeners) {
      callback(status);
    }
  }

  destroy(): void {
    this.listeners.clear();
    if (this.listenerHandle) {
      void this.listenerHandle.remove();
      this.listenerHandle = null;
    }
  }
}
