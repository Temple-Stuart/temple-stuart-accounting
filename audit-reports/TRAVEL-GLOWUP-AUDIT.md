# TRAVEL-GLOWUP AUDIT — make the Travel tab beautiful like the calendar

**Type:** Audit — READ ONLY. Nothing modified.
**Goal:** give the Travel tab the calendar's glow-up: (1) kill the redundant purple band
+ flush under the tabs; (2) edge-to-edge full width (no floating card) on phone +
desktop; (3) confirm the 1-2-3-4 vertical layout (Create → Trips → Budgeted/Actual →
Search tools). **LAYOUT/VISUAL ONLY** — reuse the working pieces, no commit-wiring.

Citations are `src/components/home/ModuleLauncher.tsx` unless noted.

---

## TL;DR

- **The 1-2-3-4 order already exists.** The Travel card body renders Create → Trips →
  Budgeted/Actual (`renderBody('travel')` `:236-276`), and the search tools stack right
  below it (`:389-420`). So step (3) is essentially **done** — it just looks boxed.
- **The one structural difference from the calendar:** Travel renders inside the
  **shared `{MODULES.map}`** (`:369-422`), not its own block. The calendar had its own
  `authed`-true/false sections, which is why killing its band was clean. To kill
  Travel's band without touching the other 5 modules, **extract Travel into its own
  block** (mirror the calendar) — that's the main lift.
- Everything else mirrors the calendar PRs: remove the band + card chrome + container
  `px` + `py-10`; relocate the "Free · guest ok" signal to a tiny tag.
- **All of it is layout/visual.** The commit-wiring (search → commit → selected trip)
  and the multi-destination save gap are **separate** and must NOT be scoped here.

---

## 1. CURRENT TRAVEL RENDER (the full stack)

Travel is rendered by the generic `{MODULES.map((m, i) => …)}` (`:369-422`):
- `<section … ${activeModule === (MODULE_TO_TAB[m.key] ?? m.key) ? 'block':'hidden'}>`
  with `py-10` + alternating bg (`:370`).
- container `<div className="max-w-7xl mx-auto px-4 lg:px-8 space-y-6">` (`:371`).
- the **card** `<div className="rounded-lg overflow-hidden border border-gray-200/50
  shadow-sm">` (`:372`).
- the **purple band** `<div className="bg-brand-purple/80 text-white px-4 py-2.5 …">`:
  `{m.label}` (`:374`) + the tag `{m.key === 'operations' ? 'Live demo · log in to use'
  : m.live ? 'Free · guest ok' : 'Paid'}` (`:376`).
- the **body** `<div className="bg-white p-4">` (`:379`): `{MODULE_INTROS[m.key] &&
  <ModuleIntro …/>}` (`:380`, the Mobile1 collapse) + `{renderBody(m)}` (`:381`).

**`renderBody('travel')`** (`:236-276`) — the card body, top to bottom:
| # | Section | Line | Reuse? |
|---|---|---|---|
| — | explainer "Start a trip and we'll help you plan…" | `:238-240` | chrome (could fold) |
| **1** | **`<CreateTripForm onUnauthenticated={gateGuestCreate} showHeader={false} onCreated={…}>`** | `:241-245` | **REUSE** |
| **2** | **`<AllTripsList refreshSignal onSelect selectedTripId onDeleted>`** (authed-only) | `:251-263` | **REUSE** (Trips1/2/3) |
| — | "Selected: <trip>" indicator | `:264-269` | chrome |
| **3** | **`<TripBudgetActual trip={currentTrip}>`** (when a trip is selected) | `:270-272` | **REUSE** (Trips5/6/7/8) |

**The search stack** — siblings of the card, inside the section (`:389-420`), the
**item 4** tools:
| Section | Line | Reuse? |
|---|---|---|
| **`<PublicFlightSearch>`** | `:389` | **REUSE** (guest search) |
| **`<PublicHotelSearch>`** | `:390` | **REUSE** |
| ComingSoon "Getting around" | `:393-398` | static |
| **`<PublicActivitySearch>`** | `:399` | **REUSE** |
| **`<PublicVisaCheck>`** | `:402` | **REUSE** |
| ComingSoon Insurance / eSIM / Events | `:403-419` | static |

