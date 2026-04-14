'use client';

import type { StepProps } from '../TaxFilingWizard';

// Step 4 — Trading (Schedule D + Form 8949). Placeholder; the real
// implementation will render the 8949 entries and Schedule D summary
// sourced from generateTaxReport(), with wash-sale merging and box
// coding already handled by the service layer.

export default function TradingStep(_props: StepProps) {
  return (
    <div className="space-y-3 text-sm text-gray-700">
      <p className="font-medium">Step 5: Trading — coming soon</p>
      <p className="text-gray-500">
        Capital gains and losses (Schedule D + Form 8949). This step will
        render the 8949 entries and Schedule D summary sourced from{' '}
        <code className="font-mono text-xs bg-gray-100 px-1 rounded">
          generateTaxReport()
        </code>
        , including wash-sale detection warnings and per-entry box coding
        (A/B/C/D/E/F).
      </p>
    </div>
  );
}
