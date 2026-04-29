# Discovery Engine — Institutional-Grade Architecture Reference

**Path:** docs/architecture/discovery-engine-institutional-grade.md
**Status:** Engineering reference, v1.0
**Audience:** Solo founder building a multi-entity compliance platform; institutional-grade target.
**Date of reference:** April 28, 2026.

---

## 0. Reading guide and operative philosophy

This document specifies what an institutional-grade AI-powered regulatory compliance discovery system looks like at the level of detail that drives PR-by-PR implementation. It is benchmarked against what Bridgewater Associates, Citadel, and Renaissance Technologies would tolerate in an internal system: every decision is auditable, every claim is grounded, every model interaction is observable, and every output is reproducible.

Three operative requirements bind every component:

1. **Everything surfaced** — every prompt, retrieval, search query, model output, validation check, and cost calculation is visible to the user in real time. No hidden state.
2. **Continuous flow** — a single top-down workbench. No tabs that fragment the workflow.
3. **Auditable top to bottom** — every action writes to a hash-chained immutable audit log. Every claim traces to a source. Every citation is verifiable against its retrieval hash.

Where an institutional standard exceeds what a solo founder can reasonably build, this document marks the gap explicitly with a **[SOLO LIMIT]** annotation and describes the realistic compromise.

---

## 1. Document corpus architecture

### 1.1 What corpus a quant firm would build

An institutional regulatory corpus for a U.S. trading and CPA-adjacent platform spans roughly seven categories. Bridgewater's "Daily Observations" research and Renaissance's internal data engineering practices both rely on canonicalized, version-locked text corpora; Citadel's Surveillance group has historically purchased commercial regulatory feeds (Thomson Reuters Regulatory Intelligence, Bloomberg BRGI, LexisNexis State Net) and overlays them with bulk public data. The minimum viable institutional corpus comprises:

| Category | Authoritative source | Canonical ingestion |
|---|---|---|
| Federal statutes (U.S. Code) | uscode.house.gov USLM XML; GovInfo bulk data | Monthly point-in-time snapshot; section-level chunking by USLM `<section>` element |
| Federal regulations (CFR / eCFR) | eCFR REST API + GovInfo eCFR Bulk Data Repository (XML, daily) | Daily delta poll on `/api/versioner/v1/titles.json`; per-section snapshot keyed on `(title, part, section, effective_date)` |
| Federal Register notices and final rules | federalregister.gov v1 API | Hourly poll; ingest documents tagged "Rule" / "Proposed Rule" with full agency taxonomy metadata |
| Agency guidance | IRS (Pub 17, Rev. Procs, Notices, IRMs); SEC IM/SLB; FINRA Notices; FinCEN; PCAOB AS; AICPA; state DOR bulletins | Per-agency scrapers with structured XPath/JSON extraction; Wayback Machine (CDX API) used as fallback for retracted pages |
| Court opinions | CourtListener REST API (Free Law Project) for federal; state-by-state via Justia or Caselaw Access Project | Citation-keyed ingestion; ingestion only on opinions cited by guidance or already in corpus |
| Treaty text / OECD model | irs.gov treaties section, treasury.gov, oecd.org/tax | Per-treaty version snapshots; effective date and protocols tracked separately |
| Tax forms and instructions | irs.gov/forms-pubs (PDF + HTML); state DOR equivalents | Annual snapshot keyed on tax year; PDF text extracted via Marker or Adobe PDF Extract |

