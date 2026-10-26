import { WorkspaceHeaderActions } from "@codexsun/ui/workspace/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription
} from "@codexsun/ui/components/dialog";
import { ScheduleCard } from "./scheduler.card";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BellIcon, CalendarClockIcon, PlusIcon } from "lucide-react";
import { Button } from "@codexsun/ui/components/button";
import { Card } from "@codexsun/ui/components/card";
import { Input } from "@codexsun/ui/components/input";
import { Label } from "@codexsun/ui/components/label";
import { Textarea } from "@codexsun/ui/components/textarea";
import { toast } from "sonner";
import {
  acknowledgeReminder,
  createSchedule,
  listSchedules,
  searchScheduleSources,
  sourceLabels,
  updateScheduleStatus,
  type ScheduleSourceType
} from "./scheduler.services";

export function SchedulerWorkspace({ view = "schedules" }: { view?: "schedules" | "reminders" }) {
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [sourceType, setSourceType] = useState<ScheduleSourceType>("enquiry");
  const [sourceSearch, setSourceSearch] = useState("");
  const [sourceId, setSourceId] = useState("");
  const [notes, setNotes] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const schedules = useQuery({
    queryKey: ["crm-schedules", view],
    queryFn: () => listSchedules(view)
  });
  const sources = useQuery({
    queryKey: ["crm-schedule-sources", sourceType, sourceSearch],
    queryFn: () => searchScheduleSources(sourceType, sourceSearch),
    enabled: createOpen && sourceSearch.trim().length > 0
  });
  const refresh = async () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ["crm-schedules"] }),
      queryClient.invalidateQueries({ queryKey: ["crm-due-reminders"] })
    ]);
  const create = useMutation({
    mutationFn: createSchedule,
    onSuccess: async () => {
      toast.success("Schedule saved");
      setCreateOpen(false);
      setNotes("");
      setSourceId("");
      setSourceSearch("");
      setScheduledAt("");
      await refresh();
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Could not schedule reminder")
  });
  const changeStatus = useMutation({
    mutationFn: ({ id, status }: { id: number; status: "completed" | "cancelled" }) =>
      updateScheduleStatus(id, status),
    onSuccess: refresh,
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Could not update schedule")
  });
  const acknowledge = useMutation({
    mutationFn: acknowledgeReminder,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["crm-schedules"] }),
        queryClient.invalidateQueries({ queryKey: ["crm-due-reminders"] })
      ]);
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Could not dismiss reminder")
  });
  const rows = schedules.data ?? [];
  const activeCount = useMemo(
    () => rows.filter((item) => item.status === "scheduled").length,
    [rows]
  );
  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!notes.trim() || !sourceId || !scheduledAt) {
      toast.error("Complete the notes, linked record, and schedule date and time.");
      return;
    }
    create.mutate({
      notes: notes.trim(),
      sourceType,
      sourceId: Number(sourceId),
      scheduledAt: new Date(scheduledAt).toISOString()
    });
  };

  return (
    <div className="mx-auto w-full max-w-6xl space-y-5 px-4 py-5 sm:px-6">
      <WorkspaceHeaderActions>
        <Button
          size="sm"
          className="h-7 px-3"
          onClick={() => {
            create.reset();
            setCreateOpen(true);
          }}
        >
          <PlusIcon className="size-4" /> New reminder
        </Button>
      </WorkspaceHeaderActions>
      <header className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-violet-200 bg-gradient-to-r from-violet-50 to-white px-5 py-4 shadow-sm">
        <div className="flex items-center gap-3">
          <span className="grid size-11 place-items-center rounded-lg bg-violet-100 text-violet-700">
            <BellIcon className="size-5" />
          </span>
          <div>
            <h1 className="text-xl font-semibold text-slate-900">
              {view === "reminders" ? "Reminders" : "Schedules"}
            </h1>
            <p className="text-sm text-slate-600">
              Linked follow-ups for enquiries, tasks, calls, duties, and SOPs.
            </p>
          </div>
        </div>
        <div className="rounded-lg border bg-white px-3 py-2 text-sm text-slate-600">
          <span className="font-semibold text-slate-900">{activeCount}</span> upcoming
        </div>
      </header>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>New reminder</DialogTitle>
            <DialogDescription>Schedule a follow-up linked to a CRM record.</DialogDescription>
          </DialogHeader>
          <form className="grid gap-4 sm:grid-cols-2" onSubmit={submit}>
            <div className="space-y-1.5">
              <Label htmlFor="schedule-at">Scheduled for</Label>
              <Input
                id="schedule-at"
                type="datetime-local"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="schedule-notes">Notes</Label>
              <Textarea
                id="schedule-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                maxLength={10000}
                required
                placeholder="What needs to be done?"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="schedule-source-type">Linked module</Label>
              <select
                id="schedule-source-type"
                className="h-11 w-full rounded-md border bg-white px-3 text-sm"
                value={sourceType}
                onChange={(e) => {
                  setSourceType(e.target.value as ScheduleSourceType);
                  setSourceId("");
                  setSourceSearch("");
                }}
              >
                {Object.entries(sourceLabels).map(([key, label]) => (
                  <option value={key} key={key}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="schedule-source">Find linked record</Label>
              <Input
                id="schedule-source"
                value={sourceSearch}
                onChange={(e) => {
                  setSourceSearch(e.target.value);
                  setSourceId("");
                }}
                placeholder={`Search ${sourceLabels[sourceType].toLowerCase()} records`}
              />
              {sources.data && (
                <div className="max-h-36 overflow-auto rounded-md border bg-white shadow-sm">
                  {sources.data.length ? (
                    sources.data.map((source) => (
                      <button
                        type="button"
                        key={source.id}
                        className={`block w-full border-b px-3 py-2 text-left text-sm hover:bg-violet-50 ${sourceId === String(source.id) ? "bg-violet-50 text-violet-800" : ""}`}
                        onClick={() => {
                          setSourceId(String(source.id));
                          setSourceSearch(source.label);
                        }}
                      >
                        {source.label}
                      </button>
                    ))
                  ) : (
                    <p className="p-3 text-sm text-slate-500">No matching records</p>
                  )}
                </div>
              )}
              {sourceId && (
                <p className="text-xs text-emerald-700">
                  Linked to selected {sourceLabels[sourceType].toLowerCase()}
                </p>
              )}
            </div>
            <div className="flex items-end">
              <Button
                type="submit"
                disabled={create.isPending || !sourceId}
                className="bg-violet-700 hover:bg-violet-800"
              >
                <CalendarClockIcon className="mr-2 size-4" />
                {create.isPending ? "Saving…" : "Save schedule"}
              </Button>
            </div>
            <Button
              type="button"
              variant="outline"
              disabled={create.isPending}
              onClick={() => setCreateOpen(false)}
            >
              Cancel
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <section className="space-y-3">
        {schedules.isLoading ? (
          <Card className="p-8 text-center text-sm text-slate-500">Loading schedules…</Card>
        ) : schedules.isError ? (
          <Card className="p-8 text-center text-sm text-red-600">
            Schedules could not be loaded.
          </Card>
        ) : rows.length === 0 ? (
          <Card className="p-10 text-center">
            <BellIcon className="mx-auto mb-2 size-6 text-violet-400" />
            <p className="font-medium">No {view === "reminders" ? "reminders" : "schedules"} yet</p>
            <p className="mt-1 text-sm text-slate-500">
              Create a reminder linked to a CRM record to see it here.
            </p>
          </Card>
        ) : (
          rows.map((item) => (
            <ScheduleCard
              key={item.id}
              item={item}
              onRescheduled={refresh}
              onStatus={(status) => changeStatus.mutate({ id: item.id, status })}
              onAcknowledge={() => acknowledge.mutate(item.id)}
            />
          ))
        )}
      </section>
    </div>
  );
}
