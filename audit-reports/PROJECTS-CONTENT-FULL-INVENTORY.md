# PROJECTS-CONTENT-FULL-INVENTORY — everything the real Projects tab and Content tab render, in causal order

**Date:** 2026-07-15 · **Branch:** `claude/projects-content-full-inventory` · **READ-ONLY — no code changed, no design.**
Mirror of BOOKS-FULL-INVENTORY (`a705f664`) / TAX-FULL-INVENTORY (`9acee52e`): the maps for the Projects
deck and the Content deck (Bloomberg template, same as Trade/Books/Tax). ONE audit, TWO inventories —
each tab gets its own deck.

**Shared entry** (`ModuleLauncher.tsx`): Projects flush branch `:462-481` — authed →
`<OperationsEntityProvider><SectionD_ProjectBacklog/></OperationsEntityProvider>` (`:470-475`); logged-out →
`OperationsPipelineShowroom` (`:477-478`). Content flush branch `:482-499` — authed →
`<OperationsEntityProvider><ContentPipeline/></OperationsEntityProvider>` (`:489-494`); logged-out → the SAME
`OperationsPipelineShowroom` (`:497`). Module blurbs `:97,:105`: Projects "Brain-dump a goal → a scoped
project → tasks on your calendar."; Content "Turn your day into a reel — sources → scenes → script."
`OperationsEntityProvider` self-fetches `/api/entities` on mount (`EntitySelector.tsx:57-87`) and persists
selection to `localStorage['operations-entity-id']` (`:26,:53`) — every authed mount of either tab sits
inside this fetching provider.

---

# PART A — THE REAL PROJECTS TAB

## A1. THE CAUSAL FLOW (= the slide order)

1. **The backlog** (`SectionD_ProjectBacklog.tsx`): header "Projects" (`:89`), "{n} project(s)" (`:94`),
   `show archived` (`:96-103`), `+ new project` (`:105-113`, disabled at 0 entities). Rows are collapsed
   `ProjectQueueCard`s — title, "{taskCount} task(s) · {runCount} request(s)" (`ProjectQueueCard.tsx:72-74`),
   status pill + left stripe (`:19-26`). Click → `‹ back to projects` + `ProjectRow defaultExpanded`
   (`SectionD:48-59`). Empty: "no projects for this entity yet — click "+ new project" to scope your first
   one." (`:139-141`).
2. **Create = title + goals** (`ProjectCreateForm.tsx`): title (≤500, `:132-139`), entity dropdown
   (Trading filtered out of this dropdown only, `isProjectEntity :49`), optional target date (`:161-166`),
   and the goal list via `ListManager` — verb prefix "I WANT to ", max 20 items × 500 chars
   (`ListManager.tsx:46-47`). Header badge "title + goals" (`:121`). Problem/diagnosis/design are NOT
   collected at create (the PD-Strip, header comment `:4-13`). Server: goals ≥1 required; problem/diagnosis
   optional (`projects/route.ts:236-243`); duplicate title → 409 (`:281-289`); status defaults `not_started`.
3. **The Truth Machine pipe** — the DEFAULT detail view (`ProjectRow.tsx:121` `pipelineMode = true`;
   `TruthMachineView.tsx`, header "Truth Machine — the pipeline, end to end" `:296`). Five stages
   top-to-bottom with `↓` chevrons: **1 · inputs** (goal/problem/diagnosis read-only lists, `:327-346`) →
   **2 · research** (badge `auto`; `✨ run deep research`; output textarea "research output
   (deep_research_input — review & edit)", `:351-388`) → **3 · audit** (badge `paste`; "Copy this prompt →
   run it in Claude Code (read-only) → paste the findings into the output below. (Phase 3 automates this.)"
   `:394`; textarea "audit output (claude_code_audit_input — paste; Phase 3 auto-fills here)" `:398-403`) →
   **4 · fusion → tasks** (badge `auto`; `↑ generate tasks` → cost line `${cost} · {in} in · {out} out`
   `:457-459` + the `AITaskPreview` accept gate — "Nothing is saved until you accept." `:471-473`) →
   **5 · plan** (the live `TaskList` slot, `:480-482`). Every prompt renders via `PromptBox` — template
   text black, YOUR inputs in red `#D62828`, segments server-declared and verified to rebuild the exact
   fired string (`:5-11,:183-246`); `copy` / `show system`.
