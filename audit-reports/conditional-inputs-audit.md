# AUDIT — Where Problem/Diagnosis render in the detail/pipe inputs, and how to conditionally hide them when empty (READ-ONLY)

**Branch:** `claude/audit-conditional-inputs` · **Date:** 2026-06-19 · **Mandate:** Truth-First, read-only, cite `file:line`. NO fixes. Presentation-only scoping — columns + data model stay (per CLAUDE.md).

---

## THE ANSWER (one line)

Problem/Diagnosis render in **TWO** surfaces — the **default pipe** (`TruthMachineView.tsx:278-285`, the current screenshot) and the **standard view** (`ProjectRowView.tsx:287-294`, the older "2 · PROBLEM / 3 · DIAGNOSIS" screenshot). Both always render the section even when empty (`(none yet)` / `(no content)`). The fix is a **presentation-only conditional** — render each section only when its resolved items are non-empty. **`TruthMachineView` is NOT showroom-shared (safe); `ProjectRowView` IS showroom-shared (ripples to the public demo).**

---

## 1 · WHERE PROBLEM/DIAGNOSIS RENDER

### (i) DEFAULT pipe — `TruthMachineView` — **this is the current screenshot**
Default since PD-3a: `ProjectRow.tsx:110` `const [pipelineMode, setPipelineMode] = useState(true);` and `:419` `if (pipelineMode) { return <TruthMachineView … /> }`. So the pipe is what loads on expand.

The inputs stage renders all three unconditionally — `TruthMachineView.tsx:272-286`:
```
272   {/* 1 · INPUTS */}
273   <Stage n={1} label="inputs" color={STRIPE.inputs}>
274     <div>
275       <div className={sub}>goal</div>
276       <ItemList items={goalItems} legacy={project.goal} />
277     </div>
278     <div>
279       <div className={sub}>problem</div>
280       <ItemList items={problemItems} legacy={project.problem} />
281     </div>
282     <div>
283       <div className={sub}>diagnosis</div>
284       <ItemList items={diagnosisItems} legacy={project.diagnosis} />
285     </div>
286   </Stage>
```
Items derived at `:255-257` via `asStringArray` (`:89-91`). For a title+goals project, `problemItems`/`diagnosisItems` are `[]` and the legacy text is empty → `ItemList` (`:143-154`) hits its empty branch and renders the `problem`/`diagnosis` sub-labels + **`(none yet)`** (`:153`). — **THE CLUTTER on the default surface.**

### (ii) STANDARD view — `ProjectRowView` — **the older "2 · PROBLEM / 3 · DIAGNOSIS" screenshot**
Reachable from the pipe via the "standard view" button (`TruthMachineView.tsx:267-269` → `onExit` → `pipelineMode=false` → `ProjectRow.tsx:450 <ProjectRowView … />`). Read-mode render — `ProjectRowView.tsx:283-294`:
```
283   <div>
284     <div className={labelClass}>1 · goal</div>
285     {renderStructuredField(goalItems, project.goal)}
286   </div>
287   <div>
288     <div className={labelClass}>2 · problem</div>
289     {renderStructuredField(problemItems, project.problem)}
290   </div>
291   <div>
292     <div className={labelClass}>3 · diagnosis</div>
293     {renderStructuredField(diagnosisItems, project.diagnosis)}
294   </div>
```
Items at `:218-223`; `renderStructuredField` (`:233-255`) renders **`(no content)`** (`:254`) when both items array and legacy are empty. `labelClass` (`:210`) is `uppercase`, so `2 · problem` displays as **"2 · PROBLEM"** — matching the older screenshot's numbering.

### Which surface does the user see now?
The **`2 ·`/`3 ·` numbering** in the task description matches **`ProjectRowView`** (the pipe has no per-input numbering — its `sub` labels are bare `problem`/`diagnosis`). But the **current default** is the pipe (`TruthMachineView`). **Honest read:** the screenshot text with `2 · / 3 · / 4 · DESIGN` is the **standard view (`ProjectRowView`)**; the current default surface that ALSO shows empty problem/diagnosis is the **pipe (`TruthMachineView`)**. Both need the conditional; they are different components.

## 2 · THE DATA — how "empty" is determined

- **Pipe** (`TruthMachineView.tsx:255-257`): `asStringArray(project.problem_items)` → filters to strings, `[]` if not an array. Legacy text is `project.problem` (string|null). "Empty" = `problemItems.length === 0` AND `(project.problem ?? '').trim().length === 0` — exactly the `ItemList` `(none yet)` branch (`:151-153`).
- **Standard** (`ProjectRowView.tsx:218-223`): same array derivation; legacy `project.problem`. "Empty" = `renderStructuredField`'s third branch (`:254`).
- **The conditional:** show the section ONLY when resolved items OR legacy text are non-empty. Mirrors the same `resolveItems` notion the routes use (`research/route.ts:35-43`) — items first, legacy fallback, else empty.

## 3 · THE CONDITIONAL APPROACH (presentation-only)

