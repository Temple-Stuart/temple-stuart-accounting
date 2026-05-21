PR-OPS-5.14 PHASE 1 AUDIT REPORT
================================

BRANCH STATUS
- main top 3: `5b9afab` (merge #560 PR-Ops-5.13 routine-capture-gap-audit) → `b528629` (5.13 audit commit) → `a26ccd7` (merge #559 PR-Ops-5.12 daily-plan-list audit).
- **PR-Ops-5.13 confirmation:** the AUDIT branch (commit `b528629`) is merged into main via PR #560. The **5.13 Phase 2 IMPLEMENTATION** (commit `15e137b` on branch `claude/pr-ops-5.13-routine-cost-capture`) is **NOT YET MERGED** into main per `git log main --oneline | grep 5.13` — only the audit landed. Phase 1 here is read-only and orthogonal to the 5.13 implementation status, so proceeding. Flag for Alex's awareness.
- current branch: `claude/pr-ops-5.14-scoping-prefill-audit`

A. PREFILL STRINGS LOCATION

- **ListManager file:** `src/components/workbench/operations/projects/ListManager.tsx` (259 lines).
- **Header doc (`:1-18`) describes the design intent:**
  > "Used by project goal/problem/diagnosis fields. Each item is one verb-prefixed line (e.g., 'I WANT to get loans approved'). Storage: items stored verbatim with verb prefix included (per PR-Ops-3.7 architectural decision B). Add-item input pre-fills the verb prefix to enforce institutional grammar discipline while keeping storage WYSIWYG."

- **Verb-prefix enforcement mechanism** (`ListManager.tsx`):
  - Accepts `verbPrefix: string` (`:37`) and optional `altVerbPrefix: string` (`:39`) as props — the strings are owned by the CALLER, not hardcoded in ListManager.
  - `startAdd(prefix)` at `:64-68`: `setDraftPrefix(prefix); setDraft(prefix);` — clicking the "+ I WANT to..." button **pre-fills the input with the prefix as editable text** (not a placeholder, not a forced/validated prefix — the user can backspace through it).
  - `commitAdd()` at `:70-80`: stores `draft.trim()` verbatim into `items` array — **prefix is stored as part of the string**.
  - "+ {verbPrefix.trim()}..." button at `:223-243`: the alt prefix gets its own second button when supplied.
  - **No server-side or component-side validation enforces the prefix.** The user can edit it out before clicking "add". The mechanism is *prompting discipline*, not *enforced grammar* — gentle Bridgewater-style nudging.

- **Current prefill strings (CALLER-SIDE, two locations — must update both):**

  **`src/components/workbench/operations/SectionD_ProjectBacklog.tsx` (the CREATE form):**
  - GOAL (`:392-398`): `verbPrefix="I WANT to "`, placeholder=`"get loans approved"`
  - PROBLEM (`:402-409`): `verbPrefix="I DID NOT "`, `altVerbPrefix="I HAVE NOT "`, placeholder=`"create an FSA ID yet"`
  - DIAGNOSIS (`:413-419`): `verbPrefix="I NEED TO "`, placeholder=`"complete personal tax return first"`
  - Section labels (`:391 / :401 / :412`):
    - "1 · goal — what success looks like"
    - "2 · problem — gap between current and goal"
    - "3 · diagnosis — root cause"  ← **label already says "root cause"; only the prefill contradicts the promise**

  **`src/components/workbench/operations/projects/ProjectRow.tsx` (the EDIT form — same wiring in the per-row inline editor):**
  - GOAL (`:475-481`): `verbPrefix="I WANT to "`, placeholder=`"get loans approved"`
  - PROBLEM (`:485-492`): `verbPrefix="I DID NOT "`, `altVerbPrefix="I HAVE NOT "`, placeholder=`"create an FSA ID yet"`
  - DIAGNOSIS (`:496-502`): `verbPrefix="I NEED TO "`, placeholder=`"complete personal tax return first"`
  - Section labels (`:474 / :484 / :495`):
    - "1 · goal — what success looks like"
    - "2 · problem — gap between current and goal"
    - "3 · diagnosis — root cause of the gap"  ← **same: label says "root cause", prefill says "I NEED TO" (solution)**

- **Confirmed: ListManager is consumed in exactly these two places** (`grep -rln "ListManager\b" src/`):
  - `src/components/workbench/operations/projects/ListManager.tsx` (the component itself)
  - `src/components/workbench/operations/projects/ProjectRow.tsx`
  - `src/components/workbench/operations/SectionD_ProjectBacklog.tsx`

B. PREFIX → DATA → AI FLOW

1. **Prefix stored or stripped:** **STORED VERBATIM.**
   - ListManager `commitAdd()` at `:70-80` writes `draft.trim()` directly into the items array — no prefix-stripping.
   - The project API `POST /api/operations/projects` (`src/app/api/operations/projects/route.ts:204-208, :289-291`) validates each item as a string ≤500 chars and persists into `goal_items`, `problem_items`, `diagnosis_items` columns — also verbatim.
   - Database storage: `operations_projects.{goal_items, problem_items, diagnosis_items}` are `Json @default("[]") @db.JsonB` (per `prisma/schema.prisma:2568-2570`). Plain JSON string arrays.
   - **Net effect:** what the user types is what gets stored. The prefill text is "the seed of the institutional voice"; nothing strips or normalizes it later.

2. **AI design generation feeds diagnosis_items into the prompt** — `src/lib/ai/generateProjectDesign.ts`:
   - User message (`:98-109`): the items are bullet-listed under the literal labels "GOAL items:" / "PROBLEM items:" / "DIAGNOSIS items:" via `bulletList(items)` at `:46-49`. So if the user supplies `"Because I never set up the FSA ID"`, that exact string lands in the DIAGNOSIS bullet list to the AI.
   - System prompt at `:51-95` — **this is where the framing-mismatch risk lives.**

3. **CRITICAL — AI system prompt EXPLICITLY references the OLD prefill grammar** (`generateProjectDesign.ts:55-58`):
   ```
   The user's natural-voice grammar maps to Bridgewater's 5-step scoping:
     - GOAL items: "I WANT" lines (desires / target end states)
     - PROBLEM items: "I DID NOT" / "I HAVE NOT" lines (current gaps)
     - DIAGNOSIS items: "I NEED TO" lines (root requirements)
     - DESIGN field: numbered STEPS with timelines and decision points (you produce this)
   ```
   **Two specific bugs the Phase 2 change must fix:**
   - **Bug A (the user's complaint, mirrored):** the system prompt calls DIAGNOSIS items "root **requirements**" — that's already solution-flavored framing, parallel to "I NEED TO". This contradicts the Bridgewater step-3 "root **cause**" definition. The label in the form is correct ("root cause"); the prompt's language and the prefill both contradict the label. Phase 2 must align all three.
   - **Bug B:** if Phase 2 changes the prefill from "I NEED TO" → "Because" / "The root cause is" without updating this system prompt, the AI is told to *expect* "I NEED TO" lines (root requirements) but will *receive* "Because..." lines (root causes). The AI may then mis-classify the input or treat it as malformed.
   - The line `:67` ("Do NOT echo the 'I WANT / I DID NOT / I NEED TO' grammar in your output") — also needs updating to reflect the new prefill set, otherwise the AI is told to avoid grammar that's no longer the prefill grammar.

4. **`generateProjectTasks.ts` has the SAME mismatch risk** (`src/lib/ai/generateProjectTasks.ts`):
   - `:91-94`: identical "INPUTS" grammar mapping, including `DIAGNOSIS items: "I NEED TO ..." (root requirements)`.
   - `:156-158`: "Do NOT echo the I WANT / I DID NOT / I NEED TO grammar from the user's inputs."
   - Used by the AI tasks generator surface (per `src/app/api/operations/ai/generate-tasks/route.ts`). Same diagnosisItems are sent through.

5. **The exemplar's diagnosis_items ALSO use the old grammar** (`src/lib/ai/exemplars/projectDesign.ts:47-54`):
   ```js
   diagnosis_items: [
     'I NEED TO complete personal tax return first so FAFSA pulls clean IRS data via Data Retrieval Tool',
     'I NEED TO complete business tax return so Schedule C and pass-through income are accurate before FAFSA',
     ...
   ]
   ```
   - The exemplar is interpolated into BOTH system prompts (generateProjectDesign.ts `:82-91`, generateProjectTasks.ts `:179-180`) as the few-shot gold standard.
   - **Critical insight:** these exemplar entries READ as root causes in disguise — "I NEED TO complete personal tax return first so FAFSA pulls clean IRS data" is semantically "because FAFSA can't pull clean IRS data until the personal tax return is filed". The "I NEED TO X so Y" pattern smuggles the cause (Y) inside a solution-prefixed wrapper.
   - **If Phase 2 changes the prefill, the exemplar must be rewritten to "Because Y" form** — otherwise the few-shot example contradicts the new prefill grammar. This is the single biggest change in Phase 2 scope: rewriting 6 exemplar diagnosis lines from "I NEED TO X so Y" to "Because Y" / "The root cause is Y".

C. EXACT CHANGE SET

1. **GOAL prefix: "I WANT to " → UNCHANGED.** Confirmed correct per Dalio: goals are aspirational target end-states; first-person desire-voice fits exactly. Two locations untouched (SectionD :395, ProjectRow :478). System prompt diagnosis-line about GOAL grammar (`generateProjectDesign.ts:56`, `generateProjectTasks.ts:92`) stays as-is.

2. **PROBLEM prefixes:**
   - **"I HAVE NOT " — KEEP.** Clean gap statement ("I have not filed FAFSA yet" is a fact, not self-blame).
   - **"I DID NOT " — REPLACE.** "I did not X" reads as self-blame past-tense ("I didn't do my homework") rather than a current obstacle.
   - **Audit recommends: "I KEEP " or "I GET ".**
     - **"I KEEP "** captures recurring obstacles cleanly: "I keep getting pulled off it", "I keep losing focus mid-session", "I keep deferring it". Pairs naturally with "I HAVE NOT " (which captures one-shot omissions) — the two together cover both the recurring and the not-yet patterns. Recommend **"I KEEP "**.
     - Alternative if Alex prefers obstacle-blame-neutral past framing: **"X IS / WAS "** ("X is taking longer than expected", "the FAFSA deadline was already missed") — more journalistic, less first-person. But this loses the verb-prefix consistency (the other prefills all start "I "). Recommend STAY with "I KEEP" for grammatical parallel.
   - Two locations to change (SectionD :405, ProjectRow :488). Placeholder examples at `:407` / `:490` ("create an FSA ID yet") need to update to match the new prefix: e.g., placeholder=`"getting pulled off this when other emergencies hit"` for "I KEEP".

3. **DIAGNOSIS prefix: "I NEED TO " → REPLACE WITH CAUSE-FRAMING.**
   - The user-proposed options: **"Because..."** and **"The root cause is..."**.
   - **Recommend BOTH** (two prefixes, mirroring the PROBLEM section's two-prefix pattern via `altVerbPrefix`):
     - `verbPrefix="Because "` — short, conversational, the dominant cause-framing English uses ("Because X" is the canonical answer to "Why?").
     - `altVerbPrefix="The root cause is "` — explicit, declarative, useful when "Because" feels too colloquial or when the cause is structural rather than narrative.
   - Two locations to change (SectionD :416, ProjectRow :499). Placeholder example (`:417` / `:500`: "complete personal tax return first") must rewrite to a cause: e.g., `"FAFSA can't pull clean IRS data until the personal tax return is filed"`.
   - **Section label minor wording cleanup (optional):** ProjectRow `:495` says "diagnosis — root cause of the gap"; SectionD `:412` says "diagnosis — root cause". Recommend ALIGNING both to "diagnosis — root cause of the gap" so the section subtitle matches the prefill.

4. **AI system prompt — PARALLEL UPDATE REQUIRED (the most important Phase 2 question).**
   - YES — the system prompts in BOTH `generateProjectDesign.ts:55-58, :67` and `generateProjectTasks.ts:91-94, :157` must update to:
     ```
     - GOAL items: "I WANT" lines (desires / target end states)
     - PROBLEM items: "I HAVE NOT" / "I KEEP" lines (current gaps + recurring obstacles)
     - DIAGNOSIS items: "Because" / "The root cause is" lines (root causes — WHY the gap exists, not what to do about it)
     ```
   - The "Do NOT echo" line must also update to list the new prefixes so the AI knows to not echo "I KEEP" / "Because" either.
   - **Bug-fix opportunity:** in the same edit, change the gloss for DIAGNOSIS from "root **requirements**" (`generateProjectDesign.ts:58`, `generateProjectTasks.ts:94`) to "root **causes**". This aligns the AI's interpretive lens with Dalio's step 3 (cause-finding) instead of step 4 (design). This is arguably the highest-leverage word change in this PR — it tells the AI to *reason* causally over the diagnosis items rather than treating them as a to-do list.

5. **EXEMPLAR REWRITE REQUIRED** (`src/lib/ai/exemplars/projectDesign.ts:35-54`):
   - PROBLEM exemplar items 35-45: any item using "I DID NOT" must rewrite to "I KEEP" or stay as "I HAVE NOT". For example:
     - "I DID NOT create an FSA ID yet" → "I HAVE NOT created an FSA ID" (already keep-able under the unchanged "I HAVE NOT" prefix)
     - "I DID NOT file my 2025 personal tax return yet" → "I HAVE NOT filed my 2025 personal tax return yet"
     - Most existing "I DID NOT" lines are actually one-shot omissions and convert naturally to "I HAVE NOT" — minimal rewriting.
   - DIAGNOSIS exemplar items 47-54: ALL six lines start with "I NEED TO". Rewrite each to "Because" / "The root cause is" cause-framing. Example transformations:
     - Old: `"I NEED TO complete personal tax return first so FAFSA pulls clean IRS data via Data Retrieval Tool"`
     - New: `"Because FAFSA can't pull clean IRS data until the personal tax return is filed via the Data Retrieval Tool"`
     - Old: `"I NEED TO recognize this project is downstream of 'Taxes Personal' and 'Sign up for Cal State LA' — not standalone work"`
     - New: `"The root cause is this project is downstream of 'Taxes Personal' and 'Sign up for Cal State LA' — not standalone work"`
   - **Why this matters:** the exemplar is shown to the AI as the few-shot gold standard. If the exemplar contradicts the new prefill grammar, the AI gets mixed signals and may revert to the exemplar's style — defeating the prefill change.

6. **Helper text scanning — no other landmines found.**
   - The section labels in SectionD `:391 :401 :412` and ProjectRow `:474 :484 :495` are already accurate (goal — what success looks like / problem — gap / diagnosis — root cause).
   - No tooltip / placeholder / aria-label outside the prefills + AI prompts references the old verb-prefix vocabulary (verified via `grep -rn "I NEED TO\|I DID NOT" src/`).
   - The `ListManager.tsx` doc comment (`:5, :32-35`) gives examples using the OLD prefixes — purely doc/internal, doesn't affect runtime. Recommend updating the comment to keep documentation truthful, but it's a 1-line nicety, not behavior.

7. **Pure strings, no schema/logic/data: CONFIRMED.**
   - `operations_projects.{goal_items, problem_items, diagnosis_items}` are JsonB string arrays — accept any string content; the schema is agnostic to prefill grammar.
   - The validation in `src/app/api/operations/projects/route.ts:204-208` and `src/app/api/operations/ai/generate-design/route.ts:84-91` only checks "string, non-empty, ≤500 chars" — agnostic to prefix.
   - No data migration: per Alex, all projects were cleared. Even if any survived, they'd display as-is — the change is purely the seed text shown when a NEW item is added, not retroactive.
   - No new API endpoints. No new component. No new types.

D. RECOMMENDATION

- **Final wording per prefix:**

| section | verbPrefix | altVerbPrefix | section label |
|---|---|---|---|
| 1 · goal — what success looks like | `"I WANT to "` (unchanged) | none | unchanged |
| 2 · problem — gap between current and goal | `"I HAVE NOT "` | `"I KEEP "` | unchanged |
| 3 · diagnosis — root cause of the gap | `"Because "` | `"The root cause is "` | normalize to "root cause of the gap" in both surfaces |

- **DIAGNOSIS: TWO prefixes (Because + The root cause is)**, mirroring the PROBLEM section's existing two-prefix pattern. Justification: "Because" is conversational and pairs with narrative explanation; "The root cause is" is declarative and pairs with structural causes. Both are pure cause-framing; either one keeps the user out of design-mode in step 3.

- **AI system prompt parallel update: REQUIRED in 2 files:**
  - `src/lib/ai/generateProjectDesign.ts:55-58, :67` — rewrite the grammar map + "Do NOT echo" line + change "root requirements" → "root causes".
  - `src/lib/ai/generateProjectTasks.ts:91-94, :156-158` — identical rewrite for parallel correctness.

- **EXEMPLAR REWRITE: REQUIRED in 1 file:**
  - `src/lib/ai/exemplars/projectDesign.ts` — `problem_items` (`:35-45`) convert any "I DID NOT" lines to "I HAVE NOT" or "I KEEP" form; `diagnosis_items` (`:47-54`) all 6 lines convert to "Because" / "The root cause is" cause-framing. Goal items and design field stay as-is.

- **Existing items affected:** **NONE.** Alex confirmed all projects cleared; the prefill change affects only the seed text shown when a new item is created. Even if any project survived, the items would render verbatim with whatever grammar they were saved under — no retroactive rewrite.

- **Scope + files (estimated for Phase 2):**
  1. `src/components/workbench/operations/SectionD_ProjectBacklog.tsx` — change 4 strings (problem `verbPrefix`, diagnosis `verbPrefix`, diagnosis `altVerbPrefix` added, problem + diagnosis placeholder), optionally normalize section label. ~8 lines.
  2. `src/components/workbench/operations/projects/ProjectRow.tsx` — identical 4-string change. ~8 lines.
  3. `src/lib/ai/generateProjectDesign.ts` — rewrite system prompt grammar map (3 lines) + "Do NOT echo" line + "root requirements" → "root causes". ~6 lines.
  4. `src/lib/ai/generateProjectTasks.ts` — same rewrite as #3. ~6 lines.
  5. `src/lib/ai/exemplars/projectDesign.ts` — rewrite ~10 problem_items + ALL 6 diagnosis_items. ~16 lines.
  6. `src/components/workbench/operations/projects/ListManager.tsx` — optional doc-comment update (`:5, :32-35`) so the examples match new reality. ~4 lines if done; skip if Alex prefers minimum-change.
  - **Total: 5 source files + 1 optional doc-only file. ~44-48 lines net changed. Pure string edits. No types, no API, no schema, no migration.**

- **Open decisions for Alex:**
  1. **PROBLEM second prefix: "I KEEP " (recommended) vs "I GET " (more passive, less self-agentive) vs no change (drop "I DID NOT", keep only "I HAVE NOT")?** Recommend "I KEEP". Dropping to one prefix loses the recurring-obstacle voice; "I GET" is less directive than "I KEEP".
  2. **DIAGNOSIS: two prefixes (Because + The root cause is) vs one (Because only)?** Recommend two — symmetric with PROBLEM. One prefix is fewer choices but loses the declarative-structural variant.
  3. **Placeholders: update to match new prefixes?** Recommend YES — the placeholder is a continuation of the prefix in the user's eyes; mismatched placeholder ("complete personal tax return first" under "Because ") is jarring. Will need fresh placeholder strings per section. Suggested:
     - GOAL: keep "get loans approved" (still works under "I WANT to ").
     - PROBLEM: "getting pulled off this when other emergencies hit" (pairs with "I KEEP ").
     - DIAGNOSIS: "FAFSA can't pull clean IRS data until the personal tax return is filed" (pairs with "Because ").
  4. **Exemplar rewrite scope: full rewrite of all 16 diagnosis-affected exemplar lines vs a minimal "best 3" sample?** Recommend FULL — the exemplar is the few-shot gold standard; a half-converted exemplar sends mixed signals.
  5. **ListManager doc comment update: yes vs defer to a docs-only PR?** Recommend YES (low-cost, keeps docs honest), but skippable if Alex wants minimum diff.
  6. **System prompt "root requirements" → "root causes": yes or stay with "requirements"?** Recommend YES — this is the AI's interpretive lens for step-3 input. "Requirements" pulls the AI toward design; "causes" pulls toward analysis. Worth the 1-word change even on its own merits.
  7. **Section label "root cause of the gap" alignment between the two surfaces (SectionD says "root cause"; ProjectRow says "root cause of the gap")?** Recommend normalize to "root cause of the gap" (matches Dalio: the gap exists, find its cause). 1-word add in SectionD.

NO SOURCE FILES MODIFIED. Audit report at audit-reports/pr-ops-5.14-phase-1.md.