4. **`⚡ run pipe (auto)`** (`:302-313`) → `POST /run-pipe` → 202 → the Inngest job (§A2). Banner: "Running
   research → fusion automatically. New tasks will appear below as pending review — accept or reject each
   when they land. Refresh to check progress." (`:319-323`).
5. **Tasks land `pending_review`** → the accept/reject checkpoint (§A3) → accepted tasks are live `open`
   tasks → **`↗ schedule`** puts a task on the daily plan (`TaskRow.tsx:207-232` →
   `POST /api/operations/daily-plan/items {plan_date, task_id}`; success "scheduled for {date}") — the
   task→calendar seam the blurb advertises.
6. **`↻ evolve — new goals, loop again`** (`TruthMachineView.tsx:499-543`): edit goals → PATCH → re-fire
   the pipe. Every AI generation lands a version in the **evolution timeline** (`EvolutionTimelineView`) —
   "{model} · ${cost} · {in} in · {out} out" per version (`EvolutionTimeline.tsx:146`).
7. **Dependencies** (`DependencyList/View`): edges `blocks | informs | derived_from` (`types.ts:234`),
   cross-project jump + flash (`ProjectRow.tsx:133-147`), DFS cycle detection server-side.

Project statuses: `not_started | in_progress | blocked | completed | cancelled | archived`
(`types.ts:13-19`). Archive cascades: active tasks → `archived` + status-history rows; future non-done
daily-plan items deleted (`projects/[id]/route.ts:236-280`).

## A2. THE TRUTH MACHINE PIPE — user-visible vs backend-only (verified first-hand)

The auto pipe (`inngest/functions/operations-pipe-run.ts`, durable steps):
`load-context` (`:80-101`) → **research** (PAID, `chargeBudget` → `generateDeepResearch` → writes
`deep_research_input`, `:104-121`) → **fire-audit** (PAID Routine, MANDATORY — `fireAuditRoutine` persists
`audit_correlation_id`; ANY failure incl. the Routine cap → `NonRetriableError`, terminal, `:129-141`) →
**`waitForEvent('await-audit')`** on `operations/audit.ingested`, `match: 'data.projectId'`, **timeout 30m**
— suspension bills no compute; timeout → "audit did not complete within timeout — pipe failed (audit
mandatory)" (`:149-158`) → **fusion** (PAID, re-reads the fresh research + the now-populated audit,
`generateProjectTasks`; `TaskSynthesisError` → terminal, `:161-194`) → **land-pending**: every task inserted
`status: 'pending_review'` — "the auto-fire checkpoint — NOT 'open'" (`:219`) — with `source_ai_usage_id`
(`:216`) and one hash-chained audit row per task (`auto_fire: true`, `:226-246`).

The token-guarded callback (`projects/[id]/audit-ingest/route.ts`): **bearer `AUDIT_INGEST_SECRET`
validated FIRST** before any DB work (`:40-48`); body `project_id` must equal the route id (`:60-63`);
**stored-match** — the posted correlationId must equal the persisted `audit_correlation_id`, else 403
(`:80-85`); findings written to `claude_code_audit_input` (stored, never executed — untrusted text); then
`inngest.send('operations/audit.ingested')` resumes the wait (`:108-111`). Middleware exempts
`/audit-ingest` from cookie auth (`middleware.ts:107-109`).

