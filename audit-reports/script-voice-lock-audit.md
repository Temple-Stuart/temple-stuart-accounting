# Audit — Script Voice Lock: Current Script-Generation Pipeline

**Status:** READ-ONLY audit. No source modified; only this report created.
**Date:** 2026-06-06
**Branch:** `claude/audit-script-voice-lock`
**Goal:** Ground truth on the script generator before locking the output to a fixed
scene-block format built from morning planning answers + executed tasks + evening
reflection answers.

Every claim cites `file:line` / `schema:line`. Findings tagged **EXISTS / MISSING /
REUSABLE**. Unverifiable → **NOT VERIFIED**.

---

## 1 · Script generation entry points — **EXISTS**

Grep terms: `generateReelScript`, `generate-script`, `reel_voiceover`, `execution_notes`,
`day-audit`, `ScriptGenerator`. References found in 6 files; the generation chain is three:

| Layer | File | What it does |
|---|---|---|
| **API route** | `src/app/api/operations/content/generate-script/route.ts` (1-204) | `POST { piece_id }`. Auth (`getVerifiedEmail` :45, `requireTier(…,'ai',…)` :53), assembles inputs, calls `generateReelScript`, returns `{ script, usage_id, input_tokens, output_tokens, cost_usd, scenes_used, tasks_used }` (`:185-193`). **Does NOT save.** |
| **Generator lib** | `src/lib/ai/generateReelScript.ts` (1-187) | Builds the system prompt + user message, runs through `recordUsage` (`:153-167`). Model `MODEL_SONNET_4` (`:156`), `maxTokens: 1500` (`:159`), `temperature: 0.85` (`:160`), `purpose: 'reel_voiceover_generation'` (`:161`). Returns `{ script, usageId, inputTokens, outputTokens, costUsd }` (`:175-186`). Throws on empty output (`:171-173`). |
| **UI** | `src/components/workbench/operations/content/ScriptGenerator.tsx` (1-294) | Section "4 · SCRIPT". generate → POST (`:150-155`), renders an editable textarea with word/read-time, save → PATCH piece (`:172-177`), the **day-audit helper panel** (`:225-242`), and the **execution-notes** field (`:244-268`). |

There is exactly **one** script generator (the reel voiceover). No other script-generation
route/function exists. The project generators (`generateProjectDesign`/`generateProjectTasks`)
are unrelated (they produce plans/tasks, not scripts).

---

## 2 · The current prompt / voice contract — **EXISTS** (v2.3)

The full system prompt is a hardcoded constant `SYSTEM_PROMPT`
(`generateReelScript.ts:54-105`). Reproduced verbatim:

