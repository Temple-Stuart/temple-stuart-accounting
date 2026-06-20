# ROUTINE AUDIT — Second Occurrence: Fire Payload Still Malformed
**Date:** 2026-06-20  
**Session:** claude/blissful-turing-nwn7pc (second run, same branch)  
**Auditor:** Claude Code Routine (automated, unwatched)  
**Status:** BLOCKED — same root cause as prior session, documented below

---

## CRITICAL FINDING — REPEAT OCCURRENCE

This Routine has been fired a **second time with a malformed payload**. The previous session on this branch (session `01DAK5M7aYRK2CBS4VKghbwK`, commit `0c84ea4`, 2026-06-20) already diagnosed this exact failure. The root cause has NOT been fixed.

**What I received:**
- Generic meta-instructions about the audit methodology (not a `buildAuditPrompt()` output)
- The POST-back instructions contain `{project_id}` as a **literal unsubstituted placeholder** — curly braces included
- No project title, no goal items, no research findings, no `correlation_id`, no real `project_id`

**What `fireAuditRoutine.ts:82–91` should have sent:**
```
AUDIT — diagnose what exists before designing any change. Read-only. Cite file + line...

Project: <project.title>
Goals:
- <goal 1>
- <goal 2>

Research findings (the standard to measure against):
<project.deep_research_input>

Treat the existing system as a machine...
---
correlation_id: <randomUUID()>
project_id: <project.id>
```

**What I actually received:**  
The generic Routine instructions text with `{project_id}` as a template placeholder — clearly a different prompt path than `buildAuditPrompt`.

---

## 1 · WHAT EXISTS (file:line, correctness label)

| File | Line | Label | Note |
|------|------|-------|------|
| `src/lib/fireAuditRoutine.ts` | 56–128 | **CORRECT** | Fire mechanism is correctly coded — builds payload from DB, sends to Routine /fire |
| `src/lib/ai/buildAuditPrompt.ts` | 94–96 | **CORRECT** | Pure string builder — correct output when given real inputs |
| `src/app/api/operations/projects/[id]/audit-ingest/route.ts` | 34–121 | **CORRECT** | Token gate + stored-match + audit log — correct by design |
| `src/middleware.ts` | 106–108 | **CORRECT** | `/audit-ingest` bypass present for token-gated callback |
| `prisma/schema.prisma` | 2762–2766 | **CORRECT** | `claude_code_audit_input`, `audit_correlation_id` fields defined |
| `src/lib/routineFireBudget.ts` | 59–73 | **CORRECT** | Atomic upsert, RoutineBudgetError on cap — no silent fallback |
| `src/lib/auth.ts` | 14–45 | **CORRECT** | JWT verify + dev-only bypass guarded by `!process.env.VERCEL` |
| `src/lib/cookie-auth.ts` | 26–61 | **CORRECT** | HMAC-signed cookie, `timingSafeEqual`, lowercase normalization |
| `src/lib/auth-helpers.ts` | 10–49 | **CORRECT** | `requireTier()` pattern, feature gate before paid calls |
| `src/app/api/ai/spending-insights/route.ts` | 7–63 | **CORRECT** | `getVerifiedEmail` → user lookup → `requireTier` BEFORE OpenAI call |
| `src/app/api/operations/routines/route.ts` | 65–109 | **CORRECT** | `user_id`-scoped query; entity ownership verified before create |
| **The FIRE PAYLOAD itself** | — | **BROKEN** | Routine received generic meta-prompt, not `buildAuditPrompt()` output |

---

## 2 · ASSERTION TEST — PHASE3 Pipeline Outputs

| Assertion | Status | File:Line |
|-----------|--------|-----------|
| **Existence** — `project_id` present in payload | **FAIL** | `{project_id}` is a literal placeholder, unsubstituted |
| **Existence** — `correlation_id` present in payload | **FAIL** | No `correlation_id` in what I received |
| **Existence** — project title in payload | **FAIL** | Not present |
| **Completeness** — goal items in payload | **FAIL** | Not present |
| **Completeness** — research findings in payload | **FAIL** | Not present |
| **Accuracy** — `buildAuditPrompt()` output sent | **FAIL** | Different prompt text was sent |
| **Rights** — audit-ingest POST would pass stored-match | **FAIL** | No `correlation_id` to match against `project.audit_correlation_id` |
| **Auth gate** — token in POST instructions | PRESENT | `temple9stuart4*` visible in payload — security concern below |
| **Cost gate** — `requireRoutineBudget` checked before fire | CORRECT (code) | `routineFireBudget.ts:59` — but a fired job with bad payload still consumed one budget slot |

---

## 3 · CONTROLS & EVIDENCE

**Present and correct (code level):**
- Auth: `getVerifiedEmail()` → `requireTier()` on all AI/paid routes — `auth-helpers.ts:10–49`
- User-scoping: all `operations_routines`, `operations_projects` queries filter `user_id = authedUser.id`
- Audit log: `writeAuditLog()` called on routine create, on audit-ingest receipt
- Paid-API gate: `spending-insights/route.ts:7–21` follows correct order (auth → tier → OpenAI)
- `audit-ingest`: token-gated first (line 44–49), then stored-match (line 80–85)

