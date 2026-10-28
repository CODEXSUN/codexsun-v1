import { useEffect, useState } from "react";
import { Button } from "@codexsun/ui/components/button";
import { Input } from "@codexsun/ui/components/input";
import { WorkspaceSelect } from "@codexsun/ui/workspace/select";
import { WorkspaceUpsertDialog, WorkspaceFormBanner } from "@codexsun/ui/workspace/upsert";
import { useMarketingTransport } from "../../transport";
import type { SubmissionInput } from "./submission.types";
import {
  importFields,
  mapImport,
  readImport,
  type ImportMapping,
  type ImportSource
} from "./submission.import-data";
type ImportSession = { uuid: string; filename: string; total: number; completed: number };
export function SubmissionImport({
  onClose,
  onSaved
}: {
  onClose: () => void;
  onSaved: () => void;
}) {
  const api = useMarketingTransport();
  const [rows, setRows] = useState<SubmissionInput[]>([]),
    [source, setSource] = useState<ImportSource | null>(null),
    [filename, setFilename] = useState(""),
    [sessions, setSessions] = useState<ImportSession[]>([]),
    [session, setSession] = useState<ImportSession | null>(null),
    [mapping, setMapping] = useState<ImportMapping>({} as ImportMapping),
    [issue, setIssue] = useState(""),
    [running, setRunning] = useState(false),
    [completed, setCompleted] = useState(0);
  useEffect(() => {
    let active = true;
    api
      .get<ImportSession[]>("/marketing/submission-imports")
      .then((items) => {
        if (active) setSessions(items);
      })
      .catch((error: unknown) => {
        if (active)
          setIssue(error instanceof Error ? error.message : "Unable to load import sessions.");
      });
    return () => {
      active = false;
    };
  }, [api]);
  async function preview(file: File | undefined) {
    setRows([]);
    setSource(null);
    setIssue("");
    setCompleted(0);
    if (!file) return;
    setFilename(file.name.slice(0, 191));
    if (file.size > 262144) {
      setIssue("Use a CSV or JSON file smaller than 256 KB.");
      return;
    }
    try {
      const parsed = readImport(await file.text(), file.name.toLowerCase().endsWith(".csv"));
      setSource(parsed);
      setMapping(
        Object.fromEntries(
          importFields.map((field) => [field, parsed.columns.includes(field) ? field : ""])
        ) as ImportMapping
      );
    } catch (error) {
      setIssue(error instanceof Error ? error.message : "Unable to read the import.");
    }
  }
  function validate() {
    if (!source) return;
    setIssue("");
    setRows([]);
    setCompleted(0);
    try {
      setRows(mapImport(source, mapping));
    } catch (error) {
      setIssue(error instanceof Error ? error.message : "Unable to validate the import.");
    }
  }
  async function run() {
    setRunning(true);
    setIssue("");
    try {
      let current =
        session ??
        (await api.post<ImportSession>("/marketing/submission-imports", {
          filename,
          mapping,
          rows
        }));
      setSession(current);
      while (current.completed < current.total) {
        current = await api.post<ImportSession>(
          `/marketing/submission-imports/${current.uuid}/advance`,
          {}
        );
        setSession(current);
        setCompleted(current.completed);
      }
      onSaved();
    } catch (error) {
      setIssue(error instanceof Error ? error.message : "Import failed.");
    } finally {
      setRunning(false);
    }
  }
  async function cancelImport(item: ImportSession) {
    setRunning(true);
    setIssue("");
    try {
      await api.post(`/marketing/submission-imports/${item.uuid}/cancel`, {});
      setSessions((current) => current.filter((entry) => entry.uuid !== item.uuid));
      if (session?.uuid === item.uuid) { setSession(null); setCompleted(0); }
    } catch (error) {
      setIssue(error instanceof Error ? error.message : "Unable to discard import.");
    } finally { setRunning(false); }
  }
  return (
    <WorkspaceUpsertDialog
      open
      onClose={() => {
        if (!running) onClose();
      }}
      title="Import submissions"
      description="Map and validate CSV or JSON records before importing."
    >
      <div className="space-y-4 p-4">
        {sessions.length > 0 && !session ? (
          <div className="space-y-2">
            <p>Resume an interrupted import:</p>
            {sessions.map((item) => (
              <div key={item.uuid} className="flex gap-2">
              <Button
                variant="outline"
                disabled={running}
                onClick={() => {
                  setSession(item);
                  setCompleted(item.completed);
                  setRows([]);
                  setSource(null);
                }}
              >
                {item.filename} ({item.completed}/{item.total})
              </Button>
              <Button variant="outline" disabled={running} onClick={() => void cancelImport(item)}>Discard</Button>
              </div>
            ))}
          </div>
        ) : null}
        <p className="text-sm">
          Fields: captureUuid, sourceKey, name, email, phone, message, privacyConsent. Use an active
          capture form UUID and a stable source key. Privacy consent does not grant promotional
          consent.
        </p>
        <Input
          type="file"
          accept=".csv,text/csv,.json,application/json"
          disabled={running || completed > 0 || Boolean(session)}
          onChange={(event) => void preview(event.target.files?.[0])}
        />
        {source ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {importFields.map((field) => (
              <label key={field} className="space-y-1 text-sm">
                <span>{field}</span>
                <WorkspaceSelect
                  ariaLabel={`Source column for ${field}`}
                  value={mapping[field] || "__none"}
                  disabled={running || completed > 0 || Boolean(session)}
                  onValueChange={(value) => {
                    setMapping({ ...mapping, [field]: value === "__none" ? "" : value });
                    setRows([]);
                  }}
                  options={[
                    { value: "__none", label: "Not mapped" },
                    ...source.columns.map((column) => ({ value: column, label: column }))
                  ]}
                />
              </label>
            ))}
          </div>
        ) : null}
        {source && completed === 0 && !session ? (
          <Button disabled={running} onClick={validate}>
            Validate mapping
          </Button>
        ) : null}
        {issue ? (
          <WorkspaceFormBanner tone="error" title="Import requires review">
            {issue}
          </WorkspaceFormBanner>
        ) : null}
        <p>
          {session?.total ?? rows.length} validated rows. {completed} saved.
        </p>
        <p className="text-sm">
          Interrupted imports are available for seven days. Discard a session to delete its staged data.
        </p>
        {rows.slice(0, 10).map((row) => (
          <p key={row.sourceKey} className="text-sm">
            {row.name} · {row.email || row.phone}
          </p>
        ))}
        <div className="flex justify-end gap-2">
          {session ? <Button variant="outline" disabled={running} onClick={() => void cancelImport(session)}>Discard import</Button> : null}
          <Button variant="outline" disabled={running} onClick={onClose}>
            Close
          </Button>
          <Button
            disabled={
              running ||
              (!session && !rows.length) ||
              Boolean(session && completed === session.total)
            }
            onClick={() => void run()}
          >
            {running ? "Importing…" : "Import validated rows"}
          </Button>
        </div>
      </div>
    </WorkspaceUpsertDialog>
  );
}
