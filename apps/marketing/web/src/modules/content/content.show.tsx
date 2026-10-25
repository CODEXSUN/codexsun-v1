import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Clock,
  Copy,
  Edit,
  ExternalLink,
  Send,
  UploadCloud,
  XCircle
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@codexsun/ui/components/button";
import { Input } from "@codexsun/ui/components/input";
import { Textarea } from "@codexsun/ui/components/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@codexsun/ui/components/dialog";
import {
  WorkspaceDetailTable,
  WorkspaceShowCard,
  WorkspaceShowLayout
} from "@codexsun/ui/workspace/show";
import { WorkspacePage } from "@codexsun/ui/workspace/page";
import { formatDateTime } from "@codexsun/ui/workspace/utils";
import { useMarketingTransport } from "../../transport";
import {
  approveContent,
  cancelContent,
  completeManual,
  contentActivity,
  getContent,
  publishContent,
  rejectContent,
  scheduleContent,
  submitApproval
} from "./content.services";
import {
  renderChannelBadge,
  renderContentStatusBadge,
  renderPublishModeBadge
} from "./content.list";
import type { ContentRecord } from "./content.types";

export function ContentShow({
  uuid,
  initialRecord,
  onBack,
  onEdit
}: {
  uuid: string;
  initialRecord?: ContentRecord | null | undefined;
  onBack: () => void;
  onEdit: (record: ContentRecord) => void;
}) {
  const api = useMarketingTransport();
  const client = useQueryClient();

  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);
  const [scheduledAtValue, setScheduledAtValue] = useState("");
  const [manualDialogOpen, setManualDialogOpen] = useState(false);
  const [nativePostId, setNativePostId] = useState("");
  const [manualNotes, setManualNotes] = useState("");

  const detail = useQuery({
    queryKey: ["marketing", api.scopeKey, "content-detail", uuid],
    queryFn: () => getContent(api, uuid),
    initialData: initialRecord ?? undefined
  });
  const record = detail.data;

  const activity = useQuery({
    queryKey: ["marketing", api.scopeKey, "content-activity", uuid, record?.updatedAt],
    queryFn: () => contentActivity(api, uuid),
    enabled: Boolean(uuid)
  });

  const invalidate = async () => {
    await client.invalidateQueries({ queryKey: ["marketing", api.scopeKey] });
  };

  const submitApprovalMutation = useMutation({
    mutationFn: () => submitApproval(api, uuid, record?.revision),
    onSuccess: async () => {
      await invalidate();
      toast.success("Content submitted for approval.");
    },
    onError: (error) => toast.error("Submission failed", { description: error.message })
  });

  const approveMutation = useMutation({
    mutationFn: () => approveContent(api, uuid, record?.revision),
    onSuccess: async () => {
      await invalidate();
      toast.success("Content approved successfully.");
    },
    onError: (error) => toast.error("Approval failed", { description: error.message })
  });

  const rejectMutation = useMutation({
    mutationFn: (reason: string) => rejectContent(api, uuid, reason, record?.revision),
    onSuccess: async () => {
      await invalidate();
      setRejectDialogOpen(false);
      setRejectReason("");
      toast.success("Content rejected with reason.");
    },
    onError: (error) => toast.error("Rejection failed", { description: error.message })
  });

  const scheduleMutation = useMutation({
    mutationFn: (scheduledAt: string) =>
      scheduleContent(api, uuid, scheduledAt, record?.revision),
    onSuccess: async () => {
      await invalidate();
      setScheduleDialogOpen(false);
      setScheduledAtValue("");
      toast.success("Content scheduled for publication.");
    },
    onError: (error) => toast.error("Scheduling failed", { description: error.message })
  });

  const cancelMutation = useMutation({
    mutationFn: () => cancelContent(api, uuid, record?.revision),
    onSuccess: async () => {
      await invalidate();
      toast.success("Content cancelled.");
    },
    onError: (error) => toast.error("Cancellation failed", { description: error.message })
  });

  const publishMutation = useMutation({
    mutationFn: () => publishContent(api, uuid, record?.revision),
    onSuccess: async () => {
      await invalidate();
      toast.success("Content publication initiated.");
    },
    onError: (error) => toast.error("Publishing failed", { description: error.message })
  });

  const manualPublishMutation = useMutation({
    mutationFn: ({ postId, notes }: { postId: string; notes?: string }) =>
      completeManual(api, uuid, postId, notes, record?.revision),
    onSuccess: async () => {
      await invalidate();
      setManualDialogOpen(false);
      setNativePostId("");
      setManualNotes("");
      toast.success("Manual publication recorded successfully.");
    },
    onError: (error) =>
      toast.error("Failed to record manual publication", { description: error.message })
  });

  if (detail.isLoading && !record) {
    return (
      <WorkspacePage title="Loading Content…" technicalName="page.marketing.content.show">
        <p className="p-4 text-sm text-muted-foreground">Loading content details…</p>
      </WorkspacePage>
    );
  }

  if (detail.error || !record) {
    return (
      <WorkspacePage title="Content Not Found" technicalName="page.marketing.content.show">
        <div className="space-y-3 p-4">
          <p role="alert" className="text-sm text-destructive">
            {detail.error?.message ?? "The requested content post could not be loaded."}
          </p>
          <Button variant="outline" onClick={onBack}>
            <ArrowLeft className="mr-1 size-4" />
            Back to list
          </Button>
        </div>
      </WorkspacePage>
    );
  }

  const copyCaption = () => {
    let textToCopy = record.body;
    if (record.mediaUrl) {
      textToCopy += `\n\nMedia: ${record.mediaUrl}`;
    }
    void navigator.clipboard.writeText(textToCopy);
    toast.success("Caption copied to clipboard.");
  };

  const isPendingAny =
    submitApprovalMutation.isPending ||
    approveMutation.isPending ||
    rejectMutation.isPending ||
    scheduleMutation.isPending ||
    cancelMutation.isPending ||
    publishMutation.isPending ||
    manualPublishMutation.isPending;

  const canEdit = record.status === "draft" || record.status === "rejected";

  return (
    <WorkspacePage
      title={record.title}
      description="Content review, copy text, publication workflow, and revision audit trail."
      technicalName="page.marketing.content.show"
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={onBack}>
            <ArrowLeft className="mr-1 size-4" />
            Back
          </Button>
          <Button variant="outline" onClick={copyCaption}>
            <Copy className="mr-1 size-4" />
            Copy Caption
          </Button>
          {canEdit ? (
            <Button onClick={() => onEdit(record)}>
              <Edit className="mr-1 size-4" />
              Edit
            </Button>
          ) : null}
        </div>
      }
    >
      <WorkspaceShowLayout>
        <div className="space-y-4">
          <WorkspaceShowCard title="Content & Preview">
            <div className="p-4 space-y-4">
              <div className="rounded-lg border border-border/70 bg-card p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/50 pb-2">
                  <div className="flex items-center gap-2">
                    {renderChannelBadge(record.channel)}
                    {renderPublishModeBadge(record.publishMode)}
                  </div>
                  {renderContentStatusBadge(record.status)}
                </div>

                <div className="space-y-2">
                  <h4 className="text-base font-semibold text-foreground">{record.title}</h4>
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
                    {record.body}
                  </p>
                </div>

                {record.mediaUrl ? (
                  <div className="mt-3 space-y-2 rounded-md border border-border/60 bg-muted/20 p-3">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Media Asset
                    </p>
                    <a
                      href={record.mediaUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 break-all text-xs text-primary hover:underline"
                    >
                      {record.mediaUrl}
                      <ExternalLink className="size-3" />
                    </a>
                    {/\.(jpg|jpeg|png|webp|gif)$/i.test(record.mediaUrl) ? (
                      <div className="mt-2 max-w-md overflow-hidden rounded-md border border-border/70">
                        <img
                          src={record.mediaUrl}
                          alt={record.title}
                          className="h-auto max-h-64 w-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLElement).style.display = "none";
                          }}
                        />
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>

            <WorkspaceDetailTable
              rows={[
                ["Status", renderContentStatusBadge(record.status)],
                ["Channel", renderChannelBadge(record.channel)],
                ["Publish Mode", renderPublishModeBadge(record.publishMode)],
                ["Brand Reference", record.brandUuid],
                [
                  "Campaign Reference",
                  record.campaignUuid ? record.campaignUuid : "None"
                ],
                [
                  "Scheduled At",
                  record.scheduledAt ? formatDateTime(record.scheduledAt) : "Not scheduled"
                ],
                [
                  "Published At",
                  record.publishedAt ? formatDateTime(record.publishedAt) : "Not published"
                ],
                ["Published By", record.publishedBy || "—"],
                ["Native Post ID", record.nativePostId || "—"],
                ["Manual Notes", record.manualNotes || "—"],
                ...(record.status === "rejected" && record.rejectionReason
                  ? ([
                      [
                        "Rejection Reason",
                        <span key="rej" className="font-medium text-destructive">
                          {record.rejectionReason}
                        </span>
                      ]
                    ] as [string, React.ReactNode][])
                  : []),
                ["Content ID", record.uuid],
                ["Revision", String(record.revision)],
                ["Created By", record.createdBy || "System"],
                ["Created At", formatDateTime(record.createdAt)],
                ["Last Updated By", record.updatedBy || "System"],
                ["Last Updated At", formatDateTime(record.updatedAt)]
              ]}
            />
          </WorkspaceShowCard>
        </div>

        <div className="space-y-4">
          <WorkspaceShowCard title="Workflow Actions">
            <div className="space-y-3 p-4">
              {record.status === "draft" || record.status === "rejected" ? (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">
                    Draft is ready for review. Submitting will lock edits and notify reviewers.
                  </p>
                  <Button
                    className="w-full"
                    disabled={isPendingAny}
                    onClick={() => submitApprovalMutation.mutate()}
                  >
                    <Send className="mr-2 size-4" />
                    Submit for Approval
                  </Button>
                </div>
              ) : null}

              {record.status === "pending_approval" ? (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">
                    Review content details and decide on approval.
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      variant="default"
                      className="bg-emerald-600 hover:bg-emerald-700 text-white"
                      disabled={isPendingAny}
                      onClick={() => approveMutation.mutate()}
                    >
                      <CheckCircle2 className="mr-1 size-4" />
                      Approve
                    </Button>
                    <Button
                      variant="destructive"
                      disabled={isPendingAny}
                      onClick={() => setRejectDialogOpen(true)}
                    >
                      <XCircle className="mr-1 size-4" />
                      Reject
                    </Button>
                  </div>
                </div>
              ) : null}

              {record.status === "approved" ? (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">
                    Approved and ready to schedule or publish.
                  </p>
                  <div className="space-y-2">
                    <Button
                      variant="outline"
                      className="w-full"
                      disabled={isPendingAny}
                      onClick={() => {
                        setScheduledAtValue(record.scheduledAt ? record.scheduledAt.slice(0, 16) : "");
                        setScheduleDialogOpen(true);
                      }}
                    >
                      <Calendar className="mr-2 size-4" />
                      Schedule Publication
                    </Button>
                    {record.publishMode === "api" ? (
                      <Button
                        className="w-full bg-indigo-600 hover:bg-indigo-700 text-white"
                        disabled={isPendingAny}
                        onClick={() => publishMutation.mutate()}
                      >
                        <UploadCloud className="mr-2 size-4" />
                        Publish Now via API
                      </Button>
                    ) : (
                      <Button
                        className="w-full bg-amber-600 hover:bg-amber-700 text-white"
                        disabled={isPendingAny}
                        onClick={() => setManualDialogOpen(true)}
                      >
                        <CheckCircle2 className="mr-2 size-4" />
                        Record Manual Publication
                      </Button>
                    )}
                  </div>
                </div>
              ) : null}

              {record.status === "scheduled" ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5 text-xs text-indigo-700">
                    <Clock className="size-4 shrink-0" />
                    <span>
                      Scheduled for {record.scheduledAt ? formatDateTime(record.scheduledAt) : "soon"}
                    </span>
                  </div>
                  <Button
                    className="w-full"
                    disabled={isPendingAny}
                    onClick={() => publishMutation.mutate()}
                  >
                    <UploadCloud className="mr-2 size-4" />
                    Publish Immediately
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full"
                    disabled={isPendingAny}
                    onClick={() => cancelMutation.mutate()}
                  >
                    Cancel Schedule
                  </Button>
                </div>
              ) : null}

              {record.status !== "published" &&
              record.status !== "cancelled" &&
              record.status !== "scheduled" ? (
                <Button
                  variant="outline"
                  className="w-full text-muted-foreground"
                  disabled={isPendingAny}
                  onClick={() => cancelMutation.mutate()}
                >
                  Cancel Content
                </Button>
              ) : null}

              {record.status === "published" ? (
                <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800">
                  <p className="font-semibold">Published</p>
                  <p className="mt-1">
                    This post was published on{" "}
                    {record.publishedAt ? formatDateTime(record.publishedAt) : "earlier"}
                    {record.publishedBy ? ` by ${record.publishedBy}` : ""}.
                  </p>
                  {record.nativePostId ? (
                    <p className="mt-1 font-mono">ID: {record.nativePostId}</p>
                  ) : null}
                </div>
              ) : null}

              {record.status === "cancelled" ? (
                <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
                  This content item has been cancelled.
                </div>
              ) : null}
            </div>
          </WorkspaceShowCard>

          <WorkspaceShowCard title="Manual Publishing Fallback">
            <div className="space-y-3 p-4">
              <p className="text-xs text-muted-foreground">
                For social channels without automated API integration or restricted access, publish
                natively on the provider app and record confirmation here.
              </p>
              <div className="space-y-2">
                <Button variant="outline" className="w-full" onClick={copyCaption}>
                  <Copy className="mr-2 size-4" />
                  Copy Caption & Media URL
                </Button>
                {record.status !== "published" ? (
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => setManualDialogOpen(true)}
                  >
                    Record Manual Post
                  </Button>
                ) : null}
              </div>
            </div>
          </WorkspaceShowCard>

          <WorkspaceShowCard title="Activity Timeline">
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
                      `${item.action} by ${item.actor}${item.details ? ` (${item.details})` : ""}`
                    ])
                  : [["Activity", <span key="empty" className="text-muted-foreground">No recorded activity</span>]]
              }
            />
          </WorkspaceShowCard>
        </div>
      </WorkspaceShowLayout>

      {/* Reject Reason Dialog */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Content</DialogTitle>
            <DialogDescription>
              Provide feedback and reason for rejection so the creator can revise the content.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <Textarea
              aria-label="Rejection Reason"
              placeholder="e.g. Tone does not match brand guidelines; update image to high-res..."
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={4}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={!rejectReason.trim() || rejectMutation.isPending}
              onClick={() => rejectMutation.mutate(rejectReason.trim())}
            >
              {rejectMutation.isPending ? "Rejecting..." : "Confirm Rejection"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Schedule Dialog */}
      <Dialog open={scheduleDialogOpen} onOpenChange={setScheduleDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Schedule Publication</DialogTitle>
            <DialogDescription>
              Select the target date and time for automated or reminder publication.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <Input
              type="datetime-local"
              aria-label="Publication Date & Time"
              value={scheduledAtValue}
              onChange={(e) => setScheduledAtValue(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setScheduleDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={!scheduledAtValue || scheduleMutation.isPending}
              onClick={() => scheduleMutation.mutate(scheduledAtValue)}
            >
              {scheduleMutation.isPending ? "Scheduling..." : "Save Schedule"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manual Publication Record Dialog */}
      <Dialog open={manualDialogOpen} onOpenChange={setManualDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record Manual Publication</DialogTitle>
            <DialogDescription>
              Confirm manual posting by entering the native post ID or destination URL and any notes.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <label className="text-xs font-medium text-foreground">
                Native Post ID / URL (Required)
              </label>
              <Input
                aria-label="Native Post ID"
                placeholder="e.g. 179238491823 or https://instagram.com/p/..."
                value={nativePostId}
                onChange={(e) => setNativePostId(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-foreground">Notes (Optional)</label>
              <Textarea
                aria-label="Notes"
                placeholder="Published manually via mobile app..."
                value={manualNotes}
                onChange={(e) => setManualNotes(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setManualDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={!nativePostId.trim() || manualPublishMutation.isPending}
              onClick={() =>
                manualPublishMutation.mutate({
                  postId: nativePostId.trim(),
                  notes: manualNotes.trim()
                })
              }
            >
              {manualPublishMutation.isPending ? "Recording..." : "Record Publication"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </WorkspacePage>
  );
}
