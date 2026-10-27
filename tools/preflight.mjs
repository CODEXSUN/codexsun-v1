#!/usr/bin/env node

import { execFileSync, spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import {
  frameworkBuildIsCurrent,
  frameworkInputs,
  recordFrameworkBuild
} from "./framework-build-cache.mjs";
import { existsSync, readFileSync, watch } from "node:fs";
import { rm } from "node:fs/promises";
import { join, resolve } from "node:path";
import { repositoryTempDirectory as tmpdir } from "./repository-temp.mjs";
import { createServer } from "node:net";
import { pathToFileURL } from "node:url";
import { loadDevEnv, requiredDevPort } from "./dev-runtime-env.mjs";
import { requestProcessStop, startProcessControl } from "./dev-process-control.mjs";
import { requestDevApiShutdown } from "./dev-shutdown-client.mjs";
import { previousPreflightPids, takeoverTarget } from "./dev-port-ownership.mjs";
import {
  apiSourceDirectories,
  captureApiInputs,
  changedApiInputs
} from "./dev-api-source-changes.mjs";

const root = resolve(import.meta.dirname, "..");
const app = process.argv[2];

const apps = {
  "qcafe-api": {
    displayName: "Q Cafe API",
    cwd: "apps/qcafe/api",
    envKey: "CODEXSUN_QCAFE_API_PORT",
    host: "127.0.0.1",
    command: process.execPath,
    args: ["src/server.mjs"]
  },
  "qcafe-web": {
    displayName: "Q Cafe web",
    cwd: "apps/qcafe/web",
    envKey: "CODEXSUN_QCAFE_WEB_PORT",
    host: "127.0.0.1",
    command: process.execPath,
    args: [nodePackageBin("vite", "bin/vite.js"), "--strictPort"]
  },
  "codeit-web": {
    displayName: "Codeit web",
    cwd: "devkits/codeit",
    envKey: "CODEXSUN_CODEIT_WEB_PORT",
    defaultPort: 7070,
    host: "127.0.0.1",
    command: process.execPath,
    args: [nodePackageBin("vite", "bin/vite.js"), "--strictPort"]
  },
  "uiux-web": {
    displayName: "uiux web",
    cwd: "devkits/uiux",
    envKey: "CODEXSUN_UIUX_WEB_PORT",
    host: "127.0.0.1",
    command: process.execPath,
    args: [nodePackageBin("vite", "bin/vite.js"), "--strictPort"]
  },
  "tconnect-web": {
    displayName: "Sites · Tirupur Connect",
    cwd: "apps/sites/clients",
    envKey: "CODEXSUN_TCONNECT_WEB_PORT",
    defaultPort: 7040,
    host: "127.0.0.1",
    command: process.execPath,
    args: [
      "--import",
      "tsx",
      nodePackageBin("vite", "bin/vite.js"),
      "--mode",
      "tirupurconnect",
      "--strictPort"
    ]
  },
  "ecommerce-web": {
    displayName: "ecommerce web",
    cwd: "apps/ecommerce/web",
    envKey: "CODEXSUN_ECOMMERCE_WEB_PORT",
    host: "127.0.0.1",
    command: process.execPath,
    args: [nodePackageBin("vite", "bin/vite.js"), "--strictPort"]
  },
  "sites-codexsun": {
    displayName: "sites codexsun",
    cwd: "apps/sites/clients",
    envKey: "CODEXSUN_SITES_CODEXSUN_PORT",
    defaultPort: 7130,
    host: "127.0.0.1",
    command: process.execPath,
    args: [nodePackageBin("vite", "bin/vite.js"), "--strictPort", "--mode", "codexsun"]
  },
  "sites-logicx": {
    displayName: "sites logicx",
    cwd: "apps/sites/clients",
    envKey: "CODEXSUN_SITES_LOGICX_PORT",
    defaultPort: 7131,
    host: "127.0.0.1",
    command: process.execPath,
    args: [nodePackageBin("vite", "bin/vite.js"), "--strictPort", "--mode", "logicx"]
  },
  "sites-techmedia": {
    displayName: "sites techmedia",
    cwd: "apps/sites/clients",
    envKey: "CODEXSUN_SITES_TECHMEDIA_PORT",
    defaultPort: 7132,
    host: "127.0.0.1",
    command: process.execPath,
    args: [nodePackageBin("vite", "bin/vite.js"), "--strictPort", "--mode", "techmedia"]
  },
  "platform-api": {
    displayName: "api",
    cwd: "apps/platform/api",
    envKey: "PLATFORM_API_PORT",
    host: "127.0.0.1",
    command: process.execPath,
    args: [
      "--import",
      pathToFileURL(resolve(root, "tools/register-root-package-resolution.mjs")).href,
      "--import",
      "tsx",
      "src/server.ts"
    ]
  },
  "platform-web": {
    displayName: "web",
    cwd: "apps/platform/web",
    envKey: "PLATFORM_WEB_PORT",
    host: "127.0.0.1",
    command: process.execPath,
    args: [nodePackageBin("vite", "bin/vite.js"), "--strictPort"]
  }
};

if (!app || !apps[app]) {
  console.log(`Usage: node tools/preflight.mjs <${Object.keys(apps).join("|")}>`);
  process.exit(1);
}

const config = apps[app];
const env = loadDevEnv(root);
const port = requiredDevPort(
  process.env[config.envKey] ?? env[config.envKey] ?? config.defaultPort,
  config.envKey
);
const host = config.host;
const portPolicy = process.env.CODEXSUN_DEV_PORT_POLICY ?? env.CODEXSUN_DEV_PORT_POLICY ?? "abort";
const controlFile = join(tmpdir(), `codexsun-dev-shutdown-${process.pid}.json`);
const controlToken = randomBytes(32).toString("hex");
let child;
let shuttingDown = false;
let restartTimer;
let restartPending = false;
let restarting = false;
let apiInputs;
let checkingApiInputs = false;
let rescanApiInputs = false;
let activeStop;
const watchers = [];
let closeProcessControl = async () => {};

process.on("message", (message) => {
  if (message?.type === "codexsun:shutdown") void shutdown("SIGTERM");
});
if (process.send) process.once("disconnect", () => void shutdown("SIGTERM"));
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.once(signal, () => void shutdown(signal));
}
ensureWorkspaceLinks();
closeProcessControl = await startProcessControl("preflight", () => void shutdown("SIGTERM"));

