# ROUTINES GUEST-INTERACTIVE — AUDIT (read-only)

**Branch:** `claude/audit-routines-guest-interactive` · **Date:** 2026-06-21 · **Scope:** what's needed for
a logged-out guest to fully USE the Routines tab — build/edit test routines that live ONLY in browser
memory (React state), saved nowhere — with **zero authed routes** and **zero DB rows**, plus a "sign up to
save" prompt. Read-only; every claim cites `file:line`. Unread = "NOT VERIFIED."

---

## PER-COMPONENT TABLE

| Component | Authed behavior | Guest today | Needed for guest-interactive |
|---|---|---|---|
| `renderBody` routines branch | `<OperationsEntityProvider><SectionE_Routines/></…>` | `<HomeRoutineCreateForm onRequireAuth/>` | keep guest form; make it build-in-memory |
| **`home/RoutineCreateForm`** | (not used) | **fetch-free** input + **static-empty** output; submit→login modal | append form to local `useState`, render the local list, edit/delete locally; "save"→`onRequireAuth` |
| `SectionE_Routines` | mounts `TodaysStrip`+`RoutineList`, `useOperationsEntity()` | **not mounted** | stays authed-only |
| `EntitySelector` (provider) | `GET /api/entities` `:61` | not mounted | authed-only |
| `RoutineList` | `GET /api/operations/routines` `:49-51` | not mounted | authed-only |
| `TodaysStrip` | `GET /api/operations/routines/today` `:73` | not mounted | authed-only |
| `CoaSelect` (budget COA) | `GET /api/chart-of-accounts?entity_id=` `:37` | not mounted (guest form has no COA field) | **DO NOT add — it self-fetches** |
| create route | `POST /api/operations/routines` `route.ts:69` / `:267` | never called by guest | never call for guest |

---

## Q1 — THE AUTHED ROUTINES UI

`ModuleLauncher` renderBody, `m.key === 'routines'`, authed branch: `if (authed === true) return
(<OperationsEntityProvider><SectionE_Routines /></OperationsEntityProvider>)`.

`SectionE_Routines.tsx`:
- `const { entities } = useOperationsEntity()` (`:21`) — consumes the provider (which fetches
  `GET /api/entities`, `EntitySelector.tsx:61`).
- `<TodaysStrip onCommitted={bump} />` (`:40`) — self-fetches `GET /api/operations/routines/today`
  (`TodaysStrip.tsx:73`) + posts completions (`:96`).
- `<RoutineList entities={entities} onCommitted={bump} />` (`:47`) — self-fetches `GET
  /api/operations/routines` (`RoutineList.tsx:49-51`); its create form (workbench
  `routines/RoutineCreateForm.tsx`) **POSTs `/api/operations/routines`** (`:69`) and uses `CoaSelect`
  (the budget COA picker, `:167`); `RoutineRow` does PUT/DELETE `/api/operations/routines/${id}`
  (`:122,152,176`) + `RoutineStepList` step CRUD.

So a logged-in user: picks an entity, sees their existing routines (list + today), creates/edits via the
real form (name/desc/cadence/dates/times **+ budget COA**), each mutation hitting an authed route.

## Q2 — THE GUEST ROUTINES UI TODAY

