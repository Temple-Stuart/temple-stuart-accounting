# Projects tab — mount real CRUD on homepage (mirror Routines HB-4e) (READ-ONLY AUDIT)

**Mandate:** Truth-first, read-only, every claim cites file:line. No fixes. Labels:
EXISTS / EXISTS-BUT-UNUSED / MISSING / REUSABLE / RISK.

**Headline:** Projects is in the **exact pre-HB-4e state Routines was** — the homepage Projects tab
renders `OperationsPipelineShowroom` (the fetch-free "Maria's food truck" demo) **for everyone, no
auth branch** (`ModuleLauncher.tsx:278-282`), so a logged-in user **never gets the real builder on
the homepage** and must go to the retired `/operations/projects` app to actually manage projects.
The **mount fix is identical to Routines HB-4e**: the real CRUD (`SectionD_ProjectBacklog`) is
self-contained but coupled only to `OperationsEntityProvider` (self-fetching) — wrap-and-mount, no
extraction; the logged-out teaser (`home/ProjectCreateForm`) already exists; gate the Live-demo
tag. **The one big difference: the restyle (HB-4e-style equivalent) is LARGE** — the projects CRUD
spans **9 components with 103 `font-mono`** (vs Routines' 3 files / 24), so PR-Projects-style is a
much heavier lift than PR-HB-4e-style was.

---

## 1. CURRENT PROJECTS TAB — demo for everyone, no auth branch

`ModuleLauncher.tsx:278-282`:
```
if (m.key === 'projects') {
  // PR-A-Tabs: the Projects tab keeps the existing Operations project showroom …
  // Project → Day → Script, fetch-free, every action → onRequireAuth.
  return <OperationsPipelineShowroom onRequireAuth={onRequireAuth} />;
}
```
**No `authed` branch** — identical to the routines placeholder before HB-4e. Both authed and
logged-out users get the showroom. The **Live-demo tag** (`:472`) shows for projects **ungated**:
`m.key === 'routines' && authed === true ? '' : (m.key === 'projects' || m.key === 'routines' ?
'Live demo · log in to use' : …)` — routines was gated off for authed (HB-4e), **projects was
not**, so an authed user still sees "Live demo · log in to use." Projects also still renders inside
the **MODULES.map purple-band card** (`:451-475`) — it was NOT pulled out to a flush section like
Calendar/Travel/Routines. — EXISTS / RISK, `ModuleLauncher.tsx:278-282, 472, 451-475`.

## 2. THE DEMO COMPONENT — fetch-free showroom

`OperationsPipelineShowroom` (`src/components/workbench/operations/showroom/OperationsPipelineShowroom.tsx`)
— *"static demo seed, and EVERY action … is bound to one inert `lock` handler that does ONLY
onRequireAuth()"* (`:11-12`). The lock: `const lock = () => onRequireAuth()` (`:58`); every
callback (`onDateChange`, `onGenerate`, `onSave`, …) → `lock` (`:71,95-97`). It renders
`ProjectsPipelineShowroom` (the "Maria's food truck" project) + day-calendar + script views from a
hardcoded `demoData` seed (`:23-32`). **No fetch, no real data.** — EXISTS (the demo), fetch-free
confirmed.

## 3. THE REAL PROJECTS CRUD — `SectionD_ProjectBacklog`

`app/operations/projects/page.tsx` = `<SectionD_ProjectBacklog />` (the "Bridgewater 5-step scoping
list"). `SectionD_ProjectBacklog.tsx`:
- consumes **`useOperationsEntity()`** (`:20,26`) → `{ entities, selectedEntityId }` — the SAME
  context dependency as `SectionE_Routines` (provided by `OperationsEntityProvider`).
- **self-fetches** the project list — `const res = await fetch(url)` (`:55`).
- mounts **`ProjectRow`** + **`ProjectCreateForm`** (`:21-22`); `ProjectCreateForm` takes
  `entities`, `defaultEntityId`, `onCreated`, `onCancel` (`:54-63`) — same prop shape as the
  routine create form. CRUD self-contained. — EXISTS / REUSABLE.

## 4. REUSE PATH — mount-as-is (provider wrap), identical to Routines

`SectionD_ProjectBacklog` needs only the `OperationsEntityProvider` context (which **self-fetches
`/api/entities`**, `EntitySelector.tsx:61`). So the mount is verbatim:
`<OperationsEntityProvider><SectionD_ProjectBacklog /></OperationsEntityProvider>` — **no
extraction, no CRUD rewrite**, exactly the HB-4e-mount pattern. `/operations/projects` keeps working
(it gets the provider from its own layout). — REUSABLE, `SectionD_ProjectBacklog.tsx:20,26` +
`EntitySelector.tsx:38,61`.

## 5. LOGGED-OUT TEASER — already exists

`home/ProjectCreateForm.tsx` EXISTS (default export, `onRequireAuth` prop, fetch-free: *"calls
onRequireAuth and returns. There is NO generate-design / generate-tasks / any …"* `:15,34,51`) —
the direct analog of `home/RoutineCreateForm`. So logged-out → this teaser; the real builder is
authed-only. — EXISTS-BUT-UNUSED (the teaser isn't mounted in the tab today; the showroom is).

## 6. STYLING — terminal, needs the HB-4e-style treatment (but LARGER)

`SectionD_ProjectBacklog` is terminal-styled exactly like `SectionE_Routines` was pre-HB-4e:
- card wrapper `bg-white rounded border border-border shadow-sm p-5` (`:86`),
- `font-mono` header `font-mono text-sm font-bold tracking-wide` (`:88`),
- `font-mono` labels/states (`:91,117,135,137`).

**The blast radius is far larger than Routines.** `font-mono` across the real projects CRUD tree
(excluding the showroom): **9 files, 103 occurrences** —
`SectionD_ProjectBacklog (5)`, `projects/ProjectRowView (24)`, `projects/TaskRowView (16)`,
`projects/ListManager (14)`, `projects/ProjectCreateForm (13)`, `projects/DependencyListView (9)`,
`projects/AITaskPreview (9)`, `projects/TaskListView (8)`, `projects/EvolutionTimelineView (5)`.
Compared to Routines' 3 files / ~24. The homepage contract (flush/sans, `HubBudgetSection` +
Travel) is the target (same as HB-4e-style). — RISK (LARGE restyle), the 9 files above.

## 7. THE "/operations KICK" — there is NO real homepage surface

The grep for `/operations` navigation in the showroom tree returns **only imports**, no `href`/
`router.push` to `/operations`. So the "kick" is **structural, not a stray link**: the projects
renderBody has **no authed branch** (§1), so a logged-in user's clicks hit the showroom's `lock`
→ `onRequireAuth()` (`:58`) — which for an already-authed user is a dead-end — and the **only place
real project work exists is the retired `/operations/projects` app** (`SectionD_ProjectBacklog`).
Mounting the real CRUD on the homepage (§4) eliminates the need to leave for `/operations`. —
RISK (dead-end demo for authed), `OperationsPipelineShowroom.tsx:58` + `ModuleLauncher.tsx:278-282`.

---

## Explicit answers

**(a) Current structure + why authed users get the demo + the kick.** `ModuleLauncher.tsx:278-282`
returns `<OperationsPipelineShowroom>` for everyone (no `authed` branch); the Live-demo tag (`:472`)
is ungated for projects; every showroom click → `lock` → `onRequireAuth()`
(`OperationsPipelineShowroom.tsx:58`). There is **no real projects surface on the homepage**, so
authoring lives only at the retired `/operations/projects` — that's the "kick." Same shape Routines
had before HB-4e.

**(b) Real CRUD location + components + self-containment.** `app/operations/projects/page.tsx` →
`SectionD_ProjectBacklog` (uses `useOperationsEntity` `:20,26`; self-fetches `:55`; mounts
`ProjectRow` + `ProjectCreateForm` `:21-22`). Self-contained on data, **coupled only to
`OperationsEntityProvider`** (the same single dependency as `SectionE_Routines`).

**(c) Reuse path.** **Mount-as-is** — `<OperationsEntityProvider><SectionD_ProjectBacklog
/></OperationsEntityProvider>`; the provider self-fetches entities (`EntitySelector.tsx:61`). No
extraction, no CRUD rewrite — IDENTICAL to HB-4e-mount.

**(d) Logged-out teaser.** **Already exists** — `home/ProjectCreateForm.tsx` (fetch-free, →
onRequireAuth). Mount it for logged-out; authed → the real builder; resolving → nothing. Mirrors
Routines exactly.

**(e) Styling gap.** **Yes — needs the HB-4e-style treatment, but LARGE.** `SectionD` + 8 project
sub-components are terminal-styled (`font-mono`, `bg-white rounded … shadow-sm p-5` cards) — **9
files, 103 `font-mono`** vs Routines' 3 files / 24. Plus the Projects tab must be **pulled out of
the purple-band card into a flush section** (like Travel/Routines) and its header/pills/dates
aligned to the contract. Watch for **legit code values to keep mono** (any raw RRULE/JSON/ID
displays, mirroring `RoutineRow:267`).

**(f) Recommended PR sequence (mirror Routines).**
1. **PR-Projects-mount (SMALL-MED, no migration).** In `renderBody` `m.key==='projects'`: `authed
   === true` → `<OperationsEntityProvider><SectionD_ProjectBacklog/></OperationsEntityProvider>`;
   `authed === false` → `<HomeProjectCreateForm onRequireAuth={onRequireAuth}/>` (the existing
   teaser); `null` → nothing. Pull Projects out of MODULES.map into a **flush section** (mirror
   Travel `:389-444`) and **gate the `:472` Live-demo tag off for authed projects** (extend the
   routines condition). Reuses the showroom for logged-out (or the teaser). Ships the working
   builder immediately; it'll read terminal until the style PR.
2. **PR-Projects-style (LARGE).** Restyle the 9 components (103 `font-mono` → sans; drop the
   `shadow-sm p-5` cards; header → `text-lg font-bold text-brand-purple`; pills → Travel's
   `rounded-full bg-X/10 font-medium`; humanize any ISO dates) to the homepage contract — the same
   work HB-4e-style + HB-4e-style-2 did for Routines, but ~3× the surface. **Recommend SPLITTING**
   into sub-PRs (e.g. 4a: SectionD + ProjectRowView + ProjectCreateForm; 4b: TaskRowView/
   TaskListView/ListManager; 4c: Dependency/Evolution/AITaskPreview) to keep each reviewable. Keep
   any genuine code-value displays mono (the `RoutineRow:267` precedent). `/operations/projects`
   inherits the restyle (shared components — same "restyle both" decision as Routines).

**Honest sizing:** mount = SMALL-MED (one renderBody branch + a flush section + tag gate, exactly
HB-4e-mount). Style = **LARGE** (9 files, 103 mono, + cards/header/pills/dates) — materially bigger
than HB-4e-style; split it. Net: same arc as Routines, but the style half is the heavy part.

### Citation index
- Projects tab render + tag: `ModuleLauncher.tsx:278-282, 472, 451-475`; flush refs (Travel)
  `:389-444`.
- Showroom (demo, fetch-free, lock): `OperationsPipelineShowroom.tsx:11-12, 58, 71, 95-97, 23-32`.
- Real CRUD: `app/operations/projects/page.tsx`; `SectionD_ProjectBacklog.tsx:20,26,55,21-22,86,88,
  91,117,135,137`; `projects/ProjectCreateForm.tsx:54-63`.
- Provider: `EntitySelector.tsx:38,61`. Teaser: `home/ProjectCreateForm.tsx:15,34,51`.
- Restyle blast radius (9 files / 103 mono): `SectionD_ProjectBacklog`, `projects/ProjectRowView`,
  `TaskRowView`, `ListManager`, `ProjectCreateForm`, `DependencyListView`, `AITaskPreview`,
  `TaskListView`, `EvolutionTimelineView`.

*Do not implement — audit only.*
