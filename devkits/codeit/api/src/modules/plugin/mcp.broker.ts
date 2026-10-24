import { type ChildProcess, execSync, spawn } from "node:child_process";
import { resolve } from "node:path";
import { CodeitError } from "../../errors.js";
import {
  type McpCallToolResult,
  McpProtocolError,
  type McpRequest,
  type McpResponse,
  type McpToolDefinition,
  PluginRevokedError,
  type PluginEntrypoint,
  type PluginManifest
} from "./plugin.types.js";

const DEFAULT_MCP_PROTOCOL_VERSION = "2024-11-05";
const MAX_PAYLOAD_BYTES = 500 * 1024; // 500KB budget limit (E16)
const SENSITIVE_KEY_PATTERN =
  /(?:_KEY|_SECRET|_TOKEN|PASSWORD|CREDENTIAL|PRIVATE_KEY|AUTH_TOKEN|API_KEY|BEARER|CANARY)/i;

/**
 * Strips secret tokens and canary keys from process environment (E21).
 */
export function getScrubbedEnv(customEnv?: Record<string, string>): NodeJS.ProcessEnv {
  const cleanEnv: NodeJS.ProcessEnv = {};
  for (const [key, val] of Object.entries(process.env)) {
    if (val !== undefined && !SENSITIVE_KEY_PATTERN.test(key)) {
      cleanEnv[key] = val;
    }
  }

  if (customEnv) {
    for (const [key, val] of Object.entries(customEnv)) {
      if (!SENSITIVE_KEY_PATTERN.test(key)) {
        cleanEnv[key] = val;
      }
    }
  }

  cleanEnv.NODE_ENV = cleanEnv.NODE_ENV ?? "test";
  return cleanEnv;
}

/**
 * Cross-platform process tree killer to enforce cancellation (E10).
 */
export function killProcessTree(child: ChildProcess): void {
  const pid = child.pid;
  if (!pid) return;

  try {
    if (process.platform === "win32") {
      try {
        execSync(`taskkill /pid ${pid} /t /f`, { stdio: "ignore" });
      } catch {
        // Child or tree may have already terminated
      }
    } else {
      try {
        process.kill(-pid, "SIGKILL");
      } catch {
        try {
          process.kill(pid, "SIGKILL");
        } catch {
          // ignore
        }
      }
    }
  } finally {
    try {
      child.kill("SIGKILL");
    } catch {
      // ignore
    }
  }
}

export function namespaceToolName(pluginId: string, toolName: string): string {
  if (toolName.startsWith(`plugin:${pluginId}:`)) {
    return toolName;
  }
  return `plugin:${pluginId}:${toolName}`;
}

export function unnamespaceToolName(pluginId: string, toolName: string): string {
  const prefix = `plugin:${pluginId}:`;
  if (toolName.startsWith(prefix)) {
    return toolName.slice(prefix.length);
  }
  if (toolName.startsWith("plugin:")) {
    throw new CodeitError(
      "CODEIT_RESOURCE_DENIED",
      `Tool '${toolName}' does not belong to plugin '${pluginId}'`,
      403
    );
  }
  return toolName;
}

interface PendingRequest {
  resolve: (value: unknown) => void;
  reject: (reason: unknown) => void;
  timer?: NodeJS.Timeout | undefined;
}

export interface McpSession {
  pluginId: string;
  child: ChildProcess;
  requestId: number;
  pendingRequests: Map<number | string, PendingRequest>;
  initialized: boolean;
  advertisedTools: McpToolDefinition[];
  protocolVersion: string;
}

export class McpBroker {
  private activeSessions = new Map<string, McpSession>();
  private spawningPromises = new Map<string, Promise<McpSession>>();
  private fencedPlugins = new Set<string>();

  /**
   * Spawns or retrieves an active MCP stdio process session for the plugin.
   */
  async getOrCreateSession(
    pluginId: string,
    manifest: PluginManifest,
    options?: { timeoutMs?: number | undefined; signal?: AbortSignal | undefined }
  ): Promise<McpSession> {
    if (this.fencedPlugins.has(pluginId)) {
      throw new PluginRevokedError(`Plugin '${pluginId}' operations fenced`);
    }

    const existing = this.activeSessions.get(pluginId);
    if (
      existing &&
      !existing.child.killed &&
      existing.child.exitCode === null &&
      existing.initialized
    ) {
      return existing;
    }

    const existingPromise = this.spawningPromises.get(pluginId);
    if (existingPromise) {
      return existingPromise;
    }

    const spawnPromise = this.spawnSession(pluginId, manifest, options).finally(() => {
      this.spawningPromises.delete(pluginId);
    });

    this.spawningPromises.set(pluginId, spawnPromise);
    return spawnPromise;
  }

