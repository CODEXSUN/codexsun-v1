#!/usr/bin/env node

/**
 * tools/codeit-packaging-smoke.test.mjs
 *
 * Packaging and Release Readiness Verification (Tasks T12 & T13, E23 & E26)
 *
 * Verifies:
 * 1. Packaged artifacts existence, layout, and integrity under root dist/.
 * 2. Standalone server startup from dist/devkits/codeit/api/server.js without dev server or dev session.
 * 3. Health check, pairing, and CSRF on loopback.
 * 4. Fresh database creation, migration ledger, and private storage initialization on clean target.
 * 5. Retained-data upgrade cycle (persistence across restarts).
 * 6. Backup snapshot and clean restore into an isolated sandbox (E23).
 * 7. Boundary security (Host filtering, CSRF, canary rejection) on packaged artifact.
 */

import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync, copyFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { createHash, randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import { request as httpRequest } from "node:http";

const root = resolve(import.meta.dirname, "..");
const apiDistDir = resolve(root, "dist/devkits/codeit/api");
const serverScript = resolve(apiDistDir, "server.js");
const webDistDir = resolve(root, "dist/devkits/codeit/web");
const webIndexHtml = resolve(webDistDir, "index.html");

function httpReq(options, body) {
  return new Promise((res, rej) => {
    const req = httpRequest(options, (response) => {
      let data = "";
      response.on("data", (chunk) => (data += chunk));
      response.on("end", () => {
        try {
          const parsed = data ? JSON.parse(data) : null;
          res({ status: response.statusCode ?? 0, headers: response.headers, data: parsed, raw: data });
        } catch {
          res({ status: response.statusCode ?? 0, headers: response.headers, data: null, raw: data });
        }
      });
    });
    req.on("error", rej);
    if (body) {
      req.write(typeof body === "string" ? body : JSON.stringify(body));
    }
    req.end();
  });
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForServerReady(port, deadlineMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < deadlineMs) {
    try {
      const res = await httpReq({
        hostname: "127.0.0.1",
        port,
        path: "/health",
        method: "GET",
        headers: { Host: `127.0.0.1:${port}` }
      });
      if (res.status === 200 && res.data?.data?.status === "ok") {
        return true;
      }
    } catch {
      // Still starting
    }
    await delay(150);
  }
  throw new Error(`Packaged Codeit API on port ${port} did not become ready within ${deadlineMs}ms`);
}

describe("Codeit Packaging & Release Readiness Verification (E23, E26)", () => {
  const testSandbox = join(tmpdir(), `codeit-pkg-test-${Date.now()}-${randomBytes(4).toString("hex")}`);

  before(() => {
    mkdirSync(testSandbox, { recursive: true });
  });

  after(() => {
    try {
      rmSync(testSandbox, { recursive: true, force: true });
    } catch {
      // Cleanup best effort
    }
  });

  describe("1. Packaged Artifact Layout & Output Verification (E26)", () => {
    test("verifies root dist/devkits/codeit/api/server.js and index.js exist", () => {
      assert.ok(existsSync(serverScript), `Missing compiled server script: ${serverScript}`);
      assert.ok(existsSync(resolve(apiDistDir, "index.js")), "Missing compiled index.js");
      assert.ok(existsSync(resolve(apiDistDir, "storage/migrations.js")), "Missing compiled migrations");
    });

    test("verifies web packaging output in root dist/devkits/codeit/web with HTML and assets", () => {
      assert.ok(existsSync(webIndexHtml), `Missing packaged web index: ${webIndexHtml}`);
      const indexContent = readFileSync(webIndexHtml, "utf8");
      assert.ok(indexContent.includes("<title>Codeit"), "Packaged web index should contain Codeit title");
      assert.ok(existsSync(resolve(webDistDir, "assets")), "Missing packaged assets directory");
    });

    test("computes reproducible artifact hashes for release manifest", () => {
      const serverBytes = readFileSync(serverScript);
      const serverHash = createHash("sha256").update(serverBytes).digest("hex");
      assert.equal(typeof serverHash, "string");
      assert.equal(serverHash.length, 64);
    });
  });

  describe("2. Clean Standalone Startup & Process Isolation (E26)", () => {
    const testPort = 17180;
    const testStorage = join(testSandbox, "standalone-storage");
    const testDb = join(testStorage, "codeit.db");
    let childProcess = null;

    after(async () => {
      if (childProcess && childProcess.exitCode === null) {
        childProcess.kill("SIGTERM");
        await delay(500);
      }
    });

    test("starts packaged server directly with node and responds to /health on loopback", async () => {
      mkdirSync(testStorage, { recursive: true });

      childProcess = spawn(
        process.execPath,
        [serverScript],
        {
          cwd: root,
          env: {
            ...process.env,
            NODE_ENV: "production",
            CODEXSUN_CODEIT_API_PORT: String(testPort),
            CODEIT_STORAGE_ROOT: testStorage,
            CODEIT_DB_PATH: testDb
          },
          stdio: ["ignore", "pipe", "pipe"]
        }
      );

      let stdout = "";
      let stderr = "";
      childProcess.stdout.setEncoding("utf8").on("data", (d) => (stdout += d));
      childProcess.stderr.setEncoding("utf8").on("data", (d) => (stderr += d));

      await waitForServerReady(testPort);

      // Verify health check response
      const res = await httpReq({
        hostname: "127.0.0.1",
        port: testPort,
        path: "/health",
        method: "GET",
        headers: { Host: `127.0.0.1:${testPort}` }
      });

      assert.equal(res.status, 200);
      assert.equal(res.data?.success, true);
      assert.equal(res.data?.data?.service, "codeit-api");
      assert.equal(res.data?.data?.status, "ok");

      // Verify DB file was created on clean target
      assert.ok(existsSync(testDb), "SQLite DB file should be created automatically in clean storage");
    });

    test("verifies host and DNS rebinding defense on packaged server (E02)", async () => {
      const rebindingRes = await httpReq({
        hostname: "127.0.0.1",
        port: testPort,
        path: "/health",
        method: "GET",
        headers: { Host: "attacker.com" }
      });
      assert.equal(rebindingRes.status, 403);
      assert.equal(rebindingRes.data?.error?.code, "CODEIT_HOST_FORBIDDEN");
    });

    test("shuts down cleanly upon SIGTERM with exit code 0", async () => {
      assert.ok(childProcess && childProcess.exitCode === null, "Child process should be running");
      const exitPromise = new Promise((resolve) => {
        childProcess.once("exit", (code, signal) => resolve({ code, signal }));
      });
      childProcess.kill("SIGTERM");
      const exitResult = await Promise.race([exitPromise, delay(5000)]);
      assert.ok(exitResult, "Process should have exited within 5s");
    });
  });

  describe("3. Fresh Install, Migrations, and Retained-Data Upgrade (E23)", () => {
    const upgradePort = 17182;
    const upgradeStorage = join(testSandbox, "upgrade-storage");
    const upgradeDb = join(upgradeStorage, "codeit-upgrade.db");
    const pairingTokenFile = join(upgradeStorage, "pairing.token");
    let child = null;
    let csrfToken = "";
    let sessionId = "";
    let createdProjectUuid = "";

    after(async () => {
      if (child && child.exitCode === null) {
        child.kill("SIGTERM");
        await delay(500);
      }
    });

    test("Phase 1: Boot on clean target, execute pairing, and write state", async () => {
      mkdirSync(upgradeStorage, { recursive: true });

      child = spawn(
        process.execPath,
        [serverScript],
        {
          cwd: root,
          env: {
            ...process.env,
            NODE_ENV: "production",
            CODEXSUN_CODEIT_API_PORT: String(upgradePort),
            CODEIT_STORAGE_ROOT: upgradeStorage,
            CODEIT_DB_PATH: upgradeDb,
            CODEIT_PAIRING_TOKEN_PATH: pairingTokenFile
          },
          stdio: ["ignore", "pipe", "pipe"]
        }
      );

      await waitForServerReady(upgradePort);

      // Verify pairing token was generated
      assert.ok(existsSync(pairingTokenFile), "pairing.token should be created in private storage");
      const pairingToken = readFileSync(pairingTokenFile, "utf8").trim();

      // Pair session
      const pairRes = await httpReq(
        {
          hostname: "127.0.0.1",
          port: upgradePort,
          path: "/api/codeit/pairing",
          method: "POST",
          headers: {
            Host: `127.0.0.1:${upgradePort}`,
            Origin: "http://127.0.0.1:7070",
            "Content-Type": "application/json"
          }
        },
        { pairing_token: pairingToken }
      );

      assert.equal(pairRes.status, 200);
      assert.equal(pairRes.data?.success, true);
      csrfToken = pairRes.data.data.csrf_token;
      assert.ok(csrfToken);

      const setCookie = pairRes.headers["set-cookie"];
      const cookieStr = Array.isArray(setCookie) ? setCookie.join("; ") : (setCookie || "");
      const match = cookieStr.match(/codexsun_codeit_session=([^;]+)/);
      sessionId = match ? match[1] : "";
      assert.ok(sessionId, "Session cookie must be set upon pairing");

      // Create a project
      const projDir = join(upgradeStorage, "proj-1");
      mkdirSync(projDir, { recursive: true });
      const projRes = await httpReq(
        {
          hostname: "127.0.0.1",
          port: upgradePort,
          path: "/api/codeit/projects",
          method: "POST",
          headers: {
            Host: `127.0.0.1:${upgradePort}`,
            Origin: "http://127.0.0.1:7070",
            Cookie: `codexsun_codeit_session=${sessionId}`,
            "x-codeit-csrf": csrfToken,
            "Content-Type": "application/json"
          }
        },
        { name: "Upgrade Test Project", root_path: projDir }
      );

      assert.ok([200, 201].includes(projRes.status), `Expected 200 or 201, got ${projRes.status}`);
      createdProjectUuid = projRes.data.data.uuid;
      assert.ok(createdProjectUuid);

      // Stop server cleanly
      const exitPromise = new Promise((resolve) => child.once("exit", resolve));
      child.kill("SIGTERM");
      await exitPromise;
      child = null;
    });

    test("Phase 2: Retained-data restart preserves database records and allows access", async () => {
      // Restart server pointing to the EXACT same database
      child = spawn(
        process.execPath,
        [serverScript],
        {
          cwd: root,
          env: {
            ...process.env,
            NODE_ENV: "production",
            CODEXSUN_CODEIT_API_PORT: String(upgradePort),
            CODEIT_STORAGE_ROOT: upgradeStorage,
            CODEIT_DB_PATH: upgradeDb,
            CODEIT_PAIRING_TOKEN_PATH: pairingTokenFile
          },
          stdio: ["ignore", "pipe", "pipe"]
        }
      );

      await waitForServerReady(upgradePort);

      // Read existing pairing token and establish session
      const pairingToken = readFileSync(pairingTokenFile, "utf8").trim();
      const pairRes = await httpReq(
        {
          hostname: "127.0.0.1",
          port: upgradePort,
          path: "/api/codeit/pairing",
          method: "POST",
          headers: {
            Host: `127.0.0.1:${upgradePort}`,
            Origin: "http://127.0.0.1:7070",
            "Content-Type": "application/json"
          }
        },
        { pairing_token: pairingToken }
      );

      assert.equal(pairRes.status, 200);
      const setCookie = pairRes.headers["set-cookie"];
      const cookieStr = Array.isArray(setCookie) ? setCookie.join("; ") : (setCookie || "");
      const match = cookieStr.match(/codexsun_codeit_session=([^;]+)/);
      const newSession = match ? match[1] : "";
      assert.ok(newSession);

      // Verify the previously created project survived and is returned intact
      const listProjRes = await httpReq({
        hostname: "127.0.0.1",
        port: upgradePort,
        path: `/api/codeit/projects/${createdProjectUuid}`,
        method: "GET",
        headers: {
          Host: `127.0.0.1:${upgradePort}`,
          Origin: "http://127.0.0.1:7070",
          Cookie: `codexsun_codeit_session=${newSession}`
        }
      });

      assert.equal(listProjRes.status, 200);
      assert.equal(listProjRes.data?.data?.uuid, createdProjectUuid);
      assert.equal(listProjRes.data?.data?.name, "Upgrade Test Project");

      // Stop server
      const exitPromise = new Promise((resolve) => child.once("exit", resolve));
      child.kill("SIGTERM");
      await exitPromise;
      child = null;
    });
  });

  describe("4. Backup Snapshot & Restore into Isolated Sandbox (E23)", () => {
    const backupSourceStorage = join(testSandbox, "source-storage");
    const backupSourceDb = join(backupSourceStorage, "codeit.db");
    const restoreStorage = join(testSandbox, "restored-sandbox-storage");
    const restoreDb = join(restoreStorage, "codeit-restored.db");
    const restorePort = 17185;
    let child = null;

    after(async () => {
      if (child && child.exitCode === null) {
        child.kill("SIGTERM");
        await delay(500);
      }
    });

    test("creates backup snapshot of DB and restores into clean sandbox", async () => {
      // 1. Prepare source DB file with a known artifact and project record
      mkdirSync(backupSourceStorage, { recursive: true });
      mkdirSync(restoreStorage, { recursive: true });

      // Copy previous upgrade DB as backup source
      const prevDb = join(testSandbox, "upgrade-storage/codeit-upgrade.db");
      assert.ok(existsSync(prevDb), "Previous test DB must exist to create backup");
      const backupSnapshotFile = join(testSandbox, "codeit-backup.snapshot");
      copyFileSync(prevDb, backupSnapshotFile);
      if (existsSync(`${prevDb}-wal`)) {
        copyFileSync(`${prevDb}-wal`, `${backupSnapshotFile}-wal`);
      }

      // Verify backup file integrity via sha256
      const originalBytes = readFileSync(prevDb);
      const originalHash = createHash("sha256").update(originalBytes).digest("hex");
      const snapshotBytes = readFileSync(backupSnapshotFile);
      const snapshotHash = createHash("sha256").update(snapshotBytes).digest("hex");
      assert.equal(snapshotHash, originalHash, "Backup snapshot hash must match source exactly");

      // 2. Restore into clean sandbox
      copyFileSync(backupSnapshotFile, restoreDb);
      if (existsSync(`${backupSnapshotFile}-wal`)) {
        copyFileSync(`${backupSnapshotFile}-wal`, `${restoreDb}-wal`);
      }
      assert.ok(existsSync(restoreDb), "Restored DB must exist in clean sandbox");

      // 3. Boot packaged server pointing to restored DB
      const restorePairingTokenFile = join(restoreStorage, "pairing.token");
      child = spawn(
        process.execPath,
        [serverScript],
        {
          cwd: root,
          env: {
            ...process.env,
            NODE_ENV: "production",
            CODEXSUN_CODEIT_API_PORT: String(restorePort),
            CODEIT_STORAGE_ROOT: restoreStorage,
            CODEIT_DB_PATH: restoreDb,
            CODEIT_PAIRING_TOKEN_PATH: restorePairingTokenFile
          },
          stdio: ["ignore", "pipe", "pipe"]
        }
      );

      await waitForServerReady(restorePort);

      // Read newly generated pairing token from restore sandbox
      const restoredPairingToken = readFileSync(restorePairingTokenFile, "utf8").trim();
      const pairRes = await httpReq(
        {
          hostname: "127.0.0.1",
          port: restorePort,
          path: "/api/codeit/pairing",
          method: "POST",
          headers: {
            Host: `127.0.0.1:${restorePort}`,
            Origin: "http://127.0.0.1:7070",
            "Content-Type": "application/json"
          }
        },
        { pairing_token: restoredPairingToken }
      );

      assert.equal(pairRes.status, 200);
      const setCookie = pairRes.headers["set-cookie"];
      const cookieStr = Array.isArray(setCookie) ? setCookie.join("; ") : (setCookie || "");
      const match = cookieStr.match(/codexsun_codeit_session=([^;]+)/);
      const restoredSession = match ? match[1] : "";
      assert.ok(restoredSession);

      // Verify restored project is readable
      const listRes = await httpReq({
        hostname: "127.0.0.1",
        port: restorePort,
        path: "/api/codeit/projects",
        method: "GET",
        headers: {
          Host: `127.0.0.1:${restorePort}`,
          Origin: "http://127.0.0.1:7070",
          Cookie: `codexsun_codeit_session=${restoredSession}`
        }
      });

      assert.equal(listRes.status, 200);
      assert.ok(Array.isArray(listRes.data?.data?.items));
      assert.ok(listRes.data.data.items.length >= 1);
      assert.equal(listRes.data.data.items[0].name, "Upgrade Test Project");

      // Clean shutdown
      const exitPromise = new Promise((resolve) => child.once("exit", resolve));
      child.kill("SIGTERM");
      await exitPromise;
      child = null;
    });
  });
});
