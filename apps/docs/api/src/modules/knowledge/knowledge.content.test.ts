import assert from "node:assert/strict";
import test from "node:test";
import {
  knowledgeSources,
  readKnowledgeSource,
  searchDeveloperReference
} from "./knowledge.content.js";
test("repository catalog covers active app groups with readable SHA-checked sources", async () => {
  const sources = await knowledgeSources();
  assert.ok(sources.length >= 225);
  assert.equal(new Set(sources.map((s) => s.pageKey)).size, sources.length);
  for (const app of [
    "platform",
    "core",
    "billing",
    "accounts",
    "crm",
    "frappe",
    "ecommerce",
    "logicx-erp",
    "mail",
    "auditor",
    "zetro",
    "zuno",
    "uiux",
    "qcafe",
    "hrms",
    "himsx",
    "docs",
    "blog"
  ])
    assert.ok(sources.some((s) => s.appKey === app && s.pageKey === `${app}/overview`));
  for (const source of sources) assert.ok((await readKnowledgeSource(source)).startsWith("# "));
});
test("assistant reference is bounded and cites repository source identity", async () => {
  const refs = await searchDeveloperReference("billing");
  assert.ok(refs.length > 0 && refs.length <= 5);
  for (const ref of refs) {
    assert.equal(ref.origin, "repository");
    assert.ok(ref.sourcePath.startsWith("applications/billing/"));
    assert.match(ref.sourcePath, /^applications\//);
    assert.match(ref.sourceHash, /^[a-f0-9]{64}$/);
    assert.ok(ref.excerpt.length <= 5000);
    assert.ok(ref.url.startsWith("/app/docs/library?page="));
  }
  assert.deepEqual(await searchDeveloperReference("x"), []);
});