await freePort(port, host);

if (app === "platform-api") {
  ensurePlatformApiDependencies();
} else if (app === "platform-web" || app === "ecommerce-web" || app === "tconnect-web") {
  await waitForPlatformApi(
    requiredDevPort(process.env.PLATFORM_API_PORT ?? env.PLATFORM_API_PORT, "PLATFORM_API_PORT")
  );
}

if (app === "platform-api" && !shuttingDown) {
  try {
    apiInputs = await captureApiInputs(root);
    watchApiSources();
  } catch (error) {
    console.error(`  x API file watcher failed: ${error.message}`);
    await shutdown("SIGTERM");
  }
}
if (!shuttingDown) launchChild();
process.send?.({ type: "codexsun:preflight-ready" });

async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  if (restartTimer) clearTimeout(restartTimer);
  for (const watcher of watchers) watcher.close();
  console.log(`  - Stopping ${config.displayName}`);
  try {
    const result = child ? await stopCurrentChild(signal) : 0;
    await rm(controlFile, { force: true });
    await closeProcessControl();
    if (result === 0) console.log(`  ok ${config.displayName} stopped`);
    process.exit(result);
  } catch (error) {
    console.error(`  x Failed to stop ${config.displayName}: ${error.message}`);
    await Promise.allSettled([rm(controlFile, { force: true }), closeProcessControl()]);
    process.exit(1);
  }
}

function launchChild() {
  const launched = spawn(
    config.command,
    [
      ...config.args,
      ...(!["platform-api", "qcafe-api"].includes(app)
        ? ["--host", host, "--port", String(port)]
        : [])
    ],
    {
      cwd: resolve(root, config.cwd),
      detached: process.platform !== "win32",
      env: {
        ...(app !== "platform-api" ? env : {}),
        ...process.env,
        npm_config_cache: join(root, "dist", ".cache", "npm"),
        TEMP: tmpdir(),
        TMP: tmpdir(),
        TMPDIR: tmpdir(),
        ...(["platform-api", "platform-web", "qcafe-web", "ecommerce-web", "tconnect-web"].includes(
          app
        )
          ? {
              NODE_OPTIONS: withMaxHttpHeaderSize(
                process.env.NODE_OPTIONS ?? env.NODE_OPTIONS,
                // Admit accumulated local cookies once so development login can retire them.
                262_144
              )
            }
          : {}),
        ...(app === "platform-api"
          ? {
              CODEXSUN_DB_FRESH_SESSION_FILE: join(
                tmpdir(),
                `codexsun-platform-fresh-${process.pid}.done`
              ),
              CODEXSUN_DEV_SHUTDOWN_FILE: controlFile,
              CODEXSUN_DEV_SHUTDOWN_TOKEN: controlToken
            }
          : {}),
        ...(app === "qcafe-api" ? qCafeApiEnvironment(env, port) : {}),
        [config.envKey]: String(port)
      },
      stdio: "inherit"
    }
  );
  child = launched;
  launched.on("exit", async (code, signal) => {
    if (child !== launched || shuttingDown || activeStop?.child === launched) return;
    console.error(`  x ${config.displayName} exited with ${signal ?? `code ${code ?? 1}`}`);
    await rm(controlFile, { force: true });
    await closeProcessControl();
    process.exit(code || 1);
  });
  launched.on("error", (error) => {
    if (shuttingDown) return;
    console.error(`  x Failed to launch ${config.displayName}: ${error.message}`);
    process.exit(1);
  });
}

