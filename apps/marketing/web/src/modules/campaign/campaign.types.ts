export type CampaignInput = {
  expectedRevision?: number | undefined;
  brandUuid: string;
  name: string;
  objective: string;
  channel: string;
  landingUrl: string;
  status: "active" | "inactive";
};

export type CampaignRecord = CampaignInput & {
  revision: number;
  uuid: string;
  companyId: number;
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
};

export type CampaignColumnFilters = {
  name?: string | undefined;
  brandUuid?: string | undefined;
  objective?: string | undefined;
  channel?: string | undefined;
  updatedBy?: string | undefined;
  status?: string | undefined;
};
