# Trip Budget Ledger Audit — replace Budgeted/Actual cards with a flat statement-style table

**Scope:** read-only audit. Replace the two horizontal-scroll "Budgeted / Actual" card rows
on a trip with ONE flat ledger table = the trip's **BUDGET** (both "Saved" and "Booked"
lines are planned spend). ACTUAL reconciliation moves to Bookkeeping (Plaid), **not** here.
This maps each target column to its data source + the COA/Project dropdown sources, and
flags what's missing. **No code changed.**

**Headline:** most columns already have data, but it's **split across two tables** —
`budget_line_items` (the amount/COA/description) and `trip_itinerary` (the dates, times,
cadence, vendor). The current `/budget` route returns the former and only joins two keys
from the latter, so the ledger PR mainly needs to **surface more of the existing
`trip_itinerary` fields**. Two genuine gaps need migrations: **Project linkage is entirely
missing**, and there is **no single "Saved vs Booked" status** (Booked/paid lives in a
separate `reservations` table). Details below.

---

## 1. The current cards (what we're replacing)

`src/components/trips/TripBudgetActual.tsx` renders **two horizontal-scroll rows** under a
selected trip:
- **BUDGETED (purple)** — `fetch('/api/trips/[id]/budget')` (`TripBudgetActual.tsx:179`),
  rendered `:208-252` as `overflow-x-auto` cards. Source = `budget_line_items`.
- **ACTUAL (green)** — `fetch('/api/trips/[id]/reservations')` (`:182`), rendered
  `:254-278`. Source = the `reservations` table (real paid bookings).

Confirmed: today it **splits budgeted vs actual** (`:6-7` header comment; two separate
fetches + two rows). The target is **one budget ledger** (Saved + Booked both = budget);
actual reconciliation conceptually leaves for Bookkeeping. The card component also owns the
**remove** paths — vendor-linked lines "Remove"/uncommit via `DELETE /vendor-commit`
(`:123-145`), manual lines "Delete" via `DELETE /budget-line` (`:151-172`) — those flows
carry over to the table rows.

---

## 2. Data per target column (EXISTS / MISSING)

`budget_line_items` (`prisma/schema.prisma:1036-1061`): `id, userId, tripId, itineraryId,
coaCode (VarChar20), year, month, amount (Decimal), description, photoUrl, source
(VarChar20: 'trip'|'manual'|'recurring'), entity_id (unused)`. **No dates/times, no vendor,
no projectId.**

`trip_itinerary` (`prisma/schema.prisma:646-684`): `homeDate, homeTime (VarChar10), destDate,
destTime (VarChar10), category, vendor, cost, note, location, vendorOptionId,
vendorOptionType`, plus the time-blocks fields `recurrence ('once'|'daily'),
block_start_time (Time), block_end_time (Time), coa_code (VarChar20), vendor_name`. Linked
to a budget line by `budget_line_items.itineraryId`.

| Target column | Source field | Status |
|---|---|---|
| **Saved or Booked** | No single status field. `budget_line_items.source` ('trip'/'manual'/'recurring') is all BUDGET. "Booked/paid" lives in a **separate** `reservations` table (`schema:1154-1180`: `provider` 'duffel'/'liteapi', `status`, `finalPriceCents`). | **PARTIAL** — derive (union/join) or add a status column |
| **Date Start** | `trip_itinerary.homeDate` (join via `itineraryId`) | **EXISTS** (vendor-committed lines); **MISSING** for manual lines (only `year`/`month`) |
| **Time Start** | `trip_itinerary.homeTime` (+ `block_start_time`) | **EXISTS** (committed); MISSING (manual) |
| **Date End** | `trip_itinerary.destDate` | **EXISTS** (committed); MISSING (manual) |
| **Time End** | `trip_itinerary.destTime` (+ `block_end_time`) | **EXISTS** (committed); MISSING (manual) |
| **Cadence** | `trip_itinerary.recurrence` ('once'\|'daily') | **EXISTS** (committed); MISSING (manual) |
| **COA Category** | `budget_line_items.coaCode` (+ `trip_itinerary.coa_code`), stored as a **code string**, not an FK | **EXISTS** (display) |
| **Vendor** | `trip_itinerary.vendor` / `vendor_name` | **EXISTS** (committed); MISSING (manual — no vendor field on `budget_line_items`) |
| **Description** | `budget_line_items.description` (+ `trip_itinerary.note`) | **EXISTS** |
| **Project** | **none** — no `projectId` on `budget_line_items` or `trip_itinerary` (grep: `project_id` only on workstreams/operations tables) | **MISSING — net-new (migration)** |

**How rows are created (so Saved-vs-Booked is clear):** `POST /vendor-commit` writes a
`budget_line_items` row with `source:'trip'` **and** a `trip_itinerary` row atomically
(`vendor-commit/route.ts:228-237` budget create; `:251-300` itinerary create — populating
`homeDate/homeTime/destDate/destTime`, `recurrence`, `vendor`, `vendorOptionId/Type`). That
is the **"Saved" (Save-to-trip / planned)** path. An **actual "Booked"** event (hotel pay →
`reservations`; flight Duffel → a Duffel order) writes to `reservations`, and **does not
currently create or flag a `budget_line_items` row as "booked."** So a single ledger with a
"Saved or Booked" column must either UNION the two sources or gain a status column (see §4).

---

## 3. The inline-edit path (COA + Project dropdowns)

