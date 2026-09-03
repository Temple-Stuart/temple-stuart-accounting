# Audit — Script Generation Prompt + Data Flow

**Status:** AUDIT ONLY (read-only investigation, no implementation)
**Date:** 2026-06-05
**Branch:** `claude/audit-script-prompt`
**Goal context:** Alex's reels run ~2 min spoken (~280–320 words). Generated scripts
read "too advanced" — he wants a **5th-grade reading level** for IG/TikTok. This is the
verified current state of the generator before any tuning.

Every claim cites `file:line`.

---

## 1 · The Prompt Itself

### Where it lives
- **Route:** `src/app/api/operations/content/generate-script/route.ts` —
  `POST /api/operations/content/generate-script { piece_id }` (route.ts:1-2, handler 43).
- **Prompt builder:** the route imports `generateReelScript` from
  `src/lib/ai/generateReelScript.ts` (route.ts:32-36; call at route.ts:174-183).
- The system prompt is a hardcoded module constant `SYSTEM_PROMPT`
  (`generateReelScript.ts:54-83`); the user message is assembled in `generateReelScript`
  (`generateReelScript.ts:121-131`) using two helpers, `bulletScenes` (`:85-98`) and
  `bulletTasks` (`:100-112`).

### Model / params / usage wrapper
- **Model:** `MODEL_SONNET_4` = `'claude-sonnet-4-20250514'` — **Sonnet, not Haiku**
  (`generateReelScript.ts:15,138`; id at `client.ts:31`).
- **max_tokens:** `1500` (`generateReelScript.ts:141`).
- **temperature:** `0.85` ("creative, conversational voice") (`generateReelScript.ts:142`).
- **Through `recordUsage`?** **Yes** (`generateReelScript.ts:135-148`). `recordUsage`
  calls `client.messages.create` (`recordUsage.ts:119`) and writes an immutable
  `operations_ai_usage` row (`recordUsage.ts:151`) capturing model/prompts/tokens/cost —
  the audit-tail version record. `purpose: 'reel_voiceover_generation'`.

### VERBATIM — System prompt (`generateReelScript.ts:54-83`)
```
You write the VOICEOVER SCRIPT for a daily short-form reel. You write in ALEX'S RAW VOICE.

ALEX'S VOICE (non-negotiable):
- Plain language a simple person instantly understands. Fun, playful, enjoyable to listen to.
- Built for WILD ENGAGEMENT: hook HARD in the first line, keep momentum every beat, land a strong close.
- Talk like he'd say it OUT LOUD to a friend. Short sentences. Real words.

HARD BAN (instant rewrite if any appears):
- Academic or pretentious verbiage. Corporate tone. Try-hard "smart" vocabulary. Platitudes / motivational-poster lines.
- If a sentence sounds like an essay or a LinkedIn post, rewrite it like he'd actually say it.

THE LOCKED REEL FORMAT:
1. HOOK — open on the strongest line drawn from his answers. Stop the scroll.
2. BODY — the planning / goals / stakes / mindset answers, voiced over the day's life footage (morning scenes through the day, in order). This is most of the reel.
3. PROOF-BURST — near the END, compress the EXECUTION (the task blocks: what got built, planned vs actual, what shipped) into a rapid-fire burst. Fast, concrete, receipts.
4. CLOSE — the day score + a "catch me tomorrow" hook, pulled from the tomorrow/closing answers.

GROUNDING THE WORK (anti-confabulation — NON-NEGOTIABLE):
- A task TITLE is a LABEL, not a description. You do NOT know what a task actually involved from its title.
- The EXECUTION NOTES (when present) are the AUTHORITATIVE account of what got built/done. Where the notes and a task title differ, the NOTES WIN.
- You may NOT state any work specific (what was built, how, what shipped, any number) that is not grounded in the EXECUTION NOTES, the task record, or Alex's answers. Do not infer or dramatize the work.
- If there are NO execution notes and the task titles are thin, keep the proof-burst HIGH-LEVEL — e.g. "real hours into the build — receipts tomorrow" — and NEVER invent specifics. Honest-and-vague beats confident-and-wrong.

OUTPUT SHAPE:
- SCENE-MAPPED: tag each beat with [scene N · activity] (use the scene numbers + activities given) so Alex can match clips while editing. The proof-burst may be tagged [execution].
- Target ~2:00 read aloud — roughly 280–320 words. Tight.
- Use ONLY what Alex answered and the REAL task record below. If something wasn't answered, don't voice it.
- NEVER fabricate events, feelings, numbers, or outcomes. No invented stats. If the task record is thin, keep the proof-burst short — real and short beats padded.

Write the script now. Output only the script (the tagged beats), nothing else.
```

