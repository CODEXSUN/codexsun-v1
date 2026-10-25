// Transport
export {
  MarketingTransportProvider,
  useMarketingTransport
} from "./transport";
export type { MarketingTransport } from "./transport";

// Wave 1A Core Modules
export {
  BrandWorkspace,
  BrandList,
  BrandForm,
  BrandShow
} from "./modules/brand/index";
export * from "./modules/brand/brand.types";

export {
  CampaignWorkspace,
  CampaignList,
  CampaignForm,
  CampaignShow
} from "./modules/campaign/index";
export * from "./modules/campaign/campaign.types";

export {
  CaptureWorkspace,
  CaptureList,
  CaptureForm,
  CaptureShow
} from "./modules/capture/index";
export * from "./modules/capture/capture.types";

export {
  SubmissionWorkspace,
  SubmissionList,
  SubmissionForm,
  SubmissionShow
} from "./modules/submission/index";
export * from "./modules/submission/submission.types";

export {
  ConnectionWorkspace,
  ConnectionList,
  ConnectionForm,
  ConnectionShow
} from "./modules/connection/index";
export * from "./modules/connection/connection.types";

export {
  ConsentWorkspace,
  ConsentList,
  ConsentForm,
  ConsentShow
} from "./modules/consent/index";
export * from "./modules/consent/consent.types";

// Wave 1A Lifecycle Modules
export {
  LeadWorkspace,
  LeadList,
  LeadForm,
  LeadShow
} from "./modules/lead/index";
export * from "./modules/lead/lead.types";

export {
  QualificationWorkspace,
  QualificationList,
  QualificationForm,
  QualificationShow
} from "./modules/qualification/index";
export * from "./modules/qualification/qualification.types";

export {
  ConversionWorkspace,
  ConversionList,
  ConversionForm,
  ConversionShow
} from "./modules/conversion/index";
export * from "./modules/conversion/conversion.types";

export {
  OutcomeWorkspace,
  OutcomeList,
  OutcomeForm,
  OutcomeShow
} from "./modules/outcome/index";
export * from "./modules/outcome/outcome.types";

export {
  FollowUpWorkspace,
  FollowUpList,
  FollowUpForm,
  FollowUpShow
} from "./modules/follow-up/index";
export * from "./modules/follow-up/follow-up.types";

// Wave 2 Publishing & Content Modules
export {
  ContentWorkspace,
  ContentList,
  ContentForm,
  ContentShow
} from "./modules/content/index";
export * from "./modules/content/content.types";

// Wave 3 Email Campaigns
export {
  EmailCampaignWorkspace,
  EmailCampaignList,
  EmailCampaignForm,
  EmailCampaignShow
} from "./modules/email-campaign/index";
export * from "./modules/email-campaign/email-campaign.types";

// Wave 4 Conversations & Nurturing
export {
  ConversationWorkspace,
  ConversationList,
  ConversationForm,
  ConversationShow
} from "./modules/conversation/index";
export * from "./modules/conversation/conversation.types";
