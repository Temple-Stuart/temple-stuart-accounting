'use client';

import { useState, useEffect } from 'react';

interface Metrics {
  profitability: {
    grossProfitMargin: number;
    netProfitMargin: number;
    returnOnAssets: number;
    returnOnEquity: number;
  };
  liquidity: {
    currentRatio: number;
    quickRatio: number;
    cashRatio: number;
  };
  efficiency: {
    expenseRatio: number;
    assetTurnover: number;
  };
  growth: {
    revenueGrowth: number;
    incomeGrowth: number;
    assetGrowth: number;
  };
}

interface Projection {
  metric: string;
  current: number;
  projected3Month: number;
  projected6Month: number;
  projected12Month: number;
  trend: 'up' | 'down' | 'stable';
}

export default function MetricsAndProjectionsTab() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [projections, setProjections] = useState<Projection[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadMetrics();
  }, []);

  const loadMetrics = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/metrics');
      if (res.ok) {
        const data = await res.json();
        setMetrics(data.metrics);
        setProjections(data.projections || []);
      }
    } catch (error) {
      console.error('Error loading metrics:', error);
    }
    setLoading(false);
  };

  const getRatingColor = (value: number, metricType: string) => {
    if (metricType === 'margin' || metricType === 'return') {
      if (value >= 20) return 'text-green-600';
      if (value >= 10) return 'text-yellow-600';
      return 'text-red-600';
    }
    if (metricType === 'ratio') {
      if (value >= 2) return 'text-green-600';
      if (value >= 1) return 'text-yellow-600';
      return 'text-red-600';
    }
    return 'text-gray-600';
  };

  if (loading) {
    return <div className="p-8 text-center">Loading metrics...</div>;
  }

  if (!metrics) {
    return <div className="p-8 text-center text-red-600">Failed to load metrics</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Metrics & Projections</h2>
          <p className="text-sm text-gray-600 mt-1">Financial KPIs and trend forecasting</p>
        </div>
        <button 
          onClick={loadMetrics}
          className="px-4 py-2 bg-[#2d1b4e] text-white rounded-lg text-sm"
        >
          Refresh
        </button>
      </div>

      {/* Profitability Metrics */}
      <div className="bg-white border rounded-xl p-6">
        <h3 className="text-lg font-semibold mb-4">Profitability Metrics</h3>
        <div className="grid grid-cols-4 gap-4">
          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <div className="text-xs text-gray-600 mb-1">Gross Profit Margin</div>
            <div className={`text-3xl font-bold ${getRatingColor(metrics.profitability.grossProfitMargin, 'margin')}`}>
              {metrics.profitability.grossProfitMargin.toFixed(1)}%
            </div>
          </div>
          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <div className="text-xs text-gray-600 mb-1">Net Profit Margin</div>
            <div className={`text-3xl font-bold ${getRatingColor(metrics.profitability.netProfitMargin, 'margin')}`}>
              {metrics.profitability.netProfitMargin.toFixed(1)}%
            </div>
          </div>
          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <div className="text-xs text-gray-600 mb-1">Return on Assets</div>
            <div className={`text-3xl font-bold ${getRatingColor(metrics.profitability.returnOnAssets, 'return')}`}>
              {metrics.profitability.returnOnAssets.toFixed(1)}%
            </div>
          </div>
          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <div className="text-xs text-gray-600 mb-1">Return on Equity</div>
            <div className={`text-3xl font-bold ${getRatingColor(metrics.profitability.returnOnEquity, 'return')}`}>
              {metrics.profitability.returnOnEquity.toFixed(1)}%
            </div>
          </div>
        </div>
      </div>

      {/* Liquidity Metrics */}
      <div className="bg-white border rounded-xl p-6">
        <h3 className="text-lg font-semibold mb-4">Liquidity Metrics</h3>
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <div className="text-xs text-gray-600 mb-1">Current Ratio</div>
            <div className={`text-3xl font-bold ${getRatingColor(metrics.liquidity.currentRatio, 'ratio')}`}>
              {metrics.liquidity.currentRatio.toFixed(2)}
            </div>
            <div className="text-xs text-gray-500 mt-1">Target: &gt; 1.5</div>
          </div>
          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <div className="text-xs text-gray-600 mb-1">Quick Ratio</div>
            <div className={`text-3xl font-bold ${getRatingColor(metrics.liquidity.quickRatio, 'ratio')}`}>
              {metrics.liquidity.quickRatio.toFixed(2)}
            </div>
            <div className="text-xs text-gray-500 mt-1">Target: &gt; 1.0</div>
          </div>
          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <div className="text-xs text-gray-600 mb-1">Cash Ratio</div>
            <div className={`text-3xl font-bold ${getRatingColor(metrics.liquidity.cashRatio, 'ratio')}`}>
              {metrics.liquidity.cashRatio.toFixed(2)}
            </div>
            <div className="text-xs text-gray-500 mt-1">Target: &gt; 0.5</div>
          </div>
        </div>
      </div>

      {/* Efficiency & Growth */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white border rounded-xl p-6">
          <h3 className="text-lg font-semibold mb-4">Efficiency Metrics</h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center p-3 bg-gray-50 rounded">
              <span className="text-sm text-gray-600">Expense Ratio</span>
              <span className="text-xl font-bold">{metrics.efficiency.expenseRatio.toFixed(1)}%</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-gray-50 rounded">
              <span className="text-sm text-gray-600">Asset Turnover</span>
              <span className="text-xl font-bold">{metrics.efficiency.assetTurnover.toFixed(2)}x</span>
            </div>
          </div>
        </div>

        <div className="bg-white border rounded-xl p-6">
          <h3 className="text-lg font-semibold mb-4">Growth Metrics</h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center p-3 bg-gray-50 rounded">
              <span className="text-sm text-gray-600">Revenue Growth</span>
              <span className={`text-xl font-bold ${metrics.growth.revenueGrowth >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {metrics.growth.revenueGrowth >= 0 ? '+' : ''}{metrics.growth.revenueGrowth.toFixed(1)}%
              </span>
            </div>
            <div className="flex justify-between items-center p-3 bg-gray-50 rounded">
              <span className="text-sm text-gray-600">Income Growth</span>
              <span className={`text-xl font-bold ${metrics.growth.incomeGrowth >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {metrics.growth.incomeGrowth >= 0 ? '+' : ''}{metrics.growth.incomeGrowth.toFixed(1)}%
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Projections */}
      {projections.length > 0 && (
        <div className="bg-white border rounded-xl overflow-hidden">
          <div className="bg-gray-50 px-6 py-4 border-b">
            <h3 className="text-lg font-semibold">Financial Projections</h3>
            <p className="text-xs text-gray-600 mt-1">Based on historical trends (simple linear projection)</p>
          </div>
          <div className="overflow-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Metric</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600">Current</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600">3 Months</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600">6 Months</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600">12 Months</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600">Trend</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {projections.map((proj, idx) => (
                  <tr key={idx} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium">{proj.metric}</td>
                    <td className="px-4 py-3 text-right text-sm font-semibold">
                      ${proj.current.toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-right text-sm">
                      ${proj.projected3Month.toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-right text-sm">
                      ${proj.projected6Month.toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-right text-sm">
                      ${proj.projected12Month.toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        proj.trend === 'up' ? 'bg-green-100 text-green-700' :
                        proj.trend === 'down' ? 'bg-red-100 text-red-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {proj.trend === 'up' ? '↑ Growing' : proj.trend === 'down' ? '↓ Declining' : '→ Stable'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Disclaimer */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-blue-900 mb-2">About These Metrics</h3>
        <p className="text-sm text-blue-800">
          Financial metrics provide insights into business performance. Projections are based on historical trends 
          and should be used for planning purposes only. Actual results may vary based on market conditions, 
          business decisions, and external factors.
        </p>
      </div>
    </div>
  );
}
