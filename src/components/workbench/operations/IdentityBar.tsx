'use client';

import { useEffect, useState } from 'react';
import EntitySelectorStrip from './EntitySelector';

const BUILD_SHA = (process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ?? 'dev').slice(0, 8);

const REFRESH_INTERVAL_MS = 15_000;
const MAX_CONSECUTIVE_FAILURES = 3;

export default function OperationsIdentityBar() {
  const [auditTailHash, setAuditTailHash] = useState<string | null>(null);
  const [tailError, setTailError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let intervalId: ReturnType<typeof setInterval> | null = null;
    let consecutiveFailures = 0;

    const fetchTail = async () => {
      try {
        const res = await fetch('/api/audit-log?prefix=operations_&limit=1');
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        if (cancelled) return;
        const body = await res.json();
        const tail = body?.rows?.[0]?.content_hash ?? null;
        setAuditTailHash(tail ? String(tail).slice(0, 8) : null);
        setTailError(null);
        consecutiveFailures = 0;
      } catch (err) {
        if (cancelled) return;
        consecutiveFailures += 1;
        if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
          setTailError('tail unavailable');
          if (intervalId !== null) {
            clearInterval(intervalId);
            intervalId = null;
          }
          // Surfaced to the bar; no silent infinite retry.
          // eslint-disable-next-line no-console
          console.warn('[OperationsIdentityBar] tail fetch failed 3x; halting poll');
        }
      }
    };

    fetchTail();
    intervalId = setInterval(fetchTail, REFRESH_INTERVAL_MS);

    return () => {
      cancelled = true;
      if (intervalId !== null) clearInterval(intervalId);
    };
  }, []);

  return (
    <div className="sticky top-0 z-30 bg-white border-b border-border shadow-sm">
      <div className="max-w-[1600px] mx-auto px-4 py-2 flex items-center justify-between text-xs font-mono text-text-secondary">
        <div className="flex items-center gap-4">
          <span className="font-bold text-text-primary tracking-wide">OPERATIONS</span>
          <span>build:{BUILD_SHA}</span>
          {auditTailHash && (
            <span title="Operations audit log tail hash (last 8 chars of latest content_hash, filtered to operations_*)">
              tail:{auditTailHash}
            </span>
          )}
          {tailError && (
            <span className="text-amber-700" title="audit-log tail fetch failed; poll halted after 3 failures">
              tail: {tailError}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <EntitySelectorStrip />
        </div>
      </div>
    </div>
  );
}
