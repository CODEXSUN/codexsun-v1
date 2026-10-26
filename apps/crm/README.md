# CRM

## Local five-tenant acceptance suite

Run `npm run test:crm:full` from the CRM worktree after you start the local API and provision the five `CRMISO1` to `CRMISO5` fixtures.
To create the fixtures on an empty local test database, run `npm run test:crm:seed-five-tenants` once while the local API is running.
The seed command checks existing fixture tenants and resumes only missing fixtures. It does not clear or replace tenant data.
Each fixture has 3,000 enquiries and its own tenant database. The runner rejects a nonlocal database host, an unexpected master database, or enabled Frappe and queue workers.
It runs CRM, authentication, and tenant unit tests, local CRM E2E tests, the five-tenant HTTP isolation matrix, and Flutter tests.
The isolation matrix checks all 20 ordered tenant pairs, restricted record access, shared contact identifiers, forged routing headers, writes, and session revocation.
Run `npm run test:e2e:crm-five-tenants` to repeat only the matrix.
The suite excludes `crm-duties-live.e2e.ts` because it needs the external Frappe service.
It also excludes two Platform-wide E2E fixtures that require the legacy CODEXSUN development login or unrelated Core and Billing seeds.
The five-tenant matrix uses real tenant logins and checks session isolation. The suite does not certify a cloud deployment.
Logs and results stay under `.codex-runtime/crm/tenancy/full-suite/`.

## Local CRM and queued Frappe delivery

CRM web and mobile use the local CRM API and tenant database.
CRM does not show Frappe sync columns, detail panels, source-history tabs, or verification actions.
It does not poll integration capabilities or sync status.
The separate Frappe app remains the owner of connection settings and integration operations.
Existing imported records and source links remain stored.

Enquiry saves and comments commit durable change events before queue submission.
Queue submission checks local activation and connection settings without a remote readiness request.
Delivery runs through the background worker. The worker retains availability, permission, retry, and tenant checks.
Disabled integration settings leave events pending for the existing relay.
This cleanup does not remove the outbox, change existing schemas, or send provider messages during local tests.

Enquiry lists, enquiry details, contacts, duties, and duty reports refresh every 15 seconds while active.
Local mutations still invalidate their queries immediately. Enquiry pagination keeps the previous page visible during a request.
Enquiry tabs load when first opened and retain drafts after tab changes. Hidden enquiry panels stop polling.
Mobile uses the same records and retains its existing refresh and resume behavior.
Mobile enquiry search requests matching records across all pages after a 300 ms typing delay.
The web enquiry list starts with 20 rows. Users can select 50 or 100 rows.
Created follows Priority in the web list. It uses the saved creation timestamp and refreshes elapsed hours and minutes locally each minute.
Unsearched list totals reuse the scoped status counts. Search requests retain an independent filtered count.
Contact lookups run once per distinct contact on each page and do not persist between requests.
Concurrent pages share contact reads only while those reads are in progress, with at most four reads per tenant database.
Completed reads leave the coordinator immediately, so later requests read current Core contact names.

Enquiry responses include nullable `runningJobId` and `runningJobStartedAt` timer summaries.
The API loads summaries in one query for the returned page, after pagination and record scope checks.
Mobile cards use these summaries without a job-session request per card.
Dashboard refreshes replace cached timer state, so web job stops clear mobile timers without reopening the screen.
Older API responses retain a fallback refresh for previously opened job sessions.
Enquiry, closure, and task actions resolve work-report context before starting their write transactions.
This prevents concurrent writes from exhausting the pool while waiting for an additional context connection.

## Marketing integration planning — 2026-10-23

