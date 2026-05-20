PR-OPS-5.3 PHASE 1 AUDIT REPORT
================================

BRANCH STATUS
- main top 3: `d6559b8` (merge #539 PR-Ops-5.1.5) → `cedf5e2` (5.1.5 itself) → `6d5eeb0` (merge #538 PR-Ops-5.1.7).
- **PR-Ops-5.2 status: UNMERGED.** Commit `3a75a26` ("feat(pr-ops-5.2): inline + schedule block form…") lives on its branch `claude/pr-ops-5.2-schedule-block-form` but is not in main yet. The audit work here is orthogonal to 5.2 (5.2 only touches `DailyPlanItemRow.tsx`'s create-form UI; this audit surveys /hub route, src/components/hub, calendar libraries, and the daily-plan items GET shape — none of which 5.2 affects), so I proceeded transparently. Re-run after the 5.2 merge if Alex prefers strict gating; the findings won't change.
- current branch: `claude/pr-ops-5.3-hub-audit` (off `d6559b8`)

A. /hub ROUTE — **EXISTS, fully built**

- `src/app/hub/` exists ✓. Tree:
  - `page.tsx` — **682 lines** (44,245 bytes)
  - `itinerary/` subdirectory (separate sub-page)
- Other hub-shaped app routes:
  - `src/app/api/hub/` — 5 endpoints (see Section D)
  - `src/app/api/finnhub/` — unrelated (stock API integration)
- **Current `page.tsx` render:** a full Hub page with:
  - `AppLayout` wrapper + `useSession` auth (`:1-5`)
  - `CalendarGrid` from `@/components/shared/CalendarGrid` (`:7`)
  - `BudgetDrillDown` from `@/components/hub/BudgetDrillDown` (`:6`)
  - Leaflet map components via `next/dynamic` for trip visualization (`:11-16`)
  - **Seven event sources** with icons/colors (`SOURCE_CONFIG`, `:48-56`): `home, auto, shopping, personal, health, growth, trip` — NO `operations` source yet
  - Year/month state, four data loads:
    - `fetch('/api/calendar?year=…&month=…')` (`:142`) — `calendar_events` table
    - `fetch('/api/hub/trips')` (`:154`)
    - `fetch('/api/hub/year-calendar?year=…')` (`:161`)
    - `fetch('/api/hub/nomad-budget?year=…')` (`:177`)
    - `fetch('/api/hub/business-budget?year=…')` (`:193`)
- **Nav link to /hub:** wired throughout:
  - `src/app/page.tsx:9` — "Hub" entry in main nav: `{ name: 'Hub', desc: 'Command center', href: '/hub' }`
  - `src/components/ui/AppLayout.tsx:177,192,199,341` — Hub link in header + sidebar
  - `src/app/login/page.tsx:28` + `src/components/LoginBox.tsx:14` — post-login redirect defaults to `/hub`
  - Hub is the **default landing page** after auth.

B. HUB COMPONENTS (`src/components/hub/`)

- **Single file:** `BudgetDrillDown.tsx` (192 lines).
  - Purpose: side-panel drill-down for budget categories on the Hub.
  - Data source: `fetch('/api/hub/drill-down?…')` (`BudgetDrillDown.tsx:56`); fetches transaction-level rows for a coaCodes+month+year+entityType slice.
  - Rendered: by `src/app/hub/page.tsx` (the only consumer per grep). Live, in production use.
- **No other components under `src/components/hub/`.**
- **The reusable calendar lives at `src/components/shared/CalendarGrid.tsx`** (542 lines) — NOT in `hub/`, but the Hub's primary visual component. See Section C.

C. EXISTING CALENDAR UI — **BUILT IN-HOUSE, READY TO REUSE**

- **`src/components/shared/CalendarGrid.tsx` (542 lines)** is a custom-built calendar component with:
  - **`CalendarEvent` interface** (`:9-23`): `id, source, title, icon?, startDate, endDate?, startTime?, endTime?, isRecurring?, location?, budgetAmount?, details?[]`. **Already supports `startTime`/`endTime` (HH:MM, 24h) for time-based positioning** — exactly the shape Operations calendar blocks emit.
  - **`SourceConfig`** (`:25-32`): `label, icon, bg, dot, badge?, text?` — color-coded per source.
  - **Props (`:34-45`):** `events, sourceConfig, defaultView?: 'week'|'month', anchorDate?, highlightStart?, highlightEnd?, onEventClick?, showBudgetTotals?, showCategoryLegend?, compact?`.
  - Used by `/hub/page.tsx` (line 7 import; line 60 derives `HUB_GRID_CONFIG` from the existing seven sources). Live.
- **Calendar/date libraries in package.json:** ONLY `rrule@^2.8.1` (used for routine RRULE expansion). **No `react-big-calendar`, `@fullcalendar/*`, `date-fns`, `dayjs`, `luxon`, `moment`.** CalendarGrid is fully home-grown.
- **Build-from-scratch or extend:** **EXTEND.** The Hub already renders a calendar with the exact data shape Operations blocks emit (time-windowed events with a `source` discriminator). Adding an `'operations'` source to `SOURCE_CONFIG` + a fetcher that maps daily-plan items → CalendarGrid events is the entire frontend work. **No new calendar component needed.**

D. CALENDAR BLOCK READ API

- **`GET /api/operations/daily-plan/items` response shape** (verified at `items/route.ts:90-99`, post-5.2 PR-Ops-5.1.x state):
  ```
  { items: [{
    id, user_id, entity_id, plan_date, task_id, ad_hoc_title, ad_hoc_description,
    display_order, notes, created_at, updated_at, created_by,
    calendar_blocks: [{ id, user_id, entity_id, daily_plan_item_id,
      scheduled_start, scheduled_end, actual_start, actual_end,
      status, notes, created_at, updated_at, created_by }, ...],
    task: { id, title, status }  // null when ad-hoc
  }, ...] }
  ```
  Blocks ordered by `scheduled_start` asc.
- **`?from=YYYY-MM-DD&to=YYYY-MM-DD` still works** (handler at `items/route.ts:51-88`, unchanged since PR-Ops-4.1).
- **Dedicated `/api/hub/operations-calendar` endpoint or similar: NO.** The existing 5 `/api/hub/*` endpoints (`business-budget`, `nomad-budget`, `trips`, `year-calendar`, `drill-down`) all key off `calendar_events`, `ledger_entries`, `budgets`, `trips`, `transactions` tables. **Zero operations_* references** in `src/app/hub/` or `src/app/api/hub/` (verified via grep). The Operations work is fully unwired from the Hub today.
- **Sufficient for Operations-blocks-only Hub: YES**, for the basic wire (time + title + status). Operations Hub blocks can be rendered using the existing `items` GET — one fetch per month window (`?from=YYYY-MM-01&to=YYYY-MM-31`), map each item.calendar_blocks[] entry to a CalendarEvent with `startDate/startTime/endTime`, `title = item.task?.title ?? item.ad_hoc_title`, `source='operations'`.
- **Cost/category reachable from the block read path: NO** (in the current shape). The block carries `notes`, `status`, times. The parent item carries `task: { id, title, status }` only — **no `coa_code`, no `estimated_cost_usd`, no `actual_cost_usd`**. To render cost/category badges on a Hub calendar entry, either:
  1. **Expand the task `select`** in `items/route.ts:94` to include `coa_code, estimated_cost_usd, actual_cost_usd` (one-line server change, small client type expansion).
  2. **Add a dedicated `/api/hub/operations-window` endpoint** that does a custom join and shapes the result into `CalendarGrid.CalendarEvent` directly.
  
  Option 1 is the smaller change and consistent with existing patterns. **Recommend deferring cost/category rendering to a polish PR** — basic time + title wire is the meaningful first step.

E. ENTITY + BUDGET (future scope reconnaissance)

- **Entity model (`prisma/schema.prisma:66-88`):** `entities { id, userId, name, entity_type VarChar(20), is_default, … }`. `entity_type` is a free-form string at the schema level; observed values in the existing Hub code: **`'personal'`, `'sole_prop'`, `'business'`**. The drill-down endpoint groups `'sole_prop'` + `'business'` together (`/api/hub/drill-down/route.ts`).
- **Three entity UUIDs:** **NOT hardcoded UUIDs.** Each user has their own entity rows (`entities.userId` scoping). The Hub looks them up per-request, e.g., `prisma.entities.findFirst({ where: { userId, entity_type: 'personal' } })` (`/api/hub/year-calendar/route.ts:30-32`). A future budget-panel PR must do the same lookup, not hardcode IDs.
- **Existing budget-vs-actual aggregation: YES — already shipped, sophisticated.**
  - `/api/hub/year-calendar/route.ts` — personal homebase budget vs actual. Pulls budget from `budgets` table (monthly columns `jan…dec`), actuals from `ledger_entries` (filtered by `chart_of_accounts.account_type='expense'`, excludes 7xxx travel codes), groups by COA. Returns `budgetData/actualData` keyed by `coa → month → $`.
  - `/api/hub/business-budget/route.ts` — same shape, scoped to `sole_prop`/`business` entities.
  - `/api/hub/nomad-budget/route.ts` — same shape, scoped to 7xxx travel codes.
  - `/api/hub/drill-down/route.ts` — per-month per-coa transaction-list drill, from `ledger_entries` join.
  - **Source tables:** `budgets` (planned), `ledger_entries` (actual via journal entries), `chart_of_accounts` (category metadata), `transactions` (merchant/description), `entities` (entity-type filter).
- **Notes for a FUTURE budget-panel PR:**
  - Operations-specific budget vs actual would slot in alongside year-calendar/business-budget/nomad-budget. Pattern: read `operations_project_tasks.estimated_cost_usd` (planned) vs `operations_project_tasks.actual_cost_usd` (recorded), grouped by `coa_code`. **No journal-entry round-trip needed for Operations actuals** — they're recorded directly on the task row, distinct from how Plaid actuals flow through `ledger_entries`. This is a meaningful divergence to flag for the future PR.
  - Operations doesn't currently emit anything to `ledger_entries` (no journal entries generated from task completion). A "Operations actuals" budget panel would NOT join through journals — it'd read tasks directly. Documented here so the future PR doesn't get confused into trying to use the existing journal-based aggregations.

RECOMMENDATION FOR PR-OPS-5.3 PHASE 2 (Hub shell, Operations blocks only)

- **Reuse existing scaffolding: YES, almost entirely.**
  - `src/app/hub/page.tsx` — extend (add `operations` source + a 5th `fetch` call + mapping)
  - `src/components/shared/CalendarGrid.tsx` — **no changes needed** (data shape already supports time-windowed events)
  - `SOURCE_CONFIG` (`hub/page.tsx:48-56`) — add an `operations` entry (icon/color)
- **New /hub page needed: NO.** Existing page is the Hub.
- **New read endpoint needed: NO** for the basic wire (use existing `GET /api/operations/daily-plan/items?from=&to=`). **OPTIONAL later** for cost/category rendering (either expand the items GET task `select`, or add `/api/hub/operations-window`).
- **Calendar library: use the existing `CalendarGrid`** (no external library; rrule is already there for the routines surface).
- **Estimated scope for Phase 2:**
  - Frontend: `/hub/page.tsx` — add `operations` to SOURCE_CONFIG (≈5 lines), add a fetch + mapping in the data-load block (≈30 lines), add to the events-merge that feeds `<CalendarGrid events={…} />` (≈3 lines).
  - Optional: a small helper in `src/lib/hub/mapOperationsBlocks.ts` (≈30 lines) that converts daily-plan items → CalendarGrid events — keeps page.tsx tidy.
  - **No new API, no new component, no migration.** ~50-70 lines total in 1-2 files.
- **Open decisions for Alex:**
  1. **Color/icon for the `operations` source.** Existing palette is taken (amber, slate, pink, violet, emerald, brand-purple, cyan). Propose: `'operations'` = `🎯` indigo, or `📋` slate-700. Alex pick.
  2. **`onEventClick` behavior.** CalendarGrid accepts an `onEventClick` callback. For Operations blocks: open a side-panel like BudgetDrillDown? Link to `/workbench/operations` with anchor to the daily plan for that date? Just show a tooltip? Cheapest v1: link to `/workbench/operations` and let the user scroll to Section C (Daily Plan).
  3. **Cost/category badges on calendar entries.** Defer to a polish PR or include in 5.3? Recommend defer — the `task: { select: {…} }` expansion to surface `coa_code/estimated_cost_usd/actual_cost_usd` is a separate concept.
  4. **Window range fetched.** The other Hub fetches are year-scoped (`?year=2025`). The daily-plan items GET is from/to-scoped (defaults to today if neither given). For Hub year/month view, fetch the visible window. Use the existing month-selector state in `/hub/page.tsx`.

NO SOURCE FILES MODIFIED. Audit report at audit-reports/pr-ops-5.3-phase-1.md.
