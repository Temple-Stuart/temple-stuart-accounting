# FULL-SHOWROOM-SCOPE-AUDIT

**Scope:** What it takes to make the public home-page showroom show the WHOLE product
end-state (not just the Projects pipe). Read-only audit. Every claim cites `file:line`
against `main` @ `fabc5f50` (PR11 merged).

**Status legend:** EXISTS · EXISTS BUT UNUSED · MISSING · REUSABLE · RISKS

---

## 0. TL;DR

- The public home page is **already multi-module** (6 stacked module cards,
  `ModuleLauncher.tsx:29-36,155`). Only the **Operations** card currently shows a real
  showroom (`ProjectsPipelineShowroom`, `ModuleLauncher.tsx:116`) — and only the
  **Projects pipe**, not the Day Calendar or Script Generator.
- **Inconsistency (Projects):** the demo shows the reality-INPUT boxes but not the
  buttons that act on them, because the generate buttons live in `editing` mode and the
  showroom locks `editing=false`. See §1.
- **Day Calendar** and **Script Generator** both EXIST but are **self-fetchers** behind
  the authed `/operations/content` page; **neither is a pure view**. To show them locked
  on a public page they need the **same pure-view + slot extraction** Projects needed
  (PR5–PR7b), plus demo seed. Script Generator additionally hits a **PAID Anthropic
  route** that must be locked behind `onRequireAuth`. See §2, §3, RISKS.
- Adding calendar/script pure views to the showroom means **also adding them to the
  PR10 guardrail's asserted file list** (`assert-showroom-fetch-free.mjs:29-37`). See §5.

---

## 1. CURRENT SHOWROOM — THE INCONSISTENCY (inputs shown, action buttons not)

**Where the reality-input boxes render** — inside the `expanded && !editing` read block
(`ProjectRowView.tsx:262`):
- Section label `reality inputs (ground AI regeneration)` — `ProjectRowView.tsx:300`
- `researchInput` textarea — `ProjectRowView.tsx:308`
- `auditInput` textarea — `ProjectRowView.tsx:318`
- `save inputs` button → `onClick={onSaveInputs}` — `ProjectRowView.tsx:329`
- helper text `saved — regenerate tasks to use these` — `ProjectRowView.tsx:335`

**Where the generate/evolve buttons render** — inside the `editing` block
(`ProjectRowView.tsx:408`), a DIFFERENT mode:
- `↑ generate plan` → `onClick={onGenerateDesign}` — `ProjectRowView.tsx:494,499`
- `↑ generate tasks` → `onClick={onGenerateTasks}` — `ProjectRowView.tsx:570,575`

**Why the demo is inconsistent:** the showroom mounts the row force-expanded but
**non-editing** — `expanded={true}`, `editing={false}`
(`ProjectsPipelineShowroom.tsx:206-207`). Result:
- VISIBLE in the demo: the research/audit paste boxes + a **locked** `save inputs`
  button (they are in the `expanded && !editing` block).
- HIDDEN in the demo: `↑ generate plan` and `↑ generate tasks` (they are in the
  `editing`-only block, never reached because `onEnterEdit` is locked to
  `onRequireAuth`, `ProjectsPipelineShowroom.tsx`).

So a visitor sees input boxes labeled "ground AI regeneration" / "regenerate tasks to
use these" with **no regenerate button anywhere on screen** — the loop is truncated.

**How inputs+buttons pair in the real (authed) product:** the authed container wires
the same `ProjectRowView`, so the layout split is identical — inputs in the read view,
generate buttons in edit mode. The difference is the authed user CAN click **edit** to
reach them; the demo cannot. Container handlers (the live, paid path):
- `onSaveInputs={handleSaveInputs}` — `ProjectRow.tsx:401`
- `onGenerateDesign={handleGenerateDesign}` (PAID `POST …/generate-design`) —
  `ProjectRow.tsx:404` → fetch `ProjectRow.tsx:186`
- `onGenerateTasks={handleGenerateTasks}` (PAID `POST …/generate-tasks`) —
  `ProjectRow.tsx:407` → fetch `ProjectRow.tsx:225`

**What a complete, consistent loop should show:** either (a) surface the
`↑ generate plan` / `↑ generate tasks` (and the input "save") buttons **together with**
the input boxes, all routed to `onRequireAuth` (locked), so the visitor sees the full
input → generate → evolve story; or (b) hide the reality inputs too (show neither). The
"evolve scope" step is not a separate button — re-running `generate-tasks` is what
appends a new version to the Evolution timeline (the `EvolutionTimelineView` already in
the demo). REUSABLE: the buttons already exist in `ProjectRowView`; making them visible
in a locked/non-editing context is a view-layout decision, not new machinery.

