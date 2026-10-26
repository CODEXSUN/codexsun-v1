import assert from "node:assert/strict";
import { test } from "node:test";
import { EnquiryContactLookup } from "./enquiry.contact-lookup.js";

test("coalesces concurrent contact reads without crossing tenant databases", async () => {
  const lookup = new EnquiryContactLookup();
  let loads = 0;
  const first = Array.from({ length: 20 }, () =>
    lookup.find("tenant-one", 1, async () => {
      loads++;
      return { name: "First tenant" };
    })
  );
  const second = lookup.find("tenant-two", 1, async () => ({ name: "Second tenant" }));
  assert.ok((await Promise.all(first)).every((contact) => contact?.name === "First tenant"));
  assert.equal((await second)?.name, "Second tenant");
  assert.equal(loads, 1);
  assert.equal(
    (await lookup.find("tenant-one", 1, async () => ({ name: "Updated contact" })))?.name,
    "Updated contact"
  );
});

test("limits each tenant to four contact reads and retries failed reads", async () => {
  const lookup = new EnquiryContactLookup();
  let active = 0;
  let peak = 0;
  const pending = Array.from({ length: 30 }, (_, index) =>
    lookup.find("tenant-one", index + 1, async () => {
      active++;
      peak = Math.max(peak, active);
      await Promise.resolve();
      active--;
      return { name: `Contact ${index + 1}` };
    })
  );
  const contacts = await Promise.all(pending);
  assert.equal(peak, 4);
  assert.equal(contacts.length, 30);
  await assert.rejects(lookup.find("tenant-one", 100, async () => Promise.reject(new Error("DB"))));
  assert.equal(
    (await lookup.find("tenant-one", 100, async () => ({ name: "Recovered" })))?.name,
    "Recovered"
  );
});
