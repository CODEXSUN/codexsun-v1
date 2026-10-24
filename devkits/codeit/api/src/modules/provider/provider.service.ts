import { NotFoundError } from "../../errors.js";
import type {
  GenerateStreamOptions,
  ModelCapability,
  NormalizedError,
  ProviderAdapter,
  ProviderMessage,
  ProviderStatus,
  ProviderTestResult,
  StreamChunk
} from "./provider.types.js";

/**
 * Sanitizes URLs and strings to ensure API keys are never exposed in logs or errors.
 */
function sanitizeSecret(text: string, secret?: string): string {
  let cleaned = text.replace(/([?&]key=)[^&]+/gi, "$1[REDACTED]");
  if (secret && secret.length > 4) {
    cleaned = cleaned.replaceAll(secret, "[REDACTED]");
  }
  return cleaned;
}

/**
 * Deterministic offline provider double for testing, isolated runs,
 * and environments without internet or external API access.
 */
export class MockProvider implements ProviderAdapter {
  public readonly id = "mock";
  public readonly name = "Mock Offline Provider";
  public readonly configured = true;
  public readonly models = ["mock-codeit-default", "mock-codeit-fast", "mock-codeit-reasoning"];
  public readonly defaultModel = "mock-codeit-default";

  public getCapabilities(_model?: string): ModelCapability {
    return {
      supports_streaming: true,
      supports_tools: true,
      supports_vision: false,
      max_context_tokens: 128000,
      max_output_tokens: 8192
    };
  }

  public async checkHealth(): Promise<ProviderStatus> {
    return {
      id: this.id,
      name: this.name,
      available: true,
      configured: true,
      models: [...this.models],
      default_model: this.defaultModel,
      latency_ms: 1
    };
  }

