import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import {
  config,
  fixture,
  environmentFixture,
  owner,
  read,
  shellPath,
  fakeCommands,
  runShell,
  python
} from "./deployment-test-fixture.mjs";

function mount(name, destination) {
  return {
    Type: "volume",
    RW: true,
    Name: name,
    Source: `/data/${name}`,
    Destination: destination
  };
}

test("Media adoption requires an exact opt-in and rejects missing, duplicate or foreign mounts", () => {
  const storage = mount("codexsun-data", "/storage");
  const media = mount("codexsun-media-data", "/storage/media");
  const check = (mounts, selected = "") =>
    config(["adoption", "codexsun-data", selected], JSON.stringify([{ Mounts: mounts }])).status;
  assert.equal(check([storage]), 0);
  assert.notEqual(check([storage, media]), 0);
  assert.equal(check([media, storage], media.Name), 0);
  for (const mounts of [
    [storage],
    [storage, media, media],
    [storage, { ...media, Type: "bind" }],
    [storage, { ...media, RW: false }],
    [storage, { ...media, Destination: "/var/lib/mysql" }]
  ]) {
    assert.notEqual(check(mounts, media.Name), 0);
  }
});

test("Media cannot alias database, Redis or application volumes", () => {
  const directory = fixture();
  const env = environmentFixture(directory);
  const original = readFileSync(env, "utf8");
  for (const volume of [
    "codexsun-data",
    "codexsun-mariadb-data",
    "codexsun-mariadb-backups",
    "codexsun-redis-data",
    "../escape"
  ]) {
    writeFileSync(
      env,
      original.replace("CODEXSUN_MEDIA_DATA_VOLUME=", `CODEXSUN_MEDIA_DATA_VOLUME=${volume}`)
    );
    assert.notEqual(config(["validate", env]).status, 0, volume);
  }
  writeFileSync(
    env,
    original.replace("CODEXSUN_MEDIA_DATA_VOLUME=", "CODEXSUN_MEDIA_DATA_VOLUME=reviewed-media")
  );
  assert.equal(config(["validate", env]).status, 0);
});

test("proxy preserves existing API upgrades and adds opt-in Chatb without exposing Worker", () => {
  for (const file of ["nginx-web.conf", "nginx-shop.conf"]) {
    const source = read(`.container/codexsun-v1/${file}`);
    assert.match(source, /map \$http_upgrade \$codexsun_connection_upgrade/u);
    for (const location of source
      .split(/location /u)
      .filter((value) => value.includes("proxy_pass"))) {
      assert.match(location, /proxy_set_header Upgrade \$http_upgrade/u);
      assert.match(location, /proxy_set_header Connection \$codexsun_connection_upgrade/u);
    }
    assert.match(source, /location = \/api\/chatb\/realtime/u);
    assert.match(source, /if \(\$realtime_enabled = 0\) \{ return 503; \}/u);
    assert.match(source, /proxy_pass http:\/\/\$chatb_upstream\/chatb\/realtime\$is_args\$args/u);
    assert.doesNotMatch(source, /codexsun-worker/u);
  }
});

test("graceful-stop client deadline fails before removal and only requests native infinite stop", () => {
  const directory = fixture();
  const env = fakeCommands(directory, "echo SIGTERM");
  const result = runShell(
    directory,
    `source '${shellPath(join(owner, "lib/common.sh"))}'\nsource '${shellPath(join(owner, "lib/quiesce.sh"))}'\ntimeout() { printf '%s\\n' "$*" >>"$CODEXSUN_TEST_LOG"; return 124; }\ngraceful_stop codexsun-api\ndocker rm codexsun-api`,
    env
  );
  assert.notEqual(result.status, 0);
  const calls = readFileSync(join(directory, "commands.log"), "utf8");
  assert.match(calls, /--signal=TERM 90 docker stop --timeout -1 codexsun-api/u);
  assert.doesNotMatch(calls, /SIGKILL|^rm /mu);
});

test("actual database mounts cannot be adopted as Media under another volume name", () => {
  const directory = fixture();
  const env = environmentFixture(directory);
  writeFileSync(
    env,
    readFileSync(env, "utf8").replace(
      "CODEXSUN_MEDIA_DATA_VOLUME=",
      "CODEXSUN_MEDIA_DATA_VOLUME=unexpected-database-volume"
    )
  );
  const result = spawnSync(python, ["-B", join(owner, "lib/safety.py"), env, "update"], {
    encoding: "utf8",
    input: JSON.stringify([
      {
        Name: "/shared-db",
        Config: { Image: "mariadb:11" },
        Mounts: [mount("unexpected-database-volume", "/var/lib/mysql")]
      }
    ])
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /database server.*protected/u);
});
