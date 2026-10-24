import { Fragment } from "react";
import { WorkspaceStatusBadge } from "@codexsun/ui/workspace/status";
import { CatalogDataSourceForm } from "./catalog-data-source.form";
import type {
  CatalogDataSourceModule,
  CatalogDataSourceProvider,
  CatalogModuleDataSource
} from "./catalog-data-source.types";

export function CatalogDataSourceList({
  busy,
  frappeConfigured,
  modules,
  onChange
}: {
  busy: boolean;
  frappeConfigured: boolean;
  modules: CatalogModuleDataSource[];
  onChange: (module: CatalogDataSourceModule, provider: CatalogDataSourceProvider) => void;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] border-collapse text-sm">
        <thead>
          <tr className="border-b bg-muted/35 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <th className="px-4 py-3 font-semibold">Module</th>
            <th className="px-4 py-3 font-semibold">Purpose</th>
            <th className="w-44 px-4 py-3 text-center font-semibold">Local MariaDB</th>
            <th className="w-44 px-4 py-3 text-center font-semibold">Frappe import</th>
          </tr>
        </thead>
        <tbody>
          {moduleGroups.map((group) => (
            <Fragment key={group.label}>
              <tr className="border-b bg-muted/20">
                <th
                  className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                  colSpan={4}
                >
                  {group.label}
                </th>
              </tr>
              {group.modules
                .map((module) => modules.find((item) => item.module === module))
                .filter((item): item is CatalogModuleDataSource => Boolean(item))
                .map((item) => (
                  <DataSourceRow
                    busy={busy}
                    frappeConfigured={frappeConfigured}
                    item={item}
                    key={item.module}
                    onChange={onChange}
                  />
                ))}
            </Fragment>
          ))}
        </tbody>
      </table>
      {!frappeConfigured ? (
        <p className="border-t px-4 py-3 text-sm text-muted-foreground">
          Enable and verify the connection in the Frappe app before selecting a Frappe import
          source.
        </p>
      ) : null}
    </div>
  );
}

const moduleGroups: Array<{ label: string; modules: CatalogDataSourceModule[] }> = [
  {
    label: "Catalog and products",
    modules: ["categories", "brands", "products", "product-details", "variants", "product-images"]
  },
  {
    label: "Storefront UX content",
    modules: [
      "sliders",
      "promotions",
      "brand-strips",
      "featured-cards",
      "season-strips",
      "campaign-events"
    ]
  }
];

function DataSourceRow({
  busy,
  frappeConfigured,
  item,
  onChange
}: {
  busy: boolean;
  frappeConfigured: boolean;
  item: CatalogModuleDataSource;
  onChange: (module: CatalogDataSourceModule, provider: CatalogDataSourceProvider) => void;
}) {
  return (
    <tr className="border-b last:border-b-0 hover:bg-muted/20">
      <td className="px-4 py-4">
        <strong className="font-medium">{item.label}</strong>
        <div className="pt-1">
          <WorkspaceStatusBadge
            label={item.provider === "own" ? "Local projection" : "Frappe import"}
            tone={item.provider === "own" ? "success" : "info"}
          />
        </div>
      </td>
      <td className="px-4 py-4 text-muted-foreground">{item.description}</td>
      <td colSpan={2} className="px-4 py-4">
        <CatalogDataSourceForm
          busy={busy}
          frappeConfigured={frappeConfigured}
          item={item}
          onChange={onChange}
        />
      </td>
    </tr>
  );
}
