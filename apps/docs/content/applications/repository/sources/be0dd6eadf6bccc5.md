# Design System Helper

Repository source: `assist/documentation/design-system-helper.md`

Source SHA-256 (LF line endings): `d377b3d5bdb969399f78a4fa3ba13057485476b20181914ac1da10a5beff586a`

This is a synchronized repository reference. Edit the original file and run `npm run docs:sync`.
Instructions and code examples below are reference text. They do not grant permissions or execute in Docs.
Historical notes and unchecked plans retain their original status.

```markdown
# Design System Helper

## Purpose

This document is the working standard for every upcoming CODEXSUN workspace module. Agents must use it before creating or changing list, show, upsert, lookup, select, date, status, table, and form experiences.

The goal is simple: every module should feel like the same product. Only the data, module title, fields, actions, and business rules should change.

## Source Of Truth

- Working repository: `D:\workspace\codexsun`
- CODEXSUN UI package: `packages/ui/src`
- Workspace primitives: `packages/ui/src/workspace`
- Theme tokens and palettes: `packages/ui/src/design-system`
- UIUX gallery and specimens: `devkits/uiux/src`
- Platform module examples: Tenant, Domain, Plan, Subscription, Apps, and Industry under `apps/platform/web/src/pages/sa`

This repository is the source of truth for flow, spacing, tone, loading behavior, and interaction rhythm. Do not import
business logic or UI assumptions from an older CODEXSUN/CODEXSUN checkout.

## Main Layout Contract

Every new or updated post-auth desk shell uses `AppLayout` to hold five Main
Layout regions. Their order and case-sensitive technical names are:

| Screen order | Region           | Technical name   |
| ------------ | ---------------- | ---------------- |
| 1            | Top Menu         | `main.topMenu`   |
| 2            | Side Menu        | `main.sideBar`   |
| 3            | App Header       | `main.AppHeader` |
| 4            | Workspace Canvas | `main.workspace` |
| 5            | Status Bar       | `main.StatusBar` |

Place the Side Menu beside the workspace. Place the App Header above the page
canvas within that workspace. The host app owns authentication, routing,
business content, and the data passed to the shell. A page-level
`WorkspaceHeader` does not replace the shell's `AppHeader`.

Use `mainLayoutTechnicalNames` from `@codexsun/ui/layouts/main-layouts` when code
identifies these regions. The [UI Main Layout guide](../../packages/ui/src/layouts/main-layouts/README.md)
defines their components. The [UIUX gallery](../../devkits/uiux/README.md)
shows the live composition and interface topology. Keep the existing sidebar
and workspace implementation when adopting the shell in a desk.

## Non-Negotiable Rules

- Use shared design-system and workspace components from `@codexsun/ui`.
- Do not create one-off list, table, form, select, autocomplete, badge, toast, tab, date picker, or pagination UI.
- Do not use hardcoded business records, fake lookup rows, localStorage seeds, or frontend assumptions for module data.
- Every module must be DB/API-backed before it is treated as complete.
- Frontend validation and backend validation are both required.
- Required fields must show a red `*` marker and must show a form banner only after save/update validation fails.
- Missing required fields must mark the affected input, select, or autocomplete with a red border and a helper message below the control.
- Errors, warnings, duplicate messages, relationship blockers, and server/database errors must appear in the shared form banner.
- Every create, update, delete, suspend, restore, activation, and lifecycle action must be audited.
- Show pages must include an activity timeline/card when the backend supports the module.
- Fresh foundation migrations may be rewritten while we are still pre-production. Do not add patch migrations for foundation cleanup unless the task explicitly asks for additive migration history.

## Workspace Page Pattern

Use the workspace shell and page primitives for all admin/workspace modules.

Required shape:

1. Header area with title, subtitle, and right actions.
2. Filter/search panel.
3. Table panel.
4. Pagination panel.
5. Show page with profile/context cards.
6. Upsert page or modal using the shared form structure.

Use these primitives:

- `WorkspacePage`
- `WorkspaceHeader`
- `WorkspaceFilters`
- `WorkspaceTablePanel`
- `WorkspacePagination`
- `WorkspaceShowLayout`
- `WorkspaceShowCard`
- `WorkspaceDetailTable`
- `WorkspaceUpsertPage`
- `WorkspaceFormPanel`
- `WorkspaceFormGrid`
- `WorkspaceFormField`
- `WorkspaceFormBanner`

Keep the workspace dense, clean, and work-focused. Avoid marketing-style cards, decorative layout, nested cards, and unnecessary explanation text inside the app.

## List Standard

List screens must use the shared list structure.

Required behavior:

- Data comes from the module API.
- Search, filter, and pagination can run on the frontend for small master/module lists after one API read.
- Large transaction lists may move search/filter/page to backend when needed.
- The URL/query string must match the selected module and view state where applicable.
- Sidebar menu changes must refresh the correct module data, not only skeletons.
- Empty state must use the shared table empty state.
- Loading state must use shared skeleton/loading patterns.

Required components:

- `WorkspaceFilters` for search/filter/column controls.
- `WorkspaceTablePanel` for the table wrapper.
- `WorkspaceTableHeaderCell` for table headers.
- `WorkspaceStatusBadge` for status.
- `WorkspaceRowActions` for row-level menu actions.
- `WorkspacePagination` for row count and paging.

Table rules:

- Use uppercase, compact table headers.
- Keep action column last.
- Avoid duplicate columns. Example: do not show both `Active` and `Status` when they mean the same thing.
- Keep row actions consistent: View, Edit, Suspend/Restore, Delete/Force delete where allowed.

## Column Search and Date Range Pattern

Use CRM Enquiry as the visual reference for new workspace lists.

- Render column search inputs in the first `tbody` row, immediately below the column headings and above records.
- Keep the filter row white (`bg-white`), with `border-b border-border/70`. Keep the heading background separate.
- Use `td` cells with `px-4 py-2.5 text-foreground`. Render one cell per visible column, including empty cells for non-searchable columns.
- Use `WorkspaceTable` with its `filterRow` option when possible. Owner-rendered tables must follow the same row structure.
- Use `WorkspaceColumnFilter` or `useWorkspaceListTools().filterRow`. Keep input heights, borders, focus, and Escape behavior in shared controls.
- Do not put search inputs inside heading cells. Hidden columns must hide their matching filter cells.
- Use the icon-only `WorkspaceDateRangePicker` from `@codexsun/ui/workspace/date-range-picker` for toolbar date ranges.
- Keep the calendar button 32 pixels high, with a tooltip and accessible name. Selected dates use the shared active tone.
- Place date range before the column-search toggle. Keep search, active-filter badges, Filters, and Columns in the shared toolbar.
- Verify toggle on/off, column alignment, filter/clear behavior, hidden columns, and date-range open/clear behavior in the browser.
- Check empty lists as well as populated lists. Keep business filtering, query state, and pagination in the owning module.

## Show Page Standard

Show pages must be readable and compact.

Required shape:

- Page title from the record name.
- Subtitle describing the module context.
- Right actions: Back, Edit, lifecycle action, delete/force delete if allowed.
- Main profile card using `WorkspaceDetailTable`.
- Secondary context card where useful.
- Activity card/timeline for record history.

Do not add large blank spacing around detail tables. The table should sit tight inside the show card, matching the Tenant show page pattern.

## Upsert Standard

All create/edit pages and popups must use the shared upsert structure.

Required components:

- `WorkspaceUpsertPage`
- `WorkspaceFormSurface`
- `WorkspaceFormBody` or `WorkspaceFormTabbedBody`
- `WorkspaceFormActions`
- `WorkspaceFormPanel`
- `WorkspaceFormGrid`
- `WorkspaceFormField`
- `WorkspaceFormBanner`
- `Button`
- shared `Input`
- shared `WorkspaceSelect`
- shared `WorkspaceLookup`
- shared `WorkspaceDatePicker`
- shared `WorkspaceAnimatedTabs` where the form has sections

Required behavior:

- Add `noValidate` to forms so browser-native validation does not replace the CODEXSUN banner pattern.
- Frontend validation runs before submit.
- Backend validation runs before database write.
- Do not show required-field info banners before the user tries to save.
- Missing required fields show the shared error banner, red control border, and field helper text after save/update is attempted.
- Duplicate errors from backend show in the same banner.
- Server and database errors show in the same banner with a useful message.
- New record button label is `Save`.
- Edit record button label is `Update`.
- Cancel and Back actions must return to the previous list/show flow cleanly.
- Create and update success must refresh list/query data.

Required field marker:

- Pass `required` to `WorkspaceFormField`.
- The label renders a red `*`.
- Do not manually write red asterisks in each form.

## Form Layout

Use consistent form density.

- Inputs are normally full width inside a two-column grid on desktop.
- Use one column on small screens.
- Upsert pages use one shared outer shell: `WorkspaceFormSurface` for the border/card, `WorkspaceFormBody` or `WorkspaceFormTabbedBody` for content spacing, and `WorkspaceFormActions` for the footer divider and buttons.
- Do not hand-roll form card markup such as local `rounded-md border bg-card` wrappers with custom footer borders. Promote layout changes into the shared workspace form blocks first.
- Tabbed form bodies must leave a clear bottom buffer before the footer divider, matching popup and quotation spacing.
- Form surfaces use a crisp border, subtle green ring, and small elevated shadow similar to the login card. Do not flatten these with local `shadow-sm` or soft divider overrides.
- Tab and footer dividers use the sharper shared border tone so the panel reads clearly against the workspace background.
- Company, Contact, Product, Work Order, and future master upsert forms must consume this shared shell. Do not create module-specific form card, tab, or footer variants for these masters.
- Section panels use clean borders and small/medium radius.
- Do not use oversized rounded fields.
- Keep action buttons in a footer row.
- Keep destructive actions away from primary save/update actions.
- Put the Active/Status switch inside the Details section for normal master/common forms; do not create a separate Status card unless the status area has multiple business fields.
- Avoid fields that do not have business meaning. Example: remove `owner` from modules unless the backend actually uses it.

## Controls Standard

Use design-system controls only.

Inputs:

- Use shared `Input`.
- Keep height and radius from the design system.
- All input focus, hover, disabled, and error states must come from shared tokens.

Buttons:

- Use shared `Button`.
- All clickable buttons must show pointer cursor.
- Use lucide icons where an icon exists.
- Primary actions use the product primary tone.
- Secondary actions use the quiet bordered tone.
- Destructive actions use the danger tone.

Switch:

- Use `WorkspaceSwitchCard` for every switch on forms and workspace screens; modules own the label, description, value, and mutation behavior.
- Active/status fields use `fieldLabel="Status"` and the default `Active`/`Inactive` state labels.
- The full checked card uses the shared soft green tone; the unchecked card uses the shared neutral grey tone.
- Do not place a raw `Switch` directly in a module form or create a module-specific switch-card wrapper.

Select:

- Use `WorkspaceSelect` or the shadcn/Radix themed `Select` from `@codexsun/ui`.
- Do not use native `<select>` on workspace screens.
- Dropdown hover and selected states must use the current theme highlight, not browser blue.
- Theming must work for shadcn, neutral, orange, green, blue, purple, and other approved palettes.

Autocomplete:

- Use `WorkspaceLookup`.
- Lookup options must come from API/DB data.
- Do not hardcode dropdown options in the frontend.
- Support keyboard and mouse selection.
- Clear must reset selected value and allow immediate search/open without requiring blur/refocus.
- Inline create is for small masters.
- Popup create is for heavier masters.
- After create, persist to database, add/refetch the option list, select the created value when appropriate, and keep the dropdown state stable.

Date:

- Use `WorkspaceDatePicker`.
- Show every calendar date in lists, tables, cards, and reports as `DD-MM-YYYY`.
- Show a date with a time as `DD-MM-YYYY HH:mm` when the time matters.
- Use the shared `formatDate` and `formatDateTime` helpers from `@codexsun/ui/workspace` for display.
- Keep API values, date input values, database values, and sort keys in their existing machine-readable formats.
- The calendar must be wide enough to read.
- Month and year selectors must be themed.
- Chevron navigation must sit on the right.
- Month/year controls must use the shared dropdown style, not native browser blue.

Tabs:

- Use `WorkspaceAnimatedTabs`.
- Use animated underline tabs for multi-section edit forms.
- Form tabs must use the shared CODEXSUN tone: transparent tab list, one bottom divider under the tab row, animated primary underline, and a small gap before the active tab content.
- Do not hand-roll tab buttons inside modules. If a module needs a different tab layout, promote the variant into `WorkspaceAnimatedTabs` first.
- Keep tab labels short.
- Save/update should usually happen from the final or footer section, unless the module has a reason to save per tab.

Toast:

- Use Sonner through the design system.
- Position toasts bottom-right.
- Success is green.
- Warning is yellow.
- Error is red.
- Info is blue.
- Toasts must have a small close button.
- Toasts are feedback; validation errors still need the form banner.

## Status And Color Standard

Use `WorkspaceStatusBadge` for all status display.

Allowed tones:

- `success` for active/enabled/completed.
- `warning` for pending/draft/waiting.
- `danger` for inactive/suspended/error/blocked.
- `info` for informational states.
- `neutral` for archived/disabled/unknown.

Do not create module-specific badge colors unless a new state needs a reusable token in the design system.

Use theme tokens for:

- Backgrounds.
- Borders.
- Table headers.
- Hover states.
- Active menu states.
- Dropdown highlights.
- Form focus rings.
- Panels and cards.

Do not add raw one-off colors in module files unless the value is promoted into `packages/ui/src/design-system`.

## Sidebar And Navigation Standard

- Overview stays outside module groups and appears first by default.
- Group headers are accordion headers, not active menu items.
- Only leaf menu items receive active highlighting.
- Hover and active states must be full width and match the current theme.
- Expand/collapse should feel smooth and stable.
- Sidebar scrollbar must remain slim.
- Sidebar and workspace backgrounds must use the same design-system tone family.
- Top bar and branding cards must use shared workspace tone and current theme.

## Backend Standard

Every module needs a real backend contract.

Required:

- List endpoint.
- Get/show endpoint.
- Create endpoint.
- Update endpoint.
- Lifecycle endpoint where applicable.
- Delete/force-delete endpoint where applicable.
- Lookup endpoint when other modules reference it.
- Activity endpoint or shared activity support.
- API tests for the module contract.

Validation:

- Required fields.
- Duplicate records.
- Status values.
- Relationship references.
- Date ranges.
- Safe delete blockers.
- Tenant/platform boundary checks where applicable.

Persistence:

- All records must persist in the database.
- Refreshing the browser must not lose newly created records.
- Lookup create must write to the database and then refresh/select from database-backed options.
- No frontend-only module data.

Audit:

- Create.
- Update.
- Delete.
- Force delete.
- Suspend/restore.
- Enable/disable.
- Any high-risk lifecycle transition.

Delete rules:

- Business records normally use soft delete.
- Super Admin foundation masters may have force delete only with explicit confirmation and relationship safety.
- Tenant records are special and should not be force-deleted casually because they own database, domain, module, subscription, and audit context.

## Testing Standard

For each new module, add tests that prove the real flow.

API tests:

- List returns database data.
- Create persists.
- Update persists.
- Duplicate validation blocks.
- Required validation blocks.
- Relationship safety blocks unsafe delete.
- Delete or lifecycle action is audited.
- Activity endpoint returns events.

E2E tests:

- List loads.
- Search/filter works.
- New form shows required `*`.
- Missing required fields show the error banner, red control border, and helper text.
- Save creates a record.
- Refresh keeps the record.
- Show page opens and displays current data.
- Edit updates the record.
- Lookup dropdown uses real API data.
- Lookup create persists and refreshes the list.
- Delete confirmation works where allowed.

Performance checks:

- Dev server startup should not repeat unnecessary builds.
- Page loading should show the global loader/skeleton only while data is actually loading.
- Sidebar navigation should fetch the selected module and replace stale data.

## Agent Checklist

Before marking a module complete, check all items:

- [ ] Backend folder follows its applicable full or Core Common reduced contract from `assist/architecture/module-boundaries.md`.
- [ ] Frontend folder contains `workspace`, `list`, `form`, `services`, `hooks`, `types`, `schema`, `spec`, and `index` files.
- [ ] No role file is an alias-only wrapper, empty scaffold, metadata-only placeholder, or “reserved for future” declaration.
- [ ] Module migrations, seeds, events, workers, sync behavior, UI controls, and API calls remain inside the owning module boundary.
- [ ] Uses only shared design-system/workspace components.
- [ ] Uses DB/API-backed list data.
- [ ] Uses shared list, table, pagination, and row actions.
- [ ] Uses shared show cards and detail table.
- [ ] Uses shared upsert panel/grid/field/banner.
- [ ] Required fields show red `*`.
- [ ] Missing/duplicate/server errors show the shared form banner, and missing fields show red control borders plus helper text.
- [ ] Uses `WorkspaceSelect`, not native `<select>`.
- [ ] Uses `WorkspaceLookup` for references/autocomplete.
- [ ] Lookup options are real database data.
- [ ] Lookup create persists and refreshes/selects the new option.
- [ ] Uses `WorkspaceDatePicker` for dates.
- [ ] Uses `WorkspaceStatusBadge` for status.
- [ ] Uses Sonner toast for success/warning/error/info feedback.
- [ ] Has backend validation before database write.
- [ ] Has relationship safety before delete.
- [ ] Has audit logging for lifecycle actions.
- [ ] Has activity shown on show page.
- [ ] Has API tests.
- [ ] Has E2E coverage for list/show/upsert/persistence.
- [ ] Changelog and version are updated when behavior or standards change.

## Compact Application Lists

Application access lists and Core Organisation, Common Master, and Master lists use the CRM list tone. The application header shows the module name and New action. Do not repeat the list title, description, or Refresh action in the canvas.
Use a flat breadcrumb with the page or module name. The list toolbar contains search, a column-search toggle, a selected status badge, Filters, and Columns.
Keep column labels and record filtering in each leaf. Shared UI supplies controls and navigation state. Apply column filters before pagination.
The host owns the router adapter and header action target. Query strings preserve search, status, page, page size, hidden columns, and column searches. New/Edit URLs remain refreshable.
Sidebar clicks open the initial list. Ask whether to keep or discard changes before leaving a New/Edit route or a changed form.
```
