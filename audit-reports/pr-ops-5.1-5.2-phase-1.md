PR-OPS-5.1+5.2 COMBINED AUDIT REPORT
=====================================

BRANCH STATUS
- current branch: claude/pr-ops-5.1-task-time-block-audit (continued; clean, in sync with origin)
- main is clean: yes (no behind-main commits; the Phase 1 commit `b33242d` only added the prior audit report)

A. `operations_calendar_blocks` MODEL
- Model name + @@map: `operations_calendar_blocks` (snake_case; @@map matches table name) — prisma/schema.prisma:2677
- Line: prisma/schema.prisma:2658
- Columns (every one, lines 2659–2671):
  * id                 String              @id @default(uuid()) @db.Uuid               — 2659
  * user_id            String                                                          — 2660
  * entity_id          String                                                          — 2661
  * daily_plan_item_id String              @db.Uuid                                    — 2662   (NOT NULL — required FK)
  * scheduled_start    DateTime            @db.Timestamptz(6)                          — 2663   (NOT NULL)
  * scheduled_end      DateTime            @db.Timestamptz(6)                          — 2664   (NOT NULL)
  * actual_start       DateTime?           @db.Timestamptz(6)                          — 2665
  * actual_end         DateTime?           @db.Timestamptz(6)                          — 2666
  * status             CalendarBlockStatus @default(scheduled)                         — 2667   (enum: scheduled, in_progress, completed, missed, cancelled — defined at prisma/schema.prisma:2529–2535)
  * notes              String?             @db.Text                                    — 2668
  * created_at         DateTime            @default(now()) @db.Timestamptz(6)          — 2669
  * updated_at         DateTime            @updatedAt @db.Timestamptz(6)               — 2670
  * created_by         String?                                                         — 2671
- Indexes:
  * @@index([user_id, scheduled_start, scheduled_end]) — 2675 (calendar-window queries)
  * @@index([daily_plan_item_id])                       — 2676
  * No @@unique constraints
- FKs and cascades:
  * daily_plan_item → operations_daily_plan_items via `daily_plan_item_id` — onDelete: **Cascade** (line 2673). FK is on the block side; deleting the parent daily_plan_item deletes all blocks underneath.
  * **No direct FK to operations_project_tasks.** Tasks are reached only transitively via daily_plan_item.task_id.
  * **No FK to operations_routines.** Routines do not flow through this table.
  * **No other table FKs.** entity_id and user_id are plain strings — no FK from this model (per the schema declaration).
- Relations: just `daily_plan_item` (line 2673). Back-reference on operations_daily_plan_items is `calendar_blocks operations_calendar_blocks[]` (line 2650).

B. `operations_daily_plan_items` MODEL
- Model name + @@map: `operations_daily_plan_items` — prisma/schema.prisma:2655
- Line: prisma/schema.prisma:2635
- Columns (every one, lines 2636–2647):
  * id                 String   @id @default(uuid()) @db.Uuid           — 2636
  * user_id            String                                           — 2637
  * entity_id          String                                           — 2638
  * plan_date          DateTime @db.Date                                — 2639   (NOT NULL)
  * task_id            String?  @db.Uuid                                — 2640   (NULLABLE — supports ad-hoc items with no task)
  * ad_hoc_title       String?  @db.VarChar(500)                        — 2641
  * ad_hoc_description String?  @db.Text                                — 2642
  * display_order      Int      @default(0)                             — 2643
  * notes              String?  @db.Text                                — 2644
  * created_at         DateTime @default(now()) @db.Timestamptz(6)      — 2645
  * updated_at         DateTime @updatedAt @db.Timestamptz(6)           — 2646
  * created_by         String?                                          — 2647
- Indexes (lines 2652–2654): (user_id, plan_date), (task_id), (entity_id). No @@unique.
- FKs and cascades:
  * task → operations_project_tasks via `task_id` — onDelete: **SetNull** (line 2649). Deleting a task does NOT delete its plan items; it just nulls their `task_id`, leaving an orphan item that the API would now treat as ad-hoc (but missing ad_hoc_title). This is a soft data-quality wrinkle, not a Phase-2 blocker.