  /**
   * Spawns a new child process with scrubbed env and executes the MCP handshake.
   */
  private async spawnSession(
    pluginId: string,
    manifest: PluginManifest,
    options?: { timeoutMs?: number | undefined; signal?: AbortSignal | undefined }
  ): Promise<McpSession> {
    if (this.fencedPlugins.has(pluginId)) {
      throw new PluginRevokedError(`Plugin '${pluginId}' operations fenced`);
    }

    const { command, args } = this.resolveEntrypoint(manifest.entrypoint);
    const scrubbedEnv = getScrubbedEnv();

    const child = spawn(command, args, {
      stdio: ["pipe", "pipe", "pipe"],
      env: scrubbedEnv,
      cwd: process.cwd()
    });

    // Handle stdin errors (e.g. EPIPE when child terminates or is cancelled)
    child.stdin?.on("error", () => {
      // Ignore pipe errors on process termination
    });

    const session: McpSession = {
      pluginId,
      child,
      requestId: 0,
      pendingRequests: new Map(),
      initialized: false,
      advertisedTools: [],
      protocolVersion: DEFAULT_MCP_PROTOCOL_VERSION
    };

    // Register session immediately so fencePlugin can terminate it even during handshake
    this.activeSessions.set(pluginId, session);

    if (this.fencedPlugins.has(pluginId)) {
      killProcessTree(child);
      this.activeSessions.delete(pluginId);
      throw new PluginRevokedError(`Plugin '${pluginId}' operations fenced`);
    }

    let stdoutBuffer = "";
    child.stdout?.setEncoding("utf8");
    child.stdout?.on("data", (chunk: string) => {
      stdoutBuffer += chunk;
      let newlineIdx = stdoutBuffer.indexOf("\n");
      while (newlineIdx !== -1) {
        const line = stdoutBuffer.slice(0, newlineIdx).trim();
        stdoutBuffer = stdoutBuffer.slice(newlineIdx + 1);
        if (line.length > 0) {
          this.handleStdoutLine(session, line);
        }
        newlineIdx = stdoutBuffer.indexOf("\n");
      }
    });

    child.on("exit", (code, signal) => {
      // Reject any pending requests
      for (const [_id, req] of session.pendingRequests) {
        if (req.timer) clearTimeout(req.timer);
        req.reject(
          new McpProtocolError(
            `MCP server process exited prematurely with code ${code ?? signal}`,
            { code, signal }
          )
        );
      }
      session.pendingRequests.clear();
      this.activeSessions.delete(pluginId);
    });

    child.on("error", (err) => {
      for (const [_id, req] of session.pendingRequests) {
        if (req.timer) clearTimeout(req.timer);
        req.reject(new McpProtocolError(`MCP process spawn error: ${err.message}`));
      }
      session.pendingRequests.clear();
      this.activeSessions.delete(pluginId);
    });

    // Execute MCP Handshake: initialize -> initialized -> tools/list
    try {
      const initTimeout = options?.timeoutMs ?? 10000;
      const initResult = (await this.sendRequest(
        session,
        "initialize",
        {
          protocolVersion: DEFAULT_MCP_PROTOCOL_VERSION,
          capabilities: {},
          clientInfo: {
            name: "codeit-mcp-broker",
            version: "1.0.0"
          }
        },
        initTimeout,
        options?.signal
      )) as { protocolVersion?: string; capabilities?: Record<string, unknown> };

      session.protocolVersion = initResult.protocolVersion ?? DEFAULT_MCP_PROTOCOL_VERSION;
      session.initialized = true;

      // Send initialized notification
      this.sendNotification(session, "notifications/initialized", {});

      // Query tools/list to negotiate advertised tools
      const toolsResult = (await this.sendRequest(
        session,
        "tools/list",
        {},
        initTimeout,
        options?.signal
      )) as { tools?: McpToolDefinition[] };

      if (toolsResult && Array.isArray(toolsResult.tools)) {
        session.advertisedTools = toolsResult.tools;
      }
    } catch (err) {
      killProcessTree(child);
      this.activeSessions.delete(pluginId);
      if (this.fencedPlugins.has(pluginId)) {
        throw new PluginRevokedError(`Plugin '${pluginId}' operations fenced`);
      }
      throw err;
    }

    return session;
  }

