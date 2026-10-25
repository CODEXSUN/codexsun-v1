import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { copyFile, link, lstat, mkdir, readFile, readdir, stat } from "node:fs/promises";
import { dirname, join, posix, resolve, sep } from "node:path";
import { sourceChecksum, sourceFiles } from "./config.mjs";
import { digest, privateDirectory, privateWrite } from "./files.mjs";

export async function createSourceSnapshot(root, directory) {
  const target = await privateDirectory(join(directory, "source-1"));
  const checksum = await sourceChecksum(root);
  const files = {};
  const selection = await deploymentSources(root, sourceFiles(root));
  const cache = await previousSource(dirname(directory), directory);
  if (selection.excludedWorkspaces.length)
    console.log(
      `Draft workspaces absent from the root lockfile stay outside deployment: ${selection.excludedWorkspaces.join(", ")}`
    );
  const parents = [...new Set(selection.files.map((name) => dirname(resolve(target, name))))];
  await parallel(parents, (path) => mkdir(path, { recursive: true }));
  await parallel(selection.files, async (name) => {
    const source = resolve(root, name);
    const destination = resolve(target, name);
    assert.ok(
      source.startsWith(resolve(root) + sep) && destination.startsWith(target + sep),
      "Source path escaped its build root."
    );
    const current = await lstat(source);
    assert.ok(current.isFile(), `Build snapshot requires a regular source file: ${name}`);
    if (cache) {
      const cached = join(cache, name);
      const metadata = await stat(cached).catch(() => null);
      if (
        metadata?.isFile() &&
        metadata.size === current.size &&
        metadata.mtimeMs >= current.mtimeMs &&
        metadata.mtimeMs >= current.ctimeMs
      ) {
        await link(cached, destination).catch(() => copyFile(cached, destination));
        files[name] = await digest(destination);
        return;
      }
    }
    await copyFile(source, destination);
    files[name] = await digest(destination);
    assert.equal(await digest(source), files[name], `Source changed while copying ${name}`);
  });
  const changed = (await sourceChecksum(root)) !== checksum;
  const contentChecksum = createHash("sha256")
    .update(JSON.stringify(Object.entries(files).sort()))
    .digest("hex");
  const snapshot = {
    root: target,
    checksum: changed ? `snapshot-${contentChecksum}` : checksum,
    files,
    excludedWorkspaces: selection.excludedWorkspaces,
    workspaceChangedDuringCapture: changed
  };
  await privateWrite(join(directory, "source-1.manifest.private.json"), snapshot);
  if (changed)
    console.log(
      "Snapshot is frozen. Working-tree edits made during capture will be picked up by the next update."
    );
  return snapshot;
}

async function previousSource(base, current) {
  for (const name of (await readdir(base))
    .filter((name) => /^\d+-[a-f0-9]+$/u.test(name))
    .sort()
    .reverse()) {
    const directory = join(base, name);
    if (directory === current) continue;
    const entries = await readdir(directory);
    const source = entries
      .filter((name) => /^source-\d+$/u.test(name))
      .sort()
      .reverse()[0];
    if (source) return join(directory, source);
  }
  return null;
}

export async function deploymentSources(root, names) {
  const manifest = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
  const lock = JSON.parse(await readFile(join(root, "package-lock.json"), "utf8"));
  const patterns = Array.isArray(manifest.workspaces)
    ? manifest.workspaces
    : manifest.workspaces.packages;
  const excludedWorkspaces = names
    .filter((name) => name.endsWith("/package.json"))
    .map((name) => posix.dirname(name))
    .filter(
      (name) =>
        patterns.some((pattern) => !pattern.startsWith("!") && posix.matchesGlob(name, pattern)) &&
        !Object.hasOwn(lock.packages, name)
    );
  return {
    files: names.filter(
      (name) => !excludedWorkspaces.some((directory) => name.startsWith(directory + "/"))
    ),
    excludedWorkspaces
  };
}

export async function verifySourceSnapshot(snapshot) {
  await parallel(Object.entries(snapshot.files), async ([name, expected]) => {
    const path = resolve(snapshot.root, name);
    assert.ok(
      path.startsWith(resolve(snapshot.root) + sep),
      "Snapshot path escaped its build root."
    );
    assert.equal(await digest(path), expected, `Build snapshot changed: ${name}`);
  });
}

async function parallel(items, action) {
  let index = 0;
  const results = await Promise.allSettled(
    Array.from({ length: Math.min(24, items.length) }, async () => {
      while (index < items.length) await action(items[index++]);
    })
  );
  const failed = results.find((result) => result.status === "rejected");
  if (failed) throw failed.reason;
}
