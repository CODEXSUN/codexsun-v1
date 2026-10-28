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
  const backupEnvironment = { ...process.env, MYSQL_PWD: literal(environment.DB_PASSWORD) };
  const databases = docker
    .run(
      [
        "exec",
        "-i",
        "-e",
        "MYSQL_PWD",
        state.database.Name.slice(1),
        "mariadb",
        "--no-defaults",
        `-u${literal(environment.DB_USER)}`,
        "-N",
        "--batch"
      ],
      {
        input:
          "SELECT SCHEMA_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME NOT IN ('information_schema','performance_schema','sys','mysql') AND SCHEMA_NAME NOT REGEXP '^codexsun_cxtest_[0-9a-f]+$' ORDER BY SCHEMA_NAME",
        env: backupEnvironment
      }
    )
    .trim()
    .split(/\r?\n/u)
    .filter(Boolean);
  assert.ok(
    databases.length && databases.every((name) => /^[a-zA-Z0-9_]+$/u.test(name)),
    "Review database names before backup."
  );
  assert.ok(
    databases.includes(literal(environment.DB_MASTER_NAME)),
    "The master database is missing from the backup target list."
  );
  const unsupported = docker
    .run(
      [
        "exec",
        "-i",
        "-e",
        "MYSQL_PWD",
        state.database.Name.slice(1),
        "mariadb",
        "--no-defaults",
        `-u${literal(environment.DB_USER)}`,
        "-N",
        "--batch"
      ],
      {
        input:
          "SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA NOT IN ('information_schema','performance_schema','sys','mysql') AND TABLE_TYPE = 'BASE TABLE' AND COALESCE(ENGINE, '') NOT IN ('InnoDB', 'MyISAM')",
        env: backupEnvironment
      }
    )
    .trim();
  assert.equal(unsupported, "0", "The backup supports only InnoDB and MyISAM application tables.");
  await privateWrite(join(directory, "databases.private.json"), databases);
  await docker.output(
    dumpArguments(state.database.Name.slice(1), literal(environment.DB_USER), databases),
    sql,
    { MYSQL_PWD: literal(environment.DB_PASSWORD) }
  );
  await docker.output(
    dumpArguments(state.database.Name.slice(1), literal(environment.DB_USER), ["mysql"]),
    join(directory, "mysql-system.sql"),
    { MYSQL_PWD: literal(environment.DB_PASSWORD) }
  );
  await assertDumpComplete(sql);
  await assertDumpComplete(join(directory, "mysql-system.sql"));
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

async function assertDumpComplete(path) {
  const handle = await open(path, "r");
  try {
    const { size } = await handle.stat();
    const tail = Buffer.alloc(Math.min(size, 1024));
    await handle.read(tail, 0, tail.length, size - tail.length);
    assert.match(tail.toString(), /-- Dump completed/u, "SQL backup is incomplete.");
  } finally {
    await handle.close();
  }
}

export function dumpArguments(container, user, databases) {
  return [
    "exec",
    "-e",
    "MYSQL_PWD",
    container,
    "mariadb-dump",
    "--no-defaults",
    `-u${user}`,
    "--lock-all-tables",
    "--quick",
    "--routines",
    "--events",
    "--triggers",
    "--hex-blob",
    "--databases",
    ...databases
  ];
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
    "databases.private.json",
    "redis.rdb",
    "previous.private.json",
    "containers.private.json"
  ]) {
    assert.ok(Object.hasOwn(checksums, name), `Backup manifest is missing ${name}.`);
  }
  const databases = await readJson(join(directory, "databases.private.json"));
  assert.ok(Array.isArray(databases), "Invalid backup database inventory.");
  if (!databases.includes("mysql")) {
    assert.ok(Object.hasOwn(checksums, "mysql-system.sql"), "Backup manifest is missing mysql-system.sql.");
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
