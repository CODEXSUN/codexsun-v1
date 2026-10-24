import { test, describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { execSync } from "node:child_process";
import { resolve, join } from "node:path";
import { pathToFileURL } from "node:url";

// Ensure compiled dist is up to date
const distPath = resolve(process.cwd(), "dist/devkits/codeit/api");
execSync("npx tsc -p devkits/codeit/api/tsconfig.json", { stdio: "inherit" });

const {
  PluginModule,
  PluginService,
  PluginRepository,
  McpBroker,
  createPluginRoutes,
  computeManifestDigest,
  PluginIntegrityError,
  PluginStateError,
  PluginRevokedError,
  McpProtocolError
} = await import(pathToFileURL(join(distPath, "modules/plugin/index.js")).href);

const { CodeitDatabase, runMigrations } = await import(
  pathToFileURL(join(distPath, "storage/index.js")).href
);

const { CodeitError, NotFoundError } = await import(
  pathToFileURL(join(distPath, "errors.js")).href
);

const mockServerPath = resolve(
  process.cwd(),
  "devkits/codeit/api/test/fixtures/plugins/mock-mcp-server.mjs"
);

function createTestManifest(overrides = {}) {
  const base = {
    plugin_id: "mock-mcp-plugin",
    name: "Mock MCP Plugin",
    version: "1.0.0",
    description: "A test fixture MCP plugin for testing lifecycle and broker",
    entrypoint: {
      command: "node",
      args: [mockServerPath]
    },
    capabilities: ["tools"],
    advertised_tools: [
      {
        name: "echo",
        description: "Echoes input message",
        inputSchema: {
          type: "object",
          properties: { message: { type: "string" } }
        },
        required_grants: []
      },
      {
        name: "env_check",
        description: "Checks visible environment variables",
        inputSchema: { type: "object" },
        required_grants: []
      },
      {
        name: "large_payload",
        description: "Returns 600KB text payload",
        inputSchema: { type: "object" },
        required_grants: []
      },
      {
        name: "hang",
        description: "Hangs indefinitely",
        inputSchema: { type: "object" },
        required_grants: []
      },
      {
        name: "privileged_tool",
        description: "Requires explicit grant",
        inputSchema: { type: "object" },
        required_grants: ["admin:execute"]
      }
    ],
    requested_grants: ["basic:run"],
    author: "Codeit Test Worker",
    ...overrides
  };

  const digest = computeManifestDigest(base);
  return {
    ...base,
    manifest_digest: digest
  };
}

describe("T10: Plugin Lifecycle & MCP Broker (E10, E12, E16, E17, E18, E20, E21)", () => {
  let db;
  let repo;
  let broker;
  let service;
  let pluginModule;

  beforeEach(() => {
    const codeitDb = new CodeitDatabase({ inMemory: true });
    db = codeitDb.db;
    runMigrations(db);

    repo = new PluginRepository(db);
    broker = new McpBroker();
    service = new PluginService(repo, broker);
    pluginModule = new PluginModule(db, broker);
  });

  afterEach(() => {
    broker.terminateAll();
  });

  describe("1. Manifest Integrity & Schema Validation (E17)", () => {
    test("installs valid manifest with verified SHA-256 digest in 'installed' state", () => {
      const manifest = createTestManifest();
      const installed = service.install(manifest);

      assert.ok(installed.uuid);
      assert.strictEqual(installed.uuid.length, 8);
      assert.strictEqual(installed.plugin_id, "mock-mcp-plugin");
      assert.strictEqual(installed.version, "1.0.0");
      assert.strictEqual(installed.manifest_digest, manifest.manifest_digest);
      assert.strictEqual(installed.enabled_state, "installed");
      assert.deepStrictEqual(installed.grants, []);
    });

    test("fails closed with CODEIT_PLUGIN_INTEGRITY_VIOLATION when manifest is tampered", () => {
      const valid = createTestManifest();
      // Tamper with description or capability without updating digest
      const tampered = {
        ...valid,
        description: "Tampered malicious description attempting injection"
      };

      assert.throws(
        () => service.install(tampered),
        (err) => {
          assert.strictEqual(err.code, "CODEIT_PLUGIN_INTEGRITY_VIOLATION");
          assert.strictEqual(err.statusCode, 400);
          return true;
        }
      );
    });

    test("fails closed with CODEIT_PLUGIN_INTEGRITY_VIOLATION when tool list is tampered", () => {
      const valid = createTestManifest();
      const tampered = {
        ...valid,
        advertised_tools: [
          ...valid.advertised_tools,
          { name: "backdoor", description: "Injected tool", required_grants: [] }
        ]
      };

      assert.throws(
        () => service.install(tampered),
        (err) => {
          assert.strictEqual(err.code, "CODEIT_PLUGIN_INTEGRITY_VIOLATION");
          return true;
        }
      );
    });

    test("fails closed on invalid semver or invalid plugin_id schema", () => {
      const invalid = {
        plugin_id: "INVALID PLUGIN ID WITH SPACES",
        name: "Test",
        version: "not-a-semver",
        manifest_digest: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
        entrypoint: "node ./test.js"
      };

      assert.throws(
        () => service.install(invalid),
        (err) => {
          assert.strictEqual(err.code, "CODEIT_VALIDATION_ERROR");
          return true;
        }
      );
    });
  });

  describe("2. Distinct Audited Lifecycle Transitions (E17, E18)", () => {
    test("lifecycle transitions: install -> enable -> disable -> revoke -> uninstall", () => {
      const manifest = createTestManifest();
      const installed = service.install(manifest);
      assert.strictEqual(installed.enabled_state, "installed");

      // Attempting to invoke tool while merely installed fails closed
      assert.rejects(
        async () => {
          await service.invokeTool(installed.uuid, "echo", { message: "test" });
        },
        (err) => {
          assert.strictEqual(err.code, "CODEIT_PLUGIN_STATE_ERROR");
          return true;
        }
      );

      // Transition to enabled
      const enabled = service.enable(installed.uuid);
      assert.strictEqual(enabled.enabled_state, "enabled");
      assert.deepStrictEqual(enabled.grants, ["basic:run"]);

      // Transition to disabled
      const disabled = service.disable(installed.uuid);
      assert.strictEqual(disabled.enabled_state, "disabled");

      // Invocations fail closed when disabled
      assert.rejects(
        async () => {
          await service.invokeTool(installed.uuid, "echo", { message: "test" });
        },
        (err) => {
          assert.strictEqual(err.code, "CODEIT_PLUGIN_STATE_ERROR");
          return true;
        }
      );

      // Re-enabling works
      const reenabled = service.enable(installed.uuid, ["custom:grant"]);
      assert.strictEqual(reenabled.enabled_state, "enabled");
      assert.deepStrictEqual(reenabled.grants, ["custom:grant"]);

      // Revoking fences permanently
      const revoked = service.revoke(installed.uuid);
      assert.strictEqual(revoked.enabled_state, "revoked");
      assert.deepStrictEqual(revoked.grants, []);

      // Enabling a revoked plugin is denied
      assert.throws(
        () => service.enable(installed.uuid),
        (err) => {
          assert.strictEqual(err.code, "CODEIT_PLUGIN_REVOKED");
          return true;
        }
      );

      // Invocations fail closed on revoked plugin
      assert.rejects(
        async () => {
          await service.invokeTool(installed.uuid, "echo", { message: "test" });
        },
        (err) => {
          assert.strictEqual(err.code, "CODEIT_PLUGIN_REVOKED");
          return true;
        }
      );

      // Uninstall removes record
      const deleted = service.uninstall(installed.uuid);
      assert.strictEqual(deleted, true);
      assert.strictEqual(repo.findByUuid(installed.uuid), null);
    });
  });

  describe("3. Tool Namespacing & Built-in Collision Prevention", () => {
    test("tools are namespaced with plugin:<plugin_id>:<tool_name>", async () => {
      const manifest = createTestManifest();
      const installed = service.install(manifest);
      service.enable(installed.uuid);

      const tools = await service.listTools(installed.uuid);
      assert.ok(tools.length > 0);

      for (const tool of tools) {
        assert.ok(
          tool.name.startsWith(`plugin:${manifest.plugin_id}:`),
          `Tool name '${tool.name}' must start with plugin prefix`
        );
      }

      const echoTool = tools.find((t) => t.name.endsWith(":echo"));
      assert.ok(echoTool);
      assert.strictEqual(echoTool.name, `plugin:${manifest.plugin_id}:echo`);
    });

    test("calling a tool prefixed with another plugin's id is rejected", async () => {
      const manifest = createTestManifest();
      const installed = service.install(manifest);
      service.enable(installed.uuid);

      await assert.rejects(
        async () => {
          await service.invokeTool(installed.uuid, "plugin:other-plugin:echo", {
            message: "hi"
          });
        },
        (err) => {
          assert.strictEqual(err.code, "CODEIT_RESOURCE_DENIED");
          return true;
        }
      );
    });
  });

  describe("4. Controlled MCP stdio Fixture & Real Tool Invocation", () => {
    test("broker performs handshake and successfully executes echo tool", async () => {
      const manifest = createTestManifest();
      const installed = service.install(manifest);
      service.enable(installed.uuid);

      const result = await service.invokeTool(installed.uuid, `plugin:${manifest.plugin_id}:echo`, {
        message: "Hello from Codeit Test"
      });

      assert.strictEqual(result.isError, false);
      assert.ok(Array.isArray(result.content));
      assert.strictEqual(result.content[0].text, "Echo: Hello from Codeit Test");
    });

    test("invoking with unnamespaced raw tool name also works", async () => {
      const manifest = createTestManifest();
      const installed = service.install(manifest);
      service.enable(installed.uuid);

      const result = await service.invokeTool(installed.uuid, "echo", {
        message: "Direct invocation"
      });

      assert.strictEqual(result.isError, false);
      assert.strictEqual(result.content[0].text, "Echo: Direct invocation");
    });
  });

  describe("5. Grant & Capability Policy Enforcement (E17, E20)", () => {
    test("rejects invocation of privileged tool when required grant is missing", async () => {
      const manifest = createTestManifest();
      const installed = service.install(manifest);
      service.enable(installed.uuid); // only has ["basic:run"]

      await assert.rejects(
        async () => {
          await service.invokeTool(installed.uuid, "privileged_tool", {});
        },
        (err) => {
          assert.strictEqual(err.code, "CODEIT_APPROVAL_REQUIRED");
          assert.strictEqual(err.statusCode, 403);
          return true;
        }
      );
    });

    test("permits invocation of privileged tool when required grant is explicitly provided", async () => {
      const manifest = createTestManifest();
      const installed = service.install(manifest);
      service.enable(installed.uuid, ["admin:execute"]);

      const result = await service.invokeTool(installed.uuid, "echo", {
        message: "Authorized"
      });
      assert.strictEqual(result.isError, false);
    });
  });

  describe("6. Secret Environment Scrubbing (E21)", () => {
    test("child MCP process does NOT receive sensitive environment tokens", async () => {
      // Inject synthetic canaries into parent process.env
      process.env.OPENAI_API_KEY = "sk-canary-secret-token-12345";
      process.env.CODEIT_SECRET_TOKEN = "sec-canary-codeit-999";
      process.env.DATABASE_PASSWORD = "canary-super-secret-password";
      process.env.MY_AUTH_TOKEN = "canary-auth-token";
      process.env.API_KEY_CANARY = "canary-key";

      try {
        const manifest = createTestManifest();
        const installed = service.install(manifest);
        service.enable(installed.uuid);

        const result = await service.invokeTool(installed.uuid, "env_check", {});
        assert.strictEqual(result.isError, false);

        const visibleKeys = JSON.parse(result.content[0].text);

        // Assert no sensitive keys leaked into child process
        assert.ok(!visibleKeys.includes("OPENAI_API_KEY"), "OPENAI_API_KEY must be scrubbed");
        assert.ok(
          !visibleKeys.includes("CODEIT_SECRET_TOKEN"),
          "CODEIT_SECRET_TOKEN must be scrubbed"
        );
        assert.ok(!visibleKeys.includes("DATABASE_PASSWORD"), "DATABASE_PASSWORD must be scrubbed");
        assert.ok(!visibleKeys.includes("MY_AUTH_TOKEN"), "MY_AUTH_TOKEN must be scrubbed");
        assert.ok(!visibleKeys.includes("API_KEY_CANARY"), "API_KEY_CANARY must be scrubbed");

        for (const key of visibleKeys) {
          assert.ok(
            !/(?:_KEY|_SECRET|_TOKEN|PASSWORD|CREDENTIAL|PRIVATE_KEY|AUTH_TOKEN|API_KEY|BEARER|CANARY)/i.test(
              key
            ),
            `Key '${key}' should not be present in scrubbed child environment`
          );
        }
      } finally {
        delete process.env.OPENAI_API_KEY;
        delete process.env.CODEIT_SECRET_TOKEN;
        delete process.env.DATABASE_PASSWORD;
        delete process.env.MY_AUTH_TOKEN;
        delete process.env.API_KEY_CANARY;
      }
    });
  });

  describe("7. Bounded Output & Payload Quota Truncation (E16)", () => {
    test("bounds output exceeding 500KB and marks result as truncated", async () => {
      const manifest = createTestManifest();
      const installed = service.install(manifest);
      service.enable(installed.uuid);

      const result = await service.invokeTool(installed.uuid, "large_payload", {});

      assert.strictEqual(result.isError, false);
      assert.strictEqual(result.truncated, true);

      const text = result.content[0].text;
      assert.ok(text.includes("[TRUNCATED: Output exceeded 500KB payload limit]"));

      // Output size must be bounded below or around 500KB
      const byteLength = Buffer.byteLength(text, "utf8");
      assert.ok(
        byteLength <= 500 * 1024,
        `Truncated output size (${byteLength} bytes) must not exceed 500KB`
      );
    });
  });

  describe("8. Process Timeout & Cancellation Cleanup (E10)", () => {
    test("times out hanging tool invocation and cleans up child process tree", async () => {
      const manifest = createTestManifest();
      const installed = service.install(manifest);
      service.enable(installed.uuid);

      await assert.rejects(
        async () => {
          await service.invokeTool(installed.uuid, "hang", {}, { timeoutMs: 300 });
        },
        (err) => {
          assert.strictEqual(err.code, "CODEIT_BUDGET_EXCEEDED");
          assert.strictEqual(err.statusCode, 504);
          return true;
        }
      );
    });

    test("immediately cancels invocation via AbortSignal", async () => {
      const manifest = createTestManifest();
      const installed = service.install(manifest);
      service.enable(installed.uuid);

      const controller = new AbortController();
      setTimeout(() => controller.abort(), 50);

      await assert.rejects(
        async () => {
          await service.invokeTool(
            installed.uuid,
            "hang",
            {},
            { timeoutMs: 5000, signal: controller.signal }
          );
        },
        (err) => {
          assert.strictEqual(err.code, "CODEIT_INVALID_STATE");
          assert.strictEqual(err.statusCode, 499);
          return true;
        }
      );
    });
  });

  describe("9. Revocation & Disable Fencing of In-Flight Work (E12, E18)", () => {
    test("fences active in-flight invocations immediately when plugin is disabled", async () => {
      const manifest = createTestManifest();
      const installed = service.install(manifest);
      service.enable(installed.uuid);

      // Warm up session so broker handshake is complete
      await service.invokeTool(installed.uuid, "echo", { message: "ready" });

      // Start a hanging tool call
      const inFlightPromise = service.invokeTool(installed.uuid, "hang", {}, { timeoutMs: 10000 });

      // Give stdio a moment to dispatch
      await new Promise((r) => setTimeout(r, 50));

      // Disable plugin while work is running
      service.disable(installed.uuid);

      // In-flight call must be rejected immediately
      await assert.rejects(inFlightPromise, (err) => {
        assert.strictEqual(err.code, "CODEIT_PLUGIN_REVOKED");
        return true;
      });
    });

    test("fences active in-flight invocations immediately when plugin is revoked", async () => {
      const manifest = createTestManifest();
      const installed = service.install(manifest);
      service.enable(installed.uuid);

      // Warm up session so broker handshake is complete
      await service.invokeTool(installed.uuid, "echo", { message: "ready" });

      const inFlightPromise = service.invokeTool(installed.uuid, "hang", {}, { timeoutMs: 10000 });

      await new Promise((r) => setTimeout(r, 50));

      // Revoke plugin
      service.revoke(installed.uuid);

      await assert.rejects(inFlightPromise, (err) => {
        assert.strictEqual(err.code, "CODEIT_PLUGIN_REVOKED");
        return true;
      });
    });

    test("fences cold in-flight invocations when disabled during broker startup", async () => {
      const manifest = createTestManifest();
      const installed = service.install(manifest);
      service.enable(installed.uuid);

      // Trigger invocation cold (no warmup)
      const inFlightPromise = service.invokeTool(installed.uuid, "hang", {}, { timeoutMs: 10000 });

      // Immediately disable without waiting for handshake
      service.disable(installed.uuid);

      await assert.rejects(inFlightPromise, (err) => {
        assert.strictEqual(err.code, "CODEIT_PLUGIN_REVOKED");
        return true;
      });
    });
  });

  describe("10. HTTP Route Endpoints Verification", () => {
    test("HTTP routes handle install, enable, list tools, invoke, disable, and uninstall", async () => {
      const routes = createPluginRoutes(service);

      const findRoute = (method, path) =>
        routes.find((r) => r.method === method && r.path === path);

      const listRoute = findRoute("GET", "/api/codeit/plugins");
      const installRoute = findRoute("POST", "/api/codeit/plugins/install");
      const enableRoute = findRoute("POST", "/api/codeit/plugins/:uuid/enable");
      const toolsRoute = findRoute("GET", "/api/codeit/plugins/:uuid/tools");
      const invokeRoute = findRoute("POST", "/api/codeit/plugins/:uuid/invoke");
      const disableRoute = findRoute("POST", "/api/codeit/plugins/:uuid/disable");
      const revokeRoute = findRoute("POST", "/api/codeit/plugins/:uuid/revoke");
      const deleteRoute = findRoute("DELETE", "/api/codeit/plugins/:uuid");

      assert.ok(listRoute);
      assert.ok(installRoute);
      assert.ok(enableRoute);
      assert.ok(toolsRoute);
      assert.ok(invokeRoute);
      assert.ok(disableRoute);
      assert.ok(revokeRoute);
      assert.ok(deleteRoute);

      // 1. Install
      const manifest = createTestManifest({ plugin_id: "http-test-plugin" });
      const installRes = await installRoute.handler(null, null, {
        params: {},
        query: new URLSearchParams(),
        body: { manifest },
        correlationId: "test-c0de"
      });
      assert.strictEqual(installRes.plugin_id, "http-test-plugin");
      const uuid = installRes.uuid;

      // 2. List
      const listRes = await listRoute.handler(null, null, {
        params: {},
        query: new URLSearchParams(),
        body: null,
        correlationId: "test-c0de"
      });
      assert.ok(listRes.plugins.some((p) => p.uuid === uuid));

      // 3. Enable
      const enableRes = await enableRoute.handler(null, null, {
        params: { uuid },
        query: new URLSearchParams(),
        body: { grants: ["basic:run"] },
        correlationId: "test-c0de"
      });
      assert.strictEqual(enableRes.enabled_state, "enabled");

      // 4. Tools
      const toolsRes = await toolsRoute.handler(null, null, {
        params: { uuid },
        query: new URLSearchParams(),
        body: null,
        correlationId: "test-c0de"
      });
      assert.ok(toolsRes.tools.length > 0);

      // 5. Invoke
      const invokeRes = await invokeRoute.handler(null, null, {
        params: { uuid },
        query: new URLSearchParams(),
        body: { tool_name: "echo", arguments: { message: "HTTP Invoke Test" } },
        correlationId: "test-c0de"
      });
      assert.strictEqual(invokeRes.content[0].text, "Echo: HTTP Invoke Test");

      // 6. Disable
      const disableRes = await disableRoute.handler(null, null, {
        params: { uuid },
        query: new URLSearchParams(),
        body: null,
        correlationId: "test-c0de"
      });
      assert.strictEqual(disableRes.enabled_state, "disabled");

      // 7. Revoke
      const revokeRes = await revokeRoute.handler(null, null, {
        params: { uuid },
        query: new URLSearchParams(),
        body: null,
        correlationId: "test-c0de"
      });
      assert.strictEqual(revokeRes.enabled_state, "revoked");

      // 8. Delete
      const deleteRes = await deleteRoute.handler(null, null, {
        params: { uuid },
        query: new URLSearchParams(),
        body: null,
        correlationId: "test-c0de"
      });
      assert.strictEqual(deleteRes.uninstalled, true);
    });
  });
});
