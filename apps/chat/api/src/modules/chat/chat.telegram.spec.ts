import assert from "node:assert/strict";
import test from "node:test";
import {
  encryptTelegramSecret,
  decryptTelegramSecret,
  telegramCredentialScope
} from "./chat.telegram.crypto.js";
import { TelegramAccountApi, telegramFailure } from "./chat.telegram.api.js";
import { Api } from "teleproto";
import { PhoneMigrateError } from "teleproto/errors";
import type { RequestState } from "teleproto/network/RequestState";
import { ChatConnectionManager, ChatRealtimeBus } from "./chat.realtime.js";
import type { ChatRuntimeContext, ChatMessage } from "./chat.types.js";

test("Telegram API secrets are encrypted and bound to tenant, company, owner and account", () => {
  const account = { uuid: "aaaaaaaa", company_id: 1, actor_email: "owner@example.test" };
  const scope = telegramCredentialScope("11111111", account);
  const credentials = { apiHash: "private-hash", session: "private-session", input: "12345" };
  const encrypted = encryptTelegramSecret(credentials, "key", scope);
  assert.ok(!encrypted.includes("private"));
  assert.deepEqual(decryptTelegramSecret(encrypted, "key", scope), credentials);
  for (const wrongScope of [
    telegramCredentialScope("22222222", account),
    telegramCredentialScope("11111111", { ...account, company_id: 2 }),
    telegramCredentialScope("11111111", { ...account, actor_email: "other@example.test" })
  ]) {
    assert.throws(() => decryptTelegramSecret(encrypted, "key", wrongScope));
  }
  assert.throws(() => decryptTelegramSecret(encrypted, "different-key", scope));
});

for (const [code, kind] of [
  ["PHONE_CODE_INVALID", "code"],
  ["PASSWORD_HASH_INVALID", "password"],
  ["API_ID_INVALID", "credentials"],
  ["PHONE_NUMBER_INVALID", "phone"],
  ["PHONE_NUMBER_BANNED", "phone"],
  ["PHONE_MIGRATE_5", "connection"],
  ["RECAPTCHA_CHECK_REQUIRED", "unsupported"],
  ["SESSION_REVOKED", "session"],
  ["FLOOD_WAIT_60", "rate"]
]) {
  test(`Telegram ${code} is sanitized without exposing provider payloads`, () => {
    const result = telegramFailure({
      errorMessage: code,
      message: "private-api-hash session password code"
    });
    assert.equal(result.kind, kind);
    assert.ok(!result.message.includes("private-api-hash"));
  });
}
test("Telegram sign-in follows a data-center redirect through the real SDK retry policy", async (t) => {
  const api = new TelegramAccountApi({
    apiId: 1,
    apiHash: "0".repeat(32),
    phone: "+10000000000",
    session: ""
  });
  const client = api["client"];
  let requests = 0;
  let migrated = 0;
  Object.defineProperty(client, "_sender", {
    value: {
      userDisconnected: false,
      addStateToQueue(state: RequestState) {
        requests++;
        if (requests === 1)
          state.reject(new PhoneMigrateError({ capture: 5, request: state.request }));
        else
          state.resolve(
            new Api.auth.SentCode({
              type: new Api.auth.SentCodeTypeApp({ length: 5 }),
              phoneCodeHash: "test-code-hash"
            })
          );
      }
    },
    configurable: true
  });
  client["_connectedDeferred"].resolve();
  t.mock.method(client, "isUserAuthorized", async () => false);
  t.mock.method(client, "_switchDC", async (dc: number) => {
    migrated = dc;
  });
  assert.equal(await api.sendCode(), "test-code-hash");
  assert.equal(migrated, 5);
  assert.equal(requests, 2);
});
test("unknown Telegram exceptions never expose their raw messages", () => {
  assert.ok(
    !telegramFailure(new Error("api_hash=private-session")).message.includes("private-session")
  );
});
test("Telegram realtime delivery rejects tenant collisions and revoked subscribers", async () => {
  const manager = new ChatConnectionManager();
  const bus = new ChatRealtimeBus(manager, async () => {});
  const context: ChatRuntimeContext = {
    actorEmail: "admin@test.invalid",
    authorize: async () => {},
    companyId: 1,
    database: undefined as never,
    tenantDatabase: "tenant_one",
    tenantId: "11111111"
  };
  const received: string[][] = [[], [], [], []];
  for (let index = 0; index < 4; index++)
    manager.admit({
      connectionId: String(index),
      channels: new Set(["aaaaaaaa"]),
      context: {
        ...context,
        ...(index === 1 ? { tenantId: "22222222", tenantDatabase: "tenant_two" } : {}),
        ...(index === 2 ? { companyId: 2 } : {}),
        ...(index === 3
          ? {
              authorize: async () => {
                throw new Error("Revoked.");
              }
            }
          : {})
      },
      socket: {
        close: () => {},
        send: (frame) => {
          received[index]!.push(frame);
        }
      }
    });
  await bus.messageCreatedInScope(context, { channelUuid: "aaaaaaaa" } as ChatMessage);
  assert.deepEqual(
    received.map((frames) => frames.length),
    [1, 0, 0, 0]
  );
});
