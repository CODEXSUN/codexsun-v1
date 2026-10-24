import {
  AlertCircleIcon,
  CheckCircle2Icon,
  Loader2Icon,
  RefreshCwIcon,
  SlidersIcon,
  ZapIcon
} from "lucide-react";
import { Button } from "@codexsun/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@codexsun/ui/components/card";
import { Input } from "@codexsun/ui/components/input";
import { Label } from "@codexsun/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@codexsun/ui/components/select";
import type { ProviderFormProps } from "./provider.types";

export function ProviderForm({
  settings,
  selectedProvider,
  onChangeSettings,
  onResetDefaults,
  onTestConnection,
  testState,
  disabled = false,
  className = ""
}: ProviderFormProps) {
  const models = selectedProvider?.models ?? [settings.model];

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <SlidersIcon className="size-4 text-primary" />
          Model Parameters
        </CardTitle>
        <CardDescription>
          Adjust temperature, context budget, and verify provider connection health.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Model Selection */}
        <div className="space-y-2">
          <Label htmlFor="provider-model-select">Active Model</Label>
          <Select
            value={settings.model}
            onValueChange={(val) => onChangeSettings({ model: val })}
            disabled={disabled || models.length === 0}
          >
            <SelectTrigger id="provider-model-select" className="w-full">
              <SelectValue placeholder="Select active model" />
            </SelectTrigger>
            <SelectContent>
              {models.map((m) => (
                <SelectItem key={m} value={m}>
                  {m} {m === selectedProvider?.default_model ? "(Default)" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Provider models are discovered dynamically from the active provider adapter.
          </p>
        </div>

        {/* Temperature */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="provider-temperature">Temperature</Label>
            <span className="font-mono text-xs text-muted-foreground">
              {settings.temperature.toFixed(1)}
            </span>
          </div>
          <div className="flex items-center gap-4">
            <input
              id="provider-temperature"
              type="range"
              min="0.0"
              max="2.0"
              step="0.1"
              value={settings.temperature}
              onChange={(e) => onChangeSettings({ temperature: parseFloat(e.target.value) })}
              disabled={disabled}
              className="w-full cursor-pointer disabled:cursor-not-allowed"
            />
          </div>
          <div className="flex justify-between text-[10px] text-muted-foreground">
            <span>0.0 (Deterministic)</span>
            <span>0.7 (Balanced)</span>
            <span>2.0 (Creative)</span>
          </div>
        </div>

        {/* Max Tokens */}
        <div className="space-y-2">
          <Label htmlFor="provider-max-tokens">Max Output Tokens</Label>
          <Input
            id="provider-max-tokens"
            type="number"
            min={1}
            max={32768}
            step={256}
            value={settings.maxTokens}
            onChange={(e) => {
              const val = parseInt(e.target.value, 10);
              if (!isNaN(val) && val >= 1) {
                onChangeSettings({ maxTokens: val });
              }
            }}
            disabled={disabled}
          />
          <p className="text-xs text-muted-foreground">
            Upper bound on token budget for generated model completions.
          </p>
        </div>

        {/* Test Connection State Banner */}
        {testState.status !== "idle" && (
          <div
            className={`flex items-start gap-2.5 rounded-md p-3 text-sm ${
              testState.status === "testing"
                ? "bg-muted text-muted-foreground"
                : testState.status === "success"
                  ? "bg-emerald-50 text-emerald-900 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800"
                  : "bg-destructive/10 text-destructive border border-destructive/20"
            }`}
          >
            {testState.status === "testing" ? (
              <Loader2Icon className="size-4 shrink-0 animate-spin mt-0.5" />
            ) : testState.status === "success" ? (
              <CheckCircle2Icon className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400 mt-0.5" />
            ) : (
              <AlertCircleIcon className="size-4 shrink-0 text-destructive mt-0.5" />
            )}
            <div className="min-w-0 flex-1 space-y-0.5">
              <p className="font-medium">
                {testState.status === "testing"
                  ? "Testing provider connection..."
                  : testState.status === "success"
                    ? "Connection Successful"
                    : "Connection Test Failed"}
              </p>
              {testState.message && (
                <p className="text-xs opacity-90 break-words">{testState.message}</p>
              )}
              {testState.latencyMs !== undefined && (
                <p className="text-[11px] font-mono opacity-80">Latency: {testState.latencyMs}ms</p>
              )}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onResetDefaults}
            disabled={disabled || testState.status === "testing"}
            className="cursor-pointer disabled:cursor-not-allowed"
          >
            <RefreshCwIcon className="size-3.5 mr-1" />
            Reset Defaults
          </Button>

          <Button
            type="button"
            size="sm"
            onClick={onTestConnection}
            disabled={disabled || testState.status === "testing"}
            className="cursor-pointer disabled:cursor-not-allowed"
          >
            {testState.status === "testing" ? (
              <>
                <Loader2Icon className="size-3.5 mr-1.5 animate-spin" />
                Testing...
              </>
            ) : (
              <>
                <ZapIcon className="size-3.5 mr-1.5" />
                Test Connection
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
