// Enhanced table component showing all investment data
const InvestmentTable = ({ transactions }) => (
  <div className="overflow-x-auto max-h-96 border rounded-lg">
    <table className="w-full text-xs">
      <thead className="bg-gray-50 sticky top-0">
        <tr>
          <th className="px-2 py-2 text-left">Date</th>
          <th className="px-2 py-2 text-left">Strategy</th>
          <th className="px-2 py-2 text-left">Underlying</th>
          <th className="px-2 py-2 text-left">Action</th>
          <th className="px-2 py-2 text-left">Type</th>
          <th className="px-2 py-2 text-right">Qty</th>
          <th className="px-2 py-2 text-right">Price</th>
          <th className="px-2 py-2 text-right">Amount</th>
          <th className="px-2 py-2 text-right">Fees</th>
          <th className="px-2 py-2 text-left">Security ID</th>
        </tr>
      </thead>
      <tbody className="divide-y text-xs">
        {transactions.map((txn) => (
          <tr key={txn.id} className="hover:bg-gray-50">
            <td className="px-2 py-1">{new Date(txn.date).toLocaleDateString()}</td>
            <td className="px-2 py-1 font-medium">{txn.strategy}</td>
            <td className="px-2 py-1">{txn.underlying}</td>
            <td className="px-2 py-1">
              <span className={`px-1 py-0.5 text-xs rounded ${
                txn.type === 'buy' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
              }`}>
                {txn.type.toUpperCase()}
              </span>
            </td>
            <td className="px-2 py-1">{txn.optionType}</td>
            <td className="px-2 py-1 text-right">{txn.quantity}</td>
            <td className="px-2 py-1 text-right">${txn.price}</td>
            <td className={`px-2 py-1 text-right font-medium ${
              txn.amount > 0 ? 'text-green-600' : 'text-red-600'
            }`}>
              ${txn.amount}
            </td>
            <td className="px-2 py-1 text-right">${txn.fees}</td>
            <td className="px-2 py-1 text-xs text-gray-500">{txn.security_id.substring(0, 8)}...</td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);
