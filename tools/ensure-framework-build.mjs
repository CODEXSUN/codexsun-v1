#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { frameworkBuildIsCurrent, frameworkInputs, recordFrameworkBuild } from "./framework-build-cache.mjs";

export function ensureFrameworkBuild(root, build = buildFramework) {
  if (frameworkBuildIsCurrent(root)) return "cached";
  const inputs = frameworkInputs(root);
  build(root);
  recordFrameworkBuild(root, inputs);
  if (!frameworkBuildIsCurrent(root)) {
    throw new Error("Framework inputs or output changed during the build. Retry the check.");
  }
  return "built";
}

function buildFramework(root) {
  const npm = process.env.npm_execpath;
  if (!npm) throw new Error("Run this helper through npm so the configured npm CLI is available.");
  const result = spawnSync(process.execPath, [npm, "run", "build", "-w", "@codexsun/framework"], {
    cwd: root,
    env: process.env,
    stdio: "inherit"
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error("Framework build failed.");
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const result = ensureFrameworkBuild(resolve(import.meta.dirname, ".."));
  console.log(`Framework build ${result === "cached" ? "is current" : "completed"}.`);
}
