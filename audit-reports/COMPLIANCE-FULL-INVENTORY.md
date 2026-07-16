# COMPLIANCE-FULL-INVENTORY — read-only audit

**Date:** 2026-07-16 · **Branch:** `claude/compliance-full-inventory` · **Mode:** READ-ONLY (no code changes, no design)
**Purpose:** the complete map of the real Compliance tab — the RECEIPTS tab — for the FINAL showcase deck
(Bloomberg template, proven ×8). This tab carries the platform's institutional claims, so this audit's
center of gravity is PRECISION ON THE HONESTY MECHANICS: the hash chain and citation verification exactly
as they work, because a skeptical engineer will test those first.

Verification method: I read the chain writer, chain verifier, citation verify route + lib, the citations
and audit_log schema models, the workbench shell, the mount gating, and every UNBUILT badge firsthand;
three parallel read-only sweeps covered sections A–J and the six sub-pages, and every load-bearing cite
below was re-verified by direct read on `main` (`70aa06d8`).

---

## 0. Entry + gating

| Surface | Cite |
|---|---|
| Mount: entitled/admin → `<ComplianceWorkbench/>`; locked → `<ComplianceShowcase/>` + unlock CTA | `ModuleLauncher.tsx:940-943` |
| Client lock `isTabLocked('tab:compliance', …)` | `ModuleLauncher.tsx:234`, `categoryLock.ts:27-30` |
| Server gate `requireTabAccess(userId,'tab:compliance')` (bundle:all honored, admin bypass, fail-closed) | `auth-helpers.ts:65-75` → `entitlements.ts:47-61` |
| Unlock CTA → real Stripe checkout, key `tab:compliance` | `TabShowcases.tsx` LockedTabCard → `/api/stripe/checkout-entitlement` |
| The workbench = Sections A–J + a 6-link sub-page row (Profile/Discovery/Registry/Citations/Audit Log/Missions) | `ComplianceWorkbench.tsx:30-67`; same order as `/compliance` (`compliance/page.tsx:36-47`) |

