/**
 * src/components/workbench/operations/SectionK_AuditTail.tsx
 *
 * Operations-filtered audit tail. Mirrors SectionI_AuditTail but:
 *  - fetches with ?prefix=operations_ to scope to the Operations subsystem
 *  - calls verify-chain via POST (matches the endpoint contract)
 *  - reads body.rows only (current API response shape)
 *
 * PR-Ops-3.6: rows are click-to-expand. Click on the action cell toggles
 * an expanded view that shows pretty-printed payload JSON for any row
 * type, plus — for action_type='operations_ai_inference' — a lazy fetch
 * to /api/operations/ai-usage/[id] that surfaces full prompt/response
 * via InspectionDrawer. Cache is session-scoped.
 */

'use client';

import { Fragment, useEffect, useState } from 'react';
import InspectionDrawer from './ai/InspectionDrawer';
import { themed, type Surface } from '@/lib/ds';

interface AuditRow {
  id: string;
  created_at: string;
  actor_type: string;
  action_type: string;
  action_description: string;
  target_table: string | null;
  target_id: string | null;
  prev_hash: string;
  content_hash: string;
  payload?: unknown;
}

interface VerifyResult {
  ok: boolean;
  rows_checked: number;
  message?: string;
}

interface AiUsageRow {
  id: string;
  model: string;
  purpose: string;
  input_tokens: number;
  output_tokens: number;
  cost_usd: string;
  full_system_prompt: string | null;
  full_user_message: string | null;
  full_response: string | null;
}

function shortHash(h: string | null): string {
  if (!h) return '—';
  return h.length > 12 ? `${h.slice(0, 6)}…${h.slice(-4)}` : h;
}

function relTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60_000) return `${Math.floor(ms / 1000)}s ago`;
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m ago`;
  if (ms < 86_400_000) return `${Math.floor(ms / 3_600_000)}h ago`;
  return `${Math.floor(ms / 86_400_000)}d ago`;
}

function readUsageId(payload: unknown): string | null {
  if (typeof payload !== 'object' || payload === null) return null;
  const meta = (payload as { metadata?: unknown }).metadata;
  if (typeof meta !== 'object' || meta === null) return null;
  const id = (meta as { usage_id?: unknown }).usage_id;
  return typeof id === 'string' ? id : null;
}

export default function SectionK_AuditTail({ surface = 'light' }: { surface?: Surface } = {}) {
  const dk = surface === 'dark';
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState<VerifyResult | null>(null);

  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [aiUsageCache, setAiUsageCache] = useState<Map<string, AiUsageRow>>(new Map());
  const [aiUsageLoading, setAiUsageLoading] = useState<Set<string>>(new Set());
  const [aiUsageError, setAiUsageError] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    let cancelled = false;
    const fetchData = async () => {
      try {
        const res = await fetch('/api/audit-log?prefix=operations_&limit=50');
        if (!cancelled && res.ok) {
          const body = await res.json();
          setRows(body?.rows ?? []);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchData();
    const id = setInterval(fetchData, 10000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  const verifyChain = async () => {
    setVerifying(true);
    setVerifyResult(null);
    try {
      const res = await fetch('/api/audit-log/verify-chain', { method: 'POST' });
      if (res.ok) {
        setVerifyResult(await res.json());
      } else {
        setVerifyResult({ ok: false, rows_checked: 0, message: `request failed (${res.status})` });
      }
    } finally {
      setVerifying(false);
    }
  };

  const toggleRow = async (rowId: string, actionType: string, payload: unknown) => {
    const isCurrentlyExpanded = expandedRows.has(rowId);
    const next = new Set(expandedRows);
    if (isCurrentlyExpanded) {
      next.delete(rowId);
      setExpandedRows(next);
      return;
    }
    next.add(rowId);
    setExpandedRows(next);

    if (actionType !== 'operations_ai_inference') return;
    const usageId = readUsageId(payload);
    if (!usageId) return;
    if (aiUsageCache.has(usageId) || aiUsageLoading.has(usageId)) return;

    setAiUsageLoading((s) => {
      const n = new Set(s);
      n.add(usageId);
      return n;
    });
    try {
      const res = await fetch(`/api/operations/ai-usage/${usageId}`);
      const body = await res.json();
      if (!res.ok) {
        setAiUsageError((m) => {
          const n = new Map(m);
          n.set(usageId, body?.message ?? body?.error ?? 'failed to load AI usage row');
          return n;
        });
      } else {
        setAiUsageCache((c) => {
          const n = new Map(c);
          n.set(usageId, body as AiUsageRow);
          return n;
        });
      }
    } catch (e) {
      setAiUsageError((m) => {
        const n = new Map(m);
        n.set(usageId, e instanceof Error ? e.message : 'fetch failed');
        return n;
      });
    } finally {
      setAiUsageLoading((s) => {
        const n = new Set(s);
        n.delete(usageId);
        return n;
      });
    }
  };

  const renderAiInspection = (payload: unknown) => {
    const usageId = readUsageId(payload);
    if (!usageId) {
      return (
        <div className="text-amber-800 text-xs font-mono">
          (AI inference row missing usage_id in metadata)
        </div>
      );
    }
    if (aiUsageLoading.has(usageId)) {
      return <div className={themed('text-text-muted text-xs font-mono', dk)}>loading AI inference details…</div>;
    }
    const err = aiUsageError.get(usageId);
    if (err) {
      return (
        <div className="text-red-800 text-xs font-mono px-3 py-2 rounded border bg-red-50 border-red-200">
          {err}
        </div>
      );
    }
    const usage = aiUsageCache.get(usageId);
    if (!usage) return null;

    const hasFullPrompts =
      usage.full_system_prompt !== null &&
      usage.full_user_message !== null &&
      usage.full_response !== null;

    if (!hasFullPrompts) {
      return (
        <InspectionDrawer surface={surface}
          data={null}
          legacyReason="(prompts not captured for this row — predates PR-Ops-3.6)"
        />
      );
    }

    return (
      <InspectionDrawer surface={surface}
        data={{
          model: usage.model,
          temperature: 0,
          maxTokens: 0,
          systemPrompt: usage.full_system_prompt!,
          userMessage: usage.full_user_message!,
          rawResponse: usage.full_response!,
          inputTokens: usage.input_tokens,
          outputTokens: usage.output_tokens,
          costUsd: usage.cost_usd,
          usageId,
        }}
      />
    );
  };

  return (
    <section className={themed('bg-white rounded border border-border shadow-sm p-5', dk)}>
      <div className="flex items-center justify-between mb-3">
        <h2 className={themed('font-mono text-sm font-bold tracking-wide text-text-primary', dk)}>
          K · AUDIT TAIL
        </h2>
        <div className="flex items-center gap-3 text-xs font-mono">
          <span className={themed('text-text-muted', dk)}>refresh 10s</span>
          <button
            onClick={verifyChain}
            disabled={verifying}
            className={themed('px-2 py-1 border border-border rounded hover:bg-bg-row disabled:opacity-50', dk)}
          >
            {verifying ? 'verifying…' : 'verify chain'}
          </button>
        </div>
      </div>

      {verifyResult && (
        <div
          className={`text-xs font-mono mb-3 px-3 py-2 rounded border ${
            verifyResult.ok
              ? 'bg-green-50 border-green-200 text-green-800'
              : 'bg-red-50 border-red-200 text-red-800'
          }`}
        >
          {verifyResult.ok
            ? `chain valid · ${verifyResult.rows_checked} rows checked`
            : `chain INVALID · ${verifyResult.message ?? 'see audit log'}`}
        </div>
      )}

      {loading ? (
        <div className={themed('text-xs font-mono text-text-muted', dk)}>loading…</div>
      ) : rows.length > 0 ? (
        <div className="text-xs font-mono max-h-96 overflow-y-auto">
          <table className="w-full">
            <thead className={themed('sticky top-0 bg-white', dk)}>
              <tr className={themed('text-text-faint uppercase tracking-wide', dk)}>
                <th className="text-left pb-1 w-20">when</th>
                <th className="text-left pb-1">action</th>
                <th className="text-left pb-1 w-24">target</th>
                <th className="text-left pb-1 w-28">prev_hash</th>
                <th className="text-left pb-1 w-28">this_hash</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const isExpanded = expandedRows.has(r.id);
                return (
                  <Fragment key={r.id}>
                    <tr className={themed('border-t border-border-light', dk)}>
                      <td className={themed('py-1 text-text-muted', dk)}>{relTime(r.created_at)}</td>
                      <td
                        className={themed('py-1 text-text-primary cursor-pointer hover:bg-bg-row', dk)}
                        onClick={() => toggleRow(r.id, r.action_type, r.payload)}
                        title="Click to inspect this audit row"
                      >
                        <div className="font-bold flex items-center gap-1">
                          <span className={themed('text-text-faint', dk)}>{isExpanded ? '▾' : '▸'}</span>
                          <span>{r.action_type}</span>
                        </div>
                        <div className={themed('text-text-muted truncate max-w-md', dk)}>
                          {r.action_description}
                        </div>
                      </td>
                      <td className={themed('py-1 text-text-muted truncate', dk)}>
                        {r.target_table ?? '—'}
                      </td>
                      <td className={themed('py-1 text-text-faint', dk)}>{shortHash(r.prev_hash)}</td>
                      <td className={themed('py-1 text-text-faint', dk)}>{shortHash(r.content_hash)}</td>
                    </tr>
                    {isExpanded && (
                      <tr>
                        <td colSpan={5} className={themed('bg-bg-row px-4 py-3 border-t border-border-light', dk)}>
                          <div className="text-xs font-mono space-y-3">
                            <div>
                              <div className={themed('text-text-faint uppercase tracking-wide mb-1', dk)}>payload</div>
                              <pre className={themed('whitespace-pre-wrap p-2 bg-white border border-border-light rounded max-h-64 overflow-y-auto text-xs', dk)}>
                                {JSON.stringify(r.payload, null, 2)}
                              </pre>
                            </div>
                            {r.action_type === 'operations_ai_inference' && renderAiInspection(r.payload)}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className={themed('text-xs font-mono text-text-muted', dk)}>no operations audit entries yet</div>
      )}
    </section>
  );
}
