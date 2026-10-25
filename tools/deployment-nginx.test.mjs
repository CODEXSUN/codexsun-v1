import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { read } from "./deployment-test-fixture.mjs";
import { LocalDocker } from "../.container/codexsun-v1/local/docker.mjs";

const container = process.env.CODEXSUN_NGINX_TEST_CONTAINER;
if (container) new LocalDocker().checkTarget();
for (const file of ["nginx-web.conf", "nginx-shop.conf"]) {
  for (const enabled of ["0", "1"]) {
    test(`${file} parses with realtime ${enabled}`, { skip: !container }, () => {
      assert.equal(
        container,
        "codexsun-web",
        "Use the local Web container for configuration-only validation."
      );
      const template = read(`.container/codexsun-v1/${file}`)
        .replaceAll("${PLATFORM_API_PORT}", "17010")
        .replaceAll("${CODEXSUN_CHATB_PORT}", "17031")
        .replaceAll("${CODEXSUN_REALTIME_ENABLED}", enabled);
      const path = `/tmp/codexsun-nginx-test-${randomUUID()}.conf`;
      // Validate an isolated temporary file; never reload or replace live configuration.
      const script = `trap 'rm -f ${path}' EXIT; cat > ${path}; nginx -t -c ${path}`;
      const result = spawnSync(
        "docker",
        ["--context", "desktop-linux", "exec", "-i", container, "sh", "-ec", script],
        {
          input: `error_log stderr; events {} http { ${template} }`,
          encoding: "utf8",
          timeout: 15000
        }
      );
      assert.equal(result.status, 0, result.stderr);
      assert.match(result.stderr, /test is successful/u);
    });
  }
}
