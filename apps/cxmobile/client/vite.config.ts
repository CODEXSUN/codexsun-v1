import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

const root = fileURLToPath(new URL("../../..", import.meta.url));
const rootPackage = JSON.parse(
  readFileSync(resolve(root, "package.json"), "utf8")
) as { version: string };

export default defineConfig({
  plugins: [tailwindcss(), react()],
  define: {
    __APP_VERSION__: JSON.stringify(rootPackage.version)
  },
  cacheDir: resolve(root, "dist/.cache/vite/cxmobile-client"),
  build: {
    outDir: resolve(root, "dist/apps/cxmobile/client"),
    emptyOutDir: true
  },
  server: {
    host: "127.0.0.1",
    port: 18090,
    strictPort: true,
    proxy: {
      "/api/app": {
        target: "http://127.0.0.1:18010",
        changeOrigin: false,
        secure: false
      }
    }
  },
  preview: {
    host: "127.0.0.1",
    port: 18190,
    strictPort: true,
    proxy: {
      "/api/app": {
        target: "http://127.0.0.1:18010",
        changeOrigin: false,
        secure: false
      }
    }
  }
});
