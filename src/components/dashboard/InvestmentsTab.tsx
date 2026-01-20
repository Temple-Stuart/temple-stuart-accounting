'use client';

import { useState } from 'react';
import CommittedInvestmentsTable from "./CommittedInvestmentsTable";
import TradeCommitWorkflow from "./TradeCommitWorkflow";

interface InvestmentsTabProps {
  investmentTransactions: any[];
  committedInvestments: any[];
  onReload: () => Promise<void>;
}

export default function InvestmentsTab({ investmentTransactions, committedInvestments, onReload }: InvestmentsTabProps) {
  const [selectedCommittedInvestments, setSelectedCommittedInvestments] = useState<string[]>([]);

  const massUncommitInvestments = async () => {
    if (selectedCommittedInvestments.length === 0) {
      alert('Select investment transactions to uncommit');
      return;
    }
    
    try {
      const res = await fetch('/api/investment-transactions/uncommit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transactionIds: selectedCommittedInvestments
        })
      });
      
      const result = await res.json();
      
      if (result.success) {
        await onReload();
        setSelectedCommittedInvestments([]);
        alert(`✅ ${result.message}`);
      } else {
        alert(`❌ Error: ${result.error || 'Failed to uncommit'}`);
      }
    } catch (error) {
      alert(`Failed to uncommit: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  return (
    <>
      <TradeCommitWorkflow onReload={onReload} />

      <CommittedInvestmentsTable 
        committedInvestments={committedInvestments}
        selectedCommittedInvestments={selectedCommittedInvestments}
        setSelectedCommittedInvestments={setSelectedCommittedInvestments}
        massUncommitInvestments={massUncommitInvestments}
      />
    </>
  );
}
