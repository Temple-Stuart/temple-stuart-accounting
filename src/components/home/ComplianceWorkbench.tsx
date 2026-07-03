'use client';

import Link from 'next/link';
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

/**
 * COMP-1 — the Compliance A–J institutional workbench for the homepage Compliance tab.
 *
 * Renders the standalone /compliance page's exact section order (SectionA_IdentityBar →
 * Sections B…J), MINUS its AppLayout chrome (the homepage tab supplies the shell). Each
 * section is a zero-prop, self-fetching component that manages its own loading/error —
 * this component adds no fetch logic and no fallback state of its own.
 *
 * The standalone page's OpsSubNav is deliberately NOT mounted here: it carries
 * standalone-app assumptions (usePathname-based active state that is inert on '/',
 * font-mono terminal styling, and disabled cross-nav placeholders that duplicate the
 * homepage tabs). Instead we render a homepage-styled link row to the six sub-pages,
 * which keep their own routes + AppLayout chrome (unchanged).
 */

const SUBPAGES: { name: string; href: string }[] = [
  { name: 'Profile', href: '/compliance/profile' },
  { name: 'Discovery', href: '/compliance/discovery' },
  { name: 'Registry', href: '/compliance/registry' },
  { name: 'Citations', href: '/compliance/citations' },
  { name: 'Audit Log', href: '/compliance/audit-log' },
  { name: 'Missions', href: '/compliance/missions' },
];

export default function ComplianceWorkbench() {
  return (
    <div className="space-y-4">
      <SectionA_IdentityBar />

      {/* Sub-page link row — replaces OpsSubNav's role, homepage-styled. Each link opens
          the existing sub-page route (which keeps its own AppLayout chrome). */}
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

      {/* Sections B…J in the standalone page's order (compliance/page.tsx:39-47). */}
      <SectionB_FounderProfile />
      <SectionC_CorpusContext />
      <SectionD_DiscoveryLauncher />
      <SectionE_LiveStream />
      <SectionF_Roadmap />
      <SectionG_CitationVerification />
      <SectionH_CorpusInspector />
      <SectionI_AuditTail />
      <SectionJ_CostLedger />
    </div>
  );
}