renderBody, routines, guest branch: `if (authed === false) return <HomeRoutineCreateForm
onRequireAuth={onRequireAuth} />`. That component (`home/RoutineCreateForm.tsx`) is the **fetch-free
extraction** (`:3-16`: *"NO fetch on mount, NO fetch anywhere"*):
- **Interactive INPUT, local-state only:** `useState<RoutineForm>(DEFAULT_ROUTINE_FORM)` (`:35`); real
  fields — name (`:59`), description (`:70`), **entity = a DISABLED placeholder** ("Your workspace · set
  after login", `:82-84`, because there's no `/api/entities` fetch), the real `<RRULEBuilder>` cadence
  (`:89`, controlled/fetch-free), start/end date (`:94-108`), start/end time (`:115-129`). **No
  budget/COA field** (the authed `CoaSelect` self-fetches, so it's omitted).
- **Submit does NOT create:** `handleCreate = () => { onRequireAuth(); }` (`:48-50`) — the "Create routine
  → log in" button (`:134-140`) just opens the login modal. **No local append, no POST.**
- **Output is STATIC EMPTY:** "0 routines" (`:149`), cadence chips all "(0)" (`:153-160`), and *"Your
  routines appear here once you log in and create one."* (`:168-170`).

→ **Gap:** the guest can *fill* the form but can't *build a list* — submit converts to login; the table is
permanently empty. For "guest fully uses / builds test routines live," the form must **append to local
state and render them**, instead of bouncing to the modal.

## Q3 — CAN THE FORM RUN CLIENT-SIDE ONLY? → **YES, it already does**

- The guest form's state is **purely local** (`useState(DEFAULT_ROUTINE_FORM)`, `:35`); it needs **no
  server data to render** — the entity field is a static disabled placeholder (`:82-84`), and
  `RRULEBuilder` is controlled/fetch-free (`:89`).
- **Every authed route the *workbench* Routines UI touches (all 401 for a guest), and how the guest form
  avoids each:**

  | Authed route | Used by | Guest form avoids it by… |
  |---|---|---|
  | `GET /api/entities` | `EntitySelector:61` | disabled placeholder select (`:82-84`) |
  | `GET /api/operations/routines` | `RoutineList:49-51` | static-empty output table (`:146-172`) |
  | `GET /api/operations/routines/today` | `TodaysStrip:73` | TodaysStrip not mounted for guests |
  | `GET /api/chart-of-accounts?entity_id=` | `CoaSelect:37` | **no budget/COA field in the guest form** |
  | `POST/PUT/DELETE /api/operations/routines[...]` | create/RoutineRow | submit → login modal, never POSTs |

  → The guest form **already touches ZERO authed routes**. The only thing missing for interactivity is
  local create/render — which needs **no** new route.

## Q4 — THE "BROWSER MEMORY" MECHANISM → **option (a)/(b), trivially**

- **Feasible & cleanest:** the form **already builds a local `RoutineForm` object** (`:35`). To make it
  interactive: add `const [routines, setRoutines] = useState<RoutineForm[]>([])`; on "Create", **append
  the current form** (with a client-generated id, e.g. `crypto.randomUUID()`) to `routines` and reset the
  form — **instead of** `onRequireAuth()`. Then render `routines` in the **existing output-table
  structure** (replace the static "0 routines"/empty hint with the local list, cadence-grouped like
  `RoutineRow`). Edit/delete mutate the local array. This is options **(a)** (submit appends to useState)
  and **(b)** (the local object is already built — intercept it) combined: same change.
- **NO localStorage / sessionStorage** — state stays in React `useState`, **gone on refresh** (matches the
  platform rule + Alex's intent). Existing ephemeral-client-state patterns to mirror: the form's own
  `useState(DEFAULT_ROUTINE_FORM)` (`RoutineCreateForm.tsx:35`); the showroom `demoData.ts` static arrays.
  **No `localStorage` is used anywhere for this surface** (grep within the routines/home guest path —
  none).

## Q5 — "SIGN UP TO SAVE" CONVERSION → reuse `onRequireAuth`

The register trigger is **already wired into the guest form**: prop `onRequireAuth: () => void`
(`RoutineCreateForm.tsx:30`), passed by `ModuleLauncher` (the same `onRequireAuth` the Hero "Get Started"
uses → `setLoginMode('register'); setShowLogin(true)`). Today `handleCreate` calls it (`:49`). For
guest-interactive, **move that trigger to an explicit "Save" / "Sign up to save these N routines" control**
(a persistent banner above the list, or a Save button next to the local count) — it calls the same
`onRequireAuth()`. No new modal/auth wiring needed; the conversion path already exists.

## Q6 — SECURITY (hard gate) → **ZERO authed calls, ZERO DB writes — confirmed**

Trace of every guest interaction in the proposed design:
- **Render** the Routines tab → `home/RoutineCreateForm` mounts → **no fetch** (`:3-16`, fetch-free).
- **Fill/edit** the form → local `setForm` (`:62,72,…`) → no network.
- **Create** (local append) → `setRoutines([...])` → pure client state, **no POST, no DB row.**
- **Edit/delete** a guest routine → local array mutation → no network.
- **"Sign up to save"** → `onRequireAuth()` → opens the existing client modal → no network until the user
  actually registers/logs in (then the authed app takes over).

→ **The guest fires ZERO authed routes** (`/api/entities`, `/api/operations/routines*`,
`/api/chart-of-accounts`, etc.) and **writes ZERO DB rows.** The authed components
(`SectionE_Routines`/`RoutineList`/`TodaysStrip`/`CoaSelect`/`EntitySelector`) are **not mounted** on the
guest branch, so their self-fetches never fire.

**⚠ THE ONE REGRESSION TO DESIGN OUT:** do **NOT** reuse any **self-fetching workbench component** in the
guest form to add features. Specifically, adding a **budget/COA field via `CoaSelect`** would fire
`GET /api/chart-of-accounts` on mount (`CoaSelect.tsx:37`) → **401 for a guest = a leak/regression.** If a
guest budget field is wanted, it must be a **plain client input** (free-text or a static list), never
`CoaSelect`. Likewise never mount `RoutineList`/`TodaysStrip` for guests. **No route may be made public; no
auth removed** — the guest builds in memory only.

## Q7 — THE BANNER CHECK → **no redundant banner in the Routines guest view**

`home/RoutineCreateForm.tsx` has **no** "make a free account" banner — its only CTAs are the "Create routine
→ log in" button (`:139`) and the empty-table hint *"Your routines appear here once you log in and create
one."* (`:168-170`). Repo grep for the banner text finds it only in `HubCalendar.tsx:261,268` (the calendar
banner — separate, PR1's target) and `projects/showroom/narrativeCopy.ts:83,85` (Projects showroom,
different text). **Neither is in the Routines guest view.** → No banner to remove here.

---

## BUILD APPROACH (security honored)

Make `home/RoutineCreateForm` **interactive in memory** — one component, no new routes:
1. Add `const [routines, setRoutines] = useState<RoutineForm[]>([])` (in-memory only; no localStorage).
2. Rename the action: a **"Add routine"** button appends the current `form` (with `crypto.randomUUID()`)
   to `routines` and resets the form — **replacing** the current `onRequireAuth()` on that button. No POST.
3. Render `routines` in the **existing output-table structure** (`:146-172`), cadence-grouped, with local
   edit/delete; show the real count instead of "0 routines".
4. Add a **"Sign up to save"** control (banner or button) that calls the existing `onRequireAuth()` — the
   only place the modal is triggered now.
5. **Keep it fetch-free:** no `CoaSelect`, no `RoutineList`/`TodaysStrip`, no entity fetch — the entity
   stays the disabled placeholder (or a static client list). Budget/COA, if added, is a plain input.

This reuses the form's existing local state + the existing output scaffold + the existing `onRequireAuth`
trigger — a self-contained client change.

## PR SEQUENCE

1. **PR-1 — Guest routines build-in-memory.** In `home/RoutineCreateForm`: local `routines` state, "Add"
   appends locally + renders the list (edit/delete local), real count. Fetch-free, no new route. One file.
2. **PR-2 — "Sign up to save" conversion.** Add the persistent save prompt/banner wired to the existing
   `onRequireAuth`. (Could merge into PR-1; splitting keeps the build vs the conversion CTA reviewable.)
3. *(Optional later)* — a guest budget field as a **plain** input (NOT `CoaSelect`), if Alex wants budgeted
   test routines — explicitly avoiding the authed COA fetch.

## SECURITY VERDICT (Q6)

**The proposed design keeps the guest's authed-fetch surface and DB-write surface at ZERO.** Guest
interaction is pure React state; the only network action is the user choosing to register via the existing
client modal. The sole regression risk is reusing a self-fetching workbench component (esp. `CoaSelect` →
`/api/chart-of-accounts`) — explicitly **excluded**. No route is made public; no auth is removed. Safe to
post publicly **provided** the guest form stays fetch-free as specified.

---

*Read-only audit. No code changed; this `.md` is the only file created. Core findings: the guest form is
already fetch-free and interactive for INPUT, but submit→login and the output is static-empty; making it
build-in-memory is a one-component change (local `useState` append + render the existing scaffold), reusing
the existing `onRequireAuth` for "sign up to save". The authed workbench Routines UI's four self-fetching
routes (`/api/entities`, `/api/operations/routines`, `/api/operations/routines/today`,
`/api/chart-of-accounts`) are never mounted for guests — keep it that way. Every claim cites `file:line`.*
