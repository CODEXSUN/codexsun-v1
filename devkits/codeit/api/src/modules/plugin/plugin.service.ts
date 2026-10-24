import { randomBytes } from "node:crypto";
import { CodeitError, NotFoundError } from "../../errors.js";
import { type McpBroker, unnamespaceToolName } from "./mcp.broker.js";
import { type PluginRepository } from "./plugin.repository.js";
import {
  computeManifestDigest,
  type McpCallToolResult,
  type McpToolDefinition,
  type PluginInstallRecord,
  PluginIntegrityError,
  type PluginManifest,
  PluginManifestSchema,
  PluginRevokedError,
  PluginStateError
} from "./plugin.types.js";

export class PluginService {
  private manifestsByPluginId = new Map<string, PluginManifest>();

  constructor(
    private readonly repo: PluginRepository,
    private readonly broker: McpBroker
  ) {}

  /**
   * Installs a plugin after validating manifest schema and SHA-256 integrity digest (E17).
   */
  install(rawManifest: unknown): PluginInstallRecord {
    const parseResult = PluginManifestSchema.safeParse(rawManifest);
    if (!parseResult.success) {
      throw new CodeitError(
        "CODEIT_VALIDATION_ERROR",
        `Invalid plugin manifest schema: ${parseResult.error.message}`,
        400,
        false,
        { issues: parseResult.error.issues }
      );
    }

    const manifest = parseResult.data;

    // Verify manifest digest integrity
    const computedDigest = computeManifestDigest(manifest);
    if (computedDigest !== manifest.manifest_digest) {
      throw new PluginIntegrityError(
        "Plugin manifest integrity violation: digest mismatch. Package or manifest has been tampered with.",
        {
          expected: manifest.manifest_digest,
          computed: computedDigest
        }
      );
    }

    // Check existing installation
    const existing = this.repo.findByPluginId(manifest.plugin_id);
    if (existing) {
      if (existing.enabled_state === "revoked") {
        throw new PluginRevokedError(
          `Plugin '${manifest.plugin_id}' was previously revoked. It must be explicitly uninstalled before reinstalling.`,
          { plugin_id: manifest.plugin_id, uuid: existing.uuid }
        );
      }

      // Update cached manifest and return existing install
      this.manifestsByPluginId.set(manifest.plugin_id, manifest);
      return existing;
    }

    const uuid = randomBytes(4).toString("hex");
    const record = this.repo.create({
      uuid,
      plugin_id: manifest.plugin_id,
      version: manifest.version,
      manifest_digest: manifest.manifest_digest,
      enabled_state: "installed",
      grants: []
    });

    this.manifestsByPluginId.set(manifest.plugin_id, manifest);
    return record;
  }

  /**
   * Activates an installed plugin and configures explicit capability grants (E17).
   */
  enable(uuid: string, grants?: string[]): PluginInstallRecord {
    const record = this.repo.findByUuid(uuid);
    if (!record) {
      throw new NotFoundError(`Plugin install with uuid '${uuid}' not found`);
    }

    if (record.enabled_state === "revoked") {
      throw new PluginRevokedError(
        `Plugin '${record.plugin_id}' has been revoked and cannot be enabled`,
        { plugin_id: record.plugin_id, uuid }
      );
    }

    let updatedGrants = record.grants;
    if (grants && Array.isArray(grants)) {
      updatedGrants = grants;
      this.repo.updateGrants(uuid, updatedGrants);
    } else if (record.grants.length === 0) {
      const manifest = this.manifestsByPluginId.get(record.plugin_id);
      if (manifest?.requested_grants) {
        updatedGrants = manifest.requested_grants;
        this.repo.updateGrants(uuid, updatedGrants);
      }
    }

    // Clear any previous execution fence when explicitly re-enabled
    this.broker.unfencePlugin(record.plugin_id);

    return this.repo.updateEnabledState(uuid, "enabled");
  }

  /**
   * Disables a plugin, immediately fencing in-flight executions and stopping broker processes (E12, E18).
   */
  disable(uuid: string): PluginInstallRecord {
    const record = this.repo.findByUuid(uuid);
    if (!record) {
      throw new NotFoundError(`Plugin install with uuid '${uuid}' not found`);
    }

    if (record.enabled_state === "revoked") {
      throw new PluginRevokedError(`Plugin '${record.plugin_id}' has been revoked`, {
        plugin_id: record.plugin_id,
        uuid
      });
    }

    // Fence active executions and processes immediately
    this.broker.fencePlugin(record.plugin_id);

    return this.repo.updateEnabledState(uuid, "disabled");
  }

