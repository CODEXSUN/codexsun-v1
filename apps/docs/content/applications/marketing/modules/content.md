# Content

Marketing owns content drafts, revisions, approval decisions, and manual publishing outcomes.

## Ownership

- API: `apps/marketing/api/src/modules/content`.
- Web: `apps/marketing/web/src/modules/content`.
- Platform supplies authenticated tenant, company, actor, activation, and permission context.
- The module keeps persistence and validation inside Marketing.

## Verification Boundary

Source integration and TypeScript checks do not prove provider authorization or production operation.
Customer activation, real delivery, and authenticated browser acceptance require separate verification.
Do not send real messages or change provider configuration during source-only integration.
