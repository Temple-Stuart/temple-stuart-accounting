'use client';

import type { StepProps } from '../TaxFilingWizard';

// Step 2 — Income review. Placeholder; the real implementation will show
// Form 1040 Line 1 / 4a / 4b / 5a / 5b computations sourced from
// tax_documents + ledger (Personal entity 4000) and let the user edit
// overrides before confirming.

export default function IncomeReviewStep(_props: StepProps) {
  return (
    <div className="space-y-3 text-sm text-gray-700">
      <p className="font-medium">Step 3: Income — coming soon</p>
      <p className="text-gray-500">
        Review your income sources: W-2 wages, retirement distributions,
        interest, and dividends. Amounts will come from{' '}
        <code className="font-mono text-xs bg-gray-100 px-1 rounded">
          tax_documents
        </code>{' '}
        with Personal-entity ledger and{' '}
        <code className="font-mono text-xs bg-gray-100 px-1 rounded">
          tax_overrides
        </code>{' '}
        as secondary sources.
      </p>
    </div>
  );
}
