# Showroom Pipeline — Current-State Audit

**Date:** 2026-06-09
**Branch:** `claude/audit-showroom-pipeline` (merged to current `origin/main` `8ea6f2a4` before auditing, so all citations reflect current main).
**Method:** Read-only. Every claim cites `file:line`. Unverifiable items marked **MISSING**.

> **One-line answer to the security question (full detail in RISKS):** **No** — no live user
> project/task data renders, or can render, on the public home page during SSR. `/` is a **client
> component** (`src/app/page.tsx:1`) with **zero** server data access, and it renders the
> **fetch-free** `OperationsShowroom`, **not** the live `SectionD_ProjectBacklog`/`ProjectRow` tree.

---

## 1. COMPONENT INVENTORY

All five are **named, default-exported** components (none are inline JSX). **All five are IMPURE** —
each reads React hooks / context and/or self-fetches `/api/...`; none is props-only.

### SectionD_ProjectBacklog
- **File:** `src/components/workbench/operations/SectionD_ProjectBacklog.tsx` (161 lines).
- **Exported:** `export default function SectionD_ProjectBacklog()` `:25` (named, default export).
- **Prop signature:** **none** — `function SectionD_ProjectBacklog()` `:25` (takes no props).
- **DATA SOURCE — IMPURE:**
  - Context: `const { entities, selectedEntityId } = useOperationsEntity();` `:26`.
  - State: `useState` `:28-44`; effect: `useEffect(... fetchProjects ...)` on mount + `[selectedEntityId, showArchived]` `:70-73`.
  - **fetch:** `GET /api/operations/projects[?entity_id=&include_archived=]` — `fetch(url)` `:55` (url built `:50-54`).
- **Call sites:** `src/app/operations/projects/page.tsx:12` (`return <SectionD_ProjectBacklog />;`).

### ProjectRow
- **File:** `src/components/workbench/operations/projects/ProjectRow.tsx` (857 lines).
- **Exported:** `export default function ProjectRow({...}: Props)` `:87`.
- **Prop signature:** `interface Props` `:34-46` — `project: Project` `:35`, `entities: Entity[]` `:36`, `allProjects: Project[]` `:37`, `onUpdate: () => void` `:38`, `onDelete: () => void` `:39`, `isJumpTarget: boolean` `:42`, `onClearTarget: () => void` `:44`, `onJumpTo: (projectId: string) => void` `:45`.
- **DATA SOURCE — IMPURE:** `useEffect/useRef/useState` `:19,88-90`. Self-fetches on user action:
  - `PATCH /api/operations/projects/${project.id}` `:166`, `:191`, `:323`, `:348`.
  - `POST .../generate-design` `:215` (**paid AI**), `POST .../generate-tasks` `:252` (**paid AI**).
  - `DELETE /api/operations/projects/${project.id}` `:296`.
- **Call sites:** `SectionD_ProjectBacklog.tsx:145` (`<ProjectRow … />`).

### TaskList
- **File:** `src/components/workbench/operations/projects/TaskList.tsx` (323 lines).
- **Exported:** `export default function TaskList({ projectId, entity_id }: Props)` `:26`.
- **Prop signature:** `interface Props` `:21-24` — `projectId: string`, `entity_id: string`.
- **DATA SOURCE — IMPURE:** `useEffect/useState` `:16,27-29`; mount effects `:66`, `:77`.
  - **fetch:** `GET /api/operations/projects/${projectId}/tasks[?include_archived]` `:49-51`; `GET /api/chart-of-accounts?entity_id=…` `:89`; `POST .../tasks` `:138`.
- **Call sites:** `ProjectRow.tsx:517` (`<TaskList projectId={project.id} entity_id={project.entity_id} />`).

### EvolutionTimeline
- **File:** `src/components/workbench/operations/projects/EvolutionTimeline.tsx` (212 lines).
- **Exported:** `export default function EvolutionTimeline({ projectId }: Props)` `:98`.
- **Prop signature:** `interface Props` `:48-50` — `projectId: string`.
- **DATA SOURCE — IMPURE:** `useEffect/useState` `:19,99`; mount effect `:103`.
  - **fetch:** `GET /api/operations/projects/${projectId}/evolution` `:109`.
- **Call sites:** `ProjectRow.tsx:530` (`{showEvolution && <EvolutionTimeline projectId={project.id} />}`).

