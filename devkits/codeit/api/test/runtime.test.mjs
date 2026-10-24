import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { execSync } from "node:child_process";
import { createHash } from "node:crypto";

import { pathToFileURL } from "node:url";

// Ensure build output exists before importing
const distPath = resolve(process.cwd(), "dist/devkits/codeit/api/index.js");
if (!existsSync(distPath)) {
  execSync("npx tsc -p devkits/codeit/api/tsconfig.json", { stdio: "inherit" });
}

const { startCodeitApi, CodeitDatabase, runMigrations, codeitContracts } = await import(
  pathToFileURL(distPath).href
);

import { request as httpRequest } from "node:http";

function sendRawRequest(options, bodyData = "") {
  return new Promise((resolvePromise, rejectPromise) => {
    const req = httpRequest(options, (res) => {
      const chunks = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => {
        const raw = Buffer.concat(chunks).toString("utf8");
        let parsed = null;
        try {
          parsed = JSON.parse(raw);
        } catch {
          parsed = raw;
        }
        resolvePromise({
          status: res.statusCode,
          headers: res.headers,
          data: parsed
        });
      });
    });

    req.on("error", rejectPromise);
    if (bodyData) {
      req.write(bodyData);
    }
    req.end();
  });
}

describe("T02: Codeit Local Runtime, Identity, and Storage", () => {
  const testBaseDir = join(tmpdir(), `codeit-runtime-test-${Date.now()}`);
  const storageRoot = join(testBaseDir, "storage");
  const fixtureProjectDir = join(testBaseDir, "fixture-project");
  const testPort = 17071;
  const webPort = 17070;

  let apiInstance = null;
  let pairingToken = "";
  let sessionSlot = "";
  let sessionToken = "";
  let csrfToken = "";
  let registeredProjectUuid = "";
  let createdArtifactUuid = "";

  before(async () => {
    mkdirSync(storageRoot, { recursive: true });
    mkdirSync(fixtureProjectDir, { recursive: true });
    writeFileSync(join(fixtureProjectDir, "index.txt"), "hello codeit", "utf8");

    // Start standalone Codeit API server
    apiInstance = await startCodeitApi({
      port: testPort,
      webPort: webPort,
      storageRoot: storageRoot,
      inMemoryDb: false
    });

    pairingToken = apiInstance.pairingManager.getPairingToken();
  });

  after(async () => {
    if (apiInstance) {
      await apiInstance.close();
    }
    if (existsSync(testBaseDir)) {
      rmSync(testBaseDir, { recursive: true, force: true });
    }
  });

  describe("1. Standalone Startup & Port Safety", () => {
    test("starts without Platform and responds to health check with loopback host", async () => {
      const res = await fetch(`http://127.0.0.1:${testPort}/api/codeit/health`, {
        headers: {
          host: `127.0.0.1:${testPort}`
        }
      });

      assert.equal(res.status, 200);
      const body = await res.json();
      assert.equal(body.success, true);
      assert.equal(body.data.status, "ok");
      assert.equal(body.data.port, testPort);
      assert.ok(body.correlation_id.startsWith("c0de17-"));
    });

    test("refuses to bind when port is already occupied", async () => {
      await assert.rejects(
        async () => {
          await startCodeitApi({
            port: testPort,
            inMemoryDb: true
          });
        },
        (err) => {
          assert.match(err.message, /already in use or unavailable/);
          return true;
        }
      );
    });
  });

  describe("2. Host Security and Origin Validation", () => {
    test("rejects DNS rebinding / non-loopback Host header with 403 CODEIT_HOST_FORBIDDEN", async () => {
      const res = await sendRawRequest({
        host: "127.0.0.1",
        port: testPort,
        path: "/api/codeit/health",
        method: "GET",
        headers: {
          Host: `attacker.com:${testPort}`
        }
      });

      assert.equal(res.status, 403);
      assert.equal(res.data.success, false);
      assert.equal(res.data.error.code, "CODEIT_HOST_FORBIDDEN");
      assert.match(res.data.error.message, /Host rebinding or non-loopback host rejected/);
    });

    test("rejects untrusted Origin header with 403 CODEIT_HOST_FORBIDDEN", async () => {
      const res = await fetch(`http://127.0.0.1:${testPort}/api/codeit/health`, {
        headers: {
          host: `127.0.0.1:${testPort}`,
          origin: "http://malicious-website.com"
        }
      });

      assert.equal(res.status, 403);
      const body = await res.json();
      assert.equal(body.success, false);
      assert.equal(body.error.code, "CODEIT_HOST_FORBIDDEN");
      assert.match(body.error.message, /Unauthorized origin rejected/);
    });

    test("accepts trusted loopback Origin and sets CORS headers", async () => {
      const res = await fetch(`http://127.0.0.1:${testPort}/api/codeit/health`, {
        headers: {
          host: `127.0.0.1:${testPort}`,
          origin: `http://127.0.0.1:${webPort}`
        }
      });

      assert.equal(res.status, 200);
      assert.equal(res.headers.get("access-control-allow-origin"), `http://127.0.0.1:${webPort}`);
      assert.equal(res.headers.get("access-control-allow-credentials"), "true");
    });
  });

  describe("3. Pairing Authentication & CSRF Validation", () => {
    test("rejects invalid pairing token with 401 CODEIT_UNAUTHORIZED", async () => {
      const res = await fetch(`http://127.0.0.1:${testPort}/api/codeit/pairing`, {
        method: "POST",
        headers: {
          host: `127.0.0.1:${testPort}`,
          "content-type": "application/json"
        },
        body: JSON.stringify({ pairing_token: "invalid-token-123456" })
      });

      assert.equal(res.status, 401);
      const body = await res.json();
      assert.equal(body.success, false);
      assert.equal(body.error.code, "CODEIT_UNAUTHORIZED");
    });

    test("completes pairing with valid token and returns session_slot and csrf_token", async () => {
      const res = await fetch(`http://127.0.0.1:${testPort}/api/codeit/pairing`, {
        method: "POST",
        headers: {
          host: `127.0.0.1:${testPort}`,
          "content-type": "application/json"
        },
        body: JSON.stringify({ pairing_token: pairingToken })
      });

      assert.equal(res.status, 200);
      const setCookie = res.headers.get("set-cookie");
      assert.ok(setCookie, "Must set session cookie");
      assert.match(setCookie, /codexsun_codeit_session=[0-9a-f]{64}/);
      assert.match(setCookie, /HttpOnly/i);
      assert.match(setCookie, /SameSite=Strict/i);

      // Extract session token from cookie
      const match = setCookie.match(/codexsun_codeit_session=([0-9a-f]+)/);
      assert.ok(match);
      sessionToken = match[1];

      const body = await res.json();
      assert.equal(body.success, true);
      assert.match(body.data.session_slot, /^[0-9a-f]{8}$/);
      assert.match(body.data.csrf_token, /^[0-9a-f]{32}$/);

      sessionSlot = body.data.session_slot;
      csrfToken = body.data.csrf_token;
      assert.ok(sessionSlot);
    });

    test("denies protected GET endpoint without session or pairing auth with 401", async () => {
      const res = await fetch(`http://127.0.0.1:${testPort}/api/codeit/projects`, {
        headers: {
          host: `127.0.0.1:${testPort}`
        }
      });

      assert.equal(res.status, 401);
      const body = await res.json();
      assert.equal(body.success, false);
      assert.equal(body.error.code, "CODEIT_UNAUTHORIZED");
    });

    test("allows protected GET endpoint with session cookie", async () => {
      const res = await fetch(`http://127.0.0.1:${testPort}/api/codeit/projects`, {
        headers: {
          host: `127.0.0.1:${testPort}`,
          cookie: `codexsun_codeit_session=${sessionToken}`
        }
      });

      assert.equal(res.status, 200);
      const body = await res.json();
      assert.equal(body.success, true);
      assert.ok(Array.isArray(body.data.items));
    });

    test("denies mutation without CSRF token with 403 CODEIT_CSRF_MISMATCH", async () => {
      const res = await fetch(`http://127.0.0.1:${testPort}/api/codeit/projects`, {
        method: "POST",
        headers: {
          host: `127.0.0.1:${testPort}`,
          cookie: `codexsun_codeit_session=${sessionToken}`,
          "content-type": "application/json"
        },
        body: JSON.stringify({ name: "Denial Test", root_path: fixtureProjectDir })
      });

      assert.equal(res.status, 403);
      const body = await res.json();
      assert.equal(body.success, false);
      assert.equal(body.error.code, "CODEIT_CSRF_MISMATCH");
    });

    test("denies mutation with invalid CSRF token with 403 CODEIT_CSRF_MISMATCH", async () => {
      const res = await fetch(`http://127.0.0.1:${testPort}/api/codeit/projects`, {
        method: "POST",
        headers: {
          host: `127.0.0.1:${testPort}`,
          cookie: `codexsun_codeit_session=${sessionToken}`,
          "x-codeit-csrf": "wrong-csrf-token",
          "content-type": "application/json"
        },
        body: JSON.stringify({ name: "Denial Test", root_path: fixtureProjectDir })
      });

      assert.equal(res.status, 403);
      const body = await res.json();
      assert.equal(body.success, false);
      assert.equal(body.error.code, "CODEIT_CSRF_MISMATCH");
    });
  });

  describe("4. Project Module Lifecycle & Canonical Path Validation", () => {
    test("rejects project registration with non-existent root path (400 CODEIT_PATH_DENIED)", async () => {
      const res = await fetch(`http://127.0.0.1:${testPort}/api/codeit/projects`, {
        method: "POST",
        headers: {
          host: `127.0.0.1:${testPort}`,
          cookie: `codexsun_codeit_session=${sessionToken}`,
          "x-codeit-csrf": csrfToken,
          "content-type": "application/json"
        },
        body: JSON.stringify({
          name: "Non-existent Project",
          root_path: join(testBaseDir, "does-not-exist")
        })
      });

      assert.equal(res.status, 400);
      const body = await res.json();
      assert.equal(body.success, false);
      assert.equal(body.error.code, "CODEIT_PATH_DENIED");
    });

    test("registers project with valid canonical path and returns ProjectRecord", async () => {
      const res = await fetch(`http://127.0.0.1:${testPort}/api/codeit/projects`, {
        method: "POST",
        headers: {
          host: `127.0.0.1:${testPort}`,
          cookie: `codexsun_codeit_session=${sessionToken}`,
          "x-codeit-csrf": csrfToken,
          "content-type": "application/json"
        },
        body: JSON.stringify({
          name: "Fixture Project",
          root_path: fixtureProjectDir
        })
      });

      assert.equal(res.status, 200);
      const body = await res.json();
      assert.equal(body.success, true);
      assert.match(body.data.uuid, /^[0-9a-f]{8}$/);
      assert.equal(body.data.name, "Fixture Project");
      assert.equal(body.data.trust_state, "untrusted");
      assert.equal(body.data.policy_revision, "1.0.0");
      assert.ok(body.data.created_at);

      registeredProjectUuid = body.data.uuid;

      // Validate against frozen contract schema
      codeitContracts.ProjectSchema.parse(body.data);
    });

    test("rejects duplicate project registration for the same canonical root (409 CODEIT_INVALID_STATE)", async () => {
      const res = await fetch(`http://127.0.0.1:${testPort}/api/codeit/projects`, {
        method: "POST",
        headers: {
          host: `127.0.0.1:${testPort}`,
          cookie: `codexsun_codeit_session=${sessionToken}`,
          "x-codeit-csrf": csrfToken,
          "content-type": "application/json"
        },
        body: JSON.stringify({
          name: "Duplicate Project Attempt",
          root_path: fixtureProjectDir
        })
      });

      assert.equal(res.status, 409);
      const body = await res.json();
      assert.equal(body.success, false);
      assert.equal(body.error.code, "CODEIT_INVALID_STATE");
      assert.match(body.error.message, /already registered/);
    });

    test("lists registered projects including newly added project", async () => {
      const res = await fetch(`http://127.0.0.1:${testPort}/api/codeit/projects`, {
        headers: {
          host: `127.0.0.1:${testPort}`,
          cookie: `codexsun_codeit_session=${sessionToken}`
        }
      });

      assert.equal(res.status, 200);
      const body = await res.json();
      assert.equal(body.success, true);
      assert.ok(body.data.items.length >= 1);
      const found = body.data.items.find((p) => p.uuid === registeredProjectUuid);
      assert.ok(found);
      assert.equal(found.name, "Fixture Project");
    });

    test("retrieves project by UUID", async () => {
      const res = await fetch(
        `http://127.0.0.1:${testPort}/api/codeit/projects/${registeredProjectUuid}`,
        {
          headers: {
            host: `127.0.0.1:${testPort}`,
            cookie: `codexsun_codeit_session=${sessionToken}`
          }
        }
      );

      assert.equal(res.status, 200);
      const body = await res.json();
      assert.equal(body.success, true);
      assert.equal(body.data.uuid, registeredProjectUuid);
    });

    test("returns 404 CODEIT_NOT_FOUND for unknown project UUID", async () => {
      const res = await fetch(`http://127.0.0.1:${testPort}/api/codeit/projects/ffffffff`, {
        headers: {
          host: `127.0.0.1:${testPort}`,
          cookie: `codexsun_codeit_session=${sessionToken}`
        }
      });

      assert.equal(res.status, 404);
      const body = await res.json();
      assert.equal(body.success, false);
      assert.equal(body.error.code, "CODEIT_NOT_FOUND");
    });
  });

  describe("5. Artifact Module: Storage, Hashing, and Streaming", () => {
    const artifactContent = "# Plan Artifact\n1. Analyze requirements\n2. Implement tests";
    const expectedHash = createHash("sha256")
      .update(Buffer.from(artifactContent, "utf8"))
      .digest("hex");

    test("creates artifact, writes to disk with content hash, and returns ArtifactRecord", async () => {
      const res = await fetch(`http://127.0.0.1:${testPort}/api/codeit/artifacts`, {
        method: "POST",
        headers: {
          host: `127.0.0.1:${testPort}`,
          cookie: `codexsun_codeit_session=${sessionToken}`,
          "x-codeit-csrf": csrfToken,
          "content-type": "application/json"
        },
        body: JSON.stringify({
          artifact_type: "plan",
          content: artifactContent,
          media_type: "text/markdown",
          provenance: { source: "T02-test" }
        })
      });

      assert.equal(res.status, 200);
      const body = await res.json();
      assert.equal(body.success, true);
      assert.match(body.data.uuid, /^[0-9a-f]{8}$/);
      assert.equal(body.data.content_hash, expectedHash);
      assert.equal(body.data.byte_size, Buffer.byteLength(artifactContent, "utf8"));
      assert.equal(body.data.artifact_type, "plan");
      assert.equal(body.data.media_type, "text/markdown");

      createdArtifactUuid = body.data.uuid;

      // Validate against frozen contract schema
      codeitContracts.ArtifactSchema.parse(body.data);

      // Verify physical disk file exists under storage root
      const onDiskPath = join(storageRoot, "artifacts", `${expectedHash}.bin`);
      assert.equal(existsSync(onDiskPath), true);
    });

    test("downloads/streams artifact by UUID with matching binary content and headers", async () => {
      const res = await fetch(
        `http://127.0.0.1:${testPort}/api/codeit/artifacts/${createdArtifactUuid}`,
        {
          headers: {
            host: `127.0.0.1:${testPort}`,
            cookie: `codexsun_codeit_session=${sessionToken}`
          }
        }
      );

      assert.equal(res.status, 200);
      assert.equal(res.headers.get("content-type"), "text/markdown");
      assert.equal(res.headers.get("x-content-hash"), expectedHash);
      assert.equal(
        Number(res.headers.get("content-length")),
        Buffer.byteLength(artifactContent, "utf8")
      );

      const content = await res.text();
      assert.equal(content, artifactContent);
    });

    test("returns 404 CODEIT_NOT_FOUND for non-existent artifact UUID", async () => {
      const res = await fetch(`http://127.0.0.1:${testPort}/api/codeit/artifacts/00000000`, {
        headers: {
          host: `127.0.0.1:${testPort}`,
          cookie: `codexsun_codeit_session=${sessionToken}`
        }
      });

      assert.equal(res.status, 404);
      const body = await res.json();
      assert.equal(body.success, false);
      assert.equal(body.error.code, "CODEIT_NOT_FOUND");
    });
  });

  describe("6. Storage Migrations & Upgrades with Retained Data", () => {
    test("runs migrations idempotently and retains existing database records on reload", () => {
      const testDbPath = join(testBaseDir, "retained-test.db");

      // Initial run
      const db1 = new CodeitDatabase({ dbPath: testDbPath });
      const res1 = runMigrations(db1.db);
      assert.ok(res1.applied.length > 0);
      assert.equal(res1.alreadyApplied.length, 0);

      // Insert test project
      const now = new Date().toISOString();
      db1.db
        .prepare(
          `
        INSERT INTO codeit_projects (uuid, name, root_path, trust_state, policy_revision, created_at, updated_at)
        VALUES ('11223344', 'Retained Test', 'D:\\workspace\\retained', 'trusted', '1.0.0', ?, ?)
      `
        )
        .run(now, now);
      db1.close();

      // Second run: upgrade / reload
      const db2 = new CodeitDatabase({ dbPath: testDbPath });
      const res2 = runMigrations(db2.db);
      assert.equal(res2.applied.length, 0);
      assert.ok(res2.alreadyApplied.length > 0);

      const row = db2.db.prepare("SELECT * FROM codeit_projects WHERE uuid = ?").get("11223344");
      assert.ok(row);
      assert.equal(row.name, "Retained Test");
      assert.equal(row.trust_state, "trusted");
      db2.close();
    });
  });
});
