import assert from "node:assert/strict";
import test from "node:test";
import { ChatTelegramWorker } from "./chat.telegram.worker.js";
import type { TelegramDependencies, TelegramScope } from "./chat.telegram.types.js";

test("Telegram scheduler shutdown waits for its active pass and prevents later dispatch", async (context) => {
  context.mock.timers.enable({ apis: ["setInterval"] });
  let releaseScopes: (value: TelegramScope[]) => void = () => {};
  let calls = 0;
  let processors = 0;
  const dependencies: TelegramDependencies = {
    secretKey: "codexsun-test-only",
    scopes: () => {
      calls += 1;
      return new Promise((resolve) => {
        releaseScopes = resolve;
      });
    },
    authorize: async () => {},
    enqueue: async () => {
      throw new Error("Stopped scheduler must not enqueue.");
    },
    registerProcessor: () => {
      processors += 1;
    }
  };
  const stop = new ChatTelegramWorker(dependencies, async () => {}).start();
  context.mock.timers.tick(5_000);
  assert.equal(calls, 1);
  assert.equal(processors, 1);
  let stopped = false;
  const pending = stop().then(() => {
    stopped = true;
  });
  await Promise.resolve();
  assert.equal(stopped, false);
  releaseScopes([]);
  await pending;
  assert.equal(stopped, true);
  context.mock.timers.tick(15_000);
  assert.equal(calls, 1);
});
