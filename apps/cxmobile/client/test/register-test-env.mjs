import { register } from "node:module";
import React from "react";

process.env.NODE_ENV = "test";

// Simple in-memory Storage shim for Node environment
class MemoryStorage {
  constructor() {
    this.store = new Map();
  }
  getItem(key) {
    return this.store.get(key) ?? null;
  }
  setItem(key, value) {
    this.store.set(key, String(value));
  }
  removeItem(key) {
    this.store.delete(key);
  }
  clear() {
    this.store.clear();
  }
  get length() {
    return this.store.size;
  }
  key(index) {
    return Array.from(this.store.keys())[index] ?? null;
  }
}

// Setup global DOM-like environment for Node test runner
if (typeof globalThis.window === "undefined") {
  globalThis.window = globalThis;
}
globalThis.React = React;

if (!globalThis.window.localStorage) {
  globalThis.window.localStorage = new MemoryStorage();
}
if (!globalThis.window.sessionStorage) {
  globalThis.window.sessionStorage = new MemoryStorage();
}
if (!globalThis.window.addEventListener) {
  globalThis.window.addEventListener = () => {};
}
if (!globalThis.window.removeEventListener) {
  globalThis.window.removeEventListener = () => {};
}

// Initialize runtime config so requiredClientEnv() resolves cleanly during test module imports
const testConfig = Object.freeze({
  VITE_PLATFORM_API_URL: "http://127.0.0.1:18010/api/app",
  VITE_APP_NAME: "cxmobile",
  VITE_TENANT_NAME: "CODEXSUN",
  VITE_TENANCY_MODE: "multi",
  VITE_DEV_AUTO_TENANT_LOGIN: "0"
});

globalThis.__CODEXSUN_RUNTIME_CONFIG__ = testConfig;
if (globalThis.window) {
  globalThis.window.__CODEXSUN_RUNTIME_CONFIG__ = testConfig;
}

register("./css-loader.mjs", import.meta.url);
