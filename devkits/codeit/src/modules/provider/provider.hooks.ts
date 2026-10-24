import { useCallback, useEffect, useState } from "react";
import type { ProviderItem, ProviderSettings, ProviderTestState } from "./provider.types";
import {
  DEFAULT_PROVIDER_SETTINGS,
  fetchProviders,
  testProviderConnection
} from "./provider.services";

export function useProviders() {
  const [providers, setProviders] = useState<ProviderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [settings, setSettings] = useState<ProviderSettings>(DEFAULT_PROVIDER_SETTINGS);
  const [testState, setTestState] = useState<ProviderTestState>({ status: "idle" });

  const loadProviders = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const items = await fetchProviders();
      setProviders(items);

      // Default to first available/configured provider if current is not in list
      setSettings((prev) => {
        const currentFound = items.find((p) => p.id === prev.providerId);
        if (!currentFound) {
          const preferred = items.find((p) => p.configured && p.available) ?? items[0];
          if (preferred) {
            return {
              ...prev,
              providerId: preferred.id,
              model: preferred.default_model
            };
          }
        }
        return prev;
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load providers");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadProviders();
  }, [loadProviders]);

  const updateSettings = useCallback((patch: Partial<ProviderSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      // If provider changed, reset model to that provider's default
      if (patch.providerId && patch.providerId !== prev.providerId) {
        setProviders((currentList) => {
          const found = currentList.find((p) => p.id === patch.providerId);
          if (found) {
            next.model = found.default_model;
          }
          return currentList;
        });
      }
      return next;
    });
  }, []);

  const resetSettings = useCallback(() => {
    const selected = providers.find((p) => p.id === settings.providerId);
    setSettings({
      ...DEFAULT_PROVIDER_SETTINGS,
      providerId: settings.providerId,
      model: selected?.default_model ?? DEFAULT_PROVIDER_SETTINGS.model
    });
    setTestState({ status: "idle" });
  }, [providers, settings.providerId]);

  const runConnectionTest = useCallback(async () => {
    setTestState({ status: "testing" });
    const res = await testProviderConnection(settings.providerId, settings.model);
    if (res.success) {
      setTestState({
        status: "success",
        message: res.message,
        latencyMs: res.latencyMs
      });
    } else {
      setTestState({
        status: "error",
        message: res.message,
        latencyMs: res.latencyMs
      });
    }
  }, [settings.providerId, settings.model]);

  const selectedProvider = providers.find((p) => p.id === settings.providerId);

  return {
    providers,
    selectedProvider,
    loading,
    error,
    settings,
    updateSettings,
    resetSettings,
    testState,
    runConnectionTest,
    refreshProviders: loadProviders
  };
}
