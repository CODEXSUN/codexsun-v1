import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join, relative } from "node:path";

export function fingerprint(root, paths) {
  const hash = createHash("sha256");
  for (const path of paths) addPath(hash, root, path);
  return hash.digest("hex");
}

function addPath(hash, root, path) {
  const fullPath = join(root, path);
  hash.update(path);
  if (!existsSync(fullPath)) {
    hash.update("missing");
    return;
  }
  const entries = readdirSync(fullPath, { withFileTypes: true, recursive: true, encoding: "utf8" });
  for (const entry of entries
    .filter((item) => item.isFile())
    .sort((a, b) => join(a.parentPath, a.name).localeCompare(join(b.parentPath, b.name)))) {
    const file = join(entry.parentPath, entry.name);
    hash.update(relative(root, file));
    hash.update(readFileSync(file));
  }
}

export function frameworkBuildIsCurrent(root) {
  const cache = join(root, "dist/.cache/framework-startup.json");
  const inputs = ["packages/framework/src"];
  const outputs = ["dist/packages/framework"];
  if (!existsSync(join(root, "dist/packages/framework/index.js"))) return false;
  try {
    const record = JSON.parse(readFileSync(cache, "utf8"));
    return (
      record.inputs === frameworkInputs(root, inputs) &&
      record.outputs === fingerprint(root, outputs)
    );
  } catch {
    return false;
  }
}

export function frameworkInputs(root, inputs = ["packages/framework/src"]) {
  const hash = createHash("sha256");
  hash.update(fingerprint(root, inputs));
  for (const file of [
    "package-lock.json",
    "tsconfig.base.json",
    "packages/framework/tsconfig.json",
    "packages/framework/package.json",
    "node_modules/typescript/package.json"
  ]) {
    const path = join(root, file);
    hash.update(existsSync(path) ? readFileSync(path) : "missing");
  }
  hash.update(process.version);
  return hash.digest("hex");
}

export function recordFrameworkBuild(root, expectedInputs) {
  if (
    frameworkInputs(root) !== expectedInputs ||
    !existsSync(join(root, "dist/packages/framework/index.js"))
  )
    return;
  const cache = join(root, "dist/.cache/framework-startup.json");
  mkdirSync(dirname(cache), { recursive: true });
  writeFileSync(
    cache,
    JSON.stringify({
      inputs: expectedInputs,
      outputs: fingerprint(root, ["dist/packages/framework"])
    })
  );
}
