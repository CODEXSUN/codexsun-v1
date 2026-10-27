import { sql } from "kysely";
import { ChatTelegramRepository } from "./chat.telegram.repository.js";
import { TelegramAccountApi, telegramFailure } from "./chat.telegram.api.js";
import {
  encryptTelegramSecret,
  decryptTelegramSecret,
  telegramCredentialScope
} from "./chat.telegram.crypto.js";
import { ChatTelegramSync } from "./chat.telegram.sync.js";
import type { ChatRuntimeContext, ChatMessage } from "./chat.types.js";
import type {
  TelegramDependencies,
  TelegramAccountRow,
  TelegramCredentials,
  TelegramClientApi
} from "./chat.telegram.types.js";

export class ChatTelegramWorker {
  private readonly repository = new ChatTelegramRepository();
  private readonly sync: ChatTelegramSync;
  constructor(
    private readonly dependencies: TelegramDependencies,
    publish: (context: ChatRuntimeContext, message: ChatMessage) => void | Promise<void>
  ) {
    this.sync = new ChatTelegramSync(dependencies.secretKey, publish);
  }
  start() {
    this.dependencies.registerProcessor((tenant, account, operation) =>
      this.process(tenant, account, operation)
    );
    let stopped = false;
    let inFlight: Promise<void> | undefined;
    const dispatch = async () => {
      try {
        for (const scope of await this.dependencies.scopes()) {
          if (stopped) return;
          try {
            for (const account of await this.repository.list(scope)) {
              if (stopped) return;
              const slot =
                account.auth_state === "connected" ? `:${Math.floor(Date.now() / 15_000)}` : "";
              await this.dependencies.enqueue({
                jobName: "chat.telegram.sync",
                queueName: "chat",
                sourceModule: "chat.telegram",
                tenantId: scope.tenantId,
                correlationId: `telegram:${account.uuid}`,
                maxAttempts: account.auth_state === "connected" ? 3 : 1,
                idempotencyKey: `telegram:${scope.tenantId}:${account.uuid}:${account.operation_id}${slot}`,
                payload: { accountUuid: account.uuid, operationId: account.operation_id }
              });
            }
          } catch {
            console.warn(
              "[chat.telegram] Tenant dispatch deferred. Check Telegram Settings and Queue Manager."
            );
          }
        }
      } catch {
        console.warn("[chat.telegram] Account dispatch deferred.");
      }
    };
    const timer = setInterval(() => {
      if (stopped || inFlight) return;
      inFlight = dispatch().finally(() => {
        inFlight = undefined;
      });
    }, 5_000);
    timer.unref();
    return async () => {
      stopped = true;
      clearInterval(timer);
      await inFlight;
    };
  }
  async process(tenantId: string, accountUuid: string, operationId: string) {
    const scope = (await this.dependencies.scopes()).find((scope) => scope.tenantId === tenantId);
    if (!scope) throw new Error("Telegram tenant or Chat activation is unavailable.");
    const account = await this.repository.claim(scope, accountUuid, operationId);
    if (!account) return { skipped: true };
    const context: ChatRuntimeContext = {
      ...scope,
      actorEmail: account.actor_email,
      companyId: Number(account.company_id),
      authorize: () => this.dependencies.authorize(scope, account.actor_email)
    };
    let api: TelegramClientApi | undefined;
    let credentials: TelegramCredentials | undefined;
    try {
      await context.authorize("chat.manage");
      credentials = decryptTelegramSecret<TelegramCredentials>(
        account.credentials_encrypted,
        this.dependencies.secretKey,
        telegramCredentialScope(tenantId, account)
      );
      if (
        ["requesting_code", "verifying_code", "verifying_password"].includes(account.auth_state)
      ) {
        const valid = await context.database
          .selectFrom("chat_telegram_accounts")
          .select(sql<number>`auth_expires_at > UTC_TIMESTAMP()`.as("valid"))
          .where("id", "=", account.id)
          .executeTakeFirst();
        if (!valid?.valid) throw new Error("Telegram sign-in attempt expired.");
      }
      api = this.dependencies.clientFactory?.(credentials) ?? new TelegramAccountApi(credentials);
      await api.connect();
      if (account.auth_state === "requesting_code") {
        credentials.phoneCodeHash = await api.sendCode();
        await this.save(context, account, api, credentials, "awaiting_code");
      } else if (account.auth_state === "verifying_code") {
        if (await api.signIn(credentials.input ?? ""))
          await this.authorized(context, account, api, credentials);
        else await this.save(context, account, api, credentials, "awaiting_password");
      } else if (account.auth_state === "verifying_password") {
        await api.password(credentials.input ?? "");
        await this.authorized(context, account, api, credentials);
      } else if (account.auth_state === "disconnecting") {
        let error: string | null = null;
        try {
          await api.logout();
        } catch {
          error =
            "Disconnected locally. Revoke this session in Telegram Settings > Devices if needed.";
        }
        credentials.session = "";
        credentials.apiHash = "";
        credentials.phone = "";
        await this.save(context, account, undefined, credentials, "disconnected", error);
      } else if (account.auth_state === "refreshing") {
        await this.sync.refresh(context, account, api);
        await this.save(context, account, api, credentials, "connected");
      } else if (account.auth_state === "connected") {
        await this.sync.run(context, account, api);
        await this.save(context, account, api, credentials, "connected");
      }
      return { accountUuid, state: "processed" };
    } catch (error) {
      const failure = telegramFailure(error);
      const message =
        account.auth_state === "disconnecting"
          ? "Disconnected locally. Revoke this session in Telegram Settings > Devices if needed."
          : failure.message;
      const state =
        account.auth_state === "verifying_code"
          ? "awaiting_code"
          : account.auth_state === "verifying_password"
            ? "awaiting_password"
            : ["connected", "refreshing"].includes(account.auth_state) && failure.kind !== "session"
              ? "connected"
              : "disconnected";
      if (credentials) await this.save(context, account, api, credentials, state, message);
      else
        await context.database
          .updateTable("chat_telegram_accounts")
          .set({ last_error: message })
          .where("id", "=", account.id)
          .execute();
      if (failure.kind === "rate") return { accountUuid, state: "rate-limited" };
      throw new Error(message);
    } finally {
      if (api) {
        try {
          await api.close();
        } catch {
          /* Session is already persisted. */
        }
      }
      await this.repository.release(scope, account.id);
    }
  }
  private async authorized(
    context: ChatRuntimeContext,
    account: TelegramAccountRow,
    api: TelegramClientApi,
    credentials: TelegramCredentials
  ) {
    const identity = await api.identity();
    if (credentials.userId && credentials.userId !== identity.id) {
      await context.database
        .updateTable("chat_telegram_dialogs")
        .set({ channel_uuid: null, status: "inactive" })
        .where("account_uuid", "=", account.uuid)
        .execute();
    }
    credentials.userId = identity.id;
    await this.sync.refresh(context, account, api);
    await context.database
      .updateTable("chat_telegram_accounts")
      .set({ account_label: identity.label.slice(0, 191) })
      .where("id", "=", account.id)
      .execute();
    await this.save(context, account, api, credentials, "connected");
  }
  private async save(
    context: ChatRuntimeContext,
    account: TelegramAccountRow,
    api: TelegramClientApi | undefined,
    credentials: TelegramCredentials,
    state: string,
    error: string | null = null
  ) {
    delete credentials.input;
    if (api) credentials.session = api.saveSession();
    if (state === "disconnected") {
      credentials.session = "";
      credentials.apiHash = "";
      credentials.phone = "";
    }
    if (state === "connected" || state === "disconnected") delete credentials.phoneCodeHash;
    await context.database
      .updateTable("chat_telegram_accounts")
      .set({
        auth_state: state,
        last_error: error,
        ...(state === "connected" && !error ? { last_synced_at: sql`UTC_TIMESTAMP()` } : {}),
        credentials_encrypted: encryptTelegramSecret(
          credentials,
          this.dependencies.secretKey,
          telegramCredentialScope(context.tenantId, account)
        )
      })
      .where("id", "=", account.id)
      .execute();
  }
}
