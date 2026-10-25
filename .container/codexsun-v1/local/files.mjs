import { createHash, randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { createReadStream } from "node:fs";
import { mkdir, open, readFile, rename, rm, rmdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

export async function privateDirectory(path) {
  await mkdir(path, { recursive: true, mode: 0o700 });
  protect(path, true);
  return path;
}

export async function privateWrite(path, value) {
  const temporary = `${path}.${randomUUID()}.partial`;
  const handle = await open(temporary, "wx", 0o600);
  try {
    protect(temporary, false);
    await handle.writeFile(typeof value === "string" ? value : JSON.stringify(value, null, 2));
  } finally {
    await handle.close();
  }
  await rename(temporary, path);
}

export async function withLock(root, action) {
  const base = await privateDirectory(join(root, ".container/backups/local"));
  const lock = join(base, "operation.lock");
  try {
    await mkdir(lock);
  } catch {
    throw new Error(
      "Another local deployment holds operation.lock. Review it before removing a stale lock."
    );
  }
  try {
    await writeFile(
      join(lock, "owner.json"),
      JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() })
    );
    return await action(base);
  } finally {
    await rm(join(lock, "owner.json"), { force: true });
    await rmdir(lock);
  }
}

export async function digest(path) {
  const hash = createHash("sha256");
  for await (const bytes of createReadStream(path)) hash.update(bytes);
  return hash.digest("hex");
}

export async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

function protect(path, directory) {
  if (process.platform !== "win32") {
    // The caller creates files with 0600 before writing private content.
    execFileSync("chmod", [directory ? "700" : "600", path]);
    return;
  }
  const user = execFileSync("whoami", { encoding: "utf8" }).trim();
  const permission = directory ? "(OI)(CI)F" : "F";
  execFileSync(
    "icacls",
    [path, "/inheritance:r", "/grant:r", `${user}:${permission}`, `SYSTEM:${permission}`],
    { stdio: "ignore" }
  );
}
