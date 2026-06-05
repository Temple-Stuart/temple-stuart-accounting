# Audit — Content Tab Creation Consolidation

**Status:** AUDIT ONLY (read-only investigation, no implementation)
**Date:** 2026-06-05
**Goal context:** Add "Make a project" + "Make a routine" creation forms to the top of
Operations › Content, above the `1 · INPUTS` section, mirroring the homepage live-demo
layout.
**Deliverable:** verified code map + recommended implementation approach, sized as one PR.

---

## 1 · Content Tab Structure

### Page + root component
- **Route page:** `src/app/operations/content/page.tsx:20-22` — a thin wrapper that renders
  `<ContentPipeline />` and nothing else.
- **Root component:** `src/components/workbench/operations/content/ContentPipeline.tsx`
  (`'use client'`, ~395 lines). This single component owns the *entire* Content tab
  composition top-to-bottom.

### How the numbered sections are structured
The four pipeline sections are **NOT** separate components — they are inline `<section>`
blocks rendered directly inside `ContentPipeline`'s JSX:

| Section | Where | Notes |
|---|---|---|
| `1 · INPUTS` | `ContentPipeline.tsx:253-362` | Inline `<section>`. Left = routines list (selectable), right = project-tasks list ("+ add to day"). Both rendered inline, not child components. |
| `2 · AI SCRIPT MAP` | `ContentPipeline.tsx:364-367` | Conditional child `<ScenifyDraft>` (renders only when ≥1 routine selected). |
| `3 · ANSWER + RECORD` | `ContentPipeline.tsx:369-389` | Inline `<section>` wrapping child `<DailyLog>` + `<PieceGrid>`. |
| `4 · SCRIPT` | `ContentPipeline.tsx:391-392` | Child `<ScriptGenerator>`. |

So the target insertion point ("above `1 · INPUTS`") is concretely **between the header
block (`ContentPipeline.tsx:216-245`) / error banner (`247-251`) and the INPUTS `<section>`
opening at line 254.**

### Entity filter propagation (All / Business / Personal Finances / Trading)
- **Mechanism: React Context**, not props or URL params.
- Provider `OperationsEntityProvider` is mounted once in the Operations layout:
  `src/app/operations/layout.tsx:18` (wraps the whole subtree). It fetches `/api/entities`
  and persists the selection to `localStorage` key `operations-entity-id`
  (`EntitySelector.tsx:26, 38-98`).
- Consumers call `useOperationsEntity()` (`EntitySelector.tsx:30-36`). `ContentPipeline`
  reads `{ entities, selectedEntityId, setSelectedEntityId }` at
  `ContentPipeline.tsx:68`.
- **Important Content-tab nuance:** the Content tab does **not** filter its source lists by
  the selected entity. `load()` fetches routines and unscheduled tasks **cross-entity**
  (`ContentPipeline.tsx:108-127`, comment lines 108-109). The selector here only governs
  which entity a *new day-piece* is filed under (`ContentPipeline.tsx:139-144, 229-243`).
  The "All/Business/…" tab strip (`EntitySelector.tsx:100-129`, `EntitySelectorStrip`) is
  the same context but is **not mounted on the Content tab** — only the inline `<select>`
  at `ContentPipeline.tsx:230-242` is.

---

## 2 · Existing Creation Forms

There are **two independent implementations** of each form — a demo (home) copy and a real
(dashboard) copy. They are NOT the same component; they share only low-level primitives.

### "Make a project"
| | Homepage live demo | Projects tab (real) |
|---|---|---|
| File | `src/components/home/ProjectCreateForm.tsx` | `src/components/workbench/operations/SectionD_ProjectBacklog.tsx` |
| Mounted by | `OperationsShowroom.tsx:92-94` (Panel 01) | `src/app/operations/projects/page.tsx:11` |
| Form state | local `useState<ProjectForm>(DEFAULT_PROJECT_FORM)` (`ProjectCreateForm.tsx:37`) | local `useState<ProjectForm>` (`SectionD:42`) |
| Submit | **none** — every button calls `onRequireAuth()` and returns (`ProjectCreateForm.tsx:50-52, 126-177`) | real `POST /api/operations/projects` (`SectionD:288-309`) + AI design/tasks + bulk-create (`SectionD:75-243`) |
| Shared primitives | `ListManager`, `ProjectForm`/`DEFAULT_PROJECT_FORM` types | same `ListManager` (`SectionD:22`), same types (`SectionD:24-25`) |

