# AUDIT — Content tab: date blocks, remove create-steps, vertical cues, script input→prompt wiring (READ-ONLY)

**Branch:** `claude/audit-content-tab-changes` · **Date:** 2026-06-18 · **Mandate:** Truth-First, read-only, every claim cites `file:line`. Labels: EXISTS / EXISTS-BUT-UNUSED / MISSING / REUSABLE / RISK.

The Content tab is `ContentPipeline.tsx` — four sections (`0·CREATE`, `1·INPUTS`, `2·AI SCRIPT MAP`, `3·ANSWER+RECORD`, `4·SCRIPT`) plus a `·DAY` block. Each scope below is an atomic PR.

---

## SCOPE 1 — DATE/TIME BLOCKS ALWAYS SHOWN

**Where:** the `·DAY` time-blocks block = `DayCalendar` (live container) → `DayCalendarView` (pure view). Mounted at `ContentPipeline.tsx:344` (`<DayCalendar date={date} onDateChange={setDate} />`), above `0·CREATE`.

**Current gate — COLLAPSED by default:**
- `DayCalendarView.tsx:147` — `const [open, setOpen] = useState(false);` ← **the collapse default.**
- Toggle button: `DayCalendarView.tsx:310-323` (`onClick={() => setOpen((o) => !o)}`, shows `▾ hide`/`▸ show` at `:321`).
- **Conditional render:** `DayCalendarView.tsx:344` — `{open && ( …the entire time-blocks body… )}`. So the blocks render **only when `open`**.
- The intent is documented: `ContentPipeline.tsx:343` ("Collapsed by default; sits above 0·CREATE") and `DayCalendarView.tsx:10` ("`open` toggle … STAYS here").

**What makes them ALWAYS visible** (one of):
- Flip the default: `DayCalendarView.tsx:147` `useState(false)` → `useState(true)` (still toggleable, but open on load), **or**
- Remove the collapse entirely: drop the `{open && (` gate at `:344` (render the body unconditionally) + remove the toggle (`:310-323`) and the `open` state (`:147`).

**Label:** EXISTS (collapse gate) — `DayCalendarView.tsx:147, :344`. Note: `DailyLog` (section 3, `ContentPipeline.tsx:560`) is **already always-rendered** (no collapse) — only the `·DAY` block is gated. — **SMALL.**

---

## SCOPE 2 — REMOVE "STEP ZERO: CREATE A PROJECT" (and the routine equivalent)

**The create-step:** `ContentPipeline.tsx:346-397` — section **`0 · CREATE`** ("make a project · make a routine"), collapsible (`createOpen`, `:90` `useState(false)`). Inside (`:371-396`) it mounts **both** creators:
- **Create a project:** `<ProjectCreateForm … onCreated={handleProjectCreated} />` (`:377-382`).
- **Create a routine:** `<RoutineCreateForm … onCreated={handleRoutineCreated} />` (`:388-393`).
- These are the **same components the Projects/Routines tabs use** — imported from `../projects/ProjectCreateForm` (`:34`) and `../routines/RoutineCreateForm` (`:35`) ("one source of truth each", `:347-348`).
- Supporting code to remove with it: `createOpen`/`setCreateOpen` (`:90`), `createMsg` (`:91`, banner `:365-369`, auto-clear effect `:188-192`), and the two handlers `handleProjectCreated` (`:196-200`) / `handleRoutineCreated` (`:201-205`).

**Does a SELECTOR already exist? YES — `1·INPUTS` already selects existing projects/routines.** Removing creation needs **no new selector**:
- **Routines selector** — `ContentPipeline.tsx:491-532`: lists existing routines from **`/api/operations/routines`** (fetched `:136`) and selects/orders them (`toggle` `:214-215`, `selected` state `:78`). Empty state already says "create one on the Routines tab" (`:495`).
- **Project tasks selector** — `ContentPipeline.tsx:411-488`: lists existing unscheduled tasks from **`/api/operations/tasks/unscheduled`** (fetched `:137`) and adds them to the day (`addTaskToDay` `:229-264`).
- So the existing-list sources to select FROM already back both queues. — **EXISTS / REUSABLE.**