| Pipe stage | USER SEES | BACKEND-ONLY |
|---|---|---|
| queue | `⚡ run pipe (auto)` → `pipe running…` + the banner | the 202 + Inngest event |
| research | stage-2 textarea fills after refresh | `chargeBudget`, usage row |
| fire-audit | **nothing** | correlationId persist, Routine fire, `requireRoutineBudget` |
| await-audit | **nothing** (see the 5-min/30-min mismatch below) | the 30m suspension |
| audit-ingest | stage-3 textarea has findings after refresh | token gate, stored-match, resume event |
| fusion | — | `chargeBudget`, usage row |
| land-pending | **`pending review` purple pills sorted FIRST** (`projects/[id]/tasks/route.ts:27`), `✓ accept` / `✕ reject` (`TaskRowView.tsx:185-206`) | per-task audit rows |

**Honesty finding (deck-relevant):** the client polls tasks every 5s but gives up at **5 minutes** with
"no tasks landed — check and retry" (`ProjectRow.tsx:174,:204`), while the job legitimately waits up to
**30 minutes** for the audit (`operations-pipe-run.ts:154`) — a healthy audit-length run "fails" in the UI
and its tasks appear only on a later refresh. The banner also says "research → fusion automatically"
(`TruthMachineView.tsx:321`), omitting the mandatory audit + wait stages. A deck describing the pipe must
describe the REAL five stages (the deck may not inherit the banner's under-description).

## A3. TASK MANAGEMENT — the pending_review checkpoint

- `TaskStatus` = `open | in_progress | blocked | completed | cancelled | archived | pending_review`
  (`types.ts:118-125`); labels: `open`→"new", `in_progress`→"in process", `completed`→"done",
  `pending_review`→"pending review" (`:201-210`).
- `✓ accept` (title "Accept this auto-generated task (becomes a live open task)") → PATCH `status:'open'`;
  `✕ reject` → confirm → PATCH `status:'cancelled'` (history preserved) (`TaskRowView.tsx:185-206`,
  `TaskRow.tsx:315-349`).
- **Accept fires execution**: the PATCH route detects `pending_review → open` and calls
  `fireExecutionRoutine` (build + PR) — `exec_status:'building'` + `exec_correlation_id`; failure → 502
  "could not start execution — {message}" (`projects/[id]/tasks/[taskId]/route.ts:403-427`). UI shows the
  ephemeral green "building… PR incoming" (`TaskRow.tsx:341`).
- Task rows: complete/uncomplete/history/schedule/delete/archive (`TaskRow.tsx:135-310`); create form
  "what is the atomic unit of work?" + unblocks/deadline/estimates/COA category
  (`TaskListView.tsx:101-205`).

## A4. ANTHROPIC-BACKED ACTIONS + DAILY CAPS (all verified)

Model: `MODEL_SONNET_4 = 'claude-sonnet-4-6'` (`lib/ai/client.ts:33`); $3/M in, $15/M out (`:44,:48`).
Every paid call goes through `recordUsage` (immutable `operations_ai_usage` + audit row); the
`InspectionDrawer` shows the full receipts — "🔍 inspect this inference": model/temp/maxTokens, both
prompts, raw response, tokens, cost, usage-row id (`ai/InspectionDrawer.tsx:44-52,:84-87`).

| Action | Route | Engine | Cap |
|---|---|---|---|
| `✨ run deep research` | `POST …/research` | Sonnet + web_search (max 8), 4000 tok, temp 0.4 (`generateDeepResearch.ts:161-177`) | pipe cap |
| `↑ generate tasks` (fusion) | `POST …/generate-tasks` | Sonnet + web_search + forced `return_project_tasks` tool, 16000 tok (`generateProjectTasks.ts:230-261`) | pipe cap |
| `↑ generate plan` (design; standard-view EDIT only) | `POST …/generate-design` | requires goal+problem+diagnosis else 400 (`generate-design/route.ts:64-75`) | pipe cap |
| `⚡ run pipe (auto)` | `POST …/run-pipe` → Inngest | research + fusion inside the job (2 increments) | pipe cap |
| pipe fire-audit | Claude Code Routine (`fireAuditRoutine.ts:60,:93-102`) | — | routine cap |
| accept → build/PR | `fireExecutionRoutine` | — | exec cap |

**Caps:** pipe `DEFAULT_PIPE_DAILY_CAP = 20`/user/day, env `AI_PIPE_DAILY_CAP`, warn at 80%, over-cap
429 "AI pipe daily limit reached — {n}/{cap} calls used today" (`pipeBudget.ts:15-16,:24,:37`); Routine
`DEFAULT_ROUTINE_DAILY_CAP = 10` (`routineFireBudget.ts:18`); exec `DEFAULT_EXEC_DAILY_CAP = 5`
(`execFireBudget.ts:16`). Inngest over-cap = `NonRetriableError` (no retry re-increment,
`operations-pipe-run.ts:53-62`). The truth-machine `GET /prompts` preview fires NO Anthropic call (pure
builders).

## A5. PHASE 2 — Projects mountability (three-tier)

| Piece | Verdict | Basis |
|---|---|---|
| `SectionD_ProjectBacklog` | STATIC MIRROR | fetches projects on mount (`:56,:71-74`) + entity context |
| `OperationsEntityProvider` | STATIC MIRROR | fetches `/api/entities` on mount (`EntitySelector.tsx:61`) |
| `ProjectRow` (container) | STATIC MIRROR | fetches `/prompts` on mount in pipe mode (`:155-161`), 5s pipe poll (`:169-211`), all mutations |
| `TaskList` / `EvolutionTimeline` / `DependencyList` (containers) | STATIC MIRROR | mount fetches (`TaskList.tsx:73-127`; `EvolutionTimeline.tsx:31-53`; `DependencyList.tsx:50-131`) |
| `ProjectRowView` | **DIRECT REUSE / EXAMPLE-FED** | pure props, "no fetch, no /api/* call" (`:59-134`, header) |
| `TruthMachineView` | **EXAMPLE-FED** | pure props — "owns NO data/fetch — every action is a container callback" (`:45-95`); ALL paid triggers are routable props |
| `TaskListView` / `TaskRowView` | **EXAMPLE-FED** | pure props (`TaskListView.tsx:22-45`; `TaskRowView.tsx:50-99`) — incl. the pending_review ✓/✕ rendering |
| `EvolutionTimelineView` / `DependencyListView` / `ProjectQueueCard` / `InspectionDrawer` / `ListManager` | **EXAMPLE-FED** | pure props (cites in agent inventory §6) |
| `AITaskPreview` | EXAMPLE-FED **with action-fetch caveat** | pure render, but "accept all" self-POSTs `/tasks/bulk-create` (`:124-137`) — strip or mirror the action |
| `ProjectCreateForm` | EXAMPLE-FED **with action-fetch caveat** | pure inputs, but self-POSTs create (`:92`) |

**Anthropic-cost mandate:** every Projects AI trigger is a routable callback prop on a pure view
(`onGenerateDesign` / `onGenerateTasks` / `onRunResearch` / run-pipe via `TruthMachineView` callbacks) —
lockable to signup exactly as the existing showroom proves (`ProjectsPipelineShowroom.tsx:283-289`). No
paid call is reachable from a locked mount. ✓

## A6. Projects — advertised-but-not-live / dead surfaces (BANNED from deck copy)

1. **The PR is invisible**: `exec-ingest` writes `pr_url` + `exec_status` onto the task
   (`exec-ingest/route.ts:86-89`) but NO component renders them (grep: zero) — only the ephemeral
   "building… PR incoming". A deck may say a build fires; it may NOT show/claim an in-tab PR link.
2. **Manual audit auto-fill promise**: stage 3's "Phase 3 auto-fills here" (`TruthMachineView.tsx:398,:403`)
   — auto-fill happens only inside the run-pipe job; the open textarea never live-updates and the manual
   view has no fire-audit button.
3. **The run-pipe banner under-describes the pipe** + the 5-min poll vs 30-min wait mismatch (§A2) — the
   deck must present the real five-stage pipe, not the banner's two-stage version.
4. Dead code paths: `AITaskPreview.onAcceptStateless` (`:54-58`, stripped create-preview flow),
   `readViewAiActions` slot (showroom-only), `operations/exec.ingested` event (no consumer — "future
   EXEC-3"), `superseded` status (DB-only, no UI writes it).
5. `↑ generate plan` (design) is reachable ONLY via standard view → edit (`ProjectRowView.tsx:533`) — not
   part of the default pipe; don't headline it.

---

# PART B — THE REAL CONTENT TAB

## B1. THE CAUSAL FLOW (= the slide order)

`ContentPipeline.tsx` (header comment `:1-22`) — one flat page: subtitle **"inputs → script map →
answer + record → script"** (`:281-284`), live badges "{n} scenes" / "{n} answered" (`:287,:290`), a
new-day entity select ("Which entity a newly-created day is filed under (the day reads cross-entity)",
`:292-306`).

1. **· DAY (time blocks)** — `DayCalendar` (`:318`) → `useDayFeed(date)` merges cross-entity scenes +
   committed task blocks + travel into ONE clock-ordered timeline (`useDayFeed.ts:191-236,:383-396`;
   DAY_START 04:00 wrap). `DayCalendarView`: filter chips (scenes/travel/tasks), gap dividers "{n}m open",
   overlap rings "⚠ overlaps another block on this day", `unscheduled` lane, teal/indigo/cyan fills, day
   nav `‹ / today / ›`. Empty "No time blocks for {date}."
2. **1 · INPUTS** — "pick routines to scenify · add tasks to the day" (`:323-325`). Project tasks from
   `GET /api/operations/tasks/unscheduled` (`:132`): `+ add to day` → POST daily-plan item (`:203-238`);
   `✓ on day` → remove (guard: "This task has committed time on the day — uncommit it in the day section
   below before removing." `:249`). Routines from `GET /api/operations/routines` (`:131`), click-to-select
   with order badges. Empty: "No routines — create one on the Routines tab." (`:411`).
3. **2 · AI SCRIPT MAP** — `ScenifyDraft` renders only when ≥1 routine selected (`:454-456`): the whole
   day in clock order — editable scene rows (Camera/Angle/Shot/B-Roll/Narrative/Question) interleaved with
   read-only amber `TaskBand`s. `cameras available` free text (default `iPhone`). **`✨ AI suggest`**
   (`:546-553`) fires one PAID `POST /api/operations/content/enrich-routine` per selected routine
   (`:247-252`). Question badges: `from library` (purple) vs `proposed new` (amber) (`:479-488`).
   **`save scenes`** upserts `/content/scene-rows` keyed `routine_step_id` — "saved scenes appear in the
   confirmed grid below · task rows are read-only" (`:610`).
4. **3 · ANSWER + RECORD** — `DailyLog`: "ANSWER — the day, top to bottom — mindset + execution",
   "{answered} of {n} answered"; per-scene inline answer textarea ("answer the question in your own
   words…") → `Save answer` POSTs `/grid/cell` (`:102-131`); `Start {date} log` creates the day piece
   (`:77-100`). Below it `PieceGrid`: "DAY-TO-DAY RECORD — scenes × days — the evolution record" — rows =
   scenes, columns = day-pieces, cells = takes; click-to-edit ("esc cancels · blur saves"), `+ answer`,
   `+ day`, "🔗 linked" pieces (read-only).
5. **4 · SCRIPT** — `ScriptGenerator(View)`: "the day's answers + task record → reel voiceover"; word/
   read-time meter (150 wpm); the always-visible **DAY-AUDIT prompt** + `copy prompt` (a read-only Claude
   Code git-log audit prompt whose output is pasted back as execution notes); **`✨ generate script` /
   `↻ regenerate`** → PAID `POST /content/generate-script {piece_id}` — disabled reasons: "Start the day's
   log first (section 3 · Answer)." / "Answer the day's scenes first — the script is built only from what
   you logged."; notice "Generated from {n} answers + {n} task blocks. Edit, then save."; `save to the day`
   PATCHes the piece — caption "edits are yours — saving overwrites the day's script (every run is
   logged)".

Cross-refresh: `CONTENT_SCENES_CHANGED_EVENT` / `CONTENT_DAY_PLAN_CHANGED_EVENT` window events keep all
sections in sync (`ScenifyModal.tsx:26,:29`; listeners in ContentPipeline/PieceGrid/ScenifyDraft/
ScriptGenerator/useDayFeed).

## B2. CONTENT STATES — no draft→published enum

Content has NO publish workflow; it is a **data-completeness progression**: routine steps → scene-rows
(state = fields filled + question badge `from library`/`proposed new`) → day piece exists ("Start {date}
log" / "+ day") → cell answered (`script` non-empty flips the ✓ badge) → `piece.script` saved
(last-write-wins). The status enums on screen belong to the task/calendar side: input pills
`open/in_progress/blocked` (`ContentPipeline.tsx:54-58`) and the `TaskBand` lifecycle PLANNED → COMMITTED
(`commit time` / `edit time` / `uncommit` / `remove from day` / `✓ mark done`) → DONE (`TaskBand.tsx:1-18`).
No scheduling/publishing of content exists — a deck may not imply posting/scheduling to any platform.

## B3. ANTHROPIC-BACKED ACTIONS — tier-gated, **NO daily cap** (verified first-hand)

Exactly two paid actions: **`✨ AI suggest`** (`enrich-routine` → `enrichRoutineScenes`,
`claude-sonnet-4-6`, 4000 tok/0.4, forced `return_scene_enrichment` tool; "NEVER invent, merge, split,
rename, or reorder steps") and **`✨ generate script`** (`generate-script` → `generateReelScript`,
`claude-sonnet-4-6`, 1500 tok/0.85; the locked "ALEX'S RAW VOICE" 5th-grade reel contract with
anti-confabulation rules). Both truth-first no-save (human gate) with fail-loud 400s: "This routine has no
active steps to enrich…" / "This day has no answers yet. Answer the scenes for this day … before
generating the script…".

Gating: `getVerifiedEmail → users → requireTier(user.tier, 'ai', user.id)`
(`enrich-routine/route.ts:42-43`, `generate-script/route.ts:53-54`). **Only `pro_plus` has `ai: true`**
(`tiers.ts:57-65`) + the `ADMIN_USER_ID` bypass (`:24,:75`) — and "All paid tiers are currently gated as
'Coming Soon' for public users. Only the admin user has full access." (`tiers.ts:19-20`). Non-admin →
403 "This feature requires a plan with ai access." (`auth-helpers.ts:44-47`), surfaced in the red banners.

**Unlike the Projects pipe, NEITHER content AI route has a daily budget counter** — no
`requirePipeBudget`/quota import (grep: zero). Cost tracking exists (`recordUsage`) but is accounting,
not a cap. → A Content deck may NOT claim "budget-capped AI"; that claim is true only for the Projects
pipe (20/day), Routine fires (10/day), and exec fires (5/day). It also may not imply public users can
fire the ✨ buttons today (tier-gated "Coming Soon"; admin-only in practice).

## B4. PHASE 2 — Content mountability (three-tier)

| Piece | Verdict | Basis |
|---|---|---|
| `ContentPipeline` | STATIC MIRROR | mount fetches routines/unscheduled-tasks/grid/daily-plan (`:88-133`) + entity context |
| `useDayFeed` / `DayCalendar` / `DailyLog` / `PieceGrid` / `ScriptGenerator` | STATIC MIRROR | mount fetches (`useDayFeed.ts:191-236`; `PieceGrid.tsx:109`; `ScriptGenerator.tsx:58-73`) |
| `ScenifyDraft` | STATIC MIRROR | mount fetches per routine (`:163,:196-199`) AND fires the PAID enrich via an INTERNAL handler (`:236-293`) — not a routable prop → never mountable logged-out |
| `TaskBand` / `TaskTimeCommit` | mirror for any interaction | no mount fetch, but every button hits live daily-plan routes |
| `DayCalendarView` | **DIRECT REUSE** | pure props (`:128-137`; "owns NO data … no fetch") — already proven in the showroom |
| `ScriptGeneratorView` | **DIRECT REUSE** | pure props incl. `onGenerate` (`:27-53`; "NEVER names the paid generate route") — the paid trigger is a lockable prop ✓ |
| `ContentTable` / `SceneHeaderRow` / `TakeRow` / `EditableCell` / `ScriptDrawer` / `AvailableRoutinesList` / `ContentTableSkeleton` | EXAMPLE-FED (pure props) | but ALL belong to the RETIRED SectionG surface — reusing them would demo dead UI |
| `content/showroom/demoData.ts` | the existing type-checked static feed | `_check` proofs `:219-223` |

**Anthropic-cost mandate:** `ScriptGeneratorView.onGenerate` is a props seam (locked in the showroom
today, `OperationsPipelineShowroom.tsx:94-95`) ✓. `ScenifyDraft`'s enrich is an internal handler → RULED
OUT of any live mount; scenify must be mirrored. ✓

## B5. Content — advertised-but-not-live / dead surfaces (BANNED from deck copy)

1. **REDDIT NARRATIVE WRITER — NOT BUILT.** Full-repo grep: the only "Reddit" in the codebase is a Grok
   sentiment-source description in Trade's `ConvergenceIntelligence.tsx:3848`. No module, no route, no
   schema, no stub. **BANNED from all deck copy.** (Independently verified twice.)
2. **`QuestionLibrary` is unmounted** — fully built manager (`QuestionLibrary.tsx`, `/content/questions`)
   with ZERO importers. The enrich AI reads the library server-side (`enrich-routine/route.ts:81-84`) and
   ScenifyDraft's notice even says "your question library is empty, so questions are newly proposed. Add
   the keepers to your library." — but there is NO mounted UI to add them. Don't advertise a library
   manager.
3. **The whole `SectionG_Content` family is RETIRED** (OPS-CE-7, `app/operations/content/page.tsx:11-16`):
   `SectionG_Content`, `ContentTable(-Skeleton)`, `SceneHeaderRow`, `TakeRow`, `EditableCell`,
   `AvailableRoutinesList`, `ScriptDrawer` — kept only for the logged-out home `ContentPreview`.
4. **`ScenifyModal` / `ScenifyButton` / `TakeifyButton`** live on the ROUTINES tab, not Content (the
   Content tab uses `ScenifyDraft`); `TakeifyButton` writes the LEGACY scenes-as-takes table.
5. Deferred-by-comment: gear/camera library ("no persistence yet"), "shotify a task", piece
   project/version linking UI ("no linking UI here — that is a later PR", `PieceGrid.tsx:8-9`).
6. The two ✨ AI buttons are functionally dead for every non-admin user (§B3) — a deck must present them
   as the product's mechanics, not as something a free signup can fire today.

---

# THE SHOWROOM DRIFT CHECK (the Trade lesson)

The existing logged-out surface for BOTH tabs is `OperationsPipelineShowroom` (105 lines): PANEL 1 =
`ProjectsPipelineShowroom` (real `ProjectRowView` force-expanded on the seed, with real `TaskListView`/
`TaskRowView`/`EvolutionTimelineView`/`DependencyListView` slots), PANEL 2 = `DayCalendarView` on
`demoDay`, PANEL 3 = `ScriptGeneratorView` on `demoScript` — one inert `lock` handler for every action
including both PAID triggers, wrapped in `guardShowroomRender` (Layer-2 runtime fetch-guard).

**Structural drift: impossible by construction.** Both seeds carry compile-time `_check` type-conformance
proofs against the live view prop contracts (`projects/showroom/demoData.ts:364-390`;
`content/showroom/demoData.ts:215-223`) — main compiles, so the seeds still match today's views exactly.
The seed's evolution model string `claude-sonnet-4-6` equals the live `MODEL_SONNET_4` (`client.ts:33`) ✓.

**Content drift: REAL — the showroom predates the Truth Machine and the ContentPipeline.** What the
showroom does NOT show of today's product:

| # | Drift | Cites |
|---|---|---|
| 1 | The real default detail view is now **TruthMachineView** (`ProjectRow.tsx:121`); the showroom renders only the standard `ProjectRowView`. The five-stage pipe, the red-input PromptBox, the `⚡ run pipe (auto)` button — all absent. | `ProjectsPipelineShowroom.tsx:236-294` |
| 2 | **No `pending_review` anywhere in the seed** — demoTasks are `completed/in_progress/open` (`demoData.ts:170-283`); the crown-jewel checkpoint (purple pill, `✓ accept`/`✕ reject`) is never demoed. | `TaskRowView.tsx:185-206` |
| 3 | The seed's truth-machine inputs are `null` (`deep_research_input`/`claude_code_audit_input`, `demoData.ts:80-81`) — research/audit stages render empty in the showroom. | |
| 4 | The showroom's AI-loop card shows `↑ generate plan` + `↑ generate tasks` (`:199-221`) — but in the REAL tab generate-plan lives only behind standard-view→edit, and the headline action is `⚡ run pipe (auto)`. The showroom's loop is yesterday's loop. | `ProjectRowView.tsx:533`; `TruthMachineView.tsx:302-313` |
| 5 | Content: the showroom shows Day + Script only — **2 of the live pipeline's 4 sections**. INPUTS (routine picker + add-to-day), the Scenify script map (`✨ AI suggest`, question badges), DailyLog answers, and the PieceGrid scenes×days record are all absent. The mount comment's "already renders the content Day + Script demo panels" (`ModuleLauncher.tsx:61-63`) is accurate but partial. | `ContentPipeline.tsx:277-483` |
| 6 | No evolution loop / `↻ evolve`, no dependencies jump-flash, no schedule-to-day demo in the showroom's task rows (all callbacks locked, fine — but the NEW mechanics aren't present to lock). | |

**Verdict:** the showroom is safe (fetch-free, cost-free, honestly labeled "Nothing here gets saved") and
structurally current, but it demonstrates the pre-Truth-Machine, pre-ContentPipeline product. Decks built
from it alone would repeat the Trade drift lesson. The decks must be grounded in THIS inventory's causal
flows; the showroom's seed + pure views remain excellent raw material (and the two content Views are
DIRECT REUSE seams already proven in production).

# DISCLAIMERS / COVERAGE DECLARATIONS THE REAL TABS CARRY (decks inherit these)

- "Nothing is saved until you accept." (fusion preview, `TruthMachineView.tsx:471-473`) — the human gate.
- The PromptBox contract: "prompt — your inputs in red" — segments verified to rebuild the exact fired
  string (`TruthMachineView.tsx:5-11`).
- The inspection receipts: "🔍 inspect this inference" — model, prompts, tokens, cost, usage-row id.
- Cap messages verbatim: "AI pipe daily limit reached — {n}/{cap} calls used today" / "Routine daily
  limit reached…" / "Execution daily limit reached…" (Projects only).
- Content: "edits are yours — saving overwrites the day's script (every run is logged)"; the fail-loud
  empties ("This day has no answers yet…", "No scenes yet — Scenify a routine first…"); the tier message
  "This feature requires a plan with ai access."
- Showroom: "This is the real app, not a screenshot… Nothing here gets saved." (`narrativeCopy.ts:44-51`).
