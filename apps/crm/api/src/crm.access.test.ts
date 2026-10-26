import assert from "node:assert/strict";
import { test } from "node:test";
import { crmRecordReadRoles, isContact360Permission } from "./crm.access.js";

test("tenant-wide enquiry and task reads require an administrator role", () => {
  for (const permission of ["crm.enquiry.view-all", "crm.task.view-all"]) {
    const roles = crmRecordReadRoles(permission)!;
    assert.deepEqual(roles, ["admin", "super-admin"]);
    for (const role of ["user", "manager", "team-head", "auditor", "custom-role"])
      assert.equal(roles.includes(role), false);
  }
});

test("ordinary permissions retain their existing permission checks", () => {
  for (const permission of [
    "crm.enquiry.view",
    "crm.enquiry.work",
    "crm.enquiry.update",
    "crm.task.work",
    "core.application.records.view"
  ])
    assert.equal(crmRecordReadRoles(permission), null);
});

test("hide only unfinished Contact 360 permission modules", () => {
  for (const permission of [
    "crm.contact-profiles.view",
    "crm.contact-notes.create",
    "crm.contact-person-tags.update"
  ])
    assert.equal(isContact360Permission(permission), true);
  for (const permission of [
    "crm.contact.view",
    "crm.enquiry.view",
    "core.contact.view",
    "crm.contact-profiles-extra.view"
  ])
    assert.equal(isContact360Permission(permission), false);
});
