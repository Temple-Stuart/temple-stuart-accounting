# Content pipeline → new homepage tab (between Projects and Trade) (READ-ONLY AUDIT)

**Mandate:** Truth-first, read-only, every claim cites file:line. No fixes. Labels:
EXISTS / EXISTS-BUT-UNUSED / MISSING / REUSABLE / RISK.

**Headline:** the Content pipeline is the **exact Projects/Routines pattern** — a self-contained
top surface (`ContentPipeline`) coupled only to `OperationsEntityProvider`, so **mount-as-is** via
the provider wrap (no extraction, no new routes, no migration — all 13 content routes + 5
`operations_content_*` tables already exist and work). Adding the "Content" tab between Projects and
Trade is a small `MODULES`/`TABS`/`renderBody` edit + a flush section + a lucide icon. **The
restyle is the work:** the live content tree is **7 files / 66 `font-mono`** — between Routines
(3/24) and Projects (9/103), closer to Projects → a LARGE-ish, **2-sub-PR** restyle. One RISK: the
phone tab bar goes from 8 → 9 tabs (crowding).

---

## 1. THE CONTENT PIPELINE — the complete LIVE tree

Top surface: **`ContentPipeline`** (`src/components/workbench/operations/content/ContentPipeline.tsx`),
mounted at `app/operations/content/page.tsx` (the OPS-CE-7 4-step pipeline: SOURCES → SCENIFY DRAFT
→ CONFIRMED grid → SCRIPT OUTPUT). Traced transitively:

```
ContentPipeline                                  (13 mono)  — useOperationsEntity, self-fetches
├── ScenifyDraft                                 (2)  → ScenifyModal, TaskBand
├── ScriptGenerator                              (0)  → ScenifyModal, ScriptGeneratorView (16)
├── PieceGrid                                    (8)  → ScenifyModal
├── DailyLog                                     (10) → TaskBand, useDayFeed
├── DayCalendar                                  (0)  → DayCalendarView (14), useDayFeed
├── ScenifyModal                                 (3)
├── TaskBand                                     (0)
├── useDayFeed (hook)                            (0)
├── ProjectCreateForm  (REUSED from projects)    (0 — already restyled, style-2)
└── RoutineCreateForm  (REUSED from routines)    (0 — already restyled, HB-4e-style)
```
**Live files with font-mono (7):** `ContentPipeline (13)`, `ScriptGeneratorView (16)`,
`DayCalendarView (14)`, `DailyLog (10)`, `PieceGrid (8)`, `ScenifyModal (3)`, `ScenifyDraft (2)`
= **66**. — EXISTS, complete tree (`ContentPipeline.tsx:26-35,71`).

**RETIRED / not in the live tree (do NOT restyle):** the page comment (`app/operations/content/
page.tsx`) explicitly retires `SectionG_Content`, `ScriptDrawer`, `AvailableRoutinesList`,
`SceneHeaderRow`, `TakeRow` (dead on the page, kept for a later cleanup). Their satellites —
`ScenifyButton` (imported only by AvailableRoutinesList), `TakeifyButton` (no importer),
`EditableCell` (only SceneHeaderRow/TakeRow), `QuestionLibrary` (no importer in content/) — are
**not reachable from ContentPipeline**, so they're **EXISTS-BUT-UNUSED** and out of scope.
`ContentTable` is still used by the home `ContentPreview` (a separate showroom), not the pipeline.

## 2. SELF-CONTAINED vs COUPLED — mount-as-is

`ContentPipeline` consumes **`useOperationsEntity()`** (`:27,71`) → `{ entities, selectedEntityId,
setSelectedEntityId }` — the SAME single coupling as `SectionD`/`SectionE` — and **self-fetches**
everything it needs (`/api/operations/content/grid` `:94`, `/api/operations/daily-plan/items`
`:109,233,280`, `/api/operations/routines` `:136`, `/api/operations/tasks/unscheduled` `:137`). So
the mount is verbatim: `<OperationsEntityProvider><ContentPipeline /></OperationsEntityProvider>`
— **no extraction, no CRUD rewrite**, exactly the Projects/Routines pattern. `/operations/content`
keeps working (provider from its own layout). — REUSABLE, `ContentPipeline.tsx:27,71` +
`EntitySelector.tsx:38,61`.

## 3. ROUTES + SCHEMA — all present, NO migration

**Routes (all EXIST under `app/api/operations/content/`):** `grid/route.ts`,
`grid/piece/route.ts`, `grid/piece/[pieceId]/route.ts`, `grid/cell/route.ts`,
`scenes/route.ts`+`[id]`, `scene-rows/route.ts`, `takes/route.ts`+`[id]`,
**`generate-script/route.ts`** (the reel/script generator endpoint), `questions/route.ts`+`[id]`
(the question library), `enrich-routine/route.ts`. The pipeline's fetches (§2) all hit existing
routes. — EXISTS, nothing to build.

