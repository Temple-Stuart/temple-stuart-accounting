# Mission Planner Audit 3/3 — AI + Audit Infra + API Routes — 2026-04-25

## 1. Anthropic API Integration

### Call sites

11 total call sites across 10 files. All use `@anthropic-ai/sdk` import and `client.messages.create()`.

| File | Line | Model | max_tokens | temp | Persisted To | Tool Use |
|------|------|-------|-----------|------|-------------|----------|
| `src/app/api/ops/workstream-analysis/route.ts` | 125 | `claude-sonnet-4-20250514` (const MODEL, line 8) | 4096 | — | `ops_workstream_analysis.analysisOutput` via upsert | None |
| `src/app/api/ops/synthesis-report/route.ts` | 132 | `claude-sonnet-4-20250514` (const MODEL, line 8) | 8192 | — | `ops_synthesis_report.synthesisOutput` via upsert | None |
| `src/app/api/ops/brain-dump/route.ts` | 62 | `claude-sonnet-4-20250514` | 2000 | 0.4 | Not persisted — returned to client only | None |
| `src/app/api/ops/ai-plan/route.ts` | 109 (adjust) | `claude-sonnet-4-20250514` | 2000 | 0.3 | Not persisted | None |
| `src/app/api/ops/ai-plan/route.ts` | 129 (synthesize) | `claude-sonnet-4-20250514` | 2000 | 0.5 | Not persisted | None |
| `src/app/api/ops/mission/generate-roadmap/route.ts` | 140 | `claude-sonnet-4-20250514` | 4000 | 0.5 | `missions.roadmap` via update | None |
| `src/app/api/mission/[id]/run-stage/route.ts` | 152 | Dynamic (STRUCTURE_MODEL=haiku or GOAL_DISCOVERY_MODEL=sonnet) | 4096 | — | `mission_stages.rawResponse` + `parsedOutput` + `systemPrompt` + `userPrompt` + `model` | None |
| `src/app/api/ai/market-brief/route.ts` | 189 (via callWithRetry) | `claude-sonnet-4-20250514` | 2500 | 0.2 | Not persisted | None |
| `src/app/api/ai/strategy-analysis/route.ts` | 127 (via callWithRetry) | `claude-sonnet-4-20250514` | 1500 | 0.2 | Not persisted | None |
| `src/app/api/ai/convergence-synthesis/route.ts` | 346 (via callWithRetry) | `claude-sonnet-4-20250514` | 4000 | 0.2 | Not persisted | None |
| `src/lib/convergence/news-classifier.ts` | 24 | `claude-haiku-4-5-20251001` | 100 | — | Not persisted | None |

**Key finding: No Anthropic call in the entire codebase uses tool_use, web_search, or Citations API.** All calls are simple system+user prompt → text response.

**Persistence pattern:** Only 3 of 11 call sites persist AI output to the database:
- `workstream-analysis` → `ops_workstream_analysis`
- `synthesis-report` → `ops_synthesis_report`
- `run-stage` → `mission_stages` (with full observability: systemPrompt, userPrompt, model, rawResponse, parsedOutput)

The `run-stage` route is the most complete observability implementation — stores everything needed to reproduce the call.

### Prompt templates

6 files under `src/lib/mission/prompts/`:

| File | Status | Model | Exports |
|------|--------|-------|---------|
| `structure.ts` | **Implemented** | `claude-haiku-4-5-20251001` | `STRUCTURE_SYSTEM_PROMPT`, `buildStructurePrompt()`, `parseStructureResponse()` |
| `goal-discovery.ts` | **Implemented** | `claude-sonnet-4-20250514` | `GOAL_DISCOVERY_SYSTEM_PROMPT`, `buildGoalDiscoveryPrompt()`, `parseGoalDiscoveryResponse()` |
| `goal-confirmation.ts` | **Stub** (throws) | `claude-sonnet-4-20250514` | Model const only; builder/parser throw "not yet implemented" |
| `reality-audit.ts` | **Stub** (throws) | `claude-sonnet-4-20250514` | Model const only; builder/parser throw "not yet implemented" |
| `roadmap.ts` | **Stub** (throws) | `claude-sonnet-4-20250514` | Model const only; builder/parser throw "not yet implemented" |
| `types.ts` | Types only | N/A | `BrainDumpItem`, `StructureOutput`, `GoalDiscoveryOutput`, `GoalConfirmationOutput`, `RealityAuditOutput`, `RoadmapOutput` |