**⚠️ THE REAL A–J ≠ the old showcase's A–J line.** The rendered sections are: **A** identity bar ·
**B** founder profile · **C** corpus context · **D** discovery launcher (UNBUILT) · **E** live stream
(UNBUILT) · **F** roadmap · **G** citation verification (UNBUILT display) · **H** corpus inspector ·
**I** audit tail · **J** cost ledger (UNBUILT). The old showcase's line — *"identity → registry →
citations → discovery → missions → tasks → attestations → evidence → audit chain → SOC 2 view"*
(`TabShowcases.tsx:590`) — is a different, partly aspirational list. The deck must describe the REAL
sections + sub-pages (§9 banned list #12).

---

## 1. THE CORPUS — live counts, real crons, seeded registry

**Section C (`SectionC_CorpusContext.tsx`)** renders three stat tiles — `documents`, `chunks`,
`superseded` — plus a `last ingestion event` block and a per-source table (domain / documents /
last fetched), polling `/api/workbench/corpus-context` every 30s (`:47,56`). Empty state: *"no
ingestion runs yet — first cron at 06:00 UTC"* (`:88`).

**Counts provenance — LIVE DB AGGREGATES, hardcoded nowhere:** `SELECT COUNT(*) FROM
regulatory_documents` / `regulatory_document_chunks` / superseded (`corpus-context/route.ts:31-41`);
last-ingest = the newest `regulatory_ingest_run_completed` audit_log row (`:42-54`); per-source = a
LEFT JOIN with `MAX(retrieved_at)` freshness (`:55-74`). The screenshot figures "19,236 documents /
141,174 chunks" appear NOWHERE in the repo (whole-tree grep) — they were the live aggregates at
screenshot time. Sources seed from `prisma/seed-data/regulatory_sources.json` (ecfr.gov,
federalregister.gov, uscode.house.gov, irs.gov, govinfo.gov, congress.gov, FTC/FinCEN/Treasury/FASB…).

**The ingest machinery (Inngest, all real, each run writing a `regulatory_ingest_run_completed`
audit row the UI displays):** eCFR daily 06:00 UTC (`ecfr-ingest.ts`, audit `:172-175`); US Code
weekly Sun 07:00 (`uscode-ingest.ts:200-203`); Federal Register hourly (`fedreg-ingest.ts:171-174`);
IRS Internal Revenue Bulletin daily 02:00 (`irb-ingest.ts:170-173`); Voyage embedding worker every 6h
under a $10/run cap (`embed-pending.ts:7-9`, cron `5 */6 * * *`).

**⚠️ Gating inconsistency (flag):** `corpus-context` and `recent-chunks` are AUTH-ONLY — no
`tab:compliance` gate (`corpus-context/route.ts:22-26`, verified firsthand; `recent-chunks/route.ts:35-39`)
— any logged-in unentitled user can read live corpus counts/chunks. Cheap DB reads (no paid calls), but
inconsistent with the rest of the tab.

**The REGISTRY (`/compliance/registry`)** = the `regulatory_sources` allow-list rendered read-only:
*"Regulatory Source Registry / Foundation for verification-first compliance. {N} verified authoritative
sources."* (`registry/page.tsx:98-101`) — columns Source/Domain/Tier/Rank(1-5)/Jurisdictions/Modules/
Cadence/Notes, tier filters (primary_law → secondary_practitioner). Route tab-gated
(`regulatory-sources/route.ts:8-22`). The registry's `is_active` is what the citation verifier's
source-authority check reads, and discovery's web search is domain-restricted to it (§4).

---

## 2. CITATION VERIFICATION — the exact mechanics (precision item #1)

**The model** (`schema.prisma:2141-2199`, read firsthand): a citation is version-locked at creation —
`stable_uri` (unique), `retrieved_url`, `retrieved_at`, **`retrieved_content_hash`** (SHA-256 of the
retrieved body), `version_label`, `effective_date`, supersession + hierarchy self-relations, `status`
(CitationStatus: `unverified` default / verified / superseded / withdrawn / unreachable /
pending_review), `last_verified_at/by`, notes, and **eight per-check columns**
(`VerificationCheckResult`: passed/failed/not_applicable/error). No `userId` (a shared global
regulatory library). **No `is_pinned` field exists.**

**The verify flow** (all firsthand):
1. Gate order on `POST /api/citations/[id]/verify` — cookie auth 401 → user 404 →
   `requireTabAccess('tab:compliance')` 403 → **per-USER rate limit `citation-verify:{email}` 10/60s
   BEFORE the outbound calls** (fail-closed; 429 verbatim *"Too many verification requests — please
   slow down and try again shortly."*) — `verify/route.ts:14-39,108-112`.
2. `verifyCitation()` runs **6 live checks of the 8 defined** (`verifyCitation.ts:99-157`):
   - `existence` — HTTP **HEAD** `retrieved_url` (200/301/302 pass; 404/410 fail) `:24-41`
   - `content_hash` — HTTP **GET**, SHA-256 the entire body, compare to the pinned
     `retrieved_content_hash` (*"hash mismatch — content may have changed"*) `:78-97`
   - `source_authority_match` — the registry row must be `is_active` `:67-76`
   - `currency` (superseded or no effective_date → fail) `:43-51` · `pinpoint` `:53-58` ·
     `supersession` `:60-65`
   - **`groundedness` and `jurisdiction_match` are hardcoded `not_applicable`** with honest notes
     *"deferred to PR-E (requires AI text analysis / task context)"* `:116-128`.
3. `overall_status`: all implemented passed → `verified`; some → `partial`; none → `failed`
   (`:130-148`); route maps verified→verified, failed→**unreachable**, partial→**pending_review**
   (`verify/route.ts:48-54`), updates the row + all 8 check columns, and writes a `citation_verified`
   audit row with before/after (`:56-104`).

**Verification is against the SOURCE URL + pinned hash — NOT corpus chunks.** And it is
**manual-only**: zero re-verification-on-ingest logic exists (grep of `src/lib/corpus/ingest/*`,
citations lib, and routes: no citation writes, no stale status, no hook — verified firsthand).

**What renders** (`/compliance/citations`, `citations/page.tsx`): header *"Verification-first citation
tracking with 8-step integrity protocol."* (`:176-179`), filter bar, table (Citation/Type/Source/
Status/Pinpoint/Verified/Actions), a **status badge** per row (emerald `verified`), relative
`last_verified_at`, and a Verify action. **The 8 per-check results are stored and audited but never
displayed** — the UI shows only the badge. Empty state: *"No citations yet. Citations populate as
compliance tasks are created in PR-D."* (`:220`). The workbench's SectionG is an
**`UNBUILT · PHASE 3`** static step-list placeholder (`SectionG:31`, verified) — the live flow is the
sub-page.

---

## 3. THE HASH-CHAINED AUDIT LOG — the exact mechanics (precision item #2)

**The writer** (`writeAuditLog.ts`, read in full): every write runs in a **Serializable** transaction
(`:123`) — request_id idempotency check INSIDE the tx (`:66-71`), reads the latest row (`:73-75`),
**fails loud if the genesis row is missing** (`:77-82`), builds a canonical JSON `content` embedding
`prev_hash = prev.content_hash` (`:84-97`), computes `content_hash = SHA-256(content)` (`:99`), and
stores `prev_hash`, `content_hash`, **and the full `hash_input`** (`:101-121`) — so every row is
independently recomputable. Serialization conflicts (P2034/P2024) retry up to 5× with jittered
exponential backoff (`:5,14-28,125-137`).

**The schema** (`schema.prisma:2307-2349`, read firsthand): `sequence_number` BigInt unique
autoincrement · `prev_hash` · `content_hash` (unique) · `hash_input` · actor (user_id/email/type/
session/ip) · action (type/description) · target (table/id) · payloads before/after/metadata ·
request_id/user_agent · created_at.

**The verifier** (`verifyAuditChain.ts`, verified firsthand) — **real tamper-evidence, not
display-only**: loads ALL rows ascending, checks genesis `prev_hash === 'GENESIS'` and genesis
content_hash === `sha256('TEMPLE_STUART_AUDIT_LOG_GENESIS_v1')` (`:36-56`), verifies every link
`prev_hash === prev.content_hash` (`:65-73`), and **recomputes `sha256(hash_input)` against
`content_hash`** flagging *"content_hash does not match hash_input — possible tampering"* (`:75-96`).
Legacy rows without hash_input count as linkage-only.

**What the user sees:**
- `/compliance/audit-log` page: header *"Hash-chained, append-only compliance timeline with SOC 2
  immutability."* (`:209`); on mount it fetches rows AND **POSTs `/api/audit-log/verify-chain`**
  (`:170`, verified) → the badge **"Chain verified — {total_rows} rows"** or **"Chain broken — see
  details"** with per-break reasons (`:225-241`). Table: Time/Actor/Action/Target/Description/Seq #;
  expanding a row reveals payload JSON + `Hash: {content_hash[0:16]}… / Prev: …` (`:340-377`).
  Load-more pagination; action/target filters.
- SectionI (workbench tail): when/action/target/**prev_hash/this_hash** columns, 10s polling —
  **⚠️ BUG (verified firsthand): its "verify chain" button fetches with GET (`SectionI:72`) but the
  route only exports POST (`verify-chain/route.ts:6`) → 405 → it ALWAYS renders "chain INVALID ·
  request failed."** The deck must mirror the WORKING page verify, never this button.
- Scoping: the rows GET is hard user-scoped (`actor_user_id = user.id`, `audit-log/route.ts:79` —
  SEC-1); the chain VERIFY runs globally (all rows). Neither audit-log route is tab-gated (auth-only).

---

## 4. DISCOVERY — the real flow vs the placeholder (precision item #3)

**SectionD in the workbench is an `UNBUILT` placeholder** (verified firsthand): dimmed fields
(`proposer models: Claude · GPT · Gemini`, `cost cap $5.00 default`), a button literally labeled
**"launch discovery (disabled)"**, and copy promising an Inngest-fired ensemble "in Phase 2 (PRs
16-25)". **The Inngest claim is not live** — the real run is fully synchronous.

**The REAL flow** (`/compliance/discovery` sub-page → `POST /api/discovery/runs`, verified firsthand):
- Gate order BEFORE the paid call: cookie auth 401 → user 404 → **`requireTabAccess('tab:compliance')`
  403** → profile-exists 404 → single-in-flight 409 → `runDiscovery` (`runs/route.ts:36-72`).
- **⚠️ NO rate limit, NO requireTier, NO quota lib on this paid route** (grep count 0, verified) —
  the 409 concurrency guard is the only throttle.
- The paid call (`runDiscovery.ts`, verified): ONE `claude-sonnet-4-6` message (`:8`), max_tokens
  16000, with the server-side **`web_search_20250305`** tool restricted to
  `allowed_domains = active registry domains` (`:73`) — the search cannot leave the vetted registry.
- Writes: a `discovery_runs` row walked through initiated → web_search_running → synthesis_running →
  citation_verification → completed, `total_cost_usd` computed; nested `discovery_proposals`
  (mission/project/workstream/task) with `proposed_citation_payloads` JSON (citations are NOT created
  as rows by a run); bracketing audit rows `ai_generation_started` / `_completed` / `_failed`.
- The sub-page renders the runs table (Started/Status/Proposals/Cost $x.xxxx/Actions) and
  *"Running discovery... this may take a minute."*; accept/reject per proposal
  (`discovery/proposals/[id]/accept|reject`, tab-gated).

---

## 5. MISSIONS / TASKS / PROFILE — and the attestation/evidence truth

- **`/compliance/missions`**: header "PR-D Missions"; create form (title placeholder *"e.g., SOC 2
  Type II Readiness"*, framework_mappings placeholder *"SOC2, ISO27001, GDPR"*); table with status
  filters + archive; **mission detail** renders an editable header + a collapsible
  **Projects → Workstreams → Tasks** tree with inline creation; an expanded task shows Description,
  Risk (inherent likelihood/impact), Penalty, Monitoring frequency, **Attestation frequency (display
  only)**, Action Steps, and linked Citations (badge + string + relevance note). All routes tab-gated
  + user-scoped; mission create writes a `mission_created` audit row.
- **ATTESTATIONS — data-model shell only:** `compliance_tasks` carries
  `attestation_frequency/status/last_attested_at/by/expires_at` (`schema.prisma:2537-2548`, verified)
  and statuses `awaiting_evidence`/`awaiting_attestation` + a `task_attested` audit enum exist — but
  **no attest endpoint exists and `task_attested` is never emitted** (PATCH emits only
  `task_updated`/`task_status_changed`).
- **EVIDENCE — no file/document model, no upload.** `task_evidence_attached` fires only when a
  CITATION is attached to a task (`compliance-tasks/[id]/citations/route.ts:49`). In this app,
  evidence == linked citations. Period.
- **Profile** (`/compliance/profile`): the `user_profiles` form (business overview, jurisdictions,
  products, data handling incl. AI-in-product, stage/size, plans/history) → `GET/POST
  /api/discovery/profile` (tab-gated). Feeds discovery.
- **⚠️ SectionB fetches a route that DOES NOT EXIST** — `GET /api/profile` (no such file; verified
  firsthand) → the workbench card permanently shows *"profile not yet configured"* even with a saved
  profile (the real route is `/api/discovery/profile`).
- **⚠️ Dead `/ops/*` cross-links** in profile (`:506`), discovery (`:144,222`), missions (`:311`) —
  the `/ops` route tree doesn't exist; canonical routes are `/compliance/*`.

---

## 6. THE WORKBENCH SEARCH (Section H) — live Voyage hybrid retrieval

`SectionH_CorpusInspector`: three modes — **Keyword (BM25) / Semantic (vectors) / Hybrid (BM25 +
vectors + rerank)**, default hybrid; POSTs `/api/workbench/search` `{query, mode, topK: 8}`; renders
ranked chunk cards with doc-type pill, `citation_key`, source domain, **scores (`rerank: … · rrf: …`)**,
structural path · pinpoint, expandable snippet, and a `source ↗` link to the canonical URL. Empty
state: `No results for "{query}".`

Route (verified firsthand): auth → user → **`requireTabAccess('tab:compliance')` BEFORE the paid
Voyage call** (`search/route.ts:42`) → `searchCorpus`. Mechanics: parallel BM25 + dense (50 candidates
each) → RRF fusion → **Voyage `rerank-2`**; dense = **Voyage `voyage-3.5`** query embedding
(1024-dim) → pgvector cosine over chunk embeddings (HNSW), superseded-filtered.
**⚠️ No rate limit on this paid route** (gated but unthrottled — flag, same class as discovery).

---

## 7. Sections A, F, J and the shell

- **A · IdentityBar**: `WORKBENCH · build:{sha} · tail:{hash}` — the tail is the newest audit row's
  content_hash (first 8 chars), polled 15s from the user-scoped audit route. **⚠️ `entity:` and email
  are declared but never populated — permanently `entity: —` / blank** (flag).
- **F · Roadmap**: live — up to 10 real missions with status + relative time, linking to
  `/compliance/missions/{id}`; honest empty state ("…Until then, missions can be created manually…").
- **J · Cost Ledger**: **`UNBUILT · PHASE 2 · PR-23`** placeholder (verified) — three `$ —` tiles, no
  route. (Real cost data exists elsewhere: `discovery_runs.total_cost_usd`, `operations_ai_usage`,
  `embedding_runs` — J wires none of it.)
- The standalone `/compliance/page.tsx` carries a stale doc-header calling itself `src/app/ops/page.tsx`.

---

## 8. THE REAL CAUSAL ORDER (the receipts story — the deck's slide order)

1. **The registry** — a vetted allow-list of authoritative sources, tiered and ranked; everything
   downstream anchors to it.
2. **The corpus** — four ingest crons (eCFR daily · US Code weekly · Federal Register hourly · IRB
   daily) fill documents/chunks; Voyage embeds 6-hourly under a cost cap; **every ingest run itself
   lands in the audit chain**, and Section C shows the live counts + the last run.
3. **Search it** — BM25 + vectors + rerank over the corpus, entitlement-gated before the paid call.
4. **Discovery** — your business profile + ONE gated Claude run whose web search cannot leave the
   registry domains; proposals (mission → project → workstream → task) with citation payloads; the
   run's start, cost, and completion are audit rows.
5. **The work tree** — accept proposals into missions/projects/workstreams/tasks (RACI, risk,
   monitoring, attestation fields), tasks link citations.
6. **Verify the citations** — version-locked at retrieval (stable URI + content hash); on-demand
   verification re-fetches the source and recomputes the hash (6 live checks, 2 declared-deferred);
   result + before/after into the audit chain.
7. **The chain** — every write goes through one serializable writer (genesis-anchored,
   SHA-256-linked, hash_input stored); the verify endpoint recomputes every hash and reports
   "Chain verified — N rows" or names the exact break.
8. **The close**: the platform's honesty claims are themselves rows in the thing they claim.

---

## 9. SOC 2 LANGUAGE CHECK

**ZERO hard violations repo-wide** (whole-tree grep: no "SOC 2 certified", no "bank-grade"/"bank
grade"; "certified" absent from src/ entirely). Rendered SOC-2 strings, judged:

| String (verbatim) | Where | Judgment |
|---|---|---|
| "…Our control framework is designed to SOC 2 Trust Service Criteria standards and is audit-ready." | `/soc2/page.tsx:214-221` (verified firsthand) | Compliant with the hard rule; **"audit-ready" flagged borderline** (readiness assertion, not alignment) — Alex's call, existing copy |
| "Hash-chained, append-only compliance timeline with SOC 2 immutability." | `audit-log/page.tsx:209` | Compliant (describes a control property) |
| "…attestations → evidence → audit chain → SOC 2 view." | `TabShowcases.tsx:590` | No certification claim, but **content-inaccurate** (§0, §5) — superseded by the deck |
| "e.g., SOC 2 Type II Readiness" / "SOC2, ISO27001, GDPR" | missions placeholders | Compliant (form examples) |
| Pricing compliance card: "…the tamper-evident audit registry." | `pricing-costs.ts:361-365` | Clean — no SOC-2 language on pricing |

**Deck rule confirmed:** "SOC-2-aligned controls" phrasing only; never certified/bank-grade.

---

## 10. MOUNTABILITY + EXAMPLE-DATA RULING

This tab has **no public seam anywhere** — every section is behind auth (mostly + tab:compliance),
and the deck audience is locked viewers/guests. Therefore, uniquely among the nine decks:
**every panel is a STATIC MIRROR.** No zero-fetch live mount exists (nothing like Travel's public
routes or Routines' in-browser builder). The two paid affordances (Anthropic discovery, Voyage
search) must be mirrored inert — a live mount is impossible anyway (gate) and undesirable (unthrottled
paid routes, §4/§6).

| Section | Ruling | Notes |
|---|---|---|
| Corpus tiles + per-source freshness | STATIC MIRROR | counts are live aggregates — any deck figure is a **declared, dated snapshot** ("as of <date>", example-tagged); NEVER presented as live, never fetched (no seam; adding one = gate change, banned). The 19,236/141,174 screenshot values may be used ONLY with that dated-snapshot label (provenance: Alex's live screenshot; they exist nowhere in code) |
| Registry rows | STATIC MIRROR | real tier/rank vocabulary (primary_law…, rank 1-5) |
| Search results card | STATIC MIRROR, inert | carry the real score labels (`rerank: · rrf:`), modes, and the Voyage/BM25 mechanics truthfully |
| Citation card + verify | STATIC MIRROR, inert | §162(a) example carries (below); check-list may show the REAL 8 with 6 live + 2 "deferred" labels — that precision IS the sell |
| Audit rows + chain badge | STATIC MIRROR | mirror the WORKING page verify ("Chain verified — N rows"), never SectionI's broken button |
| Discovery run row | STATIC MIRROR, inert | one synchronous run, cost visible, registry-restricted web search — no streaming/ensemble claims |
| Missions tree | STATIC MIRROR | attestation shown as display-only frequency (no attest workflow claim) |

**THE CROSS-DECK LOOP CLOSES — ruling: YES, carry it.** The example audit rows should be the REAL
platform events the other decks established: the old showcase already renders
`audit_log #4812 · permission_granted · hash-chained to #4811 · actor: external_integration (Stripe
webhook) (example row)` — and that is exactly what the entitlement system really writes (the
signature-verified Stripe webhook's `grantEntitlement` audit rows, verified in the Travel audit §6;
the actor enum value `external_integration` is the real storable value per the SHOWROOM-TRUTH-FIX
comment, `TabShowcases.tsx:580-583`). The paywall's own audit trail as the example = the universe
closing its loop. Sequence numbers stay declared-example.

**The citation example carries with two REQUIRED truth-fixes:** keep `26 U.S.C. §162(a)` + Verified
badge + quote, but the old footer *"Pinned to the ingested US Code corpus · re-verified on ingest
updates"* must become version-locking language that matches the code — e.g. *"version-locked at
retrieval (stable URI + SHA-256 content hash) · re-verify on demand."* (No pinning field, no
ingest-triggered re-verification exists — §2.)

---

## 11. NOT-LIVE / BANNED LIST (zero rendered hits in deck copy)

| # | Banned | Why | Cite |
|---|---|---|---|
| 1 | "Pinned citations" / pinning | no `is_pinned` field, no code — say version-locked (stable_uri + content hash), which IS real | schema `:2141-2199` |
| 2 | "Re-verified on ingest updates" / stale-marking | ingest never touches citations; verification is manual-only | ingest grep (§2) |
| 3 | "8-step" as all-live | 6 live + 2 hardcoded `not_applicable` ("deferred to PR-E"); per-check results never rendered in UI | `verifyCitation.ts:116-128` |
| 4 | Sections D/E/G/J as features | UNBUILT badges (verified): D discovery launcher (disabled button), E live stream, G step display, J cost ledger | `SectionD:19-21`, `SectionE:62`, `SectionG:31`, `SectionJ:19` |
| 5 | The workbench verify-chain button as working | GET vs POST-only → always "chain INVALID · request failed"; mirror the audit-log PAGE's working verify | `SectionI:72`, `verify-chain/route.ts:6` |
| 6 | "SOC 2 certified" / "bank-grade" | the hard rule; repo is currently clean — keep it | §9 |
| 7 | Attestations as a workflow | fields + display only; no attest endpoint; `task_attested` never emitted | §5 |
| 8 | "Evidence" as uploads/documents | evidence == linked citations only | §5 |
| 9 | A "SOC 2 view/dashboard" on this tab | none exists (J is a cost-ledger placeholder); `/soc2` and the dashboard proof grid are separate surfaces | §0, §9 |
| 10 | Discovery as streaming/ensemble/Inngest-fired | synchronous single run, 409 concurrency, no stream; "Claude · GPT · Gemini" is placeholder copy | §4 |
| 11 | Corpus counts as live in the deck | live DB aggregates; deck figures must be dated declared snapshots | §1, §10 |
| 12 | The old "identity → registry → … → SOC 2 view" A–J line | doesn't match the real sections; use the real ones | §0 |

**Additional flags for Alex (existing code/copy, not deck items):** the paid `discovery/runs` POST and
`workbench/search` routes are gated but **unthrottled** (no rate limit/quota); `corpus-context` +
`recent-chunks` lack the tab gate; SectionB fetches a nonexistent `/api/profile`; SectionA's entity/email
never populate; SectionI's verify-chain method bug; dead `/ops/*` links; "audit-ready" on `/soc2`.

**Verbatim strings to carry:** "Chain verified — {N} rows" / "Chain broken — see details" · the 429
verify string · "no ingestion runs yet — first cron at 06:00 UTC" · "No citations yet. Citations
populate as compliance tasks are created in PR-D." · "Verification-first citation tracking with 8-step
integrity protocol." · "Regulatory Source Registry / Foundation for verification-first compliance." ·
"content_hash does not match hash_input — possible tampering" · "Hash-chained, append-only compliance
timeline…" · the genesis anchor (`GENESIS` / `TEMPLE_STUART_AUDIT_LOG_GENESIS_v1`) · `WORKBENCH ·
build:{sha} · tail:{hash}`.

---

## 12. Scope of the FINAL showcase build (informational, no design here)

The deck supersedes `ComplianceShowcase` in `TabShowcases.tsx` (its current mount,
`ModuleLauncher.tsx:943`) for locked viewers — all mirrors, zero fetches, claims calibrated to §2/§3
precision, the cross-deck audit-row loop closed, the two citation-card truth-fixes applied. CTA: the
tab HAS a real paywall — keep the real `LockedTabCard` checkout (key `tab:compliance`). No
gate/route/lib changes.

---

*READ-ONLY audit. No code changed. Authored for the SOC 2 paper trail; Alex merges.*
