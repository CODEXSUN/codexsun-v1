import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, rmSync, writeFileSync, symlinkSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { execSync } from "node:child_process";
import { pathToFileURL } from "node:url";

// Compile workspace.command.ts and workspace.command.types.ts into dist
const distPath = resolve(process.cwd(), "dist/devkits/codeit/api");
const commandTs = resolve(
  process.cwd(),
  "devkits/codeit/api/src/modules/workspace/workspace.command.ts"
);
const commandTypesTs = resolve(
  process.cwd(),
  "devkits/codeit/api/src/modules/workspace/workspace.command.types.ts"
);

if (!existsSync(resolve(distPath, "modules/workspace/workspace.command.js"))) {
  execSync("npx tsc -p devkits/codeit/api/tsconfig.json", { stdio: "inherit" });
}

const { CommandRunner, scrubEnvironment, DEFAULT_MAX_OUTPUT_BYTES, TRUNCATION_NOTICE } =
  await import(pathToFileURL(resolve(distPath, "modules/workspace/workspace.command.js")).href);

const { ExecuteCommandInputSchema, CommandResultSchema, CommandOutputChunkSchema } = await import(
  pathToFileURL(resolve(distPath, "modules/workspace/workspace.command.types.js")).href
);

const { PathDeniedError, ValidationError } = await import(
  pathToFileURL(resolve(distPath, "errors.js")).href
);

