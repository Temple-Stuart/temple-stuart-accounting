'use client';

import type { StepProps } from '../TaxFilingWizard';

// Step 5 — Review (Form 1040). Placeholder; the real implementation will
// render the full Form 1040 with traced line items, bracket breakdown,
// AGI/taxable-income/total-tax/payments/refund-or-owed, sourced from
// generateForm1040().

export default function ReviewStep(_props: StepProps) {
  return (
    <div className="space-y-3 text-sm text-gray-700">
      <p className="font-medium">Step 6: Review — coming soon</p>
      <p className="text-gray-500">
        Form 1040 complete return review. This step will render every line
        of the 1040 with traced source information, bracket breakdown, and
        the bottom-line refund-or-owed calculation, sourced from{' '}
        <code className="font-mono text-xs bg-gray-100 px-1 rounded">
          generateForm1040()
        </code>
        .
      </p>
    </div>
  );
}
