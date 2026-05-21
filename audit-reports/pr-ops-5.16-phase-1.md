PR-OPS-5.16 PHASE 1 AUDIT REPORT
================================

BRANCH STATUS
- main top 3: `5b9afab` (merge #560 PR-Ops-5.13 routine-capture-gap-audit) → `b528629` (5.13 audit commit) → `a26ccd7` (merge #559 PR-Ops-5.12 daily-plan-list audit).
- current branch: `claude/pr-ops-5.16-north-star-optimizer-audit`

A. NORTH STAR RENDER + SAVE

**File:** `src/components/workbench/operations/SectionB_NorthStar.tsx` (522 lines).

**Display view (`NorthStarDisplay`, `:235-331`):**
- `mission_statement` (`:239-248`) — `whitespace-pre-wrap` block. Empty → "no mission statement set".
- `life_stage` (`:251-254`) — single-line text or "—".
- `core_values` (`:263-279`) — chips list (one `<span>` per value) or "—".
- `one_year_target` / `three_year_target` (`:281-294`) — two-column `whitespace-pre-wrap` blocks.
- `guiding_principles` (`:296-301`) — rendered only when truthy, `whitespace-pre-wrap`.
- `location · timezone` (`:255-260`) — concatenated single line.
- Review meta row (`:303-328`) — `last_reviewed_at`, `review_cadence_days`, `next_review_at` traffic-light.

**Editor view (`NorthStarEditor`, `:345-521`):**
- `mission_statement` (`:362-371`) — `<textarea rows={2}>`.
- `life_stage` (`:374-383`) — `<input type="text">`.
- `core_values` (`:398-440`) — chips (rendered with × delete) + add-input + add-button; held as `String[]` in form state; ENTER commits via `addCoreValue` (`:102-111`).
- `one_year_target` / `three_year_target` (`:442-463`) — two `<textarea rows={2}>` in a 2-col grid.
- `guiding_principles` (`:465-474`) — `<textarea rows={4}>`.
- `location` / `timezone` (`:476-497`) — two single-line `<input>`.
- No `maxLength` enforced anywhere (verified by `grep -n "maxLength" src/components/workbench/operations/SectionB_NorthStar.tsx` → 0 hits; consistent with the PR-Ops-5.15 audit finding).

**Save mechanism (`:117-140`):** single whole-form POST to `/api/operations/north-star` carrying ALL 9 fields. NO per-field save endpoint. The form lives in `editing=true` mode (`:61`); typing modifies local state; "save north star" button hits POST (`:121-125`); success path sets `setNorthStar`, `setEditing(false)`, surfaces a 3s green flash via `successMessage`. Cancel (`:163-169`) reverts form to last-saved value.

**Where the "optimize from reality" button slots for each prose section** (Phase 2 placement targets):
- **Mission** — inside the section header div at `:362-371`. Recommend the affordance appear next to the label (`<div className={labelClass}>mission statement</div>` at `:363`), as a small `+ optimize from reality` link/button. This matches the existing "+ schedule block" and "+ add item" tertiary-action vocabulary in this codebase.
- **One-year target** — same idiom at `:443-451`.
- **Three-year target** — same idiom at `:453-461`.
- **Guiding principles** — same idiom at `:465-474`.
- **Core values** — special case (it's a `String[]`, not free prose). The "optimize" semantic still works but the proposal shape is different: the AI returns a proposed ARRAY, and Alex accepts by replacing the chip list. Recommend leaving core_values OUT of the v1 optimizer — start with the 4 prose sections. (Reasoning: chip-list optimization is a meaningfully different UX from textarea optimization; bundling them complicates the v1.)
- **Life_stage** — also a short field. Could optimize but the prose-richness benefit is small. Recommend OUT of v1.

**v1 scope: 4 prose sections get the optimizer.** mission + one_year + three_year + guiding_principles.

**North Star API** — `src/app/api/operations/north-star/route.ts` (full read complete in PR-Ops-5.15 audit; key details for this PR):
- **GET (`:21-43`):** auth via `getVerifiedEmail()` (`:23`) + `prisma.users.findFirst` (`:26-28`) + `prisma.operations_north_star.findUnique({ where: { user_id: user.id } })` (`:31-33`). Returns `{ northStar }` or `{ northStar: null }`.
- **POST upsert (`:45-140`):** same auth idiom; validates `review_cadence_days > 0` (`:61`) + `core_values` is-array (`:68`); normalizes 6 string fields via `norm()` (`:75-79`); `prisma.operations_north_star.upsert` (`:100-108`); writes `writeAuditLog` with `operations_north_star_{created,updated}` action type (`:110-130`).
- **No per-field PATCH endpoint exists.** The optimizer's "save" is just a re-POST of the whole form with the edited field swapped — uses the EXISTING upsert path. No new write endpoint needed.

B. EXISTING AI PATTERN (to mirror)

**Singleton Anthropic client + model** — `src/lib/ai/client.ts`:
- `getAnthropicClient()` at `:17-25` — cached singleton, reads `process.env.ANTHROPIC_API_KEY`, throws if absent.
- **Model:** `MODEL_SONNET_4 = 'claude-sonnet-4-20250514'` at `:31`. **This is the production model the operations AI features use** (per the file comment at `:28-31` and the generateProjectDesign import at `:17`).
- Cost rates registered at `:38-44`: input `$3.00`/M tokens, output `$15.00`/M tokens.
- `computeCostUsd(model, in, out)` at `:53-69` — throws on unregistered model (defensive against silent $0 logging).

**Cost-tracking / inference-logging — `src/lib/ai/recordUsage.ts` (the WRAPPER every operations AI feature uses):**
- One-shot helper at `:102-212` wrapping the Anthropic call + persistence in a single function.
- **Order of operations** (per file header `:10-16` and the body):
  1. `client.messages.create(...)` (`:119`) with system + user + optional `tools`/`toolChoice`.
  2. Extract `text` (`:121-124`) from text blocks; extract `toolUses` (`:130-132`) for custom-tool callers.
  3. Compute cost via `computeCostUsd` (`:136`).
  4. `prisma.operations_ai_usage.create` (`:151-168`) — captures `user_id, model, purpose, target_table, target_id, input_tokens, output_tokens, cost_usd, inputs_summary, output_summary, full_system_prompt, full_user_message, full_response, created_by`.
  5. `writeAuditLog` (`:170-194`) — `action_type='operations_ai_inference'`, target is the affected entity (or the usage row if stateless), `payload.metadata.usage_id` cross-references the usage row.
  6. Return `{ text, usageId, inputTokens, outputTokens, costUsd, inspection, toolUses? }` (`:196-211`).

- **`operations_ai_usage` schema** (`prisma/schema.prisma:2837-2861`): full prompt + full response stored verbatim in `full_system_prompt` / `full_user_message` / `full_response` (each `@db.Text`). This is the "transparency" pattern — every inference is fully reconstructable for inspection.
- **Indexes** for the usage table (`:2857-2859`): `[user_id, created_at desc]`, `[target_table, target_id]`, `[purpose, created_at desc]` — supports "show me all AI calls for this user / for this North Star / for this purpose" queries cheaply.

**Prompt construction pattern** — `src/lib/ai/generateProjectDesign.ts:51-95`:
- A long `SYSTEM_PROMPT` constant (the instruction set) + a per-call `userMessage` built from input data via `bulletList()` helper.
- The system prompt includes a **few-shot exemplar** interpolated via `PROJECT_DESIGN_EXEMPLAR` (`src/lib/ai/exemplars/projectDesign.ts`).
- The user message restates the project's data + asks for the output.
- Result is plain TEXT — no JSON tool-use, no structured output. The endpoint returns raw text for the user to review.

**Transparency / inspection pattern** — `recordUsage` returns an `inspection` block (`:202-209`) containing `model / temperature / maxTokens / systemPrompt / userMessage / rawResponse`. The endpoint then forwards this in the JSON response (per `generate-design/route.ts:103-110`):
```ts
return NextResponse.json({
  generated_design: result.generatedDesign,
  usage_id: result.usageId,
  input_tokens: result.inputTokens,
  output_tokens: result.outputTokens,
  cost_usd: result.costUsd,
  inspection: result.inspection,
});
```
This lets the client display the prompt + response live alongside the proposal — the user sees the actual inputs that produced the suggestion before deciding to accept it.

**Reference AI route — `src/app/api/operations/ai/generate-design/route.ts` (PR-Ops-3.6+):**
- **Auth pattern (`:65-73`):** `getVerifiedEmail()` → 401 if absent; `prisma.users.findFirst` → 404 if absent. **No tier check.** Verified via `grep -rn "tier\|requireTier" src/app/api/operations/ai/ src/lib/ai/` → zero matches. The operations AI surface is single-user gated by cookie auth alone. **The North Star optimizer should mirror this — no tier check.**
- **Body shape:** `RequestBody` interface at `:27-32`; validated field-by-field with `validateItems` at `:37-63` returning a discriminated `{ ok: true, items } | { ok: false, message }` union.
- **Call site:** `await generateProjectDesign({ ... })` (`:93-101`) — server-side function does the Anthropic call + `recordUsage` writes the audit + usage row.
- **Response:** full inspection forwarded (`:103-110`).
- **Error handling (`:111-117`):** structured `{ error, message }` 500 on failure. No fallback text, no silent degradation. **Confirms the "no fallback" idiom: AI failure surfaces as a 5xx; the frontend handles by showing the error, not by inserting placeholder text.**

C. TASK DATA (the "reality")

**Task fetch endpoints:**
- **`GET /api/operations/projects`** (`src/app/api/operations/projects/route.ts:40-78+`): returns the user's projects with `entity_id` filter optional. Sort: `priority_score desc`, `target_completion_date asc`, `updated_at desc`. Returns ALL fields (`title`, `goal`, `problem`, `diagnosis`, `design`, `goal_items[]`, `problem_items[]`, `diagnosis_items[]`, `status`, `target_completion_date`, `estimated_total_minutes`, `estimated_total_cost_usd`, etc., per the `operations_projects` model at `schema.prisma:2559-2594`).
- **`GET /api/operations/projects/[id]/tasks`** (`src/app/api/operations/projects/[id]/tasks/route.ts:39-78`): returns this project's tasks. Sort: `display_order asc`, `deadline asc nulls last`, `updated_at desc`, then in-memory sort by `STATUS_ORDER`. Returns full `Task` rows including `title`, `description`, `status`, `estimated_minutes`, `estimated_cost_usd`, `coa_code`, `actual_cost_usd`, `actual_minutes`, `deadline`, `priority_score`, etc.
- **No cross-project tasks-only endpoint.** To collect tasks across multiple projects, the client either calls `/api/operations/projects` then iterates `/api/operations/projects/[id]/tasks` per project — OR the new optimizer endpoint accepts a `task_ids[]` from the client and fetches them server-side in a single Prisma query (recommended; one round-trip).

**Project ↔ section link signal: NONE.** No column on `operations_projects` or `operations_project_tasks` references the North Star or any section name. Verified by:
- `grep -in "north_star\|mission\|one_year\|three_year\|guiding" prisma/schema.prisma | grep -i "operations_proj"` → zero hits (the schema's project + task models don't reference the North Star at all).
- No metadata column links a project to a North Star section.

So **the smart-default has no machine-readable signal to work from.** The cleanest honest options:

- **Option A (recommended): default to ALL ACTIVE projects pre-checked; user uncheckts.** Truth-first; no inferred relevance; the user retains full control. Cost: a larger AI payload (mitigated by Section C7's summary cap below).
- **Option B: default to NO projects checked; user opts in.** Safer for cost but high-friction; the user has to remember to check what they want every time.
- **Option C: heuristic match (e.g., projects whose `title` or `goal_items` contain keywords from the section text).** Tempting but introduces a fallback-like inference: if the heuristic is wrong, the user might trust a flawed smart-default. Violates the no-silent-fallback principle.
- **Recommend A.** Surface a count ("3 of 5 projects selected · est. ~2,400 input tokens · ~$0.012") so Alex can uncheck high-volume projects he doesn't want in this round.

**Token / cost consideration:**
- **Per-task summary cost (recommended payload shape):** title (≤200 chars) + status + COA code + estimated_minutes + estimated_cost_usd + 200-char description excerpt + 200-char notes excerpt ≈ **~150 tokens per task**.
- **Per-project header cost:** title + goal_items (up to 20 × 500 chars) + problem_items + diagnosis_items + design field ≈ up to **~2,000 tokens per project** at the max.
  - In practice with Alex's institutional voice, expect **300-800 tokens per project header** for early-state projects (fewer items, shorter prose).
- **Typical run (single-user, ~5 active projects, ~5 tasks per project):** project headers ~2,500 tokens + tasks ~3,750 tokens + section text ~500 tokens + system prompt ~800 tokens ≈ **~7,500 input tokens** → at $3.00/M input + ~500 output tokens at $15.00/M = **~$0.030 per call**. Trivial.
- **Worst-case (all 20 projects with full goal/problem/diagnosis items):** ~50,000 input tokens → ~$0.15. Still well below any concerning threshold but the visible count above gives Alex agency.
- **Recommendation: send a SUMMARIZED task payload — NOT full raw tasks.** Build a compact text block per project on the server side from selected project+task IDs:
  ```
  PROJECT: <title> (status=<status>, target=<target_completion_date>)
  Goal: <first 3 goal_items joined>
  Tasks (n=12):
    - [open] File FAFSA 2026-2027 (est $0, deadline 2026-08-01)
    - [in_progress] Complete personal tax return (est $200, deadline 2026-04-15)
    ...
  ```
  This caps the payload at predictable size and gives the AI the structured shape it can synthesize against. Full task details are ALWAYS retrievable from the audit / from the source rows if Alex wants to inspect.
- **Surface the token estimate + cost estimate IN THE UI** before the call fires. Alex's "every AI inference logged with cost" value extends to "and the cost is visible before the user commits to spending it". This is the single highest-leverage transparency feature in the optimizer.

D. FEATURE SHAPE

**New AI endpoint:** `POST /api/operations/ai/optimize-north-star-section`.

- **Request body:**
  ```ts
  interface OptimizeRequest {
    section_name: 'mission_statement' | 'one_year_target' | 'three_year_target' | 'guiding_principles';
    current_text: string;          // the existing section text (may be empty for first-time generate)
    project_ids: string[];         // selected project UUIDs (empty array = "no projects context")
    // task_ids is not separately needed in v1: send all tasks of selected projects.
    // If task-level granularity is needed later, add task_ids[] as a refinement.
  }
  ```
- **Auth + ownership:** `getVerifiedEmail()` → user → load each `project_id` filtered by `user_id` (defensive 404 on cross-user). **No tier check** — mirrors existing operations AI routes.
- **Response shape (mirror generate-design):**
  ```ts
  {
    proposed_text: string,         // the AI's proposal — lands in editable textarea
    usage_id: string,
    input_tokens: number,
    output_tokens: number,
    cost_usd: string,
    inspection: { model, temperature, maxTokens, systemPrompt, userMessage, rawResponse },
  }
  ```
- **Server-side flow:**
  1. Validate `section_name` against the 4-section allowlist.
  2. Validate `current_text` ≤ 5,000 chars (matches the TEXT column intent + sane prompt ceiling). `project_ids` is array of UUIDs, length ≤ 20.
  3. Load the projects + tasks: `prisma.operations_projects.findMany({ where: { id: { in: project_ids }, user_id }, include: { tasks: true } })`.
  4. Build the summarized task block (per C7).
  5. Call `generateNorthStarSectionOptimization(...)` — a new helper in `src/lib/ai/generateNorthStarSectionOptimization.ts` that wraps `recordUsage` with the appropriate system prompt + user message.
  6. Return the inspection block + proposed text.

**System prompt draft (Phase 2 will refine):**

```
You are refining ONE section of a user's North Star ("vision document")
against the reality of their actual project work. Your job is to propose
a sharpened version of THIS SECTION that is grounded, specific, and true
to the work the user is actually doing.

You receive:
  - SECTION: the name of the section being refined (mission_statement,
    one_year_target, three_year_target, or guiding_principles)
  - CURRENT TEXT: the user's existing wording for that section
  - PROJECT CONTEXT: a summary of the user's active projects and their
    tasks — this is the "reality" the section should be grounded in

Your output: PROPOSED TEXT for ONLY this section. No preamble. No
section header. No surrounding markdown. Just the prose that would
replace what's currently in the textarea.

RULES (non-negotiable):
  1. Ground every claim in either the CURRENT TEXT or the PROJECT
     CONTEXT. Do NOT invent commitments the user hasn't made.
  2. Sharpen, don't expand. If the current text is 3 lines and the
     reality is 5 projects, the proposal should still be 3-5 lines —
     the goal is precision, not verbosity.
  3. Replace theoretical generality with what the tasks reveal. If
     the current text says "build a great product" and the projects
     show 3 product-build tasks with specific deadlines, the proposal
     should reference the specific products and timelines.
  4. Match the section's natural voice:
       - mission_statement: declarative, present-tense, identity-shaping
         ("Temple Stuart accounting platform serves...")
       - one_year_target: concrete, dated, measurable ("By <month> 2027,
         Temple Stuart Trading has produced...")
       - three_year_target: same as one-year but at three-year horizon
       - guiding_principles: imperative or declarative, one principle
         per line, opinionated and specific
  5. If the PROJECT CONTEXT is empty (no projects supplied), propose
     based on CURRENT TEXT alone — sharpen wording, eliminate filler.
     Do NOT fabricate project references.
  6. Honesty over polish. If the projects contradict the current
     text (e.g., current says "I value simplicity" but projects show
     6 simultaneous tracks), reflect that tension in the proposal
     rather than smoothing it over.

OUTPUT: just the proposed section text. No preamble. Plain prose,
whitespace-pre-wrap rendering. Max ~1500 chars for mission/targets,
~3000 chars for guiding_principles.
```

**UI flow (Phase 2):**
1. In the **edit form** view of each of the 4 prose sections, add a small **"+ optimize from reality"** link/button beside the label.
2. Click → opens a small inline **picker panel** (NOT a modal — modals are friction; inline panel is in-context):
   - Header: "Optimize <SECTION_NAME> from your project work"
   - Checkbox list of active projects (defaulted: all checked per C6 Option A)
   - **Cost estimate row:** "Selected: <N> projects · ~<T> input tokens · ~$<C> per call" — updates live as Alex toggles. Computed client-side from a rough char-count heuristic (the actual cost is logged server-side).
   - "optimize" button (fires the POST) + "cancel" (closes panel, no call).
3. On success: the **section's textarea is REPLACED with the proposed text** (the existing edit form is the canvas — no new textarea component needed). Alex edits freely (it's a normal textarea). A small "🤖 AI proposal · undo to original" affordance lets him revert without typing.
4. On save (the EXISTING "save north star" button): the whole form is upserted as today — the AI proposal becomes the new section text. No new save endpoint. **Human commits.**
5. On failure: error message surfaced in the existing red error banner area (`SectionB_NorthStar.tsx:201-205`). NO fallback text inserted into the textarea. NO retry. Alex sees the error and decides to retry or skip.
6. Optional `inspection` view: a small "🔍 see prompt + response" link that expands the inspection block in-place. Mirrors the existing project-design inspection drawer (`src/components/workbench/operations/ai/InspectionDrawer.tsx` — same component reusable).

**Human-commits confirmed:** YES. The optimize endpoint NEVER calls `prisma.operations_north_star.upsert`. The proposal lives in client state (the textarea) until Alex hits the existing "save north star" button. The endpoint's job ends at "here is the proposed text + the inspection block".

**Cost-logged confirmed:** YES. Every call routes through `recordUsage` which writes the `operations_ai_usage` row + the `operations_ai_inference` audit row in one transaction-equivalent sequence. Cost field is `Decimal(10,6)` so 6-decimal precision preserved (per `schema.prisma:2846`). The `purpose` field gets a discriminating value (recommend `'north_star_section_optimization'`) so cost analytics by feature stays clean.

**No-fallback confirmed:** YES. Three explicit no-fallback gates:
1. If Anthropic call fails → `recordUsage` re-throws; route catches and returns 500 with `{ error, message }`. Frontend surfaces the error in the existing error banner. **No silent placeholder text.**
2. If the user selects zero projects → the call STILL proceeds (the system prompt rule #5 handles "empty PROJECT CONTEXT"). This is NOT a fallback — it's an intentional degenerate-input mode for "sharpen the current text alone". Alex can choose this explicitly.
3. If the AI returns empty text → endpoint returns 502 with `{ error: 'EmptyResponse' }`. Frontend shows the error. **No automatic re-prompt, no default text.**

**Schema change: NONE.** Confirmed:
- `operations_ai_usage` already exists and accommodates the new `purpose='north_star_section_optimization'` without alteration (string column, no enum).
- `operations_north_star` is the existing save target via the existing upsert.
- No new tables. No new columns. No migration.

**Scope + files (estimated for Phase 2):**

1. `src/lib/ai/generateNorthStarSectionOptimization.ts` (NEW, ~120 lines) — wraps `recordUsage` with the system prompt + user-message builder + `bulletList`-style task summarizer. Mirrors `generateProjectDesign.ts` shape.
2. `src/app/api/operations/ai/optimize-north-star-section/route.ts` (NEW, ~120 lines) — POST endpoint. Auth → validation → project/task fetch → call generator → return inspection. Mirrors `generate-design/route.ts` shape exactly.
3. `src/components/workbench/operations/SectionB_NorthStar.tsx` (MODIFY, ~150 lines added) — add the "+ optimize from reality" button per section (4 spots in the editor); add the inline picker-panel component; add the proposed-text/undo state per section; wire the cost estimate. Whole-form save flow unchanged.
4. `src/components/workbench/operations/types.ts` (MODIFY, ~10 lines) — add `OptimizeSectionRequest` / `OptimizeSectionResponse` types if they need to be shared with the picker panel.
5. (Optional reuse) `src/components/workbench/operations/ai/InspectionDrawer.tsx` — extend its props interface to accept arbitrary inspection blocks (likely already generic; verify in Phase 2).
- **Total: 2 new files + 2 modified + 1 optional reuse. No new DB table. No new migration. No schema change. ~400 lines net added.**

**Open decisions for Alex:**

1. **v1 sections covered: 4 prose only (mission + 1yr + 3yr + principles) — or include core_values + life_stage?** Recommend prose-only v1. Core_values is a chip-list (different UX shape); life_stage is short (low optimization benefit). Add later in a focused PR if desired.
2. **Smart default for project selection: ALL projects pre-checked (recommended) vs none vs heuristic match?** Recommend ALL pre-checked + visible token/cost estimate so Alex can uncheck what's not relevant. No heuristic match — that's a hidden fallback.
3. **Task payload shape: full raw tasks vs summarized text block?** Recommend SUMMARIZED (per C7) — predictable cost, AI synthesizes against structured shape, full details still retrievable from operations_ai_usage rows + the source DB. Send a per-project text block, not a JSON dump.
4. **Output rendering: replace the textarea content directly (recommended) vs side-by-side current-vs-proposed diff vs separate "proposed" textarea?** Recommend REPLACE with an "undo to original" affordance. Simple, mirrors the existing edit flow, no new component.
5. **Inspection view: inline expandable in-context (recommended) vs separate page vs drawer?** Recommend in-context expandable — mirrors the project-design InspectionDrawer pattern; one component reused.
6. **Cost-estimate display BEFORE the call: client-side approx (recommended) vs server-side preflight endpoint?** Recommend client-side approx with a clear "estimated" label. Server-side preflight doubles the round-trips for negligible accuracy gain.
7. **`purpose` enum-style namespacing in operations_ai_usage:** `north_star_section_optimization` vs `north_star_mission_optimization` / `north_star_one_year_optimization` / etc. (one per section)? Recommend ONE bucket (`north_star_section_optimization`) and put the specific section name in `inputs_summary` — keeps the analytics index simple, still differentiable.
8. **Section value for the `target_table` in the audit log: `operations_north_star` (recommended, attributes the inference to the entity affected) vs `null` (stateless)?** Recommend `operations_north_star` + `target_id = northStar.id`. Lets Alex filter the audit log by target=this-NS and see every AI proposal that touched it.
9. **Token/cost ceiling: hard cap on input_tokens?** Recommend SOFT cap with warning at the picker panel (e.g., "selecting 15+ projects may cost ~$0.30 — consider narrowing"). No hard refusal; Alex's call. Costs in this range are trivial; the friction of a hard cap is worse than the dollar spend.
10. **Future: per-section diff history (a `north_star_history` table that snapshots each accepted version)?** OUT OF SCOPE for this PR. The audit log + operations_ai_usage rows already record what AI proposed; the `_updated` audit row captures what Alex committed. The full "see how my North Star evolved over time" view can be built later from those two sources without a new table.

NO SOURCE FILES MODIFIED. Audit report at audit-reports/pr-ops-5.16-phase-1.md.
