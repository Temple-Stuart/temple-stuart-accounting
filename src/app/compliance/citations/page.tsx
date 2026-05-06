'use client';

import { useState, useEffect, useMemo } from 'react';
import AppLayout from '@/components/ui/AppLayout';
import OpsSubNav from '@/components/ops/OpsSubNav';

interface Citation {
  id: string;
  regulatory_source_id: string;
  document_type: string;
  citation_string: string;
  pinpoint: string | null;
  stable_uri: string;
  retrieved_url: string;
  retrieved_at: string;
  retrieved_content_hash: string;
  retrieval_method: string;
  version_label: string;
  effective_date: string | null;
  status: string;
  last_verified_at: string | null;
  last_verified_by: string | null;
  verification_notes: string | null;
  existence_check: string;
  currency_check: string;
  groundedness_check: string;
  pinpoint_check: string;
  supersession_check: string;
  jurisdiction_match_check: string;
  source_authority_match_check: string;
  content_hash_check: string;
  regulatory_source: {
    source_name: string;
    domain: string;
  };
}

const STATUS_STYLE: Record<string, string> = {
  verified: 'bg-emerald-100 text-emerald-800',
  unverified: 'bg-gray-100 text-gray-600',
  superseded: 'bg-amber-100 text-amber-800',
  withdrawn: 'bg-red-100 text-red-800',
  unreachable: 'bg-red-100 text-red-800',
  pending_review: 'bg-blue-100 text-blue-800',
};

const DOC_TYPE_STYLE: Record<string, string> = {
  statute: 'bg-emerald-100 text-emerald-800',
  regulation: 'bg-blue-100 text-blue-800',
  case_opinion: 'bg-purple-100 text-purple-800',
  agency_guidance: 'bg-amber-100 text-amber-800',
  agency_enforcement_order: 'bg-red-100 text-red-800',
  treaty: 'bg-indigo-100 text-indigo-800',
  professional_standard: 'bg-teal-100 text-teal-800',
  technical_standard: 'bg-cyan-100 text-cyan-800',
  legislative_history: 'bg-gray-100 text-gray-600',
  state_attorney_general_opinion: 'bg-orange-100 text-orange-800',
  no_action_letter: 'bg-yellow-100 text-yellow-800',
  comment_letter: 'bg-lime-100 text-lime-800',
  other: 'bg-gray-100 text-gray-600',
};

const STATUS_OPTIONS = ['', 'verified', 'unverified', 'superseded', 'withdrawn', 'unreachable', 'pending_review'];
const DOC_TYPE_OPTIONS = [
  '', 'statute', 'regulation', 'case_opinion', 'agency_guidance', 'agency_enforcement_order',
  'treaty', 'professional_standard', 'technical_standard', 'legislative_history',
  'state_attorney_general_opinion', 'no_action_letter', 'comment_letter', 'other',
];

function relativeTime(dateStr: string | null): string {
  if (!dateStr) return '—';
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return 'just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 30) return `${diffDay}d ago`;
  const diffMonth = Math.floor(diffDay / 30);
  return `${diffMonth}mo ago`;
}