### DependencyList
- **File:** `src/components/workbench/operations/projects/DependencyList.tsx` (351 lines).
- **Exported:** `export default function DependencyList({ projectId, allProjects, onJumpTo }: Props)` `:43`.
- **Prop signature:** `interface Props` `:33-39` — `projectId: string`, `allProjects: Project[]`, `onJumpTo: (projectId: string) => void`.
- **DATA SOURCE — IMPURE:** `useEffect/useState` `:22,44-46`; mount effect `:77`.
  - **fetch:** `GET .../dependencies` `:60`; `POST .../dependencies` `:98`; `DELETE .../dependencies/...` `:122`.
- **Call sites:** `ProjectRow.tsx:534` (`<DependencyList … />`).

**Render tree:** `operations/projects/page.tsx:12` → `SectionD_ProjectBacklog` → `ProjectRow` (`SectionD:145`) → `TaskList`/`EvolutionTimeline`/`DependencyList` (`ProjectRow:517,530,534`). **This tree is NOT on the home page** (see §2, §4, RISKS).

---

## 2. EXISTING OperationsShowroom

- **File:** `src/components/home/OperationsShowroom.tsx` (120 lines). `export default function OperationsShowroom({ onRequireAuth }: Props)` `:77`; `interface Props { onRequireAuth: () => void }` `:32-36`; inner `Panel` `:42`.
- **What it renders:** four `Panel`s wrapping **fetch-free home-specific** components — **NOT** the live §1 tree:
  - `<ProjectCreateForm onRequireAuth={onRequireAuth} />` `:93` (`@/components/home/ProjectCreateForm` `:27`).
  - `<RoutineCreateForm … />` `:100` (`:28`).
  - `<ContentPreview />` `:108` (`:29`).
  - `<EvolutionPreview />` `:115` (`:30`).
- **Live data?** **NO.** Grep `fetch(` in `OperationsShowroom.tsx` → 0 matches (only comment mentions at `:9,91`). It imports **none** of `SectionD_ProjectBacklog`/`projects/ProjectRow`/`TaskList`/`EvolutionTimeline`/`DependencyList` (grep over `src/components/home/` → only a *comment* reference in `home/ProjectCreateForm.tsx:9,35,56`, no import). The four panel components each have **0 `fetch(`** (verified: `home/ProjectCreateForm.tsx`, `RoutineCreateForm.tsx`, `ContentPreview.tsx`, `EvolutionPreview.tsx` all 0). The only action is `onRequireAuth` (the login modal), `:66`.
- **Imported/rendered at:** `src/components/home/ModuleLauncher.tsx:7` (import), `:114` (render). No other importers (grep).

---

## 3. ModuleLauncher

- **File:** `src/components/home/ModuleLauncher.tsx` (172 lines). `'use client'` `:1`; `export default function ModuleLauncher({ onRequireAuth }: Props)` `:44`.
- **Imports/renders OperationsShowroom:** import `:7`; in `renderBody`, `if (m.key === 'operations') { … return <OperationsShowroom onRequireAuth={onRequireAuth} />; }` `:110-114`. The card tag reads `'Live demo · log in to use'` `:160`.
- **Home-page tree position:** `src/app/page.tsx` (`LandingPage`) imports it `:7` and renders `<ModuleLauncher onRequireAuth={() => { setLoginMode('register'); setShowLogin(true); }} />` `:74` (directly under the hero). `MODULES` order `:30-35`: travel, trading, **operations**, bookkeeping, tax, compliance.
- **Own data access:** `ModuleLauncher` (client) fetches `/api/auth/me` on mount (`fetch('/api/auth/me')` `:55`) to set logged-in/admin state — this is **auth detection**, not project/task data, and runs client-side after hydration.

---

## 4. HOME PAGE RENDER PATH (security core)

- **Renders `/`:** `src/app/page.tsx` — `export default function LandingPage()` `:9`.
- **Server vs client:** **CLIENT component** — `'use client'` is the first line (`src/app/page.tsx:1`). It uses `useState` `:3` for the login modal.
- **Server data access during render:** **NONE.** Grep of `src/app/page.tsx` for `prisma | getCurrentUser | verifyCookie | requireTier | getServerSession | cookies() | await fetch | generateMetadata` → **0 matches**. There is no module-scope or render-time server query; no `generateMetadata`; no server component wrapper. (The page-level provider is just the client `LandingPage`.)
- **`/` in `PUBLIC_PATHS`?** **YES** — `src/middleware.ts:51` (`'/'`), inside `PUBLIC_PATHS` `:50-64`. `isPublic` prefix-matches `:66-67`. So `/` is reachable logged-out.
- **Props/data passed into the home tree:** the only data threaded in is the **`onRequireAuth` callback** (`page.tsx:74` → `ModuleLauncher` → `OperationsShowroom` → panels). No project, task, user, or entity object is passed. `ModuleLauncher` derives `authed`/`isAdmin` client-side from `/api/auth/me` (`:55`); `OperationsShowroom` and its panels receive only `onRequireAuth`.

