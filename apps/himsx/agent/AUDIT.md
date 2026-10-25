# HIMSX audit and refinement register

Prepared on 25 October 2026. This baseline is source and requirements analysis, not an independent runtime audit.
No supervisor worker has started, and no clinical, financial, browser, database, or deployment acceptance is claimed.

## Initial risk register

| ID | Priority | Source finding or risk | Required refinement | Gate and state |
| --- | --- | --- | --- | --- |
| A01 | High | HIMSX currently exports overview only. README hospital roadmap exceeds the client's Front Office scope | Freeze 22-step coverage and explicit exclusions. Do not report overview as business completion | E01, Open |
| A02 | Critical | Shared contact paths may expose patient identity outside hospital permissions | Verify Core/CRM/Billing lookup/search/export exposure and add narrowly owned restrictions before patient acceptance | E04, Open, D07 |
| A03 | Critical | Billing root exports do not establish atomic hospital registration/post/refund APIs | Freeze transaction-aware owner contract, idempotency and rollback/reconciliation tests | E07/E11, Open, D09 |
| A04 | High | Source receipt modes do not include a distinct card mode. Client requests configurable payment methods | Review Billing method mapping and extend its owner where necessary. Do not label a fake card flow complete | E07, Open, D08 |
| A05 | High | Shared phone and name matching can conflate family members | Review existing customer resolver. Use patient duplicate review and explicit contact selection, not automatic merge | E06, Open |
| A06 | High | Current master values alone cannot support historical IP status or primary doctor/type corrections | Store effective event history and visit/financial snapshots. Test as-of boundaries and later corrections | E08/E09, Open |
| A07 | High | Master activity repository uses Platform master DB | Keep patient-sensitive audit tenant-local and atomic. Platform access reporting needs explicit tenant filters | E04/E08/E12, Open |
| A08 | High | Doctor schedules without real booking behavior cannot prove conflict prevention | Include appointment workflow, reserved-slot checks, leave/backup rules, concurrent writes and unique constraints | E10, Open |
| A09 | High | Existing CRM enquiry can be duplicated by a new hospital enquiry form | Reuse CRM entry/status/assignment/follow-up with hospital extension and unique admission conversion | E11, Open |
| A10 | High | Role CRUD inspected without copy action. Copy can escalate grants | Implement in Platform with grant ceiling, target uniqueness, protected-role checks and atomic audit | E12, Open |
| A11 | High | HRMS/shared owner reuse can tempt automatic app activation or permission grants | Freeze public contract/dependency policy. Missing access remains denied and visible | E02/E04, Open |
| A12 | High | ABHA has no approved method/provider configuration in the inspected HIMSX source | Keep consent/callback safety and local adapter tests separate from approved provider acceptance | E11, Open, D12 |
| A13 | Medium | MHC meaning, company/payer distinction, numbering, and policy fields are unresolved | Resolve D01-D14 before dependent acceptance. Continue independent tasks | E01/E06, Open |
| A14 | Medium | Broad dirty checkout includes shared UI, Platform, CRM, Marketing and deployment work | Capture baseline and exact leases. Preserve existing edits and serialize shared operations | E02/E13, Open |
| A15 | Medium | Generic activate/delete actions can corrupt posted hospital transactions | Use domain transitions for registration/admission/billing links. Protect dependencies and audit | E07/E08, Open |
| A16 | Medium | UI similarity cannot be established by shared component imports alone | Compare actual rendered CRM/HIMSX list, Show and upsert, themes, filter row, navigation and keyboard behavior | E05, Open |

Priority describes delivery risk, not a claim of an exploited vulnerability in the existing overview.

## Audit cycles

| Cycle | Tasks and baseline | Reviewer ID | Checks and evidence | Findings | Decision |
| --- | --- | --- | --- | --- | --- |
| Planning baseline | Overview and inspected shared contracts | Planning agent, self-review | REQUIREMENTS-ANALYSIS source anchors | A01-A16 | Implementation audit pending |

## Repair register

| Repair ID | Parent task / requirement / gate | Severity and reproduction | Owner and exact lease | Worker | Fix evidence | Independent recheck | State |
| --- | --- | --- | --- | --- | --- | --- | --- |
| None assigned | None | Initial risks require contract work first | None | None | None | None | Open baseline |

Use stable `H-REPAIR-###` IDs. Never erase a valid finding after assigning it.
Mark fixed only with fresh recheck evidence. Reopen on regression.
Record rejected findings with a concrete rationale and supporting source/runtime evidence.
Blocked provider/policy requirements retain their original requirement and gate IDs.

## Final audit questions

- Does every source subrequirement have an implemented field/action and a real acceptance test?
- Are shared identities reused without hospital columns or duplicate masters?
- Can a generic owner path bypass patient confidentiality or department scope?
- Can retries, simultaneous requests, or partial failures duplicate identifiers, bills, refunds, admissions, or bookings?
- Do corrections preserve historical financial facts and as-of IP reports?
- Do all required list features, Show pages, organized forms, active themes, and error states work in the browser?
- Are all five documents and detail/matrix reports correct, authorized, and reconciled?
- Do shared access reports and role copy retain tenant boundaries and grant limits?
- Are ABHA/provider limitations clearly separated from verified local behavior?
- Have independent reviewers rechecked repairs and left no mandatory unresolved gate?

Final handover must include passed, failed, skipped, externally blocked, and deployment states separately.