---

## 2. TIME-BLOCK / DAY CALENDAR

**EXISTS** — authed only; **self-fetcher**, not a pure view.

**Primary component:** `DayCalendar` —
`src/components/workbench/operations/content/DayCalendar.tsx:133`
(`export default function DayCalendar({ date, onDateChange })`).

**Data-access lines (NOT pure):**
- `const { timeline, loading, error } = useDayFeed(date);` — `DayCalendar.tsx:141`
- `const { entities } = useOperationsEntity();` (React context) — `DayCalendar.tsx:142`

**The fetching hook:** `useDayFeed` —
`src/components/workbench/operations/content/useDayFeed.ts:179`. Fetches FOUR sources:
- `fetch('/api/operations/content/grid', …)` — `useDayFeed.ts:196`
- `fetch('/api/operations/projects', …)` — `useDayFeed.ts:197`
- `fetch('/api/operations/daily-plan/items?from=…&to=…', …)` — `useDayFeed.ts:221`
- `fetch('/api/trips/day-blocks?date=…', …)` — `useDayFeed.ts:236`
- event listener `CONTENT_DAY_PLAN_CHANGED_EVENT` refresh — `useDayFeed.ts:257`

**Sibling daily-plan components (also live):** `SectionC_DailyPlan.tsx:47` (fetches
`daily-plan/items` :68, `routines/today` :90, POST create :129); `DailyPlanItemRow.tsx:63`
(POST blocks :141, PATCH :195, DELETE :219). `DailyPlanRoutineRow.tsx:48` is the one
**PURE** row (props-only).

**Backing models (Prisma):**
- `operations_daily_plan_items` — `prisma/schema.prisma:2732-2754`
  (`plan_date`, `task_id`, `ad_hoc_title`, `display_order`, → `calendar_blocks`).
- `operations_calendar_blocks` — `prisma/schema.prisma:2756-2776`
  (`scheduled_start/end`, `actual_start/end`, `status` enum
  `scheduled|in_progress|completed|missed|cancelled`).

**Rendered today:** only in `ContentPipeline.tsx` (import `:33`, render
`<DayCalendar date={date} onDateChange={setDate} />` `:344`), which is the **authed**
page `src/app/operations/content/page.tsx`. **Not on the public home page.**

**Demo seed needed (shape):** a single `date`, plus a `timeline` array of blocks like
`useDayFeed` produces — each block tagged by source (scene / task / travel) with a label,
a clock time / `scheduled_start`–`scheduled_end`, an entity, and a status. A handful of
non-overlapping blocks across one day (so collision/gap rendering shows real structure),
e.g. a morning routine scene, a midday task block, an afternoon travel block.

---

## 3. SCRIPT GENERATOR

**EXISTS** — authed only; **self-fetcher** AND **calls a PAID Anthropic route**.

**Main component:** `ScriptGenerator` —
`src/components/workbench/operations/content/ScriptGenerator.tsx:48`.

**Data-access lines (NOT pure):**
- `fetch('/api/operations/content/grid', …)` — `ScriptGenerator.tsx:64`
- `useEffect(() => { void load(); }, [load])` (load on mount) — `ScriptGenerator.tsx:74`
- event-listener refetch `useEffect` — `ScriptGenerator.tsx:77-85`
- PATCH save execution notes `…/grid/piece/${id}` — `ScriptGenerator.tsx:120`
- **PAID** `fetch('/api/operations/content/generate-script', { method:'POST' })` —
  `ScriptGenerator.tsx:150`
- PATCH save script `…/grid/piece/${id}` — `ScriptGenerator.tsx:172`

**The PAID route:** `POST /api/operations/content/generate-script` —
`src/app/api/operations/content/generate-script/route.ts:43`.
- Tier gate `requireTier(user.tier, 'ai', user.id)` — `route.ts:53`
- Calls `generateReelScript()` — `route.ts:174` →
  `src/lib/ai/generateReelScript.ts:139`
- Actual Anthropic call `client.messages.create(...)` —
  `src/lib/ai/recordUsage.ts:119`; model `claude-sonnet-4-20250514`
  (`src/lib/ai/client.ts:31`); cost $3/$15 per M tok (`client.ts:38-44`).
- Voice contract / system prompt — `generateReelScript.ts:53-108`.

**Response shape (what a generated script returns)** — `route.ts:185-193`:
`{ script: string (scene-tagged prose "[scene N · activity]"), usage_id, input_tokens,
output_tokens, cost_usd, scenes_used, tasks_used }`.

