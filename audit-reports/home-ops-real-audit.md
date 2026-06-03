# HOME-OPS-REAL-AUDIT — rendering the REAL Operations components on home, gated (like Travel/Trading)

**Branch:** `claude/home-ops-real-audit`
**Date:** 2026-06-02
**Scope (READ-ONLY):** Determine exactly how Travel + Trading render their **real**
shared components on the public home page — real inputs, real output structure, the
submit gated to the login modal, and **zero server call when logged out** — then
determine what each **real** Operations component (project form, routine form,
content workspace, evolution view) needs to render the **same way**, so the
fabricated `OperationsShowroom` (HOME-PR-10) can be replaced with the real thing.
**Cite file+line. Recommend, do not implement.**

---

# PART A — How Travel/Trading do "real but gated" on home

## A1. CreateTripForm (Travel)

- **Mount on home vs `/budgets/trips`:** one shared component. Home mounts it via
  `ModuleLauncher.renderBody` → `<CreateTripForm onUnauthenticated={gateGuestCreate}
  showHeader={false} />` (`ModuleLauncher.tsx:107`). The trips index mounts it with
  **no** `onUnauthenticated` and default `showHeader` (extracted "VERBATIM from
  budgets/trips" — `CreateTripForm.tsx:26-29`).
- **Fetch on mount? NO.** The only `useEffect` adds a click-outside listener
  (`CreateTripForm.tsx:78-81`). Destination autocomplete is a **local lib**
  (`searchDestinations`, `:5,51`), not a fetch. The component holds local form state
  and touches the network **only** in `handleCreate`.
- **Gate point = at submit, not at render.** `handleCreate` (`:90-122`):
  ```
  if (onUnauthenticated) { const handled = await onUnauthenticated(); if (handled) return; }
  … fetch('/api/trips', { method:'POST', … })   // :102 — only reached when not handled
  ```
  A logged-out guest's click runs `onUnauthenticated()` → `gateGuestCreate`
  (`ModuleLauncher.tsx:93-100`) opens the modal and returns `true` → **returns before
  the POST**. The `fetch('/api/trips')` (`:102`) never fires for a guest.
- **The prop that drives the home variant:** `onUnauthenticated` (the gate) +
  `showHeader={false}` (drops the inner purple band — one-purple rule).
- **Output structure on home:** **none.** CreateTripForm is an input-only form; on
  success it `router.push('/budgets/trips/{id}')` (`:117`). The "output" (trip
  detail) lives on the authed page, not home.

## A2. ScanFilterForm (Trading)

- **Mount on home:** `ModuleLauncher.renderBody` for `trading && isAdmin` →
  `<ScanFilterForm … scanTriggerRef={scanTriggerRef} showHeader={false} />`
  (`ModuleLauncher.tsx:112-121`). Non-admins get the stub (so the real form only
  renders for the admin).
- **Fetch on mount? NO — zero fetch anywhere.** ScanFilterForm is **fully
  state-lifted**: the parent owns `scannerFilters`/`scannerUniverse`; every control
  calls `onFiltersChange` (`ScanFilterForm.tsx:24,71…`). There is no `useEffect`, no
  `fetch` in the file.
- **Gate point = the injected trigger.** The Scan button calls `runScan` →
  `scanTriggerRef.current()` (`:49,176`). On home the parent sets
  `scanTriggerRef.current = () => router.push('/trading')`
  (`ModuleLauncher.tsx:83`) — so home's Scan **navigates** to the dashboard; it does
  **not** run a scan. The actual (admin-gated) scan runs on `/trading`.
- **The prop that drives the home variant:** `scanTriggerRef` (parent injects the
  action) + `showHeader={false}`.
- **Output table on home:** **none.** The results table (`ConvergenceIntelligence`)
  is on `/trading`; home shows the **input** surface only.

## A3. THE SHARED PATTERN (the template Operations must follow)

| Property | CreateTripForm | ScanFilterForm | Rule |
|---|---|---|---|
| **No fetch on mount** | ✅ (only a DOM listener) | ✅ (stateless) | The component renders from local/lifted state — **never self-fetches user data on mount.** |
| **Action injected by parent** | `onUnauthenticated()` checked before the POST | `scanTriggerRef.current()` (parent routes to /trading) | The submit/network behavior is a **prop/ref the parent controls** — home wires it to the modal/route. |
| **Gate at submit, not render** | guest path returns before `fetch` | Scan just routes | Logged-out = the form is fully usable; the **only** consequence of "submit" is the login modal. |
| **No output table on home** | success → push to authed page | results table on /trading | Home shows the **input** surface; the output lives on the authed dashboard. |
| **`showHeader={false}`** | ✅ | ✅ | One purple band per card (the home launcher provides it). |

**Net:** Travel/Trading were **extracted as self-contained presentational input
forms** with **no mount fetch** and an **injected submit**. That is the whole trick —
a guest literally cannot trigger a server call because the render path has no fetch
and the submit path is routed to the modal.

---

# PART B — What the Operations components need

**The crux:** *every* real Operations surface **fetches authed user data on mount* —
the exact opposite of Travel/Trading. None can be dropped on the public page as-is:
each would fire ≥1 authed call (401 for a guest) the instant it renders, and several
depend on the `useOperationsEntity()` context provider (`EntitySelector`) which
**itself fetches `/api/entities` on mount** (`EntitySelector.tsx:57-61`).

| Component | Fetch-on-mount (cite) | Real inputs | Real output table | Submit / AI points (cite) |
|---|---|---|---|---|
| **Project — `SectionD_ProjectBacklog`** | `useEffect:267-270` → `fetch('/api/operations/projects…')`:252. **+ context** `useOperationsEntity()`:35 → `/api/entities`. **+ children:** each `ProjectRow`→`TaskList` fetches `/…/tasks` on mount; `ProjectRow`→`EvolutionTimeline` fetches `/…/evolution`:103-109. | 5-step: title `:355`, entity `:366`, target date `:381`, goal/problem/diagnosis `ListManager` `:392/402/413`, design `:435`, est min/cost `:510/520` | the projects list → `ProjectRow` `:590-604` (task list, evolution) | **AI (paid)** generate-design `onClick:427 → fetch:93`; **AI (paid)** generate-tasks `onClick:541 → fetch:154`; create `onClick:533 → fetch:292`; accept `:199` + bulk-create `:215` |
| **Routine — `RoutineList`/`RoutineRow`** | `useEffect:66-69` → `fetch('/api/operations/routines?is_active=true')`:51. `entities` is a **prop** (`:33`) — no own entity fetch. `RoutineRow`/`RRULEBuilder` = **no mount fetch.** | name `:223`, description `:233`, entity `:243`, cadence via `RRULEBuilder` (mode/days/day-of-month/nth-weekday/custom RRULE/hour-min/tz), start/end dates `:263`, times `:284` | routines grouped list → `RoutineRow` `:331-356` (no sub-fetch) | create `onClick:305 → fetch:120`; row save `:396→:100` / toggle `:284→:130` / delete `:292→:154` (PATCH/DELETE) |
| **Content — `SectionG_Content`/`ContentTable`** | `useEffect:40-84` → **4 parallel** fetches: `/content/scenes`:46, `/content/takes`:47, `/routines`:48, `/api/entities`:49. `ContentTable`/`AvailableRoutinesList`/`ScenifyModal` = **no mount fetch.** | entity filter `:296`; ScenifyModal: scene #/title/focus/location/hours/script | 14-col `ContentTable` (`HEADERS:113-128`) + `AvailableRoutinesList` | Scenify create `ScenifyModal:73` POST `/content/scenes`; scene PATCH `:116`; take PATCH `:150` |
| **Evolution — `EvolutionTimeline`** | `useEffect:103` → `fetch('/…/evolution')`:109. Read-only (GET). | (none — read view) | the version timeline | (none — no writes; read-only) |

### Per-component verdict + minimal change

The template (A3) requires **(a) no mount fetch, (b) input + empty output rendered,
(c) submit routed to `onRequireAuth`.** None satisfies (a) today. Two ways to get
there per component:

- **Option 1 — `previewMode` prop threaded into the existing component:** add a prop
  that (a) **skips the mount `useEffect` fetch** and seeds empty state
  (`routines=[]`, `projects=[]`, `loading=false`), (b) renders the form + an empty
  output table, (c) makes every submit/AI `onClick` call `onRequireAuth()` instead of
  `fetch`. **Risk:** the fetch is in *multiple* places (parent + nested `TaskList`,
  `EvolutionTimeline`, the 4 content fetches, the context provider) — every one must
  be guarded or a guest fires a call. Easy to miss one → the hard security line
  breaks silently.
- **Option 2 — extract a presentational input form (the Travel/Trading way,
  RECOMMENDED):** pull the **input form JSX** (which already holds only local state)
  into a self-contained component with **no fetch code at all** + an injected
  `onRequireAuth` submit — exactly how `CreateTripForm` was extracted "VERBATIM" from
  the trips page (`CreateTripForm.tsx:26-29`) and `ScanFilterForm` from the
  dashboard. The extracted form is **safe by construction** (no fetch exists to fire)
  and reused on both home (gated) and the dashboard (wired to the real POST).

| Component | Render logged-out as-is? | Minimal change (recommended) | Fires paid/AI on mount? |
|---|---|---|---|
| **Routine form** | ❌ (mount fetch `:51`) | **Easiest.** Extract the create-form JSX (`RoutineList:215-320` + `RRULEBuilder`, both already local-state/no-fetch) into `RoutineCreateForm`; home mounts it with `onRequireAuth` on the create button. Output = an empty routines table (static). | No (AI is not in routine create) |
| **Content form** | ❌ (4 mount fetches `:46-49`) | Extract the **ScenifyModal** input fields + a static empty 14-col `ContentTable` header (`ContentTable` already takes data via props — pass `[]`). Gate the Scenify submit. | No paid AI; but 4 authed fetches on mount today — must be removed in the extracted form |
| **Project form** | ❌ (mount fetch `:252` + context + child fetches) | **Last / hardest.** Extract the 5-step create form (`SectionD:344-578`, `ListManager`s are local) into `ProjectCreateForm`; **the two AI buttons (generate-design `:427`, generate-tasks `:541`) are the paid calls — in gated mode both must route to `onRequireAuth`, never to `fetch:93/:154`.** Provide a static `entities` list (the home form has no `useOperationsEntity` provider). Output = empty task table. | **YES — the only paid surface.** generate-design/generate-tasks call paid AI. Hard line: in gated mode these must not fetch. |
| **Evolution view** | ❌ (mount fetch `:109`) | Already read-only; for home show the **timeline chrome with no data** — either a tiny `sampleData`/`previewMode` prop that renders an empty spine **without** the `useEffect` fetch, or extract the presentational timeline (the render half) and feed it `[]`. No submit to gate. | No |

---

# Recommended build sequence (one component per PR, simplest-first)

> Each PR extracts a presentational, **fetch-free** input form (Option 2) and mounts
> it in `ModuleLauncher` for `operations`, replacing one quarter of
> `OperationsShowroom`, with the submit/AI action routed to `onRequireAuth`
> (`ModuleLauncher.tsx:40`) — the exact prop Travel/Trading reuse.

1. **HOME-OPS-PR-1 · Routine form** (no AI; single mount fetch to drop). Extract
   `RoutineCreateForm` (cadence inputs + `RRULEBuilder`) + a static empty routines
   table. Lowest risk — proves the extraction pattern.
2. **HOME-OPS-PR-2 · Evolution view** (read-only). A presentational empty timeline
   (no `useEffect` fetch). No submit. Trivial once PR-1 sets the precedent.
3. **HOME-OPS-PR-3 · Content form** (no paid AI, but 4 mount fetches). Extract the
   Scenify input fields + a static empty 14-col `ContentTable`.
4. **HOME-OPS-PR-4 · Project form** (LAST — the AI/paid surface). Extract the 5-step
   `ProjectCreateForm`; **explicitly route generate-design + generate-tasks to
   `onRequireAuth`** so no paid call can fire logged-out (the hard line). Provide a
   static `entities` list (no context provider on home).
5. **HOME-OPS-PR-5 · retire `OperationsShowroom`** once all four real forms are
   mounted; delete the fabricated component.

---

# Security verdict

**Yes — each can be made to fire ZERO server/paid calls when logged out**, but **only
via the extraction (Option 2) or a rigorously-guarded `previewMode`**, because today
**every** Operations surface self-fetches on mount (Project `:252` + context
`/api/entities` + child `TaskList`/`EvolutionTimeline`; Routine `:51`; Content 4× at
`:46-49`; Evolution `:109`). The **recommended extraction is safe by construction**:
the extracted input form contains *no fetch code*, so there is nothing to fire — the
same property that makes `CreateTripForm`/`ScanFilterForm` safe on the public page.
The **single hardest line** is the Project form's two **paid AI** buttons
(generate-design `:93`, generate-tasks `:154`): in the home/gated variant these
**must** call `onRequireAuth`, never `fetch`. All other Operations submits are
non-AI writes, also routed to `onRequireAuth`.

---

# Sign-off items
1. **Extraction (Option 2) vs `previewMode` prop (Option 1)** — recommend extraction
   (matches Travel/Trading exactly; safe by construction). Confirm.
2. **Hard line on the Project form** — confirm generate-design + generate-tasks route
   to `onRequireAuth` in the home variant (zero paid call logged-out).
3. **Static `entities` on home** — the project/routine forms need an `entities` list;
   home has no `useOperationsEntity` provider. Confirm a static placeholder entity
   (e.g. "Your business") for the gated preview, since submit just opens the modal.
4. **Output tables on home** — render **empty** real tables (Travel/Trading show no
   output on home). Confirm empty-state tables vs input-only.
5. **Sequence** — Routine → Evolution → Content → Project (AI last), then retire
   `OperationsShowroom`. Confirm.
6. **Dashboard reuse** — the extracted forms should also replace the inline forms on
   the real `/operations` dashboard (one component, two mounts — the Travel pattern),
   so there's no divergence. Confirm in-scope.

---

**READ-ONLY audit. No implementation performed.**
