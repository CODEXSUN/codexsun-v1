import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig, loadEnv } from "vite";
import { fileURLToPath } from "node:url";
import { codeitApiPlugin } from "./api/codeit-api.plugin.js";

const root = fileURLToPath(new URL("../..", import.meta.url));

export default defineConfig(({ mode }) => {
  const port = Number(
    process.env.CODEXSUN_CODEIT_WEB_PORT ?? loadEnv(mode, root, "").CODEXSUN_CODEIT_WEB_PORT ?? 7070
  );
  if (!Number.isInteger(port) || port < 1 || port > 65535)
    throw new Error("Invalid CODEXSUN_CODEIT_WEB_PORT");
  return {
    plugins: [tailwindcss(), react(), codeitApiPlugin(root, port)],
    build: { outDir: "../../dist/devkits/codeit/web", emptyOutDir: true },
    cacheDir: "../../dist/.cache/vite/codeit",
    server: { host: "127.0.0.1", port, strictPort: true },
    preview: { host: "127.0.0.1", port, strictPort: true }
  };
});
