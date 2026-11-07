'use client';

/**
 * TOOL-LAW-01 — /crm, CRM'S ONE PAGE (tool 04, MONEY IN). CRM-01a (Alex, 2026-11-06, ruling A).
 *
 * The people you sell to, in three flat tables — contacts, proposals and signups: CrmSection — one read (GET /api/crm),
 * three shared DataTables. It writes nothing yet (CRM-01b sets a stage and a next step, and adds a contact by hand). The
 * page is the house's shell: the opener (family, name, registry line) and the one mount — not mounted anywhere else.
 * PHASES_RENDERED_AT['/crm'] is [] (nav.ts): no strip, no phase.
 */
import AppLayout from '@/components/ui/AppLayout';
import ToolOpener from '@/components/shell/ToolOpener';
import { navToolByName } from '@/lib/nav';
import { TOOL_GATE } from '@/lib/offer';
import CrmSection from '@/components/crm/CrmSection';

export default function CrmPage() {
  return (
    <AppLayout page>
      <ToolOpener tools={[navToolByName('CRM', TOOL_GATE)]} />
      <div className="space-y-3" data-tool-page="CRM">
        <CrmSection />
      </div>
    </AppLayout>
  );
}