A solo system should not attempt to ingest the full corpus on day one. The disciplined approach is to ingest **only what citations the discovery engine actually emits**, plus a curated seed of "core" documents (IRC §§ 1, 61, 162, 199A, 263A, 469, 475, 1411; CFR Title 26 most-cited parts; Pub 17, Pub 535, Pub 550; FinCEN BSA Rules; relevant state DOR for the founder's domicile). This is the **citation-driven corpus** pattern: the corpus grows lazily with the system's actual footprint. Bridgewater's research stack uses an analogous "just-in-time materialization" pattern for macro datasets.

### 1.2 Technology stack — opinionated picks

**Vector store: pgvector with pgvectorscale** for the primary store, with a clear migration path to Qdrant if you cross ~10M vectors. Justification:

- Your `regulatory_sources`, `citations`, `audit_log`, and `compliance_tasks` tables already live in Postgres. Putting the vector index in the same database eliminates an entire class of dual-write consistency bugs. The hash-chained audit log can reference embedding rows by primary key inside the same transaction.
- Production benchmarks in 2026 show pgvector with HNSW (m=16, ef_search=200) hitting >95% recall up to ~10M vectors with proper tuning. Pinecone and Weaviate scale further but introduce a second system to operate, monitor, secure, and reconcile against the audit log.
- Pinecone is operationally easier but creates vendor lock-in and adds network round-trip latency to every retrieval. For a system whose entire premise is "every retrieval is logged with cryptographic provenance," sending data out to a third-party vector service materially weakens the audit story.
- Weaviate's hybrid graph capabilities are attractive for legal cross-reference traversal, but the same effect can be achieved in Postgres using a `citation_graph` adjacency table and recursive CTE, without the operational overhead.

**Embedding model: Voyage 3.5 Large** (or Voyage 4 if generally available at the time of build) **with voyage-law-2 retained for legal-only sub-queries.** Justification:

- Voyage's blog reports voyage-law-2 outperforming OpenAI text-embedding-3-large by 6% NDCG@10 average across eight legal retrieval datasets and >10% on LeCaRDv2, LegalQuAD, and GerDaLIR. Voyage 4's MoE architecture and shared embedding space across model sizes simplifies tiered retrieval.
- Harvey (the legal AI vendor used by O'Melveny, A&O Shearman) partnered with Voyage to produce voyage-law-2-harvey, validating Voyage's domain primacy.
- Practical pattern: embed all corpus chunks once with voyage-3.5-large at $0.06/M tokens; for legal-only sub-corpora (CFR, U.S. Code, court opinions) maintain a parallel voyage-law-2 index (16K context, $0.22/M tokens). At query time, both indices are searched and results fused.
- OpenAI text-embedding-3-large is acceptable as a fallback. Cohere embed-v4 is competitive on hybrid search but adds another vendor.

**Chunking strategy: hierarchical, structure-aware, with overlap.** For statutes and regulations the natural unit is the section (IRC § 162) or subsection (§ 162(a)(2)). For CFR, the eCFR XML provides explicit `<DIV5>` (section) and `<DIV8>` (paragraph) elements; chunk at the DIV5 level with parent-section metadata, store the parent section text as a separate "context" chunk, and at retrieval time rehydrate the parent section into the prompt (the **small-to-big** retrieval pattern from LlamaIndex). For agency guidance and PDFs, semantic chunking via the `text-splitter` library with a 1,200-token target and 200-token overlap is the institutional default. Fixed-size chunking is rejected: it splits sentences mid-clause and consistently underperforms structure-aware chunking on legal RAG benchmarks.

**Retrieval strategy: hybrid BM25 + dense vector with cross-encoder reranking.** The 2026 Legal RAG Bench paper (arXiv 2603.01710) explicitly concludes that "information retrieval is the primary driver of legal RAG performance" and that "retrieval sets the ceiling for the performance of many modern legal RAG systems." Retrieval pipeline:

1. **BM25** over Postgres `tsvector` (English + custom legal stopwords) returns top-50.
2. **Dense vector** via pgvector HNSW over voyage embeddings returns top-50.
3. **Reciprocal Rank Fusion** (k=60) merges to top-30.
4. **Cross-encoder rerank** with Voyage rerank-2 or Cohere Rerank 3.5 produces final top-8 with explicit relevance scores.
5. **Citation-graph expansion**: for each top-8 chunk, pull all chunks from the same parent section and any chunk that cites or is cited by the chunk; pass the union to the model.

### 1.3 Per-source canonical ingestion

| Source | Mechanism | Cadence | Version-lock anchor |
|---|---|---|---|
| U.S. Code (statutes) | uscode.house.gov USLM XML downloads | Monthly + on-release | `(title, section, public_law, effective_date)` |
| eCFR | eCFR API `/api/versioner/v1/full/{date}/title-{n}.xml` | Daily 06:00 UTC | `(title, part, section, version_date)` from XML `@amdpar` |
| Federal Register | federalregister.gov v1 API by publication date | Hourly | `document_number` (immutable FR identifier) |
| IRS publications | Direct fetch of HTML + PDF; SHA-256 each | Daily diff against last hash | `(pub_number, revision_date_string, sha256)` |
| IRS Internal Revenue Manual | irs.gov/irm | Weekly | `(part, chapter, section, revision_date)` |
| FinCEN | fincen.gov rulings/notices RSS + scrape | Daily | `(notice_id, published_date)` |
| SEC | sec.gov rules; EDGAR for issuer filings | Daily | `(release_no, file_no, accession_no)` |
| FINRA | finra.org notices RSS | Daily | `notice_id` |
| State DOR | per-state scrapers (50 modules) | Weekly | `(state, doc_type, doc_id, effective_date)` |
| Court opinions | CourtListener REST API; on-demand only when cited | On-demand | `(court, docket, decided_date, citation)` |
| Treaty text | treasury.gov treaty pages; per-treaty | On-protocol | `(treaty_id, protocol_no, effective_date)` |

### 1.4 Version locking at scale — the "Pub 17 on April 15" scenario

When IRS publishes a revised Pub 17 on April 15, the system must (a) detect the change, (b) ingest the new version, (c) mark every prior-version chunk superseded, (d) trigger downstream verification of every citation that points to the prior version, and (e) write each step to the audit log. The implementation pattern:

1. **Detection.** A nightly Inngest cron job (`detect_irs_publication_changes`) fetches the canonical URL, computes SHA-256 over normalized HTML and over the PDF binary, and compares to `regulatory_documents.content_hash` for the latest non-superseded row keyed on `(source_id='irs.gov', doc_type='publication', doc_number='17', tax_year=current)`. A hash mismatch triggers the ingestion pipeline.
2. **Ingestion.** A new row is inserted into `regulatory_documents` with `version=prev_version+1`, `effective_date`, `superseded_by=NULL`. Chunks are re-extracted, re-embedded, and inserted into `regulatory_document_chunks` with the new `document_id`.
3. **Supersession.** A single transaction updates `regulatory_documents.superseded_by` on all prior versions of `(source, doc_number, tax_year)` to point to the new `document_id`. The genesis-anchored audit log records the supersession as event type `document_superseded`.
4. **Downstream verification.** A worker (`citation_supersession_check`) selects every row in `citations` whose `document_id` references the superseded version, sets `verification_status='stale'`, and enqueues a re-verification task. Every active mission/project that references those citations gets a banner in the workbench: "3 citations superseded by Pub 17 (rev. 2026-04-15) — review required."
5. **Audit log entries.** Each step writes one row to `audit_log` with the previous row's hash, enabling Merkle-style replay.

### 1.5 Schema sketch

```sql
CREATE TABLE regulatory_documents (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id             uuid NOT NULL REFERENCES regulatory_sources(id),
  doc_type              text NOT NULL,        -- 'statute','regulation','publication','notice','opinion','irm','treaty','form'
  jurisdiction          text NOT NULL,        -- 'US','US-FED','US-CA', etc.
  citation_key          text NOT NULL,        -- 'IRC-162','26-CFR-1.162-1','IRS-PUB-17','REV-PROC-2024-30'
  title                 text NOT NULL,
  version               int  NOT NULL,        -- monotonic per citation_key
  effective_date        date,
  published_date        date NOT NULL,
  retrieved_at          timestamptz NOT NULL,
  canonical_url         text NOT NULL,
  stable_uri            text NOT NULL,        -- 'urn:cite:irc:162:2026-01-01'
  content_hash          bytea NOT NULL,       -- sha256 of normalized text
  raw_hash              bytea NOT NULL,       -- sha256 of raw bytes (PDF/HTML)
  raw_storage_uri       text NOT NULL,        -- S3/MinIO path to immutable blob
  superseded_by         uuid REFERENCES regulatory_documents(id),
  superseded_at         timestamptz,
  metadata              jsonb NOT NULL DEFAULT '{}',
  UNIQUE (citation_key, version)
);
CREATE INDEX ON regulatory_documents (citation_key, effective_date DESC) WHERE superseded_by IS NULL;
CREATE INDEX ON regulatory_documents (source_id, retrieved_at);

CREATE TABLE regulatory_document_chunks (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id           uuid NOT NULL REFERENCES regulatory_documents(id) ON DELETE CASCADE,
  parent_chunk_id       uuid REFERENCES regulatory_document_chunks(id),    -- hierarchical
  ordinal               int  NOT NULL,
  structural_path       text NOT NULL,        -- 'IRC/162/(a)/(2)' or 'CFR/26/1.162-1/(b)(3)'
  pinpoint              text,                 -- '§ 162(a)(2)' (display form)
  text                  text NOT NULL,
  text_hash             bytea NOT NULL,       -- sha256
  token_count           int  NOT NULL,
  embedding             vector(1024),         -- voyage-3.5-large or voyage-law-2
  embedding_model       text NOT NULL,
  bm25_tsv              tsvector GENERATED ALWAYS AS (to_tsvector('english', text)) STORED,
  created_at            timestamptz NOT NULL DEFAULT now(),
  UNIQUE (document_id, ordinal)
);
CREATE INDEX ON regulatory_document_chunks USING hnsw (embedding vector_cosine_ops) WITH (m=16, ef_construction=200);
CREATE INDEX ON regulatory_document_chunks USING gin (bm25_tsv);
CREATE INDEX ON regulatory_document_chunks (document_id, structural_path);
```

The `stable_uri` is the institutional contract: every claim the system emits cites a `stable_uri` plus a `chunk_id` plus a `text_hash`. The combination is the cryptographic primary key of "what the model was actually shown."

---

## 2. Multi-model ensemble architecture

### 2.1 Pattern selection

The institutional pattern of choice as of April 2026 is **proposer / critic / judge with cross-vendor diversity and uncertainty-aware fusion**, structurally derived from constitutional AI (Anthropic, 2022), LLM-as-judge (Zheng et al., 2023), and the 2025 Uncertainty-Aware Fusion (UAF) framework (Dey, Merugu, Kaveri; WWW 2025), which reported ~8% improvements in factual accuracy over single-model baselines. Mixture-of-experts at the inference layer is the right choice when the experts have non-overlapping coverage; for regulatory reasoning, the diversity that matters is *vendor diversity*, because correlated errors across same-family models are well-documented (Magesh et al. 2025, Stanford RegLab "Hallucination-Free Legal AI" critique).

The discovery flow:

1. **Proposer pass (3 models, parallel).** Each proposer is given the founder profile, the retrieved corpus context, and a structured task schema. Each emits a candidate roadmap (missions, projects, workstreams, compliance_tasks, with citations).
2. **Critic pass (1 model, with adversarial prompt).** The critic is given all three proposer outputs side-by-side and instructed to find every citation defect, jurisdictional mismatch, missed task, and unjustified priority assignment. The critic does not propose new content; it produces a structured defect list keyed to specific items.
3. **Judge pass (1 model, with deciding prompt).** The judge sees the proposer outputs, the critic's defect list, and the founder profile, and emits the canonical roadmap with merged citations and explicit acknowledgment of which proposer contributed which item.
4. **Verification pass (deterministic, not a model).** Every citation in the judge output flows through the 8-step adversarial verification of §3.

### 2.2 Model selection — April 2026 state of the art

LegalBench Vals.ai live leaderboard (Feb 2026 readout):

| Model | LegalBench accuracy |
|---|---|
| Gemini 3.1 Pro Preview (02/26) | 87.40% |
| Gemini 3 Pro (11/25) | 87.04% |
| Gemini 3 Flash (12/25) | 86.86% |
| GPT 5.4 | 86.04% |
| Claude Opus 4.6 (thinking) | ~78.20% |

Important caveat from the same source: "A given model's performance can vary dramatically across different legal tasks. There is still significant room for improvement for these models to perform well in law." A high LegalBench number is necessary but not sufficient. Long-form regulatory reasoning, citation grounding, and hedge calibration matter more than aggregate accuracy.

**Institutional ensemble (target):**

| Role | Model | Provider | Reason |
|---|---|---|---|
| Proposer 1 | Claude Opus 4.6 (extended thinking) | Anthropic | Best long-form qualification, instruction following, conservative hedging |
| Proposer 2 | GPT-5.4 (high reasoning) | OpenAI | Strongest factual breadth and structured output reliability |
| Proposer 3 | Gemini 3.1 Pro | Google | Highest LegalBench, 1M-2M context for full-corpus context dumps |
| Critic | Claude Opus 4.6 (extended thinking) with constitutional-style adversarial prompt | Anthropic | Highest precision in qualification and counter-argument |
| Judge | GPT-5.4 Pro or Gemini 3.1 Pro | OpenAI / Google | Use a *different* family from the critic to avoid same-model rubber-stamping |
| Open-weight reserve | DeepSeek R1 or Llama 4 Scout | self-hosted via vLLM | Independent verification path; protects against silent provider-side regressions |

The open-weight reserve is the institutional belt-and-suspenders move: when all three commercial vendors agree, you have high confidence; when an open-weight model dissents, you have a meaningful flag. A solo founder will probably skip the open-weight path on day one but should reserve a feature flag for it.

### 2.3 Quantitative effect of ensemble size

Published, peer-reviewed numbers worth citing:

- **Uncertainty-Aware Fusion** (Dey et al., WWW 2025): a 3-model fusion improved factual accuracy by ~8% over the best single model on TriviaQA-like factoid tasks, and narrowed the gap to GPT-4 on harder domains.
- **MSA at SemEval-2025 Task 3** (Hikal, Nasreldin, Hamdi): a primary-extractor-plus-three-LLM-adjudicator ensemble for hallucination span detection ranked 1st in Arabic and Basque, 2nd in three more languages — a robust empirical demonstration of triadic adjudication.
- **Stanford RegLab "Hallucination-Free Legal AI"** (Magesh et al., 2025): commercial single-model legal AI tools hallucinated 17–34% of the time on retrieval-grounded queries; the paper's primary recommended mitigation is multi-model verification with explicit citation grounding — the exact architecture proposed here.

Realistic expectation: a properly built proposer/critic/judge ensemble with grounded retrieval and verification reduces unsupported-claim rate from the ~15–30% range typical of single-model RAG to the ~2–5% range, but never to zero. **No ensemble eliminates hallucination; it bounds it and surfaces it.**

### 2.4 Prompt structures

**Proposer prompt (sketch):**

```
SYSTEM: You are a regulatory compliance discovery engine for a CPA-candidate
solo founder operating a multi-entity platform (personal, business, trading).
You produce a structured compliance roadmap. You cite only from the provided
corpus. You never cite to your training data. If a claim cannot be grounded
in the provided context, you mark it [UNSUPPORTED] and explain what additional
source you would need.

OUTPUT SCHEMA: <strict JSON schema for missions/projects/workstreams/tasks
with citation_keys, structural_paths, text_hashes, and pinpoints>

CONTEXT PROVIDED:
- Founder profile: <signed JSON>
- Retrieved corpus chunks (top-30 after rerank): <chunks with stable_uri,
  pinpoint, text_hash, retrieved_at, document version>
- Authoritative source registry (allow-list of 184 domains)

CONSTRAINTS:
- Every task MUST cite at least one chunk by chunk_id and text_hash.
- Priority tier is two-axis (impact x urgency); you must justify both axes.
- FAIR risk fields (LEF, LM) must be populated with ranges and reasoning.
- Lifecycle clocks (statutory deadline, internal target, review, audit-window)
  must be set or explicitly marked N/A with justification.
- RACI: every task assigns Responsible, Accountable, Consulted, Informed roles.

TASK: Produce the canonical roadmap.
```

**Critic prompt (sketch):**

```
SYSTEM: You are an adversarial reviewer. Your job is to find defects in three
candidate compliance roadmaps produced by other models. You do not propose
replacement content. You produce a structured defect list. You assume all
three proposers may have hallucinated; your default is suspicion.

INPUTS:
- Proposer A output (Claude)
- Proposer B output (GPT)
- Proposer C output (Gemini)
- Identical retrieved corpus the proposers saw
- Founder profile

DEFECT TYPES TO FIND:
1. Citation grounding failure: cited text does not support the claim
2. Pinpoint inaccuracy: § (a)(2) cited but referenced text is from § (b)
3. Jurisdictional mismatch: California rule cited for a Texas-domiciled entity
4. Supersession: cited document is in `superseded_by` chain
5. Coverage gap: a known compliance area absent from all three proposers
6. Priority defect: tier mismatched to the documented FAIR risk
7. Deadline defect: statutory deadline contradicts cited authority
8. RACI defect: Accountable role assigned to a non-existent entity

OUTPUT: JSON array of defects, each keyed to a specific item by proposer+id.
```

**Judge prompt (sketch):**

```
SYSTEM: You are the deciding judge. You see the three proposer outputs and
the critic's defect list. You produce one canonical roadmap. For every item
you include, you record (a) which proposer(s) supported it, (b) which critic
defects you accepted or rejected and why, (c) the citations after you have
verified them against the provided corpus.

You are forbidden from inventing items not present in any proposer output.
You are required to remove items the critic flagged unless you record an
explicit rebuttal.

OUTPUT: canonical roadmap with provenance trace.
```

All three prompts, the corpus context, and all model outputs are written verbatim to `audit_log` and surfaced in the workbench (§6).

---

## 3. Adversarial citation verification — the 8-step protocol

Each verification step writes a row to `citation_verifications` and an event to `audit_log`. A citation is `verified` only if all eight steps pass. Failure of any single step degrades the citation status to `defective` and the dependent task to `blocked` until human review.

### Step 1 — Existence
- **Check:** Fetch the canonical URL with a HEAD then GET; confirm 200 and content-type.
- **Tool:** `node-fetch` with `User-Agent: ComplianceDiscovery/1.0 (+https://...)` through a server-side proxy, never client-side.
- **Pass criteria:** HTTP 200, content length > 0, not a soft-404 (some agency sites return 200 with "Page Not Found" body — detect by pattern).
- **Fail consequence:** `verification_status='unreachable'`. Citation flagged red. Audit event `citation_existence_failed` with HTTP status and response hash.

### Step 2 — Currency
- **Check:** The cited document's `effective_date <= today` and the document is not in a `superseded_by` chain.
- **Tool:** Postgres query against `regulatory_documents`.
- **Pass criteria:** `superseded_by IS NULL` and `(effective_date IS NULL OR effective_date <= today)`.
- **Fail consequence:** `verification_status='stale'` or `'not_yet_effective'`. Re-verification queued.

### Step 3 — Groundedness (the hard one)
- **Check:** Does the cited text actually support the claim? This is the adversarial step where most legal RAG systems fail (Magesh et al. 2025 showed citation-presence is not citation-faithfulness).
- **Tool stack (institutional):**
  1. **NLI model** — DeBERTa-v3-large fine-tuned on TRUE/MNLI/ANLI, run locally. Decompose the claim into atomic propositions (using a small extractor LLM call), then run NLI(premise=cited_text, hypothesis=proposition). Threshold ≥0.85 entailment for "supported."
  2. **Independent verifier LLM** — a separate model from the proposer/judge ensemble, typically Claude Sonnet 4.6, given only the claim and the cited text and asked: "Does the cited text support the claim? Answer yes/no/partial with quoted span."
  3. **Embedding similarity floor** — cosine(embedding(claim), embedding(cited_text)) ≥ 0.5 as a gross-error filter. Below this, skip the more expensive checks.
- **Pass criteria:** NLI entailment ≥0.85 **and** independent verifier returns "yes" with a quoted span that overlaps the cited chunk's text by ≥80% character ratio.
- **Fail consequence:** `verification_status='ungrounded'`. Citation rejected. The discovery item that depended on it is rewritten or removed.
- **Cite:** VeriCite (Cui et al., arXiv 2510.11394, 2025) and MedRAGChecker (Ji et al., arXiv 2601.06519, 2026) both validate this three-signal pattern. The Deepchecks RAG evaluation guide names ≥0.9 NLI entailment as the institutional "grounded" threshold; we use 0.85 to allow for paraphrase but flag 0.85–0.90 for human review.

### Step 4 — Pinpoint accuracy
- **Check:** Does §162(a)(2) actually exist in the cited document, and does it contain the cited chunk?
- **Tool:** Lookup against `regulatory_document_chunks.structural_path`. The pinpoint must resolve to a real chunk in the cited document version.
- **Pass criteria:** Exact match of structural path; chunk's `text_hash` matches the hash recorded with the citation.
- **Fail consequence:** `verification_status='pinpoint_invalid'`. Common cause: model hallucinated a subsection.

### Step 5 — Supersession
- **Check:** Even if the document is not directly superseded, is there a newer authoritative document on the same point that should be cited instead?
- **Tool:** A "supersession graph" query that traverses citing relationships in `regulatory_document_links`. For example, if a cited Rev. Rul. has been distinguished by a later Rev. Proc. that the corpus knows about, surface that.
- **Pass criteria:** No newer authoritative document covers the same `(jurisdiction, topic_tag)` pair.
- **Fail consequence:** `verification_status='better_authority_available'` with a pointer to the suggested replacement. Soft fail — surfaces a suggestion rather than blocking.

### Step 6 — Jurisdictional match
- **Check:** Cited authority's jurisdiction matches the entity context (e.g., a citation to California R&TC for a Texas-domiciled entity is a defect).
- **Tool:** Match `regulatory_documents.jurisdiction` against the active entity's jurisdiction in the founder profile, with a configurable jurisdiction graph (US-FED matches all US-* entities; US-CA matches only US-CA entities; UN/OECD treaty matches all parties).
- **Pass criteria:** Citation jurisdiction is in the entity's applicable-jurisdiction set.
- **Fail consequence:** `verification_status='jurisdiction_mismatch'`. Hard fail.

### Step 7 — Source authority
- **Check:** The cited document came from a domain in the 184-row `regulatory_sources` allow-list and the source is currently active.
- **Tool:** Postgres lookup; cross-check against `regulatory_sources.tier` (federal_primary, federal_guidance, state_primary, etc.).
- **Pass criteria:** Source is on the registry and `active=true`.
- **Fail consequence:** `verification_status='source_unauthoritative'`. Hard fail. (This catches cases where a model cited Wikipedia or a tax-blog summary.)

### Step 8 — Content hash
- **Check:** The text the model cited matches the text currently stored. This guards against silent corpus mutations and ensures bit-for-bit reproducibility of past discovery runs.
- **Tool:** SHA-256 of the chunk's normalized text vs. the recorded `text_hash`.
- **Pass criteria:** Hashes equal.
- **Fail consequence:** `verification_status='hash_mismatch'`. This is a corpus-integrity event and triggers a P1 alert, because it should never happen in an immutable store.

### Audit log entries
Each step emits an event of the form:

```json
{
  "event_type": "citation_verification_step",
  "step_number": 3,
  "step_name": "groundedness",
  "citation_id": "uuid",
  "outcome": "pass",
  "evidence": {
    "nli_entailment": 0.91,
    "verifier_model": "claude-sonnet-4.6",
    "verifier_response_hash": "sha256:...",
    "embedding_similarity": 0.78
  },
  "previous_event_hash": "sha256:...",
  "this_event_hash": "sha256:..."
}
```

---

## 4. Background worker architecture

### 4.1 Choice: Inngest for the solo build, Temporal as the institutional choice

For a 5–15 minute multi-step LLM orchestration with progress streaming, the practical choice is **Inngest**. For an institutional team with dedicated infrastructure engineers, **Temporal** is the canonical choice and is what Citadel-class firms run for any workflow they cannot afford to lose state on. The trade-off:

- **Temporal** (used in production by NVIDIA, OpenAI for Codex, Replit Agent) records every state change in an append-only Event History and replays workflows from exact failure points. It is the gold standard for durability. It requires running a Temporal Server cluster (Postgres + Cassandra/Elasticsearch) and writing workflows in a deterministic style — a meaningful cognitive tax.
- **Inngest** is event-driven, serverless, with `step.run()` providing durable execution semantics. It has a built-in dashboard, automatic retries, and visual replay. It eliminates the need to operate orchestration infrastructure. The cost is per-step billing and a less rich set of primitives for very long-running (days/weeks) workflows.
- **AWS Step Functions** is a fine third choice if the codebase is already AWS-native, but the Standard workflow's $0.025/1k-state-transitions pricing makes per-step LLM workflows expensive at scale, and the JSON-based state machine DSL is awkward for AI orchestration.

**Recommendation for this system:** Inngest for the solo build, with workflows written in a way that is portable to Temporal if/when scale demands it. The portability discipline: every workflow step is idempotent, every external side-effect is wrapped in `step.run`, and no in-memory state crosses step boundaries.

### 4.2 Streaming progress to the UI

The institutional pattern is **server-sent events (SSE) backed by a per-run event log table.** Implementation:

1. Each Inngest step writes a row to `discovery_run_events(run_id, ts, event_type, payload, sequence)`.
2. The browser opens an SSE connection to `/api/runs/{run_id}/stream`.
3. The SSE handler tails `discovery_run_events` (Postgres `LISTEN/NOTIFY` or short-poll) and writes each event to the wire.
4. The UI receives events of types `prompt_sent`, `tokens_streaming`, `model_completed`, `retrieval_started`, `retrieval_completed`, `verification_step`, `cost_updated`, `step_complete`.
5. Token-by-token streaming from each model is forwarded by a small relay process that subscribes to the model SDK's stream and writes deltas to `discovery_run_events` and to a Redis pubsub channel for low-latency forwarding.

The principle: **the SSE stream is a projection of the audit log, not a parallel channel.** Anything visible in the UI is provably also in the audit log.

### 4.3 Failure recovery

Inngest's durable steps already provide automatic retry with exponential backoff. Layered on top:

- **Idempotency keys.** Every external API call (model, web search, document fetch) is keyed on a deterministic hash of inputs. A retried call returns the cached response from the prior attempt rather than re-running.
- **Partial-state recovery.** When a discovery run fails mid-judge-pass, the proposer outputs and critic output are already persisted; resumption starts at the judge.
- **Cleanup.** On final failure (after retry budget exhausted), the run is marked `failed`, all temporary artifacts in object storage are tagged for 30-day retention (long enough to debug, short enough to satisfy data minimization), and an audit event `run_failed_terminal` is written.
- **Compensation.** If the run partially wrote to `compliance_tasks`, a compensation step soft-deletes those rows (sets `status='discarded_failed_run'`) so the user does not see half-baked output as canonical.

### 4.4 Cost tracking and bounding

Every model call is wrapped in a `meterModelCall(model, prompt_tokens, completion_tokens)` helper that:

1. Looks up provider pricing from a `model_pricing` table (versioned).
2. Computes input + output dollar cost.
3. Inserts a row into `cost_ledger(run_id, model, input_tokens, output_tokens, usd_cost, ts)`.
4. Updates a Redis counter `run:{run_id}:cost_usd`.
5. If the run's cumulative cost exceeds `run.cost_cap_usd`, the next step throws `CostCapExceeded` and the run is paused with an audit event. The user is shown a modal: "Run paused at $4.18 of $5.00 cap. Approve $5 increment to continue?"

Per-run typical economics (April 2026 prices):

- 3 proposers × ~30k input + ~3k output tokens ≈ Claude Opus $0.45 + GPT-5.4 $0.42 + Gemini 3.1 Pro $0.10 ≈ $0.97
- 1 critic × ~15k input + ~2k output ≈ $0.13 (Claude Opus)
- 1 judge × ~20k input + ~3k output ≈ $0.10 (Gemini 3.1 Pro)
- Verifier (Claude Sonnet 4.6) × ~50 calls × ~2k tokens ≈ $0.10
- Embedding (Voyage 3.5 Large) × ~5k tokens ingestion + ~3k tokens query ≈ $0.0005
- Reranker × ~30 docs × 5 queries ≈ $0.05

**Total per discovery run: ~$1.35–$1.80.** Set `cost_cap_usd` default to $5 to absorb retries and longer profiles. An institutional firm running 1,000 of these per day spends ~$1,800/day on inference; a solo founder running 5/week spends ~$40/month.

---

## 5. Evaluation harness

### 5.1 Pre-deployment validation pattern

There is no widely-published institutional evaluation harness for AI compliance discovery, because the firms that do it well treat it as proprietary alpha. The composite institutional bar is assembled from three adjacent disciplines:

- **From quant trading: backtesting with point-in-time data integrity.** Renaissance and Citadel run every model change against years of historical data using only the data that would have been available at each historical point. The compliance analogue: every test case is bound to a corpus snapshot date; the system must run the case using only documents whose `effective_date <= snapshot_date` and where `superseded_by` was NULL on that date.
- **From legal tech: LegalBench (Guha et al., 162 tasks, 6 reasoning types) and LawBench (20 tasks, 5 task types).** These give per-skill diagnostic accuracy. They do not measure end-to-end roadmap quality.
- **From compliance (de novo, because nothing widely published meets the bar):** an internal **ComplianceDiscoveryBench** keyed on real founder profiles and ground-truth roadmaps adjudicated by a CPA panel.

### 5.2 The 100-case test set

The test set must vary along these dimensions to be useful:

| Dimension | Coverage |
|---|---|
| Entity composition | Solo personal; sole-prop; LLC single-member; LLC multi-member; S-corp; C-corp; partnership; trader 475(f); rental; multi-state |
| Domicile | At least 10 states including CA, NY, TX, FL, WA, IL plus one no-tax state and one PIT-only state |
| Income mix | W-2 only; 1099 only; capital gains heavy; trader; international with FBAR; rental; royalty |
| Lifecycle stage | Pre-formation; year-1 operations; mid-year acquisition; year-end planning; quarterly estimate; audit response |
| Edge cases | Crypto; PFIC; controlled foreign corp; SALT cap workaround; ERC clawback; backup withholding; nonresident alien partner |
| Failure cases | Profile with deliberately ambiguous facts; profile with internal contradictions; profile that should produce "insufficient information, ask user X questions" |

Per case, the ground-truth artifact is a CPA-reviewed roadmap with explicit citations, plus a list of "must-have" tasks, "must-not-include" tasks (negatives), and the expected priority tier for each must-have.

### 5.3 Metrics

| Metric | Definition | Target |
|---|---|---|
| Task precision | (correct tasks emitted) / (total tasks emitted) | ≥ 0.92 |
| Task recall | (must-have tasks emitted) / (must-have tasks total) | ≥ 0.85 |
| Citation accuracy | (citations passing all 8 verification steps) / (total citations) | ≥ 0.98 |
| Citation pinpoint accuracy | (correct subsection) / (total citations with pinpoint) | ≥ 0.95 |
| Hallucination rate | (citations with `ungrounded` after verification) / (total citations) | ≤ 0.02 |
| Jurisdictional correctness | (tasks with correct jurisdiction) / (total tasks) | ≥ 0.99 |
| Priority tier accuracy | exact match on two-axis tier vs. ground truth | ≥ 0.80 |
| Negative test pass rate | (must-not-include tasks correctly omitted) / total | ≥ 0.95 |
| Reproducibility | (cases with byte-identical output on re-run with same corpus snapshot and model versions) / total | ≥ 0.99 (with temperature=0; expect non-determinism otherwise — track separately) |

The Stanford RegLab "Hallucination-Free Legal AI" critique (Magesh et al., 2025) measured commercial legal AI tools at 17–34% hallucination on retrieval-grounded queries; the ≤2% target above is aggressive but achievable specifically because of the 8-step verification gate, which fails-closed.

### 5.4 Maintenance and the ground-truth oracle

- **Snapshot binding.** Every test case has a `corpus_snapshot_id`; the harness runs against that exact corpus, not "today's corpus." When the system promotes a corpus snapshot to "current," cases run against both old and new snapshots and any divergence is flagged for CPA review.
- **Ground truth.** A licensed CPA (in this system, the founder once they're licensed; until then, a contracted reviewer) is the oracle. Each case is dated and signed. Cases are versioned: when regulations change in a way that materially changes the right answer, the case is forked, the prior version archived, and the new version reviewed.
- **Drift detection.** A nightly run executes the full test set against the latest corpus and reports metric deltas. Any metric drop >2% triggers a P1 review.

**[SOLO LIMIT]** A solo founder cannot realistically build and maintain a 100-case CPA-adjudicated test set in v1. The realistic compromise: build 25 cases at launch, all hand-built by the founder; expand to 100 over the first 12 months; tag the prediction set as `internal_only_v0` and never represent test results to third parties as institutional-grade until the panel is real.

---

## 6. UI specification — the single-page workbench

### 6.1 Design tradition

The system most often invoked as the institutional standard for "everything visible, no hiding state, expert-friendly" is the **Bloomberg Terminal**. Bloomberg's design lead has stated explicitly that "transparency... means surfacing what you need to know, when you need to know it, and why this is relevant to you" (Bloomberg UX, 2017). The Terminal achieves continuous flow through dense, persistent panels rather than navigation hierarchies. Internal trading-floor monitoring tools at Bridgewater and Citadel similarly favor dense, flat, scrollable views over tabbed dashboards — for the same reason: when a regulator asks "what was on screen at 14:32 when this decision was made," tabs make the answer hard to reconstruct.

The workbench is a **single vertical stream** divided into stacked sections. The user can scroll the entire compliance workflow in one motion. There is one URL. Sections are anchored (`#section-id`) so that audit log entries can deep-link to the exact state that was visible when an event was emitted.

### 6.2 Section stack, top to bottom

**Section A — Identity bar (sticky, top, 40 px)**
- Visible: signed-in user, current entity context (selector), corpus snapshot ID + age, current model versions in use, build SHA, audit log tail hash (last 8 chars).
- Editable: entity selector.
- Audit-log writes: every entity switch (`entity_context_changed`).

**Section B — Founder profile**
- Visible by default: structured profile (entities, jurisdictions, income types, key dates) as a dense table.
- Collapsible: each entity's full nested detail.
- Editable: every field, with debounced saves.
- Real-time: nothing.
- Audit-log writes: every save (`profile_field_updated`) including before/after values.

**Section C — Corpus context (read-only)**
- Visible by default: corpus snapshot ID, total documents, last ingestion event, count of newly superseded documents in last 24h, list of "stale" citations across all active missions.
- Collapsible: per-source last-fetch timestamps.
- Real-time: updates on ingestion events via SSE.
- Audit-log writes: ingestion events surface here, not generated here.

**Section D — Discovery run launcher**
- Visible by default: model selection (with current versions), cost cap slider (default $5), corpus snapshot lock checkbox (default checked), "Launch discovery" button.
- Editable: all of the above.
- Audit-log writes: `discovery_run_initiated` with full configuration captured.

**Section E — Live discovery stream (the heart of the workbench)**
This is the "everything surfaced" section. While a run is in progress, the following blocks render in document-flow order, each block expanding as it produces output:

1. **Profile signature.** SHA-256 of the JSON profile sent to the run, plus the profile JSON itself (collapsed by default, one click to expand).
2. **Retrieval block, per query.** Each query shows: the natural-language query string, the BM25 query string (post-stopword), the rerank prompt, and the top-30 results with score, stable_uri, pinpoint, and a snippet. Each result is a link that scrolls to the corpus inspector (Section H).
3. **Proposer A/B/C blocks (parallel, three columns).** For each: model name + version, system prompt (collapsed by default), full user message including all retrieved chunks (collapsed), and the streaming output token-by-token. Token-per-second and running cost shown live.
4. **Critic block.** Shows the critic prompt, the three proposer outputs concatenated as input, the critic's structured defect list as it streams.
5. **Judge block.** Shows the judge prompt, all upstream context, the canonical roadmap as it streams.
6. **Verification block.** A table with one row per citation; each row has eight columns for the 8 verification steps; cells turn green (pass), red (fail), or yellow (review). Clicking any cell reveals the evidence (NLI score, verifier response, hash comparison).

All six sub-blocks remain on the page after the run completes. Nothing is hidden. The user can scroll back through everything that happened.

**Section F — Roadmap (canonical output)**
- Visible by default: missions → projects → workstreams → compliance_tasks rendered as a nested, dense outline. Each task shows: priority (two-axis), FAIR risk fields (LEF, LM as ranges), four lifecycle clocks, RACI, and citation chips (each chip is a `stable_uri#chunk` link).
- Editable: every field, with the convention that human edits write a `human_override` event to the audit log including a freeform justification.
- Real-time: updates as the run finishes; subsequent edits propagate inline.
- Audit-log writes: every save, every reorder, every comment.

**Section G — Citation verification panel**
- Visible by default: a list of all citations across the active mission with their 8-step status badges.
- Collapsible: per-citation evidence detail.
- Editable: a "force re-verify" button per citation that triggers a fresh verification run (subject to cost approval).
- Real-time: status updates from background verification jobs.
- Audit-log writes: every re-verify trigger; outcomes flow from the verifier itself.

**Section H — Corpus inspector**
- Visible by default: search box and the most recently retrieved chunks across all sessions.
- On click of a citation chip elsewhere on the page, this section scrolls and highlights the exact chunk, with the parent section above and below.
- Editable: nothing (read-only).
- Real-time: updates when corpus is re-snapshotted.

**Section I — Audit log tail**
- Visible by default: the last 50 audit-log rows, newest first, with event type, timestamp, actor (human user / model / system), payload preview, prev_hash, this_hash.
- Collapsible: full payload.
- Editable: nothing.
- Real-time: appends as events occur.
- A "verify chain" button computes the hash chain locally in-browser and reports any mismatch.

**Section J — Cost ledger**
- Visible by default: cumulative cost today, this week, this month; per-run breakdown; per-model breakdown.
- Collapsible: per-call ledger rows.
- Real-time: updates on each model call.
- Editable: cost caps.

### 6.3 Implementation notes
- Frontend: Next.js (App Router), React Server Components for read-mostly sections, client components for live streams.
- SSE for streaming; the EventSource subscription is opened once for the page and multiplexes all sections.
- Tailwind + a Bloomberg-inspired dense theme: monospace for IDs and hashes, amber-on-near-black optional, with high-contrast and CVD-aware palettes (Bloomberg's published research on CVD scheme design is the right reference).

---

## 7. Data provenance and immutability

### 7.1 Hash chain integration
The audit log is hash-chained: every row stores `prev_hash` (the SHA-256 of the prior row's canonical serialization) and `this_hash` (its own). The genesis row is anchored by including, in its payload, a public artifact (e.g., the Bitcoin block hash on the system's launch date) so that the chain has an external time anchor. SOC 2 immutability triggers prevent UPDATE and DELETE on the audit table; any attempt produces a Postgres exception.

Integration with the rest of the system: every domain mutation (profile field, mission, project, task, citation status, verification step, cost ledger row, ingestion event, model call) is paired with an audit log insert in the **same transaction**. There is no domain mutation that is not auditable. The pairing is enforced by a small "audited write" service layer; direct INSERT/UPDATE on domain tables outside this layer is blocked at the database role level (the application role lacks `INSERT` on most tables and instead has `EXECUTE` on `audited_insert(...)` functions).

### 7.2 Additional provenance patterns
Institutional firms layer the following on top of a hash-chained log:

- **Merkle-tree daily roots.** All audit events for a given day are batched into a Merkle tree; the root is signed with an Ed25519 key and stored separately. This bounds the cost of proving inclusion of any historical event to O(log n) hashes. Reference: arXiv 2511.17118 (2025), "Constant-Size Cryptographic Evidence Structures for Regulated AI Workflows," which formalizes this composition for regulated AI workflows.
- **External anchoring (notary-style).** The signed daily Merkle root is submitted to OpenTimestamps (free, anchors to Bitcoin) **and** to a paid commercial timestamp authority such as DigiCert TSA or Surety AbsoluteProof. Two independent anchors means an attacker would need to compromise both Bitcoin and the commercial TSA simultaneously — a vanishingly small threat model.
- **Cryptographic signing of model outputs.** Every model output is signed by the orchestration service's HSM-held key (AWS KMS or GCP KMS) before being persisted. The signature, the model version string, and the prompt hash form the verifiable claim "this output was produced by this model on this prompt at this time." Tools like AuditKit popularized this for SOC 2 evidence; the same pattern works for AI outputs.
- **Trusted Execution Environment (TEE) attestation.** For the highest assurance level, model orchestration runs inside an AWS Nitro Enclave or Azure Confidential VM and produces an attestation document binding the workload measurement to the output. This is what a frontier-finance firm would do for a regulator-facing system.

**[SOLO LIMIT]** The realistic solo-founder build implements the hash-chained log + signed daily Merkle root + OpenTimestamps anchor (all free or low-cost). HSM-signed model outputs require a $1/month KMS key and are a clear win. TEE attestation is operationally heavy and should be deferred unless an institutional customer requires it.

### 7.3 Passing external audits

**Big Four (PCAOB-compliant) audit.** A Big Four auditor evaluating SOC 2 Type II readiness will ask: (a) demonstrate that audit logs cannot be modified; (b) demonstrate that every privileged action is logged; (c) demonstrate that logs are retained for the required period; (d) demonstrate that backups exist and are tested; (e) demonstrate access controls. The hash chain + daily Merkle root + OpenTimestamps anchor + KMS-signed outputs covers (a). The audited-write enforcement at the database role level covers (b). A 7-year retention policy with WORM (Write-Once-Read-Many) S3 bucket policies covers (c). Standard backup discipline covers (d). Workload Identity Federation, role-based UI access, and short-lived credentials cover (e).

**SEC.** The SEC's Rule 17a-4 (broker-dealer recordkeeping) and Advisers Act Rule 204-2 specify WORM storage and indexed retrievability for designated records. The system should expose an "Export 17a-4 / 204-2 dossier for date range" function that produces (i) every audit log row in the range, (ii) the Merkle root for each day, (iii) the OpenTimestamps proof, (iv) the KMS public key, (v) a verification script. This is the exact dossier an SEC examiner would want.

**State CPA boards.** A state CPA board reviewing the founder's professional conduct cares about: did the CPA exercise professional judgment, was AI used as an aid rather than a substitute, were client records preserved, and was confidentiality maintained? The system answers all four by surfacing — for any decision — the model outputs, the human review record, the citation chain, and the access log.

---

## 8. Cost and timeline

### 8.1 Engineering timeline — solo developer with Claude Code and parallel AI agents

This assumes the partial v0 already in place (regulatory_sources, citations, audit_log with genesis row, missions/projects/workstreams/compliance_tasks, single-pass Claude Sonnet discovery). PRs are sized for one focused day each unless noted.

**Phase 1 — Corpus foundation (3 weeks, ~15 PRs)**

1. PR-01 — `regulatory_documents` and `regulatory_document_chunks` schema migration with HNSW index.
2. PR-02 — eCFR ingestion worker (Inngest): daily title-by-title XML pull, structural chunking by `<DIV5>`.
3. PR-03 — U.S. Code USLM ingestion worker.
4. PR-04 — Federal Register ingestion worker (hourly, by document_number).
5. PR-05 — IRS publications scraper (Pub 17 et al.) with HTML+PDF dual-hash.
6. PR-06 — IRM ingestion worker.
7. PR-07 — FinCEN, SEC, FINRA scrapers (1 PR each is more realistic — call it 3 PRs).
8. PR-08 — Generic state DOR scraper framework (1 PR for framework + 1 PR per priority state).
9. PR-09 — CourtListener on-demand integration.
10. PR-10 — Voyage embedding pipeline; chunk-level embeddings populated.
11. PR-11 — Hybrid retrieval API (BM25 + vector + RRF).
12. PR-12 — Cohere or Voyage reranker integration.
13. PR-13 — Citation graph table + supersession graph queries.
14. PR-14 — `regulatory_documents.superseded_by` cascade triggering downstream re-verification.
15. PR-15 — Corpus snapshot table + snapshot-locked retrieval.

**Phase 2 — Multi-model ensemble (2 weeks, ~10 PRs)**

16. PR-16 — Provider abstraction (Anthropic, OpenAI, Google, optional vLLM-hosted open-weight).
17. PR-17 — Proposer prompt template + structured-output JSON schema.
18. PR-18 — Critic prompt template.
19. PR-19 — Judge prompt template.
20. PR-20 — Inngest workflow that runs proposer pass in parallel.
21. PR-21 — Inngest workflow continuation for critic.
22. PR-22 — Inngest workflow continuation for judge.
23. PR-23 — Cost ledger + cost cap enforcement.
24. PR-24 — `discovery_run_events` + SSE relay.
25. PR-25 — Idempotency keys + retry semantics.

**Phase 3 — 8-step verification (2 weeks, ~10 PRs)**

26. PR-26 — `citation_verifications` schema.
27. PR-27 — Step 1 (existence) verifier.
28. PR-28 — Step 2 (currency) verifier.
29. PR-29 — Step 3 (groundedness) — NLI model deployment + verifier LLM + embedding floor.
30. PR-30 — Step 4 (pinpoint) verifier.
31. PR-31 — Step 5 (supersession graph) verifier.
32. PR-32 — Step 6 (jurisdictional match) verifier.
33. PR-33 — Step 7 (source authority) verifier.
34. PR-34 — Step 8 (content hash) verifier.
35. PR-35 — Verification orchestrator and audit-log integration.

**Phase 4 — UI (3 weeks, ~12 PRs)**

36. PR-36 — Single-page workbench skeleton, sticky identity bar.
37. PR-37 — Profile section.
38. PR-38 — Corpus context section.
39. PR-39 — Discovery run launcher.
40. PR-40 — Live discovery stream — retrieval blocks.
41. PR-41 — Live discovery stream — proposer columns with token streaming.
42. PR-42 — Live discovery stream — critic and judge blocks.
43. PR-43 — Live discovery stream — verification table.
44. PR-44 — Roadmap section with inline editing.
45. PR-45 — Citation verification panel.
46. PR-46 — Corpus inspector.
47. PR-47 — Audit log tail + chain-verify button + cost ledger.

**Phase 5 — Provenance hardening (1 week, ~5 PRs)**

48. PR-48 — Daily Merkle root computation + signing.
49. PR-49 — OpenTimestamps anchoring.
50. PR-50 — KMS-signed model outputs.
51. PR-51 — WORM S3 bucket for audit log archive.
52. PR-52 — 17a-4 / 204-2 export dossier.

**Phase 6 — Evaluation harness (2 weeks, ~5 PRs)**

53. PR-53 — Test-case schema + first 25 cases authored.
54. PR-54 — Snapshot-bound test runner.
55. PR-55 — Metrics dashboard.
56. PR-56 — Drift detection nightly job.
57. PR-57 — CI gate on merge to main.

**Total: ~13 weeks of focused work.** A solo founder using Claude Code, parallel agents for boilerplate, and the existing v0 base can compress this to **8–10 weeks** on a 50-hour-per-week schedule. Optimistic estimates below 8 weeks consistently underestimate the verification step (PR-29 alone is realistically a 4-day effort) and the UI streaming infrastructure (PR-40 through PR-43).

### 8.2 Monthly operating cost

| Line item | Cost (USD/mo) |
|---|---|
| Postgres (Neon Scale or Supabase Pro with pgvector) | $69–$120 |
| Object storage for raw corpus + audit archive (S3 with WORM) | $5–$15 |
| Inngest Pro (durable workflow execution) | $50–$100 |
| Voyage embeddings (5M tokens/mo ingestion + queries) | $1–$5 |
| Reranker API (Voyage or Cohere; ~5k requests/mo) | $5–$15 |
| Anthropic Claude Opus + Sonnet (proposer + verifier + critic) | $40–$120 |
| OpenAI GPT-5.4 (proposer + judge alternative) | $30–$80 |
| Google Gemini 3.1 Pro (proposer + judge primary) | $20–$60 |
| AWS KMS (signing key) | $1 |
| OpenTimestamps anchoring | $0 |
| Commercial TSA (optional) | $0–$50 |
| Sentry or equivalent error tracking | $26 |
| **Total recurring** | **~$250–$590/month** |
| **Per discovery run** | **~$1.35–$1.80** |

Bandwidth for ingestion is rounding error. The single biggest swing is how many discovery runs the founder does: 5/week sits comfortably at the low end; 100/week pushes the high end and may justify provisioned Anthropic capacity.

### 8.3 Where the solo build cannot match institutional bar

Naming the gaps explicitly so the system is not misrepresented:

1. **Adversarial red-team panel.** Bridgewater-class firms run an internal red team against any new model-driven system before deployment. A solo founder does not have one. The realistic compromise: run the system's own critic model against its own outputs in a "self-attack" mode, augmented by periodic external review (a CPA contractor reviewing 5 cases/month).
2. **24/7 model-drift monitoring.** Institutional firms have on-call rotations watching for silent vendor-side regressions. A solo founder cannot. The compromise: nightly evaluation harness runs and a Slack/SMS alert on any metric drop >2%.
3. **Custom domain models.** Harvey's voyage-law-2-harvey is fine-tuned on case law specifically for their workload, with proprietary training data. A solo founder uses the off-the-shelf voyage-law-2 and accepts the 10–15% performance gap on legal-specific tasks.
4. **Regulator-facing legal support.** A Big Four firm includes legal indemnification from the audit partner; a solo founder cannot. The compromise: explicit "this system is an aid to professional judgment, not a substitute" disclaimers, and a CPA sign-off step on every roadmap before any external use.
5. **Regulatory feed completeness.** Citadel's Surveillance group buys Thomson Reuters Regulatory Intelligence at six figures per year, covering ~900 global regulators with curated metadata. The 184-source allow-list covers the U.S. domain comprehensively but does not match the breadth of a paid commercial feed. The compromise: explicitly scope the system to U.S. federal + the founder's domicile state(s) + any other state with a meaningful nexus, and mark anything outside that scope as "unsupported jurisdiction; do not rely."
6. **Real-time supersession of agency interpretations.** When the IRS issues a Chief Counsel Advice that distinguishes a Rev. Rul., commercial systems flag this within hours via expert annotation. The solo system catches the document on its next ingestion poll but does not auto-distinguish without the supersession-graph link being authored by a human. The compromise: a weekly "what's new this week" review where the founder spends 30 minutes triaging new ingestions and authoring supersession links.
7. **Bench depth on edge-case tax law.** No off-the-shelf LLM in 2026 performs above ~80% on the hardest LegalBench subtasks. For a thorny issue (e.g., a § 475(f) election timing question for a trader entity), the system should suggest the right citations and tasks but should *not* be relied on for a final answer. The institutional compromise: explicit "low confidence — please consult a tax attorney" badges, surfaced in the UI when verifier disagreement is high.

---

## 9. Closing principles

1. **The audit log is not an afterthought; it is the database.** Every domain table is a projection of the audit log. If the audit log were destroyed, the system would be destroyed; if any other table were destroyed, it could be reconstructed from the audit log.
2. **Every claim has a source; every source has a hash; every hash is anchored.** This is the single non-negotiable invariant. Code review enforces it.
3. **Models are tools; verifiers are infrastructure.** The proposer/critic/judge ensemble produces drafts. The 8-step verifier is the production system. Spend engineering effort proportionally.
4. **Surface, don't summarize.** If the user wants a summary they can collapse a section. The default is everything visible.
5. **Honesty about gaps.** Where the system cannot meet the institutional bar, it says so in the UI, in this document, and in any output destined for a third party.

---

*End of reference document.*
