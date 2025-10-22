'use client';

import { useState } from 'react';
import { ImportDataSection } from '@/components/dashboard/ImportDataSection';
import ChartOfAccountsTab from '@/components/dashboard/ChartOfAccountsTab';
import JournalEntriesTab from '@/components/dashboard/JournalEntriesTab';
import LedgerTab from '@/components/dashboard/LedgerTab';
import ReconciliationTab from '@/components/dashboard/ReconciliationTab';
import AdjustingEntriesTab from '@/components/dashboard/AdjustingEntriesTab';
import FinancialStatementsTab from '@/components/dashboard/FinancialStatementsTab';
import ThreeStatementAnalysisTab from '@/components/dashboard/ThreeStatementAnalysisTab';
import MetricsAndProjectionsTab from '@/components/dashboard/MetricsAndProjectionsTab';
import CloseBooksTab from '@/components/dashboard/CloseBooksTab';
import TradingJournalTab from '@/components/dashboard/TradingJournalTab';
import SpendingTab from '@/components/dashboard/SpendingTab';

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
    { id: 10, name: 'Close Books' },
    { id: 11, name: 'Trading Journal' },
    { id: 12, name: 'Spending' }
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-full mx-auto px-4 py-8">
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
            {activeStep === 2 && <ChartOfAccountsTab />}
            {activeStep === 3 && <JournalEntriesTab />}
            {activeStep === 4 && <LedgerTab />}
            {activeStep === 5 && <ReconciliationTab />}
            {activeStep === 6 && <AdjustingEntriesTab />}
            {activeStep === 7 && <FinancialStatementsTab />}
            {activeStep === 8 && <ThreeStatementAnalysisTab />}
            {activeStep === 9 && <MetricsAndProjectionsTab />}
            {activeStep === 10 && <CloseBooksTab />}
            {activeStep === 11 && <TradingJournalTab />}
            {activeStep === 12 && <SpendingTab />}
          </div>
        </div>
      </div>
    </div>
  );
}
