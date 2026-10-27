import type { Plugin, ViteDevServer, PreviewServer } from "vite";
import { resolve } from "node:path";
import { createCodeitApi } from "./src/app.js";

export function codeitApiPlugin(root: string, port: number): Plugin {
  async function configure(server: ViteDevServer | PreviewServer) {
    const api = await createCodeitApi({
      databasePath: resolve(root, "storage/codeit/prompt-manager.sqlite"),
      port
    });
    server.middlewares.use((request, response, next) => {
      if (!request.url?.startsWith("/api/codeit/")) return next();
      api.routing(request, response);
    });
    server.httpServer?.once("close", () => void api.close());
  }
  return {
    name: "codexsun-codeit-api",
    configureServer: configure,
    configurePreviewServer: configure
  };
}
