# AUDIT — The Truth Machine: transparent pipeline view + evolve-append loop (READ-ONLY)

**Branch:** `claude/audit-truth-machine` · **Date:** 2026-06-18 · **Mandate:** Truth-First, read-only, every claim cites `file:line`. Labels: EXISTS / EXISTS-BUT-UNUSED / MISSING / REUSABLE / RISK.

---

## HEADLINE — the evolve-append engine already exists; this is a UI/transparency reshape

The Projects surface is **already a vertical pipeline** (goals → reality inputs → tasks → evolution), and the **evolve-append loop is fully built on the data side**:
- **Append-only tasks** — `bulk-create` only inserts, never deletes (`tasks/bulk-create/route.ts:198-216`); its own comment calls it "the **append batch**" (`:212`).
- **Run marker** — every task carries `source_ai_usage_id` (`schema:2782`), the FK to the `operations_ai_usage` row of the re-run that produced it.
- **Run versioning + visualization** — `evolution/route.ts:4-15` groups tasks by `source_ai_usage_id` into `versions[]` (v1 = oldest, by `created_at`), already surfaced as the "evolution (trajectory by AI re-run)" panel (`ProjectRowView.tsx:358`).
- **Supersede primitive** — `OperationsTaskStatus` already has `superseded` (`evolution/route.ts:34`).

So the "Truth Machine" is **mostly a presentation build** — show the prompts, show each output under its prompt, stream as it runs, and wire an "evolve" button onto the **existing** append + accept machinery. **No migration is required for the core loop.** (One optional migration only — goals-provenance, §e.)

> Note: Phase 1's research button is **not on `main`** yet (`generateDeepResearch.ts` + `projects/[id]/research/route.ts` are **ABSENT** here — they live on the unmerged `claude/pr-loop-1-research-agent`). Citations below are against current `main`; Phase 1's pattern is referenced as the model.

---

## 1. THE CURRENT PROJECT SURFACE (what we reshape)

**`ProjectRowView.tsx` — the pure view; `ProjectRow.tsx` — the container that owns paid calls.** Three modes: compact / expanded-read / edit (`ProjectRow.tsx:16-18`).

**Expanded READ view (`ProjectRowView.tsx:273-369`)** — already the screenshot's stacked sections:
- `1 · goal` (`:276`), `2 · problem` (`:280`), `3 · diagnosis` (`:284`) — via `renderStructuredField`.
- `4 · design` (`:289`) — the AI plan; toggle "view AI design reasoning" (`:296`).
- **`reality inputs (ground AI regeneration)`** (`:311`) — **two paste boxes side-by-side**: `deep research input` (`:317-324`) + `claude code audit input` (`:327-334`), with a `save inputs` button (`:340`). (PR-Ops-Evolve-1.)
- `5 · execute (tasks)` (`:353`) → `taskSection` slot.
- `evolution (trajectory by AI re-run)` (`:358`) → `evolutionSection` (toggle-mounted).
- `6 · dependencies` (`:370`).

**Edit view (`ProjectRowView.tsx:430-600`)** — holds the two PAID generate buttons: `↑ generate plan` (design, `:513`) and `↑ generate tasks` (`:589`), each firing a container-owned call (`ProjectRow.tsx` `handleGenerateDesign` / `handleGenerateTasks`). Generated output flows through `AITaskPreview` (the human-accept gate) → `bulk-create`.

**Phase 1's button pattern (on the branch, the model to mirror):** a "run deep research" button beside the `deep_research_input` field → POST `projects/[id]/research` → writes the field → the editable textarea shows it for review. Same container-owns-paid-call split. — EXISTS (read view is the pipeline) / REUSABLE.

---

## 2. THE PROMPTS — can we SHOW them?

All three prompt templates are **server-only module constants** (never shipped to the client today):
- **Research:** `generateDeepResearch.ts` SYSTEM_PROMPT + `userMessage` (on the Phase-1 branch).
- **Fusion (tasks):** `generateProjectTasks.ts:94-202` (SYSTEM_PROMPT) + `:212-223` (userMessage, interpolates goal/problem/diagnosis items + the two reality blocks `:206-210`).
- **Design:** `generateProjectDesign.ts:57` (SYSTEM_PROMPT) + `:117` (userMessage).

