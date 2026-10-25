#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const ROOT = resolve(import.meta.dirname, "..");
const CHANGELOG_FILE = join("assist", "documentation", "CHANGELOG.md");
const WINDOWS_TAURI_CONFIG = join("apps", "platform", "windows", "src-tauri", "tauri.conf.json");
const WINDOWS_CARGO_MANIFEST = join("apps", "platform", "windows", "src-tauri", "Cargo.toml");

export function bumpNextVersion(rootDir, title = "version update", options = {}) {
  const currentVersion = readRootVersion(rootDir);
  const nextVersion = bumpPatch(currentVersion);
  const databaseUpdate = resolveDatabaseUpdate(rootDir, options.databaseUpdate);
  const packageFiles = findWorkspacePackageFiles(rootDir);

  for (const file of packageFiles) {
    updatePackageVersion(file, currentVersion, nextVersion);
  }

  updatePackageLock(
    resolve(rootDir, "package-lock.json"),
    rootDir,
    packageFiles,
    currentVersion,
    nextVersion
  );
  updateChangelog(rootDir, nextVersion, title, databaseUpdate);
  updateDeploymentSample(rootDir, nextVersion);
  updateWindowsPackageManifests(rootDir, nextVersion);

  return {
    currentVersion,
    databaseUpdate,
    nextVersion,
    reference: Number(nextVersion.split(".")[2] ?? "0"),
    title
  };
}

