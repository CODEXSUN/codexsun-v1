import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import test from "node:test";
import { LocalDocker } from "./docker.mjs";
import { project } from "./config.mjs";

test("graceful app shutdown suppresses restart policy without a force-kill timeout", async () => {
  const docker = new LocalDocker();
  const container = {
    Id: "app-id",
    Name: "/codexsun-api",
    Config: { Labels: { "com.docker.compose.project": project }, StopSignal: "SIGTERM" },
    State: { Running: true }
  };
  const calls = [];
  docker.inspect = () => container;
  docker.startProcess = (args) => {
    calls.push(args);
    const child = new EventEmitter();
    child.stdout = child.stderr = { resume() {} };
    setImmediate(() => {
      container.State.Running = false;
      child.emit("close", 0);
    });
    return child;
  };
  await docker.stop(container.Id);
  assert.deepEqual(calls, [["stop", "--timeout", "-1", "app-id"]]);
});

test("graceful shutdown rejects database and unrelated containers", async () => {
  const docker = new LocalDocker();
  docker.inspect = () => ({ Name: "/cxapp-mariadb" });
  await assert.rejects(() => docker.stop("database-id"), /Only local app containers/u);
});
