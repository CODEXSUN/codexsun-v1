import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { randomBytes } from "node:crypto";
import { extname, join, resolve } from "node:path";
import { createReadStream, existsSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import {
  type ApiResponseEnvelope,
  CodeitError,
  NotFoundError,
  UnauthorizedError,
  ValidationError
} from "./errors.js";
import { PairingManager } from "./host/pairing.js";
import { SecurityMiddleware } from "./host/security.js";
import { ArtifactModule } from "./modules/artifact/artifact.module.js";
import { ConversationModule } from "./modules/conversation/conversation.module.js";
import { ProjectModule } from "./modules/project/project.module.js";
import { ProviderModule } from "./modules/provider/provider.module.js";
import { RunModule } from "./modules/run/run.module.js";
import { CodingLoopService } from "./modules/run/coding-loop.service.js";
import { ToolModule } from "./modules/tool/tool.module.js";
import { WorkspaceModule } from "./modules/workspace/workspace.module.js";
import { OrchestrationModule } from "./modules/orchestration/orchestration.module.js";
import { PersonalizationModule } from "./modules/personalization/personalization.module.js";
import { PluginModule } from "./modules/plugin/plugin.module.js";
import type { RouteDefinition } from "./modules/project/project.routes.js";
import { CodeitDatabase } from "./storage/db.js";
import { runMigrations } from "./storage/migrations.js";

export interface CodeitServerOptions {
  port?: number | undefined;
  webPort?: number | undefined;
  storageRoot?: string | undefined;
  inMemoryDb?: boolean | undefined;
  dbPath?: string | undefined;
  pairingTokenPath?: string | undefined;
  pairingToken?: string | undefined;
  sessionTtlMs?: number | undefined;
}

export interface CodeitServerInstance {
  server: Server;
  url: string;
  port: number;
  db: CodeitDatabase;
  pairingManager: PairingManager;
  projectModule: ProjectModule;
  artifactModule: ArtifactModule;
  providerModule: ProviderModule;
  toolModule: ToolModule;
  workspaceModule: WorkspaceModule;
  conversationModule: ConversationModule;
  runModule: RunModule;
  loopService: CodingLoopService;
  orchestrationModule: OrchestrationModule;
  personalizationModule: PersonalizationModule;
  pluginModule: PluginModule;
  close: () => Promise<void>;
}

function matchRoute(
  method: string,
  pathname: string,
  routes: RouteDefinition[]
): { route: RouteDefinition; params: Record<string, string> } | null {
  const reqParts = pathname.split("/").filter(Boolean);

  for (const route of routes) {
    if (route.method.toUpperCase() !== method.toUpperCase()) continue;

    const routeParts = route.path.split("/").filter(Boolean);
    if (routeParts.length !== reqParts.length) continue;

    const params: Record<string, string> = {};
    let matched = true;

    for (let i = 0; i < routeParts.length; i++) {
      const rPart = routeParts[i]!;
      const qPart = reqParts[i]!;

      if (rPart.startsWith(":")) {
        params[rPart.slice(1)] = decodeURIComponent(qPart);
      } else if (rPart !== qPart) {
        matched = false;
        break;
      }
    }

    if (matched) {
      return { route, params };
    }
  }

  return null;
}

async function readRequestBody(req: IncomingMessage): Promise<unknown> {
  const method = req.method ?? "GET";
  if (!["POST", "PUT", "PATCH"].includes(method)) {
    return null;
  }

  return new Promise((resolvePromise, rejectPromise) => {
    const chunks: Buffer[] = [];
    let totalBytes = 0;
    const maxBytes = 10 * 1024 * 1024; // 10MB limit

    req.on("data", (chunk: Buffer) => {
      totalBytes += chunk.length;
      if (totalBytes > maxBytes) {
        rejectPromise(
          new CodeitError("CODEIT_BUDGET_EXCEEDED", "Request payload exceeds 10MB limit", 413)
        );
        return;
      }
      chunks.push(chunk);
    });

    req.on("end", () => {
      if (chunks.length === 0) {
        resolvePromise(null);
        return;
      }

      const rawBuffer = Buffer.concat(chunks);
      const contentType = req.headers["content-type"] || "";

      if (contentType.includes("application/json")) {
        try {
          const parsed = JSON.parse(rawBuffer.toString("utf8"));
          resolvePromise(parsed);
        } catch {
          rejectPromise(new ValidationError("Malformed JSON payload"));
        }
      } else {
        resolvePromise(rawBuffer);
      }
    });

    req.on("error", (err) => {
      rejectPromise(err);
    });
  });
}

export function createCodeitServer(options: CodeitServerOptions = {}): {
  server: Server;
  port: number;
  db: CodeitDatabase;
  pairingManager: PairingManager;
  projectModule: ProjectModule;
  artifactModule: ArtifactModule;
  providerModule: ProviderModule;
  toolModule: ToolModule;
  workspaceModule: WorkspaceModule;
  conversationModule: ConversationModule;
  runModule: RunModule;
  loopService: CodingLoopService;
  orchestrationModule: OrchestrationModule;
  personalizationModule: PersonalizationModule;
  pluginModule: PluginModule;
  security: SecurityMiddleware;
} {
  const port = options.port ?? (Number(process.env.CODEXSUN_CODEIT_API_PORT) || 7071);
  const webPort = options.webPort ?? (Number(process.env.CODEXSUN_CODEIT_WEB_PORT) || 7070);

  const storageRoot =
    options.storageRoot ??
    process.env.CODEIT_STORAGE_ROOT ??
    process.env.CODEXSUN_CODEIT_STORAGE_ROOT ??
    (options.inMemoryDb
      ? join(tmpdir(), `codeit-mem-${Date.now()}`, "storage")
      : resolve(process.cwd(), ".codeit", "storage"));

  // 1. Initialize Storage & Migrations
  const db = new CodeitDatabase({
    inMemory: options.inMemoryDb,
    dbPath: options.inMemoryDb
      ? ":memory:"
      : (options.dbPath ?? (process.env.CODEIT_DB_PATH || join(storageRoot, "codeit.db")))
  });
  runMigrations(db.db);

  // 2. Initialize Pairing & Security
  const tokenPath =
    options.pairingTokenPath ??
    process.env.CODEIT_PAIRING_TOKEN_PATH ??
    (options.inMemoryDb ? undefined : join(storageRoot, "pairing.token"));

  const pairingManager = new PairingManager({
    staticToken: options.pairingToken,
    tokenPath,
    sessionTtlMs: options.sessionTtlMs,
    inMemory: options.inMemoryDb
  });

  const security = new SecurityMiddleware({
    apiPort: port,
    webPort,
    pairingManager
  });

  // 3. Initialize Modules
  const projectModule = new ProjectModule(db.db);
  const artifactModule = new ArtifactModule(db.db, join(storageRoot, "artifacts"));
  const providerModule = new ProviderModule();
  const toolModule = new ToolModule(db.db);
  const workspaceModule = new WorkspaceModule(db.db);
  const conversationModule = new ConversationModule(db.db);
  const initialRunModule = new RunModule(db.db, providerModule.service);
  const loopService = new CodingLoopService(
    initialRunModule.service,
    workspaceModule.patcher,
    workspaceModule.runner,
    db.db
  );
  const runModule = new RunModule(db.db, providerModule.service, loopService);
  const orchestrationModule = new OrchestrationModule(db.db);
  const personalizationModule = new PersonalizationModule(db.db);
  const pluginModule = new PluginModule(db.db);

  // 4. Register Routes
  const routes: RouteDefinition[] = [
    // Pairing Route
    {
      method: "POST",
      path: "/api/codeit/pairing",
      handler: (_req, res, ctx) => {
        const body = (ctx.body ?? {}) as { pairing_token?: string };
        const candidate = body.pairing_token;
        if (!candidate || !pairingManager.verifyPairingToken(candidate)) {
          throw new UnauthorizedError("Invalid pairing token");
        }

        const session = pairingManager.createSession();
        res.setHeader("Set-Cookie", [
          `codexsun_codeit_session=${session.session_token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=86400`,
          `codexsun_codeit_csrf=${session.csrf_token}; SameSite=Strict; Path=/; Max-Age=86400`
        ]);

        return {
          session_slot: session.session_slot,
          csrf_token: session.csrf_token
        };
      }
    },
    // Health Check
    {
      method: "GET",
      path: "/api/codeit/health",
      handler: () => {
        const addr = server.address();
        const activePort = typeof addr === "object" && addr ? addr.port : port;
        return { status: "ok", service: "codeit-api", port: activePort };
      }
    },
    {
      method: "GET",
      path: "/health",
      handler: () => {
        const addr = server.address();
        const activePort = typeof addr === "object" && addr ? addr.port : port;
        return { status: "ok", service: "codeit-api", port: activePort };
      }
    },
    // Project Module Routes
    ...projectModule.routes,
    // Artifact Module Routes
    ...artifactModule.routes,
    // Provider Module Routes
    ...providerModule.routes,
    // Tool Module Routes
    ...toolModule.routes,
    // Workspace Module Routes
    ...workspaceModule.routes,
    // Conversation Module Routes
    ...conversationModule.routes,
    // Run Module Routes
    ...runModule.routes,
    // Orchestration Module Routes
    ...orchestrationModule.routes,
    // Personalization Module Routes
    ...personalizationModule.routes,
    // Plugin Module Routes
    ...pluginModule.routes
  ];

  // 5. Create HTTP Server
  const mimeTypes: Record<string, string> = {
    ".html": "text/html; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".woff2": "font/woff2",
    ".woff": "font/woff",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".ico": "image/x-icon"
  };

  function tryServeStatic(req: IncomingMessage, res: ServerResponse, pathname: string): boolean {
    if (req.method !== "GET" && req.method !== "HEAD") return false;
    if (pathname.startsWith("/api/")) return false;

    const possibleRoots = [
      resolve(fileURLToPath(import.meta.url), "../../web"),
      resolve(fileURLToPath(import.meta.url), "../../../web"),
      resolve(process.cwd(), "dist/devkits/codeit/web")
    ];

    let webRoot: string | null = null;
    for (const r of possibleRoots) {
      if (existsSync(join(r, "index.html"))) {
        webRoot = r;
        break;
      }
    }

    if (!webRoot) return false;

    let targetFile = join(webRoot, pathname === "/" ? "index.html" : pathname);
    const normalized = resolve(targetFile);
    if (!normalized.startsWith(resolve(webRoot))) {
      return false;
    }

    if (!existsSync(normalized) || statSync(normalized).isDirectory()) {
      targetFile = join(webRoot, "index.html");
    }

    if (!existsSync(targetFile)) return false;

    const ext = extname(targetFile).toLowerCase();
    const contentType = mimeTypes[ext] || "application/octet-stream";

    res.statusCode = 200;
    res.setHeader("Content-Type", contentType);
    if (targetFile.includes("assets")) {
      res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    }
    createReadStream(targetFile).pipe(res);
    return true;
  }

  const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    const correlation_id = `c0de17-${randomBytes(6).toString("hex")}`;
    res.setHeader("X-Correlation-Id", correlation_id);

    try {
      // Run security middleware
      const secContext = security.handle(req, res);
      // If preflight OPTIONS, request is already ended
      if (res.writableEnded || (!secContext && req.method === "OPTIONS")) {
        return;
      }

      const parsedUrl = new URL(req.url ?? "/", `http://127.0.0.1:${port}`);
      const pathname = parsedUrl.pathname;

      const matched = matchRoute(req.method ?? "GET", pathname, routes);
      if (!matched) {
        if (tryServeStatic(req, res, pathname)) {
          return;
        }
        throw new NotFoundError(`Endpoint not found: ${req.method} ${pathname}`);
      }

      const body = await readRequestBody(req);

      const result = await matched.route.handler(req, res, {
        params: matched.params,
        query: parsedUrl.searchParams,
        body,
        correlationId: correlation_id
      });

      // If handler responded directly (e.g. binary artifact download), return
      if (res.writableEnded) {
        return;
      }

      // Default JSON response envelope
      res.statusCode = res.statusCode && res.statusCode !== 200 ? res.statusCode : 200;
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      const envelope: ApiResponseEnvelope = {
        success: true,
        data: result ?? null,
        error: null,
        correlation_id
      };
      res.end(JSON.stringify(envelope));
    } catch (err: unknown) {
      if (!res.writableEnded) {
        let statusCode = 500;
        let errorPayload: ApiResponseEnvelope["error"] = {
          code: "CODEIT_INTERNAL_ERROR",
          message: err instanceof Error ? err.message : "Internal server error",
          retryable: false,
          details: {}
        };

        if (err instanceof CodeitError) {
          statusCode = err.statusCode;
          errorPayload = err.toPayload();
        }

        res.statusCode = statusCode;
        res.setHeader("Content-Type", "application/json; charset=utf-8");
        const envelope: ApiResponseEnvelope = {
          success: false,
          data: null,
          error: errorPayload,
          correlation_id
        };
        res.end(JSON.stringify(envelope));
      }
    }
  });

  return {
    server,
    port,
    db,
    pairingManager,
    projectModule,
    artifactModule,
    providerModule,
    toolModule,
    workspaceModule,
    conversationModule,
    runModule,
    loopService,
    orchestrationModule,
    personalizationModule,
    pluginModule,
    security
  };
}

