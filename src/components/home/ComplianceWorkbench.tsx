'use client';

import Link from 'next/link';
import { useState } from 'react';
import { SectionA_IdentityBar } from '@/components/workbench/SectionA_IdentityBar';
import { SectionB_FounderProfile } from '@/components/workbench/SectionB_FounderProfile';
import { SectionC_CorpusContext } from '@/components/workbench/SectionC_CorpusContext';
import { SectionD_DiscoveryLauncher } from '@/components/workbench/SectionD_DiscoveryLauncher';
import { SectionE_LiveStream } from '@/components/workbench/SectionE_LiveStream';
import { SectionF_Roadmap } from '@/components/workbench/SectionF_Roadmap';
import { SectionG_CitationVerification } from '@/components/workbench/SectionG_CitationVerification';
import { SectionH_CorpusInspector } from '@/components/workbench/SectionH_CorpusInspector';
import { SectionI_AuditTail } from '@/components/workbench/SectionI_AuditTail';
import { SectionJ_CostLedger } from '@/components/workbench/SectionJ_CostLedger';
// COMPLIANCE-PIPE: the ratified Pipe Frame — StageStrip REPLACES the
// COMPLIANCE-UX-1 ToggleStrip (the Trade/Books precedent: one phase
// control, never two; control replaced, surfaces preserved). The sub-page
// link row above is ROUTE navigation (a different axis) and stays.
import StageStrip, { type StagePhase } from '@/components/ui/StageStrip';
import SectionHeader from '@/components/ui/SectionHeader';
import ProofStrip from '@/components/ui/ProofStrip';
import { PIPE_PHASES, type PipePhase } from '@/lib/pipePhases';

/**
 * COMP-1 → COMPLIANCE-PIPE — the Compliance A–J institutional workbench as
 * the sixth Pipe Frame strip.
 *
 * Phase → surface (every section in exactly one phase; A–J relative order
 * preserved WITHIN each phase — the Books nesting precedent):
 *   01 Profile  = B (founder profile)
 *   02 Corpus   = C (live corpus state)
 *   03 Retrieve = H (hybrid retrieval over the regulatory corpus)
 *   04 Discover = D (run launcher) → E (live stream) → F (missions the runs
 *                 feed) → J (the runs' cost ledger)
 *   05 Verify   = G (citation verification — the honest UNBUILT placeholder
 *                 renders AS-IS; its limit chip moves with it)
 *   06 Register = I (audit tail + the hash chain — the tamper-evident
 *                 registry surface)
 * Surfaces are CSS show/hide, ALL MOUNTED (the COMPLIANCE-UX-1 keep-mounted
 * contract preserved — every section's self-fetched state survives
 * switching). Default phase 'verify' — preserving the ruled "verify-us
 * leads" first-chip prominence (structural only, zero marketing copy).
 *
 * States are DERIVED INDICATORS, never locks (the ratified amendment) — the
 * children's onTotals report-ups (the Books idiom, zero new fetches) feed
 * them; an unreported or honestly-underivable signal renders pending
 * (Discover: the launcher is a placeholder; Verify: G is UNBUILT — the
 * Travel-Search precedent, declared). The identity bar (build SHA + audit
 * hash) and the sub-page nav stay ABOVE the strip, persistent; the
 * ProofStrip receipts rail sits at the foot. G13/G14 entity guards and the
 * wave-2 ledger items are untouched by construction (no section internals
 * edited beyond the optional report-up props).
 */

const SUBPAGES: { name: string; href: string }[] = [
  { name: 'Profile', href: '/compliance/profile' },
  { name: 'Discovery', href: '/compliance/discovery' },
  { name: 'Registry', href: '/compliance/registry' },
  { name: 'Citations', href: '/compliance/citations' },
  { name: 'Audit Log', href: '/compliance/audit-log' },
  { name: 'Missions', href: '/compliance/missions' },
];

// Widened to the interface so the optional fields type-check across the
// union of literal rows (the Travel precedent).
const [PIPE_PROFILE, PIPE_CORPUS, PIPE_RETRIEVE, PIPE_DISCOVER, PIPE_VERIFY, PIPE_REGISTER] =
  PIPE_PHASES.compliance as readonly PipePhase[];

type CompliancePhase = 'profile' | 'corpus' | 'retrieve' | 'discover' | 'verify' | 'register';

