import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { applications, buildModel } from "./config.mjs";

test("deployment and workflows use the pinned npm version", async () => {
  const root = process.cwd();
  const manifest = JSON.parse(await readFile("package.json", "utf8"));
  const version = manifest.packageManager.match(/^npm@(\d+\.\d+\.\d+)$/u)?.[1];
  assert.ok(version);
  assert.equal(manifest.engines.npm, `>=${version}`);
  const services = Object.fromEntries(applications.map((name) => [name, { environment: {} }]));
  services["codexsun-api"].environment.PLATFORM_API_PORT = "18010";
  const model = await buildModel(root, { services }, "test");
  for (const service of Object.values(model.services)) {
    assert.equal(service.build.args.NPM_RUNTIME_VERSION, version);
  }
  for (const name of ["ci", "windows-release", "addon-package-monitor"]) {
    const workflow = await readFile(`.github/workflows/${name}.yml`, "utf8");
    assert.match(
      workflow,
      new RegExp(`npm install --global npm@${version.replaceAll(".", "\\.")}`)
    );
  }
});
