import { NativeSessionManager } from "../session/native-session-manager.js";
import type { LoginCredentials, SessionRecord } from "../session/session-types.js";
import type { M2StepResult } from "./types.js";

/**
 * Step 1: Login & restore tenant/company/year context.
 * Authenticates user, establishes session slot, and verifies full session restoration.
 */
export async function executeStep1LoginAndRestore(
  sessionManager: NativeSessionManager,
  credentials: LoginCredentials,
  targetOrigin?: string
): Promise<M2StepResult<{ restoredSession: SessionRecord; session: SessionRecord }>> {
  const startTime = Date.now();

  const session = await sessionManager.login(credentials, targetOrigin);

  if (!session.authenticated || !session.sessionSlot) {
    throw new Error("Step 1 failed: Login did not produce an authenticated session slot.");
  }

  if (credentials.desk === "tenant" && !session.tenantId && !session.tenantUuid) {
    throw new Error("Step 1 failed: Tenant login missing tenant ID/UUID.");
  }

  // Restore session to verify persistence and host verification
  const restoredSession = await sessionManager.restoreSession(credentials.desk);

  if (!restoredSession) {
    throw new Error("Step 1 failed: Session could not be restored from secure storage.");
  }

  if (restoredSession.sessionSlot !== session.sessionSlot) {
    throw new Error("Step 1 failed: Restored session slot mismatch.");
  }

  const durationMs = Date.now() - startTime;
  return {
    data: { restoredSession, session },
    durationMs,
    message: `Authenticated and restored tenant context (${session.tenantCode ?? session.tenantId ?? "desk"}) with Company: ${session.activeCompanyId ?? "default"} FY: ${session.activeFinancialYearId ?? "default"}`,
    step: 1,
    stepName: "Login & Restore Tenant Context",
    success: true
  };
}

/**
 * Step 6: Sign out / account switch cleanup.
 * Clears session slot, wipes secure storage, advances session generation to kill in-flight requests.
 */
export async function executeStep6SignOutCleanup(
  sessionManager: NativeSessionManager
): Promise<M2StepResult<{ sessionCleared: boolean; storageCleared: boolean }>> {
  const startTime = Date.now();
  const preGeneration = sessionManager.currentGeneration;
  const preSlot = sessionManager.sessionSlot;

  await sessionManager.logout();

  if (sessionManager.activeSession !== null) {
    throw new Error("Step 6 failed: Active session was not cleared after logout.");
  }

  if (sessionManager.status !== "unauthenticated") {
    throw new Error(`Step 6 failed: Expected status unauthenticated, got ${sessionManager.status}.`);
  }

  if (sessionManager.currentGeneration <= preGeneration) {
    throw new Error("Step 6 failed: Session generation counter was not advanced.");
  }

  // Verify that previous in-flight requests are considered stale
  if (!sessionManager.isResponseStale(preGeneration, preSlot ?? undefined)) {
    throw new Error("Step 6 failed: In-flight requests for old session were not flagged as stale.");
  }

  const durationMs = Date.now() - startTime;
  return {
    data: { sessionCleared: true, storageCleared: true },
    durationMs,
    message: "Cleanly signed out, cleared secure session storage, and invalidated in-flight generation.",
    step: 6,
    stepName: "Sign Out & Account Switch Cleanup",
    success: true
  };
}
