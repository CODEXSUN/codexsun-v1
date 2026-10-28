import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { join, resolve } from "node:path";
import { test } from "node:test";

const bash =
  process.platform === "win32" ? join(process.env.ProgramFiles, "Git/bin/bash.exe") : "bash";
const hook = resolve(".container/database/mariadb/10-codexsun-grants.sh").replaceAll("\\", "/");
const env = {
  ...process.env,
  CODEXSUN_DB_USER: "fixture",
  CODEXSUN_DB_PASSWORD: "fixture-password",
  MARIADB_ROOT_PASSWORD: "root-fixture-password"
};

test("sourced MariaDB hook preserves caller shell options and applies grants", () => {
  const command = `set +u; docker_process_sql() { cat; }; source "$1"; [[ $- != *u* ]]; test -z "\${2:-}"; echo caller-ok`;
  const output = execFileSync(bash, ["-c", command, "fixture", hook], { env, encoding: "utf8" });
  assert.match(output, /GRANT ALL PRIVILEGES ON \*\.\* TO 'fixture'@'%'/u);
  assert.match(output, /caller-ok/u);
});

test("hook rejects missing credentials without weakening an existing nounset option", () => {
  const command = `set -u; docker_process_sql() { cat >/dev/null; }; source "$1"; [[ $- == *u* ]]`;
  execFileSync(bash, ["-c", command, "fixture", hook], { env });
  const missing = { ...env };
  delete missing.CODEXSUN_DB_USER;
  const result = spawnSync(bash, [hook], { env: missing, encoding: "utf8" });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /CODEXSUN_DB_USER is required/u);
});
