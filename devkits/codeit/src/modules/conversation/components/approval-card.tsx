/**
 * Approval Card Component
 * Surfaces operator approval gates for capability execution and bounded permissions.
 */

import { useState } from "react";
import { CheckIcon, ClockIcon, ShieldAlertIcon, ShieldCheckIcon, XIcon } from "lucide-react";
import { Badge } from "@codexsun/ui/components/badge";
import { Button } from "@codexsun/ui/components/button";
import { Approval, ApprovalDecision, formatCodeitDateTime } from "../conversation.types";

interface ApprovalCardProps {
  approval: Approval;
  onDecide?:
    ((approvalUuid: string, decision: ApprovalDecision) => Promise<void> | void) | undefined;
  className?: string | undefined;
}

export function ApprovalCard({ approval, onDecide, className = "" }: ApprovalCardProps) {
  const [submitting, setSubmitting] = useState(false);

  const handleDecision = async (decision: ApprovalDecision) => {
    if (!onDecide || submitting) return;
    setSubmitting(true);
    try {
      await onDecide(approval.uuid, decision);
    } finally {
      setSubmitting(false);
    }
  };

  const isDecided = approval.decision !== undefined;

  return (
    <div
      className={`rounded-lg border border-amber-500/30 bg-amber-500/5 p-3.5 shadow-xs dark:bg-amber-500/10 ${className}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="flex size-7 items-center justify-center rounded-md bg-amber-500/20 text-amber-600 dark:text-amber-400">
            <ShieldAlertIcon className="size-4" />
          </div>
          <div>
            <span className="text-xs font-semibold text-foreground">
              Operator Approval Required
            </span>
            <p className="font-mono text-[10px] text-muted-foreground">
              Digest: {approval.action_digest.substring(0, 16)}...
            </p>
          </div>
        </div>

        {isDecided ? (
          approval.decision === "approved" ? (
            <Badge
              variant="outline"
              className="gap-1 border-green-500/40 bg-green-500/10 text-green-600 dark:text-green-400"
            >
              <ShieldCheckIcon className="size-3" />
              Approved
            </Badge>
          ) : (
            <Badge
              variant="outline"
              className="gap-1 border-red-500/40 bg-red-500/10 text-red-600 dark:text-red-400"
            >
              <ShieldAlertIcon className="size-3" />
              Denied
            </Badge>
          )
        ) : (
          <Badge
            variant="outline"
            className="gap-1 border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400"
          >
            <ClockIcon className="size-3" />
            Pending Decision
          </Badge>
        )}
      </div>

      <div className="mt-2.5 rounded-md bg-card/60 p-2 text-xs text-muted-foreground">
        <div className="grid grid-cols-2 gap-1.5 text-[11px]">
          <div>
            <span className="font-medium text-foreground">Actor: </span>
            {approval.actor}
          </div>
          <div>
            <span className="font-medium text-foreground">Expires: </span>
            {formatCodeitDateTime(approval.expiry)}
          </div>
        </div>

        {Object.keys(approval.constraints).length > 0 ? (
          <div className="mt-2 border-t border-border pt-1.5 font-mono text-[10px]">
            <span className="font-sans font-medium text-foreground">Constraints:</span>
            <pre className="mt-0.5 max-h-24 overflow-x-auto rounded-xs bg-muted/50 p-1">
              {JSON.stringify(approval.constraints, null, 2)}
            </pre>
          </div>
        ) : null}
      </div>

      {!isDecided ? (
        <div className="mt-3 flex items-center justify-end gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-7 gap-1 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={() => handleDecision("denied")}
            disabled={submitting}
          >
            <XIcon className="size-3" />
            Deny
          </Button>
          <Button
            size="sm"
            className="h-7 gap-1 bg-green-600 text-xs text-white hover:bg-green-700 dark:bg-green-600 dark:hover:bg-green-700"
            onClick={() => handleDecision("approved")}
            disabled={submitting}
          >
            <CheckIcon className="size-3" />
            Approve Action
          </Button>
        </div>
      ) : null}
    </div>
  );
}
