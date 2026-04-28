# Mission Planner Audit 1/3 — Routing + UI Components — 2026-04-25

## 1. Routing State

### src/app/mission/
**DOES NOT EXIST.** Directory was deleted in commit `dbb1c9e` (PR claude/ops-create-mission). API routes at `src/app/api/mission/` still exist (9 route files) but there is no page route for `/mission`.

### src/app/ops/
**EXISTS.** 4 files:

| File | Component Rendered | Component Path |
|------|-------------------|----------------|
| `layout.tsx` | Passthrough `<>{children}</>` — no nav, no wrapper (line 1-3) | N/A |
| `page.tsx` | `<AppLayout>` + `<OpsSubNav>` + `<OperationsPlanner>` (lines 3-13) | `src/components/ops/OperationsPlanner.tsx` |
| `bookkeeping/page.tsx` | `BookkeepingQuestionnairePage` — self-contained 817-line component (line 38) | Inline in page file, imports from `@/lib/ops/bookkeepingQuestions` |
| `trading/page.tsx` | `TradingQuestionnairePage` — self-contained 791-line component (line 39) | Inline in page file, imports from `@/lib/ops/tradingQuestions` |

**Layout:** `layout.tsx` is a no-op passthrough (`<>{children}</>`). Sub-navigation is handled by `<OpsSubNav>` rendered individually inside each page component, not via the layout.

**Sub-navigation (OpsSubNav.tsx lines 7-13):**
- Overview → `/ops` (active)
- Bookkeeping → `/ops/bookkeeping` (active)
- Trading → `/ops/trading` (active)
- Travel → disabled (no href)
- Operations → disabled (no href)

### src/app/office/
**DOES NOT EXIST.** No directory, no files, no references found.

### Other relevant routes
- `src/app/api/mission/` — 9 route files for the mission pipeline API (create, get by ID, brain-dump, run-stage, approve/reject, confirm-goal, reality-constraints, active)
- `src/app/api/ops/` — 9 route files for questionnaire/analysis/synthesis/compliance-tasks/daily-plan/brain-dump/ai-plan/mission

---

## 2. UI Components

### src/components/ops/ (15 files)

| File | Export | Purpose | Data Source |
|------|--------|---------|-------------|
| `BrainDump.tsx` | `BrainDump` | Old-style bullet-point brain dump with "Organize My Thoughts" button | POSTs to `/api/ops/brain-dump` |
| `BudgetCard.tsx` | `BudgetCard` | Daily budget target/actual card for Ops daily dashboard | Props from `DailyDashboard` state |
| `DailyDashboard.tsx` | `DailyDashboard` | Daily execution dashboard (tasks, schedule, health, meals, budget, end-of-day) | Fetches `/api/ops/daily-plan`, `/api/ops/mission` |
| `EndOfDayCard.tsx` | `EndOfDayCard` | Day score with sub-scores, wins/blockers/reflection | Props from `DailyDashboard` state |
| `HealthCard.tsx` | `HealthCard` | Weight, workout, hydration, calories, protein, sleep, steps | Props from `DailyDashboard` state |
| `MealsCard.tsx` | `MealsCard` | Meal tracking with emoji + calories/protein totals | Props from `DailyDashboard` state |
| `MissionPlanning.tsx` | `MissionPlanning` | Full mission form (goal, milestones, constraints, health/personal/meals) + roadmap generation | Fetches `/api/ops/mission`, `/api/ops/mission/generate-roadmap` |
| `OperationsPlanner.tsx` | `OperationsPlanner` | Main Overview page: mission title+duration, trigger questions, open dump, prompt preview, Structure stage output with approve/reject | Fetches `/api/mission/active`, `/api/mission/create`, `/api/mission/[id]/brain-dump`, `/api/mission/[id]/run-stage`, `/api/mission/[id]` |
| `OpsSubNav.tsx` | `OpsSubNav` | Sub-navigation tabs (Overview, Bookkeeping, Trading, Travel[disabled], Operations[disabled]) | `usePathname()` for active state |
| `QuestionInput.tsx` | `QuestionInput` | Form input renderer for all 6 question types (text, boolean, select, multiselect, checklist, date) | Props: `OpsQuestion` from bookkeeping registry |
| `RecordView.tsx` | `RecordView` | Cinematic full-screen recording view (morning/evening tabs) for daily plan | Props: `DailyPlan` from `DailyDashboard` |
| `ScheduleCard.tsx` | `ScheduleCard` | Time-block schedule card for daily dashboard | Props from `DailyDashboard` |
| `TasksCard.tsx` | `TasksCard` | Inline editable task list with priority dots for daily dashboard | Props from `DailyDashboard` |
| `types.ts` | Multiple interfaces | `Task`, `ScheduleBlock`, `Meal`, `DailyPlan`, `PreviousDay`, `Mission`, `Milestone`, `WeekPlan`, `Roadmap`, `MetricsCheck`, `SuccessMetric` | N/A — type definitions only |
| `useAutoSave.ts` | `useAutoSave` | Debounced save hook with "Saved" toast state | POSTs to `/api/ops/daily-plan` |

