import { CircleCheck } from "lucide-react";

const prioritySwatches: Record<string, string> = {
  low: "bg-sky-500",
  normal: "bg-teal-500",
  high: "bg-orange-500",
  urgent: "bg-rose-500"
};

const statusBadges: Record<string, string> = {
  new: "border-blue-600 bg-blue-600 text-white",
  open: "border-sky-500 bg-sky-500 text-slate-950",
  won: "border-emerald-500 bg-emerald-500 text-slate-950",
  lost: "border-red-600 bg-red-600 text-white",
  "hold-for-approval": "border-amber-500 bg-amber-500 text-slate-950",
  "long-hold": "border-violet-600 bg-violet-600 text-white",
  "hold-for-spares": "border-orange-500 bg-orange-500 text-slate-950",
  closed: "border-slate-600 bg-slate-600 text-white",
  "hold-for-job-out": "border-amber-500 bg-amber-500 text-slate-950",
  escalation: "border-rose-600 bg-rose-600 text-white",
  reopen: "border-blue-600 bg-blue-600 text-white",
  contacted: "border-sky-500 bg-sky-500 text-slate-950",
  qualified: "border-emerald-500 bg-emerald-500 text-slate-950",
  unqualified: "border-slate-600 bg-slate-600 text-white"
};

const statusIconColors: Record<string, string> = {
  new: "text-blue-600",
  open: "text-sky-500",
  won: "text-emerald-500",
  lost: "text-red-600",
  "hold-for-approval": "text-amber-500",
  "long-hold": "text-violet-600",
  "hold-for-spares": "text-orange-500",
  closed: "text-slate-600",
  "hold-for-job-out": "text-amber-500",
  escalation: "text-rose-600",
  reopen: "text-blue-600",
  contacted: "text-sky-500",
  qualified: "text-emerald-500",
  unqualified: "text-slate-600"
};

const statusRings: Record<string, string> = {
  new: "ring-blue-600/40",
  open: "ring-sky-500/40",
  won: "ring-emerald-500/40",
  lost: "ring-red-600/40",
  "hold-for-approval": "ring-amber-500/40",
  "long-hold": "ring-violet-600/40",
  "hold-for-spares": "ring-orange-500/40",
  closed: "ring-slate-600/40",
  "hold-for-job-out": "ring-amber-500/40",
  escalation: "ring-rose-600/40",
  reopen: "ring-blue-600/40",
  contacted: "ring-sky-500/40",
  qualified: "ring-emerald-500/40",
  unqualified: "ring-slate-600/40"
};

export function statusRing(code: string) {
  return statusRings[code] ?? "ring-slate-600/40";
}

export function prioritySwatch(code: string) {
  return prioritySwatches[code] ?? "bg-slate-500";
}

export function statusIcon(code: string) {
  return <CircleCheck className={`size-4 ${statusIconColors[code] ?? "text-slate-600"}`} />;
}

export function CrmStatusBadge({ code, label }: { code: string; label: string }) {
  return (
    <span
      className={`inline-flex min-h-6 max-w-full items-center gap-1.5 rounded-md border px-2.5 py-1 text-[11px] font-medium leading-4 ${statusBadges[code] ?? "border-slate-600 bg-slate-600 text-white"}`}
    >
      <CircleCheck aria-hidden="true" className="size-3 shrink-0" />
      <span className="min-w-0 whitespace-normal text-left">{label}</span>
    </span>
  );
}

export function CrmColorLabel({
  code,
  kind,
  label
}: {
  code: string;
  kind: "priority" | "status";
  label: string;
}) {
  return (
    <span className="inline-flex items-center gap-2">
      {kind === "status" ? (
        <span aria-hidden="true">{statusIcon(code)}</span>
      ) : (
        <span
          aria-hidden="true"
          className={`size-2.5 shrink-0 rounded-full ${prioritySwatch(code)}`}
        />
      )}
      {label}
    </span>
  );
}
