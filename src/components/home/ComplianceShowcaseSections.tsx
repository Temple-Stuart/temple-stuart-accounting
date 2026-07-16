'use client';

/**
 * COMPLIANCE-SHOWCASE-BLOOMBERG — the NINTH AND FINAL deck: the receipts deck.
 * Dark hero → 7 causal slides → the all-mirror connective line → the REAL
 * Unlock Compliance checkout (LockedTabCard, tab:compliance — passed in as the
 * `cta` prop by TabShowcases.ComplianceShowcase to avoid an import cycle).
 * Grounded in audit-reports/COMPLIANCE-FULL-INVENTORY.md (merged 2e90e343).
 * This deck closes the carousel AND the cross-deck loop: the paywall the other
 * eight decks sell, audited by the ninth.
 *
 * ── MOUNTABILITY (inventory §10): NO PUBLIC SEAM — ALL MIRRORS ───────────────
 * Every panel here is a labeled static mirror of an entitlement-gated screen.
 * This file contains ZERO fetch calls. The chain, checks, and crons it
 * describes are real; running them requires the entitlement (the CTA).
 *
 * ── THE DECLARED EXAMPLE SET (no invented figures beyond these, all labeled) ─
 *   Corpus counts: 19,236 documents · 141,174 chunks — LIVE DB aggregates
 *     hardcoded nowhere in code (inventory §1); shown ONLY as a dated declared
 *     snapshot ("live counts, snapshotted 2026-07-16"; provenance: Alex's live
 *     screenshot, per the inventory's example-data ruling).
 *   Chain length: 4,812 rows — declared example, coherent with the example
 *     audit rows #4812/#4811 carried from the prior locked surface
 *     (TabShowcases SHOWROOM-TRUTH-FIX rows; the real page renders the live
 *     count in the same "Chain verified — {N} rows" format,
 *     audit-log/page.tsx:225-227).
 *   Example citation: 26 U.S.C. §162(a), Verified — carried from the prior
 *     locked surface, with the CORRECTED version-locking footer (see below).
 *   The loop rows (slide 5): the REAL event shape the entitlement webhook
 *     writes (stripe/webhook/route.ts:49-64, verified): actor
 *     { type: 'external_integration', email: 'stripe-webhook' }, action
 *     permission_granted, target user_category_entitlements, payload.after
 *     { key, status: 'active' }, request_id `${eventId}:${userId}:${key}`.
 *     The ids shown are declared-example values in the real formats.
 *
 * ── THE TWO CORRECTED OVERCLAIMS (inventory banned #1, #2) ───────────────────
 * The old locked surface said "Pinned to the ingested US Code corpus ·
 * re-verified on ingest updates". Neither is code: citations have NO pinning
 * field and NO ingest-triggered re-verification exists. The truthful language
 * used throughout this deck: "version-locked at retrieval (stable URI + SHA-256
 * content hash) · re-verify on demand" (schema.prisma:2141-2199,
 * verifyCitation.ts — inventory §2).
 *
 * ── CLAIMS CALIBRATION (inventory §§2-6) ─────────────────────────────────────
 *   The verifier runs 6 LIVE checks (existence HEAD · content-hash GET+SHA-256
 *   recompute · source-authority · currency · pinpoint · supersession); 2 are
 *   honestly not_applicable — groundedness + jurisdiction, "deferred to PR-E"
 *   (verifyCitation.ts:116-128). The chain mirror reproduces the WORKING
 *   /compliance/audit-log page (POST verify → "Chain verified — {N} rows",
 *   genesis-anchored, sha256(hash_input) recompute) — NEVER the workbench
 *   SectionI button (GET on a POST-only route → always INVALID; banned #5).
 *   Discovery: claude-sonnet-4-6 + server-side web_search restricted to active
 *   registry domains, tab-gated BEFORE the paid call (runDiscovery.ts:8,73;
 *   runs/route.ts:36-72) — GATED, NOT CAPPED (the route has no rate limit;
 *   no throttling claim anywhere in this deck; banned #10 variant).
 *   Lifecycle: compliance_tasks statuses incl. awaiting_evidence /
 *   awaiting_attestation; attestation_frequency / attestation_expires_at /
 *   evidence_freshness_days are TRACKING fields (schema.prisma:2537-2548) —
 *   no attest endpoint exists, so the copy describes the model, never an
 *   attest-button flow (banned #7). Evidence == linked citations (banned #8).
 *
 * ── BANNED (the inventory's 12 — zero rendered hits in deck copy) ────────────
 * pinning-as-field · re-verify-on-ingest · 8-step-as-all-live · the four
 * UNBUILT workbench sections (D launcher / E live stream / G step display /
 * J cost ledger — unadvertised here) · the broken SectionI verify button ·
 * "SOC 2 certified" / "bank-grade" (SOC-2-aligned language only) · attest
 * workflows · evidence-as-uploads · a "SOC 2 view" · discovery as streaming/
 * ensemble/throttled · live corpus counts · the old A–J marketing line.
 */

