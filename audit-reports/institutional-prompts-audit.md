# AUDIT — Replace the 3 pipe prompts (research/audit/fusion) with institutional versions: shared builders + no-drift map (READ-ONLY)

**Branch:** `claude/audit-institutional-prompts` · **Date:** 2026-06-18 · **Mandate:** Truth-First, read-only, cite `file:line`. Labels: EXISTS / SHARED / SEGMENT-PAIR / RISK.

Goal: swap the CONTENT of the 3 pipe prompts while preserving the **no-drift guarantee** (what the UI shows == what fires). Map every builder + its segment pair + the coupling.

---

## HEADLINE — the swap is mechanical + fail-safe; one new input wire needed (audit ← research results)

- Each prompt has a **string builder** (the real text) + a **`*Segments()` builder** (the red-input preview) in the SAME file. The prompts route runs `verifyAgainst(segments, realString)`.
- **`verifyAgainst` is fail-safe:** if `join(segments) !== realString` it returns one neutral segment (the real string, no red) — **never drift, never a break.** So updating string+segments in lockstep KEEPS the red; a slip only loses coloring (cosmetic). — the no-drift constraint is structurally protected.
- **One new wire:** the new audit prompt needs **research results**, but `AuditPromptInput` doesn't carry them today — extend it + pass `project.deep_research_input` in the route. (Fusion already has both research + audit results.)
- **No migration** (content only; columns untouched). **Showroom unaffected** (it renders `ProjectRowView`, not the pipe; the prompts route is auth-gated).

---

## 1. THE 3 STRING BUILDERS (what we replace)

All three are the **SINGLE source** the real call + the preview both consume — grep confirms builders live only in `generateDeepResearch.ts`, `buildAuditPrompt.ts`, `generateProjectTasks.ts`, consumed by `prompts/route.ts` + the real `generate*` calls. **No duplicate prompt strings.** — SHARED.

**#1 Research — `buildResearchPrompt` (`generateDeepResearch.ts:97-111`)** returns `{ systemPrompt, userMessage }`:
- `systemPrompt = SYSTEM_PROMPT` (the institutional instructions — **all template, no interpolation**, shown via "show system" in the UI).
- `userMessage` (`:98-109`) interpolates: `formatNorthStarBlock(northStar)`, `"${projectTitle}"`, `GOAL items:\n${bulletList(goalItems)}`, `PROBLEM items:\n${bulletList(problemItems)}`, `DIAGNOSIS items:\n${bulletList(diagnosisItems)}`, + the closing instruction. **The segmented part is the userMessage only.**

**#2 Audit — `buildAuditPrompt` (`buildAuditPrompt.ts:40-78`)** returns a **single string** (the copy-ready prompt; no system/user split). Interpolates `"${projectTitle}"` (×2, incl. the slug `branchSlug`), `GOAL/PROBLEM/DIAGNOSIS items` (`:50/:53/:56`), and the git/deliverable block. The **whole string** is segmented.

**#3 Fusion — `buildTasksPrompt` (`generateProjectTasks.ts:220-241`)** returns `{ systemPrompt, userMessage }`:
- `systemPrompt = SYSTEM_PROMPT` (institutional task-scoping instructions — template).
- `userMessage` (`:228-239`) interpolates: northStar, title, `GOAL/PROBLEM/DIAGNOSIS items`, + the **realityBlock** (`:224-226`) = `## Deep Research Findings\n${research}` + `## Codebase Audit Findings\n${audit}`. Segmented part = the userMessage.

---

## 2. THE SEGMENT PAIRS + `verifyAgainst` (the no-drift crux)

**The segment builders mirror each string builder's interpolated text into ordered `{text, kind:'template'|'input'}` spans** (red = `'input'`):
- `buildResearchSegments` (`generateDeepResearch.ts:119-132`) — mirrors the research userMessage; inputs = title (`:123`), goals (`:125`), problem (`:127`), diagnosis (`:129`).
- `buildAuditSegments` (`buildAuditPrompt.ts:80-…`) — mirrors the whole audit string; inputs = title, goals, problem, diagnosis, slug.
- `buildTasksSegments` (`generateProjectTasks.ts:249-277`) — mirrors the fusion userMessage; inputs = title (`:266`), goals (`:268`), problem (`:270`), diagnosis (`:272`), research (`:255`), audit (`:260`).

