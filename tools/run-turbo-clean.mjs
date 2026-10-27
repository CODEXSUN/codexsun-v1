#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const turboBin = resolve(root, "node_modules", "turbo", "bin", "turbo");
const args = process.argv.slice(2);
const envPath = join(root, ".env");

if (!args.length) {
  console.error("Usage: node tools/run-turbo-clean.mjs <turbo arguments>");
  process.exit(1);
}

if (existsSync(envPath)) {
  process.loadEnvFile(envPath);
}

const turboArgs = args.includes("--cache-dir")
  ? args
  : [...args, "--cache-dir", "dist/.cache/turbo"];
const command = existsSync(turboBin) ? process.execPath : "turbo";
const commandArgs = existsSync(turboBin) ? [turboBin, ...turboArgs] : turboArgs;
const temporary = join(root, "dist", ".tmp");
mkdirSync(temporary, { recursive: true });
const result = spawnSync(command, commandArgs, {
  cwd: root,
  env: {
    ...process.env,
    npm_config_cache: join(root, "dist", ".cache", "npm"),
    TEMP: temporary,
    TMP: temporary,
    TMPDIR: temporary
  },
  stdio: "inherit"
});

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}

if (result.signal) {
  process.kill(process.pid, result.signal);
}

process.exit(result.status ?? 1);