**RISK — downstream id-dependency? NONE.** The create handlers produce **no id consumed downstream** — `handleProjectCreated`/`handleRoutineCreated` (`:196-205`) only `setCreateOpen(false)`, set a toast, and call `load()` (re-fetch the lists). The downstream consumer is `2·AI SCRIPT MAP` → `<ScenifyDraft routines={selectedRoutines} … />` (`:538-539`), and `selectedRoutines` (`:217-224`) derives from the **selected routines in the list**, not from creation. Tasks flow via `addTaskToDay` using **list** task ids. So removing `0·CREATE` orphans nothing — the only thing lost is the in-tab convenience of creating without leaving the page (creation still lives on the Projects/Routines tabs). — **No RISK to downstream.** — **SMALL-MED.**

---

## SCOPE 3 — VERTICAL-STACK THE CUES (projects/routines input)

The "cues" = the `1·INPUTS` lists (`ContentPipeline.tsx:399-535`). Two layers stack horizontally + truncate:

**Layer A — the two columns sit side-by-side (horizontal):**
- `ContentPipeline.tsx:408` — `<div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">` → **Project tasks (left) + Routines (right)** are side-by-side on `md+`.
- **Vertical fix:** drop `md:grid-cols-2` (keep `grid-cols-1`) → the two lists stack vertically.

**Layer B — each task ROW is a horizontal multi-column grid with truncation (the data cut off):**
- Row container `ContentPipeline.tsx:427` — `className="grid items-start gap-2 … grid-cols-[minmax(0,1fr)_11.5rem] lg:grid-cols-[minmax(0,3fr)_minmax(0,1fr)_minmax(0,1fr)_11.5rem]"` → title | project | entity | button, all in one horizontal row.
- **Truncation cutting the text:**
  - Title: `:429` `className="… line-clamp-2"` (clamps to 2 lines).
  - Project: `:433` `className="hidden lg:block text-text-muted truncate"` (**truncated AND hidden below `lg`**).
  - Entity: `:439` `className="hidden lg:block text-text-muted truncate"` (**truncated AND hidden below `lg`**).
- **Vertical fix:** change the row `:427` to a vertical stack (e.g. `flex flex-col` / `grid-cols-1`), and remove `line-clamp-2` (`:429`), `truncate` + `hidden lg:block` (`:433`, `:439`) so title + project + entity show in full, stacked.

**Routines rows (`:502-525`):** already a single horizontal flex row (`flex items-center gap-2`, `:506`) — name (`flex-1`, `:518`), entity (`break-words`, `:520`, not truncated), step-count (`:522`). Less truncation, but still horizontal; the same vertical treatment applies if desired.

**Label:** EXISTS (horizontal + truncated) — `ContentPipeline.tsx:408, 427, 429, 433, 439`. — **SMALL** (layout classes only, no logic).

---

## SCOPE 4 — SCRIPT-MAP INPUT→PROMPT WIRING (SHOW-ONLY)

**The chain:** `ScriptGeneratorView` (pure UI) ← `ScriptGenerator` (container, `ContentPipeline.tsx:565`) → **POST `/api/operations/content/generate-script`** (`generate-script/route.ts`) → **`generateReelScript()`** (`src/lib/ai/generateReelScript.ts`) → Anthropic (`MODEL_SONNET_4`, `recordUsage`).

### The inputs (what actually feeds the prompt)
The POST body is **only `{ piece_id }`** (`ScriptGenerator.tsx:149-154`). Everything else is loaded server-side from that day's piece:

| Input | UI origin | Loaded in route | → prompt |
|---|---|---|---|
| **piece_id** | the selected day's piece (`ScriptGenerator.tsx:85-88`) | `route.ts:65-70` | resolves the day |
| **scenes** (answers) | answered in `3·ANSWER+RECORD` (`PieceGrid`/`DailyLog`), stored as `operations_content_takes.script` | `route.ts:74-126` (takes ⨝ scene-row ⨝ routine_step; `scene_number/activity/time/narrative/b_roll/question/answer`) | userMessage "THE DAY'S SCENES" |
| **tasks** (record) | `operations_daily_plan_items` + `calendar_blocks` (added via `1·INPUTS` add-to-day) | `route.ts:129-172` (`title/project/status/planned/scheduled/actual`) | userMessage "THE TASK RECORD" |
| **executionNotes** | the **"Execution notes" textarea** in `ScriptGeneratorView` (`ScriptGeneratorView.tsx:139-154`), saved via PATCH `piece.execution_notes` (`ScriptGenerator.tsx:112-133`) | `route.ts:182` (`piece.execution_notes`) | userMessage "EXECUTION NOTES" block |
| **dateLabel** | the day key | `route.ts:70, 178` | userMessage "DAY:" |