import type { ReactNode } from 'react';
import TabShowcaseTemplate, { ExampleTag } from '@/components/home/TabShowcaseTemplate';

interface DeckProps {
  /** Opens the existing home register/login modal. Never fetches. */
  onRequireAuth: () => void;
  /** The REAL unlock CTA (LockedTabCard tab:compliance) — injected by
   *  TabShowcases.ComplianceShowcase so this file never imports TabShowcases
   *  (no cycle). */
  cta: ReactNode;
}

// ── the declared example set (derivations in the header comment) ─────────────

const EX = {
  snapshot: { documents: '19,236', chunks: '141,174', date: '2026-07-16' },
  chainRows: '4,812',
};

// ── dark slide shell (panel token family — same look as the eight prior decks) ─

function DarkSlide({ title, tag = 'Mirror · labeled', children }: { title: string; tag?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-panel-border bg-panel p-4 font-mono text-[11px] leading-relaxed">
      <div className="flex items-center justify-between gap-2 border-b border-panel-border pb-2">
        <span className="font-bold uppercase tracking-wider text-white/60">{title}</span>
        <ExampleTag text={tag} />
      </div>
      <div className="mt-2">{children}</div>
    </div>
  );
}

// ── HERO ─────────────────────────────────────────────────────────────────────

/** The receipts, in three lines: the chain (the real page's verified-string
 *  format, audit-log/page.tsx:225-227), a verified citation, and the corpus
 *  as a DATED DECLARED SNAPSHOT (inventory §10 ruling). */
function ComplianceHeroTerminal() {
  return (
    <div className="rounded-lg border border-panel-border bg-panel/90 p-4 font-mono text-[11px] leading-relaxed shadow-2xl">
      <div className="flex items-center justify-between border-b border-panel-border pb-2">
        <span className="font-bold uppercase tracking-wider text-white/60">Compliance · the receipts</span>
        <ExampleTag text="Example set" />
      </div>
      <div className="mt-2 space-y-1 text-white/70">
        <p>
          <span className="text-brand-green">Chain verified — {EX.chainRows} rows</span>
          <span className="float-right text-white/50">genesis-anchored · SHA-256</span>
        </p>
        <p className="border-t border-panel-border pt-1">
          <span className="text-white">26 U.S.C. §162(a)</span>{' '}
          <span className="rounded-full border border-green-400/40 px-1.5 text-[10px] text-green-300">verified</span>
          <span className="float-right text-white/50">6 checks passed</span>
        </p>
        <p className="border-t border-panel-border pt-1 text-white">
          {EX.snapshot.documents} documents · {EX.snapshot.chunks} chunks
          <span className="float-right text-white/50">4 gov sources, on cron</span>
        </p>
        <p className="text-[10px] italic text-white/50">
          live counts, snapshotted {EX.snapshot.date} — the tab computes them fresh
        </p>
      </div>
    </div>
  );
}

