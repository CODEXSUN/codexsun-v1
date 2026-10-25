# Email Campaign

Marketing owns email audiences, previews, approval, scheduling, and campaign state. Mail supplies delivery and suppression contracts.

## Ownership

- API: `apps/marketing/api/src/modules/email-campaign`.
- Web: `apps/marketing/web/src/modules/email-campaign`.
- Platform supplies authenticated tenant, company, actor, activation, and permission context.
- The module keeps persistence and validation inside Marketing.

## Verification Boundary

Source integration and TypeScript checks do not prove provider authorization or production operation.
Customer activation, real delivery, and authenticated browser acceptance require separate verification.
Do not send real messages or change provider configuration during source-only integration.
