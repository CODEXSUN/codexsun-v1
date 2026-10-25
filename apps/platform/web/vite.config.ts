import { createWorkspaceDocument } from "./public-document.ts";
import mdx from "@mdx-js/rollup";
import remarkGfm from "remark-gfm";
import rehypeSlug from "rehype-slug";
import rehypeAutolink from "rehype-autolink-headings";
import rehypeHighlight from "rehype-highlight";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig, loadEnv } from "vite";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import {
  platformWebAllowedHosts,
  requireEnvNumber,
  requireEnvValue,
  resolvePlatformRuntime
} from "@codexsun/framework/env";

const configDir = fileURLToPath(new URL(".", import.meta.url));
const rootPackage = JSON.parse(
  readFileSync(resolve(configDir, "../../../package.json"), "utf8")
) as { version: string };
const sharedUiPackage = JSON.parse(
  readFileSync(resolve(configDir, "../../../packages/ui/package.json"), "utf8")
) as { dependencies: Record<string, string> };
const sharedUiDependencies = Object.keys(sharedUiPackage.dependencies).filter(
  (name) => !name.startsWith("@fontsource") && name !== "tailwindcss"
);

export default defineConfig(({ command, mode }) => {
  const runtimeEnv = loadEnv(mode, resolve(configDir, "../../.."), "");

  return {
    build: {
      chunkSizeWarningLimit: 450,
      emptyOutDir: true,
      outDir: "../../../dist/apps/platform/web"
    },
    cacheDir: "../../../dist/.cache/vite/platform-web",
    envDir: "../../..",
    define: {
      __CODEXSUN_CODEIT_WEB_PORT__: JSON.stringify(
        Number(runtimeEnv.CODEXSUN_CODEIT_WEB_PORT ?? 7070)
      ),
      __CODEXSUN_CODEIT_WEB_URL__: JSON.stringify(runtimeEnv.CODEXSUN_CODEIT_WEB_URL ?? ""),
      __CODEXSUN_TCONNECT_WEB_PORT__: JSON.stringify(
        Number(runtimeEnv.CODEXSUN_TCONNECT_WEB_PORT ?? 7040)
      ),
      __APP_VERSION__: JSON.stringify(rootPackage.version),
      __CODEXSUN_ECOMMERCE_WEB_PORT__: JSON.stringify(
        Number(runtimeEnv.CODEXSUN_ECOMMERCE_WEB_PORT)
      )
    },
    optimizeDeps: {
      exclude: [
        "@codexsun/ui",
        "@codexsun/marketing-web",
        "@codexsun/tconnect-web",
        "@codexsun/data-migration-web",
        "@codexsun/data-bridge-web",
        "@codexsun/sportsclub-web",
        "@codexsun/qcafe-web",
        "@codexsun/qcafe-web/web",
        "@codexsun/codexsun-web",
        "@codexsun/blog/web",
        "@codexsun/billing-web",
        "@codexsun/core-web",
        "@codexsun/crm-web",
        "@codexsun/frappe-web",
        "@codexsun/zetro-web",
        "@codexsun/docs-web",
        "@codexsun/hrms-web",
        "@codexsun/notes-web",
        "@codexsun/chat-web"
      ],
      include: [
        ...sharedUiDependencies,
        "@tanstack/react-table/legacy",
        "qrcode.react",
        "react",
        "react-dom",
        "react-dom/client",
        "react/jsx-runtime",
        "react/jsx-dev-runtime",
        "next-themes",
        "sonner",
        "socket.io-client",
        "react-markdown",
        "remark-gfm",
        "rehype-highlight",
        "rehype-slug",
        "rehype-autolink-headings",
        "lowlight",
        "style-to-js",
        "style-to-object",
        "@mdx-js/react",
        "react-is",
        "use-sync-external-store/shim",
        "use-sync-external-store/shim/index.js",
        "use-sync-external-store/shim/with-selector",
        "use-sync-external-store/shim/with-selector.js"
      ]
    },
    plugins: [
      {
        name: "codexsun-workspace-document",
        enforce: "post",
        generateBundle: {
          order: "post",
          handler(_output, bundle) {
            const entry = bundle["index.html"];
            if (!entry || entry.type !== "asset") throw new Error("Homepage HTML is missing.");
            const html =
              typeof entry.source === "string"
                ? entry.source
                : new TextDecoder().decode(entry.source);
            this.emitFile({
              type: "asset",
              fileName: "app.html",
              source: createWorkspaceDocument(html)
            });
          }
        }
      },
      {
        enforce: "pre",
        ...mdx({
          providerImportSource: "@mdx-js/react",
          remarkPlugins: [remarkGfm],
          rehypePlugins: [rehypeSlug, [rehypeAutolink, { behavior: "wrap" }], rehypeHighlight]
        })
      },
      tailwindcss(),
      react({ include: /\.(jsx|tsx|md|mdx)$/ })
    ],
    resolve: {
      dedupe: ["react", "react-dom", "@tanstack/react-query"],
      alias: {
        "@codexsun/marketing-web": resolve(configDir, "../../marketing/web/src"),
        "@codexsun/ui": resolve(configDir, "../../../packages/ui/src"),
        "@codexsun/core-web/modules/organisation/default-company/hooks": resolve(
          configDir,
          "../../core/web/src/modules/organisation/default-company/default-company.hooks.ts"
        ),
        "@codexsun/core-web/modules/organisation/default-company/services": resolve(
          configDir,
          "../../core/web/src/modules/organisation/default-company/default-company.services.ts"
        ),
        "@codexsun/core-web/modules/organisation/default-company/types": resolve(
          configDir,
          "../../core/web/src/modules/organisation/default-company/default-company.types.ts"
        ),
        "@codexsun/core-web/modules/organisation/default-company": resolve(
          configDir,
          "../../core/web/src/modules/organisation/default-company/index.ts"
        ),
        "@codexsun/ui/workspace/page": resolve(
          configDir,
          "../../../packages/ui/src/workspace/page.tsx"
        ),
        "@codexsun/ui/workspace/filters": resolve(
          configDir,
          "../../../packages/ui/src/workspace/filters.tsx"
        ),
        "@codexsun/ui/workspace/navigation": resolve(
          configDir,
          "../../../packages/ui/src/workspace/navigation.tsx"
        ),
        "@codexsun/ui/workspace/list-tools": resolve(
          configDir,
          "../../../packages/ui/src/workspace/list-tools.tsx"
        ),
        "@codexsun/ui/workspace/upsert": resolve(
          configDir,
          "../../../packages/ui/src/workspace/upsert.tsx"
        ),
        "@codexsun/qcafe-web/web": resolve(configDir, "../../qcafe/web/src/web/WebApp.tsx"),
        "@codexsun/ui/workspace/column-filter": resolve(
          configDir,
          "../../../packages/ui/src/workspace/column-filter.tsx"
        ),
        "@codexsun/hrms-web/modules/employee": resolve(
          configDir,
          "../../hrms/web/src/modules/employee/index.ts"
        ),
        "@codexsun/hrms-web/modules/attendance": resolve(
          configDir,
          "../../hrms/web/src/modules/attendance/index.ts"
        ),
        "@codexsun/ui/workspace/row-actions": resolve(
          configDir,
          "../../../packages/ui/src/workspace/row-actions.tsx"
        ),
        "@codexsun/tconnect-web": resolve(configDir, "../../tconnect/web/src/index.ts"),
        "@codexsun/data-migration-web": resolve(
          configDir,
          "../../../devkits/data-migration/web/src/index.ts"
        ),
        "@codexsun/data-bridge-web": resolve(
          configDir,
          "../../../devkits/data-bridge/src/index.ts"
        ),
        "@codexsun/sportsclub-web": resolve(configDir, "../../sportsclub/web/src/index.ts"),
        "@codexsun/codexsun-web": resolve(configDir, "../../codexsun/web/src/index.ts"),
        "@codexsun/docs-web/modules/overview/gateway": resolve(
          configDir,
          "../../docs/web/src/modules/overview/overview.services.ts"
        ),
        "@codexsun/docs-web/modules/overview": resolve(
          configDir,
          "../../docs/web/src/modules/overview/index.ts"
        ),
        "@codexsun/docs-web/modules/knowledge": resolve(
          configDir,
          "../../docs/web/src/modules/knowledge/index.ts"
        ),
        "@codexsun/docs-content": resolve(configDir, "../../docs/content"),
        "@codexsun/core-web/modules/master/contact/workspace": resolve(
          configDir,
          "../../core/web/src/modules/master/contact/contact.workspace.tsx"
        ),
        "@codexsun/crm-web/modules/enquiry/services": resolve(
          configDir,
          "../../crm/web/src/modules/enquiry/enquiry.services.ts"
        ),
        "@codexsun/crm-web/modules/enquiry/hooks": resolve(
          configDir,
          "../../crm/web/src/modules/enquiry/enquiry.hooks.ts"
        ),
        "@codexsun/crm-web/modules/call-log": resolve(
          configDir,
          "../../crm/web/src/modules/call-log/index.ts"
        ),
        "@codexsun/crm-web/modules/scheduler/services": resolve(
          configDir,
          "../../crm/web/src/modules/scheduler/scheduler.services.ts"
        ),
        "@codexsun/crm-web/modules/scheduler": resolve(
          configDir,
          "../../crm/web/src/modules/scheduler/index.ts"
        ),
        "@codexsun/ui/layouts/application-layout": resolve(
          configDir,
          "../../../packages/ui/src/layouts/application-layout.tsx"
        ),
        "@codexsun/ui/workspace/lookup": resolve(
          configDir,
          "../../../packages/ui/src/workspace/lookup.tsx"
        ),
        "@codexsun/billing-web/modules/reports": resolve(
          configDir,
          "../../billing/web/src/modules/reports/index.ts"
        ),
        "@codexsun/billing-web/modules/quotation": resolve(
          configDir,
          "../../billing/web/src/modules/quotation/index.ts"
        ),
        "@codexsun/billing-web/modules/sales": resolve(
          configDir,
          "../../billing/web/src/modules/sales/index.ts"
        ),
        "@codexsun/billing-web/modules/purchase": resolve(
          configDir,
          "../../billing/web/src/modules/purchase/index.ts"
        ),
        "@codexsun/billing-web/modules/export-sales": resolve(
          configDir,
          "../../billing/web/src/modules/export-sales/index.ts"
        ),
        "@codexsun/billing-web/modules/receipt": resolve(
          configDir,
          "../../billing/web/src/modules/receipt/index.ts"
        ),
        "@codexsun/billing-web/modules/payment": resolve(
          configDir,
          "../../billing/web/src/modules/payment/index.ts"
        ),
        "@codexsun/crm-web/modules/enquiry": resolve(
          configDir,
          "../../crm/web/src/modules/enquiry/index.ts"
        ),
        "@codexsun/crm-web/modules/data-source": resolve(
          configDir,
          "../../crm/web/src/modules/data-source/index.ts"
        ),
        "@codexsun/ecommerce-web/modules/pages": resolve(
          configDir,
          "../../ecommerce/web/src/modules/ecommerce-composition/ecommerce-composition.pages.tsx"
        ),
        "@codexsun/ecommerce-web/modules/overview/gateway": resolve(
          configDir,
          "../../ecommerce/web/src/modules/overview/overview.services.ts"
        ),
        "@codexsun/ecommerce-web/modules/overview": resolve(
          configDir,
          "../../ecommerce/web/src/modules/overview/index.ts"
        ),
        "@codexsun/crm-web/modules/reports": resolve(
          configDir,
          "../../crm/web/src/modules/reports/index.ts"
        ),
        "@codexsun/frappe-web/modules/export": resolve(
          configDir,
          "../../frappe/web/src/modules/export/index.ts"
        ),
        "@codexsun/frappe-web/modules/live-sync": resolve(
          configDir,
          "../../frappe/web/src/modules/live-sync/index.ts"
        ),
        "@codexsun/zetro-web/modules/provider": resolve(
          configDir,
          "../../zetro/web/src/modules/provider/index.ts"
        ),
        "@codexsun/zetro-web/modules/admin": resolve(
          configDir,
          "../../zetro/web/src/modules/admin/index.ts"
        ),
        "@codexsun/zetro-web/modules/chat": resolve(
          configDir,
          "../../zetro/web/src/modules/chat/index.ts"
        ),
        "@codexsun/core-web/modules/master/contact": resolve(
          configDir,
          "../../core/web/src/modules/master/contact/index.ts"
        ),
        "@codexsun/chat-web/modules/chat/navigation": resolve(
          configDir,
          "../../chat/web/src/modules/chat/chat.navigation.ts"
        ),
        "@codexsun/chat-web/modules/chat": resolve(
          configDir,
          "../../chat/web/src/modules/chat/index.ts"
        ),
        "@codexsun/chat-web": resolve(configDir, "../../chat/web/src/index.ts"),
        // Watch CRM source instead of its ignored node_modules junction.
        "@codexsun/crm-web": resolve(configDir, "../../crm/web/src")
      },
      preserveSymlinks: true
    },
    ...(command === "serve" ? { server: platformDevelopmentServer(runtimeEnv) } : {})
  };
});

