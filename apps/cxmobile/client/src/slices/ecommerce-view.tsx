import React, { useState } from "react";
import { CameraIcon, PlusIcon, ShoppingBagIcon } from "lucide-react";
import { useNativeSession } from "../app/native-session-provider.js";
import { executeStep5EcommerceDraft } from "./ecommerce-slice.js";

export function EcommerceView() {
  const { transport } = useNativeSession();
  const [loading, setLoading] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const [storefrontTitle, setStorefrontTitle] = useState("High Torque Brushless Motor 24V");

  async function handleSaveDraft() {
    setLoading(true);
    try {
      setLog((prev) => [...prev, `Uploading draft item & image for '${storefrontTitle}'...`]);
      const res = await executeStep5EcommerceDraft(transport, {
        storefrontTitle
      });
      setLog((prev) => [
        ...prev,
        `✓ ${res.message}`,
        `  Draft ID: #${res.data.draftId} | Status: '${res.data.publicationStatus}' (Unpublished) | Image URL: ${res.data.imageUrl}`
      ]);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setLog((prev) => [...prev, `✗ Ecommerce Error: ${msg}`]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-4">
        <h2 className="text-base font-semibold text-slate-100 flex items-center gap-2">
          <ShoppingBagIcon className="size-4 text-amber-400" />
          Ecommerce Catalogue Drafts
        </h2>
        <p className="text-xs text-slate-400 mt-1">
          Draft catalogue items, upload product photos, and verify unpublished draft states.
        </p>

        <div className="mt-3 flex flex-col gap-2">
          <label className="text-xs text-slate-300">
            Product Storefront Title
            <input
              type="text"
              value={storefrontTitle}
              onChange={(e) => setStorefrontTitle(e.target.value)}
              className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-slate-200"
            />
          </label>

          <div className="flex items-center gap-2 rounded border border-slate-800 bg-slate-950/60 px-3 py-2 text-xs text-slate-300">
            <CameraIcon className="size-3.5 text-amber-400" />
            <span>Product Photo: <strong>product-draft-photo.png</strong></span>
          </div>

          <div className="text-[11px] text-slate-400">
            State: <span className="text-amber-300 font-semibold">Unpublished (draft)</span> until verified and reviewed.
          </div>

          <button
            type="button"
            onClick={handleSaveDraft}
            disabled={loading}
            className="mt-2 flex items-center justify-center gap-1.5 rounded bg-amber-600 px-3 py-2 text-xs font-medium text-white hover:bg-amber-500 disabled:opacity-50"
          >
            <PlusIcon className="size-3.5" />
            {loading ? "Saving Draft..." : "Save Product Draft with Image"}
          </button>
        </div>
      </div>

      {log.length > 0 && (
        <div className="rounded-lg border border-slate-800 bg-slate-950 p-3 font-mono text-[11px] text-slate-300">
          <div className="text-slate-400 font-semibold mb-1 flex items-center gap-1">
            <ShoppingBagIcon className="size-3" /> Ecommerce Log:
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