function withMaxHttpHeaderSize(nodeOptions, size) {
  const option = `--max-http-header-size=${size}`;
  const current = String(nodeOptions ?? "").trim();
  const existingOption = /--max-http-header-size(?:=|\s+)\d+/u;
  return existingOption.test(current)
    ? current.replace(existingOption, option)
    : [current, option].filter(Boolean).join(" ");
}

function qCafeApiEnvironment(runtimeEnv, port) {
  if ((process.env.CODEXSUN_TENANCY_MODE ?? runtimeEnv.CODEXSUN_TENANCY_MODE) !== "single") {
    throw new Error("Q Cafe's shared SQLite store requires CODEXSUN_TENANCY_MODE=single.");
  }
  const dataPath = runtimeEnv.CODEXSUN_QCAFE_DATABASE_PATH;
  const imagePath = runtimeEnv.CODEXSUN_QCAFE_IMAGE_DIRECTORY;
  if (!dataPath || !imagePath) {
    throw new Error(
      "CODEXSUN_QCAFE_DATABASE_PATH and CODEXSUN_QCAFE_IMAGE_DIRECTORY are required."
    );
  }
  return {
    QCAFE_API_HOST: "127.0.0.1",
    QCAFE_API_PORT: String(port),
    QCAFE_API_TOKEN: randomBytes(32).toString("hex"),
    QCAFE_DATABASE_PATH: resolve(root, dataPath),
    QCAFE_IMAGE_DIRECTORY: resolve(root, imagePath)
  };
}

function watchApiSources() {
  const addWatcher = (watcher) => {
    watcher.on("error", (error) => {
      console.error(`  x API file watcher failed: ${error.message}`);
      void shutdown("SIGTERM");
    });
    watchers.push(watcher);
  };
  const schedule = () => {
    if (shuttingDown) return;
    if (restartTimer) clearTimeout(restartTimer);
    restartTimer = setTimeout(() => void checkApiInputs(), 500);
  };
  for (const directory of apiSourceDirectories(root))
    addWatcher(watch(directory, { recursive: true }, schedule));
  addWatcher(
    watch(root, (_event, filename) => {
      if (String(filename) === ".env") schedule();
    })
  );
}

async function checkApiInputs() {
  if (shuttingDown) return;
  if (checkingApiInputs) {
    rescanApiInputs = true;
    return;
  }
  checkingApiInputs = true;
  try {
    do {
      rescanApiInputs = false;
      const current = await captureApiInputs(root);
      const changed = changedApiInputs(apiInputs, current);
      if (changed.length) {
        apiInputs = current;
        console.log(`  - API input changed: ${changed.join(", ")}`);
        restartPending = true;
        if (!restarting) void restartApi();
      }
    } while (rescanApiInputs && !shuttingDown);
  } catch (error) {
    console.error(`  x API source check failed: ${error.message}`);
    await shutdown("SIGTERM");
  } finally {
    checkingApiInputs = false;
  }
}

async function restartApi() {
  if (restarting || shuttingDown) return;
  restarting = true;
  try {
    while (restartPending && !shuttingDown) {
      restartPending = false;
      await waitForApiReady(child);
      if (shuttingDown) return;
      console.log("  - API source or .env changed; stopping current server");
      const result = await stopCurrentChild("SIGTERM");
      if (result !== 0) throw new Error("API did not stop before restart");
      if (shuttingDown) return;
      launchChild();
      console.log("  ok API restarted; waiting for readiness");
      await waitForApiReady(child);
    }
  } catch (error) {
    console.error(`  x API restart failed: ${error.message}`);
    await shutdown("SIGTERM");
  } finally {
    restarting = false;
  }
}

