import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { PinLocationText } from "./pin-location-text.js";

test("pin comments and action details share a safe maps link and local capture label", () => {
  const details =
    "[11.1292752, 77.3409328](https://www.google.com/maps?q=11.1292752,77.3409328) · Accuracy: 381.00 m · Captured: 2026-10-26T11:46:02.000Z";
  for (const prefix of ["", "Pin Location : "]) {
    const html = renderToStaticMarkup(createElement(PinLocationText, { value: prefix + details }));
    assert.ok(html.includes('href="https://www.google.com/maps?q=11.1292752,77.3409328"'));
    assert.ok(html.includes("381.00 m"));
    assert.ok(html.includes("26-10-2026"));
    assert.equal(html.includes(".000Z"), false);
  }
  const unsafe = renderToStaticMarkup(
    createElement(PinLocationText, { value: "[11, 77](javascript:alert(1))" })
  );
  assert.equal(unsafe.includes("<a"), false);
});