Additionally, `src/lib/mission/prompts/index.ts` barrel-exports all of the above plus `TRIGGER_QUESTION_GROUPS` from `../trigger-questions.ts`.

### Existing tool use / web_search / Citations API

- **Anthropic tool_use:** Not used anywhere. Zero references.
- **Anthropic web_search:** Not used anywhere. Zero references.
- **Anthropic Citations API:** Not used anywhere. Zero references.
- **xAI Grok web_search:** Used in `src/lib/grokAgent.ts` line 218 — `{ type: 'web_search' }` passed as a tool to Grok for travel destination research. This is Grok-specific, not Anthropic.

## 2. SOC 2 Immutability + Audit Infrastructure

### Trigger SQL

**Journal entries immutability** — `prisma/migrations/20260227000100_protect_journal_entries/migration.sql`:
- `prevent_journal_entry_mutation()` — BEFORE UPDATE trigger. Blocks changes to all fields EXCEPT `status` and `reversed_by_entry_id`. Raises exception on attempt. (Lines 10-31)
- `prevent_journal_entry_delete()` — BEFORE DELETE trigger. Blocks all deletes. Raises exception "use reversals." (Lines 38-44)
- Triggers: `protect_journal_entry_fields` (line 33), `no_journal_entry_deletes` (line 48)

**Ledger entries immutability** — `prisma/migrations/20250930_double_entry_foundation/migration.sql`:
- `prevent_ledger_modifications()` — BEFORE UPDATE OR DELETE trigger. Blocks ALL modifications and deletes. (Lines 44-49)
- `validate_transaction_balance()` — Validates debit_sum = credit_sum per journal entry. (Lines 54+)
- Triggers: `no_ledger_updates` (line 50), `check_transaction_balance` (line 76)

### Trigger management code

Two migration files modify triggers after initial creation:
- `prisma/migrations/20260226000100_reconcile_triggers_baseline/migration.sql` — Drops and recreates `no_ledger_updates` and `check_transaction_balance` (lines 17-18, 47-48)
- `prisma/migrations/20260226000500_fix_balance_trigger_deferred/migration.sql` — Drops `check_transaction_balance` (line 10) and presumably recreates with DEFERRED constraint

No application code (src/) enables/disables triggers at runtime. All trigger management is via migrations only.

### General audit logging

No general-purpose audit logging infrastructure exists. The word "audit" appears in:
- `src/app/api/soc2/route.ts` — SOC 2 control proof endpoint (GET). Runs 6+ database queries to verify control states (balanced entries, auth coverage, trace completeness, duplicate detection, scope coverage). Returns `ControlProof[]` with pass/fail/warn status. This is a read-only verification endpoint, not a logging system.
- `src/components/mission/MissionPipeline.tsx` line containing "auditable" in a comment
- `src/app/api/mission/[id]/run-stage/route.ts` — stores full AI observability (systemPrompt, userPrompt, model, rawResponse, parsedOutput) per stage. This is the closest thing to an audit trail.

**No append-only audit_log table exists.** No general INSERT logging on mutations. No hash-chained event log.

### Hash-chained / content-hashed infrastructure

**Hash-chained tables: NONE.** No `previousHash`, `prevHash`, or chain-linking field exists in any model.

**Content hashing exists in 3 places:**
- `ops_workstream_analysis.inputHash` (line 2080) — SHA-256 truncated to 16 chars, computed from answer values at analysis time. Used for staleness detection.
- `ops_synthesis_report.inputHash` (line 2105) — SHA-256 of workstream analysis timestamps. Used for staleness detection.
- `task_evidence_code.codeHash` (line 2215) + `commitHash` (line 2216) — SHA-256 of code content at verification time + git commit hash. Used for staleness detection when code changes.

