import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { setTimeout as delay } from "node:timers/promises";
import WebSocket from "ws";

const directory = "dist/local-cloud";
const environment = JSON.parse(readFileSync(`${directory}/runtime.private.json`, "utf8"))[
  "codexsun-api"
];
const workerToken = readFileSync(`${directory}/.worker-control-token`, "utf8").trim();
const evidence = [];
const base = "http://127.0.0.1:18020/api/app";
const origin = "http://127.0.0.1:18020";
const sessions = [];
const sockets = [];
const channels = [];
let restartTargetsValidated = false;
try {
  for (const name of ["codexsun-worker", "cxapp-redis", "codexsun-chatb"]) {
    const target = JSON.parse(docker(["inspect", name]))[0];
    assert.equal(
      target.Config.Labels["com.docker.compose.project"],
      "codexsun-local-cloud",
      "Audit requires the local cloud Compose stack"
    );
  }
  restartTargetsValidated = true;
  if (!process.argv.includes("--cleanup")) await checkWorker();
  const session = await login(
    environment.DEFAULT_TENANT_CORPORATE_ID,
    environment.DEFAULT_TENANT_ADMIN_EMAIL,
    environment.DEFAULT_TENANT_ADMIN_PASSWORD
  );
  if (process.argv.includes("--cleanup")) {
    const records = await api(session, "/chat/channels?search=CODEXSUN%20ChatB%20audit&limit=200");
    for (const record of records) await cleanupChannel(session, record.uuid);
    evidence.push(`Removed ${records.length} local audit channels and their generated messages`);
  } else await checkChat(session);
  if (process.argv.includes("--restart")) await checkRestarts(session);
} finally {
  if (restartTargetsValidated && process.argv.includes("--restart")) {
    docker(["start", "cxapp-redis", "codexsun-worker", "codexsun-chatb"]);
  }
  for (const socket of sockets) socket.terminate();
  for (const { session, uuid } of channels) {
    try {
      await cleanupChannel(session, uuid);
    } catch {
      process.exitCode = 1;
      console.error("Generated audit channel cleanup failed.");
    }
  }
  for (const session of sessions) await api(session, "/auth/logout", "POST").catch(() => {});
}
if (process.exitCode === 1) throw new Error("Local audit cleanup failed.");
const report = process.argv.includes("--cleanup")
  ? "realtime-cleanup"
  : process.argv.includes("--restart")
    ? "realtime-audit"
    : "realtime-smoke";
writeFileSync(
  `${directory}/${report}.json`,
  JSON.stringify({ checkedAt: new Date().toISOString(), checks: evidence }, null, 2)
);
console.log(`Passed ${evidence.length} local realtime audit checks.`);

async function cleanupChannel(session, uuid) {
  const detail = await api(session, `/chat/channels/${uuid}`);
  assert.match(detail.channel.name, /^CODEXSUN ChatB audit \d+$/);
  for (const message of detail.messages) {
    assert.match(message.body, /^CODEXSUN local ChatB proof \d+$/);
    await api(session, `/chat/messages/${message.uuid}`, "DELETE");
  }
  await api(session, `/chat/channels/${uuid}`, "DELETE");
}

async function checkWorker() {
  assert.equal((await fetch("http://127.0.0.1:17040/ready")).status, 200);
  const denied = await fetch("http://127.0.0.1:17040/worker/probe", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{}"
  });
  assert.equal(denied.status, 401);
  const value = `codexsun-audit-${Date.now()}`;
  const result = await probe(value);
  assert.equal(result.result.value, value);
  assert.equal(result.prefix, "codexsun-worker-local-cloud");
  evidence.push("Worker control-token enforcement and real Redis job consumption");
}