  private handleStdoutLine(session: McpSession, line: string): void {
    try {
      const msg = JSON.parse(line) as McpResponse;
      if (msg.id !== undefined && session.pendingRequests.has(msg.id)) {
        const pending = session.pendingRequests.get(msg.id)!;
        session.pendingRequests.delete(msg.id);
        if (pending.timer) clearTimeout(pending.timer);

        if (msg.error) {
          pending.reject(
            new McpProtocolError(msg.error.message || "MCP server returned an error", {
              code: msg.error.code,
              data: msg.error.data
            })
          );
        } else {
          pending.resolve(msg.result);
        }
      }
    } catch {
      // Ignore unparseable non-JSON messages or log
    }
  }

  private sendNotification(session: McpSession, method: string, params?: unknown): void {
    if (!session.child.stdin || session.child.killed || session.child.stdin.destroyed) return;
    const notification = {
      jsonrpc: "2.0",
      method,
      params
    };
    try {
      session.child.stdin.write(JSON.stringify(notification) + "\n", "utf8", () => {});
    } catch {
      // ignore write errors on terminated process
    }
  }

  private sendRequest(
    session: McpSession,
    method: string,
    params: unknown,
    timeoutMs = 15000,
    signal?: AbortSignal
  ): Promise<unknown> {
    return new Promise((resolve, reject) => {
      if (session.child.killed || session.child.exitCode !== null) {
        return reject(new PluginRevokedError("MCP child process is not running"));
      }

      if (signal?.aborted) {
        killProcessTree(session.child);
        return reject(
          new CodeitError("CODEIT_INVALID_STATE", "MCP invocation cancelled by abort signal", 499)
        );
      }

      const id = ++session.requestId;

      let timer: NodeJS.Timeout | undefined;
      if (timeoutMs > 0) {
        timer = setTimeout(() => {
          session.pendingRequests.delete(id);
          killProcessTree(session.child);
          this.activeSessions.delete(session.pluginId);
          reject(
            new CodeitError(
              "CODEIT_BUDGET_EXCEEDED",
              `MCP request '${method}' timed out after ${timeoutMs}ms`,
              504
            )
          );
        }, timeoutMs);
      }

      let abortListener: (() => void) | undefined;
      if (signal) {
        abortListener = () => {
          if (timer) clearTimeout(timer);
          session.pendingRequests.delete(id);
          killProcessTree(session.child);
          this.activeSessions.delete(session.pluginId);
          reject(
            new CodeitError("CODEIT_INVALID_STATE", "MCP invocation cancelled by abort signal", 499)
          );
        };
        signal.addEventListener("abort", abortListener, { once: true });
      }

      session.pendingRequests.set(id, {
        resolve: (val) => {
          if (abortListener && signal) {
            signal.removeEventListener("abort", abortListener);
          }
          resolve(val);
        },
        reject: (err) => {
          if (abortListener && signal) {
            signal.removeEventListener("abort", abortListener);
          }
          reject(err);
        },
        timer
      });

      const request: McpRequest = {
        jsonrpc: "2.0",
        id,
        method,
        params
      };

      try {
        if (!session.child.stdin || session.child.killed || session.child.stdin.destroyed) {
          session.pendingRequests.delete(id);
          if (timer) clearTimeout(timer);
          return reject(new PluginRevokedError("MCP child process is not running"));
        }
        session.child.stdin.write(JSON.stringify(request) + "\n", "utf8", (err) => {
          if (err) {
            session.pendingRequests.delete(id);
            if (timer) clearTimeout(timer);
            reject(new McpProtocolError(`Failed to write to child stdin: ${err.message}`));
          }
        });
      } catch (err) {
        session.pendingRequests.delete(id);
        if (timer) clearTimeout(timer);
        reject(new McpProtocolError(`Failed to write to child stdin: ${err}`));
      }
    });
  }

  /**
   * Namespaces tools and returns them.
   */
  async listTools(
    pluginId: string,
    manifest: PluginManifest,
    options?: { timeoutMs?: number | undefined; signal?: AbortSignal | undefined }
  ): Promise<McpToolDefinition[]> {
    let rawTools: McpToolDefinition[] = [];

    // Prefer querying the live broker session if available or negotiable
    try {
      const session = await this.getOrCreateSession(pluginId, manifest, options);
      rawTools = session.advertisedTools;
    } catch {
      // Fallback to manifest advertised_tools if process has not started yet
      rawTools = (manifest.advertised_tools ?? []).map((t) => ({
        name: t.name,
        description: t.description,
        inputSchema: t.inputSchema
      }));
    }

    return rawTools.map((t) => ({
      ...t,
      name: namespaceToolName(pluginId, t.name)
    }));
  }