### VERBATIM — User-message template (`generateReelScript.ts:121-131`)
```
DAY: ${input.dateLabel}

THE DAY'S SCENES (in clock order — these are the life-footage beats; voice the BODY from these answers):
${bulletScenes(input.scenes)}

THE TASK RECORD (the calendar blocks — planned vs actual; the skeleton of the proof-burst):
${bulletTasks(input.tasks)}

${executionBlock}

Write Alex's reel voiceover per the format and his voice. Scene-map every beat. Ground every work claim in the execution notes + task record + answers. Never fabricate.
```

**Per-scene format** (`bulletScenes`, `generateReelScript.ts:85-98`):
```
[scene ${n} · ${activity}${ · time?}]
  narrative purpose: ${narrative}      (omitted if empty)
  b-roll: ${b_roll}                    (omitted if empty)
  question: ${question}                (omitted if empty)
  ANSWER: ${answer}
```
**Per-task format** (`bulletTasks`, `generateReelScript.ts:100-112`):
```
- ${title}${ (project)?} — ${status} · ${actual ?? scheduled ?? 'no time'}
```
(empty task list → `(no project tasks on the calendar this day)`)

**Execution-notes block** (`generateReelScript.ts:115-119`):
- With notes: `EXECUTION NOTES — Alex's authoritative receipts of what ACTUALLY got built/done (this is the AUTHORITY; task titles are only labels; where this differs from a title, THIS wins):\n${notes}`
- Without: `EXECUTION NOTES: (none provided — task titles are LABELS only; keep the proof-burst HIGH-LEVEL, never invent work specifics).`

---

## 2 · Data In

### Every field the prompt receives
| Field | Source | Assembled at |
|---|---|---|
| `dateLabel` (day) | `piece.piece_date` → `YYYY-MM-DD` | route.ts:70, passed :178 |
| **Scene** `activity` | `routine_step.activity` (fallback `'scene'`) | route.ts:79,93 → :118-126 |
| **Scene** `time` | `routine_step.time_of_day` (HH:MM) | route.ts:94 |
| **Scene** `narrative` | scene `narrative_purpose` | route.ts:96 |
| **Scene** `b_roll` | scene `b_roll` | route.ts:97 |
| **Scene** `question` | scene `assigned_question_text` | route.ts:97→ wait `:97` is b_roll; question at route.ts:97? (question = `s.assigned_question_text`, route.ts:97 line `question: s.assigned_question_text`) |
| **Scene** `answer` | `take.script` (the logged answer), trimmed | route.ts:98 |
| **Task** `title` | `task.title` or `ad_hoc_title` or `'Untitled'` | route.ts:150 |
| **Task** `project` | project title via `project_id` lookup | route.ts:139-145,151 |
| **Task** `status` | `calendar_block.status` (or `'planned'`) | route.ts:155,167 |
| **Task** `scheduled` | block `scheduled_start–scheduled_end` (HH:MM) | route.ts:160 |
| **Task** `actual` | block `actual_start–actual_end` when done | route.ts:161-164 |
| **Execution notes** | `piece.execution_notes` | route.ts:182 |

> Field-cite correction for clarity: in `route.ts` the scene mapping is `narrative: s.narrative_purpose` (:96), `b_roll: s.b_roll` (:97 first), `question: s.assigned_question_text` (:97 second) — both on the lines at 96-97; `answer: (t.script ?? '').trim()` (:98).

### NOT included (findings)
- **North Star context** — **absent**. The route never reads `operations_north_star`; the
  prompt has no mission/goals framing beyond the day's own answers. (grep across the route
  + builder: no `north_star` reference.)
- **Task descriptions** — **absent**. Only task **title** is sent (route.ts:133 selects
  `title, project_id` only — no `description`). The prompt explicitly treats titles as mere
  labels (system prompt, "GROUNDING THE WORK").
- **Routine step narratives** beyond `activity`/`time` are sent only via the *scene's*
  `narrative_purpose` / `b_roll` (scene-level, not step-level prose).

### Order the model sees the day in
- **Scenes and tasks are TWO SEPARATE BLOCKS**, not interleaved. The prompt shows all
  scenes first ("THE DAY'S SCENES"), then all tasks ("THE TASK RECORD")
  (`generateReelScript.ts:123-127`).
