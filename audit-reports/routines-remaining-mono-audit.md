# Remaining font-mono / inconsistency on Routines tab vs Travel (READ-ONLY AUDIT)

**Mandate:** Truth-first, read-only, every claim cites file:line. No fixes. Labels:
EXISTS / MISSING / RISK.

**Headline:** HB-4e-style restyled four files (SectionE_Routines, RoutineList, RoutineCreateForm,
RoutineRow) but **missed three rendering components** — **`TodaysStrip` (7 `font-mono`),
`RoutineStepList` (14), `RRULEBuilder` (3)** — and they carry the terminal look the screenshot
shows. The **TODAY strip** (times, names, missed/upcoming pills, "✓ mark done", "X done · Y due")
is 100% `font-mono` (`TodaysStrip.tsx`, untouched). Two non-font issues remain too: the
**status-pill style** differs from Travel's soft rounded-full pill, and the **date format is ISO**
(`active 2026-06-01–2026-06-30`) where Travel uses human dates — both read "technical" even in
sans. Only ONE remaining `font-mono` is legitimate: the raw RRULE code string
(`RoutineRow.tsx:249`).

---

## 1. COMPONENT TREE — what renders the Routines tab, and what HB-4e-style missed

`SectionE_Routines` (`:40,47`) renders **`TodaysStrip`** + **`RoutineList`**. `RoutineList` mounts
`RoutineCreateForm` + `RoutineRow` (per group). Those in turn mount more:

| Component | Renders | Restyled in HB-4e-style? | `font-mono` left |
|---|---|---|---|
| `SectionE_Routines.tsx` | the two sections + headers | ✅ yes | 0 |
| **`TodaysStrip.tsx`** | the TODAY strip (times/names/pills/mark-done) | **❌ NO** | **7** |
| `RoutineList.tsx` | count, group labels, "+ new routine" | ✅ yes | 0 |
| `RoutineCreateForm.tsx` | create form fields | ✅ yes | 0 |
| `RoutineRow.tsx` | a routine row (name/next/active/edit) | ✅ yes | 1 (the rrule — legit) |
| **`RRULEBuilder.tsx`** | the cadence builder (in create + edit) | **❌ NO** | **3** |
| **`RoutineStepList.tsx`** | the per-routine steps editor (expanded) | **❌ NO** | **14** |
| `CoaSelect.tsx` | the COA picker (HB-4b) | n/a (born homepage-styled) | 0 |

→ **Unrestyled, still terminal: `TodaysStrip`, `RRULEBuilder`, `RoutineStepList`.** — MISSING
(restyle), the root of the persisting look.

## 2. TODAYS STRIP — the terminal TODAY block (7 × font-mono, ALL wrong)

`TodaysStrip.tsx` — every text element is `font-mono`; none is a code value:
- `:120` loading "loading today's routines…" — `text-xs font-mono`.
- `:125` empty "no routines scheduled for today." — `text-xs font-mono`.
- `:133` the counts row "**{done} done · {due} due · {missed} missed**" — `text-xs font-mono`.
- `:140` error banner — `text-xs font-mono`.
- `:147` the **status pill** ("pending/completed/missed/upcoming") — `inline-block px-2 py-0.5
  border rounded text-xs font-mono ${STATUS_PILL[status]}`.
- `:152` the **row** (time + name + pill + Δmin) — `… text-xs font-mono`.
- `:178` the **"✓ mark done" button** — `… text-xs font-mono`.

So the TODAY strip's **times ("08:00 AM", `formatTime` `:55-61`), routine names (`:163`), pills,
counts, and the mark-done button** all render mono. — RISK / the screenshot's terminal TODAY block,
`TodaysStrip.tsx:120,125,133,140,147,152,178`. **All 7 should be sans.**

## 3. REMAINING font-mono — classified

**LEGIT (code value — keep):**
- `RoutineRow.tsx:249` — `<div className="text-text-primary font-mono break-all">{routine.
  schedule_rrule}</div>` — the raw RRULE string (e.g. `FREQ=WEEKLY;BYDAY=MO`). Mono is correct for
  a code literal. — KEEP.

**WRONG (labels/inputs/buttons — should be sans):**
- **`TodaysStrip.tsx`** — all 7 (§2).
- **`RRULEBuilder.tsx`** (the cadence builder, rendered inside the create + edit forms):
  `:37` input const, `:38` label const, `:79` the **cadence-mode pill buttons** (`px-2 py-1 border
  rounded text-xs font-mono`). — RISK, the form's cadence picker reads terminal.
