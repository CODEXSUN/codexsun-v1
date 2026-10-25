import assert from "node:assert/strict";
import { copyFile, lstat, mkdir } from "node:fs/promises";
import { dirname, join, resolve, sep } from "node:path";
import { sourceChecksum, sourceFiles } from "./config.mjs";
import { digest, privateDirectory, privateWrite } from "./files.mjs";

export async function createSourceSnapshot(root, directory) {
  let failure;
  for (let attempt = 1; attempt <= 3; attempt++) {
    const target = await privateDirectory(join(directory, `source-${attempt}`));
    try {
      const checksum = await sourceChecksum(root);
      const files = {};
      await parallel(sourceFiles(root), async (name) => {
        const source = resolve(root, name);
        const destination = resolve(target, name);
        assert.ok(
          source.startsWith(resolve(root) + sep) && destination.startsWith(target + sep),
          "Source path escaped its build root."
        );
        assert.ok(
          (await lstat(source)).isFile(),
          `Build snapshot requires a regular source file: ${name}`
        );
        await mkdir(dirname(destination), { recursive: true });
        await copyFile(source, destination);
        files[name] = await digest(destination);
        assert.equal(await digest(source), files[name], `Source changed while copying ${name}`);
      });
      assert.equal(
        await sourceChecksum(root),
        checksum,
        "Source changed while capturing the snapshot."
      );
      const snapshot = { root: target, checksum, files };
      await privateWrite(join(directory, `source-${attempt}.manifest.private.json`), snapshot);
      return snapshot;
    } catch (error) {
      failure = error;
    }
  }
  throw new Error(`Cannot capture a stable source snapshot: ${failure.message}`);
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
