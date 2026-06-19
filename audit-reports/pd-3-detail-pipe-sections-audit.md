# AUDIT — PD-3: project detail → pipe-step sections + the request timeline (READ-ONLY)

**Branch:** `claude/audit-pd-3-detail-pipe-sections` · **Date:** 2026-06-18 · **Mandate:** Truth-First, read-only, cite `file:line`. Labels: EXISTS / REUSABLE / NEEDED / VESTIGIAL / RISK.

Scope PD-3: turn the project DETAIL into **one clean section per pipe step** (the `TruthMachineView` layout), decide the fate of the empty Problem/Diagnosis/Design sections, and add the **run-grouped request timeline**.

---

## HEADLINE — the pipe IS the target; make it the default detail, conditionally show problem/diagnosis/design, add the timeline. No migration.

- The clean pipe-step layout **already exists** as `TruthMachineView` (colored `Stage` stripes + red-segment prompts). PD-3 = **make it the default detail** (drop the "⊞ pipeline view" toggle) and **add the request-timeline stage** (reuse `EvolutionTimelineView`).
- The prompts **still interpolate problem + diagnosis** — but for new pure-title+goals projects they're **always empty → "(none provided)"**. Recommendation: **conditionally render problem/diagnosis/design (show only when non-empty)** — new projects show goal-only (clean), old projects keep their data. Display-only.
- **No migration** — reshaping existing data + views; the goal-per-request provenance is PD-4/separate.

---

## 1. DO THE PIPE PROMPTS STILL USE PROBLEM/DIAGNOSIS? (the key decision)

**All three builders STILL interpolate problem AND diagnosis** (string + segments):
- Research: `generateDeepResearch.ts:103-107` (`PROBLEM items:\n${bulletList(problemItems)}` … diagnosis) + segments `:126-129`.
- Fusion: `generateProjectTasks.ts:233-237` + segments `:269-272`.
- Audit: `buildAuditPrompt.ts:52-56` + segments `:107-114`.

**Empty behavior:** `bulletList([])` → `'(none provided)'` (`generateDeepResearch.ts:58-59` etc.). The create form is now **pure title+goals** (PD-Strip), so for **new projects problem/diagnosis are always empty** → the prompts render "PROBLEM items:\n(none provided)". The pipe **technically uses them, but they're always empty for new projects** → **VESTIGIAL-in-practice for new projects.** Old projects may still hold real problem/diagnosis (columns kept), and the pipe still reads them.

**VERDICT:** **Don't hard-drop — conditionally render.** Show Problem / Diagnosis / Design in the detail **only when non-empty**:
- New project → empty → **hidden** (the clean goal-only pipe the user wants).
- Old project → filled → **still shown** (no data loss, the pipe still grounds on them).
This is display-only (no column change, no prompt change). — **Recommend conditional render.**

---

## 2. THE CURRENT DETAIL LAYOUT (what we transform)

`ProjectRowView` read view (`:281-405`, `{expanded && !editing}`):
- `1 · goal` (`:284`, `renderStructuredField`)
- `2 · problem` (`:288`) — **EMPTY for new projects**
- `3 · diagnosis` (`:292`) — **EMPTY for new projects**
- `4 · design` (`:297-316`) — **EMPTY for new projects** ("(no design)" `:315`)
- `reality inputs` (research input `:326` + claude code audit input `:351`) — always relevant (pipe inputs)
- `readViewAiActions` (`:375`) = the **"⊞ pipeline view (Truth Machine)" toggle** (passed by `ProjectRow`)
- `5 · execute (tasks)` (`:377-378`, `taskSection`) — always relevant
- `evolution (trajectory by AI re-run)` (`:382-391`, `evolutionSection`, toggle-gated) — always relevant
- `6 · dependencies` (`:394`), est. minutes/cost (`:399-404`)

**Empty-clutter for new projects:** `2·problem`, `3·diagnosis`, `4·design`. **Always-relevant:** `1·goal`, reality inputs, tasks, evolution, dependencies.

**Relationship:** `ProjectRowView` (gray detail) vs `TruthMachineView` (clean pipe behind the `readViewAiActions` toggle). `ProjectRow` renders `if (pipelineMode) <TruthMachineView/> else <ProjectRowView/>`, and the toggle button sets `pipelineMode=true`.

