# TRAVEL — PR-29 Audit: editable committed-trip header (replace the search bar)

**Branch:** `claude/travel-pr-29-audit`
**Date:** 2026-05-30
**Mode:** READ-ONLY.
**Goal:** On an existing trip, replace the search-form top bar with a committed,
editable trip header (name / destinations / dates / travelers as facts, edited
in place + an Update action) — not a "Where to?" search form.

---

## 1. Current top bar — shared with trip-create

The bar is **`src/components/trips/TripCreationBar.tsx`** (336 lines), mounted
**globally** in `AppLayout.tsx:162` (`<Suspense><TripCreationBar /></Suspense>`),
so it appears on the landing page, `/budgets/trips/new`, AND every existing-trip
detail page. It **self-detects context via `pathname`** (`:28-32`):
```ts
const isOnNewPage   = pathname === '/budgets/trips/new';                   // :28
const isOnDetailPage = /^\/budgets\/trips\/([^/]+)$/ … !== 'new';          // :29-30
const mode: 'landing' | 'new' | 'detail' = …;                              // :32
```
It renders the **same search-form chrome in all modes** — a gold-bordered bar
with a name input placeholder `"e.g., Bali Surf Trip 2026"` (`:214`), a
`"Where to?"` destination box (`:245`), date pickers (`:271-285`), a travelers
`<select>` (`:291-299`), and a button that reads **"Create Trip" / "Save" /
"Update"** by mode (`:308-314`). So on a committed trip it *functions* as an
editor but *reads* as a search form. **It is the same component as trip-create**
(no separate component).

## 2. create-mode vs committed-mode — the branch already exists

`mode === 'detail'` (`:32`) **is** the committed-trip state. On detail the bar
pre-populates from the trip + its destinations (`:51-77`) and the button PATCHes
the existing trip (`:172-193`). So PR-29 can branch the **presentation** on
`mode`: render a committed header for `'detail'`, keep the search/create form for
`'new'` and `'landing'`. The new-trip flow (`mode === 'new'`, `:194-197`) stays
untouched.

## 3. Editable fields + their persist endpoints — with a real gap

The detail-mode Update calls `PATCH /api/trips/${id}` (`:179-190`) sending
`{ name, destination: selectedDestinations[0], startDate, endDate, daysTravel,
tripType }`. **But the route only accepts three of them** —
`route.ts:183` `const { destination, startDate, endDate } = body;`:

| Field | Bar sends | Route persists? |
|---|---|---|
| `startDate` / `endDate` | yes | ✅ (+ recomputes `daysTravel`/`month`/`year`, `:187-200`) |
| `destination` | first chip only | ✅ but **single string** `trip.destination` (`:186`) — not the chip set |
| **`name`** | yes (`:183`) | ❌ **dropped** — not destructured → the Update button does **not** save the trip name |
| **`tripType`** | yes | ❌ dropped |
| **travelers** | not sent | ❌ travelers live in `trip_participants` (invite/RSVP), not a trip field |
| `daysTravel` | sent | ignored — route recomputes from dates |

**Key gap:** editing the **name** (and tripType) in the bar is cosmetic — lost on
refresh. PR-29 must **extend the PATCH route to accept `name`** (and optionally
`tripType`) for the header's title edit to persist.

## 4. Destination chips — two views, one real source

The committed destinations live in **`trip_destinations`**, served by
`/api/trips/[id]/destinations`: **GET** (`route.ts:201`), **POST** add/upsert
(`:273-335`), **DELETE** remove (`:360`). The detail page edits them via
`DestinationSelector` + `selectDestination` (`page.tsx:323`) + `loadDestinations`
(`page.tsx:228`), and renders the "Scan:" chips from this data
(`page.tsx:1059-1078`).

The **TripCreationBar's chips are a separate, partially-synced view**: add/remove
only mutate local state, and Update persists only `selectedDestinations[0]` →
`trip.destination` (a single string). So the bar and the scan-row chips are **two
destination UIs** over partly-different data. **The committed header should edit
the real `trip_destinations` set via the existing POST/DELETE endpoints** (so
header chips ⇄ scan chips stay in sync), not the PATCH's single-string field.

## 5. Proposed committed-trip header (mode === 'detail')

Replace the detail-mode search chrome with a header of **committed facts, edited
in place**, same palette (brand-purple dominant, gold/aqua accents):
- **Trip name** — an inline-editable title (styled as a heading, not a search
  placeholder). Persists via `PATCH /api/trips/[id]` **once the route accepts
  `name`** (§3).
- **Destination chips** — from `trip_destinations`; add (autocomplete) → POST,
  remove (×) → DELETE, **persisted immediately** (not deferred to Update),
  reusing the existing endpoints so the scan chips stay in sync (§4).
- **Date range** — editable date inputs as a date-range pill; PATCH
  start/end (recomputes daysTravel). ✓ already works.
- **Travelers** — show the count; editing means managing `trip_participants`
  (invite/RSVP). **Recommend read-only count + a "Manage travelers" link** in v1
  rather than a free numeric edit (a bare number can't add real participants).
- **Update** action — saves name + dates (destinations save on chip change).

Where it lives: branch inside `TripCreationBar` (render a committed-header block
when `mode === 'detail'`) **or** a new `TripHeader` component rendered by the
detail page with the global bar suppressed on detail (`AppLayout` conditional).

## 6. Scope + new-trip safety

| Item | Detail |
|---|---|
| Files | `TripCreationBar.tsx` (detail-mode branch) **or** new `TripHeader.tsx` + `AppLayout.tsx` (suppress bar on detail); `api/trips/[id]/route.ts` (accept `name`/`tripType` in PATCH) |
| Destination edits | existing `/api/trips/[id]/destinations` POST/DELETE — no new endpoint |
| Travelers | `trip_participants` flow — read-only/link in v1 (flag) |
| Schema / migration | **none** — `trips.name`/`tripType` columns exist; just widen the PATCH |
| New deps | none |
| New-trip flow | **untouched** — only the `mode === 'detail'` render changes; `'new'`/`'landing'` paths unchanged |

## Taste vs mechanical
- **Mechanical:** branch presentation on `mode`; wire header destination chips to
  the existing /destinations POST/DELETE; extend PATCH to accept `name`(+`tripType`).
- **Taste calls (Alex sign-off):**
  1. **Header location** — a `mode==='detail'` branch *inside* TripCreationBar
     vs a new `TripHeader` on the detail page with the global bar suppressed.
  2. **Travelers** — read-only count + "Manage travelers" link (recommended) vs a
     full participants editor.
  3. **Name edit affordance** — always-input vs click-to-edit title.
  4. Whether the PATCH `name`/`tripType` widening ships in PR-29 or a sibling.

---

**READ-ONLY audit. No implementation performed.**
