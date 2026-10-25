import {
  Keyboard,
  type KeyboardInfo
} from "@capacitor/keyboard";
import {
  StatusBar,
  Style as StatusBarStyle
} from "@capacitor/status-bar";

export interface SafeAreaInsets {
  bottom: number;
  left: number;
  right: number;
  top: number;
}

export interface KeyboardState {
  height: number;
  isVisible: boolean;
}

export interface KeyboardPluginContract {
  addListener(
    eventName: "keyboardWillShow" | "keyboardDidShow",
    listenerFunc: (info: KeyboardInfo) => void
  ): Promise<{ remove: () => Promise<void> }>;
  addListener(
    eventName: "keyboardWillHide" | "keyboardDidHide",
    listenerFunc: () => void
  ): Promise<{ remove: () => Promise<void> }>;
  hide(): Promise<void>;
  show(): Promise<void>;
}

export interface StatusBarPluginContract {
  hide(): Promise<void>;
  setBackgroundColor(options: { color: string }): Promise<void>;
  setOverlaysWebView(options: { overlay: boolean }): Promise<void>;
  setStyle(options: { style: StatusBarStyle }): Promise<void>;
  show(): Promise<void>;
}

export interface DeviceInsetsOptions {
  autoApplyCssVariables?: boolean | undefined;
  keyboardPlugin?: KeyboardPluginContract | undefined;
  statusBarPlugin?: StatusBarPluginContract | undefined;
}

export class DeviceInsetsCoordinator {
  private readonly keyboardPlugin: KeyboardPluginContract;
  private readonly statusBarPlugin: StatusBarPluginContract;
  private readonly autoApplyCss: boolean;

  private currentKeyboardState: KeyboardState = { height: 0, isVisible: false };
  private cleanupListeners: Array<() => Promise<void>> = [];
  private readonly keyboardListeners = new Set<(state: KeyboardState) => void>();
  private isStarted = false;

  constructor(options: DeviceInsetsOptions = {}) {
    this.keyboardPlugin = options.keyboardPlugin ?? (Keyboard as unknown as KeyboardPluginContract);
    this.statusBarPlugin = options.statusBarPlugin ?? (StatusBar as unknown as StatusBarPluginContract);
    this.autoApplyCss = options.autoApplyCssVariables ?? true;
  }

  get keyboardState(): KeyboardState {
    return this.currentKeyboardState;
  }

  async start(): Promise<void> {
    if (this.isStarted) return;
    this.isStarted = true;

    if (this.autoApplyCss) {
      this.applyInitialSafeAreas();
    }

    try {
      const showHandle = await this.keyboardPlugin.addListener("keyboardWillShow", (info) => {
        this.updateKeyboardState({ height: info.keyboardHeight, isVisible: true });
      });
      this.cleanupListeners.push(showHandle.remove);

      const hideHandle = await this.keyboardPlugin.addListener("keyboardWillHide", () => {
        this.updateKeyboardState({ height: 0, isVisible: false });
      });
      this.cleanupListeners.push(hideHandle.remove);
    } catch {
      // Fallback on web/test platforms where Capacitor Keyboard is unattached
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

  updateKeyboardState(next: KeyboardState): void {
    this.currentKeyboardState = next;

    if (this.autoApplyCss && typeof document !== "undefined" && document.documentElement) {
      const root = document.documentElement;
      root.style.setProperty("--cxmobile-keyboard-height", `${next.height}px`);
      root.style.setProperty("--cxmobile-keyboard-visible", next.isVisible ? "1" : "0");
    }

    for (const listener of this.keyboardListeners) {
      try {
        listener(next);
      } catch {
        // Listener error
      }
    }
  }

  private applyInitialSafeAreas(): void {
    if (typeof document !== "undefined" && document.documentElement) {
      const root = document.documentElement;
      root.style.setProperty("--cxmobile-safe-top", "env(safe-area-inset-top, 0px)");
      root.style.setProperty("--cxmobile-safe-bottom", "env(safe-area-inset-bottom, 0px)");
      root.style.setProperty("--cxmobile-safe-left", "env(safe-area-inset-left, 0px)");
      root.style.setProperty("--cxmobile-safe-right", "env(safe-area-inset-right, 0px)");
    }
  }

  setCustomSafeAreas(insets: SafeAreaInsets): void {
    if (typeof document !== "undefined" && document.documentElement) {
      const root = document.documentElement;
      root.style.setProperty("--cxmobile-safe-top", `${insets.top}px`);
      root.style.setProperty("--cxmobile-safe-bottom", `${insets.bottom}px`);
      root.style.setProperty("--cxmobile-safe-left", `${insets.left}px`);
      root.style.setProperty("--cxmobile-safe-right", `${insets.right}px`);
    }
  }

  async setStatusBarStyle(style: "dark" | "light" | "default"): Promise<void> {
    const capacitorStyle =
      style === "dark"
        ? StatusBarStyle.Dark
        : style === "light"
        ? StatusBarStyle.Light
        : StatusBarStyle.Default;

    try {
      await this.statusBarPlugin.setStyle({ style: capacitorStyle });
    } catch {
      // Status bar unattached on web
    }
  }

  async setStatusBarColor(hexColor: string): Promise<void> {
    try {
      await this.statusBarPlugin.setBackgroundColor({ color: hexColor });
    } catch {
      // Status bar unattached on web
    }
  }

  async setStatusBarOverlay(overlay: boolean): Promise<void> {
    try {
      await this.statusBarPlugin.setOverlaysWebView({ overlay });
    } catch {
      // Status bar unattached on web
    }
  }

  async showKeyboard(): Promise<void> {
    try {
      await this.keyboardPlugin.show();
    } catch {
      // Web fallback
    }
  }

  async hideKeyboard(): Promise<void> {
    try {
      await this.keyboardPlugin.hide();
    } catch {
      // Web fallback
    }
  }

  onKeyboardChange(listener: (state: KeyboardState) => void): () => void {
    this.keyboardListeners.add(listener);
    return () => this.keyboardListeners.delete(listener);
  }
}
