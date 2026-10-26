import { ImapFlow } from "imapflow";
import { simpleParser, type ParsedMail } from "mailparser";
import Pop3Command from "node-pop3";
import nodemailer from "nodemailer";
import { migrateMailModule } from "./mail.migration.js";
import { MailRepository } from "./mail.repository.js";
import { openSystemMailPayload } from "./mail.system-payload.js";
import type { MailRuntimeContext, MailWorkerDependencies } from "./mail.types.js";

export const mailWorker = {
  jobs: ["mail.send", "mail.sync", "mail.system-send"],
  queue: "mail",
  retry: { attempts: 3, backoffMs: 5000 }
} as const;

export async function processMailJob(
  jobName: string,
  payload: Record<string, unknown>,
  dependencies: MailWorkerDependencies
) {
  if (jobName === "mail.system-send") {
    return sendSystemMail(
      openSystemMailPayload(payload, dependencies.secretKey),
      dependencies.fallback
    );
  }
  const database = dependencies.database;
  if (!database) throw new Error("Mail tenant database is required.");
  await migrateMailModule(database);
  const context = workerContext(payload, { ...dependencies, database });
  if (jobName === "mail.send") return sendMail(context, payload, dependencies);
  if (jobName === "mail.sync") return syncMail(context, dependencies);
  throw new Error(`Unsupported Mail job: ${jobName}`);
}

async function sendSystemMail(
  payload: Record<string, unknown>,
  fallback: MailWorkerDependencies["fallback"]
) {
  const to = Array.isArray(payload.to)
    ? payload.to
        .map(String)
        .map((value) => value.trim().toLowerCase())
        .filter(Boolean)
    : [];
  const subject = String(payload.subject ?? "").trim();
  if (!fallback.enabled || !fallback.host || !fallback.fromEmail)
    throw new Error("System SMTP is not configured.");
  if (!to.length || !subject) throw new Error("System mail recipient and subject are required.");
  const transport = nodemailer.createTransport({
    auth: fallback.username ? { pass: fallback.password, user: fallback.username } : undefined,
    host: fallback.host,
    port: fallback.port,
    secure: fallback.secure
  });
  const sent = await transport.sendMail({
    disableFileAccess: true,
    disableUrlAccess: true,
    from: fallback.fromName
      ? { address: fallback.fromEmail, name: fallback.fromName }
      : fallback.fromEmail,
    html: String(payload.bodyHtml ?? "") || undefined,
    replyTo: fallback.replyTo || undefined,
    subject,
    text: String(payload.bodyText ?? "") || undefined,
    to
  });
  return { provider: "environment", providerMessageId: sent.messageId ?? null };
}

async function sendMail(
  context: MailRuntimeContext,
  payload: Record<string, unknown>,
  dependencies: MailWorkerDependencies
) {
  const messageUuid = String(payload.messageUuid ?? "").trim();
  if (!messageUuid) throw new Error("Mail delivery job is missing messageUuid.");
  const repository = new MailRepository(dependencies.secretKey);
  const message = await repository.requireMessage(context, messageUuid);
  if (message.status === "sent") return { alreadySent: true, messageUuid };
  const tenant = await repository.deliverySettings(context);
  const fallback = dependencies.fallback;
  const tenantReady = tenant.enabled && Boolean(tenant.fromEmail && tenant.smtpHost);
  const fallbackReady =
    tenant.fallbackEnabled && fallback.enabled && Boolean(fallback.host && fallback.fromEmail);
  if (!tenantReady && !fallbackReady)
    throw new Error("Tenant SMTP is not configured and environment fallback is unavailable.");
  await repository.markStatus(context, message.id, "sending");
  try {
    const sent = tenantReady
      ? await deliver(
          message,
          {
            fromEmail: tenant.fromEmail,
            fromName: tenant.fromName,
            host: tenant.smtpHost,
            password: tenant.smtpPassword,
            port: tenant.smtpPort,
            replyTo: tenant.replyTo,
            secure: tenant.smtpSecure,
            username: tenant.smtpUsername
          },
          context
        )
      : await deliver(message, fallback, context);
    await repository.markStatus(context, message.id, "sent", {
      providerMessageId: String(sent.messageId ?? "")
    });
    return {
      messageUuid,
      provider: tenantReady ? "tenant-smtp" : "environment",
      providerMessageId: sent.messageId ?? null
    };
  } catch (tenantError) {
    if (tenantReady && fallbackReady) {
      try {
        const sent = await deliver(message, fallback, context);
        await repository.markStatus(context, message.id, "sent", {
          providerMessageId: String(sent.messageId ?? "")
        });
        return {
          fallbackAfter: errorMessage(tenantError),
          messageUuid,
          provider: "environment",
          providerMessageId: sent.messageId ?? null
        };
      } catch (fallbackError) {
        const messageText = `Tenant SMTP failed: ${errorMessage(tenantError)}; fallback failed: ${errorMessage(fallbackError)}`;
        await repository.markStatus(context, message.id, "failed", { error: messageText });
        throw new Error(messageText, { cause: fallbackError });
      }
    }
    await repository.markStatus(context, message.id, "failed", {
      error: errorMessage(tenantError)
    });
    throw tenantError;
  }
}

