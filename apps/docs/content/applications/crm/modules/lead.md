# Crm: Leads

CRM owns canonical Leads received through Marketing intake or created manually. Source identity is company-scoped and duplicate-safe. Marketing intake creates one assigned follow-up Task transactionally.

The web list, full-page details, and upsert form use the Enquiry workspace pattern. Fields are Contact, Mobile, Enquiry details, Campaign, and Status. Conversion is an explicit action. Manual campaign labels do not create Marketing campaigns.

Review, Qualified, and Lost are editable statuses. Converted is set only by the conversion service. Conversion locks the lead, resolves its Core customer through the public contract, creates one Enquiry with the original assignee, and stores the link and activity in the same transaction. Repeated and concurrent requests return the same Enquiry. Failure rolls back the contact, Enquiry, outbox, and lead change.

## Ownership and access

Platform resolves trusted tenant context and live grants. Each client uses its own database.
Public UUIDs do not grant access. Company and record scope still apply.
No documentation or frontend control grants permission.

## Source contracts

- `apps/crm/api/src/modules/lead/index.ts`
- `apps/crm/web/src/modules/lead/index.ts`
- Owned primary table: `crm_leads`.
- Owned audit table: `crm_lead_activity`.
- Migration: `crm.lead.workspace.v2`. Existing source receipts are preserved.
- Permissions: `crm.lead.view`, `create`, `update`, `convert`, and administrator-only `view-all`. Marketing intake retains `crm.lead.intake`.

## Routes

- `GET /crm/leads` retains the intake list contract.
- `GET /crm/leads/page` provides bounded search, status filtering, and pagination.
- The page query also accepts UTC `fromAt`/exclusive `toAt` creation boundaries and `searchName`, `searchPhone`, `searchMessage`, `searchCampaign`, and `searchStatus`. Filters combine within the same tenant/company/assignee scope. `active` includes Review and Qualified only.
- `POST /crm/leads`, `GET /crm/leads/:uuid`, and `PUT /crm/leads/:uuid` provide create, read, and update operations.
- `POST /crm/leads/:uuid/convert` requires Lead conversion and Enquiry creation grants.
- `GET /crm/leads/:uuid/activity` applies the same record scope.
- `GET /crm/leads/contacts` uses Core's active contact lookup and the CRM contact read grant.
- `GET /crm/leads/options` returns live action capabilities.

The server selects the authenticated tenant database and validates the active company. Ordinary users see their assigned leads. Tenant-wide reads require both a live grant and an administrator role. Optimistic revisions reject stale edits. The browser scopes caches and requests by tenant and company.

## Verification and limits

Run `tools/e2e/crm-leads.e2e.ts` against disposable local databases. It covers validation, persistence, owner/company/tenant isolation, live grants, duplicate and concurrent conversion, transaction rollback, and Marketing intake compatibility.

Production migration, permission seeding, provider access, and deployment remain separate release steps. No direct Frappe sync or Marketing campaign mutation is added.

## Campaign lookup and optional capture

Contact name and enquiry details may be empty in manual Lead input. Mobile remains required.
`GET /crm/leads/campaigns?search=` returns up to 30 saved campaign labels within the current company and authorized record scope, plus default campaign choices.
The form uses an inline create lookup. New labels persist when the lead is saved.
The app header provides New lead and Save lead actions. Ctrl+S submits the active Lead form through its normal validation.