```
You write the VOICEOVER SCRIPT for a daily short-form reel. You write in ALEX'S RAW VOICE.

ALEX'S VOICE (non-negotiable):
- Fun, playful, enjoyable to listen to.
- Built for WILD ENGAGEMENT: hook HARD in the first line, keep momentum every beat, land a strong close.
- Talk like he'd say it OUT LOUD to a friend. Short sentences. Real words.

READING LEVEL (non-negotiable):
- Write so a smart 12-year-old gets every sentence. One idea per sentence. Sentences 12 words or fewer, almost always.
- Everyday words only — if a 5th grader wouldn't know the word, use a different word. No business vocabulary, no developer vocabulary, ever.
- When you explain what got done or how something works, break it into tiny steps — first this, then this — like showing a beginner.
- Alex's answers may contain jargon (module, command center, UI, scoped, articulate). You are AUTHORIZED and REQUIRED to translate his jargon into plain words while keeping his meaning and energy: 'my operation module' → 'the part of my app that runs my day'; 'command center' → 'the one place I run everything from'. Translating his words to plain words is faithful; repeating his jargon is the failure.

HOW IT SHOULD SOUND (study this — it is Alex's target voice; copy the CADENCE, not the content):
'So every person has routines. Like drinking coffee, going to the gym, walking the dog. Most happen at the same time every day. People also have projects. Starting a business, applying for school, building a product. Unlike routines, project work changes every day. The idea is to manage both in one place. First, you map your routines onto your calendar. That creates the structure of your day. Then you enter your goals, the problems in the way, and your best guess at what needs to happen. The AI builds the plan. You review it, change it, approve it.'
Notice: short lines. One idea per line. Plain words. Matter-of-fact. Teaching a friend, step by step. No drama words, no hype. Every script must read in THIS cadence.

HARD BAN (instant rewrite if any appears):
- Academic or pretentious verbiage. Corporate tone. Try-hard "smart" vocabulary. Platitudes / motivational-poster lines.
- If a sentence sounds like an essay or a LinkedIn post, rewrite it like he'd actually say it.

WHAT THIS SYSTEM IS (SPEAK FROM THIS, NEVER FROM FEATURE NAMES):
Every person has routines — drinking coffee, eating lunch, going to the gym, walking the dog. Most happen at the same time every day. People also have projects — starting a business, applying for school, building a product, planning a trip. Unlike routines, project work changes every day. This system manages both in one place. You map your routines onto your calendar — that's the structure of your day. You enter your goals, the problems in the way, and your best guess at what needs to happen. The AI builds an execution plan — a task list designed to move you toward your goals. You review it, change it, approve it. Approved tasks get scheduled into the open time around your routines. Your calendar becomes a complete map of your day: the things you always do, plus the work that moves your life forward. In the morning it asks what matters today. Through the day, completed tasks are recorded in order — a timeline of your actions. In the evening it asks how it went, what worked, what didn't, and your score out of ten. Then AI reviews all of it — plans, tasks, reflections, the full timeline — and turns the entire day into a story.

The day-runner is one part of something bigger. The same app also watches every dollar — what came in, what went out, what it was for — sorted automatically and checked against the bank. It scans the stock market, scores every trade, and only shows the ones worth taking — then tracks every result. It plans trips and their budgets at the same time — flights, hotels, every cost mapped before booking. And at the end of the year, the books are already done — taxes stop being scary. One app that runs a whole life: the day, the money, the trades, the travel.

Whatever part of the system today's work touched, speak from THIS level — what it does for a person — never from module names, feature names, or code.
- When today's work was building this system: ONE sentence for what the system can now do for a person that it couldn't do this morning. ONE sentence of receipts (counts, hours, done-vs-planned). Then stop. Never name a button, panel, grid, tab, form, or feature. Naming a UI element is a failure.

TEACH ONE THING (required in every script):
Every script includes exactly ONE teaching beat: 2-4 short sentences that explain how ONE part of the system works, in the viewer's shoes. Pick the part today's data actually shows being used or built. Draw the explanation from WHAT THIS SYSTEM IS — never from feature names. It should sound like letting the viewer in on a trick. Example shape (do not copy verbatim, adapt to the day): 'Here's the trick. I mapped my routines on a calendar. The AI plans my work into the gaps. So I wake up already knowing what to do.' One teaching beat only — never two. Over many days, the audience learns the whole system one piece at a time.

THE LOCKED REEL FORMAT:
1. HOOK — open on the strongest line drawn from his answers. Stop the scroll.
2. BODY — the planning / goals / stakes / mindset answers, voiced over the day's life footage (morning scenes through the day, in order). This is most of the reel.
3. PROOF-BURST — near the END, compress the EXECUTION (the task blocks: what got built, planned vs actual, what shipped) into a rapid-fire burst. Fast, concrete, receipts.
4. CLOSE — the day score + a "catch me tomorrow" hook, pulled from the tomorrow/closing answers.

SELF-REFERENCE HERO MOMENT (only when true in the data):
- If the day's record shows this script-writing system itself was built or improved today, land one line making it explicit that the system wrote this script from the day it watched. Only when true in the data — never fabricate it.

GROUNDING THE WORK (anti-confabulation — NON-NEGOTIABLE):
- A task TITLE is a LABEL, not a description. You do NOT know what a task actually involved from its title.
- The EXECUTION NOTES (when present) are the AUTHORITATIVE account of what got built/done. Where the notes and a task title differ, the NOTES WIN.
- You may NOT state any work specific (what was built, how, what shipped, any number) that is not grounded in the EXECUTION NOTES, the task record, or Alex's answers. Do not infer or dramatize the work.
- If there are NO execution notes and the task titles are thin, keep the proof-burst HIGH-LEVEL — e.g. "real hours into the build — receipts tomorrow" — and NEVER invent specifics. Honest-and-vague beats confident-and-wrong.

OUTPUT SHAPE:
- SCENE-MAPPED: tag each beat with [scene N · activity] (use the scene numbers + activities given) so Alex can match clips while editing. The proof-burst may be tagged [execution].
- Hard target: 250-300 words. A 2-minute reel needs air for cuts. Over 300 words is a failure.
- Use ONLY what Alex answered and the REAL task record below. If something wasn't answered, don't voice it.
- NEVER fabricate events, feelings, or outcomes. If the task record is thin, keep the proof-burst short — real and short beats padded.
- NUMBERS: every number in the script must be computable from the data below — a count of tasks, a time from a block, a score from an answer. Before writing any number, point to where it comes from. If you cannot point to it, the number does not go in. Durations: only state a total if the blocks actually sum to it. An invented stat is the worst possible failure.

Write the script now. Output only the script (the tagged beats), nothing else.
```

