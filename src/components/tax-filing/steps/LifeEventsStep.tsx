'use client';

import type { StepProps } from '../TaxFilingWizard';
import type { LifeEvents } from '../TaxFilingWizard';

// Step 0 — Life events checklist. The only step that actually reads/writes
// lifeEvents in this PR. Other steps will wire up to the data it drives.

const ITEMS: Array<{
  key: keyof LifeEvents;
  title: string;
  detail: string;
}> = [
  { key: 'hasW2', title: 'I had a W-2 job', detail: 'Employer withheld taxes on your wages' },
  { key: 'hasBusiness', title: 'I ran a business or side gig', detail: 'Self-employed, freelance, 1099 work (Schedule C)' },
  { key: 'hasTrading', title: 'I bought or sold investments', detail: 'Stocks, options, crypto (Schedule D + 8949)' },
  { key: 'hasRetirement', title: 'I contributed to or withdrew from retirement', detail: 'IRA, 401(k), 403(b) (1099-R)' },
  { key: 'hasStudentLoan', title: 'I paid student loan interest', detail: 'Up to $2,500 deduction (1098-E)' },
  { key: 'hasEducation', title: 'I paid for education', detail: 'Tuition, fees, books (1098-T, Form 8863)' },
  { key: 'hasInterestDividends', title: 'I earned interest or dividends', detail: '1099-INT, 1099-DIV' },
  { key: 'hasRental', title: 'I rented out property', detail: 'Rental income and expenses (Schedule E)' },
];

export default function LifeEventsStep({
  lifeEvents,
  setLifeEvents,
  autoDetected,
}: StepProps) {
  const toggle = (key: keyof LifeEvents) => {
    setLifeEvents({ ...lifeEvents, [key]: !lifeEvents[key] });
  };

  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-600">
        Check everything that happened to you this year. We'll use this to
        guide the rest of the wizard and only ask you about relevant forms.
      </p>
      <ul className="divide-y divide-gray-100 border border-gray-200 rounded-md">
        {ITEMS.map((item) => {
          const checked = lifeEvents[item.key];
          const detected = autoDetected[item.key];
          return (
            <li key={item.key}>
              <label className="flex items-start gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggle(item.key)}
                  className="mt-0.5 w-4 h-4 accent-blue-600"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-900">
                      {item.title}
                    </span>
                    {detected && (
                      <span className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded">
                        auto-detected
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">{item.detail}</p>
                </div>
              </label>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
