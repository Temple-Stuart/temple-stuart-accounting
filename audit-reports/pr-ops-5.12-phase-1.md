PR-OPS-5.12 PHASE 1 AUDIT REPORT
================================

BRANCH STATUS
- main top 3: `4503584` (merge #558 PR-Ops-5.11 hub clean-slate) → `a9c2e83` (merge #557 5.11 audit) → `e175562` (merge #556 5.9 recurrence-builder audit). **PR-Ops-5.11 confirmed on main** (the underlying commit `a8257a5` is in main's history at position 5).
- current branch: `claude/pr-ops-5.12-daily-plan-list-audit`

A. CURRENT STRUCTURE

- **File:** `src/components/workbench/operations/SectionC_DailyPlan.tsx` (359 lines)
- **Toggler UI (`:180-197`):** flex row containing `← prev` (`:181-183`), `today` (`:184-186`), `next →` (`:187-189`), and a `<input type="date">` jump-to-date picker (`:190-195`) plus the static "showing all entities" caption (`:196`). The prev/today/next helpers are `prevDay(iso)` / `nextDay(iso)` / `todayIso()` defined at `:26-38`.
- **Selected-day state (`:50`):** `const [currentDate, setCurrentDate] = useState<string>(todayIso())` — single ISO-date string. The toggler buttons + date input all mutate this single piece of state.
- **fetchItems date params (`:64-84`):**
  ```ts
  await fetch(`/api/operations/daily-plan/items?from=${currentDate}&to=${currentDate}`);
  ```
  → from === to → exactly one day's items (`:69`).
- **fetchRoutines date params (`:86-101`):**
  ```ts
  await fetch('/api/operations/routines/today');
  ```
  → **no date param** — the `/today` endpoint is hardcoded to "now" in the server's clock (`:99` of route.ts: `const now = new Date()`). No way to pass a target date.
- **useEffect (`:103-113`):** routines are ONLY fetched when `currentDate === todayIso()`. Otherwise `setRoutines([])` and only items are fetched. Confirmed at `:282` (`hasRoutines = isToday && routines.length > 0`) and the "routines shown for today only" message at `:330-334`.
- **Render blocks:**
  - Routines section (`:317-326`): label `"routines"` then `routines.map((entry) => <DailyPlanRoutineRow key={entry.routine.id} entry={entry} />)` — **only renders when isToday**.
  - Items section (`:336-352`): optional `"items"` label (only shown when there's also a routines section above) then `items.map((item) => <DailyPlanItemRow key={item.id} item={item} onUpdate={fetchItems} onDelete={fetchItems} />)`.
  - Calendar blocks: nested inside `DailyPlanItemRow` (`DailyPlanItemRow.tsx:285-293`) — rendered as a flex-wrap of pill chips beneath each item, fetched via Prisma `include: { calendar_blocks: ... }` in the items endpoint (`route.ts:92-94`).
- **Scoped to ONE selected day: CONFIRMED.** Both fetches narrow to currentDate; routines are gated to today entirely; nothing renders that's outside the chosen day.

B. DATA FETCHES (windowable?)

- **`GET /api/operations/daily-plan/items`** (`src/app/api/operations/daily-plan/items/route.ts:41-116`):
  - Accepts `?from=YYYY-MM-DD&to=YYYY-MM-DD` (`:52-53`). Both parsed with the `DATE_RE = /^\d{4}-\d{2}-\d{2}$/` regex (`:57-67`, `:71-78`).
  - If `to` omitted → defaults to `from` (`:80`). If both omitted → defaults to today UTC (`:66`).
  - Validates `from <= to` (`:83-88`).
  - **NO maximum-range cap on the server.** Any `to - from` window is accepted as-is. Includes `calendar_blocks` + the linked `task` (with `coa_code`, `estimated_cost_usd`, `actual_cost_usd`) per `:92-104`. Order: `{ plan_date: 'asc' }, { display_order: 'asc' }` (`:105`). Calendar blocks inside each item are ordered by `scheduled_start: 'asc'` (`:93`).
  - → **Items + their nested calendar_blocks are fully windowable today, with no API change needed.**

- **`GET /api/operations/routines/today`** (`src/app/api/operations/routines/today/route.ts:89-191`):
  - **NOT windowable.** Takes no params. Internally calls `todayBounds(r.timezone, now)` (`:117`) and only the FIRST occurrence in (todayStart, todayEnd] is kept (`:146`). Hydrates each occurrence with completion status (`:149-156`) and computes `status: 'completed' | 'missed' | 'pending' | 'upcoming'` (`:158-170`).
  - → Cannot drive a multi-day list.

- **`GET /api/hub/operations-routines?from=&to=`** (`src/app/api/hub/operations-routines/route.ts:58-185`):
  - Accepts windowed from/to (`:68-99`). **MAX_WINDOW_DAYS = 92** (`:34`); requests larger → 400. **MAX_OCCURRENCES = 500** total across all routines (`:35`); when hit, response `truncated: true` is set (`:121-127, :158, :174`).
  - Returns thin `RoutineWindowEntry[]` (`:109-117`): `{ routine_id, name, entity_id, timezone, start_time, end_time, occurrences[] }`. **Does NOT include:** `description`, `steps`, `consecutive_completion_streak`, `consecutive_miss_streak`, `fail_threshold_minutes`, or per-occurrence completion/status.
  - → Reusable for windowed routine EXPANSION, but emits a strict subset of what `DailyPlanRoutineRow` currently consumes.

- **Routines window reuse: WHICH IS CLEANER?**
  - **(a) Reuse `/api/hub/operations-routines` as-is** — accept a thinner routine row on non-today days (no status pill, no streak, no steps drawer). Today's slot still uses `/today` (rich shape) so today doesn't regress. Clean separation. Zero API changes. **Recommend (a).**
  - **(b) Extend the hub endpoint** to include completion/streak/steps — mission creep (the Hub doesn't need streaks; bloats the hub payload).
  - **(c) New endpoint `/api/operations/routines/window`** — duplicates 90% of the hub endpoint's logic; pure overhead.

- **All three windowed-fetchable: PARTIAL.**
  - Items: yes (no API change).
  - Calendar blocks: yes (nested inside items, naturally windowed by the items fetch).
  - Routine occurrences: yes via `/api/hub/operations-routines` for the EXPANSION dimension.
  - **Gap:** the routine row's RICH FIELDS (`steps`, `description`, `streaks`, per-occurrence `status` / `completion`) are NOT available in the windowed endpoint. For non-today days the row must render a thinner version OR the client must fetch the routine details separately (1 extra fetch for the routines themselves, ~1 KB of metadata, no expansion cost). **Recommend the thinner-non-today-row approach** — non-today routine occurrences are predictive (they haven't happened yet for future days; they're history for past days). Status/streak are inherently a today-centric concept; making future days display "upcoming" for every occurrence is noise.

C. WINDOW

- **Existing caps to respect:**
  - `/api/hub/operations-routines`: MAX_WINDOW_DAYS = 92 (`route.ts:34`), MAX_OCCURRENCES = 500 (`:35`).
  - `/api/operations/daily-plan/items`: no server cap — bounded only by data volume.
- **Recommended window: N = 7 past, M = 84 future = 91-day window.** Fits under the 92-day hub cap with one day of headroom. "Past week + next quarter" — matches AuDHD-design intent (recent context, not deep history; near-term horizon, not unbounded).
- **Alternative (more past, less future): N = 14, M = 77 = 91 days.** Same total, shifts the centerpiece earlier. Recommend the 7/84 split — past-week is enough for "did I do my routines this week?" reference; the future-bias is what makes this a *plan*, not a log.
- **Respects existing caps: CONFIRMED** (91 ≤ 92).
- **Fixed vs load-more:** **fixed window**, no load-more. Reasoning:
  - The 91-day fixed window already covers the most useful planning horizon.
  - Load-more re-introduces "navigating" — the exact friction Alex wants to kill.
  - A deeper historical view belongs in a dedicated history surface, not the planning surface.
  - If users genuinely need >91 days of future, they can navigate to `/operations/routines` (which manages indefinite cadence) — but the Daily Plan stays bounded.

D. LIST STRUCTURE + DISTINCTION

- **Date-grouped headers:**
  - Group by `plan_date` (for items) and by routine-occurrence calendar-date (formatted in the routine's own timezone, mirroring the existing `formatLocalDate(iso, timezone)` idiom at `mapOperationsRoutines.ts:67-78`).
  - One sticky-ish header per day: `Wed, May 21 · today` or `Thu, May 22`.
  - Sort ascending. Past days at top (collapsible or visually de-emphasized); today next; future days following.
- **Within-day ordering (recommend):**
  1. Timed entries (routines with `start_time`, items with calendar_blocks) sorted by HH:MM ascending.
  2. Untimed entries (cadence-only routines, items without blocks) below, alphabetical or display_order.
  - Items currently have a `display_order` (per-day) — preserve it as the tiebreaker for items.
- **Routine vs task vs ad-hoc vs block — existing visual distinction:**
  - `[routine]` tag (gray text-muted) at `DailyPlanRoutineRow.tsx:58`.
  - `[task]` tag (gray text-muted) at `DailyPlanItemRow.tsx:241`.
  - **GAP — ad-hoc items have NO tag** (`DailyPlanItemRow.tsx:247-249`): the `else` branch just renders the bare ad_hoc_title without a `[ad-hoc]` label. Routine and task rows have a leading bracket-tag; ad-hoc rows visually float without one. **Recommend Phase 2 add `[ad-hoc]` tag to match** — same gray text-muted treatment, consistent surface.
  - Calendar blocks: pill chips nested inside their parent item, visually distinct via `border-l-2 border-border-light` indent (`DailyPlanItemRow.tsx:286`). No standalone block rows — they're always children of items.
  - Status pills: routines have status-colored pills (green/red/gray/purple per status, `DailyPlanRoutineRow.tsx:28-42`). Tasks have a neutral border pill showing `status` text (`DailyPlanItemRow.tsx:243-245`). Already consistent enough to distinguish at a glance.
  - **Recommend extending the existing tag idiom — do NOT introduce new colors/shapes.** A reader who already knows `[routine]` vs `[task]` will immediately read `[ad-hoc]` correctly. Consistency > novelty.
- **Today emphasis:**
  - Today's date header in a stronger color (e.g. `text-brand-purple` or `text-text-primary font-bold` versus `text-text-muted` for other days).
  - Optional: thin colored left-border or background tint on the today section (`bg-purple-50/30` is already in use for "upcoming" routines at `:38` — could reuse for today's date-block background, but be careful not to clash with status pills).
  - Optional: auto-scroll today's section into view on mount (one-line `scrollIntoView` on a today-ref). Recommend YES — the AuDHD "less navigating, more seeing" intent benefits from the eye landing on now without scroll-hunting.

E. PERFORMANCE

- **Typical user, 91-day window, rough math:**
  - Routine occurrences: assume 4-8 active daily-cadence routines × 91 days = **364–728 routine rows.** Will hit MAX_OCCURRENCES=500 if user has 6+ daily routines — endpoint returns `truncated: true`. Surface a "showing first 500" warning row when truncated (no silent drop — North Star).
  - Items: typical Alex-style usage is ~1-5 items/day. 91 days × 3 items avg = **~270 item rows.** Calendar blocks nested, not standalone rows.
  - **Total: ~600-1000 rendered rows in worst case, ~400 in typical case.**
- **Virtualization needed?**
  - 400-1000 simple rows is a known-comfortable React render budget (no animation, no per-row subscriptions, plain text + a few spans + maybe a status pill). The existing `/operations/routines` page already renders dozens of expandable routine rows without virtualization and is responsive.
  - The 500-occurrence cap on the server caps the worst-case routine count. Items have no cap but are naturally bounded by the user actually creating them.
  - **Recommend: SHIP WITHOUT VIRTUALIZATION.** Add it only if a real user reports lag with their actual row count. Premature virtualization adds complexity (windowing libs, ref management, accessibility regressions) that the rest of the codebase doesn't have.
- Long-term: if Alex consistently runs ~10 daily routines, MAX_OCCURRENCES becomes the bottleneck before render-perf does. The truncation indicator already exists; pagination/load-more is the future move, not virtualization.

F. RECOMMENDATION

- **Approach (Phase 2):**
  1. **Remove the toggler entirely** (`SectionC_DailyPlan.tsx:180-197`) and the `currentDate` state (`:50`), `prevDay`/`nextDay`/`todayIso` helpers reduced to just `todayIso()` (still needed for the today-marker).
  2. **Fetch items over the 91-day window** via the existing `/api/operations/daily-plan/items?from=YYYY-MM-DD&to=YYYY-MM-DD` — no API change.
  3. **Fetch routines over the window** via the existing `/api/hub/operations-routines?from=&to=` — no API change. Handle `truncated: true` by rendering a warning row.
  4. **Keep `/api/operations/routines/today`** as the source for TODAY's routine row (so today preserves the rich status / streak / steps UX). Today's routines override / replace the hub-endpoint occurrences for the today date-cell (key by routine_id + date).
  5. **Render grouped-by-date** with one header per day. Sort ascending. Today visually emphasized (color + auto-scroll into view).
  6. **Within each day:** timed entries sorted by HH:MM, then untimed entries.
  7. **Distinguishable types via the existing tag idiom:** `[routine]` (existing), `[task]` (existing), `[ad-hoc]` (NEW — extend `DailyPlanItemRow` to add this tag in its else-branch at `:247-249`).
  8. **The create-form's plan_date** is currently `currentDate` (`:133`). With no current-date concept, default to `todayIso()` and let the user override via the form's existing date pattern (or add a one-line date input to the create form).

- **Window: N = 7 past, M = 84 future (= 91 days).**

- **Endpoints reused:**
  - `/api/operations/daily-plan/items?from=&to=` (no change)
  - `/api/hub/operations-routines?from=&to=` (no change — same one the Hub uses, code-only re-consumer)
  - `/api/operations/routines/today` (no change — kept for today's rich row)

- **Schema change: NO.** Confirmed — both windowable endpoints already exist and ship; no DB or Prisma migration.

- **Scope + files (estimated for Phase 2):**
  1. `src/components/workbench/operations/SectionC_DailyPlan.tsx` (modify, heavy) — remove toggler + currentDate state + isToday gating; add windowed fetches (items + hub-routines); add date-grouping logic; add today-emphasis + scroll-into-view; reconcile today's `/today` routines with the hub-endpoint occurrences. ~120 lines changed / ~80 net added.
  2. `src/components/workbench/operations/dailyplan/DailyPlanItemRow.tsx` (modify, tiny) — add `[ad-hoc]` tag in the else-branch at `:247-249`. ~3 lines.
  3. `src/components/workbench/operations/dailyplan/DailyPlanRoutineRow.tsx` (modify, modest) — accept an optional "thin" routine entry (from hub endpoint) that lacks status/streak/steps for non-today days. Render gracefully when those fields are absent. ~30 lines.
  4. `src/lib/hub/mapOperationsRoutines.ts` (NO CHANGE — Daily Plan can consume the raw API response shape directly without going through the CalendarEvent mapper, since it's not feeding CalendarGrid).
  - **Total: 3 files modified, ~115 net lines. No new component, no new API, no schema, no migration.**

- **Open decisions for Alex:**
  1. **Window split: 7 past / 84 future (recommended) or 14 past / 77 future or 0 past / 91 future ("only forward")?** Recommend 7/84. If "look behind" feels noisy, 0/91 is the most minimal — but then "did I miss yesterday's routine?" requires another surface.
  2. **Past-day visual treatment:** dim past days (lower contrast, e.g. `text-text-faint`) or render them full-strength? **Recommend dim** — past is reference, not action; the eye should be drawn to today and forward.
  3. **`[ad-hoc]` tag wording:** `[ad-hoc]` (recommended — matches existing terminology in code + the create form's `ad_hoc_title` field) vs `[item]` (more user-friendly but conflates with the items section label). **Recommend `[ad-hoc]`.**
  4. **Today auto-scroll on mount:** YES (recommended — AuDHD intent) or NO (let user scroll). **Recommend YES** with a top-anchored `scrollIntoView({ behavior: 'auto', block: 'start' })` on a `today-ref` div.
  5. **Truncation warning:** when `hub-routines` returns `truncated: true`, render an inline warning row ("showing first 500 routine occurrences — narrow your active routines for full coverage") or silently truncate? **Recommend visible warning** — matches PR-Ops-5.6's existing North Star "no silent drop" discipline.
  6. **What happens to the "+ add item" create-form's plan_date when the toggler is gone?** Recommend: form defaults to `todayIso()` (most-common case) and shows a small date input the user can adjust. Same field already exists conceptually (POST endpoint requires `plan_date`); the form just needs an explicit date picker now that `currentDate` doesn't supply one. ~5 extra lines in the create form.
  7. **Empty days inside the window:** render the date header with a muted "—" or skip the header entirely? **Recommend skip empty days** — date headers are an orienting device, not a calendar grid. An empty Tuesday between two busy days is not orienting; skipping it keeps the list dense.
  8. **Reconciling today's two routine sources:** `/today` returns rich entries (1 per active routine that has an occurrence today); `/api/hub/operations-routines` also returns today's occurrences. Recommend: use `/today` as the source of truth for the today date-cell, and filter today's occurrences OUT of the hub response on the client (`occurrences.filter(iso => formatDateInZone(iso, tz) !== todayIso())`). Avoids duplication; preserves the rich today UX.

NO SOURCE FILES MODIFIED. Audit report at audit-reports/pr-ops-5.12-phase-1.md.
