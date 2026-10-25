export type ConnectionProvider =
  | "facebook"
  | "instagram"
  | "whatsapp"
  | "linkedin"
  | "google"
  | "threads"
  | "pinterest"
  | "x"
  | "telegram"
  | "email";

export type ConnectionStatus = "active" | "inactive";

export type ConnectionCapability =
  | "youtube.channel.read"
  | "youtube.video.publish"
  | "facebook.pages.read"
  | "facebook.pages.publish"
  | "facebook.leads.retrieve"
  | "instagram.content.publish"
  | "instagram.insights.read"
  | "google.ads.leads.webhook"
  | "google.ads.conversions.upload"
  | "mail.campaign.send"
  | "mail.sender.verify"
  | "mail.suppression.sync"
  | "whatsapp.messages.send"
  | "whatsapp.templates.read"
  | "linkedin.community.publish"
  | "linkedin.leads.sync";

export type ConnectionInput = {
  expectedRevision?: number | undefined;
  brandUuid: string;
  name: string;
  provider: ConnectionProvider;
  externalAccountId: string;
  status: ConnectionStatus;
};

export type ConnectionRecord = ConnectionInput & {
  revision: number;
  uuid: string;
  companyId: number;
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
};

export type ConnectionActivity = { action: string; actor: string; occurredAt: string };

export type ConnectionHealthStatus = {
  connected: boolean;
  accountId: string;
  capabilities: ConnectionCapability[] | string[];
  expiresAt: string | null;
};

export type ConnectionGrantRecord = {
  uuid: string;
  connectionUuid: string;
  companyId: number;
  provider: ConnectionProvider;
  accountId: string;
  expiresAt: string;
  capabilities: string[];
  createdAt: string;
  updatedAt: string;
};

export type OAuthAccountOption = {
  id: string;
  label: string;
};

export type OAuthBeginResult = {
  url: string;
};

export type OAuthCompleteResult = {
  accounts: OAuthAccountOption[];
};

export type OAuthSelectResult = {
  connected: boolean;
  capabilities: string[];
};

export type ProviderAccountClaimRecord = {
  uuid: string;
  accountHash: string;
  provider: string;
  tenantUuid: string;
  connectionUuid: string;
  createdAt: string;
};
