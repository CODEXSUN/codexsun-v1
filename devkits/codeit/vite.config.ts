import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig, loadEnv } from "vite";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../..", import.meta.url));

export default defineConfig(({ mode }) => {
  const port = Number(
    process.env.CODEXSUN_CODEIT_WEB_PORT ?? loadEnv(mode, root, "").CODEXSUN_CODEIT_WEB_PORT ?? 7070
  );
  if (!Number.isInteger(port) || port < 1 || port > 65535)
    throw new Error("Invalid CODEXSUN_CODEIT_WEB_PORT");
  const apiPort = Number(
    process.env.CODEXSUN_CODEIT_API_PORT ?? loadEnv(mode, root, "").CODEXSUN_CODEIT_API_PORT ?? 7071
  );
  return {
    build: { emptyOutDir: true, outDir: "../../dist/devkits/codeit/web" },
    cacheDir: "../../dist/.cache/vite/codeit",
    plugins: [tailwindcss(), react()],
    server: {
      host: "127.0.0.1",
      port,
      strictPort: true,
      proxy: {
        "/api/codeit": {
          target: `http://127.0.0.1:${apiPort}`,
          changeOrigin: true
        }
      }
    },
    preview: { host: "127.0.0.1", port, strictPort: true }
  };
});
