import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import test from "node:test";
import {
  applications,
  buildModel,
  inspectDeployment,
  project
} from "../.container/codexsun-v1/local/config.mjs";
import { LocalDocker } from "../.container/codexsun-v1/local/docker.mjs";
import { recover, release } from "../.container/codexsun-v1/local/release.mjs";
import { verifyBackup } from "../.container/codexsun-v1/local/backup.mjs";
import { withLock } from "../.container/codexsun-v1/local/files.mjs";

const root = resolve(import.meta.dirname, "..");

test("local preflight accepts retained infrastructure and refuses unsafe changes", () => {
  const { docker, config } = fixture();
  assert.equal(inspectDeployment(docker, config, "deploy").containers.length, 0);
  config.database.id = "different";
  assert.throws(() => inspectDeployment(docker, config, "deploy"), /MariaDB identity/u);
  config.database.id = "database-original";
  config.model.services["codexsun-api"].environment.CODEXSUN_ALLOW_LIVE_RESTORE = "1";
  assert.throws(() => inspectDeployment(docker, config, "deploy"), /must be 0/u);
  config.model.services["codexsun-api"].environment.CODEXSUN_ALLOW_LIVE_RESTORE = "0";
  config.model.services["codexsun-web"].ports[0].host_ip = "0.0.0.0";
  assert.throws(() => inspectDeployment(docker, config, "deploy"), /loopback/u);
});

test("app deployment cannot mount MariaDB storage or include a database service", () => {
  const { docker, config } = fixture();
  config.model.services["codexsun-api"].volumes.push({
    type: "volume",
    source: "database-data",
    target: "/storage"
  });
  assert.throws(() => inspectDeployment(docker, config, "deploy"), /MariaDB storage/u);
  config.model.services["database"] = {};
  assert.throws(() => inspectDeployment(docker, config, "deploy"), /five app containers/u);
});

test("Docker Desktop guard refuses a remote SSH endpoint", () => {
  const docker = new LocalDocker();
  docker.json = () => [{ Endpoints: { docker: { Host: "ssh://production" } } }];
  assert.throws(() => docker.checkTarget(), /local Docker socket/u);
});

test("local image builds use unique tags and the existing versioned Dockerfile", async () => {
  const { config } = fixture();
  const model = await buildModel(root, config.model, "proof-123");
  for (const name of applications) {
    assert.match(model.services[name].image, /:local-\d+\.\d+\.\d+-proof-123$/u);
    assert.equal(model.services[name].build.dockerfile, ".container/codexsun-v1/Dockerfile");
    assert.equal(model.services[name].build.context, root.replaceAll("\\", "/"));
  }
  assert.equal(config.model.services["codexsun-api"].build, undefined);
});

test("failed SQL backup blocks build and container replacement", async () => {
  const { docker, config, calls } = fixture();
  docker.output = async () => {
    throw new Error("SQL backup failed");
  };
  const directory = await temporary();
  await assert.rejects(
    () => release(docker, root, config, "deploy", directory),
    /SQL backup failed/u
  );
  assert.equal(
    calls.some((args) => args.includes("build") || args.includes("up") || args[0] === "kill"),
    false
  );
});

test("application rollback uses only the captured five-app compose model", async () => {
  const directory = await temporary();
  const backup = join(directory, "final");
  await mkdir(backup);
  await manifest(backup);
  const { docker, config, calls } = fixture();
  await recover(docker, config, "update", true, config.model, backup, [], directory);
  const replacement = calls.find((args) => args.includes("up"));
  assert.ok(replacement.includes(join(backup, "previous.private.json")));
  assert.deepEqual(replacement.slice(-applications.length), applications);
  assert.ok(!replacement.includes("--remove-orphans"));
  assert.equal(
    calls.some(
      (args) => args[0] === "rm" || args.includes("cxapp-mariadb") || args.includes("cxapp-redis")
    ),
    false
  );
});

test("a corrupt backup prevents rollback commands", async () => {
  const directory = await temporary();
  await manifest(directory);
  await writeFile(join(directory, "previous.private.json"), "corrupted");
  await assert.rejects(() => verifyBackup(directory), /checksum failed/u);
  const { docker, config, calls } = fixture();
  await assert.rejects(
    () => recover(docker, config, "update", true, config.model, directory, [], directory),
    /recovery needs attention/u
  );
  assert.equal(calls.length, 0);
});

test("failed fresh deployment removes only its five app containers and keeps volumes", async () => {
  const directory = await temporary();
  const { docker, config, calls, registry } = fixture();
  for (const name of applications)
    registry[name] = {
      Image: config.model.services[name].image,
      Config: { Labels: { "com.docker.compose.project": project } }
    };
  await recover(docker, config, "deploy", true, config.model, "unused", [], directory);
  assert.deepEqual(
    calls.filter((args) => args[0] === "rm"),
    applications.map((name) => ["rm", name])
  );
  assert.ok(
    !calls.some(
      (args) =>
        args.includes("-v") ||
        args.includes("prune") ||
        args.includes("cxapp-mariadb") ||
        args.includes("cxapp-redis")
    )
  );
});