---

## 3. SHOULD THE DETAIL BECOME THE PIPE-STEP LAYOUT? (recommend)

**YES — make `TruthMachineView` the default detail, drop the toggle.** It already is the clean pipe-step layout:
- `Stage n={1} label="inputs"` (`TruthMachineView.tsx:273`) — goal/problem/diagnosis via `ItemList` (`:276/:280/:284`).
- `2·research`, `3·audit` (`:333`), `4·fusion→tasks`, `5·plan` (`:420`, `taskSection`).
- Each stage = a white card with a **colored `border-l-4` left-stripe** (the `Stage` component + `STRIPE` map) + red-segment prompts. — **EXISTS / REUSABLE (it IS the target).**

**Minimal path:** `ProjectRow` defaults `pipelineMode = true` (the pipe IS the detail) and **remove the "⊞ pipeline view" toggle** (`readViewAiActions`). The gray `ProjectRowView` read sections become redundant for the authed app; **keep `ProjectRowView`'s EDIT mode** reachable (via the "standard view" exit on `TruthMachineView`) so fields stay editable. — **Recommend: default-to-pipe + drop toggle; keep edit.**

---

## 4. PIPE-STEP SECTIONS + THE REQUEST TIMELINE (reusable vs needed)

**Pipe-step sections — REUSABLE:** the `Stage` component (colored left-stripe + small-caps label + badge) and the `STRIPE` palette in `TruthMachineView.tsx` are exactly the "one clean section per pipe step" the user likes. No new section framework needed.

**The request timeline — REUSABLE engine, NEEDED as a stage:**
- `EvolutionTimelineView` **already groups tasks by run** into ordered versions (`:122` "N re-run(s)", per-version cards with `v{n}`, "added X tasks", per-task status). Fed by `evolution/route.ts` `versions[]` (grouped by `source_ai_usage_id`). — EXISTS / REUSABLE.
- `TruthMachineView` does **NOT** currently include the timeline (its stages are inputs/research/audit/fusion/plan only — no evolution). So **adding a "requests" Stage that renders `EvolutionTimelineView` is NEEDED** (new stage; `ProjectRow` already has the `EvolutionTimeline` container to pass in, like `taskSection`). — NEEDED (small wiring + one Stage).
- **Copy:** the timeline says "re-run"/"version"; the user wants **"request"** ("request 1 origin → request N"). A "re-run"→"request" relabel in `EvolutionTimelineView` (`:122`, `:138` v-badge, etc.) is a small copy change. — Optional polish.

---

## 5. EMPTY-STATE (0 runs)

`EvolutionTimelineView` **already handles 0 runs**: `if (totalTasks === 0) → "no tasks yet — generate tasks to start this project's trajectory."` (`:111-114`). The tasks Stage (`taskSection` = `TaskList`) has its own empty state too. For PD-3, **relabel to the request framing** — e.g. "no requests yet — run the pipe to generate your first plan." — EXISTS (relabel only).

---

## 6. SHOWROOM / RISK

- **`ProjectRowView` feeds the showroom** (`ProjectsPipelineShowroom` renders `ProjectRowView` fully expanded with locked handlers). **`TruthMachineView` is NOT in the showroom.**
- **If PD-3 only changes `ProjectRow`'s default to `TruthMachineView`** (and does **not** edit `ProjectRowView`'s read sections), the **showroom is untouched** — it keeps rendering `ProjectRowView`'s gray detail. The authed app shows the pipe; the showroom shows the old detail → an *inconsistency, not a breakage*. — **Lowest-risk recommendation: don't edit `ProjectRowView`'s read sections; flip `ProjectRow`'s default. Showroom safe.**
- **If you want showroom parity**, update `ProjectsPipelineShowroom` to render `TruthMachineView` (with the locked `lock` handlers + demo prompts) — a separate, optional showroom PR. — RISK only if you choose to edit the shared `ProjectRowView`.
- **Conditional problem/diagnosis/design** (§1) would live in `TruthMachineView`'s inputs Stage (`:280/:284`) — `TruthMachineView` is **not** showroom-shared, so that change is showroom-safe.
- **No migration** — the timeline + pipe-sections reshape existing data (`operations_project_tasks` + `source_ai_usage_id` runs) and existing views. The goal-per-request provenance ("you asked X this run") is **PD-4/separate** (needs a migration; not PD-3).

