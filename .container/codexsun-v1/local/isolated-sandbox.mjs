import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import { createReadStream, createWriteStream } from "node:fs";
import { pipeline } from "node:stream/promises";

const serverScript = [
  "set -eu",
  "chown mysql:mysql /var/lib/mysql /run/mysqld /tmp",
  "mariadb-install-db --no-defaults --user=mysql --datadir=/var/lib/mysql --skip-test-db >/tmp/init.log 2>&1",
  "exec mariadbd --no-defaults --user=mysql --datadir=/var/lib/mysql --socket=/run/mysqld/mysqld.sock --pid-file=/run/mysqld/mysqld.pid --skip-networking --skip-grant-tables --event-scheduler=OFF"
].join("; ");

export async function restoreIntoSandbox(docker, source, dumpPath, proofDir) {
  const name = `codexsun-restore-audit-${randomBytes(8).toString("hex")}`;
  const id = docker.run(sandboxCreateArguments(name, source.Image)).trim();
  assert.match(id, /^[a-f0-9]{64}$/u, "Invalid sandbox container identity.");
  const dispose = async () => {
    const recovering = docker.recovering;
    if (docker.interrupted) docker.resumeForRecovery();
    try {
      const current = docker.inspect(id);
      assertSandbox(current, source.Id, false);
      docker.run(["rm", "-f", id]);
    } finally {
      docker.recovering = recovering;
    }
  };
  const assertSafe = () => {
    const current = docker.inspect(id);
    assertSandbox(current, source.Id);
    assert.equal(current.Image, source.Image, "Sandbox image differs from source.");
    const flags = docker
      .run([
        "exec",
        id,
        "mariadb",
        "--no-defaults",
        "-uroot",
        "-N",
        "--batch",
        "-e",
        "SELECT @@GLOBAL.event_scheduler,@@GLOBAL.skip_networking"
      ])
      .trim();
    assert.match(flags, /^(?:OFF|DISABLED|0)\s+(?:ON|1)$/iu, "Sandbox isolation flags changed.");
  };
  try {
    const current = docker.inspect(id);
    assertSandbox(current, source.Id);
    await waitForSandbox(docker, id);
    assertSandbox(docker.inspect(id), source.Id);
    await importDump(docker, id, dumpPath, `${proofDir}/restore.stderr.log`);
    assertSandbox(docker.inspect(id), source.Id);
    assertSafe();
    return { id, name, dispose, assertSafe };
  } catch (error) {
    await dispose();
    throw error;
  }
}

export function sandboxCreateArguments(name, image) {
  assert.match(name, /^codexsun-restore-audit-[a-f0-9]{16}$/u);
  assert.match(image, /^sha256:[a-f0-9]{64}$/u);
  return [
    "run",
    "-d",
    "--name",
    name,
    "--network",
    "none",
    "--read-only",
    "--tmpfs",
    "/var/lib/mysql:rw,nosuid,noexec,size=2g",
    "--tmpfs",
    "/run/mysqld:rw,nosuid,noexec,size=16m",
    "--tmpfs",
    "/tmp:rw,nosuid,noexec,size=64m",
    "--entrypoint",
    "sh",
    image,
    "-c",
    serverScript
  ];
}

export function assertSandbox(container, sourceId, requireRunning = true) {
  assert.notEqual(container.Id, sourceId, "Sandbox cannot be the source database.");
  assert.equal(container.HostConfig.NetworkMode, "none", "Sandbox network must be disabled.");
  assert.equal(
    container.HostConfig.ReadonlyRootfs,
    true,
    "Sandbox root filesystem must be read-only."
  );
  assert.equal(container.HostConfig.Privileged, false, "Sandbox cannot be privileged.");
  assert.notEqual(container.HostConfig.PidMode, "host", "Sandbox cannot share host processes.");
  assert.notEqual(container.HostConfig.IpcMode, "host", "Sandbox cannot share host IPC.");
  assert.ok(
    Object.keys(container.NetworkSettings.Networks ?? {}).every((network) => network === "none"),
    "Sandbox cannot join another network."
  );
  assert.ok(
    (container.Mounts ?? []).every((mount) => mount.Type === "tmpfs"),
    "Sandbox cannot use shared volumes or bind mounts."
  );
  assert.ok(
    Object.values(container.NetworkSettings.Ports ?? {}).every((ports) => !ports?.length),
    "Sandbox cannot publish ports."
  );
  if (requireRunning) assert.equal(container.State.Running, true, "Sandbox is not running.");
}

async function waitForSandbox(docker, id) {
  for (let attempt = 0; attempt < 180; attempt += 1) {
    try {
      const result = docker.run([
        "exec",
        id,
        "mariadb",
        "--no-defaults",
        "-uroot",
        "-N",
        "-e",
        "SELECT 1"
      ]);
      if (result.trim() === "1") return;
    } catch {
      if (!docker.inspect(id).State.Running) throw new Error("Isolated MariaDB failed to start.");
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error("Isolated MariaDB startup timed out.");
}

async function importDump(docker, id, path, logPath) {
  docker.assertActive();
  const child = spawn(
    "docker",
    [
      "--context",
      docker.context,
      "exec",
      "-i",
      "--user",
      "mysql",
      id,
      "mariadb",
      "--no-defaults",
      "-uroot"
    ],
    { stdio: ["pipe", "ignore", "pipe"] }
  );
  docker.track(child);
  const stderr = createWriteStream(logPath, { flags: "wx", mode: 0o600 });
  const result = new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("close", (code) =>
      code === 0 ? resolve() : reject(new Error("Isolated restore failed."))
    );
  });
  await Promise.all([
    pipeline(createReadStream(path), child.stdin),
    pipeline(child.stderr, stderr),
    result
  ]);
}

export async function sandboxDump(docker, host, user, password, databases, path) {
  const args = [
    "exec",
    "-e",
    "MYSQL_PWD",
    host,
    "mariadb-dump",
    "--no-defaults",
    `-u${user}`,
    "--lock-all-tables",
    "--quick",
    "--skip-comments",
    "--skip-dump-date",
    "--order-by-primary",
    "--routines",
    "--events",
    "--triggers",
    "--hex-blob",
    "--databases",
    ...databases
  ];
  await docker.output(args, path, { MYSQL_PWD: password });
}