// ── THE 7 SLIDE PANELS (the approved sequence) ───────────────────────────────

/** 1. A REAL REGULATORY CORPUS — mirrors Section C's tiles/per-source table
 *  (SectionC_CorpusContext.tsx) + the real cron schedules (inventory §1:
 *  ecfr-ingest daily 06:00 UTC · uscode weekly Sun 07:00 · fedreg hourly ·
 *  irb daily 02:00 · embed-pending every 6h, $10/run cap). Every ingest run
 *  writes a regulatory_ingest_run_completed audit row the UI displays. */
function CorpusPanel() {
  return (
    <DarkSlide title="The corpus — live sources, real schedules">
      <div className="space-y-1 text-white/70">
        <p className="text-white">
          {EX.snapshot.documents} documents · {EX.snapshot.chunks} chunks
          <span className="float-right text-[10px] text-white/50">snapshot {EX.snapshot.date}</span>
        </p>
        <p className="border-t border-panel-border pt-1"><span className="text-white/40">ecfr.gov</span> eCFR <span className="float-right text-white/80">daily · 06:00 UTC</span></p>
        <p><span className="text-white/40">uscode.house.gov</span> US Code <span className="float-right text-white/80">weekly · Sun 07:00</span></p>
        <p><span className="text-white/40">federalregister.gov</span> Fed. Register <span className="float-right text-white/80">hourly</span></p>
        <p><span className="text-white/40">irs.gov</span> Internal Revenue Bulletin <span className="float-right text-white/80">daily · 02:00</span></p>
        <p className="border-t border-panel-border pt-1 text-white/50">embeddings <span className="float-right text-white/80">every 6h · $10/run cap</span></p>
        <p className="pt-1 text-[10px] italic text-white/50">
          Each ingest run writes its own audit row — the corpus&rsquo;s freshness claim is itself on the chain.
        </p>
      </div>
    </DarkSlide>
  );
}

/** 2. CITATIONS THAT VERIFY — the REAL 8-check protocol with the honest split:
 *  6 live + 2 not_applicable/deferred (verifyCitation.ts:24-97 live checks,
 *  :116-128 deferred; route statusMap verify/route.ts:48-54). */
function ChecksPanel() {
  const live: Array<[string, string]> = [
    ['existence', 'HTTP HEAD, the source answers'],
    ['content_hash', 'GET + SHA-256 vs the locked hash'],
    ['source_authority', 'the registry row is active'],
    ['currency', 'not superseded, effective date set'],
    ['pinpoint', 'the cited subsection is present'],
    ['supersession', 'no superseding reference'],
  ];
  return (
    <DarkSlide title="Verify a citation — six live checks, two honest gaps">
      <div className="space-y-0.5 text-white/70">
        <p className="text-white">26 U.S.C. §162(a) <span className="float-right text-green-300">verified</span></p>
        {live.map(([name, what]) => (
          <p key={name}>
            <span className="text-green-300">✓</span> <span className="text-white/80">{name}</span>
            <span className="float-right text-white/50">{what}</span>
          </p>
        ))}
        <p><span className="text-white/40">○</span> <span className="text-white/40">groundedness</span> <span className="float-right text-white/40">not_applicable · deferred</span></p>
        <p><span className="text-white/40">○</span> <span className="text-white/40">jurisdiction_match</span> <span className="float-right text-white/40">not_applicable · deferred</span></p>
        <p className="pt-1 text-[10px] italic text-white/50">
          All eight results are stored and audit-logged per run. The two deferred checks say so on the
          record — even the checker declares its limits.
        </p>
      </div>
    </DarkSlide>
  );
}