export function startCodeitApi(options: CodeitServerOptions = {}): Promise<CodeitServerInstance> {
  const {
    server,
    port,
    db,
    pairingManager,
    projectModule,
    artifactModule,
    providerModule,
    toolModule,
    workspaceModule,
    conversationModule,
    runModule,
    loopService,
    orchestrationModule,
    personalizationModule,
    pluginModule,
    security
  } = createCodeitServer(options);

  return new Promise((resolvePromise, rejectPromise) => {
    let started = false;

    server.once("error", (err: NodeJS.ErrnoException) => {
      if (!started) {
        if (err.code === "EADDRINUSE") {
          rejectPromise(new Error(`Codeit API port ${port} is already in use or unavailable`));
        } else {
          rejectPromise(err);
        }
      }
    });

    server.listen(port, "127.0.0.1", () => {
      started = true;
      const addr = server.address();
      const actualPort = typeof addr === "object" && addr ? addr.port : port;
      security.setApiPort(actualPort);
      const url = `http://127.0.0.1:${actualPort}`;
      resolvePromise({
        server,
        url,
        port: actualPort,
        db,
        pairingManager,
        projectModule,
        artifactModule,
        providerModule,
        toolModule,
        workspaceModule,
        conversationModule,
        runModule,
        loopService,
        orchestrationModule,
        personalizationModule,
        pluginModule,
        close: async () => {
          pluginModule.broker.terminateAll();
          return new Promise((resClose, rejClose) => {
            server.close((err) => {
              db.close();
              if (err) rejClose(err);
              else resClose();
            });
          });
        }
      });
    });
  });
}

