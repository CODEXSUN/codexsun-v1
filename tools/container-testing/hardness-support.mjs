import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { setTimeout as delay } from "node:timers/promises";
import WebSocket from "ws";

export const directory = "dist/local-cloud";
export const origin = "http://127.0.0.1:18020";
const base = `${origin}/api/app`;
export const environment = JSON.parse(readFileSync(`${directory}/runtime.private.json`))[
  "codexsun-api"
];
export const token = readFileSync(`${directory}/.worker-control-token`, "utf8").trim();

export async function login(corporateId, email, password) {
  const response = await fetch(`${base}/auth/login`, {
    method: "POST",
    headers: { origin, "content-type": "application/json", "x-auth-token-delivery": "bearer" },
    body: JSON.stringify({ desk: "tenant", corporateId, email, password })
  });
  assert.equal(response.status, 200, `Sample login failed for ${corporateId}`);
  const { data } = await response.json();
  return {
    token: data.accessToken,
    slot: data.sessionSlot,
    cookie: response.headers
      .getSetCookie()
      .map((cookie) => cookie.split(";")[0])
      .join("; ")
  };
}
export async function api(session, path, method = "GET", body) {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: {
      cookie: session.cookie,
      "x-codexsun-session-slot": session.slot,
      origin,
      ...(body ? { "content-type": "application/json" } : {})
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(20000)
  });
  const result = await response.json();
  assert.equal(
    response.status,
    200,
    `Sample API ${method} ${path}: ${result.error?.code ?? response.status}`
  );
  assert.equal(result.success, true);
  return result.data;
}
export async function connect(session, index = 0, extraQuery = "") {
  const url = new URL(
    index % 2 ? "ws://127.0.0.1:17031/chatb/realtime" : "ws://127.0.0.1:18020/api/app/chat/realtime"
  );
  url.searchParams.set("sessionSlot", session.slot);
  for (const [key, value] of new URLSearchParams(extraQuery)) url.searchParams.set(key, value);
  const socket = new WebSocket(url, {
    headers: {
      origin,
      ...(index % 4 === 0
        ? { authorization: `Bearer ${session.token}` }
        : { cookie: session.cookie })
    }
  });
  socket.on("error", () => {});
  const ready = waitFrame(socket, (frame) => frame.eventType === "pong");
  socket.once("open", () => send(socket, "chat.ping", {}));
  try {
    await ready;
    return socket;
  } catch (error) {
    socket.terminate();
    throw error;
  }
}
export function send(socket, eventType, payload) {
  socket.send(
    JSON.stringify({ eventId: `sample-${Date.now()}-${Math.random()}`, eventType, payload })
  );
}
export function waitFrame(socket, predicate, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error("Sample frame timed out"));
    }, timeoutMs);
    const listener = (bytes, binary) => {
      if (binary) return;
      let frame;
      try {
        frame = JSON.parse(bytes.toString());
      } catch {
        return;
      }
      if (predicate(frame)) {
        cleanup();
        resolve(frame);
      }
    };
    const closed = (code) => {
      cleanup();
      reject(new Error(`Sample socket closed: ${code}`));
    };
    function cleanup() {
      clearTimeout(timer);
      socket.off("message", listener);
      socket.off("close", closed);
      socket.off("error", failed);
    }
    function failed() {
      cleanup();
      reject(new Error("Sample socket connection failed"));
    }
    socket.on("message", listener);
    socket.once("close", closed);
    socket.once("error", failed);
  });
}
export async function pool(count, concurrency, operation) {
  let next = 0;
  const results = new Array(count);
  await Promise.all(
    Array.from({ length: concurrency }, async () => {
      while (next < count) {
        const index = next++;
        results[index] = await operation(index);
      }
    })
  );
  return results;
}
export function stats(values) {
  const sorted = values.toSorted((a, b) => a - b);
  return {
    p50: Math.round(sorted[Math.floor(sorted.length * 0.5)]),
    p95: Math.round(sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))]),
    max: Math.round(sorted.at(-1))
  };
}
export function docker(args) {
  return execFileSync("docker", args, { encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] });
}
export async function ready(url, status = 200) {
  for (let attempt = 0; attempt < 60; attempt++) {
    if (
      await fetch(url, { signal: AbortSignal.timeout(1500) })
        .then((response) => response.status === status)
        .catch(() => false)
    )
      return;
    await delay(500);
  }
  throw new Error(`Sample readiness failed: ${status} ${url}`);
}
export async function queueSample(mode, run, count, stopped = false) {
  const args = stopped
    ? [
        "run",
        "--rm",
        "-i",
        "--network",
        "codexsun-local-cloud-network",
        "--env-file",
        `${directory}/.env.worker`,
        "--entrypoint",
        "node",
        "codexsun/worker:local-integrated"
      ]
    : ["exec", "-i", "codexsun-worker", "node"];
  const source = readFileSync("tools/container-testing/hardness-queue.mjs", "utf8");
  const child = spawn("docker", [...args, "--input-type=module", "-", mode, run, String(count)], {
    stdio: ["pipe", "pipe", "pipe"]
  });
  let output = "",
    error = "";
  child.stdout.on("data", (data) => {
    output += data;
  });
  child.stderr.on("data", (data) => {
    error += data;
  });
  const completed = new Promise((resolve, reject) => {
    child.on("error", reject);
    child.on("close", (code) =>
      code === 0
        ? resolve(JSON.parse(output.trim()))
        : reject(new Error(`Sample queue process failed: ${error.slice(-1500)}`))
    );
  });
  child.stdin.end(source);
  return completed;
}
