import { useMemo } from "react";
import {
  SubmissionWorkspace,
  ConsentWorkspace,
  BrandWorkspace,
  CampaignWorkspace,
  CaptureWorkspace,
  ConnectionWorkspace,
  LeadWorkspace,
  QualificationWorkspace,
  ConversionWorkspace,
  OutcomeWorkspace,
  FollowUpWorkspace,
  MarketingTransportProvider
} from "@codexsun/marketing-web";
import { createSessionBoundGateway } from "../../shared/api/platform-api";

export function MarketingHost({ page, companyId }: { page: string; companyId: number | null }) {
  const transport = useMemo(() => {
    const api = createSessionBoundGateway("tenant");
    return {
      ...api,
      scopeKey: api.sessionKey + ":marketing:" + companyId,
      publicUrl: (path: string) => {
        const base = (window as Window & { __CODEXSUN_RUNTIME_CONFIG__?: Record<string, string> })
          .__CODEXSUN_RUNTIME_CONFIG__?.VITE_PLATFORM_API_URL;
        if (!base) throw new Error("The API URL is not configured.");
        return base.replace(/\/$/, "") + path;
      }
    };
  }, [companyId]);
  return (
    <MarketingTransportProvider.Provider key={transport.scopeKey} value={transport}>
      {page === "marketing.consents" ? <ConsentWorkspace /> : null}
      {page === "marketing.submissions" ? <SubmissionWorkspace /> : null}
      {page === "marketing.brands" ? <BrandWorkspace /> : null}
      {page === "marketing.campaigns" ? <CampaignWorkspace /> : null}
      {page === "marketing.captures" ? <CaptureWorkspace /> : null}
      {page === "marketing.connections" ? <ConnectionWorkspace /> : null}
      {page === "marketing.leads" ? <LeadWorkspace /> : null}
      {page === "marketing.qualifications" ? <QualificationWorkspace /> : null}
      {page === "marketing.conversions" ? <ConversionWorkspace /> : null}
      {page === "marketing.outcomes" ? <OutcomeWorkspace /> : null}
      {page === "marketing.followups" ? <FollowUpWorkspace /> : null}
    </MarketingTransportProvider.Provider>
  );
}
