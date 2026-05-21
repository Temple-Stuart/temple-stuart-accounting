PR-OPS-5.17 PHASE 1 AUDIT REPORT
================================

BRANCH STATUS
- main top 3: `cd7f985` (merge #565 PR-Ops-5.14 diagnosis-prefill-fix) → `cff9c21` (5.14 commit) → `dbe2004` (merge #564 PR-Ops-5.16 north-star-optimizer).
- **PR-Ops-5.14 confirmed merged** (#565). **PR-Ops-5.16 confirmed merged** (#564). PR-Ops-5.15 (#562) also in history.
- current branch: `claude/pr-ops-5.17-north-star-to-ai-audit`

A. NORTH STAR DATA

**Model `operations_north_star`** (`prisma/schema.prisma:2936-2958`) — fields available to inject (post-PR-Ops-5.15 widening; verified against current schema):
- `mission_statement` — `String? @db.Text` (:2939) — unbounded prose.
- `life_stage` — `String? @db.Text` (:2940, widened in PR-Ops-5.15) — short label.
- `core_values` — `String[] @default([])` (:2941) — array of value chips.
- `guiding_principles` — `String? @db.Text` (:2942) — unbounded; Alex's is ~25 principles.
- `one_year_target` — `String? @db.Text` (:2943).
- `three_year_target` — `String? @db.Text` (:2944).
- `current_location_label` — `String? @db.Text` (:2945, widened) — irrelevant to scoping.
- `current_timezone` — `String @db.VarChar(64)` (:2946) — irrelevant to scoping.
- `review_cadence_days`, `last_reviewed_at`, `next_review_at` — review-cycle metadata, irrelevant to scoping.

**GET endpoint** (`src/app/api/operations/north-star/route.ts:21-43`): `prisma.operations_north_star.findUnique({ where: { user_id: user.id } })` (:31-33), returns `{ northStar }` or `{ northStar: null }`. Auth = `getVerifiedEmail` (:23) + `prisma.users.findFirst` (:26-28). Read-only, user-scoped.

**Recommended fields to inject:**

| field | inject? | reasoning |
|---|---|---|
| `mission_statement` | **YES** | The WHY. Anchors every project to the purpose. |
| `one_year_target` | **YES** | The near-horizon sequencing. Lets the AI scope a project as a step toward the 1-year state, with realistic phasing. |
| `three_year_target` | **YES** | The long arc. Prevents scoping that optimizes the 1-year at the expense of the 3-year. |
| `guiding_principles` | **YES** | The HOW + the values + (per Alex) the AuDHD-first thesis + Phase 1/2/3 sequencing live here. This is the highest-signal field for "scope it the way I'd want it scoped." |
| `core_values` | **YES (light)** | Short, high-signal. Cheap to include. Tells the AI the stances the work must honor. |
| `life_stage` | **OPTIONAL** | One short line ("building"); cheap, mildly useful context. Recommend include — it's ~5 tokens. |
| `current_location_label` | **NO** | Geographic; irrelevant to project scoping. |
| `current_timezone` | **NO** | Scheduling metadata; irrelevant to scoping. |
| review cadence / timestamps | **NO** | Review-cycle bookkeeping; not vision content. |

**Recommendation: inject mission_statement + one_year_target + three_year_target + guiding_principles + core_values + life_stage** — i.e., the full vision content, OMIT the operational metadata (location, timezone, review cadence, timestamps).

**Token cost estimate:**
- Alex's North Star is substantial. Rough sizing:
  - mission_statement ≈ 500 chars
  - one_year_target ≈ 400 chars
  - three_year_target ≈ 400 chars
  - guiding_principles ≈ 25 principles × ~120 chars ≈ 3,000 chars
  - core_values ≈ 8 × 20 chars ≈ 160 chars
  - life_stage ≈ 30 chars
  - labels + framing block ≈ 300 chars
  - **Total ≈ 4,800 chars ≈ ~1,200 tokens** added per generation call.
- At Sonnet 4 input pricing ($3.00/M): **~$0.0036 added per call.** Negligible.
- The existing per-call cost (project items + exemplar + system prompt) is ~5,000-8,000 input tokens (~$0.02-0.05); adding ~1,200 tokens raises it ~15-25% — well within the "every inference logged with cost" budget.
- **Recommendation: FULL-INJECT the recommended fields.** Curating a subset of guiding_principles (e.g., "top 5") would require a selection heuristic — a hidden judgment the AI shouldn't make and a fallback-flavored decision. The whole point is the AI scopes against the WHOLE vision; sending all principles for ~$0.004 is the honest, cheap choice. The cost is logged per `recordUsage`, so it's transparent.

B. PROMPT CONSTRUCTION

**`generateProjectDesign.ts`:**
- `SYSTEM_PROMPT` constant (`:51-95`): the static instruction set + grammar map + exemplar.
- `userMessage` (`:98-109`): per-call, built from `projectTitle` + goal/problem/diagnosis bullet lists.
- **Injection point recommendation:** add the North Star as a clearly-labeled context block at the TOP of the `userMessage` (before "Project title:"), NOT in the system prompt. Reasoning: the North Star is per-USER data, not a static instruction; it belongs in the user message alongside the other per-call inputs (the system prompt stays the stable instruction layer). Format:
  ```
  THE USER'S NORTH STAR (their overarching vision — scope this project as a
  coherent PART of this vision, not in a vacuum):
  Mission: <mission_statement>
  1-year target: <one_year_target>
  3-year target: <three_year_target>
  Core values: <core_values joined>
  Guiding principles:
  <guiding_principles>

  ───

  Project title: "<title>"
  GOAL items: ...
  ```
- A ONE-LINE pointer should also be added to the SYSTEM_PROMPT so the model knows the block is coming and how to weight it: e.g., after the grammar map, "The user message MAY begin with the user's NORTH STAR — treat it as the strategic frame: scope this project as a coherent part of that vision, respect its sequencing and values, and do not propose work that contradicts it."

**`generateProjectTasks.ts`:**
- `SYSTEM_PROMPT` constant (`:87-189`): instruction set + voice rules + exemplar.
- `userMessage` (`:192-203`): per-call, built from `projectTitle` + goal/problem/diagnosis bullet lists.
- **Injection point: identical pattern** — prepend the North Star context block to the `userMessage` (`:192`), plus a one-line pointer in the SYSTEM_PROMPT's INPUTS section (`:91-94`) noting the optional NORTH STAR frame.

**Call chain (endpoint → generator):**
- **Stateless (create-form) endpoints:**
  - `src/app/api/operations/ai/generate-design/route.ts:93-101` → `generateProjectDesign({ userId, userEmail, projectId: '', projectTitle, goalItems, problemItems, diagnosisItems })`.
  - `src/app/api/operations/ai/generate-tasks/route.ts:117-125` → `generateProjectTasks({ ... projectId: '' ... })`.
- **Per-project endpoints:**
  - `src/app/api/operations/projects/[id]/generate-design/route.ts:72-79` → `generateProjectDesign({ ... projectId, projectTitle: project.title, ... })`.
  - `src/app/api/operations/projects/[id]/generate-tasks/route.ts:73` → `generateProjectTasks({ ... })`.
- **All 4 endpoints already do `getVerifiedEmail()` + `prisma.users.findFirst()`** to resolve `user`. The North Star fetch slots immediately after the user lookup in each of the 4: `const northStar = await prisma.operations_north_star.findUnique({ where: { user_id: user.id } });` then thread it into the generator call as a new OPTIONAL field on `GenerateInput`.
- **`GenerateInput` interface** (`generateProjectDesign.ts:20-28` and `generateProjectTasks.ts:25-33`) gets one new optional field, e.g. `northStar?: NorthStarContext | null`, where `NorthStarContext` is a small interface holding the 6 inject fields. The generator's `userMessage` builder conditionally prepends the block when `northStar` is present + non-empty.

C. ENDPOINTS

**Where to fetch the North Star (all 4 endpoints):** immediately after the `user` lookup, before the generator call:
```ts
const northStar = await prisma.operations_north_star.findUnique({
  where: { user_id: user.id },
});
```
- Stateless endpoints: insert after `:73` (generate-design) / `:82` (generate-tasks).
- Per-project endpoints: insert after the project ownership check (after `:56` design / equivalent in tasks) — the North Star is fetched by `user.id`, independent of the project.

**Pass-through:** add `northStar: northStar ? toNorthStarContext(northStar) : null` to each generator call. `toNorthStarContext` is a tiny mapper extracting the 6 inject fields. Same `user.id` already authorized — **no new auth, no new ownership check** (the North Star is uniquely keyed by `user_id`, so `findUnique({ where: { user_id: user.id } })` cannot leak another user's row).

**No-North-Star edge case (NO FABRICATION):**
- If `findUnique` returns `null` (user never saved a North Star), pass `northStar: null` to the generator.
- The generator's `userMessage` builder OMITS the context block entirely when `northStar` is null/empty — falls back to the EXACT current behavior (title + goal/problem/diagnosis only).
- **This is NOT a silent degradation** — it's the honest "no vision set yet" case. The AI scopes from the project items alone, exactly as it does today. No placeholder vision, no invented mission, no "[no north star]" filler in the prompt.
- Defensive empty-check: also treat a North Star row whose inject fields are ALL empty/null as "no context" (omit the block) — a row can exist with only `review_cadence_days` set. Confirm per-field: only build the block from the fields that are actually populated.
- Alex HAS saved his North Star (per context), so the populated path is the live one; the null path is the honest edge case for any future user or pre-save state.

D. OVER-ENGINEERING TUNE

**Offending prompt language: NONE EXPLICIT.** Grep for "A/B", "completion rate", "abandonment", "metric", "experiment", "test with", "session test", "measure", "validation", "founder", "solo" across both generators → **zero matches.** The over-engineering the pilot exhibited (A/B tests, completion-rate metrics, "test with 10 real tasks", "30-minute session tests") is **EMERGENT**, not instructed. It arises from:
- `generateProjectTasks.ts:87` / `generateProjectDesign.ts:51`: the "institutional rigor of Bridgewater Associates' Principles, Citadel's risk discipline, and Renaissance Technologies' empirical method" framing — which pulls the model toward formal experimental validation and metrics-gathering, the register those institutions operate in.
- `generateProjectDesign.ts:64-65`: the "Decision points" / "scenarios that would re-trigger scoping" instruction — nudges toward measurement gates.
- The Student Loan exemplar is a regulated-process domain (FAFSA, deadlines, agencies) where formal rigor IS appropriate — so the few-shot teaches a heavyweight register that misfires on a solo-founder product-build project.

**Recommended founder-judgment additions (ADDITIVE — no text to delete):**
Add a guardrail block to BOTH system prompts. Recommended wording:
```
OPERATOR CONTEXT — SOLO FOUNDER, USER #1:
The user is a solo founder who is also User #1 of their own product. They
validate by USING the thing, not by running controlled experiments.
  - Favor decide-by-use over formal A/B testing, completion-rate metrics,
    abandonment-funnel analysis, or "test with N users" studies. A solo
    founder's direct judgment from real use IS the validation.
  - Do NOT propose tasks whose only output is a measurement (e.g., "run a
    30-minute session test", "instrument completion rates", "A/B test the
    flow"). Propose tasks that BUILD or DECIDE, then let real use surface
    what's wrong.
  - Institutional rigor here means SEQUENCING and DEPENDENCY discipline,
    NOT corporate product-management ceremony. Apply Bridgewater's
    "diagnose the root cause" rigor; skip the big-company growth-team
    apparatus.
```

**Where it slots:**
- `generateProjectDesign.ts`: in the SYSTEM_PROMPT, after the grammar map (after `:59`) and before the "The DESIGN you produce must:" list (`:61`) — so the operator-context frames everything that follows.
- `generateProjectTasks.ts`: in the SYSTEM_PROMPT, after the INPUTS section (`:91-94`) and before the OUTPUTS section (`:96`).

E. RECOMMENDATION

- **Inject fields + format:** mission_statement + one_year_target + three_year_target + guiding_principles + core_values + life_stage, as a clearly-labeled context block prepended to the `userMessage` in BOTH generators:
  ```
  THE USER'S NORTH STAR (their overarching vision — scope this project as a
  coherent PART of this vision, not in a vacuum):
  Mission: ...
  1-year target: ...
  3-year target: ...
  Life stage: ...
  Core values: ...
  Guiding principles:
  ...
  ───
  ```
  Plus a one-line pointer in each SYSTEM_PROMPT so the model knows to treat the block as the strategic frame.

- **Fetch + pass-through:** add `prisma.operations_north_star.findUnique({ where: { user_id: user.id } })` after the user lookup in all 4 endpoints (2 stateless + 2 per-project); add an optional `northStar?: NorthStarContext | null` field to both generators' `GenerateInput`; thread it through via a tiny `toNorthStarContext` mapper.

- **No-vision edge case (no fabrication):** `northStar` null OR all-inject-fields-empty → omit the context block entirely → exact current behavior. Honest "no vision set" case, NOT a silent fallback, NO placeholder vision.

- **Prompt-tuning (same files):** add the SOLO-FOUNDER OPERATOR CONTEXT guardrail block to both system prompts (additive — no offending text exists to remove; the over-engineering is emergent from the institutional framing + the regulated-domain exemplar).

- **Token cost:** ~1,200 tokens (~$0.004) added per call. Full-inject recommended; curating principles would require a hidden heuristic. Cost is logged per `recordUsage` — transparent.

- **Schema change: NONE.** Confirmed — read-only use of the existing `operations_north_star` row via the existing `findUnique`. No new column, no new table, no migration, no new write.

- **Scope + files (estimated for Phase 2):**
  1. `src/lib/ai/generateProjectDesign.ts` (modify) — add `NorthStarContext` type + optional `northStar` input field; add the SYSTEM_PROMPT pointer + the SOLO-FOUNDER guardrail; prepend the North Star block to `userMessage` when present. ~40 lines.
  2. `src/lib/ai/generateProjectTasks.ts` (modify) — identical changes. ~40 lines.
  3. `src/app/api/operations/ai/generate-design/route.ts` (modify) — fetch North Star, pass through. ~5 lines.
  4. `src/app/api/operations/ai/generate-tasks/route.ts` (modify) — same. ~5 lines.
  5. `src/app/api/operations/projects/[id]/generate-design/route.ts` (modify) — same. ~5 lines.
  6. `src/app/api/operations/projects/[id]/generate-tasks/route.ts` (modify) — same. ~5 lines.
  7. (optional) a shared `NorthStarContext` type + `toNorthStarContext` mapper in `src/lib/ai/northStarContext.ts` (NEW, ~30 lines) to avoid duplicating the mapper across 2 generators — recommend extracting to keep the 4 endpoints + 2 generators consistent.
  - **Total: 6 modified files + 1 optional new helper. ~130 lines. No schema, no migration, no new endpoint.**

- **Open decisions for Alex:**
  1. **Inject location into the prompt? Recommend NO (irrelevant to scoping).** Confirm.
  2. **life_stage: include (recommended, ~5 tokens) or omit?** Recommend include.
  3. **Curate guiding_principles (e.g., top N) or send all? Recommend send ALL** — curating is a hidden heuristic; cost is negligible (~$0.004).
  4. **Injection location: user message (recommended) vs system prompt?** Recommend user message — it's per-user data, not a static instruction; keeps the system prompt as the stable instruction layer and the North Star inspectable per-call in the `full_user_message` audit column.
  5. **Solo-founder guardrail wording: as drafted (D) or softer/sharper?** The draft bans measurement-only tasks explicitly. Confirm the strength — Alex may want it even sharper ("never propose analytics instrumentation unless the project's GOAL is analytics") or softer.
  6. **Apply to BOTH stateless (create-form) AND per-project endpoints? Recommend YES, all 4** — a project scoped from the create form should be just as vision-aware as one re-generated later. Confirm.
  7. **Extract the shared `NorthStarContext` mapper to a helper module (recommended) vs inline in each generator?** Recommend extract — single source of truth for which fields inject + how they format.
  8. **Should the North Star block also feed the North Star OPTIMIZER (PR-Ops-5.16) in reverse — i.e., does this create a circular "vision shapes tasks, tasks reshape vision" loop?** Out of scope for THIS PR (5.16 already reads tasks→vision; 5.17 adds vision→tasks). The loop is intentional and healthy (vision and reality co-refine), but each direction is human-gated (AI proposes, human commits), so no runaway. Just flag it; no action needed here.

NO SOURCE FILES MODIFIED. Audit report at audit-reports/pr-ops-5.17-phase-1.md.
