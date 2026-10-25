#!/usr/bin/env node

import { spawn, spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { loadDevEnv, requiredDevPort } from "./dev-runtime-env.mjs";
import { startProcessControl } from "./dev-process-control.mjs";

const root = resolve(import.meta.dirname, "..");
const env = loadDevEnv(root);
const qCafeOnly = process.argv.includes("--qcafe-only");
const apiPort = requiredDevPort(
  process.env.PLATFORM_API_PORT ?? env.PLATFORM_API_PORT,
  "PLATFORM_API_PORT"
);
const webPort = requiredDevPort(
  process.env.PLATFORM_WEB_PORT ?? env.PLATFORM_WEB_PORT,
  "PLATFORM_WEB_PORT"
);
const ecommercePort = requiredDevPort(
  process.env.CODEXSUN_ECOMMERCE_WEB_PORT ?? env.CODEXSUN_ECOMMERCE_WEB_PORT,
  "CODEXSUN_ECOMMERCE_WEB_PORT"
);
const uiuxPort = requiredDevPort(
  process.env.CODEXSUN_UIUX_WEB_PORT ?? env.CODEXSUN_UIUX_WEB_PORT,
  "CODEXSUN_UIUX_WEB_PORT"
);
const qCafeApiPort = requiredDevPort(
  process.env.CODEXSUN_QCAFE_API_PORT ?? env.CODEXSUN_QCAFE_API_PORT,
  "CODEXSUN_QCAFE_API_PORT"
);
const qCafeWebPort = requiredDevPort(
  process.env.CODEXSUN_QCAFE_WEB_PORT ?? env.CODEXSUN_QCAFE_WEB_PORT,
  "CODEXSUN_QCAFE_WEB_PORT"
);
const qCafeLocalApiEnabled =
  (process.env.CODEXSUN_TENANCY_MODE ?? env.CODEXSUN_TENANCY_MODE) === "single";
const allServices = {
  ...(qCafeLocalApiEnabled
    ? {
        "qcafe-api": {
          color: "\x1b[33m",
          healthUrl: `http://127.0.0.1:${qCafeApiPort}/health`,
          readyUrl: `http://127.0.0.1:${qCafeApiPort}/health`,
          label: "Q Cafe API",
          readyTimeoutMs: 30_000
        }
      }
    : {}),
  "qcafe-web": {
    color: "\x1b[33m",
    healthUrl: `http://127.0.0.1:${qCafeWebPort}/qcafe/`,
    readyUrl: `http://127.0.0.1:${qCafeWebPort}/qcafe/`,
    label: "Q Cafe web",
    readyTimeoutMs: 30_000
  },
  "uiux-web": {
    color: "\x1b[33m",
    healthUrl: `http://127.0.0.1:${uiuxPort}/`,
    readyUrl: `http://127.0.0.1:${uiuxPort}/`,
    label: "uiux",
    readyTimeoutMs: 30_000
  },
  "ecommerce-web": {
    color: "\x1b[35m",
    healthUrl: `http://127.0.0.1:${ecommercePort}/`,
    readyUrl: `http://127.0.0.1:${ecommercePort}/`,
    label: "ecommerce",
    readyTimeoutMs: 30_000
  },
  "platform-api": {
    color: "\x1b[36m",
    healthUrl: `http://127.0.0.1:${apiPort}/health`,
    readyUrl: `http://127.0.0.1:${apiPort}/ready`,
    label: "api",
    readyTimeoutMs: 90_000
  },
  "platform-web": {
    color: "\x1b[32m",
    healthUrl: `http://127.0.0.1:${webPort}/`,
    readyUrl: `http://127.0.0.1:${webPort}/`,
    label: "web",
    readyTimeoutMs: 30_000
  }
};
const services = qCafeOnly
  ? Object.fromEntries(
      Object.entries(allServices).filter(([name]) => name === "qcafe-api" || name === "qcafe-web")
    )
  : allServices;
const reset = "\x1b[0m";
const runtimes = new Map(
  Object.keys(services).map((serviceName) => [
    serviceName,
    {
      child: null,
      failures: 0,
      restartHistory: [],
      restarting: false
    }
  ])
);
let healthTimer;
let stopping = false;
let shutdownPromise;
let closeControl = async () => {};

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.once(signal, () => void shutdown(0));
}
closeControl = await startProcessControl("stack", () => void shutdown(0));

