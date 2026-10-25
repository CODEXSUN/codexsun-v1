import { NativeHttpTransport } from "../native/http.js";
import { NativeSessionManager } from "../session/native-session-manager.js";
import type { LoginCredentials } from "../session/session-types.js";
import { executeStep3BillingQuotation } from "./billing-slice.js";
import { executeStep4ChatMessage } from "./chat-slice.js";
import { executeStep2CrmEnquiry } from "./crm-slice.js";
import { executeStep5EcommerceDraft } from "./ecommerce-slice.js";
import {
  executeStep1LoginAndRestore,
  executeStep6SignOutCleanup
} from "./session-slice.js";
import type { M2SliceReport } from "./types.js";

export interface RunM2SliceOptions {
  credentials: LoginCredentials;
  sessionManager?: NativeSessionManager;
  targetOrigin?: string;
  transport?: NativeHttpTransport;
}

/**
 * Executes the complete 6-step persisted M2 integrated mobile slice:
 * 1. Login & restore tenant/company/year context
 * 2. CRM: create enquiry, assign, comment, reload
 * 3. Billing: create quotation, reload totals, PDF preview/share
 * 4. Chat: send message, attachment, verify read status
 * 5. Ecommerce: save item draft, image, reload unpublished state
 * 6. Sign out / account switch cleanup
 */
export async function runCompleteM2Slice(options: RunM2SliceOptions): Promise<M2SliceReport> {
  const startedAt = new Date().toISOString();
  const overallStart = Date.now();

  const sessionManager = options.sessionManager ?? new NativeSessionManager();
  const transport = options.transport ?? new NativeHttpTransport({ sessionManager });

  // Step 1: Login & restore tenant/company/year context
  const step1 = await executeStep1LoginAndRestore(
    sessionManager,
    options.credentials,
    options.targetOrigin
  );

  // Step 2: CRM: create enquiry, assign, comment, reload
  const step2 = await executeStep2CrmEnquiry(transport);

  // Step 3: Billing: create quotation, reload totals, PDF preview/share
  const step3 = await executeStep3BillingQuotation(transport);

  // Step 4: Chat: send message, attachment, verify read status
  const step4 = await executeStep4ChatMessage(transport);

  // Step 5: Ecommerce: save item draft, image, reload unpublished state
  const step5 = await executeStep5EcommerceDraft(transport);

  // Step 6: Sign out / account switch cleanup
  const step6 = await executeStep6SignOutCleanup(sessionManager);

  const overallDuration = Date.now() - overallStart;
  const completedAt = new Date().toISOString();

  return {
    completedAt,
    durationMs: overallDuration,
    results: {
      step1_loginAndRestore: step1,
      step2_crmEnquiry: step2,
      step3_billingQuotation: step3,
      step4_chatMessage: step4,
      step5_ecommerceDraft: step5,
      step6_signOutCleanup: step6
    },
    startedAt,
    success: true
  };
}
