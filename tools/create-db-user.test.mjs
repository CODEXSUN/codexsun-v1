import assert from "node:assert/strict";
import test from "node:test";
import { buildUserSql, runUserSetup } from "./create-db-user.mjs";

const settings = {
  client: "mariadb",
  adminUser: "admin",
  adminPassword: "admin-secret",
  host: "localhost",
  port: "3306",
  appUser: "user'example",
  appPassword: "pa'ss\\word",
  masterDb: "master`db",
  tenantDb: "tenant_db"
};

test("escapes SQL settings and passes them to the client through stdin", () => {
  let call;
  runUserSetup(settings, (...args) => { call = args; });
  const [client, args, options] = call;
  assert.equal(client, "mariadb");
  assert.ok(args.includes("--binary-mode"));
  assert.ok(!args.join(" ").includes(settings.appPassword));
  assert.ok(!args.join(" ").includes(settings.adminPassword));
  assert.equal(options.env.MYSQL_PWD, settings.adminPassword);
  assert.match(options.input, /NO_BACKSLASH_ESCAPES/);
  assert.ok(options.input.includes("'user''example'@'localhost'"));
  assert.ok(options.input.includes("IDENTIFIED BY 'pa''ss\\word'"));
  assert.ok(options.input.includes("`master``db`.*"));
  assert.equal((options.input.match(/CREATE USER IF NOT EXISTS/g) ?? []).length, 2);
  assert.equal((options.input.match(/GRANT ALL PRIVILEGES/g) ?? []).length, 4);
});

test("rejects NUL bytes and propagates client failures", () => {
  assert.throws(() => buildUserSql({ ...settings, appPassword: "bad\0password" }), /NUL/);
  assert.throws(() => runUserSetup(settings, () => { throw new Error("client failed"); }), /client failed/);
});
