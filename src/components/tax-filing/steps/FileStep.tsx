'use client';

import type { StepProps } from '../TaxFilingWizard';

// Step 6 — File (export & filing options). Placeholder; the real
// implementation will offer PDF downloads (Form 1040, Schedule C,
// Schedule D, Form 8949, Schedule 1, Form 8863) via /api/tax/generate-pdf
// and Form 8949 CSV for TurboTax import via /api/tax/export.

export default function FileStep(_props: StepProps) {
  return (
    <div className="space-y-3 text-sm text-gray-700">
      <p className="font-medium">Step 7: File — coming soon</p>
      <p className="text-gray-500">
        Export and filing options. This step will offer PDF downloads of
        every generated form via{' '}
        <code className="font-mono text-xs bg-gray-100 px-1 rounded">
          /api/tax/generate-pdf
        </code>{' '}
        and Form 8949 CSV for TurboTax import via{' '}
        <code className="font-mono text-xs bg-gray-100 px-1 rounded">
          /api/tax/export
        </code>
        . E-file (MeF) is out of scope for this release.
      </p>
    </div>
  );
}
