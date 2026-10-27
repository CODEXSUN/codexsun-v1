import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  frameworkBuildIsCurrent,
  frameworkInputs,
  recordFrameworkBuild
} from "./framework-build-cache.mjs";
import { ensureFrameworkBuild } from "./ensure-framework-build.mjs";

test("framework startup cache fails closed when inputs or outputs change", () => {
  const root = mkdtempSync(join(tmpdir(), "codexsun-framework-"));
  try {
    mkdirSync(join(root, "packages/framework/src"), { recursive: true });
    mkdirSync(join(root, "dist/packages/framework"), { recursive: true });
    writeFileSync(join(root, "packages/framework/src/index.ts"), "source");
    writeFileSync(join(root, "dist/packages/framework/index.js"), "output");
    assert.equal(frameworkBuildIsCurrent(root), false);
    recordFrameworkBuild(root, frameworkInputs(root));
    assert.equal(frameworkBuildIsCurrent(root), true);
    writeFileSync(join(root, "dist/packages/framework/index.js"), "changed");
    assert.equal(frameworkBuildIsCurrent(root), false);
    recordFrameworkBuild(root, frameworkInputs(root));
    writeFileSync(join(root, "packages/framework/src/index.ts"), "changed");
    assert.equal(frameworkBuildIsCurrent(root), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("test prerequisite builds once, then rebuilds after a source change", () => {
  const root = mkdtempSync(join(tmpdir(), "codexsun-framework-"));
  try {
    mkdirSync(join(root, "packages/framework/src"), { recursive: true });
    mkdirSync(join(root, "dist/packages/framework"), { recursive: true });
    const source = join(root, "packages/framework/src/index.ts");
    writeFileSync(source, "first");
    let builds = 0;
    const build = () => {
      builds++;
      writeFileSync(join(root, "dist/packages/framework/index.js"), `build ${builds}`);
    };
    assert.equal(ensureFrameworkBuild(root, build), "built");
    assert.equal(ensureFrameworkBuild(root, build), "cached");
    writeFileSync(source, "second");
    assert.equal(ensureFrameworkBuild(root, build), "built");
    assert.equal(builds, 2);
    writeFileSync(source, "third");
    assert.throws(() => ensureFrameworkBuild(root, () => {
      writeFileSync(source, "changed while building");
    }), /inputs or output changed/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
