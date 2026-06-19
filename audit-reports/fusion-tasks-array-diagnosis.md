# DIAGNOSIS — fusion fails: "return_project_tasks tool input did not contain a tasks array" (READ-ONLY)

**Branch:** `claude/diagnose-fusion-tasks-array` · **Date:** 2026-06-19 · **Mandate:** Truth-First, read-only, cite `file:line`. The auto-pipe runs (load-context ✅, research ✅) but **fusion** throws `return_project_tasks tool input did not contain a tasks array`.

---

## ROOT CAUSE (one line)

**`maxTokens: 4000` (`generateProjectTasks.ts:218`) truncates the forced `return_project_tasks` tool call before its `tasks` array JSON finishes.** The tool *is* invoked (the code finds it by name, `:245`), but the model hits the 4000-token output ceiling mid-array — `stop_reason: max_tokens` — so the tool_use block's `input` is incomplete and `input.tasks` is not a valid array → the throw at `:251-252`. **The clincher:** research uses the *same* `maxTokens: 4000` (`generateDeepResearch.ts:164`) and **works**, because research returns **free-form text** (a truncated brief is still valid text), whereas fusion forces a **rigid structured tool** whose `tasks` array must be **complete, valid JSON** to parse. Same limit, opposite outcome — that's the signature of structured-output truncation. Compounded by `web_search` (up to 8 searches, `:233`) burning output tokens in the same call, and amplified to **12 minutes by Inngest retries** (the fusion step doesn't mark this failure non-retriable, so it re-runs the whole search+generation ~4×).

---

## 1 · The tool definition + the exact throw

The fusion call (`generateProjectTasks.ts:212-242`):
- `maxTokens: 4000` (`:218`) — the output ceiling.
- Tools: `web_search_20250305` (max_uses 8, `:231-234`) **+** the custom `return_project_tasks` with `input_schema: TASK_SCHEMA` (`:235-239`).
- `toolChoice: { type: 'tool', name: 'return_project_tasks' }` (`:241`) — the tool is **forced**.

`TASK_SCHEMA` (`:71-92`) is **large**: `tasks` is an array of **up to `maxItems: 30`** (`:88`), each task carrying `title` (≤200), `description` (≤1000), `notes` (≤**1500**), `link_url`, `suggested_order`. One fully-populated task ≈ 700–900 output tokens; even **5–6 tasks exceed 4000 tokens**, and the system prompt asks for an atomic, ordered task list (i.e. many).

The extraction + the throw (`:244-253`):
```
244  // Extract the structured task array from the return_project_tasks tool use.
245  const taskToolUse = (result.toolUses ?? []).find((t) => t.name === 'return_project_tasks');
246  if (!taskToolUse) {
247    throw new Error('AI did not invoke return_project_tasks tool — synthesis failed');
248  }
250  const toolInput = taskToolUse.input as { tasks?: unknown };
251  if (!toolInput || !Array.isArray(toolInput.tasks)) {
252    throw new Error('return_project_tasks tool input did not contain a tasks array');  // ← THIS
253  }
```
**Expected shape:** `taskToolUse.input.tasks` must be an **array** (`:251`). The error at `:252` fires when the tool_use block IS present (we got past `:247`) but its `input.tasks` is **not** an array.

## 2 · Why Claude's tool output lacks a valid `.tasks` — the four candidates, decided

- **(a) max_tokens truncation — ✅ THE CAUSE.** `maxTokens: 4000` (`:218`) vs a tool that emits up to 30 tasks × ~2700 chars. When output hits the ceiling, Anthropic returns the partial `tool_use` block with whatever JSON was emitted — an **incomplete/empty `input`** (`stop_reason: 'max_tokens'`). `input.tasks` is then absent or a broken fragment → `Array.isArray` false → `:252`. The **parse-by-type is correct** (`recordUsage.ts:130-131` filters `b.type === 'tool_use'`), so this isn't a positional bug — the block is found, it's just truncated.
- **(b) tool_choice not forced — RULED OUT.** It **is** forced (`:241`), and we reach `:250` (past the "did not invoke" throw at `:247`), proving the tool *was* called. Not prose-instead-of-tool.
- **(c) schema key mismatch — RULED OUT.** The schema's array property is `tasks` (`:74`) and the code reads `input.tasks` (`:250`) — same key.
- **(d) parse-by-position — RULED OUT.** `recordUsage` extracts by `type === 'tool_use'` (`:130-131`) and `generateProjectTasks` finds by `name` (`:245`) — never `content[0]`.

**Decisive contrast:** research (`generateDeepResearch.ts:164`) runs the *same* `maxTokens: 4000` + `web_search` and **succeeds** — because it returns text (truncation = a shorter brief, still valid), with **no structured-tool parse gate**. Fusion's forced structured tool is the only difference, and structured JSON truncation is exactly what produces "tool_use present, `.tasks` missing."

**The code is blind to it:** `recordUsage` never surfaces `stop_reason` (grep → none), so a `max_tokens` truncation can only surface as this cryptic downstream message — never as "output was truncated."

## 3 · The input-size angle

Yes — fusion injects the **entire research findings** into the prompt: `buildTasksPrompt` interpolates `researchText(input)` = the full `deep_research_input` (`generateProjectTasks.ts:178`, `:167-169`). Now that research writes a long multi-section markdown report, the **input** is large — which doesn't directly truncate the output, but (i) leaves less of the context budget and (ii) the model, grounded in a rich research doc, tries to emit **more/larger tasks**, making the 4000-token **output** ceiling even more likely to clip the `tasks` array. The output ceiling is `maxTokens: 4000` (`:218`); the model also spends output tokens on the up-to-8 `web_search` queries (`:233`) **before** the tasks JSON — so the effective budget left for the array is well under 4000.

## 4 · The 12-minute duration — retries of the truncation failure

The fusion step (`operations-pipe-run.ts:123-141`) wraps **only the budget check** as non-retriable (`chargeBudget` → `NonRetriableError`, `:52-57`). The `generateProjectTasks(...)` call (`:130`) is **not** wrapped — so when it throws the plain `Error` at `:252`, that's an **ordinary error inside `step.run('fusion')`** → **Inngest retries the step** (default policy, ~4 attempts). Each attempt re-runs the full call (the up-to-8 `web_search` round-trips + generation), each taking minutes → **~12 min = the retries**, every attempt clipping at 4000 tokens and failing identically. The 12 minutes is the symptom; the single-call truncation is the root.

---

## Explicit answers

**(a) The exact validation that throws + expected shape.** `generateProjectTasks.ts:250-252` — `const toolInput = taskToolUse.input as { tasks?: unknown }; if (!toolInput || !Array.isArray(toolInput.tasks)) throw …`. It expects `taskToolUse.input.tasks` to be an **array** (tool found by name at `:245`; blocks extracted by `type === 'tool_use'` at `recordUsage.ts:130-131`).

**(b) The most likely reason `.tasks` is absent.** **max_tokens truncation** — `maxTokens: 4000` (`:218`) is far too low for a forced `return_project_tasks` array of up to 30 tasks (`maxItems`, `:88`) × ~2700 chars/task, especially with `web_search` (`:233`) consuming output tokens in the same call. The tool's JSON is cut off (`stop_reason: max_tokens`) → incomplete `input` → no valid `tasks` array. Proven by the research-vs-fusion contrast (same 4000, research survives because it's free text; fusion's structured JSON doesn't).

