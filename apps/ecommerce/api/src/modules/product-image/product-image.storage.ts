import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, extname, resolve, sep } from "node:path";
import { AppError } from "@codexsun/framework/errors";
import { ecommerceEnv } from "../../env.js";

const formats = {
  ".jpeg": { mime: "image/jpeg", signature: isJpeg },
  ".jpg": { mime: "image/jpeg", signature: isJpeg },
  ".png": { mime: "image/png", signature: isPng },
  ".webp": { mime: "image/webp", signature: isWebp }
} as const;

export class ProductImageStorage {
  settings() {
    return {
      acceptedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
      maxUploadBytes: ecommerceEnv.ECOMMERCE_PRODUCT_IMAGE_MAX_BYTES
    };
  }

  async upload(fileName: string, contentBase64: string) {
    const safeName = productImageFileName(fileName);
    const body = Buffer.from(contentBase64, "base64");
    const format = formatFor(safeName);
    if (!body.length || body.length > ecommerceEnv.ECOMMERCE_PRODUCT_IMAGE_MAX_BYTES) {
      throw AppError.validation("Product image must be non-empty and within the upload limit.");
    }
    if (!format.signature(body)) throw AppError.validation("Product image content is invalid.");
    const root = resolve(ecommerceEnv.ECOMMERCE_PRODUCT_IMAGE_ROOT);
    await mkdir(root, { recursive: true });
    await writeFile(resolveMediaPath(root, safeName), body);
    return {
      imageUrl: `/api/platform/storefront/product-images/${encodeURIComponent(safeName)}`,
      sizeBytes: body.length
    };
  }

  async content(fileName: string) {
    const safeName = productImageFileName(fileName);
    const root = resolve(ecommerceEnv.ECOMMERCE_PRODUCT_IMAGE_ROOT);
    try {
      return {
        body: await readFile(resolveMediaPath(root, safeName)),
        mime: formatFor(safeName).mime
      };
    } catch {
      const body = await this.readLegacy(safeName);
      if (!body) throw AppError.notFound("Product image was not found.");
      return { body, mime: formatFor(safeName).mime };
    }
  }

  /**
   * EC-R09 bridge: serve bytes from the pre-tenant app root and copy them once into the verified
   * tenant root. The public URL and record link are unchanged; the copy is idempotent and safe to
   * repeat. A read-only tenant root still serves the legacy bytes.
   */
  private async readLegacy(fileName: string) {
    const legacyRoot = resolve(ecommerceEnv.ECOMMERCE_PRODUCT_IMAGE_LEGACY_ROOT);
    const currentRoot = resolve(ecommerceEnv.ECOMMERCE_PRODUCT_IMAGE_ROOT);
    if (legacyRoot === currentRoot) return null;
    let body: Buffer;
    try {
      body = await readFile(resolveMediaPath(legacyRoot, fileName));
    } catch {
      return null;
    }
    try {
      await mkdir(currentRoot, { recursive: true });
      await writeFile(resolveMediaPath(currentRoot, fileName), body, { flag: "wx" });
    } catch {
      /* Another request may have copied it, or the tenant root is read-only. Serving still works. */
    }
    return body;
  }
}

function productImageFileName(fileName: string) {
  const normalized = basename(fileName).toLowerCase();
  if (!/^[a-z0-9][a-z0-9-]*\.(?:jpe?g|png|webp)$/u.test(normalized)) {
    throw AppError.validation("Product image filename is invalid.");
  }
  return normalized;
}

function formatFor(fileName: string) {
  const format = formats[extname(fileName) as keyof typeof formats];
  if (!format) throw AppError.validation("Use a JPG, PNG, or WebP image.");
  return format;
}

function resolveMediaPath(root: string, fileName: string) {
  const path = resolve(root, fileName);
  if (!path.startsWith(`${root}${sep}`))
    throw AppError.validation("Product image path is invalid.");
  return path;
}

function isJpeg(body: Buffer) {
  return body.length >= 3 && body[0] === 0xff && body[1] === 0xd8 && body[2] === 0xff;
}
function isPng(body: Buffer) {
  return (
    body.length >= 8 && body.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  );
}
function isWebp(body: Buffer) {
  return (
    body.length >= 12 &&
    body.subarray(0, 4).toString("ascii") === "RIFF" &&
    body.subarray(8, 12).toString("ascii") === "WEBP"
  );
}
