# AUDIT — Why the research prompt (#1) won't run on a pure title+goals project (READ-ONLY)

**Branch:** `claude/audit-research-not-running` · **Date:** 2026-06-18 · **Mandate:** Truth-First, read-only, cite `file:line`. Find the REAL reason — no assumptions.

---

## THE BUG (one line)

**The research route still has the OLD strict gate that requires problem + diagnosis** — `[id]/research/route.ts:69` — which PD-Clean relaxed on the *other* routes but **missed this one**. A pure title+goals project has empty `problem_items`/`diagnosis_items` → `resolveItems` returns `null` → the route returns **400 before any Anthropic call**. The builder is fine; it's never reached.

---

## 1. THE TRIGGER

- **Button → handler:** `ProjectRow.tsx:255` `handleRunResearch` → `POST /api/operations/projects/${project.id}/research` (`:259`). On `!res.ok` it sets `researchError = body?.message` (`:264`), surfaced in the pipe UI (`:430-431`, `:491-497`). — EXISTS.
- The trigger fires correctly; the failure is server-side.

## 2. THE ROUTE — the gate PD-Clean missed (the bug)

`src/app/api/operations/projects/[id]/research/route.ts`:
```
65   const goalItems = resolveItems(project.goal_items, project.goal);
66   const problemItems = resolveItems(project.problem_items, project.problem);
67   const diagnosisItems = resolveItems(project.diagnosis_items, project.diagnosis);
68
69   if (!goalItems || !problemItems || !diagnosisItems) {
70     return NextResponse.json(
71       {
72         error: 'Validation',
73         message: 'project must have at least one goal item, one problem item, and one diagnosis item before running research',
74       },
75       { status: 400 }
76     );
77   }
```
`resolveItems` (`:34-44`) returns **`null`** when the JSONB array is empty AND the legacy text is empty. For a pure title+goals project, `problem_items = []` and `project.problem = null` → `resolveItems` → `null`. So `!problemItems` is **true** → the route **returns 400** at `:69-76`, **before** `generateDeepResearch({…})` at `:83`. — **THE STOP POINT.**

**PD-Clean relaxed the other 4 gates but NOT this one.** The relaxed sibling, `[id]/generate-tasks/route.ts`, shows the corrected pattern:
```
63   const problemItems = resolveItems(project.problem_items, project.problem) ?? [];
64   const diagnosisItems = resolveItems(project.diagnosis_items, project.diagnosis) ?? [];
66   if (!goalItems) {                       // ← only GOAL required
70     message: 'project must have at least one goal item before generating tasks',
```
**Proof the research route is the lone holdout:** grep for the strict message `"one problem item"` across `src/app/api/**` returns **only** `[id]/research/route.ts`. PD-Clean (#1028) touched create POST + `ai/generate-design` + `ai/generate-tasks` + `[id]/generate-tasks` — **`[id]/research` was not in its scope.** — **CONFIRMED: the prime suspect, the un-relaxed research gate.**

## 3. THE BUILDER — clean (not the cause)

`buildResearchPrompt` after PROMPT-1 (`generateDeepResearch.ts:29-35`):
```
33   const userMessage = `Project: ${input.projectTitle}\nGoals:\n${bulletList(input.goalItems)}${RESEARCH_BODY}`;
```
It references **only** `projectTitle` + `goalItems`. `problemItems`/`diagnosisItems` remain on `ResearchPromptInput` (`:24-25`, passed by the route) but are **never referenced** in the builder or its segments → no `.map`-on-undefined, no throw, graceful on empty. **The builder is clean — but it is never reached** because the route 400s first. — NOT the cause.

## 4. THE ACTUAL FAILURE

- **(a) not (b) not (c):** the research **does not fire at all** — a **400 before the Anthropic call** (route `:69-76`). It does not error inside the builder, and it does not fire-and-write-nothing.
- **What the user sees — NOT silent:** `handleRunResearch` sets `researchError` to the 400 body message (`ProjectRow.tsx:264`), so the pipe's research stage shows the red error: **"project must have at least one goal item, one problem item, and one diagnosis item before running research."** A confusing demand for problem/diagnosis the create form no longer collects.
- **Auth intact (not the cause):** `getVerifiedEmail` + ownership-scoped find run first (route `:54-64`) and pass for the owner — the 400 is the *validation* gate after auth, not an auth failure.

## 5. THE FIX DIRECTION (identified, not implemented)

**Relax the research route's gate to require only `goalItems`** — the exact change PD-Clean already applied to `[id]/generate-tasks`:
- `research/route.ts:66-67` → `resolveItems(...) ?? []` (default empty, never null).
- `research/route.ts:69` → `if (!goalItems)` (require only goal); update the message at `:73` to "at least one goal item."
- The builder already ignores problem/diagnosis, so passing `[]` is harmless; the prompt degrades to goal-only (the institutional research prompt doesn't reference them anyway).
- Keep auth + ownership + the write-to-`deep_research_input` untouched.

This is a **gate relaxation only** — no builder change, no migration, no prompt-content change. It brings `[id]/research` into parity with the 4 routes PD-Clean already relaxed.

---

## Explicit answers

**(a) The path + where it stops.** Button `ProjectRow.tsx:255` → POST `[id]/research` (`:259`) → route auth (`:54-64`, passes) → resolve items (`:65-67`) → **STOP: 400 at `:69-76`** (`if (!goalItems || !problemItems || !diagnosisItems)`). Never reaches `generateDeepResearch` (`:83`) / the Anthropic call.

**(b) A gate requiring problem/diagnosis that PD-Clean missed?** **YES** — `research/route.ts:69`. PD-Clean relaxed create + generate-design + generate-tasks(×2) but **not** the research route; grep confirms `[id]/research` is the only route still carrying the strict "one problem item" gate.

**(c) Leftover problem/diagnosis in buildResearchPrompt that throws?** **NO** — the builder uses only title+goals (`generateDeepResearch.ts:33`); problem/diagnosis are unreferenced. The builder is clean; it's just never reached.

**(d) What the user experiences.** **Not silent** — a red error in the research stage: "project must have at least one goal item, one problem item, and one diagnosis item before running research" (the 400 message via `ProjectRow.tsx:264`).

**(e) Fix direction.** **Relax the research route's gate** to require only `goalItems` (default problem/diagnosis to `[]`), identical to `[id]/generate-tasks:63-66`. Gate-only; no builder/migration/prompt change.

### Citation index
- Trigger: `ProjectRow.tsx:255-264` (handler + error surfacing).
- The bug: `[id]/research/route.ts:34-44` (resolveItems→null on empty), `:65-67` (resolve), `:69-76` (the strict gate → 400), `:83` (the unreached Anthropic call).
- Relaxed contrast: `[id]/generate-tasks/route.ts:63-64` (`?? []`), `:66-70` (`if (!goalItems)`).
- Builder clean: `generateDeepResearch.ts:24-25` (type fields), `:33` (only title+goals).
- PD-Clean scope: merge #1028; grep "one problem item" → only `[id]/research/route.ts`.

*Do not implement — audit only.*
