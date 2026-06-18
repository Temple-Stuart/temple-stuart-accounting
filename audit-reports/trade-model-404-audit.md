# AUDIT — "Scan failed" 404 on `claude-sonnet-4-20250514` (READ-ONLY)

**Branch:** `claude/audit-trade-model-404` · **Date:** 2026-06-18 · **Mandate:** Truth-First, read-only, cite `file:line`, no fixes.

**Symptom:** The convergence scan shows `Scan failed — 404 … model: claude-sonnet-4-20250514`. The data pipeline runs, but the Anthropic synthesis call 404s on a retired model ID.

---

## TL;DR

- **The 404 fires in the SCAN's synthesis step:** `src/app/api/ai/convergence-synthesis/route.ts:346` — `model: 'claude-sonnet-4-20250514'` (HARDCODED, **does not** use the shared constant). **EXISTS / RISK.**
- The model string `claude-sonnet-4-20250514` (Sonnet 4, dated 2025-05-14) is **retired → 404** in production. The codebase already uses the current Sonnet **`claude-sonnet-4-6`** elsewhere — that's the correct replacement.
- It is **SCATTERED, not DRY:** the bad string is hardcoded at **6 route call-sites** *and* baked into the shared constant `MODEL_SONNET_4` (`src/lib/ai/client.ts:31`) + the cost-map keys (`:39`, `:43`). The 404-ing scan route **bypasses** the constant entirely.
- **The 404 blocks the usable scan**, not just a cosmetic enrichment: the raw pipeline data (steps A–T) is fetched, but synthesis produces the ranked `top_9` that the entire results UI is built on. On synthesis failure the client `throw`s → `batchError` → "Scan failed", and `batchData`/`top_9`/enrichment never populate.

---

## (a) Every Anthropic model string in the trading/convergence scan path

The scan = `ConvergenceIntelligence.scanMarket` → (1) EventSource `/api/trading/convergence` (data pipeline) → (2) POST `/api/ai/convergence-synthesis` (Claude ranking/synthesis).

