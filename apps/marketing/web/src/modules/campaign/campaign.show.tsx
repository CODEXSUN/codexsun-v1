import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Copy, Edit } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@codexsun/ui/components/button";
import {
  WorkspaceDetailTable,
  WorkspaceShowCard,
  WorkspaceShowLayout
} from "@codexsun/ui/workspace/show";
import { WorkspacePage } from "@codexsun/ui/workspace/page";
import { WorkspaceStatusBadge } from "@codexsun/ui/workspace/status";
import { formatDateTime } from "@codexsun/ui/workspace/utils";
import { useMarketingTransport } from "../../transport";
import { campaignActivity, duplicateCampaign, getCampaign } from "./campaign.services";
import type { CampaignRecord } from "./campaign.types";

export function CampaignShow({
  uuid,
  initialRecord,
  onBack,
  onEdit,
  onToggleStatus
}: {
  uuid: string;
  initialRecord?: CampaignRecord | null | undefined;
  onBack: () => void;
  onEdit: (record: CampaignRecord) => void;
  onToggleStatus?: ((record: CampaignRecord) => void) | undefined;
}) {
  const api = useMarketingTransport();
  const client = useQueryClient();

  const detail = useQuery({
    queryKey: ["marketing", api.scopeKey, "campaign-detail", uuid],
    queryFn: () => getCampaign(api, uuid),
    initialData: initialRecord ?? undefined
  });
  const record = detail.data;

  const activity = useQuery({
    queryKey: ["marketing", api.scopeKey, "campaign-activity", uuid, record?.updatedAt],
    queryFn: () => campaignActivity(api, uuid),
    enabled: Boolean(uuid)
  });

  const duplicate = useMutation({
    mutationFn: (name: string) => duplicateCampaign(api, uuid, name),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["marketing", api.scopeKey] });
      toast.success("Inactive campaign copy created. Review it before activation.");
      onBack();
    },
    onError: (error) => toast.error("Unable to duplicate campaign", { description: error.message })
  });

  if (detail.isLoading && !record) {
    return (
      <WorkspacePage title="Loading Campaign…" technicalName="page.marketing.campaign.show">
        <p className="p-4 text-sm text-muted-foreground">Loading campaign details…</p>
      </WorkspacePage>
    );
  }

  if (detail.error || !record) {
    return (
      <WorkspacePage title="Campaign not found" technicalName="page.marketing.campaign.show">
        <div className="space-y-3 p-4">
          <p role="alert" className="text-sm text-destructive">
            {detail.error?.message ?? "The requested campaign could not be loaded."}
          </p>
          <Button variant="outline" onClick={onBack}>
            <ArrowLeft className="mr-1 size-4" />
            Back to list
          </Button>
        </div>
      </WorkspacePage>
    );
  }

  let trackingUrl: string | null = null;
  if (record.landingUrl) {
    try {
      const url = new URL(record.landingUrl);
      url.searchParams.set("utm_campaign", record.name);
      url.searchParams.set("utm_id", record.uuid);
      url.searchParams.set("utm_source", record.channel);
      trackingUrl = url.toString();
    } catch {
      trackingUrl = null;
    }
  }

  return (
    <WorkspacePage
      title={record.name}
      description="Campaign settings, acquisition channel, tracking URL, and activity."
      technicalName="page.marketing.campaign.show"
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={onBack}>
            <ArrowLeft className="mr-1 size-4" />
            Back
          </Button>
          <Button
            variant="outline"
            disabled={duplicate.isPending}
            onClick={() => {
              const name = window.prompt(
                "Name for the inactive campaign copy",
                ("Copy of " + record.name).slice(0, 160)
              );
              if (name?.trim()) duplicate.mutate(name.trim());
            }}
          >
            <Copy className="mr-1 size-4" />
            Duplicate as draft
          </Button>
          {onToggleStatus ? (
            <Button variant="outline" onClick={() => onToggleStatus(record)}>
              {record.status === "active" ? "Deactivate" : "Restore"}
            </Button>
          ) : null}
          <Button onClick={() => onEdit(record)}>
            <Edit className="mr-1 size-4" />
            Edit
          </Button>
        </div>
      }
    >
      <WorkspaceShowLayout>
        <div className="space-y-4">
          <WorkspaceShowCard title="Campaign Information">
            <WorkspaceDetailTable
              rows={[
                ["Campaign Name", record.name],
                ["Brand Reference", record.brandUuid],
                ["Channel", record.channel],
                ["Objective", record.objective],
                [
                  "Landing URL",
                  record.landingUrl ? (
                    <a
                      href={record.landingUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                    >
                      {record.landingUrl}
                    </a>
                  ) : (
                    <span className="text-muted-foreground">Not set</span>
                  )
                ],
                [
                  "Tracking Link",
                  trackingUrl ? (
                    <div className="space-y-1">
                      <p className="break-all font-mono text-xs">{trackingUrl}</p>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          if (trackingUrl) void navigator.clipboard.writeText(trackingUrl);
                          toast.success("Tracking URL copied to clipboard.");
                        }}
                      >
                        Copy tracking link
                      </Button>
                    </div>
                  ) : (
                    <span className="text-muted-foreground">
                      Set a landing URL to generate a tracking link
                    </span>
                  )
                ],
                [
                  "Status",
                  <WorkspaceStatusBadge
                    key="status"
                    label={record.status === "active" ? "Active" : "Inactive"}
                    tone={record.status === "active" ? "success" : "neutral"}
                  />
                ],
                ["Reference ID", record.uuid],
                ["Created By", record.createdBy || "System"],
                ["Created At", formatDateTime(record.createdAt)],
                ["Last Updated By", record.updatedBy || "System"],
                ["Last Updated At", formatDateTime(record.updatedAt)]
              ]}
            />
          </WorkspaceShowCard>
        </div>

        <div className="space-y-4">
          <WorkspaceShowCard title="Activity">
            {activity.error ? (
              <p role="alert" className="p-4 text-xs text-destructive">
                {activity.error.message}
              </p>
            ) : null}
            <WorkspaceDetailTable
              rows={
                (activity.data ?? []).length > 0
                  ? (activity.data ?? []).map((item, index) => [
                      formatDateTime(item.occurredAt) + " #" + (index + 1),
                      `${item.action} by ${item.actor}`
                    ])
                  : [["Activity", <span key="empty" className="text-muted-foreground">No recent activity recorded</span>]]
              }
            />
          </WorkspaceShowCard>
        </div>
      </WorkspaceShowLayout>
    </WorkspacePage>
  );
}
