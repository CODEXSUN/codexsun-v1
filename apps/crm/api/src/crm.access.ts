/** Administrative mutations and tenant-wide reads require persisted administrator roles. */
export function crmRecordReadRoles(permission: string): readonly string[] | null {
  return permission === "crm.enquiry.view-all" ||
    permission === "crm.task.view-all" ||
    (permission.startsWith("crm.") &&
      /\.(update(?:-own)?|delete|remove|manage|assign|cancel|restore|suspend|close|deactivate|publish|force-delete)(?:\.|$)/u.test(
        permission
      ))
    ? ["admin", "super-admin"]
    : null;
}

/** Contact 360 is unfinished; retain its data and grants but hide its access-control entries. */
export function isContact360Permission(permission: string): boolean {
  const module = permission.split(".")[1];
  return permission.startsWith("crm.") && contact360Modules.has(module ?? "");
}

const contact360Modules = new Set([
  "contact-profiles",
  "contact-people",
  "contact-tags",
  "contact-person-tags",
  "contact-roles",
  "contact-classifications",
  "contact-documents",
  "contact-employments",
  "contact-communication",
  "contact-preferences",
  "contact-relationships",
  "contact-notes",
  "contact-lifecycle"
]);
