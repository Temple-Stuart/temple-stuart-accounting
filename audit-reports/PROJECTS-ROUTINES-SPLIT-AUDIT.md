# PROJECTS-ROUTINES-SPLIT-AUDIT — rename Operations→Projects, add a Routines tab, split the pipe

**Branch:** `claude/audit-projects-routines-split` · **Base:** main @ `7b51f6ad` · **Date:** 2026-06-16
**Scope:** READ ONLY. No code changes.

---

## TL;DR

- **The tab system is a clean rename + reorder + add** — all driven by three arrays in
  `ModuleLauncher.tsx` (`MODULES`, `TABS`, `MODULE_TO_TAB`) + `TAB_DESCRIPTORS` + one
  `renderBody` branch + one band-tag check. ~8 `operations` references to touch.
- **The current public Operations tab has NO routines surface** — it mounts the workbench
  `OperationsPipelineShowroom` = **Project pipe + Day calendar + Script** (no routine-create
  form). So "pull routines out of Operations" is really "Operations *was already* projects-
  centric; **add** the routines surface to a new tab."
- **The routines pipe is substantially BUILT** — a home-ready, fetch-free
  `src/components/home/RoutineCreateForm.tsx` already exists (the real RRULE/cadence form),
  plus a full deep feature (`/operations/routines`, 9 routes, RRULEBuilder, the recurrence
  engine we just fixed, calendar mapping, a background miss-evaluator). The new Routines tab
  can mount the existing home form on day one.
