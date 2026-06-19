# AUDIT — Strip create form to title+goals+entity/date (kill design-gen, reality-audit box, est. fields) (READ-ONLY)

**Branch:** `claude/audit-create-form-strip` · **Date:** 2026-06-18 · **Mandate:** Truth-First, read-only, cite `file:line`. Labels: EXISTS / USED-BY-PIPE / SAFE-TO-DELETE / RISK.

Goal: create form → **title + goals + entity + target-date** only, removing (1) the DESIGN "generate plan" section, (2) the REALITY-AUDIT paste box, (3) EST. minutes/cost — **without breaking the pipe**. Verdict below.

---

## HEADLINE — all three are removable as create-form sections; KEEP every column

- **DESIGN** is **VESTIGIAL at create time**: the pipe never reads `design`, and the *same* generate-design exists on the existing project (`ProjectRow`). — SAFE-TO-DELETE the create-form section + `handleGenerateCreateDesign`.
- **REALITY-AUDIT box** is **REDUNDANT**: `claude_code_audit_input` is read by the pipe fusion (column must stay), but the pipe's own AUDIT stage already writes it (`TruthMachineView`). — SAFE-TO-DELETE the box; keep the column.
- **EST. fields** are displayed/editable on the existing project (`ProjectRowView`) and optional in the create POST. — SAFE-TO-DELETE the create inputs; keep the columns.
- **No migration** — every column stays; only create-form *sections* go (+ the now-orphaned design handler/state). The create POST treats all three as optional.

---

## 1. THE DESIGN SECTION

**What it does:** `handleGenerateCreateDesign` (`ProjectCreateForm.tsx:90`) fires the PAID `POST /api/operations/ai/generate-design` and shows a preview the user accepts into `createForm.design`. Its state: `generatingCreateDesign`, `createDesignPreview`, `createDesignError`, `createDesignCost`, `createDesignInspection` (`:55-61`), rendered as the "4 · design — generate plan" block (`~:362-…`).

**Is `design` read downstream?**
- **The PIPE does NOT read `design`** — `buildResearchPrompt`/`buildTasksPrompt`/`buildAuditPrompt` interpolate goal/problem/diagnosis (+ research/audit), **never `design`** (grep of `generateProjectTasks.ts`/`generateDeepResearch.ts`/`buildAuditPrompt.ts` for `design` → only prose comments, no `input.design`). — **NOT a pipe input.**
- **`TruthMachineView` (the pipe view) does NOT render `design`** (grep → only "redesign" comment hits). — design is **not** a pipe surface.
- **`design` IS displayed/edited on the existing project** — `ProjectRowView` "4 · design" read + edit. So the **column stays** (other surface reads it).

**Does generate-design survive without the create-time section?** **YES** — the existing project has its own: `ProjectRow.handleGenerateDesign` (`:210-217` → `POST /api/operations/projects/[id]/generate-design`), wired to `ProjectRowView`'s "↑ generate plan" (`onGenerateDesign` `:124`, `:512`). So design generation simply moves to **after create, on the project**.

→ The create-time design section is **VESTIGIAL** — duplicates a capability that lives on the project. — **SAFE-TO-DELETE** the section + `handleGenerateCreateDesign` + its 5 state vars. `createForm.design` stays in `ProjectForm` (sent empty; POST `design = trimNullable(body.design)` `route.ts:259` → optional).

---

## 2. THE REALITY-AUDIT BOX

**Column MUST STAY — the pipe fusion reads it:** `[id]/generate-tasks/route.ts:91` passes `project.claude_code_audit_input` → `generateProjectTasks` → `buildTasksPrompt` reads `input.claudeCodeAuditInput` (`generateProjectTasks.ts:223, 251`); the prompts-preview route also reads it (`prompts/route.ts:84`). — **USED-BY-PIPE → keep `claude_code_audit_input`.**

**The pipe's AUDIT stage fills it itself (the box is redundant):** `TruthMachineView`'s audit textarea is `value={auditInput}` (`:340`, labeled "audit output (claude_code_audit_input — paste; Phase 3 auto-fills here)" `:338`), bound to `ProjectRow.auditInput` (`:496`) and saved via `handleSaveInputs` → `PATCH … { claude_code_audit_input: auditInput }` (`ProjectRow.tsx:195`). So the **pipe (Truth Machine) writes `claude_code_audit_input` on the project** — and Phase 3 will auto-fill it. The create-time paste box is a **second, redundant writer.**

→ Removing the create-time box is **SAFE** — the column stays, the pipe fusion still reads it, and the pipe's own audit stage (TruthMachineView) writes it. `createForm.claude_code_audit_input` stays in `ProjectForm` (sent empty at create; POST `trimNullable` `:263` → optional). — **SAFE-TO-DELETE the box, keep the column.**

---

## 3. THE EST. MINUTES / COST FIELDS

**Read/edited elsewhere:** `ProjectRowView` displays them in the read view (`:399-404` `est. minutes`/`est. cost (usd)`) and edits them in the edit view (`:656-661`). `ProjectRow.projectToForm` round-trips them (`:67-68`). (The `UnscheduledTaskTable:301` "est. cost" is an unrelated **task-level** field.)

**Create POST optional:** `estimated_total_minutes` is only parsed/validated when present (`route.ts:298-304` — `!== undefined && !== null && !== ''` → else null); same shape for cost. — **not required.**

