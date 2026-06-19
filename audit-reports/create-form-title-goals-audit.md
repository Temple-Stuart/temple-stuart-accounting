# AUDIT — Create form → title + goals only + kill KICKOFF (READ-ONLY)

**Branch:** `claude/audit-create-form-title-goals` · **Date:** 2026-06-18 · **Mandate:** Truth-First, read-only, cite `file:line`. Labels: EXISTS / USED-BY-PIPE / SAFE-TO-DELETE / RISK.

Goal: make `ProjectCreateForm` **title + goals only** and delete the KICKOFF block — **without breaking the pipe**. Verdict below.

---

## HEADLINE — the data + prompts allow it; FOUR validation gates block it

- **The DATA MODEL already allows title+goals-only:** `problem`/`diagnosis` are nullable, `problem_items`/`diagnosis_items` default to `[]` (`schema:2724-2729`). **No migration — keep the columns.**
- **The PIPE PROMPTS degrade gracefully on empty:** every builder's `bulletList([])` returns `'(none provided)'` (`generateDeepResearch.ts:58-59`, `buildAuditPrompt.ts:25-26`, `generateProjectTasks.ts` same), and the prompts route's `resolveItems` returns `[]` for empty. So empty problem/diagnosis → a clean "(none provided)" section, **no break**. — USED-BY-PIPE, degrades gracefully.
- **BUT problem + diagnosis are REQUIRED non-empty at FOUR validation gates** (create POST + 2 task-gen routes + design-gen route) **and** the client form. So **removing the form fields alone makes the create POST fail (400)**. — **This is MED, not pure presentation: the validations must be relaxed too.** Still no migration.
- **KICKOFF block is self-contained** — SAFE-TO-DELETE.

---

## 1. WHAT THE PIPE'S PROMPTS CONSUME

All three builders interpolate **goal AND problem AND diagnosis** — but tolerate empty:
- `buildResearchPrompt`/`buildResearchSegments` (`generateDeepResearch.ts`): `bulletList(goalItems)`, `bulletList(problemItems)`, `bulletList(diagnosisItems)` (the `GOAL/PROBLEM/DIAGNOSIS items:` sections). — USED-BY-PIPE.
- `buildTasksPrompt`/`buildTasksSegments` (`generateProjectTasks.ts:227-236`): same three + the reality block. — USED-BY-PIPE.
- `buildAuditPrompt`/`buildAuditSegments` (`buildAuditPrompt.ts:48-56, 104-114`): same three. — USED-BY-PIPE.
- `formatNorthStarBlock`/`toNorthStarContext` read the **north star**, not the project's problem/diagnosis — irrelevant here. — not a consumer.

**Empty behavior — GRACEFUL:** `bulletList(items)` → `'(none provided)'` when `items.length === 0` (`generateDeepResearch.ts:58-59`, `buildAuditPrompt.ts:25-26`). The prompts route feeds `resolveItems(project.problem_items, project.problem)` which returns `[]` for empty (`prompts/route.ts:24-31`). So with empty problem/diagnosis the prompt shows `PROBLEM items:\n(none provided)` — valid, no crash, no required field. — **Degrades gracefully ✓.** (The red-segment verify guard also still holds — `bulletList([])` is a deterministic string.)

---

## 2. WHAT THE CREATE FLOW SENDS — the blocking gates

**(a) Create POST `/api/operations/projects` — REQUIRES problem + diagnosis non-empty.**
- `validateItems(body.problemItems, …)` (`route.ts:213`) + `validateItems(body.diagnosisItems, …)` (`:215`) reject an empty array: `if (value.length === 0) → 400 "must contain at least one item"` (`:157-165`). So a title+goals project (empty problem/diagnosis) **fails the create with a 400**. — **RISK (the core blocker).**

