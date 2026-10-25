import type { SessionRecord } from "../session/session-types.js";

export interface M2StepResult<T = unknown> {
  data: T;
  durationMs: number;
  message: string;
  step: number;
  stepName: string;
  success: boolean;
}

export interface M2SliceReport {
  completedAt: string;
  durationMs: number;
  error?: string;
  results: {
    step1_loginAndRestore: M2StepResult<{ restoredSession: SessionRecord; session: SessionRecord }>;
    step2_crmEnquiry: M2StepResult<{ assignedUserId: string; commentId: string | number; enquiryId: string; reloadedCommentsCount: number }>;
    step3_billingQuotation: M2StepResult<{ grandTotal: number; pdfUrl: string; quotationId: string }>;
    step4_chatMessage: M2StepResult<{ channelUuid: string; messageUuid: string; readStatusVerified: boolean }>;
    step5_ecommerceDraft: M2StepResult<{ draftId: number; imageUrl: string; publicationStatus: string }>;
    step6_signOutCleanup: M2StepResult<{ sessionCleared: boolean; storageCleared: boolean }>;
  };
  startedAt: string;
  success: boolean;
}

export interface CrmEnquiryInput {
  customerName: string;
  email?: string;
  mobile: string;
  requirements?: string;
  title?: string;
}

export interface BillingQuotationInput {
  customerName: string;
  items: Array<{
    description: string;
    quantity: number;
    rate: number;
    taxRate?: number;
  }>;
}

export interface ChatMessageInput {
  attachment?: {
    base64: string;
    fileName: string;
    mimeType: string;
  };
  body: string;
  channelUuid: string;
}

export interface EcommerceDraftInput {
  coreProductId?: number;
  image?: {
    contentBase64: string;
    fileName: string;
  };
  price?: number;
  storefrontTitle: string;
}
