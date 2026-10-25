import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import test from "node:test";
import { previousPreflightPids, takeoverTarget } from "./dev-port-ownership.mjs";

test("a duplicate development start leaves an occupied listener running", async () => {
  const server = createServer((_request, response) => response.end("still running"));
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const { port } = server.address();
    await assert.rejects(
      promisify(execFile)(process.execPath, ["tools/preflight.mjs", "platform-web"], {
        cwd: new URL("..", import.meta.url),
        env: { ...process.env, PLATFORM_WEB_PORT: String(port), CODEXSUN_DEV_PORT_POLICY: "abort" },
        timeout: 20_000
      }),
      (error) => error.code === 1 && /previous dev process or another listener/u.test(error.stderr)
    );
    const response = await fetch(`http://127.0.0.1:${port}`);
    assert.equal(await response.text(), "still running");
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("TConnect takeover refuses an unrelated port owner", async () => {
  const server = createServer((_request, response) => response.end("unrelated listener"));
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const { port } = server.address();
    await assert.rejects(
      promisify(execFile)(process.execPath, ["tools/preflight.mjs", "tconnect-web"], {
        cwd: new URL("..", import.meta.url),
        env: {
          ...process.env,
          CODEXSUN_TCONNECT_WEB_PORT: String(port),
          CODEXSUN_DEV_PORT_POLICY: "takeover"
        },
        timeout: 20000
      }),
      (error) => error.code === 1 && /another process; refusing takeover/u.test(error.stderr)
    );
    assert.equal(await (await fetch(`http://127.0.0.1:${port}`)).text(), "unrelated listener");
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

const [
  packageSource,
  stackSource,
  preflightSource,
  appRegistrySource,
  appDeskSource,
  platformApiTsconfigSource,
  platformWebTsconfigSource,
  platformWebViteSource
] = await Promise.all([
  readFile(new URL("../package.json", import.meta.url), "utf8"),
  readFile(new URL("./dev-stack.mjs", import.meta.url), "utf8"),
  readFile(new URL("./preflight.mjs", import.meta.url), "utf8"),
  readFile(new URL("../apps/platform/web/src/app/app-registry.ts", import.meta.url), "utf8"),
  readFile(new URL("../apps/platform/web/src/desks/tenant/AppDesk.tsx", import.meta.url), "utf8"),
  readFile(new URL("../apps/platform/api/tsconfig.json", import.meta.url), "utf8"),
  readFile(new URL("../apps/platform/web/tsconfig.json", import.meta.url), "utf8"),
  readFile(new URL("../apps/platform/web/vite.config.ts", import.meta.url), "utf8")
]);
const packageJson = JSON.parse(packageSource);
const platformApiTsconfig = JSON.parse(platformApiTsconfigSource);
const platformWebTsconfig = JSON.parse(platformWebTsconfigSource);

test("development commands keep API and web watchers independently available", () => {
  assert.equal(packageJson.scripts.dev, "node tools/dev-stack.mjs");
  assert.equal(packageJson.scripts["dev:api"], "node tools/preflight.mjs platform-api");
  assert.equal(packageJson.scripts["dev:web"], "node tools/preflight.mjs platform-web");
  assert.match(preflightSource, /watchApiSources\(\)/u);
  assert.doesNotMatch(preflightSource, /"--watch"/u);
  assert.match(preflightSource, /nodePackageBin\("vite", "bin\/vite\.js"\)/u);
  assert.match(
    preflightSource,
    /\[\s*"platform-api",\s*"platform-web",\s*"qcafe-web",\s*"ecommerce-web",\s*"tconnect-web"\s*\]\.includes\(\s*app\s*\)/u
  );
  assert.match(preflightSource, /--max-http-header-size=\$\{size\}/u);
  assert.match(preflightSource, /withMaxHttpHeaderSize\([\s\S]*?262_144/u);
});

test("API development resolves linked owner packages through the root dependency tree", () => {
  assert.match(preflightSource, /register-root-package-resolution\.mjs/u);
  assert.match(preflightSource, /"--import",\s*"tsx"/u);
  assert.equal(platformApiTsconfig.compilerOptions.preserveSymlinks, true);
});

test("web development keeps linked owner source and styles on the root dependency path", () => {
  assert.equal(platformWebTsconfig.compilerOptions.preserveSymlinks, true);
  assert.match(platformWebViteSource, /preserveSymlinks:\s*true/u);
});

test("tenant app breadcrumbs use app IDs and canonical root pages", () => {
  assert.match(appRegistrySource, /appId:\s*app\.id/u);
  assert.match(appRegistrySource, /url:\s*appRootUrl\(app\.id\)/u);
  assert.match(appDeskSource, /requestListNavigation\(pageForApp\(item\.appId\)\)/u);
  assert.doesNotMatch(appDeskSource, /item\.title\s*===/u);
});

test("combined development runtime restarts one service without stopping its sibling", () => {
  assert.match(stackSource, /restartService\(serviceName, "process exit"\)/u);
  assert.match(stackSource, /restartService\(serviceName, "failed health checks"\)/u);
  assert.match(stackSource, /await waitForPreflight\(child, service\.label\)/u);
  assert.match(preflightSource, /codexsun:preflight-ready/u);
  assert.match(preflightSource, /env\.CODEXSUN_DEV_PORT_POLICY \?\? "abort"/u);
  assert.doesNotMatch(stackSource, /stopChildren\(child\)/u);
});

test("port takeover stops the old watcher tree and its supervisor", () => {
  const processes = new Map([
    [10, { pid: 10, parentPid: 20, name: "node.exe", commandLine: "node src/server.ts" }],
    [20, { pid: 20, parentPid: 30, name: "node.exe", commandLine: "node --watch src/server.ts" }],
    [
      30,
      {
        pid: 30,
        parentPid: 40,
        name: "node.exe",
        commandLine: "node tools/preflight.mjs platform-api"
      }
    ],
    [40, { pid: 40, parentPid: 0, name: "node.exe", commandLine: "node tools/dev-stack.mjs" }],
    [
      50,
      {
        pid: 50,
        parentPid: 0,
        name: "node.exe",
        commandLine: "node tools/preflight.mjs platform-api"
      }
    ],
    [
      60,
      {
        pid: 60,
        parentPid: 30,
        name: "cmd.exe",
        commandLine: "cmd /c node tools/preflight.mjs platform-api"
      }
    ]
  ]);
  assert.equal(takeoverTarget(10, processes, "platform-api", 50), 40);
  processes.set(50, {
    pid: 50,
    parentPid: 40,
    name: "node.exe",
    commandLine: "node tools/preflight.mjs platform-api"
  });
  assert.equal(takeoverTarget(10, processes, "platform-api", 50), 30);
  assert.equal(takeoverTarget(10, processes, "platform-web", 50), null);
  assert.equal(takeoverTarget(999, processes, "platform-api", 50), null);
  assert.deepEqual(previousPreflightPids(processes, "platform-api", 50), [30]);
});

test("development shutdown asks the child to stop before forcing termination", () => {
  const gracefulStop = stackSource.indexOf('child.send({ type: "codexsun:shutdown" })');
  const forcedStop = stackSource.indexOf('spawnSync("taskkill"');
  assert.ok(gracefulStop >= 0, "The supervisor must request a graceful child shutdown.");
  assert.ok(forcedStop > gracefulStop, "Forced termination must remain a fallback.");
  assert.match(preflightSource, /message\?\.type === "codexsun:shutdown"/u);
  assert.match(preflightSource, /requestDevApiShutdown\(controlFile, controlToken\)/u);
  assert.match(preflightSource, /await stopCurrentChild\(signal\)/u);
});

test("configured ports and API readiness govern startup", () => {
  assert.match(
    stackSource,
    /requiredDevPort\(\s*process\.env\.PLATFORM_API_PORT \?\? env\.PLATFORM_API_PORT/u
  );
  assert.match(
    stackSource,
    /requiredDevPort\(\s*process\.env\.PLATFORM_WEB_PORT \?\? env\.PLATFORM_WEB_PORT/u
  );
  assert.match(stackSource, /readyUrl: `http:\/\/127\.0\.0\.1:\$\{apiPort\}\/ready`/u);
  assert.match(preflightSource, /`http:\/\/127\.0\.0\.1:\$\{apiPort\}\/ready`/u);
});

test("development services use one distinct frontend port each", async () => {
  const example = await readFile(new URL("../.env.example", import.meta.url), "utf8");
  const ports = new Map(
    [
      ...example.matchAll(
        /^(PLATFORM_API_PORT|PLATFORM_WEB_PORT|CODEXSUN_ECOMMERCE_WEB_PORT|CODEXSUN_UIUX_WEB_PORT)=(\d+)$/gmu
      )
    ].map((match) => [match[1], Number(match[2])])
  );
  assert.deepEqual([...ports.values()], [7010, 7020, 7030, 7040]);
  assert.match(stackSource, /await startAndWait\("uiux-web"\)/u);
  assert.doesNotMatch(stackSource, /await startAndWait\("ecommerce-storefront"\)/u);
});
