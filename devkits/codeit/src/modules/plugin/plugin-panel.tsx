import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangleIcon,
  CheckCircle2Icon,
  EyeIcon,
  InfoIcon,
  KeyIcon,
  LayersIcon,
  PauseIcon,
  PlayIcon,
  PlugIcon,
  PlusIcon,
  RefreshCwIcon,
  SearchIcon,
  ShieldAlertIcon,
  ShieldCheckIcon,
  Trash2Icon,
  WrenchIcon,
  XCircleIcon
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
import { Input } from "@codexsun/ui/components/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle
} from "@codexsun/ui/components/sheet";
import { Textarea } from "@codexsun/ui/components/textarea";
import { pluginService } from "./plugin.services";
import type {
  PluginEnabledState,
  PluginInstall,
  PluginManifest,
  PluginPanelProps,
  PluginTool
} from "./plugin.types";

function canonicalStringify(obj: unknown): string {
  if (obj === null || typeof obj !== "object") {
    return JSON.stringify(obj);
  }
  if (Array.isArray(obj)) {
    return "[" + obj.map(canonicalStringify).join(",") + "]";
  }
  const keys = Object.keys(obj as Record<string, unknown>).sort();
  const parts = keys.map(
    (k) => JSON.stringify(k) + ":" + canonicalStringify((obj as Record<string, unknown>)[k])
  );
  return "{" + parts.join(",") + "}";
}

