import { SettingsReportingCurrency } from "./settings.reporting-currency";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@codexsun/ui/components/button";
import {
  WorkspaceAnimatedTabs,
  type WorkspaceAnimatedTab
} from "@codexsun/ui/workspace/animated-tabs";
import { WorkspacePage } from "@codexsun/ui/workspace/page";
import { WorkspaceSelect } from "@codexsun/ui/workspace/select";
import { WorkspaceSwitchCard } from "@codexsun/ui/workspace/status";
import { useRouterState } from "@tanstack/react-router";
import { PageTitle } from "../../shared/document/PageTitle";
import { BillingLayout } from "../../shared/layout/BillingLayout";
import { saveBillingSettings } from "./settings.services";
import { useBillingSettings } from "./settings.hooks";
import { OpeningBalanceWorkspace } from "../opening-balance/index";
import {
  defaultBillingSettings,
  type BillingDocumentLayoutSettings,
  type BillingSettings
} from "./settings.types";

const layoutSwitches: Array<{
  key: keyof BillingDocumentLayoutSettings;
  label: string;
  note: string;
}> = [
  { key: "usePo", label: "PO", note: "Show purchase order number on item rows." },
  { key: "useDc", label: "DC", note: "Show delivery challan number on item rows." },
  { key: "useColour", label: "Colour", note: "Show colour selector and item column." },
  { key: "useSize", label: "Size", note: "Show size selector and item column." },
  {
    key: "useEinvoice",
    label: "E-invoice",
    note: "Enable E-invoice controls for this billing flow."
  },
  { key: "useEway", label: "E-way", note: "Enable E-way controls for this billing flow." }
];

export function SalesSettingsPage() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  return (
    <BillingLayout
      currentPath={pathname}
      headerTitle="Bill Settings"
      subtitle="Configure billing layout, customisation, GST, numbering, and print controls."
      title="Billing Workspace"
    >
      <PageTitle title="Bill Settings" />
      <SettingsWorkspaceContent />
    </BillingLayout>
  );
}

