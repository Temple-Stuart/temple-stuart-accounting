'use client';

import { useState } from 'react';
import { ImportDataSection } from '@/components/dashboard/ImportDataSection';

export default function Dashboard() {
  const [activeStep, setActiveStep] = useState(1);
  const [activeEntity, setActiveEntity] = useState('personal');
  
  const pipelineSteps = [
    { id: 1, name: 'Import Data' },
    { id: 2, name: 'Chart of Accounts' },
    { id: 3, name: 'Journal Entries' },
    { id: 4, name: 'Post to Ledger' },
    { id: 5, name: 'Reconciliation' },
    { id: 6, name: 'Adjusting Entries' },
    { id: 7, name: 'Financial Statements' },
    { id: 8, name: '3-Statement Analysis' },
    { id: 9, name: 'Metrics & Projections' },
    { id: 10, name: 'Close Books' }
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-8">Temple Stuart Accounting</h1>
        
        <div className="flex gap-8">
          <div className="w-64">
            <nav className="space-y-1">
              {pipelineSteps.map((step) => (
                <button
                  key={step.id}
                  onClick={() => setActiveStep(step.id)}
                  className={`w-full text-left px-3 py-2 rounded ${
                    activeStep === step.id ? 'bg-[#b4b237] text-white' : 'bg-white'
                  }`}
                >
                  {step.id}. {step.name}
                </button>
              ))}
            </nav>
          </div>

          <div className="flex-1">
            {activeStep === 1 && <ImportDataSection entityId={activeEntity} />}
            {activeStep !== 1 && <div>Step {activeStep} - Coming Soon</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