- **Scenes:** sorted into clock order by `compareDayOrder` (midnight wraps to day-end)
  (route.ts:101-103).
- **Tasks:** sorted by minute-of-day of `actual_start ?? scheduled_start` (route.ts:166,171);
  **planned (block-less) tasks are pushed to the END** via a synthetic sequence starting at
  `100000` (route.ts:148,154). So the model sees timed tasks in clock order, then planned
  ones last.
- The *format* instruction tells the model to weave scenes as the BODY (in order) and
  compress tasks into a late PROOF-BURST (system prompt format 1-4) — so the temporal
  interleaving is the model's job, guided by the prompt, not pre-merged in the data.

### Filtering
- **Scenes:** only **answered** ones — takes with `script.trim().length > 0` AND a joined
  scene (route.ts:85-86). **FAIL-LOUD:** zero answers → HTTP 400 with a "answer the scenes
  first" message; never generates from nothing (route.ts:106-116).
- **Tasks:** **no status filter** — ALL `operations_daily_plan_items` for the day (planned +
  committed + done) are included (route.ts:129-135). Status/planned/actual are passed so the
  model can voice "planned vs actual."

---

## 3 · Output Contract

### Format demanded
- **Scene-mapped tagged prose** — each beat tagged `[scene N · activity]`; the proof-burst
  may be `[execution]` (system prompt, OUTPUT SHAPE). "Output only the script (the tagged
  beats), nothing else." **Not JSON, not a saved structure — free prose with inline tags.**

### Where the output lands
- The route **does NOT save** — returns `{ script, usage_id, tokens, cost, scenes_used,
  tasks_used }` (route.ts:185-193). The immutable reasoning lives only in the
  `operations_ai_usage` row `recordUsage` wrote (route.ts:14-16 docstring).
- The UI (`ScriptGenerator.tsx`) renders the returned script inline as an **editable**
  textarea (ScriptGenerator.tsx:7-10); **"save" → `PATCH /content/grid/piece/[pieceId]
  { script }`** persists to `piece.script` (ScriptGenerator.tsx:8,167-183). Human gate:
  nothing saves without Alex's action.

### Length constraint — **YES**
- System prompt: **"Target ~2:00 read aloud — roughly 280–320 words. Tight."**
  (`generateReelScript.ts:79`). Also reinforced "Tight" / "real and short beats padded"
  (`:81`). Bounded indirectly by `max_tokens: 1500` (`:141`).

### Reading-level / tone / voice — **PARTIAL**
- **Reading level: NONE.** There is **no** grade-level, Flesch-Kincaid, syllable, or
  "5th grade" instruction anywhere (grep confirmed absent in builder + route).
- **Tone/voice: YES, extensive.** Quoted from `generateReelScript.ts:56-63`:
  - "Plain language a simple person instantly understands. Fun, playful, enjoyable to listen to."
  - "Talk like he'd say it OUT LOUD to a friend. Short sentences. Real words."
  - HARD BAN: "Academic or pretentious verbiage. Corporate tone. Try-hard 'smart' vocabulary.
    Platitudes / motivational-poster lines." / "If a sentence sounds like an essay or a
    LinkedIn post, rewrite it…"
- So the prompt *gestures* at simplicity ("plain language," "simple person," "short
  sentences," bans academic vocab) but **never sets a measurable reading level**. That gap
  is almost certainly why output still reads "too advanced" — "plain language" is softer and
  more interpretable than "5th-grade reading level; one idea per sentence; avoid words over
  two syllables."

---

## 4 · Tunability

### Hardcoded vs parameterized
- **Hardcoded.** `SYSTEM_PROMPT` is a fixed module constant (`generateReelScript.ts:54-83`).
- `generateReelScript`'s input (`GenInput`, `:34-44`) carries **data only** (scenes, tasks,
  executionNotes, ids) — **no voice / reading-level / duration knobs**. The route passes no
  options either (route.ts:174-183).
- **There is, however, a clean seam.** `recordUsage` already takes `systemPrompt`,
  `userMessage`, `maxTokens`, `temperature` as parameters (`recordUsage.ts:85,102-119`). So
  a parameterized prompt is a drop-in: build the system prompt from options and pass it
  through — no change to the usage/audit machinery.

