import assert from "node:assert/strict";
import { createReadStream } from "node:fs";
import { copyFile, open, readdir } from "node:fs/promises";
import { basename, join } from "node:path";
import { createGunzip } from "node:zlib";
import { digest, privateDirectory, privateWrite, readJson } from "./files.mjs";
import { literal } from "./config.mjs";

export async function backup(docker, state, directory) {
  await privateDirectory(directory);
  await privateWrite(join(directory, "previous.private.json"), state.model);
  await privateWrite(join(directory, "containers.private.json"), [
    ...state.containers,
    state.database,
    state.redis
  ]);
  const environment = state.model.services["codexsun-api"].environment;
  const sql = join(directory, "databases.sql");
  await docker.output(
    [
      "exec",
      "-e",
      "MYSQL_PWD",
      state.database.Name.slice(1),
      "mariadb-dump",
      "--no-defaults",
      `-u${literal(environment.DB_USER)}`,
      "--all-databases",
      "--single-transaction",
      "--quick",
      "--routines",
      "--events",
      "--triggers",
      "--hex-blob"
    ],
    sql,
    { MYSQL_PWD: literal(environment.DB_PASSWORD) }
  );
  const handle = await open(sql, "r");
  try {
    const { size } = await handle.stat();
    const tail = Buffer.alloc(Math.min(size, 1024));
    await handle.read(tail, 0, tail.length, size - tail.length);
    assert.match(tail.toString(), /-- Dump completed/u, "SQL backup is incomplete.");
  } finally {
    await handle.close();
  }
  await backupRedis(docker, state.redis.Name.slice(1), directory);
  const volumes = new Set();
  let binding = 0;
  for (const service of Object.values(state.model.services)) {
    for (const mount of service.volumes ?? []) {
      if (mount.type === "volume") volumes.add(mount.source);
      else await copyFile(literal(mount.source), join(directory, `bind-${binding++}.private`));
    }
  }
  for (const volume of volumes) {
    const file = join(directory, `${volume}.tar.gz`);
    await docker.output(
      [
        "run",
        "--rm",
        "--network",
        "none",
        "--user",
        "0:0",
        "--entrypoint",
        "tar",
        "--mount",
        `type=volume,source=${volume},target=/source,readonly`,
        state.database.Image,
        "-C",
        "/source",
        "-czf",
        "-",
        "."
      ],
      file
    );
    for await (const _chunk of createReadStream(file).pipe(createGunzip())) {
      /* Validate the complete archive. */
    }
  }
  const checksums = {};
  for (const name of await readdir(directory))
    checksums[name] = await digest(join(directory, name));
  await privateWrite(join(directory, "sha256.json"), checksums);
  await verifyBackup(directory);
}

export async function backupRedis(docker, container, directory) {
  const redisScript =
    'export REDISCLI_AUTH="$REDIS_PASSWORD"; file="$(mktemp /tmp/codexsun-local-XXXXXX)"; trap \'rm -f "$file"\' EXIT; redis-cli --rdb "$file" >/dev/null; cat "$file"';
  const redisFile = join(directory, "redis.rdb");
  await docker.output(["exec", container, "sh", "-ec", redisScript], redisFile);
  const redis = await open(redisFile, "r");
  try {
    const header = Buffer.alloc(5);
    await redis.read(header, 0, 5, 0);
    assert.equal(header.toString(), "REDIS", "Redis snapshot is incomplete.");
  } finally {
    await redis.close();
  }
}

export async function verifyBackup(directory) {
  const checksums = await readJson(join(directory, "sha256.json"));
  for (const name of [
    "databases.sql",
    "redis.rdb",
    "previous.private.json",
    "containers.private.json"
  ]) {
    assert.ok(Object.hasOwn(checksums, name), `Backup manifest is missing ${name}.`);
  }
  assert.deepEqual(
    (await readdir(directory)).filter((name) => name !== "sha256.json").sort(),
    Object.keys(checksums).sort(),
    "Backup file inventory changed."
  );
  for (const [name, expected] of Object.entries(checksums)) {
    assert.equal(basename(name), name, "Backup manifest contains an invalid path.");
    assert.equal(await digest(join(directory, name)), expected, `Backup checksum failed: ${name}`);
  }
}