### src/components/mission/ (6 files)

| File | Export | Purpose | Data Source |
|------|--------|---------|-------------|
| `BrainDumpSection.tsx` | `BrainDumpSection` | Trigger-question brain dump (5 groups, 15 questions) + open dump. Two-column layout. | POSTs to `/api/mission/[id]/brain-dump`. Imports `TRIGGER_QUESTION_GROUPS` from `@/lib/mission/trigger-questions` |
| `CreateMissionCard.tsx` | `CreateMissionCard` | Mission title + duration presets (30/75/90d). Shows completed state when mission exists. | POSTs to `/api/mission/create` |
| `GoalConfirmationSection.tsx` | `GoalConfirmationSection` | Select from 3 candidate goals, edit statement, review open questions. | POSTs to `/api/mission/[id]/confirm-goal`. Reads `parsedOutput` from approved goal_discovery stage |
| `MissionPipeline.tsx` | `MissionPipeline` | Vertical pipeline orchestrator: brain dump → structure → goal discovery → goal confirmation → reality constraints → reality audit → roadmap | Renders `BrainDumpSection`, `StageSection`, `GoalConfirmationSection`, `RealityConstraintsSection` |
| `RealityConstraintsSection.tsx` | `RealityConstraintsSection` | Product reality (exists/broken/missing) + operational reality (hours, budget, personal, energy) | POSTs to `/api/mission/[id]/reality-constraints` |
| `StageSection.tsx` | `StageSection` | Reusable AI pipeline stage renderer with full observability (input, system prompt, user prompt, raw response, parsed output, approve/reject) | POSTs to `/api/mission/[id]/run-stage`, `/api/mission/[id]/stage/[stageId]/approve`, `reject` |

### src/components/office/
**DOES NOT EXIST.**

### Specific component findings

**Brain dump UI:** TWO implementations exist:
1. `src/components/ops/BrainDump.tsx` — old bullet-point style with "Organize My Thoughts" button. Posts to `/api/ops/brain-dump`. **Not currently rendered** — `OperationsPlanner.tsx` does not import it (removed in commit `208f69f`).
2. `src/components/mission/BrainDumpSection.tsx` — trigger-question-based with 5 groups. Posts to `/api/mission/[id]/brain-dump`. **Not currently rendered by /ops** — used only by `MissionPipeline.tsx` which has no route.
3. `src/components/ops/OperationsPlanner.tsx` — contains a THIRD inline brain dump implementation (trigger questions + open dump + prompt preview + structure stage). Lines 4-6 import from `@/lib/mission/trigger-questions` and `@/lib/mission/prompts`. **This is what currently renders at /ops.**

**Structure stage output:** Rendered inline in `OperationsPlanner.tsx` (lines ~415-560) as `StructureStageOutput` function component. Shows discovered projects, themes, contradictions, constraints, missing inputs, dependencies, logic gaps. Includes approve/reject buttons.

**Bookkeeping questionnaire:** `src/app/ops/bookkeeping/page.tsx` (817 lines). Self-contained page component. Imports `BOOKKEEPING_OPS_MODULE` from `@/lib/ops/bookkeepingQuestions`. Renders 90 questions via `QuestionInput`. Fetches answers from `/api/ops/questionnaire-answers`, analyses from `/api/ops/workstream-analysis`, synthesis from `/api/ops/synthesis-report`, tasks from `/api/ops/compliance-tasks`. All use `moduleId: 'bookkeeping'`.

**Trading questionnaire:** `src/app/ops/trading/page.tsx` (791 lines). Near-identical copy of bookkeeping page. Imports `TRADING_OPS_MODULE` from `@/lib/ops/tradingQuestions`. Uses `moduleId: 'trading'`. Casts `TradingQuestion` to `OpsQuestion` for `QuestionInput` compatibility (line 9 imports `OpsQuestion`).

**Travel module UI:** **DOES NOT EXIST.** No travel-specific ops component found. Tab is disabled in OpsSubNav.

**Operations module UI:** **DOES NOT EXIST.** No operations-specific ops component found. Tab is disabled in OpsSubNav.

**Mission overview/setup UI:** Three overlapping implementations:
1. `CreateMissionCard.tsx` — simple title + duration. Used by `OperationsPlanner` (but currently NOT imported — `OperationsPlanner` has its own inline mission creation at lines ~240-270).
2. `MissionPlanning.tsx` — full mission form with goal, milestones, constraints, health/personal/meals, roadmap generation. Referenced by `DailyDashboard` but the `DailyDashboard` code path to render it requires `mission === null && !editingMission` which conflicts with the `OperationsPlanner` wrapper.
3. `OperationsPlanner.tsx` — inline mission title + duration + brain dump. **This is what currently renders.**