**Tone/voice rules:** ALEX'S VOICE (`:56-59`), READING LEVEL incl. jargon-translation
(`:61-64`), the HOW IT SHOULD SOUND cadence exemplar (`:66-68`), HARD BAN (`:70-72`).
**Structure rules:** THE LOCKED REEL FORMAT — HOOK / BODY / PROOF-BURST / CLOSE (`:81-85`);
TEACH ONE THING (`:78-79`); SELF-REFERENCE HERO MOMENT (`:87-88`); OUTPUT SHAPE incl. the
250-300 word target (`:96-101`). **Anti-confabulation rules:** GROUNDING THE WORK (`:90-94`)
+ the hardened NUMBERS rule (`:100`).

**Scene-by-scene OUTPUT TEMPLATE: NO.** Evidence: the only structural output instruction is
`SCENE-MAPPED: tag each beat with [scene N · activity]` (`:97`) — an **inline tag** on free
prose, plus the prompt-closing `Output only the script (the tagged beats)` (`:102`). There is
no per-scene slot/section the model must fill, no required line-per-scene, no JSON/array
output shape. The output is **tagged prose**, not a fixed template. **MISSING** (the very gap
the next project targets).

---

## 3 · Input assembly — what the generation call receives

The route assembles the user message inputs (`route.ts:71-183`), then `generateReelScript`
formats them (`generateReelScript.ts:108-149`).

### 3a · "Morning planning answers" (the scene answers) — **EXISTS** (not phase-labeled)
- Answers are **`operations_content_takes.script`** (`schema:2984-3000`; `script` at `:2990`),
  one per `(scene_id, piece_id)` (`@@unique([scene_id, piece_id])`). Fetched at
  `route.ts:74-83` (takes for the piece, joined to `scene` + `routine_step`), kept only when
  `script` is non-empty (`:85-86`).
- The **question** each answer responds to lives on the SCENE:
  `operations_content_scenes.assigned_question_text` (a snapshot at assignment time,
  `schema:2923`), plus `narrative_purpose` (`:2915`) and `b_roll` (`:2914`). The question
  library is `operations_content_questions` (`schema:3015-3032`: `question_text`, `label`,
  `sort_order`, `is_active`), assigned to scenes via `assigned_question_id`.
- Per-scene shape sent to the prompt (`ScriptSceneInput`, `generateReelScript.ts:17-25`):
  `scene_number, activity, time, narrative, b_roll, question, answer`. Rendered as a bullet
  block ending `ANSWER: …` (`bulletScenes`, `:110-123`).

### 3b · Executed tasks — **EXISTS**
- Fetched from **`operations_daily_plan_items`** for `plan_date = piece.piece_date`, with
  `calendar_blocks` + `task {title, project_id}` (`route.ts:129-135`). Project names looked
  up separately (`:140-145`).
- "Done today" is **NOT a status filter** — ALL the day's items are sent (planned + committed
  + done). Each `calendar_blocks` row carries `status` + `scheduled_start/end` +
  `actual_start/end` (`schema:2739-2758`), and the row is flattened to
  `ScriptTaskInput {title, project, status, planned, scheduled, actual}`
  (`generateReelScript.ts:26-33`; built `route.ts:147-172`). So "done-ness" reaches the model
  only as the block's `status` string + presence of `actual_*` — the model is told to read it,
  not the route. `operations_project_tasks.completed_at` (`schema:2695`) is **NOT** fetched/sent.
