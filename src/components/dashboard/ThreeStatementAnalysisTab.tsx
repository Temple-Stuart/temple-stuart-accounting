'use client';

import { useState, useEffect } from 'react';

interface PeriodData {
  period: string;
  revenue: number;
  expenses: number;
  netIncome: number;
  assets: number;
  liabilities: number;
  equity: number;
}

export default function ThreeStatementAnalysisTab() {
  const [data, setData] = useState<PeriodData[]>([]);
  const [loading, setLoading] = useState(true);
  const [periodType, setPeriodType] = useState<'monthly' | 'quarterly' | 'yearly'>('monthly');

  useEffect(() => {
    loadAnalysis();
  }, [periodType]);

  const loadAnalysis = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/statements/analysis?period=${periodType}`);
      if (res.ok) {
        const result = await res.json();
        setData(result.periods || []);
      }
    } catch (error) {
      console.error('Error loading analysis:', error);
    }
    setLoading(false);
  };

  const calculateChange = (current: number, previous: number) => {
    if (previous === 0) return 0;
    return ((current - previous) / Math.abs(previous)) * 100;
  };

  if (loading) {
    return <div className="p-8 text-center">Loading analysis...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">3-Statement Analysis</h2>
          <p className="text-sm text-gray-600 mt-1">Comparative financial statement analysis</p>
        </div>
        <div className="flex gap-2">
          <select 
            value={periodType}
            onChange={(e) => setPeriodType(e.target.value as any)}
            className="px-4 py-2 border rounded-lg text-sm"
          >
            <option value="monthly">Monthly</option>
            <option value="quarterly">Quarterly</option>
            <option value="yearly">Yearly</option>
          </select>
          <button 
            onClick={loadAnalysis}
            className="px-4 py-2 bg-[#b4b237] text-white rounded-lg text-sm"
          >
            Refresh
          </button>
        </div>
      </div>

      {data.length === 0 ? (
        <div className="bg-white border rounded-xl p-8 text-center text-gray-500">
          No data available for analysis
        </div>
      ) : (
        <>
          {/* Income Statement Comparison */}
          <div className="bg-white border rounded-xl overflow-hidden">
            <div className="bg-gray-50 px-6 py-4 border-b">
              <h3 className="text-lg font-semibold">Income Statement</h3>
            </div>
            <div className="overflow-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Period</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600">Revenue</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600">Expenses</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600">Net Income</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600">Margin %</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600">Change</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {data.map((period, idx) => {
                    const margin = period.revenue !== 0 ? (period.netIncome / period.revenue) * 100 : 0;
                    const prevPeriod = idx > 0 ? data[idx - 1] : null;
                    const change = prevPeriod ? calculateChange(period.netIncome, prevPeriod.netIncome) : 0;

                    return (
                      <tr key={period.period} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm font-medium">{period.period}</td>
                        <td className="px-4 py-3 text-right text-sm text-green-600 font-semibold">
                          ${period.revenue.toFixed(2)}
                        </td>
                        <td className="px-4 py-3 text-right text-sm text-red-600 font-semibold">
                          ${period.expenses.toFixed(2)}
                        </td>
                        <td className="px-4 py-3 text-right text-sm font-bold">
                          <span className={period.netIncome >= 0 ? 'text-green-600' : 'text-red-600'}>
                            ${period.netIncome.toFixed(2)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right text-sm">
                          {margin.toFixed(1)}%
                        </td>
                        <td className="px-4 py-3 text-right text-sm">
                          {prevPeriod && (
                            <span className={change >= 0 ? 'text-green-600' : 'text-red-600'}>
                              {change >= 0 ? '↑' : '↓'} {Math.abs(change).toFixed(1)}%
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Balance Sheet Comparison */}
          <div className="bg-white border rounded-xl overflow-hidden">
            <div className="bg-gray-50 px-6 py-4 border-b">
              <h3 className="text-lg font-semibold">Balance Sheet</h3>
            </div>
            <div className="overflow-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Period</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600">Assets</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600">Liabilities</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600">Equity</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600">Current Ratio</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600">Change</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {data.map((period, idx) => {
                    const currentRatio = period.liabilities !== 0 
                      ? (period.assets / Math.abs(period.liabilities)).toFixed(2) 
                      : 'N/A';
                    const prevPeriod = idx > 0 ? data[idx - 1] : null;
                    const change = prevPeriod ? calculateChange(period.assets, prevPeriod.assets) : 0;

                    return (
                      <tr key={period.period} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm font-medium">{period.period}</td>
                        <td className="px-4 py-3 text-right text-sm font-semibold">
                          ${period.assets.toFixed(2)}
                        </td>
                        <td className="px-4 py-3 text-right text-sm font-semibold">
                          ${Math.abs(period.liabilities).toFixed(2)}
                        </td>
                        <td className="px-4 py-3 text-right text-sm font-semibold">
                          ${period.equity.toFixed(2)}
                        </td>
                        <td className="px-4 py-3 text-right text-sm">
                          {currentRatio}
                        </td>
                        <td className="px-4 py-3 text-right text-sm">
                          {prevPeriod && (
                            <span className={change >= 0 ? 'text-green-600' : 'text-red-600'}>
                              {change >= 0 ? '↑' : '↓'} {Math.abs(change).toFixed(1)}%
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Key Metrics Summary */}
          <div className="grid grid-cols-4 gap-4">
            {data.length > 0 && (
              <>
                <div className="bg-white border rounded-lg p-4">
                  <div className="text-xs text-gray-600 mb-1">Latest Revenue</div>
                  <div className="text-2xl font-bold text-green-600">
                    ${data[0].revenue.toFixed(2)}
                  </div>
                </div>
                <div className="bg-white border rounded-lg p-4">
                  <div className="text-xs text-gray-600 mb-1">Latest Net Income</div>
                  <div className={`text-2xl font-bold ${data[0].netIncome >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    ${data[0].netIncome.toFixed(2)}
                  </div>
                </div>
                <div className="bg-white border rounded-lg p-4">
                  <div className="text-xs text-gray-600 mb-1">Total Assets</div>
                  <div className="text-2xl font-bold">
                    ${data[0].assets.toFixed(2)}
                  </div>
                </div>
                <div className="bg-white border rounded-lg p-4">
                  <div className="text-xs text-gray-600 mb-1">Avg Profit Margin</div>
                  <div className="text-2xl font-bold">
                    {(data.reduce((sum, p) => sum + (p.revenue !== 0 ? (p.netIncome / p.revenue) * 100 : 0), 0) / data.length).toFixed(1)}%
                  </div>
                </div>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
