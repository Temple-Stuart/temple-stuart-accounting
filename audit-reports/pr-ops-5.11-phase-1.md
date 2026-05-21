PR-OPS-5.11 PHASE 1 AUDIT REPORT
================================

BRANCH STATUS
- main top 3: `debc5ae` (merge #554 PR-Ops-5.8 hub-routine-intent-window) → `1fd7b5d` (merge #553 5.8 hub-time audit) → `89871bf` (merge #552 5.8 editable-routines audit). **PR-Ops-5.8 confirmed on main.**
- current branch: `claude/pr-ops-5.11-legacy-hub-sources-audit`

A. HUB SOURCES

- **`SOURCE_CONFIG` (`src/app/hub/page.tsx:51-66`) — full list of 9 entries:**

  | Source key | Icon | Color | Added by |
  |---|---|---|---|
  | `home` | 🏠 | amber | pre-Operations (legacy) |
  | `auto` | 🚗 | slate | pre-Operations (legacy) |
  | `shopping` | 🛒 | pink | pre-Operations (legacy) |
  | `personal` | 👤 | violet | pre-Operations (legacy) |
  | `health` | 💪 | emerald | pre-Operations (legacy) |
  | `growth` | 📚 | brand-purple | pre-Operations (legacy) |
  | `trip` | ✈️ | cyan | pre-Operations (legacy, ties to Travel) |
  | `operations` | 🎯 | indigo | **NEW** — PR-Ops-5.3 |
  | `routines` | 🔁 | teal | **NEW** — PR-Ops-5.6 |

- **Fetch wiring (`hub/page.tsx:182-309`):**

  | Source(s) | Endpoint | Table | Loader |
  |---|---|---|---|
  | home/auto/shopping/personal/health/growth/trip | `/api/calendar?year=&month=` | `calendar_events` | `loadCalendar()` (`:182`) |
  | operations | `/api/operations/daily-plan/items?from=&to=` | `operations_daily_plan_items` + nested `operations_calendar_blocks` | `loadOperationsBlocks()` (`:200`) |
  | routines | `/api/hub/operations-routines?from=&to=` | `operations_routines` (expanded via rrule) | `loadOperationsRoutines()` (`:232`) |
  | (budget panels — not calendar tiles) | `/api/hub/trips` / `/api/hub/year-calendar` / `/api/hub/nomad-budget` / `/api/hub/business-budget` | `trips` / `ledger_entries` + `budgets` / etc. | `loadCommittedTrips()` / `loadYearCalendar()` / `loadNomadBudget()` / `loadBusinessBudget()` |

- **New vs older sources:** the seven legacy sources (`home, auto, shopping, personal, health, growth, trip`) all feed from one endpoint — `/api/calendar` (`src/app/api/calendar/route.ts:1-90`), which raw-SQL-queries the `calendar_events` table filtered by `source` column values. The two new sources (`operations`, `routines`) feed from the post-5.3/5.6 endpoints and tables. Different tables, different read paths.

B. OLD BARS ORIGIN

- **The AT&T / Food / Water / Coffee / Meals all-day bars** are produced by the legacy `SOURCE_CONFIG` entries (home, personal, shopping, etc.) — exact source-column-value depends on which legacy surface wrote the row.
- **Endpoint:** `/api/calendar` (`src/app/api/calendar/route.ts:21-50`). **Table:** `calendar_events`. The route uses `prisma.$queryRaw` to `SELECT * FROM calendar_events WHERE user_id = $1 AND start_date BETWEEN ...`. Returns rows as `events: any[]`.
- **Fetch in hub/page.tsx:** `loadCalendar()` at `:182-194`:
  ```ts
  const res = await fetch(`/api/calendar?year=${selectedYear}&month=${selectedMonth + 1}`);
  if (res.ok) {
    const data = await res.json();
    setEvents(data.events || []);
    setSummary(data.summary || null);
  }
  ```
  These events are then mapped into `gridEvents` (`:340-355`) — the first map block (`events.map(e => ({ id, source, title, ... }))`) — and concatenated with `operationsEvents` + `routineEvents` before being passed to `<CalendarGrid>`.

C. SOURCE TABS — REMOVED FROM NAV, BUT ROUTES + WRITES STILL LIVE

**CRITICAL DIVERGENCE FROM PROMPT PREMISE:** the prompt says "old tabs which have been REMOVED from the app." That's **partially true (removed from primary nav)** but **not fully true (routes still exist on disk and APIs still write to `calendar_events`)**.

- **Primary nav** (`AppLayout.tsx:78-83`) — only these 5 top-level tabs are linked from the menu:
  - Bookkeeping (`/dashboard`)
  - Trading (`/trading`)
  - Travel (`/budgets/trips`)
  - Compliance (`/compliance`)
  - Operations (`/operations`)
  
  **`home`, `auto`, `shopping`, `personal`, `health`, `growth`, `income`, `agenda` are NOT in the primary nav.**

- **But the ROUTES still exist on disk** (`find src/app -maxdepth 2 -type d`):
  - `src/app/home/`, `src/app/auto/`, `src/app/shopping/`, `src/app/personal/`, `src/app/health/`, `src/app/growth/`, `src/app/income/`, `src/app/agenda/`, `src/app/trips/` all present.
  - They're listed only as `PERSONAL_PREFIXES` / `TRAVEL_PREFIXES` (`AppLayout.tsx:62-70`) — used for route-prefix matching, not menu links. Accessible by typing the URL directly.

- **And the APIs still WRITE to `calendar_events`** — `grep -rn calendar_events src/` shows active INSERT/DELETE in:
  - `src/app/api/home/[id]/route.ts:24,48,82` — INSERTs with `source='home'`
  - `src/app/api/auto/[id]/route.ts:22,33,82,142`
  - `src/app/api/shopping/[id]/route.ts:22,33,82,142` + `shopping/commit/route.ts:83`
  - `src/app/api/health/[id]/route.ts:22,33,82,142`
  - `src/app/api/growth/[id]/route.ts:22,33,82,142`
  - `src/app/api/trips/[id]/commit/route.ts:181,186,281` + `trips/[id]/vendor-commit/route.ts:214-225,297-300`
  - `src/app/api/agenda/[id]/route.ts:84,184` — INSERTs with `source='agenda'` (and `agenda` is NOT in SOURCE_CONFIG, so its events render with the gray fallback — a separate small issue)
  - Plus the `/api/trips/[id]/route.ts:137` DELETE on cleanup.

- **Per-source live-tab status:**

  | Source | Primary nav? | Route exists | API writes to calendar_events | Status |
  |---|---|---|---|---|
  | home | NO | YES (`src/app/home/`) | YES | **dead-from-nav, live on disk** |
  | auto | NO | YES | YES | dead-from-nav, live on disk |
  | shopping | NO | YES | YES | dead-from-nav, live on disk |
  | personal | NO | YES | (none found in grep — may not write calendar_events directly) | dead-from-nav, no writes observed |
  | health | NO | YES | YES | dead-from-nav, live on disk |
  | growth | NO | YES | YES | dead-from-nav, live on disk |
  | trip | NO* | YES | YES (via `/api/trips/[id]/commit` and `/vendor-commit`) | **STILL LIVE** — `Travel` nav tab points at `/budgets/trips` which writes calendar_events with `source='trip'` |
  | agenda | NO | YES | YES | dead-from-nav, live on disk, NOT in SOURCE_CONFIG (renders gray-fallback) |
  | operations | n/a (workbench surface) | YES | NO (uses its own tables: `operations_calendar_blocks` etc.) | new — keep |
  | routines | n/a (workbench surface) | YES | NO (uses its own tables: `operations_routines`) | new — keep |

  *`trip` is tricky: `Travel` IS in the primary nav (`/budgets/trips`), which writes `calendar_events` rows with `source='trip'`. So `trip` events on the Hub aren't "orphaned legacy" — they reflect live Travel commitments. Removing the `trip` source from the Hub would hide actively-created Travel data.

- **Bottom line:** the AT&T / Food / Meals bars are **REAL DATA** written by routes that still exist and still work. They look "orphaned" to Alex because the tabs are gone from the primary nav, but the surfaces still respond if a URL is typed and the APIs still mutate `calendar_events`. **No data is actually orphaned in the schema sense.**

D. CALENDAR_EVENTS CONSUMERS — what reads it, what writes it

- **READERS** (only one):
  - `src/app/api/calendar/route.ts:32-46` — the GET endpoint that Hub's `loadCalendar()` calls. **This is the ONLY read consumer in the entire codebase.** Grep confirmed: `grep -rln "calendar_events"` returns only writer-side INSERT/DELETE code and the single read in `/api/calendar`. `grep -rln "/api/calendar"` returns only `hub/page.tsx` as a consumer.

- **WRITERS** (many, per Section C grep results): `home/auto/shopping/health/growth/agenda/trips/shopping-commit/trips-commit/trips-vendor-commit/home-init` — all INSERT or DELETE rows scoped by `source = <module>`.

- **Does removing the Hub's calendar-events render break any financial feature? NO.**
  - The 4 budget panels (year-calendar, business-budget, nomad-budget, trips) all query `ledger_entries` + `budgets` + `chart_of_accounts` per the PR-Ops-5.3 audit. **Independent of `calendar_events`.**
  - The HubEventCard (PR-Ops-5.5) only handles `source === 'operations'` events. Doesn't interact with calendar_events sources.
  - No journal-entry / ledger / tax flow joins through `calendar_events` (verified by absence of references in `src/app/api/ledger`, `src/app/api/transactions`, etc.).
  - **Removing the legacy sources from the Hub render → zero downstream impact on financial features.**

E. CLEAN-SLATE APPROACH — code-only, data untouched

**CODE APPROACH (recommended, no data touched):**

Remove from `src/app/hub/page.tsx`:
1. **`loadCalendar()` function** (`:182-194`) and the `events` + `summary` state it sets (`:91-92`).
2. The `useEffect` line that calls `loadCalendar()` (`:180` — currently `useEffect(() => { loadCalendar(); loadOperationsBlocks(); loadOperationsRoutines(); }, [selectedYear, selectedMonth]);` — drop the `loadCalendar()` call).
3. **Legacy entries from `SOURCE_CONFIG`** (`:51-58`): `home, auto, shopping, personal, health, growth` (7 entries including `trip` — but see decision question below on `trip`). Keep `operations` + `routines`.
4. **The `events.map(e => ({...}))` block** in the `gridEvents` `useMemo` (`:340-355`) — remove, so `gridEvents` is only `[...operationsEvents, ...routineEvents]`.

Result: Hub renders ONLY `operations` + `routines` (and possibly `trip` if kept). `calendar_events` rows remain in the DB, untouched. The /home, /auto, /shopping, etc. routes still respond — anyone who navigates to them by URL can still create/edit entries, the rows still land in `calendar_events`, but the Hub stops surfacing them. **Fully reversible by re-adding the source entries and the fetch.**

- **Achieves "Hub shows only projects + routines going forward": YES** (with the `trip` decision as a caveat).
- **Data deletion needed: NO.** Per the constitutional rule, do NOT propose raw SQL on user data; this clean-slate is achievable purely in the rendering layer.
- **Reversibility:** trivial — re-add the SOURCE_CONFIG entries and re-add the fetch in a follow-up PR if needed.

**DATA APPROACH (NOT RECOMMENDED, FLAGGED PER CONSTITUTION):**

Deleting orphaned `calendar_events` rows is NOT proposed here. Even if Alex eventually wants to clear them, it would need:
- A product mechanism (e.g., a "wipe my legacy home/shopping/etc. entries" admin button that calls the existing per-module DELETE endpoints — `DELETE /api/home/[id]`, etc.).
- NOT raw SQL.
- Explicit Alex approval per the constitutional rule.

I'm flagging this as a SEPARATE decision Alex should make on its own terms. **This audit does not include a data-deletion recommendation.**

**OPEN QUESTIONS FOR ALEX:**

1. **The `trip` source is genuinely live** — the `Travel` primary-nav tab (`/budgets/trips`) actively writes `source='trip'` calendar_events rows via `/api/trips/[id]/commit` and `/api/trips/[id]/vendor-commit`. **Hide `trip` from the Hub too, or keep it?** Recommend **keep** — Travel is a live first-class surface (in primary nav), and its commits represent real future commitments that belong on a "command center" calendar.
2. **The 6 dead-from-nav sources (`home, auto, shopping, personal, health, growth`):** confirm all should be removed from the Hub. The audit shows none have a primary-nav tab; the routes are technically accessible by URL but not advertised. Recommend **remove all 6 from Hub**.
3. **The `agenda` source** is written by `/api/agenda/[id]` but is NOT currently in SOURCE_CONFIG — it renders with the gray-fallback today. Should this PR also: (a) explicitly hide it (add no-op or filter), or (b) leave it as-is (the gray fallback continues; one more dead-from-nav source quietly bleeding through)? Recommend **filter it out** as part of the same cleanup, since the same logic applies.
4. **Decision on whether to also REMOVE the legacy `/home, /auto, /shopping, /personal, /health, /growth, /agenda` routes from disk** is a much bigger separate concern (delete code, may have other dependencies, may break direct-URL access for users who bookmarked them). **Recommend NOT bundling.** Hub-render cleanup achieves the visible clean-slate; the deeper code deprecation is its own sequenced effort.
5. **The /api/calendar endpoint itself** has no other consumer (only Hub). After Hub stops calling it, the endpoint is dead code. **Remove it too in the same PR, or leave it?** Recommend **leave for this PR** — dead-but-harmless. Removing it is a one-line file delete in a follow-up cleanup PR; bundling here adds blast radius without much benefit.
6. **What about the `summary` totals** the old `loadCalendar()` was computing (homeTotal, autoTotal, etc., used somewhere in the Hub render)? Need to confirm in Phase 2 that nothing in the Hub JSX references `summary.homeTotal` etc. (if anything does, removing the fetch will need a small Hub-render cleanup too). Quick grep in Phase 2 will tell.

**SCOPE + FILES for Phase 2 (single file, ~30 lines net removed):**
- `src/app/hub/page.tsx` — remove `loadCalendar()`, the `events`/`summary` state, the SOURCE_CONFIG legacy entries (6 or 7 depending on `trip` decision), the `events.map(...)` block in `gridEvents`, the `useEffect` call to `loadCalendar()`. Optionally also remove the `CalendarEvent` / `CalendarSummary` interfaces at `:19-41` if no longer referenced. Quick grep to clean up any orphan `summary.X` references in the JSX.

NO SOURCE FILES MODIFIED. Audit report at audit-reports/pr-ops-5.11-phase-1.md.
