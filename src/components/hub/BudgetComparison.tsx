'use client';
import { themed } from '@/lib/ds';

/**
 * BudgetComparison (PR-Runway-Comparison) — the Travel-vs-Personal budget comparison,
 * extracted VERBATIM from the /hub "Budget Comparison" block (hub/page.tsx:516-664) so it
 * can be surfaced on the homepage Runway tab (the /hub cockpit is being unlinked).
 *
 * Self-contained, mirroring HubBudgetSection: it owns its own year + travel-months state
 * and self-fetches the SAME four routes the /hub page does — no props required:
 *   • Personal  ← /api/hub/year-calendar   (HB-5-corrected: routine bridge takes per-COA
 *                                            precedence over the budgets table → de-inflated)
 *   • Travel    ← /api/hub/nomad-budget     (budget_line_items source=trip)
 *   • Business  ← /api/hub/business-budget   (budget_line_items source=business)
 *   • Trips     ← /api/hub/trips             (the committed-trips footer row)
 *
 * The comparison MATH is copied byte-for-byte (Home/Travel Months, Travel Savings = green/red,
 * Effective Total = homeMonthsCombined + travelMonthsTravelBudget + yearlyBusinessBudget). No
 * rewrite, no new data source. The /hub inline block is left untouched (acceptable duplication;
 * /hub is on its way out). Dense/mono styling is retained — a flush/sans restyle is a follow-up.
 *
 * Mounted only in the authed Runway tab (ModuleLauncher), so logged-out demo users never see it.
 */

import { useEffect, useState } from 'react';

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Uniform budget-route response shape (year-calendar / nomad-budget / business-budget).
interface BudgetState {
  budgetData: Record<string, Record<number, number>>;
  actualData: Record<string, Record<number, number>>;
  coaNames: Record<string, string>;
  budgetGrandTotal: number;
  actualGrandTotal: number;
}
const EMPTY_BUDGET: BudgetState = { budgetData: {}, actualData: {}, coaNames: {}, budgetGrandTotal: 0, actualGrandTotal: 0 };

interface CommittedTrip {
  id: string; name: string; destination: string | null;
  latitude: number | null; longitude: number | null;
  startDate: string | null; endDate: string | null; totalBudget: number; destinationPhoto: string | null;
}