**Related pure piece:** `ScriptDrawer.tsx:30-45` is props-only (a scene editor), but the
generator itself is not.

**Rendered today:** only in `ContentPipeline.tsx:565` (authed `/operations/content`).
**Not on the public home page.**

**What a locked demo version would show:** the real generator UI (scene/piece picker,
the execution-notes box, the script output panel) seeded with a **static sample
generated script** (a plain-voice, scene-tagged string consistent with the food-truck
demo) plus sample scene/task inputs — with the `Generate script` button and the
notes/script save buttons all routed to `onRequireAuth`. **The `generate-script` POST
must never be reachable logged-out** (it is paid).

---

## 4. THE FRAMING — one pipe vs. full-product showroom

**Home structure today:** `ModuleLauncher` defines a `MODULES` array of 6 module cards —
`ModuleLauncher.tsx:29-36`:
`travel (live)`, `trading`, `operations`, `bookkeeping`, `tax`, `compliance`. It maps
them into stacked full-width `SectionCard`s (`MODULES.map` `:155`) and chooses each
card's body via `renderBody(m)` switching on `m.key` (`:106`). The card tag shows
`'Live demo · log in to use'` for operations, else `Free · guest ok` / `Paid`
(`:162`).

**Multi-panel capable?** YES. The page is already multi-module, and a single module
card can host multiple sub-panels: the **previous** `OperationsShowroom` rendered a
4-panel grid (Project / Routine / Content / Evolution) in the operations card — proof
the operations slot can compose several showroom panels. Today the operations card
renders ONE component, `<ProjectsPipelineShowroom onRequireAuth={onRequireAuth}/>`
(`ModuleLauncher.tsx:116`) — i.e. only the Projects pipe. A full-product Operations
showroom would compose Projects + Day Calendar + Script (+ Routines) panels inside that
same card.

**Per-module home-surface status:**

| Module | Home-renderable surface today | Status |
|---|---|---|
| Travel | `CreateTripForm` (live, guest-ok) — `ModuleLauncher.tsx:108` | **EXISTS** |
| Trading | `ScanFilterForm` for admins only `:120`; guests → paid stub `:131` | **EXISTS (admin) / guest stub** |
| Operations · Projects | `ProjectsPipelineShowroom` — `:116` | **EXISTS** |
| Operations · Day Calendar | none on home; authed `ContentPipeline.tsx:344` | **EXISTS BUT UNUSED on home** |
| Operations · Script Gen | none on home; authed `ContentPipeline.tsx:565` | **EXISTS BUT UNUSED on home** |
| Operations · Routines | old `RoutineCreateForm` existed in retired `OperationsShowroom`; not in current card | **EXISTS BUT UNUSED on home** |
| Bookkeeping | paid stub only — `ModuleLauncher.tsx:131-143` | **MISSING** |
| Tax | paid stub only — `:131-143` | **MISSING** |
| Compliance | paid stub only — `:131-143` | **MISSING** |
| Hub Calendar | not a `MODULES` entry; the cross-source day view is `DayCalendar` (authed) | **MISSING on home** (see §2) |

Note: the `MODULES` list contains `compliance`, not a separate "Hub Calendar" module;
the unified day/calendar surface lives inside Operations content (`DayCalendar`).

---

## 5. SAFETY POSTURE TO PRESERVE (PR10 guardrail)

The Layer-1 build assertion `scripts/assert-showroom-fetch-free.mjs` asserts an
**explicit** file list (`BASE` `:24`, `SUBTREE_FILES` `:29-37`), 8 files today:
1. `…/projects/showroom/ProjectsPipelineShowroom.tsx`
2. `…/projects/showroom/demoData.ts`
3. `…/projects/showroom/narrativeCopy.ts`
4. `…/projects/ProjectRowView.tsx`
5. `…/projects/TaskListView.tsx`
6. `…/projects/EvolutionTimelineView.tsx`
7. `…/projects/DependencyListView.tsx`
8. `…/projects/TaskRowView.tsx`

It forbids `fetch(`, `useSWR`, `useEffect(`, `useOperationsEntity(`, quoted `'/api/'`,
and live-container imports, and is wired into `npm run build` (`package.json`
`assert:showroom` + prepended to `build`). The Layer-2 runtime guard lives at
`src/lib/showroom/renderGuard.ts` (intentionally NOT in the asserted list).