- Back-reference: `calendar_blocks operations_calendar_blocks[]` (line 2650).
- **Linkage to calendar_blocks:** the FK lives on the BLOCK side (`calendar_blocks.daily_plan_item_id` → `daily_plan_items.id`, Cascade). A daily_plan_item has 0..N calendar_blocks; deleting the item deletes all its blocks.

C. EXISTING calendar_blocks USAGE

**API routes (Prisma client calls on `operations_calendar_blocks`):**
- src/app/api/operations/daily-plan/items/[itemId]/blocks/route.ts:105 — `POST` creates a block under a given item. Full handler (lines 36–145): derives user_id/entity_id from the parent item, parses + validates scheduled_start/end (ISO), enforces end > start, parses optional status (default `scheduled`), trims optional notes, runs `detectBlockConflicts` against existing non-cancelled/non-missed blocks and returns **409** unless `body.allow_conflicts === true`. Audits `operations_calendar_block_created`.
- src/app/api/operations/daily-plan/blocks/[blockId]/route.ts:158 — `PATCH` updates a block (mutable: scheduled_start/end, status, notes, actual_start/end). Re-checks overlap (excluding self); 409 unless `allow_conflicts`. Audits `_updated`.
- src/app/api/operations/daily-plan/blocks/[blockId]/route.ts:211 — `DELETE` removes a block. Audits `_deleted`.
- src/lib/operations/loadAuthorizedCalendarBlock.ts:4 — shared user-scoped lookup helper used by the PATCH/DELETE routes.

**Related Prisma calls on `operations_daily_plan_items`:**
- src/app/api/operations/daily-plan/items/route.ts:90 (GET list), :198 (max display_order), :205 (POST create — NO calendar_block side-effect, confirmed below)
- src/app/api/operations/daily-plan/items/[itemId]/route.ts:78,140,196 — GET/PATCH/DELETE single item
- src/lib/operations/loadAuthorizedDailyPlanItem.ts:4 — shared lookup helper

**UI components that touch blocks (3 files in workbench/operations/):**
- src/components/workbench/operations/SectionC_DailyPlan.tsx:6 — comment confirming "calendar_blocks render read-only beneath each item"
- src/components/workbench/operations/dailyplan/DailyPlanItemRow.tsx:156–164 — renders existing blocks read-only as text `{formatTime(b.scheduled_start)}–{formatTime(b.scheduled_end)} · {b.status}`. **No edit, no create UI.**
- src/components/workbench/operations/dailyplan/types.ts:5–6, 33 — `CalendarBlockSummary { scheduled_start, scheduled_end, status }` + `calendar_blocks: CalendarBlockSummary[]` on the item type.
- **Outside workbench/operations:** src/components/ops/ScheduleCard.tsx:69 has a `+ Add Block` button (a different surface — Schedule card, not the workbench Section C/D operations surface). Not the integration target for PR-Ops-5.2.

**Current behavior of TaskRow's ↗ schedule button:**
- TaskRow.tsx:202–227 `handleSchedule` makes **ONE** API call: `POST /api/operations/daily-plan/items` with body `{ plan_date, task_id }`. That creates an `operations_daily_plan_items` row only.
- **No follow-up call to the blocks endpoint.** No calendar_block is created by this path.

**Server-side side-effects in POST /api/operations/daily-plan/items:**
- src/app/api/operations/daily-plan/items/route.ts:120–215 — the handler ONLY creates the daily_plan_items row (line 205). It does NOT create a calendar_block. The block creation is a separate, explicit call to `POST /api/operations/daily-plan/items/[itemId]/blocks`.