### "Make a routine"
| | Homepage live demo | Routines tab (real) |
|---|---|---|
| File | `src/components/home/RoutineCreateForm.tsx` | `src/components/workbench/operations/routines/RoutineList.tsx` (create form is inline, `RoutineList.tsx:210-321`) mounted via `SectionE_Routines.tsx:47` |
| Mounted by | `OperationsShowroom.tsx:99-101` (Panel 02) | `src/app/operations/routines/page.tsx:11` → `SectionE_Routines` |
| Form state | local `useState<RoutineForm>(DEFAULT_ROUTINE_FORM)` (`RoutineCreateForm.tsx:35`) | local `useState<RoutineForm>` (`RoutineList.tsx:40`) |
| Submit | **none** — `handleCreate` calls `onRequireAuth()` and returns (`RoutineCreateForm.tsx:48-50`) | real `POST /api/operations/routines` (`RoutineList.tsx:116-143`) |
| Shared primitives | `RRULEBuilder`, `RoutineForm`/`DEFAULT_ROUTINE_FORM`, `CADENCE_*` | same `RRULEBuilder` (`RoutineList.tsx:18`), same types (`RoutineList.tsx:19-20`) |

### Props required
- **`ProjectCreateForm`** — `{ onRequireAuth: () => void }` (`ProjectCreateForm.tsx:28-32`).
- **`RoutineCreateForm`** — `{ onRequireAuth: () => void }` (`RoutineCreateForm.tsx:27-31`).
- **`SectionD_ProjectBacklog`** — **no props**; pulls everything from `useOperationsEntity()`
  context (`SectionD:34-35`). Manages its own submit.
- **`RoutineList`** — `{ entities: Entity[]; onCommitted?: () => void }`
  (`RoutineList.tsx:28-33`). Self-fetches on mount (`RoutineList.tsx:66-69`). Manages its own
  submit; `onCommitted` notifies the parent (`SectionE`) to refetch sibling surfaces.

### API routes + auth pattern (confirmed by reading handlers)
- **Projects:** `POST /api/operations/projects` →
  `src/app/api/operations/projects/route.ts:99` (`export async function POST`).
  Auth = `getVerifiedEmail()` from `@/lib/cookie-auth` (`route.ts:23, 101`), then resolves
  the `users` row and verifies entity ownership; audits via `writeAuditLog` (`route.ts:299`).
- **Routines:** `POST /api/operations/routines` →
  `src/app/api/operations/routines/route.ts`. Same cookie pattern:
  `getVerifiedEmail()` from `@/lib/cookie-auth` (`route.ts:18`, used in GET at `:67` and the
  POST handler). Server compiles `schedule_rrule` from the form (never trusts a client
  string) and audits `operations_routine_created`.
- **AI (project create only):** `POST /api/operations/ai/generate-design`
  (`SectionD:93`) and `POST /api/operations/ai/generate-tasks` (`SectionD:154`); accepted
  tasks land via `POST /api/operations/projects/{id}/tasks/bulk-create` (`SectionD:215`).

> **Auth pattern note:** the codebase uses `getVerifiedEmail()` (cookie-auth), not a
> `verifyCookie`/`getCurrentUser` helper. All four routes follow the same shape:
> `getVerifiedEmail()` → 401 if absent → `prisma.users.findFirst` → 404 if absent.

---

## 3 · Reusability Assessment

### Can the homepage demo forms drop into the Content tab as-is? **No.**
They are coupled to demo/no-server mode by construction. Exact coupling points:

1. **No real submit — everything gates to login.**
   - `ProjectCreateForm.tsx:50-52` (`gate = () => onRequireAuth()`), wired to *every* button:
     create (`:166-167`), generate plan (`:126-127`), preview tasks (`:172-174`).
   - `RoutineCreateForm.tsx:48-50` (`handleCreate = () => onRequireAuth()`), wired to the
     create button (`:135-136`).
   - Button labels are literally "Create project → log in" / "Create routine → log in"
     (`ProjectCreateForm.tsx:170`, `RoutineCreateForm.tsx:139`).
