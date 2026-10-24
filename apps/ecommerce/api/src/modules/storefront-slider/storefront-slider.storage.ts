import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, resolve, sep } from "node:path";
import { AppError } from "@codexsun/framework/errors";
import { ecommerceEnv } from "../../env.js";

const publicImagePattern = /^\/[a-z0-9][a-z0-9-]*\.webp$/u;

export class StorefrontSliderStorage {
  settings() {
    return {
      acceptedMimeTypes: ["image/webp"] as ["image/webp"],
      maxUploadBytes: ecommerceEnv.ECOMMERCE_SLIDER_IMAGE_MAX_BYTES,
      publicPath: "/" as const
    };
  }

  async upload(fileName: string, contentBase64: string) {
    const publicPath = sliderPublicPath(fileName);
    const body = Buffer.from(contentBase64, "base64");
    if (!body.length || body.length > ecommerceEnv.ECOMMERCE_SLIDER_IMAGE_MAX_BYTES) {
      throw AppError.validation("Slider image must be a non-empty WebP within the upload limit.");
    }
    if (!isWebp(body)) throw AppError.validation("Slider images must use the WebP format.");
    const path = storagePath(publicPath);
    await mkdir(resolve(ecommerceEnv.ECOMMERCE_SLIDER_IMAGE_ROOT), { recursive: true });
    await writeFile(path, body);
    return { imageUrl: publicPath, sizeBytes: body.length };
  }

  async content(fileName: string) {
    const publicPath = sliderPublicPath(fileName);
    try {
      return await readFile(storagePath(publicPath));
    } catch {
      const body = await this.readLegacy(publicPath);
      if (!body) throw AppError.notFound("Slider image was not found.");
      return body;
    }
  }

  /** EC-R09 bridge: idempotently copy a pre-tenant-root slot into the verified tenant root. */
  private async readLegacy(publicPath: string) {
    const currentRoot = resolve(ecommerceEnv.ECOMMERCE_SLIDER_IMAGE_ROOT);
    const legacyRoot = resolve(ecommerceEnv.ECOMMERCE_SLIDER_IMAGE_LEGACY_ROOT);
    if (legacyRoot === currentRoot) return null;
    let body: Buffer;
    try {
      body = await readFile(storagePath(publicPath, legacyRoot));
    } catch {
      return null;
    }
    try {
      await mkdir(currentRoot, { recursive: true });
      await writeFile(storagePath(publicPath, currentRoot), body, { flag: "wx" });
    } catch {
      /* Another request may have copied it, or the tenant root is read-only. */
    }
    return body;
  }
}

export function sliderPublicPath(fileName: string) {
  const normalized = `/${basename(fileName).toLowerCase()}`;
  if (!publicImagePattern.test(normalized)) {
    throw AppError.validation(
      "Slider image name must contain letters, numbers, or hyphens and end in .webp."
    );
  }
  return normalized;
}

export function sliderContentUrl(imageUrl: string) {
  return publicImagePattern.test(imageUrl)
    ? `/api/platform/storefront/slider-images/${encodeURIComponent(imageUrl.slice(1))}`
    : imageUrl;
}

function storagePath(publicPath: string, root = resolve(ecommerceEnv.ECOMMERCE_SLIDER_IMAGE_ROOT)) {
  const path = resolve(root, publicPath.slice(1));
  if (!path.startsWith(`${root}${sep}`)) throw AppError.validation("Slider image path is invalid.");
  return path;
}

function isWebp(body: Buffer) {
  return (
    body.length >= 12 &&
    body.subarray(0, 4).toString("ascii") === "RIFF" &&
    body.subarray(8, 12).toString("ascii") === "WEBP"
  );
}
