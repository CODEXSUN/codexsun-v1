# Legacy CXApp preparation

This owner prepares renamed legacy tables and split records for Data Bridge.
It does not execute business imports, update a client target, or authorize migration decisions.

Run the local preparation harness in Core → Masters → Billing order.
The original source and its raw Docker restore stay read only.
Create dedicated staging and target databases with repository owner migrations.
Never use another client's target or disable foreign-key checks to admit invalid business rows.

Staging contains normalized records plus `bridge_legacy_mappings` and `bridge_legacy_prepared_rows`.
The review table retains every raw source record, proposed destination values, dependency issues, staging ID, and existing target ID.
Its `execution_authorized` flag stays false. Blocked records never enter normalized business tables.
Stage IDs and destination IDs are separate identities. Match parents through business fields.

Do not infer legal-company identity from accounting-period suffixes or infer posting from active/lock flags.
Missing district, address, currency, company/year, tax, and lifecycle decisions stay blocked.
Preserve unsupported source values in private provenance. Do not expose passwords or authentication tables.
Use exact decimal arithmetic and hold an entire invoice when any header/child reconciliation fails.

Save private full row lists and mapping reports under root `dist/verification`.
Verify unchanged source and destination fingerprints after every phase.
Preparation lists are not completed import reports. Business import requires separate reviewed confirmation and the normal queue.
