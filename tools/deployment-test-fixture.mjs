import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

export const root = resolve(import.meta.dirname, "..");
export const owner = join(root, ".container/codexsun-v1");
export const bash = process.platform === "win32" ? "C:/Program Files/Git/bin/bash.exe" : "bash";
export const python = process.platform === "win32" ? "python" : "python3";
export const shellPath = (value) =>
  value
    .replaceAll("\\", "/")
    .replace(/^([A-Za-z]):/u, (_match, drive) => `/${drive.toLowerCase()}`);
export const read = (name) => readFileSync(resolve(root, name), "utf8");
export function fixture() {
  const base = join(root, "dist/deployment-tests");
  mkdirSync(base, { recursive: true });
  return mkdtempSync(join(base, "audit-"));
}
export function config(args, input) {
  return spawnSync(python, ["-B", join(owner, "lib/config.py"), ...args], {
    encoding: "utf8",
    input
  });
}
export function fakeCommands(directory, body) {
  const bin = join(directory, "bin");
  mkdirSync(bin, { recursive: true });
  writeFileSync(
    join(bin, "docker"),
    `#!/usr/bin/env bash\nprintf '%s\\n' "$*" >>"$CODEXSUN_TEST_LOG"\n${body}\n`,
    { mode: 0o755 }
  );
  writeFileSync(join(bin, "python3"), `#!/usr/bin/env bash\nexec ${python} -B "$@"\n`, {
    mode: 0o755
  });
  return {
    ...process.env,
    CODEXSUN_TEST_BIN: shellPath(bin),
    CODEXSUN_TEST_LOG: shellPath(join(directory, "commands.log")),
    PYTHONDONTWRITEBYTECODE: "1"
  };
}
export function runShell(directory, script, env) {
  return spawnSync(
    bash,
    [
      "-c",
      `export PATH="$CODEXSUN_TEST_BIN:$PATH"\n[ "$(command -v docker)" = "$CODEXSUN_TEST_BIN/docker" ] || exit 99\n${script}`
    ],
    { cwd: directory, encoding: "utf8", env }
  );
}
export function writeBackup(
  directory,
  model = { services: { "codexsun-api": { image: "sha256:previous", "x-codexsun-running": true } } }
) {
  writeFileSync(join(directory, "databases.sql"), "-- Dump completed on fixture\n");
  writeFileSync(join(directory, "deploy.env"), "FIXTURE=1\n");
  writeFileSync(join(directory, "rollback.json"), JSON.stringify(model));
  writeFileSync(
    join(directory, "SHA256SUMS"),
    ["databases.sql", "deploy.env", "rollback.json"]
      .map(
        (name) =>
          `${createHash("sha256")
            .update(readFileSync(join(directory, name)))
            .digest("hex")}  ${name}\n`
      )
      .join("")
  );
}
export function environmentFixture(directory) {
  const text = read(".container/deploy.env.sample")
    .replace(/change_this_[a-z_]+/gu, "fixture-secret-012345678901234567890123456789")
    .replace(
      /^(SUPER_ADMIN|SOFTWARE_ADMIN|TENANT_ADMIN|DEFAULT_TENANT_ADMIN)_(NAME|EMAIL|PASSWORD)=$/gmu,
      "$1_$2=fixture"
    );
  const path = join(directory, "deploy.env");
  writeFileSync(path, text);
  return path;
}
export function createVpsFixture(state) {
  const directory = fixture();
  cpSync(owner, join(directory, ".container/codexsun-v1"), { recursive: true });
  cpSync(join(root, ".container/database"), join(directory, ".container/database"), {
    recursive: true
  });
  cpSync(join(root, "package.json"), join(directory, "package.json"));
  const envPath = environmentFixture(directory);
  cpSync(envPath, join(directory, ".container/deploy.env"));
  mkdirSync(join(directory, "payload"));
  writeFileSync(join(directory, "payload/manifest.json"), "[]");
  writeFileSync(join(directory, "payload/retained.txt"), "fixture persistent bytes");
  const archive = runShell(
    directory,
    `tar -czf '${shellPath(join(directory, "archive.tar.gz"))}' -C '${shellPath(join(directory, "payload"))}' .`,
    fakeCommands(directory, "exit 99")
  );
  if (archive.status !== 0) throw new Error(archive.stderr);
  state.directory = directory;
  state.archive = join(directory, "archive.tar.gz");
  state.sourceVersion = JSON.parse(readFileSync(join(directory, "package.json"))).version;
  // Approval belongs to this fixture, independent of concurrent repository releases.
  const privateEnv = join(directory, ".container/deploy.env");
  writeFileSync(
    privateEnv,
    readFileSync(privateEnv, "utf8")
      .replace(/^CODEXSUN_VERSION=.*$/mu, `CODEXSUN_VERSION=${state.sourceVersion}`)
      .replace(
        /^CODEXSUN_MIGRATION_COMPATIBLE_VERSION=.*$/mu,
        `CODEXSUN_MIGRATION_COMPATIBLE_VERSION=${state.sourceVersion}`
      )
  );
  state.commit = "a".repeat(40);
  writeFileSync(join(directory, "state.json"), JSON.stringify(state));
  const env = fakeCommands(directory, 'exec node "$CODEXSUN_MOCK_DRIVER" docker "$@"');
  Object.assign(env, {
    CODEXSUN_MOCK_DRIVER: join(root, "tools/deployment-mock-driver.mjs"),
    CODEXSUN_MOCK_STATE: join(directory, "state.json"),
    CODEXSUN_EXPECTED_REVISION: state.targetVersion ? "b".repeat(40) : state.commit,
    TMPDIR: shellPath(directory)
  });
  for (const [name, body] of [
    ["uname", "echo Linux"],
    ["flock", "exit 0"],
    ["git", 'exec node "$CODEXSUN_MOCK_DRIVER" git "$@"']
  ]) {
    writeFileSync(join(directory, "bin", name), `#!/usr/bin/env bash\n${body}\n`, { mode: 0o755 });
  }
  return {
    directory,
    env,
    readState: () => JSON.parse(readFileSync(join(directory, "state.json"))),
    calls: () => readFileSync(join(directory, "commands.log"), "utf8"),
    run: (script, options = "--yes") =>
      runShell(
        directory,
        `bash '${shellPath(join(directory, ".container/codexsun-v1", script))}' ${options}`,
        env
      )
  };
}