These are point-in-time content hashes, not chained hashes. They detect staleness but don't provide tamper-evidence.

## 3. Mission-Planner-Related API Routes

### Mission pipeline routes (`/api/mission/`)

| Route | Methods | Auth | DB Models | AI |
|-------|---------|------|-----------|-----|
| `mission/create/route.ts` | POST | getMissionUser (2 checks) | missions (create) | No |
| `mission/active/route.ts` | GET | getMissionUser (2 checks) | missions (findFirst with includes: brainDumpEntries, stages, realityConstraints) | No |
| `mission/[id]/route.ts` | GET | getMissionUser (2 checks) | missions (findFirst with all includes) | No |
| `mission/[id]/brain-dump/route.ts` | POST | getMissionUser + getMissionWithOwnerCheck (2 checks) | brain_dump_entries (deleteMany + createMany in transaction) | No |
| `mission/[id]/run-stage/route.ts` | POST | getMissionUser + getMissionWithOwnerCheck (2 checks) | mission_stages (create + update), brain_dump_entries (read) | **Yes** — Anthropic via prompt templates |
| `mission/[id]/stage/[stageId]/approve/route.ts` | POST | getMissionUser + getMissionWithOwnerCheck (2 checks) | mission_stages (update status→approved) | No |
| `mission/[id]/stage/[stageId]/reject/route.ts` | POST | getMissionUser + getMissionWithOwnerCheck (2 checks) | mission_stages (update status→rejected) | No |
| `mission/[id]/confirm-goal/route.ts` | POST | getMissionUser + getMissionWithOwnerCheck (2 checks) | missions (update confirmedGoal) | No |
| `mission/[id]/reality-constraints/route.ts` | POST | getMissionUser + getMissionWithOwnerCheck (2 checks) | reality_constraints (deleteMany + createMany) | No |

### Ops routes (`/api/ops/`)

| Route | Methods | Auth | DB Models | AI |
|-------|---------|------|-----------|-----|
| `ops/mission/route.ts` | GET, POST | getVerifiedEmail (3 checks) | missions (findFirst, create, update) | No |
| `ops/mission/generate-roadmap/route.ts` | POST | getVerifiedEmail (2 checks) | missions (findFirst, update roadmap) | **Yes** — Anthropic |
| `ops/ai-plan/route.ts` | POST | getVerifiedEmail (2 checks) | None (response only) | **Yes** — Anthropic (2 modes: synthesize, adjust) |
| `ops/brain-dump/route.ts` | POST | getVerifiedEmail (2 checks) | None (response only) | **Yes** — Anthropic |
| `ops/daily-plan/route.ts` | GET, POST | getVerifiedEmail (3 checks) | daily_plans (findUnique, upsert) | No |
| `ops/questionnaire-answers/route.ts` | GET, PUT | getAuthUser (5 checks) | ops_questionnaire_answers (findMany, upsert), missions (findFirst for ownership) | No |
| `ops/workstream-analysis/route.ts` | GET, POST | getAuthUser (5 checks) | ops_workstream_analysis (upsert, findFirst), ops_questionnaire_answers (findMany) | **Yes** — Anthropic |
| `ops/synthesis-report/route.ts` | GET, POST | getAuthUser (5 checks) | ops_synthesis_report (upsert, findFirst), ops_workstream_analysis (findMany) | **Yes** — Anthropic |
| `ops/compliance-tasks/route.ts` | GET, POST, PATCH, DELETE | getAuthUser (7 checks) | compliance_tasks (findMany, upsert, create, update, delete, findFirst), ops_workstream_analysis (findFirst) | No |

### Security flags

**No unauthenticated routes calling paid APIs found.** Every route that calls Anthropic has getVerifiedEmail or getMissionUser auth at the top.