**Implication:** any new calendar/script **pure view** added to the showroom subtree
(e.g. a future `DayCalendarView`, `ScriptGeneratorView`, plus their demo-seed modules)
**must be appended to `SUBTREE_FILES`** so the guardrail covers them. Otherwise a fetch
could be reintroduced in an unguarded file and ship to the public page. The Layer-2
`guardShowroomRender` wrapper should likewise wrap any new showroom root.

---

## RISKS — for each new surface: pure today or self-fetching/paid, and smallest safe path

**Day Calendar**
- **Today:** SELF-FETCHING. `DayCalendar.tsx:141` (`useDayFeed`) + `:142`
  (`useOperationsEntity` context); `useDayFeed.ts` fires 4 `fetch` calls
  (`:196,197,221,236`). No paid route. It also reaches a React context
  (`useOperationsEntity`) — same class of coupling the Projects views removed.
- **Smallest safe path:** mirror PR5/PR7a — extract a **pure `DayCalendarView`**
  (props: `timeline`, `loading`, `error`, `entities`, plus callbacks) and leave the
  fetching/`useDayFeed`/context in a thin `DayCalendar` container. Author a static
  **calendar demo seed** (a day of non-overlapping blocks). Add the view + seed to the
  guardrail list (§5). All controls (date nav, block actions) → `onRequireAuth`. No paid
  exposure to worry about. Effort ≈ the Projects extraction, smaller surface.

**Script Generator**
- **Today:** SELF-FETCHING **and PAID**. `ScriptGenerator.tsx:64,74,120,172` fetches +
  the **paid** `POST /api/operations/content/generate-script` (`:150` →
  `route.ts:43` → `generateReelScript.ts:139` → `recordUsage.ts:119`
  `client.messages.create`, tier-gated `route.ts:53`).
- **Highest risk:** the paid Anthropic call. It MUST be unreachable logged-out — the
  `Generate script` button has to be a locked `onRequireAuth` no-op in the demo, exactly
  like Projects' `onGenerateDesign`/`onGenerateTasks` are locked.
- **Smallest safe path:** extract a **pure `ScriptGeneratorView`** (props: scene/piece
  list, selected piece, `executionNotes`, `scriptOutput`, pending flags + callbacks),
  keep all fetches AND the paid POST in the `ScriptGenerator` container. Seed a **static
  sample script string** + sample scenes/tasks. Lock every button (esp. generate/save)
  to `onRequireAuth`. Add view + seed to the guardrail list. The runtime guard
  (`renderGuard.ts`) gives defense-in-depth against an accidental paid call slipping in.

**Projects loop consistency (§1)**
- **Risk:** low/cosmetic, no new fetch. The generate buttons already exist in
  `ProjectRowView`; they're just gated to `editing`. Surfacing them (locked) in the
  non-editing demo, or hiding the inputs, is a view-layout change. No paid route is
  reachable because `onGenerateDesign`/`onGenerateTasks` are already bound to the locked
  `onRequireAuth` handler in the showroom; making the buttons visible does not change
  that. Guardrail already covers `ProjectRowView.tsx`.

**Cross-cutting**
- Both new surfaces live under `operations/content` and share `ContentPipeline`'s data
  plumbing; extracting their views does **not** require touching `ContentPipeline` if the
  showroom composes the pure views directly with seed (as Projects does).
- `useOperationsEntity` context is a new coupling not present in the Projects subtree;
  the calendar extraction must move that context read into the container (the guardrail
  already forbids `useOperationsEntity(` in subtree files — §5).
- Keep `/` client-only with no SSR data (today: `page.tsx:1` `'use client'`, no
  server-data access) — adding panels must not introduce `getCurrentUser`/`prisma`/
  `cookies`/`generateMetadata` to the home route.

---

## REUSABLE assets (already built, directly applicable)

- **Pure-view + slot pattern** (PR5–PR7b): `ProjectRowView` slots, `TaskListView`
  `renderTaskRow` render-prop — the exact template for `DayCalendarView` /
  `ScriptGeneratorView`.
- **`onRequireAuth` lock** (`ProjectsPipelineShowroom.tsx` `makeLockedHandlers`) — one
  inert handler covering every callback; reuse verbatim.
- **Demo-seed module pattern** (`showroom/demoData.ts`) + **narrative copy module**
  (`showroom/narrativeCopy.ts`) + **`SectionNote`** wrapper — same structure for calendar
  and script seeds/copy.
- **Guardrail** (`assert-showroom-fetch-free.mjs` + `renderGuard.ts`) — extend the file
  list; no new mechanism needed.
- **Multi-panel host** — the Operations module card (`ModuleLauncher.tsx:110-117`) can
  compose multiple showroom panels (as the retired `OperationsShowroom` did).
