import assert from "node:assert/strict";
import { test } from "node:test";

test("startup organisation reads cancel stalled requests", async () => {
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  const originalFetch = globalThis.fetch;
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: { __CODEXSUN_RUNTIME_CONFIG__: { VITE_PLATFORM_API_URL: "/api/app" } }
  });
  globalThis.fetch = async (_url, options) =>
    new Promise<Response>((_resolve, reject) => {
      const signal = options?.signal;
      if (!signal) return reject(new Error("Missing abort signal"));
      signal.addEventListener("abort", () => reject(signal.reason), { once: true });
    });
  try {
    const { listCompanies } = await import("./company/company.services");
    const { listFinancialYears } = await import("./financial-year/financial-year.services");
    const { getDefaultCompany } = await import("./default-company/default-company.services");
    for (const request of [
      (signal: AbortSignal) => listCompanies("", signal),
      listFinancialYears,
      getDefaultCompany
    ]) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(new Error("Timed out")), 25);
      try {
        await assert.rejects(request(controller.signal), /Timed out/);
      } finally {
        clearTimeout(timeout);
      }
    }
  } finally {
    globalThis.fetch = originalFetch;
    if (originalWindow) Object.defineProperty(globalThis, "window", originalWindow);
    else Reflect.deleteProperty(globalThis, "window");
  }
});
