import assert from "node:assert/strict";
import { test } from "node:test";
import { planEnquiryNumbers } from "./enquiry.numbering.js";

test("a different site's protected enquiry keeps its number during reconciliation", () => {
  const records = [
    { id: 1, enquiryNo: 1 },
    { id: 2, enquiryNo: 9 },
    { id: 3, enquiryNo: 2 }
  ];
  const plan = planEnquiryNumbers(
    records,
    [
      { enquiryId: 2, remoteName: "Q1" },
      { enquiryId: 3, remoteName: "Q3" }
    ],
    10,
    new Set([1])
  );
  assert.equal(
    plan.moves.some((move) => move.id === 1 || move.id === 2),
    false
  );
  assert.equal(plan.moves.find((move) => move.id === 3)?.after, 3);
});

test("Frappe serials replace CRM serials without losing colliding local records", () => {
  const records = [
    { id: 1, enquiryNo: 2075 },
    { id: 2, enquiryNo: 2060 },
    { id: 3, enquiryNo: 930 }
  ];
  const links = [
    { enquiryId: 1, remoteName: "Q2060" },
    { enquiryId: 3, remoteName: "ENQ27" }
  ];
  const plan = planEnquiryNumbers(records, links, 2076);
  assert.equal(plan.moves.find((move) => move.id === 1)?.after, 2060);
  assert.equal(plan.moves.find((move) => move.id === 2)?.after, 2075);
  assert.equal(plan.moves.find((move) => move.id === 3)?.after, 27);
  const final = records.map((row) => ({
    ...row,
    enquiryNo: plan.moves.find((move) => move.id === row.id)?.after ?? row.enquiryNo
  }));
  assert.equal(new Set(final.map((row) => row.enquiryNo)).size, 3);
  assert.deepEqual(planEnquiryNumbers(final, links, plan.nextNumber).moves, []);
});

test("swapped serials use distinct temporary numbers and preserve Q930", () => {
  const plan = planEnquiryNumbers(
    [
      { id: 1, enquiryNo: 1 },
      { id: 2, enquiryNo: 930 }
    ],
    [
      { enquiryId: 1, remoteName: "Q930" },
      { enquiryId: 2, remoteName: "Q1" }
    ],
    931
  );
  assert.deepEqual(
    plan.moves.map((move) => move.after),
    [930, 1]
  );
  assert.equal(new Set(plan.moves.map((move) => move.temporary)).size, 2);
  assert.ok(plan.moves.every((move) => move.temporary > 930));
  assert.equal(plan.nextNumber, 931);
});

test("import collisions reuse the provisional serial without consuming temporary numbers", () => {
  let records = [{ id: 1, enquiryNo: 2077 }];
  let nextNumber = 2083;
  const links: Array<{ enquiryId: number; remoteName: string }> = [];
  for (let index = 0; index < 4; index++) {
    const id = index + 2;
    records.push({ id, enquiryNo: nextNumber++ });
    links.push({ enquiryId: id, remoteName: `Q${2077 + index}` });
    const plan = planEnquiryNumbers(records, links, nextNumber);
    records = records.map((row) => ({
      ...row,
      enquiryNo: plan.moves.find((move) => move.id === row.id)?.after ?? row.enquiryNo
    }));
    assert.equal(plan.nextNumber, nextNumber);
    assert.equal(new Set(records.map((row) => row.enquiryNo)).size, records.length);
  }
  assert.equal(records.find((row) => row.id === 1)?.enquiryNo, 2083);
  assert.equal(nextNumber, 2087);
});

test("ambiguous Q and ENQ serials block renumbering instead of guessing", () => {
  assert.throws(
    () =>
      planEnquiryNumbers(
        [],
        [
          { enquiryId: 1, remoteName: "Q930" },
          { enquiryId: 2, remoteName: "ENQ930" }
        ],
        931
      ),
    /share enquiry number/
  );
  assert.throws(
    () => planEnquiryNumbers([], [{ enquiryId: 1, remoteName: "Q999999999999" }], 1),
    /unsupported number/
  );
});