  public async *generateStream(options: GenerateStreamOptions): AsyncIterable<StreamChunk> {
    const signal = options.signal;
    if (signal?.aborted) {
      yield { type: "finish", finish_reason: "cancelled" };
      return;
    }

    const lastMsg = options.messages[options.messages.length - 1];
    const promptText = lastMsg ? lastMsg.content : "";

    // 1. Simulated Error Triggers (Fixture testing)
    if (promptText.includes("[SIMULATE_ERROR: rate_limit]")) {
      yield {
        type: "error",
        error: {
          code: "CODEIT_PROVIDER_RATE_LIMIT",
          message: "Rate limit exceeded (simulated)",
          retryable: true,
          status: 429
        }
      };
      return;
    }

    if (promptText.includes("[SIMULATE_ERROR: auth]")) {
      yield {
        type: "error",
        error: {
          code: "CODEIT_PROVIDER_AUTH_FAILED",
          message: "Authentication failed: invalid API key (simulated)",
          retryable: false,
          status: 401
        }
      };
      return;
    }

    if (promptText.includes("[SIMULATE_ERROR: timeout]")) {
      yield {
        type: "error",
        error: {
          code: "CODEIT_PROVIDER_TIMEOUT",
          message: "Request timed out after 30000ms (simulated)",
          retryable: true,
          status: 408
        }
      };
      return;
    }

    if (promptText.includes("[SIMULATE_ERROR: bad_request]")) {
      yield {
        type: "error",
        error: {
          code: "CODEIT_PROVIDER_BAD_REQUEST",
          message: "Invalid prompt payload (simulated)",
          retryable: false,
          status: 400
        }
      };
      return;
    }

    // 2. Simulated Tool Call Proposals
    // Notice: Provider adapter ONLY parses and yields tool-call proposals.
    // It strictly does NOT execute the tool calls.
    const toolCallMatch = promptText.match(
      /\[SIMULATE_TOOL_CALL:\s*([a-zA-Z0-9_-]+)\s*\((.*?)\)\]/s
    );
    if (toolCallMatch) {
      const toolName = toolCallMatch[1]!;
      const rawArgs = toolCallMatch[2]!.trim();
      let parsedArgs: string = "{}";
      try {
        if (rawArgs.length > 0) {
          JSON.parse(rawArgs);
          parsedArgs = rawArgs;
        }
      } catch {
        parsedArgs = JSON.stringify({ query: rawArgs });
      }

      yield {
        type: "tool_call_delta",
        tool_call: {
          id: `call_mock_${Date.now()}`,
          name: toolName,
          arguments_delta: parsedArgs,
          index: 0
        }
      };

      yield {
        type: "usage",
        usage: {
          prompt_tokens: 35,
          completion_tokens: 18,
          total_tokens: 53,
          is_estimated: false
        }
      };

      yield { type: "finish", finish_reason: "tool_calls" };
      return;
    }

    if (
      options.tools &&
      options.tools.length > 0 &&
      promptText.toLowerCase().includes("propose_tool")
    ) {
      const firstTool = options.tools[0]!;
      yield {
        type: "tool_call_delta",
        tool_call: {
          id: `call_mock_${Date.now()}`,
          name: firstTool.name,
          arguments_delta: JSON.stringify({ reason: "auto-proposed by mock" }),
          index: 0
        }
      };

      yield {
        type: "usage",
        usage: {
          prompt_tokens: 40,
          completion_tokens: 15,
          total_tokens: 55,
          is_estimated: false
        }
      };

      yield { type: "finish", finish_reason: "tool_calls" };
      return;
    }

    // 3. Normal Streamed Text Generation
    const chunks = [
      "I am the Codeit mock provider. ",
      "Executing planned developer steps ",
      "within the canonical workspace boundary."
    ];

    for (const chunk of chunks) {
      if (signal?.aborted) {
        yield { type: "finish", finish_reason: "cancelled" };
        return;
      }
      // Small tick for realistic streaming and cancellation interleaving
      await new Promise((r) => setTimeout(r, 5));
      if (signal?.aborted) {
        yield { type: "finish", finish_reason: "cancelled" };
        return;
      }
      yield { type: "text_delta", text: chunk };
    }

    // 4. Token Usage Accounting
    if (promptText.includes("[SIMULATE_USAGE: unknown]")) {
      yield {
        type: "usage",
        usage: {
          prompt_tokens: -1,
          completion_tokens: -1,
          total_tokens: -1,
          is_estimated: true
        }
      };
    } else {
      const promptTokens = Math.max(1, Math.ceil(promptText.length / 4));
      const completionTokens = Math.ceil(chunks.join("").length / 4);
      yield {
        type: "usage",
        usage: {
          prompt_tokens: promptTokens,
          completion_tokens: completionTokens,
          total_tokens: promptTokens + completionTokens,
          is_estimated: false
        }
      };
    }

    yield { type: "finish", finish_reason: "stop" };
  }
}

export interface GeminiProviderOptions {
  apiKey?: string | undefined;
  baseUrl?: string | undefined;
  fetchFn?: typeof fetch | undefined;
}

/**
 * Google Gemini adapter connecting to generativelanguage.googleapis.com
 * using server environment key GEMINI_API_KEY. Normalizes responses and errors.
 */
export class GeminiProvider implements ProviderAdapter {
  public readonly id = "gemini";
  public readonly name = "Google Gemini";
  public readonly models = ["gemini-2.0-flash", "gemini-1.5-pro", "gemini-1.5-flash"];
  public readonly defaultModel = "gemini-2.0-flash";

  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly fetchFn: typeof fetch;

  constructor(options: GeminiProviderOptions = {}) {
    this.apiKey =
      options.apiKey ?? process.env.GEMINI_API_KEY ?? process.env.CODEXSUN_GEMINI_API_KEY ?? "";
    this.baseUrl = (options.baseUrl ?? "https://generativelanguage.googleapis.com").replace(
      /\/+$/,
      ""
    );
    this.fetchFn = options.fetchFn ?? globalThis.fetch;
  }

  public get configured(): boolean {
    return Boolean(this.apiKey && this.apiKey.trim().length > 0);
  }

  public getCapabilities(_model?: string): ModelCapability {
    return {
      supports_streaming: true,
      supports_tools: true,
      supports_vision: true,
      max_context_tokens: 1048576,
      max_output_tokens: 8192
    };
  }

