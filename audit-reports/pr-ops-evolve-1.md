# PR-Ops-Evolve-1 — Build: evolve-loop foundation

Wires two manual-paste reality inputs into the existing generate-tasks prompt and
adds the `superseded` task status. **Additive only** — existing generation
(append, never-delete, recordUsage, inspection) is unchanged. PR-1 sets nothing to
`superseded` (the retire/sharpen reconciliation is Evolve-PR-2).

## (1) Schema — `superseded` enum + two columns

**Migration** `prisma/migrations/20260523000000_pr_ops_evolve_1_research_audit_inputs/migration.sql`:
```sql
ALTER TYPE "OperationsTaskStatus" ADD VALUE IF NOT EXISTS 'superseded';
ALTER TABLE "operations_projects" ADD COLUMN "deep_research_input" TEXT;
ALTER TABLE "operations_projects" ADD COLUMN "claude_code_audit_input" TEXT;
```
**ADD VALUE / transaction handling:** `ALTER TYPE … ADD VALUE` cannot run inside a
`BEGIN/COMMIT` block. The file uses **bare statements with no explicit
transaction** (so each runs in autocommit), exactly matching the existing
enum-ADD-VALUE precedent `20260518500002_pr_ops_4_9_1c_content_scene_audit_enums`
(whose own comment notes the same). The new value is **not referenced** by any
statement in this file (the two columns are `TEXT`, not the enum), so there is no
"use new enum value in the same transaction" hazard → `prisma migrate deploy` on
Vercel/Azure is safe. Additive (new enum value + two nullable columns), no backfill.

**schema.prisma parallel half** (both halves move together):
- `enum OperationsTaskStatus` (`:2521-2528`): added `superseded`.
- `model operations_projects` (`:2571-2572`): added
  `deep_research_input String? @db.Text` + `claude_code_audit_input String? @db.Text`.
- `npx prisma generate` run (client regenerated); `npx prisma validate` → valid
  (exit 0 with env set).

**Zero-drift proof:** a live `prisma migrate diff` shadow-replay needs DB
connectivity, which this headless sandbox lacks (only `.env.example`, no
`DATABASE_URL`/`SHADOW_DATABASE_URL`) — it runs on deploy. Verified instead by
exact 1:1 correspondence between the two halves:

| schema.prisma | migration.sql |
|---|---|
| enum value `superseded` | `ADD VALUE IF NOT EXISTS 'superseded'` |
| `deep_research_input String? @db.Text` | `ADD COLUMN "deep_research_input" TEXT` |
| `claude_code_audit_input String? @db.Text` | `ADD COLUMN "claude_code_audit_input" TEXT` |

No other model/enum changed → no drift.

## (2) The two input boxes (UI + persistence)

- **UI** — `src/components/workbench/operations/projects/ProjectRow.tsx`, inside
  the dependency section ("6 · dependencies", above `<DependencyList>`): two
  labelled `<textarea>`s — "deep research input" / "claude code audit input" —
  with placeholders "Paste deep research output here…" / "Paste Claude Code audit
  findings here…", a "save inputs" button, and a "saved — regenerate tasks to use
  these" hint. Compact, matches the section `labelClass` styling.
- **State + save**: local state seeded from `project.deep_research_input` /
  `project.claude_code_audit_input`; `handleSaveInputs` PATCHes the project.
- **Persistence reuses the existing project section-save path** — `PATCH
  /api/operations/projects/[id]` (`route.ts`). The two columns were added to the
  existing legacy-Text-field loop (`route.ts:118-123`: `['goal','problem',
  'diagnosis','design','deep_research_input','claude_code_audit_input']`), so they
  save through `trimNonEmpty` exactly like the other Text sections — no new
  endpoint invented.
- **Type**: `Project` interface (`projects/types.ts:33-34`) gained the two fields.
  The list GET (`api/operations/projects/route.ts:68`) uses `findMany` with no
  `select`, so the columns flow to the client automatically.

## (3) Feed into generate-tasks prompt

- **`src/lib/ai/generateProjectTasks.ts`**:
  - `GenerateInput` (`:34-41`): added optional `deepResearchInput?: string | null`
    + `claudeCodeAuditInput?: string | null`.
  - `userMessage` (`:208-225`): builds a `realityBlock` and injects it after the
    DIAGNOSIS items — **only when a box is non-empty** (each block is conditional
    on `.trim()`, so an empty box emits no header): `## Deep Research Findings
    (external — what's true/best/current)` and `## Codebase Audit Findings (what's
    actually shipped / stale / missing)`.
  - `SYSTEM_PROMPT` (`:198-200`): added a "REALITY INPUTS (when present)"
    instruction — ground the task set in research (truth/best/current) + audit
    (shipped/stale/missing), and **explicitly do NOT mark existing tasks
    retired/superseded** (this run only proposes a set; reconciliation is elsewhere).
- **Endpoint** `POST /api/operations/projects/[id]/generate-tasks`
  (`generate-tasks/route.ts:86-87`): reads `project.deep_research_input` /
  `project.claude_code_audit_input` and passes them into `generateProjectTasks()`.

## Inspection (automatic)
The two inputs ride inside `userMessage`, which `recordUsage` persists verbatim as
`operations_ai_usage.full_user_message` — so every evolved list traces back to the
exact research + audit text in the inspection drawer. **No inspection-layer change.**

## No auto-retire in PR-1 (confirmed)
The `superseded` enum value exists but **no code path sets it**. The SYSTEM_PROMPT
explicitly tells the model not to retire existing tasks. Generation still APPENDS
via the unchanged bulk-create accept-gate. (The one other code reference to the
enum — `STATUS_ORDER` in `tasks/route.ts:25-32` — only needed `superseded: 5` added
to stay exhaustive for sorting; it doesn't assign the status.)

## Checks
- `npx tsc --noEmit` → exit 0.
- ESLint touched files → **0 new errors**. The 7 errors reported are **pre-existing
  on main** (verified: identical count via `git stash` + lint of the same two files
  on the base commit — unrelated `prefer-const`/`no-explicit-any`/unescaped-quote
  issues that predate this PR).
- Additive only; no fallback logic; scoped to the Operations feature.

## Not verified
DB-dependent steps (live `migrate diff`, the migration actually applying) can't run
in this headless sandbox — they execute on `prisma migrate deploy` at Vercel deploy.
`/operations` is auth-gated, so the paste boxes + reality-aware generation need a
manual pass in an authenticated browser.
