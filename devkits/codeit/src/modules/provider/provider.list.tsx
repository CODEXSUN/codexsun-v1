import {
  BotIcon,
  CheckCircle2Icon,
  CpuIcon,
  ServerIcon,
  ShieldAlertIcon,
  ZapIcon
} from "lucide-react";
import { Badge } from "@codexsun/ui/components/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@codexsun/ui/components/card";
import type { ProviderListProps } from "./provider.types";

export function ProviderList({
  providers,
  selectedProviderId,
  onSelectProvider,
  loading = false,
  className = ""
}: ProviderListProps) {
  if (loading) {
    return (
      <div className={`space-y-3 ${className}`}>
        <p className="text-sm text-muted-foreground animate-pulse">Loading providers...</p>
      </div>
    );
  }

  if (providers.length === 0) {
    return (
      <Card className={className}>
        <CardContent className="py-6 text-center text-sm text-muted-foreground">
          No model providers configured.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={`space-y-3 ${className}`}>
      {providers.map((provider) => {
        const isSelected = provider.id === selectedProviderId;

        return (
          <Card
            key={provider.id}
            onClick={() => onSelectProvider(provider.id)}
            className={`cursor-pointer transition-all hover:border-primary/50 ${
              isSelected ? "border-primary ring-1 ring-primary shadow-sm" : ""
            }`}
          >
            <CardHeader className="p-4 pb-2">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="flex items-center gap-2 text-base font-medium">
                  {provider.id === "mock" ? (
                    <BotIcon className="size-4 text-primary" />
                  ) : (
                    <ServerIcon className="size-4 text-primary" />
                  )}
                  {provider.name}
                </CardTitle>
                <div className="flex items-center gap-1.5">
                  {provider.latency_ms !== undefined && provider.available && (
                    <span className="flex items-center gap-0.5 text-xs text-muted-foreground">
                      <ZapIcon className="size-3 text-amber-500" />
                      {provider.latency_ms}ms
                    </span>
                  )}
                  {provider.available ? (
                    <Badge variant="default" className="text-xs">
                      Online
                    </Badge>
                  ) : provider.configured ? (
                    <Badge variant="destructive" className="text-xs">
                      Offline
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="text-xs">
                      Unconfigured
                    </Badge>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-4 pt-1 space-y-2 text-xs text-muted-foreground">
              <div className="flex items-center justify-between">
                <span className="font-mono">{provider.id}</span>
                <span className="flex items-center gap-1 text-foreground/80">
                  <CpuIcon className="size-3" />
                  {provider.models.length} {provider.models.length === 1 ? "model" : "models"}
                </span>
              </div>

              {provider.error ? (
                <div className="flex items-start gap-1.5 text-destructive font-sans">
                  <ShieldAlertIcon className="size-3.5 shrink-0 mt-0.5" />
                  <span className="line-clamp-2">{provider.error}</span>
                </div>
              ) : (
                <div className="flex items-center gap-1 text-muted-foreground">
                  <CheckCircle2Icon className="size-3.5 text-emerald-600" />
                  <span>
                    Default:{" "}
                    <code className="font-mono text-foreground">{provider.default_model}</code>
                  </span>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
