# 72-Hour Build Retrospective (READ-ONLY)

**Mandate:** Truth-first, read-only. Facts from `git log origin/main` + `audit-reports/`, not
memory. Every number is from git; every claim cites a hash or file:line.

**Window:** `2026-06-14 11:14:42 -0700` (#873, `a1500669`) → `2026-06-16 23:44:21 -0700` (#985,
`f6690dd7`) — ~60.5 hours inside the 72h `--since` window.

**Scope honesty:** the six arcs the brief names (calendar/money/timezone/fetch/hotel/budget) are
the **dominant recent thread (≈ Jun 15–16)**, but the 72h window also contains a large earlier
body (Jun 14): Duffel flight payments, the mobile app shell, travel wiring, and a docs/reality
pass. This retro reports the **full** window's numbers and arcs, then goes deep on the six named.

---

## (b) BY THE NUMBERS (all from git)

| Metric | Value | Source |
|---|---|---|
| Total commits in window | **227** | `git log origin/main --since="72 hours ago" --oneline \| wc -l` |
| Merge commits (PRs landed) | **113** | `--merges` |
| Non-merge work commits | **114** | `--no-merges` |
| Lines added / removed (non-merge) | **+12,196 / −1,726** | `--numstat` aggregate |
| File-changes (non-unique) | 183 | `--numstat` |
| Unique files touched | **83** | `--name-only \| sort -u` |
| Audit reports created/modified | **34** | `audit-reports/` in window |
| Migration SQL files added | **3** (+1 doc'd separately) | `prisma/migrations-manual/` |
| Net-new non-audit files | **18** | `--diff-filter=A` |

**Cadence:** the recurring shape is **audit → PR**: 34 read-only audits preceded the builds, each
merged as its own PR before the implementing PR (e.g. `f397e3f1` audit → `870a4c8c` fix →
`389cca68` merge). Roughly half the 113 merges are audit PRs.

---

## (a) TIMELINE — merged PRs grouped by arc (one line each)

### Arc 1 — Calendar truth fixes (date drift → duration → phantom → schema)
- `d17e0937` (#954) — kill **−1-day display drift** in the budget ledger (`fmtDate` UTC-midnight localization).
- `b6ee7272` — audit: datetime/timezone data-flow map (the fact base).
- `113ead9e` (#952) **[MIGRATION]** — capture Duffel flight **`duration_minutes`** into `trip_itinerary` + `calendar_events` (nullable).
- `f0a9728d` (#955) — send `durationMinutes` from the in-trip FlightPicker commit (TripPlannerAI deliberately untouched — no fabricated duration).
- `fd104ba1` (#956) — render flight blocks by **depart + duration** (kills the **34h** naive cross-zone span); null → a visible flag marker, never start→end.
- `9ece8652` (#925) **[MIGRATION]** — write flight depart/arrive into `start_time`/`end_time` → flights render wheels-up→wheels-down.
- `f0275b47` (#924) **[MIGRATION]** — add nullable `start_time`/`end_time` to `calendar_events`.
- `00eabe8a` (#950) — render valid times incl. **00:00 midnight** (distinguish no-time from midnight).
- `676b4bd3` (#958) — month view indexes flights by **derived-end** (start+duration) → kills the **Jul 2 phantom**.

### Arc 2 — Money convention
- `a0cdffe1` (#959) **[NEW FILE]** — shared **`lib/money.ts`** formatter + color: expenses red/negative, P&L signed green/red (direction from caller, never guessed).

### Arc 3 — Timezone system (capture → store → convert → render → live toggle)
- `629c24b0` (#960) — audit: home-base anchor + live toggle model.
- `864f36b5` (#961) — audit tz-0a: verify Duffel airport IANA `time_zone` availability.
- `f50372d6` (#962) — tz-0b: **capture** airport IANA zone through the commit payload.
- `88846d8a` (#963) **[MIGRATION]** — tz-1: add `start_at`/`end_at`/`start_zone`/`end_zone` storage; persist zones passthrough.
- `e4e6288b`/`16ef7c3f`/`6bc7560e` (#964–966) — diagnose blank zones (temporary probe → **confirmed C1 stale-offer → probe reverted**).
- `3d3f77c8` (#967) **[NEW FILE]** — tz-2: **`lib/time.ts`** canonical zone↔instant converter on native `Intl` (DST-correct), unit-proven.
- `50264301` (#968) — tz-2-fill: compute `start_at`/`end_at` via `zonedToInstant` (flight-only, guarded; **end uses arriveDate, not endDate**).
- `59dca292` (#969) — tz-3a: plumb instant + zones to `CalendarGrid` (no render change).
- `87b8f047` (#971) — tz-3b: render geometry/label from `start_at` in `America/Los_Angeles` anchor; naive dual-path for null.
- `8b83d4dc` (—) — tz-4: wire the **live Trip-Local toggle** (event trip zone vs home anchor; subtitle zone fixed to match title).

### Arc 4 — Calendar fetch (visible-range → boundary → overlap)
- `f397e3f1` (#972) — audit: week spanning a month boundary loads only one month (fetch-window, not render-filter).
- `870a4c8c` (#973) — fetch the **visible view range** (from/to) instead of the month; month/year modes kept.
- `eacecf15` (#982) — fetch events **overlapping** the window (all 3 modes), not only those starting in it; summary scoped to window-start.

### Arc 5 — Hotel handling (span-fill → amortize → truncate → guard)
- `f6405622` (#975) — audit: hotel all-day model correct, cost stored once, **nights-divisor already fixed** (no fabricated fix).
- `168d88c3` (#976) — multi-day hotels render a **continuous span across all nights**, not just endpoints.
- `f032214f` (#977) — lodging amount **fails loud** instead of silently falling back to one night.
- `c3058abc` (#978) — audit: per-day footer amortization (divide by nights, checkout-day $0).
- `1af92030` (#979) — truncate overflowing all-day labels to one line (`min-w-0` so existing `truncate` engages).
- `952648f0` (#980) — amortize lodging to the **nightly rate** in the per-day footer via `coa_code 9200` (checkout $0, reconciles to total).
- `fedd9b41` (#981) — audit: amortize **not firing (PR unmerged)** + week-2 vanish (fetch keys `start_date` only) — caught both.

### Arc 6 — Budget section (HB-1 → HB-1b)
- `86670e66` (#983) — audit: existing hub budget stack + drill-in (planned: `budgets` vs `budget_line_items`; actuals = ledger; routine bridge missing).
- `23edf361` (#984) **[NEW FILE]** — HB-1: month-scoped **budget section + 4-toggle** under the hub calendar, reusing `BudgetDrillDown`; Personal/Business/Travel wired, Trading pending.
- `0784f8cd` (#985) — HB-1b: hide `$0/$0` COA rows (keep any non-zero incl. negatives).

### Broader window (Jun 14, also in 72h — not the named six, reported for honesty)
- **Duffel flight payments:** `ccd972f0` (#939) backend payment-intent→confirm→order, `ddb1c65a` (#941) `FlightCheckoutPanel`, `84b29a38` (#943) Book button, `90f24de6` (#881) friendly error mapping.
- **Mobile app shell:** `9d16e322` (#897) bottom tab bar, `b5947810` (#896) collapsible intros, `939e8637`/`bb4427bf` (#899/900) 7-tab + desktop tabs, `b529f9de` (#902) phone day-only calendar.
- **Travel wiring:** trips list/budget/actual/uncommit/delete/images/modal (`a7a8cc51`, `6786bc21`, `8ffc3f0c`, `ce6ac4dc`, `b05094cb`, `87515041`), reservations route `fe7b67de` (#888).
- **Flight/Hotel commit-to-trip:** `a88f1795` (#920), `49081c39` (#922).
- **Event detail (HCR3):** `ab191098` (#875) type-aware panel, `107e4622`/`3bf69579` modal + routine-open.
- **Docs/reality pass:** `e74ad46c` (#914) full-reality audit (57 routes), `bd266cc1` (#915) README rewrite, `3c0c8592` (#913) license fix, `10470d72` (#911) pricing page, `64c142d0` (#916) freemium doc.

---

## Audit reports produced (34) — headlines of the six-arc set

(Full list in §below; the six-arc audits, quoted verbatim from each file's `**Headline**`:)
- `timezone-model-audit.md` — *"Trip-local conversion is NOT possible from stored data today — every…"* (drove the tz-1 zone-storage migration).
- `week-month-boundary-audit.md` — *"the calendar fetch window is MONTH-scoped, not view-scoped."*
- `tz3-render-audit.md` — *"every calendar render site reads the naive start_time/start_date…"*
- `hotel-amortization-audit.md` — *"two answers, both reassuring on cost"* (storage correct; the real defect was the membership gap).
- `hotel-daily-amortize-audit.md` — *"the per-day footer sums full budget on every spanned day (CalendarGrid.tsx:816/:838)."*
- `hotel-amortize-debug-audit.md` — *"two INDEPENDENT roots, both found"* (unmerged PR + start_date-only fetch).
- `event-editor-audit.md` — *"the 12-column canonical store the editor wants already exists — hub_scheduled_items — but is wired to nothing."*
- `hub-budget-existing-audit.md` — *"the hub already has a full budget stack… NOT greenfield."*

(Earlier-window audits, 26 more, span Duffel/mobile/travel/docs — e.g. `FULL-REALITY-AUDIT.md`
mapped 57 routes; `README-REALITY-AUDIT.md` caught BSL-not-AGPL + six "Production Ready"
overclaims.)

---

## (c) ARC SUMMARIES

**Calendar truth.** Trip flights were broken three ways: a **−1-day** display drift (UTC-midnight
localization, `d17e0937`), a **34-hour** block from rendering naive cross-zone `start→end`
(`fd104ba1`), and a **phantom** second day in month view (`676b4bd3`). Now flights render from
**depart + true elapsed `duration_minutes`** (a captured Duffel field, migration `113ead9e`), the
ledger date is correct, and month membership is derived not naive. Midnight (`00:00`) is a real
time, not "no time" (`00eabe8a`).

**Money convention.** Color/sign were ad-hoc. **`lib/money.ts`** (`a0cdffe1`) is now the single
formatter: `kind:'expense'` → red/negative, `kind:'pnl'` → signed green/red, **direction passed by
the caller, never inferred from the value's sign**. Consumed across the calendar footer, trip
ledger, and the new budget section.

**Timezone system.** A flight's wall-clock was stored naively in the airport's own zone, so a
cross-zone leg landed at the wrong position. The arc built the full pipeline: **capture** the
airport IANA zone from Duffel (`f50372d6`) → **store** `start_at/end_at` (UTC instant) +
`start_zone/end_zone` (migration `88846d8a`) → **convert** via the DST-correct canonical
`lib/time.ts` (`3d3f77c8`) → **render** from the instant in a fixed home anchor (`87b8f047`) →
**toggle** live between Home and Trip-Local (`8b83d4dc`). Every step was additive and null-safe.

**Calendar fetch.** The fetch keyed on `start_date` and the month, so a week crossing a month
boundary loaded half its events and a multi-day hotel **vanished** in weeks after its start. Fixed
in two steps: fetch the **visible view range** (`870a4c8c`), then fetch events that **overlap** the
window — `start_date <= to AND (end_date >= from OR …)` — across all three modes (`eacecf15`), with
the dead per-source summary scoped to window-start so its totals stay honest.

**Hotel handling.** A 30-night stay showed only check-in/check-out chips (middle nights blank), its
full total repeated on every day, and an overflowing label. Now: a **continuous span** across all
nights (`168d88c3`); the per-day footer shows the **amortized nightly rate** (total ÷ nights, $0 on
the checkout day, reconciles to the stored total) gated on the lodging COA `9200` (`952648f0`); the
label truncates to one line (`1af92030`); and the lodging amount **fails loud** rather than silently
storing one night (`f032214f`). Storage was audited as already-correct and left untouched.

**Budget section.** The audit found the hub already had a full budget stack + a working actuals
drill — so HB-1 (`23edf361`) **reused** it: a month-scoped flat table (Category | COA | Budget |
Actual | Variance) with a 4-toggle, the existing `BudgetDrillDown` for actuals (no extraction),
Personal/Business/Travel wired to the existing routes, Trading honestly **pending**. HB-1b
(`0784f8cd`) hides empty `$0/$0` rows while keeping negatives.

---

## (d) ARCHITECTURE LANDED (the durable systems)

1. **`src/lib/time.ts`** — the canonical zone↔instant converter (`zonedToInstant` /
   `instantToZoned`) on native `Intl.DateTimeFormat`, DST-correct, **no library, no fallback**
   (throws on bad zone). The single timezone authority for storage + render.
2. **`src/lib/money.ts`** — the single money formatter + color convention (`formatMoney`,
   `moneyColorClass`), direction-from-caller. The single money-display authority.
3. **The home-anchor + live-toggle timezone model** — `start_at`/`end_at` (UTC instant) +
   `start_zone`/`end_zone` (IANA) stored additively; render from the instant in a resolved display
   zone (`HOME_ANCHOR` or the event's trip zone), switched by the live `tzMode` toggle.
4. **The visible-range + overlap fetch contract** — `/api/calendar` returns events **overlapping**
   the on-screen window in all three modes; `CalendarGrid` emits the range via `onRangeChange`.
5. **The budget-section pattern** — a month-scoped per-COA table reading the three existing budget
   routes (uniform `{budgetData, actualData, coaNames}` shape) + reusing `BudgetDrillDown`; the
   template for HB-2..5.
6. **Additive-nullable migrations** — `duration_minutes`, the tz columns, and the
   `hub_scheduled_items` travel columns were all `ADD COLUMN IF NOT EXISTS` nullable, old rows
   untouched (constitutional: never destructive on financial data).

### Migrations run in the window (4)
| Migration | Added | Commit |
|---|---|---|
| `pr-calendar-times-schema` (doc'd) | `start_time`/`end_time` `@db.Time` on `calendar_events` | `f0275b47` |
| `flight_duration_minutes.sql` | `duration_minutes INT` on `calendar_events` + `trip_itinerary` | `113ead9e` |
| `tz_storage_zones.sql` | `start_at`/`end_at` `timestamptz` + `start_zone`/`end_zone` `text` on both | `88846d8a` |
| `hub_scheduled_items_travel_cols.sql` | `vendor`/`item_type`/`trip_id`/`provider_ref` on `hub_scheduled_items` | `37863941` |

### Net-new durable files (18, non-audit)
`src/lib/time.ts`, `src/lib/money.ts`, `src/components/hub/HubBudgetSection.tsx`,
`src/components/hub/EventDetailPanel.tsx`, `src/components/trips/TripBudgetActual.tsx`,
`src/components/trips/FlightCheckoutPanel.tsx`, `src/components/trips/AllTripsList.tsx`,
`src/components/trips/TripFormModal.tsx`, `src/app/api/flights/payment-intent/route.ts`,
`src/app/api/trips/[id]/reservations/route.ts`, `src/app/api/trips/[id]/budget-line/route.ts`,
`src/app/how-pricing-works/page.tsx`, `src/app/dev/flight-checkout/page.tsx`,
`docs/FREEMIUM-MODEL.md`, `docs/migrations/pr-calendar-times-schema.md`, + 3 migration SQLs.

---

## (f) ENGINEERING DISCIPLINE EVIDENCE (where truth-first visibly worked)

- **CC caught a real semantic bug — `arriveDate` vs `endDate`:** tz-2-fill computes `end_at` from
  the flight's **arrival date**, not the round-trip return date (`50264301`); using `endDate` would
  have placed arrival on the wrong day. Flagged and corrected in the build.
- **CC caught an unmerged PR + a latent fetch bug:** the `hotel-amortize-debug` audit (`fedd9b41`)
  discovered `perDayBudget` was **not on main** (PR built but unmerged) — so amortization "wasn't
  firing" because it wasn't deployed — **and** that the visible-range fetch keyed on `start_date`
  only, so a hotel vanished in week 2. A self-audit catching its own pipeline state.
- **No fabricated fix:** the `hotel-amortization` audit (`f6405622`) found the suspected
  nights-vs-days divisor bug was **already fixed** (PR-21/33) and said so rather than inventing a
  change.
- **NO-FALLBACK decisions, repeatedly:** lodging amount **fails loud** vs storing one night
  (`f032214f`); tz instants are `null` when zone/time absent, never defaulted (`50264301`);
  amortization with `nights <= 0` shows full-on-start-day, never divide-by-zero (`952648f0`);
  `lib/time.ts` throws on an invalid zone.
- **STOP-and-report gates honored:** the tz-probe was a **temporary** diagnostic log added to
  disambiguate C1 (stale offer) vs C2 (missing zone), then **reverted** once C1 was confirmed
  (`16ef7c3f` → `6bc7560e`); HB-1 and overlap-fetch each ran a hard gate (the overlap gate
  confirmed the route `summary` had **no live consumer** before widening the fetch).
- **DST correctness:** `lib/time.ts` uses native `Intl` (DST-correct by construction); the daily
  amortization's `Math.round((end−start)/86_400_000)` absorbs the 23/25-hour DST day (verified
  against an Oct→Nov crossing).
- **Constitutional non-destruction:** every migration additive-nullable; the stale-trips and budget
  disconnect work explicitly **never** SQL-deletes user financial data (`STALE-TRIPS-AUDIT.md`,
  `hub-budget-existing-audit.md`).

---

## (e) WHAT'S STILL OPEN (parked — honest)

- **Event editor EE-1 → EE-5** (`event-editor-audit.md`): the detail panel is still a read-only
  scaffold. EE-1 editor shell + naive-ISO fix, EE-2 COA title join, **EE-3 kind-link migration**
  (`content_piece_id` is net-new under every option), EE-4 full-field PATCH + `start_at/end_at`
  sync (closes the trip_itinerary-vs-calendar_events split-brain), EE-5 cost-by-name rollup. **None
  built.**
- **`hub_scheduled_items` still unwired** — the 12-column canonical store exists (travel columns
  added, `37863941`) but has **no reader/writer** (EXISTS-BUT-UNUSED). The editor + budget arcs
  both point at it as the eventual canonical row.
- **Budget HB-2 → HB-5:** HB-2 Trading budget route (entity exists, no route); HB-3 budget-figure
  drill → `budget_line_items` (the budget cell is inert today); **HB-4 routine-mapped planned
  (LARGE + MIGRATION)** — `operations_routines` has **no cost/COA**, and nothing writes
  `budget_line_items source='recurring'`, so "planned from Routines" is unbuilt; HB-5 disconnect the
  `budgets` table read (gated on HB-4, keep the rows).
- **Content promotion / routine→planned bridge** — the dependency under HB-4; routines carry no
  money today.
- **Two cleanup items (pre-existing, untouched):** the `let events: any[]` lint error in
  `src/app/api/calendar/route.ts:27` (pre-dates this window) and the `compact` unused-var +
  `getEventsForDate`/`gridDays` effect-deps warnings in `CalendarGrid.tsx` (pre-existing). Carried,
  not introduced.
- **tz-4 behavior note:** the toggle defaults to `'local'` and is hidden in month view, so month
  membership follows the current `tzMode` — fine for LAX-origin rows, divergent only for a flight
  whose departure zone ≠ the anchor. Flagged for a possible follow-up.

---

### Appendix — full audit-reports touched in window (34)
`AUTH-KEYSTONE`, `BUDGET-LOGIN-BUG`, `BUDGET-PAY-UNIFY`, `CALENDAR-RENDER`, `DUFFEL-PAYMENTS`,
`EDGE-MACHINE`, `EVENT-DETAIL`, `FLIGHT-BOOK`, `FLIGHT-COMMIT-WIRE`, `FLIGHT-TIMEZONES`,
`FULL-REALITY`, `HOTEL-COMMIT`, `LEDGER-CALENDAR-MAP`, `MOBILE-APP`, `PROJECTS-ROUTINES-SPLIT`,
`README-REALITY`, `STALE-TRIPS`, `TIMED-BLOCKS`, `TRAVEL-GLOWUP`, `TRAVEL-STATEMENT`,
`TRAVEL-WIRE`, `TRIP-LEDGER`, `TWO-MODE-HUB`, `UNCOMMIT-IMAGES`, `datetime-timezone-flow`,
`event-editor`, `hotel-amortization`, `hotel-amortize-debug`, `hotel-daily-amortize`,
`hub-budget-existing`, `month-phantom-amount-convention`, `timezone-model`, `tz3-render`,
`week-month-boundary`.

*Read-only retrospective — facts from git history + audit-reports/. No fixes.*
