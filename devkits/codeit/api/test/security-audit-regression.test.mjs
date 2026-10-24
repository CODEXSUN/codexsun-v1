import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { request as httpRequest } from "node:http";
import { pathToFileURL } from "node:url";

const distPath = resolve(process.cwd(), "dist/devkits/codeit/api/index.js");

const { startCodeitApi } = await import(pathToFileURL(distPath).href);

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

describe("Security Audit Finding A1 Regression Suite", () => {
  const testBaseDir = join(tmpdir(), `codeit-sec-audit-${Date.now()}`);
  const storageRoot = join(testBaseDir, "storage");
  const untrustedProjectDir = join(testBaseDir, "untrusted-project");
  const trustedProjectDir = join(testBaseDir, "trusted-project");
  const outsideSecretDir = join(testBaseDir, "outside-secret-area");

  const outsideSecretFile = join(outsideSecretDir, "outside-canary.key");
  const outsideSecretContent = "CANARY_SECRET_EXT_AUDIT_998877";

  const attackOutputFile = join(untrustedProjectDir, "attacker-output.txt");

  let serverInstance;
  let serverPort;
  let sessionCookie;
  let csrfToken;

  let untrustedProjectUuid;
  let trustedProjectUuid;

  let planRunUuid;
  let cancelledRunUuid;

  before(async () => {
    mkdirSync(storageRoot, { recursive: true });
    mkdirSync(untrustedProjectDir, { recursive: true });
    mkdirSync(trustedProjectDir, { recursive: true });
    mkdirSync(outsideSecretDir, { recursive: true });

    // Seed fixture files
    writeFileSync(join(untrustedProjectDir, "index.js"), "console.log('untrusted');", "utf8");
    writeFileSync(join(trustedProjectDir, "index.js"), "console.log('trusted');", "utf8");
    writeFileSync(outsideSecretFile, outsideSecretContent, "utf8");

    // Start server on ephemeral port (port: 0)
    serverInstance = await startCodeitApi({
      port: 0,
      storageRoot,
      inMemoryDb: true
    });

    serverPort = serverInstance.port;
    const pairingToken = serverInstance.pairingManager.getPairingToken();

    // a. Pair normally to get session and CSRF
    const pairingRes = await sendRawRequest(
      {
        hostname: "127.0.0.1",
        port: serverPort,
        path: "/api/codeit/pairing",
        method: "POST",
        headers: {
          Host: `127.0.0.1:${serverPort}`,
          "Content-Type": "application/json"
        }
      },
      JSON.stringify({ pairing_token: pairingToken })
    );

    assert.strictEqual(pairingRes.status, 200);
    assert.strictEqual(pairingRes.data.success, true);
    csrfToken = pairingRes.data.data.csrf_token;
    const setCookie = pairingRes.headers["set-cookie"];
    assert.ok(setCookie);
    sessionCookie = setCookie[0].split(";")[0];
    assert.ok(sessionCookie.startsWith("codexsun_codeit_session="));

    // b. Register an UNTRUSTED project
    const untrustedRes = await sendRawRequest(
      {
        hostname: "127.0.0.1",
        port: serverPort,
        path: "/api/codeit/projects",
        method: "POST",
        headers: {
          Host: `127.0.0.1:${serverPort}`,
          Cookie: sessionCookie,
          "x-codeit-csrf": csrfToken,
          "Content-Type": "application/json"
        }
      },
      JSON.stringify({
        name: "Auditor Untrusted Project",
        root_path: untrustedProjectDir,
        trust_state: "untrusted"
      })
    );

    assert.strictEqual(untrustedRes.status, 200);
    assert.strictEqual(untrustedRes.data.data.trust_state, "untrusted");
    untrustedProjectUuid = untrustedRes.data.data.uuid;

    // Also register a TRUSTED project for baseline comparisons
    const trustedRes = await sendRawRequest(
      {
        hostname: "127.0.0.1",
        port: serverPort,
        path: "/api/codeit/projects",
        method: "POST",
        headers: {
          Host: `127.0.0.1:${serverPort}`,
          Cookie: sessionCookie,
          "x-codeit-csrf": csrfToken,
          "Content-Type": "application/json"
        }
      },
      JSON.stringify({
        name: "Auditor Trusted Project",
        root_path: trustedProjectDir,
        trust_state: "trusted"
      })
    );

    assert.strictEqual(trustedRes.status, 200);
    assert.strictEqual(trustedRes.data.data.trust_state, "trusted");
    trustedProjectUuid = trustedRes.data.data.uuid;

    // c. Create a PLAN-mode run with auto_execute: false
    const convRes = await sendRawRequest(
      {
        hostname: "127.0.0.1",
        port: serverPort,
        path: "/api/codeit/conversations",
        method: "POST",
        headers: {
          Host: `127.0.0.1:${serverPort}`,
          Cookie: sessionCookie,
          "x-codeit-csrf": csrfToken,
          "Content-Type": "application/json"
        }
      },
      JSON.stringify({
        project_uuid: untrustedProjectUuid,
        title: "Security Audit Plan Conversation",
        mode: "plan"
      })
    );

    assert.strictEqual(convRes.status, 200);
    const convUuid = convRes.data.data.uuid;

    const runRes = await sendRawRequest(
      {
        hostname: "127.0.0.1",
        port: serverPort,
        path: "/api/codeit/runs",
        method: "POST",
        headers: {
          Host: `127.0.0.1:${serverPort}`,
          Cookie: sessionCookie,
          "x-codeit-csrf": csrfToken,
          "Content-Type": "application/json"
        }
      },
      JSON.stringify({
        conversation_uuid: convUuid,
        project_uuid: untrustedProjectUuid,
        mode: "plan",
        auto_execute: false
      })
    );

    assert.strictEqual(runRes.status, 200);
    planRunUuid = runRes.data.data.uuid;
    cancelledRunUuid = planRunUuid;

    // d. CANCEL the run
    const cancelRes = await sendRawRequest(
      {
        hostname: "127.0.0.1",
        port: serverPort,
        path: `/api/codeit/runs/${planRunUuid}/cancel`,
        method: "POST",
        headers: {
          Host: `127.0.0.1:${serverPort}`,
          Cookie: sessionCookie,
          "x-codeit-csrf": csrfToken,
          "Content-Type": "application/json"
        }
      },
      JSON.stringify({ reason: "Auditor cancellation test" })
    );

    assert.strictEqual(cancelRes.status, 200);

    // Verify run state in database is cancelled
    const checkRunRes = await sendRawRequest({
      hostname: "127.0.0.1",
      port: serverPort,
      path: `/api/codeit/runs/${planRunUuid}`,
      method: "GET",
      headers: {
        Host: `127.0.0.1:${serverPort}`,
        Cookie: sessionCookie
      }
    });

    assert.strictEqual(checkRunRes.status, 200);
    assert.strictEqual(checkRunRes.data.data.state, "cancelled");
  });

  after(async () => {
    if (serverInstance) {
      await serverInstance.close();
    }
    if (existsSync(testBaseDir)) {
      try {
        rmSync(testBaseDir, { recursive: true, force: true });
      } catch {
        // Safe cleanup on Windows
      }
    }
  });

  test("e & f. Replicate auditor attack on /api/codeit/workspace/command: Rejects with 403 or 409, command NOT executed, outside canary NOT read", async () => {
    // Malicious attack command trying to read outside secret and write to file
    const maliciousScript = `
      const fs = require('fs');
      try {
        const secret = fs.readFileSync(${JSON.stringify(outsideSecretFile)}, 'utf8');
        fs.writeFileSync(${JSON.stringify(attackOutputFile)}, secret, 'utf8');
      } catch (e) {
        fs.writeFileSync(${JSON.stringify(attackOutputFile)}, 'ERROR: ' + e.message, 'utf8');
      }
    `;

    const res = await sendRawRequest(
      {
        hostname: "127.0.0.1",
        port: serverPort,
        path: "/api/codeit/workspace/command",
        method: "POST",
        headers: {
          Host: `127.0.0.1:${serverPort}`,
          Cookie: sessionCookie,
          "x-codeit-csrf": csrfToken,
          "Content-Type": "application/json"
        }
      },
      JSON.stringify({
        project_uuid: untrustedProjectUuid,
        run_uuid: cancelledRunUuid,
        executable: "node",
        args: ["-e", maliciousScript],
        cwd: "."
      })
    );

    // Assert: HTTP 403 or 409 rejection
    assert.ok(
      res.status === 403 || res.status === 409,
      `Expected HTTP 403 or 409 rejection, got HTTP ${res.status}`
    );
    assert.strictEqual(res.data.success, false);
    assert.ok(
      res.data.error.code === "CODEIT_INVALID_STATE" ||
        res.data.error.code === "CODEIT_POLICY_DENIED" ||
        res.data.error.code === "CODEIT_APPROVAL_REQUIRED",
      `Expected error code CODEIT_INVALID_STATE, CODEIT_POLICY_DENIED, or CODEIT_APPROVAL_REQUIRED, got ${res.data.error?.code}`
    );

    // Assert: Command was NOT executed on disk
    assert.strictEqual(
      existsSync(attackOutputFile),
      false,
      "Attack output file must NOT have been created by child process"
    );
  });

  test("g1. /api/codeit/workspace/patch rejection on cancelled run or untrusted project", async () => {
    const patchPayload = {
      project_uuid: untrustedProjectUuid,
      run_uuid: cancelledRunUuid,
      path: "index.js",
      expected_hash: "0".repeat(64),
      patch: "console.log('malicious patch applied');\n"
    };

    const res = await sendRawRequest(
      {
        hostname: "127.0.0.1",
        port: serverPort,
        path: "/api/codeit/workspace/patch",
        method: "POST",
        headers: {
          Host: `127.0.0.1:${serverPort}`,
          Cookie: sessionCookie,
          "x-codeit-csrf": csrfToken,
          "Content-Type": "application/json"
        }
      },
      JSON.stringify(patchPayload)
    );

    assert.ok(
      res.status === 403 || res.status === 409,
      `Expected HTTP 403 or 409 rejection for patch on cancelled/untrusted run, got ${res.status}`
    );
    assert.strictEqual(res.data.success, false);
  });

  test("g2. /api/codeit/workspace/patch rejection on active PLAN-mode run (even on trusted project)", async () => {
    // Create an uncancelled run in PLAN mode on TRUSTED project
    const convRes = await sendRawRequest(
      {
        hostname: "127.0.0.1",
        port: serverPort,
        path: "/api/codeit/conversations",
        method: "POST",
        headers: {
          Host: `127.0.0.1:${serverPort}`,
          Cookie: sessionCookie,
          "x-codeit-csrf": csrfToken,
          "Content-Type": "application/json"
        }
      },
      JSON.stringify({
        project_uuid: trustedProjectUuid,
        title: "Trusted Plan Conversation",
        mode: "plan"
      })
    );
    assert.strictEqual(convRes.status, 200);

    const runRes = await sendRawRequest(
      {
        hostname: "127.0.0.1",
        port: serverPort,
        path: "/api/codeit/runs",
        method: "POST",
        headers: {
          Host: `127.0.0.1:${serverPort}`,
          Cookie: sessionCookie,
          "x-codeit-csrf": csrfToken,
          "Content-Type": "application/json"
        }
      },
      JSON.stringify({
        conversation_uuid: convRes.data.data.uuid,
        project_uuid: trustedProjectUuid,
        mode: "plan",
        auto_execute: false
      })
    );
    assert.strictEqual(runRes.status, 200);
    const activePlanRunUuid = runRes.data.data.uuid;

    // Attempt patch in plan mode
    const patchRes = await sendRawRequest(
      {
        hostname: "127.0.0.1",
        port: serverPort,
        path: "/api/codeit/workspace/patch",
        method: "POST",
        headers: {
          Host: `127.0.0.1:${serverPort}`,
          Cookie: sessionCookie,
          "x-codeit-csrf": csrfToken,
          "Content-Type": "application/json"
        }
      },
      JSON.stringify({
        project_uuid: trustedProjectUuid,
        run_uuid: activePlanRunUuid,
        path: "index.js",
        expected_hash: "0".repeat(64),
        patch: "console.log('plan mode mutation');\n"
      })
    );

    assert.strictEqual(patchRes.status, 403);
    assert.strictEqual(patchRes.data.success, false);
    assert.strictEqual(patchRes.data.error.code, "CODEIT_POLICY_DENIED");
    assert.match(patchRes.data.error.message, /forbids workspace mutations/);

    // Attempt command in plan mode
    const cmdRes = await sendRawRequest(
      {
        hostname: "127.0.0.1",
        port: serverPort,
        path: "/api/codeit/workspace/command",
        method: "POST",
        headers: {
          Host: `127.0.0.1:${serverPort}`,
          Cookie: sessionCookie,
          "x-codeit-csrf": csrfToken,
          "Content-Type": "application/json"
        }
      },
      JSON.stringify({
        project_uuid: trustedProjectUuid,
        run_uuid: activePlanRunUuid,
        executable: "node",
        args: ["-e", "console.log('command in plan mode')"],
        cwd: "."
      })
    );

    assert.strictEqual(cmdRes.status, 403);
    assert.strictEqual(cmdRes.data.success, false);
    assert.strictEqual(cmdRes.data.error.code, "CODEIT_POLICY_DENIED");
    assert.match(cmdRes.data.error.message, /forbids command execution/);
  });

  test("g3. Rejects command & patch execution on UNTRUSTED project even in WORK mode", async () => {
    // Create an uncancelled run in WORK mode on UNTRUSTED project
    const convRes = await sendRawRequest(
      {
        hostname: "127.0.0.1",
        port: serverPort,
        path: "/api/codeit/conversations",
        method: "POST",
        headers: {
          Host: `127.0.0.1:${serverPort}`,
          Cookie: sessionCookie,
          "x-codeit-csrf": csrfToken,
          "Content-Type": "application/json"
        }
      },
      JSON.stringify({
        project_uuid: untrustedProjectUuid,
        title: "Untrusted Work Conversation",
        mode: "work"
      })
    );
    assert.strictEqual(convRes.status, 200);

    const runRes = await sendRawRequest(
      {
        hostname: "127.0.0.1",
        port: serverPort,
        path: "/api/codeit/runs",
        method: "POST",
        headers: {
          Host: `127.0.0.1:${serverPort}`,
          Cookie: sessionCookie,
          "x-codeit-csrf": csrfToken,
          "Content-Type": "application/json"
        }
      },
      JSON.stringify({
        conversation_uuid: convRes.data.data.uuid,
        project_uuid: untrustedProjectUuid,
        mode: "work",
        auto_execute: false
      })
    );
    assert.strictEqual(runRes.status, 200);
    const untrustedWorkRunUuid = runRes.data.data.uuid;

    // Command rejected on untrusted project
    const cmdRes = await sendRawRequest(
      {
        hostname: "127.0.0.1",
        port: serverPort,
        path: "/api/codeit/workspace/command",
        method: "POST",
        headers: {
          Host: `127.0.0.1:${serverPort}`,
          Cookie: sessionCookie,
          "x-codeit-csrf": csrfToken,
          "Content-Type": "application/json"
        }
      },
      JSON.stringify({
        project_uuid: untrustedProjectUuid,
        run_uuid: untrustedWorkRunUuid,
        executable: "node",
        args: ["--version"],
        cwd: "."
      })
    );

    assert.strictEqual(cmdRes.status, 403);
    assert.strictEqual(cmdRes.data.success, false);
    assert.strictEqual(cmdRes.data.error.code, "CODEIT_POLICY_DENIED");
    assert.match(cmdRes.data.error.message, /untrusted or archived/i);

    // Patch rejected on untrusted project
    const patchRes = await sendRawRequest(
      {
        hostname: "127.0.0.1",
        port: serverPort,
        path: "/api/codeit/workspace/patch",
        method: "POST",
        headers: {
          Host: `127.0.0.1:${serverPort}`,
          Cookie: sessionCookie,
          "x-codeit-csrf": csrfToken,
          "Content-Type": "application/json"
        }
      },
      JSON.stringify({
        project_uuid: untrustedProjectUuid,
        run_uuid: untrustedWorkRunUuid,
        path: "index.js",
        expected_hash: "0".repeat(64),
        patch: "console.log('mutation on untrusted');\n"
      })
    );

    assert.strictEqual(patchRes.status, 403);
    assert.strictEqual(patchRes.data.success, false);
    assert.strictEqual(patchRes.data.error.code, "CODEIT_POLICY_DENIED");
    assert.match(patchRes.data.error.message, /untrusted or archived/i);
  });

  test("h. Path traversal injection attempts are strictly denied", async () => {
    // 1. Path traversal in file read
    const readRes = await sendRawRequest({
      hostname: "127.0.0.1",
      port: serverPort,
      path: `/api/codeit/workspace/files?project_uuid=${trustedProjectUuid}&path=../outside-secret-area/outside-canary.key`,
      method: "GET",
      headers: {
        Host: `127.0.0.1:${serverPort}`,
        Cookie: sessionCookie
      }
    });

    assert.strictEqual(readRes.status, 400);
    assert.strictEqual(readRes.data.success, false);
    assert.strictEqual(readRes.data.error.code, "CODEIT_PATH_DENIED");

    // 2. Null byte injection in file read
    const nullByteRes = await sendRawRequest({
      hostname: "127.0.0.1",
      port: serverPort,
      path: `/api/codeit/workspace/files?project_uuid=${trustedProjectUuid}&path=%00/etc/passwd`,
      method: "GET",
      headers: {
        Host: `127.0.0.1:${serverPort}`,
        Cookie: sessionCookie
      }
    });

    assert.strictEqual(nullByteRes.status, 400);
    assert.strictEqual(nullByteRes.data.success, false);
    assert.strictEqual(nullByteRes.data.error.code, "CODEIT_PATH_DENIED");

    // 3. Traversal in command CWD
    const cmdTravRes = await sendRawRequest(
      {
        hostname: "127.0.0.1",
        port: serverPort,
        path: "/api/codeit/workspace/command",
        method: "POST",
        headers: {
          Host: `127.0.0.1:${serverPort}`,
          Cookie: sessionCookie,
          "x-codeit-csrf": csrfToken,
          "Content-Type": "application/json"
        }
      },
      JSON.stringify({
        project_uuid: trustedProjectUuid,
        run_uuid: cancelledRunUuid,
        executable: "node",
        args: ["--version"],
        cwd: "../outside-secret-area"
      })
    );

    // Cancelled run check or path check must fail closed with 400/409
    assert.ok(cmdTravRes.status === 400 || cmdTravRes.status === 409 || cmdTravRes.status === 403);
    assert.strictEqual(cmdTravRes.data.success, false);
  });

  test("Caller-supplied caller_role is ignored; cannot elevate permissions", async () => {
    // Attacker sends caller_role: 'admin' or 'operator' to attempt bypass
    const res = await sendRawRequest(
      {
        hostname: "127.0.0.1",
        port: serverPort,
        path: "/api/codeit/workspace/command",
        method: "POST",
        headers: {
          Host: `127.0.0.1:${serverPort}`,
          Cookie: sessionCookie,
          "x-codeit-csrf": csrfToken,
          "Content-Type": "application/json"
        }
      },
      JSON.stringify({
        project_uuid: untrustedProjectUuid,
        run_uuid: cancelledRunUuid,
        caller_role: "admin",
        role: "admin",
        actor: "superadmin",
        executable: "node",
        args: ["--version"],
        cwd: "."
      })
    );

    assert.ok(res.status === 403 || res.status === 409);
    assert.strictEqual(res.data.success, false);
  });

  test("Mismatched run_uuid and project_uuid is rejected with 409", async () => {
    // Pass trustedProjectUuid with a run that actually belongs to untrustedProjectUuid
    const res = await sendRawRequest(
      {
        hostname: "127.0.0.1",
        port: serverPort,
        path: "/api/codeit/workspace/command",
        method: "POST",
        headers: {
          Host: `127.0.0.1:${serverPort}`,
          Cookie: sessionCookie,
          "x-codeit-csrf": csrfToken,
          "Content-Type": "application/json"
        }
      },
      JSON.stringify({
        project_uuid: trustedProjectUuid,
        run_uuid: cancelledRunUuid, // belongs to untrustedProjectUuid
        executable: "node",
        args: ["--version"],
        cwd: "."
      })
    );

    assert.strictEqual(res.status, 409);
    assert.strictEqual(res.data.success, false);
    assert.strictEqual(res.data.error.code, "CODEIT_INVALID_STATE");
    assert.match(res.data.error.message, /does not belong to project/i);
  });
});
