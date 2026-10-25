export type ConversionStatus = "converted" | "cancelled" | "reversed";

export type ConversionInput = {
  expectedRevision?: number | undefined;
  brandUuid: string;
  leadUuid: string;
  qualificationUuid: string;
  declaredValue?: number | undefined;
  currency?: string | undefined;
  notes?: string | undefined;
};

export type ConversionRecord = {
  uuid: string;
  revision: number;
  companyId: number;
  brandUuid: string;
  leadUuid: string;
  qualificationUuid: string;
  status: ConversionStatus;
  declaredValue: number;
  currency: string;
  cancellationReason: string;
  notes: string;
  convertedAt: string;
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
};

export type ConversionActivity = {
  action: string;
  actor: string;
  occurredAt: string;
};
