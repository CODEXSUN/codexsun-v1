import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import test from "node:test";
import { createConnection } from "mysql2/promise";
import { withConnections } from "../../devkits/data-bridge/api/src/modules/import-review/import-review.service.js";

test("Data Bridge rejects writable and aliased sources and preserves the source", async () => {
  const name = process.env.CODEXSUN_BRIDGE_FIXTURE_CONTAINER ?? "";
  const port = Number(process.env.CODEXSUN_BRIDGE_FIXTURE_PORT);
  const password = process.env.CODEXSUN_BRIDGE_FIXTURE_PASSWORD ?? "";
  assert.match(name, /^codexsun-bridge-[a-z0-9-]+$/u);
  assert.ok(port > 0 && port <= 65535 && password, "Explicit fixture connection is required.");
  const inspect = JSON.parse(execFileSync("docker", ["inspect", name], { encoding: "utf8" }))[0];
  assert.equal(inspect.Config.Labels?.["io.codexsun.fixture"], "data-bridge");
  assert.ok(inspect.HostConfig.Tmpfs?.["/var/lib/mysql"], "Fixture database must use tmpfs.");
  assert.equal(inspect.Mounts.length, 0, "Fixture must not mount persistent data.");
  const binding = inspect.NetworkSettings.Ports["3306/tcp"];
  assert.ok(
    binding?.some(
      (item: { HostIp: string; HostPort: string }) =>
        item.HostIp === "127.0.0.1" && Number(item.HostPort) === port
    )
  );
  const suffix = randomBytes(6).toString("hex");
  const sourceName = `bridge_src_${suffix}`;
  const targetName = `bridge_dst_${suffix}`;
  const username = `br_${suffix}`;
  const userPassword = randomBytes(20).toString("hex");
  const config = { host: "127.0.0.1", port, user: "root", password };
  const admin = await createConnection(config);
  try {
    await admin.query(`CREATE DATABASE \`${sourceName}\``);
    await admin.query(`CREATE DATABASE \`${targetName}\``);
    await admin.query(`CREATE USER '${username}'@'%' IDENTIFIED BY '${userPassword}'`);
    await admin.query(`GRANT SELECT ON \`${sourceName}\`.* TO '${username}'@'%'`);
    await admin.query(
      `CREATE TABLE \`${sourceName}\`.items (id INT PRIMARY KEY, name VARCHAR(30)) ENGINE=InnoDB`
    );
    await admin.query(`INSERT INTO \`${sourceName}\`.items VALUES (1, 'fixture')`);
    await admin.query(
      `CREATE TABLE \`${targetName}\`.items (id INT PRIMARY KEY, name VARCHAR(30)) ENGINE=InnoDB`
    );
    const source = {
      ...config,
      user: username,
      password: userPassword,
      database: sourceName,
      id: 1,
      label: "Fixture source",
      tlsMode: "disabled" as const
    };
    const target = { ...config, database: targetName, id: 1, label: "Fixture target" };
    await withConnections(source, target, async (from, to) => {
      const [rows] = await from.query("SELECT * FROM items");
      await assert.rejects(from.query("INSERT INTO items VALUES (2, 'forbidden')"));
      await to.query("INSERT INTO items VALUES (1, 'fixture')");
      assert.equal((rows as unknown[]).length, 1);
    });
    await assert.rejects(
      withConnections({ ...source, user: "root", password }, target, async () => {}),
      /read-only grants/
    );
    await assert.rejects(
      withConnections(
        source,
        { ...target, host: "localhost", database: sourceName },
        async () => {}
      ),
      /different databases/
    );
    const [[sourceCount]] = await admin.query<any[]>(
      `SELECT COUNT(*) AS count FROM \`${sourceName}\`.items`
    );
    const [[targetCount]] = await admin.query<any[]>(
      `SELECT COUNT(*) AS count FROM \`${targetName}\`.items`
    );
    assert.equal(sourceCount.count, 1);
    assert.equal(targetCount.count, 1);
  } finally {
    await admin.query(`DROP USER IF EXISTS '${username}'@'%'`);
    await admin.query(`DROP DATABASE IF EXISTS \`${sourceName}\``);
    await admin.query(`DROP DATABASE IF EXISTS \`${targetName}\``);
    await admin.end();
  }
});
