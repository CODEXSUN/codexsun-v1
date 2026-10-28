import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { digest } from "./files.mjs";
import { inspectRelay } from "./database-relay.mjs";

export const applications = [
  "codexsun-api",
  "codexsun-web",
  "codexsun-shop",
  "codexsun-worker",
  "codexsun-chatb"
];
export const project = "codexsun-local-cloud";
export const configurationName = ".container/local-deploy.private.json";

export function capture(docker, root, existing = {}) {
  const containers = applications.map((name) => docker.inspect(name));
  const databaseName = existing.database?.name ?? "cxapp-mariadb";
  const redisName = existing.redis?.name ?? "cxapp-redis";
  const database = docker.inspect(databaseName);
  const redis = docker.inspect(redisName);
  const model = snapshot(containers, root);
  const result = {
    schemaVersion: 1,
    context: docker.context,
    project,
    model,
    database: { name: databaseName, id: database.Id },
    redis: { name: redisName, id: redis.Id }
  };
  if (existing.relay) result.relay = inspectRelay(docker, existing.relay, database);
  return result;
}

export function inspectDeployment(docker, config, mode) {
  assert.equal(config.schemaVersion, 1);
  assert.equal(config.context, "desktop-linux");
  assert.equal(config.project, project);
  assert.deepEqual(
    Object.keys(config.model.services).sort(),
    [...applications].sort(),
    "Only the five app containers may be managed."
  );
  const database = docker.inspect(config.database.name);
  const redis = docker.inspect(config.redis.name);
  assert.equal(
    database.Id,
    config.database.id,
    "MariaDB identity changed. Review the private configuration."
  );
  assert.equal(
    redis.Id,
    config.redis.id,
    "Redis identity changed. Review the private configuration."
  );
  for (const service of [database, redis])
    assert.equal(service.State.Health?.Status, "healthy", `${service.Name} must be healthy.`);
  assert.ok(
    database.Mounts.some((mount) => mount.Destination === "/var/lib/mysql"),
    "The configured database must be MariaDB."
  );
  const existing = applications.filter((name) => docker.exists(name));
  assert.equal(
    existing.length,
    mode === "deploy" ? 0 : applications.length,
    mode === "deploy"
      ? "App containers already exist. Use update-local.sh."
      : "Missing app containers. Use deploy-local.sh only after reviewing the retained configuration."
  );
  const containers = existing.map((name) => docker.inspect(name));
  for (const item of containers) {
    assert.equal(
      item.Config.Labels?.["com.docker.compose.project"],
      project,
      `${item.Name} belongs to another project.`
    );
    assert.equal(
      item.State.Health?.Status,
      "healthy",
      `${item.Name} must be healthy before update.`
    );
  }
  const model = structuredClone(config.model);
  validateModel(docker, model, database, redis);
  validateProxyTemplates(model, process.cwd());
  for (const item of containers) {
    const actual = snapshot([item], process.cwd()).services[item.Name.slice(1)];
    const expected = model.services[item.Name.slice(1)];
    const changedEnvironment = environmentChanges(actual.environment, expected.environment);
    assert.deepEqual(
      changedEnvironment,
      [],
      `${item.Name} environment changed (${changedEnvironment.join(", ")}). Review the local configuration before update.`
    );
    for (const key of ["volumes", "networks", "ports"]) {
      assert.deepEqual(
        actual[key],
        expected[key],
        `${item.Name} ${key} changed. Review the local configuration before update.`
      );
    }
    expected.image = item.Image;
  }
  const relay = config.relay ? inspectRelay(docker, config.relay, database) : null;
  return { model, containers, database, redis, relay };
}

export function validateProxyTemplates(model, root) {
  for (const name of ["web", "shop"]) {
    const mounts = model.services[`codexsun-${name}`].volumes ?? [];
    const template = mounts.find((mount) => mount.target === "/etc/nginx/templates/default.conf.template");
    if (!template) continue;
    assert.equal(template.type, "bind", `Unexpected ${name} proxy template mount.`);
    const actual = readFileSync(literal(template.source), "utf8").replaceAll("\r\n", "\n");
    const expected = readFileSync(join(root, `.container/codexsun-v1/nginx-${name}.conf`), "utf8").replaceAll("\r\n", "\n");
    assert.equal(actual, expected, `Local ${name} proxy template differs from the repository. Review and update the retained bind file before deployment.`);
  }
}

export function environmentChanges(actual, expected) {
  return [...new Set([...Object.keys(actual), ...Object.keys(expected)])]
    .filter((key) => actual[key] !== expected[key])
    .sort();
}

export function snapshot(containers, root) {
  const python = process.platform === "win32" ? "python" : "python3";
  const model = JSON.parse(
    execFileSync(python, ["-B", join(root, ".container/codexsun-v1/lib/config.py"), "snapshot"], {
      input: JSON.stringify(containers),
      encoding: "utf8",
      maxBuffer: 32 * 1024 * 1024
    })
  );
  model.name = project;
  for (const service of Object.values(model.services)) {
    for (const mount of service.volumes ?? []) {
      if (mount.type !== "bind") continue;
      mount.source = mount.source.replace(
        /^\/(?:run\/desktop\/mnt\/host|host_mnt)\/([a-z])\//iu,
        (_match, drive) => `${drive.toUpperCase()}:/`
      );
      assert.ok(
        existsSync(literal(mount.source)) && statSync(literal(mount.source)).isFile(),
        "Local bind mounts must be existing files."
      );
    }
  }
  return model;
}