  /**
   * Invokes an MCP tool via `tools/call`, bounding the payload output (E16).
   */
  async callTool(
    pluginId: string,
    manifest: PluginManifest,
    toolName: string,
    args: Record<string, unknown>,
    options?: { timeoutMs?: number | undefined; signal?: AbortSignal | undefined }
  ): Promise<McpCallToolResult> {
    if (this.fencedPlugins.has(pluginId)) {
      throw new PluginRevokedError(`Plugin '${pluginId}' operations fenced`);
    }

    const rawToolName = unnamespaceToolName(pluginId, toolName);
    const session = await this.getOrCreateSession(pluginId, manifest, options);

    if (this.fencedPlugins.has(pluginId)) {
      this.fencePlugin(pluginId);
      throw new PluginRevokedError(`Plugin '${pluginId}' operations fenced`);
    }

    const timeout = options?.timeoutMs ?? 15000;
    const rawResult = await this.sendRequest(
      session,
      "tools/call",
      {
        name: rawToolName,
        arguments: args
      },
      timeout,
      options?.signal
    );

    return this.boundCallToolResult(rawResult);
  }

  /**
   * Bounding output payload size <= 500KB with truncation indicator (E16).
   */
  private boundCallToolResult(result: unknown): McpCallToolResult {
    let content: Array<{ type: string; text?: string; data?: string; mimeType?: string }> = [];
    let isError = false;

    if (result && typeof result === "object") {
      const obj = result as Record<string, unknown>;
      if (Array.isArray(obj.content)) {
        content = obj.content as Array<{
          type: string;
          text?: string;
          data?: string;
          mimeType?: string;
        }>;
      } else if (typeof obj.text === "string") {
        content = [{ type: "text", text: obj.text }];
      } else {
        content = [{ type: "text", text: JSON.stringify(obj) }];
      }
      isError = Boolean(obj.isError);
    } else if (typeof result === "string") {
      content = [{ type: "text", text: result }];
    } else {
      content = [{ type: "text", text: String(result ?? "") }];
    }

    let totalBytes = 0;
    let truncated = false;

    const boundedContent = content.map((item) => {
      if (item.text) {
        const itemBytes = Buffer.byteLength(item.text, "utf8");
        if (totalBytes + itemBytes > MAX_PAYLOAD_BYTES) {
          truncated = true;
          const availableBytes = Math.max(0, MAX_PAYLOAD_BYTES - totalBytes - 80);
          const slicedText = Buffer.from(item.text, "utf8")
            .subarray(0, availableBytes)
            .toString("utf8");
          totalBytes = MAX_PAYLOAD_BYTES;
          return {
            ...item,
            text: slicedText + "\n[TRUNCATED: Output exceeded 500KB payload limit]"
          };
        }
        totalBytes += itemBytes;
      }
      return item;
    });

    return {
      content: boundedContent,
      isError,
      truncated
    };
  }

  /**
   * Fences all work for a plugin immediately by killing active processes and rejecting pending calls (E12, E18).
   */
  fencePlugin(pluginId: string): void {
    this.fencedPlugins.add(pluginId);
    this.spawningPromises.delete(pluginId);

    const session = this.activeSessions.get(pluginId);
    if (!session) return;

    for (const [_id, req] of session.pendingRequests) {
      if (req.timer) clearTimeout(req.timer);
      req.reject(new PluginRevokedError(`Plugin '${pluginId}' operations fenced`));
    }
    session.pendingRequests.clear();

    killProcessTree(session.child);
    this.activeSessions.delete(pluginId);
  }

  /**
   * Clears the fence on a plugin when explicitly re-enabled.
   */
  unfencePlugin(pluginId: string): void {
    this.fencedPlugins.delete(pluginId);
  }

  /**
   * Terminates all active child processes across all plugins.
   */
  terminateAll(): void {
    for (const pluginId of Array.from(this.activeSessions.keys())) {
      this.fencePlugin(pluginId);
    }
  }

  private resolveEntrypoint(entrypoint: PluginEntrypoint): {
    command: string;
    args: string[];
  } {
    if (typeof entrypoint === "string") {
      const parts = entrypoint.trim().split(/\s+/);
      const command = parts[0]!;
      const args = parts.slice(1).map((arg) => {
        if (arg.startsWith("./") || arg.startsWith("../")) {
          return resolve(process.cwd(), arg);
        }
        return arg;
      });
      return { command, args };
    }

    const command = entrypoint.command;
    const args = (entrypoint.args ?? []).map((arg) => {
      if (arg.startsWith("./") || arg.startsWith("../")) {
        return resolve(process.cwd(), arg);
      }
      return arg;
    });

    return { command, args };
  }
}

export { McpBroker as PluginBroker };