async function deliver(
  message: Awaited<ReturnType<MailRepository["requireMessage"]>>,
  settings: {
    fromEmail: string;
    fromName: string;
    host: string;
    password: string;
    port: number;
    replyTo: string;
    secure: boolean;
    username: string;
  },
  context: MailRuntimeContext
) {
  const rows = await context.database
    .selectFrom("mail_attachments")
    .selectAll()
    .where("mail_message_id", "=", message.id)
    .orderBy("id", "asc")
    .execute();
  const transport = nodemailer.createTransport({
    auth: settings.username ? { pass: settings.password, user: settings.username } : undefined,
    host: settings.host,
    port: settings.port,
    secure: settings.secure
  });
  return transport.sendMail({
    attachments: rows.map((row) => ({
      content: Buffer.from(String(row.content_base64 ?? ""), "base64"),
      contentType: String(row.mime_type ?? "application/octet-stream"),
      filename: String(row.file_name ?? "attachment.bin")
    })),
    bcc: message.bcc,
    cc: message.cc,
    disableFileAccess: true,
    disableUrlAccess: true,
    from: settings.fromName
      ? { address: settings.fromEmail, name: settings.fromName }
      : settings.fromEmail,
    html: message.bodyHtml || undefined,
    replyTo: message.replyTo || settings.replyTo || undefined,
    subject: message.subject,
    text: message.bodyText || undefined,
    to: message.to
  });
}

async function syncMail(context: MailRuntimeContext, dependencies: MailWorkerDependencies) {
  const repository = new MailRepository(dependencies.secretKey);
  const settings = await repository.deliverySettings(context);
  if (!settings.inboundEnabled) throw new Error("Inbound mail sync is not enabled.");
  if (settings.inboundProtocol === "pop3") return syncPop3(context, repository, settings);
  const client = new ImapFlow({
    auth: { pass: settings.inboundPassword, user: settings.inboundUsername },
    host: settings.inboundHost,
    logger: false,
    port: settings.inboundPort,
    secure: settings.inboundSecure
  });
  let imported = 0;
  await client.connect();
  try {
    const lock = await client.getMailboxLock("INBOX");
    try {
      const exists = Number(
        client.mailbox && typeof client.mailbox === "object" ? client.mailbox.exists : 0
      );
      if (!exists) return { imported: 0 };
      const start = Math.max(1, exists - 49);
      for await (const item of client.fetch(`${start}:*`, { envelope: true, source: true })) {
        if (!item.source) continue;
        const parsed = await simpleParser(item.source);
        if (
          await importParsedMessage(
            context,
            repository,
            parsed,
            item.envelope?.messageId || `imap-${item.uid}`
          )
        )
          imported += 1;
      }
    } finally {
      lock.release();
    }
  } finally {
    await client.logout().catch(() => undefined);
  }
  return { imported };
}

async function syncPop3(
  context: MailRuntimeContext,
  repository: MailRepository,
  settings: Awaited<ReturnType<MailRepository["deliverySettings"]>>
) {
  const client = new Pop3Command({
    parseStreamToString: true,
    host: settings.inboundHost,
    password: settings.inboundPassword,
    port: settings.inboundPort,
    servername: settings.inboundHost,
    timeout: 30000,
    tls: settings.inboundSecure,
    user: settings.inboundUsername
  });
  let imported = 0;
  try {
    const listing = await client.UIDL();
    const entries = Array.isArray(listing[0]) ? (listing as string[][]) : [listing as string[]];
    for (const [messageNumberValue, uid] of entries.slice(-50)) {
      const messageNumber = Number(messageNumberValue);
      if (!Number.isInteger(messageNumber) || messageNumber <= 0 || !uid) continue;
      const source = await client.RETR(messageNumber);
      if (typeof source !== "string")
        throw new Error("POP3 did not return the requested message text.");
      const parsed = await simpleParser(source);
      if (await importParsedMessage(context, repository, parsed, `pop3-${uid}`)) imported += 1;
    }
  } finally {
    await client.QUIT().catch(() => undefined);
  }
  return { imported };
}

async function importParsedMessage(
  context: MailRuntimeContext,
  repository: MailRepository,
  parsed: ParsedMail,
  fallbackProviderMessageId: string
) {
  const from = parsed.from?.value[0];
  const to =
    parsed.to && !Array.isArray(parsed.to)
      ? parsed.to.value
      : Array.isArray(parsed.to)
        ? parsed.to.flatMap((address) => address.value)
        : [];
  return repository.importInbound(context, {
    bodyHtml: typeof parsed.html === "string" ? parsed.html : "",
    bodyText: parsed.text ?? "",
    fromEmail: from?.address ?? "unknown@invalid.local",
    fromName: from?.name ?? "",
    providerMessageId: parsed.messageId || fallbackProviderMessageId,
    receivedAt: parsed.date ?? new Date(),
    replyTo: parsed.replyTo?.value[0]?.address ?? "",
    subject: parsed.subject ?? "(No subject)",
    to: to.map((address) => address.address ?? "").filter(Boolean)
  });
}

function workerContext(
  payload: Record<string, unknown>,
  dependencies: MailWorkerDependencies & {
    database: NonNullable<MailWorkerDependencies["database"]>;
  }
): MailRuntimeContext {
  const companyId = Number(payload.companyId);
  const tenantDatabase = String(payload.tenantDatabase ?? "").trim();
  if (!Number.isInteger(companyId) || companyId <= 0 || !tenantDatabase)
    throw new Error("Mail job tenant database and company identity are required.");
  return {
    actorEmail: String(payload.actorEmail ?? "mail.worker@codexsun.local"),
    authorize: async () => undefined,
    companyId,
    database: dependencies.database,
    tenantDatabase,
    tenantId: String(payload.tenantId ?? "")
  };
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Mail provider request failed.";
}
