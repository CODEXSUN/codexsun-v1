import { useEffect, useMemo, useState } from "react";
import {
  CheckCheckIcon,
  CheckIcon,
  CopyIcon,
  FolderGit2Icon,
  InfoIcon,
  MessageSquareIcon,
  PlusIcon,
  RefreshCwIcon,
  SearchIcon,
  ShieldAlertIcon,
  SparklesIcon,
  Trash2Icon,
  UserIcon,
  XIcon
} from "lucide-react";
import { Badge } from "@codexsun/ui/components/badge";
import { Button } from "@codexsun/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@codexsun/ui/components/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@codexsun/ui/components/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle
} from "@codexsun/ui/components/sheet";
import { Input } from "@codexsun/ui/components/input";
import { Textarea } from "@codexsun/ui/components/textarea";
import {
  ConfirmationState,
  ContextPreview,
  FactScope,
  PersonalFact,
  PersonalizationPanelProps
} from "./personalization.types";
import { personalizationService } from "./personalization.services";

export function PersonalizationPanel({
  currentProjectUuid = "c0de1700",
  currentConversationUuid = "c0de0001",
  currentUserId = "default_user",
  className = ""
}: PersonalizationPanelProps) {
  const [facts, setFacts] = useState<PersonalFact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [scopeFilter, setScopeFilter] = useState<"all" | FactScope>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | ConfirmationState>("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Create Modal
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [formScope, setFormScope] = useState<FactScope>("user");
  const [formKey, setFormKey] = useState("");
  const [formValue, setFormValue] = useState("");
  const [formSource, setFormSource] = useState("user_explicit");
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Preview Drawer
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewData, setPreviewData] = useState<ContextPreview | null>(null);
  const [copied, setCopied] = useState(false);

  // Fetch facts
  const loadFacts = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await personalizationService.listFacts();
      setFacts(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load facts");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFacts();
  }, []);

  // Filtered facts
  const filteredFacts = useMemo(() => {
    return facts.filter((f) => {
      if (scopeFilter !== "all" && f.scope !== scopeFilter) return false;
      if (statusFilter !== "all" && f.confirmation_state !== statusFilter) return false;
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const keyMatch = f.fact_key.toLowerCase().includes(query);
        const valMatch = f.fact_value.toLowerCase().includes(query);
        const sourceMatch = f.source.toLowerCase().includes(query);
        if (!keyMatch && !valMatch && !sourceMatch) return false;
      }
      return true;
    });
  }, [facts, scopeFilter, statusFilter, searchQuery]);

  // Counts
  const counts = useMemo(() => {
    const total = facts.length;
    const confirmed = facts.filter((f) => f.confirmation_state === "confirmed").length;
    const unconfirmed = facts.filter((f) => f.confirmation_state === "unconfirmed").length;
    const stale = facts.filter((f) => f.confirmation_state === "stale").length;
    return { total, confirmed, unconfirmed, stale };
  }, [facts]);

  // Actions
  const handleConfirm = async (uuid: string, decision: "confirmed" | "rejected") => {
    try {
      await personalizationService.confirmFact(uuid, decision);
      await loadFacts();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update confirmation state");
    }
  };

  const handleForget = async (uuid: string) => {
    try {
      await personalizationService.forgetFact(uuid);
      await loadFacts();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to forget fact");
    }
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formKey.trim() || !formValue.trim()) {
      setFormError("Both key and value are required.");
      return;
    }

    let ownerId = currentUserId;
    if (formScope === "project") ownerId = currentProjectUuid;
    if (formScope === "conversation") ownerId = currentConversationUuid;

    try {
      setSubmitting(true);
      setFormError(null);
      await personalizationService.storeFact({
        scope: formScope,
        owner_id: ownerId,
        fact_key: formKey.trim(),
        fact_value: formValue.trim(),
        source: formSource.trim() || "user_explicit",
        confirmation_state: "confirmed"
      });
      setIsCreateOpen(false);
      setFormKey("");
      setFormValue("");
      setFormSource("user_explicit");
      await loadFacts();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to store fact");
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenPreview = async () => {
    setIsPreviewOpen(true);
    setPreviewLoading(true);
    try {
      const preview = await personalizationService.previewContext({
        project_uuid: currentProjectUuid,
        conversation_uuid: currentConversationUuid,
        user_id: currentUserId,
        max_tokens: 1000
      });
      setPreviewData(preview);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to assemble preview");
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleCopyPrompt = () => {
    if (previewData?.assembled_prompt) {
      navigator.clipboard.writeText(previewData.assembled_prompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Badges helpers
  const renderScopeBadge = (scope: FactScope) => {
    switch (scope) {
      case "user":
        return (
          <Badge
            variant="outline"
            className="gap-1 border-blue-500/30 bg-blue-500/10 text-blue-600 dark:text-blue-400"
          >
            <UserIcon className="size-3" />
            User
          </Badge>
        );
      case "project":
        return (
          <Badge
            variant="outline"
            className="gap-1 border-purple-500/30 bg-purple-500/10 text-purple-600 dark:text-purple-400"
          >
            <FolderGit2Icon className="size-3" />
            Project
          </Badge>
        );
      case "conversation":
        return (
          <Badge
            variant="outline"
            className="gap-1 border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
          >
            <MessageSquareIcon className="size-3" />
            Conversation
          </Badge>
        );
    }
  };

  const renderStatusBadge = (state: ConfirmationState) => {
    switch (state) {
      case "confirmed":
        return (
          <Badge
            variant="outline"
            className="gap-1 border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
          >
            <CheckIcon className="size-3" />
            Confirmed
          </Badge>
        );
      case "unconfirmed":
        return (
          <Badge
            variant="outline"
            className="gap-1 border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400"
          >
            <ShieldAlertIcon className="size-3" />
            Unconfirmed Proposal
          </Badge>
        );
      case "stale":
        return (
          <Badge variant="outline" className="gap-1 border-muted bg-muted text-muted-foreground">
            Stale (Revision Changed)
          </Badge>
        );
      case "rejected":
        return (
          <Badge
            variant="outline"
            className="gap-1 border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400"
          >
            <XIcon className="size-3" />
            Rejected
          </Badge>
        );
    }
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">
              Personalization & Context Control
            </h1>
            {personalizationService.isUsingFallback() ? (
              <Badge variant="secondary" className="text-xs">
                Local Fixtures
              </Badge>
            ) : null}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Scoped preferences and confirmed facts. Precedence: Conversation &gt; Project &gt; User.
            Memory never grants tool authority.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={loadFacts}
            disabled={loading}
            title="Refresh facts"
          >
            <RefreshCwIcon className={`size-4 ${loading ? "animate-spin" : ""}`} />
            <span className="sr-only sm:not-sr-only">Refresh</span>
          </Button>
          <Button variant="outline" size="sm" onClick={handleOpenPreview} className="gap-1.5">
            <SparklesIcon className="size-4 text-primary" />
            Preview Assembled Context
          </Button>
          <Button size="sm" onClick={() => setIsCreateOpen(true)} className="gap-1.5">
            <PlusIcon className="size-4" />
            Add Preference
          </Button>
        </div>
      </div>

      {error ? (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          <div className="flex items-center gap-2 font-medium">
            <ShieldAlertIcon className="size-4" />
            Error
          </div>
          <p className="mt-1">{error}</p>
        </div>
      ) : null}

      {/* Overview Cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Total Facts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{counts.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Confirmed
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              {counts.confirmed}
            </div>
          </CardContent>
        </Card>
        <Card className={counts.unconfirmed > 0 ? "border-amber-500/50 bg-amber-500/5" : ""}>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Pending Proposals
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div
              className={`text-2xl font-bold ${counts.unconfirmed > 0 ? "text-amber-600 dark:text-amber-400" : ""}`}
            >
              {counts.unconfirmed}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Stale Facts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-muted-foreground">{counts.stale}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          {/* Scope Filters */}
          <div className="inline-flex rounded-lg border bg-muted/40 p-1 text-xs">
            {(["all", "user", "project", "conversation"] as const).map((sc) => (
              <button
                key={sc}
                onClick={() => setScopeFilter(sc)}
                className={`rounded-md px-2.5 py-1 font-medium capitalize transition-colors ${
                  scopeFilter === sc
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {sc}
              </button>
            ))}
          </div>

          {/* Status Filters */}
          <div className="inline-flex rounded-lg border bg-muted/40 p-1 text-xs">
            {(["all", "confirmed", "unconfirmed", "stale"] as const).map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`rounded-md px-2.5 py-1 font-medium capitalize transition-colors ${
                  statusFilter === st
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {st}
              </button>
            ))}
          </div>
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-64">
          <SearchIcon className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
          <Input
            placeholder="Search facts..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 text-sm"
          />
        </div>
      </div>

      {/* Fact Cards List */}
      {loading ? (
        <div className="flex items-center justify-center p-12 text-sm text-muted-foreground">
          <RefreshCwIcon className="mr-2 size-4 animate-spin" />
          Loading personalization facts...
        </div>
      ) : filteredFacts.length === 0 ? (
        <Card className="border-dashed p-8 text-center">
          <InfoIcon className="mx-auto size-8 text-muted-foreground/60" />
          <h3 className="mt-2 text-base font-medium">No facts match criteria</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Adjust filters or add a new preference to guide conversation and workflow tone.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setScopeFilter("all");
              setStatusFilter("all");
              setSearchQuery("");
            }}
            className="mt-4"
          >
            Reset Filters
          </Button>
        </Card>
      ) : (
        <div className="grid gap-3">
          {filteredFacts.map((fact) => (
            <Card key={fact.uuid} className="transition-shadow hover:shadow-sm">
              <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    {renderScopeBadge(fact.scope)}
                    {renderStatusBadge(fact.confirmation_state)}
                    <span className="font-mono text-xs font-semibold text-foreground">
                      {fact.fact_key}
                    </span>
                    <span className="text-xs text-muted-foreground">({fact.owner_id})</span>
                  </div>

                  <p className="text-sm text-foreground/90">{fact.fact_value}</p>

                  <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                    <span>
                      Source:{" "}
                      <strong className="font-medium text-foreground/80">{fact.source}</strong>
                    </span>
                    {fact.verified_at ? (
                      <span>Verified: {new Date(fact.verified_at).toLocaleString()}</span>
                    ) : null}
                    <span>Updated: {new Date(fact.updated_at).toLocaleDateString()}</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 self-end sm:self-start">
                  {fact.confirmation_state === "unconfirmed" ? (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 gap-1 border-emerald-500/30 text-emerald-600 hover:bg-emerald-500/10 dark:text-emerald-400"
                        onClick={() => handleConfirm(fact.uuid, "confirmed")}
                        title="Confirm Fact"
                      >
                        <CheckIcon className="size-3.5" />
                        Confirm
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 gap-1 border-red-500/30 text-red-600 hover:bg-red-500/10 dark:text-red-400"
                        onClick={() => handleConfirm(fact.uuid, "rejected")}
                        title="Reject Fact"
                      >
                        <XIcon className="size-3.5" />
                        Reject
                      </Button>
                    </>
                  ) : null}

                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 text-destructive hover:bg-destructive/10"
                    onClick={() => handleForget(fact.uuid)}
                    title="Forget / Delete"
                  >
                    <Trash2Icon className="size-3.5" />
                    <span className="sr-only sm:not-sr-only sm:ml-1">Forget</span>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add Fact Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Personal Fact or Preference</DialogTitle>
            <DialogDescription>
              Explicitly save a workflow preference or confirmed fact. Facts cannot grant tool
              authority or bypass security boundaries (E20).
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateSubmit} className="space-y-4">
            {formError ? (
              <div className="rounded border border-destructive/50 bg-destructive/10 p-2.5 text-xs text-destructive">
                {formError}
              </div>
            ) : null}

            <div className="space-y-1.5">
              <label className="text-xs font-medium">Scope</label>
              <div className="flex gap-2">
                {(["user", "project", "conversation"] as const).map((sc) => (
                  <button
                    key={sc}
                    type="button"
                    onClick={() => setFormScope(sc)}
                    className={`flex-1 rounded-md border p-2 text-xs font-medium capitalize transition-colors ${
                      formScope === sc
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    {sc}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium">Fact Key</label>
              <Input
                placeholder="e.g. preferred_tone, test_command, linter"
                value={formKey}
                onChange={(e) => setFormKey(e.target.value)}
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium">Fact Value</label>
              <Textarea
                placeholder="e.g. Concise with test execution evidence"
                value={formValue}
                onChange={(e) => setFormValue(e.target.value)}
                rows={3}
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium">Source</label>
              <Input
                placeholder="e.g. user_explicit"
                value={formSource}
                onChange={(e) => setFormSource(e.target.value)}
              />
            </div>

            <DialogFooter className="mt-4">
              <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? "Saving..." : "Save Preference"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Context Preview Drawer */}
      <Sheet open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <SheetContent
          side="right"
          className="w-full sm:max-w-xl flex flex-col gap-4 overflow-y-auto"
        >
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <SparklesIcon className="size-5 text-primary" />
              Context Assembly Preview
            </SheetTitle>
            <SheetDescription>
              Inspection preview of facts assembled for the LLM prompt prefix. Precedence:
              Conversation &gt; Project &gt; User.
            </SheetDescription>
          </SheetHeader>

          {previewLoading ? (
            <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
              <RefreshCwIcon className="mr-2 size-4 animate-spin" />
              Assembling context preview...
            </div>
          ) : previewData ? (
            <div className="space-y-5">
              {/* Token Budget Meter */}
              <Card className="bg-muted/30">
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-center justify-between text-xs font-medium">
                    <span>Token Budget</span>
                    <span>
                      {previewData.token_estimate} / {previewData.token_budget} tokens
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className={`h-full transition-all ${
                        previewData.truncated ? "bg-amber-500" : "bg-primary"
                      }`}
                      style={{
                        width: `${Math.min(
                          100,
                          (previewData.token_estimate / previewData.token_budget) * 100
                        )}%`
                      }}
                    />
                  </div>
                  {previewData.truncated ? (
                    <p className="text-xs text-amber-600 dark:text-amber-400">
                      Lower-priority user facts were truncated to respect the token budget limit.
                    </p>
                  ) : null}
                </CardContent>
              </Card>

              {/* Assembled Prompt Block */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Assembled Prompt Prefix
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleCopyPrompt}
                    className="h-7 gap-1 text-xs"
                  >
                    {copied ? (
                      <>
                        <CheckCheckIcon className="size-3 text-emerald-500" />
                        Copied
                      </>
                    ) : (
                      <>
                        <CopyIcon className="size-3" />
                        Copy
                      </>
                    )}
                  </Button>
                </div>
                <pre className="max-h-60 overflow-x-auto rounded-lg border bg-muted/50 p-3 font-mono text-xs whitespace-pre-wrap">
                  {previewData.assembled_prompt}
                </pre>
              </div>

              {/* Breakdown: Included Facts */}
              <div className="space-y-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                  Included Facts ({previewData.included_facts.length})
                </span>
                <div className="space-y-1.5">
                  {previewData.included_facts.map((fact) => (
                    <div
                      key={fact.uuid}
                      className="flex items-center justify-between rounded border bg-card p-2 text-xs"
                    >
                      <div className="flex items-center gap-2">
                        {renderScopeBadge(fact.scope)}
                        <span className="font-mono font-medium">{fact.fact_key}</span>
                      </div>
                      <span className="max-w-[200px] truncate text-muted-foreground">
                        {fact.fact_value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Breakdown: Excluded Facts */}
              {previewData.excluded_facts.length > 0 ? (
                <div className="space-y-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                    Excluded Facts ({previewData.excluded_facts.length})
                  </span>
                  <div className="space-y-1.5">
                    {previewData.excluded_facts.map((ex, idx) => (
                      <div
                        key={idx}
                        className="rounded border border-amber-500/20 bg-amber-500/5 p-2 text-xs space-y-1"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono font-medium">{ex.fact.fact_key}</span>
                          {renderScopeBadge(ex.fact.scope)}
                        </div>
                        <p className="text-muted-foreground">{ex.reason}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}
