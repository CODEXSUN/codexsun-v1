import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, sep } from "node:path";
import test from "node:test";
import { repositoryTempDirectory } from "./repository-temp.mjs";
import { RepositoryDocumentation } from "./sync-repository-docs.mjs";

test("repository references preserve MDX as text, exclude output, and detect drift", () => {
  const temporary = repositoryTempDirectory();
  const root = mkdtempSync(join(temporary, "repository-docs-"));
  assert.ok(root.startsWith(temporary + sep));
  try {
    mkdirSync(join(root, "apps/docs/content"), { recursive: true });
    writeFileSync(
      join(root, "apps/docs/content/catalog.json"),
      JSON.stringify({ formatVersion: 1, pages: [] })
    );
    writeFileSync(join(root, "README.mdx"), "# Example\n\n<Component />\n```js\nrun()\n```\n");
    mkdirSync(join(root, "dist"));
    writeFileSync(join(root, "dist/ignored.md"), "# Output");
    mkdirSync(join(root, ".container"));
    writeFileSync(join(root, ".container/README.md"), "# Container guide");
    mkdirSync(join(root, ".codex-runtime"));
    writeFileSync(join(root, ".codex-runtime/local-report.md"), "# Local acceptance evidence");
    const audit = new RepositoryDocumentation(root);
    assert.equal(audit.synchronize().count, 1);
    assert.deepEqual(audit.synchronize(true).failures, []);
    const catalog = JSON.parse(readFileSync(join(root, "apps/docs/content/catalog.json"), "utf8"));
    assert.ok(!catalog.pages.some((page) => page.title.startsWith(".container/")));
    assert.ok(!catalog.pages.some((page) => page.title.startsWith(".codex-runtime/")));
    const mdx = catalog.pages.find((page) => page.title === "README.mdx");
    const body = readFileSync(join(root, "apps/docs/content", mdx.sourcePath), "utf8");
    assert.match(body, /````mdx\n# Example/u);
    assert.match(body, /<Component \/>/u);
    const original = readFileSync(join(root, "README.mdx"), "utf8");
    writeFileSync(join(root, "README.mdx"), original.replaceAll("\n", "\r\n"));
    assert.deepEqual(audit.synchronize(true).failures, []);
    writeFileSync(join(root, "README.mdx"), "# Changed\n");
    assert.ok(audit.synchronize(true).failures.includes("README.mdx"));
    audit.synchronize();
    assert.deepEqual(audit.synchronize(true).failures, []);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
