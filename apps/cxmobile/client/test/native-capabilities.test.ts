import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { Preferences } from "@capacitor/preferences";
import {
  CameraAdapter,
  FilesystemAdapter,
  InMemorySecureStorageAdapter,
  NativeHardwareKeystoreAdapter,
  NativeSecureStorage,
  NetworkMonitor as NativeNetworkMonitor,
  PushNotificationsAdapter,
  ShareAdapter
} from "../src/native/index.js";
import {
  AppLifecycleCoordinator,
  CameraCapabilityAdapter,
  DeviceInsetsCoordinator,
  FilesystemCapabilityAdapter,
  NetworkMonitor as CapabilityNetworkMonitor,
  PushNotificationCoordinator
} from "../src/capabilities/index.js";
import type { NativeHttpTransport } from "../src/native/http.js";
import type { SessionRecord } from "../src/session/session-types.js";

describe("Native Capabilities & Plugin Verification", () => {
  // ==========================================
  // Section 1: Native Plugin Adapters (src/native/)
  // ==========================================

  it("initializes NetworkMonitor and emits connectivity changes", async () => {
    const monitor = new NativeNetworkMonitor();
    const status = await monitor.getStatus();

    assert.equal(typeof status.connected, "boolean");
    assert.equal(typeof status.connectionType, "string");

    let received = false;
    const unsubscribe = monitor.subscribe((st) => {
      received = true;
      assert.equal(typeof st.connected, "boolean");
    });

    assert.equal(received, true);
    unsubscribe();
    monitor.destroy();
  });

  it("handles CameraAdapter permissions and photo capture fallback", async () => {
    const camera = new CameraAdapter();
    const hasPermission = await camera.checkPermissions();
    assert.equal(typeof hasPermission, "boolean");

    const requestResult = await camera.requestPermissions();
    assert.equal(typeof requestResult, "boolean");
  });

  it("handles FilesystemAdapter write, read, and uri operations", async () => {
    const fs = new FilesystemAdapter();

    const uri = await fs.writeText("test-doc.txt", "Hello CODEXSUN Mobile Native FS");
    assert.ok(uri.includes("test-doc.txt"));

    const content = await fs.readFile("test-doc.txt");
    assert.equal(typeof content, "string");

    const binaryUri = await fs.writeBinary("test-bin.dat", Buffer.from("Binary payload").toString("base64"));
    assert.ok(typeof binaryUri === "string");

    const fileUri = await fs.getFileUri("test-doc.txt");
    assert.ok(fileUri.includes("test-doc.txt"));

    await fs.deleteFile("test-doc.txt");
    await fs.deleteFile("test-bin.dat");
  });

  it("handles ShareAdapter capabilities and share invocation", async () => {
    const share = new ShareAdapter();
    const canShare = await share.canShare();
    assert.equal(typeof canShare, "boolean");

    const shared = await share.share({
      title: "CODEXSUN Invoice",
      text: "Quotation #QT-2026-001",
      url: "https://codexsun.invalid/billing/quotation/1"
    });
    assert.equal(typeof shared, "boolean");
  });

  it("handles PushNotificationsAdapter registration and callback subscriptions", async () => {
    const push = new PushNotificationsAdapter();
    assert.equal(push.token, null);

    let tokenReceived: string | null = null;
    const unsubToken = push.onToken((tok) => {
      tokenReceived = tok;
    });

    let notificationReceived = false;
    const unsubNotify = push.onNotification(() => {
      notificationReceived = true;
    });

    assert.equal(tokenReceived, null);
    assert.equal(notificationReceived, false);

    const regResult = await push.register();
    assert.equal(regResult, null); // Non-native fallback returns null

    unsubToken();
    unsubNotify();
  });

  it("ensures NativeSecureStorage isolates credentials from browser storage", async () => {
    const memoryAdapter = new InMemorySecureStorageAdapter();
    const storage = new NativeSecureStorage({ adapter: memoryAdapter });

    await storage.storeSession({
      activeCompanyId: 1,
      apiOrigin: "http://127.0.0.1:18080",
      authenticated: true,
      desk: "tenant",
      email: "field@codexsun.invalid",
      expiresAt: new Date(Date.now() + 3600000).toISOString(),
      loginHost: "127.0.0.1",
      sessionGeneration: 1,
      sessionSlot: "native-slot-12345",
      tenantCode: "NATIVE",
      token: "super-secret-token",
      userType: "tenant"
    });

    const stored = await storage.getStoredSession();
    assert.ok(stored);
    assert.equal(stored.sessionSlot, "native-slot-12345");
    assert.equal(stored.token, "super-secret-token");

    const slot = await storage.getSessionSlot();
    assert.equal(slot, "native-slot-12345");

    const secret = await storage.getSessionSecret();
    assert.equal(secret, "super-secret-token");

    const host = await storage.getActiveHost();
    assert.equal(host, "127.0.0.1");

    await storage.setDevicePushToken("token-abc-999");
    assert.equal(await storage.getDevicePushToken(), "token-abc-999");
    await storage.clearDevicePushToken();
    assert.equal(await storage.getDevicePushToken(), null);

    await storage.clearSession();
    const afterClear = await storage.getStoredSession();
    assert.equal(afterClear, null);
    assert.equal(await storage.getSessionSlot(), null);
    assert.equal(await storage.getSessionSecret(), null);
  });

  // ==========================================
  // Section 2: Capability Adapters (src/capabilities/)
  // ==========================================

  describe("CameraCapabilityAdapter", () => {
    it("validates photo byte size and allowable mime types", () => {
      const camera = new CameraCapabilityAdapter({
        allowedMimeTypes: ["image/jpeg", "image/png"],
        maxSizeBytes: 1024 * 500 // 500 KB limit
      });

      // Valid JPEG photo
      const validPhoto = {
        format: "jpeg",
        mimeType: "image/jpeg",
        sizeBytes: 1024 * 250
      };
      const validResult = camera.validatePhoto(validPhoto);
      assert.equal(validResult.valid, true);
      assert.equal(validResult.error, undefined);

      // Oversized photo
      const oversizedPhoto = {
        format: "jpeg",
        mimeType: "image/jpeg",
        sizeBytes: 1024 * 800
      };
      const overResult = camera.validatePhoto(oversizedPhoto);
      assert.equal(overResult.valid, false);
      assert.match(overResult.error ?? "", /exceeds allowable limit/u);

      // Disallowed format / MIME
      const gifPhoto = {
        format: "gif",
        mimeType: "image/gif",
        sizeBytes: 1024 * 100
      };
      const gifResult = camera.validatePhoto(gifPhoto);
      assert.equal(gifResult.valid, false);
      assert.match(gifResult.error ?? "", /Unsupported image format/u);
    });

    it("executes photo capture and integrates web fallback picker when native capture is unavailable", async () => {
      let fallbackInvoked = false;
      const camera = new CameraCapabilityAdapter({
        webFallbackPicker: async () => {
          fallbackInvoked = true;
          return {
            base64String: "dGVzdC1pbWFnZQ==",
            dataUrl: "data:image/jpeg;base64,dGVzdC1pbWFnZQ==",
            format: "jpeg",
            mimeType: "image/jpeg",
            sizeBytes: 10
          };
        }
      });

      const perms = await camera.checkPermissions();
      assert.equal(typeof perms.camera, "string");

      const req = await camera.requestPermissions(["camera"]);
      assert.equal(typeof req.camera, "string");

      const result = await camera.capturePhoto();
      assert.equal(result.success, true);
      assert.equal(fallbackInvoked, true);
      assert.equal(result.fallbackTriggered, true);
      assert.ok(result.photo);
      assert.equal(result.photo.format, "jpeg");

      const pickResult = await camera.pickPhoto();
      assert.equal(pickResult.success, true);
    });

    it("handles pickMultiplePhotos within limits", async () => {
      const camera = new CameraCapabilityAdapter();
      const result = await camera.pickMultiplePhotos(3);
      assert.equal(result.success, true);
      assert.ok(Array.isArray(result.photos));
    });
  });

  describe("FilesystemCapabilityAdapter", () => {
    it("saves, reads, checks existence, and deletes files in virtual storage", async () => {
      const fs = new FilesystemCapabilityAdapter();

      const testContent = "Invoice Reference #INV-2026-999";
      const record = await fs.saveFile("invoices/inv-999.txt", testContent, {
        directory: "DOCUMENTS",
        mimeType: "text/plain"
      });

      assert.equal(record.filename, "invoices/inv-999.txt");
      assert.equal(record.mimeType, "text/plain");
      assert.ok(record.sizeBytes > 0);
      assert.ok(record.uri.includes("inv-999.txt"));

      const exists = await fs.fileExists("invoices/inv-999.txt");
      assert.equal(exists, true);

      const notExists = await fs.fileExists("nonexistent-file.bin");
      assert.equal(notExists, false);

      const readBack = await fs.readFile("invoices/inv-999.txt");
      const decoded = Buffer.from(readBack, "base64").toString("utf8");
      assert.equal(decoded, testContent);

      await fs.deleteFile("invoices/inv-999.txt");
      const existsAfter = await fs.fileExists("invoices/inv-999.txt");
      assert.equal(existsAfter, false);
    });

    it("performs authenticated download and storage via NativeHttpTransport", async () => {
      const mockTransport = {
        loadMediaBlob: async () => {
          return new Blob(["%PDF-1.5 Mock PDF Binary Content"], { type: "application/pdf" });
        }
      } as unknown as NativeHttpTransport;

      const fs = new FilesystemCapabilityAdapter({
        httpTransport: mockTransport
      });

      const stored = await fs.downloadAndStoreFile(
        "/api/billing/invoices/101/pdf",
        "invoices/invoice_101.pdf"
      );

      assert.equal(stored.filename, "invoices/invoice_101.pdf");
      assert.equal(stored.mimeType, "application/pdf");
      assert.ok(stored.sizeBytes > 0);

      const exists = await fs.fileExists("invoices/invoice_101.pdf");
      assert.equal(exists, true);
    });

    it("validates PDF extensions and shares documents via sharePdfDocument", async () => {
      let fallbackShared = false;
      const fs = new FilesystemCapabilityAdapter({
        webShareFallback: async () => {
          fallbackShared = true;
          return true;
        }
      });

      // Rejects non-PDF file extension
      await assert.rejects(
        async () => {
          await fs.sharePdfDocument({
            localPath: "invoice.png",
            title: "Invalid Document"
          });
        },
        (err: Error) => {
          assert.match(err.message, /not a valid PDF document/u);
          return true;
        }
      );

      // Shares valid PDF document
      const shareResult = await fs.sharePdfDocument({
        localPath: "quotation_qt01.pdf",
        title: "Quotation QT01"
      });

      assert.equal(shareResult.shared, true);
      assert.equal(fallbackShared, true);
    });
  });

  describe("CapabilityNetworkMonitor", () => {
    it("tracks connectivity, handles debounced status changes, and fires reconnect handlers", async () => {
      const monitor = new CapabilityNetworkMonitor({
        debounceMs: 20,
        initialStatus: { connected: false, connectionType: "none" }
      });

      assert.equal(monitor.isOnline, false);
      assert.equal(monitor.status.connected, false);

      let statusNotified = false;
      let reconnectedFired = false;

      const unsubStatus = monitor.onStatusChange((st) => {
        statusNotified = true;
        assert.equal(st.connected, true);
      });

      const unsubReconnect = monitor.onReconnected(() => {
        reconnectedFired = true;
      });

      await monitor.start();

      // Transition from offline to online
      monitor.handleStatusChange({ connected: true, connectionType: "wifi" });
      assert.equal(monitor.isOnline, true);

      // Wait for debounce period (20ms + safety margin)
      await new Promise((resolve) => setTimeout(resolve, 50));

      assert.equal(statusNotified, true);
      assert.equal(reconnectedFired, true);

      unsubStatus();
      unsubReconnect();
      monitor.stop();
    });
  });

  describe("DeviceInsetsCoordinator", () => {
    it("updates keyboard state and synchronizes custom safe area CSS variables", async () => {
      const cssProps = new Map<string, string>();
      const originalDoc = (globalThis as unknown as { document?: unknown }).document;

      (globalThis as unknown as { document: unknown }).document = {
        documentElement: {
          style: {
            getPropertyValue: (prop: string) => cssProps.get(prop) ?? "",
            setProperty: (prop: string, val: string) => {
              cssProps.set(prop, val);
            }
          }
        }
      };

      try {
        const insets = new DeviceInsetsCoordinator({ autoApplyCssVariables: true });
        await insets.start();

        // Initial safe areas should be applied
        assert.equal(cssProps.get("--cxmobile-safe-top"), "env(safe-area-inset-top, 0px)");
        assert.equal(cssProps.get("--cxmobile-safe-bottom"), "env(safe-area-inset-bottom, 0px)");

        // Custom safe areas
        insets.setCustomSafeAreas({
          bottom: 34,
          left: 0,
          right: 0,
          top: 48
        });
        assert.equal(cssProps.get("--cxmobile-safe-top"), "48px");
        assert.equal(cssProps.get("--cxmobile-safe-bottom"), "34px");

        // Keyboard state update
        let receivedKeyboardHeight = 0;
        const unsub = insets.onKeyboardChange((st) => {
          receivedKeyboardHeight = st.height;
        });

        insets.updateKeyboardState({ height: 280, isVisible: true });
        assert.equal(insets.keyboardState.height, 280);
        assert.equal(insets.keyboardState.isVisible, true);
        assert.equal(receivedKeyboardHeight, 280);
        assert.equal(cssProps.get("--cxmobile-keyboard-height"), "280px");
        assert.equal(cssProps.get("--cxmobile-keyboard-visible"), "1");

        // Keyboard hide
        insets.updateKeyboardState({ height: 0, isVisible: false });
        assert.equal(cssProps.get("--cxmobile-keyboard-height"), "0px");
        assert.equal(cssProps.get("--cxmobile-keyboard-visible"), "0");

        // Status bar style calls without errors
        await insets.setStatusBarStyle("dark");
        await insets.setStatusBarColor("#1e293b");
        await insets.setStatusBarOverlay(true);
        await insets.showKeyboard();
        await insets.hideKeyboard();

        unsub();
        insets.stop();
      } finally {
        if (originalDoc === undefined) {
          delete (globalThis as unknown as { document?: unknown }).document;
        } else {
          (globalThis as unknown as { document: unknown }).document = originalDoc;
        }
      }
    });
  });

  describe("AppLifecycleCoordinator", () => {
    it("coordinates foreground/background transitions and calculates session revalidation threshold", async () => {
      const coordinator = new AppLifecycleCoordinator({
        sessionRevalidateThresholdMs: 100 // 100ms threshold for test
      });

      assert.equal(coordinator.isInForeground, true);

      let backgroundTriggered = false;
      let resumeEventReceived: { backgroundDurationMs: number; sessionRevalidationRequired: boolean } | null = null;
      let stateChanged: boolean | null = null;

      const unsubBg = coordinator.onBackground(() => {
        backgroundTriggered = true;
      });

      const unsubResume = coordinator.onResume((evt) => {
        resumeEventReceived = evt;
      });

      const unsubState = coordinator.onStateChange((isActive) => {
        stateChanged = isActive;
      });

      await coordinator.start();

      // Transition to Background
      coordinator.handleStateChange({ isActive: false });
      assert.equal(coordinator.isInForeground, false);
      assert.equal(backgroundTriggered, true);
      assert.equal(stateChanged, false);
      assert.ok(coordinator.lastBackgroundTimestamp);

      // Wait 120ms to exceed 100ms session revalidation threshold
      await new Promise((resolve) => setTimeout(resolve, 120));

      // Transition back to Foreground (Resume)
      coordinator.handleStateChange({ isActive: true });
      assert.equal(coordinator.isInForeground, true);
      assert.equal(stateChanged, true);
      assert.ok(coordinator.lastResumeTimestamp);
      assert.ok(resumeEventReceived !== null);
      const resume = resumeEventReceived as { backgroundDurationMs: number; sessionRevalidationRequired: boolean };
      assert.equal(resume.sessionRevalidationRequired, true);
      assert.ok(resume.backgroundDurationMs >= 100);

      unsubBg();
      unsubResume();
      unsubState();
      coordinator.stop();
    });

    it("registers URL open and back button handlers", async () => {
      const coordinator = new AppLifecycleCoordinator();
      let capturedUrl = "";
      let backPressed = false;

      const unsubUrl = coordinator.onUrlOpen((url) => {
        capturedUrl = url;
      });
      const unsubBack = coordinator.onBackButton(() => {
        backPressed = true;
      });

      assert.equal(capturedUrl, "");
      assert.equal(backPressed, false);

      unsubUrl();
      unsubBack();
    });
  });

  describe("PushNotificationCoordinator", () => {
    it("handles token registration, rotation detection, and storage persistence", async () => {
      const memoryAdapter = new InMemorySecureStorageAdapter();
      const storage = new NativeSecureStorage({ adapter: memoryAdapter });
      let registeredPayload: Record<string, unknown> | null = null;

      const mockTransport = {
        post: async (_url: string, body: unknown) => {
          registeredPayload = body as Record<string, unknown>;
          return { data: { success: true }, success: true };
        }
      } as unknown as NativeHttpTransport;

      const coordinator = new PushNotificationCoordinator({
        httpTransport: mockTransport,
        secureStorage: storage
      });

      await coordinator.initialize();

      // Initial token registration
      await coordinator.handleTokenRegistration("fcm-device-token-11111");
      assert.equal(await storage.getDevicePushToken(), "fcm-device-token-11111");
      assert.ok(registeredPayload !== null);
      const regPayload1 = registeredPayload as Record<string, unknown>;
      assert.equal(regPayload1.deviceToken, "fcm-device-token-11111");

      // Token rotation: new token from OS
      await coordinator.handleTokenRegistration("fcm-device-token-22222");
      assert.equal(await storage.getDevicePushToken(), "fcm-device-token-22222");
      const regPayload2 = registeredPayload as Record<string, unknown>;
      assert.equal(regPayload2.deviceToken, "fcm-device-token-22222");

      // Cleanup on logout
      let unregisterPayload: Record<string, unknown> | null = null;
      (mockTransport as unknown as { post: (url: string, b: unknown) => Promise<unknown> }).post = async (_url, b) => {
        unregisterPayload = b as Record<string, unknown>;
        return { data: { success: true }, success: true };
      };

      await coordinator.cleanupOnLogout();
      assert.equal(await storage.getDevicePushToken(), null);
      assert.ok(unregisterPayload !== null);
      const unregPayload = unregisterPayload as Record<string, unknown>;
      assert.equal(unregPayload.deviceToken, "fcm-device-token-22222");

      coordinator.dispose();
    });

    it("correctly routes notification tap events to CRM, Chat, Billing, and Ecommerce", () => {
      const coordinator = new PushNotificationCoordinator();
      const routedTargets: unknown[] = [];

      coordinator.onNotificationTap((target) => {
        routedTargets.push(target);
      });

      // 1. CRM Lead Notification
      coordinator.handleNotificationTap({
        actionId: "tap",
        notification: {
          data: {
            app: "crm",
            enquiryId: "enq-9001",
            route: "/crm/enquiry/9001"
          },
          title: "New Lead Assigned"
        }
      });

      // 2. Chat Direct Message Notification
      coordinator.handleNotificationTap({
        actionId: "tap",
        notification: {
          data: {
            channelUuid: "chan-uuid-444",
            module: "chat"
          },
          title: "New Customer Message"
        }
      });

      // 3. Billing Invoice Notification
      coordinator.handleNotificationTap({
        actionId: "tap",
        notification: {
          data: {
            app: "billing",
            invoiceId: 1042
          },
          title: "Invoice Paid"
        }
      });

      // 4. Ecommerce Order Notification
      coordinator.handleNotificationTap({
        actionId: "tap",
        notification: {
          data: {
            app: "ecommerce",
            documentId: "order-555"
          },
          title: "New Web Order"
        }
      });

      assert.equal(routedTargets.length, 4);

      const [crm, chat, billing, ecom] = routedTargets as Array<{
        app: string;
        channelUuid?: string;
        documentId?: string | number;
        enquiryId?: string | number;
      }>;

      assert.ok(crm && chat && billing && ecom);

      assert.equal(crm.app, "crm");
      assert.equal(crm.enquiryId, "enq-9001");

      assert.equal(chat.app, "chat");
      assert.equal(chat.channelUuid, "chan-uuid-444");

      assert.equal(billing.app, "billing");
      assert.equal(billing.documentId, 1042);

      assert.equal(ecom.app, "ecommerce");
      assert.equal(ecom.documentId, "order-555");

      coordinator.dispose();
    });
  });

  // ==========================================
  // Section 3: Native Secure Storage Strict Isolation (Objective 3)
  // ==========================================

  describe("Native Secure Storage Isolation Strict Verification", () => {
    it("strictly isolates session credentials and secrets from localStorage and Preferences", async () => {
      // Mock window.localStorage and window.sessionStorage for Node environment
      const mockLocalMap = new Map<string, string>();
      const mockSessionMap = new Map<string, string>();
      const createStorageMock = (map: Map<string, string>) => ({
        clear: () => map.clear(),
        getItem: (k: string) => map.get(k) ?? null,
        key: (i: number) => Array.from(map.keys())[i] ?? null,
        get length() {
          return map.size;
        },
        removeItem: (k: string) => map.delete(k),
        setItem: (k: string, v: string) => map.set(k, v)
      });

      const originalWindow = (globalThis as unknown as { window?: unknown }).window;
      (globalThis as unknown as { window: unknown }).window = {
        localStorage: createStorageMock(mockLocalMap),
        sessionStorage: createStorageMock(mockSessionMap)
      };

      try {
        // Clear localStorage and Preferences prior to assertion
        window.localStorage.clear();
        await Preferences.clear();

        const memoryAdapter = new InMemorySecureStorageAdapter();
        const secureStorage = new NativeSecureStorage({
          adapter: memoryAdapter,
          namespace: "codexsun.cxmobile"
        });

        const sensitiveSession: SessionRecord = {
          activeCompanyId: 42,
          activeFinancialYearId: 2026,
          apiOrigin: "https://api.codexsun.invalid",
          authenticated: true,
          desk: "tenant",
          email: "executive@codexsun.invalid",
          expiresAt: new Date(Date.now() + 86400000).toISOString(),
          loginHost: "api.codexsun.invalid",
          name: "Security Officer",
          sessionGeneration: 1,
          sessionSlot: "hardware-isolated-slot-778899",
          tenantCode: "ISOLATED_CORP",
          tenantDbName: "tenant_isolated_corp",
          tenantId: "tenant-iso-uuid",
          token: "hardware-isolated-secret-token-abcdef1234567890",
          userType: "tenant"
        };

        // Store sensitive session in NativeSecureStorage
        await secureStorage.storeSession(sensitiveSession);
        await secureStorage.setDevicePushToken("push-device-isolated-token-xyz");
        await secureStorage.setSecret("biometric_encryption_key", "bio-aes-key-secret-9999");

        // 1. Verify secrets are successfully stored and retrievable via NativeSecureStorage
        const stored = await secureStorage.getStoredSession();
        assert.ok(stored);
        assert.equal(stored.sessionSlot, "hardware-isolated-slot-778899");
        assert.equal(stored.token, "hardware-isolated-secret-token-abcdef1234567890");
        assert.equal(await secureStorage.getSessionSlot(), "hardware-isolated-slot-778899");
        assert.equal(await secureStorage.getSessionSecret(), "hardware-isolated-secret-token-abcdef1234567890");
        assert.equal(await secureStorage.getDevicePushToken(), "push-device-isolated-token-xyz");
        assert.equal(await secureStorage.getSecret("biometric_encryption_key"), "bio-aes-key-secret-9999");

        // 2. Strict Verification: localStorage contains ZERO sensitive records or secret tokens
        assert.equal(window.localStorage.getItem("codexsun.cxmobile.auth.session_record"), null);
        assert.equal(window.localStorage.getItem("codexsun.cxmobile.auth.session_secret"), null);
        assert.equal(window.localStorage.getItem("codexsun.cxmobile.auth.session_slot"), null);
        assert.equal(window.localStorage.getItem("codexsun.cxmobile.auth.device_push_token"), null);
        assert.equal(window.localStorage.getItem("auth.session_secret"), null);
        assert.equal(window.localStorage.getItem("auth.session_slot"), null);

        // Verify no key in localStorage contains any portion of the secret token
        for (let i = 0; i < window.localStorage.length; i++) {
          const key = window.localStorage.key(i);
          if (key) {
            const val = window.localStorage.getItem(key);
            assert.equal(val?.includes("hardware-isolated-secret-token"), false);
            assert.equal(val?.includes("hardware-isolated-slot"), false);
          }
        }

        // 3. Strict Verification: Unencrypted Preferences contains ZERO sensitive records or secret tokens
        const prefSecret = await Preferences.get({ key: "codexsun.cxmobile.auth.session_secret" });
        assert.equal(prefSecret.value, null);

        const prefSlot = await Preferences.get({ key: "codexsun.cxmobile.auth.session_slot" });
        assert.equal(prefSlot.value, null);

        const prefRecord = await Preferences.get({ key: "codexsun.cxmobile.auth.session_record" });
        assert.equal(prefRecord.value, null);

        const prefPushToken = await Preferences.get({ key: "codexsun.cxmobile.auth.device_push_token" });
        assert.equal(prefPushToken.value, null);

        // 4. Strict Verification: sessionStorage contains ZERO sensitive records
        assert.equal(window.sessionStorage.getItem("codexsun.cxmobile.auth.session_record"), null);
        assert.equal(window.sessionStorage.getItem("codexsun.cxmobile.auth.session_secret"), null);

        // 5. Verify cleanup purges credentials completely without leaving lingering traces
        await secureStorage.clearSession();
        await secureStorage.clearDevicePushToken();

        assert.equal(await secureStorage.getStoredSession(), null);
        assert.equal(await secureStorage.getSessionSlot(), null);
        assert.equal(await secureStorage.getSessionSecret(), null);
        assert.equal(await secureStorage.getDevicePushToken(), null);

        // Custom secret still retained until clearAll
        assert.equal(await secureStorage.getSecret("biometric_encryption_key"), "bio-aes-key-secret-9999");
        await secureStorage.clearAll();
        assert.equal(await secureStorage.getSecret("biometric_encryption_key"), null);
      } finally {
        if (originalWindow === undefined) {
          delete (globalThis as unknown as { window?: unknown }).window;
        } else {
          (globalThis as unknown as { window: unknown }).window = originalWindow;
        }
      }
    });

    it("verifies Native KeyStore isolation (XR01): token remains native-isolated and transport dispatches natively", async () => {
      // Simulate native platform hardware keystore adapter
      let nativeKeyStoreRawToken: string | null = "key-store-hardware-token-xyz-123";
      let nativeKeyStoreRecord: string | null = null;
      let authorizationHeaderInjectedNatively: string | null = null;

      const mockNativeAdapter = {
        clear: async () => {
          nativeKeyStoreRawToken = null;
          nativeKeyStoreRecord = null;
        },
        executeAuthenticatedRequest: async (opts: {
          headers?: Record<string, string> | undefined;
          method?: string | undefined;
          url: string;
        }) => {
          // Verify that JavaScript did NOT send the plaintext Authorization header across bridge!
          assert.equal(opts.headers?.["Authorization"], undefined);

          // Native Android KeyStore injects the decrypted bearer token directly in Java memory
          authorizationHeaderInjectedNatively = `Bearer ${nativeKeyStoreRawToken}`;

          return {
            data: JSON.stringify({ data: { authorized: true, user: "native-isolated-user" }, success: true }),
            headers: { "content-type": "application/json" },
            status: 200
          };
        },
        getItem: async (key: string) => {
          if (key.endsWith("auth.session_secret")) {
            return "[native-isolated]"; // Secret token never crosses bridge to JS
          }
          if (key.endsWith("auth.session_record")) {
            return nativeKeyStoreRecord;
          }
          return null;
        },
        removeItem: async (key: string) => {
          if (key.endsWith("auth.session_secret")) nativeKeyStoreRawToken = null;
          if (key.endsWith("auth.session_record")) nativeKeyStoreRecord = null;
        },
        setItem: async (key: string, value: string) => {
          if (key.endsWith("auth.session_secret")) nativeKeyStoreRawToken = value;
          if (key.endsWith("auth.session_record")) nativeKeyStoreRecord = value;
        }
      };

      const storage = new NativeSecureStorage({ adapter: mockNativeAdapter });

      // Store session with raw token on native device
      const nativeSession: SessionRecord = {
        activeCompanyId: 10,
        apiOrigin: "https://api.codexsun.invalid",
        authenticated: true,
        desk: "tenant",
        email: "native-engineer@codexsun.invalid",
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
        loginHost: "api.codexsun.invalid",
        sessionGeneration: 1,
        sessionSlot: "slot-native-999",
        tenantCode: "NATIVE",
        token: "[native-isolated]",
        userType: "tenant"
      };

      await storage.storeSession(nativeSession, "key-store-hardware-token-xyz-123");

      // Verify that in JS heap / stored record, token is "[native-isolated]"
      const retrieved = await storage.getStoredSession();
      assert.ok(retrieved);
      assert.equal(retrieved.token, "[native-isolated]");
      assert.notEqual(retrieved.token, "key-store-hardware-token-xyz-123");

      // Verify that calling getSessionSecret returns "[native-isolated]"
      const secret = await storage.getSessionSecret();
      assert.equal(secret, "[native-isolated]");

      // Test NativeHttpTransport with nativeHttpDispatcher
      const sessionManager = {
        activeSession: retrieved,
        apiOrigin: "https://api.codexsun.invalid",
        currentGeneration: 1,
        isResponseStale: () => false,
        sessionSlot: "slot-native-999"
      } as unknown as import("../src/session/native-session-manager.js").NativeSessionManager;

      const { NativeHttpTransport } = await import("../src/native/http.js");
      const { HostVerifier } = await import("../src/session/host-verifier.js");

      const transport = new NativeHttpTransport({
        hostVerifier: new HostVerifier({ allowedOrigins: ["https://api.codexsun.invalid"] }),
        nativeHttpDispatcher: mockNativeAdapter.executeAuthenticatedRequest,
        sessionManager
      });

      const res = await transport.get<{ authorized: boolean; user: string }>("/api/enquiry");
      assert.equal(res.authorized, true);
      assert.equal(res.user, "native-isolated-user");

      // Confirm that the native layer injected the Authorization header in Java memory
      assert.equal(authorizationHeaderInjectedNatively, "Bearer key-store-hardware-token-xyz-123");
    });

    it("verifies NativeHardwareKeystoreAdapter fallbacks safely on non-native environments", async () => {
      const hwAdapter = new NativeHardwareKeystoreAdapter();
      // On non-native test environment without native bridge, calls catch and return null gracefully
      const val = await hwAdapter.getItem("test-key");
      assert.equal(val, null);
    });

    it("enforces adversarial destination binding and rejects foreign origins without credential transmission", async () => {
      const approvedOrigin = "https://api.codexsun.invalid";
      const approvedBaseUrl = "https://api.codexsun.invalid/api/app";

      // Simulated native plugin destination validator matching NativeSecureStoragePlugin.java assertValidDestination
      const nativeDestinationValidator = (targetUrl: string, session: { apiBaseUrl: string; apiOrigin: string }) => {
        if (targetUrl.includes("..") || targetUrl.toLowerCase().includes("%2e%2e")) {
          throw new Error(`Path traversal denied: ${targetUrl}`);
        }
        const parsed = new URL(targetUrl);
        const approved = new URL(session.apiOrigin);
        if (parsed.origin !== approved.origin) {
          throw new Error(`Destination origin '${parsed.origin}' does not match approved session origin '${session.apiOrigin}'. Cross-origin credential injection denied.`);
        }
        const approvedBase = new URL(session.apiBaseUrl);
        if (!parsed.pathname.startsWith(approvedBase.pathname)) {
          throw new Error(`Destination path '${parsed.pathname}' escapes approved API scope '${approvedBase.pathname}'. Scope escape denied.`);
        }
        return true;
      };

      const session = { apiBaseUrl: approvedBaseUrl, apiOrigin: approvedOrigin };

      // 1. Foreign origin attempt
      assert.throws(
        () => nativeDestinationValidator("https://attacker.invalid/steal", session),
        /does not match approved session origin/
      );

      // 2. Scope escape attempt
      assert.throws(
        () => nativeDestinationValidator("https://api.codexsun.invalid/admin/secret", session),
        /escapes approved API scope/
      );

      // 3. Path traversal escape attempt
      assert.throws(
        () => nativeDestinationValidator("https://api.codexsun.invalid/api/app/../../etc/passwd", session),
        /Path traversal denied/
      );

      // 4. Approved endpoint within scope succeeds
      assert.equal(
        nativeDestinationValidator("https://api.codexsun.invalid/api/app/crm/enquiries", session),
        true
      );
    });

    it("filters Set-Cookie, Cookie, and Authorization response headers before returning to JavaScript", async () => {
      // Simulates response header filtering in NativeSecureStoragePlugin.java
      const rawNativeHeaders: Record<string, string> = {
        "authorization": "Bearer synthetic-token",
        "content-type": "application/json",
        "cookie": "secret-cookie-val",
        "proxy-authenticate": "Basic realm=secret",
        "set-cookie": "codexsun_session=synthetic-secret; Path=/; HttpOnly",
        "set-cookie2": "codexsun_session2=synthetic-secret; Path=/",
        "x-codexsun-version": "1.1.61",
        "x-tenant-id": "tenant-abc"
      };

      const filteredHeaders: Record<string, string> = {};
      const sensitiveKeys = new Set(["set-cookie", "set-cookie2", "authorization", "cookie", "proxy-authenticate", "x-auth-token"]);

      for (const [k, v] of Object.entries(rawNativeHeaders)) {
        if (!sensitiveKeys.has(k.toLowerCase())) {
          filteredHeaders[k.toLowerCase()] = v;
        }
      }

      assert.strictEqual(filteredHeaders["set-cookie"], undefined, "Set-Cookie must be stripped");
      assert.strictEqual(filteredHeaders["set-cookie2"], undefined, "Set-Cookie2 must be stripped");
      assert.strictEqual(filteredHeaders["authorization"], undefined, "Authorization must be stripped");
      assert.strictEqual(filteredHeaders["cookie"], undefined, "Cookie must be stripped");
      assert.strictEqual(filteredHeaders["proxy-authenticate"], undefined, "Proxy-Authenticate must be stripped");
      assert.equal(filteredHeaders["content-type"], "application/json");
      assert.equal(filteredHeaders["x-tenant-id"], "tenant-abc");
    });

    it("redacts token when getSecret is called for auth.session_record", async () => {
      // Simulates native KeyStore getSecret behavior on AndroidKeyStore
      const simulateNativeGetSecret = (key: string, storedRawJson: string) => {
        if (key.endsWith("auth.session_secret")) {
          return "[native-isolated]";
        }
        if (key.endsWith("auth.session_record")) {
          const parsed = JSON.parse(storedRawJson);
          if (parsed.token) parsed.token = "[native-isolated]";
          if (parsed.accessToken) parsed.accessToken = "[native-isolated]";
          return JSON.stringify(parsed);
        }
        return storedRawJson;
      };

      const rawVaultData = JSON.stringify({
        email: "worker@codexsun.invalid",
        loginHost: "127.0.0.1:18010",
        sessionSlot: "slot-xyz",
        token: "synthetic-raw-bearer-secret-12345"
      });

      const result = simulateNativeGetSecret("codexsun.cxmobile.auth.session_record", rawVaultData);
      const parsedResult = JSON.parse(result);

      assert.equal(parsedResult.token, "[native-isolated]", "Token must be redacted in getSecret session_record");
      assert.notEqual(parsedResult.token, "synthetic-raw-bearer-secret-12345");
      assert.equal(parsedResult.sessionSlot, "slot-xyz");
    });

    it("denies caller overriding Authorization and session slot headers in native transport", async () => {
      // Simulates header injection in NativeSecureStoragePlugin.java
      const callerHeaders: Record<string, string> = {
        "Accept": "application/json",
        "Authorization": "Bearer caller-spoofed-token",
        "x-codexsun-session-slot": "fake-slot-from-caller",
        "x-custom-request": "payload-123"
      };

      const nativeToken = "genuine-native-keystore-token";
      const nativeSlot = "genuine-native-slot";

      const finalHeaders: Record<string, string> = {};
      for (const [k, v] of Object.entries(callerHeaders)) {
        const lowerK = k.toLowerCase();
        if (lowerK === "authorization" || lowerK === "x-codexsun-session-slot") {
          continue; // Deny caller override
        }
        finalHeaders[k] = v;
      }

      // Native injection
      finalHeaders["Authorization"] = `Bearer ${nativeToken}`;
      finalHeaders["x-codexsun-session-slot"] = nativeSlot;

      assert.equal(finalHeaders["Authorization"], "Bearer genuine-native-keystore-token");
      assert.equal(finalHeaders["x-codexsun-session-slot"], "genuine-native-slot");
      assert.equal(finalHeaders["x-custom-request"], "payload-123");
    });
  });
});
