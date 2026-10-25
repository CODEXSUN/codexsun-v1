import { App, type AppState, type URLOpenListenerEvent } from "@capacitor/app";

export interface AppResumeEvent {
  backgroundDurationMs: number;
  sessionRevalidationRequired: boolean;
  timestamp: number;
}

export interface AppPluginContract {
  addListener(
    eventName: "appStateChange",
    listenerFunc: (state: AppState) => void
  ): Promise<{ remove: () => Promise<void> }>;
  addListener(
    eventName: "appUrlOpen",
    listenerFunc: (event: URLOpenListenerEvent) => void
  ): Promise<{ remove: () => Promise<void> }>;
  addListener(
    eventName: "backButton",
    listenerFunc: (data: { canGoBack: boolean }) => void
  ): Promise<{ remove: () => Promise<void> }>;
  getState?(): Promise<AppState>;
  removeAllListeners?(): Promise<void>;
}

export interface AppLifecycleOptions {
  autoStart?: boolean | undefined;
  initialState?: AppState | undefined;
  plugin?: AppPluginContract | undefined;
  sessionRevalidateThresholdMs?: number | undefined;
}

export const DEFAULT_SESSION_REVALIDATE_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes

export class AppLifecycleCoordinator {
  private readonly plugin: AppPluginContract;
  private readonly sessionRevalidateThresholdMs: number;
  private isActive: boolean;
  private lastBackgroundedAt: number | null = null;
  private lastResumedAt: number | null = null;
  private isStarted = false;

  private cleanupListeners: Array<() => Promise<void>> = [];
  private readonly stateListeners = new Set<(isActive: boolean) => void>();
  private readonly resumeListeners = new Set<(event: AppResumeEvent) => void | Promise<void>>();
  private readonly backgroundListeners = new Set<() => void>();
  private readonly urlOpenListeners = new Set<(url: string) => void>();
  private readonly backButtonListeners = new Set<() => void>();

  constructor(options: AppLifecycleOptions = {}) {
    this.plugin = options.plugin ?? (App as unknown as AppPluginContract);
    this.sessionRevalidateThresholdMs =
      options.sessionRevalidateThresholdMs ?? DEFAULT_SESSION_REVALIDATE_THRESHOLD_MS;
    this.isActive = options.initialState?.isActive ?? true;

    if (options.autoStart) {
      void this.start();
    }
  }

  get isInForeground(): boolean {
    return this.isActive;
  }

  get lastBackgroundTimestamp(): number | null {
    return this.lastBackgroundedAt;
  }

  get lastResumeTimestamp(): number | null {
    return this.lastResumedAt;
  }

  async start(): Promise<void> {
    if (this.isStarted) return;
    this.isStarted = true;

    if (this.plugin.getState) {
      try {
        const state = await this.plugin.getState();
        this.isActive = state.isActive;
      } catch {
        // Fallback to initial state
      }
    }

    try {
      const stateHandle = await this.plugin.addListener("appStateChange", (state) => {
        this.handleStateChange(state);
      });
      this.cleanupListeners.push(stateHandle.remove);

      const urlHandle = await this.plugin.addListener("appUrlOpen", (event) => {
        for (const listener of this.urlOpenListeners) {
          try {
            listener(event.url);
          } catch {
            // Listener error
          }
        }
      });
      this.cleanupListeners.push(urlHandle.remove);

      const backHandle = await this.plugin.addListener("backButton", () => {
        for (const listener of this.backButtonListeners) {
          try {
            listener();
          } catch {
            // Listener error
          }
        }
      });
      this.cleanupListeners.push(backHandle.remove);
    } catch {
      // Listener registration error fallback
    }
  }

  stop(): void {
    if (!this.isStarted) return;
    this.isStarted = false;

    for (const remove of this.cleanupListeners) {
      void remove().catch(() => {});
    }
    this.cleanupListeners = [];
  }

  handleStateChange(state: AppState): void {
    const wasActive = this.isActive;
    const now = Date.now();
    this.isActive = state.isActive;

    // Notify general state listeners
    for (const listener of this.stateListeners) {
      try {
        listener(this.isActive);
      } catch {
        // Listener error
      }
    }

    if (wasActive && !state.isActive) {
      // Transition: Foreground -> Background
      this.lastBackgroundedAt = now;
      for (const listener of this.backgroundListeners) {
        try {
          listener();
        } catch {
          // Listener error
        }
      }
    } else if (!wasActive && state.isActive) {
      // Transition: Background -> Foreground (Resume)
      this.lastResumedAt = now;
      const duration = this.lastBackgroundedAt ? now - this.lastBackgroundedAt : 0;
      const revalidateRequired = duration >= this.sessionRevalidateThresholdMs;

      const resumeEvent: AppResumeEvent = {
        backgroundDurationMs: duration,
        sessionRevalidationRequired: revalidateRequired,
        timestamp: now
      };

      for (const listener of this.resumeListeners) {
        try {
          void listener(resumeEvent);
        } catch {
          // Listener error
        }
      }
    }
  }

  onStateChange(listener: (isActive: boolean) => void): () => void {
    this.stateListeners.add(listener);
    return () => this.stateListeners.delete(listener);
  }

  /**
   * Auto-refresh on resume coordinator:
   * Triggers query invalidation, unread message fetches, or session re-validation
   * when the user returns the mobile app to the foreground.
   */
  onResume(listener: (event: AppResumeEvent) => void | Promise<void>): () => void {
    this.resumeListeners.add(listener);
    return () => this.resumeListeners.delete(listener);
  }

  onBackground(listener: () => void): () => void {
    this.backgroundListeners.add(listener);
    return () => this.backgroundListeners.delete(listener);
  }

  onUrlOpen(listener: (url: string) => void): () => void {
    this.urlOpenListeners.add(listener);
    return () => this.urlOpenListeners.delete(listener);
  }

  onBackButton(listener: () => void): () => void {
    this.backButtonListeners.add(listener);
    return () => this.backButtonListeners.delete(listener);
  }
}
