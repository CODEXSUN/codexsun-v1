import Fastify from "fastify";
import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { isAppError } from "../../../../packages/framework/src/errors/app-error.js";
import { fail } from "../../../../packages/framework/src/http/envelope.js";
import { LocalCodexGateway } from "./codex/index.js";
import { promptManagerModule, type CodexGateway } from "./modules/prompt-manager/index.js";
import "../../../../packages/framework/src/api/tenant-context.js";

export async function createCodeitApi(options: {
  databasePath: string;
  port: number;
  codex?: CodexGateway;
}) {
  if (options.databasePath !== ":memory:")
    mkdirSync(dirname(options.databasePath), { recursive: true });
  const db = new DatabaseSync(options.databasePath);
  const codex = options.codex ?? new LocalCodexGateway();
  const app = Fastify({ bodyLimit: 150_000, logger: false });
  const hosts = new Set([`127.0.0.1:${options.port}`, `localhost:${options.port}`]);
  app.addHook("onRequest", async (request, reply) => {
    const host = request.headers.host;
    const origin = request.headers.origin;
    const allowed = Boolean(host && hosts.has(host)) && (!origin || origin === `http://${host}`);
    if (!allowed || (request.method !== "GET" && request.headers["x-codeit-request"] !== "1"))
      return reply
        .code(403)
        .send({
          success: false,
          error: { message: "Only the local CodeIt workspace can access this API" }
        });
    reply.header("Cache-Control", "no-store");
  });
  app.setErrorHandler((error, request, reply) => {
    const known = isAppError(error);
    reply.code(known ? error.statusCode : 500).send(
      fail(
        {
          code: known ? error.code : "CODEIT_ERROR",
          message: error instanceof Error ? error.message : "CodeIt could not complete this request"
        },
        { requestId: request.id }
      )
    );
  });
  app.addHook("onClose", async () => {
    codex.close();
    db.close();
  });
  await promptManagerModule.register({ app, db, codex });
  await app.ready();
  return app;
}