- **`RoutineStepList.tsx`** (the per-routine steps editor, expanded row) — 14:
  `:23` input const, `:24` label const, `:221`/`:223` step buttons, `:230` count, `:246` error,
  `:252` "no steps yet", `:258` step card, `:327`/`:335` save/cancel buttons (+ more). — RISK.

→ Of the **25 remaining `font-mono`**, **24 are wrong** (labels/names/times/pills/buttons) and
**1 is legit** (the rrule). The screenshot's "ALL ROUTINES" names/"next:"/"active …" are **NOT**
font-mono anymore (HB-4e-style cleared RoutineRow) — they read technical because of the **ISO date
format** (§5), not mono.

## 4. HEADER MISMATCH — Routines vs Travel "Your trips"

- **Travel:** `<p className="text-lg font-bold text-brand-purple">Your trips</p>`
  (`AllTripsList.tsx:103`; also `ModuleLauncher.tsx:248`). **Large, bold, brand-purple.**
- **Routines:** `<h2 className="text-sm font-semibold text-text-primary tracking-tight">Routines</h2>`
  (`SectionE_Routines.tsx:31`). **Small, semibold, dark-grey.**
- **Gap:** size `text-lg` vs `text-sm`, weight `font-bold` vs `font-semibold`, color
  `text-brand-purple` vs `text-text-primary`. Routines reads smaller/lighter. To match Travel:
  `text-lg font-bold text-brand-purple`. (Same applies to the "today"/"all routines" sub-labels
  `:37,44`, which are `text-xs text-text-faint uppercase` — Travel has no such terminal sub-labels.)
  — RISK, `SectionE_Routines.tsx:31,37,44` vs `AllTripsList.tsx:103`.

## 5. THE STATUS PILLS — Routines vs Travel

- **Travel** trip-status pill: `rounded-full bg-brand-purple/10 px-2 py-0.5 text-xs font-medium
  text-brand-purple` (`AllTripsList.tsx:145`) — **soft, pill-shaped (rounded-full), tinted bg, NO
  border, sans (font-medium).**
- **Routines TODAY pills** (`TodaysStrip.tsx:147` + `STATUS_PILL :41-46`): `inline-block px-2
  py-0.5 border rounded text-xs font-mono ${bg-amber-50 text-amber-800 border-amber-300 …}` —
  **bordered, square-ish (`rounded` not `rounded-full`), font-mono, saturated per-status colors.**
- **Routines "inactive" pill** (`RoutineRow.tsx:191`): `px-2 py-0.5 border rounded text-xs
  bg-gray-100 text-gray-600 border-gray-300` — bordered, square, sans (no mono).
- **Gap:** Travel = `rounded-full`, tinted (`/10`), borderless, sans; Routines = `rounded`,
  saturated, bordered, (TODAY) mono. To match: `rounded-full`, soft `bg-X/10 text-X`, drop the
  border + the mono. — RISK, `TodaysStrip.tsx:41-46,147` + `RoutineRow.tsx:191` vs
  `AllTripsList.tsx:145`.

## 6. DATE-FORMAT INCONSISTENCY (ISO vs human) — present

- **Travel** shows human dates (`AllTripsList` formats trip start/end as "Jul 1 …", not ISO).
- **Routines RoutineRow** is **inconsistent with itself**:
  - "**next:**" uses `formatDateTime` → `toLocaleString(… month:'short', day:'numeric' …)` → human
    "Jun 16, 2026, 08:00 AM" (`RoutineRow.tsx:66-77,201`). ✅
  - "**active …**" uses **raw ISO slices**: `startStr = routine.start_date.slice(0, 10)` →
    `active 2026-06-01–2026-06-30` (`RoutineRow.tsx:206-208`). ❌ ISO, terminal-feel.
  - the **time window** uses `start_time.slice(11, 16)` → "00:00–06:45" (24h, technical)
    (`routineToForm :55-56`; rendered in the same date-window span `:204-216`).
- So even though these are now **sans**, the **ISO `YYYY-MM-DD` + 24h `HH:MM`** formatting reads
  technical next to Travel's human dates. The fix is a human formatter for the active window (mirror
  `formatDateTime`), not a font change. — RISK, `RoutineRow.tsx:206-208` (+ `:55-56`).

---

## Explicit answers

