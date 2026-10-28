import assert from "node:assert/strict";
import { test } from "node:test";
import { CrmHttpError, crmRequest } from "./crm-request";

test("CRM requests preserve the HTTP status of an authorization failure", async () => {
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  const originalStorage = Object.getOwnPropertyDescriptor(globalThis, "sessionStorage");
  const originalFetch = globalThis.fetch;
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: { __CODEXSUN_RUNTIME_CONFIG__: { VITE_PLATFORM_API_URL: "/api/app" } }
  });
  Object.defineProperty(globalThis, "sessionStorage", {
    configurable: true,
    value: { getItem: () => null }
  });
  globalThis.fetch = async () =>
    Response.json({ success: false, error: { message: "Forbidden" } }, { status: 403 });
  try {
    await assert.rejects(
      crmRequest("/crm/leads/page"),
      (error) => error instanceof CrmHttpError && error.status === 403
    );
  } finally {
    globalThis.fetch = originalFetch;
    if (originalWindow) Object.defineProperty(globalThis, "window", originalWindow);
    else Reflect.deleteProperty(globalThis, "window");
    if (originalStorage) Object.defineProperty(globalThis, "sessionStorage", originalStorage);
    else Reflect.deleteProperty(globalThis, "sessionStorage");
  }
});
