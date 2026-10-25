import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const directory = "dist/local-cloud";
const manifest = JSON.parse(readFileSync(`${directory}/manifest.json`, "utf8"));
for (const [name, expected] of Object.entries(manifest.containers)) {
  const container = JSON.parse(execFileSync("docker", ["inspect", name], { encoding: "utf8" }))[0];
  assert.equal(container.Image, expected.imageId, `${name} image differs from live`);
  assert.equal(container.State.Health.Status, "healthy", `${name} is unhealthy`);
}
for (const url of [
  "http://127.0.0.1:18010/ready",
  "http://127.0.0.1:18020/health",
  "http://127.0.0.1:18030/health",
  "http://127.0.0.1:18020/api/app/public/runtime-config",
  "http://127.0.0.1:18030/api/platform/storefront/bootstrap"
]) {
  const response = await fetch(url, { signal: AbortSignal.timeout(10000) });
  assert.equal(response.status, 200, `${new URL(url).pathname} failed`);
  if (response.headers.get("content-type")?.includes("application/json")) {
    assert.notEqual(
      (await response.json()).success,
      false,
      `${new URL(url).pathname} returned an API error`
    );
  }
}
const environment = JSON.parse(readFileSync(`${directory}/runtime.private.json`, "utf8"))[
  "codexsun-api"
];
const counts = execFileSync(
  "docker",
  [
    "exec",
    "-e",
    "MYSQL_PWD",
    "cxapp-mariadb",
    "mariadb",
    "--no-defaults",
    "-uroot",
    "-N",
    "-e",
    "SELECT TABLE_SCHEMA,COUNT(*) FROM information_schema.tables GROUP BY TABLE_SCHEMA"
  ],
  {
    encoding: "utf8",
    env: { ...process.env, MYSQL_PWD: environment.DB_PASSWORD }
  }
);
const restoredCounts = Object.fromEntries(
  counts
    .trim()
    .split(/\r?\n/)
    .map((line) => line.split("\t"))
);
for (const [name, count] of Object.entries(manifest.tableCounts)) {
  assert.equal(Number(restoredCounts[name]), count, `Restored table count differs: ${name}`);
}
const response = await fetch("http://127.0.0.1:18020/api/app/auth/login", {
  method: "POST",
  headers: { "content-type": "application/json", origin: "http://127.0.0.1:18020" },
  body: JSON.stringify({
    desk: "tenant",
    corporateId: environment.DEFAULT_TENANT_CORPORATE_ID,
    email: environment.DEFAULT_TENANT_ADMIN_EMAIL,
    password: environment.DEFAULT_TENANT_ADMIN_PASSWORD
  })
});
assert.equal(response.status, 200, "Restored default tenant login failed");
const result = await response.json();
const slot = result.data.sessionSlot;
assert.ok(slot, "Login must return a session slot");
const cookie = response.headers
  .getSetCookie()
  .map((value) => value.split(";")[0])
  .join("; ");
const session = await fetch("http://127.0.0.1:18020/api/app/auth/session", {
  headers: { cookie, "x-codexsun-session-slot": slot }
});
assert.equal(session.status, 200, "Restored session failed");
const refreshed = await fetch("http://127.0.0.1:18020/api/app/auth/session", {
  headers: { cookie, "x-codexsun-session-slot": slot }
});
assert.equal(refreshed.status, 200, "Session did not survive a second request");
const logout = await fetch("http://127.0.0.1:18020/api/app/auth/logout", {
  method: "POST",
  headers: { cookie, origin: "http://127.0.0.1:18020", "x-codexsun-session-slot": slot }
});
assert.equal(logout.status, 200, "Test session logout failed");
console.log(
  "Verified 5 exact live images, 8 database table counts, container health, API readiness, Web/Shop proxies, login, and repeated session requests."
);
