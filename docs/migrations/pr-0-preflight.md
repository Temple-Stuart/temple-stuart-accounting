# PR-0 Pre-Flight Report — Legacy Mission Planner Cleanup

## 1. Row Count Queries (Alex: run against Azure Postgres)

```sql
SELECT 'missions' AS t, COUNT(*) FROM missions UNION ALL
SELECT 'mission_stages', COUNT(*) FROM mission_stages UNION ALL
SELECT 'brain_dump_entries', COUNT(*) FROM brain_dump_entries UNION ALL
SELECT 'reality_constraints', COUNT(*) FROM reality_constraints UNION ALL
SELECT 'roadmap_weeks', COUNT(*) FROM roadmap_weeks UNION ALL
SELECT 'mission_tasks', COUNT(*) FROM mission_tasks UNION ALL
SELECT 'daily_plans_with_mission', COUNT(*) FROM daily_plans
  WHERE mission_id IS NOT NULL;
```

**Alex: paste results here before approving Phase 2.**

---

## 2. Files Importing Static Data

### bookkeepingQuestions.ts (6 importers)
| File | Line | Import |
|------|------|--------|
| `src/components/ops/QuestionInput.tsx` | 3 | `type { OpsQuestion }` |
| `src/app/ops/bookkeeping/page.tsx` | 7-8 | `BOOKKEEPING_OPS_MODULE` + types |
| `src/app/ops/trading/page.tsx` | 9 | `type { OpsQuestion }` (cast workaround) |
| `src/app/api/ops/synthesis-report/route.ts` | 5 | `BOOKKEEPING_OPS_MODULE` |
| `src/app/api/ops/workstream-analysis/route.ts` | 5 | `BOOKKEEPING_OPS_MODULE` |

### tradingQuestions.ts (1 importer)
| File | Line | Import |
|------|------|--------|
| `src/app/ops/trading/page.tsx` | 7-8 | `TRADING_OPS_MODULE` + types |

### trigger-questions.ts (3 importers)
| File | Line | Import |
|------|------|--------|
| `src/components/ops/OperationsPlanner.tsx` | 4 | `TRIGGER_QUESTION_GROUPS`, `OPEN_DUMP_LABEL` |
| `src/components/mission/BrainDumpSection.tsx` | 4 | `TRIGGER_QUESTION_GROUPS`, `OPEN_DUMP_LABEL` |
| `src/app/api/mission/[id]/run-stage/route.ts` | 17 | `TRIGGER_QUESTION_GROUPS` |

### mission/prompts/* (2 importers)
| File | Line | Import |
|------|------|--------|
| `src/components/ops/OperationsPlanner.tsx` | 5-6 | `STRUCTURE_SYSTEM_PROMPT`, `buildStructurePrompt`, `BrainDumpItem` |
| `src/app/api/mission/[id]/run-stage/route.ts` | 16 | All prompt exports (structure, goal-discovery models+builders) |

---

## 3. Orphaned Mission Components (6 files)

All in `src/components/mission/`:
1. `BrainDumpSection.tsx` — trigger-question brain dump, references `/api/mission/[id]/brain-dump`
2. `CreateMissionCard.tsx` — mission title+duration, references `/api/mission/create`
3. `GoalConfirmationSection.tsx` — goal selection, references `/api/mission/[id]/confirm-goal`
4. `MissionPipeline.tsx` — vertical pipeline orchestrator, imports the other 5 components
5. `RealityConstraintsSection.tsx` — constraint form, references `/api/mission/[id]/reality-constraints`
6. `StageSection.tsx` — AI stage renderer, references `/api/mission/[id]/run-stage`, `approve`, `reject`

**No route renders any of these.** The `/mission/[id]` page that used them was deleted in commit `dbb1c9e`.

---

## 4. API Routes Referencing Legacy Mission Models

