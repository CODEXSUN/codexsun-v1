import assert from "node:assert/strict";
import { closeSync, mkdirSync, openSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();
process.loadEnvFile(join(root, ".env"));
assert.equal(process.env.DB_HOST, "127.0.0.1", "Only the local CRM database is allowed.");
assert.equal(process.env.DB_MASTER_NAME, "codexsun_crm_dev_master");
assert.equal(process.env.CODEXSUN_FRAPPE_ENABLED, "0");
assert.equal(process.env.CODEXSUN_QUEUE_WORKER_ENABLED, "0");
const output = join(root, ".codex-runtime/crm/tenancy/full-suite");
mkdirSync(output, { recursive: true });
const fixtures = JSON.parse(
  readFileSync(join(root, ".codex-runtime/crm/tenancy/fixtures.json"), "utf8")
);
assert.equal(fixtures.length, 5, "Provision the five fresh isolation fixtures first.");
const target = fixtures[4];
assert.match(target.dbName, /^codexsun_crm_iso_20261026_[1-5]$/u);
const imports = ["--import", "./tools/register-root-package-resolution.mjs", "--import", "tsx"];
const unitRoots = [
  "apps/crm/api/src",
  "apps/crm/web/src",
  "apps/platform/api/src/auth",
  "apps/platform/api/src/modules/tenant",
  "apps/platform/api/src/modules/tenant-domain"
];
const units = unitRoots.flatMap(files).filter((path) => /\.(test|spec)\.(ts|tsx)$/u.test(path));
units.push(
  "apps/platform/api/src/tenancy-policy.test.ts",
  "apps/platform/api/src/modules/queue-manager/crm-enquiry-sync.enqueue.test.ts",
  "apps/platform/api/src/modules/queue-manager/crm-enquiry-sync.relay.test.ts"
);
const stages = [
  {
    name: "unit",
    args: [
      "--experimental-test-module-mocks",
      ...imports,
      "--test",
      "--test-concurrency=2",
      ...units
    ]
  }
];
for (const path of files("tools/e2e").filter(
  (path) =>
    /crm-.*\.e2e\.ts$/u.test(path) &&
    !path.endsWith("crm-duties-live.e2e.ts") &&
    !path.endsWith("crm-five-tenant-isolation.e2e.ts")
)) {
  stages.push({
    name: path.split(/[\\/]/u).at(-1).replace(".e2e.ts", ""),
    args: [...imports, "--test", path]
  });
}
stages.push(
  {
    name: "five-tenant-isolation",
    args: [...imports, "--test", "tools/e2e/crm-five-tenant-isolation.e2e.ts"]
  },
  { name: "mobile", args: ["tools/crm-mobile.mjs", "test", "--no-pub", "--concurrency=1"] }
);
const results = [];
for (const stage of stages) {
  console.log(`START ${stage.name}`);
  const started = performance.now();
  const logPath = join(output, `${stage.name}.log`);
  const logFile = openSync(logPath, "w");
  let result;
  try {
    result = spawnSync(process.execPath, stage.args, {
      cwd: root,
      env: {
        ...process.env,
        FLUTTER_WINDOWS: "false",
        DEFAULT_TENANT_DB_NAME: target.dbName,
        DEFAULT_TENANT_CORPORATE_ID: target.code,
        NODE_OPTIONS: "--max-old-space-size=1536"
      },
      timeout: 240_000,
      stdio: ["ignore", logFile, logFile],
      windowsHide: true
    });
  } finally {
    closeSync(logFile);
  }
  const passed = result.status === 0 && !result.error;
  results.push({
    stage: stage.name,
    passed,
    exitCode: result.status,
    error: result.error?.message,
    ms: Math.round(performance.now() - started),
    log: `${stage.name}.log`
  });
  console.log(`${passed ? "PASS" : "FAIL"} ${stage.name} (${results.at(-1).ms} ms)`);
  writeFileSync(
    join(output, "results.json"),
    JSON.stringify(
      {
        at: new Date().toISOString(),
        unitFiles: units.length,
        excludes: [
          "crm-duties-live.e2e.ts: requires external Frappe",
          "auth-domain-login.e2e.ts: Platform cross-app fixture retains an open handle",
          "tenant-session-access.e2e.ts: requires CODEXSUN development login and broad Core/Billing seeds"
        ],
        results
      },
      null,
      2
    )
  );
}
process.exitCode = results.every((result) => result.passed) ? 0 : 1;

function files(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? files(path) : [path];
  });
}