**The interpolated prompt is ALREADY surfaced — post-call.** `recordUsage` returns `inspection: { systemPrompt, userMessage, rawResponse, model, temperature, maxTokens }` (`recordUsage.ts:83-90, 202-208`); the routes return it (`generate-tasks/route.ts:98`); `ProjectRow` stores it; `InspectionDrawer` displays it. So **"the prompt with your inputs plugged in" is already viewable after a run** (EXISTS-BUT-UNDER-SURFACED — it's behind a drawer).

**To show the prompt BEFORE firing (a preview), the safe pattern:**
- **Server-rendered preview (recommended).** A read-only endpoint that **builds the `userMessage` from the project's saved inputs and returns it WITHOUT calling Anthropic** (no cost, no key, no token spend). It reuses the exact same template/interpolation the real call uses (one source of truth), so the preview is faithful. The system prompt can be returned too — prompts aren't secret; the **API key and the client are what must never leave the server** (`client.ts:18-24`, server-only). This keeps zero sensitive surface client-side.
- **Avoid:** shipping the template constants to the client to interpolate in-browser — it duplicates the template (drift risk) and serves no security benefit over a server preview.

**The audit prompt (Template B) is NOT a stored template** — today it's the manual copy-paste flow (like the Content tab's DAY-AUDIT helper, `ScriptGenerator.tsx:38-43`), not a canonical interpolatable constant tied to the project's goals. To **render** "here's the audit prompt with your goals plugged in," it must first be **authored as a constant** (a `buildAuditPrompt(goals)` template). — **MISSING (the canonical audit-prompt template)**; the research + fusion templates EXIST and are renderable.

---

## 3. THE TRANSPARENT LAYOUT (the new view)

**Recommend a NEW `<TruthMachineView>` (or an expanded "pipeline" mode) — do NOT bloat `ProjectRowView`.** Reasons:
- `ProjectRowView` is a large, deliberately byte-for-byte-stable pure view shared with the **public showroom** (`ProjectsPipelineShowroom.tsx` renders it with locked handlers). Adding prompt-preview + per-stage prompt/output panels + streaming would force matching showroom prop churn each time and risk the "locked, fetch-free" guarantee.
- The Truth Machine is a **different lens** (prompt→output pairs, live streaming, prompt previews), not just more fields.
- **Reuse the leaf pieces**, not the whole view: `renderStructuredField` (goals), `InspectionDrawer` (the prompt/response panel — already exactly "prompt + output"), `AITaskPreview` (the accept gate). A new composition stitches goals → research(prompt+output) → audit(prompt+output) → fusion(prompt+output) → task list → evolve. — **REUSABLE leaf components, new container.**

The stage shape "prompt shown, output under it" maps **directly** onto `InspectionDrawer`'s existing `{ systemPrompt, userMessage, rawResponse }` panel — that component is already a prompt+output renderer (just currently drawer-hidden).

---

## 4. STREAMING (watch the data flow)

**The SSE pattern EXISTS and is reusable:** `trading/convergence/route.ts:78` (`new ReadableStream`), `:98` (`'Content-Type': 'text/event-stream'`), `maxDuration = 300` (`:7`); the client consumes via `EventSource` (the scanner / `ConvergenceIntelligence`). — REUSABLE (transport).

**But the AI calls are NON-streaming today.** `recordUsage` uses `client.messages.create` with `MessageCreateParamsNonStreaming` (`recordUsage.ts:105-119`) — it returns the whole response at once, then logs cost/audit. To stream tokens into the view as the model writes, you'd need a **streaming variant** (`client.messages.stream`) that emits deltas over the SSE `ReadableStream` and reconciles cost/usage at the end (the `message_delta`/`message_stop` usage). — **MISSING (a streaming wrapper); the SSE transport + the non-streaming wrapper both EXIST.** Flag: streaming + `web_search` server-tool interleaving is more complex than plain text streaming (search events arrive mid-stream) — scope accordingly. Honest fallback: a **progress-event** stream ("researching… searching X… fusing…") over the same SSE without true token streaming is much cheaper and still "watch it flow."