describe("T07: Command Runner & Process Lifecycle Isolation", () => {
  const testBaseDir = join(tmpdir(), `codeit-runner-test-${Date.now()}`);
  const projectRoot = join(testBaseDir, "fixture-project");
  const outsideSecretDir = join(testBaseDir, "outside-secret-area");

  let runner = null;

  before(() => {
    mkdirSync(projectRoot, { recursive: true });
    mkdirSync(outsideSecretDir, { recursive: true });

    // Fixture files
    writeFileSync(
      join(projectRoot, "package.json"),
      '{"name":"fixture-project","version":"1.0.0"}',
      "utf8"
    );
    writeFileSync(join(projectRoot, "hello.txt"), "hello from project root", "utf8");
    writeFileSync(
      join(outsideSecretDir, "super-secret.key"),
      "SUPER_SECRET_CANARY_VALUE_12345",
      "utf8"
    );

    // Junction / symlink escape fixture (E03 / E09)
    try {
      symlinkSync(outsideSecretDir, join(projectRoot, "escapelink"), "junction");
    } catch {
      // Ignored if permissions don't allow
    }

    runner = new CommandRunner(projectRoot);
  });

  after(() => {
    if (existsSync(testBaseDir)) {
      rmSync(testBaseDir, { recursive: true, force: true });
    }
  });

  describe("1. Contract Schemas & Input Validation", () => {
    test("validates valid ExecuteCommandInputSchema matching CONTRACTS.md", () => {
      const valid = {
        run_uuid: "00000001",
        executable: "node",
        args: ["--version"],
        cwd: projectRoot,
        timeout_ms: 10000,
        max_output_bytes: 1048576
      };
      const parsed = ExecuteCommandInputSchema.parse(valid);
      assert.equal(parsed.run_uuid, "00000001");
      assert.equal(parsed.executable, "node");
      assert.deepEqual(parsed.args, ["--version"]);
    });

    test("rejects invalid run_uuid in ExecuteCommandInputSchema", () => {
      assert.throws(() => {
        ExecuteCommandInputSchema.parse({
          run_uuid: "invalid-uuid",
          executable: "node",
          args: [],
          cwd: projectRoot
        });
      });
    });

    test("validates CommandResultSchema structure", () => {
      const sampleResult = {
        exit_code: 0,
        stdout: "v20.0.0\n",
        stderr: "",
        duration_ms: 45,
        truncated: false,
        timed_out: false,
        error: null
      };
      assert.deepEqual(CommandResultSchema.parse(sampleResult), sampleResult);
    });

    test("validates CommandOutputChunkSchema structure", () => {
      const sampleChunk = {
        stream: "stdout",
        chunk: "compiling...\n",
        timestamp: new Date().toISOString()
      };
      assert.deepEqual(CommandOutputChunkSchema.parse(sampleChunk), sampleChunk);
    });
  });

  describe("2. Permitted Command Execution (E09)", () => {
    test("executes permitted 'node --version' and returns exit code 0 with stdout", async () => {
      const result = await runner.execute({
        run_uuid: "00000001",
        executable: "node",
        args: ["--version"],
        cwd: projectRoot
      });

      assert.equal(result.exit_code, 0);
      assert.match(result.stdout, /^v\d+\.\d+\.\d+/);
      assert.equal(result.stderr, "");
      assert.equal(result.truncated, false);
      assert.equal(result.timed_out, false);
      assert.equal(result.error, null);
      assert.ok(result.duration_ms >= 0);
    });

    test("executes 'node -e \"console.log(\\'hello\\')\"' and captures stdout", async () => {
      const result = await runner.execute({
        run_uuid: "00000001",
        executable: "node",
        args: ["-e", "console.log('hello codeit runner');"],
        cwd: projectRoot
      });

      assert.equal(result.exit_code, 0);
      assert.match(result.stdout, /hello codeit runner/);
    });

    test("executes 'git --version' and returns exit code 0", async () => {
      const result = await runner.execute({
        run_uuid: "00000001",
        executable: "git",
        args: ["--version"],
        cwd: projectRoot
      });

      assert.equal(result.exit_code, 0);
      assert.match(result.stdout, /git version/);
    });

    test("executes 'npm --version' and returns exit code 0", async () => {
      const result = await runner.execute({
        run_uuid: "00000001",
        executable: "npm",
        args: ["--version"],
        cwd: projectRoot
      });

      assert.equal(result.exit_code, 0);
      assert.match(result.stdout, /\d+\.\d+\.\d+/);
    });

    test("streams output chunks via onChunk callback", async () => {
      const receivedChunks = [];
      const result = await runner.execute(
        {
          run_uuid: "00000001",
          executable: "node",
          args: ["-e", "console.log('chunk 1'); console.error('chunk 2');"],
          cwd: projectRoot
        },
        {
          onChunk: (chunk) => {
            receivedChunks.push(chunk);
          }
        }
      );

      assert.equal(result.exit_code, 0);
      assert.ok(receivedChunks.length >= 2);
      const stdoutChunk = receivedChunks.find((c) => c.stream === "stdout");
      const stderrChunk = receivedChunks.find((c) => c.stream === "stderr");
      assert.ok(stdoutChunk);
      assert.ok(stderrChunk);
      assert.match(stdoutChunk.chunk, /chunk 1/);
      assert.match(stderrChunk.chunk, /chunk 2/);
    });
  });

  describe("3. Unapproved Executable Rejection & Shell Injection Prevention", () => {
    test("rejects arbitrary shell interpreter 'powershell.exe' with CODEIT_VALIDATION_ERROR", async () => {
      await assert.rejects(
        async () => {
          await runner.execute({
            run_uuid: "00000001",
            executable: "powershell.exe",
            args: ["-Command", "Get-Process"],
            cwd: projectRoot
          });
        },
        (err) => {
          assert.ok(err instanceof ValidationError);
          assert.equal(err.code, "CODEIT_VALIDATION_ERROR");
          assert.match(err.message, /not permitted/);
          return true;
        }
      );
    });

    test("rejects arbitrary shell interpreter 'cmd.exe' with CODEIT_VALIDATION_ERROR", async () => {
      await assert.rejects(
        async () => {
          await runner.execute({
            run_uuid: "00000001",
            executable: "cmd.exe",
            args: ["/c", "dir"],
            cwd: projectRoot
          });
        },
        (err) => {
          assert.equal(err.code, "CODEIT_VALIDATION_ERROR");
          return true;
        }
      );
    });

    test("rejects POSIX shell interpreters 'bash' and 'sh' with CODEIT_VALIDATION_ERROR", async () => {
      await assert.rejects(
        async () => {
          await runner.execute({
            run_uuid: "00000001",
            executable: "bash",
            args: ["-c", "ls"],
            cwd: projectRoot
          });
        },
        (err) => {
          assert.equal(err.code, "CODEIT_VALIDATION_ERROR");
          return true;
        }
      );

      await assert.rejects(
        async () => {
          await runner.execute({
            run_uuid: "00000001",
            executable: "sh",
            args: ["-c", "ls"],
            cwd: projectRoot
          });
        },
        (err) => {
          assert.equal(err.code, "CODEIT_VALIDATION_ERROR");
          return true;
        }
      );
    });

    test("rejects malicious/arbitrary binary name 'malicious.exe'", async () => {
      await assert.rejects(
        async () => {
          await runner.execute({
            run_uuid: "00000001",
            executable: "malicious.exe",
            args: [],
            cwd: projectRoot
          });
        },
        (err) => {
          assert.equal(err.code, "CODEIT_VALIDATION_ERROR");
          return true;
        }
      );
    });

    test("rejects command chaining or shell injection characters in executable string", async () => {
      await assert.rejects(
        async () => {
          await runner.execute({
            run_uuid: "00000001",
            executable: "node & calc.exe",
            args: [],
            cwd: projectRoot
          });
        },
        (err) => {
          assert.equal(err.code, "CODEIT_VALIDATION_ERROR");
          return true;
        }
      );
    });
  });

  describe("4. CWD Validation & Workspace Boundary Isolation (E03 / E09)", () => {
    test("rejects relative path traversal escaping project root (CODEIT_PATH_DENIED)", async () => {
      await assert.rejects(
        async () => {
          await runner.execute({
            run_uuid: "00000001",
            executable: "node",
            args: ["--version"],
            cwd: "../outside-secret-area"
          });
        },
        (err) => {
          assert.ok(err instanceof PathDeniedError);
          assert.equal(err.code, "CODEIT_PATH_DENIED");
          assert.match(err.message, /escapes canonical workspace root/);
          return true;
        }
      );
    });

    test("rejects absolute path pointing outside canonical project root (CODEIT_PATH_DENIED)", async () => {
      await assert.rejects(
        async () => {
          await runner.execute({
            run_uuid: "00000001",
            executable: "node",
            args: ["--version"],
            cwd: outsideSecretDir
          });
        },
        (err) => {
          assert.equal(err.code, "CODEIT_PATH_DENIED");
          assert.match(err.message, /escapes canonical workspace root/);
          return true;
        }
      );
    });

    test("rejects junction / symlink pointing outside canonical project root (CODEIT_PATH_DENIED)", async () => {
      const escapeJunction = join(projectRoot, "escapelink");
      if (existsSync(escapeJunction)) {
        await assert.rejects(
          async () => {
            await runner.execute({
              run_uuid: "00000001",
              executable: "node",
              args: ["--version"],
              cwd: escapeJunction
            });
          },
          (err) => {
            assert.equal(err.code, "CODEIT_PATH_DENIED");
            return true;
          }
        );
      }
    });

    test("rejects non-existent directory with CODEIT_PATH_DENIED", async () => {
      await assert.rejects(
        async () => {
          await runner.execute({
            run_uuid: "00000001",
            executable: "node",
            args: ["--version"],
            cwd: join(projectRoot, "does-not-exist")
          });
        },
        (err) => {
          assert.equal(err.code, "CODEIT_PATH_DENIED");
          assert.match(err.message, /does not exist/);
          return true;
        }
      );
    });
  });

  describe("5. Secret Environment Scrubbing (E21)", () => {
    test("scrubs sensitive environment variables (*_KEY, *_SECRET, *_TOKEN, GEMINI_*, AWS_*) from child processes", async () => {
      // Set synthetic canary secrets in parent environment
      process.env.GEMINI_API_KEY = "CANARY_GEMINI_SECRET_KEY_123";
      process.env.AWS_SECRET_ACCESS_KEY = "CANARY_AWS_SECRET_456";
      process.env.CODEXSUN_CODEIT_PAIRING_TOKEN = "CANARY_PAIRING_TOKEN_789";
      process.env.MY_SECRET = "CANARY_MY_SECRET";
      process.env.AUTH_TOKEN = "CANARY_AUTH_TOKEN";
      process.env.DATABASE_PASSWORD = "CANARY_DB_PASS";

      // Test specific requirement: node -e "console.log(process.env.GEMINI_API_KEY || 'scrubbed')" prints 'scrubbed'
      const resultGemini = await runner.execute({
        run_uuid: "00000001",
        executable: "node",
        args: ["-e", "console.log(process.env.GEMINI_API_KEY || 'scrubbed');"],
        cwd: projectRoot
      });

      assert.equal(resultGemini.exit_code, 0);
      assert.equal(resultGemini.stdout.trim(), "scrubbed");

      // Verify comprehensive list of sensitive canaries are not accessible to child
      const verificationScript = `
        const keys = [
          'GEMINI_API_KEY',
          'AWS_SECRET_ACCESS_KEY',
          'CODEXSUN_CODEIT_PAIRING_TOKEN',
          'MY_SECRET',
          'AUTH_TOKEN',
          'DATABASE_PASSWORD'
        ];
        const leaked = keys.filter(k => process.env[k]);
        console.log(leaked.length === 0 ? 'ALL_SCRUBBED' : 'LEAKED:' + leaked.join(','));
      `;

      const resultAll = await runner.execute({
        run_uuid: "00000001",
        executable: "node",
        args: ["-e", verificationScript],
        cwd: projectRoot
      });

      assert.equal(resultAll.exit_code, 0);
      assert.equal(resultAll.stdout.trim(), "ALL_SCRUBBED");

      // Cleanup parent env canaries
      delete process.env.GEMINI_API_KEY;
      delete process.env.AWS_SECRET_ACCESS_KEY;
      delete process.env.CODEXSUN_CODEIT_PAIRING_TOKEN;
      delete process.env.MY_SECRET;
      delete process.env.AUTH_TOKEN;
      delete process.env.DATABASE_PASSWORD;
    });

    test("forwards safe system environment variables (PATH, SYSTEMROOT, TEMP)", () => {
      const clean = scrubEnvironment({
        PATH: process.env.PATH,
        SYSTEMROOT: process.env.SYSTEMROOT,
        TEMP: process.env.TEMP,
        GEMINI_KEY: "secret",
        GITHUB_TOKEN: "token"
      });

      assert.ok(clean.PATH !== undefined);
      if (process.env.SYSTEMROOT) {
        assert.ok(clean.SYSTEMROOT !== undefined);
      }
      assert.equal(clean.GEMINI_KEY, undefined);
      assert.equal(clean.GITHUB_TOKEN, undefined);
      assert.equal(clean.CI, "true");
    });
  });

  describe("6. Timeout Termination & Process Tree Cleanup (E10 / E16)", () => {
    test("terminates hanging process tree upon timeout and returns exit_code -1 with CODEIT_BUDGET_EXCEEDED", async () => {
      // Long-running process with 500ms timeout
      const result = await runner.execute({
        run_uuid: "00000001",
        executable: "node",
        args: ["-e", "setInterval(() => {}, 1000);"],
        cwd: projectRoot,
        timeout_ms: 500
      });

      assert.equal(result.exit_code, -1);
      assert.equal(result.timed_out, true);
      assert.match(result.error, /CODEIT_BUDGET_EXCEEDED/);
      assert.ok(result.duration_ms >= 450);
    });

    test("terminates entire descendant process tree including sub-spawns upon timeout", async () => {
      // Script that spawns a grandchild process before looping
      const multiProcessScript = `
        const { spawn } = require('node:child_process');
        const g = spawn(process.execPath, ['-e', 'setInterval(()=>{}, 1000);'], { stdio: 'ignore' });
        console.log('GrandchildPID:' + g.pid);
        setInterval(() => {}, 1000);
      `;

      let capturedGrandchildPid = null;

      const result = await runner.execute(
        {
          run_uuid: "00000001",
          executable: "node",
          args: ["-e", multiProcessScript],
          cwd: projectRoot,
          timeout_ms: 600
        },
        {
          onChunk: (chunk) => {
            const match = chunk.chunk.match(/GrandchildPID:(\d+)/);
            if (match) {
              capturedGrandchildPid = Number(match[1]);
            }
          }
        }
      );

      assert.equal(result.exit_code, -1);
      assert.equal(result.timed_out, true);

      // Verify grandchild process was also terminated
      if (capturedGrandchildPid) {
        if (process.platform === "win32") {
          // On Windows, taskkill /pid <PID> fails with code 128 if process is already dead
          let isDead = false;
          try {
            execSync(`taskkill /pid ${capturedGrandchildPid} /F`, { stdio: "pipe" });
          } catch {
            isDead = true; // Error code 128 = process not found
          }
          assert.equal(
            isDead,
            true,
            "Grandchild process must be cleanly terminated by process tree killer"
          );
        } else {
          let isDead = false;
          try {
            process.kill(capturedGrandchildPid, 0);
          } catch {
            isDead = true;
          }
          assert.equal(
            isDead,
            true,
            "Grandchild process must be cleanly terminated by process tree killer"
          );
        }
      }
    });
  });

  describe("7. Process Cancellation via AbortSignal (E10)", () => {
    test("cleanly aborts and terminates process tree upon AbortSignal", async () => {
      const controller = new AbortController();

      // Trigger abort after 200ms
      setTimeout(() => {
        controller.abort();
      }, 200);

      const result = await runner.execute(
        {
          run_uuid: "00000001",
          executable: "node",
          args: ["-e", "setInterval(() => {}, 1000);"],
          cwd: projectRoot,
          timeout_ms: 10000
        },
        {
          signal: controller.signal
        }
      );

      assert.equal(result.exit_code, -1);
      assert.match(result.error, /cancelled/i);
    });

    test("immediately returns cancelled result if signal is already aborted before execution", async () => {
      const controller = new AbortController();
      controller.abort();

      const result = await runner.execute(
        {
          run_uuid: "00000001",
          executable: "node",
          args: ["--version"],
          cwd: projectRoot
        },
        {
          signal: controller.signal
        }
      );

      assert.equal(result.exit_code, -1);
      assert.match(result.error, /cancelled/i);
      assert.equal(result.duration_ms, 0);
    });
  });

  describe("8. Bounded Output & Quota Truncation (E16)", () => {
    test("truncates output when generated bytes exceed quota (e.g. 1MB default) and sets truncated: true", async () => {
      // Generate 1.2MB of stdout data
      const generateLargeScript = `
        process.stdout.write('X'.repeat(1200000));
      `;

      const result = await runner.execute({
        run_uuid: "00000001",
        executable: "node",
        args: ["-e", generateLargeScript],
        cwd: projectRoot
      });

      assert.equal(result.exit_code, 0);
      assert.equal(result.truncated, true);
      assert.ok(result.stdout.includes(TRUNCATION_NOTICE));
      assert.ok(
        Buffer.byteLength(result.stdout, "utf8") <=
          DEFAULT_MAX_OUTPUT_BYTES + TRUNCATION_NOTICE.length + 1024
      );
    });

    test("enforces custom max_output_bytes quota bounds", async () => {
      const result = await runner.execute({
        run_uuid: "00000001",
        executable: "node",
        args: ["-e", "process.stdout.write('A'.repeat(5000));"],
        cwd: projectRoot,
        max_output_bytes: 500
      });

      assert.equal(result.exit_code, 0);
      assert.equal(result.truncated, true);
      assert.ok(result.stdout.includes(TRUNCATION_NOTICE));
    });
  });
});
