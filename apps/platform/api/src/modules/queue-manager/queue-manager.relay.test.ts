import assert from "node:assert/strict";
import test from "node:test";
import { startQueueRelay } from "./queue-manager.relay.js";

test("relay stop prevents new passes and drains the active pass", async () => {
  let finish!: () => void;
  const active = new Promise<void>((resolve) => {
    finish = resolve;
  });
  let started!: () => void;
  const dispatched = new Promise<void>((resolve) => {
    started = resolve;
  });
  let calls = 0;
  const stop = startQueueRelay(
    async () => {
      calls++;
      started();
      await active;
    },
    1,
    () => true
  );
  try {
    await dispatched;
    let stopped = false;
    const stopping = stop().then(() => {
      stopped = true;
    });
    await new Promise((resolve) => setTimeout(resolve, 10));
    assert.equal(stopped, false);
    assert.equal(calls, 1);
    finish();
    await stopping;
    await new Promise((resolve) => setTimeout(resolve, 10));
    assert.equal(stopped, true);
    assert.equal(calls, 1);
  } finally {
    finish();
    await stop();
  }
});

test("relay does not dispatch in a producer-only process", async () => {
  let calls = 0;
  const stop = startQueueRelay(
    async () => {
      calls++;
    },
    1,
    () => false
  );
  await new Promise((resolve) => setTimeout(resolve, 10));
  await stop();
  assert.equal(calls, 0);
});

test("relay stopped before its first pass does not start work", async () => {
  let calls = 0;
  const stop = startQueueRelay(
    async () => {
      calls++;
    },
    1,
    () => true
  );
  await stop();
  assert.equal(calls, 0);
});
