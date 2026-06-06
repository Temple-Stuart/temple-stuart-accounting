# Audit — "Reality Audit" Input for Project Plan/Task Generation

**Status:** AUDIT ONLY (read-only investigation, no implementation)
**Date:** 2026-06-05
**Branch:** `claude/audit-reality-audit-input`
**Goal context:** Let Alex paste an externally-produced codebase audit report into a project
*before* generating the AI plan, so the plan/task generators **ground every proposed task in
that report** — reuse what it documents as existing, never propose building what it says is
already built. Today's failure: generate-plan proposed building a data fetcher that already
exists, because the generator is blind to the codebase.

> ⚠️ The task prompt arrived **truncated** (cut off mid-sentence at "4. PROMPT CONTRACT …
> Cite insertion", no deliverable filename or GIT block). I used sensible defaults: this
> report path, branch `claude/audit-reality-audit-input`, and standard commit/push. Flagging
> so nothing is assumed locked.

Every claim cites `schema:line` or `file:line`.

---

## TL;DR — the column already exists; the generators are the gap

A field for exactly this **already exists**: `operations_projects.claude_code_audit_input`
(`schema.prisma:2646`, `@db.Text`), added in PR-Ops-Evolve-1 alongside
`deep_research_input` (`:2645`). It is **already written** by the project edit surface and
**already consumed by ONE of four generation endpoints**. The real work is: (a) feed it to the
**three blind endpoints** (most importantly **design/"generate-plan"**, which has zero
support), (b) expose it on the **create form**, and (c) **harden the grounding rule** in the
prompts. **No new column. No migration.**

---

## 1 · Project model + form

### Text-capable fields (no new column required)
`operations_projects` (`schema.prisma:2633-2671`) long-text (`@db.Text`, effectively
unlimited) fields:
- `goal` (2638), `problem` (2639), `diagnosis` (2640), `design` (2641)
- **`deep_research_input` (2645)** — external research paste
- **`claude_code_audit_input` (2646)** — **the honest host for the reality audit** (its
  literal purpose; named for a Claude Code codebase audit)

**Verdict: no new column, no migration.** `claude_code_audit_input` already exists and is the
correct field. (For completeness, the column was created by
`prisma/migrations/20260523000000_pr_ops_evolve_1_research_audit_inputs/migration.sql`:
`ALTER TABLE "operations_projects" ADD COLUMN "claude_code_audit_input" TEXT;`.)

### Form mount points
- **Project edit surface (`ProjectRow`) — ALREADY DONE.** State `auditInput` /
  `researchInput` seeded from the project (`ProjectRow.tsx:122-123`); a "reality inputs" paste
  block renders the textareas (`ProjectRow.tsx:492-500`, "Paste deep research output here…");
  saved via `handleSaveInputs` → `PATCH /projects/[id]` `{ deep_research_input,
  claude_code_audit_input }` (`ProjectRow.tsx:184-192`), accepted by the route
  (`projects/[id]/route.ts:134-138`).
- **Create surface (`ProjectCreateForm`) — MISSING.** No audit/research field exists
  (grep: none). Insertion point: a "reality audit (optional — paste report)" `<textarea>` in
  the create form, logically just **above the "4 · design — the plan" / generate section**
  (`ProjectCreateForm.tsx` design block, around the "generate plan"/"preview tasks" buttons),
  so the audit is present before the user clicks generate. On create it would be sent in the
  POST body (and/or passed to the stateless generators — see §2).

### Size limits — no overflow risk (contrast the 5.15 VarChar lesson)
- Columns are **`@db.Text`** (`schema.prisma:2645-2646`) — Postgres `text`, ~unbounded. **No
  `VarChar(n)` cap** (the PR-5.15 overflow was a `VarChar(500)`; that class of bug cannot
  occur here).
- PATCH write applies only `trimNonEmpty` with **no `maxLength` clamp**
  (`projects/[id]/route.ts:134-138`).
- App-Router route handlers read `await request.json()` with **no Pages-router 1 MB
  bodyParser limit**; a 3-5 KB paste is far below any platform limit. No issue.

---

## 2 · The generation endpoints

### Endpoint → lib → field consumption (the core map)
| Endpoint | Lib called | Reads audit field? | Injects into prompt? |
|---|---|---|---|
| `ai/generate-design` (stateless, create form) | `generateProjectDesign` (`route.ts:98-106`) | **No** (lib has no field) | **No** |
| `projects/[id]/generate-design` (stateful) | `generateProjectDesign` (`route.ts:77-85`) | **No** (project has the column; endpoint ignores it) | **No** |
| `ai/generate-tasks` (stateless, create form) | `generateProjectTasks` (`route.ts:122-130`) | **No** (lib supports it; endpoint passes nothing) | **No** |
| `projects/[id]/generate-tasks` (stateful) | `generateProjectTasks` (`route.ts:78-89`) | **Yes** (`:88-89`) | **Yes** |

**Only 1 of 4 endpoints grounds.** The blindness that produced the bug is the **design path**
(both endpoints) — see below.

### generate-plan vs generate-tasks — both must ground
- **"generate plan" = generate-DESIGN.** `generateProjectDesign` produces the `design` field
  (the numbered step plan) (`generateProjectDesign.ts:2-3,55`). **It has NO audit support at
  all** — `GenerateInput` (`:21-30`) has no `claudeCodeAuditInput`; the user message
  (`:104-115`) has no reality block; the system prompt (`:53-101`) has no grounding rule. **This
  is the documented failure mode** (the plan proposed building an existing fetcher).
- **generate-tasks = the task list.** `generateProjectTasks` **already** supports it:
  `GenerateInput` has `claudeCodeAuditInput` (`generateProjectTasks.ts:39`); the user message
  appends a **"Codebase Audit Findings"** block when present
  (`generateProjectTasks.ts:206-210, 222`); a grounding paragraph exists in the system prompt
  (`:200`). But only the **stateful** endpoint passes the field — the **stateless** create-form
  endpoint does not (`ai/generate-tasks/route.ts:122-130`).

### Where an `auditReport` block injects (follow the North Star pattern)
The North Star context is injected via `formatNorthStarBlock(input.northStar)` prepended to the
user message (`generateProjectDesign.ts:104`, `generateProjectTasks.ts:212`;
`lib/ai/northStarContext.ts`). The reality block follows the same shape:
- **Design (new):** add `deepResearchInput?` / `claudeCodeAuditInput?` to
  `generateProjectDesign` `GenerateInput` (`:21-30`); build a `realityBlock` and insert it in
  the user message after the DIAGNOSIS items, before "DESIGN field:" (`:104-115`) — copy
  `generateProjectTasks.ts:206-222` verbatim in structure.
- **Stateful design endpoint:** pass `project.deep_research_input` /
  `project.claude_code_audit_input` at the call site (`projects/[id]/generate-design/route.ts:
  77-85`) — mirror `projects/[id]/generate-tasks/route.ts:88-89`.
- **Stateless endpoints (both):** read an optional audit field from the request body
  (the create form sends it) and pass it through (`ai/generate-design/route.ts:98-106`,
  `ai/generate-tasks/route.ts:122-130`). Body parsing already destructures
  `title/goalItems/...` from `request.json()` (`ai/generate-design/route.ts:76-85`), so adding
  one more optional string field is in-pattern.

### Token budget — no truncation risk; do NOT add silent clipping
- `maxTokens` are **OUTPUT** limits: design `2000` (`generateProjectDesign.ts:136`), tasks
  `4000` (`generateProjectTasks.ts:239`). The audit is **INPUT** (in the user message), not
  bounded by these.
- Model is Sonnet 4 (`MODEL_SONNET_4`, both libs) — **~200K-token input context**. A 3-5 KB
  report ≈ ~1-1.5K tokens, i.e. <1% of context. **No truncation risk at realistic sizes.**
- Current code injects the audit **whole** (no `.slice()`, `generateProjectTasks.ts:209-210`).
  **Recommendation (no-fallback law):** keep injecting whole; never clip. If a report were ever
  absurdly large (far beyond realistic), the Anthropic API errors on context overflow — that is
  the correct **fail-loud** behavior. Do **not** add length-based silent truncation.

---

## 3 · The re-run / evolution loop — are inputs snapshotted?

- A "version" is an immutable **`operations_ai_usage`** row; each generated task carries
  `source_ai_usage_id` and the evolution view groups by it
  (`projects/[id]/evolution/route.ts:6,10-15`).
- `recordUsage` snapshots, on that row, **`full_system_prompt`** (`recordUsage.ts:163`) and
  **`full_user_message`** (`:164`), plus `inputs_summary` (`:161`).
- **So inputs ARE snapshotted — as the `full_user_message` text blob.** GOAL/PROBLEM/DIAGNOSIS
  and the North Star block are captured *only* because they live in the user message; there are
  no separate structured snapshot columns (`inputs_summary` holds **counts only**, e.g.
  `goal_items_count` — `generateProjectTasks.ts:225-229`).
- **Implication:** the audit text snapshots the **same way** — once it is injected into the
  user message (as it already is for stateful tasks), that run's exact audit text is preserved
  in `full_user_message`, even though the project's `claude_code_audit_input` column is mutable
  (last-write-wins via PATCH). This is **consistent with how G/P/D are already handled — not a
  new gap.** No separate snapshot mechanism is needed; injecting into the user message is
  sufficient and correct.
- **Minor nit (not a blocker):** `inputs_summary` does not record whether an audit/research
  block was present. Adding `audit_present=yes/no` there would help cost/version analytics
  distinguish grounded from blind runs. Optional.

---

## 4 · Prompt contract — where the grounding rule lands

- **`generateProjectTasks` — rule EXISTS but is too soft.** Current
  (`generateProjectTasks.ts:200`): *"…ground the task set in them … the audit as the authority
  on what is actually shipped, stale, or missing … Propose a reality-informed task set that
  closes the gap…"* — it never explicitly forbids proposing to build what exists. **Harden** to
  the desired contract: *"When a REALITY AUDIT is provided, every task must be consistent with
  it — reuse the components/feeds/routes it documents as existing; NEVER propose building
  something it says already exists; cite the audit's findings in task descriptions where
  relevant."* (Edit the existing paragraph at `:200`.)
- **`generateProjectDesign` — NO rule; ADD one.** Insert the same grounding paragraph into the
  system prompt, naturally right after the North Star framing paragraph
  (`generateProjectDesign.ts:63`) and reinforced near the closing instruction (`:101`). The
  design plan must obey the identical "reuse, never rebuild what exists" contract — it is the
  surface that failed.

---

## 5 · Gaps summary + minimal PR set

### What the feature needs × current state
| Need | Current state |
|---|---|
| A column to store the pasted audit | **Exists** — `claude_code_audit_input` `@db.Text` (`schema:2646`); no migration |
| Save audit on the **edit** surface | **Done** — `ProjectRow` paste box + PATCH (`:122-123,184-192,492-500`) |
| Save audit on the **create** surface | **Missing** — `ProjectCreateForm` has no field |
| **generate-tasks (stateful)** grounded | **Done** — passes + injects + (soft) rule (`:88-89`, lib `:200,206-222`) |
| **generate-tasks (stateless/create)** grounded | **Missing** — endpoint doesn't pass the field |
| **generate-design (both)** grounded | **Missing entirely** — lib has no field/block/rule (the bug) |
| Grounding rule strength | **Too soft** (tasks) / **absent** (design) |
| Version snapshot of the audit used | **Works once injected** — captured in `full_user_message` (`recordUsage:164`); consistent with G/P/D |
| Size/overflow safety | **Safe** — `@db.Text`, no clamp, no 1 MB body limit |

### Recommended minimal PRs (one fix per PR — no implementation here)
1. **PR — Ground the DESIGN generator (the bug fix).** Add `deepResearchInput` /
   `claudeCodeAuditInput` to `generateProjectDesign` (`GenerateInput` + user-message reality
   block, copying the `generateProjectTasks` pattern) **and** add the grounding rule to its
   system prompt. Wire both design endpoints to pass the fields (stateful from the project row;
   stateless from the request body). This is the highest-leverage fix — it closes the exact
   failure mode. *(Schema-free, no migration.)*
2. **PR — Harden the grounding rule (both generators).** Strengthen the tasks rule at
   `generateProjectTasks.ts:200` to the explicit "NEVER build what it says exists; cite
   findings" contract, and use the identical wording in the design prompt. Pure prompt text.
3. **PR — Expose the audit field on the create form + ground the stateless task endpoint.**
   Add the "reality audit (optional, paste report)" textarea to `ProjectCreateForm`; send it in
   the create/generate calls; pass it through `ai/generate-tasks` (and `ai/generate-design`
   from PR 1) so create-time generation is grounded too.
4. **(Optional) PR — analytics flag.** Record `audit_present`/`research_present` in
   `inputs_summary` so grounded vs blind runs are distinguishable in the cost/version tail.

> Sequencing: PR 1 alone fixes the reported bug for an existing project (paste audit on the
> edit surface — already savable — then regenerate the design). PRs 2-3 complete coverage
> (create surface + stronger contract). None requires a migration; all are route/lib/prompt
> (PR 3 adds one form field). No schema change anywhere in this feature.

### Open questions for the implementer
- **Field reuse vs rename:** the column is named `claude_code_audit_input` and the UI label is
  "reality audit." Confirm we reuse that column (recommended — it's its literal purpose) rather
  than adding a new one.
- **Create-time persistence:** on create, should the pasted audit be saved to the new project's
  `claude_code_audit_input` (so it persists for later re-runs), or only passed transiently to
  the stateless generator? Recommend persist — keeps the edit-surface and create-surface
  behavior consistent and feeds the version snapshot on later re-runs.