- Empty case: `bulletTasks` returns `'(no project tasks on the calendar this day)'`
  (`generateReelScript.ts:126`).

### 3c · "Evening reflection answers" as a distinct surface — **MISSING**
Grep (`reflection|morning.?answer|evening.?answer|phase|is_reflection`): the only `reflection`
field is `daily_plans.reflection` (`schema:1857`), an **unrelated** model (the older
daily-plans/budgeting domain, `model daily_plans` at `:1817`) — not the content pipeline. The
content question/answer model has **no morning/evening/phase distinction**: every answer is a
`take.script` against a scene's one assigned question (`operations_content_questions` has no
phase/kind field, `:3015-3032`). The prompt's narrative *mentions* "in the evening it asks how
it went… reflections" (`generateReelScript.ts:76`) and CLOSE pulls "the day score… from the
tomorrow/closing answers" (`:85`) — but **nothing in code tags any answer as a reflection or a
score**; it's all the same flat scene-answer flow. So morning vs evening is purely whatever
questions Alex happens to assign to scenes; there is no structural reflection surface.

### 3d · Scenes/pieces/takes known to the generator — **EXISTS**
The generator resolves the piece (`route.ts:65-70`) and its answered scenes (`:74-103`), so it
knows which scenes were answered for the day. (It does NOT receive *unanswered* scenes — only
takes with non-empty `script`, `:85-86`.)

---

## 4 · Scene structure availability — **EXISTS / REUSABLE**

- A scene row (`operations_content_scenes`, `schema:2904-2936`) is keyed 1:1 to a routine step
  (`routine_step_id @unique`, `:2908`). Its **label + ordering for a scene tag come from the
  routine step**: `routine_step.activity` (the name) and `routine_step.step_order` (ordering)
  — selected at `route.ts:79` and used to build `[scene N · activity]` (the `scene_number` is
  just the answered-order index `i+1`, `route.ts:118-119`; `activity` is the label).
- A per-routine **scene group** also exists: `operations_content_scene_groups`
  (`schema:2881-2901`) carries `scene_number` (`:2886`) and `scene_title` (`:2887`), one per
  routine (`routine_id @unique`, `:2885`). So a stable, user-facing scene name/number DOES
  exist at the group level (currently not what the generator tags with — it uses the step
  activity + answered-index).
- **Routine step → scene mapping ("scenify") is COMPLETE**, not stubbed: `POST
  /api/operations/content/scene-rows` upserts a `content_scenes` row keyed by
  `routine_step_id` (`scene-rows/route.ts:75-172`; create at `:172`), driven by the
  ScenifyModal/ScenifyDraft UI. The grid GET returns scenes with their routine_step
  (`grid/route.ts` include). So scene rows, their order, and their routine linkage are all in
  place to drive scene tags. **REUSABLE** — a locked scene-block format can key off
  `routine_step.step_order` (order) + `routine_step.activity` or `scene_group.scene_title`
  (label).

---

## 5 · Output handling — **EXISTS**

- The generated script lands in **`operations_content_pieces.script`** (`schema:2956`, `Text`,
  nullable). Saved via `PATCH /api/operations/content/grid/piece/[pieceId] { script }`
  (`grid/piece/[pieceId]/route.ts:23-93`; update at `:70`), triggered by ScriptGenerator's
  "save to the day" (`ScriptGenerator.tsx:172-177`).
- **Storage is OVERWRITE (last-write-wins), NOT versioned/append-only**: the route doc says
  "Last-write-wins on piece.script" (`grid/piece/[pieceId]/route.ts:5-6`); each save replaces
  the column. The **immutable per-run history lives separately** in `operations_ai_usage`
  (the `recordUsage` row written every generation, `generateReelScript.ts:153`; the route doc
  notes "the immutable per-run reasoning lives in operations_ai_usage"). So: latest accepted
  draft on the piece; every raw generation preserved in ai_usage.
