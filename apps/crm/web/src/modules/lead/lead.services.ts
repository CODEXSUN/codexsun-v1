import { crmRequest } from "../../crm-request";
import { leadRequestContext } from "./lead.query-scope";
import type {
  LeadActivity,
  LeadCapabilities,
  LeadContact,
  LeadFilters,
  LeadInput,
  LeadRecord
} from "./lead.types";
export const listLeads = (scope?: string) =>
  crmRequest<LeadRecord[]>("/crm/leads", leadRequestContext(scope));
export const getLead = (uuid: string, scope?: string) =>
  crmRequest<LeadRecord>("/crm/leads/" + uuid, leadRequestContext(scope));
export const listLeadPage = (filters: LeadFilters, scope?: string) =>
  crmRequest<{ items: LeadRecord[]; total: number }>(
    "/crm/leads/page?" +
      new URLSearchParams(
        Object.entries(filters)
          .filter(([, value]) => value !== undefined && value !== "")
          .map(([key, value]) => [key, String(value)])
      ),
    leadRequestContext(scope)
  );
export const saveLead = (input: LeadInput, uuid?: string) =>
  crmRequest<LeadRecord>("/crm/leads" + (uuid ? "/" + uuid : ""), {
    method: uuid ? "PUT" : "POST",
    body: JSON.stringify(input)
  });
export const convertLead = (uuid: string) =>
  crmRequest<LeadRecord>("/crm/leads/" + uuid + "/convert", { method: "POST", body: "{}" });
export const getLeadOptions = (scope?: string) =>
  crmRequest<LeadCapabilities>("/crm/leads/options", leadRequestContext(scope));
export const getLeadActivity = (uuid: string, scope?: string) =>
  crmRequest<LeadActivity[]>("/crm/leads/" + uuid + "/activity", leadRequestContext(scope));
export const lookupLeadContacts = (search: string, scope?: string) =>
  crmRequest<LeadContact[]>(
    "/crm/leads/contacts?" + new URLSearchParams({ search }),
    leadRequestContext(scope)
  );

export const lookupLeadCampaigns = (search: string, scope?: string) =>
  crmRequest<Array<{ label: string }>>(
    "/crm/leads/campaigns?" + new URLSearchParams({ search }),
    leadRequestContext(scope)
  );
