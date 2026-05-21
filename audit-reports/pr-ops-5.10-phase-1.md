PR-OPS-5.10 PHASE 1 AUDIT REPORT
================================

BRANCH STATUS
- main top 3: `debc5ae` (merge #554 PR-Ops-5.8 hub-intent-window) → `1fd7b5d` (merge #553 5.8 hub-time audit) → `89871bf` (merge #552 5.8 editable-routines audit). **PR-Ops-5.8 confirmed on main** (intent-window fix + both 5.8 audits all merged).
- current branch: `claude/pr-ops-5.10-remove-block-audit`

A. DELETE ENDPOINT

- **Exists:** `src/app/api/operations/daily-plan/blocks/[blockId]/route.ts`, DELETE handler (file header at `:1-13` documents the contract; handler body around `:200-260` after the PATCH handler).
- **Deletes ONLY the block:** `prisma.operations_calendar_blocks.delete({ where: { id: blockId } })` (single-row delete; no cascade triggered going up).
- **Task + daily_plan_item survive — confirmed via schema FK direction:**
  - `operations_calendar_blocks.daily_plan_item_id → operations_daily_plan_items.id` with `onDelete: Cascade` (`prisma/schema.prisma:2673`). **Cascade flows DOWN (item → block), NOT up.** Deleting a block does not touch the parent item.
  - `operations_daily_plan_items.task_id → operations_project_tasks.id` with `onDelete: SetNull` (`prisma/schema.prisma:2649`). Even if the daily_plan_item were deleted (which it isn't), the task row in `operations_project_tasks` would just have a SetNull on any orphaned reference — the task itself would survive. Block-delete is two levels removed from the task; the task is structurally safe.
  - **Net: block delete = block row gone. Item row intact. Task row in a different table entirely, untouched.**
- **Auth/ownership:** `getVerifiedEmail` → `prisma.users.findFirst` → `loadAuthorizedCalendarBlock(blockId, user.id)` (defensive 404 — cross-user blocks return `Not found`, not `Forbidden`, to avoid existence-disclosure). Standard pattern matching every other delete in the codebase.
- **Response shape on success:** `{ ok: true }` (HTTP 200). Pure confirmation; no echoed payload.
- **Side effects:** ONE audit row written — `operations_calendar_block_deleted` with `payload.before = existing` (the full block snapshot for replay) and `metadata.daily_plan_item_id`. No other writes. No orphans (the parent item and the task remain reachable via their normal paths).

**Bottom line for Section A: backend is ready. Zero-line server change required for PR-Ops-5.10.**

B. HUBEVENTCARD

- **Structure** (HubEventCard.tsx 230 lines):
  - Header: title + close × button (brand-purple)
  - Body: scheduled time range + status pill + actual times (if populated) + task title + status + category + planned/actual cost + notes
  - Footer: two LIVE dimension link buttons — `Open in Projects →` (`/operations/projects`), `Open Daily Plan →` (`/operations`)
- **Props (`:32-36`):** `{ item: DailyPlanItem; block: CalendarBlockSummary; onClose: () => void }`. **`block.id` IS available** (`CalendarBlockSummary.id` from `dailyplan/types.ts`), so the card has exactly what's needed to fire `DELETE /api/operations/daily-plan/blocks/${block.id}`.
- **Refresh/onClose mechanism currently:** the card has only `onClose: () => setCardSelection(null)` (`hub/page.tsx:398`). **No data-refresh callback exists.** Parent's `cardSelection` state is set in `handleEventClick`, cleared on close. After a delete, two things must happen:
  1. **Hub refetches `operationsItems`** so the deleted block disappears from the calendar tile (the `gridEvents` useMemo at `hub/page.tsx:340-355` rebuilds from this state via `mapOperationsBlocks`).
  2. **Card closes.**
  The Hub already has `loadOperationsBlocks()` (`hub/page.tsx:200`) — that's the refetch trigger. A new `onDeleted` (or `onRefresh`) prop threaded into the card lets the card invoke both.
- **Where the button goes:** footer, next to the two existing link buttons. The card is per-block (one card per click), so the destructive action operates on the exact block the user is looking at — no ambiguity. Visually destructive style (red text/border) so it's distinct from the navigational link buttons.

C. DAILYPLANITEMROW BLOCK LIST

- **Block display (DailyPlanItemRow.tsx:285-292):**
  ```tsx
  {item.calendar_blocks.length > 0 && (
    <div className="flex flex-wrap gap-2 pl-2 border-l-2 border-border-light">
      {item.calendar_blocks.map((b) => (
        <div key={b.id} className="text-xs font-mono text-text-muted">
          {formatTime(b.scheduled_start)}–{formatTime(b.scheduled_end)} · {b.status}
        </div>
      ))}
    </div>
  )}
  ```
  Each block is a small read-only chip showing time range + status. Multiple blocks per item are common.
- **Room for per-block delete:** YES — a small `×` button next to each chip is the obvious treatment (mirrors the chip-with-close pattern in many calendar UIs). The chip becomes interactive.
- **`onUpdate/onDelete` refetch pattern (Props `:22-26`):** already wired. `<DailyPlanItemRow ... onUpdate={fetchItems} onDelete={fetchItems} />` (`SectionC_DailyPlan.tsx`). A block-delete handler in DailyPlanItemRow would call `onUpdate()` after success → `fetchItems()` reloads items → blocks repaint without the deleted one.
- **More natural home than Hub card?** **PARTIALLY.** DailyPlanItemRow is where "+ schedule block" lives (PR-Ops-5.2). Symmetric "remove block" makes architectural sense here. **BUT** — Alex is currently stuck on the Hub side; the card is where he's looking when he wants to uncommit. Both surfaces have legitimate claims. The Hub card is the higher-leverage fix today (it's where the explicit "uncommit" gesture is missing); the Daily Plan × is a smaller, mirror affordance for users browsing the Daily Plan directly.

D. REFRESH AFTER DELETE

- **HubEventCard refresh path:** add an `onDeleted: () => void` prop. Parent (`hub/page.tsx`) wires it to `() => { loadOperationsBlocks(); setCardSelection(null); }` — refetches state + closes card. On the Hub, this makes the deleted tile disappear from the CalendarGrid render on the next tick.
- **DailyPlanItemRow refresh path:** the existing `onUpdate={fetchItems}` is the refresh. A block-delete handler calls `onUpdate()` after a successful DELETE; the item GET nests the (now-reduced) calendar_blocks array, repainting the chip list.
- **Both paths reuse existing refetch — no new mechanism needed.** Neither requires optimistic state updates; the refetch is fast enough.

E. RECOMMENDATION

- **Surface(s):** **HubEventCard for v1 (PR-Ops-5.10), Daily Plan chip × as a follow-up (PR-Ops-5.10.1 — ~30 lines).** Rationale:
  - The Hub card is per-block and Alex is stuck there now — fixing this single surface immediately closes the reported pain.
  - The card already has `block` in scope (singular block, unambiguous target), so the action is the simplest possible: one button, one block, one DELETE.
  - The Daily Plan × is also valuable but a different visual pattern (interactive chip) — worth its own small PR after this lands.
- **Button + confirm placement:** footer of HubEventCard, after the two link buttons, with `margin-left: auto` (or a `flex-1` spacer) so it's visually separated as the destructive action. Destructive style: red text on white, red border on hover — same convention as the `delete` buttons in DailyPlanItemRow (`:154` `border-red-300 text-red-700 hover:bg-red-50`). Confirm dialog: `window.confirm("Remove this block from the calendar? The task stays.")` — the exact wording locked in the spec, makes the no-data-loss guarantee explicit.
- **Refresh approach:** thread `onDeleted: () => void` prop through HubEventCard. Parent invokes `loadOperationsBlocks()` (existing refetch) AND `setCardSelection(null)` (close card) in the same callback. Reuses what's there; no new mechanism.
- **DELETE endpoint ready (no backend work): YES.** Verified in Section A. Zero-line server change required.
- **Schema change: NO** — confirmed. Pure UI plumbing.
- **Scope + files for Phase 2:**
  1. `src/components/hub/HubEventCard.tsx` — add `onDeleted: () => void` prop, add `handleRemove` async function (confirm → DELETE → on success `onDeleted()`, on error set local `error` state), add a button in the footer. Add a small `error` state + inline error display at the top of the card body for failures (mirrors the existing block-form error pattern in DailyPlanItemRow). ~40-50 lines added.
  2. `src/app/hub/page.tsx` — pass `onDeleted={() => { loadOperationsBlocks(); setCardSelection(null); }}` to `<HubEventCard>` at `:395-399`. 1 line.
  - **Total: 2 files, ~50 lines net. No API change, no schema, no migration.**
- **Open decisions for Alex:**
  1. **Hub-only for v1, or include Daily Plan chip × in the same PR?** Recommend **Hub-only** (smaller, closes the reported pain immediately). Daily Plan × is a follow-up.
  2. **Button label:** `Remove from calendar` (matches the locked confirm text), or shorter (e.g., `Remove block` / `Unschedule`)? Recommend `Remove from calendar` — explicit about what's removed and consistent with the confirm dialog.
  3. **Confirm text wording:** `"Remove this block from the calendar? The task stays."` per spec. Confirm — recommend exact wording (the second sentence is the no-data-loss reassurance and removes ambiguity).
  4. **Button placement in footer:** leftmost (destructive-first), rightmost (away from primary), or separated with auto-margin? Recommend **separated with auto-margin** — visually distinct from the navigational links, not the first thing the eye lands on.
  5. **Error UX:** on a failed DELETE (network error, 404, etc.), where does the message render? Recommend **inline red error block at the top of the card body** (consistent with the block-form error pattern in DailyPlanItemRow). No toast — matches the 4.9.3 / 5.x convention.
  6. **After successful delete:** close immediately, or brief "removed" toast then close? Recommend **immediate close** — the calendar tile disappearing IS the feedback.
  7. **Future Daily Plan chip × follow-up:** confirm Alex wants it eventually (PR-Ops-5.10.1) or stop at the Hub-card affordance.

NO SOURCE FILES MODIFIED. Audit report at audit-reports/pr-ops-5.10-phase-1.md.