function updateWindowsPackageManifests(rootDir, nextVersion) {
  const configFile = resolve(rootDir, WINDOWS_TAURI_CONFIG);
  if (existsSync(configFile)) {
    const config = JSON.parse(readFileSync(configFile, "utf8"));
    config.version = nextVersion;
    writeFileSync(configFile, `${JSON.stringify(config, null, 2)}\n`, "utf8");
  }

  const cargoFile = resolve(rootDir, WINDOWS_CARGO_MANIFEST);
  if (existsSync(cargoFile)) {
    const content = readFileSync(cargoFile, "utf8").replace(
      /(^\[package\][\s\S]*?^version\s*=\s*")[^"]+("$)/mu,
      `$1${nextVersion}$2`
    );
    writeFileSync(cargoFile, content, "utf8");
  }
}

function updateDeploymentSample(rootDir, nextVersion) {
  const file = resolve(rootDir, ".container", "deploy.env.sample");
  if (!existsSync(file)) return;
  const content = readFileSync(file, "utf8").replace(
    /^CODEXSUN_VERSION=.*$/mu,
    `CODEXSUN_VERSION=${nextVersion}`
  );
  writeFileSync(file, content, "utf8");
}

export function findWorkspacePackageFiles(rootDir) {
  const rootPackagePath = resolve(rootDir, "package.json");
  const rootPackage = JSON.parse(readFileSync(rootPackagePath, "utf8"));
  const files = new Set([rootPackagePath]);

  for (const pattern of rootPackage.workspaces ?? []) {
    for (const workspaceDir of expandWorkspacePattern(rootDir, pattern)) {
      const packagePath = join(workspaceDir, "package.json");
      if (existsSync(packagePath)) {
        files.add(packagePath);
      }
    }
  }

  return [...files].sort();
}

function expandWorkspacePattern(rootDir, pattern) {
  const parts = pattern.split(/[\\/]/u).filter(Boolean);
  let dirs = [rootDir];

  for (const part of parts) {
    const nextDirs = [];

    for (const dir of dirs) {
      if (part === "*") {
        if (!existsSync(dir)) {
          continue;
        }

        for (const entry of readdirSync(dir)) {
          const fullPath = join(dir, entry);
          if (statSync(fullPath).isDirectory()) {
            nextDirs.push(fullPath);
          }
        }
      } else {
        const fullPath = join(dir, part);
        if (existsSync(fullPath) && statSync(fullPath).isDirectory()) {
          nextDirs.push(fullPath);
        }
      }
    }

    dirs = nextDirs;
  }

  return dirs;
}

function readRootVersion(rootDir) {
  const pkg = JSON.parse(readFileSync(resolve(rootDir, "package.json"), "utf8"));

  if (!pkg.version) {
    throw new Error("Root package.json does not contain a version.");
  }

  return String(pkg.version);
}

export function bumpPatch(version) {
  const match = /^(\d+)\.(\d+)\.(\d+)$/u.exec(version);
  const patch = Number(match?.[3]);
  if (!match || !Number.isSafeInteger(patch)) {
    throw new Error(`Unsupported version format: ${version}`);
  }
  return `${match[1]}.${match[2]}.${patch + 1}`;
}

function updatePackageVersion(file, currentVersion, nextVersion) {
  const pkg = JSON.parse(readFileSync(file, "utf8"));
  pkg.version = nextVersion;
  updateInternalDependencyRanges(pkg, currentVersion, nextVersion);
  writeFileSync(file, `${JSON.stringify(pkg, null, 2)}\n`, "utf8");
}

function updateInternalDependencyRanges(pkg, currentVersion, nextVersion) {
  for (const field of [
    "dependencies",
    "devDependencies",
    "peerDependencies",
    "optionalDependencies"
  ]) {
    const deps = pkg[field];
    if (!deps || typeof deps !== "object") {
      continue;
    }

    for (const [name, version] of Object.entries(deps)) {
      if (name.startsWith("@codexsun/") && version === `^${currentVersion}`) {
        deps[name] = `^${nextVersion}`;
      }
    }
  }
}

function updatePackageLock(file, rootDir, packageFiles, currentVersion, nextVersion) {
  if (!existsSync(file)) {
    return;
  }

  const lock = JSON.parse(readFileSync(file, "utf8"));
  const workspaceLockPaths = new Set(
    packageFiles.map((packageFile) => relative(rootDir, dirname(packageFile)).replaceAll("\\", "/"))
  );

  if (lock.version === currentVersion) {
    lock.version = nextVersion;
  }

  for (const [lockPath, pkg] of Object.entries(lock.packages ?? {})) {
    if (
      pkg &&
      typeof pkg === "object" &&
      pkg.version === currentVersion &&
      (lockPath === "" || workspaceLockPaths.has(lockPath))
    ) {
      pkg.version = nextVersion;
    }
    updateInternalDependencyRanges(pkg, currentVersion, nextVersion);
  }

  writeFileSync(file, `${JSON.stringify(lock, null, 2)}\n`, "utf8");
}

function updateChangelog(rootDir, nextVersion, title, databaseUpdate) {
  const file = resolve(rootDir, CHANGELOG_FILE);
  const tag = `v-${nextVersion}`;
  const label = `v ${nextVersion}`;
  let content = readFileSync(file, "utf8");

  content = content
    .replace(/Current version: .*/u, `Current version: ${nextVersion}`)
    .replace(/Release tag: .*/u, `Release tag: ${tag}`)
    .replace(/Changelog label: .*/u, `Changelog label: ${label}`);

  const entry = [
    `## ${tag}`,
    "",
    `### [${label}] ${formatLocalTimestamp(new Date())} - ${title}`,
    "",
    "#### Database Changes",
    "",
    `- Database update: ${databaseUpdate.hasUpdate ? "Yes" : "No"}${
      databaseUpdate.mode === "auto" ? " (auto-check)" : " (manual)"
    }.`,
    "",
    "#### App Codebase Changes",
    "",
    `- Bumped workspace version to ${nextVersion}.`,
    ""
  ].join("\n");

  const markerIndex = content.indexOf("## v-");
  const insertAt = markerIndex === -1 ? content.length : markerIndex;
  content = `${content.slice(0, insertAt)}${entry}\n${content.slice(insertAt)}`;
  writeFileSync(file, content, "utf8");
}

function formatLocalTimestamp(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const suffix = hours >= 12 ? "pm" : "am";
  const hour12 = hours % 12 || 12;

  return `${year}-${month}-${day} ${hour12}:${minutes} ${suffix}`;
}

function parseTitleArg(argv) {
  const titleIndex = argv.findIndex((arg) => arg === "--title" || arg === "-t");
  if (titleIndex >= 0) {
    return argv[titleIndex + 1] ?? "version update";
  }

  return (
    argv
      .filter((arg, index) => {
        const previous = argv[index - 1];
        return !arg.startsWith("--") && previous !== "--database-update" && previous !== "--title";
      })
      .join(" ")
      .trim() || "version update"
  );
}

function parseDatabaseUpdateArg(argv) {
  if (argv.some((arg) => arg === "--database-update" || arg === "--db-update" || arg === "--db")) {
    return true;
  }

  if (
    argv.some(
      (arg) => arg === "--no-database-update" || arg === "--no-db-update" || arg === "--no-db"
    )
  ) {
    return false;
  }

  const valueArg = argv.find((arg) => arg.startsWith("--database-update="));
  const value = valueArg?.split("=").slice(1).join("=").trim().toLowerCase();
  if (value === "yes" || value === "true" || value === "1") return true;
  if (value === "no" || value === "false" || value === "0") return false;

  return "auto";
}

function resolveDatabaseUpdate(rootDir, requested) {
  if (requested === true || requested === false) {
    return {
      files: [],
      hasUpdate: requested,
      mode: "manual"
    };
  }

  const files = changedFiles(rootDir).filter(isDatabaseUpdateFile);
  return {
    files,
    hasUpdate: files.length > 0,
    mode: "auto"
  };
}

function changedFiles(rootDir) {
  try {
    const output = execFileSync("git", ["diff", "--name-only", "HEAD", "--"], {
      cwd: rootDir,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"]
    });

    return output
      .split(/\r?\n/u)
      .map((file) => file.trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

function isDatabaseUpdateFile(file) {
  const normalized = file.replaceAll("\\", "/").toLowerCase();
  const fileName = normalized.split("/").pop() ?? "";

  return (
    normalized.includes("/migrations/") ||
    normalized.includes("/migration-manager/") ||
    normalized.includes("/tenant-database/") ||
    normalized.includes("/infrastructure/database/") ||
    normalized.includes("/database/") ||
    normalized.includes("/src/db/") ||
    fileName === "schema.ts" ||
    fileName.endsWith(".schema.ts") ||
    fileName.endsWith(".migration.ts") ||
    fileName === "migration.ts" ||
    fileName.endsWith(".database.ts")
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const argv = process.argv.slice(2);
  const result = bumpNextVersion(ROOT, parseTitleArg(argv), {
    databaseUpdate: parseDatabaseUpdateArg(argv)
  });

  console.log(`Bumped ${result.currentVersion} -> ${result.nextVersion}`);
  console.log(
    `Database update: ${result.databaseUpdate.hasUpdate ? "yes" : "no"} (${result.databaseUpdate.mode})`
  );
}
