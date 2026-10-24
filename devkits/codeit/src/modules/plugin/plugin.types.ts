export type PluginEnabledState = "installed" | "enabled" | "disabled" | "revoked";

export interface PluginInstall {
  id?: number | undefined;
  uuid: string;
  plugin_id: string;
  version: string;
  manifest_digest: string;
  enabled_state: PluginEnabledState;
  grants: string[];
  created_at: string;
  updated_at: string;
}

export interface AdvertisedTool {
  name: string;
  description?: string | undefined;
  inputSchema?: Record<string, unknown> | undefined;
  required_grants?: string[] | undefined;
}

export interface PluginManifest {
  plugin_id: string;
  name: string;
  version: string;
  description: string;
  entrypoint: string | { command: string; args?: string[] | undefined };
  manifest_digest: string;
  capabilities: string[];
  advertised_tools: AdvertisedTool[];
  requested_grants: string[];
  author?:
    string | { name: string; email?: string | undefined; url?: string | undefined } | undefined;
}

export interface PluginTool {
  name: string;
  description?: string | undefined;
  inputSchema?: Record<string, unknown> | undefined;
}

export interface PluginPanelProps {
  currentProjectUuid?: string | undefined;
  className?: string | undefined;
}