### Where a future knob would plug in
- **Per-request control (recommended for v1+):** add fields to the POST body
  (e.g. `reading_level`, `duration_seconds`, `voice_profile`) → thread into `GenInput` →
  build `SYSTEM_PROMPT` from them. The UI control would live in `ScriptGenerator.tsx`
  alongside the generate button.
- **Per-user defaults:** no user-settings table is wired for content/voice today; would need
  a new column or a small settings record. Not required for v1.
- **v1 reality:** the fastest correct fix is a **prompt-text edit** to the hardcoded
  `SYSTEM_PROMPT` (add the reading-level rule + tighten the word target + encode the
  playbook), shipping as one PR with no schema/route signature change.

### Alex's locked playbook rules — encoded? (FINDINGS)
| Playbook rule | Encoded? | Evidence |
|---|---|---|
| Plain language | **Partial** | "Plain language a simple person instantly understands" (`:57`) — but no measurable level |
| Playful / fun | **Yes** | "Fun, playful, enjoyable to listen to" (`:57`) |
| No academic verbiage | **Yes** | HARD BAN (`:61-63`) |
| Raw-and-real voice | **Yes** | "ALEX'S RAW VOICE… like he'd say it OUT LOUD to a friend" (`:54,59`) |
| **5th-grade reading level** | **NO** | absent (grep) — primary gap |
| **Micro step-by-step** | **NO** | absent — no instruction to break things into tiny steps |
| **Reference @handle naturally** | **NO** | absent — no handle anywhere in prompt or route |
| **Reference GitHub URL naturally** | **NO** | absent — no github reference anywhere |
| ~300-word / 2-min length | **Yes (range)** | "280–320 words" (`:79`) — within his ~300 target |

> Net: the *voice/tone* half of the playbook is encoded; the **measurable reading level,
> micro-step style, and the @handle + GitHub-URL conventions are NOT encoded anywhere** —
> that's the core finding driving the "too advanced" symptom.

---

## Recommended approach — ONE PR (prompt-text edit, no schema/route change)

Edit the hardcoded `SYSTEM_PROMPT` in `src/lib/ai/generateReelScript.ts:54-83`. No route
signature, API, or DB change; `recordUsage` already records the new prompt immutably, so the
audit tail stays intact and every generation is versioned.

1. **Reading level — make it measurable.** Add an explicit, testable rule, e.g.:
   *"Write at a 5th-grade reading level (US). One idea per sentence. Prefer one- and
   two-syllable words; if a longer word sneaks in, swap it for how a kid would say it. No
   sentence longer than ~12 words."* This replaces the soft "plain language" with a hard
   target — the single highest-leverage change for the "too advanced" complaint.

2. **Length — tighten to his number.** Change "roughly 280–320 words" to "~300 words
   (about 2:00 spoken); never over 320." Keep `max_tokens: 1500` (ample headroom; it is not
   the limiter).

3. **Encode the missing playbook rules:**
   - **Micro step-by-step:** "When you explain what he did or how, break it into tiny,
     concrete steps a beginner could copy — first this, then this."
   - **@handle + GitHub URL naturally:** thread Alex's handle and repo URL into the close/CTA
     ("follow @handle", "it's all open on github.com/…") **without sounding like an ad.**
     ⚠️ *Decision needed:* the handle + URL are **not in code today** — they must be supplied.
     Cleanest: pass them into `generateReelScript` (new optional `GenInput` fields) sourced
     from a config/env or the user record, rather than hardcoding a string in the prompt.
     If we hardcode for v1, flag it as a follow-up to parameterize.

4. **Keep intact:** the anti-confabulation/grounding block (`:71-81`), the scene-map output
   shape, and the HOOK/BODY/PROOF-BURST/CLOSE format — those are working and are not the
   reading-level problem.

5. **Optional (defer):** if Alex wants to A/B voice/length live, promote the prompt to a
   builder that takes `{ readingLevel, durationSeconds, handle, repoUrl }` and add controls
   in `ScriptGenerator.tsx`. Not needed to fix the immediate complaint — call it v2.

**PR size:** small and self-contained — one prompt constant edited (plus, if we parameterize
the handle/URL, ~3 optional fields threaded route → builder). No model change (Sonnet 4 is
appropriate for voice), no temperature change needed (0.85 is fine for conversational tone).

### Open question for the implementer
Provide the exact **@handle** and **GitHub URL** (and confirm whether they should appear in
every reel's close or only when relevant) — they exist nowhere in the codebase today, so the
PR can't encode them without that input.