export default function CitationsPage() {
  const [citations, setCitations] = useState<Citation[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [docTypeFilter, setDocTypeFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [verifyingId, setVerifyingId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/citations');
        if (res.ok) {
          const data = await res.json();
          setCitations(data.citations || []);
        }
      } catch (err) {
        console.error('Failed to load citations:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filtered = useMemo(() => {
    return citations.filter((c) => {
      if (statusFilter && c.status !== statusFilter) return false;
      if (docTypeFilter && c.document_type !== docTypeFilter) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (!c.citation_string.toLowerCase().includes(q) && !c.stable_uri.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [citations, statusFilter, docTypeFilter, searchQuery]);

  const handleVerify = async (id: string) => {
    setVerifyingId(id);
    try {
      const res = await fetch(`/api/citations/${id}/verify`, { method: 'POST' });
      if (res.ok) {
        const result = await res.json();
        setCitations((prev) =>
          prev.map((c) =>
            c.id === id
              ? {
                  ...c,
                  status: result.overall_status === 'verified' ? 'verified' : result.overall_status === 'failed' ? 'unreachable' : 'pending_review',
                  last_verified_at: result.ran_at,
                  existence_check: result.checks.existence,
                  currency_check: result.checks.currency,
                  groundedness_check: result.checks.groundedness,
                  pinpoint_check: result.checks.pinpoint,
                  supersession_check: result.checks.supersession,
                  jurisdiction_match_check: result.checks.jurisdiction_match,
                  source_authority_match_check: result.checks.source_authority_match,
                  content_hash_check: result.checks.content_hash,
                }
              : c
          )
        );
      }
    } catch (err) {
      console.error('Verification failed:', err);
    } finally {
      setVerifyingId(null);
    }
  };

  if (loading) {
    return (
      <AppLayout>
        <OpsSubNav />
        <div className="flex items-center justify-center min-h-[40vh]">
          <div className="flex items-center gap-3">
            <div className="w-5 h-5 border-2 border-brand-purple border-t-transparent rounded-full animate-spin" />
            <span className="text-text-muted font-mono text-terminal-base">Loading citations...</span>
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
          <h1 className="text-xl font-bold text-text-primary font-mono">Regulatory Citations</h1>
          <p className="text-terminal-sm text-text-muted font-mono mt-1">
            Verification-first citation tracking with 8-step integrity protocol.
          </p>
          <p className="text-terminal-sm text-text-faint font-mono mt-2">
            Showing {filtered.length} of {citations.length} citations
          </p>
        </div>

        {/* Filters */}
        <div className="bg-white rounded border border-border shadow-sm p-4 flex flex-wrap gap-3">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by citation or URI..."
            className="font-mono text-sm bg-transparent border border-border rounded-md px-3 py-1.5 w-64 focus:border-brand-purple outline-none transition-colors placeholder:text-text-faint"
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="font-mono text-sm bg-transparent border border-border rounded-md px-3 py-1.5 focus:border-brand-purple outline-none"
          >
            <option value="">All statuses</option>
            {STATUS_OPTIONS.filter(Boolean).map((s) => (
              <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
            ))}
          </select>
          <select
            value={docTypeFilter}
            onChange={(e) => setDocTypeFilter(e.target.value)}
            className="font-mono text-sm bg-transparent border border-border rounded-md px-3 py-1.5 focus:border-brand-purple outline-none"
          >
            <option value="">All document types</option>
            {DOC_TYPE_OPTIONS.filter(Boolean).map((d) => (
              <option key={d} value={d}>{d.replace(/_/g, ' ')}</option>
            ))}
          </select>
        </div>

        {/* Table */}
        {filtered.length === 0 ? (
          <div className="bg-white rounded border border-border shadow-sm p-12 text-center">
            <p className="text-text-muted font-mono text-terminal-base">
              No citations yet. Citations populate as compliance tasks are created in PR-D.
            </p>
          </div>
        ) : (
          <div className="bg-white rounded border border-border shadow-sm overflow-x-auto">
            <table className="w-full text-terminal-base font-mono">
              <thead className="bg-gray-50 border-b border-border">
                <tr>
                  <th className="px-3 py-2 text-left text-terminal-sm font-semibold text-text-secondary uppercase tracking-wider">Citation</th>
                  <th className="px-3 py-2 text-left text-terminal-sm font-semibold text-text-secondary uppercase tracking-wider">Type</th>
                  <th className="px-3 py-2 text-left text-terminal-sm font-semibold text-text-secondary uppercase tracking-wider">Source</th>
                  <th className="px-3 py-2 text-center text-terminal-sm font-semibold text-text-secondary uppercase tracking-wider">Status</th>
                  <th className="px-3 py-2 text-left text-terminal-sm font-semibold text-text-secondary uppercase tracking-wider">Pinpoint</th>
                  <th className="px-3 py-2 text-left text-terminal-sm font-semibold text-text-secondary uppercase tracking-wider">Verified</th>
                  <th className="px-3 py-2 text-center text-terminal-sm font-semibold text-text-secondary uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => (
                  <tr key={c.id} className="border-b border-border-light hover:bg-bg-row/50 transition-colors">
                    <td className="px-3 py-2 text-text-primary font-medium max-w-xs">
                      <div className="truncate">{c.citation_string}</div>
                    </td>
                    <td className="px-3 py-2">
                      <span className={`text-terminal-sm px-1.5 py-0.5 rounded ${DOC_TYPE_STYLE[c.document_type] || 'bg-gray-100'}`}>
                        {c.document_type.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-text-muted text-terminal-sm">
                      <div>{c.regulatory_source.source_name}</div>
                      <div className="text-text-faint">{c.regulatory_source.domain}</div>
                    </td>
                    <td className="px-3 py-2 text-center">
                      <span className={`text-terminal-sm px-1.5 py-0.5 rounded ${STATUS_STYLE[c.status] || 'bg-gray-100'}`}>
                        {c.status.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-text-muted text-terminal-sm max-w-[200px] truncate">
                      {c.pinpoint || '—'}
                    </td>
                    <td className="px-3 py-2 text-text-muted text-terminal-sm">
                      {relativeTime(c.last_verified_at)}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <button
                        onClick={() => handleVerify(c.id)}
                        disabled={verifyingId === c.id}
                        className="font-mono text-terminal-sm px-3 py-1 rounded border border-brand-purple text-brand-purple hover:bg-brand-purple hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {verifyingId === c.id ? 'Verifying...' : 'Verify'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