console.log(qCafeOnly ? "\nQ Cafe development runtime" : "\nCODEXSUN Platform development runtime");

try {
  if (!qCafeOnly) await startAndWait("platform-api");
  if (qCafeLocalApiEnabled) await startAndWait("qcafe-api");
  await startAndWait("qcafe-web");
  if (stopping) await shutdown(0);
  if (!qCafeOnly) {
    await startAndWait("platform-web");
    await startAndWait("ecommerce-web");
    await startAndWait("uiux-web");
  }
  if (stopping) await shutdown(0);
  if (stopping) process.exit(0);
  console.log(
    qCafeOnly
      ? "  ok Q Cafe web is ready"
      : `  ok Platform, Q Cafe, Ecommerce, UIUX, and Project Manager are ready`
  );
  console.log("  - Each service restarts independently after local changes or failures\n");
  monitorStackHealth();
} catch (error) {
  if (!stopping) {
    console.error(`  x ${errorMessage(error)}`);
    await shutdown(1);
  }
}

async function startAndWait(serviceName) {
  if (stopping) return;
  const runtime = runtimes.get(serviceName);
  runtime.restarting = true;
  const child = launchService(serviceName);
  const service = services[serviceName];
  console.log(`  - Waiting for ${service.label}`);
  await waitForPreflight(child, service.label);
  await waitForHealthyUrl(service.readyUrl, service.label, service.readyTimeoutMs, child);
  if (stopping) return;
  runtime.failures = 0;
  runtime.restarting = false;
}

function launchService(serviceName) {
  const service = services[serviceName];
  const runtime = runtimes.get(serviceName);
  const child = spawn(process.execPath, ["tools/preflight.mjs", serviceName], {
    cwd: root,
    env: process.env,
    stdio: ["ignore", "pipe", "pipe", "ipc"]
  });

  runtime.child = child;
  child.stdout.on("data", (chunk) => writeServiceLines(service, chunk));
  child.stderr.on("data", (chunk) => writeServiceLines(service, chunk));
  child.on("exit", (code, signal) => {
    if (runtime.child !== child) return;
    runtime.child = null;
    if (stopping || runtime.restarting) return;
    const reason = signal ? `signal ${signal}` : `code ${code ?? 1}`;
    console.error(`${service.color}[${service.label}]${reset} exited with ${reason}`);
    void restartService(serviceName, "process exit");
  });
  return child;
}

async function restartService(serviceName, reason) {
  const runtime = runtimes.get(serviceName);
  const service = services[serviceName];
  if (stopping || runtime.restarting) return;

  runtime.restarting = true;
  runtime.restartHistory = recentRestarts(runtime.restartHistory);
  if (runtime.restartHistory.length >= 5) {
    console.error(
      `${service.color}[${service.label}]${reset} stopped after five restart attempts in 30 seconds`
    );
    await shutdown(1);
    return;
  }
  runtime.restartHistory.push(Date.now());

  try {
    console.log(`${service.color}[${service.label}]${reset} restarting after ${reason}`);
    await stopServiceChild(runtime.child);
    if (stopping) return;
    await wait(500);
    const child = launchService(serviceName);
    await waitForPreflight(child, service.label);
    await waitForHealthyUrl(service.readyUrl, service.label, service.readyTimeoutMs, child);
    runtime.failures = 0;
    console.log(`${service.color}[${service.label}]${reset} restart complete`);
  } catch (error) {
    console.error(
      `${service.color}[${service.label}]${reset} restart failed: ${errorMessage(error)}`
    );
    runtime.restarting = false;
    if (!stopping) void restartService(serviceName, "failed restart");
    return;
  }

  runtime.restarting = false;
}

function waitForPreflight(child, label) {
  return new Promise((resolveReady, rejectReady) => {
    const timeout = setTimeout(() => finish(new Error(`${label} preflight timed out`)), 90_000);
    function finish(error) {
      clearTimeout(timeout);
      child.off("message", onMessage);
      child.off("exit", onExit);
      if (error) rejectReady(error);
      else resolveReady();
    }
    function onMessage(message) {
      if (message?.type === "codexsun:preflight-ready") finish();
    }
    function onExit(code) {
      finish(new Error(`${label} preflight exited with code ${code ?? 1}`));
    }
    child.on("message", onMessage);
    child.once("exit", onExit);
  });
}

