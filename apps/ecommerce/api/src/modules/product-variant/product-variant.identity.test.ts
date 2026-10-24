import assert from "node:assert/strict";
import test from "node:test";
import {
  canonicalOptionSignature,
  canonicalOptionSignatureFor,
  canonicalStoredOptionSignature,
  findCanonicalOptionDuplicateGroups,
  type CanonicalOptionIdentityRow
} from "./product-variant.identity.js";

function row(
  id: number,
  productInformationId: number,
  sku: string,
  first: readonly [string, string] = ["", ""],
  second: readonly [string, string] = ["", ""],
  third: readonly [string, string] = ["", ""]
): CanonicalOptionIdentityRow {
  const pairs = [first, second, third];
  return {
    id,
    option1Name: pairs[0]![0],
    option1Value: pairs[0]![1],
    option2Name: pairs[1]![0],
    option2Value: pairs[1]![1],
    option3Name: pairs[2]![0],
    option3Value: pairs[2]![1],
    productInformationId,
    sku
  };
}

test("canonical signatures are slot-independent and bounded", () => {
  const reordered = canonicalOptionSignatureFor({
    option1Name: "Size",
    option1Value: "m",
    option2Name: "color",
    option2Value: " red ",
    option3Name: "",
    option3Value: ""
  });
  const original = canonicalOptionSignatureFor({
    option1Name: "Color",
    option1Value: "Red",
    option2Name: "Size",
    option2Value: "M",
    option3Name: "",
    option3Value: ""
  });

  assert.equal(reordered, original);
  assert.equal(original.length, 64);
  assert.match(original, /^[a-f0-9]{64}$/u);
});

test("delimiter-bearing values encoded with JSON do not collide", () => {
  const single = canonicalOptionSignatureFor({
    option1Name: "a",
    option1Value: "b|c=d",
    option2Name: "",
    option2Value: "",
    option3Name: "",
    option3Value: ""
  });
  const split = canonicalOptionSignatureFor({
    option1Name: "a",
    option1Value: "b",
    option2Name: "c",
    option2Value: "d",
    option3Name: "",
    option3Value: ""
  });
  const quoted = canonicalOptionSignature([["a", 'b", "c']]);

  assert.notEqual(single, split);
  assert.notEqual(single, quoted);
});

test("canonical signatures are bounded for Unicode maximum payloads", () => {
  const signature = canonicalOptionSignatureFor({
    option1Name: "Ş".repeat(80),
    option1Value: "色".repeat(120),
    option2Name: `${"名".repeat(79)}1`,
    option2Value: `${"値".repeat(119)}1`,
    option3Name: `${"名".repeat(79)}2`,
    option3Value: `${"値".repeat(119)}2`
  });

  assert.equal(signature.length, 64);
});

test("stored signature normalizes partial legacy option columns without throwing", () => {
  const signature = canonicalStoredOptionSignature({
    option1Name: " Size ",
    option1Value: "",
    option2Name: "",
    option2Value: "",
    option3Name: "",
    option3Value: ""
  });

  assert.equal(signature.length, 64);
});

test("migration duplicate detection finds canonical collisions before DDL", () => {
  const groups = findCanonicalOptionDuplicateGroups([
    row(1, 10, "SKU-RED-M", ["Color", "Red"], ["Size", "M"]),
    row(2, 10, "SKU-M-RED", ["Size", "m"], ["color", " red "]),
    row(3, 10, "SKU-DELIMITER", ["a", "b|c=d"]),
    row(4, 10, "SKU-SPLIT", ["a", "b"], ["c", "d"]),
    row(5, 11, "SKU-OTHER-PRODUCT", ["Color", "Red"], ["Size", "M"]),
    row(6, 12, "SKU-EMPTY-A"),
    row(7, 12, "SKU-EMPTY-B")
  ]);

  assert.equal(groups.length, 2);
  const redGroup = groups.find((group) => group.productInformationId === 10);
  assert.deepEqual(redGroup?.rows.map((item) => item.sku).sort(), ["SKU-M-RED", "SKU-RED-M"]);
  const emptyGroup = groups.find((group) => group.productInformationId === 12);
  assert.deepEqual(emptyGroup?.rows.map((item) => item.sku).sort(), ["SKU-EMPTY-A", "SKU-EMPTY-B"]);
});
