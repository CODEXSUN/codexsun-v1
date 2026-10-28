import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { validateProxyTemplates } from "./config.mjs";

test("rejects stale mounted proxy templates before deployment", () => {
  const root = mkdtempSync(join(tmpdir(), "codexsun-proxy-"));
  try {
    mkdirSync(join(root, ".container/codexsun-v1"), { recursive: true });
    const mounted = join(root, "shop.conf");
    writeFileSync(join(root, ".container/codexsun-v1/nginx-shop.conf"), "current\n");
    writeFileSync(mounted, "old\n");
    const model = { services: {
      "codexsun-web": { volumes: [] },
      "codexsun-shop": { volumes: [{ type: "bind", source: mounted, target: "/etc/nginx/templates/default.conf.template" }] }
    } };
    assert.throws(() => validateProxyTemplates(model, root), /proxy template differs/);
    writeFileSync(mounted, "current\r\n");
    assert.doesNotThrow(() => validateProxyTemplates(model, root));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