  public async checkHealth(): Promise<ProviderStatus> {
    if (!this.configured) {
      return {
        id: this.id,
        name: this.name,
        available: false,
        configured: false,
        models: [...this.models],
        default_model: this.defaultModel,
        error: "GEMINI_API_KEY environment variable not configured"
      };
    }

    const start = Date.now();
    try {
      // Light connectivity check to Gemini models endpoint without executing tokens
      const checkUrl = `${this.baseUrl}/v1beta/models?key=${encodeURIComponent(this.apiKey)}`;
      const res = await this.fetchFn(checkUrl, { method: "GET" });
      const latency = Date.now() - start;

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        const rawMsg =
          (errorData as { error?: { message?: string } })?.error?.message ?? `HTTP ${res.status}`;
        return {
          id: this.id,
          name: this.name,
          available: false,
          configured: true,
          models: [...this.models],
          default_model: this.defaultModel,
          latency_ms: latency,
          error: sanitizeSecret(rawMsg, this.apiKey)
        };
      }

      return {
        id: this.id,
        name: this.name,
        available: true,
        configured: true,
        models: [...this.models],
        default_model: this.defaultModel,
        latency_ms: latency
      };
    } catch (err: unknown) {
      const rawMsg = err instanceof Error ? err.message : String(err);
      return {
        id: this.id,
        name: this.name,
        available: false,
        configured: true,
        models: [...this.models],
        default_model: this.defaultModel,
        latency_ms: Date.now() - start,
        error: sanitizeSecret(rawMsg, this.apiKey)
      };
    }
  }

  public async *generateStream(options: GenerateStreamOptions): AsyncIterable<StreamChunk> {
    const signal = options.signal;
    if (signal?.aborted) {
      yield { type: "finish", finish_reason: "cancelled" };
      return;
    }

    if (!this.configured) {
      yield {
        type: "error",
        error: {
          code: "CODEIT_PROVIDER_AUTH_FAILED",
          message: "Gemini provider is not configured: missing GEMINI_API_KEY",
          retryable: false,
          status: 401
        }
      };
      return;
    }

    const model = options.model ?? this.defaultModel;
    const streamUrl = `${this.baseUrl}/v1beta/models/${encodeURIComponent(model)}:streamGenerateContent?alt=sse&key=${encodeURIComponent(this.apiKey)}`;

    // Build Gemini request payload
    const { contents, systemInstruction } = this.formatMessages(options.messages);

    const bodyPayload: Record<string, unknown> = { contents };

    if (systemInstruction) {
      bodyPayload["systemInstruction"] = systemInstruction;
    }

    if (options.tools && options.tools.length > 0) {
      bodyPayload["tools"] = [
        {
          functionDeclarations: options.tools.map((t) => ({
            name: t.name,
            description: t.description,
            parameters: t.parameters ?? { type: "object", properties: {} }
          }))
        }
      ];
    }

    const generationConfig: Record<string, unknown> = {};
    if (typeof options.temperature === "number") {
      generationConfig["temperature"] = options.temperature;
    }
    if (typeof options.max_tokens === "number") {
      generationConfig["maxOutputTokens"] = options.max_tokens;
    }
    if (Object.keys(generationConfig).length > 0) {
      bodyPayload["generationConfig"] = generationConfig;
    }

    const requestInit: RequestInit = {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(bodyPayload)
    };
    if (signal) {
      requestInit.signal = signal;
    }

    let response: Response;
    try {
      response = await this.fetchFn(streamUrl, requestInit);
    } catch (err: unknown) {
      if (signal?.aborted || (err instanceof Error && err.name === "AbortError")) {
        yield { type: "finish", finish_reason: "cancelled" };
        return;
      }
      const rawMsg = err instanceof Error ? err.message : String(err);
      yield {
        type: "error",
        error: {
          code: "CODEIT_PROVIDER_TIMEOUT",
          message: sanitizeSecret(
            `Network or timeout connecting to Gemini: ${rawMsg}`,
            this.apiKey
          ),
          retryable: true,
          status: 504
        }
      };
      return;
    }

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      let parsedError: Record<string, unknown> = {};
      try {
        parsedError = JSON.parse(errorText);
      } catch {
        parsedError = { raw: errorText };
      }

      const normalized = this.normalizeHttpError(response.status, parsedError);
      yield { type: "error", error: normalized };
      return;
    }

    if (!response.body) {
      yield {
        type: "error",
        error: {
          code: "CODEIT_PROVIDER_UNAVAILABLE",
          message: "Gemini returned empty response body",
          retryable: true,
          status: 502
        }
      };
      return;
    }

    // Process SSE stream with fragmented chunk reassembly
    let buffer = "";
    let finalReason: "stop" | "tool_calls" | "length" | "cancelled" | "error" = "stop";
    const decoder = new TextDecoder("utf8");

    try {
      // Use async iterator over response.body stream (compatible with Node fetch and browser fetch)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const stream = response.body as any;
      for await (const rawChunk of stream) {
        if (signal?.aborted) {
          yield { type: "finish", finish_reason: "cancelled" };
          return;
        }

        const chunkStr =
          typeof rawChunk === "string" ? rawChunk : decoder.decode(rawChunk, { stream: true });
        buffer += chunkStr;

        // SSE messages are delimited by double newlines (\n\n or \r\n\r\n)
        let delimiterIndex = -1;
        while (
          (delimiterIndex = buffer.indexOf("\n\n")) !== -1 ||
          (delimiterIndex = buffer.indexOf("\r\n\r\n")) !== -1
        ) {
          const isCrLf =
            buffer.indexOf("\r\n\r\n") !== -1 && delimiterIndex === buffer.indexOf("\r\n\r\n");
          const eventBlock = buffer.slice(0, delimiterIndex).trim();
          buffer = buffer.slice(delimiterIndex + (isCrLf ? 4 : 2));

          if (!eventBlock || eventBlock.startsWith(":")) {
            // Keep-alive comment or empty line
            continue;
          }

          const lines = eventBlock.split(/\r?\n/);
          for (const line of lines) {
            if (line.startsWith("data:")) {
              const jsonPayload = line.slice(5).trim();
              if (jsonPayload === "[DONE]") {
                break;
              }

              try {
                const parsed = JSON.parse(jsonPayload);
                const events = this.parseGeminiChunk(parsed);
                for (const ev of events) {
                  if (ev.type === "finish") {
                    finalReason = ev.finish_reason;
                  }
                  yield ev;
                }
              } catch {
                // Ignore malformed individual SSE payload
              }
            }
          }
        }
      }

      // Check remaining buffer if any
      if (buffer.trim().startsWith("data:")) {
        try {
          const jsonPayload = buffer.trim().slice(5).trim();
          if (jsonPayload !== "[DONE]") {
            const parsed = JSON.parse(jsonPayload);
            const events = this.parseGeminiChunk(parsed);
            for (const ev of events) {
              if (ev.type === "finish") {
                finalReason = ev.finish_reason;
              }
              yield ev;
            }
          }
        } catch {
          // ignore
        }
      }

      yield { type: "finish", finish_reason: finalReason };
    } catch (err: unknown) {
      if (signal?.aborted || (err instanceof Error && err.name === "AbortError")) {
        yield { type: "finish", finish_reason: "cancelled" };
        return;
      }
      const rawMsg = err instanceof Error ? err.message : String(err);
      yield {
        type: "error",
        error: {
          code: "CODEIT_PROVIDER_UNAVAILABLE",
          message: sanitizeSecret(`Stream error from Gemini: ${rawMsg}`, this.apiKey),
          retryable: true,
          status: 502
        }
      };
    }
  }

  private formatMessages(messages: ProviderMessage[]): {
    contents: Array<{ role: string; parts: Array<Record<string, unknown>> }>;
    systemInstruction?: { parts: Array<{ text: string }> } | undefined;
  } {
    let systemInstruction: { parts: Array<{ text: string }> } | undefined;
    const contents: Array<{ role: string; parts: Array<Record<string, unknown>> }> = [];

    for (const msg of messages) {
      if (msg.role === "system") {
        systemInstruction = { parts: [{ text: msg.content }] };
        continue;
      }

      const role = msg.role === "assistant" ? "model" : "user";
      const parts: Array<Record<string, unknown>> = [];

      if (msg.role === "tool") {
        parts.push({
          functionResponse: {
            name: msg.name ?? "tool_result",
            response: { content: msg.content }
          }
        });
      } else {
        if (msg.tool_calls && msg.tool_calls.length > 0) {
          for (const tc of msg.tool_calls) {
            let parsedArgs = tc.arguments;
            if (typeof parsedArgs === "string") {
              try {
                parsedArgs = JSON.parse(parsedArgs);
              } catch {
                parsedArgs = { value: parsedArgs };
              }
            }
            parts.push({
              functionCall: {
                name: tc.name,
                args: parsedArgs
              }
            });
          }
        }

        if (msg.content && msg.content.length > 0) {
          parts.push({ text: msg.content });
        }
      }

      if (parts.length > 0) {
        contents.push({ role, parts });
      }
    }

    if (contents.length === 0) {
      contents.push({ role: "user", parts: [{ text: "" }] });
    }

    return { contents, systemInstruction };
  }

  private parseGeminiChunk(payload: Record<string, unknown>): StreamChunk[] {
    const events: StreamChunk[] = [];
    const candidates = payload["candidates"] as Array<Record<string, unknown>> | undefined;

    if (candidates && candidates.length > 0) {
      const candidate = candidates[0]!;
      const content = candidate["content"] as
        { parts?: Array<Record<string, unknown>> } | undefined;

      if (content && Array.isArray(content.parts)) {
        for (const part of content.parts) {
          if (typeof part["text"] === "string") {
            events.push({ type: "text_delta", text: part["text"] });
          }

          if (part["functionCall"] && typeof part["functionCall"] === "object") {
            const fnCall = part["functionCall"] as { name?: string; args?: unknown };
            events.push({
              type: "tool_call_delta",
              tool_call: {
                id: `call_gemini_${Date.now()}`,
                name: fnCall.name ?? "tool",
                arguments_delta: JSON.stringify(fnCall.args ?? {})
              }
            });
          }
        }
      }

      const finishReason = candidate["finishReason"] as string | undefined;
      if (finishReason) {
        let mappedReason: "stop" | "tool_calls" | "length" | "cancelled" | "error" = "stop";
        if (finishReason === "MAX_TOKENS") {
          mappedReason = "length";
        } else if (finishReason === "TOOL_CALL" || finishReason === "FUNCTION_CALL") {
          mappedReason = "tool_calls";
        } else if (finishReason === "SAFETY" || finishReason === "RECITATION") {
          mappedReason = "error";
        }
        events.push({ type: "finish", finish_reason: mappedReason });
      }
    }

    const usageMeta = payload["usageMetadata"] as
      | { promptTokenCount?: number; candidatesTokenCount?: number; totalTokenCount?: number }
      | undefined;
    if (usageMeta) {
      events.push({
        type: "usage",
        usage: {
          prompt_tokens: usageMeta.promptTokenCount ?? -1,
          completion_tokens: usageMeta.candidatesTokenCount ?? -1,
          total_tokens: usageMeta.totalTokenCount ?? -1,
          is_estimated: false
        }
      });
    }

    return events;
  }

  private normalizeHttpError(status: number, data: Record<string, unknown>): NormalizedError {
    const errorObj = (data["error"] as Record<string, unknown>) ?? data;
    const rawMessage = (errorObj["message"] as string) ?? `Gemini error HTTP ${status}`;
    const cleanMessage = sanitizeSecret(rawMessage, this.apiKey);

    if (status === 429) {
      return {
        code: "CODEIT_PROVIDER_RATE_LIMIT",
        message: cleanMessage,
        retryable: true,
        status: 429
      };
    }

    if (status === 401 || status === 403) {
      return {
        code: "CODEIT_PROVIDER_AUTH_FAILED",
        message: cleanMessage,
        retryable: false,
        status
      };
    }

    if (status === 408 || status === 504) {
      return {
        code: "CODEIT_PROVIDER_TIMEOUT",
        message: cleanMessage,
        retryable: true,
        status
      };
    }

    if (status === 400) {
      return {
        code: "CODEIT_PROVIDER_BAD_REQUEST",
        message: cleanMessage,
        retryable: false,
        status: 400
      };
    }

    return {
      code: "CODEIT_PROVIDER_UNAVAILABLE",
      message: cleanMessage,
      retryable: status >= 500,
      status
    };
  }
}

