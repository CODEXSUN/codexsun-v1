import assert from "node:assert/strict";
import test from "node:test";
import { queueRedisConnection } from "./queue-manager.redis.js";

test("Redis producers have bounded commands while consumers retain reconnect support", () => {
  const producer = queueRedisConnection("redis://localhost/2");
  const consumer = queueRedisConnection("redis://localhost/2", true);
  assert.equal(producer.commandTimeout, 3000);
  assert.equal(producer.maxRetriesPerRequest, 1);
  assert.equal(producer.retryStrategy?.(2), null);
  assert.equal(consumer.commandTimeout, undefined);
  assert.equal(consumer.maxRetriesPerRequest, null);
});

test("Redis connections preserve TLS, IPv6, credentials, and database identity", () => {
  const connection = queueRedisConnection("rediss://user:p%40ss@[::1]:6380/3");
  assert.deepEqual(connection.tls, {});
  assert.equal(connection.host, "::1");
  assert.equal(connection.password, "p@ss");
  assert.equal(connection.username, "user");
  assert.equal(connection.port, 6380);
  assert.equal(connection.db, 3);
  assert.equal(queueRedisConnection("redis://localhost").tls, undefined);
  for (const address of ["https://localhost", "redis://localhost/-1", "redis://localhost/1.5"])
    assert.throws(() => queueRedisConnection(address));
});
