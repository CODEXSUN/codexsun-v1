import assert from "node:assert/strict";

export function parseLocalOptions(mode, values) {
  assert.ok(["deploy", "update"].includes(mode), "Choose deploy or update.");
  const allowed = new Set(["--check", "--configure", "--help", "-h", "--plan", "--nobackup"]);
  assert.ok(
    values.every((value) => allowed.has(value)),
    "Unknown local update option."
  );
  assert.equal(new Set(values).size, values.length, "Do not repeat local update options.");
  const options = {
    check: values.includes("--check"),
    configure: values.includes("--configure"),
    help: values.includes("--help") || values.includes("-h"),
    plan: values.includes("--plan"),
    noBackup: values.includes("--nobackup")
  };
  assert.ok(!(values.includes("--help") && values.includes("-h")), "Use one help option.");
  assert.ok(!options.help || values.length === 1, "Use help on its own.");
  assert.ok(!options.configure || values.length === 1, "Use --configure on its own.");
  assert.ok(!options.plan || mode === "update", "--plan is available only for local updates.");
  assert.ok(
    !options.noBackup || mode === "update",
    "--nobackup is available only for local updates."
  );
  assert.ok(
    !options.noBackup || (!options.configure && !options.help && !options.plan),
    "Use --nobackup only for an update or its check."
  );
  assert.ok(
    !options.plan || (!options.check && !options.configure),
    "Use --plan without --check or --configure."
  );
  return options;
}