---

## 5. THE EVOLVE-APPEND LOOP

**Append: SUPPORTED, native, no migration.**
- `operations_project_tasks` is rows with a `project_id` FK (`schema:2759-2800`); inserting more = append. `bulk-create` **only `create`s** (`route.ts:198-216`) — no `deleteMany`, no replace — and documents itself as "the **append batch**" (`:212`).
- **What marks a task's generation:** `source_ai_usage_id` (`schema:2782`, indexed `:2798`), persisted per batch (`bulk-create/route.ts:214`). Each evolve-run = one immutable `operations_ai_usage` row; its tasks all carry that id. `evolution/route.ts:4-15` already groups by it into ordered `versions[]`. — **EXISTS (the run/generation marker); NO migration needed.**
- **Supersede:** `OperationsTaskStatus.superseded` already exists (`evolution/route.ts:34`) if a later run should retire an earlier task — but note `generateProjectTasks` explicitly "does NOT mark existing tasks as retired — reconciliation happens elsewhere" (`generateProjectTasks.ts:200`). So **append works out-of-the-box; supersede/reconcile is an unbuilt policy** (and must be human-approved).

**Goals: accumulate by appending the JSON array (no migration); per-goal provenance is the one optional gap.**
- `operations_projects.goal_items Json @default("[]")` (`schema:2727`) — a flat array. The project **GROWS** by appending new goal strings to it (no structure change). Last-write-wins on save, so the UI must append (read current + add), not replace.
- There is **no per-goal timestamp or run marker** — if "which evolve-run added which goal" matters, that needs a structured `goal_items` (objects with `added_at`/`run_id`) or a side table. — **OPTIONAL MIGRATION (goals provenance) — MISSING, only if you want goal history; plain accumulation needs nothing.**

**Human checkpoint reusable for appends:** the evolve flow re-runs → `AITaskPreview` shows the proposed new tasks → user accepts → `bulk-create` appends (requires `source_ai_usage_id`, `route.ts:152-159`). The **same accept-gate** the current generate-tasks flow uses works unchanged for evolve-appends. — EXISTS / REUSABLE. No auto-insert.

---

## 6. RISK / SEQUENCING

