'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import AppLayout from '@/components/ui/AppLayout';
import OpsSubNav from '@/components/ops/OpsSubNav';

interface AuditRow {
  id: string;
  sequence_number: string;
  prev_hash: string;
  content_hash: string;
  actor_user_id: string | null;
  actor_email: string | null;
  actor_type: string;
  actor_session_id: string | null;
  actor_ip: string | null;
  action_type: string;
  action_description: string;
  target_table: string;
  target_id: string | null;
  payload_before: unknown;
  payload_after: unknown;
  payload_metadata: unknown;
  request_id: string | null;
  user_agent: string | null;
  created_at: string;
}

interface ChainStatus {
  total_rows: number;
  verified_at: string;
  is_valid: boolean;
  break_points: Array<{
    sequence_number: string;
    expected_hash: string;
    actual_hash: string;
    reason: string;
  }>;
  notes: string[];
}

const ACTION_CATEGORY: Record<string, string> = {
  citation_created: 'citation',
  citation_updated: 'citation',
  citation_verified: 'citation',
  citation_status_changed: 'citation',
  citation_superseded: 'citation',
  citation_deleted: 'citation',
  task_created: 'task',
  task_updated: 'task',
  task_status_changed: 'task',
  task_assigned: 'task',
  task_completed: 'task',
  task_evidence_attached: 'task',
  task_attested: 'task',
  task_deleted: 'task',
  mission_created: 'mission',
  mission_updated: 'mission',
  mission_status_changed: 'mission',
  mission_deleted: 'mission',
  project_created: 'project',
  project_updated: 'project',
  project_deleted: 'project',
  workstream_created: 'workstream',
  workstream_updated: 'workstream',
  workstream_deleted: 'workstream',
  ai_generation_started: 'ai',
  ai_generation_completed: 'ai',
  ai_generation_failed: 'ai',
  ai_verification_passed: 'ai',
  ai_verification_failed: 'ai',
  regulatory_source_added: 'regulatory',
  regulatory_source_updated: 'regulatory',
  regulatory_source_deactivated: 'regulatory',
  user_login: 'system',
  user_logout: 'system',
  permission_granted: 'system',
  permission_revoked: 'system',
  data_export_initiated: 'system',
  data_export_completed: 'system',
  system_other: 'system',
};

const CATEGORY_STYLE: Record<string, string> = {
  citation: 'bg-blue-100 text-blue-800',
  task: 'bg-purple-100 text-purple-800',
  mission: 'bg-indigo-100 text-indigo-800',
  project: 'bg-teal-100 text-teal-800',
  workstream: 'bg-cyan-100 text-cyan-800',
  ai: 'bg-amber-100 text-amber-800',
  regulatory: 'bg-emerald-100 text-emerald-800',
  system: 'bg-gray-100 text-gray-600',
};

const ACTION_TYPE_OPTIONS = [
  '',
  'citation_created', 'citation_updated', 'citation_verified',
  'citation_status_changed', 'citation_superseded', 'citation_deleted',
  'task_created', 'task_updated', 'task_status_changed',
  'task_assigned', 'task_completed', 'task_evidence_attached',
  'task_attested', 'task_deleted',
  'ai_generation_started', 'ai_generation_completed', 'ai_generation_failed',
  'ai_verification_passed', 'ai_verification_failed',
  'regulatory_source_added', 'regulatory_source_updated', 'regulatory_source_deactivated',
  'system_other',
];

const TARGET_TABLE_OPTIONS = ['', 'citations', 'audit_log', 'regulatory_sources'];

