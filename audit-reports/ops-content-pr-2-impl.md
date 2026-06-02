# OPS-CONTENT-PR-2 — Read-only project evolution view (trajectory by AI re-run)

**Branch:** `claude/ops-content-pr-2`
**Date:** 2026-06-02
**Scope:** ONE concept — a **read-only** view of a project's trajectory: each AI
re-run rendered as a version (ordered by the immutable `operations_ai_usage`
`created_at`), showing the tasks that re-run added. Reads the `source_ai_usage_id`
column (PR-1) + the ai_usage trail. **0-schema, 0 migration, 0 write paths.**
**No content_pieces, no toggle, no edit affordances.**

> Per `audit-reports/ops-content-evolution-audit.md` (A4): the evolution substrate
> existed (append-only loop + ai_usage version rows + PR-1's task→re-run link) but
> **nothing rendered the trajectory.** This PR builds exactly that view.

---

## STEP 1 — Audit (cited)

- **`operations_project_tasks`** (`prisma/schema.prisma`, post-PR-1): now carries
  `source_ai_usage_id String? @db.Uuid` + relation `source_ai_usage` (named
  `TaskSourceAiUsage`) + `@@index([source_ai_usage_id])`. This is the link the view
  groups by.
- **`operations_ai_usage`** (`schema.prisma:2913-2938`): the immutable per-re-run
  row — `created_at` (the version timestamp), `model`/`purpose`,
  `input_tokens`/`output_tokens`/`cost_usd`, full prompts/response, and
  `target_table`/`target_id` tagging. Inverse relation `generated_tasks` (PR-1).
- **Existing read-route auth pattern (mirrored):** `GET
  /api/operations/projects/[id]/tasks` (`tasks/route.ts:40-64`) —
  `getVerifiedEmail()` → 401; `users.findFirst({ email insensitive })` → 404;
  `operations_projects.findFirst({ id, user_id })` → 404 (defensive cross-user);
  then `findMany`. Also reused its `STATUS_ORDER` map (`:25-32`, incl.
  `superseded`) so a version's tasks sort identically to the rest of the UI.
- **Mount point (recommended + chosen):** `ProjectRow.tsx` expanded **read** view.
  The row already lazy-toggles sub-panels there — "view AI design reasoning"
  (`:392-398`, gated by `showDesignReasoning`) and `TaskRow` history-on-demand.
  The evolution panel mounts as a **new section between "5 · execute (tasks)"
  (`:412`) and "6 · dependencies" (`:415`)**, matching that toggle pattern. No new
  tab/page — it lives where the project is already read.

## STEP 2 — Read endpoint (read-only)

**New `src/app/api/operations/projects/[id]/evolution/route.ts`** — `GET` only.

- **Auth mirrors `tasks/route.ts` GET** exactly: `getVerifiedEmail` → 401;
  user lookup → 404; `operations_projects.findFirst({ id: projectId, user_id:
  user.id })` → **defensive 404** (a non-owner cannot read another user's
  trajectory). No audit (read-only); **no writes anywhere.**
- **Grouping:** `findMany` tasks for the project (select id/title/status/
  display_order/created_at/`source_ai_usage_id`), collect distinct non-null
  `source_ai_usage_id`s, `findMany` the ai_usage rows `WHERE id IN (...) AND
  user_id = user.id` (defensive ownership) `ORDER BY created_at ASC`. Each usage
  row becomes a **version** (`version_number` = chronological index, v1 = oldest)
  with its tasks (status-priority then display_order sorted).
- **NULL bucket:** tasks with `source_ai_usage_id = null` are returned **separately**
  as `unversioned[]` — never assigned to a version.
- Returns `{ project_id, versions[], unversioned[], unversioned_count }`. Each
  version carries `created_at`, `model`, `purpose`, token/cost metadata, and its
  `tasks[{ id, title, status }]`.

## STEP 3 — The view

**New `src/components/workbench/operations/projects/EvolutionTimeline.tsx`** —
self-fetches `/evolution` on mount, **read-only** (no edit/delete/create
affordances anywhere). **Mounted lazily** in `ProjectRow.tsx`:

- Import (`ProjectRow.tsx:23`) + `showEvolution` state (lazy — fetches only when
  opened, mirroring `showDesignReasoning`).
- New expanded-read section: a `labelClass` header "evolution (trajectory by AI
  re-run)" + a `view evolution / hide evolution` toggle button; `{showEvolution &&
  <EvolutionTimeline projectId={project.id} />}`.

**Design tokens (match the Projects surface):**
- `text-xs font-mono` throughout; `text-text-primary` / `text-text-muted` /
  `text-text-faint`; cards `border border-border-light rounded bg-white p-3`; the
  toggle button `border border-border rounded … hover:bg-bg-row` (identical to the
  design-reasoning toggle at `ProjectRow.tsx:392-398`).
- **Vertical timeline:** a `border-l-2 border-border-light` spine; each version is
  a node with a `bg-brand-purple` dot (`-left-[1.3rem]`), a `v{n}` chip
  (`bg-brand-purple text-white`), the formatted date, "added N tasks", and a faint
  `model · $cost · in/out` line. Tasks render as `+ {title}` + a status pill.
- **Status pills** reuse `TASK_STATUS_PILL_CLASSES` + `TASK_STATUS_LABELS` from
  `./types`, with a tolerant fallback (`Record<string,string>` + default gray) so
  an out-of-union status like `superseded` renders rather than crashes.
- One-purple discipline preserved: the only brand-purple is the version chip/dot
  accent; the panel sits inside the existing card chrome (no second purple band).

## STEP 4 — NULL / unversioned bucket handled honestly

The `unversioned[]` tasks render as a **visually distinct** node — a **gray** dot
(not purple), `bg-bg-row` card, a gray `original` chip, and the honest caption
*"tasks created before versioning (no re-run on record)."* They are **never folded
into a re-run and never hidden** (truth-first / fail-loud). The header summary
counts them explicitly (`N re-runs · M unversioned · T tasks total`). An empty
project shows an honest "no tasks yet" line; a version whose tasks were all since
deleted shows "(this re-run's tasks were since deleted)" rather than a blank node.

## Hard-constraint compliance

| Constraint | Status |
|---|---|
| READ-ONLY; 0-schema, 0 migration, 0 write paths | ✅ GET-only route; component has no mutations; no schema/prisma change in diff |
| NULL-source tasks in an honest "unversioned/original" bucket — never faked/hidden | ✅ separate `unversioned[]`, gray-dot node, explicit caption + count |
| Auth mirrors the project-tasks read route; user-scoped; defensive 404 | ✅ same `getVerifiedEmail` → user → `findFirst({id,user_id})` → 404 chain; ai_usage also scoped `user_id` |
| One concept: the evolution view. No content_pieces, no toggle (content) | ✅ only the timeline route + component + the mount |
| `tsc --noEmit` | ✅ exit 0 |
| eslint | ✅ new route + EvolutionTimeline **0 problems**; ProjectRow's 4 errors are **pre-existing on main** (lines 587/668 → shifted to 605/686 by the added section) → **+0 new** |
| git diff scoped | ✅ new `evolution/route.ts` + new `EvolutionTimeline.tsx` + `ProjectRow.tsx` (mount only) (+ this report). NO schema, NO migration. |

---

## Result
A project's expanded read view gains a lazy **"view evolution"** panel rendering a
read-only vertical timeline: each AI re-run is a version node (v1 oldest, by
`operations_ai_usage.created_at`) showing the date, cost/model metadata, and the
tasks that re-run **added** — the append-only loop made legible. Tasks predating
versioning (NULL `source_ai_usage_id`) sit in a clearly labeled, visually distinct
**"original / pre-versioning"** bucket — never faked into a re-run, never hidden.
The endpoint is GET-only with the same auth/user-scoping/defensive-404 as the tasks
route. **0-schema, 0 migration, 0 writes.** tsc clean; lint +0 new; diff scoped to
the route + the component + the ProjectRow mount.
