import { useState, type ReactNode } from "react";
import {
  MessageSquare,
  Send,
  UserCheck,
  Bot,
  CheckCircle,
  Clock,
  AlertTriangle
} from "lucide-react";
import { Button } from "@codexsun/ui/components/button";
import { Textarea } from "@codexsun/ui/components/textarea";
import { WorkspacePage } from "@codexsun/ui/workspace/page";
import { WorkspaceDetailTable } from "@codexsun/ui/workspace/show";
import { WorkspaceStatusBadge } from "@codexsun/ui/workspace/status";
import { formatDateTime } from "@codexsun/ui/workspace/utils";
import type {
  ConversationActivity,
  NurtureEnrollmentRecord,
  ThreadDetailRecord
} from "./conversation.types";

const APPROVED_TEMPLATES = [
  "marketing_welcome_followup",
  "customer_inquiry_confirmation",
  "appointment_reminder_v1",
  "promo_optin_update"
];

export function ConversationShow({
  record,
  activity,
  nurtureEnrollment,
  onBack,
  onSendMessage,
  onToggleTakeover,
  onUpdateStatus,
  onStopNurture,
  sending = false
}: {
  record: ThreadDetailRecord;
  activity: ConversationActivity[];
  nurtureEnrollment: NurtureEnrollmentRecord | null;
  onBack: () => void;
  onSendMessage: (content: string, templateName?: string | null) => Promise<void>;
  onToggleTakeover: (enabled: boolean) => Promise<void>;
  onUpdateStatus: (status: "open" | "resolved" | "closed") => Promise<void>;
  onStopNurture: (reason: string) => Promise<void>;
  sending?: boolean;
}) {
  const [content, setContent] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState<string>("");
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;

    if (!record.inServiceWindow && !selectedTemplate) {
      setErrorBanner("Outside 24-hour service window. An approved WhatsApp template is required.");
      return;
    }

    try {
      setErrorBanner(null);
      await onSendMessage(content.trim(), selectedTemplate || null);
      setContent("");
      setSelectedTemplate("");
    } catch (err: unknown) {
      setErrorBanner(err instanceof Error ? err.message : "Failed to send message");
    }
  };

  const details: [string, ReactNode][] = [
    ["Contact / Phone", record.contactIdentifier],
    ["Contact Name", record.contactName || "—"],
    ["Channel", <span className="capitalize">{record.channel}</span>],
    [
      "Status",
      <WorkspaceStatusBadge
        key="status"
        tone={record.status === "open" ? "success" : "neutral"}
        label={record.status.charAt(0).toUpperCase() + record.status.slice(1)}
      />
    ],
    [
      "24h Service Window",
      record.inServiceWindow ? (
        <span className="inline-flex items-center gap-1 text-xs font-medium text-green-600">
          <Clock className="h-3.5 w-3.5" /> Inside 24h Window
        </span>
      ) : (
        <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-600">
          <AlertTriangle className="h-3.5 w-3.5" /> Window Expired (Template Only)
        </span>
      )
    ],
    [
      "Human Takeover",
      record.isHumanTakeover ? (
        <span className="inline-flex items-center gap-1 text-xs font-medium text-purple-600">
          <UserCheck className="h-3.5 w-3.5" /> Active (Bot Paused)
        </span>
      ) : (
        <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground">
          <Bot className="h-3.5 w-3.5" /> Bot Active
        </span>
      )
    ],
    ["Last Customer Inbound", record.lastInboundAt ? formatDateTime(record.lastInboundAt) : "None"],
    ["Last Message", record.lastMessageAt ? formatDateTime(record.lastMessageAt) : "—"],
    ["Created", formatDateTime(record.createdAt)]
  ];

  return (
    <WorkspacePage
      title={`Conversation: ${record.contactIdentifier}`}
      description={record.contactName ? `Customer: ${record.contactName}` : "WhatsApp Thread"}
      onBack={onBack}
    >
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (2 cols wide): Chat Bubble Stream & Reply Composer */}
        <div className="lg:col-span-2 flex flex-col rounded-lg border bg-card shadow-sm h-[680px]">
          {/* Chat Header Bar */}
          <div className="flex items-center justify-between border-b px-4 py-3 bg-muted/20">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-muted-foreground" />
              <div>
                <span className="font-semibold text-sm">{record.contactIdentifier}</span>
                {record.contactName && (
                  <span className="ml-2 text-xs text-muted-foreground">({record.contactName})</span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant={record.isHumanTakeover ? "secondary" : "outline"}
                size="sm"
                onClick={() => onToggleTakeover(!record.isHumanTakeover)}
                className="gap-1.5 text-xs h-8"
              >
                {record.isHumanTakeover ? (
                  <>
                    <UserCheck className="h-3.5 w-3.5 text-purple-600" />
                    <span>Human Takeover</span>
                  </>
                ) : (
                  <>
                    <Bot className="h-3.5 w-3.5 text-muted-foreground" />
                    <span>Take Over</span>
                  </>
                )}
              </Button>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onUpdateStatus(record.status === "resolved" ? "open" : "resolved")}
                className="gap-1 text-xs h-8"
              >
                <CheckCircle className="h-3.5 w-3.5" />
                {record.status === "resolved" ? "Reopen" : "Resolve"}
              </Button>
            </div>
          </div>

          {/* Chat Messages Body */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {record.messages.length === 0 ? (
              <div className="py-20 text-center text-sm text-muted-foreground">
                No messages in this conversation yet. Send a message below.
              </div>
            ) : (
              record.messages.map((m) => {
                const isInbound = m.direction === "inbound";
                return (
                  <div
                    key={m.uuid}
                    className={`flex flex-col ${isInbound ? "items-start" : "items-end"}`}
                  >
                    <div
                      className={`max-w-[80%] rounded-lg px-4 py-2 text-sm shadow-sm ${
                        isInbound
                          ? "bg-muted text-foreground border"
                          : "bg-primary text-primary-foreground"
                      }`}
                    >
                      {m.templateName && (
                        <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider opacity-80">
                          Template: {m.templateName}
                        </div>
                      )}
                      <p className="whitespace-pre-wrap">{m.content}</p>
                    </div>
                    <span className="mt-1 text-[10px] text-muted-foreground">
                      {formatDateTime(m.createdAt)} • {m.sender}
                    </span>
                  </div>
                );
              })
            )}
          </div>

          {/* Reply Box */}
          <form onSubmit={handleSend} className="border-t p-3 bg-muted/10 space-y-2">
            {errorBanner && (
              <div className="rounded border border-destructive/20 bg-destructive/10 p-2 text-xs text-destructive">
                {errorBanner}
              </div>
            )}

            {!record.inServiceWindow && (
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-amber-600 flex items-center gap-1">
                  <AlertTriangle className="h-3.5 w-3.5" /> Template required:
                </span>
                <select
                  value={selectedTemplate}
                  onChange={(e) => {
                    setSelectedTemplate(e.target.value);
                    if (e.target.value) {
                      setContent(`[Template: ${e.target.value}] Hello from our team.`);
                    }
                  }}
                  className="rounded-md border border-input bg-background px-2.5 py-1 text-xs focus:ring-1 focus:ring-ring"
                >
                  <option value="">Select an approved WhatsApp template</option>
                  {APPROVED_TEMPLATES.map((tmpl) => (
                    <option key={tmpl} value={tmpl}>
                      {tmpl}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="flex items-center gap-2">
              <Textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder={
                  record.inServiceWindow
                    ? "Type your message..."
                    : "Select a WhatsApp template above or type template message..."
                }
                className="min-h-[50px] max-h-[100px] text-sm resize-none"
              />
              <Button
                type="submit"
                disabled={sending || !content.trim()}
                className="gap-1.5 h-10 px-4"
              >
                <Send className="h-4 w-4" />
                <span>Send</span>
              </Button>
            </div>
          </form>
        </div>

        {/* Right Column: Metadata, Nurture Status & Activity */}
        <div className="space-y-6">
          {/* Details Card */}
          <div className="rounded-lg border bg-card p-4 shadow-sm">
            <h3 className="font-semibold text-sm mb-3">Thread Details</h3>
            <WorkspaceDetailTable rows={details} />
          </div>

          {/* Nurture Status Card (Gate E20) */}
          <div className="rounded-lg border bg-card p-4 shadow-sm">
            <h3 className="font-semibold text-sm mb-3">Nurture Automation</h3>
            {nurtureEnrollment ? (
              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Status:</span>
                  <WorkspaceStatusBadge
                    tone={nurtureEnrollment.status === "active" ? "success" : "neutral"}
                    label={nurtureEnrollment.status}
                  />
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Current Step:</span>
                  <span className="font-semibold">{nurtureEnrollment.stepNumber}</span>
                </div>
                {nurtureEnrollment.stopReason && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Stop Reason:</span>
                    <span className="font-medium text-amber-600">
                      {nurtureEnrollment.stopReason}
                    </span>
                  </div>
                )}
                {nurtureEnrollment.status === "active" && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-full mt-2 text-destructive hover:bg-destructive/10"
                    onClick={() => onStopNurture("manual")}
                  >
                    Halt Automation Sequence
                  </Button>
                )}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                No automated sequence enrolled for this contact.
              </p>
            )}
          </div>

          {/* Activity Stream */}
          <div className="rounded-lg border bg-card p-4 shadow-sm">
            <h3 className="font-semibold text-sm mb-3">Activity History</h3>
            <div className="space-y-2 text-xs">
              {activity.length === 0 ? (
                <p className="text-muted-foreground">No activity recorded.</p>
              ) : (
                activity.slice(0, 10).map((act, idx) => (
                  <div key={idx} className="flex flex-col border-b pb-1.5 last:border-0">
                    <span className="font-medium text-foreground">{act.action}</span>
                    <span className="text-[10px] text-muted-foreground">
                      {act.actor} • {formatDateTime(act.occurredAt)}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </WorkspacePage>
  );
}