**(b) `handleGenerateCreateDesign` (client) — REQUIRES problem + diagnosis.** `ProjectCreateForm.tsx:123-125` (`goalItems.length===0 || problemItems.length===0 || diagnosisItems.length===0` → error) and `isFormValidForAI` `:181-183`. The "↑ generate plan" / "↑ preview tasks" buttons gate on these. — RISK (client gate).

**(c) `generate-design` (stateless) route — REQUIRES.** `ai/generate-design/route.ts:91-95` (`validateItems` problem + diagnosis → 400 "must contain at least one item" `:46`). — RISK.

**(d) `generate-tasks` (stateless) route — REQUIRES.** `ai/generate-tasks/route.ts:110-115` (`validateItems` problem + diagnosis). — RISK.

**(e) `generate-tasks` (project) route — REQUIRES.** `[id]/generate-tasks/route.ts:60-72`: `resolveItems` returns `null` for empty → `if (!goalItems || !problemItems || !diagnosisItems)` → 400 "project must have at least one goal item, one problem item, and one diagnosis item before generating tasks" (`:68`). — RISK.

→ **To allow title+goals-only, problem/diagnosis must change from REQUIRED → OPTIONAL in:** the create POST (`route.ts:213-216`), the client form gates (`ProjectCreateForm.tsx:123-125, 181-183`), and — **if** title+goals projects should be able to generate design/tasks — the three AI-gen routes (`ai/generate-design`, `ai/generate-tasks`, `[id]/generate-tasks`). The pipe research/audit/fusion prompt PREVIEW already tolerates empty (§1).

---

## 3. THE SCHEMA — title+goals-only is VALID

- `operations_projects.problem String?` (`schema:2724`), `diagnosis String?` (`:2725`) — **nullable**.
- `goal_items / problem_items / diagnosis_items Json @default("[]")` (`:2727-2729`) — **defaulted to empty array**.
- So a project row with empty problem/diagnosis is fully schema-valid. — **No migration. Keep all columns.**

---

## 4. OTHER CONSUMERS of problem/diagnosis (remove FIELDS, keep COLUMNS)

Many surfaces READ project problem/diagnosis — **the columns must stay**; only the create-form *fields* are removed:
- **Prompts/pipe:** `prompts/route.ts`, `research/route.ts`, `[id]/generate-tasks`, `[id]/generate-design`, `ai/generate-tasks`, `ai/generate-design` (all interpolate them).
- **Views:** `ProjectRowView.tsx` (read view "2 · problem"/"3 · diagnosis" + edit ListManagers), `TruthMachineView.tsx` (the inputs stage `ItemList` for problem/diagnosis), `ProjectRow.tsx`, `types.ts` (`ProjectForm`).
- **Other:** `optimize-north-star-section/route.ts`, `SectionB_NorthStar.tsx`, `[id]/route.ts` (PATCH), showroom `demoData.ts`, the **home** `ProjectCreateForm.tsx` (separate component).
→ Removing the *columns* would break all of these. **Remove only the two ListManager fields from the workbench `ProjectCreateForm`; keep the data model.** — RISK confirms: data model stays.

---

## 5. THE KICKOFF BLOCK — SAFE-TO-DELETE