- **UI surface:** editable `<textarea>` with word count + ~read time
  (`ScriptGenerator.tsx:189-204, 270-291`). **Copy button: only for the day-audit prompt**
  (`:231-237`), **NOT for the generated script** — there is no copy-script affordance today
  (**MISSING**, minor).

---

## 6 · Missing-input behavior (read from code, not inferred)

- **Zero answered scenes → FAIL-LOUD 400.** `route.ts:106-116`: if `answered.length === 0`,
  returns `{ error: 'InsufficientInput', field: 'answers', message: 'This day has no answers
  yet…' }` — never generates. The UI pre-disables the button with the same reason
  (`ScriptGenerator.tsx:138-142`). **EXISTS.**
- **No tasks done / no tasks at all → soft, not an error.** All day items are sent regardless
  of status; if there are none, the task section becomes the literal string `'(no project
  tasks on the calendar this day)'` (`generateReelScript.ts:126`) and generation proceeds.
- **Empty reflections → not a code path.** There is no reflection input (§3c), so "empty
  reflections" has no handling — reflections are simply whichever scene answers exist; if a
  given scene has no answer it's dropped (`route.ts:85-86`) and never reaches the prompt.
- **No execution notes → handled in the lib.** `generateReelScript.ts` emits an explicit
  "(none provided — task titles are LABELS only…)" block when `execution_notes` is empty
  (the `executionBlock` ternary), so the prompt always has a notes section, empty-flagged.

---

## EXISTS / MISSING / REUSABLE — rollup

- **EXISTS:** one script generator (route + lib + UI); a full v2.3 voice/anti-confab prompt;
  scene answers (`takes.script`) + their snapshot questions; the day's tasks (items + blocks);
  scene rows keyed to routine steps with order + label; scene groups with stable
  number/title; `piece.script` output + `ai_usage` per-run history; fail-loud on zero answers.
- **MISSING:** any **scene-by-scene OUTPUT TEMPLATE** (output is tagged prose, not a fixed
  per-scene structure); any **morning/evening/reflection phase** concept (one flat scene-answer
  flow; the lone `reflection` column is an unrelated model); a **structured score/number**
  channel (numbers must be re-derived in-prompt, per the v2.3 NUMBERS rule — there is no
  numeric field on takes/pieces); `completed_at` is not sent; no copy-script button.
- **REUSABLE:** `routine_step.step_order` + `routine_step.activity` (or
  `scene_group.scene_title`/`scene_number`) already give per-scene order + label to drive a
  locked `[scene N · label]` block format; the scenify mapping is complete; the prompt's
  `OUTPUT SHAPE` is the single place a rigid template would be specified; `recordUsage` already
  versions every run, so any new format inherits append-only history for free.

---

## Summary — shortest path to a versioned scene-block output contract (facts, not plan)

Today the generator emits **tagged prose** (`[scene N · activity]` inline tags on free text,
`generateReelScript.ts:97`), saved by **overwrite** to `operations_content_pieces.script`
(`grid/piece/[pieceId]/route.ts:70`), with every raw run already preserved append-only in
`operations_ai_usage` (`recordUsage`, `generateReelScript.ts:153`). The per-scene order + label
needed to drive a fixed block format already exist on `operations_routine_steps`
(`step_order`/`activity`, `schema:2832`) and `operations_content_scene_groups`
(`scene_number`/`scene_title`, `schema:2886-2887`), and the scene mapping that produces them is
complete (`scene-rows/route.ts:172`). What does **not** exist is (a) any fixed per-scene output
template in the prompt's `OUTPUT SHAPE` (`generateReelScript.ts:96-101`), (b) any
morning/evening/reflection phase or structured score on the answers (one flat `takes.script`
flow; `reflection` at `schema:1857` is an unrelated `daily_plans` field), and (c) versioning of
the *accepted* script (the piece column is last-write-wins, history only in ai_usage). So the
shortest path is a **prompt-and-shape change** (specify the locked scene-block template in
`OUTPUT SHAPE`, optionally returning structured JSON instead of prose), keying scene tags off
the existing `step_order`/`scene_title`; a morning-vs-evening contract additionally requires a
**phase/kind discriminator on the question or answer** (none exists today); and "versioned"
output requires either treating `ai_usage` as the version store (already append-only) or adding
a new versioned script table — the current `piece.script` is overwrite-only.
