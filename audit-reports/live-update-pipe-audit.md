# AUDIT — Live-update the pipe view: tasks appear as they land + the "pipe running" badge clears itself (READ-ONLY)

**Branch:** `claude/audit-live-update-pipe` · **Date:** 2026-06-20 · **Mandate:** Truth-First, read-only, NO build, cite `file:line`. The auto-pipe lands `pending_review` tasks async, but the page doesn't auto-update — the user hard-refreshes to see them, and the "pipe running…" badge never clears (PHASE2-4's flagged no-poll choice → this is PHASE2-5).

---

## VERDICT (one paragraph)

The fix is **small and entirely client-side** — **no new endpoint, no migration**. Tasks already load via a **client self-fetch** (`TaskList` is `'use client'`, re-callable), and the **existing task GET already returns `pending_review` tasks** (sorted first). So the build is: after firing the pipe, **`ProjectRow` polls the existing `GET [id]/tasks` every ~5s**, and when the `pending_review` count rises above the at-fire baseline it (1) **clears `pipeQueued`** and (2) **bumps a refresh counter** that makes `TaskList` re-fetch and show the new tasks — mirroring the existing `promptsRefresh` pattern already in `ProjectRow`. A **~5-min timeout** ends the poll honestly: if no tasks landed, clear the badge and show **"no tasks landed — check and retry"** (never an infinite spinner, never a fake success). Showroom-safe (the showroom renders no live `TaskList` and never fires the pipe).

---

## 1 · How the page loads tasks today — CLIENT self-fetch (re-callable)

- **`TaskList` is a client component** (`TaskList.tsx:16` `'use client'`) that **self-fetches** the task list: `fetchTasks()` (`:48-67`) calls `GET /api/operations/projects/${projectId}/tasks` (`:51-53`) and `setTasks(body.tasks)` (`:62`). It runs on mount + when deps change: `useEffect(… , [projectId, showArchived])` (`:70-73`). It also re-fetches on any `TaskRow` `onUpdate`/`onDelete`.
- **No server-component refresh needed** — it's a plain client `fetch`, so it can be re-called any time. **But there is no external "refresh" prop today** — the only re-fetch triggers are mount, `showArchived` toggle, and row mutations. To re-fetch *after the async job lands tasks*, `TaskList` needs an external signal (a `refreshKey` prop in its effect deps) — the one tiny addition this needs.
- **The PLAN section (stage 5)** renders `taskSection` (`TruthMachineView.tsx:83,261`), which `ProjectRow` supplies as `<TaskList projectId entity_id />` (`ProjectRow.tsx:471`). So the plan list IS this `TaskList` — re-fetching it = re-fetching the plan.
- **The GET already returns `pending_review`** — `[id]/tasks/route.ts:62-85` lists all non-archived tasks (`:63-65`), and `STATUS_ORDER` ranks `pending_review: -1` (`:27`) so landed auto-tasks sort **first**. **No new endpoint — the existing GET surfaces exactly what we poll for.**

## 2 · The "running" state — set on 202, never cleared

- `ProjectRow.tsx:96` `const [pipeQueued, setPipeQueued] = useState(false)`. `handleRunPipe` (`:288-…`) POSTs `[id]/run-pipe` and on success `setPipeQueued(true)` (`:300`). **Nothing ever calls `setPipeQueued(false)`** → the badge spins forever.
- `TruthMachineView` renders it (`:264` prop; the header button shows `pipeQueued ? 'pipe running…'` + the explanatory line) — purely a function of the prop, so clearing `pipeQueued` in `ProjectRow` clears the badge.
- **The "done" signal:** there is no client-readable Inngest status. The honest, available signal is the **task list itself** — a **new `pending_review` task that wasn't there when the pipe fired**. So: record a baseline `pending_review` count at fire time; "done" = the polled count exceeds it.

## 3 · Live-update options — recommend (a) polling

- **(a) POLLING the existing GET — RECOMMENDED.** After `setPipeQueued(true)`, `ProjectRow` records the baseline `pending_review` count (one `GET [id]/tasks` at fire), then polls the **same GET** every ~5s. When `pending_review` count > baseline → `setPipeQueued(false)` + bump a `taskRefresh` counter (→ `TaskList` re-fetches, shows them) + stop. **No new infra, reuses the existing endpoint.** Mirrors the existing **`promptsRefresh`** counter pattern (`ProjectRow.tsx:120` `useState(0)`, bumped `setPromptsRefresh(n => n+1)` at `:207,:276`, consumed in a `useEffect` dep at `:154`) — so the codebase already does exactly this shape for the prompt preview.
- **(b) Refetch-on-focus / fixed interval** — lighter, but focus-only could miss the landing while the tab is focused-and-idle, and a blind interval re-fetches forever. The bounded poll (a) with a timeout is both lighter on the server (stops when done) and honest.
- **(c) Inngest realtime / SSE** — real infra (a streaming channel, the `inngest/realtime` package, a token endpoint). **Overkill for a single ~3.5-min job.** Flag, do not recommend now.

**Where the badge clears:** in the poll callback in `ProjectRow` — on "count rose" → `setPipeQueued(false)` (success path); on timeout → `setPipeQueued(false)` + a message (failure path). The poll lives in a `useEffect` keyed on `pipeQueued` (start when true, `clearInterval` on cleanup/unmount) — `ProjectRow` already imports `useEffect`/`useRef` (`:23`).

