import type { ProviderItem, ProviderSettings } from "./provider.types";

const API_BASE = "/api/codeit";

interface ApiResponse<T> {
  success: boolean;
  data: T | null;
  error: {
    code: string;
    message: string;
    retryable: boolean;
    details?: Record<string, unknown>;
  } | null;
  correlation_id: string;
}

const FALLBACK_PROVIDERS: ProviderItem[] = [
  {
    id: "mock",
    name: "Mock Offline Provider",
    available: true,
    configured: true,
    models: ["mock-codeit-default", "mock-codeit-fast", "mock-codeit-reasoning"],
    default_model: "mock-codeit-default",
    latency_ms: 1
  },
  {
    id: "gemini",
    name: "Google Gemini",
    available: false,
    configured: false,
    models: ["gemini-2.0-flash", "gemini-1.5-pro", "gemini-1.5-flash"],
    default_model: "gemini-2.0-flash",
    error: "GEMINI_API_KEY environment variable not configured"
  }
];

export async function fetchProviders(): Promise<ProviderItem[]> {
  try {
    const res = await fetch(`${API_BASE}/providers`, {
      method: "GET",
      headers: { "Content-Type": "application/json" }
    });

    if (res.ok) {
      const body = (await res.json()) as ApiResponse<{ providers: ProviderItem[] }>;
      if (body.success && body.data?.providers) {
        return body.data.providers;
      }
    }
  } catch {
    // API server offline or unreachable; fall back to static fixtures
  }

  return FALLBACK_PROVIDERS;
}

export async function testProviderConnection(
  providerId?: string,
  model?: string
): Promise<{ success: boolean; latencyMs: number; message: string }> {
  const start = Date.now();
  try {
    const res = await fetch(`${API_BASE}/providers/test`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider: providerId, model })
    });

    if (res.ok) {
      const body = (await res.json()) as ApiResponse<{
        success: boolean;
        provider: string;
        model: string;
        latency_ms: number;
        message: string;
      }>;
      if (body.success && body.data) {
        return {
          success: body.data.success,
          latencyMs: body.data.latency_ms,
          message: body.data.message
        };
      }
      if (body.error) {
        return {
          success: false,
          latencyMs: Date.now() - start,
          message: body.error.message
        };
      }
    } else {
      const errBody = (await res.json().catch(() => ({}))) as ApiResponse<unknown>;
      return {
        success: false,
        latencyMs: Date.now() - start,
        message: errBody?.error?.message ?? `HTTP ${res.status}: Connection test failed`
      };
    }
  } catch {
    // Simulated offline test fallback
    if (providerId === "mock" || !providerId) {
      return {
        success: true,
        latencyMs: 3,
        message: "Offline mock provider connection verified (simulated)"
      };
    }
    return {
      success: false,
      latencyMs: Date.now() - start,
      message: "API server unreachable or provider offline"
    };
  }

  return {
    success: false,
    latencyMs: Date.now() - start,
    message: "Unknown error testing provider"
  };
}

export const DEFAULT_PROVIDER_SETTINGS: ProviderSettings = {
  providerId: "mock",
  model: "mock-codeit-default",
  temperature: 0.7,
  maxTokens: 4096
};