Marketing owns Campaign, raw capture submissions, promotional consent, subscriptions, and nurturing.
CRM owns sales Leads, qualification, enquiries, assignments, follow-up, and sales/service contact restrictions.
Core owns contacts. Mail owns email delivery-safety suppression.
Existing Contact Preferences do not establish promotional opt-in.
CRM Leads support a paginated list, details, manual create/edit, review/qualified/lost status, and explicit conversion to an Enquiry.
The list shows Contact, Mobile, Enquiry details, Campaign, Convert to enquiry, and Status. It uses the Enquiry workspace primitives, responsive cards, filters, column visibility, and pagination.
The toolbar includes creation-date range filtering, a column-search toggle, and a selected-status badge with the matching count. Active excludes Converted and Lost. Date ranges include the full selected final day in the browser's local timezone; requests use UTC boundaries. Column searches combine with the global search, dates, status, and record scope.
Campaign labels preserve intake attribution. Manual leads may record a campaign label; this does not create or edit a Marketing Campaign.
Conversion requires `crm.lead.convert` and `crm.enquiry.create`. It locks the lead, resolves Core contact identity through the existing Enquiry customer contract, creates the Enquiry, and records conversion and audit history in one transaction. Explicit existing-contact selection also requires `crm.contact.view`. A retry returns the same Enquiry. Converted leads cannot be edited.
Lead reads and writes remain company- and assignee-scoped. `crm.lead.view-all` requires an administrator role. Web caches and request headers include tenant and company context.
Migration `crm.lead.workspace.v2` adds contact/enquiry links, revision checks, an index, and `crm_lead_activity`. Existing Marketing source receipts and follow-up Task links remain intact. Core migration and normal reference seeds are prerequisites. No direct Frappe call is made; Enquiry creation retains its durable local outbox.
Run `npm run test:e2e:crm-leads` for disposable local database coverage. The full CRM suite includes this file automatically.
See [CRM ownership](agent/PLAN.md#marketing-integration-decision--2026-10-23) and [Marketing Phase 0](../marketing/agent/PLAN.md#phase-0-decisions-and-contract-review).
This decision does not enable Marketing, migrate records, or expand Frappe export scope.

## Inbound enquiry source fields

Frappe imports retain complete source Enquiry documents and comment revisions in the local integration store.
CRM retains these source fields and paged history without rendering them in its workspace.
This includes company, address, Mobile Contact Customer, status details, and additional returned fields.
These source fields are read-only when CRM has no matching editor. Normal CRM field mappings remain editable through CRM workflows.
Inbound updates preserve CRM-only email. Local-edit conflicts require review before overwriting mapped values.
Q/ENQ identities remain exact. A source serial collision uses a free local enquiry number.
The Frappe owner controls live-sync direction, source retention, and successful checkpoints.
See [Frappe](../frappe/README.md) for defaults, limits, and queue verification.

## Enquiry comment sync

Enquiry creation, its opening comment, and subsequent comments/replies enter the durable Frappe
outbox before queue delivery. The approved adapter writes standalone `Job Comments` and preserves
reply links. Web/mobile request IDs reuse one local comment and outbox event. Imported comments
do not emit outbound events. Queue retries reuse a stable remote identity; general Activities
exports remain outside this approval.

## Record visibility

Assigned users can pin enquiry locations, submit check-in/out, post comments, and open a new call with `crm.enquiry.work`.
The enquiry permission seed grants this permission to the standard active role set.
Enquiry edits, reports, charges, and collections honor the persisted `crm.enquiry.update` grant for assigned users.
Creator-only visibility does not permit field actions or edits. Assignment changes and tenant-wide access retain administrator checks.
The composed API applies the owner enquiry write guard to every numeric enquiry mutation route, including job actions.
Existing tenants need the enquiry permission seed after the API update to receive the new grant.

Tenant Admin and Super Admin retain tenant-wide enquiry and task reads. Other roles see only
records assigned to their active user or created by their email. Activities, overview totals,
filters, direct record links, comments, and closure review inherit that record scope.
Legacy non-admin `view-all` grants are disabled by the enquiry/task permission seeds and rejected
by the runtime authorization policy even if restored manually.

The editable `Team Head` role is available without assigning any users to it. Team membership
and managed-team expansion are deferred; Manager and Team Head currently retain own-record scope.
Contact 360 permissions and assignments are hidden from Access Control lists and pickers while
the feature is unfinished. Existing Contact 360 data and grants are retained.

Run `npm run test:e2e:crm-record-scope` for disposable MariaDB authorization and route regression tests.

## Frappe reference and comparison

Use [CODEXSUN/logicx-biz](https://github.com/CODEXSUN/logicx-biz.git) for custom Frappe schemas and functions.
Read the [CRM comparison](agent/FRAPPE-COMPARISON.md) and
[complete DocType catalogue](../frappe/agent/LOGICX-CRM-REFERENCE.md) for the reviewed source snapshot.
CRM remains locally authoritative for normal enquiries. Frappe-imported enquiries preserve their source timestamps and comments, and the approved Frappe live-sync path posts CRM enquiry changes back to the linked Frappe record. Reference parity does not authorize additional outbound integration beyond this explicit enquiry sync contract.
Local enquiry creates and edits append a durable upsert event in the same transaction, then submit it to the queue after commit. Queue retries and the periodic relay recover transient failures. The CRM save does not wait for the remote Frappe request. The retained integration-status API requires the exact account `admin@tenant.com` and `crm.enquiry.frappe-sync.view`. CRM does not render sync columns or detail history.
See the [implemented Duty bindings](../frappe/agent/CRM-DUTY-FIELD-MAPPING.md) for frequency, Department, Employee, and report fields.
Run `npm run test:crm-frappe` for CRM/Frappe unit tests and isolated Duty API/database E2E.

Duty-report capability options are available to users with own-report or team-report read access.
The options return permission flags only; team-wide report lists and summaries still require team-report read access.

## Optional task contacts

Tasks can save without a contact. Below Task details, select a saved contact or enter a mobile number and customer name.
New customers resolve through Core during the task transaction. Select a customer when several share a mobile number.
Clear contact removes the task link without deleting the contact.

## Work timestamp display

Job start/stop and check-in/check-out reports retain UTC instants. Generated work comments now keep timestamps in ISO UTC form so web and mobile can convert them to the viewer's local timezone. Both clients display `DD-MM-YYYY hh:mm:ss am/pm`. Older generated job and checkpoint comments are interpreted as UTC; older pinned-location captures remain local. Job start/stop fields and captured location times use the same display format.
Pin location saves a structured capture, a single-line linked comment, a Pin Location action, and its durable outbox event in one transaction. Comments start with `Pin Location :`; action details omit that prefix. Both use seven coordinate decimals, two accuracy decimals, and the captured UTC instant formatted in the viewer's local time.
The task detail page links to the saved contact and shows its mobile number.
The additive `crm.task.optional-contact-v4` migration adds a nullable contact ID and a restrictive foreign key.
Existing tasks remain unlinked. Older clients that omit contact fields preserve saved links on update.
Run `npm run test:e2e:crm-task-contact` for optional, selected, inline-created, cleared, invalid, and unauthorized cases.

## Enquiry and task list date ranges

Enquiry and task lists provide a calendar date-range filter. Enquiries use the enquiry date, and tasks use their creation date.
The range includes the full end date and combines with search, status, and column filters.

## CRM schedules and reminders

Schedules are local CRM records owned by the scheduler module. Each schedule links to one
permitted enquiry, task, call log, duty assignment, or SOP. Users see and manage their own
schedules; roles with the schedule-wide permissions can manage team schedules. The Platform
main-menu notification control shows due and near-due CRM reminders while CRM is active. Selecting
a reminder opens its linked record, and dismissing it acknowledges it through the CRM API. Reminder
acknowledgement and schedule completion are recorded in the tenant CRM database. Enquiry and Task
detail pages keep schedule creation and their linked schedule lists together in the Schedules tab.
The New schedule form asks for Notes and one date and time; the reminder uses that same time.
The tab refreshes after saving and supports completion and cancellation. Existing schedule titles
and details are combined into Notes by the additive scheduler migration. Mobile uses the same API
contract and provides date, hour, and minute selection. Duties expose scheduling from their list and
assignment page.

## Enquiry contacts and closure approvals

Bidirectional Frappe enquiry sync exports mapped assignees and adopts the serial Frappe returns after posting.
Number changes keep stable record IDs and append activity history. Unknown remote Employee mappings block import without clearing allocation.
Number reconciliation reuses a free provisional serial above the linked Frappe range when a local record collides.
Temporary swap numbers do not advance the permanent number sequence. Existing gaps require a separate backed-up identity audit.
Enquiry export failures take priority over dependent comment failures in the sync badge.
An unlinked comment reports the parent export error when available.
Manual retries retain the last error until delivery succeeds and start a fresh queue correlation generation.
The stable enquiry and comment retry identities remain unchanged.
Enquiry export can link the exact Mobile Contact number without a Frappe Customer identity.
It leaves unmapped Customer fields empty in Frappe and preserves the local contact and history.
Coalesced edits also receive a fresh delivery generation so earlier completed jobs cannot hide an update.
Remote source snapshots retain fields that have no CRM editor. Tasks remain local with no Frappe contract.

Enquiries use the same Core contact IDs as the CRM contact form.
Contact changes refresh the enquiry customer lookup. The enquiry Customer tab links to its saved contact.
The Closure approvals tab shows the closure request and its review actions.
Only users with server-provided review permission see Verify and close and Reject.
Approval closes the enquiry. Rejection leaves it open. Both refresh enquiry details, comments, and activity.
Closure Approvals is removed from the sidebar. Review closures inside each enquiry.
Pending closure requests show an orange badge in the enquiry list, details, and approval card.
Web enquiries refresh pending status every 15 seconds while open, including requests sent from mobile.
Run `npm run test:e2e:crm-closure` for isolated database approval, rejection, contact binding, and permission checks.

## Component documentation

### Mobile customer form

The first tab shows mobile number and customer name on the left, with code and contact type on the right.
Active status appears below.
New numbers default to Mobile and primary. Only Details is currently visible. Additional details, Tax Details, Communication, Addresses, Finance, and More are hidden.
Hidden fields remain in the save payload so edits preserve their data.
New contacts default to the saved Customer type. Users can add numbers and select one primary phone.
Create and edit require a 10-digit Mobile or WhatsApp number.
The form and CRM API reject duplicate numbers within one customer and invalid primary selections.
Different customer names or groups can share a mobile number.
Core rejects the same name and phone combination within one group, including simultaneous saves.
Core saves identity and phone rows. Existing email, tax, address, and finance fields remain available.
Imported customer codes are read-only to preserve the Frappe customer link.
These saves change local data. They do not write to Frappe.

Run `npm run test:e2e:crm-contact-upsert` for the isolated create, reload, edit, validation, and authorization checks.
The test uses the form schemas, CRM routes, Core routes, and a disposable database.
It does not certify browser interaction or deployment.

Local enquiries, contact activity, follow-up tasks, SOPs, duty assignments, and duty reporting across web and mobile.

Core owns contact identity. Local CRM records remain authoritative after an import from the tenant's verified Frappe connection. Imported enquiries preserve serials, source creation and modified timestamps, mapped user identity, comments, and site-scoped Customer identity. Frappe live sync incrementally imports remote changes and posts new or changed CRM enquiries to their verified linked Frappe records. Preserve assignment scope and activity history. SOP and Duty outbox transfers remain separately approved.

- [TASK.md](agent/TASK.md): work items and acceptance evidence.
- [PLAN.md](agent/PLAN.md): scope, ownership, delivery order, and verification gates.
- [SKILLS.md](agent/SKILLS.md): component working rules and safety constraints.

### Source inventory

- `api/src/modules`: `activities`, `call-log`, `closure`, `contact`, `contact-classifications`, `contact-communication`, `contact-documents`, `contact-employments`, `contact-lifecycle`, `contact-notes`, `contact-people`, `contact-person-tags`, `contact-preferences`, `contact-profiles`, `contact-relationships`, `contact-roles`, `contact-tags`, `duty-assignment`, `duty-report`, `enquiry`, `enquiry-location`, `list-in`, `priority`, `scheduler`, `sop`, `sop-item`, `status`, `task`.
- `web/src/modules`: `activities`, `call-log`, `closure`, `contact`, `contact-360`, `duties`, `enquiry`, `list-in`, `overview`, `priority`, `reports`, `scheduler`, `sop`, `status`, `task`.
- `mobile/`: `android`, `assets`, `ios`, `lib`, `linux`, `macos`, `test`, `tool`, `web`, `windows`.

This inventory records source presence. It does not certify a deployed feature.

### Workspace verification

Run these commands from the repository root. Use the root installation and `dist` output tree.

- `node tools/check-module-boundaries.mjs crm`
- `npm run typecheck -w @codexsun/crm-api`
- `npm run lint -w @codexsun/crm-api`
- `npm run build -w @codexsun/crm-api`
- `npm run typecheck -w @codexsun/crm-web`
- `npm run lint -w @codexsun/crm-web`
- `npm run build -w @codexsun/crm-web`

Run `npm run check:component-docs` to verify the required documentation files.
Run the relevant app tests and root release gates when implementation changes.
Report database, browser, native, and deployment checks separately.

### Workspace packages

- `api`: `@codexsun/crm-api`.
- `web`: `@codexsun/crm-web`.

### Declared internal dependencies

- `@codexsun/core-web`
- `@codexsun/framework`
- `@codexsun/ui`

### Public package entry points

- `@codexsun/crm-api`: `.`, `./enquiry-sync`.
- `@codexsun/crm-web`: `.`, `./modules/overview`, `./modules/reports`, `./modules/enquiry`, `./modules/enquiry/services`, `./modules/activities`, `./modules/closure`, `./modules/call-log`, `./modules/enquiry/hooks`, `./modules/list-in`, `./modules/status`, `./modules/priority`, `./modules/contact-360`, `./modules/contact`, `./modules/task`, `./modules/sop`, `./modules/duties`.

## Existing record panels

New enquiries show up to five matches for a valid mobile number and selected contact.
Changing or clearing the mobile hides the previous matches immediately.
See more opens the same mobile and contact filter across all statuses, including closed enquiries.
New tasks show the five newest accessible tasks, independent of the main list search and page.
See all tasks opens the unfiltered task list. Record rows open their exact saved records.
Both panels refresh every 15 seconds while visible and provide a Refresh button and loading/error states.
Closure requests show an orange Closure pending badge.

Enquiry and Task lists switch from the full sortable table to compact record cards on narrow screens.
The cards retain the primary record link, status, priority, customer/contact, due date, assignee, closure badge, and available row actions.
Enquiry and Task detail summaries hide desktop column sizing on phones so labels and values keep readable widths.
Enquiry details resolve saved assignee IDs through the tenant user lookup, so existing allocations remain visible by name.

## SOP workspace

SOPs show only the LogicX SOP Item content: SOP name, Department, Frequency, and Steps.
The list supports search and frequency filtering. New and edit forms use those same four required fields.
Daily, Weekly, Monthly, and Yearly match Frappe. Existing unsupported local frequencies remain visible on edit.
Save maintains the existing internal SOP/item identities and publishes the instruction revision through the existing API.
Codes, purpose, revisions, evidence guidance, ordering, lifecycle controls, and assignments are not shown on this screen.
Existing revision history and evidence guidance remain stored. Duty work stays in its existing screens.

## Duties and Duty Reporting

Duties represents LogicX SOP Assigned. Its list and new/edit forms show SOP, User, and Index.
Department, Frequency, and Steps are read-only SOP details. Users with assignment permission can create;
management permission is required to edit. Without all-duty permission, the list shows the user's active duties.
Duplicate SOP/user pairs are rejected. Assignments with reports retain their SOP, user, revision, and valid report dates.

Duty Reporting represents LogicX SOP Reporting. New reports select an assigned SOP and show its User,
Date, Actions, Department, Frequency, and Steps. Only the signed-in assignee can submit or edit their reports.
Edits change Date and Actions, preserve the assignment/instruction snapshot and existing outcome/issue fields,
and keep one report per recurrence period. The server enforces all these rules.
Both lists support search and refresh; Duties filters frequency and reports filter dates with pagination.
Cancel protects unsaved form input. Existing mobile endpoints and report result fields remain supported.

The additive duty-assignment and duty-report edit-history-v2 migrations preserve prior record data and editor identity.
They were applied and repeat-checked on the local development tenant. Deployment must run these migrations.
Run `npm run test:e2e:crm-duties` for persistence, edit ownership, report collisions, history protection, and outbound queue checks.

## Task default filters and status colors

Tasks opens with the same Active filter as Enquiries. It excludes won, lost, and closed tasks.
All tasks and individual status filters remain available. Hold, Pending, and Other use the enquiry status groups.
Filter counts come from the authorized, searched records and refresh with the list every 15 seconds.
Task list, detail, and creation context use the enquiry status color badges. Closure pending keeps its orange badge.

## Administrative Duty Reporting

Duty Reporting uses the List in report pattern: SOP-wise, User-wise, Department-wise, and Frequency-wise summaries.
Date and search filters use Apply and Clear. Completed, Blocked, and Total counts open matching report rows.
Back to summary preserves the chosen view and applied filters. All reports opens the tenant-wide detail list.

The web options, summaries, and detail list require crm.duty-report.view.all.
Default grants include Admin, Manager, and Super Admin. The local tenant seed was applied and verified for those roles.
The web page never falls back to own-report scope. Normal users retain their mobile own-report API access.
Existing report creation and edit permissions remain separate from all-report viewing.
Grouped totals run on the server across all matching records, before detail pagination, within the current tenant.

## Mobile work actions and administrative review

Mobile is the user client. Web is the administrative client. Both use the same tenant-scoped Platform API and local CRM database.
New mobile enquiries default to the New status and Normal priority. Customer name and mobile are optional; a supplied name or phone is resolved to a contact, while an enquiry without either remains unlinked. Mobile title, details, and a newly entered customer name are normalized to plain text before they are saved.
The mobile Menu includes Tasks. Task details show the optional saved contact, actions, GPS check-in/check-out, and completion requests.
Enquiries, Tasks, and Duties share an Add action drawer: select an action, complete its input form, then Confirm. Cancel closes the drawer without submitting.
Duty report history opens the same drawer for edits; the server preserves the original outcome and instruction snapshot.

The append-only `work-report` module owns `crm_work_reports` and `/crm/work-reports` GET/POST.
Each report references exactly one enquiry or task. It stores the action, report text, user, device capture time, server time,
latitude, longitude, accuracy, public UUID, and retry key. Check-in/check-out require GPS and a valid sequence per user and record.
The parent row is locked for sequence and assignment checks. Retrying the same payload returns the saved report;
reusing its key for different content is rejected. Coordinates are normalized to database precision before retry comparison.

Reading requires the parent view permission and assignment, creator, or all-record scope. Reporting requires assignment or management scope
and the existing enquiry update/task work permission. Normal users cannot reassign enquiries to other users.
The module uses these existing grants and has no separate permission seed or edit/delete lifecycle.

Web enquiry and task Actions tabs show reports and map links. Actions refresh every 10 seconds.
Task details, closure requests, and status also refresh every 10 seconds. Completion awaits administrative approval;
rejection permits another request, and pending closure uses the orange badge.

Assignment changes, enquiry comments/job start/stop, task activity/closure decisions, and action reports create related Chat messages.
Recipients are the active assignee, creator, assigning user, and reporter. If no other related participant exists,
active Admin, Super Admin, and Manager users receive the update. Duty assignment/report notifications use the assignee and assigning user.
Reports and their Chat messages commit in the same transaction. Participant changes select a different conversation, so future work updates do not leak to removed assignees.
Chat reads require current channel membership. The Chat permission seed includes the four standard roles; channel administration and message ownership checks remain server-side.
Conversation lists poll and open conversations refresh. Native emulator sockets use the same development Host mapping as HTTP.

The additive `crm.work-report.actions-v1` migration must run after enquiry/task migrations. No existing report history is replaced.
This work remains local CRM data and does not expand Frappe transfer scope.
Run `npm run test:e2e:crm-work-reports`, `npm run test:e2e:crm-duties`, and the CRM mobile tests for workflow and permission coverage.

### Enquiry WhatsApp history

The WhatsApp tab stores customer-message handoffs in `crm_enquiry_whatsapp_messages`.
The server records the signed-in author, UTC time, recipient, and message before opening WhatsApp.
The history does not confirm external sending or delivery. Existing tenants need the tracked CRM migration.
Enquiry permissions and record visibility protect both reads and writes. Retry keys prevent duplicate handoffs.
Run `npm exec tsx -- --test tools/e2e/crm-whatsapp.e2e.ts` for database acceptance.

### Work charges

Enquiry and task show pages include a Charges tab for initiating charges and recording collections. These operational CRM records are not invoices or payments in Billing. Collections cannot exceed the remaining initiated amount. The `crm.work-report.charges-v1` migration adds a nullable decimal amount to existing work-report rows without changing prior history.
The web Charges form keeps its request ID when a user retries the same charge or collection after a failed response. A changed amount, note, action, or record starts a new request. This uses the work-report API retry contract to prevent duplicate entries when a save succeeds but the response is lost.
The mobile enquiry and task Charges sections show the same charge and collection history. An outstanding balance shows a purple Collection pending notice on web and mobile. Tapping a charge or Collect charge in the mobile Actions sheet opens the collection form with amount and required notes; confirming the collection updates the balance. Collections apply to the enquiry or task's outstanding total; work reports do not store a link to an individual charge.
The mobile Jobs list fetches outstanding enquiry IDs through `GET /crm/work-reports/pending-collections`. The endpoint returns only enquiries assigned to or created by the signed-in user. Cards with outstanding collections use a purple highlight and Collection pending badge; a pending completion request keeps its orange card highlight.

## Mobile user record scope

Mobile enquiry lists request assigned records; task and activity lists accept `scope=mine`, which restricts results to records assigned to or created by the authenticated user even when that user's role has wider web visibility. The default `scope=visible` behavior remains unchanged for web consumers. Mobile activity lists use a server-side seven-day date bound. The mobile Reports screen summarizes submitted reports for the user's assigned duties; enquiry/task work reports remain under their parent records.

## Local promotional email policy integration, 23-10-2026

CRM now owns append-only company-scoped email contact restrictions and a public policy check.
The check also reads Contact Preferences for every matching Core identity. Unknown legacy preferences require review.
Explicit operational allowance never grants promotional consent. Restriction changes require `crm.contact-restrictions.manage`.
Policy reads require `crm.contact-restrictions.check`. Only Admin receives these new grants by default.

## Standard User access and draft revisions

Standard User defaults grant available CRM read/create capabilities while retaining tenant and record visibility rules.
Administrative edits, deletion, management, publication, and protected lifecycle permissions require an active administrator role even after a stale broad grant.
Existing operational permissions, such as assigned task work, retain their owner rules.
SOP instruction revisions have a separate draft-edit permission. Their repository updates only draft rows and rejects published revisions atomically.
Ordinary CRM records without a draft state do not receive an invented draft-edit exception.