test("backup failure resumes every stopped app even when one restart fails", async () => {
  const directory = await temporary();
  const { docker, config, calls } = fixture();
  docker.run = (args) => {
    calls.push(args);
    if (args[1] === applications[0]) throw new Error("restart failed");
  };
  await assert.rejects(
    () => recover(docker, config, "update", false, config.model, "unused", applications, directory),
    /recovery needs attention/u
  );
  assert.deepEqual(
    calls,
    applications.map((name) => ["start", name])
  );
});

test("atomic local lock blocks a second operation and releases after failure", async () => {
  const directory = await temporary();
  await assert.rejects(
    () =>
      withLock(directory, async () => {
        await assert.rejects(() => withLock(directory, async () => {}), /holds operation.lock/u);
        throw new Error("operation failed");
      }),
    /operation failed/u
  );
  await withLock(directory, async () => {});
});

test("cancellation stops only tracked CLI children and permits application recovery", () => {
  const docker = new LocalDocker();
  const signals = [];
  docker.children.add({ kill: (signal) => signals.push(signal) });
  docker.interrupt();
  assert.deepEqual(signals, ["SIGTERM"]);
  assert.throws(() => docker.assertActive(), /interrupted/u);
  docker.resumeForRecovery();
  assert.doesNotThrow(() => docker.assertActive());
  docker.interrupt();
  assert.deepEqual(signals, ["SIGTERM"]);
});

function fixture() {
  const registry = {
    "cxapp-mariadb": {
      Id: "database-original",
      Name: "/cxapp-mariadb",
      State: { Health: { Status: "healthy" } },
      Mounts: [{ Destination: "/var/lib/mysql", Name: "database-data" }],
      NetworkSettings: { Networks: { isolated: {} } }
    },
    "cxapp-redis": {
      Id: "redis-original",
      Name: "/cxapp-redis",
      State: { Health: { Status: "healthy" } }
    }
  };
  const services = Object.fromEntries(
    applications.map((name) => [
      name,
      {
        image: `sha256:${name}`,
        container_name: name,
        environment: {},
        volumes: [],
        networks: { isolated: {} },
        ports: []
      }
    ])
  );
  services["codexsun-api"].environment = {
    DB_DRIVER: "mariadb",
    DB_HOST: "cxapp-mariadb",
    DB_PORT: "3306",
    DB_USER: "root",
    DB_PASSWORD: "literal$$password",
    NODE_ENV: "production",
    PLATFORM_API_PORT: "18010",
    CODEXSUN_DB_FRESH_ON_START: "0",
    CODEXSUN_ALLOW_PRODUCTION_DB_RESET: "0",
    CODEXSUN_ALLOW_LIVE_RESTORE: "0",
    ENABLE_DEFAULT_TENANT_SEED: "0"
  };
  services["codexsun-worker"].environment.CODEXSUN_REDIS_URL = "redis://cxapp-redis:6379";
  for (const name of ["codexsun-web", "codexsun-shop"])
    services[name].ports = [{ host_ip: "127.0.0.1", target: 80, published: "18020" }];
  const calls = [];
  const docker = {
    context: "desktop-linux",
    exists: (name) => Boolean(registry[name]),
    inspect: (name) => registry[name],
    json: () => [{ Internal: true }],
    run: (args) => {
      calls.push(args);
    },
    logged: async (args) => {
      calls.push(args);
    },
    stop: async (name) => {
      calls.push(["graceful-stop", name]);
    }
  };
  const config = {
    schemaVersion: 1,
    context: "desktop-linux",
    project,
    database: { name: "cxapp-mariadb", id: "database-original" },
    redis: { name: "cxapp-redis", id: "redis-original" },
    model: { name: project, services }
  };
  return { docker, config, calls, registry };
}

async function temporary() {
  const base = join(root, "dist/deployment-local-tests");
  await mkdir(base, { recursive: true });
  return mkdtemp(join(base, "run-"));
}

async function manifest(directory) {
  const bytes = JSON.stringify({
    services: Object.fromEntries(applications.map((name) => [name, { image: "sha256:previous" }]))
  });
  const files = {
    "previous.private.json": bytes,
    "databases.sql": "-- Dump completed",
    "redis.rdb": "REDIS0001",
    "containers.private.json": "[]"
  };
  const hashes = {};
  for (const [name, content] of Object.entries(files)) {
    await writeFile(join(directory, name), content);
    hashes[name] = createHash("sha256").update(content).digest("hex");
  }
  await writeFile(join(directory, "sha256.json"), JSON.stringify(hashes));
}