/** 3. VERSION-LOCKED, ON THE RECORD — the retrieval lock (citations model:
 *  stable_uri unique, retrieved_at, retrieved_content_hash SHA-256,
 *  version_label, supersession chain — schema.prisma:2141-2199) with the
 *  CORRECTED language (inventory §10 truth-fix). Mismatch string verbatim
 *  (verifyCitation.ts:91). */
function VersionLockPanel() {
  return (
    <DarkSlide title="The lock — what 'cited' means here">
      <div className="space-y-1 text-white/70">
        <p><span className="text-white/40">stable_uri</span> <span className="float-right text-white/80">unique, permanent</span></p>
        <p><span className="text-white/40">retrieved_at</span> <span className="float-right text-white/80">the moment you pulled it</span></p>
        <p><span className="text-white/40">retrieved_content_hash</span> <span className="float-right text-white/80">SHA-256 of the body</span></p>
        <p><span className="text-white/40">version_label · effective_date</span> <span className="float-right text-white/80">which version, since when</span></p>
        <p><span className="text-white/40">superseded_by</span> <span className="float-right text-white/80">the chain of replacement</span></p>
        <p className="border-t border-panel-border pt-1 text-white/80">
          version-locked at retrieval (stable URI + SHA-256 content hash) · re-verify on demand
        </p>
        <p className="text-[10px] italic text-amber-300/80">
          if the source changes: &ldquo;hash mismatch — content may have changed&rdquo;
        </p>
      </div>
    </DarkSlide>
  );
}

/** 4. THE HASH CHAIN — mirrors the WORKING /compliance/audit-log page render:
 *  the on-load verify badge (:225-227), rows with prev→content hashes, the
 *  genesis anchor + recompute (verifyAuditChain.ts:36-96; writer
 *  writeAuditLog.ts:60-124). NEVER the workbench SectionI button (banned #5). */
function ChainPanel() {
  return (
    <DarkSlide title="The audit chain — recomputed, not displayed">
      <div className="space-y-1 text-white/70">
        <p className="text-brand-green">Chain verified — {EX.chainRows} rows</p>
        <p className="border-t border-panel-border pt-1"><span className="text-white/40">#1</span> genesis <span className="float-right text-white/50">prev: GENESIS · anchored constant</span></p>
        <p><span className="text-white/40">#4811</span> citation_verified <span className="float-right text-white/50">prev: 9f3a…c2 → this: 7d1e…a9</span></p>
        <p><span className="text-white/40">#4812</span> permission_granted <span className="float-right text-white/50">prev: 7d1e…a9 → this: b04c…51</span></p>
        <p className="pt-1 text-white/50">
          verify = re-hash every row&rsquo;s stored input and every link, from genesis to tip
        </p>
        <p className="text-[10px] italic text-amber-300/80">
          on tamper: &ldquo;content_hash does not match hash_input — possible tampering&rdquo; · the break point is named by sequence number
        </p>
      </div>
    </DarkSlide>
  );
}

/** 5. THE CHAIN AUDITS THE PAYWALL — the loop closes. The REAL event shape the
 *  entitlement webhook writes (stripe/webhook/route.ts:49-64, verified):
 *  actor external_integration ('stripe-webhook'), permission_granted, target
 *  user_category_entitlements, after {key, status:'active'}, request_id
 *  `${eventId}:${userId}:${key}` (the idempotency key writeAuditLog dedupes
 *  on). Ids below are declared-example values in the real formats. */
function LoopPanel() {
  return (
    <DarkSlide title="The loop — the paywall's own receipt">
      <div className="space-y-1 text-white/70">
        <p className="text-white/40">audit_log #4812</p>
        <p><span className="text-white/40">action</span> <span className="text-white">permission_granted</span></p>
        <p><span className="text-white/40">actor</span> <span className="float-right text-white/80">external_integration · stripe-webhook</span></p>
        <p><span className="text-white/40">target</span> <span className="float-right text-white/80">user_category_entitlements</span></p>
        <p><span className="text-white/40">after</span> <span className="float-right text-white/80">{'{ key: "tab:compliance", status: "active" }'}</span></p>
        <p><span className="text-white/40">request_id</span> <span className="float-right text-white/80">evt_…:usr_…:tab:compliance</span></p>
        <p className="pt-1 text-[10px] italic text-white/50">
          Every unlock sold on the other eight tabs lands here as a hash-chained row — retries can&rsquo;t
          double-log (the id is the dedupe key). The machine audits itself.
        </p>
      </div>
    </DarkSlide>
  );
}