function platformDevelopmentServer(runtimeEnv: Record<string, string | undefined>) {
  const platformRuntime = resolvePlatformRuntime({
    NODE_ENV: requireEnvValue(runtimeEnv.NODE_ENV, "NODE_ENV"),
    PLATFORM_API_PORT: requireEnvNumber(runtimeEnv.PLATFORM_API_PORT, "PLATFORM_API_PORT")
  });
  const proxy = {
    ws: true,
    changeOrigin: false,
    target: platformRuntime.apiUrl
  };

  return {
    allowedHosts: platformWebAllowedHosts(
      requireEnvValue(runtimeEnv.PLATFORM_WEB_ORIGIN, "PLATFORM_WEB_ORIGIN")
    ),
    headers: {
      "Permissions-Policy": "unload=*"
    },
    host: platformRuntime.webBindHost,
    port: requireEnvNumber(runtimeEnv.PLATFORM_WEB_PORT, "PLATFORM_WEB_PORT"),
    proxy: {
      "/qcafe": {
        changeOrigin: false,
        target: `http://127.0.0.1:${requireEnvNumber(runtimeEnv.CODEXSUN_QCAFE_WEB_PORT, "CODEXSUN_QCAFE_WEB_PORT")}`
      },
      "/api/app/codexsun/socket.io": {
        ...proxy,
        rewrite: (path: string) => path.replace(/^\/api\/app/u, "")
      },
      "/api/app": proxy,
      "/api/billing": {
        ...proxy,
        rewrite: (path: string) => path.replace(/^\/api\/billing/u, "") || "/"
      },
      "/api/core": {
        ...proxy,
        rewrite: (path: string) => path.replace(/^\/api\/core/u, "") || "/"
      },
      "/api/data-migration": proxy,
      "/api/data-bridge": proxy,
      "/api/zuno": {
        ...proxy,
        rewrite: (path: string) => `/zuno${path.replace(/^\/api\/zuno/u, "") || "/"}`
      },
      "/api/platform": {
        ...proxy,
        rewrite: (path: string) => path.replace(/^\/api\/platform/u, "") || "/"
      }
    }
  };
}