**COA dropdown source (all accounts):** `GET /api/chart-of-accounts`
(`chart-of-accounts/route.ts:7-49`) → `chart_of_accounts.findMany({ is_archived:false })`,
returns `{ code, name, account_type, … }` (`:42-43`). Model at `schema:147-175`. **EXISTS.**
⚠️ Note: `/vendor-commit` validates COA against **travel-only** codes
(`isValidTravelCoaCode`, `vendor-commit/route.ts:96`); an inline "all COA" dropdown must
decide whether to relax that for trip lines.

**Projects dropdown source — AMBIGUOUS (two different "projects"):**
- `GET /api/projects` → `prisma.projects.findMany` (`projects/route.ts:31`) — the
  **compliance/missions** projects (`schema:2378`, `mission_id`, `domain_label`).
- `GET /api/operations/projects` (`operations/projects/route.ts:40`) — `operations_projects`
  (`schema:2691`, `title`), the model behind the home **"Projects" tab**.
  → **Flag:** confirm WHICH project list the trip ledger should link to (operations vs
  compliance). The home "Projects" the user sees = `operations_projects`.

**Inline update route — MISSING:** `/api/trips/[id]/budget-line` has **only `DELETE`**
(`budget-line/route.ts:16`); there is **no PATCH/PUT** to update a line's `coaCode` or a
project. Inline COA edit and inline Project edit each need a **net-new PATCH route**
(updating `budget_line_items.coaCode`, and a new `projectId` for the project).

---

## 4. The plan

### Ready vs needs-work (per column)
- **READY (data exists, just render/join):** Description (`budget_line_items.description`),
  COA display (`coaCode`), Amount (`amount`), and — for vendor-committed lines — Date Start/
  End, Time Start/End, Cadence, Vendor (all on the **already-joined** `trip_itinerary`). The
  `/budget` route already loads the linked itinerary (`budget/route.ts:34-50`); it just needs
  to **select more fields** (`homeDate/homeTime/destDate/destTime/recurrence/vendor`).
- **NEEDS WORK:**
  - **Saved-vs-Booked status** — no single field; derive by union/join with `reservations`,
    or add a status column (migration).
  - **Manual lines** lack dates/times/cadence/vendor (only `year`/`month`) — those cells are
    blank unless those fields are added to `budget_line_items`.
  - **Project** — **no FK anywhere** → migration to add `projectId` to `budget_line_items`.
  - **Inline edit** — no PATCH route for COA or project → net-new.

### Confirm the framing
The table is the **BUDGET ledger** (Saved + Booked planned lines). **Do not build an
"actual" column here** — actual reconciliation stays in Bookkeeping (Plaid). The existing
`reservations`/`/reservations` read can be dropped from this surface (or used only to derive
the "Booked" tag).

### Recommended atomic PR sequence (by dependency)
1. **PR-Ledger-Table (read-only):** replace the two card rows with one flat statement table.
   Extend `/budget` to also return the linked `trip_itinerary` date/time/cadence/vendor
   fields (the join already exists). Render every column that EXISTS; manual lines show
   blanks for the itinerary-only cells. "Saved or Booked" tag derived from `source` (and, if
   wanted, a join to `reservations`). **No schema change.**
2. **PR-Ledger-COA-Inline:** add `PATCH /api/trips/[id]/budget-line` to update `coaCode`;
   populate the dropdown from `GET /api/chart-of-accounts`; decide travel-only vs all-COA.
   **No schema change.**
3. **PR-Ledger-Project-Inline:** **migration** — add `projectId` (+ FK) to
   `budget_line_items` (target `operations_projects` unless told otherwise); extend the PATCH
   route to set it; dropdown from the chosen projects list. **Schema migration required.**
4. **(Optional) PR-Ledger-Booked-Status:** if "Saved vs Booked" must be a stored per-row
   status rather than a derived union, add a status column to `budget_line_items` and have
   the booking flows flag it. **Schema migration.**

### Honest schema-gap flags
- **Project linkage = migration** (no `projectId` exists today).
- **Saved-vs-Booked = needs a derived join OR a status-column migration** (Booked/paid lives
  in `reservations`, unlinked to `budget_line_items`).
- **Manual budget lines have no dates/times/cadence/vendor** — those columns will be empty
  for them unless `budget_line_items` gains those fields.

---

### Citation index
- Current cards: `src/components/trips/TripBudgetActual.tsx:6-7, 179, 182, 208-252, 254-278`
- `budget_line_items`: `prisma/schema.prisma:1036-1061` (coaCode, year/month, amount,
  description, source, itineraryId; no projectId/dates/vendor)
- `trip_itinerary`: `prisma/schema.prisma:646-684` (homeDate/homeTime/destDate/destTime,
  recurrence, block_start/end_time, coa_code, vendor/vendor_name, vendorOptionId/Type)
- `reservations`: `prisma/schema.prisma:1154-1180` (provider, status, finalPriceCents)
- `chart_of_accounts`: `prisma/schema.prisma:147-175`; list `chart-of-accounts/route.ts:7-49`
- projects: `projects` `schema:2378` + `/api/projects/route.ts:31`; `operations_projects`
  `schema:2691` + `/api/operations/projects/route.ts:40`
- `/budget`: `budget/route.ts:5, 34-50` · `/reservations`: `reservations/route.ts:25, 46`
- `/budget-line` (DELETE only): `budget-line/route.ts:16`
- `/vendor-commit` (writes budget+itinerary, source:'trip'): `vendor-commit/route.ts:96,
  228-237, 251-300`
