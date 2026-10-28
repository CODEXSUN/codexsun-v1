import assert from "node:assert/strict";
import test from "node:test";
import { createServer } from "node:net";
import { DatabaseRelayLease, inspectRelay, probePort } from "./database-relay.mjs";

const database = {
  Name: "/codexsun-mariadb", Image: "image-id",
  NetworkSettings: { Networks: { private: {} } }
};
const configured = { name: "codexsun-mariadb-relay", id: "relay-id", port: 13306 };

function fixture() {
  const calls = [];
  const item = {
    Id: "relay-id", Image: "image-id", State: { Running: true }, Mounts: [],
    Config: { Env: ["PATH=/usr/bin"], Labels: { "io.codexsun.role": "mariadb-relay" }, Entrypoint: ["/usr/bin/socat"],
      Cmd: ["TCP-LISTEN:3306,fork,reuseaddr", "TCP:codexsun-mariadb:3306"] },
    HostConfig: { Privileged: false, NetworkMode: "private", RestartPolicy: { Name: "no" },
      Tmpfs: { "/var/lib/mysql": "ro,nosuid,nodev,noexec,size=1m" }, PortBindings: {
      "3306/tcp": [{ HostIp: "127.0.0.1", HostPort: "13306" }]
    } },
    NetworkSettings: { Networks: { private: {} } }
  };
  const docker = {
    inspect: () => item,
    json: (args) => args[0] === "image" ? [{ Config: { Env: ["PATH=/usr/bin"] } }] :
      [{ Containers: item.State.Running ? { [item.Id]: {} } : {} }],
    async stopRelay() { calls.push("stop"); item.State.Running = false; },
    run(args) { assert.deepEqual(args, ["start", item.Id]); calls.push("start"); item.State.Running = true; }
  };
  const reserve = async () => {
    calls.push("reserve");
    return { listening: true, close(done) { calls.push("release"); this.listening = false; done(); } };
  };
  const probe = async () => calls.push("probe");
  return { calls, docker, item, reserve, probe };
}

test("accepts only the configured socat relay with a loopback port and controlled tmpfs", () => {
  const { docker, item } = fixture();
  assert.equal(inspectRelay(docker, configured, database).port, 13306);
  item.HostConfig.PortBindings["3306/tcp"][0].HostIp = "0.0.0.0";
  assert.throws(() => inspectRelay(docker, configured, database));
  item.HostConfig.PortBindings["3306/tcp"][0].HostIp = "127.0.0.1";
  item.Mounts.push({ Name: "database" });
  assert.throws(() => inspectRelay(docker, configured, database), /mounts/u);
  item.Mounts.pop();
  item.HostConfig.Tmpfs["/var/lib/mysql"] = "rw";
  assert.throws(() => inspectRelay(docker, configured, database), /read-only tmpfs/u);
});

test("rejects relay restart policies, environment overrides and database aliases", () => {
  const { docker, item } = fixture();
  item.HostConfig.RestartPolicy.Name = "always";
  assert.throws(() => inspectRelay(docker, configured, database), /restart automatically/u);
  item.HostConfig.RestartPolicy.Name = "no";
  item.Config.Env.push("LD_PRELOAD=/tmp/injected.so");
  assert.throws(() => inspectRelay(docker, configured, database), /environment overrides/u);
  item.Config.Env.pop();
  item.NetworkSettings.Networks.private.Aliases = ["codexsun-mariadb"];
  assert.throws(() => inspectRelay(docker, configured, database), /network alias/u);
});

test("isolates and reserves the port before migration, restoring it on success", async () => {
  const { docker, calls, reserve, probe } = fixture();
  const lease = new DatabaseRelayLease(docker, inspectRelay(docker, configured, database), reserve, probe);
  await lease.isolate();
  lease.assertIsolated();
  await lease.restore();
  assert.deepEqual(calls, ["stop", "reserve", "release", "start", "probe"]);
});

test("restores the relay after port reservation fails before migration", async () => {
  const { docker, calls, probe } = fixture();
  const lease = new DatabaseRelayLease(docker, inspectRelay(docker, configured, database), async () => {
    throw new Error("port unavailable");
  }, probe);
  await assert.rejects(lease.isolate(), /port unavailable/u);
  await lease.restore();
  assert.deepEqual(calls, ["stop", "start", "probe"]);
});

test("keeps the relay stopped after a possible database mutation", async () => {
  const { docker, calls, reserve } = fixture();
  const lease = new DatabaseRelayLease(docker, inspectRelay(docker, configured, database), reserve);
  await lease.isolate();
  await lease.keepStopped();
  assert.deepEqual(calls, ["stop", "reserve", "release"]);
});

test("stops a relay restored before a later post-migration failure", async () => {
  const { docker, calls, reserve, probe } = fixture();
  const lease = new DatabaseRelayLease(docker, inspectRelay(docker, configured, database), reserve, probe);
  await lease.isolate();
  await lease.restore();
  await lease.keepStopped();
  assert.deepEqual(calls, ["stop", "reserve", "release", "start", "probe", "stop"]);
});

test("fails closed if the relay identity changes during isolation", async () => {
  const { docker, item, reserve } = fixture();
  const lease = new DatabaseRelayLease(docker, inspectRelay(docker, configured, database), reserve);
  await lease.isolate();
  item.Id = "different-id";
  assert.throws(() => lease.assertIsolated(), /identity changed/u);
  await assert.rejects(lease.restore(), /identity changed/u);
});

test("does not proceed if a stopped relay remains on a database network", async () => {
  const { docker, reserve } = fixture();
  const relay = inspectRelay(docker, configured, database);
  docker.json = () => [{ Containers: { [relay.id]: {} } }];
  await assert.rejects(new DatabaseRelayLease(docker, relay, reserve).isolate(), /still attached/u);
});

test("the real port reservation blocks another local listener until recovery", async () => {
  const unused = createServer();
  await new Promise((resolve) => unused.listen(0, "127.0.0.1", resolve));
  const port = unused.address().port;
  await new Promise((resolve) => unused.close(resolve));
  const { docker, probe } = fixture();
  const lease = new DatabaseRelayLease(docker, { ...configured, port, networks: ["private"] }, undefined, probe);
  const rival = createServer();
  try {
    await lease.isolate();
    const error = await new Promise((resolve) => {
      rival.once("error", resolve);
      rival.listen(port, "127.0.0.1");
    });
    assert.equal(error.code, "EADDRINUSE");
  } finally {
    await lease.restore();
  }
});

test("relay probe retries a transient startup refusal", async () => {
  let attempts = 0;
  await probePort(13306, { timeoutMs: 100, intervalMs: 1, connect: async () => {
    attempts += 1;
    if (attempts < 3) throw Object.assign(new Error("not ready"), { code: "ECONNREFUSED" });
  } });
  assert.equal(attempts, 3);
});

test("relay probe fails closed after bounded retries", async () => {
  let attempts = 0;
  await assert.rejects(probePort(13306, { timeoutMs: 20, intervalMs: 2, connect: async () => {
    attempts += 1;
    throw Object.assign(new Error("not ready"), { code: "ECONNREFUSED" });
  } }), /did not become reachable/u);
  assert.ok(attempts > 1);
});