export async function buildModel(root, model, stamp) {
  const manifest = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
  const version = manifest.version;
  assert.match(version, /^\d+\.\d+\.\d+$/u);
  const engine = (name) => {
    const value = manifest.engines[name].replace(/^>=/u, "");
    assert.match(value, /^\d+\.\d+\.\d+$/u);
    return value;
  };
  const candidate = structuredClone(model);
  candidate.services["codexsun-api"].environment.CODEXSUN_VERSION = version;
  for (const name of applications) {
    const target = name.replace("codexsun-", "");
    candidate.services[name].image = `codexsun/${target}:local-${version}-${stamp}`;
    candidate.services[name].build = {
      context: root.replaceAll("\\", "/"),
      dockerfile: ".container/codexsun-v1/Dockerfile",
      target,
      args: {
        NODE_RUNTIME_VERSION: engine("node"),
        NPM_RUNTIME_VERSION: engine("npm"),
        CODEXSUN_VERSION: version,
        CODEXSUN_REVISION: `local-${stamp}`,
        PLATFORM_API_PORT: literal(model.services["codexsun-api"].environment.PLATFORM_API_PORT)
      }
    };
  }
  return candidate;
}

export const buildSourcePaths = [
  "apps",
  "packages",
  "devkits",
  "tools",
  ".container/codexsun-v1/Dockerfile",
  ".container/codexsun-v1/nginx-web.conf",
  ".container/codexsun-v1/nginx-shop.conf",
  ".container/codexsun-v1/api-entrypoint.sh",
  "package.json",
  "package-lock.json",
  ".npmrc",
  ".dockerignore",
  "tsconfig.json",
  "tsconfig.base.json",
  "turbo.json"
];

export function sourceFiles(root) {
  return [
    ...new Set(
      execFileSync(
        "git",
        ["ls-files", "--cached", "--others", "--exclude-standard", "-z", "--", ...buildSourcePaths],
        {
          cwd: root,
          encoding: "utf8",
          maxBuffer: 128 * 1024 * 1024,
          stdio: ["ignore", "pipe", "pipe"]
        }
      )
        .split("\0")
        .filter((name) => name && existsSync(join(root, name)))
    )
  ].sort();
}

export async function sourceChecksum(root) {
  const paths = buildSourcePaths;
  const options = {
    cwd: root,
    maxBuffer: 128 * 1024 * 1024,
    stdio: ["ignore", "pipe", "pipe"]
  };
  const hash = createHash("sha256");
  hash.update(execFileSync("git", ["rev-parse", "HEAD"], options));
  hash.update(
    execFileSync("git", ["diff", "--no-ext-diff", "--binary", "HEAD", "--", ...paths], options)
  );
  const files = execFileSync(
    "git",
    ["ls-files", "--others", "--exclude-standard", "-z", "--", ...paths],
    { ...options, encoding: "utf8" }
  )
    .split("\0")
    .filter(Boolean)
    .sort();
  for (const name of files) {
    hash.update(name).update(await digest(join(root, name)));
  }
  return hash.digest("hex");
}

export const literal = (value) => String(value ?? "").replaceAll("$$", "$");

function validateModel(docker, model, database, redis) {
  const protectedVolumes = new Set(database.Mounts.map((mount) => mount.Name).filter(Boolean));
  const api = model.services["codexsun-api"];
  const environment = Object.fromEntries(
    Object.entries(api.environment).map(([key, value]) => [key, literal(value)])
  );
  assert.equal(environment.DB_DRIVER, "mariadb");
  assert.equal(environment.DB_PORT, "3306");
  assert.equal(
    environment.DB_HOST,
    database.Name.slice(1),
    "The API must use the selected local MariaDB container."
  );
  assert.equal(environment.NODE_ENV, "production");
  for (const key of [
    "CODEXSUN_DB_FRESH_ON_START",
    "CODEXSUN_ALLOW_PRODUCTION_DB_RESET",
    "CODEXSUN_ALLOW_LIVE_RESTORE",
    "ENABLE_DEFAULT_TENANT_SEED"
  ])
    assert.equal(environment[key], "0", `${key} must be 0.`);
  for (const [name, service] of Object.entries(model.services)) {
    assert.equal(service.container_name, name);
    assert.ok(!service.privileged, "Privileged app containers are unsupported.");
    for (const port of service.ports ?? [])
      assert.ok(["127.0.0.1", "::1"].includes(port.host_ip), "Local ports must bind to loopback.");
    for (const mount of service.volumes ?? []) {
      assert.ok(!protectedVolumes.has(mount.source), "An app cannot mount MariaDB storage.");
      if (mount.type === "volume") docker.run(["volume", "inspect", mount.source]);
      else
        assert.ok(
          existsSync(literal(mount.source)) && statSync(literal(mount.source)).isFile(),
          "A retained local bind file is missing."
        );
    }
    for (const network of Object.keys(service.networks ?? {}))
      docker.run(["network", "inspect", network]);
  }
  for (const network of Object.keys(api.networks)) {
    assert.equal(
      docker.json(["network", "inspect", network])[0].Internal,
      true,
      "The local API must retain isolated networking."
    );
  }
  assert.ok(
    Object.keys(api.networks).some((name) => database.NetworkSettings.Networks[name]),
    "API and MariaDB must share a local network."
  );
  const worker = model.services["codexsun-worker"];
  assert.equal(
    new URL(literal(worker.environment.CODEXSUN_REDIS_URL)).hostname,
    redis.Name.slice(1),
    "Worker must use the selected local Redis container."
  );
}
