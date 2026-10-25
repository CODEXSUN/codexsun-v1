#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { findWorkspacePackageFiles } from "./version-bump.mjs";

const ROOT = resolve(import.meta.dirname, "..");
const CHANGELOG_PATH = join(ROOT, "assist", "documentation", "CHANGELOG.md");
const WINDOWS_TAURI_CONFIG = join(
  ROOT,
  "apps",
  "platform",
  "windows",
  "src-tauri",
  "tauri.conf.json"
);
const WINDOWS_CARGO_MANIFEST = join(ROOT, "apps", "platform", "windows", "src-tauri", "Cargo.toml");

function readJson(file) {
  return JSON.parse(readFileSync(file, "utf8"));
}

function readRootVersion(rootDir) {
  return String(readJson(join(rootDir, "package.json")).version);
}

function checkVersions(rootDir) {
  const failures = [];
  const rootVersion = readRootVersion(rootDir);

  for (const file of findWorkspacePackageFiles(rootDir)) {
    const pkg = readJson(file);
    if (String(pkg.version) !== rootVersion) {
      failures.push(
        `${relative(rootDir, file)} version is ${pkg.version}; expected ${rootVersion}.`
      );
    }
  }

  if (existsSync(join(rootDir, "package-lock.json"))) {
    const lock = readJson(join(rootDir, "package-lock.json"));
    if (String(lock.version) !== rootVersion) {
      failures.push(`package-lock.json version is ${lock.version}; expected ${rootVersion}.`);
    }

    const rootLock = lock.packages?.[""];
    if (rootLock?.version && String(rootLock.version) !== rootVersion) {
      failures.push(
        `package-lock root package version is ${rootLock.version}; expected ${rootVersion}.`
      );
    }
  }

  const changelog = readFileSync(CHANGELOG_PATH, "utf8");
  const expectedTag = `v-${rootVersion}`;
  const expectedLabel = `v ${rootVersion}`;

  if (!new RegExp(`Current version:\\s*${escapeRegExp(rootVersion)}\\b`, "u").test(changelog)) {
    failures.push(`Changelog Version State current version must be ${rootVersion}.`);
  }

  if (!new RegExp(`Release tag:\\s*${escapeRegExp(expectedTag)}\\b`, "u").test(changelog)) {
    failures.push(`Changelog Version State release tag must be ${expectedTag}.`);
  }

  if (!new RegExp(`Changelog label:\\s*${escapeRegExp(expectedLabel)}\\b`, "u").test(changelog)) {
    failures.push(`Changelog Version State label must be ${expectedLabel}.`);
  }

  if (!changelog.includes(`## ${expectedTag}`)) {
    failures.push(`Changelog must contain section ## ${expectedTag}.`);
  }

  if (existsSync(WINDOWS_TAURI_CONFIG)) {
    const packageVersion = String(readJson(WINDOWS_TAURI_CONFIG).version ?? "");
    if (packageVersion !== rootVersion) {
      failures.push(
        `Windows tauri.conf.json version is ${packageVersion}; expected ${rootVersion}.`
      );
    }
  }

  if (existsSync(WINDOWS_CARGO_MANIFEST)) {
    const cargoManifest = readFileSync(WINDOWS_CARGO_MANIFEST, "utf8");
    const packageVersion = cargoManifest.match(/^version\s*=\s*"([^"]+)"/mu)?.[1];
    if (packageVersion !== rootVersion) {
      failures.push(
        `Windows Cargo.toml version is ${packageVersion ?? "missing"}; expected ${rootVersion}.`
      );
    }
  }

  const deploymentSample = join(rootDir, ".container", "deploy.env.sample");
  if (existsSync(deploymentSample)) {
    const values = Object.fromEntries(
      readFileSync(deploymentSample, "utf8")
        .split(/\r?\n/u)
        .map((line) => line.match(/^([A-Z][A-Z0-9_]*)=(.*)$/u))
        .filter(Boolean)
        .map((match) => [match[1], match[2]])
    );
    for (const key of ["CODEXSUN_VERSION"]) {
      if (values[key] !== rootVersion) {
        failures.push(`.container/deploy.env.sample ${key} must be ${rootVersion}.`);
      }
    }
  }

  return {
    failures,
    rootVersion
  };
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = checkVersions(ROOT);

  if (result.failures.length > 0) {
    console.error(`Version check failed for ${result.rootVersion}:`);
    for (const failure of result.failures) {
      console.error(`- ${failure}`);
    }
    process.exit(1);
  }

  console.log(`Version check passed for ${result.rootVersion}.`);
}
