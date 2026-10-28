import assert from "node:assert/strict";
import { setTimeout as wait } from "node:timers/promises";

export async function fetchReady(url, options = {}) {
  const request = options.request ?? fetch;
  const pause = options.pause ?? wait;
  const attempts = options.attempts ?? 15;
  let lastError;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const response = await request(url, { signal: AbortSignal.timeout(5000) });
      if (response.status === 200 || options.acceptStatuses?.includes(response.status)) return response;
      if (![502, 503, 504].includes(response.status)) {
        assert.fail(`Local endpoint failed: ${new URL(url).pathname} (HTTP ${response.status})`);
      }
      lastError = `HTTP ${response.status}`;
    } catch (error) {
      if (error instanceof assert.AssertionError) throw error;
      lastError = error instanceof Error ? error.message : String(error);
    }
    if (attempt + 1 < attempts) await pause(2000);
  }
  throw new Error(`Local endpoint failed: ${new URL(url).pathname} (${lastError})`);
}
