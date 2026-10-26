# CRM: Schedules and reminders

The CRM scheduler owns schedules linked to enquiries, tasks, call logs, duties, and SOPs. A schedule exposes one Notes field and one scheduled date and time. That time also drives its in-app reminder. Status, assigned user, and acknowledgement time remain tenant-local.

The Enquiry and Task detail pages create and list schedules in the Schedules tab. Mobile creates schedules through the same API and shows linked Enquiry schedules in its Schedules section. Duty and SOP workflows can also create linked schedules. The CRM Schedules and Reminders pages list permitted records. Platform displays due CRM reminders in its main notification menu and sends acknowledgement requests back to CRM.

## Source contracts

- `apps/crm/api/src/modules/scheduler/index.ts`
- `apps/crm/api/src/modules/scheduler/scheduler.migration.ts`
- `apps/crm/api/src/modules/scheduler/scheduler.module.ts`
- `apps/crm/api/src/modules/scheduler/scheduler.repository.ts`
- `apps/crm/api/src/modules/scheduler/scheduler.routes.ts`
- `apps/crm/api/src/modules/scheduler/scheduler.seed.ts`
- `apps/crm/api/src/modules/scheduler/scheduler.service.ts`
- `apps/crm/api/src/modules/scheduler/scheduler.types.ts`
- `apps/crm/web/src/modules/scheduler/index.ts`
- `apps/crm/web/src/modules/scheduler/scheduler.services.ts`
- `apps/crm/web/src/modules/scheduler/scheduler.workspace.tsx`

## Declared routes

- `GET /crm/schedules`
- `GET /crm/schedules/reminders`
- `GET /crm/schedules/sources`
- `POST /crm/schedules`
- `POST /crm/schedules/:id/acknowledge`
- `POST /crm/schedules/:id/status`

## Explicit permission checks

- `crm.schedule.view`
- `crm.schedule.view-all`
- `crm.schedule.create`
- `crm.schedule.update-own`
- `crm.schedule.manage`

The scheduler migration adds `crm_schedules` with tenant-local record IDs and a public UUID. The additive Notes migration combines existing titles and details without deleting either legacy column. New writes keep the legacy title populated for older readers. The permission seed grants normal users view, create, and own-record update access. Admin, Manager, and Super Admin roles receive team-wide access and management actions.

`POST /crm/schedules` accepts Notes, a linked source, and one scheduled timestamp. During the mobile transition it also accepts the previous title, details, and reminder timestamp request and combines the text into Notes. Responses retain title, details, and reminder time for older installed clients; current clients use Notes and the scheduled time. Existing reminder timestamps are preserved.

## Reminder navigation and rescheduling

The CRM sidebar links directly to Reminder. Its badge excludes completed, cancelled, and dismissed reminders.
`GET /crm/schedules/reminders/count` returns the exact authorized open count without the list's 100-row limit.
`POST /crm/schedules/:id/reschedule` accepts `{ scheduledAt }` as an ISO date with an offset.
Only the assigned user with `crm.schedule.update-own`, or a schedule manager, can reschedule an open record.
Rescheduling updates both schedule and reminder time, clears dismissal, and retains the linked record and notes.
The app header opens the New reminder popup. Cards show the linked record first and notes second, with consistent action buttons.
