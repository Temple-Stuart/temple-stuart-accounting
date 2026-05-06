'use client';

import { useEffect, useState } from 'react';
import EntitySelectorStrip from './EntitySelector';

const BUILD_SHA = (process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ?? 'dev').slice(0, 8);

export default function OperationsIdentityBar() {
  const [auditTailHash, setAuditTailHash] = useState<string | null>(null);

  useEffect(() => {
    const fetchTail = async () => {
      try {
        const res = await fetch('/api/audit-log?prefix=operations_&limit=1');
        if (res.ok) {
          const body = await res.json();
          const tail = body?.rows?.[0]?.content_hash ?? null;
          setAuditTailHash(tail ? String(tail).slice(0, 8) : null);
        }
      } catch {
        // silent — bar still renders without tail
      }
    };
    fetchTail();
    const id = setInterval(fetchTail, 15000);
    return () => clearInterval(id);
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
        </div>
        <div className="flex items-center gap-3">
          <EntitySelectorStrip />
        </div>
      </div>
    </div>
  );
}
