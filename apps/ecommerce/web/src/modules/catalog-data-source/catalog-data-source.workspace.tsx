import { useState } from "react";
import { DownloadIcon, RefreshCwIcon, UploadIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@codexsun/ui/components/button";
import { Card } from "@codexsun/ui/components/card";
import { WorkspacePage } from "@codexsun/ui/workspace/page";
import { WorkspaceStatusBadge } from "@codexsun/ui/workspace/status";
import { useCatalogDataSource } from "./catalog-data-source.hooks";
import { CatalogDataSourceList } from "./catalog-data-source.list";
import type {
  CatalogDataSourceModule,
  CatalogDataSourceProvider
} from "./catalog-data-source.types";

export function CatalogDataSourceWorkspace() {
  const { save, settings, sync, test } = useCatalogDataSource();
  const [compact, setCompact] = useState(false);
  const value = settings.data;
  const busy = save.isPending || sync.isPending || test.isPending;

  function change(module: CatalogDataSourceModule, provider: CatalogDataSourceProvider) {
    save.mutate(
      { module, provider },
      {
        onError: (error) => toast.error(error.message),
        onSuccess: (next) => {
          const changed = next.modules.find((item) => item.module === module);
          toast.success(
            `${changed?.label ?? "Module"} now records ${sourceLabel(provider)} as its import source.`
          );
        }
      }
    );
  }

  function verify() {
    test.mutate("frappe", {
      onError: (error) => toast.error(error.message),
      onSuccess: (result) =>
        result.connected ? toast.success(result.message) : toast.error(result.message)
    });
  }

  function synchronize(action: "pull" | "push") {
    sync.mutate(action, {
      onError: (error) => toast.error(error.message),
      onSuccess: (result) =>
        toast.success(
          `${result.message} ${result.items} items and ${result.catalogs} catalogs processed.`
        )
    });
  }

  return (
    <WorkspacePage
      title="Data Source"
      description="Choose the local projection or a Frappe import source per Ecommerce module. Public storefront reads always use the local tenant projection."
    >
      <div className={`grid ${compact ? "gap-3" : "gap-5"}`}>
        <Card
          title="Module data routing"
          description="The import source is recorded per module for explicit Pull/Push transfer. It does not change how public storefront reads are served."
        >
          <CatalogDataSourceList
            busy={busy || settings.isLoading}
            frappeConfigured={value?.frappeConfigured ?? false}
            modules={value?.modules ?? []}
            onChange={change}
          />
        </Card>
        <div className="grid gap-4 lg:grid-cols-2">
          <ConnectionCard
            busy={busy}
            configured={value?.frappeConfigured ?? false}
            status={value?.verificationStatus ?? "unverified"}
            url={value?.frappeUrl ?? null}
            verify={verify}
          />
          <SyncCard
            busy={busy}
            configured={value?.frappeConfigured ?? false}
            synchronize={synchronize}
          />
        </div>
      </div>
      <div className="fixed bottom-5 right-5 z-30 flex items-center gap-1 rounded-md border bg-background/95 p-1 shadow-sm backdrop-blur">
        <span className="px-2 text-xs text-muted-foreground">Density</span>
        <Button onClick={() => setCompact(true)} size="sm" variant={compact ? "default" : "ghost"}>
          Compact
        </Button>
        <Button
          onClick={() => setCompact(false)}
          size="sm"
          variant={!compact ? "default" : "ghost"}
        >
          Relaxed
        </Button>
      </div>
    </WorkspacePage>
  );
}

function ConnectionCard({
  busy,
  configured,
  status,
  url,
  verify
}: {
  busy: boolean;
  configured: boolean;
  status: "live" | "offline" | "unverified";
  url: string | null;
  verify: () => void;
}) {
  return (
    <Card title="Frappe connection" description={url ?? "No Frappe URL is configured."}>
      <div className="flex flex-wrap items-center justify-between gap-3 p-4">
        <WorkspaceStatusBadge
          label={status === "live" ? "Verified" : configured ? "Configured" : "Not configured"}
          tone={status === "live" ? "success" : configured ? "info" : "warning"}
        />
        <Button disabled={busy || !configured} onClick={verify} variant="outline">
          <RefreshCwIcon className="size-4" />
          Test connection
        </Button>
        <a className="text-sm text-primary underline" href="/app/frappe/connection">
          Open Frappe connection settings
        </a>
      </div>
    </Card>
  );
}

function SyncCard({
  busy,
  configured,
  synchronize
}: {
  busy: boolean;
  configured: boolean;
  synchronize: (action: "pull" | "push") => void;
}) {
  return (
    <Card
      title="Catalog synchronization"
      description="Pull copies the Frappe catalog into the local projection. Push sends the local catalog to Frappe. Public reads never call Frappe and never wait for it."
    >
      <div className="grid gap-3 p-4 sm:grid-cols-2">
        <Button
          disabled={busy || !configured}
          onClick={() => synchronize("pull")}
          variant="outline"
        >
          <DownloadIcon className="size-4" />
          Pull to local
        </Button>
        <Button
          disabled={busy || !configured}
          onClick={() => synchronize("push")}
          variant="outline"
        >
          <UploadIcon className="size-4" />
          Push to Frappe
        </Button>
      </div>
    </Card>
  );
}

function sourceLabel(provider: CatalogDataSourceProvider) {
  return provider === "frappe" ? "Frappe import" : "Local projection";
}
