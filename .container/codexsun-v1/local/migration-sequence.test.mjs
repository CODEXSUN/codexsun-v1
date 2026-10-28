import assert from "node:assert/strict";
import test from "node:test";
import { prepareDatabase, withMigrationRecovery } from "./migration-sequence.mjs";

for (const failure of ["backup", "preflight", "migrate"]) {
  test(`${failure} failure uses the correct recovery without advancing the sequence`, async () => {
    const calls = [];
    const steps = Object.fromEntries(
      ["guard", "backup", "preflight", "verify", "migrate", "seed"].map((name) => [
        name,
        async () => {
          calls.push(name);
          if (name === failure) throw new Error(`${name} failed`);
        }
      ])
    );
    await assert.rejects(
      withMigrationRecovery(
        (mark) => prepareDatabase(steps, mark),
        async () => calls.push("restart-old-apps"),
        async () => calls.push("hold-apps-for-review")
      ),
      new RegExp(`${failure} failed`, "u")
    );
    assert.ok(!calls.includes("seed"));
    assert.equal(calls.includes("migrate"), failure === "migrate");
    assert.equal(calls.includes("restart-old-apps"), failure !== "migrate");
    assert.equal(calls.includes("hold-apps-for-review"), failure === "migrate");
  });
}

for (const failure of ["preliminaryBackup", "startupProof", "backup"]) {
  test(`${failure} failure uses recovery based on whether startup proof can change data`, async () => {
    const calls = [];
    const steps = Object.fromEntries(
      [
        "guard",
        "preliminaryBackup",
        "startupProof",
        "backup",
        "preflight",
        "verify",
        "migrate",
        "seed"
      ].map((name) => [
        name,
        async () => {
          calls.push(name);
          if (name === failure) throw new Error(`${name} failed`);
        }
      ])
    );
    await assert.rejects(
      withMigrationRecovery(
        (mark) => prepareDatabase(steps, mark),
        async () => calls.push("restart-old-apps"),
        async () => calls.push("hold-apps-for-review")
      ),
      new RegExp(`${failure} failed`, "u")
    );
    assert.equal(calls.includes("restart-old-apps"), failure === "preliminaryBackup");
    assert.equal(calls.includes("hold-apps-for-review"), failure !== "preliminaryBackup");
    assert.ok(!calls.includes("preflight"));
  });
}

test("master proof runs between preliminary and final backups before production migration", async () => {
  const calls = [];
  const steps = Object.fromEntries(
    [
      "guard",
      "preliminaryBackup",
      "startupProof",
      "backup",
      "preflight",
      "verify",
      "migrate",
      "seed"
    ].map((name) => [name, async () => calls.push(name)])
  );
  await prepareDatabase(steps, () => calls.push("changes-possible"));
  assert.deepEqual(calls, [
    "guard",
    "preliminaryBackup",
    "guard",
    "changes-possible",
    "startupProof",
    "guard",
    "backup",
    "guard",
    "preflight",
    "verify",
    "guard",
    "changes-possible",
    "migrate",
    "guard",
    "seed",
    "guard"
  ]);
});