**The coupling — `prompts/route.ts:67-93`:**
```
researchSegments = verifyAgainst(buildResearchSegments(researchInput), research.userMessage)   // :69 (vs userMessage)
auditSegments    = verifyAgainst(buildAuditSegments(auditInput), audit)                         // :73 (vs the whole string)
fusionSegments   = verifyAgainst(buildTasksSegments(fusionInput), fusion.userMessage)           // :87 (vs userMessage)
```
**`verifyAgainst` (`promptSegments.ts:33-35`):** `joinSegments(segments) === real ? segments : [{ text: real, kind: 'template' }]`. — **The no-drift RULE:** if a string builder changes but its segment builder doesn't (or vice versa), `join !== real` → the UI shows the **correct real text with no red coloring** (graceful, never a lie). So the system **cannot drift or break**; the only cost of a mismatch is losing the red. **To KEEP red, change the string builder + segment builder identically, per prompt.** — SEGMENT-PAIR coupling, fail-safe.

> Note: research/fusion segments verify against the **userMessage**, NOT the systemPrompt. So the institutional **SYSTEM_PROMPT can be freely rewritten** (it's all-template, shown plain via "show system") — only the **userMessage** needs a matching segment update. The audit (single string) segments cover the whole thing.

---

## 3. WHAT EACH BUILDER CAN INTERPOLATE

| Prompt | Input type | Has access to |
|---|---|---|
| Research | `ResearchPromptInput` (`generateDeepResearch.ts:89-95`) | title, goalItems, problemItems, diagnosisItems, northStar |
| Audit | `AuditPromptInput` (`buildAuditPrompt.ts:16-21`) | title, goalItems, problemItems, diagnosisItems — **NO research results** |
| Fusion | `TasksPromptInput` (`generateProjectTasks.ts:210-218`) | title, goalItems, problemItems, diagnosisItems, northStar, **deepResearchInput + claudeCodeAuditInput** |

**Dropping problem/diagnosis from the prompt text is SAFE.** The new research/audit prompts just stop interpolating `bulletList(problemItems/diagnosisItems)`. The **columns stay**; nothing depends on them being IN the prompt text (the prompt is consumed by Anthropic + shown to the user — no parser reads specific PROBLEM/DIAGNOSIS lines back). Keep the input-type fields (they're harmless, and `inputsSummary` still counts them — `generateDeepResearch.ts:140-141`, `generateProjectTasks.ts:285`); just remove the text interpolation + the matching segments. — RISK: none (content-only).

**Audit needs research results — the one NEEDED wire.** The new audit ("import research results") must interpolate the research findings, but `AuditPromptInput` doesn't carry them. **Extend `AuditPromptInput` with `deepResearchInput?: string | null`** and have `prompts/route.ts:71` pass `project.deep_research_input` (like fusion `:83`). **No real Anthropic audit call exists** (the audit is copy-ready/manual until Phase 3), so `buildAuditPrompt` is consumed **only** by the preview route + its segments — extending it touches just `buildAuditPrompt.ts` + the route. — NEEDED (small wire).

---

## 4. FUSION HAS BOTH RESEARCH + AUDIT RESULTS

Confirmed: `TasksPromptInput.deepResearchInput` + `.claudeCodeAuditInput` (`generateProjectTasks.ts:216-217`), embedded in the realityBlock (`:224-226`), and the route passes `project.deep_research_input` + `project.claude_code_audit_input` (`prompts/route.ts:83-84`). Fusion's segments already render both as red `'input'` spans (`:255`, `:260`). — EXISTS.

---

## 5. RED-SEGMENT INPUTS PER PROMPT — all cleanly verifiable

| Prompt | Red inputs (new) | Cleanly segmentable? |
|---|---|---|
| Research #1 | title + goals | YES — both are single string interpolations (`{kind:'input', text: title}`, `{kind:'input', text: bulletList(goals)}`); join === userMessage. |
| Audit #2 | title + goals + research-results | YES — once `deepResearchInput` is added to `AuditPromptInput`; research is a single text block → one `'input'` span. |
| Fusion #3 | title + goals + research-results + audit-results | YES — all already in `TasksPromptInput`; the realityBlock segment pattern (`:252-262`) already does this. |

Every new red input is a **plain string interpolation** → expressible as a verified `'input'` segment. No input resists clean segmentation (no computed/conditional spans beyond the already-handled reality block, which uses the `if (research)/if (audit)` push pattern). — SEGMENT-PAIR clean.

---

## 6. RISK / NO-MIGRATION / SHOWROOM

- **No-drift coupling (the hard constraint):** update each `{string builder, segment builder}` **in lockstep**. `verifyAgainst` is the safety net — a mismatch degrades to "no red," never drift/break. **Recommend a tiny check** (assert `join(buildXSegments(sample)) === buildXPrompt(sample).userMessage` for a sample) so the red is verified at build time, like the runtime proof done in the redesign PR.
- **Consumers assuming OLD text:** the real calls (`generateDeepResearch`, `generateProjectTasks`) consume the string builders → they'll **send the new text** (that's the intent). No consumer parses the prompt for specific old phrases; only the model response matters. No hidden coupling. — RISK: none.
- **No migration** — prompt content only; `goal_items/problem_items/diagnosis_items/deep_research_input/claude_code_audit_input` columns untouched.
- **Showroom:** does NOT render these prompts. The showroom renders `ProjectRowView` directly (not `TruthMachineView`/the pipe), and the prompts route is **auth-gated** (logged-out showroom can't fetch). So the new prompt text **never appears in the showroom** — no marketing-copy concern, nothing to update there. — note only.

---

## Explicit answers

**(a) The 3 string builders + shape.** `buildResearchPrompt` (`generateDeepResearch.ts:97-111`, `{systemPrompt, userMessage}`), `buildAuditPrompt` (`buildAuditPrompt.ts:40-78`, single string), `buildTasksPrompt` (`generateProjectTasks.ts:220-241`, `{systemPrompt, userMessage}` + realityBlock). SHARED single sources (no duplicates).

**(b) Segment pairs + verifyAgainst.** `buildResearchSegments` (`:119-132`), `buildAuditSegments` (`buildAuditPrompt.ts:80+`), `buildTasksSegments` (`:249-277`); coupled in `prompts/route.ts:69,73,87` via `verifyAgainst` (`promptSegments.ts:33-35`). **Rule:** change string + segments identically per prompt, else the UI loses red (fail-safe, no drift).

**(c) Interpolation + dropping problem/diagnosis.** Research/Fusion: title/goals/problem/diagnosis(/results); Audit: title/goals/problem/diagnosis. **Dropping problem/diagnosis from the text is safe** (columns stay; nothing reads those lines back) — keep the type fields, remove only the interpolation + matching segments.

**(d) Fusion has both results.** YES — `deepResearchInput` + `claudeCodeAuditInput` (`generateProjectTasks.ts:216-217`, route `:83-84`).

**(e) Red segments verifiable.** YES for all 3 — every new red input is a plain string interpolation; audit needs `deepResearchInput` added to its input type first.

**(f) RISK + migration + showroom.** No-drift is structurally fail-safe; lockstep update keeps red. No migration. Showroom doesn't render these prompts (auth-gated, renders `ProjectRowView`).

**(g) Recommended approach.** **ONE PR** replacing all 3 prompts' content is viable (mechanical, fail-safe), updating each `{string builder + segment builder}` in lockstep + extending `AuditPromptInput` (+ route) for research-results + a build-time `join === real` check per prompt. **OR 3 small PRs (research → audit → fusion)** — the builders are independent (fusion consumes research/audit RESULTS, not their prompt text), so they decouple cleanly and each can be verified green in isolation. **Recommend: 3 PRs** (smaller blast radius, easier to keep each segment pair provably green) — but ONE PR is acceptable given `verifyAgainst`'s safety net. **Hard constraint either way: per prompt, the string builder and its `*Segments()` builder change together so `join === real` stays true (red preserved).**

### Citation index
- String builders: `generateDeepResearch.ts:97-111`; `buildAuditPrompt.ts:40-78`; `generateProjectTasks.ts:220-241` (realityBlock `:224-226`).
- Segment builders: `generateDeepResearch.ts:119-132`; `buildAuditPrompt.ts:80+`; `generateProjectTasks.ts:249-277`.
- Coupling: `prompts/route.ts:67-93`; `promptSegments.ts:24-35` (joinSegments/verifyAgainst).
- Input types: `ResearchPromptInput:89-95`, `AuditPromptInput:16-21` (no research results), `TasksPromptInput:210-218` (has both results).
- Counts (keep fields): `generateDeepResearch.ts:140-141`, `generateProjectTasks.ts:285`.

*Do not implement — audit only.*
