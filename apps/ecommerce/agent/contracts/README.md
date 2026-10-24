# Ecommerce provider contract packets (EC-R07)

These packets convert the broad owner blockers in `CONTRACTS.md` into independently reviewable
proposals. They describe existing behavior, the exact gap, the smallest compatible change, schemas,
permissions, retries, consumers, regression tests, and the decision still owned by the provider.

They are design records, not acceptance claims. No packet is implemented until the provider owner
accepts it, the change lands, and Ecommerce reruns the listed regressions. They do not duplicate
Platform identity, Billing ledgers, Mail/Chat delivery, or queue infrastructure.

| Packet                       | Contract                                            | Provider          | Unblocks               |
| ---------------------------- | --------------------------------------------------- | ----------------- | ---------------------- |
| `C02-PORTAL-PRINCIPALS.md`   | Restricted customer/vendor principal + membership   | Platform identity | EC-T07, EC-T09, EC-T13 |
| `C03-BILLING-HANDOFF.md`     | Source UUID/idempotency + invoice/receipt handoff   | Billing           | EC-T08, EC-T10, EC-T12 |
| `C06-QUEUE-OUTBOX.md`        | Queue injection + transactional outbox/inbox        | Platform queue    | EC-T14                 |
| `C08-MAIL-CHAT-DELIVERY.md`  | Authorized notification/support delivery            | Mail/Chat         | EC-T14                 |
| `C10-MARKETPLACE-FINANCE.md` | Merchant of record, tax, invoice issuer, settlement | Business owner    | EC-T13                 |

## Review order and parallel work

1. C02 and C03 are business/security decisions; their proposals may be reviewed immediately.
2. C06 and C08 are technical Platform changes. They may proceed to impact review under the existing
   authorization once the Platform owner confirms the injection shape.
3. C10 needs a human business decision before any settlement code is written.

Catalog, media, staff UI, read-only projections, and stock-allocation design are not blocked by these
packets. Dependent transaction work stays blocked until its packet is accepted.

## Common acceptance rules

- No Ecommerce route, prompt, or document may claim a capability before the provider change is merged
  and the Ecommerce regression passes.
- A retry must be safe end-to-end; an in-memory check is not idempotency.
- Tenant identity and module activation are revalidated at execution, never trusted from a payload.
- Regression evidence records the provider revision, the Ecommerce revision, exact commands, and exit
  codes.
