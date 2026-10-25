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
import { useCollectionItems } from "./product-collection.hooks";
import type { ProductCollectionRecord } from "./product-collection.types";

export function ProductCollectionShow({
  loading,
  onBack,
  onEdit,
  onPublication,
  record
}: {
  loading: boolean;
  onBack: () => void;
  onEdit: (record: ProductCollectionRecord) => void;
  onPublication: (record: ProductCollectionRecord) => void;
  record: ProductCollectionRecord;
}) {
  const activity = useCatalogActivity("collection", record.id);
  const items = useCollectionItems(record.id);
  return (
    <WorkspacePage
      title={record.title}
      description="Review the curated collection, membership and recorded history."
      onBack={onBack}
      actions={
        <>
          <Button variant="outline" onClick={() => onEdit(record)}>
            Edit
          </Button>
          {record.publicationStatus !== "archived" ? (
            <Button disabled={loading} variant="outline" onClick={() => onPublication(record)}>
              {record.publicationStatus === "published" ? "Unpublish" : "Publish"}
            </Button>
          ) : null}
        </>
      }
    >
      <WorkspaceShowLayout>
        <div className="space-y-4">
          <WorkspaceShowCard title="Collection details">
            <WorkspaceDetailTable
              rows={[
                ["Title", record.title],
                ["Slug", record.slug],
                [
                  "Publication",
                  <WorkspaceStatusBadge
                    key="publication"
                    label={record.publicationStatus}
                    tone={record.publicationStatus === "published" ? "success" : "neutral"}
                  />
                ],
                ["Description", record.description || "Not set"],
                ["Hero image URL", record.heroImageUrl || "Not set"],
                ["Sort order", String(record.sortOrder)],
                ["Revision", String(record.revision)],
                ["Products", String(record.itemCount)],
                ["Reference", record.uuid],
                ["Updated", formatDate(record.updatedAt)]
              ]}
            />
          </WorkspaceShowCard>
          <WorkspaceShowCard title="Membership">
            {items.isLoading ? (
              <p className="px-4 py-3 text-sm text-muted-foreground">Loading products...</p>
            ) : (items.data ?? []).length === 0 ? (
              <p className="px-4 py-3 text-sm text-muted-foreground">No products are assigned.</p>
            ) : (
              <ol className="divide-y divide-border/60">
                {(items.data ?? []).map((item) => (
                  <li
                    className="flex items-center justify-between gap-3 px-4 py-2.5"
                    key={item.productInformationId}
                  >
                    <span className="text-sm font-medium">{item.title}</span>
                    <span className="text-xs text-muted-foreground">/{item.slug}</span>
                  </li>
                ))}
              </ol>
            )}
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