export default function BudgetComparison({ initialYear, preview = false }: { initialYear?: number; preview?: boolean }) {
  const now = new Date();
  const [selectedYear, setSelectedYear] = useState(initialYear ?? now.getFullYear());
  const [travelMonths, setTravelMonths] = useState<number[]>([]);
  const [homebaseBudget, setHomebaseBudget] = useState<BudgetState>(EMPTY_BUDGET);
  const [nomadBudget, setNomadBudget] = useState<BudgetState>(EMPTY_BUDGET);
  const [businessBudget, setBusinessBudget] = useState<BudgetState>(EMPTY_BUDGET);
  const [committedTrips, setCommittedTrips] = useState<CommittedTrip[]>([]);

  // Self-fetch the same four routes /hub fetches, re-fetching when the year changes
  // (mirrors hub/page.tsx:351). Each loader mirrors the /hub loader's tolerant shape-mapping.
  useEffect(() => {
    // PREVIEW (guest): skip all four authed budget fetches; the EMPTY_BUDGET initial state
    // renders the comparison with no data (no 401).
    if (preview) return;
    let cancelled = false;
    const loadCommittedTrips = async () => {
      try {
        const res = await fetch('/api/hub/trips');
        if (res.ok) { const data = await res.json(); if (!cancelled) setCommittedTrips(data.trips || []); }
      } catch (err) { console.error('Failed to load trips:', err); }
    };
    const loadYearCalendar = async () => {
      try {
        const res = await fetch(`/api/hub/year-calendar?year=${selectedYear}`);
        if (res.ok) {
          const data = await res.json();
          if (!cancelled) setHomebaseBudget({
            budgetData: data.budgetData || {}, actualData: data.actualData || {}, coaNames: data.coaNames || {},
            budgetGrandTotal: data.budgetGrandTotal || 0, actualGrandTotal: data.actualGrandTotal || 0,
          });
        }
      } catch (err) { console.error('Failed to load year calendar:', err); }
    };
    const loadNomadBudget = async () => {
      try {
        const res = await fetch(`/api/hub/nomad-budget?year=${selectedYear}`);
        if (res.ok) {
          const data = await res.json();
          if (!cancelled) setNomadBudget({
            budgetData: data.budgetData || data.monthlyData || {}, actualData: data.actualData || {}, coaNames: data.coaNames || {},
            budgetGrandTotal: data.budgetGrandTotal || data.grandTotal || 0, actualGrandTotal: data.actualGrandTotal || 0,
          });
        }
      } catch (err) { console.error('Failed to load nomad budget:', err); }
    };
    const loadBusinessBudget = async () => {
      try {
        const res = await fetch(`/api/hub/business-budget?year=${selectedYear}`);
        if (res.ok) {
          const data = await res.json();
          if (!cancelled) setBusinessBudget({
            budgetData: data.budgetData || {}, actualData: data.actualData || {}, coaNames: data.coaNames || {},
            budgetGrandTotal: data.budgetGrandTotal || 0, actualGrandTotal: data.actualGrandTotal || 0,
          });
        }
      } catch (err) { console.error('Failed to load business budget:', err); }
    };
    loadCommittedTrips(); loadYearCalendar(); loadNomadBudget(); loadBusinessBudget();
    return () => { cancelled = true; };
  }, [selectedYear, preview]);

  const fmt = (n: number) => n ? `$${n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}` : '—';

  // Calculator logic — copied VERBATIM from hub/page.tsx:360-374 (only the comparison-used
  // derivations; the per-COA-table-only intermediates are out of scope).
  const homeMonths = MONTHS_SHORT.map((_, i) => i).filter(i => !travelMonths.includes(i));
  const travelMonthsHomebaseBudget = travelMonths.reduce((sum, i) => sum + Object.values(homebaseBudget.budgetData).reduce((s, coa) => s + (coa[i] || 0), 0), 0);
  const travelMonthsTravelBudget = travelMonths.reduce((sum, i) => sum + Object.values(nomadBudget.budgetData).reduce((s, coa) => s + (coa[i] || 0), 0), 0);
  const travelSavings = travelMonthsHomebaseBudget - travelMonthsTravelBudget;
  const homeMonthsHomebaseBudget = homeMonths.reduce((sum, i) => sum + Object.values(homebaseBudget.budgetData).reduce((s, coa) => s + (coa[i] || 0), 0), 0);
  const homeMonthsTravelBudget = homeMonths.reduce((sum, i) => sum + Object.values(nomadBudget.budgetData).reduce((s, coa) => s + (coa[i] || 0), 0), 0);
  const homeMonthsCombined = homeMonthsHomebaseBudget + homeMonthsTravelBudget;
  const yearlyTravelBudget = nomadBudget.budgetGrandTotal;
  const yearlyBusinessBudget = businessBudget.budgetGrandTotal;
  const effectiveYearlyCost = homeMonthsCombined + travelMonthsTravelBudget + yearlyBusinessBudget;

  return (
    // ═══════════════════════════════════════════════════════════════════
    // BUDGET COMPARISON - WALL STREET STYLE (verbatim from hub/page.tsx:516-664)
    // ═══════════════════════════════════════════════════════════════════
    <div className="px-4 py-4 lg:px-8">
      <div className="mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <div>
            <h2 className={themed('text-sm font-semibold text-text-primary tracking-tight', true)}>Budget Comparison</h2>
            <p className={themed('text-sm text-text-muted mt-0.5', true)}>FY {selectedYear} · Homebase + Business + Travel · USD</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 bg-emerald-600 rounded-sm"></span><span className={themed('text-text-secondary', true)}>Under Budget</span></span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 bg-red-600 rounded-sm"></span><span className={themed('text-text-secondary', true)}>Over Budget</span></span>
            <div className="h-4 w-px bg-border mx-2"></div>
            <button onClick={() => setSelectedYear(y => y - 1)} className={themed('px-2 py-1 text-text-secondary hover:bg-bg-row rounded', true)}>◀</button>
            <span className={themed('font-semibold text-text-primary', true)}>{selectedYear}</span>
            <button onClick={() => setSelectedYear(y => y + 1)} className={themed('px-2 py-1 text-text-secondary hover:bg-bg-row rounded', true)}>▶</button>
          </div>
        </div>

        {/* Month Toggle */}
        <div className={themed('mb-4 p-4 bg-white border border-border', true)}>
          <div className="flex items-center justify-between mb-3">
            <span className={themed('text-sm font-medium text-text-secondary', true)}>Travel months (homebase costs excluded):</span>
            <div className="flex gap-2">
              <button onClick={() => setTravelMonths([0,1,2,3,4,5,6,7,8,9,10,11])} className={themed('text-xs px-3 py-1 text-text-secondary hover:bg-bg-row border border-border transition-colors font-medium', true)}>All Travel</button>
              <button onClick={() => setTravelMonths([])} className={themed('text-xs px-3 py-1 text-text-secondary hover:bg-bg-row border border-border transition-colors font-medium', true)}>All Home</button>
            </div>
          </div>
          <div className="flex gap-1 flex-wrap">
            {MONTHS_SHORT.map((m, i) => (
              <button
                key={i}
                onClick={() => setTravelMonths(prev => prev.includes(i) ? prev.filter(x => x !== i) : [...prev, i].sort((a,b) => a-b))}
                className={themed(`px-3 py-1.5 text-xs font-mono font-medium transition-all border ${
                  travelMonths.includes(i)
                    ? 'bg-brand-purple text-white border-brand-purple'
                    : 'bg-white text-text-secondary border-border hover:bg-bg-row'
                }`, true)}
              >
                {m}
              </button>
            ))}
          </div>
          <div className={themed('flex gap-6 text-xs text-text-muted mt-3 font-mono', true)}>
            <span>Home: {homeMonths.length} mo</span>
            <span>Travel: {travelMonths.length} mo</span>
          </div>
        </div>

        {/* Summary Row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-border mb-4">
          <div className={themed('bg-white p-4', true)}>
            <div className={themed('text-xs text-text-muted font-medium mb-1', true)}>Home Months Cost</div>
            <div className={themed('text-sm font-bold text-text-primary font-mono', true)}>{fmt(homeMonthsHomebaseBudget)}</div>
            <div className={themed('text-xs text-text-muted mt-1', true)}>+ {fmt(homeMonthsTravelBudget)} travel</div>
          </div>
          <div className={themed('bg-white p-4', true)}>
            <div className={themed('text-xs text-text-muted font-medium mb-1', true)}>Travel Months Cost</div>
            <div className={themed('text-sm font-bold text-text-primary font-mono', true)}>{fmt(travelMonthsTravelBudget)}</div>
            <div className={themed('text-xs text-text-faint line-through mt-1', true)}>{fmt(travelMonthsHomebaseBudget)} homebase</div>
          </div>
          <div className={themed('bg-white p-4', true)}>
            <div className={themed('text-xs text-text-muted font-medium mb-1', true)}>Travel Savings</div>
            <div className={`text-sm font-bold font-mono ${travelSavings >= 0 ? 'text-emerald-700' : 'text-brand-red'}`}>{travelSavings >= 0 ? '+' : ''}{fmt(travelSavings)}</div>
            <div className={themed('text-xs text-text-muted mt-1', true)}>{travelSavings >= 0 ? 'Saved vs home' : 'Extra vs home'}</div>
          </div>
          <div className="bg-brand-purple p-4 text-white">
            <div className={themed('text-xs text-text-faint font-medium mb-1', true)}>Effective Total</div>
            <div className="text-sm font-bold font-mono">{fmt(effectiveYearlyCost)}</div>
            <div className={themed('text-xs text-text-faint mt-1', true)}>{selectedYear} projected</div>
          </div>
        </div>

        {/* Comparison Table */}
        <div className={themed('border border-border bg-white overflow-x-auto', true)}>
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-brand-purple text-white">
                <th className="text-left py-2 px-3 font-medium border-r border-brand-purple-hover w-36">Category</th>
                {MONTHS_SHORT.map((m, i) => (
                  <th key={m} className={`py-2 px-2 font-medium border-r border-brand-purple-hover text-right min-w-[55px] ${travelMonths.includes(i) ? 'bg-panel-highlight' : ''}`}>{m}</th>
                ))}
                <th className="py-2 px-3 font-medium text-right bg-panel-highlight min-w-[70px]">FY Total</th>
              </tr>
            </thead>
            <tbody>
              <tr className={themed('border-b border-border bg-white hover:bg-brand-purple-wash/30', true)}>
                <td className={themed('py-2 px-3 font-medium text-text-primary border-r border-border', true)}>Homebase</td>
                {MONTHS_SHORT.map((_, i) => {
                  const val = Object.values(homebaseBudget.budgetData).reduce((s, coa) => s + (coa[i] || 0), 0);
                  const isTraveling = travelMonths.includes(i);
                  return (
                    <td key={i} className={themed(`py-2 px-2 text-right font-mono border-r border-border-light ${isTraveling ? 'bg-bg-row' : ''}`, true)}>
                      <span className={themed(isTraveling ? 'text-text-faint line-through' : 'text-text-secondary', true)}>{fmt(val)}</span>
                    </td>
                  );
                })}
                <td className={themed('py-2 px-3 text-right font-mono font-semibold text-text-primary bg-bg-row', true)}>{fmt(homeMonthsHomebaseBudget)}</td>
              </tr>
              <tr className={themed('border-b border-border bg-bg-row/50 hover:bg-brand-purple-wash/30', true)}>
                <td className={themed('py-2 px-3 font-medium text-text-primary border-r border-border', true)}>Business</td>
                {MONTHS_SHORT.map((_, i) => {
                  const val = Object.values(businessBudget.budgetData).reduce((s, coa) => s + (coa[i] || 0), 0);
                  return (<td key={i} className={themed('py-2 px-2 text-right font-mono border-r border-border-light text-text-secondary', true)}>{fmt(val)}</td>);
                })}
                <td className={themed('py-2 px-3 text-right font-mono font-semibold text-text-primary bg-bg-row', true)}>{fmt(yearlyBusinessBudget)}</td>
              </tr>
              <tr className={themed('border-b border-border bg-white hover:bg-brand-purple-wash/30', true)}>
                <td className={themed('py-2 px-3 font-medium text-text-primary border-r border-border', true)}>Travel</td>
                {MONTHS_SHORT.map((_, i) => {
                  const val = Object.values(nomadBudget.budgetData).reduce((s, coa) => s + (coa[i] || 0), 0);
                  return (<td key={i} className={themed('py-2 px-2 text-right font-mono border-r border-border-light text-text-secondary', true)}>{fmt(val)}</td>);
                })}
                <td className={themed('py-2 px-3 text-right font-mono font-semibold text-text-primary bg-bg-row', true)}>{fmt(yearlyTravelBudget)}</td>
              </tr>
            </tbody>
            <tfoot>
              <tr className="bg-brand-purple text-white font-semibold">
                <td className="py-2 px-3 border-r border-brand-purple-hover">Monthly Total</td>
                {MONTHS_SHORT.map((_, i) => {
                  const homebase = Object.values(homebaseBudget.budgetData).reduce((s, coa) => s + (coa[i] || 0), 0);
                  const business = Object.values(businessBudget.budgetData).reduce((s, coa) => s + (coa[i] || 0), 0);
                  const travel = Object.values(nomadBudget.budgetData).reduce((s, coa) => s + (coa[i] || 0), 0);
                  const isTraveling = travelMonths.includes(i);
                  const effective = isTraveling ? (travel + business) : (homebase + travel + business);
                  return (<td key={i} className={`py-2 px-2 text-right font-mono border-r border-brand-purple-hover ${isTraveling ? 'bg-panel-highlight' : ''}`}>{fmt(effective)}</td>);
                })}
                <td className="py-2 px-3 text-right font-mono bg-panel-highlight">{fmt(effectiveYearlyCost)}</td>
              </tr>
              <tr className={themed('bg-bg-row text-text-secondary text-[10px]', true)}>
                <td className={themed('py-1.5 px-3 border-r border-border', true)}>Trips</td>
                {MONTHS_SHORT.map((_, i) => {
                  const tripsInMonth = committedTrips.filter(t => {
                    if (!t.startDate) return false;
                    const start = new Date(new Date(t.startDate).getTime() + 12*60*60*1000);
                    return start.getMonth() === i && start.getFullYear() === selectedYear;
                  });
                  return (
                    <td key={i} className={themed('py-1.5 px-1 text-center border-r border-border-light truncate', true)} style={{maxWidth: '55px'}}>
                      {tripsInMonth.length > 0 ? tripsInMonth.map(t => t.destination?.split(',')[0] || t.name).join(', ') : '—'}
                    </td>
                  );
                })}
                <td className="py-1.5 px-3 text-center bg-border font-medium">{committedTrips.filter(t => t.startDate && new Date(new Date(t.startDate).getTime() + 12*60*60*1000).getFullYear() === selectedYear).length} trips</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}