async function waitForApiReady(target) {
  const readyUrl = `http://${host}:${port}/ready`;
  const startedAt = Date.now();
  while (!shuttingDown && Date.now() - startedAt < 90_000) {
    if (target.exitCode !== null || target.signalCode !== null) {
      throw new Error("API exited before becoming ready");
    }
    try {
      const response = await fetch(readyUrl, { signal: AbortSignal.timeout(2_000) });
      if (response.ok) return;
    } catch {
      // The listener may not be open while the API is initializing.
    }
    await new Promise((resolveWait) => setTimeout(resolveWait, 500));
  }
  if (!shuttingDown) throw new Error("API did not become ready within 90 seconds");
}

function ensurePlatformApiDependencies() {
  console.log("  - Checking API package builds");
  if (frameworkBuildIsCurrent(root)) {
    console.log("  ok Framework build is current");
    return;
  }
  const inputs = frameworkInputs(root);
  buildWorkspacePackage("@codexsun/framework", "startup contract");
  recordFrameworkBuild(root, inputs);
}

function ensureWorkspaceLinks() {
  const packagePath = resolve(root, config.cwd, "package.json");
  const dependencies = Object.keys(
    JSON.parse(readFileSync(packagePath, "utf8")).dependencies ?? {}
  );
  const missing = dependencies.filter(
    (name) =>
      name.startsWith("@codexsun/") &&
      !existsSync(resolve(root, "node_modules", name, "package.json"))
  );
  if (!missing.length) return;
  console.error(`  x Missing root workspace links: ${missing.join(", ")}`);
  console.error("  - Run npm install from the repository root, then start the app again.");
  process.exit(1);
}

function buildWorkspacePackage(workspaceName, reason) {
  const startedAt = Date.now();
  console.log(`  build ${workspaceName} (${reason})`);
  runNpm(["run", "build", "-w", workspaceName]);
  console.log(`  ok ${workspaceName} built in ${Date.now() - startedAt}ms`);
}

function runNpm(args) {
  if (process.env.npm_execpath) {
    execFileSync(process.execPath, [process.env.npm_execpath, ...args], {
      cwd: root,
      stdio: "inherit"
    });
    return;
  }

  if (process.platform === "win32") {
    execFileSync(process.env.ComSpec || "cmd.exe", ["/d", "/s", "/c", ["npm", ...args].join(" ")], {
      cwd: root,
      stdio: "inherit"
    });
    return;
  }

  execFileSync("npm", args, {
    cwd: root,
    stdio: "inherit"
  });
}

