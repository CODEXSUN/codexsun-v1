import assert from "node:assert/strict";
import test from "node:test";
import { reuseQueueDelivery } from "./queue-manager.delivery.js";

test("a terminal delivery does not suppress an explicitly retried pending SQL job", async () => {
  for (const state of ["completed", "failed"]) {
    let removed = false;
    assert.equal(
      await reuseQueueDelivery(
        {
          getState: async () => state,
          remove: async () => {
            removed = true;
          },
          promote: async () => {
            throw new Error("Terminal delivery cannot be promoted");
          }
        },
        new Date().toISOString()
      ),
      false
    );
    assert.equal(removed, true);
  }
});

test("a live delivery is preserved and an elapsed delayed delivery is promoted", async () => {
  for (const state of ["active", "waiting", "delayed"]) {
    let promoted = false;
    assert.equal(
      await reuseQueueDelivery(
        {
          getState: async () => state,
          remove: async () => {
            throw new Error("Live delivery cannot be removed");
          },
          promote: async () => {
            promoted = true;
          }
        },
        new Date().toISOString()
      ),
      true
    );
    assert.equal(promoted, state === "delayed");
  }
  assert.equal(await reuseQueueDelivery(undefined, new Date().toISOString()), false);
});

test("a future delivery keeps its scheduled wait", async () => {
  assert.equal(
    await reuseQueueDelivery(
      {
        getState: async () => "delayed",
        remove: async () => {
          throw new Error("Future delivery removed");
        },
        promote: async () => {
          throw new Error("Future delivery promoted");
        }
      },
      "2099-01-01T00:00:00.000Z"
    ),
    true
  );
});
