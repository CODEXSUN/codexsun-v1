import React, { useState } from "react";
import { MessageSquareIcon, PlusIcon, UserCheckIcon } from "lucide-react";
import { useNativeSession } from "../app/native-session-provider.js";
import { executeStep2CrmEnquiry } from "./crm-slice.js";

export function CrmView() {
  const { transport } = useNativeSession();
  const [loading, setLoading] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const [customerName, setCustomerName] = useState("Alpha Heavy Industries");
  const [mobile, setMobile] = useState("9876500001");
  const [requirements, setRequirements] = useState("Supply of 200 industrial servo valves");

  async function handleRunCrm() {
    setLoading(true);
    try {
      setLog((prev) => [...prev, `Submitting CRM Enquiry for ${customerName}...`]);
      const res = await executeStep2CrmEnquiry(transport, {
        customerName,
        mobile,
        requirements
      });
      setLog((prev) => [
        ...prev,
        `✓ ${res.message}`,
        `  Enquiry ID: ${res.data.enquiryId} | Assigned to: ${res.data.assignedUserId} | Comments: ${res.data.reloadedCommentsCount}`
      ]);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setLog((prev) => [...prev, `✗ CRM Error: ${msg}`]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-4">
        <h2 className="text-base font-semibold text-slate-100 flex items-center gap-2">
          <UserCheckIcon className="size-4 text-sky-400" />
          CRM Enquiries
        </h2>
        <p className="text-xs text-slate-400 mt-1">
          Capture client leads, assign sales reps, track follow-up comments, and reload state.
        </p>

        <div className="mt-3 flex flex-col gap-2">
          <label className="text-xs text-slate-300">
            Customer / Company Name
            <input
              type="text"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-slate-200"
            />
          </label>

          <label className="text-xs text-slate-300">
            Mobile Number
            <input
              type="text"
              value={mobile}
              onChange={(e) => setMobile(e.target.value)}
              className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-slate-200"
            />
          </label>

          <label className="text-xs text-slate-300">
            Requirements
            <textarea
              rows={2}
              value={requirements}
              onChange={(e) => setRequirements(e.target.value)}
              className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-slate-200"
            />
          </label>

          <button
            type="button"
            onClick={handleRunCrm}
            disabled={loading}
            className="mt-2 flex items-center justify-center gap-1.5 rounded bg-sky-600 px-3 py-2 text-xs font-medium text-white hover:bg-sky-500 disabled:opacity-50"
          >
            <PlusIcon className="size-3.5" />
            {loading ? "Processing Enquiry..." : "Create, Assign & Comment Enquiry"}
          </button>
        </div>
      </div>

      {log.length > 0 && (
        <div className="rounded-lg border border-slate-800 bg-slate-950 p-3 font-mono text-[11px] text-slate-300">
          <div className="text-slate-400 font-semibold mb-1 flex items-center gap-1">
            <MessageSquareIcon className="size-3" /> Execution Log:
          </div>
          {log.map((line, i) => (
            <div key={i} className="py-0.5 whitespace-pre-wrap">
              {line}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
