import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join, sep } from "node:path";
import test from "node:test";
import { ComponentDocumentationAudit } from "./check-component-docs.mjs";
import { repositoryTempDirectory } from "./repository-temp.mjs";

test("components require a README with a heading", () => {
  const root = mkdtempSync(join(repositoryTempDirectory(), "component-docs-"));
  try {
    const owner = join(root, "apps", "example");
    mkdirSync(owner, { recursive: true });
    writeFileSync(join(owner, "README.md"), "# Example\n");
    assert.deepEqual(new ComponentDocumentationAudit(root).run().failures, []);
    renameSync(join(owner, "README.md"), join(owner, "readme.md"));
    assert.match(new ComponentDocumentationAudit(root).run().failures.join("\n"), /README.md/u);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("external CODEXSUN add-ons require local integration guides", () => {
  const root = mkdtempSync(join(repositoryTempDirectory(), "addon-docs-"));
  assert.ok(root.startsWith(repositoryTempDirectory() + sep));
  try {
    writeFileSync(
      join(root, "package-lock.json"),
      JSON.stringify({
        packages: {
          "node_modules/@codexsun/blog": { version: "1.0.16" },
          "node_modules/@codexsun/framework": { link: true }
        }
      })
    );
    const result = new ComponentDocumentationAudit(root).run();
    assert.equal(result.owners, 1);
    assert.equal(result.failures.length, 1);
    assert.ok(result.failures.every((failure) => failure.startsWith("addons/blog/")));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