## 4 · The honest failure case (the truncation bug taught us this)

If the job **fails** (as the maxTokens truncation did), **no new `pending_review` task ever appears** → a naive poll would spin "running…" forever. The fix: **a hard timeout (~5 min)** — comfortably past the ~3.5-min happy path. On timeout with no count increase: `setPipeQueued(false)` + set a message like **"no tasks landed — check and retry"** (not a fake success, not an infinite spinner). The client cannot read Inngest's failure status directly (that needs a server call to Inngest), so **"no tasks within the window" is the honest, available proxy for "didn't land"** — it tells the user to retry without claiming success. (Optional later: a `GET` that reads the latest `operations_ai_pipe_usage` / Inngest run status for a precise failed-vs-running distinction — but that's a new endpoint; the timeout is the SMALL honest version.)

## 5 · Scope / risk

- **Client-side only** — the poll reuses `GET [id]/tasks` (no new endpoint), the badge state is in `ProjectRow`, and the only component change is an **optional `refreshKey` prop on `TaskList`** added to its effect deps (additive — other callers unaffected).
- **No migration** — purely presentational/polling; reads existing rows.
- **Showroom-safe** — the showroom renders **no live `TaskList`** (`showroom/…:11` "No live container (TaskList/EvolutionTimeline/…)") and never fires the pipe; `TruthMachineView` is not showroom-shared. Zero ripple.
- **No new endpoint needed** — confirmed; the existing task GET returns `pending_review` (`route.ts:27,62-85`).

---

## Explicit answers

**(a) How tasks load + how to re-fetch.** Client self-fetch: `TaskList.tsx:48-67` (`fetchTasks` → `GET [id]/tasks`), `:70-73` (effect on `[projectId, showArchived]`). Re-fetch by adding an external `refreshKey` prop to those effect deps (the only `TaskList` change), bumped from `ProjectRow`.

**(b) The `pipeQueued` state + "done" signal.** `ProjectRow.tsx:96` (state), `:300` (set true on 202), never cleared; rendered `TruthMachineView.tsx:264`. "Done" = a **new `pending_review` task** beyond the at-fire baseline (the existing GET returns them, `route.ts:27`).

**(c) Recommended approach + where the badge clears.** **Polling the existing `GET [id]/tasks`** every ~5s from `ProjectRow`, mirroring `promptsRefresh` (`:120,:154,:207`). Badge clears in the poll callback: count-rose → `setPipeQueued(false)` + bump `taskRefresh`; timeout → `setPipeQueued(false)` + message.

**(d) Honest failure handling.** ~5-min timeout → `setPipeQueued(false)` + **"no tasks landed — check and retry."** No infinite spin, no fake success; "no new tasks in the window" is the honest client-side proxy for failure (precise Inngest status would need a new server call — out of scope).

**(e) Client-side-only / no migration / reuses GET / showroom-safe.** All confirmed — no new endpoint (existing task GET returns `pending_review`), no schema change, showroom renders no live `TaskList` and never fires the pipe.

**(f) Recommended BUILD — PHASE2-5 (SMALL, client-side).**
1. **`TaskList`** — add an optional `refreshKey?: number` prop, include it in the `useEffect` deps (`:70-73`) so a bump re-fetches. (Additive; other callers omit it.)
2. **`ProjectRow`** — add `taskRefresh` counter (mirror `promptsRefresh`); pass `refreshKey={taskRefresh}` to both `<TaskList>` instances (`:471,:491`). In `handleRunPipe`, after the 202, capture the baseline `pending_review` count (one GET), then a `useEffect` keyed on `pipeQueued` runs a ~5s `setInterval` poll of `GET [id]/tasks`: on count-rose → `setPipeQueued(false)` + `setTaskRefresh(n=>n+1)` + clear interval; on ~5-min timeout → `setPipeQueued(false)` + set a "no tasks landed — check and retry" message + clear. `clearInterval` on cleanup.
3. **`TruthMachineView`** — optional: render the timeout message (a `pipeError`-style line already exists from PHASE2-4) so the failure path shows. No structural change.
**No new endpoint. No migration. Reuses `GET [id]/tasks`.** ⚠ The only watch-item: poll **bounded** by the timeout (don't poll forever) + `clearInterval` on unmount (no leak).

### Citation index
- TaskList client fetch: `TaskList.tsx:16` ('use client'), `:48-67` (fetchTasks/GET), `:70-73` (effect deps) — no refresh prop today.
- Task GET returns pending_review: `[id]/tasks/route.ts:27` (STATUS_ORDER), `:62-85` (list non-archived, sorted).
- Running state: `ProjectRow.tsx:96` (pipeQueued), `:288-300` (handleRunPipe → set true, never cleared), `:471,:491` (TaskList render); `TruthMachineView.tsx:264` (badge).
- Reusable poll/refresh pattern: `ProjectRow.tsx:120` (promptsRefresh state), `:154` (effect dep), `:207,:276` (bump), `:23` (useEffect/useRef imported).
- Showroom-safe: `showroom/…:11` (no live TaskList/pipe).

*Do not build — audit only.*
