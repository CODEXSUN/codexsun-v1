import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import {
  owner,
  python,
  fixture,
  fakeCommands,
  runShell,
  shellPath,
  writeBackup,
  environmentFixture,
  config
} from "./deployment-test-fixture.mjs";

test("orphaned database-owned, unowned and bind-backed volumes cannot become application storage", () => {
  const directory = fixture(),
    file = environmentFixture(directory),
    inventory = join(directory, "inventory.json");
  writeFileSync(inventory, "[]");
  for (const volume of [
    { Labels: { "com.docker.compose.project": "other-mariadb" } },
    { Labels: {} },
    { Labels: { "com.codexsun.deployment": "codexsun-v1" }, Options: { device: "/other/database" } }
  ]) {
    const result = spawnSync(
      python,
      ["-B", join(owner, "lib/safety.py"), file, "volume-application", inventory],
      { encoding: "utf8", input: JSON.stringify([volume]) }
    );
    assert.notEqual(result.status, 0);
  }
});

test("a backup manifest cannot omit its rollback model", () => {
  const directory = fixture(),
    env = fakeCommands(directory, "exit 0");
  writeBackup(directory);
  const manifest = join(directory, "SHA256SUMS");
  writeFileSync(
    manifest,
    readFileSync(manifest, "utf8")
      .split("\n")
      .filter((line) => !line.endsWith("rollback.json"))
      .join("\n")
  );
  const result = runShell(
    directory,
    `source '${shellPath(join(owner, "lib/common.sh"))}'\nsource '${shellPath(join(owner, "lib/backup.sh"))}'\nBACKUP_DIR='${shellPath(directory)}'\nverify_backup`,
    env
  );
  assert.notEqual(result.status, 0);
  assert.equal(existsSync(join(directory, "commands.log")), false);
});

test("rollback restores stopped services without starting them and removes only newly added services", () => {
  const directory = fixture(),
    env = fakeCommands(directory, "exit 0");
  writeBackup(directory, {
    services: {
      "codexsun-api": { image: "sha256:previous", "x-codexsun-running": true },
      "codexsun-web": { image: "sha256:previous-web", "x-codexsun-running": false }
    }
  });
  const result = runShell(
    directory,
    `source '${shellPath(join(owner, "lib/common.sh"))}'\nsource '${shellPath(join(owner, "lib/backup.sh"))}'\nsource '${shellPath(join(owner, "lib/release.sh"))}'\nBACKUP_DIR='${shellPath(directory)}'\nSERVICES=(codexsun-api codexsun-web codexsun-worker)\ncheck_ownership() { :; }\nrollback_release`,
    env
  );
  assert.equal(result.status, 0, result.stderr);
  const calls = readFileSync(join(directory, "commands.log"), "utf8").split("\n");
  assert.ok(calls.some((line) => line.endsWith("rm --stop --force codexsun-worker")));
  assert.ok(calls.some((line) => line.endsWith("create --no-build codexsun-api codexsun-web")));
  const starts = calls.filter((line) => line.includes(" up -d "));
  assert.equal(starts.length, 1);
  assert.ok(starts[0].endsWith("codexsun-api"));
  assert.ok(!starts[0].includes("codexsun-web"));
});

test("graceful-stop deadline never escalates to SIGKILL or reaches data deletion", () => {
  const directory = fixture();
  const env = fakeCommands(
    directory,
    'if [[ "$*" == *Config.StopSignal* ]]; then echo SIGTERM; elif [[ "$*" == *State.Running* ]]; then echo true; fi'
  );
  const result = runShell(
    directory,
    `source '${shellPath(join(owner, "lib/common.sh"))}'\nsource '${shellPath(join(owner, "lib/quiesce.sh"))}'\nsleep() { :; }\ngraceful_stop codexsun-api\ndocker rm -f codexsun-api`,
    env
  );
  assert.notEqual(result.status, 0);
  const calls = readFileSync(join(directory, "commands.log"), "utf8");
  assert.match(calls, /kill --signal SIGTERM codexsun-api/u);
  assert.doesNotMatch(calls, /SIGKILL|rm -f/u);
  assert.match(result.stderr, /did not stop gracefully/u);
});

test("image-configured SIGKILL is refused before signaling a service", () => {
  const directory = fixture();
  const env = fakeCommands(directory, "echo SIGKILL");
  const result = runShell(
    directory,
    `source '${shellPath(join(owner, "lib/common.sh"))}'\nsource '${shellPath(join(owner, "lib/quiesce.sh"))}'\ngraceful_stop codexsun-api`,
    env
  );
  assert.notEqual(result.status, 0);
  assert.doesNotMatch(readFileSync(join(directory, "commands.log"), "utf8"), /^kill /mu);
});

test("saved candidate and rollback models preserve literal credentials through Compose parsing", () => {
  const directory = fixture(),
    expected = "fixture$PASSWORD${DO_NOT_EXPAND}";
  const envPath = join(directory, "fixture.env"),
    baseline = join(directory, "baseline.json");
  writeFileSync(envPath, `FIXTURE_SECRET='${expected}'\n`);
  writeFileSync(
    baseline,
    JSON.stringify({
      services: {
        "codexsun-api": {
          image: "alpine:fixture",
          environment: { FIXTURE_SECRET: "${FIXTURE_SECRET}" },
          command: ["echo", "${FIXTURE_SECRET}"]
        }
      }
    })
  );
  function compose(path, ...options) {
    const result = spawnSync(
      "docker",
      [
        "compose",
        "--env-file",
        envPath,
        "-p",
        "codexsun-fixture",
        "-f",
        path,
        "config",
        ...options
      ],
      { encoding: "utf8" }
    );
    assert.equal(result.status, 0, result.stderr);
    return result.stdout;
  }
  const rendered = compose(baseline, "--format", "json");
  const pinned = config(["pin", "codexsun-api=alpine:fixture"], rendered);
  assert.equal(pinned.status, 0, pinned.stderr);
  const candidate = join(directory, "candidate.json");
  writeFileSync(candidate, pinned.stdout);
  assert.equal(
    compose(candidate, "--hash", "codexsun-api"),
    compose(baseline, "--hash", "codexsun-api")
  );
  const item = {
    Name: "/codexsun-api",
    Image: "alpine:fixture",
    Config: { Env: [`FIXTURE_SECRET=${expected}`], Cmd: ["echo", expected] },
    HostConfig: { RestartPolicy: { Name: "unless-stopped" } },
    NetworkSettings: { Networks: {} },
    Mounts: []
  };
  const snapshot = config(["snapshot"], JSON.stringify([item]));
  assert.equal(snapshot.status, 0, snapshot.stderr);
  const rollback = join(directory, "rollback.json");
  writeFileSync(rollback, snapshot.stdout);
  const originalApi = JSON.parse(rendered).services["codexsun-api"];
  const rollbackApi = JSON.parse(compose(rollback, "--format", "json")).services["codexsun-api"];
  assert.equal(rollbackApi.environment.FIXTURE_SECRET, originalApi.environment.FIXTURE_SECRET);
  assert.deepEqual(rollbackApi.command, originalApi.command);
});
