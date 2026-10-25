import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@codexsun/ui/components/button";
import { Input } from "@codexsun/ui/components/input";
import { WorkspacePage } from "@codexsun/ui/workspace/page";
import { WorkspaceSwitchCard } from "@codexsun/ui/workspace/status";
import { formatDateTime } from "@codexsun/ui/workspace";
import { toast } from "sonner";
import { frappeRequest } from "../../frappe-request";

type Availability = {
  scheduleEnabled: boolean;
  timezone: string;
  opensAt: string;
  closesAt: string;
  status: "unknown" | "online" | "offline" | "closed";
  lastCheckedAt: string | null;
  nextCheckAt: string | null;
  reason: string | null;
};
const key = ["frappe", "availability"];
const labels = {
  unknown: "Connection check pending",
  online: "Online",
  offline: "Offline · sync waiting",
  closed: "Outside server hours · sync waiting"
};
export function FrappeAvailabilityWorkspace() {
  const client = useQueryClient();
  const query = useQuery({
    queryKey: key,
    queryFn: () => frappeRequest<Availability>("GET", "/frappe/availability"),
    refetchInterval: 15000
  });
  const [draft, setDraft] = useState<Availability | null>(null);
  useEffect(() => {
    if (query.data) setDraft((current) => current ?? query.data!);
  }, [query.data]);
  const save = useMutation({
    mutationFn: () =>
      frappeRequest<Availability>("PUT", "/frappe/availability", {
        scheduleEnabled: draft!.scheduleEnabled,
        timezone: draft!.timezone,
        opensAt: draft!.opensAt,
        closesAt: draft!.closesAt
      }),
    onSuccess: async (result) => {
      setDraft(result);
      await client.invalidateQueries({ queryKey: key });
      toast.success("Frappe server hours saved");
    },
    onError: (error) => toast.error(error.message)
  });
  const check = useMutation({
    mutationFn: () => frappeRequest<Availability>("POST", "/frappe/availability/check", {}),
    onSuccess: (result) => client.setQueryData(key, result),
    onError: (error) => toast.error(error.message)
  });
  return (
    <WorkspacePage
      title="Server availability"
      description="Set when this tenant's Frappe server is available for sync."
      technicalName="page.frappe.availability"
    >
      {query.error ? (
        <p role="alert" className="text-destructive">
          {query.error.message}
        </p>
      ) : null}
      {draft ? (
        <form
          className="max-w-3xl space-y-5 rounded-md border bg-card p-5"
          onSubmit={(event) => {
            event.preventDefault();
            save.mutate();
          }}
        >
          <WorkspaceSwitchCard
            label="Use server hours"
            description="Hold sync outside these hours. Local CRM work remains available."
            checked={draft.scheduleEnabled}
            onCheckedChange={(value) => setDraft({ ...draft, scheduleEnabled: value })}
          />
          <div className="grid gap-4 sm:grid-cols-3">
            <label className="space-y-1 text-sm">
              Timezone
              <Input
                aria-label="Timezone"
                value={draft.timezone}
                onChange={(event) => setDraft({ ...draft, timezone: event.target.value })}
                required
              />
            </label>
            <label className="space-y-1 text-sm">
              Server starts at
              <Input
                aria-label="Server starts at"
                type="time"
                value={draft.opensAt}
                onChange={(event) => setDraft({ ...draft, opensAt: event.target.value })}
                required
              />
            </label>
            <label className="space-y-1 text-sm">
              Server stops at
              <Input
                aria-label="Server stops at"
                type="time"
                value={draft.closesAt}
                onChange={(event) => setDraft({ ...draft, closesAt: event.target.value })}
                required
              />
            </label>
          </div>
          <p className="text-sm text-muted-foreground">
            Each day, sync waits outside this window. If the server starts late, connection checks
            run at most once every five minutes until it is online. Pending work and the last
            successful import checkpoint are preserved.
          </p>
          <div className="flex items-center justify-between gap-3">
            <Button type="submit" disabled={save.isPending}>
              Save server hours
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={check.isPending}
              onClick={() => check.mutate()}
            >
              Check connection
            </Button>
          </div>
          <section
            className="space-y-2 border-t pt-4 text-sm"
            aria-label="Frappe availability status"
          >
            <p
              role="status"
              className={
                query.data?.status === "online" ? "text-emerald-700" : "text-muted-foreground"
              }
            >
              {labels[query.data?.status ?? "unknown"]}
            </p>
            {query.data?.reason ? <p>{query.data.reason}</p> : null}
            <p>
              Last connection check:{" "}
              {query.data?.lastCheckedAt ? formatDateTime(query.data.lastCheckedAt) : "Not checked"}
            </p>
            <p>
              Next check or session:{" "}
              {query.data?.nextCheckAt
                ? formatDateTime(query.data.nextCheckAt)
                : "When sync is due"}
            </p>
          </section>
        </form>
      ) : (
        <p className="text-sm text-muted-foreground">Loading server availability…</p>
      )}
    </WorkspacePage>
  );
}