**(a) Components + which weren't restyled.** Renders: `SectionE_Routines` → `TodaysStrip` +
`RoutineList` → (`RoutineCreateForm` + `RoutineRow`) → (`RRULEBuilder`, `RoutineStepList`,
`CoaSelect`, `ScenifyButton`). **NOT restyled by HB-4e-style: `TodaysStrip`, `RRULEBuilder`,
`RoutineStepList`** (HB-4e-style only touched SectionE/RoutineList/RoutineCreateForm/RoutineRow).

**(b) Remaining font-mono, classified.** 25 total: **1 legit** = the raw RRULE string
(`RoutineRow.tsx:249`, KEEP); **24 wrong** = `TodaysStrip` ×7 (`:120,125,133,140,147,152,178`),
`RoutineStepList` ×14 (`:23,24,221,223,230,246,252,258,327,335,…`), `RRULEBuilder` ×3
(`:37,38,79`) — all labels/inputs/buttons/pills/times → should be sans.

**(c) Header gap.** Travel `text-lg font-bold text-brand-purple` (`AllTripsList.tsx:103`) vs
Routines `text-sm font-semibold text-text-primary tracking-tight` (`SectionE_Routines.tsx:31`) —
smaller, lighter, wrong color.

**(d) Pill gap.** Travel `rounded-full bg-brand-purple/10 … font-medium text-brand-purple`
(`AllTripsList.tsx:145`) vs Routines `border rounded … font-mono ${saturated}`
(`TodaysStrip.tsx:147,41-46`) — bordered/square/mono/saturated vs soft/pill/sans/tinted.

**(e) Date-format inconsistency.** YES — RoutineRow's "active" window is raw ISO
(`slice(0,10)` → "2026-06-01–2026-06-30", `:206-208`) + 24h time (`slice(11,16)` → "00:00–06:45",
`:55-56`), while "next:" in the same row is human (`formatDateTime`, `:66,201`) and Travel is
human. The ISO/24h formatting (not font) is the remaining "terminal" tell here.

**(f) Complete restyle punch-list (per component / per class).**
1. **`TodaysStrip.tsx` (MISSING restyle).** Remove `font-mono` from `:120,125,133,140,152,178`.
   Pills `:147` + `STATUS_PILL :41-46`: drop `font-mono` + `border`, switch `rounded`→`rounded-full`,
   use tinted `bg-X/10 text-X` + `font-medium` (match Travel `AllTripsList.tsx:145`). Mark-done
   button `:178`: drop `font-mono`, keep the green outline (or pill it).
2. **`RRULEBuilder.tsx` (MISSING restyle).** Drop `font-mono` from the input/label consts
   (`:37,38`) and the cadence-mode pill buttons (`:79`).
3. **`RoutineStepList.tsx` (MISSING restyle).** Drop `font-mono` from all 14 (`:23,24,221,223,230,
   246,252,258,327,335,…`); keep button shapes, sans text.
4. **`RoutineRow.tsx` (date format only — font is done).** Replace the "active" window's ISO
   `slice(0,10)` with a human formatter (mirror `formatDateTime`'s `toLocaleDateString`), and the
   time window's 24h `slice(11,16)` with a human time. **Keep** `:249` rrule `font-mono`.
5. **`SectionE_Routines.tsx` (header).** Bump "Routines" `:31` to `text-lg font-bold
   text-brand-purple` to match Travel's "Your trips"; reconsider the `text-xs … uppercase` sub-labels
   `:37,44` (Travel has none — either drop or make them quiet sans section headers).

**Sizing:** SMALL-MED — it's `font-mono` removals + 2 pill restyles + 1 date-format helper + 1
header bump, across 4 files (TodaysStrip, RRULEBuilder, RoutineStepList, RoutineRow date) + the
SectionE header. No logic/CRUD changes. (These components are shared with `/operations` — same
"restyle both" decision as HB-4e-style applies.)

### Citation index
- Tree: `SectionE_Routines.tsx:40,47`; children unrestyled `TodaysStrip.tsx`,
  `RRULEBuilder.tsx:37,38,79`, `RoutineStepList.tsx:23,24,221,223,230,246,252,258,327,335`.
- TODAY strip mono: `TodaysStrip.tsx:120,125,133,140,147,152,178`; pills `:41-46`; time `:55-61`.
- Legit mono: `RoutineRow.tsx:249`. Date format: `RoutineRow.tsx:66-77,201,206-208`; `:55-56`.
- Header: `SectionE_Routines.tsx:31` vs `AllTripsList.tsx:103`. Pill: `TodaysStrip.tsx:147` vs
  `AllTripsList.tsx:145`.

*Do not implement — audit only.*