/**
 * Provider Service managing configured model provider adapters.
 */
export class ProviderService {
  private readonly adapters = new Map<string, ProviderAdapter>();

  constructor(adapters?: ProviderAdapter[]) {
    if (adapters && adapters.length > 0) {
      for (const adapter of adapters) {
        this.registerAdapter(adapter);
      }
    } else {
      // Default: MockProvider (offline fallback) and GeminiProvider
      this.registerAdapter(new MockProvider());
      this.registerAdapter(new GeminiProvider());
    }
  }

  public registerAdapter(adapter: ProviderAdapter): void {
    this.adapters.set(adapter.id, adapter);
  }

  public getAdapter(id?: string): ProviderAdapter {
    if (!id) {
      return this.getDefaultAdapter();
    }
    const adapter = this.adapters.get(id);
    if (!adapter) {
      throw new NotFoundError(`Provider '${id}' is not registered`);
    }
    return adapter;
  }

  public getDefaultAdapter(): ProviderAdapter {
    // Prefer configured Gemini provider if active, otherwise fall back to offline MockProvider
    const gemini = this.adapters.get("gemini");
    if (gemini && gemini.configured) {
      return gemini;
    }
    const mock = this.adapters.get("mock");
    if (mock) {
      return mock;
    }
    const first = this.adapters.values().next().value;
    if (first) {
      return first;
    }
    throw new NotFoundError("No provider adapters configured");
  }

