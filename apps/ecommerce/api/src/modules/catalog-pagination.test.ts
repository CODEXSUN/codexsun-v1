import assert from "node:assert/strict";
import test from "node:test";
import { resolveCatalogPageWindow } from "./catalog-pagination.js";

test("totals through one hundred return one complete page", () => {
  for (const total of [0, 20, 99, 100]) {
    assert.deepEqual(resolveCatalogPageWindow(total, 7, 20), { page: 1, pageSize: 100 });
  }
});

test("totals above one hundred honor a supported page size", () => {
  assert.deepEqual(resolveCatalogPageWindow(101, 2, 20), { page: 2, pageSize: 20 });
  assert.deepEqual(resolveCatalogPageWindow(250, 5, 50), { page: 5, pageSize: 50 });
});

test("out-of-range pages clamp to the last page", () => {
  assert.deepEqual(resolveCatalogPageWindow(101, 99, 100), { page: 2, pageSize: 100 });
  assert.deepEqual(resolveCatalogPageWindow(250, 0, 20), { page: 1, pageSize: 20 });
});

test("unsupported page sizes fall back to one hundred", () => {
  assert.deepEqual(resolveCatalogPageWindow(250, 1, 500), { page: 1, pageSize: 100 });
  assert.deepEqual(resolveCatalogPageWindow(250, 1, 33), { page: 1, pageSize: 100 });
});
