import assert from "node:assert/strict";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import test from "node:test";
import { applications, buildModel } from "./config.mjs";
import { currentRelease } from "./current-release.mjs";
import { deploymentSources } from "./source-snapshot.mjs";

test("deployment preserves locked workspace sources and excludes an unregistered draft", async () => {
  const root = await temporary();
  await writeFile(
    join(root, "package.json"),
    JSON.stringify({ workspaces: ["apps/*/*", "devkits/*/*"] })
  );
  await writeFile(
    join(root, "package-lock.json"),
    JSON.stringify({ packages: { "apps/live/api": {} } })
  );
  const selected = await deploymentSources(root, [
    "package.json",
    "apps/live/api/package.json",
    "apps/live/api/src/new-feature.ts",
    "devkits/draft/api/package.json",
    "devkits/draft/api/src/index.ts"
  ]);
  assert.deepEqual(selected.files, [
    "package.json",
    "apps/live/api/package.json",
    "apps/live/api/src/new-feature.ts"
  ]);
  assert.deepEqual(selected.excludedWorkspaces, ["devkits/draft/api"]);
});

test("fast update requires a successful matching checksum and every exact running image", async () => {
  const root = await temporary();
  const directory = join(root, "123-abc");
  await mkdir(directory);
  const model = {
    services: Object.fromEntries(applications.map((name) => [name, { image: `sha256:${name}` }]))
  };
  await writeFile(
    join(directory, "result.json"),
    JSON.stringify({ success: true, sourceChecksum: "current" })
  );
  await writeFile(join(directory, "candidate.private.json"), JSON.stringify(model));
  assert.equal(await currentRelease(root, model, "current"), directory);
  assert.equal(await currentRelease(root, model, "changed-source"), null);
  model.services["codexsun-api"].image = "sha256:different";
  assert.equal(await currentRelease(root, model, "current"), null);
});

test("local candidate updates the API runtime version with the built source", async () => {
  const root = await temporary();
  await writeFile(
    join(root, "package.json"),
    JSON.stringify({ version: "1.1.76", engines: { node: ">=26.5.0", npm: ">=12.2.0" } })
  );
  const model = {
    services: Object.fromEntries(
      applications.map((name) => [name, { environment: { PLATFORM_API_PORT: "18010" } }])
    )
  };
  model.services["codexsun-api"].environment.CODEXSUN_VERSION = "1.1.59";
  const candidate = await buildModel(root, model, "test");
  assert.equal(candidate.services["codexsun-api"].environment.CODEXSUN_VERSION, "1.1.76");
  assert.equal(model.services["codexsun-api"].environment.CODEXSUN_VERSION, "1.1.59");
});

async function temporary() {
  const base = resolve(import.meta.dirname, "../../../dist/deployment-local-optimization-tests");
  await mkdir(base, { recursive: true });
  return mkdtemp(join(base, "case-"));
}


test("environment drift reports only changed names, never values", async () => {
  const { environmentChanges } = await import("./config.mjs");
  assert.deepEqual(
    environmentChanges({ SECRET: "new-secret", ADDED: "value" }, { SECRET: "old-secret", REMOVED: "value" }),
    ["ADDED", "REMOVED", "SECRET"]
  );
});