**Tables (all EXIST, `prisma/schema.prisma:3053-3187`):** `operations_content_scene_groups`,
`operations_content_scenes`, `operations_content_pieces` (`.script` = "the generated reel
voiceover for the day"), `operations_content_takes`, `operations_content_questions`. The
scene/piece/take/question architecture is fully built. — EXISTS, **no migration needed.**

## 4. THE TAB BAR — exact edits to insert "Content" between Projects and Trade

Three arrays in `ModuleLauncher.tsx`:
- **`MODULES`** (`:53-64`): `travel, trading, projects, routines, bookkeeping, tax, compliance`.
  Add `{ key: 'content', label: 'Content', live: false, blurb: 'Turn your day into a reel — sources
  → scenes → script.' }` (position in MODULES is not what orders the tab bar — see TABS — but it
  must exist for `MODULES.find(m => m.key === 'content')`).
- **`TABS`** (`:70-79`): currently `calendar, travel, routines, projects, trade, books, tax,
  compliance`. **Insert between `projects` and `trade`:** `{ key: 'content', label: 'Content',
  icon: Clapperboard }` (import `Clapperboard` — or `Film`/`Video` — from `lucide-react` `:6`).
  Result: `… projects, CONTENT, trade, …`.
- **`MODULE_TO_TAB`** (`:82-90`): add `content: 'content'`.

**`renderBody` body-branch** (mirror `projects`, `ModuleLauncher.tsx:278-296`): add `if (m.key ===
'content')` → `authed === true` → `<OperationsEntityProvider><ContentPipeline/></OperationsEntityProvider>`;
`authed === false` → the showroom (§5); `null` → nothing. Plus a **flush `<section>`** for content
(mirror the Routines/Projects flush blocks, e.g. `:467-475`) and add `content` to the MODULES.map
skip (`if (m.key === 'travel' || m.key === 'routines' || m.key === 'projects' || m.key ===
'content') return null`). — the edit surface, `ModuleLauncher.tsx:53-90, 278-296, flush blocks`.

## 5. AUTH + LOGGED-OUT — the showroom already IS the content demo

`OperationsPipelineShowroom` (the current logged-out Projects demo) **already renders the content
pipeline**: "PANEL 2 · DAY (DayCalendarView)" + "PANEL 3 · SCRIPT (ScriptGeneratorView)"
(`OperationsPipelineShowroom.tsx:7-8,24-25,69,82`) from `content/showroom/demoData`. So the Content
tab's logged-out story is **already built** — reuse `OperationsPipelineShowroom` for `authed ===
false` (same Option-B choice as Projects: rich demo for logged-out), OR a content-focused slice of
it. There is a `content/showroom/demoData.ts` (the seed) but **no standalone content-only showroom
component** — the showroom is `OperationsPipelineShowroom`. — EXISTS (the demo), REUSABLE.

## 6. STYLING — terminal, same gap as Projects

`ContentPipeline` is terminal-styled exactly like SectionD was: `font-mono` header
(`sectionHeader = 'font-mono …'` `:68`; `<h1 className="font-mono …">` `:307`), `font-mono` chips
(`:311`), and a **card** `bg-white rounded border border-border shadow-sm p-5` (`:349`). The gap
classes that apply (same as Projects):
- **Cards** (`:349` + nested) → flush. **Band-escape** → pull the Content tab out of MODULES.map
  into a flush section (it'll otherwise render in the purple-band card). **Header** `font-mono …
  text-brand-purple` → `text-lg font-bold text-brand-purple`. **Pills** — `PieceGrid`/
  `DayCalendarView` likely carry status chips → check for `border rounded` pills → Travel
  `rounded-full` (confirm during the PR). **Dates** — verify ISO-vs-human (DailyLog/DayCalendar
  render times; check whether they `slice` or `toLocale`).
- **Size: 7 files / 66 `font-mono`.** vs Routines 3/24, Projects 9/103. **Between, closer to
  Projects.** — RISK (LARGE-ish restyle), the 7 files in §1.

## 7. SIZE — Projects-sized arc (not Routines-sized)

- **Mount = SMALL-MED** (tab arrays + renderBody branch + flush section + provider wrap — identical
  to Projects-mount; ContentPipeline is self-contained).
- **Restyle = LARGE-ish** (7 files / 66 mono — ~⅔ of Projects). Split into **2 sub-PRs**.
- **No new routes, no schema/migration** (§3) — unlike a from-scratch feature.
- **RISK:** the phone tab bar goes 8 → 9 tabs (the `TABS` comment already notes "horizontal-scroll
  so 7 tabs stay clean"; it's at 8 today, 9 after). Cosmetic crowding on narrow phones — flag, not
  a blocker.

---

## Explicit answers

**(a) Complete tree + top surface.** Top = `ContentPipeline` (`app/operations/content/page.tsx`).
Live children: `ScenifyDraft`, `ScriptGenerator→ScriptGeneratorView`, `PieceGrid`, `DailyLog`,
`DayCalendar→DayCalendarView`, `ScenifyModal`, `TaskBand`, `useDayFeed` + REUSED
`ProjectCreateForm`/`RoutineCreateForm`. 7 files carry font-mono (66). Retired satellites
(SectionG/ScriptDrawer/ContentTable/etc.) are out of the live tree.

**(b) Self-contained → mount-as-is.** `useOperationsEntity` + self-fetch (`ContentPipeline.tsx:27,
71,94,109,136`); wrap in `OperationsEntityProvider`. No extraction.

**(c) Routes + tables.** ALL present in `/operations` — 13 content routes (incl.
`generate-script`, `grid`, `scenes`, `takes`, `questions`) + 5 `operations_content_*` tables
(`schema:3053-3187`). **Nothing to migrate.**

**(d) The tab edit.** `MODULES` (`:53-64`) += a `content` entry; `TABS` (`:70-79`) insert `{ key:
'content', label: 'Content', icon: Clapperboard }` **between `projects` and `trade`**;
`MODULE_TO_TAB` (`:82-90`) += `content: 'content'`; `renderBody` += a `content` branch (authed →
provider-wrapped `ContentPipeline`, logged-out → showroom, null → nothing) + a flush `<section>` +
add `content` to the MODULES.map skip. Icon: `Clapperboard` (or `Film`/`Video`) from `lucide-react`.

**(e) Logged-out story.** Already built — `OperationsPipelineShowroom` renders the content demo
(Day + Script panels, `:7-8,24-25,69,82`). Reuse it for `authed === false` (Option B, like
Projects). No new teaser needed.

**(f) Styling gap + size.** Terminal (font-mono + `shadow-sm p-5` cards + band) — same as Projects.
**7 files / 66 font-mono** (ContentPipeline 13, ScriptGeneratorView 16, DayCalendarView 14, DailyLog
10, PieceGrid 8, ScenifyModal 3, ScenifyDraft 2). Between Routines (3/24) and Projects (9/103).

**(g) Recommended PR sequence.**
1. **PR-Content-mount (SMALL-MED, no migration).** Add the `content` entry to `MODULES`/`TABS`
   (between Projects/Trade)/`MODULE_TO_TAB`; `renderBody` branch (authed → `<OperationsEntityProvider>
   <ContentPipeline/></OperationsEntityProvider>`, logged-out → `OperationsPipelineShowroom`, null →
   nothing); flush section + MODULES.map skip; import the lucide icon. Ships the working pipeline
   immediately (terminal-styled until the style PRs). Mirror Projects-mount exactly.
2. **PR-Content-style-1 (MED).** `ContentPipeline (13)` shell/header/de-band/card + `PieceGrid (8)`
   + `DailyLog (10)` + `ScenifyModal (3)` + `ScenifyDraft (2)` ≈ 36 mono — the grid/day surface.
3. **PR-Content-style-2 (MED).** `ScriptGeneratorView (16)` + `DayCalendarView (14)` ≈ 30 mono —
   the script + day-calendar views (these are ALSO used by `OperationsPipelineShowroom`, so
   restyling them cleans the logged-out demo too — note the shared use, like Projects' AITaskPreview).
   Keep any genuine code values mono (check ScriptGeneratorView for a raw-script/JSON display — the
   COA/rrule precedent).

**Honest sizing:** mount SMALL-MED; restyle LARGE (split 2). No new route/schema work. The only new
risk is the 9-tab phone bar (cosmetic).

### Citation index
- Top surface + page: `app/operations/content/page.tsx`; `ContentPipeline.tsx:26-35,68,71,94,109,
  136,307,349`.
- Tree children: `ScenifyDraft/ScriptGenerator/PieceGrid/DailyLog/DayCalendar` imports (§1);
  `ScriptGeneratorView`, `DayCalendarView`.
- Routes: `app/api/operations/content/{grid,scenes,takes,generate-script,questions,enrich-routine}`.
- Tables: `prisma/schema.prisma:3053-3187`.
- Tab arrays: `ModuleLauncher.tsx:53-64 (MODULES), 70-79 (TABS), 82-90 (MODULE_TO_TAB)`; projects
  branch `:278-296`; flush blocks (routines `:467-475`); MODULES.map skip.
- Logged-out showroom (content demo): `OperationsPipelineShowroom.tsx:7-8,24-25,69,82`.
- Provider: `EntitySelector.tsx:38,61`.

*Do not implement — audit only.*
