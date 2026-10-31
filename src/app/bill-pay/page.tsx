'use client';

/**
 * TOOL-LAW-01 — /bill-pay, BILL PAY'S ONE PAGE (tool 08, MONEY OUT). BILLPAY-01 (Alex, 2026-10-28, ruling B).
 *
 * Every bill and its due days in a month, paid or overdue, from the postings linked by hand: BillPaySection — one read
 * (GET /api/bill-pay), the shared DataTable, ‹ month ›, and on each row the existing manual link picker. It pays nothing
 * and schedules nothing. The page is the house's shell: the opener (family, name, registry line) and the one mount —
 * not mounted on Expenses or anywhere else. PHASES_RENDERED_AT['/bill-pay'] is [] (nav.ts): no strip, no phase.
 */
import AppLayout from '@/components/ui/AppLayout';
import ToolOpener from '@/components/shell/ToolOpener';
import { navToolByName } from '@/lib/nav';
import { TOOL_GATE } from '@/lib/offer';
import BillPaySection from '@/components/workbench/operations/billpay/BillPaySection';

export default function BillPayPage() {
  return (
    <AppLayout page>
      <ToolOpener tools={[navToolByName('Bill Pay', TOOL_GATE)]} />
      <div className="space-y-3" data-tool-page="Bill Pay">
        <BillPaySection />
      </div>
    </AppLayout>
  );
}