async function computeDigest(manifestObj: Record<string, unknown>): Promise<string> {
  const { manifest_digest: _digest, ...rest } = manifestObj;
  const canonical = canonicalStringify(rest);
  const msgUint8 = new TextEncoder().encode(canonical);
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function PluginPanel({ className = "" }: PluginPanelProps) {
  const [plugins, setPlugins] = useState<PluginInstall[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | PluginEnabledState>("all");

  // Inspect tools sheet
  const [inspectPlugin, setInspectPlugin] = useState<PluginInstall | null>(null);
  const [inspectTools, setInspectTools] = useState<PluginTool[]>([]);
  const [loadingTools, setLoadingTools] = useState(false);

  // Install dialog
  const [isInstallOpen, setIsInstallOpen] = useState(false);
  const [manifestJson, setManifestJson] = useState("");
  const [installError, setInstallError] = useState<string | null>(null);
  const [installing, setInstalling] = useState(false);

  // Revoke confirmation dialog
  const [revokeTarget, setRevokeTarget] = useState<PluginInstall | null>(null);
  const [revoking, setRevoking] = useState(false);

  const fetchPlugins = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await pluginService.listPlugins();
      setPlugins(data);
    } catch (err: unknown) {
      setError((err as Error).message || "Failed to load plugins");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPlugins();
  }, []);

  const handleOpenInspect = async (plugin: PluginInstall) => {
    setInspectPlugin(plugin);
    setLoadingTools(true);
    try {
      const tools = await pluginService.listTools(plugin.uuid);
      setInspectTools(tools);
    } catch {
      setInspectTools([]);
    } finally {
      setLoadingTools(false);
    }
  };

  const handleEnable = async (plugin: PluginInstall) => {
    try {
      await pluginService.enablePlugin(plugin.uuid);
      await fetchPlugins();
    } catch (err: unknown) {
      setError((err as Error).message || "Failed to enable plugin");
    }
  };

  const handleDisable = async (plugin: PluginInstall) => {
    try {
      await pluginService.disablePlugin(plugin.uuid);
      await fetchPlugins();
    } catch (err: unknown) {
      setError((err as Error).message || "Failed to disable plugin");
    }
  };

  const handleRevokeConfirm = async () => {
    if (!revokeTarget) return;
    setRevoking(true);
    try {
      await pluginService.revokePlugin(revokeTarget.uuid);
      setRevokeTarget(null);
      await fetchPlugins();
    } catch (err: unknown) {
      setError((err as Error).message || "Failed to revoke plugin");
    } finally {
      setRevoking(false);
    }
  };

  const handleUninstall = async (plugin: PluginInstall) => {
    try {
      await pluginService.uninstallPlugin(plugin.uuid);
      await fetchPlugins();
    } catch (err: unknown) {
      setError((err as Error).message || "Failed to uninstall plugin");
    }
  };

  const handleCalculateDigest = async () => {
    try {
      const parsed = JSON.parse(manifestJson);
      const digest = await computeDigest(parsed);
      parsed.manifest_digest = digest;
      setManifestJson(JSON.stringify(parsed, null, 2));
      setInstallError(null);
    } catch (err: unknown) {
      setInstallError(`Invalid JSON: ${(err as Error).message}`);
    }
  };

  const handleInstallSubmit = async () => {
    setInstallError(null);
    setInstalling(true);
    try {
      let parsed: PluginManifest;
      try {
        parsed = JSON.parse(manifestJson);
      } catch (err: unknown) {
        throw new Error(`Invalid JSON manifest format: ${(err as Error).message}`);
      }

      await pluginService.installPlugin(parsed);
      setIsInstallOpen(false);
      setManifestJson("");
      await fetchPlugins();
    } catch (err: unknown) {
      setInstallError((err as Error).message || "Failed to install plugin");
    } finally {
      setInstalling(false);
    }
  };

  const filteredPlugins = useMemo(() => {
    return plugins.filter((p) => {
      if (statusFilter !== "all" && p.enabled_state !== statusFilter) {
        return false;
      }
      if (searchQuery.trim().length > 0) {
        const q = searchQuery.toLowerCase();
        return (
          p.plugin_id.toLowerCase().includes(q) ||
          p.version.toLowerCase().includes(q) ||
          p.uuid.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [plugins, statusFilter, searchQuery]);

  const renderStatusBadge = (state: PluginEnabledState) => {
    switch (state) {
      case "enabled":
        return (
          <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1">
            <CheckCircle2Icon className="w-3 h-3" />
            Enabled
          </Badge>
        );
      case "installed":
        return (
          <Badge className="bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-1">
            <InfoIcon className="w-3 h-3" />
            Installed
          </Badge>
        );
      case "disabled":
        return (
          <Badge className="bg-amber-600 hover:bg-amber-700 text-white flex items-center gap-1">
            <PauseIcon className="w-3 h-3" />
            Disabled
          </Badge>
        );
      case "revoked":
        return (
          <Badge className="bg-rose-600 hover:bg-rose-700 text-white flex items-center gap-1">
            <XCircleIcon className="w-3 h-3" />
            Revoked
          </Badge>
        );
    }
  };

  const sampleManifestTemplate = `{
  "plugin_id": "example-mcp-tool",
  "name": "Example MCP Tool",
  "version": "1.0.0",
  "description": "An example MCP tool plugin",
  "entrypoint": "node ./server.js",
  "manifest_digest": "",
  "capabilities": ["tools"],
  "advertised_tools": [
    {
      "name": "example_action",
      "description": "Performs an example action",
      "inputSchema": {},
      "required_grants": []
    }
  ],
  "requested_grants": [],
  "author": "Codeit Community"
}`;

  return (
    <div className={`flex flex-col gap-4 p-4 ${className}`}>
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2 text-zinc-900 dark:text-zinc-100">
            <PlugIcon className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
            Plugin Lifecycle & MCP Broker
          </h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Manage reviewed plugins, MCP servers, isolated capabilities, and security boundaries.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchPlugins}
            disabled={loading}
            className="flex items-center gap-1"
          >
            <RefreshCwIcon className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button
            size="sm"
            onClick={() => {
              setManifestJson(sampleManifestTemplate);
              setIsInstallOpen(true);
            }}
            className="bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-1"
          >
            <PlusIcon className="w-4 h-4" />
            Install Plugin
          </Button>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-md text-sm text-rose-700 dark:text-rose-300 flex items-center gap-2">
          <ShieldAlertIcon className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Filter and Search Bar */}
      <Card>
        <CardContent className="p-3 flex flex-col sm:flex-row gap-3 items-center">
          <div className="relative flex-1 w-full">
            <SearchIcon className="absolute left-2.5 top-2.5 h-4 w-4 text-zinc-400" />
            <Input
              type="text"
              placeholder="Filter plugins by ID, version, or UUID..."
              className="pl-8 text-sm"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            {(["all", "enabled", "installed", "disabled", "revoked"] as const).map((st) => (
              <Button
                key={st}
                size="sm"
                variant={statusFilter === st ? "default" : "outline"}
                className="capitalize text-xs h-8 px-2.5"
                onClick={() => setStatusFilter(st)}
              >
                {st}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Plugin List */}
      {loading ? (
        <div className="flex flex-col items-center justify-center p-12 text-zinc-500">
          <RefreshCwIcon className="w-8 h-8 animate-spin mb-2" />
          <span>Loading plugins...</span>
        </div>
      ) : filteredPlugins.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center p-12 text-center">
            <PlugIcon className="w-12 h-12 text-zinc-400 mb-3 stroke-[1.5]" />
            <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
              No plugins match your filter
            </h3>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 max-w-sm mt-1 mb-4">
              Install a new plugin from a manifest JSON or clear your search filters.
            </p>
            <Button
              size="sm"
              onClick={() => {
                setManifestJson(sampleManifestTemplate);
                setIsInstallOpen(true);
              }}
            >
              <PlusIcon className="w-4 h-4 mr-1" />
              Install Plugin
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredPlugins.map((plugin) => (
            <Card key={plugin.uuid} className="flex flex-col justify-between">
              <CardHeader className="pb-2">
                <div className="flex justify-between items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-base font-semibold truncate text-zinc-900 dark:text-zinc-100">
                      {plugin.plugin_id}
                    </CardTitle>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs font-mono text-zinc-500 dark:text-zinc-400">
                        v{plugin.version}
                      </span>
                      <span className="text-xs font-mono text-zinc-400">uuid:{plugin.uuid}</span>
                    </div>
                  </div>
                  <div>{renderStatusBadge(plugin.enabled_state)}</div>
                </div>
              </CardHeader>
              <CardContent className="pt-0 flex flex-col gap-3">
                {/* Digest */}
                <div className="bg-zinc-50 dark:bg-zinc-900 p-2 rounded text-xs">
                  <div className="text-zinc-500 dark:text-zinc-400 flex items-center gap-1 font-mono">
                    <ShieldCheckIcon className="w-3.5 h-3.5 text-indigo-500" />
                    Digest:
                  </div>
                  <div className="font-mono text-zinc-700 dark:text-zinc-300 truncate mt-0.5">
                    {plugin.manifest_digest}
                  </div>
                </div>

                {/* Grants */}
                <div className="text-xs">
                  <div className="text-zinc-500 dark:text-zinc-400 flex items-center gap-1 font-medium mb-1">
                    <KeyIcon className="w-3.5 h-3.5 text-amber-500" />
                    Active Grants ({plugin.grants.length}):
                  </div>
                  {plugin.grants.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {plugin.grants.map((grant) => (
                        <Badge
                          key={grant}
                          variant="outline"
                          className="text-[10px] px-1.5 py-0 font-mono bg-zinc-100 dark:bg-zinc-800"
                        >
                          {grant}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <span className="text-zinc-400 italic">No grants configured</span>
                  )}
                </div>

                {/* Actions */}
                <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between gap-1 flex-wrap">
                  <div className="flex items-center gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 px-2 text-xs flex items-center gap-1"
                      onClick={() => handleOpenInspect(plugin)}
                    >
                      <EyeIcon className="w-3.5 h-3.5" />
                      Tools
                    </Button>

                    {plugin.enabled_state === "enabled" ? (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 px-2 text-xs flex items-center gap-1 text-amber-600 hover:text-amber-700"
                        onClick={() => handleDisable(plugin)}
                      >
                        <PauseIcon className="w-3.5 h-3.5" />
                        Disable
                      </Button>
                    ) : plugin.enabled_state !== "revoked" ? (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 px-2 text-xs flex items-center gap-1 text-emerald-600 hover:text-emerald-700"
                        onClick={() => handleEnable(plugin)}
                      >
                        <PlayIcon className="w-3.5 h-3.5" />
                        Enable
                      </Button>
                    ) : null}
                  </div>

                  <div className="flex items-center gap-1">
                    {plugin.enabled_state !== "revoked" && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 px-2 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950"
                        onClick={() => setRevokeTarget(plugin)}
                      >
                        <ShieldAlertIcon className="w-3.5 h-3.5" />
                        Revoke
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 px-2 text-xs text-zinc-500 hover:text-rose-600"
                      onClick={() => handleUninstall(plugin)}
                    >
                      <Trash2Icon className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Inspect Tools & Grants Sheet */}
      <Sheet open={Boolean(inspectPlugin)} onOpenChange={(open) => !open && setInspectPlugin(null)}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <WrenchIcon className="w-5 h-5 text-indigo-500" />
              Advertised Tools
            </SheetTitle>
            <SheetDescription>
              Namespaced tools advertised by plugin:{" "}
              <span className="font-mono font-medium text-zinc-900 dark:text-zinc-100">
                {inspectPlugin?.plugin_id}
              </span>
            </SheetDescription>
          </SheetHeader>

          <div className="mt-4 flex flex-col gap-4">
            <div className="p-3 bg-zinc-50 dark:bg-zinc-900 rounded-md border text-xs flex flex-col gap-1.5">
              <div className="flex justify-between">
                <span className="text-zinc-500">Status:</span>
                <span>{inspectPlugin && renderStatusBadge(inspectPlugin.enabled_state)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">UUID:</span>
                <span className="font-mono">{inspectPlugin?.uuid}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Version:</span>
                <span className="font-mono">v{inspectPlugin?.version}</span>
              </div>
            </div>

            <div>
              <h4 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
                <LayersIcon className="w-4 h-4 text-indigo-500" />
                Tools List ({inspectTools.length})
              </h4>

              {loadingTools ? (
                <div className="p-8 text-center text-zinc-500 flex flex-col items-center gap-2">
                  <RefreshCwIcon className="w-6 h-6 animate-spin" />
                  <span>Querying tools from broker...</span>
                </div>
              ) : inspectTools.length === 0 ? (
                <div className="p-6 text-center text-zinc-400 border border-dashed rounded-md text-xs">
                  {inspectPlugin?.enabled_state === "revoked"
                    ? "Plugin is revoked; tools cannot be queried."
                    : inspectPlugin?.enabled_state !== "enabled"
                      ? "Plugin is not enabled. Enable it to query live broker tools."
                      : "No tools advertised by this plugin."}
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {inspectTools.map((tool) => (
                    <div
                      key={tool.name}
                      className="p-3 border rounded-md bg-white dark:bg-zinc-900 flex flex-col gap-1 text-xs"
                    >
                      <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400 break-all">
                        {tool.name}
                      </span>
                      <p className="text-zinc-600 dark:text-zinc-300">
                        {tool.description || "No description provided"}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Install Dialog */}
      <Dialog open={isInstallOpen} onOpenChange={setIsInstallOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PlugIcon className="w-5 h-5 text-indigo-600" />
              Install Plugin Manifest
            </DialogTitle>
            <DialogDescription>
              Review the manifest JSON, capabilities, and verify SHA-256 integrity digest before
              installing.
            </DialogDescription>
          </DialogHeader>

          {installError && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-md text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2">
              <ShieldAlertIcon className="w-4 h-4 flex-shrink-0" />
              <span>{installError}</span>
            </div>
          )}

          <div className="flex flex-col gap-2">
            <div className="flex justify-between items-center text-xs text-zinc-500">
              <label htmlFor="manifest-json" className="font-medium">
                Manifest JSON
              </label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-6 text-xs text-indigo-600 hover:text-indigo-700"
                onClick={handleCalculateDigest}
              >
                Compute & Pin Digest
              </Button>
            </div>
            <Textarea
              id="manifest-json"
              rows={12}
              className="font-mono text-xs"
              value={manifestJson}
              onChange={(e) => setManifestJson(e.target.value)}
              placeholder="Paste plugin manifest JSON..."
            />
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setIsInstallOpen(false)} disabled={installing}>
              Cancel
            </Button>
            <Button
              className="bg-indigo-600 hover:bg-indigo-700 text-white"
              onClick={handleInstallSubmit}
              disabled={installing}
            >
              {installing ? "Installing..." : "Install Plugin"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Revoke Confirmation Dialog */}
      <Dialog open={Boolean(revokeTarget)} onOpenChange={(open) => !open && setRevokeTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-rose-600">
              <AlertTriangleIcon className="w-5 h-5" />
              Revoke Plugin Authorization?
            </DialogTitle>
            <DialogDescription>
              Revoking plugin{" "}
              <span className="font-mono font-bold text-zinc-900 dark:text-zinc-100">
                {revokeTarget?.plugin_id}
              </span>{" "}
              will immediately fence all in-flight executions, terminate active broker process
              trees, and clear all granted permissions.
            </DialogDescription>
          </DialogHeader>

          <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded text-xs text-amber-800 dark:text-amber-200">
            This action cannot be undone by simple toggle. A revoked plugin fails closed for all
            future invocations.
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setRevokeTarget(null)} disabled={revoking}>
              Cancel
            </Button>
            <Button
              className="bg-rose-600 hover:bg-rose-700 text-white"
              onClick={handleRevokeConfirm}
              disabled={revoking}
            >
              {revoking ? "Revoking..." : "Confirm Revocation"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
