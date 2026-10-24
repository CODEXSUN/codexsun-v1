import { resolve } from "node:path";
import {
  findEcommercePublicStorageRoot,
  getEcommerceTenantKey
} from "./database/ecommerce-database.js";

const maxImageBytes = 8 * 1024 * 1024;

function verifiedTenantRoot(kind: "products" | "sliders") {
  const publicRoot = findEcommercePublicStorageRoot();
  if (publicRoot) return resolve(publicRoot, "ecommerce", kind);
  // Non-HTTP callers (focused storage tests and seed jobs) have no Platform-provided root. Keep the
  // legacy app root there; HTTP requests always use the verified tenant public root.
  return legacyTenantRoot(kind);
}

function legacyTenantRoot(kind: "products" | "sliders") {
  const storageRoot = process.env.STORAGE_ROOT;
  if (!storageRoot) throw new Error("STORAGE_ROOT is required for ecommerce images.");
  return resolve(storageRoot, "ecommerce", getEcommerceTenantKey(), kind);
}

export const ecommerceEnv = {
  get ECOMMERCE_PRODUCT_IMAGE_MAX_BYTES() {
    return maxImageBytes;
  },
  get ECOMMERCE_PRODUCT_IMAGE_ROOT() {
    return verifiedTenantRoot("products");
  },
  get ECOMMERCE_PRODUCT_IMAGE_LEGACY_ROOT() {
    return legacyTenantRoot("products");
  },
  get ECOMMERCE_SLIDER_IMAGE_MAX_BYTES() {
    return maxImageBytes;
  },
  get ECOMMERCE_SLIDER_IMAGE_ROOT() {
    return verifiedTenantRoot("sliders");
  },
  get ECOMMERCE_SLIDER_IMAGE_LEGACY_ROOT() {
    return legacyTenantRoot("sliders");
  }
};
