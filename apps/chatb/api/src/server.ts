import { buildChatb } from "./app.js";

const upstreamUrl = process.env.CODEXSUN_CHATB_UPSTREAM_URL;
if (!upstreamUrl) throw new Error("CODEXSUN_CHATB_UPSTREAM_URL is required.");
const app = await buildChatb({ upstreamUrl });
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => {
    void app.close();
  });
}
await app.listen({ host: "0.0.0.0", port: Number(process.env.CODEXSUN_CHATB_PORT ?? "17031") });
