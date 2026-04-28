'use client';

import { useState, useEffect, useMemo } from 'react';
import AppLayout from '@/components/ui/AppLayout';
import OpsSubNav from '@/components/ops/OpsSubNav';

interface RegulatorySource {
  id: string;
  domain: string;
  source_name: string;
  source_tier: string;
  authority_rank: number;
  jurisdictions: string[];
  regulators: string[];
  practice_areas: string[];
  module_relevance: string[];
  primary_content_types: string[];
  refresh_cadence: string;
  notes: string | null;
}

const TIER_STYLE: Record<string, string> = {
  primary_law: 'bg-emerald-100 text-emerald-800',
  subregulatory_guidance: 'bg-blue-100 text-blue-800',
  agency_enforcement: 'bg-red-100 text-red-800',
  secondary_authoritative: 'bg-amber-100 text-amber-800',
  secondary_practitioner: 'bg-gray-100 text-gray-600',
};

const RANK_STYLE: Record<number, string> = {
  1: 'bg-emerald-100 text-emerald-800',
  2: 'bg-blue-100 text-blue-800',
  3: 'bg-amber-100 text-amber-800',
  4: 'bg-orange-100 text-orange-800',
  5: 'bg-gray-100 text-gray-600',
};

const TIER_OPTIONS = ['', 'primary_law', 'subregulatory_guidance', 'agency_enforcement', 'secondary_authoritative', 'secondary_practitioner'];
const MODULE_OPTIONS = ['', 'bookkeeping_tax', 'trading', 'travel', 'operations'];

