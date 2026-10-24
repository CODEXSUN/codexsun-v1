import { useState } from "react";
import { Button } from "@codexsun/ui/components/button";
import { startBusinessImport } from "./business-import.services.js";
export function BusinessImportAction({
  sourceId,
  targetTenantId,
  enabled,
  onOpen
}: {
  sourceId: number;
  targetTenantId: number;
  enabled: boolean;
  onOpen: (id: string) => void;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function start() {
    setBusy(true);
    setError("");
    try {
      const report = await startBusinessImport(sourceId, targetTenantId);
      onOpen(report.id);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to queue import.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="mt-4">
      <Button disabled={!enabled || busy} onClick={() => void start()}>
        {busy ? "Queuing business import…" : "Audit and import missing business data"}
      </Button>
      <p className="mt-2 text-sm text-muted-foreground">
        Common → Masters → Billing. Preserve existing records and deleted history; verify invoices
        and children. Reuse verified company seeds for single-company sources. Copy missing users
        with their existing password hashes and standard User-role access.
      </p>
      {error ? (
        <p role="alert" className="mt-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