**(c) THE exact fix.** **Raise `maxTokens` at `generateProjectTasks.ts:218`** from `4000` to **~16000** (the model is `claude-sonnet-4-6`, `client.ts:33`, which supports up to 64k output tokens — 16k comfortably fits ~30 full tasks plus web_search overhead). That single line resolves the truncation; the tool's `tasks` array then completes and parses at `:251`.

**Recommended hardening (flag, not required for the fix):**
1. **Surface `stop_reason` in `recordUsage`** and throw a clear `"output truncated at max_tokens — raise maxTokens"` when `stop_reason === 'max_tokens'`, so future truncations aren't cryptic.
2. **Bound `maxItems: 30` → ~15** (`:88`) to cap worst-case output (a defensive ceiling alongside the higher `maxTokens`).
3. **Make a genuine parse failure non-retriable** in the fusion step (wrap the `generateProjectTasks` throw), so a deterministic failure doesn't burn ~4× cost + 12 min of retries — but with `maxTokens` fixed it should succeed first try.
4. **Consider whether `web_search` belongs in the forced-tool fusion call** — it competes for the output budget and adds the multi-minute latency; dropping it (research already did the web work) would free the entire budget for the task array. Behavior change — flag for decision, not part of the minimal fix.

### Citation index
- The throw + expected shape: `generateProjectTasks.ts:250-252` (validation), `:245` (find by name), `:247` ("did not invoke").
- The ceiling: `generateProjectTasks.ts:218` (`maxTokens: 4000`); schema size `:71-92` (`maxItems: 30`, notes ≤1500); tools `:229-241` (web_search + forced return_project_tasks).
- Contrast (research works on same limit): `generateDeepResearch.ts:164` (`maxTokens: 4000`, free-text output).
- Extraction by type (not position): `recordUsage.ts:130-131`; no `stop_reason` surfaced (grep → none).
- Model capacity: `client.ts:33` (`claude-sonnet-4-6`).
- Input size: `generateProjectTasks.ts:167-169,178` (full research interpolated).
- Retries → 12 min: `operations-pipe-run.ts:123-141` (fusion step; only budget wrapped non-retriable, `:52-57`).

*Read-only — the fix is one line (`maxTokens` at `generateProjectTasks.ts:218`); hardening optional.*