**Working pieces to REUSE (no rewrite):** `CreateTripForm`, `AllTripsList`,
`TripBudgetActual`, the 4 `Public*Search`/`Check` widgets, the `ComingSoonSection`
rows, the `ModuleIntro` collapse. **Chrome to restructure:** the band, the card
wrapper, the container `px`/`py`, the explainer line.

---

## 2. THE PURPLE BAND + FLUSH (like calendar)

- Travel's band is the **generic `MODULES.map` band** (`:373-378`) — the SAME markup the
  other 5 modules use (`{m.label}` + the per-module tag). **It is per-module (driven by
  `m`), so removing it for Travel only means special-casing.**
- ⚠ **Unlike the calendar** (which had its own `authed`-true/false sections, so its band
  was trivially removable), Travel is inside the shared map. To kill Travel's band
  cleanly without touching trading/operations/bookkeeping/tax/compliance, **extract
  Travel into its own dedicated block** (render it before/after `{MODULES.map}`, and
  filter it out of the map via `MODULES.filter(m => m.key !== 'travel')` or a guard).
  This mirrors the calendar's structure and isolates Travel's chrome.
- **Relocate the "Free · guest ok" signal minimally** (like the calendar's "Live demo"
  tag): a tiny inline tag at the top of the Travel block (e.g. `text-[10px] uppercase
  text-brand-purple`), kept but unobtrusive. The Travel tab in the tab row already
  labels "Travel," so the big band is redundant — same logic as the calendar.

---

## 3. EDGE-TO-EDGE + WIDTH (like calendar)

The same chrome that boxed the calendar boxes Travel:
- **Container** `max-w-7xl mx-auto px-4 lg:px-8` (`:371`) — the `px-4 lg:px-8` holds it
  off the edges (the PR-Calendar-Width fix removed exactly this on the calendar →
  `max-w-7xl mx-auto`). Do the same for the extracted Travel block.
- **Card wrapper** `rounded-lg … border … shadow-sm` (`:372`) — the floating-card look;
  drop it (PR-Calendar-Flush did this for the calendar).
- **`py-10`** on the section (`:370`) — the vertical gap under the tabs; drop it so
  Travel sits flush under the tab row.
- **Body `p-4`** (`:379`) — the inner padding; the calendar removed it
  (PR-Calendar-Seamless). Travel can too, letting `CreateTripForm`/the lists manage
  their own spacing.

Net: extracted Travel block = `w-full bg-white … <div className="max-w-7xl mx-auto">
<TravelContent/></div>` — full-bleed on phone, full-`max-w-7xl` (centered) on desktop,
flush under the tabs, no band, no card. Exactly the calendar treatment.

---

## 4. THE 1-2-3-4 RESTRUCTURE — mostly already there

| Target | Today | Status |
|---|---|---|
| **1 · Create-a-trip** | `CreateTripForm` (`:241`) — has name, **multi-dest** chips (`selectedDestinations[]` `CreateTripForm.tsx:39`), dates, travelers (`:42`), Personal/Business/Mixed (`tripType` `:43`) | ✅ in place |
| **2 · Your trips (list/select/delete)** | `AllTripsList` (`:253`) — select + delete built (Trips1/2/3) | ✅ in place |
| **3 · Budgeted + Actual rows** | `TripBudgetActual` (`:272`), under the trips list, shown when a trip is selected | ✅ in place |
| **4 · Search tools stacked** | flights/hotels/activities/visa + coming-soon (`:389-420`) below the card | ✅ in place |

**So the order is already 1 → 2 → 3 → 4.** Today it's split across the card body (1-3)
and the section (4); once the card is removed (§2/§3), all four flow in **one continuous
column** — the 1-2-3-4 layout falls out naturally. The reorder PR is therefore tiny
(mostly the card removal does it).

