import { createServer, type Server } from "node:http";
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { HostVerifier } from "../src/session/host-verifier.js";
import { NativeSessionManager } from "../src/session/native-session-manager.js";
import { NativeHttpTransport, type NativeHttpDispatcher } from "../src/native/http.js";
import { PlatformApiError } from "../src/session/session-types.js";

describe("Native HTTP Transport", () => {
  let server: Server;
  let serverPort: number;
  let serverOrigin: string;

  before(async () => {
    server = createServer((req, res) => {
      const url = new URL(req.url ?? "/", `http://${req.headers.host}`);

      if (url.pathname === "/api/echo") {
        let body = "";
        req.on("data", (chunk) => {
          body += chunk;
        });
        req.on("end", () => {
          let parsed: unknown = null;
          if (body) {
            try {
              parsed = JSON.parse(body);
            } catch {
              parsed = body;
            }
          }
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(
            JSON.stringify({
              data: {
                body: parsed,
                headers: req.headers,
                method: req.method
              },
              success: true
            })
          );
        });
        return;
      }

      if (url.pathname === "/api/error") {
        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            error: { code: "NOT_FOUND", message: "Record was not found." },
            success: false
          })
        );
        return;
      }

      if (url.pathname === "/api/session-expired") {
        res.writeHead(401, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            error: { code: "AUTH_SESSION_EXPIRED", message: "Session expired on server." },
            success: false
          })
        );
        return;
      }

      if (url.pathname === "/api/slow") {
        const timer = setTimeout(() => {
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ data: { delayed: true }, success: true }));
        }, 200);
        req.on("close", () => {
          clearTimeout(timer);
        });
        return;
      }

      if (url.pathname === "/api/upload") {
        const chunks: Buffer[] = [];
        req.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
        req.on("end", () => {
          const totalBuffer = Buffer.concat(chunks);
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(
            JSON.stringify({
              data: {
                contentType: req.headers["content-type"],
                headers: req.headers,
                size: totalBuffer.length
              },
              success: true
            })
          );
        });
        return;
      }

      if (url.pathname === "/api/document.pdf") {
        const pdfContent = Buffer.from("%PDF-1.5 test document stream content");
        res.writeHead(200, {
          "Content-Length": pdfContent.length,
          "Content-Type": "application/pdf"
        });
        res.end(pdfContent);
        return;
      }

      if (url.pathname === "/api/media.png") {
        const pngContent = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
        res.writeHead(200, {
          "Content-Length": pngContent.length,
          "Content-Type": "image/png"
        });
        res.end(pngContent);
        return;
      }

      res.writeHead(404);
      res.end("Not Found");
    });

    await new Promise<void>((resolve) => {
      server.listen(0, "127.0.0.1", () => {
        const address = server.address();
        if (address && typeof address === "object") {
          serverPort = address.port;
          serverOrigin = `http://127.0.0.1:${serverPort}`;
        }
        resolve();
      });
    });
  });

  after(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it("executes JSON requests (GET, POST, PUT, PATCH, DELETE) and unwraps envelopes", async () => {
    const verifier = new HostVerifier({ allowLoopback: true });
    const sessionManager = new NativeSessionManager({
      apiOrigin: serverOrigin,
      hostVerifier: verifier
    });
    const transport = new NativeHttpTransport({ hostVerifier: verifier, sessionManager });

    // 1. GET
    const getRes = await transport.get<{ method: string }>("/api/echo");
    assert.equal(getRes.method, "GET");

    // 2. POST
    const postRes = await transport.post<{ body: { message: string }; method: string }>("/api/echo", {
      message: "Hello CODEXSUN"
    });
    assert.equal(postRes.method, "POST");
    assert.equal(postRes.body.message, "Hello CODEXSUN");

    // 3. PUT
    const putRes = await transport.put<{ body: { count: number }; method: string }>("/api/echo", {
      count: 99
    });
    assert.equal(putRes.method, "PUT");
    assert.equal(putRes.body.count, 99);

    // 4. PATCH
    const patchRes = await transport.patch<{ body: { active: boolean }; method: string }>("/api/echo", {
      active: true
    });
    assert.equal(patchRes.method, "PATCH");
    assert.equal(patchRes.body.active, true);

    // 5. DELETE
    const deleteRes = await transport.delete<{ method: string }>("/api/echo");
    assert.equal(deleteRes.method, "DELETE");
  });

  it("automatically injects session slot and tenant/company context headers", async () => {
    const verifier = new HostVerifier({ allowLoopback: true });
    const sessionManager = new NativeSessionManager({
      apiOrigin: serverOrigin,
      hostVerifier: verifier
    });

    // Mock active session in manager
    const mockSession = {
      activeCompanyId: 42,
      activeFinancialYearId: 2026,
      apiOrigin: serverOrigin,
      authenticated: true,
      desk: "tenant" as const,
      email: "engineer@company.com",
      expiresAt: new Date(Date.now() + 3600_000).toISOString(),
      loginHost: `127.0.0.1:${serverPort}`,
      sessionGeneration: 1,
      sessionSlot: "11223344556677889900aabbccddeeff",
      tenantCode: "TENANT_X",
      tenantDbName: "tenant_x_db",
      tenantId: "tenant-x-uuid",
      token: "secret-session-bearer-token",
      userType: "tenant"
    };

    await sessionManager["storage"].storeSession(mockSession);
    sessionManager["_activeSession"] = mockSession;
    sessionManager["_status"] = "authenticated";

    const transport = new NativeHttpTransport({ hostVerifier: verifier, sessionManager });

    const result = await transport.get<{ headers: Record<string, string> }>("/api/echo");

    assert.equal(result.headers["x-codexsun-session-slot"], "11223344556677889900aabbccddeeff");
    assert.equal(result.headers["x-tenant-id"], "tenant-x-uuid");
    assert.equal(result.headers["x-tenant-db"], "tenant_x_db");
    assert.equal(result.headers["x-company-id"], "42");
    assert.equal(result.headers["x-financial-year-id"], "2026");
    assert.equal(result.headers["x-auth-desk"], "tenant");
    assert.equal(result.headers["authorization"], "Bearer secret-session-bearer-token");
  });

  it("handles request cancellation via AbortSignal", async () => {
    const verifier = new HostVerifier({ allowLoopback: true });
    const sessionManager = new NativeSessionManager({
      apiOrigin: serverOrigin,
      hostVerifier: verifier
    });
    const transport = new NativeHttpTransport({ hostVerifier: verifier, sessionManager });

    const controller = new AbortController();
    const requestPromise = transport.get("/api/slow", { signal: controller.signal });

    // Cancel while request is in-flight
    setTimeout(() => controller.abort(), 20);

    await assert.rejects(
      async () => {
        await requestPromise;
      },
      (err: unknown) => {
        assert.ok(err instanceof Error);
        return true;
      }
    );
  });

  it("handles request timeout when exceeding timeoutMs", async () => {
    const verifier = new HostVerifier({ allowLoopback: true });
    const sessionManager = new NativeSessionManager({
      apiOrigin: serverOrigin,
      hostVerifier: verifier
    });
    const transport = new NativeHttpTransport({ hostVerifier: verifier, sessionManager });

    await assert.rejects(
      async () => {
        // slow endpoint takes 200ms; timeout is 40ms
        await transport.get("/api/slow", { timeoutMs: 40 });
      },
      (err: unknown) => {
        assert.ok(err instanceof Error);
        return true;
      }
    );
  });

  it("handles error envelopes and server session expiration", async () => {
    const verifier = new HostVerifier({ allowLoopback: true });
    const sessionManager = new NativeSessionManager({
      apiOrigin: serverOrigin,
      hostVerifier: verifier
    });
    const transport = new NativeHttpTransport({ hostVerifier: verifier, sessionManager });

    // 404 envelope
    await assert.rejects(
      async () => {
        await transport.get("/api/error");
      },
      (err: unknown) => {
        assert.ok(err instanceof PlatformApiError);
        assert.equal(err.statusCode, 404);
        assert.equal(err.code, "NOT_FOUND");
        assert.equal(err.message, "Record was not found.");
        return true;
      }
    );

    // 401 session expiration
    await assert.rejects(
      async () => {
        await transport.get("/api/session-expired");
      },
      (err: unknown) => {
        assert.ok(err instanceof PlatformApiError);
        assert.equal(err.statusCode, 401);
        assert.equal(err.code, "AUTH_SESSION_EXPIRED");
        return true;
      }
    );
    assert.equal(sessionManager.status, "expired");
  });

  it("supports multipart upload with context headers", async () => {
    const verifier = new HostVerifier({ allowLoopback: true });
    const sessionManager = new NativeSessionManager({
      apiOrigin: serverOrigin,
      hostVerifier: verifier
    });
    const transport = new NativeHttpTransport({ hostVerifier: verifier, sessionManager });

    const formData = new FormData();
    formData.append("title", "Quotation Attached");
    formData.append("file", new Blob(["sample invoice content"], { type: "text/plain" }), "invoice.txt");

    const result = await transport.uploadMultipart<{ contentType: string; size: number }>("/api/upload", formData);

    assert.ok(result.contentType.includes("multipart/form-data"));
    assert.ok(result.size > 0);
  });

  it("supports authenticated binary download and media blob loading", async () => {
    const verifier = new HostVerifier({ allowLoopback: true });
    const sessionManager = new NativeSessionManager({
      apiOrigin: serverOrigin,
      hostVerifier: verifier
    });
    const transport = new NativeHttpTransport({ hostVerifier: verifier, sessionManager });

    // Binary download
    const arrayBuffer = await transport.downloadBinary("/api/document.pdf");
    const text = Buffer.from(arrayBuffer).toString("utf8");
    assert.ok(text.startsWith("%PDF-1.5"));

    // Media blob
    const mediaBlob = await transport.loadMediaBlob("/api/media.png");
    assert.equal(mediaBlob.type, "image/png");
    assert.equal(mediaBlob.size, 8);
  });

  it("delegates authenticated requests to native dispatcher without exposing session token across bridge", async () => {
    const verifier = new HostVerifier({ allowLoopback: true });
    const sessionManager = new NativeSessionManager({
      apiOrigin: serverOrigin,
      hostVerifier: verifier
    });

    // Native session with isolated token
    const mockSession = {
      activeCompanyId: 42,
      activeFinancialYearId: 2026,
      apiOrigin: serverOrigin,
      authenticated: true,
      desk: "tenant" as const,
      email: "engineer@company.com",
      expiresAt: new Date(Date.now() + 3600_000).toISOString(),
      loginHost: `127.0.0.1:${serverPort}`,
      sessionGeneration: 1,
      sessionSlot: "11223344556677889900aabbccddeeff",
      tenantCode: "TENANT_X",
      tenantDbName: "tenant_x_db",
      tenantId: "tenant-x-uuid",
      token: "[native-isolated]",
      userType: "tenant"
    };

    await sessionManager["storage"].storeSession(mockSession);
    sessionManager["_activeSession"] = mockSession;
    sessionManager["_status"] = "authenticated";

    let interceptedRequestHeaders: Record<string, string> | undefined;

    // Simulate NativeHttpDispatcher simulating Android KeyStore-backed NativeSecureStoragePlugin
    const nativeHttpDispatcher: NativeHttpDispatcher = async (options) => {
      interceptedRequestHeaders = { ...(options.headers ?? {}) };

      // In native plugin, authorization header is injected directly in Java memory from KeyStore
      const nativeInjectedHeaders: Record<string, string> = {
        ...(options.headers ?? {}),
        authorization: "Bearer decrypted-keystore-token"
      };

      const init: RequestInit = {
        headers: nativeInjectedHeaders,
        method: options.method ?? "GET"
      };
      if (typeof options.body === "string") {
        init.body = options.body;
      }

      const res = await fetch(options.url, init);

      const bodyText = await res.text();
      return {
        data: bodyText,
        headers: Object.fromEntries(res.headers.entries()),
        status: res.status
      };
    };

    const transport = new NativeHttpTransport({
      hostVerifier: verifier,
      sessionManager,
      nativeHttpDispatcher
    });

    const result = await transport.post<{ body: { action: string }; headers: Record<string, string> }>("/api/echo", {
      action: "fetch-records"
    });

    // Verify JS transport did NOT send Authorization header across bridge to native dispatcher
    assert.ok(interceptedRequestHeaders);
    assert.strictEqual(interceptedRequestHeaders["authorization"], undefined);
    assert.strictEqual(interceptedRequestHeaders["Authorization"], undefined);

    // Context headers still passed
    assert.equal(interceptedRequestHeaders["x-codexsun-session-slot"], "11223344556677889900aabbccddeeff");

    // Verify native server received the native-injected authorization header and unwrapped response correctly
    assert.equal(result.headers["authorization"], "Bearer decrypted-keystore-token");
    assert.equal(result.body.action, "fetch-records");
  });
});