export default function ComplianceWorkbench() {
  // COMPLIANCE-PIPE: the phase control's state + the children's reported
  // tallies. null / false = not reported yet → pending + honest empty.
  const [phase, setPhase] = useState<CompliancePhase>('verify');
  const [profileTotals, setProfileTotals] = useState<{ entities: number } | null>(null);
  const [corpusTotals, setCorpusTotals] = useState<{ documents: number } | null>(null);
  const [missionTotals, setMissionTotals] = useState<{ missions: number } | null>(null);
  const [auditTotals, setAuditTotals] = useState<{ rows: number } | null>(null);
  // Session-scoped signals: a successful retrieval ran; the chain check's
  // three-truth outcome (VERIFY-TRUTH — 'failed' is never 'invalid').
  const [retrieveRan, setRetrieveRan] = useState(false);
  const [chainState, setChainState] = useState<'valid' | 'invalid' | 'failed' | null>(null);

  const surface = (key: CompliancePhase) => (phase === key ? 'block' : 'hidden');

  // FINISH-DS-1: single-consumer (ML) — always dark.
  return (
    <div className="space-y-4">
      <SectionA_IdentityBar />

      {/* Sub-page link row — ROUTE navigation to the six standalone pages
          (their own AppLayout chrome); persistent above the strip, a
          different axis from the phase control. */}
      <nav aria-label="Compliance sub-pages" className="flex flex-wrap gap-2">
        {SUBPAGES.map((p) => (
          <Link
            key={p.href}
            href={p.href}
            className="rounded-lg border border-brand-purple/20 bg-brand-purple/5 px-3 py-1.5 text-sm font-medium text-brand-purple transition-colors hover:bg-brand-purple/10"
          >
            {p.name}
          </Link>
        ))}
      </nav>

      <StageStrip
        phases={([
          { key: 'profile', num: PIPE_PROFILE.num, label: PIPE_PROFILE.name, subLabel: PIPE_PROFILE.subLabel,
            state: phase === 'profile' ? 'active' : (profileTotals?.entities ?? 0) > 0 ? 'done' : 'pending' },
          { key: 'corpus', num: PIPE_CORPUS.num, label: PIPE_CORPUS.name, subLabel: PIPE_CORPUS.subLabel,
            state: phase === 'corpus' ? 'active' : (corpusTotals?.documents ?? 0) > 0 ? 'done' : 'pending' },
          { key: 'retrieve', num: PIPE_RETRIEVE.num, label: PIPE_RETRIEVE.name, subLabel: PIPE_RETRIEVE.subLabel,
            state: phase === 'retrieve' ? 'active' : retrieveRan ? 'done' : 'pending' },
          { key: 'discover', num: PIPE_DISCOVER.num, label: PIPE_DISCOVER.name, subLabel: PIPE_DISCOVER.subLabel,
            state: phase === 'discover' ? 'active' : 'pending' },
          { key: 'verify', num: PIPE_VERIFY.num, label: PIPE_VERIFY.name, subLabel: PIPE_VERIFY.subLabel,
            state: phase === 'verify' ? 'active' : 'pending' },
          { key: 'register', num: PIPE_REGISTER.num, label: PIPE_REGISTER.name, subLabel: PIPE_REGISTER.subLabel,
            state: phase === 'register' ? 'active' : chainState === 'valid' ? 'done' : 'pending' },
        ] as StagePhase[])}
        onSelect={(k) => setPhase(k as CompliancePhase)}
      />

      {/* ── 01 Profile ── */}
      <div className={surface('profile')}>
        <div className="space-y-4">
          <SectionHeader kicker={`${PIPE_PROFILE.num} / ${PIPE_PROFILE.name}`} right={`PHASE ${PIPE_PROFILE.num} OF 06`} />
          <SectionB_FounderProfile onTotals={setProfileTotals} />
        </div>
      </div>

      {/* ── 02 Corpus ── */}
      <div className={surface('corpus')}>
        <div className="space-y-4">
          <SectionHeader kicker={`${PIPE_CORPUS.num} / ${PIPE_CORPUS.name}`} right={`PHASE ${PIPE_CORPUS.num} OF 06`} />
          <SectionC_CorpusContext onTotals={setCorpusTotals} />
        </div>
      </div>

      {/* ── 03 Retrieve ── */}
      <div className={surface('retrieve')}>
        <div className="space-y-4">
          <SectionHeader kicker={`${PIPE_RETRIEVE.num} / ${PIPE_RETRIEVE.name}`} right={`PHASE ${PIPE_RETRIEVE.num} OF 06`} />
          <SectionH_CorpusInspector onSearched={() => setRetrieveRan(true)} />
        </div>
      </div>

      {/* ── 04 Discover — launcher → stream → missions → cost (nested, A–J
            order preserved; the D/J placeholder limit-chips ride along). ── */}
      <div className={surface('discover')}>
        <div className="space-y-4">
          <SectionHeader kicker={`${PIPE_DISCOVER.num} / ${PIPE_DISCOVER.name}`} right={`PHASE ${PIPE_DISCOVER.num} OF 06`} />
          <SectionD_DiscoveryLauncher />
          <SectionE_LiveStream />
          <SectionF_Roadmap onTotals={setMissionTotals} />
          <SectionJ_CostLedger />
        </div>
      </div>

      {/* ── 05 Verify — G renders AS-IS with its own UNBUILT limit chip
            (the honest-placeholder precedent; never an invented surface). ── */}
      <div className={surface('verify')}>
        <div className="space-y-4">
          <SectionHeader kicker={`${PIPE_VERIFY.num} / ${PIPE_VERIFY.name}`} right={`PHASE ${PIPE_VERIFY.num} OF 06`} />
          <SectionG_CitationVerification />
        </div>
      </div>

      {/* ── 06 Register — the audit tail + hash chain. ── */}
      <div className={surface('register')}>
        <div className="space-y-4">
          <SectionHeader kicker={`${PIPE_REGISTER.num} / ${PIPE_REGISTER.name}`} right={`PHASE ${PIPE_REGISTER.num} OF 06`} />
          <SectionI_AuditTail onTotals={setAuditTotals} onChain={setChainState} />
        </div>
      </div>

      {/* COMPLIANCE-PIPE: the receipts rail — reported state only, honest
          empties ("not run yet" for the user-triggered chain check). */}
      <ProofStrip
        receipts={[
          { label: 'CORPUS DOCS', value: corpusTotals ? String(corpusTotals.documents) : undefined, emptyLabel: 'not loaded yet' },
          { label: 'MISSIONS', value: missionTotals ? String(missionTotals.missions) : undefined, emptyLabel: 'not loaded yet' },
          { label: 'AUDIT ROWS', value: auditTotals ? String(auditTotals.rows) : undefined, emptyLabel: 'not loaded yet' },
          { label: 'CHAIN CHECK', value: chainState ? chainState.toUpperCase() : undefined, emptyLabel: 'not run yet' },
        ]}
      />
    </div>
  );
}
