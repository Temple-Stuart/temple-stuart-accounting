PR-OPS-5.8 PHASE 1 AUDIT REPORT
================================

BRANCH STATUS
- main top 3: `b37e744` (merge #551 PR-Ops-5.7 sign fix) → `d4cdd97` (merge #550 5.7 audit) → `b3242fa` (5.7 commit). PR-Ops-5.7 confirmed on main.
- current branch: `claude/pr-ops-5.8-editable-routines-audit`

A. ROUTINE ROW CURRENT RENDER

- **File:** `src/components/workbench/operations/dailyplan/DailyPlanRoutineRow.tsx` (134 lines)
- **Header comment is explicit (`:1-8`):** *"Purely presentational: routines are not deletable or editable from this view, and the mark-as-done affordance is deferred to PR-Ops-4.8.1 — so this component takes no callbacks."* — i.e., the read-only nature is documented intent, not an oversight.
- **Props (`:43-46`):** `{ entry: TodayRoutineEntry }` — **no `onUpdate` / `onDelete` callbacks at all.**
- **Fields shown (`:53-132`):**
  - `[routine]` tag + bold name + status pill (`:57-61`)
  - "expected: HH:MM" + "window: HH:MM–HH:MM" (or "from"/"until") + 🔥 streak counter (`:63-83`)
  - Collapsible steps drawer when `routine.steps.length > 0` (`:84-96, 99-122`)
  - Optional description below (`:124-128`)
- **Action buttons present: NONE.** No `<button onClick=...>` for edit / delete / deactivate / mark-done. The only `<button>` is the steps-drawer toggle.
- **How routines reach the row:**
  - `SectionC_DailyPlan.tsx:86-99` `fetchRoutines()` calls `GET /api/operations/routines/today` → sets `routines: TodayRoutineEntry[]` state (`:55`).
  - `SectionC_DailyPlan.tsx:322-323` renders: `routines.map((entry) => (<DailyPlanRoutineRow key={entry.routine.id} entry={entry} />))` — no callback props passed (because the component doesn't accept any).

B. TASK ROW EDIT/DELETE PATTERN (the convention to mirror)

- **File:** `src/components/workbench/operations/dailyplan/DailyPlanItemRow.tsx`
- **Props (`:22-26`):** `{ item: DailyPlanItem; onUpdate: () => void; onDelete: () => void }` — callback-based.
- **Edit mechanism:** `enterEdit()` sets `editing=true`, swapping the row's body to a full inline form (notes + display_order; ad_hoc_title/description for ad-hoc items). `handleSave()` PATCHes `/api/operations/daily-plan/items/${item.id}`, then `onUpdate()` fires the parent refetch on success.
- **Delete mechanism:** `handleDelete()` calls `window.confirm('Delete this item from the daily plan?')`, then DELETE `/api/operations/daily-plan/items/${item.id}`, then `onDelete()` on success.
- **Refetch wire (`SectionC_DailyPlan.tsx:344-349`):**
  ```tsx
  <DailyPlanItemRow
    key={item.id}
    item={item}
    onUpdate={fetchItems}
    onDelete={fetchItems}
  />
  ```
  Both callbacks point at the same `fetchItems` — refetches the items list after either mutation. **DailyPlanRoutineRow has zero callback props today — the same wire shape can extend cleanly to it.**

C. ROUTINE CRUD API (already fully shipped — pure UI-surfacing PR ahead)

- **PATCH `/api/operations/routines/[id]`** (`route.ts:105-327`):
  - Allowed fields (per the `if (body.X !== undefined)` blocks):
    - `name` (`:124-145`, required non-empty ≤200 chars, pre-emptive uniqueness check)
    - `description` (`:147-151`, nullable trim)
    - `ideal_time_label` (`:153-157`, nullable trim)
    - `fail_threshold_minutes` (`:159-167`, non-negative int)
    - `timezone` (`:169-178`, required non-empty)
    - Cadence fields (`cadence_mode, weekly_byday, monthly_day_of_month, monthly_nth, monthly_weekday, custom_rrule, byhour, byminute`) (`:181-206`) — server recompiles via `compileFormToRRule` and writes `schedule_rrule`
    - `is_active` (`:208-215`) — audit-discriminates: deactivate is its own action_type, reactivate is `_updated` with metadata
    - Plus `start_date / end_date / start_time / end_time` (visible elsewhere in the file from prior audits)
  - Audit trail: discriminates `_deactivated` vs `_updated` vs `_reactivated` per the patch contents.
- **DELETE `/api/operations/routines/[id]`** (`route.ts:329-373`):
  - **HARD delete** via `prisma.operations_routines.delete({ where: { id } })` (`:345`).
  - **Cascade:** `operations_routine_completions` cascade-deleted via FK (audit metadata at `:367` says so explicitly). From prior audits: `operations_routine_steps.routine_id` also has `onDelete: Cascade`.
  - Audit trail: `operations_routine_deleted` with full `payload.before`.
- **Auth on both:** `getVerifiedEmail` → user lookup → `loadAuthorizedRoutine(id, user.id)` (defensive 404 on cross-user). Same idiom as everywhere else in the routines surface.

D. EDITABILITY OPTIONS — `/operations/routines` ALREADY HAS THE FULL EDITOR

- **`/operations/routines/page.tsx:11`** mounts `<SectionE_Routines />` → `RoutineList` → per-routine `<RoutineRow>` rows.
- **`RoutineRow.tsx`** (the routines-page row, distinct from DailyPlanRoutineRow) has **complete edit/deactivate/delete** today:
  - `:77` `[editing, setEditing] = useState(false)` — local edit toggle
  - `:84-92` `enterEdit / cancelEdit` — open/close inline edit form
  - `:96-122` `handleSave()` — PATCHes routine with the full form (name, description, cadence via `RRULEBuilder`, time window, etc.)
  - `:125-145` `handleToggleActive()` — patches `is_active` (deactivate/reactivate button)
  - `:148-165` `handleDelete()` — `window.confirm("Delete routine "X"? All completion history will also be deleted.")` + DELETE + `onDelete()` refetch
  - `:280-296` action buttons in the expanded body: **edit · deactivate (or reactivate) · delete**
  - `:348` uses `RRULEBuilder` for cadence editing — the structured cadence form, ~200 lines.
- **The full editor (including the heavy `RRULEBuilder`) already exists at `/operations/routines`.** No reason to duplicate it inside DailyPlanRoutineRow.

**Option tradeoffs:**

- **A — lightweight actions only (deactivate + delete on Daily Plan; edit lives on /operations/routines)**: matches Daily Plan's "quick-action surface" identity. Minimum new code. User who wants to fully reshape the cadence navigates to the dedicated routines page.
- **B — full inline editor (duplicate RoutineRow's edit form in DailyPlanRoutineRow)**: heavy. Duplicates the `RRULEBuilder` + form-state + all the patch handling already proven on the routines page. Two source-of-truth surfaces for routine editing.
- **C — edit button that navigates to /operations/routines**: link-out. Zero duplication. The Hub event card from PR-Ops-5.5 already established this idiom ("info card links to dedicated surfaces for heavy editing"). Same shape applies here.

E. RECOMMENDATION

- **Recommended: hybrid A + C (lightweight actions in-place + edit link-out).**
  - **`Deactivate`** button on the Daily Plan routine row — one-click PATCH `is_active: false`. The most common "I'm done with this routine for today/permanently" gesture; valuable to keep in-place.
  - **`Delete`** button — `window.confirm("Delete routine \"X\"? All completion history will also be deleted.")` + DELETE. Mirror RoutineRow's exact wording so the warning is the single source of truth.
  - **`Edit`** button — `<Link href="/operations/routines">` (or `router.push`) — link-out for heavy editing. Mirrors the Hub-card pattern from PR-Ops-5.5.
- **Mirror task pattern or routine-appropriate: routine-appropriate.** Task row's inline-edit form has 4 fields (notes, display_order, optional ad_hoc_title/description) and patches one endpoint. A routine's equivalent inline-edit would need RRULEBuilder + 18+ form fields + timezone validation + cadence compilation — disproportionate. Link-out is the right call.
- **Reuse vs build: REUSE.** No new RoutineRow editor needed. The Daily Plan row gets three small action buttons and the existing routines-page editor stays the single editor.
- **Schema change: NO** — confirmed. PATCH + DELETE already shipped with full field coverage. The task is purely "expose existing capability in the Daily Plan UI."
- **Scope + files (estimated for Phase 2):**
  1. `src/components/workbench/operations/dailyplan/DailyPlanRoutineRow.tsx` (modify) — add `Props { onUpdate, onDelete }`, add three action buttons (edit-link, deactivate, delete) in a flex row matching DailyPlanItemRow's button layout, add `handleDeactivate` and `handleDelete` async handlers. ~60 lines added.
  2. `src/components/workbench/operations/SectionC_DailyPlan.tsx` (modify) — pass `onUpdate={fetchRoutines}` and `onDelete={fetchRoutines}` to `<DailyPlanRoutineRow>` at `:322-323`. ~2 lines.
  - **Total: 2 files modified, ~60 lines. No new component, no new API, no schema, no migration.**
- **Open decisions for Alex:**
  1. **Edit button: `<Link>` (Next link, proper prefetch + idiomatic) or `router.push` (programmatic, matches RoutineRow's button-style)?** Recommend `<Link>` for navigation — semantically a link, not an action.
  2. **"Reactivate" toggle for deactivated routines: NO.** The `/today` endpoint filters to `is_active=true`, so a deactivated routine disappears from the Daily Plan immediately after deactivation. The user can't see it to reactivate. Reactivation belongs on `/operations/routines` (where the page can show inactive routines).
  3. **Confirm text for delete:** recommend mirroring RoutineRow's exact wording (`"Delete routine \"X\"? All completion history will also be deleted."`) so the warning text is one source of truth. The "cascade" implication (completions deleted) is real per Section C.
  4. **Mark-as-done on the routine row:** DailyPlanRoutineRow's header comment notes "mark-as-done affordance is deferred to PR-Ops-4.8.1". The TodaysStrip on `/operations/routines` already has a per-row mark-complete button. Including mark-done in this PR (5.8) folds two concerns into one. **Recommend defer** — this PR is "editable" (edit/deactivate/delete); mark-done is a separate concept and can be a quick follow-up PR.
  5. **Routine row title clickable too?** Some UIs make the whole row's title a link. Recommend NO for v1 — keep the explicit `Edit` button as the only navigation target; clicking the row body could be a future "open routine inspector" affordance.
  6. **Behavior when delete fails (e.g., 409 conflict, network error):** mirror DailyPlanItemRow.tsx's pattern — set local `error` state, render an inline red error block. Reuse the existing error rendering convention; no toast.

NO SOURCE FILES MODIFIED. Audit report at audit-reports/pr-ops-5.8-phase-1.md.
