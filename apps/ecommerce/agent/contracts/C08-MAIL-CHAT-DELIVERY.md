# C08 - Authorized Mail/Chat notification and support delivery

Status: proposed, technical impact review can proceed; customer participation policy needs approval.
Blocks EC-T14 and any claim that an order/return/refund message was delivered.

## Existing behavior

- `@codexsun/mail-api` and `@codexsun/chat-api` are not dependencies of `@codexsun/ecommerce-api`.
- Mail exposes `MailService.compose` and queues `mail.send` through an injected `enqueue`.
- Chat exposes an injectable trusted DB contract `writeWorkMessage`; its repository enforces participant
  scope. Chat is a staff workplace, not a customer support channel.
- Ecommerce records no notification intent today; it must not claim a sent message.

## Exact gap

Ecommerce cannot send order, payment, shipment, return, or refund notices, and cannot open a support
thread tied to an Ecommerce record. A direct dependency on Mail/Chat internals would duplicate delivery
and participant enforcement.

## Proposed contract

Platform injects two narrow capabilities into Ecommerce public/staff composition:

```ts
type EcommerceNotificationPort = {
  send(input: {
    tenantId: string;
    templateKey: string;
    to: string;
    variables: Record<string, string>;
    idempotencyKey: string;
    source: { type: "ecommerce"; uuid: string };
  }): Promise<{ messageId: string; queued: boolean }>;
};

type EcommerceSupportPort = {
  openThread(input: {
    tenantId: string;
    subject: string;
    source: { type: "ecommerce"; uuid: string };
    participantPrincipalUuid?: string;
    initialMessage: string;
  }): Promise<{ channelId: string; messageId: string }>;
};
```

Mail owns templates. Ecommerce sends a template key and typed variables only; it never builds raw
HTML or holds SMTP credentials. Chat owns the participant model. Ecommerce may add a customer
participant only when a portal principal (C02) exists; a guest email is never a Chat participant.

Identity values in these ports follow the repository conventions: `tenantId` is the tenant public
UUID string already used by sessions and the C06 envelope; `source.uuid` is the eight-lowercase-hex
Ecommerce record UUID (`CHAR(8)`); and `participantPrincipalUuid` is the C02
`app_portal_principals.uuid` (`CHAR(8)`), not a `CHAR(36)` UUID. Use the `source.type` plus `source.uuid`
pair as the cross-boundary reference; do not invent a commerce-wide UUID type.

Notification intent is written in the same transaction as the business change, then dispatched through
the C06 outbox. `idempotencyKey = <eventType>:<aggregateUuid>:<recipient>` prevents duplicate sends on
retry. Delivery status is stored as `queued`, `sent`, or `failed` from Mail's result, never fabricated.

## Customer participant boundaries

- Staff Chat remains unchanged; no customer sees staff channels.
- A customer support thread is scoped to one tenant, one principal, and one Ecommerce source record.
- Customer messages are authorized by the C02 portal session; vendor messages by vendor membership.
- Internal notes are never exposed to a customer participant.
- Attachments use the existing storage contract, not a public URL; private evidence stays private.

## Consumers and tests

Consumers: order confirmation, payment receipt, shipment, cancellation, return/refund, vendor offer
notice, support thread. Tests: duplicate event yields one Mail message; Mail failure leaves the outbox
row retryable; customer A cannot read customer B's thread; staff-only notes are absent from the customer
view; no Ecommerce module imports Mail/Chat internals; existing Mail/Chat suites remain green.

## Repository identity conformance

- `source.uuid` and `participantPrincipalUuid` are `CHAR(8)` lowercase-hex public identifiers, matching
  Ecommerce records and C02 portal principals. They are not `CHAR(36)` values.
- `tenantId` is the existing tenant public UUID string from the validated session/envelope; Mail and
  Chat resolve and revalidate the tenant database, never the payload.
- This packet adds no table, so it introduces no `BIGINT`, `CHAR(36)`, or MySQL `ENUM`.

## Owner decision still required

1. Are customers allowed into Chat at all, or is support email-only?
2. Which templates are transactional (always sent) versus marketing (consent required)?
3. Who owns the customer-facing sender identity and reply-to address?

Recommended default: transactional email only for launch; Chat support for staff with a read-only
customer reply window added only after C02; marketing requires explicit consent.
