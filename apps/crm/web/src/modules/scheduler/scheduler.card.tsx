import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { CircleCheckIcon, Clock3Icon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@codexsun/ui/components/button";
import { Card } from "@codexsun/ui/components/card";
import { Input } from "@codexsun/ui/components/input";
import { rescheduleReminder, sourceLabels, type ScheduleRecord } from "./scheduler.services";

export function ScheduleCard({
  item,
  onStatus,
  onAcknowledge,
  onRescheduled
}: {
  item: ScheduleRecord;
  onStatus: (status: "completed" | "cancelled") => void;
  onAcknowledge: () => void;
  onRescheduled: () => Promise<unknown>;
}) {
  const [editing, setEditing] = useState(false);
  const [dateTime, setDateTime] = useState(() => {
    const date = new Date(item.scheduledAt);
    return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  });
  const save = useMutation({
    mutationFn: () => rescheduleReminder(item.id, new Date(dateTime).toISOString()),
    onSuccess: async () => {
      await onRescheduled();
      setEditing(false);
      toast.success("Reminder rescheduled");
    }
  });
  const due = new Date(item.scheduledAt);
  const href =
    item.sourceType === "enquiry"
      ? `/app/crm/enquiries/${item.sourceId}`
      : item.sourceType === "task"
        ? `/app/crm/tasks/${item.sourceId}`
        : item.sourceType === "call-log"
          ? "/app/crm/call-logs"
          : item.sourceType === "duty"
            ? "/app/crm/duties"
            : "/app/crm/sops";
  return (
    <Card className="border-slate-200 p-4 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-semibold text-slate-900">
              <a className="hover:underline" href={href}>
                {sourceLabels[item.sourceType]} ·{" "}
                {item.sourceLabel.replace(/^(#[0-9]+) · /, "$1 : ")}
              </a>
            </h2>
            <span
              className={`rounded-full px-2 py-0.5 text-xs ${item.status === "scheduled" ? "bg-violet-100 text-violet-800" : item.status === "completed" ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-600"}`}
            >
              {item.status}
            </span>
            {item.acknowledgedAt && (
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                Reminder dismissed
              </span>
            )}
          </div>
          <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{item.notes}</p>
          <p className="mt-2 flex items-center gap-1.5 text-xs text-slate-500">
            <Clock3Icon className="size-3.5" />
            {due.toLocaleString()}
          </p>
        </div>
        {item.status === "scheduled" && (
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                save.reset();
                setEditing(true);
              }}
            >
              Edit
            </Button>
            {!item.acknowledgedAt && (
              <Button size="sm" variant="outline" onClick={onAcknowledge}>
                Dismiss reminder
              </Button>
            )}
            <Button size="sm" variant="outline" onClick={() => onStatus("completed")}>
              <CircleCheckIcon className="mr-1 size-4" />
              Done
            </Button>
            <Button size="sm" variant="outline" onClick={() => onStatus("cancelled")}>
              Cancel
            </Button>
          </div>
        )}
      </div>
      {editing && (
        <form
          className="mt-3 flex flex-wrap items-end gap-2 border-t pt-3"
          onSubmit={(event) => {
            event.preventDefault();
            save.mutate();
          }}
        >
          <label className="text-sm">
            Reschedule date and time
            <Input
              type="datetime-local"
              required
              value={dateTime}
              onChange={(event) => setDateTime(event.target.value)}
            />
          </label>
          <Button type="submit" disabled={save.isPending}>
            Save
          </Button>
          <Button
            type="button"
            variant="ghost"
            disabled={save.isPending}
            onClick={() => setEditing(false)}
          >
            Cancel edit
          </Button>
          {save.error && (
            <p role="alert" className="w-full text-sm text-destructive">
              {save.error.message}
            </p>
          )}
        </form>
      )}
    </Card>
  );
}
