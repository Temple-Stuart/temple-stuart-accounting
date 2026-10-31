/**
 * src/app/ops/page.tsx
 *
 * The institutional single-page workbench. Replaces the legacy tabbed
 * landing page. Sections A through J render in a continuous vertical
 * stream per architecture doc § 6.
 *
 * Five sections wire fully today: A · B · C · F · I
 * One section partially: H (BM25 keyword search; HNSW after PR-J)
 * Four placeholders: D · E · G · J (with explicit Phase-X notices)
 *
 * The placeholders are intentional scaffolding. Each future PR fills in
 * one section without restructuring the page:
 *   PR-J Voyage embeddings → upgrades H from BM25 to HNSW
 *   PR-16-25 ensemble       → fills in D and E
 *   PR-23 cost ledger       → fills in J
 *   PR-26-35 verifier       → fills in G
 */

import AppLayout from '@/components/ui/AppLayout';
// LOCK-01: this page renders a paid module — it asks the tab's own question
// first. This is a SERVER component, so it uses the server twin (roomGate →
// hasTabAccess); the client pages use useTabLock. Both resolve keysGranting.
import RoomLock from '@/components/shell/RoomLock';
import { roomGate } from '@/lib/roomGate';
import ToolOpener from '@/components/shell/ToolOpener';
import { navToolByName } from '@/lib/nav';
import { TOOL_GATE } from '@/lib/offer';
import OpsSubNav from '@/components/ops/OpsSubNav';
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

export default async function OpsWorkbenchPage() {
  // LOCK-01: the same question the Compliance tab asks.
  const { locked } = await roomGate('tab:compliance');
  return (
    <AppLayout>
      <RoomLock locked={locked} stepName="Compliance">
      <SectionA_IdentityBar />
      <OpsSubNav />
      <div className="max-w-[1600px] mx-auto px-4 pt-4 pb-8 space-y-4">
        {/* NAV-25: the screen names the TOOL it is — /compliance is Compliance's. */}
        <ToolOpener tools={[navToolByName('Compliance', TOOL_GATE)]} />
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
    </RoomLock>
    </AppLayout>
  );
}
