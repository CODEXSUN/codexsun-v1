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
import type { ProductSpecificationRecord } from "./product-specification.types";

export function ProductSpecificationShow({
  onBack,
  onEdit,
  onStatus,
  record
}: {
  onBack: () => void;
  onEdit: (record: ProductSpecificationRecord) => void;
  onStatus: (record: ProductSpecificationRecord) => void;
  record: ProductSpecificationRecord;
}) {
  const activity = useCatalogActivity("specification", record.id);
  return (
    <WorkspacePage
      title={record.label}
      description="Review this product specification fact and its recorded history."
      onBack={onBack}
      actions={
        <>
          <Button variant="outline" onClick={() => onEdit(record)}>
            Edit
          </Button>
          <Button variant="outline" onClick={() => onStatus(record)}>
            {record.status === "active" ? "Deactivate" : "Activate"}
          </Button>
        </>
      }
    >
      <WorkspaceShowLayout>
        <WorkspaceShowCard title="Specification details">
          <WorkspaceDetailTable
            rows={[
              ["Label", record.label],
              ["Value", record.value],
              ["Product", record.productTitle],
              [
                "Status",
                <WorkspaceStatusBadge
                  key="status"
                  label={record.status}
                  tone={record.status === "active" ? "success" : "neutral"}
                />
              ],
              ["Sort order", String(record.sortOrder)],
              ["Reference", record.uuid],
              ["Updated", formatDate(record.updatedAt)]
            ]}
          />
        </WorkspaceShowCard>
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
