import assert from "node:assert/strict";
import { createConnection, createServer } from "node:net";

export function inspectRelay(docker, configured, database) {
  assert.equal(configured.name, "codexsun-mariadb-relay", "Unexpected database relay name.");
  assert.match(String(configured.port), /^\d+$/u, "Invalid database relay port.");
  assert.ok(Number(configured.port) > 0 && Number(configured.port) <= 65535, "Invalid database relay port.");
  const relay = docker.inspect(configured.name);
  assert.equal(relay.Id, configured.id, "Database relay identity changed.");
  assert.equal(relay.Config.Labels?.["io.codexsun.role"], "mariadb-relay");
  assert.equal(relay.Image, database.Image, "Database relay image differs from MariaDB image.");
  assert.deepEqual(relay.Config.Entrypoint, ["/usr/bin/socat"]);
  assert.deepEqual(relay.Config.Cmd, [
    "TCP-LISTEN:3306,fork,reuseaddr",
    `TCP:${database.Name.slice(1)}:3306`
  ]);
  assert.equal(relay.State.Running, true, "Database relay must be running before update.");
  assert.ok(!relay.HostConfig.Privileged && relay.HostConfig.NetworkMode !== "host");
  assert.ok(!(relay.HostConfig.CapAdd ?? []).length, "Database relay capabilities are unsupported.");
  assert.equal(relay.HostConfig.RestartPolicy?.Name || "no", "no", "Database relay must not restart automatically.");
  assert.deepEqual(relay.HostConfig.Tmpfs, {
    "/var/lib/mysql": "ro,nosuid,nodev,noexec,size=1m"
  }, "Database relay requires its controlled read-only tmpfs.");
  assert.ok((relay.Mounts ?? []).every((mount) =>
    mount.Type === "tmpfs" && mount.Destination === "/var/lib/mysql" && mount.RW === false
  ), "Database relay persistent or writable mounts are unsupported.");
  const image = docker.json(["image", "inspect", relay.Image])[0];
  assert.deepEqual([...(relay.Config.Env ?? [])].sort(), [...(image.Config.Env ?? [])].sort(),
    "Database relay environment overrides are unsupported.");
  const ports = relay.HostConfig.PortBindings ?? {};
  assert.deepEqual(Object.keys(ports), ["3306/tcp"], "Unexpected database relay port mappings.");
  assert.deepEqual(ports["3306/tcp"], [{ HostIp: "127.0.0.1", HostPort: String(configured.port) }]);
  const networks = Object.keys(relay.NetworkSettings.Networks ?? {});
  assert.ok(networks.length > 0 && networks.every((name) => database.NetworkSettings.Networks[name]),
    "Database relay must use only MariaDB networks.");
  for (const name of networks) {
    assert.ok(!(relay.NetworkSettings.Networks[name].Aliases ?? []).includes(database.Name.slice(1)),
      "Database relay cannot use the MariaDB network alias.");
  }
  return { name: configured.name, id: relay.Id, port: Number(configured.port), networks };
}

export class DatabaseRelayLease {
  constructor(docker, relay, holdPort = reservePort, probe = probePort) {
    this.docker = docker;
    this.relay = relay;
    this.holdPort = holdPort;
    this.probe = probe;
    this.stopAttempted = false;
    this.reservation = null;
  }

  async isolate() {
    this.stopAttempted = true;
    await this.docker.stopRelay(this.relay);
    this.assertStopped();
    this.reservation = await this.holdPort(this.relay.port, () => this.docker.interrupt?.());
    this.assertIsolated();
  }

  assertIsolated() {
    this.assertStopped();
    assert.ok(this.reservation?.listening, "The local database relay port is not reserved.");
  }

  assertStopped() {
    const relay = this.docker.inspect(this.relay.name);
    assert.equal(relay.Id, this.relay.id, "Database relay identity changed.");
    assert.equal(relay.State.Running, false, "Database relay is still running.");
    for (const network of this.relay.networks) {
      const info = this.docker.json(["network", "inspect", network])[0];
      assert.ok(!Object.hasOwn(info.Containers ?? {}, relay.Id), "Database relay is still attached to the network.");
    }
  }

  async restore() {
    if (!this.stopAttempted) return;
    await this.releasePort();
    const relay = this.docker.inspect(this.relay.name);
    assert.equal(relay.Id, this.relay.id, "Database relay identity changed.");
    if (!relay.State.Running) this.docker.run(["start", relay.Id]);
    assert.equal(this.docker.inspect(this.relay.name).State.Running, true, "Database relay failed to restart.");
    await this.probe(this.relay.port);
    this.stopAttempted = false;
  }

  async releasePort() {
    if (!this.reservation) return;
    const reservation = this.reservation;
    this.reservation = null;
    await new Promise((resolve, reject) => reservation.close((error) => error ? reject(error) : resolve()));
  }

  async keepStopped() {
    this.stopAttempted = true;
    const relay = this.docker.inspect(this.relay.name);
    assert.equal(relay.Id, this.relay.id, "Database relay identity changed.");
    if (relay.State.Running) await this.docker.stopRelay(this.relay);
    this.assertStopped();
    await this.releasePort();
  }
}

function reservePort(port, onFailure) {
  return new Promise((resolve, reject) => {
    const server = createServer((socket) => socket.destroy());
    server.once("error", reject);
    server.listen({ host: "127.0.0.1", port, exclusive: true }, () => {
      server.removeListener("error", reject);
      server.on("error", () => { onFailure(); server.close(); });
      resolve(server);
    });
  });
}

export async function probePort(port, options = {}) {
  const timeoutMs = options.timeoutMs ?? 10_000;
  const intervalMs = options.intervalMs ?? 250;
  const connect = options.connect ?? connectPort;
  const deadline = Date.now() + timeoutMs;
  while (true) {
    try {
      await connect(port, Math.max(1, Math.min(1_000, deadline - Date.now())));
      return;
    } catch (error) {
      if (
        !["ECONNREFUSED", "ECONNRESET", "EHOSTUNREACH", "ETIMEDOUT"].includes(error?.code) ||
        Date.now() >= deadline
      ) {
        throw new Error("Database relay did not become reachable after restart.", { cause: error });
      }
      await new Promise((resolve) =>
        setTimeout(resolve, Math.min(intervalMs, Math.max(0, deadline - Date.now())))
      );
    }
  }
}

function connectPort(port, timeoutMs) {
  return new Promise((resolve, reject) => {
    const socket = createConnection({ host: "127.0.0.1", port });
    socket.setTimeout(timeoutMs, () => {
      const error = new Error("Database relay connection timed out.");
      error.code = "ETIMEDOUT";
      socket.destroy(error);
    });
    socket.once("error", reject);
    socket.once("connect", () => { socket.end(); resolve(); });
  });
}