2. **Required `onRequireAuth` prop** with no real-mode branch — there is no path that POSTs
   (`ProjectCreateForm.tsx:28-32`, `RoutineCreateForm.tsx:27-31`).
3. **Entity selector is a disabled placeholder**, not the real entity list:
   `<select disabled><option>Your workspace · set after login</option></select>`
   (`ProjectCreateForm.tsx:74-76`, `RoutineCreateForm.tsx:82-84`). The comment explicitly
   says "no `/api/entities` fetch here".
4. **Empty output tables hard-coded** ("0 tasks", "0 routines", "appear here once you log
   in") — `ProjectCreateForm.tsx:182-200`, `RoutineCreateForm.tsx:144-172`.

Dropping these in would render a logged-in user a form whose buttons re-open a login modal
and whose entity field is permanently disabled — wrong behavior.

### Are the Projects/Routines tab forms the better reuse candidates? **Yes — but they are
not currently standalone.**
- The real create UIs already do exactly what the Content tab needs (real POST, real entity
  `<select>` from context, validation, error states). They are the correct source of truth.
- **However**, neither is an extractable standalone component today:
  - The project create form is inline JSX inside `SectionD_ProjectBacklog`
    (`SectionD:344-579`), entangled with the AI design/tasks preview state machine
    (`SectionD:51-243`) and the project-list render (`SectionD:581-605`).
  - The routine create form is inline JSX inside `RoutineList` (`RoutineList.tsx:210-321`),
    entangled with the list fetch + cadence grouping + scenify/takeify optimistic updates
    (`RoutineList.tsx:44-170`).
- Both share the genuinely reusable, already-decoupled primitives: `ListManager`,
  `RRULEBuilder`, and the `ProjectForm`/`RoutineForm` types + `DEFAULT_*` defaults
  (`projects/types.ts:56-80`, `routines/types.ts:140-227`).

---

## 4 · Post-Create Data Refresh

The Content tab uses **plain `fetch` + `useState` + custom window events** — there is **no
SWR / React Query / `router.refresh()`** anywhere in `ContentPipeline`.

### PROJECT TASKS queue (the right column of `1 · INPUTS`)
- Sourced by `load()` → `GET /api/operations/tasks/unscheduled`
  (`ContentPipeline.tsx:110-127`, set at `:121`).
- Refreshed only on the custom event `CONTENT_DAY_PLAN_CHANGED_EVENT`
  (`ContentPipeline.tsx:155-163`; event constant defined in `ScenifyModal.tsx:29`), which is
  dispatched after add-to-day (`ContentPipeline.tsx:200`).
- **Nothing dispatches this event on project/task creation today** — a newly created
  project's tasks would not appear without a manual reload.

### ROUTINES list (the left column of `1 · INPUTS`)
- Sourced by the same `load()` → `GET /api/operations/routines`
  (`ContentPipeline.tsx:114-120`, set at `:119`).
- Same refresh wiring: `load()` runs on mount (`:129-131`) and on
  `CONTENT_DAY_PLAN_CHANGED_EVENT` (`:155-163`). No routine-created trigger exists.

### What's required for a newly created project/routine to appear without a manual reload
The simplest in-pattern hook is to call the existing `load()` after a successful create.
Two viable options (both already idiomatic here):
1. **Direct callback:** pass an `onCreated` handler into the new Content-tab forms that calls
   `load()` (and `loadCounts()` if relevant) — mirrors `RoutineList`'s `onCommitted`
   (`RoutineList.tsx:71-74`) and `SectionD`'s `fetchProjects()` after create (`SectionD:303`).
2. **Custom event:** after create, `window.dispatchEvent(new Event(CONTENT_DAY_PLAN_CHANGED_EVENT))`
   — the existing listener (`ContentPipeline.tsx:155-163`) already re-runs `load()`,
   `loadDayItems()`, and `loadCounts()`. (Slightly broader than needed but zero new wiring.)

Recommended: option 1 (explicit `onCreated → load()`), because the day-plan event also
triggers `loadDayItems`/`loadCounts` which are irrelevant to a bare project/routine create.

---

## 5 · Risks

### State / context / layout
- **Entity context is available** — `OperationsEntityProvider` already wraps the Content tab
  via `operations/layout.tsx:18`, so a reused real form's `useOperationsEntity()` call works
  with no new provider. ✅ Low risk.
- **The real forms are entangled, not standalone** (see §3). Mounting them "as-is" means
  mounting the *entire* `SectionD_ProjectBacklog` / `RoutineList` — which would also render a
  second full project backlog / routine list on the Content tab (duplicate of the dedicated
  tabs). That is almost certainly not the intent. Extraction is needed to get just the form.
- **Cross-entity vs. entity-scoped mismatch:** Content reads sources cross-entity
  (`ContentPipeline.tsx:108-127`) but the real `SectionD` list is entity-filtered
  (`SectionD:249-251`). The *create forms* themselves are entity-agnostic (they take an
  `entity_id` in the form body), so this only matters for the list views, not the forms —
  but it's a reason not to drop the whole Section in.
- **Routine "entities" prop:** an extracted routine form needs the `entities` array. On the
  Content tab that comes from `useOperationsEntity().entities` (already read at
  `ContentPipeline.tsx:68`), so it can be passed straight through.

### Page length / performance
- `ContentPipeline` is already a long single client component (~395 lines) rendering INPUTS +
  ScenifyDraft + DailyLog + PieceGrid + ScriptGenerator. Adding two full multi-step forms
  (the project form alone is ~230 lines of JSX with an AI preview drawer) at the top makes
  the page substantially longer and pushes the actual pipeline below the fold.
  - Mitigation: mount the new forms **collapsed by default** behind "+ make a project" /
    "+ make a routine" toggles (the exact pattern `SectionD:325-334` and
    `RoutineList.tsx:192-201` already use), so they cost almost nothing until opened.
- The project create form pulls in the AI design + `AITaskPreview` + `InspectionDrawer`
  machinery. If the Content-tab variant doesn't need AI, the extracted component should make
  the AI block optional to keep the bundle lean.

---

## Recommended Implementation Approach (one PR)

**Extract two shared, real-mode form components — do NOT reuse the home demo forms, and do
NOT mount the whole Section components.**

1. **Extract `ProjectCreateForm` (real)** from `SectionD_ProjectBacklog.tsx:344-579` into a
   standalone `projects/ProjectCreateForm.tsx` (dashboard sibling of `ListManager`), taking:
   - `entities` + initial `entity_id` (from `useOperationsEntity()`),
   - an `onCreated` callback,
   - an optional `enableAI` flag (default true) to keep the design/tasks preview reusable.
   Re-mount it inside `SectionD` (no behavior change there) and mount it on the Content tab.
2. **Extract the routine create form** from `RoutineList.tsx:210-321` into a standalone
   `routines/RoutineCreateForm.tsx` (distinct filename from the home demo one) taking
   `{ entities, onCreated }`. Re-mount inside `RoutineList`; mount on the Content tab.
3. **Mount both on the Content tab** above `1 · INPUTS`
   (`ContentPipeline.tsx:253`), collapsed behind "+ make a project" / "+ make a routine"
   toggles to protect page length.
4. **Wire refresh:** pass `onCreated={load}` (plus `loadCounts` where useful) so a new
   project/routine appears in the INPUTS queues immediately (see §4).
5. **No API or schema changes** — both POST routes (`/api/operations/projects`,
   `/api/operations/routines`) and their cookie-auth (`getVerifiedEmail`) are reused as-is.

**Why extract rather than reuse the home forms:** the home forms are deliberately
server-free and gate every action to `onRequireAuth` (§3) — unusable logged-in. The real
forms already POST correctly but are trapped inside list components (§3, §5). One extraction
PR yields a single shared real form per type, used by both the dedicated tab and the Content
tab, with the demo copies left untouched.

**PR size:** moderate and self-contained — two extractions (pure JSX/state moves, no new
logic), two re-mounts in existing Sections, two mounts + one `load()` wire on the Content
tab. No backend, no schema, no new dependencies.

### Open question for the implementer
Should the Content-tab project form include the **paid AI** "generate plan / preview tasks"
buttons, or be a lightweight non-AI create? This is the main behavioral decision (cost
surface + the `enableAI` flag in step 1).
