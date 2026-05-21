PR-OPS-5.5 PHASE 1 AUDIT REPORT
================================

BRANCH STATUS
- main top 3: `f2e5745` (merge #545 PR-Ops-5.4) → `c81358a` (merge #544 5.4 audit) → `e8db77d` (5.4 commit). 5.4 confirmed on main.
- current branch: `claude/pr-ops-5.5-info-card-audit`

A. CURRENT HUB CLICK HANDLING

- **`CalendarEvent` interface** (`CalendarGrid.tsx:10-30`):
  ```ts
  export interface CalendarEvent {
    id: string;
    source: string;
    title: string;
    icon?: string | null;
    startDate: string;        // YYYY-MM-DD
    endDate?: string | null;
    startTime?: string | null; // HH:MM (24h)
    endTime?: string | null;
    isRecurring?: boolean;
    location?: string | null;
    budgetAmount?: number;
    details?: string[];
    href?: string;             // PR-Ops-5.3 — Next router target
  }
  ```
- **`handleTileClick` dispatch (`CalendarGrid.tsx:158-164`):**
  ```ts
  const handleTileClick = (event, nativeEvent) => {
    if (event.href) { router.push(event.href); return; }
    onEventClick?.(event, nativeEvent);
  };
  ```
  Per-event `href` takes precedence over the callback. Wired into both all-day tile (`:344`) and time-based tile (`:417`) onClick handlers.
- **Inline panel/card support in CalendarGrid: NO.** No `setSelected`/panel state; the click dispatch only navigates or calls back. Panel ownership belongs in the parent.

**⚠ CRITICAL FINDING — DEAD LINK SHIPPED IN PR-Ops-5.3:** `mapOperationsBlocks.ts:23` sets `OPERATIONS_HREF = '/workbench/operations'`. **That route does not exist on disk.** Searched `src/app/workbench/` — does not exist (only `src/app/api/workbench/` exists, an API directory). No route group (no `(*)` directories). No middleware rewrite or redirect referencing `workbench`. The actual operations surface lives at `/operations` (`src/app/operations/layout.tsx:8-15`) with sub-routes `/operations/projects`, `/operations/routines`, `/operations/content`, `/operations/issues`, `/operations/audit-log`. **Every Operations block on the Hub today routes to a 404.** This is a real bug from 5.3 that PR-Ops-5.5 should fix as part of replacing href-navigation with the info card.

B. REUSABLE PANEL SHELLS

- **`BudgetDrillDown.tsx` (`src/components/hub/`)** — 192 lines. Right-side slide-in (`:99` `fixed inset-0 z-50 flex justify-end`, `:101` `bg-black/30` backdrop, `:104-107` panel `max-w-lg` with `slide-in-from-right` animation). Has click-outside-to-close (`:69-80`), Escape-to-close (`:83-87`), and brand-purple header (`:111`). **Open/close pattern:** props-driven (`isOpen, onClose`); fetches `/api/hub/drill-down` on `isOpen→true` (`:43-67`). **NOT reusable as-is** — props are hard-coded to budget drill-down: `coaCodes, month, year, categoryName, cellAmount, entityType`. The structural pattern (slide-in shell with backdrop, escape, click-outside) is the **convention to mirror** for a new info card.
- **`ScriptDrawer.tsx` (`src/components/workbench/operations/content/`)** — operations-scoped scene.script editor (PR-Ops-4.9.3f). Right-side slide-in but **no backdrop**, **no click-outside or Escape close** (lock-locked: only Save/Cancel close). Scoped to scene editing; not a generic shell.
- **Other candidates:** zero other side-panel/drawer components in `src/components/hub/` or `src/components/shared/`. `src/components/ui/Card.tsx` is a generic block container (not a panel). `src/components/ops/*Card.tsx` files are dashboard sub-cards, not slide-in panels.
- **Recommendation:** **Build a new lightweight card component**, mirroring BudgetDrillDown's structural pattern (slide-in shell + backdrop + click-outside + escape). Don't extract a generic shell yet — premature abstraction with only 1–2 callers in flight.

C. DATA AVAILABLE FOR THE CARD

- **`mapOperationsBlocks.ts` currently emits** (per `:51-72`): `{ id (= block.id), source, title, startDate, endDate, startTime, endTime, budgetAmount, details[0] = "<coa> · $<cost>", href }`. **Drops** `item.notes, item.ad_hoc_description, item.plan_date, task.status, block.status, block.notes, block.actual_start/end, task.id, item.id`.
- **`/api/operations/daily-plan/items` GET response (per `items/route.ts:90-105`)** is much richer:
  ```ts
  items: [{
    id, user_id, entity_id, plan_date, task_id, ad_hoc_title,
    ad_hoc_description, display_order, notes, created_at, updated_at,
    created_by,
    calendar_blocks: [{ id, scheduled_start, scheduled_end,
      actual_start, actual_end, status, notes }, ...],
    task: { id, title, status, coa_code, estimated_cost_usd,
      actual_cost_usd } | null
  }]
  ```
- **Gap (needs new fetch?): NO.** The Hub already holds `operationsItems: DailyPlanItem[]` state (PR-Ops-5.3, `hub/page.tsx`). All the data the card needs is already in memory; the card just needs a way to look up the parent item+block by block.id. **Zero new API calls.**
- **Cleanest data plumbing:** keep `CalendarEvent` lean; on click, the Hub uses the event's `id` (= block.id) to find the matching `item` + `block` in `operationsItems`, and passes the rich data into the card directly. No need to add a `meta` field on CalendarEvent or expand mapOperationsBlocks.

D. DIMENSION LINK DESTINATIONS

| Dimension | Route | Status | Notes |
|---|---|---|---|
| Project / task | `/operations/projects` | **LIVE** (`src/app/operations/projects/page.tsx`) | Lists all projects + nested tasks. **No `[id]` deep-link route** — clicking lands on the project list; user manually finds the task. Future PR could add `?task=<id>` filter or `#task-<id>` scroll-and-highlight. |
| Daily Plan | `/operations` | **LIVE** (`src/app/operations/page.tsx`) | The Daily Plan page itself. No date-query-param filter; defaults to today. |
| Category (coa_code) | `/chart-of-accounts` | **LIVE shell** (`src/app/chart-of-accounts/page.tsx`) | Filter-by-code support not verified. Currently the COA management page; clicking would land there but not auto-focus the code. |
| Bookkeeping (transactions for category/date) | `/ledger` | **LIVE shell** (`src/app/ledger/page.tsx`) | Filter-by-coa+date support not verified. |
| Narrative / notes | (inline) | **N/A** | `task.description`, `task.notes`, `block.notes`, `item.notes` — all surface-able inline on the card; no separate "narrative" surface needed. |
| Routine (if task came from a routine) | `/operations/routines` | **LIVE** (`src/app/operations/routines/page.tsx`) | Not currently linked from a block — but if `item.task` was generated from a routine, this would be the link target. Not in scope for v1. |

**Live-now vs placeholder for v1:**
- **LIVE (build now):** `Open in Projects` → `/operations/projects`, `Open Daily Plan` → `/operations`. Two clean dimension links.
- **DEFERRED (don't add yet):** category drill-in, bookkeeping drill-in, deep-link by task id. The destinations exist as pages but filter/highlight support isn't there. Adding them as disabled/placeholder buttons adds noise without value.

E. RECOMMENDATION

- **Shell decision:** **Build a new lightweight card component** `src/components/hub/HubEventCard.tsx`. Mirror BudgetDrillDown's structural pattern (slide-in from right, bg-black/30 backdrop, click-outside-close, Escape-close, max-w-lg, brand-purple header) — established Hub convention. No generic-shell extraction yet (premature with only 1–2 callers).
- **Open-in-place vs navigate:** **open-in-place card** replaces the current navigate-away. Confirms the locked decision in the prompt. The current `href` navigation must be REMOVED for Operations events (and also fixed because it's a dead link — see Section A).
- **v1 content (no new fetch):**
  - **Header:** event title + close (×) button
  - **Time range:** `formatTime12h(scheduled_start) – formatTime12h(scheduled_end)` (local), with the date
  - **Status:** the calendar_block's `status` (scheduled / in_progress / completed / missed / cancelled) as a small pill — uses the same enum the workbench shows
  - **Actual vs scheduled:** if `actual_start`/`actual_end` populated, show them below scheduled (small muted line, "actually: …") — useful, no extra fetch
  - **Source:** "Operations" label (matches the SOURCE_CONFIG icon/color)
  - **Task title + status pill:** from `item.task`
  - **Category:** `coa_code` (no link in v1 — placeholder text only)
  - **Cost:** "Planned: $X · Actual: $Y" from task fields; show only the side(s) populated
  - **Notes/description:** `block.notes` if present (high-signal — block-specific), else `item.notes` if present, else nothing. Skip the deep task.description for v1 (not in the items GET response — would require a new fetch).
  - **Dimension links (v1, footer):** `Open in Projects` → `/operations/projects`, `Open Daily Plan` → `/operations`. That's it.
- **Mapping expansion needed (notes/desc/status)?** **NO.** The Hub already fetches the full `DailyPlanItem[]` and stores it as `operationsItems` state (PR-Ops-5.3). The card just looks up by `block.id` and renders. **Zero new fetches, zero mapOperationsBlocks expansion.**
- **CalendarEvent interface changes:** **NONE** for v1. Keep the interface lean; the Hub uses event.id to find the rich data locally.
- **`href` field strategy:** `mapOperationsBlocks.ts` should **stop setting href** on Operations events (fixes the dead link). With href absent, CalendarGrid's `handleTileClick` falls through to `onEventClick`. The Hub provides an `onEventClick` handler that opens the card for `event.source === 'operations'` events. The `href` field on CalendarEvent stays in place for future per-event link targets that aren't card-worthy. **Backward compat preserved** for the trips page's existing onEventClick usage (still routes through the same fall-through path).
- **Files to touch (Phase 2 estimate — 3 files):**
  1. `src/lib/hub/mapOperationsBlocks.ts` — remove the dead `href: '/workbench/operations'` line (or delete the OPERATIONS_HREF constant entirely). ~3 lines removed.
  2. `src/components/hub/HubEventCard.tsx` *(new)* — ~140 lines. Right-side slide-in shell + content sections + 2 dimension links.
  3. `src/app/hub/page.tsx` — add `cardBlock` state, pass `onEventClick` to `<CalendarGrid>` that opens the card for Operations events, render `<HubEventCard>` at the section root. ~30 lines.
- **Total scope:** ~170 lines across 1 new + 2 modified. No API, no migration, no schema, no shared-CalendarGrid changes (the click dispatcher already supports the onEventClick fall-through path).
- **Open decisions for Alex:**
  1. **Confirm the dead `/workbench/operations` href is the bug Alex hit.** Phase 1 confirms the route doesn't exist; if clicking blocks on prod is producing a 404, this PR is the fix path. If something else is happening (route rewrite at the edge?), need to verify before removing the href.
  2. **v1 dimension links: just LIVE (Projects + Daily Plan), or also disabled-placeholder COA/Ledger?** Recommend LIVE only. Placeholders create noise.
  3. **Card styling: mirror BudgetDrillDown** (backdrop + click-outside + Escape close) **or lighter like ScriptDrawer** (no backdrop, deliberate-close only)? Recommend BudgetDrillDown style — it's already the Hub convention; using it makes the card feel like a sibling of the existing drill-down.
  4. **Should the card show `block.notes` AND `item.notes`** (separate sections) or only the most-specific? Recommend showing both when present — labeled "block notes" and "item notes" so the user knows the scope.
  5. **Multi-block items:** a single daily_plan_item can have multiple blocks (one per time window). The card is per-block (block.id is the click target). Should it also list sibling blocks for context? Recommend NO for v1 — the calendar itself already shows them all spatially.

NO SOURCE FILES MODIFIED. Audit report at audit-reports/pr-ops-5.5-phase-1.md.