- `KICKOFF_PROMPT` const (`ProjectCreateForm.tsx:33-46`), its render (`~:337-355` — the copy-prompt sub-card, `onClick={copyPrompt}` + the `<pre>{KICKOFF_PROMPT}</pre>`), the `copyPrompt` handler (`:74-82`), and the `copied` state (`:73`).
- **Self-contained:** grep shows `KICKOFF_PROMPT` + `copyPrompt` only in `ProjectCreateForm.tsx`. (The `ScriptGenerator.tsx:102` `copyPrompt` is a **different component's** unrelated handler — not this one.) — **SAFE-TO-DELETE** (const + render + handler + the `copied` state; no other reference). No engine/data impact.

---

## Explicit answers

**(a) Does the pipe consume problem/diagnosis, and degrade gracefully if empty?** YES on both — all three builders interpolate them (`generateDeepResearch`/`generateProjectTasks`/`buildAuditPrompt`), and **empty → `'(none provided)'`** via `bulletList` (`generateDeepResearch.ts:58-59` et al). The prompt preview is unaffected by empty problem/diagnosis. — USED-BY-PIPE, graceful.

**(b) Does create / design-gen / task-gen REQUIRE problem/diagnosis?** **YES — all of them.** Create POST (`route.ts:213-216, 157-165`), generate-design (`ai/generate-design/route.ts:91-95`), generate-tasks stateless (`ai/generate-tasks/route.ts:110-115`) + project (`[id]/generate-tasks/route.ts:64-72`), and the client form (`ProjectCreateForm.tsx:123-125, 181-183`). **Title+goals alone fails today.**

**(c) Schema nullable?** YES — `problem/diagnosis String?` (`:2724-2725`), `*_items Json @default("[]")` (`:2727-2729`). Title+goals-only is schema-valid; **no migration**.

**(d) Other consumers?** Many (views + all AI routes + prompts + PATCH + north-star). **Keep the columns; remove only the create-form fields.**

**(e) KICKOFF self-contained + safe to delete?** YES — const `:33-46` + render `~:337-355` + `copyPrompt` `:74-82` + `copied` state `:73`, referenced nowhere else. SAFE-TO-DELETE.

**(f) Recommended approach (SMALL-MED, no migration):**
1. **PD-fields-1 — strip the create form to title + goals + delete KICKOFF (SMALL, presentation + client gates).** Remove the Problem + Diagnosis `ListManager`s and the KICKOFF block (const/render/handler/`copied`) from `ProjectCreateForm.tsx`. Relax the client gates: `handleGenerateCreateDesign:123-125` + `isFormValidForAI:181-183` → require only title + goal (drop the problem/diagnosis checks). **Keep entity + target-date + reality-audit + design** unless you also want those gone (decision — the prompt sends empty cleanly either way). Send `problemItems: []`, `diagnosisItems: []` in the POST.
2. **PD-fields-2 — relax the server validations (SMALL, REQUIRED for #1 to work, no migration).** Change `problem`/`diagnosis` from required→optional (accept empty `[]`) in: create POST (`route.ts:213-216`), and — only if title+goals projects must generate design/tasks — `ai/generate-design:91-95`, `ai/generate-tasks:110-115`, `[id]/generate-tasks:64-72`. **Keep `goal` required.** Columns unchanged (nullable/defaulted). — **This is the RISK to surface: #1 without #2 makes the create POST 400.**

**Decision to confirm:** should title+goals projects be able to **generate design/tasks with empty problem/diagnosis** (relax all 4 gates — the prompts degrade gracefully), or only **create** with title+goals and require problem/diagnosis to be added later before generating (relax just the create POST + client)? The pipe prompts work either way; this is a product call.

**Migration:** **none** — columns stay nullable/defaulted; nothing is dropped.

### Citation index
- Create POST validation: `api/operations/projects/route.ts:157-165, 213-216, 226-228, 296-302`.
- AI-gen gates: `ai/generate-design/route.ts:46, 91-95`; `ai/generate-tasks/route.ts:110-115`; `[id]/generate-tasks/route.ts:31, 60-72`.
- Prompt degradation: `generateDeepResearch.ts:58-59`; `buildAuditPrompt.ts:25-26, 48-56`; `generateProjectTasks.ts:66-68, 227-236`; `prompts/route.ts:24-31`.
- Schema: `prisma/schema.prisma:2724-2729`.
- Client gates + KICKOFF: `ProjectCreateForm.tsx:33-46 (const), 73-82 (copyPrompt/copied), 123-125, 181-183, ~337-355 (render)`.
- Readers (keep columns): `ProjectRowView.tsx`, `TruthMachineView.tsx`, `types.ts`, `[id]/route.ts`, `prompts/route.ts`, `research/route.ts`, `optimize-north-star-section/route.ts`.

*Do not implement — audit only.*
