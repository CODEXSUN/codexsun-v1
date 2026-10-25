import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { chatSample } from "./hardness-chat.mjs";
import {
  directory,
  environment,
  token,
  login,
  api,
  pool,
  stats,
  docker,
  queueSample,
  ready,
  connect,
  send,
  waitFrame
} from "./hardness-support.mjs";

const run = `codexsun-hardness-${Date.now()}`;
const report = {
  run,
  startedAt: new Date().toISOString(),
  scope: "Local synthetic workload only",
  results: {}
};
const sessions = [];
let targetsValidated = false;
try {
  for (const name of ["codexsun-worker", "codexsun-chatb", "cxapp-redis"]) {
    const target = JSON.parse(docker(["inspect", name]))[0];
    assert.equal(target.Config.Labels["com.docker.compose.project"], "codexsun-local-cloud");
    assert.equal(target.State.Running, true);
  }
  targetsValidated = true;
  report.before = resources();
  report.results.queue = await queueSample("load", `${run}-bulk`, 1000);
  console.log(
    "Worker: 1,000 jobs, duplicate IDs, delayed jobs and three-attempt failure checks passed."
  );
  await boundaries();
  const session = await login(
    environment.DEFAULT_TENANT_CORPORATE_ID,
    environment.DEFAULT_TENANT_ADMIN_EMAIL,
    environment.DEFAULT_TENANT_ADMIN_PASSWORD
  );
  sessions.push(session);
  const foreign = await login(
    "TECHMEDIA",
    environment.TENANT_ADMIN_EMAIL,
    environment.TENANT_ADMIN_PASSWORD
  );
  sessions.push(foreign);
  const result = await chatSample(session, foreign, run, httpLoad);
  report.results.chat = result.chat;
  report.results.workerHttp = result.worker;
  console.log("ChatB: 10,000 message deliveries and 1,000 pong replies verified.");
  docker(["stop", "-t", "10", "codexsun-worker"]);
  const backlogRun = `${run}-backlog`;
  await queueSample("enqueue", backlogRun, 500, true);
  docker(["restart", "cxapp-redis"]);
  docker(["start", "codexsun-worker"]);
  await ready("http://127.0.0.1:17040/ready");
  report.results.recoveredBacklog = await queueSample("verify", backlogRun, 500);
  docker(["restart", "codexsun-chatb"]);
  await ready("http://127.0.0.1:17031/ready");
  const socket = await connect(session);
  const pong = waitFrame(socket, (frame) => frame.eventType === "pong");
  send(socket, "chat.ping", {});
  await pong;
  socket.terminate();
  report.results.chatRestartRecovery = true;
  report.after = resources();
  report.passed = true;
} catch (error) {
  report.passed = false;
  report.error = error.message;
  process.exitCode = 1;
} finally {
  if (targetsValidated) docker(["start", "cxapp-redis", "codexsun-worker", "codexsun-chatb"]);
  if (targetsValidated) {
    await ready("http://127.0.0.1:17040/ready");
    report.cleanup = await queueSample("cleanup", run, 1);
  }
  for (const session of sessions) await api(session, "/auth/logout", "POST").catch(() => {});
  report.finishedAt = new Date().toISOString();
  writeFileSync(`${directory}/hardness-report.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
}

async function boundaries() {
  const request = (body, authorization = `Bearer ${token}`) =>
    fetch("http://127.0.0.1:17040/worker/probe", {
      method: "POST",
      headers: { "content-type": "application/json", authorization },
      body
    });
  assert.equal((await request("{}", "Bearer invalid")).status, 401);
  assert.equal((await request("{")).status, 400);
  assert.equal((await request(JSON.stringify({ value: {} }))).status, 400);
  assert.equal((await request(JSON.stringify({ value: "x".repeat(129) }))).status, 400);
  const prefix = `${run}/unicode/`;
  const value = prefix + "🌟".repeat(128 - Array.from(prefix).length);
  const unicode = await request(JSON.stringify({ value }));
  assert.equal(
    unicode.status,
    200,
    "128 Unicode characters must match the HTTP schema and Worker validation"
  );
  assert.equal((await unicode.json()).result.value, value);
  report.results.workerInputBoundaries = { rejectedInputs: 4, unicodeBoundary: true };
}
async function httpLoad() {
  const elapsed = [],
    ids = new Set();
  const started = performance.now();
  await pool(300, 20, async (index) => {
    const value = `${run}-http-${index}`;
    const begin = performance.now();
    const response = await fetch("http://127.0.0.1:17040/worker/probe", {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({ value }),
      signal: AbortSignal.timeout(10000)
    });
    assert.equal(response.status, 200);
    const result = await response.json();
    assert.equal(result.result.value, value);
    assert.ok(!ids.has(result.id));
    ids.add(result.id);
    elapsed.push(performance.now() - begin);
  });
  return {
    requests: 300,
    concurrency: 20,
    failures: 0,
    elapsedMs: Math.round(performance.now() - started),
    latencyMs: stats(elapsed)
  };
}
function resources() {
  return docker([
    "stats",
    "--no-stream",
    "--format",
    "{{.Name}}|{{.CPUPerc}}|{{.MemUsage}}",
    "codexsun-worker",
    "codexsun-chatb",
    "codexsun-api",
    "cxapp-redis"
  ])
    .trim()
    .split(/\r?\n/);
}
