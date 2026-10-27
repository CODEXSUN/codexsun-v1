# Chat

## Component documentation

Tenant channels, direct and group messaging, attachments, realtime delivery, and the optional Telegram integration.

Check channel membership and live permissions before record access or delivery. Keep Telegram credentials server-side and preserve tenant-scoped audit and message ownership.

- [TASK.md](agent/TASK.md): work items and acceptance evidence.
- [PLAN.md](agent/PLAN.md): scope, ownership, delivery order, and verification gates.
- [SKILLS.md](agent/SKILLS.md): component working rules and safety constraints.

### Source inventory

- `api/src/modules`: `chat`.
- `web/src/modules`: `chat`.

This inventory records source presence. It does not certify a deployed feature.

### Workspace verification

Run these commands from the repository root. Use the root installation and `dist` output tree.

- `node tools/check-module-boundaries.mjs chat`
- `npm run typecheck -w @codexsun/chat-api`
- `npm run lint -w @codexsun/chat-api`
- `npm run build -w @codexsun/chat-api`
- `npm run typecheck -w @codexsun/chat-web`
- `npm run lint -w @codexsun/chat-web`
- `npm run build -w @codexsun/chat-web`

Run `npm run check:component-docs` to verify the required documentation files.
Run the relevant app tests and root release gates when implementation changes.
Report database, browser, native, and deployment checks separately.

### Workspace packages

- `api`: `@codexsun/chat-api`.
- `web`: `@codexsun/chat-web`.

### Declared internal dependencies

- `@codexsun/framework`
- `@codexsun/ui`

### Public package entry points

- `@codexsun/chat-api`: `.`, `./modules/chat`.
- `@codexsun/chat-web`: `.`, `./modules/chat`.

## CRM work conversations

The trusted `writeWorkMessage` public contract writes work messages using the caller's transaction.
CRM supplies the authorized record participants. The writer creates a participant-specific group and its memberships,
then stores the message with the work event UUID. All timestamps are stored in UTC.
It does not contact external messaging providers. CRM resolves related people and its admin fallback.
The standard Chat permission seed grants Admin, Super Admin, Manager, and User access.
Channel and message reads require active membership; channel administration and editing another user's message require channel administration.
Web channel/message queries poll for messages written by the CRM transaction contract.

## 2026-10-17: Read cursor correctness

Migration `chat.008_read_cursor` adds nullable `chat_channel_reads.last_message_id` and backfills existing rows from their saved read timestamp. It changes only Chat read tracking; no message rows are removed. The migration is repeatable and was applied twice on the local test tenant.
Unread counts compare message IDs, which avoids timezone and same-second timestamp ambiguity. HTTP read requests accept an optional messageId and advance the cursor monotonically. Membership and company checks remain required. Existing clients without a cursor retain mark-current-channel-read behavior. New messages use UTC, and newest-message queries use ID order.
Validation: the isolated work-report E2E covers assignment unread, new messages after read, old cursor retries, and read clearing. Apply the tracked migration to each target tenant before deploying this code. Production migration was not run.

## Realtime ownership and delivery

Chatb remains a transport proxy. Chat owns channel membership, message persistence, and realtime events.
Platform supplies the authenticated tenant context and live permission authority.

Realtime event publishers pass the verified tenant, database, and company context.
The Chat bus matches this scope before checking each subscriber's current permission and channel membership.
Removed memberships and denied permissions stop message, typing, and presence delivery.
Typing also requires current channel membership for its sender.

`ChatRealtimeEvents` callbacks are asynchronous and take `ChatRuntimeContext` first.
Publishers must await these callbacks. This contract adds no database migration or new broker.
Connections remain process-local. Multiple Platform instances need a separately reviewed fan-out contract.
The existing browser reconnect and HTTP polling recover persisted messages. Presence and typing remain transient.
Timestamp-based `chat.sync` is unchanged and is not an exactly-once cursor protocol.

The host must include live session validation in its context authority to revoke an already open socket on logout.
Handshake authentication alone does not supply that guarantee.

## Telegram execution host

`telegramExecution: false` keeps the API routes and queue producers without starting the account scheduler or registering its processor.
The execution host starts the exported `ChatTelegramWorker` with the same tenant scope and authorization dependencies.
Its asynchronous stop callback stops dispatch and waits for the current scheduler pass.
The queue host must also drain its active processors before closing database connections.

`subscribeExternalMessages` lets the composition host deliver persisted-message notifications to Chat's local realtime bus.
The host validates the trusted transport event, resolves tenant authority, and reloads the persisted message.
It returns asynchronous subscription cleanup for application shutdown.
Chat rechecks local recipients' live permissions and membership before delivery.
The host owns Redis configuration and namespace isolation. Chat adds no Redis dependency.