### `/api/mission/` (9 routes) — ALL reference `prisma.missions` or child models
- `mission/create/route.ts` — creates `missions`
- `mission/active/route.ts` — reads `missions` with includes
- `mission/[id]/route.ts` — reads `missions` with all includes
- `mission/[id]/brain-dump/route.ts` — writes `brain_dump_entries`
- `mission/[id]/run-stage/route.ts` — writes `mission_stages`, reads `brain_dump_entries`
- `mission/[id]/stage/[stageId]/approve/route.ts` — updates `mission_stages`
- `mission/[id]/stage/[stageId]/reject/route.ts` — updates `mission_stages`
- `mission/[id]/confirm-goal/route.ts` — updates `missions.confirmedGoal`, reads `mission_stages`
- `mission/[id]/reality-constraints/route.ts` — writes `reality_constraints`

### `/api/ops/mission/` (2 routes) — reference `prisma.missions`
- `ops/mission/route.ts` — GET/POST on `missions`
- `ops/mission/generate-roadmap/route.ts` — reads+updates `missions.roadmap`

### `/api/ops/` routes that also reference `prisma.missions` (ownership checks)
- `ops/questionnaire-answers/route.ts` — line 24, 56: `prisma.missions.findFirst` for ownership
- `ops/workstream-analysis/route.ts` — line 108: same
- `ops/synthesis-report/route.ts` — line 94: same
- `ops/compliance-tasks/route.ts` — line 51: same

**CRITICAL NOTE:** The 4 ops routes above (`questionnaire-answers`, `workstream-analysis`, `synthesis-report`, `compliance-tasks`) reference `prisma.missions` for ownership verification. However, since we are **deleting the bookkeeping and trading questionnaire pages** that call these routes, AND the routes themselves, the rename is safe. No live code path will hit these after Phase 3.

---

## 5. Components Importing from Legacy API Routes

### Components calling `/api/mission/*`
- `src/components/ops/OperationsPlanner.tsx` — 7 fetch calls (lines 63, 128, 148, 167, 182, 207, 213)
- `src/components/mission/BrainDumpSection.tsx` — 1 fetch (line 61)
- `src/components/mission/RealityConstraintsSection.tsx` — 1 fetch (line 68)
- `src/components/mission/GoalConfirmationSection.tsx` — 1 fetch (line 33)
- `src/components/mission/StageSection.tsx` — 3 fetches (lines 53, 68, 74)
- `src/components/mission/CreateMissionCard.tsx` — 1 fetch (line 24)

### Components calling `/api/ops/mission`
- `src/components/ops/DailyDashboard.tsx` — 1 fetch (line 53)
- `src/components/ops/MissionPlanning.tsx` — 3 fetches (lines 91, 101, 122)

---

## 6. travelCOA Safety Check

```
grep -rn "travelCOA" src/components/mission src/app/api/mission src/app/api/ops/mission
```

**Result: ZERO MATCHES. src/lib/travelCOA.ts is safe — no legacy mission code references it.**

---

## Decision Points for Alex

1. **Proceed with Phase 2 (schema rename)?** Row counts will confirm data volume.
2. **OperationsPlanner.tsx** — This is the /ops overview page. It's entirely mission-planner focused (brain dump, trigger questions, prompt preview, structure stage). Recommend: **delete entirely** and replace with a placeholder. The DailyDashboard (which OperationsPlanner previously wrapped) is also mission-dependent. Confirm?
3. **DailyDashboard.tsx** — Lines 53 calls `/api/ops/mission`. It has non-mission functionality (daily plan, budget, health, meals, etc.) but the mission-loading code gates all rendering. Recommend: **remove mission-loading code, keep daily dashboard as standalone if it's still needed**, or stub the entire /ops page. Confirm?
4. **QuestionInput.tsx** — Imports `OpsQuestion` type from bookkeepingQuestions.ts (being deleted). Recommend: **delete QuestionInput.tsx** since both questionnaire pages are being deleted. Confirm?
5. **4 ops API routes** (`questionnaire-answers`, `workstream-analysis`, `synthesis-report`, `compliance-tasks`) reference `prisma.missions`. Since the pages calling them are being deleted, recommend: **delete all 4 routes**. Confirm?
