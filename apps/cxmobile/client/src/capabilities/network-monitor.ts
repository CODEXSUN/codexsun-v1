import { Capacitor, registerPlugin } from "@capacitor/core";

export type ConnectionType = "wifi" | "cellular" | "none" | "unknown";

export interface NetworkStatus {
  connected: boolean;
  connectionType: ConnectionType;
}

export interface NetworkPlugin {
  addListener(
    eventName: "networkStatusChange",
    listenerFunc: (status: NetworkStatus) => void
  ): Promise<{ remove: () => Promise<void> }>;
  getStatus(): Promise<NetworkStatus>;
  removeAllListeners?(): Promise<void>;
}

export interface NetworkMonitorOptions {
  debounceMs?: number | undefined;
  initialStatus?: NetworkStatus | undefined;
  plugin?: NetworkPlugin | undefined;
}

export class NetworkMonitor {
  private readonly plugin: NetworkPlugin;
  private readonly debounceMs: number;
  private currentStatus: NetworkStatus;
  private isStarted = false;
  private removePluginListener: (() => Promise<void>) | null = null;

  private readonly statusListeners = new Set<(status: NetworkStatus) => void>();
  private readonly reconnectListeners = new Set<() => void | Promise<void>>();
  private debounceTimer: NodeJS.Timeout | null = null;

  constructor(options: NetworkMonitorOptions = {}) {
    this.debounceMs = options.debounceMs ?? 300;
    this.currentStatus = options.initialStatus ?? {
      connected: true,
      connectionType: "wifi"
    };

    if (options.plugin) {
      this.plugin = options.plugin;
    } else if (Capacitor.isNativePlatform()) {
      this.plugin = registerPlugin<NetworkPlugin>("Network");
    } else {
      this.plugin = {
        addListener: async (_eventName: string, listenerFunc: (status: NetworkStatus) => void) => {
          if (typeof window !== "undefined") {
            const handleOnline = () => listenerFunc({ connected: true, connectionType: "wifi" });
            const handleOffline = () => listenerFunc({ connected: false, connectionType: "none" });
            window.addEventListener("online", handleOnline);
            window.addEventListener("offline", handleOffline);
            return {
              remove: async () => {
                window.removeEventListener("online", handleOnline);
                window.removeEventListener("offline", handleOffline);
              }
            };
          }
          return { remove: async () => {} };
        },
        getStatus: async () => {
          const isOnline = typeof navigator !== "undefined" ? navigator.onLine : true;
          return {
            connected: isOnline,
            connectionType: isOnline ? "wifi" : "none"
          };
        }
      };
    }
  }

  get status(): NetworkStatus {
    return this.currentStatus;
  }

  get isOnline(): boolean {
    return this.currentStatus.connected;
  }

  async start(): Promise<void> {
    if (this.isStarted) return;
    this.isStarted = true;

    try {
      const initial = await this.plugin.getStatus();
      this.currentStatus = initial;
    } catch {
      // Use existing status if getStatus fails
    }

    try {
      const handle = await this.plugin.addListener("networkStatusChange", (newStatus) => {
        this.handleStatusChange(newStatus);
      });
      this.removePluginListener = handle.remove;
    } catch {
      // Fallback if plugin listener registration fails
    }
  }

  stop(): void {
    if (!this.isStarted) return;
    this.isStarted = false;

    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }

    if (this.removePluginListener) {
      void this.removePluginListener().catch(() => {});
      this.removePluginListener = null;
    }
  }

  /**
   * Internal status change dispatcher with debouncing and reconnection detection.
   */
  handleStatusChange(newStatus: NetworkStatus): void {
    const wasOffline = !this.currentStatus.connected;
    const isNowOnline = newStatus.connected;

    this.currentStatus = newStatus;

    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = setTimeout(() => {
      // Notify status listeners
      for (const listener of this.statusListeners) {
        try {
          listener(this.currentStatus);
        } catch {
          // Listener error
        }
      }

      // Reconnection Trigger: offline -> online transition
      if (wasOffline && isNowOnline) {
        for (const reconnectHandler of this.reconnectListeners) {
          try {
            void reconnectHandler();
          } catch {
            // Handler error
          }
        }
      }
    }, this.debounceMs);
  }

  /**
   * Subscribes to network status transitions (online/offline).
   */
  onStatusChange(listener: (status: NetworkStatus) => void): () => void {
    this.statusListeners.add(listener);
    return () => this.statusListeners.delete(listener);
  }

  /**
   * Subscribes to reconnection triggers (fired when network comes back online after being offline).
   * Used to trigger WebSocket reconnections, synchronization queues, and cache refetches.
   */
  onReconnected(handler: () => void | Promise<void>): () => void {
    this.reconnectListeners.add(handler);
    return () => this.reconnectListeners.delete(handler);
  }
}