- **Forward-compat for Phase 3 auto-audit:** YES. The audit output target is `operations_projects.claude_code_audit_input` (the paste box `ProjectRowView.tsx:327-334`). Phase 3's auto-audit writes that **same field** — exactly as Phase 1's research agent writes `deep_research_input`. So a Truth-Machine slot that shows "audit prompt + paste box now" becomes "audit prompt + auto-filled output later" with **no structural change** — same field, same review-then-fuse gate. — Forward-compatible. ✓
- **Migrations:** **none required** for the transparent view, show-prompts, streaming, or evolve-append (tasks). The **only** possible migration is **goals-provenance** (§5), and it's **optional**. Flag explicitly: do not migrate unless goal-history is a hard requirement.
- **Auth (evolve re-fires paid calls):** reuse the established gate — `getVerifiedEmail()` + ownership-scoped project find (`generate-tasks/route.ts:46-58`, mirrored by Phase 1's `research` route). The evolve button hits the same auth-first paid routes; no new auth surface. — REUSABLE. ⚠️ Evolve re-fires research + fusion = real cost per click; add a per-user rate-limit/cost-ceiling (not present today — RISK).

---

## Explicit answers

**(a) Current layout + Phase-1 button.** `ProjectRowView.tsx:273-369` read view: goal/problem/diagnosis (`:276-285`), design (`:289`), reality inputs = research+audit paste boxes (`:311-347`), execute/tasks (`:353`), evolution (`:358`), dependencies (`:370`); generate buttons in the edit view (`:513`, `:589`). Phase 1's "run deep research" button (on branch) sits beside `deep_research_input` and writes the field via the `research` route — **not on `main`**.

**(b) Show prompts safely.** Templates are server-only constants (`generateProjectTasks.ts:94-223`, `generateProjectDesign.ts:57-117`, `generateDeepResearch.ts` on branch). The interpolated prompt is **already returned** post-call via `recordUsage` `inspection` (`recordUsage.ts:202-208`) and shown by `InspectionDrawer`. For a **pre-fire preview**, add a **server endpoint that builds & returns the `userMessage` without calling Anthropic** (no cost, no key) — reuse the same template (one source of truth). Don't ship templates to the client. The **audit prompt is not yet a stored template** (MISSING — must be authored as `buildAuditPrompt(goals)`).

**(c) New view vs extend.** **New `<TruthMachineView>`** (or pipeline mode), reusing `renderStructuredField` + `InspectionDrawer` (already a prompt+output panel) + `AITaskPreview` — keeps `ProjectRowView` and its showroom contract stable.

**(d) Streaming.** SSE transport EXISTS (`trading/convergence/route.ts:78-98` + `EventSource`). The AI calls are **non-streaming** (`recordUsage.ts:105`) — true token streaming needs a **new streaming wrapper** (`messages.stream`); a cheaper **progress-event** stream over the same SSE gets "watch it flow" without it.

**(e) Evolve-append.** **Fully supported, no migration:** append-only `bulk-create` (`:198-216`), run marker `source_ai_usage_id` (`schema:2782`), versioning `evolution/route.ts:4-15`, `superseded` status exists. Goals accumulate by appending `goal_items` (`schema:2727`) — **optional** migration only for per-goal provenance. Accept-gate (`AITaskPreview`→`bulk-create`) reusable for appends.

**(f) Forward-compat for Phase 3.** YES — auto-audit writes the same `claude_code_audit_input` field the paste box uses (`ProjectRowView.tsx:327-334`); the slot is unchanged when the output becomes auto-filled.

**(g) Recommended BUILD sequence:**
1. **PR-TM-1 — transparent pipeline view (MED, no migration).** New `<TruthMachineView>` rendering goals → research (Phase-1 button + output) → audit (prompt + paste box, Phase-3-ready slot) → fusion → task list → (evolve later). Reuse `InspectionDrawer` as the prompt+output panel. **Depends on Phase 1 being merged** (the research button/route).
2. **PR-TM-2 — show the prompts (SMALL-MED, no migration).** Server preview endpoint returning the assembled `userMessage` (+ system prompt) without firing Anthropic; **author the canonical audit-prompt template** (the MISSING piece). No key/client exposure.
3. **PR-TM-3 — streaming (MED, no migration).** Start with a **progress-event** SSE (cheap) reusing `trading/convergence`'s ReadableStream; optionally a true token-streaming wrapper (`messages.stream`) later. Flag: web_search interleaving complicates true streaming.
4. **PR-TM-4 — evolve-append (SMALL on data, MED on UX; optional migration).** "Evolve" button: append goals (`goal_items` push) → re-run research+fusion (auth-gated, reuse Phase-1 gate + cost ceiling) → `AITaskPreview` accept → `bulk-create` **appends** (run-marked) → evolution panel shows the new version. Data layer already done; mostly UX + the human-gated reconciliation policy. **Optional** goals-provenance migration only if needed.

### Citation index
- Layout: `ProjectRowView.tsx:273-369` (read), `:430-600` (edit, generate buttons `:513,:589`); `ProjectRow.tsx` (container paid calls).
- Prompts: `generateProjectTasks.ts:94-223`, `generateProjectDesign.ts:57-117`, `recordUsage.ts:83-90,105-119,202-208`, `InspectionDrawer` (via `ProjectRowView` props).
- Streaming: `trading/convergence/route.ts:7,78,98`; `recordUsage.ts:105` (non-streaming).
- Evolve-append: `tasks/bulk-create/route.ts:152-159,198-216`; `schema.prisma:2759-2800` (tasks, `source_ai_usage_id:2782`), `:2727` (goal_items); `evolution/route.ts:4-15,34`; `generateProjectTasks.ts:200` (no auto-reconcile).
- Auth: `generate-tasks/route.ts:46-58`; `client.ts:18-24` (server-only key).

*Do not build — audit only.*
