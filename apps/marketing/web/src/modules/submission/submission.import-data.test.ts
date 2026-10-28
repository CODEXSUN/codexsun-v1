import { test } from "node:test";
import assert from "node:assert/strict";
import { importFields, mapImport, readImport, type ImportMapping } from "./submission.import-data";

const mapping = Object.fromEntries(importFields.map((field) => [field, field])) as ImportMapping;
const header =
  "captureUuid,sourceKey,name,email,phone,message,privacyConsent,sourceReference,sourceConsentAt,sourceNoticeVersion";
const record = 'abcdef12,source-001,"Smith, Jane",jane@example.com,,"hello\nworld",true,ref,,v1';

test("CSV supports quoted values and mapped columns", () => {
  const source = readImport(`${header}\r\n${record}\r\n`, true);
  const rows = mapImport(source, mapping);
  assert.equal(rows[0]?.name, "Smith, Jane");
  assert.equal(rows[0]?.message, "hello\nworld");
  assert.equal(rows[0]?.privacyConsent, true);
});

test("JSON columns can be mapped and invalid or duplicate rows are rejected", () => {
  const source = readImport(
    '[{"id":"abcdef12","key":"source-001","person":"Jane","mail":"jane@example.com","consent":true}]',
    false
  );
  const custom = {
    ...Object.fromEntries(importFields.map((field) => [field, ""])),
    captureUuid: "id",
    sourceKey: "key",
    name: "person",
    email: "mail",
    privacyConsent: "consent"
  } as ImportMapping;
  assert.equal(mapImport(source, custom)[0]?.name, "Jane");
  assert.throws(
    () => mapImport(readImport(`${header}\n${record}\n${record}`, true), mapping),
    /Duplicate/
  );
  assert.throws(() => readImport('a,b\n"bad', true), /Unclosed/);
  assert.throws(
    () => mapImport(readImport(`${header}\n${record.replace(",true,", ",false,")}`, true), mapping),
    /Row 1/
  );
});
