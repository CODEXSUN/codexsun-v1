import type { SessionRecord } from "../../session/session-types.js";

export class BillingPermissionError extends Error {
  readonly code: string;
  readonly statusCode: number;

  constructor(
    message = "Posting or cancelling billing entries requires administrator privileges.",
    statusCode = 403,
    code = "BILLING_PERMISSION_DENIED"
  ) {
    super(message);
    this.name = "BillingPermissionError";
    this.statusCode = statusCode;
    this.code = code;
  }
}

/**
 * Checks whether the current active session has administrator rights for Billing operations.
 */
export function isAdminSession(session?: SessionRecord | null): boolean {
  if (!session) return false;

  const role = (session.role ?? "").toLowerCase();
  if (role === "admin" || role === "tenant_admin" || role === "super_admin") {
    return true;
  }

  const userType = (session.userType ?? "").toLowerCase();
  if (userType === "admin") {
    return true;
  }

  const desk = (session.desk ?? "").toLowerCase();
  if (desk === "tenant_admin") {
    return true;
  }

  const safeSettings = session.context?.safeSettings as Record<string, unknown> | undefined;
  if (safeSettings?.isAdmin === true || safeSettings?.canEditFinalizedEntries === true) {
    return true;
  }

  return false;
}

/**
 * Asserts that the session possesses administrator privileges.
 * Throws a BillingPermissionError (403) if unauthorized.
 */
export function assertAdminPermission(
  session?: SessionRecord | null,
  actionName = "Posting or cancelling"
): void {
  if (!isAdminSession(session)) {
    throw new BillingPermissionError(
      `${actionName} billing entries requires administrator privileges.`
    );
  }
}

/**
 * Determines whether a document can be edited.
 * Draft documents can be edited by authorized staff; finalized/posted documents require admin.
 */
export function canEditBillingEntry(status: string, isAdmin: boolean): boolean {
  return status === "draft" || isAdmin;
}