  public async listProviders(): Promise<ProviderStatus[]> {
    const statuses: ProviderStatus[] = [];
    for (const adapter of this.adapters.values()) {
      try {
        const status = await adapter.checkHealth();
        statuses.push(status);
      } catch (err: unknown) {
        statuses.push({
          id: adapter.id,
          name: adapter.name,
          available: false,
          configured: adapter.configured,
          models: [...adapter.models],
          default_model: adapter.defaultModel,
          error: err instanceof Error ? err.message : String(err)
        });
      }
    }
    return statuses;
  }

  public async testProvider(id?: string, model?: string): Promise<ProviderTestResult> {
    const adapter = this.getAdapter(id);
    const targetModel = model ?? adapter.defaultModel;
    const start = Date.now();

    try {
      const stream = adapter.generateStream({
        model: targetModel,
        messages: [{ role: "user", content: "ping test connection" }],
        max_tokens: 10
      });

      let receivedAnyChunk = false;
      let errorOccurred: NormalizedError | null = null;

      for await (const chunk of stream) {
        if (chunk.type === "error") {
          errorOccurred = chunk.error;
          break;
        }
        if (
          chunk.type === "text_delta" ||
          chunk.type === "tool_call_delta" ||
          chunk.type === "finish"
        ) {
          receivedAnyChunk = true;
        }
      }

      const latency_ms = Date.now() - start;

      if (errorOccurred) {
        return {
          success: false,
          provider: adapter.id,
          model: targetModel,
          latency_ms,
          message: errorOccurred.message
        };
      }

      if (!receivedAnyChunk) {
        return {
          success: false,
          provider: adapter.id,
          model: targetModel,
          latency_ms,
          message: "No stream chunks returned from provider test"
        };
      }

      return {
        success: true,
        provider: adapter.id,
        model: targetModel,
        latency_ms,
        message: "Provider connection and streaming verified"
      };
    } catch (err: unknown) {
      const latency_ms = Date.now() - start;
      const msg = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        provider: adapter.id,
        model: targetModel,
        latency_ms,
        message: msg
      };
    }
  }

  public generateStream(
    options: GenerateStreamOptions & { provider?: string }
  ): AsyncIterable<StreamChunk> {
    const adapter = this.getAdapter(options.provider);
    return adapter.generateStream(options);
  }
}