| Step | Model string | file:line | Status |
|------|--------------|-----------|--------|
| News classification (inside pipeline) | `claude-haiku-4-5-20251001` | `src/lib/convergence/news-classifier.ts:25` | **VALID** (Haiku 4.5 — current dated ID) |
| Sentiment (inside pipeline) | `grok-4-1-fast` | `src/lib/convergence/sentiment.ts:155` | xAI/Grok — **not Anthropic**, not the 404 |
| Sentiment (inside pipeline) | `grok-4-1-fast-non-reasoning` | `src/lib/convergence/sentiment.ts:218` | xAI/Grok — **not Anthropic**, not the 404 |
| **Synthesis / ranking (the scan's Claude call)** | **`claude-sonnet-4-20250514`** | **`src/app/api/ai/convergence-synthesis/route.ts:346`** | **404 — THE failing call** |

- The convergence route itself (`src/app/api/trading/convergence/route.ts`) names **no model** — the model strings live in `lib/convergence/*` and the synthesis route. **EXISTS (clean).**
- **Proof the SDK/key/format work in the scan:** the same scan successfully calls Haiku (`news-classifier.ts:25`, `claude-haiku-4-5-20251001`). The failure is specific to the **retired Sonnet string**, not auth or wiring.

### Same stale string outside the scan (same bug, other features)
Hardcoded `model: 'claude-sonnet-4-20250514'` also at:
- `src/app/api/ai/market-brief/route.ts:189`
- `src/app/api/ai/strategy-analysis/route.ts:127`
- `src/app/api/ops/ai-plan/route.ts:110`
- `src/app/api/ops/ai-plan/route.ts:130`
- `src/app/api/ops/brain-dump/route.ts:63`

And via the **shared constant** `MODEL_SONNET_4 = 'claude-sonnet-4-20250514'` (`src/lib/ai/client.ts:31`), consumed by:
- `src/lib/ai/enrichRoutineScenes.ts:184`
- `src/lib/ai/generateNorthStarSectionOptimization.ts:288`
- `src/lib/ai/generateProjectDesign.ts:146`
- `src/lib/ai/generateProjectTasks.ts:236`
- `src/lib/ai/generateReelScript.ts:163`

> So **every Sonnet call in the app** points at the retired ID — the content script generator, project design/tasks, ops AI, and the trading scan would all 404 on Sonnet. Only Haiku (news-classifier) is on a current ID.

---

## (b) The exact 404-ing model string + which call

- **String:** `claude-sonnet-4-20250514` (Claude Sonnet 4, dated 2025-05-14 — **retired**).
- **Call:** `src/app/api/ai/convergence-synthesis/route.ts:346`, inside `callWithRetry(client, { model: 'claude-sonnet-4-20250514', max_tokens: 4000, temperature: 0.2, system: SYSTEM_PROMPT, messages: [...] })` (client = `new Anthropic({ apiKey })` at `:342`).
- Triggered from `src/components/convergence/ConvergenceIntelligence.tsx:4639` (POST `/api/ai/convergence-synthesis`).

---

## (c) Known-good current model string (the correct replacement)

- **`claude-sonnet-4-6`** (Claude Sonnet 4.6 — current Sonnet). Already present in this repo:
  - `src/lib/discovery/runDiscovery.ts:8` — `const MODEL = 'claude-sonnet-4-6';`
  - `src/components/workbench/operations/projects/showroom/demoData.ts:333,348` (demo strings)
- Corroborating valid current dated ID in the **same scan**: `claude-haiku-4-5-20251001` (`news-classifier.ts:25`) — proves the new model-family format is what works.
- **Recommended replacement for the 404:** `claude-sonnet-4-20250514` → **`claude-sonnet-4-6`**.

---

## (d) DRY or scattered — every location a complete fix must touch

**SCATTERED.** A shared constant exists but the failing scan route does **not** use it.

**Minimal fix (unblocks the reported scan only) — 1 line:**
- `src/app/api/ai/convergence-synthesis/route.ts:346`

**Complete fix (all Sonnet calls; the constant itself is stale) — touch all of:**
1. Constant + cost map: `src/lib/ai/client.ts:31` (`MODEL_SONNET_4`), `:39` and `:43` (cost-map keys — keyed by the model string).
2. Hardcoded route call-sites (bypass the constant):
   - `src/app/api/ai/convergence-synthesis/route.ts:346`
   - `src/app/api/ai/market-brief/route.ts:189`
   - `src/app/api/ai/strategy-analysis/route.ts:127`
   - `src/app/api/ops/ai-plan/route.ts:110` and `:130`
   - `src/app/api/ops/brain-dump/route.ts:63`
3. (Consumers of the constant at `lib/ai/*:184/288/146/236/163` auto-fix once `client.ts:31` is updated.)

**RISK — cost map (`client.ts:39,43`):** the per-million cost map is keyed by the model string, and `computeCost` "Throws if model isn't in the cost table" (`client.ts:48-50`). If the constant is changed to `claude-sonnet-4-6` **without** adding/renaming the `claude-sonnet-4-6` keys in both `COST_PER_MILLION_INPUT_USD` and `COST_PER_MILLION_OUTPUT_USD`, any consumer that records usage will **throw**. (The scan route at `:342` instantiates `new Anthropic` directly and does not appear to call `computeCost`, so the *minimal* one-line fix is not exposed to this — but the *complete* fix is.)

---

## (e) Does the 404 block the whole scan or just enrichment?

**It blocks the usable scan output.** Flow in `src/components/convergence/ConvergenceIntelligence.tsx`:

1. `:4636` `setPipelineResult(pipelineResults)` — the **data pipeline (steps A–T) completes and is stored** *before* synthesis.
2. `:4639-4647` POST `/api/ai/convergence-synthesis`; on `!resp.ok` → `throw new Error(body.error || 'Synthesis HTTP …')` (`:4646`). The 404 lands here.
3. `:4694-4696` `catch` → `setBatchError(...)` + `setScanning(false)`.
4. `:4788` renders the red **"Scan failed"** banner from `batchError`.

Because the `throw` happens **before** `:4652 setBatchData(json)`, the synthesis response (`json.top_9`, the ranked set) is never set, and the enrichment loop (`:4655` `json.top_9.map(...)`) never runs. The ranked/enriched results the UI is built around depend on synthesis — so although raw pipeline data is fetched, **the scan is effectively unusable** on the 404. It is **not** "just an enrichment step."

---

## (f) Recommended fix (SMALL)

**Immediate (fixes the reported scan 404):** one line —
- `src/app/api/ai/convergence-synthesis/route.ts:346`: `claude-sonnet-4-20250514` → `claude-sonnet-4-6`.

**Recommended (DRY, app-wide — the constant is stale and every Sonnet feature is affected):**
1. `src/lib/ai/client.ts:31`: `MODEL_SONNET_4 = 'claude-sonnet-4-6'`.
2. `src/lib/ai/client.ts:39` & `:43`: rename the cost-map keys `'claude-sonnet-4-20250514'` → `'claude-sonnet-4-6'` (keep the $3 / $15 values, or update to current pricing) so `computeCost` doesn't throw.
3. Replace the 6 hardcoded call-site strings (convergence-synthesis:346, market-brief:189, strategy-analysis:127, ops/ai-plan:110 & :130, ops/brain-dump:63) with `MODEL_SONNET_4` imported from `@/lib/ai/client` — so the model lives in exactly one place going forward.

No code changed in this audit (read-only).