- **Intro collapse:** the Mobile1 `ModuleIntro` (the "How it works" collapse) renders at
  `:380` for Travel's `MODULE_INTROS` entry (`:76`). ✅ present + tight. Note: there's
  **also** a second explainer line in the card body (`:238` "Start a trip and we'll
  help you plan…") — minor redundancy; the glow-up could fold it into the collapse or
  drop it.
- ⚠ **FLAG (data, not layout):** `CreateTripForm` collects multiple destinations but the
  POST sends only `destination: selectedDestinations[0]` (`CreateTripForm.tsx:112`) — the
  multi-dest **save** gap from the travel-wire audit. **Not** part of this layout glow-up;
  do not fix it here.

---

## 5. LAYOUT-ONLY vs NEEDS-WIRING

- **This glow-up is 100% layout/visual:** extract Travel into its own block, remove the
  band + card + `px`/`py`, relocate the guest tag, let the existing 1-2-3-4 sections
  flow. Every functional piece (`CreateTripForm` POST, `AllTripsList` fetch/select/
  delete, `TripBudgetActual` `/budget`+`/reservations` fetch, the `Public*Search`/`Check`
  guest searches) is **reused unchanged**.
- **NOT in scope (the wiring — flagged so it isn't pulled in):**
  - search → commit → the selected trip (threading `currentTrip` into the search
    widgets; the hotel budget path) — the hard part from the budget-pay-unify +
    travel-wire audits.
  - the multi-dest **save** gap (`CreateTripForm.tsx:112`).
  - any `hub_scheduled_items` master writes.

---

## REPORT: THE ATOMIC GLOW-UP PLAN

### PR-TG1 — kill band + flush + edge-to-edge (mirror the calendar)
- **Touches:** ModuleLauncher only — **extract Travel into its own block** (out of
  `{MODULES.map}` `:369-422`, render a dedicated `activeModule === 'travel'` block like
  the calendar's `:352-367`); remove the band (`:373-378`), card (`:372`), container
  `px` (`:371`), `py-10` (`:370`), body `p-4` (`:379`); relocate the "Free · guest ok"
  signal to a tiny tag.
- **Stays working:** the tab visibility (`activeModule === 'travel'`), `MODULE_INTROS`/
  `ModuleIntro`, every reused widget. The other 5 modules keep the generic map + band.
- **Risk:** the extraction is the trickiest part (move the card body **and** the search
  stack into one block, keep `renderBody('travel')` or inline it, keep the tab gate).
  Medium — but it's pure JSX reorganization, no logic.

### PR-TG2 — confirm/tidy the 1-2-3-4 order
- **Touches:** minor — after TG1 the order already falls out; this just verifies Create
  → Trips → Budgeted/Actual → Search read as one clean column, and optionally folds the
  redundant explainer (`:238`) into the `ModuleIntro` collapse.
- **Risk:** low. Mostly a no-op once TG1 lands.

### PR-TG3 — per-section polish (optional)
- **Touches:** the search stack (`:389-420`) — 8 stacked sections is a long scroll;
  optionally the 2×2 tap-tiles from the edge-machine audit, or just section headers/
  spacing. Pure presentation.
- **Risk:** low — make sure all 4 live searches + 4 coming-soon stay reachable.

### Order
**TG1 → TG2 → TG3.** (TG1 does most of the visible glow-up; TG2/TG3 are polish.)

### Don't-break flags
- **`CreateTripForm`'s other caller** is `/budgets/trips/page.tsx` (`<CreateTripForm />`,
  default props → navigates on create). The glow-up is ModuleLauncher-local; don't touch
  `CreateTripForm` → that caller stays fine.
- **The search widgets' guest behavior** (public search, booking → `onRequireAuth`) —
  reorder/reskin only, no prop changes.
- **The budget/actual fetches** (`TripBudgetActual` → `/budget` + `/reservations` when a
  trip is selected) — reposition only.

---

## Citations index
- Travel card body: `renderBody('travel')` `ModuleLauncher.tsx:236-276` (explainer
  `:238`, CreateTripForm `:241`, AllTripsList `:253`, Selected `:264`, TripBudgetActual
  `:272`).
- Map + band + card: `:369-382` (section `:370`, container `:371`, card `:372`, band
  `:373-378`, body `:379`, ModuleIntro `:380`).
- Search stack: `:389-420`.
- Tab visibility + bottom bar: `:370` (`activeModule`), `:431-444`.
- Calendar precedent (own block, flush, full-width): calendar sections `:352-367`.
- CreateTripForm: fields `CreateTripForm.tsx:39,42,43`; multi-dest save gap `:112`;
  other caller `src/app/budgets/trips/page.tsx`.
- Travel intro: `MODULE_INTROS.travel` `:76`.
