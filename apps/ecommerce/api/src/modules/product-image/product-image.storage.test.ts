import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import { isAppError } from "@codexsun/framework/errors";
import { runWithEcommerceRequestScope } from "../../database/ecommerce-database.js";
import { ProductImageStorage } from "./product-image.storage.js";
import { StorefrontSliderStorage } from "../storefront-slider/storefront-slider.storage.js";

const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9ZQmcAAAAASUVORK5CYII=",
  "base64"
);
const webp = Buffer.from("UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEADsD+JaQAA3AAAAAA", "base64");

test("EC-R09 copies a legacy product image into the verified tenant root once", async () => {
  const fixture = await fixtureRoots();
  try {
    const legacy = resolve(fixture.legacy, "ecommerce", "tenant-a", "products");
    await mkdir(legacy, { recursive: true });
    await writeFile(resolve(legacy, "legacy.png"), png);
    process.env.STORAGE_ROOT = fixture.legacy;

    const storage = new ProductImageStorage();
    const first = await runWithEcommerceRequestScope(
      {} as never,
      "tenant-a",
      () => storage.content("legacy.png"),
      undefined,
      false,
      fixture.tenantA
    );
    assert.deepEqual(first.body, png);
    assert.equal(first.mime, "image/png");
    const migrated = resolve(fixture.tenantA, "ecommerce", "products", "legacy.png");
    assert.equal(existsSync(migrated), true, "Legacy bytes were not copied.");
    assert.deepEqual(await readFile(migrated), png, "The migrated bytes changed.");

    await rm(resolve(fixture.legacy, "ecommerce"), { force: true, recursive: true });
    const second = await runWithEcommerceRequestScope(
      {} as never,
      "tenant-a",
      () => storage.content("legacy.png"),
      undefined,
      false,
      fixture.tenantA
    );
    assert.deepEqual(
      second.body,
      png,
      "The migrated file did not survive removing the legacy root."
    );

    await assert.rejects(
      runWithEcommerceRequestScope(
        {} as never,
        "tenant-b",
        () => storage.content("legacy.png"),
        undefined,
        false,
        fixture.tenantB
      ),
      (error: unknown) => isAppError(error) && error.statusCode === 404
    );
  } finally {
    await cleanup(fixture.root);
  }
});

test("EC-R09 copies a legacy slider image into the verified tenant root once", async () => {
  const fixture = await fixtureRoots();
  try {
    const legacy = resolve(fixture.legacy, "ecommerce", "tenant-a", "sliders");
    await mkdir(legacy, { recursive: true });
    await writeFile(resolve(legacy, "legacy.webp"), webp);
    process.env.STORAGE_ROOT = fixture.legacy;

    const storage = new StorefrontSliderStorage();
    const first = await runWithEcommerceRequestScope(
      {} as never,
      "tenant-a",
      () => storage.content("legacy.webp"),
      undefined,
      false,
      fixture.tenantA
    );
    assert.deepEqual(first, webp);
    const migrated = resolve(fixture.tenantA, "ecommerce", "sliders", "legacy.webp");
    assert.deepEqual(await readFile(migrated), webp);

    await rm(resolve(fixture.legacy, "ecommerce"), { force: true, recursive: true });
    const second = await runWithEcommerceRequestScope(
      {} as never,
      "tenant-a",
      () => storage.content("legacy.webp"),
      undefined,
      false,
      fixture.tenantA
    );
    assert.deepEqual(second, webp);
  } finally {
    await cleanup(fixture.root);
  }
});

async function fixtureRoots() {
  const root = await mkdtemp(resolve("dist/ecommerce-scratch/media-root-"));
  return {
    legacy: resolve(root, "legacy"),
    root,
    tenantA: resolve(root, "storage", "tenant-a", "public"),
    tenantB: resolve(root, "storage", "tenant-b", "public")
  };
}

async function cleanup(root: string) {
  assert.ok(
    root.startsWith(resolve("dist/ecommerce-scratch")),
    "Refusing to clean an unknown root."
  );
  await rm(root, { force: true, recursive: true });
}
