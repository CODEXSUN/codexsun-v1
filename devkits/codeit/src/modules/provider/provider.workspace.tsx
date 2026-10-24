import { AlertTriangleIcon, ShieldCheckIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@codexsun/ui/components/card";
import { ProviderList } from "./provider.list";
import { ProviderForm } from "./provider.form";
import { useProviders } from "./provider.hooks";
import type { ProviderWorkspaceProps } from "./provider.types";

export function ProviderWorkspace({ className = "", onSettingsSaved }: ProviderWorkspaceProps) {
  const {
    providers,
    selectedProvider,
    loading,
    error,
    settings,
    updateSettings,
    resetSettings,
    testState,
    runConnectionTest
  } = useProviders();

  const handleSelectProvider = (providerId: string) => {
    updateSettings({ providerId });
  };

  const handleChangeSettings = (patch: Parameters<typeof updateSettings>[0]) => {
    updateSettings(patch);
    if (onSettingsSaved) {
      onSettingsSaved({ ...settings, ...patch });
    }
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Workspace Header */}
      <div className="space-y-1">
        <h2 className="text-xl font-semibold tracking-tight">
          Model Providers & Inference Settings
        </h2>
        <p className="text-sm text-muted-foreground">
          Configure active model provider adapters, runtime parameters, and verify backend
          connection health.
        </p>
      </div>

      {/* Global Error Banner */}
      {error && (
        <div className="flex items-center gap-2 rounded-md border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertTriangleIcon className="size-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left: Providers List */}
        <div className="space-y-4 lg:col-span-5">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium">Configured Adapters</h3>
            <span className="text-xs text-muted-foreground">
              {providers.length} {providers.length === 1 ? "provider" : "providers"} available
            </span>
          </div>

          <ProviderList
            providers={providers}
            selectedProviderId={settings.providerId}
            onSelectProvider={handleSelectProvider}
            loading={loading}
          />

          {/* Security & Secrets Assurance Card */}
          <Card className="border-muted bg-muted/30">
            <CardHeader className="p-4 pb-2">
              <CardTitle className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                <ShieldCheckIcon className="size-3.5 text-primary" />
                Security & Credential Isolation
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-1 text-xs text-muted-foreground space-y-1.5">
              <p>
                API keys are resolved exclusively from server-side environment variables (e.g.{" "}
                <code className="font-mono text-foreground font-semibold">GEMINI_API_KEY</code>).
              </p>
              <p>
                Credentials are never stored in browser storage, client bundles, or exported into
                artifacts.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Right: Model Parameters Form */}
        <div className="space-y-4 lg:col-span-7">
          <ProviderForm
            settings={settings}
            selectedProvider={selectedProvider}
            onChangeSettings={handleChangeSettings}
            onResetDefaults={resetSettings}
            onTestConnection={runConnectionTest}
            testState={testState}
            disabled={loading}
          />
        </div>
      </div>
    </div>
  );
}