**No per-user rate limiting found on any route.** The only rate-limit reference is in `src/app/api/ai/strategy-analysis/route.ts` line 15 — retry-after handling for Anthropic's own 429 responses, not user-facing rate limiting.

**Two AI routes do NOT persist outputs:**
- `ops/brain-dump/route.ts` — AI response returned to client only, not stored
- `ops/ai-plan/route.ts` — AI response returned to client only, not stored (both synthesize and adjust modes)

## 4. Findings Summary

### EXISTS AND REUSABLE
- SOC 2 immutability trigger pattern for journal_entries and ledger_entries — proven, deployed, can be extended to new audit tables with the same BEFORE UPDATE/DELETE trigger approach
- `mission_stages` model with full AI observability (systemPrompt, userPrompt, model, rawResponse, parsedOutput, editedOutput) — this is the gold standard for AI audit trails in the codebase
- Content-hash staleness detection pattern (inputHash on workstream_analysis and synthesis_report) — works, can be extended
- `task_evidence_code` model with codeHash + commitHash + isStale — designed for code-evidence staleness but not yet wired to any detection mechanism
- Auth pattern (getVerifiedEmail → prisma.users.findFirst) is consistent across all 18 routes
- SOC 2 control proof endpoint (`/api/soc2/`) — pattern for automated compliance verification queries

### EXISTS BUT MISALIGNED
- Two parallel mission API systems with different auth helpers: `/api/mission/` uses `getMissionUser` from `src/lib/mission/auth.ts`; `/api/ops/` uses inline `getAuthUser` function. Same logic, different implementations.
- 3 prompt template stubs (goal-confirmation, reality-audit, roadmap) that throw errors — these were designed for the now-deleted mission pipeline page
- `ops/brain-dump/route.ts` and `ops/ai-plan/route.ts` don't persist AI outputs — if the target architecture requires audit trails on all AI calls, these need retrofitting
- No per-user rate limiting on any AI-calling route — any authenticated user can trigger unlimited Anthropic API calls

### DOES NOT EXIST
- Hash-chained audit log table (no `previousHash` linking, no append-only event log)
- General-purpose mutation audit logging (no INSERT/UPDATE/DELETE logging beyond the immutability triggers)
- Anthropic tool_use integration (needed for web_search, Citations API)
- Anthropic web_search integration
- Anthropic Citations API integration
- regulatory_sources table (for storing verified regulatory citations)
- Per-user API rate limiting
- AI output persistence on brain-dump and ai-plan routes
- Code-evidence staleness detection hook (model fields exist but no deploy hook or cron job wired)
- Document expiration monitoring (model field exists but no cron job)

## 5. Open Questions

- The `run-stage` route stores full AI observability (systemPrompt, userPrompt, model, rawResponse) but the `workstream-analysis` and `synthesis-report` routes only store the final output. Should all AI calls persist full observability, or is output-only sufficient for the questionnaire analysis routes?
- `ops/brain-dump/route.ts` and `ops/ai-plan/route.ts` return AI responses to the client without persisting them. If a user claims they received misleading AI output, there's no server-side record. Is this acceptable?
- No per-user rate limiting exists on any route. A single user could trigger hundreds of Anthropic API calls. Should rate limiting be added before the compliance dashboard launch?
- The two auth helper patterns (`getMissionUser` in `/api/mission/` vs inline `getAuthUser` in `/api/ops/`) do the same thing differently. Should they be consolidated?
- `task_evidence_code` has `isStale`, `staleDetectedAt`, `codeHash`, `commitHash` fields but no mechanism to detect staleness. When should this be wired — as a deploy hook, a cron job, or on-demand when viewing evidence?
- `task_evidence_documents` has `expirationDate` and `expirationAlertSent` but no cron job to check expiring documents. What's the timeline for wiring this?
- The SOC 2 trigger pattern (BEFORE UPDATE/DELETE) could be extended to create an append-only audit_log table. Should new tables use the same PostgreSQL trigger approach, or should audit logging be application-level?