export default function RegistryPage() {
  const [sources, setSources] = useState<RegulatorySource[]>([]);
  const [loading, setLoading] = useState(true);
  const [tierFilter, setTierFilter] = useState('');
  const [moduleFilter, setModuleFilter] = useState('');
  const [jurisdictionFilter, setJurisdictionFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/regulatory-sources');
        if (res.ok) {
          const data = await res.json();
          setSources(data.sources || []);
        }
      } catch (err) {
        console.error('Failed to load sources:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filtered = useMemo(() => {
    return sources.filter((s) => {
      if (tierFilter && s.source_tier !== tierFilter) return false;
      if (moduleFilter && !s.module_relevance.includes(moduleFilter)) return false;
      if (jurisdictionFilter && !s.jurisdictions.some((j) => j.toLowerCase().includes(jurisdictionFilter.toLowerCase()))) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (!s.source_name.toLowerCase().includes(q) && !s.domain.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [sources, tierFilter, moduleFilter, jurisdictionFilter, searchQuery]);

  if (loading) {
    return (
      <AppLayout>
        <OpsSubNav />
        <div className="flex items-center justify-center min-h-[40vh]">
          <div className="flex items-center gap-3">
            <div className="w-5 h-5 border-2 border-brand-purple border-t-transparent rounded-full animate-spin" />
            <span className="text-text-muted font-mono text-terminal-base">Loading registry...</span>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <OpsSubNav />
      <div className="max-w-[1600px] mx-auto px-4 pt-4 pb-8 space-y-4">
        {/* Header */}
        <div className="bg-white rounded border border-border shadow-sm p-5">
          <h1 className="text-xl font-bold text-text-primary font-mono">Regulatory Source Registry</h1>
          <p className="text-terminal-sm text-text-muted font-mono mt-1">
            Foundation for verification-first compliance. {sources.length} verified authoritative sources.
          </p>
          <p className="text-terminal-sm text-text-faint font-mono mt-2">
            Showing {filtered.length} of {sources.length} sources
          </p>
        </div>

        {/* Filters */}
        <div className="bg-white rounded border border-border shadow-sm p-4 flex flex-wrap gap-3">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name or domain..."
            className="font-mono text-sm bg-transparent border border-border rounded-md px-3 py-1.5 w-64 focus:border-brand-purple outline-none transition-colors placeholder:text-text-faint"
          />
          <select
            value={tierFilter}
            onChange={(e) => setTierFilter(e.target.value)}
            className="font-mono text-sm bg-transparent border border-border rounded-md px-3 py-1.5 focus:border-brand-purple outline-none"
          >
            <option value="">All tiers</option>
            {TIER_OPTIONS.filter(Boolean).map((t) => (
              <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>
            ))}
          </select>
          <select
            value={moduleFilter}
            onChange={(e) => setModuleFilter(e.target.value)}
            className="font-mono text-sm bg-transparent border border-border rounded-md px-3 py-1.5 focus:border-brand-purple outline-none"
          >
            <option value="">All modules</option>
            {MODULE_OPTIONS.filter(Boolean).map((m) => (
              <option key={m} value={m}>{m.replace(/_/g, ' ')}</option>
            ))}
          </select>
          <input
            type="text"
            value={jurisdictionFilter}
            onChange={(e) => setJurisdictionFilter(e.target.value)}
            placeholder="Jurisdiction..."
            className="font-mono text-sm bg-transparent border border-border rounded-md px-3 py-1.5 w-40 focus:border-brand-purple outline-none transition-colors placeholder:text-text-faint"
          />
        </div>

        {/* Table */}
        <div className="bg-white rounded border border-border shadow-sm overflow-x-auto">
          <table className="w-full text-terminal-base font-mono">
            <thead className="bg-gray-50 border-b border-border">
              <tr>
                <th className="px-3 py-2 text-left text-terminal-sm font-semibold text-text-secondary uppercase tracking-wider">Source</th>
                <th className="px-3 py-2 text-left text-terminal-sm font-semibold text-text-secondary uppercase tracking-wider">Domain</th>
                <th className="px-3 py-2 text-left text-terminal-sm font-semibold text-text-secondary uppercase tracking-wider">Tier</th>
                <th className="px-3 py-2 text-center text-terminal-sm font-semibold text-text-secondary uppercase tracking-wider">Rank</th>
                <th className="px-3 py-2 text-left text-terminal-sm font-semibold text-text-secondary uppercase tracking-wider">Jurisdictions</th>
                <th className="px-3 py-2 text-left text-terminal-sm font-semibold text-text-secondary uppercase tracking-wider">Modules</th>
                <th className="px-3 py-2 text-left text-terminal-sm font-semibold text-text-secondary uppercase tracking-wider">Cadence</th>
                <th className="px-3 py-2 text-left text-terminal-sm font-semibold text-text-secondary uppercase tracking-wider max-w-xs">Notes</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => (
                <tr key={s.id} className="border-b border-border-light hover:bg-bg-row/50 transition-colors">
                  <td className="px-3 py-2 text-text-primary font-medium">{s.source_name}</td>
                  <td className="px-3 py-2 text-text-muted">{s.domain}</td>
                  <td className="px-3 py-2">
                    <span className={`text-terminal-sm px-1.5 py-0.5 rounded ${TIER_STYLE[s.source_tier] || 'bg-gray-100'}`}>
                      {s.source_tier.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-center">
                    <span className={`text-terminal-sm px-2 py-0.5 rounded-full font-bold ${RANK_STYLE[s.authority_rank] || 'bg-gray-100'}`}>
                      {s.authority_rank}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-text-muted text-terminal-sm">{s.jurisdictions.join(', ')}</td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-1">
                      {s.module_relevance.map((m) => (
                        <span key={m} className="text-terminal-sm bg-brand-purple/10 text-brand-purple px-1.5 py-0.5 rounded">{m.replace(/_/g, ' ')}</span>
                      ))}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-text-muted text-terminal-sm">{s.refresh_cadence.replace(/_/g, ' ')}</td>
                  <td className="px-3 py-2 text-text-faint text-terminal-sm max-w-xs truncate">{s.notes || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AppLayout>
  );
}