> Note: the **DAY-AUDIT prompt** (`ScriptGenerator.tsx:38-43`, displayed/copied in `ScriptGeneratorView`) is **NOT sent to the model** — it's a helper Alex runs in Claude Code to *produce* the execution-notes text he pastes in. Only `execution_notes` reaches the model.

The route assembles `ScriptSceneInput[]` (`route.ts:118-126`) + `ScriptTaskInput[]` (`route.ts:147-172`) and calls `generateReelScript({ userId, userEmail, pieceId, dateLabel, scenes, tasks, executionNotes: piece.execution_notes })` (`route.ts:174-183`).

### The assembly (where each input is interpolated)
In `generateReelScript.ts`:
- **`bulletScenes(scenes)`** (`:110-123`) renders each scene as `[scene N · activity · time]` + `narrative purpose:` + `b-roll:` + `question:` + `ANSWER:`.
- **`bulletTasks(tasks)`** (`:125-137`) renders each task as `- {title} ({project}) — {status} · {actual|scheduled|no time}`; empty → `(no project tasks on the calendar this day)`.
- **`executionBlock`** (`:140-144`) — if notes present, an AUTHORITATIVE block with the notes; else a "(none provided …)" placeholder.
- **`userMessage`** template (`:146-156`) interpolates `dateLabel`, `bulletScenes(...)`, `bulletTasks(...)`, `executionBlock`.
- Call params (`:160-173`): `model: MODEL_SONNET_4`, `maxTokens: 1500`, `temperature: 0.85`, `purpose: 'reel_voiceover_generation'`.

### THE FULL PROMPT — VERBATIM

**SYSTEM prompt** — `generateReelScript.ts:54-108`:
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

**USER message** — `generateReelScript.ts:146-156` (template; `${…}` are the interpolation points):
```
DAY: ${input.dateLabel}

THE DAY'S SCENES (in clock order — these are the life-footage beats; voice the BODY from these answers):
${bulletScenes(input.scenes)}

THE TASK RECORD (the calendar blocks — planned vs actual; the skeleton of the proof-burst):
${bulletTasks(input.tasks)}

${executionBlock}

Write Alex's reel voiceover per the format and his voice. Scene-map every beat. Ground every work claim in the execution notes + task record + answers. Never fabricate.
```

**Per-scene rendering** (`bulletScenes`, `:110-123`), each scene:
```
[scene ${scene_number} · ${activity}${ · time?}]
  narrative purpose: ${narrative?}
  b-roll: ${b_roll?}
  question: ${question?}
  ANSWER: ${answer}
```
**Per-task rendering** (`bulletTasks`, `:125-137`), each task:
```
- ${title}${ (project)?} — ${status} · ${actual ? `actual ${actual}` : scheduled ? `scheduled ${scheduled}` : 'no time'}
```
**Execution-notes block** (`:140-144`):
- with notes → ``EXECUTION NOTES — Alex's authoritative receipts … (this is the AUTHORITY; … where this differs from a title, THIS wins):\n${notes}``
- without → ``EXECUTION NOTES: (none provided — task titles are LABELS only; keep the proof-burst HIGH-LEVEL, never invent work specifics).``

**Input→prompt binding summary (file:line):**
- `execution_notes` textarea (`ScriptGeneratorView.tsx:139-154`) → PATCH (`ScriptGenerator.tsx:117-122`) → `piece.execution_notes` (`route.ts:182`) → `executionBlock` (`generateReelScript.ts:140-144`) → userMessage `${executionBlock}` (`:154`).
- day answers (`PieceGrid`/`DailyLog`) → `operations_content_takes.script` → `scenes` (`route.ts:74-126`) → `bulletScenes` (`:110-123`) → userMessage "THE DAY'S SCENES" (`:148-149`).
- add-to-day tasks (`1·INPUTS`, `ContentPipeline.tsx:229-264`) → `daily_plan_items`+`calendar_blocks` → `tasks` (`route.ts:129-172`) → `bulletTasks` (`:125-137`) → userMessage "THE TASK RECORD" (`:151-152`).
- date → `dateLabel` (`route.ts:178`) → userMessage "DAY:" (`:146`).
- SYSTEM voice contract (`:54-108`) → `recordUsage({ systemPrompt })` (`:164`).

