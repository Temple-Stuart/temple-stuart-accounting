interface CommittedInvestmentsTableProps {
  committedInvestments: any[];
  selectedCommittedInvestments: string[];
  setSelectedCommittedInvestments: (ids: string[]) => void;
  massUncommitInvestments: () => void;
}

export default function CommittedInvestmentsTable({
  committedInvestments,
  selectedCommittedInvestments,
  setSelectedCommittedInvestments,
  massUncommitInvestments
}: CommittedInvestmentsTableProps) {
  const filteredInvestments = committedInvestments.filter(
    (txn: any) => true
  );

  if (filteredInvestments.length === 0) return null;

  return (
    <div className="mt-6 border rounded-lg overflow-hidden">
      <div className="bg-green-100 p-3 border-b border-green-300">
        <div className="flex justify-between items-center">
          <h3 className="font-semibold text-green-800">
            Committed Investment Transactions ({filteredInvestments.length})
          </h3>
          <button 
            onClick={massUncommitInvestments}
            className="px-3 py-1 bg-red-600 text-white rounded text-xs"
          >
            Uncommit Selected
          </button>
        </div>
      </div>
      <div className="overflow-auto" style={{maxHeight: '400px'}}>
        <table className="w-full text-xs">
          <thead className="bg-green-50 sticky top-0">
            <tr>
              <th className="px-2 py-2">
                <input
                  type="checkbox"
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedCommittedInvestments(committedInvestments.map((t: any) => t.id));
                    } else {
                      setSelectedCommittedInvestments([]);
                    }
                  }}
                />
              </th>
              <th className="px-2 py-2 text-left">Date</th>
              <th className="px-2 py-2 text-left">Symbol</th>
              <th className="px-2 py-2 text-left">Name</th>
              <th className="px-2 py-2 text-right">Amount</th>
              <th className="px-2 py-2 text-left">Strategy</th>
              <th className="px-2 py-2 text-left">COA</th>
              <th className="px-2 py-2 text-center">Trade #</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-green-200">
            {filteredInvestments.map((txn: any) => {
              const symbol = txn.name?.split(' ').find((part: string) => part.match(/^[A-Z]+$/)) 
                || txn.security?.ticker_symbol 
                || '-';
              
              return (
                <tr key={txn.id} className="bg-white hover:bg-green-50">
                  <td className="px-2 py-2">
                    <input
                      type="checkbox"
                      checked={selectedCommittedInvestments.includes(txn.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedCommittedInvestments([...selectedCommittedInvestments, txn.id]);
                        } else {
                          setSelectedCommittedInvestments(
                            selectedCommittedInvestments.filter((id: string) => id !== txn.id)
                          );
                        }
                      }}
                    />
                  </td>
                  <td className="px-2 py-2">{new Date(txn.date).toLocaleDateString()}</td>
                  <td className="px-2 py-2 font-medium">{symbol}</td>
                  <td className="px-2 py-2 text-xs">{txn.name}</td>
                  <td className="px-2 py-2 text-right">${Math.abs(txn.amount || 0).toFixed(2)}</td>
                  <td className="px-2 py-2 text-green-700">{txn.strategy || '-'}</td>
                  <td className="px-2 py-2 font-semibold text-green-700">{txn.accountCode}</td>
                  <td className="px-2 py-2 text-center">{txn.tradeNum || '-'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