function relativeTime(dateStr: string): string {
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

function formatActor(row: AuditRow): string {
  if (row.actor_email) return row.actor_email;
  if (row.actor_type === 'ai_agent') return 'ai_agent';
  if (row.actor_type === 'system_automation') return 'system';
  return row.actor_type;
}

export default function AuditLogPage() {
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [chainStatus, setChainStatus] = useState<ChainStatus | null>(null);
  const [chainLoading, setChainLoading] = useState(true);
  const [chainExpanded, setChainExpanded] = useState(false);
  const [actionFilter, setActionFilter] = useState('');
  const [targetTableFilter, setTargetTableFilter] = useState('');
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [limit, setLimit] = useState(100);

  const fetchRows = useCallback(async (take: number) => {
    try {
      const params = new URLSearchParams();
      params.set('limit', String(take));
      if (actionFilter) params.set('action_type', actionFilter);
      if (targetTableFilter) params.set('target_table', targetTableFilter);
      const res = await fetch(`/api/audit-log?${params}`);
      if (res.ok) {
        const data = await res.json();
        setRows(data.rows || []);
      }
    } catch (err) {
      console.error('Failed to load audit log:', err);
    } finally {
      setLoading(false);
    }
  }, [actionFilter, targetTableFilter]);

  useEffect(() => {
    setLoading(true);
    fetchRows(limit);
  }, [fetchRows, limit]);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/audit-log/verify-chain', { method: 'POST' });
        if (res.ok) {
          const data = await res.json();
          setChainStatus(data);
        }
      } catch (err) {
        console.error('Failed to verify chain:', err);
      } finally {
        setChainLoading(false);
      }
    })();
  }, []);

  const filtered = useMemo(() => rows, [rows]);

  if (loading && rows.length === 0) {
    return (
      <AppLayout>
        <OpsSubNav />
        <div className="flex items-center justify-center min-h-[40vh]">
          <div className="flex items-center gap-3">
            <div className="w-5 h-5 border-2 border-brand-purple border-t-transparent rounded-full animate-spin" />
            <span className="text-text-muted font-mono text-terminal-base">Loading audit log...</span>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <OpsSubNav />
      <div className="max-w-[1600px] mx-auto px-4 pt-4 pb-8 space-y-4">
        {/* Header + Chain Status */}
        <div className="bg-white rounded border border-border shadow-sm p-5">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-xl font-bold text-text-primary font-mono">Audit Log</h1>
              <p className="text-terminal-sm text-text-muted font-mono mt-1">
                Hash-chained, append-only compliance timeline with SOC 2 immutability.
              </p>
            </div>
            <div>
              {chainLoading ? (
                <span className="text-terminal-sm font-mono text-text-faint">Verifying chain...</span>
              ) : chainStatus ? (
                <div>
                  <button
                    onClick={() => setChainExpanded(!chainExpanded)}
                    className={`text-terminal-sm font-mono px-3 py-1 rounded ${
                      chainStatus.is_valid
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-red-100 text-red-800'
                    }`}
                  >
                    {chainStatus.is_valid
                      ? `Chain verified — ${chainStatus.total_rows} rows`
                      : `Chain broken — see details`}
                  </button>
                  {chainExpanded && !chainStatus.is_valid && (
                    <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded text-terminal-sm font-mono">
                      {chainStatus.break_points.map((bp, i) => (
                        <div key={i} className="mb-1">
                          <span className="text-red-800 font-medium">Seq #{bp.sequence_number}:</span>{' '}
                          <span className="text-red-700">{bp.reason}</span>
                        </div>
                      ))}
                      {chainStatus.notes.map((n, i) => (
                        <div key={`n-${i}`} className="text-red-600">{n}</div>
                      ))}
                    </div>
                  )}
                  {chainExpanded && chainStatus.is_valid && (
                    <div className="mt-3 p-3 bg-emerald-50 border border-emerald-200 rounded text-terminal-sm font-mono text-emerald-700">
                      {chainStatus.notes.map((n, i) => (
                        <div key={i}>{n}</div>
                      ))}
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          </div>
          <p className="text-terminal-sm text-text-faint font-mono mt-2">
            Showing {filtered.length} rows
          </p>
        </div>

        {/* Filters */}
        <div className="bg-white rounded border border-border shadow-sm p-4 flex flex-wrap gap-3">
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="font-mono text-sm bg-transparent border border-border rounded-md px-3 py-1.5 focus:border-brand-purple outline-none"
          >
            <option value="">All actions</option>
            {ACTION_TYPE_OPTIONS.filter(Boolean).map((a) => (
              <option key={a} value={a}>{a.replace(/_/g, ' ')}</option>
            ))}
          </select>
          <select
            value={targetTableFilter}
            onChange={(e) => setTargetTableFilter(e.target.value)}
            className="font-mono text-sm bg-transparent border border-border rounded-md px-3 py-1.5 focus:border-brand-purple outline-none"
          >
            <option value="">All targets</option>
            {TARGET_TABLE_OPTIONS.filter(Boolean).map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>

        {/* Table */}
        {filtered.length === 0 ? (
          <div className="bg-white rounded border border-border shadow-sm p-12 text-center">
            <p className="text-text-muted font-mono text-terminal-base">
              No audit entries match the current filters.
            </p>
          </div>
        ) : (
          <div className="bg-white rounded border border-border shadow-sm overflow-x-auto">
            <table className="w-full text-terminal-base font-mono">
              <thead className="bg-gray-50 border-b border-border">
                <tr>
                  <th className="px-3 py-2 text-left text-terminal-sm font-semibold text-text-secondary uppercase tracking-wider">Time</th>
                  <th className="px-3 py-2 text-left text-terminal-sm font-semibold text-text-secondary uppercase tracking-wider">Actor</th>
                  <th className="px-3 py-2 text-left text-terminal-sm font-semibold text-text-secondary uppercase tracking-wider">Action</th>
                  <th className="px-3 py-2 text-left text-terminal-sm font-semibold text-text-secondary uppercase tracking-wider">Target</th>
                  <th className="px-3 py-2 text-left text-terminal-sm font-semibold text-text-secondary uppercase tracking-wider">Description</th>
                  <th className="px-3 py-2 text-right text-terminal-sm font-semibold text-text-secondary uppercase tracking-wider">Seq #</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => {
                  const category = ACTION_CATEGORY[row.action_type] || 'system';
                  const isExpanded = expandedRow === row.id;
                  return (
                    <React.Fragment key={row.id}>
                      <tr className="border-b border-border-light hover:bg-bg-row/50 transition-colors">
                        <td className="px-3 py-2 text-text-muted text-terminal-sm">
                          <span title={new Date(row.created_at).toLocaleString()}>
                            {relativeTime(row.created_at)}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-text-primary text-terminal-sm">
                          {formatActor(row)}
                        </td>
                        <td className="px-3 py-2">
                          <span className={`text-terminal-sm px-1.5 py-0.5 rounded ${CATEGORY_STYLE[category] || 'bg-gray-100'}`}>
                            {row.action_type.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-text-muted text-terminal-sm">
                          {row.target_table}
                          {row.target_id ? `.${row.target_id.slice(0, 8)}` : ''}
                        </td>
                        <td className="px-3 py-2 text-text-muted text-terminal-sm max-w-xs">
                          <button
                            onClick={() => setExpandedRow(isExpanded ? null : row.id)}
                            className="text-left hover:text-text-primary transition-colors"
                          >
                            <span className="truncate block max-w-xs">
                              {row.action_description}
                            </span>
                          </button>
                        </td>
                        <td className="px-3 py-2 text-text-faint text-terminal-sm text-right">
                          {row.sequence_number}
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr className="border-b border-border-light">
                          <td colSpan={6} className="px-3 py-3 bg-gray-50">
                            <div className="space-y-2 text-terminal-sm">
                              <div className="font-medium text-text-secondary">Full Description</div>
                              <div className="text-text-muted">{row.action_description}</div>

                              {row.payload_before != null && (
                                <div>
                                  <div className="font-medium text-text-secondary mt-2">Before</div>
                                  <pre className="text-text-faint bg-white border border-border rounded p-2 overflow-x-auto text-xs">
                                    {JSON.stringify(row.payload_before, null, 2)}
                                  </pre>
                                </div>
                              )}
                              {row.payload_after != null && (
                                <div>
                                  <div className="font-medium text-text-secondary mt-2">After</div>
                                  <pre className="text-text-faint bg-white border border-border rounded p-2 overflow-x-auto text-xs">
                                    {JSON.stringify(row.payload_after, null, 2)}
                                  </pre>
                                </div>
                              )}
                              {row.payload_metadata != null && (
                                <div>
                                  <div className="font-medium text-text-secondary mt-2">Metadata</div>
                                  <pre className="text-text-faint bg-white border border-border rounded p-2 overflow-x-auto text-xs">
                                    {JSON.stringify(row.payload_metadata, null, 2)}
                                  </pre>
                                </div>
                              )}

                              <div className="flex gap-4 text-text-faint text-xs mt-2">
                                <span>Hash: {row.content_hash.slice(0, 16)}...</span>
                                <span>Prev: {row.prev_hash === 'GENESIS' ? 'GENESIS' : `${row.prev_hash.slice(0, 16)}...`}</span>
                                {row.request_id && <span>Req: {row.request_id}</span>}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Load More */}
        {filtered.length >= limit && (
          <div className="text-center">
            <button
              onClick={() => setLimit((prev) => prev + 100)}
              className="font-mono text-terminal-sm px-4 py-2 rounded border border-border text-text-muted hover:text-text-primary hover:border-brand-purple transition-colors"
            >
              Load more
            </button>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