---

## Explicit answers

**(a) Prompts use problem/diagnosis → drop the sections?** All three builders interpolate them (`generateDeepResearch.ts:103-107`, `generateProjectTasks.ts:233-237`, `buildAuditPrompt.ts:52-56`), but they're **always empty for new projects → "(none provided)"**. **Recommend conditionally rendering them (show only when non-empty)** — new projects hide them (clean), old projects keep them (no data loss). Not a hard drop, not a prompt/column change.

**(b) Current detail + empty vs relevant.** `ProjectRowView:281-405`: empty-clutter for new = `2·problem`/`3·diagnosis`/`4·design`; always-relevant = `1·goal`, reality inputs, `5·tasks`, evolution, dependencies.

**(c) Detail becomes the pipe layout, drop the toggle?** **YES** — `TruthMachineView` is already the clean pipe (`Stage` stripes + red prompts); make it `ProjectRow`'s default detail (`pipelineMode=true`), drop the "⊞ pipeline view" toggle, keep `ProjectRowView` **edit** mode reachable via "standard view".

**(d) Reusable.** The colored-stripe pipe stages = `TruthMachineView`'s `Stage` + `STRIPE` (reusable, the target). The request timeline = `EvolutionTimelineView` (`:122`, run-grouped versions) — reusable engine; **needs** a new "requests" Stage in `TruthMachineView` to host it.

**(e) Empty-state.** `EvolutionTimelineView:111-114` already shows a 0-run empty state; **relabel to "no requests yet — run the pipe."**

**(f) Showroom + migration.** Lowest-risk: change only `ProjectRow`'s default (don't touch `ProjectRowView`'s read sections) → **showroom untouched**. Conditional problem/diagnosis lives in `TruthMachineView` (not showroom-shared) → safe. **No migration** (goal-per-request provenance is PD-4).

**(g) Recommended BUILD sequence:**
1. **PD-3a — pipe becomes the default detail (SMALL).** `ProjectRow`: default `pipelineMode=true`; remove the "⊞ pipeline view" toggle (the `readViewAiActions` button); keep `ProjectRowView` edit reachable via `TruthMachineView`'s "standard view". **Showroom untouched.**
2. **PD-3b — conditional inputs (SMALL).** In `TruthMachineView`'s `1·inputs` Stage, render Problem/Diagnosis (and a Design line) **only when non-empty** (`:280/:284`). New → goal-only; old → full. No data change. Showroom-safe.
3. **PD-3c — request timeline stage (MED).** Add a "requests" `Stage` to `TruthMachineView` rendering `EvolutionTimelineView` (pass the existing `EvolutionTimeline` container from `ProjectRow`, like `taskSection`). Relabel "re-run"→"request". Run-grouped history, reuses the evolution route.
4. **PD-3d — empty-state copy (SMALL).** "no requests yet — run the pipe" in the timeline (relabel `EvolutionTimelineView:114`).
5. **(optional) Showroom parity PR** — render `TruthMachineView` in `ProjectsPipelineShowroom` for marketing consistency (separate, only if wanted).
**No migration anywhere in PD-3.**

### Citation index
- Prompts use problem/diagnosis: `generateDeepResearch.ts:103-107,126-129`; `generateProjectTasks.ts:233-237,269-272`; `buildAuditPrompt.ts:52-56,107-114`; empty → `bulletList` `generateDeepResearch.ts:58-59`.
- Current detail: `ProjectRowView.tsx:281-405` (goal `:284`, problem `:288`, diagnosis `:292`, design `:297-316`, reality inputs `:319-372`, toggle `:375`, tasks `:377-378`, evolution `:382-391`, deps `:394`, est `:399-404`).
- Pipe stages: `TruthMachineView.tsx:273 (Stage inputs), 280/284 (problem/diagnosis ItemList), 333, 420`.
- Timeline: `EvolutionTimelineView.tsx:111-114 (empty), 122 (re-run grouping)`; `evolution/route.ts` versions.

*Do not implement — audit only.*
