import type { PluginInstall, PluginManifest, PluginTool } from "./plugin.types";

const API_BASE = "/api/codeit/plugins";

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

// -------------------------------------------------------------
// In-Memory Fixtures for Standalone / Offline UI Fallback
// -------------------------------------------------------------
let fixturePlugins: PluginInstall[] = [
  {
    id: 1,
    uuid: "plg00001",
    plugin_id: "mcp-git-inspector",
    version: "1.2.0",
    manifest_digest: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    enabled_state: "enabled",
    grants: ["git:read", "workspace:inspect"],
    created_at: "2026-10-24T06:00:00.000Z",
    updated_at: "2026-10-24T06:00:00.000Z"
  },
  {
    id: 2,
    uuid: "plg00002",
    plugin_id: "mcp-code-analyzer",
    version: "0.9.5",
    manifest_digest: "ca978112ca1bbdcafac231b39a23dc4da786eff8147c4e72b9807785afee48bb",
    enabled_state: "installed",
    grants: [],
    created_at: "2026-10-24T07:15:00.000Z",
    updated_at: "2026-10-24T07:15:00.000Z"
  },
  {
    id: 3,
    uuid: "plg00003",
    plugin_id: "untrusted-web-scraper",
    version: "0.1.0",
    manifest_digest: "5891b5b522d5df086d0ff0b110fbd9d21bb4fc7163af34d08286a2e846f6be03",
    enabled_state: "revoked",
    grants: [],
    created_at: "2026-10-24T08:00:00.000Z",
    updated_at: "2026-10-24T08:05:00.000Z"
  }
];

const fixtureTools: Record<string, PluginTool[]> = {
  plg00001: [
    {
      name: "plugin:mcp-git-inspector:status",
      description: "Inspect working tree git status and staged changes"
    },
    {
      name: "plugin:mcp-git-inspector:diff",
      description: "Generate structured patch diff against specified commit"
    }
  ],
  plg00002: [
    {
      name: "plugin:mcp-code-analyzer:lint",
      description: "Run AST-based lint analysis across source files"
    }
  ]
};

async function apiFetch<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(options?.headers ?? {})
    }
  });

  const json: ApiResponse<T> = await res.json();
  if (!res.ok || !json.success) {
    const errorMsg = json.error?.message ?? `API error ${res.status}`;
    const err = Object.assign(new Error(errorMsg), {
      code: json.error?.code ?? undefined,
      details: json.error?.details ?? undefined
    });
    throw err;
  }

  return json.data as T;
}

export const pluginService = {
  async listPlugins(): Promise<PluginInstall[]> {
    try {
      const data = await apiFetch<{ plugins: PluginInstall[] }>(API_BASE);
      return data.plugins;
    } catch {
      return [...fixturePlugins];
    }
  },

  async installPlugin(manifest: PluginManifest): Promise<PluginInstall> {
    try {
      return await apiFetch<PluginInstall>(`${API_BASE}/install`, {
        method: "POST",
        body: JSON.stringify({ manifest })
      });
    } catch (err: unknown) {
      if (
        (err as Error)?.message?.includes("Failed to fetch") ||
        (err as Error)?.message?.includes("fetch")
      ) {
        const newInstall: PluginInstall = {
          id: fixturePlugins.length + 1,
          uuid: `plg${Math.random().toString(16).slice(2, 7)}`,
          plugin_id: manifest.plugin_id,
          version: manifest.version,
          manifest_digest: manifest.manifest_digest,
          enabled_state: "installed",
          grants: [],
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        fixturePlugins.push(newInstall);
        return newInstall;
      }
      throw err;
    }
  },

  async enablePlugin(uuid: string, grants?: string[]): Promise<PluginInstall> {
    try {
      return await apiFetch<PluginInstall>(`${API_BASE}/${uuid}/enable`, {
        method: "POST",
        body: JSON.stringify(grants ? { grants } : {})
      });
    } catch (err: unknown) {
      const item = fixturePlugins.find((p) => p.uuid === uuid);
      if (item) {
        if (item.enabled_state === "revoked") {
          throw new Error("Plugin is revoked and cannot be enabled");
        }
        item.enabled_state = "enabled";
        if (grants) item.grants = grants;
        item.updated_at = new Date().toISOString();
        return { ...item };
      }
      throw err;
    }
  },

  async disablePlugin(uuid: string): Promise<PluginInstall> {
    try {
      return await apiFetch<PluginInstall>(`${API_BASE}/${uuid}/disable`, {
        method: "POST"
      });
    } catch (err: unknown) {
      const item = fixturePlugins.find((p) => p.uuid === uuid);
      if (item) {
        item.enabled_state = "disabled";
        item.updated_at = new Date().toISOString();
        return { ...item };
      }
      throw err;
    }
  },

  async revokePlugin(uuid: string): Promise<PluginInstall> {
    try {
      return await apiFetch<PluginInstall>(`${API_BASE}/${uuid}/revoke`, {
        method: "POST"
      });
    } catch (err: unknown) {
      const item = fixturePlugins.find((p) => p.uuid === uuid);
      if (item) {
        item.enabled_state = "revoked";
        item.grants = [];
        item.updated_at = new Date().toISOString();
        return { ...item };
      }
      throw err;
    }
  },

  async uninstallPlugin(uuid: string): Promise<boolean> {
    try {
      const data = await apiFetch<{ uninstalled: boolean }>(`${API_BASE}/${uuid}`, {
        method: "DELETE"
      });
      return data.uninstalled;
    } catch (err: unknown) {
      const idx = fixturePlugins.findIndex((p) => p.uuid === uuid);
      if (idx !== -1) {
        fixturePlugins.splice(idx, 1);
        return true;
      }
      throw err;
    }
  },

  async listTools(uuid: string): Promise<PluginTool[]> {
    try {
      const data = await apiFetch<{ tools: PluginTool[] }>(`${API_BASE}/${uuid}/tools`);
      return data.tools;
    } catch {
      return fixtureTools[uuid] ?? [];
    }
  },

  async invokeTool(
    uuid: string,
    toolName: string,
    args: Record<string, unknown>
  ): Promise<unknown> {
    return await apiFetch<unknown>(`${API_BASE}/${uuid}/invoke`, {
      method: "POST",
      body: JSON.stringify({
        tool_name: toolName,
        arguments: args
      })
    });
  }
};