/** 6. DISCOVERY, GATED AND REAL — the sub-page's actual synchronous run
 *  (runDiscovery.ts:8,73; gate order runs/route.ts:36-72). GATED before the
 *  paid call; NO throttling claim (the route has none — inventory flag). */
function DiscoveryPanel() {
  return (
    <DarkSlide title="Discovery — scoped by construction">
      <div className="space-y-1 text-white/70">
        <p><span className="text-white/40">gate</span> <span className="float-right text-white/80">account → entitlement → profile → one run at a time</span></p>
        <p><span className="text-white/40">model</span> <span className="float-right text-white/80">claude-sonnet-4-6 · one call per run</span></p>
        <p><span className="text-white/40">web search</span> <span className="float-right text-white/80">restricted to the registry&rsquo;s active domains</span></p>
        <p className="border-t border-panel-border pt-1 text-white/50">
          initiated → web_search_running → synthesis_running → citation_verification → completed
        </p>
        <p><span className="text-white/40">out</span> <span className="float-right text-white/80">proposals: mission → project → workstream → task</span></p>
        <p><span className="text-white/40">cost</span> <span className="float-right text-white/80">in USD, to four decimals, on the run row</span></p>
        <p className="pt-1 text-[10px] italic text-white/50">
          The search cannot leave the vetted sources — and the run&rsquo;s start, cost, and finish are
          themselves audit rows.
        </p>
      </div>
    </DarkSlide>
  );
}

/** 7. COMPLIANCE AS A LIFECYCLE — the real compliance_tasks TRACKING model
 *  (schema.prisma:2537-2548 attestation/evidence fields; statuses incl.
 *  awaiting_evidence / awaiting_attestation :2389-2390). Copy describes the
 *  model, never an attest-button flow (none exists — inventory §5); evidence
 *  here means linked citations. */
function LifecyclePanel() {
  return (
    <DarkSlide title="The lifecycle — obligations as tickets">
      <div className="space-y-1 text-white/70">
        <p className="text-white/40">a compliance task carries:</p>
        <p><span className="text-white/40">status</span> <span className="float-right text-white/80">… awaiting_evidence · awaiting_attestation …</span></p>
        <p><span className="text-white/40">risk</span> <span className="float-right text-white/80">inherent likelihood × impact · penalty</span></p>
        <p><span className="text-white/40">attestation_frequency</span> <span className="float-right text-white/80">how often it must be re-affirmed</span></p>
        <p><span className="text-white/40">attestation_expires_at</span> <span className="float-right text-white/80">when the last affirmation lapses</span></p>
        <p><span className="text-white/40">evidence_freshness_days</span> <span className="float-right text-white/80">how stale proof may get</span></p>
        <p><span className="text-white/40">citations</span> <span className="float-right text-white/80">the verified authority it rests on</span></p>
        <p className="pt-1 text-[10px] italic text-white/50">
          Tracked in a missions → projects → workstreams → tasks tree, with evidence and expiry
          modeled — not vibes. Evidence here means linked, verifiable citations.
        </p>
      </div>
    </DarkSlide>
  );
}

// ── THE DECK ─────────────────────────────────────────────────────────────────

