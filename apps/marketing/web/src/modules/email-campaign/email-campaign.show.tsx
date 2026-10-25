import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Check, Edit, Mail, Pause, Play, RefreshCw, Send, ShieldAlert, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@codexsun/ui/components/button";
import { Input } from "@codexsun/ui/components/input";
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
import { WorkspaceStatusBadge } from "@codexsun/ui/workspace/status";
import { formatDateTime } from "@codexsun/ui/workspace/utils";
import { useMarketingTransport } from "../../transport";
import {
  approveEmailCampaign,
  cancelEmailCampaign,
  dispatchEmailCampaign,
  emailCampaignActivity,
  getEmailCampaign,
  listEmailRecipients,
  pauseEmailCampaign,
  previewEmailCampaign,
  rejectEmailCampaign,
  resumeEmailCampaign,
  scheduleEmailCampaign,
  snapshotAudienceEmailCampaign,
  submitForApprovalEmailCampaign,
  testSendEmailCampaign
} from "./email-campaign.services";
import type { EmailCampaignRecord, EmailCampaignStatus } from "./email-campaign.types";

export function EmailCampaignShow({
  uuid,
  initialRecord,
  onBack,
  onEdit
}: {
  uuid: string;
  initialRecord?: EmailCampaignRecord | null;
  onBack: () => void;
  onEdit: (record: EmailCampaignRecord) => void;
}) {
  const api = useMarketingTransport();
  const client = useQueryClient();

  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduleTime, setScheduleTime] = useState("");

  const [testSendOpen, setTestSendOpen] = useState(false);
  const [testRecipient, setTestRecipient] = useState("");

  const detail = useQuery({
    queryKey: ["marketing", api.scopeKey, "email-campaign-detail", uuid],
    queryFn: () => getEmailCampaign(api, uuid),
    initialData: initialRecord ?? undefined
  });
  const record = detail.data;

  const preview = useQuery({
    queryKey: ["marketing", api.scopeKey, "email-campaign-preview", uuid, record?.updatedAt],
    queryFn: () => previewEmailCampaign(api, uuid),
    enabled: Boolean(uuid)
  });

  const recipients = useQuery({
    queryKey: ["marketing", api.scopeKey, "email-campaign-recipients", uuid, record?.updatedAt],
    queryFn: () => listEmailRecipients(api, uuid, { limit: 25, offset: 0 }),
    enabled: Boolean(uuid)
  });

  const activity = useQuery({
    queryKey: ["marketing", api.scopeKey, "email-campaign-activity", uuid, record?.updatedAt],
    queryFn: () => emailCampaignActivity(api, uuid),
    enabled: Boolean(uuid)
  });

  const invalidate = async () => {
    await client.invalidateQueries({ queryKey: ["marketing", api.scopeKey] });
  };

  const submitApproval = useMutation({
    mutationFn: () => submitForApprovalEmailCampaign(api, uuid),
    onSuccess: async () => {
      await invalidate();
      toast.success("Campaign submitted for approval.");
    },
    onError: (err) => toast.error("Submission failed", { description: err.message })
  });

  const approve = useMutation({
    mutationFn: () => approveEmailCampaign(api, uuid),
    onSuccess: async () => {
      await invalidate();
      toast.success("Campaign approved.");
    },
    onError: (err) => toast.error("Approval failed", { description: err.message })
  });

  const reject = useMutation({
    mutationFn: () => rejectEmailCampaign(api, uuid, rejectReason),
    onSuccess: async () => {
      setRejectOpen(false);
      setRejectReason("");
      await invalidate();
      toast.success("Campaign rejected with reason.");
    },
    onError: (err) => toast.error("Rejection failed", { description: err.message })
  });

  const schedule = useMutation({
    mutationFn: () => scheduleEmailCampaign(api, uuid, scheduleTime),
    onSuccess: async () => {
      setScheduleOpen(false);
      await invalidate();
      toast.success("Campaign scheduled successfully.");
    },
    onError: (err) => toast.error("Scheduling failed", { description: err.message })
  });

  const cancel = useMutation({
    mutationFn: () => cancelEmailCampaign(api, uuid),
    onSuccess: async () => {
      await invalidate();
      toast.success("Campaign cancelled.");
    },
    onError: (err) => toast.error("Cancellation failed", { description: err.message })
  });

  const pause = useMutation({
    mutationFn: () => pauseEmailCampaign(api, uuid),
    onSuccess: async () => {
      await invalidate();
      toast.success("Campaign paused.");
    },
    onError: (err) => toast.error("Pause failed", { description: err.message })
  });

  const resume = useMutation({
    mutationFn: () => resumeEmailCampaign(api, uuid),
    onSuccess: async () => {
      await invalidate();
      toast.success("Campaign resumed.");
    },
    onError: (err) => toast.error("Resume failed", { description: err.message })
  });

  const snapshotAudience = useMutation({
    mutationFn: () => snapshotAudienceEmailCampaign(api, uuid),
    onSuccess: async (data) => {
      await invalidate();
      toast.success(`Audience snapshot complete: ${data.total} total (${data.enqueued} eligible, ${data.suppressed} suppressed).`);
    },
    onError: (err) => toast.error("Snapshot failed", { description: err.message })
  });

  const testSend = useMutation({
    mutationFn: () => testSendEmailCampaign(api, uuid, testRecipient),
    onSuccess: async (data) => {
      setTestSendOpen(false);
      setTestRecipient("");
      toast.success(`Test email sent to ${data.recipient}`);
    },
    onError: (err) => toast.error("Test send failed", { description: err.message })
  });

  const dispatch = useMutation({
    mutationFn: () => dispatchEmailCampaign(api, uuid),
    onSuccess: async (data) => {
      await invalidate();
      toast.success(`Batch dispatched: ${data.sent} sent, ${data.suppressed} suppressed, ${data.remaining} remaining.`);
    },
    onError: (err) => toast.error("Dispatch failed", { description: err.message })
  });

  if (detail.isLoading && !record) {
    return (
      <WorkspacePage title="Loading Campaign…" technicalName="page.marketing.email-campaign.show">
        <p className="p-4 text-sm text-muted-foreground">Loading email campaign details…</p>
      </WorkspacePage>
    );
  }

  if (detail.error || !record) {
    return (
      <WorkspacePage title="Campaign not found" technicalName="page.marketing.email-campaign.show">
        <div className="space-y-3 p-4">
          <p role="alert" className="text-sm text-destructive">
            {detail.error?.message ?? "The requested email campaign could not be loaded."}
          </p>
          <Button variant="outline" onClick={onBack}>
            <ArrowLeft className="mr-1 size-4" />
            Back to list
          </Button>
        </div>
      </WorkspacePage>
    );
  }

  const statusTone = (st: EmailCampaignStatus): "success" | "warning" | "neutral" | "danger" => {
    switch (st) {
      case "approved":
      case "completed":
        return "success";
      case "pending_approval":
      case "scheduled":
      case "sending":
        return "warning";
      case "rejected":
      case "cancelled":
        return "danger";
      case "paused":
      case "draft":
      default:
        return "neutral";
    }
  };

  return (
    <WorkspacePage
      title={record.name}
      description="Campaign configuration, verified sender, live variable preview, and dispatch safety."
      technicalName="page.marketing.email-campaign.show"
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={onBack}>
            <ArrowLeft className="mr-1 size-4" />
            Back
          </Button>
          {record.status === "draft" || record.status === "rejected" ? (
            <Button variant="outline" onClick={() => onEdit(record)}>
              <Edit className="mr-1 size-4" />
              Edit
            </Button>
          ) : null}
        </div>
      }
    >
      <WorkspaceShowLayout>
        {/* Left Column: Details, Preview, Audience Metrics & Recipients */}
        <div className="space-y-6">
          <WorkspaceShowCard title="Campaign Details">
            <WorkspaceDetailTable
              rows={[
                ["Status", <WorkspaceStatusBadge key="status" label={record.status.replace("_", " ")} tone={statusTone(record.status)} />],
                ["Subject", record.subject],
                ["Preheader", record.preheader || "—"],
                ["From", `${record.fromName} <${record.fromEmail}>`],
                ["Reply-To", record.replyTo],
                ["Scheduled At", record.scheduledAt ? formatDateTime(record.scheduledAt) : "—"],
                ["Revision", `v${record.revision}`],
                ["Rejection Reason", record.rejectionReason || "—"]
              ]}
            />
          </WorkspaceShowCard>

          {/* Audience Metrics Summary */}
          <WorkspaceShowCard title="Audience & Dispatch Performance">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <div className="rounded-md border p-3 text-center">
                <div className="text-2xl font-semibold text-foreground">{record.totalRecipients}</div>
                <div className="text-xs text-muted-foreground">Total Audience</div>
              </div>
              <div className="rounded-md border p-3 text-center">
                <div className="text-2xl font-semibold text-emerald-600">{record.sentCount}</div>
                <div className="text-xs text-muted-foreground">Delivered / Sent</div>
              </div>
              <div className="rounded-md border p-3 text-center">
                <div className="text-2xl font-semibold text-amber-600">{record.suppressedCount}</div>
                <div className="text-xs text-muted-foreground">Suppressed (Safe)</div>
              </div>
              <div className="rounded-md border p-3 text-center">
                <div className="text-2xl font-semibold text-rose-600">{record.bouncedCount}</div>
                <div className="text-xs text-muted-foreground">Bounces</div>
              </div>
              <div className="rounded-md border p-3 text-center">
                <div className="text-2xl font-semibold text-purple-600">{record.complainedCount}</div>
                <div className="text-xs text-muted-foreground">Complaints</div>
              </div>
              <div className="rounded-md border p-3 text-center">
                <div className="text-2xl font-semibold text-neutral-600">{record.unsubscribedCount}</div>
                <div className="text-xs text-muted-foreground">Unsubscribes</div>
              </div>
            </div>
          </WorkspaceShowCard>

          {/* Live Variable Preview */}
          <WorkspaceShowCard title="Rendered Template Preview">
            {preview.data ? (
              <div className="space-y-3">
                <div className="rounded-md border bg-muted/30 p-3 text-xs">
                  <div className="font-semibold text-foreground">Subject: {preview.data.subject}</div>
                  {preview.data.preheader ? (
                    <div className="text-muted-foreground">Preheader: {preview.data.preheader}</div>
                  ) : null}
                </div>
                <div className="rounded-md border p-4">
                  <div
                    className="prose prose-sm max-w-none text-xs text-foreground"
                    dangerouslySetInnerHTML={{ __html: preview.data.html }}
                  />
                </div>
                <div className="flex flex-wrap gap-1 text-[11px] text-muted-foreground">
                  <span>Variables interpolated:</span>
                  {preview.data.variablesUsed.map((v) => (
                    <span key={v} className="rounded bg-muted px-1.5 py-0.5 font-mono">
                      {v}
                    </span>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">Loading preview…</p>
            )}
          </WorkspaceShowCard>

          {/* Enqueued Audience Snapshot List */}
          <WorkspaceShowCard title="Audience Snapshot Sample">
            {(recipients.data ?? []).length === 0 ? (
              <p className="text-xs text-muted-foreground">
                No audience enqueued. Click "Snapshot Audience" to populate recipients from marketing leads.
              </p>
            ) : (
              <div className="space-y-2">
                {(recipients.data ?? []).map((r) => (
                  <div key={r.uuid} className="flex items-center justify-between border-b py-2 text-xs">
                    <div>
                      <span className="font-medium text-foreground">{r.recipientEmail}</span>
                      {r.suppressionReason ? (
                        <span className="ml-2 text-amber-600">({r.suppressionReason})</span>
                      ) : null}
                    </div>
                    <WorkspaceStatusBadge
                      label={r.status}
                      tone={
                        r.status === "sent"
                          ? "success"
                          : r.status === "suppressed"
                          ? "warning"
                          : r.status === "bounced" || r.status === "complained"
                          ? "danger"
                          : "neutral"
                      }
                    />
                  </div>
                ))}
              </div>
            )}
          </WorkspaceShowCard>
        </div>

        {/* Right Column: Workflow Actions & Activity */}
        <div className="space-y-6">
          <WorkspaceShowCard title="Workflow & Dispatch Actions">
            <div className="flex flex-col gap-2">
              {record.status === "draft" || record.status === "rejected" ? (
                <>
                  <Button
                    variant="outline"
                    onClick={() => snapshotAudience.mutate()}
                    disabled={snapshotAudience.isPending}
                  >
                    <RefreshCw className="mr-1 size-4" />
                    Snapshot Audience
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setTestSendOpen(true)}
                  >
                    <Mail className="mr-1 size-4" />
                    Send Test Email
                  </Button>
                  <Button
                    onClick={() => submitApproval.mutate()}
                    disabled={submitApproval.isPending || record.totalRecipients === 0}
                  >
                    <Check className="mr-1 size-4" />
                    Submit for Approval
                  </Button>
                </>
              ) : null}

              {record.status === "pending_approval" ? (
                <>
                  <Button
                    onClick={() => approve.mutate()}
                    disabled={approve.isPending}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white"
                  >
                    <Check className="mr-1 size-4" />
                    Approve Campaign
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => setRejectOpen(true)}
                  >
                    <X className="mr-1 size-4" />
                    Reject Campaign
                  </Button>
                </>
              ) : null}

              {record.status === "approved" ? (
                <>
                  <Button
                    onClick={() => setScheduleOpen(true)}
                    variant="outline"
                  >
                    Schedule Dispatch
                  </Button>
                  <Button
                    onClick={() => dispatch.mutate()}
                    disabled={dispatch.isPending}
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    <Send className="mr-1 size-4" />
                    Dispatch Now
                  </Button>
                </>
              ) : null}

              {record.status === "scheduled" ? (
                <Button
                  onClick={() => dispatch.mutate()}
                  disabled={dispatch.isPending}
                >
                  <Send className="mr-1 size-4" />
                  Dispatch Now (Override Schedule)
                </Button>
              ) : null}

              {record.status === "sending" ? (
                <>
                  <Button
                    onClick={() => dispatch.mutate()}
                    disabled={dispatch.isPending}
                  >
                    <Send className="mr-1 size-4" />
                    Dispatch Next Batch
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => pause.mutate()}
                    disabled={pause.isPending}
                  >
                    <Pause className="mr-1 size-4" />
                    Pause Dispatch
                  </Button>
                </>
              ) : null}

              {record.status === "paused" ? (
                <Button
                  onClick={() => resume.mutate()}
                  disabled={resume.isPending}
                >
                  <Play className="mr-1 size-4" />
                  Resume Dispatch
                </Button>
              ) : null}

              {record.status !== "completed" && record.status !== "cancelled" ? (
                <Button
                  variant="outline"
                  onClick={() => cancel.mutate()}
                  disabled={cancel.isPending}
                  className="text-destructive hover:bg-destructive/10"
                >
                  <ShieldAlert className="mr-1 size-4" />
                  Cancel Unsent Campaign
                </Button>
              ) : null}
            </div>
          </WorkspaceShowCard>

          {/* Activity Log */}
          <WorkspaceShowCard title="Campaign Activity">
            {(activity.data ?? []).length === 0 ? (
              <p className="text-xs text-muted-foreground">No activity recorded.</p>
            ) : (
              <div className="space-y-3">
                {(activity.data ?? []).map((a, idx) => (
                  <div key={idx} className="border-b pb-2 text-xs last:border-b-0">
                    <div className="font-medium text-foreground">{a.action}</div>
                    <div className="flex items-center justify-between text-muted-foreground">
                      <span>{a.actor}</span>
                      <span>{formatDateTime(a.occurredAt)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </WorkspaceShowCard>
        </div>
      </WorkspaceShowLayout>

      {/* Reject Dialog */}
      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Email Campaign</DialogTitle>
            <DialogDescription>
              State the reason why this email campaign is being rejected back to draft.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Input
              placeholder="e.g. Unverified sender address or missing unsubscribe footer."
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => reject.mutate()}
              disabled={!rejectReason.trim() || reject.isPending}
            >
              Confirm Rejection
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Schedule Dialog */}
      <Dialog open={scheduleOpen} onOpenChange={setScheduleOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Schedule Email Campaign</DialogTitle>
            <DialogDescription>
              Select the future date and time for automated batch dispatch.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Input
              type="datetime-local"
              value={scheduleTime}
              onChange={(e) => setScheduleTime(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setScheduleOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => schedule.mutate()}
              disabled={!scheduleTime || schedule.isPending}
            >
              Confirm Schedule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Test Send Dialog */}
      <Dialog open={testSendOpen} onOpenChange={setTestSendOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send Test Email</DialogTitle>
            <DialogDescription>
              Dispatch a test version of this campaign with sample variable interpolation.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Input
              placeholder="e.g. tester@example.test"
              value={testRecipient}
              onChange={(e) => setTestRecipient(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTestSendOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => testSend.mutate()}
              disabled={!testRecipient || testSend.isPending}
            >
              Send Test
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </WorkspacePage>
  );
}