---

## 3. Findings Summary

### EXISTS AND USABLE
- `/ops` route structure with sub-nav tabs (OpsSubNav)
- Bookkeeping questionnaire page (90 questions, full CRUD, analysis, synthesis, task generation)
- Trading questionnaire page (88 questions, same infrastructure)
- `QuestionInput.tsx` — generic input renderer for all question types
- Question registries: `bookkeepingQuestions.ts` (90 questions, 18 workstreams), `tradingQuestions.ts` (88 questions, 18 workstreams)
- Compliance task API (`/api/ops/compliance-tasks`) with 4 HTTP methods
- Workstream analysis API (`/api/ops/workstream-analysis`) with AI-powered decision register
- Synthesis report API (`/api/ops/synthesis-report`) with cross-workstream launch readiness
- Answer persistence API (`/api/ops/questionnaire-answers`)
- `StageSection.tsx` — reusable AI pipeline stage renderer with full observability

### EXISTS BUT MISALIGNED
- `src/components/ops/BrainDump.tsx` — old bullet-point brain dump, no longer imported by any route. Dead code.
- `src/components/ops/MissionPlanning.tsx` — elaborate mission form that references `/api/ops/mission` (a different mission system than `/api/mission/`). Not rendered by any current route.
- `src/components/mission/CreateMissionCard.tsx` — simple mission card, not imported by current OperationsPlanner (it has its own inline implementation).
- `src/components/mission/BrainDumpSection.tsx` — trigger-question brain dump, only used by MissionPipeline which has no route.
- `src/components/mission/MissionPipeline.tsx` — full vertical pipeline, but the `/mission/[id]` route that rendered it was deleted. No current route renders this.
- `src/components/mission/GoalConfirmationSection.tsx` — goal selection UI, only used by MissionPipeline (no route).
- `src/components/mission/RealityConstraintsSection.tsx` — constraint form, only used by MissionPipeline (no route).
- Daily dashboard components (DailyDashboard, BudgetCard, HealthCard, MealsCard, ScheduleCard, TasksCard, EndOfDayCard, RecordView, useAutoSave) — part of the /ops daily plan system, orthogonal to compliance questionnaire.
- `src/app/ops/layout.tsx` — empty passthrough, serves no purpose.
- TWO parallel mission API systems: `/api/ops/mission/` (used by MissionPlanning component) and `/api/mission/` (used by OperationsPlanner + MissionPipeline). Different schemas, different endpoints, overlapping purpose.

### DOES NOT EXIST
- `/ops/travel` page and travel question registry
- `/ops/operations` page and operations question registry
- Shared questionnaire page component (bookkeeping and trading are 817/791 lines of near-identical code)
- Task detail UI (compliance tasks exist in API but only show title+status inline)
- Evidence attachment UI (schema exists: `task_evidence`, `task_evidence_documents`, `task_evidence_code`, `task_evidence_urls` — no UI or API routes)
- Calendar integration for compliance tasks (fields exist on compliance_tasks model but no calendar UI)
- Code-reference evidence staleness detection (fields exist on `task_evidence_code` but no deploy hook or cron)
- Document expiration monitoring (field exists on `task_evidence_documents` but no cron)

---

## 4. Open Questions

- There are TWO mission API systems: `/api/ops/mission/` (GET/POST, used by `MissionPlanning.tsx`) and `/api/mission/` (9 routes including create, active, run-stage, approve, etc., used by `OperationsPlanner.tsx`). Which is canonical? Should one be deleted?
- `src/components/ops/BrainDump.tsx` is dead code (not imported anywhere). Should it be deleted?
- `src/components/mission/MissionPipeline.tsx` and its children (`GoalConfirmationSection`, `RealityConstraintsSection`, `StageSection`) were built for a `/mission/[id]` route that was deleted. Are these components still needed, or should they be deleted?
- `src/components/ops/MissionPlanning.tsx` references types from `src/components/ops/types.ts` (Mission, Roadmap, etc.) that overlap with but differ from the mission pipeline types in `src/lib/mission/prompts/types.ts`. Which type system is canonical?
- The bookkeeping and trading questionnaire pages are 817 and 791 lines of near-identical code. Should they be refactored into a shared component before adding Travel and Operations modules?
- `src/app/ops/layout.tsx` is a no-op passthrough. Should it be deleted, or should OpsSubNav be moved into it so pages don't each have to import it?
- `QuestionInput.tsx` accepts `OpsQuestion` (with `regulatoryTag: RegulatoryTag` — bookkeeping-specific union type). Trading page casts `TradingQuestion` to `OpsQuestion` as a workaround. Should `QuestionInput` accept a generic interface with `regulatoryTag: string`?
- The daily dashboard system (DailyDashboard + 6 cards + RecordView + useAutoSave) is orthogonal to the compliance questionnaire system. Are these two systems intended to coexist on the Ops tab, or should one move elsewhere?