async function freePort(port, host) {
  console.log(`\n  > ${config.displayName} preflight`);
  console.log(`  - Checking ${host}:${port}`);

  const available = await probePort(port, host);
  const pids = available ? [] : getPidsOnPort(port);
  const processes = getProcessSnapshot();
  // A restarting launcher still owns the service while its port is free.
  const previous = previousPreflightPids(processes, app, process.pid);

  if (available && !previous.length) {
    await waitForPortRelease();
    console.log(`  ok ${host}:${port} is ready\n`);
    return;
  }

  if (!pids.length && !previous.length) {
    if (await probePort(port, host)) {
      console.log(`  ok ${host}:${port} is ready\n`);
      return;
    }
    console.error(`  x ${host}:${port} is occupied but its owner could not be identified.\n`);
    process.exit(1);
  }

  if (pids.length) console.log(`  ! ${host}:${port} is already in use by PID ${pids.join(", ")}`);
  if (previous.length)
    console.log(`  - Previous ${config.displayName} launcher: ${previous.join(", ")}`);
  if (portPolicy === "abort") {
    console.error(
      "  x A previous dev process or another listener is active. Set CODEXSUN_DEV_PORT_POLICY=takeover to replace it.\n"
    );
    process.exit(1);
  }

  if (portPolicy !== "takeover" && portPolicy !== "force") {
    console.error(
      `  x Invalid CODEXSUN_DEV_PORT_POLICY: ${portPolicy}. Use takeover, force, or abort.\n`
    );
    process.exit(1);
  }

  const targets = new Set();
  for (const pid of new Set([...pids, ...previous])) {
    const target = portPolicy === "force" ? pid : takeoverTarget(pid, processes, app, process.pid);
    if (!target) {
      console.error(`  x Port ${port} belongs to another process; refusing takeover.\n`);
      process.exit(1);
    }
    targets.add(target);
  }
  if (targets.has(process.pid)) {
    console.error("  x Refusing to stop the current preflight process.\n");
    process.exit(1);
  }
  for (const pid of targets) {
    const controlName = /dev-stack\.mjs/u.test(processes.get(pid)?.commandLine ?? "")
      ? "stack"
      : /preflight\.mjs/u.test(processes.get(pid)?.commandLine ?? "")
        ? "preflight"
        : null;
    if (controlName && (await requestProcessStop(controlName, pid))) {
      console.log(`  - Waiting for previous ${controlName} PID ${pid} to stop gracefully`);
      if (await waitForTakeover(pid)) {
        console.log(`  ok Previous ${controlName} PID ${pid} stopped cleanly`);
        continue;
      }
      console.error(`  ! Previous ${controlName} PID ${pid} did not stop; forcing takeover`);
    }
    try {
      killPid(pid);
      console.log(`  ! Forced previous dev process tree to stop at PID ${pid}`);
    } catch (error) {
      if (isProcessAlive(pid)) throw error;
      console.log(`  ok Previous dev process PID ${pid} already stopped`);
    }
  }

  for (let attempt = 0; attempt < 40; attempt += 1) {
    if (await probePort(port, host)) {
      await waitForPortRelease();
      console.log(`  ok ${host}:${port} is ready\n`);
      return;
    }

    await new Promise((resolveWait) => setTimeout(resolveWait, 250));
  }

  console.error(`  x Port ${port} was not released after stopping the previous process.\n`);
  process.exit(1);
}

async function waitForTakeover(pid) {
  for (let attempt = 0; attempt < 160; attempt += 1) {
    if (!isProcessAlive(pid) && (await probePort(port, host))) return true;
    await new Promise((resolveWait) => setTimeout(resolveWait, 250));
  }
  return false;
}

function probePort(port, host) {
  return new Promise((resolve) => {
    const server = createServer();
    server.once("error", () => resolve(false));
    server.once("listening", () => {
      server.close((error) => resolve(!error));
    });
    server.listen(port, host);
  });
}

function waitForPortRelease() {
  return new Promise((resolveWait) => setTimeout(resolveWait, 100));
}

async function waitForPlatformApi(apiPort) {
  const healthUrl = `http://127.0.0.1:${apiPort}/ready`;
  const startedAt = Date.now();
  let lastStatus = "not reachable";

  console.log(`\n  - Waiting for Platform API at ${healthUrl}`);
  while (Date.now() - startedAt < 90_000) {
    try {
      const response = await fetch(healthUrl, { signal: AbortSignal.timeout(2_000) });
      lastStatus = `HTTP ${response.status}`;
      if (response.ok) {
        console.log("  ok Platform API is ready");
        return;
      }
    } catch (error) {
      lastStatus = error instanceof Error ? error.message : String(error);
    }

    await new Promise((resolveWait) => setTimeout(resolveWait, 500));
  }

  console.error(`  x Platform API did not become healthy: ${lastStatus}`);
  console.error("  x Start it separately with: npm run dev:api\n");
  process.exit(1);
}

function getPidsOnPort(port) {
  try {
    if (process.platform === "win32") {
      const out = execFileSync("netstat", ["-ano", "-p", "tcp"], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"]
      });

      return Array.from(
        new Set(
          out
            .split(/\r?\n/)
            .map((line) => line.trim().split(/\s+/))
            .filter(
              (parts) =>
                parts.length >= 5 && parts[3] === "LISTENING" && portFromAddress(parts[1]) === port
            )
            .map((parts) => Number(parts[4]))
            .filter((pid) => Number.isInteger(pid) && pid > 0 && pid !== process.pid)
        )
      );
    }

    const out = execFileSync("lsof", ["-ti", `:${port}`], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"]
    });

    return Array.from(
      new Set(
        out
          .split(/\s+/)
          .map(Number)
          .filter((pid) => Number.isInteger(pid) && pid > 0 && pid !== process.pid)
      )
    );
  } catch {
    return [];
  }
}

