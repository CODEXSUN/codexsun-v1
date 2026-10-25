# Conversation

Marketing owns contact conversation threads, messages, human takeover, and nurture state.

## Ownership

- API: `apps/marketing/api/src/modules/conversation`.
- Web: `apps/marketing/web/src/modules/conversation`.
- Platform supplies authenticated tenant, company, actor, activation, and permission context.
- The module keeps persistence and validation inside Marketing.

## Verification Boundary

Source integration and TypeScript checks do not prove provider authorization or production operation.
Customer activation, real delivery, and authenticated browser acceptance require separate verification.
Do not send real messages or change provider configuration during source-only integration.
