/**
 * src/components/workbench/SectionI_AuditTail.tsx
 *
 * Audit log tail: last 50 entries, newest first. Verify-chain button
 * computes the hash chain locally and reports any mismatch.
 *
 * Wires to /api/audit-log and /api/audit-log/verify-chain (existing).
 */

'use client';

import { useEffect, useState } from 'react';
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
}

interface VerifyResult {
  ok: boolean;
  rows_checked: number;
  message?: string;
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

export function SectionI_AuditTail({ surface = 'light' }: { surface?: Surface } = {}) {
  const dk = surface === 'dark';
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState<VerifyResult | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch('/api/audit-log?limit=50');
        if (res.ok) {
          const body = await res.json();
          setRows(body?.entries ?? body?.rows ?? []);
        }
      } finally {
        setLoading(false);
      }
    };
    fetchData();
    const id = setInterval(fetchData, 10000);
    return () => clearInterval(id);
  }, []);

  const verifyChain = async () => {
    setVerifying(true);
    setVerifyResult(null);
    try {
      const res = await fetch('/api/audit-log/verify-chain');
      if (res.ok) {
        setVerifyResult(await res.json());
      } else {
        setVerifyResult({ ok: false, rows_checked: 0, message: 'request failed' });
      }
    } finally {
      setVerifying(false);
    }
  };

  return (
    <section className={themed('bg-white rounded border border-border shadow-sm p-5', dk)}>
      <div className="flex items-center justify-between mb-3">
        <h2 className={themed('font-mono text-sm font-bold tracking-wide text-text-primary', dk)}>
          I · AUDIT LOG TAIL
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
            : `chain INVALID · ${verifyResult.message ?? 'see /compliance/audit-log'}`}
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
              {rows.map((r) => (
                <tr key={r.id} className={themed('border-t border-border-light', dk)}>
                  <td className={themed('py-1 text-text-muted', dk)}>{relTime(r.created_at)}</td>
                  <td className={themed('py-1 text-text-primary', dk)}>
                    <div className="font-bold">{r.action_type}</div>
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
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className={themed('text-xs font-mono text-text-muted', dk)}>no audit entries</div>
      )}
    </section>
  );
}
