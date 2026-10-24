/**
 * Frontend types for Codeit Provider Module.
 */

export interface ProviderItem {
  id: string;
  name: string;
  available: boolean;
  configured: boolean;
  models: string[];
  default_model: string;
  error?: string | undefined;
  latency_ms?: number | undefined;
}

export interface ProviderSettings {
  providerId: string;
  model: string;
  temperature: number;
  maxTokens: number;
}

export interface ProviderTestState {
  status: "idle" | "testing" | "success" | "error";
  message?: string | undefined;
  latencyMs?: number | undefined;
}

export interface ProviderListProps {
  providers: ProviderItem[];
  selectedProviderId: string;
  onSelectProvider: (providerId: string) => void;
  loading?: boolean | undefined;
  className?: string | undefined;
}

export interface ProviderFormProps {
  settings: ProviderSettings;
  selectedProvider: ProviderItem | undefined;
  onChangeSettings: (patch: Partial<ProviderSettings>) => void;
  onResetDefaults: () => void;
  onTestConnection: () => Promise<void> | void;
  testState: ProviderTestState;
  disabled?: boolean | undefined;
  className?: string | undefined;
}

export interface ProviderWorkspaceProps {
  className?: string | undefined;
  onSettingsSaved?: ((settings: ProviderSettings) => void) | undefined;
}