**Bottom line for the chain:** backend is complete (create/patch/delete/list-via-item-include all shipped, conflict detection shipped, audit trail shipped). Frontend has a read-only viewer (DailyPlanItemRow) and a "create an item" trigger (TaskRow's ↗ schedule), but **no UI to create or edit a calendar_block in the workbench/operations surface**.

D. COA ACCOUNTS API + UI

**Existing COA-related API routes:**
- src/app/api/chart-of-accounts/route.ts — `GET` lists user-owned accounts (`prisma.chart_of_accounts.findMany` filtered by `userId`, `is_archived: false`, optional `entity_id` from query), ordered by `code`. Returns `{ accounts: [{ id, code, name, accountType, balanceType, settledBalance, pendingBalance, version, is_archived, entity_id, entity_type, createdAt, updatedAt }] }` (BigInt fields serialized to numbers). `POST` creates a new account.
- src/app/api/chart-of-accounts/[id]/route.ts — single-account CRUD.
- src/app/api/chart-of-accounts/balances/route.ts — balance projections per entity.
- src/app/api/transactions/assign-coa/route.ts — bulk-assigns coa_code to transactions.
- src/app/api/accounts/route.ts — Plaid accounts (different concept, not COA).
- src/app/api/account-tax-mappings/route.ts — links accounts to tax forms.

**Endpoint to use for dropdown population:** `GET /api/chart-of-accounts?entity_id=<eid>` — already user-scoped, archived-filtered, sorted by code. This is the runtime table of COA accounts (NOT `coa_template_accounts`, which is the seed pattern).

**`coa_template_accounts` schema** (prisma/schema.prisma:110–122):
- id String @id @default(uuid())
- template_id String
- code String @db.VarChar(10)           ← shorter than the runtime `chart_of_accounts.code` (VarChar(50))
- name String @db.VarChar(100)
- account_type String @db.VarChar(20)
- balance_type String @db.Char(1)
- sub_type String? @db.VarChar(50)
- tax_form_line String? @db.VarChar(50)
- @@unique([template_id, code])

**`coa_templates`** (prisma/schema.prisma:99–108): id, entity_type (VarChar 20), name (VarChar 100), version, is_active, `accounts: coa_template_accounts[]`. @@unique([entity_type, name]).

**Template-to-user assignment:** none — templates are not tied to users. They're seeded patterns. At runtime each user gets their own rows in `chart_of_accounts` (initialized via `ensureBookkeepingInitialized`, used at src/app/api/chart-of-accounts/route.ts:18). The runtime model `chart_of_accounts` (prisma/schema.prisma:147) has `userId String?` (line 149), `entity_id String` (150), `code VarChar(50)` (151), `name VarChar(255)` (152), `account_type` (153), `balance_type` (154), `sub_type`, `tax_form_line`, balance fields, `is_archived`, `entity_type`, `module`. Unique on `[userId, entity_id, code]`. Indexed on `[entity_id, account_type]` and `[userId, code]`.

**`coa_template_accounts` fields useful for dropdown rendering:** the runtime equivalents on `chart_of_accounts` are what to render — `code` + `name` (the user-facing label "1100 — Checking" style), optionally `account_type` for grouping. `is_archived` is already filtered out by the GET endpoint. **No `short_label`, `description`, `category_type`, `is_active`** fields exist; the closest to "is_active" is `is_archived` (inverted, already filtered).

**Existing COA dropdown components (potential reuse targets):**
- src/components/dashboard/ReviewQueueTab.tsx:63–82 — inline `<select>` per transaction row, value = `coa_code`, onChange POSTs to `/api/transactions/assign-coa`. Optimistic state update. Not extracted as a component.
- src/components/dashboard/SpendingTab.tsx:913–921 and :1441–1452 — inline `<select>` with options `<option value={\`\${o.code}|\${o.entity_id || ''}\`}>{o.code} - {o.name} ({ENTITY_LABELS[...]})</option>`. Not extracted.
- src/components/dashboard/BudgetingPage.tsx:191–209 — inline `<select>` with `form.coa_code` binding; options from `coaAccounts`. Not extracted.
- src/components/bookkeeping/COAManagementTable.tsx:101 — fetches `/api/chart-of-accounts?entity_id=<eid>`. Manages COA, not a dropdown.
- **No shared `<COASelect>` / `<CoaCodeDropdown>` component exists.** Every consumer rolls its own inline `<select>` populated from `/api/chart-of-accounts`. This is the codebase convention.

E. TASKROW CURRENT FIELDS

**Display order (compact header, TaskRow.tsx:260–340):**
1. index number (line 264)
2. expand chevron ▸/▾ (265)
3. task title — strike-through if completed/cancelled (267–274)
4. link_url icon (when present, lines 275–285)
5. status pill (287)
6. deadline as "due {date}" (288–290)
7. right-side action buttons: ✓ complete / ↩ uncomplete (293–319), history (320–328), ↗ schedule (322–331). schedule success toast inline (333–335).

**Expanded body** (TaskRow.tsx:431–512):
- description (when present)
- unblocks_label (when present)
- link_url full-row (when present)
- notes (collapsible)
- 3-column grid: est. minutes / est. cost (usd) / completed at (TaskRow.tsx:478–490)
- action row: edit, delete (493–510)

**Recommended placement for `coa_code` cell:**
- Compact header: too crowded already (8 elements). Don't add there.
- Expanded body: add a 4-column grid (or extend the existing 3-column at line 478 to 4-column) with `coa_code` as the new cell. Label "category". Inline-display in read mode (e.g., `{task.coa_code ? `${task.coa_code} · ${name from local lookup}` : '—'}`).
- Edit mode form: add a `<select>` between status (line 537) and the existing fields, populated from `GET /api/chart-of-accounts?entity_id=${task.entity_id}`. Operations idiom: plain inline `<select className={inputClass}>`.

**Recommended placement for `scheduled_start/end`:**
- Compact header: bad — multiple blocks per task means a single field can't summarize.
- Expanded body: a new section "scheduled blocks" listing existing blocks (mirror DailyPlanItemRow.tsx:156–164's read-only rendering) + a "+ schedule block" affordance that opens an inline expanding form (4.9.3-series convention) to POST to the existing blocks endpoint.
- Important: scheduled blocks live on `daily_plan_items`, which require the task to be on a plan first. If the task has no plan item yet, the existing ↗ schedule button creates the item; once an item exists, the new "+ schedule block" affordance attaches a block to that item. So the new UI needs to either: (a) two-step it (schedule to plan, then add block), or (b) extend the existing ↗ schedule flow to take an optional `scheduled_start/end` and do both POSTs in sequence.

**Inline-edit pattern (the operations convention):**
- The 4.9.3e EditableCell component (src/components/workbench/operations/content/EditableCell.tsx) is the precedent — click-to-edit, blur/Enter saves, Escape cancels, optimistic + rollback via parent handler. But it lives in `content/`, not `projects/`. **TaskRow currently has NO inline-cell editing** — it uses a full-form `editing` mode (line 515 onward) toggled by the `edit` button. Bringing EditableCell into projects/ is possible but a larger refactor; PR-Ops-5.1 can either reuse EditableCell (cross-folder import) or extend the existing `editing` form to include `coa_code` as a dropdown.

**Drawer/side-panel pattern available:**
- src/components/workbench/operations/projects/ProjectRow.tsx and AITaskPreview.tsx use `InspectionDrawer` from `../ai/InspectionDrawer.tsx`. **InspectionDrawer is INLINE expand/collapse**, not a side panel (confirmed in PR-Ops-4.9.3f audit). No side-panel drawer exists in projects/.
- ScriptDrawer (content/ScriptDrawer.tsx) is the only right-side slide-in drawer in workbench/operations, and it's scoped to scene.script. A "task detail drawer" doesn't exist; building one would be a new convention.

F. PATCH ALLOW-LIST

**Current PATCH allow-list** (src/app/api/operations/projects/[id]/tasks/[taskId]/route.ts:115–245):
- title (required non-empty, ≤500 chars) — 115–124
- description (nullable, trim) — 127–129
- unblocks_label (nullable, trim) — 131–133
- link_url (nullable, ≤500 chars) — 135–144
- notes (nullable, ≤1500 chars) — 146–155
- deadline (nullable ISO date → Date or null) — 156–161
- estimated_minutes (nullable non-negative number) — 163–177
- estimated_cost_usd (nullable Prisma.Decimal from string or number) — 179–188
- display_order (integer; Math.trunc) — 190–199
- status (enum value; triggers status-history transaction) — 204–229
- completed_at (nullable ISO date) — 231–235
- reason (audit-payload metadata only; not a column write) — 237–240
- **NOT in allow-list:** coa_code, actual_cost_usd, actual_minutes (the three columns added in PR-Ops-4.0 migration `20260516000000_pr_ops_4_0_daily_plan_schema`). All three are in the schema (lines 2614–2616) but invisible to PATCH.

**Validation pattern:** manual `if (body.X !== undefined)` blocks per field with explicit checks. No Zod, no shared validator. Returns `{ error: 'Validation', field, message }` with status 400 on failure. Same idiom used across scenes/takes PATCH endpoints from PR-Ops-4.9.3.

**Recommended approach for `coa_code` validation:**
- Type-check string, trim, allow null (mirror the existing `trimNullable` pattern used at lines 109–113).
- Server-side existence check (does the coa_code exist in `chart_of_accounts` for this user+entity)? Recommendation: **do the check.** Cheap query (indexed on `[userId, entity_id, code]` at prisma/schema.prisma:174), prevents drift if the dropdown gets out-of-sync, and matches the defensive-404 pattern used elsewhere. Return 400 `{ error: 'Validation', field: 'coa_code', message: 'coa_code not found in user chart of accounts' }` on miss. Lookup uses the task's existing entity_id (already loaded as `existing.entity_id`), no extra param needed.
- The column is VarChar(50); enforce that as a max-length guard in case of free-form input.

G. RECOMMENDATIONS FOR PR-OPS-5.1 (coa_code surface)

**Files to modify:**
1. `src/app/api/operations/projects/[id]/tasks/[taskId]/route.ts` — add `coa_code` to PATCH allow-list. ~15 lines. Optionally also add `actual_cost_usd` and `actual_minutes` while in the file (they share the same gap from PR-Ops-4.0 — but defer if out of scope).
2. `src/app/api/operations/projects/[id]/tasks/route.ts` — add `coa_code` to the POST create allow-list (currently missing) so newly created tasks can carry a category from the create form.
3. `src/components/workbench/operations/projects/types.ts:117–141` — add `coa_code: string | null;` to the `Task` interface; add `coa_code: string;` to the `TaskForm` interface and `''` to `DEFAULT_TASK_FORM`.
4. `src/components/workbench/operations/projects/TaskRow.tsx` — render `coa_code` in the expanded-body grid (the 3-column at line 478 becomes 4-column; or a new row below); add a `<select>` in the edit form. The expanded-body display needs the name not just the code, so the parent (likely TaskList) should fetch `/api/chart-of-accounts` once and pass a `coaAccountsById: Map<string, { code, name }>` down to TaskRow for lookup. ~50–80 lines.
5. `src/components/workbench/operations/projects/TaskList.tsx` — add the `/api/chart-of-accounts?entity_id=<eid>` fetch alongside the existing data load; pass the lookup map to each TaskRow. ~20 lines.

**New API endpoint needed:** No. `GET /api/chart-of-accounts?entity_id=<eid>` already exists and serves this purpose.

**Estimated PR scope:** 5 files, ~150 lines total. No migration. No new component (the dropdown follows the inline `<select>` convention seen 4× in dashboard/ and 10× in workbench/operations/).

**Concerns / ambiguities for Alex to resolve:**
1. **Display label format:** `code` only? `code · name`? `code — name (type)`? Existing transactions UI uses `${code} - ${name} (${entity_label})`. The operations idiom may prefer terser. Decide.
2. **Dropdown placement:** edit-form only, or also inline on the expanded body (click code to edit)? Operations convention has both — RoutineRow uses a full-form edit; ContentTable uses inline EditableCell. Both are acceptable. Edit-form-only is simpler for v1.
3. **Existence-check policy:** strict (400 on unknown code) vs. lenient (accept any string, trust the dropdown)? Strict is the truth-first choice.
4. **Out-of-scope cleanup:** `actual_cost_usd` + `actual_minutes` are also missing from PATCH. Include in PR-Ops-5.1 or defer to a separate PR? They were added in the same migration; logically they belong with coa_code, but they're tangential to the time-block + category story.

H. RECOMMENDATIONS FOR PR-OPS-5.2 (time-block on the chain)

**↗ schedule already creates calendar_block? — No.** TaskRow's `handleSchedule` (TaskRow.tsx:202–227) creates ONLY a `daily_plan_items` row. No calendar_block is created server- or client-side by that flow. PR-Ops-5.2 needs to add the second step.

**Two reasonable paths:**
- **Path 5.2-A — extend ↗ schedule:** when the user picks a date in the existing schedule menu (lines 339+), also collect a time range (start + end inputs) and chain a second fetch to `POST /api/operations/daily-plan/items/[itemId]/blocks` immediately after the daily_plan_items POST returns. One affordance, two API calls. Cleaner UX; user thinks of "scheduling" as one act.
- **Path 5.2-B — separate "+ block" affordance:** keep ↗ schedule unchanged (creates item only); add a separate "+ schedule block" button next to the read-only blocks display in TaskRow's expanded body (and/or in DailyPlanItemRow). Inline expanding form per 4.9.3 convention with `scheduled_start`, `scheduled_end`, optional notes. More clicks but clearer mental model (item → block is a real entity boundary).
- **Recommendation:** Path 5.2-B. The blocks endpoint enforces overlap detection and 409 conflict semantics (with `allow_conflicts` override) — those errors need a UI surface that can stay open and let the user retry. The schedule menu's existing one-shot UI doesn't naturally accommodate that. Path 5.2-B mirrors the inline-form convention used everywhere else in operations.

**Files to modify (Path 5.2-B):**
1. `src/components/workbench/operations/projects/TaskRow.tsx` — in the expanded body, render existing blocks (currently invisible from TaskRow — they're only visible on DailyPlanItemRow). Add "+ schedule block" affordance that opens an inline form (datetime-local inputs for start + end, optional notes). On submit, POST to `/api/operations/daily-plan/items/[itemId]/blocks`. ~80 lines + a new inline-form component (or local state).
2. **Data fetch:** TaskRow currently doesn't have the task's daily_plan_items (and thus no item_ids to attach blocks to). TaskList would need to fetch the task's plan items (or do the GET on demand when the form opens). Add either `GET /api/operations/daily-plan/items?task_id=<id>` (check if it supports this filter — Phase 1.B audited line 90, may or may not) or use a per-task lookup. **Phase 2 of PR-Ops-5.2 should re-audit the items GET filters before writing.**
3. `src/components/workbench/operations/dailyplan/DailyPlanItemRow.tsx` — extend the existing read-only blocks rendering (lines 156–164) with a "+ block" button + inline form. Mirror PR-Ops-5.2 step 1's UI.
4. `src/lib/operations/detectBlockConflicts.ts` — confirmed shipped (used by both blocks POST and PATCH). No changes needed.

**Estimated PR scope:** 3 files modified + possibly 1 new helper component for the inline block-create form, ~200 lines total. No migration. No new API endpoint. No new server validation (the blocks endpoint already handles everything).

**Concerns / ambiguities for Alex to resolve:**
1. **Path A vs Path B** above. Recommendation: Path B.
2. **Time input UX:** `<input type="datetime-local">` is the obvious choice and works without a date-picker library; matches the operations convention of plain HTML inputs. Confirm.
3. **Conflict handling:** when the blocks POST returns 409 with `conflicting_block_ids`, the UI needs to show which blocks conflict and offer an "override" toggle that sets `allow_conflicts: true` and retries. Locked decision per PR-Ops-4.9.3 style: no toast, inline error, user retries.
4. **TaskRow ↔ daily_plan_items data flow:** the task component currently knows nothing about its plan items. Either fetch on demand when the block form opens, or fold a `task.daily_plan_items` array into the tasks GET response (would need an `include` and a Task-type change). Decide.
5. **Tasks without a plan item:** if a task has zero plan items, PR-Ops-5.2 must EITHER auto-create a plan item before creating the block, OR refuse and tell the user to schedule first via the existing ↗ schedule button. The former is more user-friendly; the latter is more honest about the data model.

NO SOURCE FILES WERE MODIFIED. Only the audit report was created.
