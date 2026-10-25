import assert from "node:assert/strict";
import test from "node:test";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { resolve, join } from "node:path";
import { bumpNextVersion, bumpPatch } from "./version-bump.mjs";

test("bumps only a complete three-part numeric version", () => {
  assert.equal(bumpPatch("1.0.55"), "1.0.56");
  assert.throws(() => bumpPatch("1.0.55beta"), /Unsupported version format/u);
  assert.throws(() => bumpPatch("1.0"), /Unsupported version format/u);
  assert.throws(() => bumpPatch("1.0.5.5"), /Unsupported version format/u);
});

test("application version bump preserves infrastructure pins and requires new migration approval", () => {
  const base = resolve(import.meta.dirname, "../dist/deployment-tests");
  mkdirSync(base, { recursive: true });
  const root = mkdtempSync(join(base, "version-"));
  mkdirSync(join(root, ".container"));
  mkdirSync(join(root, "assist/documentation"), { recursive: true });
  writeFileSync(join(root, "package.json"), JSON.stringify({ version: "1.2.3", workspaces: [] }));
  writeFileSync(join(root, "assist/documentation/CHANGELOG.md"), "# Changelog\n");
  writeFileSync(
    join(root, ".container/deploy.env.sample"),
    "CODEXSUN_VERSION=1.2.3\nMARIADB_IMAGE_TAG=11.8-stable\nCODEXSUN_MIGRATION_COMPATIBLE_VERSION=1.2.3\n"
  );
  bumpNextVersion(root, "Fixture release", { databaseUpdate: false });
  const sample = readFileSync(join(root, ".container/deploy.env.sample"), "utf8");
  assert.match(sample, /CODEXSUN_VERSION=1\.2\.4/u);
  assert.match(sample, /MARIADB_IMAGE_TAG=11\.8-stable/u);
  assert.match(sample, /CODEXSUN_MIGRATION_COMPATIBLE_VERSION=1\.2\.3/u);
});