function getProcessSnapshot() {
  try {
    if (process.platform === "win32") {
      const script =
        "Get-CimInstance Win32_Process | Select-Object ProcessId,ParentProcessId,Name,CommandLine | ConvertTo-Json -Compress";
      const output = execFileSync(
        "powershell.exe",
        ["-NoProfile", "-NonInteractive", "-Command", script],
        {
          encoding: "utf8",
          stdio: ["ignore", "pipe", "ignore"]
        }
      );
      const records = JSON.parse(output);
      return new Map(
        [records].flat().map((record) => [
          Number(record.ProcessId),
          {
            commandLine: String(record.CommandLine ?? ""),
            name: String(record.Name ?? ""),
            parentPid: Number(record.ParentProcessId),
            pid: Number(record.ProcessId)
          }
        ])
      );
    }

    const output = execFileSync("ps", ["-ww", "-eo", "pid=,ppid=,comm=,args="], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"]
    });
    return new Map(
      output
        .split(/\r?\n/u)
        .map((line) => line.match(/^\s*(\d+)\s+(\d+)\s+(\S+)\s+(.*)$/u))
        .filter(Boolean)
        .map((match) => [
          Number(match[1]),
          {
            commandLine: match[4],
            name: match[3],
            parentPid: Number(match[2]),
            pid: Number(match[1])
          }
        ])
    );
  } catch {
    return new Map();
  }
}

function portFromAddress(address) {
  const match = String(address).match(/:(\d+)$/);
  return match ? Number(match[1]) : null;
}

function killPid(pid) {
  if (process.platform === "win32") {
    execFileSync("taskkill", ["/PID", String(pid), "/T", "/F"], {
      stdio: ["ignore", "pipe", "pipe"]
    });
    return;
  }

  process.kill(pid, "SIGTERM");
}

function isProcessAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error?.code !== "ESRCH";
  }
}

async function stopChild(childProcess, signal) {
  const childPid = childProcess.pid;
  if (!childPid) return (await waitForStoppedPort()) ? 0 : 1;

  if (app === "platform-api" && (await requestDevApiShutdown(controlFile, controlToken))) {
    console.log("  - Waiting for API requests and shutdown hooks to finish");
    if ((await waitForChildExit(childProcess, 32_000)) && (await waitForStoppedPort())) return 0;
    console.error("  ! API graceful shutdown timed out; forcing process stop");
  } else if (await waitForChildExit(childProcess, 1500)) {
    return (await waitForStoppedPort()) ? 0 : 1;
  }

  if (process.platform === "win32") {
    if (isProcessAlive(childPid)) {
      try {
        killPid(childPid);
      } catch (error) {
        if (isProcessAlive(childPid)) throw error;
      }
    }
  } else if (childPid) {
    try {
      process.kill(-childPid, signal);
    } catch (error) {
      if (error?.code !== "ESRCH") throw error;
    }
    if (await waitForChildExit(childProcess, 1500)) {
      return (await waitForStoppedPort()) ? 0 : 1;
    }
    try {
      process.kill(-childPid, "SIGKILL");
    } catch (error) {
      if (error?.code !== "ESRCH") throw error;
    }
  }

  const exited = await waitForChildExit(childProcess, 3000);
  if (exited && (await waitForStoppedPort())) {
    console.log(`  ! ${config.displayName} required a forced process stop`);
    return 0;
  }
  console.error(`  x ${config.displayName} did not release ${host}:${port} during shutdown.`);
  return 1;
}

function stopCurrentChild(signal) {
  if (activeStop?.child === child) return activeStop.promise;
  const target = child;
  const promise = stopChild(target, signal);
  activeStop = { child: target, promise };
  promise.then(
    () => {
      if (activeStop?.child === target) activeStop = undefined;
    },
    () => {
      if (activeStop?.child === target) activeStop = undefined;
    }
  );
  return promise;
}

function waitForChildExit(childProcess, timeoutMs) {
  if (childProcess.exitCode !== null || childProcess.signalCode !== null)
    return Promise.resolve(true);
  if (timeoutMs === 0) return Promise.resolve(false);
  return new Promise((resolveWait) => {
    const timer = setTimeout(() => {
      childProcess.off("exit", onExit);
      resolveWait(false);
    }, timeoutMs);
    function onExit() {
      clearTimeout(timer);
      resolveWait(true);
    }
    childProcess.once("exit", onExit);
  });
}

async function waitForStoppedPort() {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (await probePort(port, host)) return true;
    await new Promise((resolveWait) => setTimeout(resolveWait, 100));
  }
  return false;
}

function nodePackageBin(packageName, binPath) {
  return resolve(root, "node_modules", packageName, binPath);
}