→ Removing the create-form inputs is **SAFE** — the columns stay, the user sets them later on the project's edit view; create works with them empty. `createForm.estimated_total_minutes`/`_cost_usd` stay in `ProjectForm` (sent empty). — **SAFE-TO-DELETE the inputs, keep the columns.**

---

## 4. DELETION SAFETY / RISK

- **Design:** removing the section means removing `handleGenerateCreateDesign` (`:90`) **and** its 5 now-orphaned state vars (`:55-61`) — else unused-var lint. — RISK (orphaned state — remove together).
- **InspectionDrawer import:** `ProjectCreateForm` imports `InspectionDrawer` (`:28`) used **only** in the design preview. Removing the design section **orphans that import** → must remove the import too (or lint fails). — RISK (orphaned import — remove with the section). *(Confirm: `AITaskPreview` — used by the tasks-preview flow — is separate and stays.)*
- **Keep the create + generate-tasks flow:** `handleCreate` (the POST), `handleGenerateTasksPreview` + `handleAcceptStatelessTasks` + `AITaskPreview` (the "↑ preview tasks" accept-gate) are **out of scope** — they stay so "the create form still creates + the pipe generates." Note: "↑ preview tasks" currently sends `auditInput: createForm.claude_code_audit_input` — now empty → the prompt degrades to "(none provided)" (graceful, already proven). — Not a break; optional follow-up to also drop preview-tasks if you want create to be pure title+goals.
- **Do NOT touch `ProjectForm`/`DEFAULT_PROJECT_FORM`/`types.ts`:** keep `design`, `claude_code_audit_input`, `estimated_total_*` in the form shape — the edit view + other forms use them, and the create POST still receives them (empty). Removing them from the type would ripple to `ProjectRowView`'s edit view. — RISK (keep the type intact).
- **Columns:** none dropped — `design`, `claude_code_audit_input`, `estimated_total_minutes`, `estimated_total_cost_usd` all stay (read by ProjectRowView + the pipe). — **No migration.**

---

## Explicit answers

**(a) Design section — VESTIGIAL or USED?** **VESTIGIAL at create time** — the pipe doesn't read `design`, and the same generate-design exists on the existing project (`ProjectRow.tsx:210-217`, `ProjectRowView` "↑ generate plan"). **Safe to remove the section + `handleGenerateCreateDesign` + its 5 state vars + the orphaned `InspectionDrawer` import.** Keep the `design` column (displayed in `ProjectRowView`; generatable on the project).

**(b) Reality-audit box.** `claude_code_audit_input` **column STAYS** — pipe fusion reads it (`generate-tasks/route.ts:91` → `generateProjectTasks.ts:223,251`; `prompts/route.ts:84`). The pipe's audit stage **fills it** (`TruthMachineView.tsx:340` → `ProjectRow.tsx:195` PATCH). **Safe to remove the create-time box** — redundant with the pipe's own audit stage.

**(c) Est. fields.** Read/edited in `ProjectRowView` (`:399-404` read, `:656-661` edit); optional in the create POST (`route.ts:298-304`). **Safe to remove the inputs; keep the columns** (user sets them on the project edit view).

**(d) RISK.** Orphaned design state vars (`:55-61`) + `handleGenerateCreateDesign` (`:90`) + the `InspectionDrawer` import (`:28`) — remove together. Keep `ProjectForm`/`DEFAULT_PROJECT_FORM` intact (edit view uses these fields). Keep `handleCreate` + the tasks-preview accept-gate. No route/validation breaks (all three optional in the POST).

**(e) Recommended approach (SMALL-MED, no migration):**
- **PD-Strip — remove the 3 create-form sections.** Delete: the DESIGN block + `handleGenerateCreateDesign` + its 5 state vars + the `InspectionDrawer` import; the REALITY-AUDIT textarea; the EST. minutes/cost inputs. **Keep all columns** (`design`, `claude_code_audit_input`, `estimated_total_*`), keep `ProjectForm` shape (fields sent empty), keep `handleCreate` + the "↑ preview tasks" accept-gate. Result: create form = **title + goals + entity + target-date** (+ create / preview-tasks / cancel). No server change (POST already optional on all three). **No migration.**
- **(Optional follow-up, your call):** also drop "↑ preview tasks" so create is *pure* title+goals (the pipe generates on the project) — separate decision, not required.

### Citation index
- Design: `ProjectCreateForm.tsx:55-61 (state), 90 (handler), ~362+ (render), 28 (InspectionDrawer import)`; survives at `ProjectRow.tsx:210-217`, `ProjectRowView.tsx:124,512`; not a pipe input (`generateProjectTasks.ts`/`generateDeepResearch.ts`/`buildAuditPrompt.ts` — no `design` read); POST optional `route.ts:259`.
- Audit box: pipe reads `generate-tasks/route.ts:91`, `generateProjectTasks.ts:223,251`, `prompts/route.ts:84`; pipe writes `TruthMachineView.tsx:338-340`, `ProjectRow.tsx:195`; POST optional `route.ts:263`.
- Est: read/edit `ProjectRowView.tsx:399-404,656-661`; `ProjectRow.tsx:67-68`; POST optional `route.ts:298-304`.

*Do not implement — audit only.*