---

## 5. DATA SHAPE (Prisma schema — `prisma/schema.prisma`)

### operations_projects (`:2650-2688`) — backs SectionD/ProjectRow
`id String @id @db.Uuid` `:2651`; `user_id String` `:2652`; `entity_id String` `:2653`; `title VarChar(500)` `:2654`; `goal/problem/diagnosis/design Text?` `:2655-2658`; `goal_items/problem_items/diagnosis_items Json @db.JsonB` `:2659-2661`; `deep_research_input/claude_code_audit_input Text?` `:2662-2663`; `status ProjectStatus` `:2664`; `target_completion_date Timestamptz?` `:2665`; `estimated_total_minutes Int?` `:2666`; `estimated_total_cost_usd Decimal(15,2)?` `:2667`; `priority_score Decimal(10,4)?` `:2668`; `priority_inputs_hash/priority_computed_at/priority_rationale` `:2669-2671`; `created_at/updated_at/created_by` `:2672-2674`.
- **Relations:** `tasks operations_project_tasks[]` `:2676`; `outgoing_dependencies` / `incoming_dependencies operations_project_dependencies[]` `:2677-2678`; `linked_issues` `:2679`; `content_pieces` `:2680`. `@@unique([user_id, title])` `:2682`.

### operations_project_tasks (`:2690-2730`) — backs TaskList
`id Uuid` `:2691`; `project_id Uuid` `:2692`; `user_id` `:2693`; `entity_id` `:2694`; `title VarChar(500)` `:2695`; `description Text?` `:2696`; `status OperationsTaskStatus` `:2697`; `estimated_minutes Int?` `:2698`; `estimated_cost_usd Decimal(15,2)?` `:2699`; `deadline Timestamptz?` `:2700`; `priority_*` `:2701-2704`; `unblocks_label/link_url/notes Text?` `:2705-2707`; `coa_code VarChar(50)?` `:2708`; `actual_cost_usd/actual_minutes` `:2709-2710`; `display_order Int` `:2711`; `completed_at Timestamptz?` `:2712`; `source_ai_usage_id Uuid?` `:2713`; `created_at/updated_at/created_by` `:2714-2716`.
- **Relations:** `project operations_projects @relation(... onDelete: Cascade)` `:2718`; `source_ai_usage operations_ai_usage? @relation("TaskSourceAiUsage", ... onDelete: SetNull)` `:2719`; `daily_plan_items` `:2720`; `status_history` `:2721`.

### operations_project_dependencies (`:2795-2812`) — backs DependencyList
`id Uuid` `:2796`; `project_id Uuid` `:2797`; `depends_on_project_id Uuid` `:2798`; `dependency_type ProjectDependencyType` `:2799`; `rationale Text?` `:2800`; `created_at/created_by` `:2801-2802`.
- **Relations:** `project @relation("project_dependency_source", ... onDelete: Cascade)` `:2804`; `depends_on_project @relation("project_dependency_target", ... onDelete: Cascade)` `:2805`. `@@unique([project_id, depends_on_project_id, dependency_type])` `:2807`.

### operations_ai_usage (`:3052-3078`) — backs EvolutionTimeline
The evolution endpoint reads tasks grouped by their `source_ai_usage_id` "version" and hydrates from `operations_ai_usage` (`evolution/route.ts:5-13, 60-84`). Fields: `id Uuid` `:3053`; `user_id` `:3054`; `model VarChar(100)` `:3055`; `purpose VarChar(100)` `:3056`; `target_table/target_id` `:3057-3058`; `input_tokens/output_tokens Int` `:3059-3060`; `cost_usd Decimal(10,6)` `:3061`; `inputs_summary/output_summary/full_system_prompt/full_user_message/full_response Text?` `:3062-3066`; `created_at/created_by` `:3067-3068`.
- **Relations:** `user users` `:3070`; `generated_tasks operations_project_tasks[] @relation("TaskSourceAiUsage")` `:3071`; `generated_pieces` `:3072`.

---

## 6. EXISTING SEED / DEMO INFRASTRUCTURE

