import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { resolveEnquiryMobile } from "./enquiry-mobile.js";

const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
});
const settings = {
  baseUrl: "https://frappe.example/",
  apiKey: "key",
  apiSecret: "secret",
  enabled: true
};
const number = "9994885548";

for (const existsInitially of [true, false])
  test(`mobile-only export preserves the number identity without choosing a Customer (${existsInitially})`, async () => {
    let exists = existsInitially;
    let writes = 0;
    globalThis.fetch = async (input, init) => {
      assert.equal(
        decodeURIComponent(new URL(String(input)).pathname),
        "/api/resource/Mobile Contact"
      );
      if (init?.method === "POST") {
        writes++;
        exists = true;
        throw new Error("Lost Mobile Contact response after commit");
      }
      return Response.json({ data: exists ? [{ name: number, mobile_number: number }] : [] });
    };
    for (let pass = 0; pass < 2; pass++)
      assert.deepEqual(await resolveEnquiryMobile(settings, number, null, { mobileOnly: true }), {
        mobile: number
      });
    assert.equal(writes, existsInitially ? 0 : 1);
  });

for (const scenario of ["existing", "create", "timeout", "race"])
  test(`enquiry mobile resolves exact association after ${scenario}`, async () => {
    let exists = scenario === "existing";
    let writes = 0;
    globalThis.fetch = async (input, init) => {
      const url = new URL(String(input));
      if (decodeURIComponent(url.pathname).endsWith("/Mobile Contact Customer")) {
        assert.deepEqual(JSON.parse(url.searchParams.get("filters")!), [
          ["mobile_contact", "=", number],
          ["customer", "=", "C123"]
        ]);
        return Response.json({
          data: [{ name: `${number} - C123`, mobile_contact: number, customer: "C123" }]
        });
      }
      assert.equal(decodeURIComponent(url.pathname), "/api/resource/Mobile Contact");
      if (init?.method === "POST") {
        writes++;
        assert.deepEqual(JSON.parse(String(init.body)), { mobile_number: number });
        exists = true;
        if (scenario === "timeout") throw new Error("Response lost after commit");
        if (scenario === "race") return Response.json({}, { status: 409 });
        return Response.json({ data: { name: number } });
      }
      return Response.json({ data: exists ? [{ name: number, mobile_number: number }] : [] });
    };
    assert.deepEqual(await resolveEnquiryMobile(settings, number, "C123"), {
      mobile: number,
      mobile_customer: `${number} - C123`,
      customer: "C123"
    });
    await resolveEnquiryMobile(settings, number, "C123");
    assert.equal(writes, scenario === "existing" ? 0 : 1);
  });

for (const associations of [[], ["C1", "C2"]])
  test(`enquiry mobile blocks ${associations.length ? "ambiguous" : "missing"} customer links`, async () => {
    globalThis.fetch = async (input) => {
      const path = decodeURIComponent(new URL(String(input)).pathname);
      return Response.json({
        data: path.endsWith("/Mobile Contact")
          ? [{ name: number, mobile_number: number }]
          : associations.map((customer) => ({
              name: `${number} - ${customer}`,
              mobile_contact: number,
              customer
            }))
      });
    };
    await assert.rejects(resolveEnquiryMobile(settings, number, null), /missing or ambiguous/);
  });

test("enquiry mobile does not retry a denied creation as another write", async () => {
  let writes = 0;
  globalThis.fetch = async (_input, init) => {
    if (init?.method === "POST") {
      writes++;
      return Response.json({}, { status: 403 });
    }
    return Response.json({ data: [] });
  };
  await assert.rejects(resolveEnquiryMobile(settings, number, null), /rejected.*credentials/);
  assert.equal(writes, 1);
});

test("invalid enquiry mobile is rejected before contacting Frappe", async () => {
  globalThis.fetch = async () => {
    throw new Error("Unexpected request");
  };
  await assert.rejects(resolveEnquiryMobile(settings, "123", null), /10-digit/);
});