  /**
   * Revokes a plugin permanently fencing all work and clearing all grants (E12, E18).
   */
  revoke(uuid: string): PluginInstallRecord {
    const record = this.repo.findByUuid(uuid);
    if (!record) {
      throw new NotFoundError(`Plugin install with uuid '${uuid}' not found`);
    }

    // Immediately fence active broker connections and processes
    this.broker.fencePlugin(record.plugin_id);

    // Clear grants and set state to revoked
    this.repo.updateGrants(uuid, []);
    return this.repo.updateEnabledState(uuid, "revoked");
  }

  /**
   * Uninstalls a plugin, stopping broker processes and deleting persistence.
   */
  uninstall(uuid: string): boolean {
    const record = this.repo.findByUuid(uuid);
    if (!record) {
      throw new NotFoundError(`Plugin install with uuid '${uuid}' not found`);
    }

    this.broker.fencePlugin(record.plugin_id);
    this.manifestsByPluginId.delete(record.plugin_id);
    return this.repo.delete(uuid);
  }

  listPlugins(): PluginInstallRecord[] {
    return this.repo.list();
  }

  getPluginByUuid(uuid: string): PluginInstallRecord {
    const record = this.repo.findByUuid(uuid);
    if (!record) {
      throw new NotFoundError(`Plugin with uuid '${uuid}' not found`);
    }
    return record;
  }

  registerManifest(manifest: PluginManifest): void {
    this.manifestsByPluginId.set(manifest.plugin_id, manifest);
  }

  getManifest(pluginId: string): PluginManifest | null {
    return this.manifestsByPluginId.get(pluginId) ?? null;
  }

  /**
   * Lists advertised tools namespaced with `plugin:<plugin_id>:<tool_name>`.
   */
  async listTools(
    uuid: string,
    options?: { timeoutMs?: number | undefined; signal?: AbortSignal | undefined }
  ): Promise<McpToolDefinition[]> {
    const record = this.getPluginByUuid(uuid);

    if (record.enabled_state === "revoked") {
      throw new PluginRevokedError(`Plugin '${record.plugin_id}' is revoked`, {
        plugin_id: record.plugin_id,
        uuid
      });
    }

    if (record.enabled_state !== "enabled") {
      throw new PluginStateError(
        `Plugin '${record.plugin_id}' is not enabled (current state: ${record.enabled_state})`,
        { plugin_id: record.plugin_id, state: record.enabled_state }
      );
    }

    const manifest = this.manifestsByPluginId.get(record.plugin_id);
    if (!manifest) {
      throw new NotFoundError(`Manifest for plugin '${record.plugin_id}' is not loaded`);
    }

    return this.broker.listTools(record.plugin_id, manifest, options);
  }

  /**
   * Invokes an MCP tool on an enabled plugin with grant and boundary enforcement (E17, E18, E20).
   */
  async invokeTool(
    uuid: string,
    toolName: string,
    args: Record<string, unknown>,
    options?: { timeoutMs?: number | undefined; signal?: AbortSignal | undefined }
  ): Promise<McpCallToolResult> {
    const record = this.getPluginByUuid(uuid);

    if (record.enabled_state === "revoked") {
      throw new PluginRevokedError(
        `Plugin '${record.plugin_id}' is revoked. Invocations fail closed.`,
        { plugin_id: record.plugin_id, uuid }
      );
    }

    if (record.enabled_state !== "enabled") {
      throw new PluginStateError(
        `Plugin '${record.plugin_id}' is not enabled (current state: ${record.enabled_state})`,
        { plugin_id: record.plugin_id, state: record.enabled_state }
      );
    }

    const manifest = this.manifestsByPluginId.get(record.plugin_id);
    if (!manifest) {
      throw new NotFoundError(`Manifest for plugin '${record.plugin_id}' is not loaded`);
    }

    // Check tool ownership and namespacing
    const rawToolName = unnamespaceToolName(record.plugin_id, toolName);

    // Capability / Grant check: enforce required grants
    const toolDef = manifest.advertised_tools?.find((t) => t.name === rawToolName);
    if (toolDef && toolDef.required_grants && toolDef.required_grants.length > 0) {
      const missingGrants = toolDef.required_grants.filter((g) => !record.grants.includes(g));
      if (missingGrants.length > 0) {
        throw new CodeitError(
          "CODEIT_APPROVAL_REQUIRED",
          `Plugin '${record.plugin_id}' lacks required grants for tool '${rawToolName}': ${missingGrants.join(", ")}`,
          403,
          false,
          { missing_grants: missingGrants }
        );
      }
    }

    return this.broker.callTool(record.plugin_id, manifest, rawToolName, args, options);
  }
}