- **`prisma/seed.ts`?** **MISSING** — no `prisma/seed.ts`; no `"prisma": { "seed": … }` block and no `"seed"` script in `package.json` (only `seed:regulatory` → `src/lib/regulatory/seedRegulatorySources.ts`, build runs `prisma generate && prisma migrate deploy`).
- **Seed scripts that exist** (none for operations projects): `prisma/seed-coa.ts`, `seed-coa-complete.ts`, `seed-trading-coa.ts`, `seed-destinations.ts` (+ `-2/-3`), `prisma/seed-data/regulatory_sources.json`. **No project/task fixtures.**
- **Demo/fixture/mock data for projects anywhere?** **MISSING** — `grep -rilE "fixture|mockProject|demoProject|sampleProject|SAMPLE_PROJECT" src/` → 0 matches. The home showroom panels carry **local form state only** (`home/ProjectCreateForm.tsx:35` "Local form state only … No fetch seeds it"); they render empty structure, not seeded rows.
- **How static demo data would reach a component today:** only via **props** — the §1 components don't accept a "data" prop (`SectionD` takes no props; `ProjectRow` takes a live `project: Project` object). There is no existing prop/path that injects static demo rows into the live tree.

---

## EXISTS

- The five live components (§1), all impure, rendered only under `operations/projects/page.tsx:12` → `SectionD … ProjectRow … {TaskList,EvolutionTimeline,DependencyList}`.
- A working **fetch-free** public showroom: `OperationsShowroom` (§2) mounted via `ModuleLauncher:114` on the public home page (`page.tsx:74`), gating every action through `onRequireAuth`.
- The backing Prisma models (§5).
- The auth boundary: `/operations*` is **not** in `PUBLIC_PATHS` (`middleware.ts:50-64`); the projects GET API is auth-gated (`getVerifiedEmail`, `projects/route.ts:42`) and user-scoped (`where: { user_id: user.id }`, `:57`).

## EXISTS BUT UNUSED

- The **stale prior report** `audit-reports/showroom-pipeline-audit.md` is on this branch (superseded by this file).
- `home/ProjectCreateForm.tsx` comments reference `SectionD_ProjectBacklog` by name/line (`:9,35,56`) but **do not import or render it** — documentation only.

## MISSING

- No `prisma/seed.ts`, no `package.json` seed entry, no project/task **fixture/mock/demo** data anywhere (§6).
- No existing mechanism to inject static demo rows into the live §1 components (they consume live `project` objects / self-fetch; none takes a static-data prop).

## REUSABLE

- `OperationsShowroom` + `Panel` (`OperationsShowroom.tsx:42-120`) — the proven fetch-free, `onRequireAuth`-gated container already wired into the home page.
- The four fetch-free home panels (`home/ProjectCreateForm`, `RoutineCreateForm`, `ContentPreview`, `EvolutionPreview`) — each 0 `fetch`.
- The `onRequireAuth` thread (`page.tsx:74` → `ModuleLauncher:114` → panels).
- The model field lists (§5) define the exact shape any static demo object must match.

## RISKS

**"Does any live user project/task data currently render — or could it render — on the public home page during SSR?"**

**NO (current state).** Cited path:
1. `/` is served by `src/app/page.tsx`, a **client component** (`'use client'`, `:1`) — there is **no server render that touches data** (no `prisma`/`getCurrentUser`/`cookies()`/`generateMetadata`/server `fetch` — grep = 0, §4).
2. `page.tsx:74` renders `ModuleLauncher`, whose operations branch renders `OperationsShowroom` (`ModuleLauncher.tsx:114`), which renders only the **fetch-free** `home/` panels (`OperationsShowroom.tsx:93-115`) — it does **not** import or mount `SectionD_ProjectBacklog`/`ProjectRow`/`TaskList`/`EvolutionTimeline`/`DependencyList` (§2).
3. The live §1 tree renders **only** at `/operations/projects` (`operations/projects/page.tsx:12`), which is **not public** (`middleware.ts:50-64`), and even there each component **self-fetches client-side** from auth-gated, user-scoped APIs (`projects/route.ts:42,57`) — i.e. live data arrives after hydration via the user's own session, never during a public SSR.

**Latent risk (not present today, but the boundary to preserve):** the live components are impure self-fetchers (§1). If a future change were to import `SectionD_ProjectBacklog` (or any of the tree) into `OperationsShowroom`/`ModuleLauncher`/`page.tsx`, it would, on the **public** `/`, fire `GET /api/operations/projects` from the *visiting* browser. That call is itself user-scoped and returns 401 for a logged-out visitor (`projects/route.ts:42`), so it would render empty rather than leak — **but** it would also break the showroom's "no server/paid call logged-out" guarantee (`OperationsShowroom.tsx:4-5` documents this invariant), and `ProjectRow`'s paid-AI buttons (`generate-design` `:215`, `generate-tasks` `:252`) would become reachable. The current code does **not** do this; the home tree passes only `onRequireAuth` (§4) and renders fetch-free panels.

*(No SSR data leak path exists today. The home page is client-only and the showroom is fetch-free.)*

---

*End of audit. No source files were modified; only this report was created.*