**Label:** EXISTS — fully wired, SHOW-ONLY (no build). This audit is the deliverable for Scope 4.

---

## Explicit answers

**(a) Date blocks.** Gate = `DayCalendarView.tsx:147` `useState(false)` + the `{open && …}` render at `:344` (toggle `:310-323`). Always-visible = flip `:147` to `useState(true)` **or** remove the `:344` gate + toggle. (`DailyLog` is already always-on.)

**(b) Create steps.** `0·CREATE` at `ContentPipeline.tsx:346-397` mounts `ProjectCreateForm` (`:377`) + `RoutineCreateForm` (`:388`). **A selector already exists** — `1·INPUTS` selects existing routines (`:491-532`, from `/api/operations/routines` `:136`) and existing tasks (`:411-488`, from `/api/operations/tasks/unscheduled` `:137`); nothing new to build. **No downstream id-dependency** — the create handlers (`:196-205`) only refresh lists; `ScenifyDraft` consumes `selectedRoutines` from the list (`:217-224, :538`). Clean removal.

**(c) Cues layout.** Horizontal: outer `grid … md:grid-cols-2` (`ContentPipeline.tsx:408`) + per-task-row `grid-cols-[…]` (`:427`). Truncation: `line-clamp-2` (`:429`), `truncate`+`hidden lg:block` (`:433`, `:439`). Vertical fix: `:408`→`grid-cols-1`, `:427`→`flex flex-col`/`grid-cols-1`, remove the clamp/truncate/hidden at `:429/:433/:439`.

**(d) Script wiring.** Inputs: `piece_id` → scenes (answers) + tasks (record) + `execution_notes` + dateLabel (`route.ts:74-183`). Assembly: `bulletScenes`/`bulletTasks`/`executionBlock` → `userMessage` (`generateReelScript.ts:110-156`). Full verbatim SYSTEM (`:54-108`) + USER (`:146-156`) templates quoted above; each input→prompt binding cited. Only `execution_notes` is a direct UI-typed input to the prompt; scenes/tasks come from the day's logged data; the DAY-AUDIT prompt (`ScriptGenerator.tsx:38-43`) is a helper, not sent.

**(e) Recommended PR sequence (Scopes 1-3 build; Scope 4 is show-only):**
1. **PR-Content-1 — date blocks always visible (SMALL).** `DayCalendarView.tsx:147` → `useState(true)` (or remove the `:344` gate + toggle). One-file, display only.
2. **PR-Content-3 — vertical-stack the cues (SMALL).** `ContentPipeline.tsx:408/427/429/433/439` — `grid-cols-1` + remove truncation. Layout classes only; no logic, no data.
3. **PR-Content-2 — remove `0·CREATE` (SMALL-MED).** Delete the section `:346-397` + its state/handlers (`:90-91, 188-205, 365-369`) + the two now-unused imports (`:34-35`). Selectors already exist (Scope 2); verify no other reference to `createOpen`/`handleProjectCreated`/`handleRoutineCreated`. Slightly larger only because it removes state + imports (tsc/lint must stay clean).
- **Scope 4 — no build.** This report surfaces the complete input→prompt wiring for later tuning.

### Citation index
- Date blocks: `DayCalendarView.tsx:147, 310-323, 344`; mount `ContentPipeline.tsx:344`.
- Create steps: `ContentPipeline.tsx:34-35, 90-91, 188-205, 346-397`; selectors `:411-488, 491-532, 136-137, 217-224, 538`.
- Cues: `ContentPipeline.tsx:408, 427, 429, 433, 439, 502-525`.
- Script wiring: `ScriptGenerator.tsx:38-43, 112-133, 143-164`; `ScriptGeneratorView.tsx:139-154`; `generate-script/route.ts:56-183`; `generateReelScript.ts:54-108, 110-137, 139-173`.

*Do not implement — audit only.*
