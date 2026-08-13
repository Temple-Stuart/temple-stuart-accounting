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

/** VERIFY-TRUTH: three truths, discriminated — a failed request must NEVER
 *  render as INVALID. 'invalid' may only come from the server's explicit
 *  verdict (route.ts ok:false on a 200); anything else — non-2xx status,
 *  network, parse — is 'failed' ("could not verify"), with the actual
 *  error surfaced and a Retry. No fallback of any kind. */
type VerifyResult =
  | { state: 'valid'; rows_checked: number }
  | { state: 'invalid'; rows_checked: number; message?: string }
  | { state: 'failed'; detail: string };

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

export function SectionI_AuditTail({ }: { } = {}) {
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
      // VERIFY-TRUTH: POST — the route accepts POST only (verify-chain/
      // route.ts:6); the GET here 405'd forever and painted a false
      // INVALID. Call shape per the working twin (operations/
      // SectionK_AuditTail.tsx:110).
      const res = await fetch('/api/audit-log/verify-chain', { method: 'POST' });
      if (!res.ok) {
        setVerifyResult({ state: 'failed', detail: `request failed (${res.status})` });
        return;
      }
      const body = await res.json();
      if (typeof body?.ok !== 'boolean' || typeof body?.rows_checked !== 'number') {
        setVerifyResult({ state: 'failed', detail: 'malformed verification response' });
        return;
      }
      setVerifyResult(
        body.ok
          ? { state: 'valid', rows_checked: body.rows_checked }
          : { state: 'invalid', rows_checked: body.rows_checked, message: body.message },
      );
    } catch (err) {
      setVerifyResult({ state: 'failed', detail: err instanceof Error ? err.message : 'network error' });
    } finally {
      setVerifying(false);
    }
  };

  return (
    <section className="bg-white rounded border border-border shadow-sm p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-mono text-sm font-bold tracking-wide text-text-primary">
          I · AUDIT LOG TAIL
        </h2>
        <div className="flex items-center gap-3 text-xs font-mono">
          <span className="text-text-muted">refresh 10s</span>
          {/* COMPLIANCE-UX-1: the dossier anchor — the verify-chain affordance
              is the tab's strongest verification machinery, so it takes the
              house primary-CTA idiom (strongest-cell treatment at its existing
              site). Same label, same handler, zero new copy. */}
          <button
            onClick={verifyChain}
            disabled={verifying}
            className="px-3 py-1 border border-brand-purple bg-brand-purple text-white rounded hover:opacity-90 disabled:opacity-50"
          >
            {verifying ? 'verifying…' : 'verify chain'}
          </button>
        </div>
      </div>

      {/* COMPLIANCE-UX-1: the verdict steps up one rung (text-sm bold) — the
          chain's answer should be unmissable. Strings verbatim. */}
      {/* VERIFY-TRUTH: three visually distinct verdicts. VALID + INVALID keep
          the pre-existing chip pair; INVALID renders ONLY on the server's
          explicit verdict and now wears the status-danger token family.
          FAILED is the new third state — "could not verify", never a tamper
          claim — in the DS strip family with the real error + Retry. */}
      {verifyResult && verifyResult.state === 'valid' && (
        <div className="text-sm font-bold font-mono mb-3 px-3 py-2 rounded border bg-green-50 border-green-200 text-green-800">
          chain valid · {verifyResult.rows_checked} rows checked
        </div>
      )}
      {verifyResult && verifyResult.state === 'invalid' && (
        <div className="text-sm font-bold font-mono mb-3 px-3 py-2 rounded border border-status-danger/40 bg-status-danger/10 text-status-danger">
          chain INVALID · {verifyResult.message ?? 'see /compliance/audit-log'}
        </div>
      )}
      {verifyResult && verifyResult.state === 'failed' && (
        <div className="text-sm font-mono mb-3 px-3 py-2 rounded border border-border bg-bg-row text-text-secondary flex items-center justify-between gap-3">
          <span>
            <span className="font-bold">could not verify</span> · {verifyResult.detail}
          </span>
          <button
            onClick={verifyChain}
            disabled={verifying}
            className="px-2 py-0.5 text-xs border border-brand-purple/40 text-brand-purple rounded hover:bg-brand-purple-wash disabled:opacity-50"
          >
            Retry
          </button>
        </div>
      )}

      {loading ? (
        <div className="text-xs font-mono text-text-muted">loading…</div>
      ) : rows.length > 0 ? (
        <div className="text-xs font-mono max-h-96 overflow-y-auto">
          <table className="w-full">
            <thead className="sticky top-0 bg-white">
              <tr className="text-text-faint uppercase tracking-wide">
                <th className="text-left pb-1 w-20">when</th>
                <th className="text-left pb-1">action</th>
                <th className="text-left pb-1 w-24">target</th>
                <th className="text-left pb-1 w-28">prev_hash</th>
                <th className="text-left pb-1 w-28">this_hash</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-border-light">
                  <td className="py-1 text-text-muted">{relTime(r.created_at)}</td>
                  <td className="py-1 text-text-primary">
                    <div className="font-bold">{r.action_type}</div>
                    <div className="text-text-muted truncate max-w-md">
                      {r.action_description}
                    </div>
                  </td>
                  <td className="py-1 text-text-muted truncate">
                    {r.target_table ?? '—'}
                  </td>
                  <td className="py-1 text-text-faint">{shortHash(r.prev_hash)}</td>
                  <td className="py-1 text-text-faint">{shortHash(r.content_hash)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="text-xs font-mono text-text-muted">no audit entries</div>
      )}
    </section>
  );
}