A small local "has content" guard per section:
- **Pipe** — wrap `:278-281` (problem) and `:282-285` (diagnosis) in `{(problemItems.length > 0 || (project.problem ?? '').trim().length > 0) && ( … )}` (and likewise diagnosis). Goal (`:274-277`) stays unconditional (always present).
- **Standard** — wrap `:287-290` and `:291-294` in the same guard.
- **Presentation-only — confirmed:** no column change, no `schema.prisma`/migration, no data write. The JSONB columns (`problem_items`/`diagnosis_items`) and legacy columns stay; the routes/builders are untouched. Only JSX rendering is gated.
- **Goal/title always render** (always present). Only problem/diagnosis (and design — §4) are conditional.

## 4 · DESIGN SECTION — same empty-clutter? (FLAG)

- **Pipe (`TruthMachineView`): NO design stage exists in the inputs** — its stages are `1·inputs / 2·research / …` (grep for `design/Design/DESIGN` in `TruthMachineView.tsx` → none in the input render). So the pipe has **no `(no design)` clutter** to hide. Nothing to do on the default surface for design.
- **Standard (`ProjectRowView.tsx:295-317`): YES** — renders `4 · design` with an empty state **`(no design)`** (`:315`) when `(project.design ?? '').trim().length === 0`. Same empty-clutter pattern as the older screenshot.
  - **FLAG:** design already has an internal content check (`:298`, `:308`) for the "view AI design reasoning" button, but the **label `4 · design` + `(no design)` line still render**. To match the title+goals clean read, the whole `4 · design` block (`:295-317`) could be wrapped in the same `(project.design ?? '').trim().length > 0` guard. **Recommend including it** for the standard view only (the pipe has no design section).

## 5 · SHOWROOM / RISK

- **`TruthMachineView` is NOT showroom-shared** — the public showroom (`showroom/ProjectsPipelineShowroom.tsx:28,236`) renders **`ProjectRowView`** only; it never imports `TruthMachineView`. **Editing `TruthMachineView` is showroom-safe — zero ripple.**
- **`ProjectRowView` IS showroom-shared** — `ProjectsPipelineShowroom.tsx:236 <ProjectRowView … />` with `demoData.ts` props. A conditional render there **ripples to the public demo**. The demo project (`demoData.ts`) carries problem/diagnosis content, so a "show only if non-empty" guard leaves the demo **unchanged** (data present → still shows). But the ripple must be noted, and the demo should be eyeballed so the showroom still reads as intended.
- **No migration, presentation-only — confirmed** (repo holds no `DATABASE_URL`; nothing here touches the DB or schema).

---

## Explicit answers (file:line)

**(a) Where problem/diagnosis render + which the user sees.** Two places: **pipe** `TruthMachineView.tsx:278-285` (current default surface, PD-3a `ProjectRow.tsx:110/419`) and **standard** `ProjectRowView.tsx:287-294` (the older `2 · / 3 ·` screenshot). The current default the user lands on is the **pipe**; the numbered screenshot is the **standard view**. Both render empty sections.

**(b) How "empty" is determined.** Resolved-items check: pipe `asStringArray(project.problem_items)` empty `[]` + `(project.problem ?? '').trim()` empty → `ItemList (none yet)` (`TruthMachineView.tsx:151-153`); standard `renderStructuredField (no content)` (`ProjectRowView.tsx:254`).

**(c) The conditional guard per location.** Wrap each problem/diagnosis block in `{(items.length > 0 || (legacy ?? '').trim().length > 0) && (…)}` — pipe `:278-285`, standard `:287-294`. Goal stays unconditional. Presentation-only; no column/data/migration change.

**(d) Design section.** Pipe has **no** design section (nothing to hide). Standard `ProjectRowView.tsx:295-317` shows `4 · design (no design)` empty-clutter — **FLAG: recommend the same conditional** (wrap `:295-317` in `(project.design ?? '').trim().length > 0`), standard view only.

**(e) Showroom risk + no-migration.** `TruthMachineView` not showroom-shared → **safe**. `ProjectRowView` IS showroom-shared (`ProjectsPipelineShowroom.tsx:236`) → ripple noted; demo carries data so it still shows. **No migration — presentation-only.**

**(f) Recommended fix.** Conditional render (hide when empty) per location: **pipe `TruthMachineView.tsx:278-285`** (showroom-safe, the default surface — primary) and **standard `ProjectRowView.tsx:287-294`** (showroom-shared — note ripple). Include the **design block `ProjectRowView.tsx:295-317`** in the standard view's conditional (flagged). Columns/data/migration untouched. **SMALL, presentation-only.** Suggest splitting: one PR for the pipe (safe, primary) and a separate one for the showroom-shared standard view + design.

### Citation index
- Default = pipe: `ProjectRow.tsx:110` (`pipelineMode=true`), `:419` (`if (pipelineMode) <TruthMachineView/>`), `:450` (`<ProjectRowView/>` after `onExit`).
- Pipe render: `TruthMachineView.tsx:255-257` (items), `:272-286` (inputs stage), `:143-154` (`ItemList` empty `(none yet)`), `:89-91` (`asStringArray`).
- Standard render: `ProjectRowView.tsx:218-223` (items), `:283-294` (goal/problem/diagnosis), `:233-255` (`renderStructuredField` empty `(no content)`), `:295-317` (design `(no design)`), `:210` (`labelClass` uppercase).
- Showroom: `showroom/ProjectsPipelineShowroom.tsx:28,236` (renders `ProjectRowView`, never `TruthMachineView`).

*Do not implement — audit only.*
