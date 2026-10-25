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
import type { ProductAttributeRecord } from "./product-attribute.types";

export function ProductAttributeShow({
  onBack,
  onEdit,
  onStatus,
  record
}: {
  onBack: () => void;
  onEdit: (record: ProductAttributeRecord) => void;
  onStatus: (record: ProductAttributeRecord) => void;
  record: ProductAttributeRecord;
}) {
  const activity = useCatalogActivity("attribute", record.id);
  return (
    <WorkspacePage
      title={record.name}
      description="Review this reusable product characteristic and its recorded history."
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
        <WorkspaceShowCard title="Attribute details">
          <WorkspaceDetailTable
            rows={[
              ["Name", record.name],
              [
                "Status",
                <WorkspaceStatusBadge
                  key="status"
                  label={record.status}
                  tone={record.status === "active" ? "success" : "neutral"}
                />
              ],
              ["Code", record.code],
              ["Data type", record.dataType],
              ["Unit", record.unit || "Not set"],
              ["Filterable", record.isFilterable ? "Yes" : "No"],
              ["Sort order", String(record.sortOrder)],
              ["Assigned values", String(record.valueCount)],
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