async function checkChat(session) {
  const channel = await api(session, "/chat/channels", "POST", {
    kind: "channel",
    members: [],
    name: `CODEXSUN ChatB audit ${Date.now()}`
  });
  channels.push({ session, uuid: channel.uuid });
  const first = await openSocket(session);
  const second = await openSocket(session, "ws://127.0.0.1:17031/chatb/realtime");
  const pong = waitFrame(first, (frame) => frame.eventType === "pong");
  send(first, "chat.ping", {});
  await pong;
  const native = new WebSocket("ws://127.0.0.1:17031/chatb/realtime", {
    headers: { authorization: `Bearer ${session.token}`, origin }
  });
  sockets.push(native);
  const nativePong = waitFrame(native, (frame) => frame.eventType === "pong");
  native.once("open", () => send(native, "chat.ping", {}));
  await nativePong;
  evidence.push("Native Authorization-header WebSocket authentication delegates to Platform");
  for (const socket of [first, second]) {
    const subscribed = waitFrame(
      socket,
      (frame) =>
        frame.eventType === "presence.updated" && frame.payload.channelUuid === channel.uuid
    );
    send(socket, "chat.subscribe", { channelUuid: channel.uuid });
    await subscribed;
  }
  const body = `CODEXSUN local ChatB proof ${Date.now()}`;
  const received = [first, second].map((socket) =>
    waitFrame(
      socket,
      (frame) => frame.eventType === "message.created" && frame.payload.message?.body === body
    )
  );
  send(first, "chat.send", { channelUuid: channel.uuid, body });
  const frames = await Promise.all(received);
  assert.equal(frames[0].payload.message.uuid, frames[1].payload.message.uuid);
  const saved = await api(session, `/chat/channels/${channel.uuid}`);
  assert.ok(saved.messages.some((message) => message.body === body));
  evidence.push(
    "Cookie-authenticated ChatB ping, subscribe, text-frame delivery, two-client fan-out and MariaDB message persistence"
  );

  const anonymous = await closedSocket("ws://127.0.0.1:17031/chatb/realtime");
  assert.ok([4401, 4403].includes(anonymous));
  const originDenied = await closedSocket(
    `ws://127.0.0.1:17031/chatb/realtime?sessionSlot=${session.slot}`,
    { cookie: session.cookie, origin: "https://untrusted.invalid" }
  );
  assert.ok([4401, 4403].includes(originDenied));
  evidence.push("Anonymous and cross-origin WebSocket admission rejected");

  const other = await login(
    "TECHMEDIA",
    environment.TENANT_ADMIN_EMAIL,
    environment.TENANT_ADMIN_PASSWORD
  );
  const foreign = await openSocket(
    other,
    `ws://127.0.0.1:17031/chatb/realtime?tenantId=CODEXSUN&tenantDatabase=${environment.DEFAULT_TENANT_DB_NAME}`
  );
  const rejected = waitFrame(foreign, (frame) => frame.eventType === "error");
  send(foreign, "chat.subscribe", { channelUuid: channel.uuid });
  assert.equal((await rejected).payload.code, "UNKNOWN_CHANNEL");
  evidence.push(
    "Independent TECHMEDIA session cannot subscribe to CODEXSUN channel through forged tenant selectors"
  );

  const revoked = await login(
    environment.DEFAULT_TENANT_CORPORATE_ID,
    environment.DEFAULT_TENANT_ADMIN_EMAIL,
    environment.DEFAULT_TENANT_ADMIN_PASSWORD
  );
  await api(revoked, "/auth/logout", "POST");
  const invalid = await closedSocket(
    `ws://127.0.0.1:17031/chatb/realtime?sessionSlot=${revoked.slot}`,
    { cookie: revoked.cookie, origin }
  );
  assert.ok([4401, 4403].includes(invalid));
  evidence.push("Revoked session cannot reconnect to ChatB");
}

async function checkRestarts(session) {
  for (const socket of sockets) socket.terminate();
  docker(["stop", "-t", "10", "codexsun-worker"]);
  assert.equal(
    docker(["inspect", "codexsun-worker", "--format", "{{.State.ExitCode}}"]).trim(),
    "0"
  );
  const id = `codexsun-audit-restart-${Date.now()}`;
  const producer = `import { Queue } from 'bullmq'; import { Redis } from 'ioredis'; const connection=new Redis(process.env.CODEXSUN_REDIS_URL,{maxRetriesPerRequest:null}); const q=new Queue('worker.probe',{prefix:process.env.CODEXSUN_WORKER_QUEUE_PREFIX,connection}); await q.add('worker.probe',{value:'restart-proof'},{jobId:'${id}',removeOnComplete:false}); await q.close();await connection.quit();`;
  docker([
    "run",
    "--rm",
    "--network",
    "codexsun-local-cloud-network",
    "--env-file",
    `${directory}/.env.worker`,
    "--entrypoint",
    "node",
    "codexsun/worker:local-integrated",
    "--input-type=module",
    "-e",
    producer
  ]);
  docker(["restart", "cxapp-redis"]);
  docker(["start", "codexsun-worker"]);
  await ready("http://127.0.0.1:17040/ready");
  const inspectJob =
    producer.slice(0, producer.indexOf("await q.add")) +
    `const j=await q.getJob('${id}');console.log(JSON.stringify({state:await j.getState(),value:j.returnvalue?.value}));await q.close();await connection.quit();`;
  const completed = JSON.parse(
    docker(["exec", "codexsun-worker", "node", "--input-type=module", "-e", inspectJob])
  );
  assert.deepEqual(completed, { state: "completed", value: "restart-proof" });
  evidence.push("Worker exits cleanly and queued Redis job survives Redis/Worker restart");

  docker(["stop", "cxapp-redis"]);
  try {
    await ready("http://127.0.0.1:17040/ready", 503);
  } finally {
    docker(["start", "cxapp-redis"]);
  }
  await ready("http://127.0.0.1:17040/ready");
  assert.equal((await probe("reconnected")).result.value, "reconnected");
  evidence.push(
    "Worker reports Redis outage and automatically resumes consumption after Redis returns"
  );

  docker(["restart", "codexsun-chatb"]);
  await ready("http://127.0.0.1:17031/ready");
  const connected = await openSocket(session);
  const pong = waitFrame(connected, (frame) => frame.eventType === "pong");
  send(connected, "chat.ping", {});
  await pong;
  evidence.push("ChatB restarts and accepts an existing valid Platform session");
}

