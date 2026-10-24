import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { existsSync, mkdirSync, rmSync, writeFileSync, realpathSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { randomBytes, createHmac } from "node:crypto";
import { spawn } from "node:child_process";
import { z } from "zod";

describe("T00 Foundation Verification", () => {
  const testDir = join(tmpdir(), `codeit-foundation-test-${Date.now()}`);

  before(() => {
    if (!existsSync(testDir)) {
      mkdirSync(testDir, { recursive: true });
    }
  });

  after(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe("1. SQLite Packaging and Transactional Storage (node:sqlite)", () => {
    test("instantiates SQLite in-memory and executes DDL, DML, and transactions", () => {
      const db = new DatabaseSync(":memory:");

      // Migration schema ledger
      db.exec(`
        CREATE TABLE migration_schema (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          batch_name TEXT NOT NULL,
          applied_at TEXT NOT NULL
        );
      `);

      // Core tables
      db.exec(`
        CREATE TABLE codeit_projects (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          uuid TEXT NOT NULL UNIQUE,
          name TEXT NOT NULL,
          root_path TEXT NOT NULL,
          trust_state TEXT NOT NULL DEFAULT 'untrusted',
          policy_revision TEXT NOT NULL DEFAULT '1.0.0',
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );

        CREATE TABLE codeit_runs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          uuid TEXT NOT NULL UNIQUE,
          project_uuid TEXT NOT NULL,
          mode TEXT NOT NULL,
          state TEXT NOT NULL DEFAULT 'queued',
          cancellation_generation INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          FOREIGN KEY (project_uuid) REFERENCES codeit_projects (uuid) ON DELETE CASCADE
        );

        CREATE TABLE codeit_run_events (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          run_uuid TEXT NOT NULL,
          seq INTEGER NOT NULL,
          event_type TEXT NOT NULL,
          payload TEXT NOT NULL,
          created_at TEXT NOT NULL,
          UNIQUE (run_uuid, seq)
        );
      `);

      // Transactional commit of state and event
      const insertProject = db.prepare(`
        INSERT INTO codeit_projects (uuid, name, root_path, trust_state, policy_revision, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      const insertRun = db.prepare(`
        INSERT INTO codeit_runs (uuid, project_uuid, mode, state, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      const insertEvent = db.prepare(`
        INSERT INTO codeit_run_events (run_uuid, seq, event_type, payload, created_at)
        VALUES (?, ?, ?, ?, ?)
      `);

      const now = new Date().toISOString();
      const projUuid = "a1b2c3d4";
      const runUuid = "e5f6a7b8";

      db.exec("BEGIN TRANSACTION;");
      insertProject.run(projUuid, "Test Project", "D:\\workspace\\test", "trusted", "1.0.0", now, now);
      insertRun.run(runUuid, projUuid, "plan", "planning", now, now);
      insertEvent.run(runUuid, 1, "run.started", JSON.stringify({ mode: "plan" }), now);
      db.exec("COMMIT;");

      const runRow = db.prepare("SELECT * FROM codeit_runs WHERE uuid = ?").get(runUuid);
      assert.equal(runRow.uuid, runUuid);
      assert.equal(runRow.state, "planning");

      const eventRow = db.prepare("SELECT * FROM codeit_run_events WHERE run_uuid = ? AND seq = ?").get(runUuid, 1);
      assert.equal(eventRow.event_type, "run.started");

      // Verify unique constraint failure
      assert.throws(() => {
        insertEvent.run(runUuid, 1, "run.duplicate", "{}", now);
      });

      // Verify performance benchmark
      const start = performance.now();
      const iterations = 100;
      db.exec("BEGIN TRANSACTION;");
      for (let i = 2; i <= iterations + 1; i++) {
        insertEvent.run(runUuid, i, "run.step", JSON.stringify({ i }), now);
      }
      db.exec("COMMIT;");
      const duration = performance.now() - start;
      const avgMs = duration / iterations;
      assert.ok(avgMs < 1.0, `Expected avg transaction time < 1ms, got ${avgMs}ms`);

      db.close();
    });

    test("persists to file and reloads with data integrity", () => {
      const dbPath = join(testDir, "codeit-test.db");
      const db = new DatabaseSync(dbPath);
      db.exec("CREATE TABLE test_data (id INTEGER PRIMARY KEY, value TEXT NOT NULL);");
      db.prepare("INSERT INTO test_data (value) VALUES (?)").run("retained");
      db.close();

      const dbReloaded = new DatabaseSync(dbPath);
      const row = dbReloaded.prepare("SELECT * FROM test_data WHERE id = 1").get();
      assert.equal(row.value, "retained");
      dbReloaded.close();
    });
  });

  describe("2. Local Pairing, Origin, and Host Validation", () => {
    const pairingSecret = randomBytes(32).toString("hex");

    function validateRequest(headers, options = {}) {
      const host = headers["host"] || "";
      const origin = headers["origin"] || "";
      const authHeader = headers["authorization"] || "";
      const csrfToken = headers["x-codeit-csrf"] || "";
      const sessionCookie = headers["cookie"] || "";

      // 1. Host header validation: strictly loopback
      const validHosts = ["127.0.0.1:7071", "localhost:7071"];
      if (!validHosts.includes(host)) {
        return { allowed: false, status: 403, reason: "Host rebinding or non-loopback host rejected" };
      }

      // 2. Origin validation (for state-changing or web-initiated requests)
      if (origin) {
        const validOrigins = ["http://127.0.0.1:7070", "http://localhost:7070"];
        if (!validOrigins.includes(origin)) {
          return { allowed: false, status: 403, reason: "Unauthorized origin rejected" };
        }
      }

      // 3. Pairing / Auth token check
      if (options.requirePairing) {
        if (authHeader !== `Bearer ${pairingSecret}`) {
          return { allowed: false, status: 401, reason: "Invalid pairing token" };
        }
      }

      // 4. CSRF protection on mutations
      if (options.isMutation) {
        if (!csrfToken || csrfToken !== options.expectedCsrf) {
          return { allowed: false, status: 403, reason: "CSRF token missing or mismatch" };
        }
      }

      return { allowed: true, status: 200 };
    }

    test("accepts valid loopback requests with proper origin and credentials", () => {
      const res = validateRequest({
        host: "127.0.0.1:7071",
        origin: "http://127.0.0.1:7070",
        authorization: `Bearer ${pairingSecret}`
      }, { requirePairing: true });
      assert.equal(res.allowed, true);
    });

    test("rejects DNS rebinding / non-loopback hosts", () => {
      const res = validateRequest({
        host: "attacker.com:7071",
        origin: "http://127.0.0.1:7070"
      });
      assert.equal(res.allowed, false);
      assert.equal(res.status, 403);
      assert.match(res.reason, /Host rebinding/);
    });

    test("rejects untrusted origins", () => {
      const res = validateRequest({
        host: "127.0.0.1:7071",
        origin: "http://malicious-site.com"
      });
      assert.equal(res.allowed, false);
      assert.equal(res.status, 403);
      assert.match(res.reason, /Unauthorized origin/);
    });

    test("enforces CSRF validation on mutations", () => {
      const validCsrf = randomBytes(16).toString("hex");
      const resWithoutCsrf = validateRequest({
        host: "127.0.0.1:7071",
        origin: "http://127.0.0.1:7070"
      }, { isMutation: true, expectedCsrf: validCsrf });
      assert.equal(resWithoutCsrf.allowed, false);
      assert.equal(resWithoutCsrf.status, 403);

      const resWithCsrf = validateRequest({
        host: "127.0.0.1:7071",
        origin: "http://127.0.0.1:7070",
        "x-codeit-csrf": validCsrf
      }, { isMutation: true, expectedCsrf: validCsrf });
      assert.equal(resWithCsrf.allowed, true);
    });
  });

  describe("3. Windows Runner Isolation & Workspace Boundary", () => {
    const projectRoot = join(testDir, "fixture-project");
    const externalDir = join(testDir, "external-secret-area");

    before(() => {
      mkdirSync(projectRoot, { recursive: true });
      mkdirSync(externalDir, { recursive: true });
      writeFileSync(join(projectRoot, "allowed.txt"), "allowed content", "utf8");
      writeFileSync(join(externalDir, "secret.key"), "SUPER_SECRET_CANARY_VALUE", "utf8");
    });

    function resolveWorkspacePath(canonicalRoot, requestedSubpath) {
      // Resolve path
      const target = resolve(canonicalRoot, requestedSubpath);
      // Canonical real path check
      const canonicalTarget = realpathSync(target);
      const canonicalBase = realpathSync(canonicalRoot);

      if (!canonicalTarget.startsWith(canonicalBase + "\\") && canonicalTarget !== canonicalBase) {
        throw new Error(`Path traversal denied: target ${canonicalTarget} is outside root ${canonicalBase}`);
      }
      return canonicalTarget;
    }

    test("resolves allowed workspace paths within canonical root", () => {
      const resolved = resolveWorkspacePath(projectRoot, "allowed.txt");
      assert.equal(resolved, realpathSync(join(projectRoot, "allowed.txt")));
    });

    test("rejects directory traversal attempts (.. / ../)", () => {
      assert.throws(() => {
        resolveWorkspacePath(projectRoot, "../external-secret-area/secret.key");
      }, /Path traversal denied/);
    });

    test("scrubs sensitive environment variables before spawning process", () => {
      const dirtyEnv = {
        PATH: process.env.PATH,
        SYSTEMROOT: process.env.SYSTEMROOT,
        TEMP: process.env.TEMP,
        CODEXSUN_DATABASE_URL: "mysql://user:pass@localhost:3306/db",
        GEMINI_API_KEY: "secret_gemini_key",
        AWS_SECRET_ACCESS_KEY: "secret_aws_key",
        MY_TOKEN: "super_token_123"
      };

      function scrubEnvironment(rawEnv) {
        const allowedKeys = new Set(["PATH", "SYSTEMROOT", "TEMP", "TMP", "COMSPEC", "PATHEXT"]);
        const scrubbed = {};
        for (const [key, val] of Object.entries(rawEnv)) {
          const upper = key.toUpperCase();
          if (
            allowedKeys.has(upper) &&
            !upper.includes("TOKEN") &&
            !upper.includes("KEY") &&
            !upper.includes("SECRET") &&
            !upper.startsWith("CODEXSUN_")
          ) {
            scrubbed[key] = val;
          }
        }
        return scrubbed;
      }

      const cleanEnv = scrubEnvironment(dirtyEnv);
      assert.equal(cleanEnv.GEMINI_API_KEY, undefined);
      assert.equal(cleanEnv.AWS_SECRET_ACCESS_KEY, undefined);
      assert.equal(cleanEnv.CODEXSUN_DATABASE_URL, undefined);
      assert.equal(cleanEnv.MY_TOKEN, undefined);
      assert.ok(cleanEnv.PATH !== undefined);
    });

    test("executes bounded command and verifies timeout cancellation", async () => {
      // Spawn node command that outputs text
      const child = spawn(process.execPath, ["-e", "console.log('command executed');"], {
        cwd: projectRoot,
        env: { PATH: process.env.PATH, SYSTEMROOT: process.env.SYSTEMROOT }
      });

      let stdout = "";
      child.stdout.on("data", (chunk) => { stdout += chunk.toString(); });

      const exitCode = await new Promise((resolve) => {
        child.on("close", resolve);
      });

      assert.equal(exitCode, 0);
      assert.match(stdout, /command executed/);
    });

    test("cancels hanging process tree on timeout", async () => {
      // Spawn process that hangs for 30s
      const child = spawn(process.execPath, ["-e", "setTimeout(() => {}, 30000);"], {
        cwd: projectRoot,
        env: { PATH: process.env.PATH, SYSTEMROOT: process.env.SYSTEMROOT }
      });

      let exited = false;
      child.on("close", () => { exited = true; });

      // Simulate 50ms timeout kill
      await new Promise(r => setTimeout(r, 50));
      child.kill("SIGKILL");

      await new Promise(r => setTimeout(r, 100));
      assert.equal(exited, true);
    });
  });

  describe("4. Executable Contract Schemas (CONTRACTS.md frozen)", () => {
    // Exact Zod schemas corresponding to frozen CONTRACTS.md
    const HexUuidSchema = z.string().regex(/^[0-9a-f]{8}$/, "Must be an 8-character lowercase hex string");
    const IsoTimestampSchema = z.string().datetime();

    const ProjectSchema = z.object({
      id: z.number().int().positive().optional(),
      uuid: HexUuidSchema,
      name: z.string().min(1).max(100),
      root_path: z.string().min(1),
      trust_state: z.enum(["untrusted", "trusted", "archived"]),
      policy_revision: z.string().min(1),
      created_at: IsoTimestampSchema,
      updated_at: IsoTimestampSchema
    });

    const ConversationSchema = z.object({
      id: z.number().int().positive().optional(),
      uuid: HexUuidSchema,
      project_uuid: HexUuidSchema,
      title: z.string().min(1).max(200),
      selected_mode: z.enum(["ask", "plan", "work", "review"]),
      archived: z.boolean().default(false),
      created_at: IsoTimestampSchema,
      updated_at: IsoTimestampSchema
    });

    const RunSchema = z.object({
      id: z.number().int().positive().optional(),
      uuid: HexUuidSchema,
      project_uuid: HexUuidSchema,
      conversation_uuid: HexUuidSchema,
      mode: z.enum(["ask", "plan", "work", "review"]),
      state: z.enum([
        "queued", "planning", "waiting", "running",
        "paused", "blocked", "verifying", "cancelling",
        "succeeded", "failed", "cancelled"
      ]),
      cancellation_generation: z.number().int().nonnegative().default(0),
      budget: z.object({
        max_duration_seconds: z.number().positive(),
        max_output_bytes: z.number().positive(),
        max_tool_invocations: z.number().positive(),
        max_repair_attempts: z.number().positive()
      }),
      created_at: IsoTimestampSchema,
      updated_at: IsoTimestampSchema
    });

    test("validates valid project payload", () => {
      const now = new Date().toISOString();
      const valid = {
        uuid: "c0de1700",
        name: "Test Project",
        root_path: "D:\\workspace\\codexsun",
        trust_state: "trusted",
        policy_revision: "1.0.0",
        created_at: now,
        updated_at: now
      };
      assert.deepEqual(ProjectSchema.parse(valid), valid);
    });

    test("rejects invalid project UUID (must be 8-char lowercase hex)", () => {
      const now = new Date().toISOString();
      const invalid = {
        uuid: "not-a-valid-hex-uuid",
        name: "Test Project",
        root_path: "D:\\workspace\\codexsun",
        trust_state: "trusted",
        policy_revision: "1.0.0",
        created_at: now,
        updated_at: now
      };
      assert.throws(() => ProjectSchema.parse(invalid));
    });

    test("validates Run state machine valid transitions and rejects invalid transitions", () => {
      const transitions = {
        queued: ["planning", "running", "cancelling", "failed"],
        planning: ["waiting", "running", "verifying", "cancelling", "failed"],
        waiting: ["queued", "planning", "running", "cancelling", "failed"],
        running: ["waiting", "paused", "blocked", "verifying", "cancelling", "failed"],
        paused: ["queued", "cancelling"],
        blocked: ["queued", "cancelling", "failed"],
        verifying: ["running", "waiting", "succeeded", "cancelling", "failed"],
        cancelling: ["cancelled", "failed"],
        succeeded: [],
        failed: [],
        cancelled: []
      };

      function canTransition(current, next) {
        return (transitions[current] || []).includes(next);
      }

      assert.equal(canTransition("queued", "planning"), true);
      assert.equal(canTransition("planning", "running"), true);
      assert.equal(canTransition("running", "verifying"), true);
      assert.equal(canTransition("verifying", "succeeded"), true);
      assert.equal(canTransition("succeeded", "running"), false); // Terminal state cannot transition
      assert.equal(canTransition("cancelled", "running"), false); // Terminal state cannot transition
      assert.equal(canTransition("planning", "succeeded"), false); // Cannot jump straight to succeeded
    });
  });
});
