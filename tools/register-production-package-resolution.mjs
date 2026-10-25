import { existsSync } from "node:fs";
import { registerHooks } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const apiPackages = new Map([
  ["@codexsun/qcafe-api", "qcafe"],
  ["@codexsun/codexsun-api", "codexsun"],
  ["@codexsun/hrms-api", "hrms"],
  ["@codexsun/docs-api", "docs"],
  ["@codexsun/himsx-api", "himsx"],
  ["@codexsun/sites-api", "sites"],
  ["@codexsun/sportsclub-api", "sportsclub"],
  ["@codexsun/tconnect-api", "tconnect"],

  ["@codexsun/accounts-api", "accounts"],
  ["@codexsun/auditor-api", "auditor"],
  ["@codexsun/billing-api", "billing"],
  ["@codexsun/core-api", "core"],
  ["@codexsun/crm-api", "crm"],
  ["@codexsun/frappe-api", "frappe"],
  ["@codexsun/logicx-erp-api", "logicx-erp"],
  ["@codexsun/ecommerce-api", "ecommerce"],
  ["@codexsun/notes-api", "notes"],
  ["@codexsun/chat-api", "chat"],
  ["@codexsun/zetro-api", "zetro"],
  ["@codexsun/zuno-api", "zuno"],
  ["@codexsun/mail-api", "mail"],
  ["@codexsun/marketing-api", "marketing"]
]);
const productionApiAliases = new Map([
  ["@codexsun/data-bridge-api", resolve(root, "dist", "devkits", "data-bridge", "api", "index.js")],
  [
    "@codexsun/data-migration-api",
    resolve(root, "dist", "devkits", "data-migration", "api", "index.js")
  ],
  [
    "@codexsun/sportsclub-api/migration",
    resolve(root, "dist", "apps", "sportsclub", "api", "sportsclub.migration.js")
  ],
  [
    "@codexsun/sportsclub-api/seed",
    resolve(root, "dist", "apps", "sportsclub", "api", "sportsclub.seed.js")
  ]
]);

registerHooks({
  resolve(specifier, context, nextResolve) {
    const target = productionApiTarget(specifier);
    if (target) return { shortCircuit: true, url: pathToFileURL(target).href };
    return nextResolve(specifier, context);
  }
});

function productionApiTarget(specifier) {
  const alias = productionApiAliases.get(specifier);
  if (alias) {
    if (!existsSync(alias)) {
      throw new Error(`Production build output is missing for ${specifier}. Run npm run build.`);
    }
    return alias;
  }

  if (specifier.startsWith("@codexsun/qcafe-api/src/")) {
    const source = resolve(
      root,
      "apps",
      "qcafe",
      "api",
      specifier.slice("@codexsun/qcafe-api/".length)
    );
    if (!existsSync(source)) {
      throw new Error(`Production source is missing for ${specifier}.`);
    }
    return source;
  }

  for (const [packageName, app] of apiPackages) {
    if (specifier !== packageName && !specifier.startsWith(`${packageName}/`)) continue;
    const subpath = specifier.slice(packageName.length + 1);
    const base = resolve(root, "dist", "apps", app, "api");
    const candidates = subpath
      ? [resolve(base, `${subpath}.js`), resolve(base, subpath, "index.js")]
      : [resolve(base, "index.js")];
    const target = candidates.find((candidate) => existsSync(candidate));
    if (!target) {
      throw new Error(`Production build output is missing for ${specifier}. Run npm run build.`);
    }
    return target;
  }
  return null;
}