async function login(corporateId, email, password) {
  const response = await fetch(`${base}/auth/login`, {
    method: "POST",
    headers: { origin, "content-type": "application/json", "x-auth-token-delivery": "bearer" },
    body: JSON.stringify({ desk: "tenant", corporateId, email, password })
  });
  assert.equal(response.status, 200, `Tenant audit login failed: ${corporateId}`);
  const result = await response.json();
  const session = {
    token: result.data.accessToken,
    slot: result.data.sessionSlot,
    cookie: response.headers
      .getSetCookie()
      .map((cookie) => cookie.split(";")[0])
      .join("; ")
  };
  sessions.push(session);
  return session;
}

async function api(session, path, method = "GET", body) {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: {
      cookie: session.cookie,
      "x-codexsun-session-slot": session.slot,
      origin,
      ...(body ? { "content-type": "application/json" } : {})
    },
    ...(body ? { body: JSON.stringify(body) } : {})
  });
  const result = await response.json();
  assert.equal(
    response.status,
    200,
    `Chat API ${path} failed: ${result.error?.code ?? response.status}`
  );
  assert.equal(result.success, true);
  return result.data;
}

async function probe(value) {
  const response = await fetch("http://127.0.0.1:17040/worker/probe", {
    method: "POST",
    headers: { authorization: `Bearer ${workerToken}`, "content-type": "application/json" },
    body: JSON.stringify({ value })
  });
  assert.equal(response.status, 200);
  return response.json();
}

async function openSocket(session, address = "ws://127.0.0.1:18020/api/app/chat/realtime") {
  const url = new URL(address);
  url.searchParams.set("sessionSlot", session.slot);
  const socket = new WebSocket(url, { headers: { cookie: session.cookie, origin } });
  sockets.push(socket);
  await new Promise((resolve, reject) => {
    socket.once("open", resolve);
    socket.once("error", reject);
    socket.once("close", (code) => reject(new Error(`ChatB closed during admission: ${code}`)));
  });
  return socket;
}

function waitFrame(socket, predicate) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error(`ChatB frame timed out: ${predicate.toString()}`));
    }, 8000);
    const listener = (bytes, binary) => {
      if (binary) {
        cleanup();
        reject(new Error("Expected a text WebSocket frame"));
        return;
      }
      const frame = JSON.parse(bytes.toString());
      if (predicate(frame)) {
        cleanup();
        resolve(frame);
      }
    };
    const closed = (code) => {
      cleanup();
      reject(new Error(`ChatB closed while waiting for a frame: ${code}`));
    };
    function cleanup() {
      clearTimeout(timeout);
      socket.off("message", listener);
      socket.off("close", closed);
    }
    socket.on("message", listener);
    socket.on("close", closed);
  });
}

function closedSocket(address, headers = {}) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(address, { headers });
    const timer = setTimeout(() => {
      socket.terminate();
      reject(new Error("Socket denial timed out"));
    }, 8000);
    socket.on("error", () => {});
    socket.on("close", (code) => {
      clearTimeout(timer);
      resolve(code);
    });
  });
}

function send(socket, eventType, payload) {
  socket.send(JSON.stringify({ eventId: String(Date.now()), eventType, payload }));
}
function docker(args) {
  return execFileSync("docker", args, { encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] });
}
async function ready(url, status = 200) {
  for (let attempt = 0; attempt < 40; attempt++) {
    if (
      await fetch(url, { signal: AbortSignal.timeout(1500) })
        .then((response) => response.status === status)
        .catch(() => false)
    )
      return;
    await delay(500);
  }
  throw new Error(`Readiness did not reach ${status}: ${url}`);
}
