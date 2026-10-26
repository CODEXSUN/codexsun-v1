import assert from "node:assert/strict";
import { test } from "node:test";
import { ciSitesPublication, writeCiSitesPublication } from "./ci-sites-publication-fixture.js";

test("CI publication is valid, synthetic, and restricted to explicit CI generation", () => {
  const snapshot = ciSitesPublication();
  assert.equal(snapshot.siteSlug, "tirupurconnect");
  assert.equal(snapshot.content.profile.domain, "tirupurconnect.com");
  assert.ok(snapshot.content.textile);
  assert.match(snapshot.content.profile.brand, /CI verification fixture/u);
  assert.throws(() => writeCiSitesPublication({}), /restricted to explicit CI/u);
});
