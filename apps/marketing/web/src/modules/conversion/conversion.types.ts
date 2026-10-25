export type ConversionStatus = "converted" | "cancelled" | "reversed";

export type ConversionInput = {
  expectedRevision?: number | undefined;
  leadUuid: string;
  qualificationUuid?: string | undefined;
  status: ConversionStatus;
  declaredValue: number;
  currency: string;
  cancellationReason?: string | undefined;
  convertedBy: string;
  convertedAt: string;
  notes?: string | undefined;
};

export type ConversionRecord = ConversionInput & {
  uuid: string;
  companyId: number;
  revision: number;
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
};

export type ConversionColumnFilters = {
  leadUuid?: string | undefined;
  status?: string | undefined;
  convertedBy?: string | undefined;
  currency?: string | undefined;
};