export default function ComplianceReceiptsDeck({ onRequireAuth, cta }: DeckProps) {
  return (
    <TabShowcaseTemplate
      darkHero={{
        eyebrow: 'Compliance — the receipts',
        headline: 'Don’t trust us. Verify us.',
        subcopy:
          'Every claim on this platform has a receipt — a hash-chained audit log you can recompute, citations that verify against the government source, and a real regulatory corpus refreshed on real schedules. This tab is where the receipts live.',
        cta: (
          <button
            type="button"
            onClick={onRequireAuth}
            className="rounded bg-white px-5 py-2 text-sm font-semibold text-brand-purple hover:opacity-90"
          >
            Make my free account
          </button>
        ),
        panel: <ComplianceHeroTerminal />,
      }}
      editorialTitle="The receipts, one by one"
      editorialRows={[
        {
          title: 'A real regulatory corpus, on real schedules.',
          copy:
            'eCFR daily, the US Code weekly, the Federal Register hourly, the Internal Revenue Bulletin daily — ingested from the government sources themselves, chunked and embedded every six hours under a cost cap. And every ingest run writes its own audit row: the freshness claim is itself on the chain.',
          panel: <CorpusPanel />,
          panelSide: 'left',
        },
        {
          title: 'Citations that verify — and a checker that declares its limits.',
          copy:
            'One click re-fetches the source and runs the integrity protocol: does the page still exist, does its hash still match, is the authority still active, is the version still current. Six checks run for real. Two are honestly marked not-yet — stored as “not applicable, deferred,” on the record, instead of pretending.',
          panel: <ChecksPanel />,
          panelSide: 'right',
        },
        {
          title: 'The statute you cited is the statute you saw.',
          copy:
            'Every citation is version-locked at retrieval: a stable URI, the exact retrieval time, and a SHA-256 hash of the content you actually read. Re-verify whenever you want — if the source has changed since, the hash mismatch says so in plain words. No silent drift between what you cited and what’s there now.',
          panel: <VersionLockPanel />,
          panelSide: 'left',
        },
        {
          title: 'Break one row, the whole chain screams.',
          copy:
            'Every grant, edit, verification, and run lands in an append-only log where each row carries a SHA-256 of its own content and the hash of the row before it, back to a fixed genesis anchor. Verification doesn’t trust the display — it re-hashes every stored input and every link, and names the exact sequence number where anything breaks.',
          panel: <ChainPanel />,
          panelSide: 'right',
        },
        {
          title: 'The chain audits the paywall.',
          copy:
            'The unlocks sold on every other tab of this site land here as rows: the payment webhook writes permission_granted with its own integration identity, the entitlement it flipped, and an idempotency key that makes double-logging impossible. The ninth tab keeps receipts on the first eight. The machine audits itself.',
          panel: <LoopPanel />,
          panelSide: 'left',
        },
        {
          title: 'AI discovery that can only search the sources on the registry.',
          copy:
            'One gated model call scopes your compliance posture — and its web search is restricted, by construction, to the vetted regulatory domains on the source registry. It proposes a work tree with citation payloads; its start, cost, and completion are audit rows. Gated before a cent is spent.',
          panel: <DiscoveryPanel />,
          panelSide: 'right',
        },
        {
          title: 'Obligations tracked like engineering tickets.',
          copy:
            'Missions break into projects, workstreams, and tasks — each task carrying risk, penalty, monitoring cadence, attestation frequency and expiry, and evidence freshness, with verified citations as its authority. Compliance as a lifecycle with dates and hashes, not a binder and vibes.',
          panel: <LifecyclePanel />,
          panelSide: 'left',
        },
      ]}
      // The all-mirror connective line — this deck's unique truth (inventory
      // §10: no public seam exists; every panel above is a labeled mirror).
      sample={
        <p className="text-center text-sm text-text-secondary">
          Nothing on this page is mounted live — this tab guards real compliance data behind the
          entitlement, so every panel here is a labeled, faithful mirror of the real screens. The
          chain, the checks, and the crons are real; sign in and unlock to run them.
        </p>
      }
      cta={cta}
    />
  );
}