async function waitForHealthyUrl(url, label, timeoutMs, child) {
  const startedAt = Date.now();
  let lastStatus = "not reachable";

  while (!stopping && Date.now() - startedAt < timeoutMs) {
    if (child.exitCode !== null || child.signalCode !== null) {
      throw new Error(`${label} process exited before becoming healthy`);
    }
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(2_000) });
      lastStatus = `HTTP ${response.status}`;
      if (response.ok) return;
    } catch (error) {
      lastStatus = errorMessage(error);
    }

    await wait(500);
  }

  if (stopping) return;
  throw new Error(`${label} did not become healthy: ${lastStatus}`);
}

function monitorStackHealth() {
  let checking = false;
  healthTimer = setInterval(async () => {
    if (checking || stopping) return;
    checking = true;

    try {
      for (const [serviceName, service] of Object.entries(services)) {
        const runtime = runtimes.get(serviceName);
        if (runtime.restarting) continue;

        try {
          const response = await fetch(service.healthUrl, {
            signal: AbortSignal.timeout(2_000)
          });
          runtime.failures = response.ok ? 0 : runtime.failures + 1;
        } catch {
          runtime.failures += 1;
        }

        if (runtime.failures >= 20) {
          runtime.failures = 0;
          void restartService(serviceName, "failed health checks");
        }
      }
    } finally {
      checking = false;
    }
  }, 2_000);
}

function writeServiceLines(service, chunk) {
  for (const rawLine of String(chunk).split(/\r?\n/u)) {
    const line = rawLine.replace(/\u001b\[[0-9;]*m/gu, "").trim();
    if (line) process.stdout.write(`${service.color}[${service.label}]${reset} ${line}\n`);
  }
}

async function shutdown(exitCode) {
  if (shutdownPromise) return shutdownPromise;
  stopping = true;
  if (healthTimer) clearInterval(healthTimer);
  console.log("  - Stopping Platform API and Web");
  shutdownPromise = (async () => {
    const results = await Promise.allSettled(
      Array.from(runtimes.values(), (runtime) => stopServiceChild(runtime.child))
    );
    const failures = results.filter((result) => result.status === "rejected");
    try {
      await closeControl();
    } catch (error) {
      failures.push({ status: "rejected", reason: error });
    }
    for (const failure of failures) console.error(`  x ${errorMessage(failure.reason)}`);
    if (failures.length) console.error("  x Development runtime did not stop cleanly");
    else console.log("  ok Platform API and Web stopped");
    process.exit(failures.length ? 1 : exitCode);
  })();
  return shutdownPromise;
}

async function stopServiceChild(child) {
  if (!child || child.exitCode !== null || child.signalCode !== null || !child.pid) return;

  const exited = waitForExit(child, child.spawnargs.includes("platform-api") ? 35_000 : 3_000);
  if (child.connected) child.send({ type: "codexsun:shutdown" });
  else child.kill("SIGTERM");
  if (await exited) {
    if (child.exitCode !== 0)
      throw new Error(`Development service exited with ${child.exitCode ?? child.signalCode}`);
    return;
  }

  if (process.platform === "win32") {
    spawnSync("taskkill", ["/PID", String(child.pid), "/T", "/F"], { stdio: "ignore" });
  } else {
    child.kill("SIGKILL");
  }
  await waitForExit(child, 3_000);
  throw new Error(`Development service required a forced stop (PID ${child.pid})`);
}

function waitForExit(child, timeoutMs) {
  return new Promise((resolveWait) => {
    if (child.exitCode !== null || child.signalCode !== null) {
      resolveWait(true);
      return;
    }
    const timer = setTimeout(() => {
      child.off("exit", onExit);
      resolveWait(false);
    }, timeoutMs);
    function onExit() {
      clearTimeout(timer);
      resolveWait(true);
    }
    child.once("exit", onExit);
  });
}

function recentRestarts(history) {
  const threshold = Date.now() - 30_000;
  return history.filter((startedAt) => startedAt >= threshold);
}

function wait(milliseconds) {
  return new Promise((resolveWait) => setTimeout(resolveWait, milliseconds));
}

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}
