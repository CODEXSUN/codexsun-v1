import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { test } from "node:test";

const bash = process.platform === "win32" ? "C:/Program Files/Git/bin/bash.exe" : "bash";
const directory = resolve(".container/codexsun-v1").replaceAll("\\", "/");

test("VPS rejects no-backup updates before changing anything", () => {
  const result = spawnSync(bash, [`${directory}/update.sh`, "--nobackup"], { encoding: "utf8" });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /unavailable for VPS updates/);
});

function exitHandler(changesPossible, replacementStarted) {
  const script = `
DEPLOY_DIR="$1"
. "$DEPLOY_DIR/lib/release.sh"
SERVICES=(codexsun-api)
BACKUP_DIR=/tmp/fixture
CODEXSUN_VERSION=fixture
CODEXSUN_REVISION=fixture
QUIESCED=true
DATABASE_CHANGES_POSSIBLE="$2"
REPLACEMENT_STARTED="$3"
container_exists() { return 0; }
docker() { echo true; }
graceful_stop() { echo STOPPED; }
restore_quiesced() { echo RESUMED; }
rollback_release() { echo ROLLED_BACK; }
python3() { :; }
trap on_release_exit EXIT
exit 4
`;
  return spawnSync(
    bash,
    ["-c", script, "fixture", directory, String(changesPossible), String(replacementStarted)],
    { encoding: "utf8" }
  );
}

test("migration or post-migration failure stops writers without restoring old apps", () => {
  for (const replaced of [false, true]) {
    const result = exitHandler(true, replaced);
    assert.equal(result.status, 4);
    assert.match(result.stdout, /STOPPED/);
    assert.doesNotMatch(result.stdout, /RESUMED|ROLLED_BACK/);
    assert.match(result.stderr, /database-review-required/);
  }
});

test("a failure before migration resumes the previous runtime", () => {
  const result = exitHandler(false, false);
  assert.equal(result.status, 4);
  assert.match(result.stdout, /RESUMED/);
  assert.doesNotMatch(result.stdout, /STOPPED|ROLLED_BACK/);
});
