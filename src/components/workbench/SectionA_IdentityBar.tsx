/**
 * src/components/workbench/SectionA_IdentityBar.tsx
 *
 * Sticky top bar of the institutional workbench. Always visible while
 * scrolling. Shows identity, entity context, build SHA, audit tail hash.
 *
 * Reference: docs/architecture/discovery-engine-institutional-grade.md § 6.2 A
 */

'use client';

import { useEffect, useState } from 'react';

interface IdentityBarData {
  user_email: string | null;
  current_entity_name: string | null;
  build_sha: string;
  audit_tail_hash: string | null;
}

const BUILD_SHA = (process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ?? 'dev').slice(0, 8);

export function SectionA_IdentityBar() {
  const [data, setData] = useState<IdentityBarData>({
    user_email: null,
    current_entity_name: null,
    build_sha: BUILD_SHA,
    audit_tail_hash: null,
  });

  useEffect(() => {
    const fetchTail = async () => {
      try {
        const res = await fetch('/api/audit-log?limit=1');
        if (res.ok) {
          const body = await res.json();
          const tail = body?.rows?.[0]?.content_hash ?? null;
          setData((d) => ({
            ...d,
            audit_tail_hash: tail ? String(tail).slice(0, 8) : null,
          }));
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
          <span className="font-bold text-text-primary tracking-wide">WORKBENCH</span>
          <span>build:{data.build_sha}</span>
          {data.audit_tail_hash && (
            <span title="Audit log tail hash (last 8 chars of latest content_hash)">
              tail:{data.audit_tail_hash}
            </span>
          )}
        </div>
        <div className="flex items-center gap-4">
          <span>entity: {data.current_entity_name ?? '—'}</span>
          <span>{data.user_email ?? ''}</span>
        </div>
      </div>
    </div>
  );
}
