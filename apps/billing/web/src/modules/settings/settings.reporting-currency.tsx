import { useQuery } from "@tanstack/react-query";
import { WorkspaceSelect } from "@codexsun/ui/workspace/select";
import { billingApiGet } from "../../shared/api/billing-api";
import {
  getTenantId,
  getCompanyId,
  getFinancialYearId,
  getReportCurrencyCode,
  selectReportCurrencyCode
} from "../../shared/api/tenant-context";

export function SettingsReportingCurrency() {
  const query = useQuery({
    queryKey: [
      "billing",
      "settings",
      "report-currencies",
      getTenantId(),
      getCompanyId(),
      getFinancialYearId()
    ],
    queryFn: () =>
      billingApiGet<Array<{ id: number; name: string }>>("/billing/settings/currencies")
  });
  return (
    <div className="max-w-sm space-y-2">
      <span className="text-sm font-semibold">Reporting currency</span>
      <WorkspaceSelect
        ariaLabel="Reporting currency"
        disabled={query.isLoading || query.isError}
        value={getReportCurrencyCode()}
        options={(query.data ?? [])
          .filter((row) => /^[A-Z]{3}$/.test(row.name.toUpperCase()))
          .map((row) => ({ label: row.name.toUpperCase(), value: row.name.toUpperCase() }))}
        onValueChange={selectReportCurrencyCode}
      />
      <p className="text-sm text-muted-foreground">
        Applies immediately to reports and the overview for this tab, company and financial year.
        GST reports and normal Sales remain in INR.
      </p>
      {query.isError ? (
        <p className="text-xs text-destructive">Currencies could not be loaded.</p>
      ) : null}
    </div>
  );
}