**Missing / violated at runtime:**
- The fire payload bypassed `buildAuditPrompt()` — the project data never reached this session
- One `operations_routine_usage` budget slot was consumed by this malformed fire (no way to reclaim it from here; `routineFireBudget.ts:62–68` increments before the Routine runs)
- **AUDIT_INGEST_SECRET exposure** — the secret value `temple9stuart4routine7secret2xyz` appears verbatim in the Routine instructions payload, making it visible in this session transcript. This secret should arrive via a Routine environment variable, NOT embedded in the prompt text. If this is the production secret it must be rotated.

---

## 4 · ROOT CAUSE DIAGNOSIS

**Why is the payload generic instead of project-specific?**

The code path in `fireAuditRoutine.ts:82–91` correctly assembles `buildAuditPrompt({ projectTitle, goalItems, deepResearchInput })` and appends the `correlation_id`/`project_id` trailer. This code path is ONLY reachable when called from `operations-pipe-run` (the Inngest job), which:
- Requires `INNGEST_EVENT_KEY` / `INNGEST_SIGNING_KEY` to be configured (prior audit `phase3a-auto-ccaudit-audit.md:13–15` flagged this as a blocker)
- Requires the pipe to be triggered by a user via `run-pipe/route.ts`

**What actually triggered this Routine:**  
The payload does NOT match `buildAuditPrompt()` output. It appears to be a manually-crafted or test-triggered Routine fire that sent a generic meta-prompt without project data interpolated. The instructions contain `{project_id}` as an un-substituted template variable, which is inconsistent with either `fireAuditRoutine.ts` or any code in the codebase.

**Root cause (why, until fixable):**
1. The Inngest pipeline is not yet running in production (INNGEST config gap — blocker from `phase3a-auto-ccaudit-audit.md:13`)
2. Someone is manually triggering this Routine to test it, sending a generic prompt instead of a `buildAuditPrompt()` output
3. The generic prompt includes `{project_id}` as a template variable that was never substituted

---

## 5 · FAILURE MODES & BLAST RADIUS

| Failure Mode | Blast Radius | Severity |
|-------------|--------------|----------|
| Routine budget slot consumed by bad fire | 1 slot of daily cap (10 default) wasted per bad fire | **Medium** — repeated bad fires exhaust the ~10/day cap |
| `AUDIT_INGEST_SECRET` in prompt payload | Secret visible in Claude session transcript; if intercepted → can write arbitrary `claude_code_audit_input` to any project (until the stored-match check blocks it) | **HIGH** — if this is the real production secret, must rotate |
| Audit findings never reach `claude_code_audit_input` | Fusion step reads `'(none provided)'` — tasks generated without real codebase grounding | **Medium** — degrades quality, does not break the pipe |
| `waitForEvent` in `operations-pipe-run` times out | PR #1068 raised timeout to 30m, but a malformed fire means the Routine never POSTs back → timeout fires → proceed-degraded | **Low** — handled gracefully |
| Duplicate audit docs accumulating on this branch | Each bad fire creates a new audit file (this is the second) | **Low** — SOC 2 paper trail noise |

---

## 6 · TRACEABILITY & HONEST DELTA

**Single source of truth:**  
`buildAuditPrompt.ts` is the correct single source for the audit prompt. The `buildAuditSegments` twin exists and both are derived from the same constants — NO-DRIFT is verified in code.

**Where the gap is:**  
The Routine was not triggered via `fireAuditRoutine.ts`'s assembled payload. Until the Inngest pipeline is live AND the fire endpoint is triggered by real project runs, the auto-audit chain cannot produce output.

**Honest delta vs the design standard:**
- The PHASE3 code (fire, ingest, stored-match, budget) is **correctly implemented and already merged**
- The infrastructure to trigger it correctly (Inngest prod config, real project fire) is **not yet live**
- This Routine is being fired manually/experimentally with an incomplete prompt, producing no useful output and consuming budget

**The uncomfortable truth:**  
Every manual Routine fire with this generic prompt wastes one daily budget slot, exposes the ingest secret in the session transcript if it's hardcoded in the payload, and produces a SOC 2 audit file that says "BLOCKED" — not the intended outcome. The system is correctly built but incorrectly triggered.

---

## RANKED FINDINGS BY SEVERITY

| Rank | Finding | Severity |
|------|---------|----------|
| 1 | `AUDIT_INGEST_SECRET` appears in Routine payload verbatim — if real, rotate immediately | **CRITICAL** |
| 2 | Routine fired TWICE with no project context; `buildAuditPrompt()` not being used | **HIGH** |
| 3 | Budget slot consumed per bad fire; 10 slots/day at risk | **MEDIUM** |
| 4 | Inngest prod config gap blocks the full automated chain | **MEDIUM** (pre-existing, known) |
| 5 | Accumulated "BLOCKED" audit files create SOC 2 noise | **LOW** |

---

## ACTIONS REQUIRED (for Alex)

1. **Rotate `AUDIT_INGEST_SECRET`** if `temple9stuart4routine7secret2xyz` is the real production value — it is now in this session transcript.
2. **Do not manually fire this Routine** with a generic prompt — each fire consumes budget and produces no usable output.
3. To test the Routine correctly: fire it via the app's `run-pipe` UI → Inngest job → `fireAuditRoutine()` path (requires Inngest prod config to be live first).
4. Before enabling auto-fire: close the Inngest `INNGEST_EVENT_KEY`/`INNGEST_SIGNING_KEY` config gap so events actually publish/consume in production.
