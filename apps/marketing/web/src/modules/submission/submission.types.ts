export type SubmissionInput = {
  captureUuid: string;
  sourceKey: string;
  name: string;
  email: string;
  phone: string;
  message: string;
  privacyConsent: true;
  sourceReference?: string | undefined;
  sourceConsentAt?: string | undefined;
  sourceNoticeVersion?: string | undefined;
};

export type SubmissionRecord = SubmissionInput & {
  sourceReference: string;
  sourceConsentAt: string;
  sourceNoticeVersion: string;
  uuid: string;
  companyId: number;
  brandUuid: string;
  campaignUuid: string;
  campaignLabel: string;
  noticeVersion: string;
  consentNotice: string;
  createdAt: string;
  createdBy: string;
  status: "pending" | "delivered";
  leadUuid: string | null;
};

export type SubmissionColumnFilters = {
  name?: string | undefined;
  campaignLabel?: string | undefined;
  email?: string | undefined;
  phone?: string | undefined;
  status?: string | undefined;
  leadUuid?: string | undefined;
};
