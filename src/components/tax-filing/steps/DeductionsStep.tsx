'use client';

import type { StepProps } from '../TaxFilingWizard';

// Step 3 — Deductions (Schedule C). Placeholder; the real implementation
// will render the Schedule C line-item breakdown with drill-down to
// ledger entries, pulling from generateScheduleC().

export default function DeductionsStep(_props: StepProps) {
  return (
    <div className="space-y-3 text-sm text-gray-700">
      <p className="font-medium">Step 4: Deductions — coming soon</p>
      <p className="text-gray-500">
        Business expenses (Schedule C). This step will render the Schedule
        C line-item breakdown sourced from the sole-prop entity's ledger
        via{' '}
        <code className="font-mono text-xs bg-gray-100 px-1 rounded">
          generateScheduleC()
        </code>
        , with drill-down into individual ledger entries and unmapped-
        account warnings.
      </p>
    </div>
  );
}