function SettingsWorkspaceContent() {
  const queryClient = useQueryClient();
  const settingsQuery = useBillingSettings();
  const [activeTab, setActiveTab] = useState("layout");
  const [form, setForm] = useState<BillingSettings>(defaultBillingSettings);

  useEffect(() => {
    if (settingsQuery.data) setForm(settingsQuery.data);
  }, [settingsQuery.data]);

  const mutation = useMutation({
    mutationFn: saveBillingSettings,
    onSuccess: async (settings) => {
      await queryClient.invalidateQueries({ queryKey: ["billing", "settings"] });
      setForm(settings);
      toast.success("Billing settings published", {
        description: "Quotation, sales, and purchase screens will use the latest layout."
      });
    },
    onError: (error) => {
      toast.error("Unable to publish settings", {
        description: error instanceof Error ? error.message : "Please try again."
      });
    }
  });

  function patch(next: Partial<BillingSettings>) {
    setForm((current) => ({ ...current, ...next }));
  }

  function patchLayout(next: Partial<BillingDocumentLayoutSettings>) {
    setForm((current) => ({
      ...current,
      layout: { ...current.layout, ...next }
    }));
  }

  function patchFeature(kind: keyof BillingSettings["features"], enabled: boolean) {
    setForm((current) => ({
      ...current,
      features: {
        ...current.features,
        [kind]: enabled
      }
    }));
  }

  const tabs: WorkspaceAnimatedTab[] = useMemo(
    () => [
      {
        label: "Reporting",
        value: "reporting",
        content: (
          <div className="space-y-4 rounded-md border border-border/70 bg-card/95 p-4 shadow-sm">
            <h2 className="text-base font-semibold">Report settings</h2>
            <SettingsReportingCurrency />
          </div>
        )
      },
      {
        value: "layout",
        label: "Layout",
        content: (
          <div className="rounded-md border border-border/70 bg-card/95 p-4 shadow-sm">
            <div className="space-y-1">
              <h2 className="text-base font-semibold text-foreground">Billing Layout</h2>
              <p className="text-sm text-muted-foreground">
                Toggle industry fields independently for quotation, sales, and purchase.
              </p>
            </div>
            <div className="mt-6 space-y-3">
              <div className="rounded-md border border-border/70 bg-background p-4">
                <label className="text-sm font-semibold text-foreground" htmlFor="gst-api-mode">
                  GST API mode
                </label>
                <div className="mt-2">
                  <WorkspaceSelect
                    ariaLabel="GST API mode"
                    value={form.gstApiMode}
                    options={[
                      { label: "E-invoice + E-way", value: "einvoice_eway" },
                      { label: "E-invoice only", value: "einvoice_only" },
                      { label: "E-way only", value: "eway_only" }
                    ]}
                    onValueChange={(gstApiMode) =>
                      patch({ gstApiMode: gstApiMode as BillingSettings["gstApiMode"] })
                    }
                  />
                </div>
              </div>
              <DocumentLayoutPanel layout={form.layout} onLayoutChange={patchLayout} />
            </div>
          </div>
        )
      },
      {
        value: "customise",
        label: "Customise",
        content: (
          <div className="rounded-md border border-border/70 bg-card/95 p-4 shadow-sm">
            <div className="space-y-1">
              <h2 className="text-base font-semibold text-foreground">Bill Customise</h2>
              <p className="text-sm text-muted-foreground">
                Controls for bill titles, labels, totals, and print language.
              </p>
            </div>
            <div className="mt-6 grid gap-3 lg:grid-cols-2">
              <CustomiseCard
                title="Sales invoice"
                note="Uses the sales item layout, GST mode, E-invoice, and E-way switches."
              />
              <CustomiseCard
                title="Quotation"
                note="Uses quotation item controls for PO, DC, colour, and size."
              />
              <CustomiseCard
                title="Purchase"
                note="Uses purchase item controls for supplier-side billing and GST fields."
              />
              <CustomiseCard
                title="Item table"
                note="Keeps item columns aligned with the Layout tab before printing."
              />
              <CustomiseCard
                title="Totals block"
                note="Shows taxable amount, GST total, round off, and grand total."
              />
            </div>
          </div>
        )
      },
      {
        value: "printing",
        label: "Printing",
        content: (
          <PlaceholderPanel
            title="Printing"
            note="Print controls will use the active quotation and sales layout."
          />
        )
      },
      {
        value: "numbering",
        label: "Numbering",
        content: (
          <PlaceholderPanel
            title="Numbering"
            note="Invoice and quotation numbering controls will live here."
          />
        )
      },
      {
        value: "gst",
        label: "GST",
        content: (
          <PlaceholderPanel
            title="GST"
            note="GST API, E-invoice, and E-way settings are controlled from the active billing layout."
          />
        )
      },
      {
        value: "openings",
        label: "Opening balances",
        content: <OpeningBalanceWorkspace />
      },
      {
        value: "features",
        label: "Features",
        content: (
          <div className="space-y-3 rounded-md border border-border/70 bg-card/95 p-4 shadow-sm">
            <SettingsToggle
              checked={form.features.quotation}
              label="Enable quotations"
              note="Shows quotation list, entry, preview, and conversion workspace."
              onChange={(enabled) => patchFeature("quotation", enabled)}
            />
            <SettingsToggle
              checked={form.features.exportSales}
              label="Export Sales"
              note="Shows export sales entries, totals, shortcuts, and document settings."
              onChange={(enabled) => patchFeature("exportSales", enabled)}
            />
            <SettingsToggle
              checked={form.features.tconnect}
              label="TConnect"
              note="Shows the TConnect trade connection workspace in the client app menu and landing desk."
              onChange={(enabled) => patchFeature("tconnect", enabled)}
            />
          </div>
        )
      }
    ],
    [form]
  );

  return (
    <WorkspacePage
      title="Bill Settings"
      description="Configure billing layout, customisation, print, numbering, GST, and feature controls."
      technicalName="page.billing.settings.sales"
      actions={
        <Button
          className="h-9 rounded-md"
          disabled={mutation.isPending || settingsQuery.isLoading}
          onClick={() => mutation.mutate(form)}
          type="button"
        >
          <Save className="size-4" />
          Publish live
        </Button>
      }
    >
      <WorkspaceAnimatedTabs
        contentPadding
        tabs={tabs}
        value={activeTab}
        onValueChange={setActiveTab}
      />
    </WorkspacePage>
  );
}

function DocumentLayoutPanel({
  layout,
  onLayoutChange
}: {
  layout: BillingDocumentLayoutSettings;
  onLayoutChange: (next: Partial<BillingDocumentLayoutSettings>) => void;
}) {
  return (
    <div className="rounded-md border border-border/70 bg-background p-4 shadow-sm">
      <div className="space-y-3">
        {layoutSwitches.map((item) => (
          <SettingsToggle
            key={item.key}
            checked={layout[item.key]}
            label={item.label}
            note={`${item.note} Applies to quotation, sales, and purchase.`}
            onChange={(checked) => onLayoutChange({ [item.key]: checked })}
          />
        ))}
      </div>
    </div>
  );
}

function CustomiseCard({ note, title }: { note: string; title: string }) {
  return (
    <div className="rounded-md border border-border/70 bg-background p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{note}</p>
    </div>
  );
}

function SettingsToggle({
  checked,
  disabled = false,
  label,
  note,
  onChange
}: {
  checked: boolean;
  disabled?: boolean;
  label: string;
  note: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <WorkspaceSwitchCard
      checked={checked}
      disabled={disabled}
      label={
        <span className="flex flex-wrap items-center gap-2">
          <span>{label}</span>
          <span className="rounded border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
            Industry
          </span>
        </span>
      }
      description={note}
      onCheckedChange={onChange}
    />
  );
}

function PlaceholderPanel({ note, title }: { note: string; title: string }) {
  return (
    <div className="rounded-md border border-border/70 bg-card/95 p-5 text-sm text-muted-foreground shadow-sm">
      <h2 className="text-base font-semibold text-foreground">{title}</h2>
      <p className="mt-1">{note}</p>
    </div>
  );
}
