export type ConnectionInput = {
  expectedRevision?: number | undefined;
  brandUuid: string;
  name: string;
  provider: string;
  externalAccountId: string;
  status: "active" | "inactive";
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

export type ConnectionColumnFilters = {
  name?: string | undefined;
  brandUuid?: string | undefined;
  provider?: string | undefined;
  externalAccountId?: string | undefined;
  updatedBy?: string | undefined;
  status?: string | undefined;
};
