import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { execSync } from "node:child_process";
import { createServer } from "node:http";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { existsSync } from "node:fs";

// 1. Compile TypeScript to ensure dist output is up-to-date
const providerDistPath = resolve(
  process.cwd(),
  "dist/devkits/codeit/api/modules/provider/index.js"
);
if (!existsSync(providerDistPath)) {
  execSync("npx tsc -p devkits/codeit/api/tsconfig.json --noEmitOnError false", {
    stdio: "ignore"
  });
}
const {
  MockProvider,
  GeminiProvider,
  ProviderService,
  ProviderModule,
  TokenUsageSchema,
  NormalizedErrorSchema,
  ModelCapabilitySchema,
  ProviderStatusSchema
} = await import(pathToFileURL(providerDistPath).href);

describe("T03: Provider Adapter and Model Settings", () => {
  describe("1. MockProvider (Deterministic Offline Double)", () => {
    let mockProvider;

    before(() => {
      mockProvider = new MockProvider();
    });

    test("exposes correct identity, default model, and capabilities", () => {
      assert.equal(mockProvider.id, "mock");
      assert.equal(mockProvider.name, "Mock Offline Provider");
      assert.equal(mockProvider.configured, true);
      assert.ok(mockProvider.models.includes("mock-codeit-default"));
      assert.equal(mockProvider.defaultModel, "mock-codeit-default");

      const caps = mockProvider.getCapabilities();
      assert.equal(caps.supports_streaming, true);
      assert.equal(caps.supports_tools, true);
      assert.equal(caps.supports_vision, false);
      assert.ok(caps.max_context_tokens > 0);
      assert.ok(caps.max_output_tokens > 0);
      ModelCapabilitySchema.parse(caps);
    });

    test("health check reports available and healthy with latency measurement", async () => {
      const health = await mockProvider.checkHealth();
      assert.equal(health.id, "mock");
      assert.equal(health.available, true);
      assert.equal(health.configured, true);
      assert.ok(Array.isArray(health.models));
      assert.ok(typeof health.latency_ms === "number");
      ProviderStatusSchema.parse(health);
    });

    test("streams text chunks deterministically and finishes with stop", async () => {
      const chunks = [];
      const stream = mockProvider.generateStream({
        messages: [{ role: "user", content: "Plan task steps" }]
      });

      for await (const chunk of stream) {
        chunks.push(chunk);
      }

      const textChunks = chunks.filter((c) => c.type === "text_delta");
      assert.ok(textChunks.length >= 3, "Expected multiple streamed text deltas");
      assert.match(textChunks.map((c) => c.text).join(""), /canonical workspace boundary/);

      const usageChunk = chunks.find((c) => c.type === "usage");
      assert.ok(usageChunk, "Expected usage chunk");
      assert.ok(usageChunk.usage.prompt_tokens > 0);
      assert.ok(usageChunk.usage.completion_tokens > 0);
      assert.equal(
        usageChunk.usage.total_tokens,
        usageChunk.usage.prompt_tokens + usageChunk.usage.completion_tokens
      );
      TokenUsageSchema.parse(usageChunk.usage);

      const finishChunk = chunks.find((c) => c.type === "finish");
      assert.ok(finishChunk);
      assert.equal(finishChunk.finish_reason, "stop");
    });

    test("supports cancellation midway via AbortController and finishes with cancelled", async () => {
      const controller = new AbortController();
      const chunks = [];
      const stream = mockProvider.generateStream({
        messages: [{ role: "user", content: "Long generation" }],
        signal: controller.signal
      });

      for await (const chunk of stream) {
        chunks.push(chunk);
        if (chunk.type === "text_delta") {
          // Abort immediately after receiving first text chunk
          controller.abort();
        }
      }

      const finishChunk = chunks.find((c) => c.type === "finish");
      assert.ok(finishChunk, "Stream must terminate with finish chunk");
      assert.equal(finishChunk.finish_reason, "cancelled");

      // Verify stream halted early: received fewer text chunks than complete generation
      const textChunks = chunks.filter((c) => c.type === "text_delta");
      assert.ok(textChunks.length < 3, "Stream should stop yielding text deltas once cancelled");
    });

    test("generates tool-call proposal without executing tool", async () => {
      const chunks = [];
      const stream = mockProvider.generateStream({
        messages: [
          {
            role: "user",
            content: '[SIMULATE_TOOL_CALL: read_file({"path": "devkits/codeit/README.md"})]'
          }
        ]
      });

      for await (const chunk of stream) {
        chunks.push(chunk);
      }

      const toolChunk = chunks.find((c) => c.type === "tool_call_delta");
      assert.ok(toolChunk, "Expected tool_call_delta chunk");
      assert.equal(toolChunk.tool_call.name, "read_file");
      assert.match(toolChunk.tool_call.arguments_delta, /devkits\/codeit\/README\.md/);

      // Verify provider yielded proposal and finished with tool_calls
      const finishChunk = chunks.find((c) => c.type === "finish");
      assert.ok(finishChunk);
      assert.equal(finishChunk.finish_reason, "tool_calls");
    });

    test("supports explicitly unknown token usage accounting", async () => {
      const chunks = [];
      const stream = mockProvider.generateStream({
        messages: [{ role: "user", content: "Count [SIMULATE_USAGE: unknown]" }]
      });

      for await (const chunk of stream) {
        chunks.push(chunk);
      }

      const usageChunk = chunks.find((c) => c.type === "usage");
      assert.ok(usageChunk);
      assert.equal(usageChunk.usage.prompt_tokens, -1);
      assert.equal(usageChunk.usage.completion_tokens, -1);
      assert.equal(usageChunk.usage.total_tokens, -1);
      assert.equal(usageChunk.usage.is_estimated, true);
    });

    test("normalizes simulated errors for rate limit, auth, timeout, and bad request", async () => {
      const errorCases = [
        {
          trigger: "[SIMULATE_ERROR: rate_limit]",
          expectedCode: "CODEIT_PROVIDER_RATE_LIMIT",
          status: 429,
          retryable: true
        },
        {
          trigger: "[SIMULATE_ERROR: auth]",
          expectedCode: "CODEIT_PROVIDER_AUTH_FAILED",
          status: 401,
          retryable: false
        },
        {
          trigger: "[SIMULATE_ERROR: timeout]",
          expectedCode: "CODEIT_PROVIDER_TIMEOUT",
          status: 408,
          retryable: true
        },
        {
          trigger: "[SIMULATE_ERROR: bad_request]",
          expectedCode: "CODEIT_PROVIDER_BAD_REQUEST",
          status: 400,
          retryable: false
        }
      ];

      for (const ec of errorCases) {
        const chunks = [];
        const stream = mockProvider.generateStream({
          messages: [{ role: "user", content: `Trigger ${ec.trigger}` }]
        });

        for await (const chunk of stream) {
          chunks.push(chunk);
        }

        const errChunk = chunks.find((c) => c.type === "error");
        assert.ok(errChunk, `Expected error chunk for ${ec.expectedCode}`);
        assert.equal(errChunk.error.code, ec.expectedCode);
        assert.equal(errChunk.error.status, ec.status);
        assert.equal(errChunk.error.retryable, ec.retryable);
        NormalizedErrorSchema.parse(errChunk.error);
      }
    });
  });

  describe("2. GeminiProvider (Google Gemini Adapter & Normalization)", () => {
    test("reports unconfigured when GEMINI_API_KEY is empty and returns clean health", async () => {
      const unconfigured = new GeminiProvider({ apiKey: "" });
      assert.equal(unconfigured.configured, false);

      const health = await unconfigured.checkHealth();
      assert.equal(health.id, "gemini");
      assert.equal(health.available, false);
      assert.equal(health.configured, false);
      assert.match(health.error, /GEMINI_API_KEY environment variable not configured/);
    });

    test("fails fast with auth error when stream attempted without configured API key", async () => {
      const unconfigured = new GeminiProvider({ apiKey: "" });
      const chunks = [];
      const stream = unconfigured.generateStream({
        messages: [{ role: "user", content: "test" }]
      });

      for await (const chunk of stream) {
        chunks.push(chunk);
      }

      assert.equal(chunks.length, 1);
      assert.equal(chunks[0].type, "error");
      assert.equal(chunks[0].error.code, "CODEIT_PROVIDER_AUTH_FAILED");
      assert.equal(chunks[0].error.retryable, false);
    });

    test("streams SSE text and parses token usage with mock Gemini backend", async () => {
      const ssePayload = [
        'data: {"candidates":[{"content":{"parts":[{"text":"Gemini online: "}]}}]}\n\n',
        'data: {"candidates":[{"content":{"parts":[{"text":"streaming developer responses."}]}}],"usageMetadata":{"promptTokenCount":14,"candidatesTokenCount":8,"totalTokenCount":22}}\n\n',
        'data: {"candidates":[{"finishReason":"STOP"}]}\n\n'
      ];

      async function* mockSseStream() {
        for (const item of ssePayload) {
          yield Buffer.from(item, "utf8");
        }
      }

      const mockFetch = async (url) => {
        assert.ok(url.includes(":streamGenerateContent"));
        return {
          ok: true,
          status: 200,
          body: mockSseStream()
        };
      };

      const gemini = new GeminiProvider({
        apiKey: "fake_secret_key_12345",
        fetchFn: mockFetch
      });

      const chunks = [];
      const stream = gemini.generateStream({
        messages: [{ role: "user", content: "Hi" }]
      });

      for await (const chunk of stream) {
        chunks.push(chunk);
      }

      const textDeltas = chunks.filter((c) => c.type === "text_delta").map((c) => c.text);
      assert.equal(textDeltas.join(""), "Gemini online: streaming developer responses.");

      const usage = chunks.find((c) => c.type === "usage");
      assert.ok(usage);
      assert.equal(usage.usage.prompt_tokens, 14);
      assert.equal(usage.usage.completion_tokens, 8);
      assert.equal(usage.usage.total_tokens, 22);

      const finish = chunks.find((c) => c.type === "finish");
      assert.ok(finish);
      assert.equal(finish.finish_reason, "stop");
    });

    test("reassembles fragmented SSE chunks split across network packets", async () => {
      // Simulate fragmented network packets splitting an SSE event across byte boundaries
      const packet1 = 'data: {"candidates":[{"content":{"parts":[{"text":"Fragment';
      const packet2 = "ed text correctly ";
      const packet3 = 'reassembled"}]}}]}\n\n';

      async function* mockFragmentedStream() {
        yield Buffer.from(packet1, "utf8");
        yield Buffer.from(packet2, "utf8");
        yield Buffer.from(packet3, "utf8");
      }

      const mockFetch = async () => ({
        ok: true,
        status: 200,
        body: mockFragmentedStream()
      });

      const gemini = new GeminiProvider({
        apiKey: "fake_secret_key_12345",
        fetchFn: mockFetch
      });

      const chunks = [];
      const stream = gemini.generateStream({
        messages: [{ role: "user", content: "Fragment test" }]
      });

      for await (const chunk of stream) {
        chunks.push(chunk);
      }

      const texts = chunks.filter((c) => c.type === "text_delta").map((c) => c.text);
      assert.equal(texts.join(""), "Fragmented text correctly reassembled");
    });

    test("parses tool call proposal from Gemini functionCall response", async () => {
      const ssePayload = [
        'data: {"candidates":[{"content":{"parts":[{"functionCall":{"name":"patch_workspace","args":{"path":"src/test.ts","patch":"diff content"}}}]},"finishReason":"TOOL_CALL"}]}\n\n'
      ];

      async function* mockSseStream() {
        for (const item of ssePayload) {
          yield Buffer.from(item, "utf8");
        }
      }

      const mockFetch = async () => ({
        ok: true,
        status: 200,
        body: mockSseStream()
      });

      const gemini = new GeminiProvider({
        apiKey: "fake_secret_key_12345",
        fetchFn: mockFetch
      });

      const chunks = [];
      const stream = gemini.generateStream({
        messages: [{ role: "user", content: "propose patch" }],
        tools: [{ name: "patch_workspace", description: "apply patch" }]
      });

      for await (const chunk of stream) {
        chunks.push(chunk);
      }

      const toolDelta = chunks.find((c) => c.type === "tool_call_delta");
      assert.ok(toolDelta, "Expected tool_call_delta");
      assert.equal(toolDelta.tool_call.name, "patch_workspace");
      assert.match(toolDelta.tool_call.arguments_delta, /src\/test\.ts/);
      assert.match(toolDelta.tool_call.arguments_delta, /diff content/);

      const finish = chunks.find((c) => c.type === "finish");
      assert.ok(finish);
      assert.equal(finish.finish_reason, "tool_calls");
    });

    test("normalizes HTTP error codes (429, 401, 504, 400) and scrubs API keys", async () => {
      const secretCanary = "SECRET_CANARY_API_KEY_99999";

      const testCases = [
        {
          status: 429,
          responseBody: { error: { message: `Quota exhausted with key=${secretCanary}` } },
          expectedCode: "CODEIT_PROVIDER_RATE_LIMIT",
          retryable: true
        },
        {
          status: 401,
          responseBody: { error: { message: `Invalid authentication key ${secretCanary}` } },
          expectedCode: "CODEIT_PROVIDER_AUTH_FAILED",
          retryable: false
        },
        {
          status: 504,
          responseBody: {
            error: { message: `Gateway timeout accessing endpoint?key=${secretCanary}` }
          },
          expectedCode: "CODEIT_PROVIDER_TIMEOUT",
          retryable: true
        },
        {
          status: 400,
          responseBody: { error: { message: "Invalid argument: temperature out of range" } },
          expectedCode: "CODEIT_PROVIDER_BAD_REQUEST",
          retryable: false
        }
      ];

      for (const tc of testCases) {
        const mockFetch = async () => ({
          ok: false,
          status: tc.status,
          text: async () => JSON.stringify(tc.responseBody)
        });

        const gemini = new GeminiProvider({
          apiKey: secretCanary,
          fetchFn: mockFetch
        });

        const chunks = [];
        const stream = gemini.generateStream({
          messages: [{ role: "user", content: "Test error" }]
        });

        for await (const chunk of stream) {
          chunks.push(chunk);
        }

        const errChunk = chunks.find((c) => c.type === "error");
        assert.ok(errChunk, `Expected error chunk for HTTP ${tc.status}`);
        assert.equal(errChunk.error.code, tc.expectedCode);
        assert.equal(errChunk.error.retryable, tc.retryable);

        // Security assertion: API key must NEVER appear in the error message
        assert.equal(
          errChunk.error.message.includes(secretCanary),
          false,
          "Raw API key must be scrubbed"
        );
      }
    });
  });

  describe("3. ProviderService and Public Composition", () => {
    let service;

    before(() => {
      service = new ProviderService();
    });

    test("lists registered providers without exposing secret credentials", async () => {
      const list = await service.listProviders();
      assert.ok(Array.isArray(list));
      assert.ok(list.length >= 2, "Expected at least mock and gemini providers");

      const mockInfo = list.find((p) => p.id === "mock");
      assert.ok(mockInfo);
      assert.equal(mockInfo.available, true);
      assert.equal(mockInfo.configured, true);

      const geminiInfo = list.find((p) => p.id === "gemini");
      assert.ok(geminiInfo);

      // Verify no secret properties leaked in status
      for (const p of list) {
        assert.equal("apiKey" in p, false);
        assert.equal("token" in p, false);
        assert.equal("secret" in p, false);
      }
    });

    test("resolves default adapter and throws NotFoundError for unknown provider", () => {
      const defaultAdapter = service.getDefaultAdapter();
      assert.ok(defaultAdapter);
      assert.ok(defaultAdapter.id === "mock" || defaultAdapter.id === "gemini");

      assert.throws(() => service.getAdapter("non_existent_provider"), {
        name: "CodeitError"
      });
    });

    test("runs connection test via testProvider()", async () => {
      const result = await service.testProvider("mock");
      assert.equal(result.success, true);
      assert.equal(result.provider, "mock");
      assert.ok(typeof result.latency_ms === "number");
      assert.match(result.message, /verified/i);
    });
  });

  describe("4. Provider HTTP Endpoints (Loopback Server Integration)", () => {
    let server;
    let serverPort;
    let providerModule;

    before(async () => {
      providerModule = new ProviderModule();
      const routes = providerModule.routes;

      server = createServer(async (req, res) => {
        const correlationId = "c0de17-test-correlation";
        res.setHeader("X-Correlation-Id", correlationId);

        try {
          const parsedUrl = new URL(req.url, `http://127.0.0.1:0`);
          const matched = routes.find(
            (r) =>
              r.method.toUpperCase() === req.method.toUpperCase() && r.path === parsedUrl.pathname
          );

          if (!matched) {
            res.statusCode = 404;
            res.setHeader("Content-Type", "application/json");
            res.end(
              JSON.stringify({ success: false, data: null, error: { code: "CODEIT_NOT_FOUND" } })
            );
            return;
          }

          let body = null;
          if (["POST", "PUT"].includes(req.method)) {
            const chunks = [];
            for await (const chunk of req) chunks.push(chunk);
            const raw = Buffer.concat(chunks).toString("utf8");
            body = raw ? JSON.parse(raw) : {};
          }

          const result = await matched.handler(req, res, {
            params: {},
            query: parsedUrl.searchParams,
            body,
            correlationId
          });

          res.statusCode = 200;
          res.setHeader("Content-Type", "application/json");
          res.end(
            JSON.stringify({
              success: true,
              data: result,
              error: null,
              correlation_id: correlationId
            })
          );
        } catch (err) {
          res.statusCode = 500;
          res.setHeader("Content-Type", "application/json");
          res.end(
            JSON.stringify({
              success: false,
              data: null,
              error: { code: "CODEIT_INTERNAL_ERROR", message: err.message },
              correlation_id: correlationId
            })
          );
        }
      });

      await new Promise((resolvePromise) => {
        server.listen(0, "127.0.0.1", () => {
          serverPort = server.address().port;
          resolvePromise();
        });
      });
    });

    after(async () => {
      if (server) {
        await new Promise((resolvePromise) => server.close(resolvePromise));
      }
    });

    test("GET /api/codeit/providers returns provider status list in standard envelope", async () => {
      const res = await fetch(`http://127.0.0.1:${serverPort}/api/codeit/providers`);
      assert.equal(res.status, 200);

      const envelope = await res.json();
      assert.equal(envelope.success, true);
      assert.equal(envelope.error, null);
      assert.ok(envelope.correlation_id.startsWith("c0de17-"));
      assert.ok(Array.isArray(envelope.data.providers));
      assert.ok(envelope.data.providers.some((p) => p.id === "mock"));
    });

    test("POST /api/codeit/providers/test tests connection and returns result", async () => {
      const res = await fetch(`http://127.0.0.1:${serverPort}/api/codeit/providers/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: "mock" })
      });

      assert.equal(res.status, 200);
      const envelope = await res.json();
      assert.equal(envelope.success, true);
      assert.equal(envelope.data.provider, "mock");
      assert.equal(envelope.data.success, true);
      assert.ok(typeof envelope.data.latency_ms === "number");
    });
  });
});