- **Flag:** the routine "recurring-expense / both" patterns don't appear in the current home
  form (it's cadence + time only). Verify before promising all 3 patterns.

---

## 1. The tab system (rename + reorder + add)

All in `src/components/home/ModuleLauncher.tsx`:

- **`MODULES`** (`:38-45`): the 6 paid/live module defs. Operations =
  `{ key: 'operations', label: 'Operations', live: false, blurb: 'Routines, daily plan,
  command center.' }` (`:41`).
- **`TABS`** (`:51-59`): the 7 tab chips, **this array defines tab ORDER**
  (calendar · travel · trade · operations · books · tax · compliance). Operations =
  `{ key: 'operations', label: 'Operations', icon: '🎯' }` (`:55`). Both the desktop top row
  and the mobile bottom bar `.map(TABS)` — so **reorder = reorder this array**; the mobile bar
  already horizontal-scrolls, so an 8th tab fits.
- **`MODULE_TO_TAB`** (`:62-69`): maps a MODULES key → its TAB key; `operations: 'operations'`
  (`:66`). Panels gate on `activeModule === (MODULE_TO_TAB[m.key] ?? m.key)` (`MODULES.map`).
- **`TAB_DESCRIPTORS`** (`:75-83`, exported, drives the per-tab hero via PR-Hero-PerTab):
  `operations` line at `:79`. Needs a **`routines`** entry + an `operations`→`projects` rename.
- **`renderBody`** (`:170`): the Operations body branch `if (m.key === 'operations') { return
  <OperationsPipelineShowroom onRequireAuth={onRequireAuth} /> }` (`:220-225`).
- **Band tag** (`:385`): `m.key === 'operations' ? 'Live demo · log in to use' : m.live ?
  'Free · guest ok' : 'Paid'` — Operations gets the special "Live demo" tag because the
  showroom is a live demo. After the rename, **Projects** (and likely **Routines**) should
  keep that tag, so this check needs both keys.
- **`activeModule`** = a TAB key (default `'calendar'`, `:112`); `selectTab` (`:115`) swaps it +
  notifies the hero. Reorder/rename/add does not touch this.

**Target order:** `Calendar · Travel · Routines · Projects · Trade · Books · Tax · Compliance`
(8 tabs) — a reorder of `TABS` with `routines` inserted and `operations`→`projects` renamed.

> Note: Calendar + Travel render as **dedicated blocks** (not in `MODULES.map`); the other
> modules render via `MODULES.map`. Panel display order is irrelevant (one panel shows at a
> time, gated by `activeModule`) — only `TABS` order is user-visible. The `MODULES.map`
> alternating bg (`i % 2`) shifts when modules are added/reordered, but since one panel shows
> at a time it's invisible (same finding as PR-TG1).

---

## 2. What's inside "Operations" today (the split point)

ModuleLauncher mounts the **workbench** `OperationsPipelineShowroom`
(`ModuleLauncher.tsx:16,225`). That component
(`src/components/workbench/operations/showroom/OperationsPipelineShowroom.tsx:60-104`) renders
**three panels**, all fetch-free (Layer-2 `guardShowroomRender`, build-time guardrail):

| Panel | Component | What it is | Projects or Routines? |
|---|---|---|---|
| **1 · Project** | `<ProjectsPipelineShowroom>` (`:64`) | The real project pipe: 5-step scoping fields, task list (mixed statuses), evolution timeline, dependency edges — fed by the static PR6 seed. | **PROJECTS** |
| **2 · Day Calendar** | `<DayCalendarView>` (`:69`) | The demo day timeline (her tasks mapped into the day). | Operations execution (project-adjacent) |
| **3 · Script** | `<ScriptGeneratorView>` (`:82`) | AI narrates the day; the PAID generate-script is locked to `onRequireAuth`. | Content/script |

**There is NO routine-create surface in the current public Operations tab.** Routines do not
appear here at all — so nothing routine-specific has to be *cut* from the showroom; the project
pipe + day + script stay, and the routines surface is *added* to the new tab.

(Aside: a separate `src/components/home/OperationsShowroom.tsx` exists that *does* combine
`ProjectCreateForm` + `RoutineCreateForm` + `ContentPreview` + `EvolutionPreview`, but it is
**not** what ModuleLauncher mounts — it's superseded by the workbench `OperationsPipelineShowroom`.
It's a useful reference for how a routines panel was meant to look on the home surface.)

---

## 3. The routines pipe (what the new tab needs)

### Home-ready surface — ALREADY BUILT
`src/components/home/RoutineCreateForm.tsx` (HOME-OPS-PR-1): the **real** routine input form,
**fetch-free**, gated to `onRequireAuth` (same pattern as `CreateTripForm`):
- Real fields: name / description / entity / **cadence via the real `RRULEBuilder`**
  (`workbench/operations/routines/RRULEBuilder`) + dates/times (`:54-89`).
- The real **routines output table structure, EMPTY**, grouped by cadence
  (Daily/Weekly/Monthly/Quarterly/Yearly/Custom via `CADENCE_GROUP_ORDER`/`CADENCE_GROUP_LABELS`,
  `:144-158`).
- "Create routine" submit calls `onRequireAuth` and returns **before** any network call.

This is mountable in the new Routines tab **immediately** (it's the public, freemium-correct
routines surface — search/fill freely, save = sign-up).

### Deep feature — BUILT (behind login)
- **Page:** `/operations/routines` → `SectionE_Routines`
  (`workbench/operations/SectionE_Routines.tsx`): `TodaysStrip` (due-today + mark-complete) +
  `RoutineList` (cadence-grouped, create/edit), both refetch on mutation.
- **Components:** `routines/RoutineList`, `RoutineRow`, `RoutineCreateForm` (workbench),
  `RoutineStepList`, `RRULEBuilder`, `TodaysStrip`, `dailyplan/DailyPlanRoutineRow`,
  `content/AvailableRoutinesList`, `SectionE_Routines`.
- **Routes (9):** `api/operations/routines` (list/create), `[id]` (get/update/delete),
  `[id]/steps`, `[id]/completions`, `[id]/upcoming`, `today`; `api/hub/operations-routines`
  (calendar window — **PR-Routine-EndDate just fixed the end-date leak here**);
  `api/operations/content/enrich-routine` (AI).
- **Engine + plumbing:** `lib/operations/rruleHelpers` (RRULE expand), `lib/hub/
  mapOperationsRoutines` (routine→calendar tiles), `inngest/functions/routine-evaluator`
  (background miss/complete evaluation → audit_log).

### The "3 patterns" — verify before promising
The home `RoutineCreateForm` + `RRULEBuilder` cover **cadence + start/end times** = the
**recurring time-block** pattern. A grep of the home form shows **no expense/COA/amount
fields**, so the **recurring-expense** and **"both"** patterns do **not** appear to be in the
current form. **FLAG:** confirm whether recurring-expense routines are built (a `cost`/COA on
the routine) before the Routines tab advertises all 3 patterns; today it's time-block routines.

---

## 4. The clean split plan

### What moves / what's added
- **Projects tab = Operations renamed** — keeps the current `OperationsPipelineShowroom`
  (project pipe + day calendar + script). Nothing to cut (routines were never in it). Rename
  the key/label/icon/descriptor/renderBody-branch/band-tag from `operations`→`projects`.
- **Routines tab = NEW** — mount `src/components/home/RoutineCreateForm` (the fetch-free,
  gated routine form + empty cadence-grouped output). That IS the routines pipe on the public
  home. (Optionally, later, surface a read-only "today's routines" / list preview from the
  deep feature.)

### Exact edit surface (rename + add), all in `ModuleLauncher.tsx`
1. `MODULES` (`:41`): `operations`→`projects` (label "Projects", blurb projects-only); **add**
   `{ key: 'routines', label: 'Routines', live: false, blurb: '…' }`.
2. `TABS` (`:51-59`): reorder to Calendar·Travel·Routines·Projects·Trade·Books·Tax·Compliance;
   rename the operations chip (icon: keep 🎯 for Projects, pick one for Routines e.g. 🔁).
3. `MODULE_TO_TAB` (`:62-69`): `operations: 'operations'`→`projects: 'projects'`; add
   `routines: 'routines'`.
4. `TAB_DESCRIPTORS` (`:75-83`): rename `operations`→`projects` (project line); add a
   `routines` line.
5. `renderBody` (`:220-225`): rename the branch `m.key === 'operations'`→`'projects'`
   (still returns `OperationsPipelineShowroom`); **add** `if (m.key === 'routines') return
   <RoutineCreateForm onRequireAuth={onRequireAuth} />` (the home form).
6. Band tag (`:385`): change `m.key === 'operations'` to include both `projects` and
   `routines` (so both keep "Live demo · log in to use", since both are live demos).
7. Import `RoutineCreateForm from '@/components/home/RoutineCreateForm'`.

### Risks / flags
- **Band-tag check (`:385`)** assumes a single `operations` key for the "Live demo" tag — must
  be updated for BOTH new keys or they'll fall to the wrong tag.
- **Hero (PR-Hero-PerTab)** reads `TAB_DESCRIPTORS[activeTab]` — the renamed/added keys must
  match the `TABS` keys or the hero shows blank for that tab.
- **`MODULES.map` alternating bg** parity shifts when modules are added/reordered — cosmetically
  invisible (one panel at a time) but worth a glance.
- **Deep `/operations/*` routes keep the `operations` namespace** — the rename is a **home tab
  label/key** change only; do NOT rename the API routes, the `operations_routines` table, or
  `/operations/routines` (those are the backend and stay). The split is a front-of-house
  re-labeling + surfacing, not a backend rename.
- **3-patterns gap** (see §3) — Routines tab should ship with the time-block routine it has;
  don't advertise recurring-expense until built.

### Recommended atomic PR sequence
1. **PR-A · Tabs (rename + reorder + add)** — Operations→Projects everywhere in
   `ModuleLauncher`; insert a **Routines** tab (TABS/MODULES/MODULE_TO_TAB/TAB_DESCRIPTORS),
   reorder to the 8-tab target, fix the band-tag check. Routines panel renders a **placeholder/
   stub** for now (so the tab lands without depending on the routines mount). Pure
   tab-system PR.
2. **PR-B · Routines surface** — mount `home/RoutineCreateForm` in the Routines tab (replace
   the PR-A stub). The real fetch-free routine form + empty cadence output, gated to sign-up.
3. **PR-C · Routines pipe polish** — surface more of the routines feature on home (e.g. a
   read-only today/list preview), and close the **recurring-expense / "both"** pattern gap if
   that's wanted. Larger; depends on PR-B.

Order: **A → B → C.** PR-A is low-risk and landable alone (tab shell only); PR-B is the real
"routines live in their own tab" win using the already-built home form; PR-C is the feature
build-out.

---

## REPORT (summary)

- **Tabs:** rename/reorder/add are all in `ModuleLauncher.tsx` — `MODULES` (`:41`), `TABS`
  (`:51-59`, order), `MODULE_TO_TAB` (`:66`), `TAB_DESCRIPTORS` (`:79`), `renderBody` branch
  (`:220-225`), band tag (`:385`). 8-tab target = reorder + insert `routines` + rename
  `operations`→`projects`.
- **Operations today:** the workbench `OperationsPipelineShowroom` = Project pipe +
  DayCalendar + Script (`OperationsPipelineShowroom.tsx:60-104`); **no routine surface** —
  routines are *added*, not cut.
- **Routines pipe:** home-ready `home/RoutineCreateForm` already exists (fetch-free, gated) +
  a full deep feature (`/operations/routines`, 9 routes, RRULEBuilder, recurrence engine,
  calendar mapping, miss-evaluator). Mountable now. Flag: only the time-block pattern is in
  the home form (recurring-expense unverified).
- **Plan:** Projects = Operations renamed (keeps its showroom); Routines = new tab mounting the
  home routine form. Sequence **PR-A (tabs) → PR-B (mount routines) → PR-C (pipe polish)**. Do
  NOT rename the backend `operations`/`operations_routines` namespace.

**No code modified. Audit only.**