if (process.argv[1]) {
  try {
    const isDirectRun = resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));
    if (isDirectRun) {
      const port = Number(process.env.CODEXSUN_CODEIT_API_PORT ?? 7071);
      const webPort = Number(process.env.CODEXSUN_CODEIT_WEB_PORT ?? 7070);
      const storageRoot = process.env.CODEIT_STORAGE_ROOT;
      const dbPath = process.env.CODEIT_DB_PATH;
      const pairingTokenPath = process.env.CODEIT_PAIRING_TOKEN_PATH;

      startCodeitApi({ port, webPort, storageRoot, dbPath, pairingTokenPath })
        .then((instance) => {
          console.log(`Codeit API ready: ${instance.url} (port ${instance.port})`);

          const shutdown = async (signal: string) => {
            console.log(`[shutdown] ${signal} received; closing Codeit API...`);
            try {
              await instance.close();
              process.exit(0);
            } catch (err) {
              console.error("Error during shutdown:", err);
              process.exit(1);
            }
          };

          process.on("SIGINT", () => shutdown("SIGINT"));
          process.on("SIGTERM", () => shutdown("SIGTERM"));
        })
        .catch((err) => {
          console.error("Failed to start Codeit API:", err);
          process.exit(1);
        });
    }
  } catch {
    // Ignore URL resolution errors during bundlers or custom loaders
  }
}
