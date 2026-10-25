import { Button } from "@codexsun/ui/components/button";
import { WorkspacePage } from "@codexsun/ui/workspace/page";
import {
  WorkspaceDetailTable,
  WorkspaceShowCard,
  WorkspaceShowLayout
} from "@codexsun/ui/workspace/show";
import { WorkspaceStatusBadge } from "@codexsun/ui/workspace/status";
import { CatalogActivityList } from "../../shared/catalog-activity-list";
import { useCatalogActivity } from "../../shared/catalog-activity";
import type { ProductInformationRecord } from "./product-information.types";

export function ProductInformationShow({
  loading,
  onArchive,
  onBack,
  onEdit,
  record
}: {
  loading: boolean;
  onArchive: (record: ProductInformationRecord) => void;
  onBack: () => void;
  onEdit: (record: ProductInformationRecord) => void;
  record: ProductInformationRecord;
}) {
  const activity = useCatalogActivity("product-information", record.id);
  return (
    <WorkspacePage
      title={record.storefrontTitle}
      description="Review this storefront item, its catalogue links and recorded history."
      onBack={onBack}
      actions={
        <>
          <Button variant="outline" onClick={() => onEdit(record)}>
            Edit
          </Button>
          {record.publicationStatus !== "archived" ? (
            <Button disabled={loading} variant="outline" onClick={() => onArchive(record)}>
              Archive
            </Button>
          ) : null}
        </>
      }
    >
      <WorkspaceShowLayout>
        <div className="space-y-4">
          <WorkspaceShowCard title="Item details">
            <WorkspaceDetailTable
              rows={[
                ["Storefront title", record.storefrontTitle],
                ["Subtitle", record.subtitle || "Not set"],
                [
                  "Publication",
                  <WorkspaceStatusBadge
                    key="publication"
                    label={record.publicationStatus}
                    tone={
                      record.publicationStatus === "published"
                        ? "success"
                        : record.publicationStatus === "archived"
                          ? "warning"
                          : "neutral"
                    }
                  />
                ],
                ["Slug", `/${record.slug}`],
                ["Core product", record.coreProductName],
                ["Brand", record.brandName || "No brand"],
                ["Featured", record.isFeatured ? "Yes" : "No"],
                ["Revision", String(record.revision)],
                ["Reference", record.uuid],
                ["Updated", formatDate(record.updatedAt)]
              ]}
            />
          </WorkspaceShowCard>
          <WorkspaceShowCard title="Storefront content">
            <WorkspaceDetailTable
              rows={[
                ["Short description", record.shortDescription || "Not set"],
                ["Material", record.material || "Not set"],
                ["Country of origin", record.countryOfOrigin || "Not set"],
                ["Manufacturer", record.manufacturer || "Not set"],
                ["Warranty", record.warranty || "Not set"],
                ["Return policy", record.returnPolicy || "Not set"],
                ["Shipping class", record.shippingClass || "Not set"],
                ["SEO title", record.seoTitle || "Not set"],
                ["SEO description", record.seoDescription || "Not set"]
              ]}
            />
          </WorkspaceShowCard>
        </div>
        <CatalogActivityList loading={activity.isLoading} records={activity.data ?? []} />
      </WorkspaceShowLayout>
    </WorkspacePage>
  );
}

function formatDate(value: string) {
  return new Date(value).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  });
}
