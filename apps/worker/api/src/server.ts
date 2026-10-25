import { timingSafeEqual } from "node:crypto";
import Fastify from "fastify";
import { startWorkerRuntime } from "./runtime.js";

const redisUrl = process.env.CODEXSUN_REDIS_URL;
const token = process.env.CODEXSUN_WORKER_CONTROL_TOKEN;
if (!redisUrl || !token || token.length < 32)
  throw new Error("Worker requires Redis and a control token of at least 32 characters.");
const app = Fastify({ logger: { redact: ["req.headers.authorization"] } });
const runtime = startWorkerRuntime({
  redisUrl,
  ...(process.env.CODEXSUN_WORKER_QUEUE_PREFIX
    ? { prefix: process.env.CODEXSUN_WORKER_QUEUE_PREFIX }
    : {}),
  onError: (error) => app.log.warn({ message: error.message }, "Worker Redis connection error")
});
app.get("/health", async () => ({ status: "ok", service: "codexsun-worker" }));
app.get("/ready", async (_request, reply) =>
  reply
    .code(runtime.isReady() ? 200 : 503)
    .send({ status: runtime.isReady() ? "ok" : "unavailable" })
);
app.post<{ Body: { value?: string } }>(
  "/worker/probe",
  {
    schema: {
      body: {
        type: "object",
        additionalProperties: false,
        properties: { value: { type: "string", maxLength: 128 } }
      }
    },
    preHandler: async (request, reply) => {
      const received = Buffer.from(request.headers.authorization ?? "");
      const expected = Buffer.from(`Bearer ${token}`);
      if (received.length !== expected.length || !timingSafeEqual(received, expected)) {
        return reply.code(401).send({ error: "Worker control token required." });
      }
      if (!runtime.isReady())
        return reply.code(503).send({ error: "Worker Redis is unavailable." });
    }
  },
  async (request) => runtime.probe(request.body?.value)
);
app.addHook("onClose", async () => runtime.close());
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => {
    void app.close();
  });
}
void runtime
  .ready()
  .catch((error) => app.log.error({ message: String(error) }, "Worker startup failed"));
await app.listen({ host: "0.0.0.0", port: Number(process.env.CODEXSUN_WORKER_PORT ?? "17040") });
