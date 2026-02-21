'use client';

import { useState, useEffect, useMemo } from 'react';

interface PeriodData {
  period: string;
  revenue: number;
  expenses: number;
  netIncome: number;
  assets: number;
  liabilities: number;
  equity: number;
}

interface AccountData {
  code: string;
  name: string;
  type: string;
  periods: Record<string, number>;
}

export default function ThreeStatementAnalysisTab() {
  const [periods, setPeriods] = useState<PeriodData[]>([]);
  const [accounts, setAccounts] = useState<AccountData[]>([]);
  const [periodKeys, setPeriodKeys] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [periodType, setPeriodType] = useState<'monthly' | 'quarterly' | 'yearly'>('monthly');
  const [activeTab, setActiveTab] = useState<'income' | 'balance'>('balance');

  useEffect(() => {
    loadAnalysis();
  }, [periodType]);

  const loadAnalysis = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/statements/analysis?period=${periodType}`);
      if (res.ok) {
        const result = await res.json();
        setPeriods(result.periods || []);
        setAccounts(result.accounts || []);
        setPeriodKeys(result.periodKeys || []);
      }
    } catch (error) {
      console.error('Error loading analysis:', error);
    }
    setLoading(false);
  };

  // Group accounts by type
  const revenueAccounts = useMemo(() => accounts.filter(a => a.type === 'revenue'), [accounts]);
  const expenseAccounts = useMemo(() => accounts.filter(a => a.type === 'expense'), [accounts]);
  const assetAccounts = useMemo(() => accounts.filter(a => a.type === 'asset'), [accounts]);
  const liabilityAccounts = useMemo(() => accounts.filter(a => a.type === 'liability'), [accounts]);
  const equityAccounts = useMemo(() => accounts.filter(a => a.type === 'equity'), [accounts]);

  const formatAmount = (val: number) => {
    if (val === 0) return '-';
    const abs = Math.abs(val);
    const formatted = abs >= 1000
      ? `$${abs.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      : `$${abs.toFixed(2)}`;
    return val < 0 ? `(${formatted})` : formatted;
  };

  const formatPeriodLabel = (pk: string) => {
    if (periodType === 'monthly') {
      const [year, month] = pk.split('-');
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      return `${monthNames[parseInt(month) - 1]} ${year}`;
    }
    return pk;
  };

  const getSectionTotal = (accts: AccountData[], pk: string) => {
    return accts.reduce((sum, a) => sum + (a.periods[pk] || 0), 0);
  };

  if (loading) {
    return <div className="p-8 text-center">Loading analysis...</div>;
  }

  const renderAccountSection = (
    title: string,
    accts: AccountData[],
    bgClass: string,
    textClass: string
  ) => {
    if (accts.length === 0) return null;
    return (
      <>
        <tr className={bgClass}>
          <td colSpan={periodKeys.length + 2} className={`px-3 py-2 font-bold text-sm ${textClass}`}>
            {title}
          </td>
        </tr>
        {accts.map(acct => (
          <tr key={acct.code} className="border-b border-gray-100 hover:bg-gray-50">
            <td className="px-3 py-2 whitespace-nowrap sticky left-0 bg-white z-10">
              <span className="font-mono text-xs text-gray-400">{acct.code}</span>
              <span className="ml-2 text-sm">{acct.name}</span>
            </td>
            {periodKeys.map(pk => {
              const val = acct.periods[pk] || 0;
              return (
                <td key={pk} className={`px-3 py-2 text-right text-sm ${val !== 0 ? '' : 'text-gray-300'}`}>
                  {formatAmount(val)}
                </td>
              );
            })}
            <td className="px-3 py-2 text-right text-sm font-semibold bg-gray-50">
              {formatAmount(acct.periods[periodKeys[periodKeys.length - 1]] || 0)}
            </td>
          </tr>
        ))}
        <tr className={`${bgClass} border-b-2`}>
          <td className={`px-3 py-2 font-semibold text-sm sticky left-0 ${bgClass} z-10 ${textClass}`}>Total {title}</td>
          {periodKeys.map(pk => (
            <td key={pk} className={`px-3 py-2 text-right font-semibold text-sm ${textClass}`}>
              {formatAmount(getSectionTotal(accts, pk))}
            </td>
          ))}
          <td className={`px-3 py-2 text-right font-bold text-sm bg-gray-50 ${textClass}`}>
            {formatAmount(getSectionTotal(accts, periodKeys[periodKeys.length - 1] || ''))}
          </td>
        </tr>
      </>
    );
  };

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
            className="px-4 py-2 bg-[#2d1b4e] text-white rounded-lg text-sm"
          >
            Refresh
          </button>
        </div>
      </div>

      {periodKeys.length === 0 ? (
        <div className="bg-white border rounded-xl p-8 text-center text-gray-500">
          No data available for analysis
        </div>
      ) : (
        <>
          {/* Statement Tabs */}
          <div className="flex border-b">
            {[
              { key: 'balance', label: 'Balance Sheet' },
              { key: 'income', label: 'Income Statement' },
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as any)}
                className={`px-5 py-3 text-sm font-medium transition-colors ${
                  activeTab === tab.key
                    ? 'border-b-2 border-[#2d1b4e] text-[#2d1b4e] bg-white'
                    : 'text-gray-500 hover:text-gray-700 bg-gray-50'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Balance Sheet — account-level detail with running balances */}
          {activeTab === 'balance' && (
            <div className="bg-white border rounded-xl overflow-hidden">
              <div className="bg-gray-50 px-6 py-4 border-b flex justify-between items-center">
                <h3 className="text-lg font-semibold">Balance Sheet</h3>
                <span className="text-xs text-gray-500">Cumulative running balances at each period-end</span>
              </div>
              <div className="overflow-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="px-3 py-2 text-left font-semibold min-w-[220px] sticky left-0 bg-gray-100 z-10">Account</th>
                      {periodKeys.map(pk => (
                        <th key={pk} className="px-3 py-2 text-right font-semibold whitespace-nowrap min-w-[100px]">
                          {formatPeriodLabel(pk)}
                        </th>
                      ))}
                      <th className="px-3 py-2 text-right font-semibold min-w-[100px] bg-gray-100">Current</th>
                    </tr>
                  </thead>
                  <tbody>
                    {renderAccountSection('Assets', assetAccounts, 'bg-blue-50', 'text-blue-800')}
                    {renderAccountSection('Liabilities', liabilityAccounts, 'bg-orange-50', 'text-orange-800')}
                    {renderAccountSection('Equity', equityAccounts, 'bg-purple-50', 'text-purple-800')}

                    {/* Accounting equation check */}
                    {periodKeys.length > 0 && (
                      <>
                        <tr className="bg-gray-200 border-t-2">
                          <td className="px-3 py-2 font-bold text-sm sticky left-0 bg-gray-200 z-10">L + E</td>
                          {periodKeys.map(pk => {
                            const le = getSectionTotal(liabilityAccounts, pk) + getSectionTotal(equityAccounts, pk);
                            return (
                              <td key={pk} className="px-3 py-2 text-right font-bold text-sm">
                                {formatAmount(le)}
                              </td>
                            );
                          })}
                          <td className="px-3 py-2 text-right font-bold text-sm bg-gray-200">
                            {formatAmount(
                              getSectionTotal(liabilityAccounts, periodKeys[periodKeys.length - 1] || '') +
                              getSectionTotal(equityAccounts, periodKeys[periodKeys.length - 1] || '')
                            )}
                          </td>
                        </tr>
                        <tr className="bg-gray-100">
                          <td className="px-3 py-2 font-bold text-sm sticky left-0 bg-gray-100 z-10">A = L + E Check</td>
                          {periodKeys.map(pk => {
                            const a = getSectionTotal(assetAccounts, pk);
                            const le = getSectionTotal(liabilityAccounts, pk) + getSectionTotal(equityAccounts, pk);
                            const diff = Math.abs(a - le);
                            const balanced = diff < 0.02;
                            return (
                              <td key={pk} className={`px-3 py-2 text-right text-sm font-semibold ${balanced ? 'text-green-600' : 'text-red-600'}`}>
                                {balanced ? 'Balanced' : `Off $${diff.toFixed(2)}`}
                              </td>
                            );
                          })}
                          <td className="px-3 py-2 text-right text-sm font-semibold bg-gray-100">
                            {(() => {
                              const lastPk = periodKeys[periodKeys.length - 1] || '';
                              const a = getSectionTotal(assetAccounts, lastPk);
                              const le = getSectionTotal(liabilityAccounts, lastPk) + getSectionTotal(equityAccounts, lastPk);
                              const diff = Math.abs(a - le);
                              return diff < 0.02
                                ? <span className="text-green-600">Balanced</span>
                                : <span className="text-red-600">Off ${diff.toFixed(2)}</span>;
                            })()}
                          </td>
                        </tr>
                      </>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Income Statement — periodic activity */}
          {activeTab === 'income' && (
            <div className="bg-white border rounded-xl overflow-hidden">
              <div className="bg-gray-50 px-6 py-4 border-b flex justify-between items-center">
                <h3 className="text-lg font-semibold">Income Statement</h3>
                <span className="text-xs text-gray-500">Activity per period</span>
              </div>
              <div className="overflow-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="px-3 py-2 text-left font-semibold min-w-[220px] sticky left-0 bg-gray-100 z-10">Account</th>
                      {periodKeys.map(pk => (
                        <th key={pk} className="px-3 py-2 text-right font-semibold whitespace-nowrap min-w-[100px]">
                          {formatPeriodLabel(pk)}
                        </th>
                      ))}
                      <th className="px-3 py-2 text-right font-semibold min-w-[100px] bg-gray-100">YTD</th>
                    </tr>
                  </thead>
                  <tbody>
                    {renderAccountSection('Revenue', revenueAccounts, 'bg-green-50', 'text-green-800')}
                    {renderAccountSection('Expenses', expenseAccounts, 'bg-red-50', 'text-red-800')}

                    {/* Net Income */}
                    <tr className="bg-yellow-100 font-bold border-t-2 border-yellow-400">
                      <td className="px-3 py-2 sticky left-0 bg-yellow-100 z-10">Net Income</td>
                      {periodKeys.map(pk => {
                        const rev = getSectionTotal(revenueAccounts, pk);
                        const exp = getSectionTotal(expenseAccounts, pk);
                        const ni = rev - exp;
                        return (
                          <td key={pk} className={`px-3 py-2 text-right ${ni >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                            {formatAmount(ni)}
                          </td>
                        );
                      })}
                      <td className="px-3 py-2 text-right bg-yellow-200">
                        {(() => {
                          const totalRev = periodKeys.reduce((s, pk) => s + getSectionTotal(revenueAccounts, pk), 0);
                          const totalExp = periodKeys.reduce((s, pk) => s + getSectionTotal(expenseAccounts, pk), 0);
                          const ni = totalRev - totalExp;
                          return <span className={ni >= 0 ? 'text-green-700' : 'text-red-700'}>{formatAmount(ni)}</span>;
                        })()}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Key Metrics */}
          {periods.length > 0 && (
            <div className="grid grid-cols-4 gap-4">
              <div className="bg-white border rounded-lg p-4">
                <div className="text-xs text-gray-600 mb-1">Latest Revenue</div>
                <div className="text-2xl font-bold text-green-600">
                  {formatAmount(periods[0].revenue)}
                </div>
              </div>
              <div className="bg-white border rounded-lg p-4">
                <div className="text-xs text-gray-600 mb-1">Latest Net Income</div>
                <div className={`text-2xl font-bold ${periods[0].netIncome >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatAmount(periods[0].netIncome)}
                </div>
              </div>
              <div className="bg-white border rounded-lg p-4">
                <div className="text-xs text-gray-600 mb-1">Total Assets</div>
                <div className="text-2xl font-bold">
                  {formatAmount(periods[0].assets)}
                </div>
              </div>
              <div className="bg-white border rounded-lg p-4">
                <div className="text-xs text-gray-600 mb-1">A = L + E</div>
                <div className="text-2xl font-bold">
                  {(() => {
                    const diff = Math.abs(periods[0].assets - (periods[0].liabilities + periods[0].equity));
                    return diff < 0.02
                      ? <span className="text-green-600">Balanced</span>
                      : <span className="text-red-600">Off ${diff.toFixed(2)}</span>;
                  })()}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
