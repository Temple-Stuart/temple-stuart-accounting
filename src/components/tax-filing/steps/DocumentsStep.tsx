'use client';

import type { StepProps } from '../TaxFilingWizard';

// Step 1 — Documents. Placeholder; the real implementation will let the user
// upload or manually enter W-2, 1099-R, 1098-T, 1098-E forms (tax_documents
// table) and mirror the existing dashboard/tax Document modal.

export default function DocumentsStep(_props: StepProps) {
  return (
    <div className="space-y-3 text-sm text-gray-700">
      <p className="font-medium">Step 2: Documents — coming soon</p>
      <p className="text-gray-500">
        Upload or enter your tax documents. This step will mirror the
        W-2 / 1099-R / 1098-T / 1098-E entry flow that currently lives in
        the Tax Forms dashboard tab, storing data in the{' '}
        <code className="font-mono text-xs bg-gray-100 px-1 rounded">
          tax_documents
        </code>{' '}
        table.
      </p>
    </div>
  );
}
