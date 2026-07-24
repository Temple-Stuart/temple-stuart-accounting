/**
 * src/components/workbench/SectionB_FounderProfile.tsx
 *
 * Compact summary of the founder profile (entities, jurisdictions,
 * income types, key dates). Read-only here; full editing lives at
 * /compliance/profile.
 */

'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { themed, type Surface } from '@/lib/ds';

interface ProfileSummary {
  primary_entity_name: string | null;
  jurisdictions: string[];
  income_types: string[];
  entity_count: number;
}

export function SectionB_FounderProfile({ surface = 'light' }: { surface?: Surface } = {}) {
  const dk = surface === 'dark';
  const [profile, setProfile] = useState<ProfileSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await fetch('/api/profile');
        if (res.ok) {
          const body = await res.json();
          setProfile({
            primary_entity_name: body?.primary_entity_name ?? null,
            jurisdictions: body?.jurisdictions ?? [],
            income_types: body?.income_types ?? [],
            entity_count: body?.entity_count ?? 0,
          });
        }
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, []);

  return (
    <section className={themed('bg-white rounded border border-border shadow-sm p-5', dk)}>
      <div className="flex items-center justify-between mb-3">
        <h2 className={themed('font-mono text-sm font-bold tracking-wide text-text-primary', dk)}>
          B · FOUNDER PROFILE
        </h2>
        <Link
          href="/compliance/profile"
          className="text-xs font-mono text-brand-purple hover:underline"
        >
          edit →
        </Link>
      </div>

      {loading ? (
        <div className={themed('text-xs font-mono text-text-muted', dk)}>loading…</div>
      ) : profile ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs font-mono">
          <KeyValue dk={dk} label="primary entity" value={profile.primary_entity_name ?? '—'} />
          <KeyValue dk={dk} label="entities" value={String(profile.entity_count)} />
          <KeyValue dk={dk}
            label="jurisdictions"
            value={profile.jurisdictions.length ? profile.jurisdictions.join(', ') : '—'}
          />
          <KeyValue dk={dk}
            label="income types"
            value={profile.income_types.length ? profile.income_types.join(', ') : '—'}
          />
        </div>
      ) : (
        <div className={themed('text-xs font-mono text-text-muted', dk)}>profile not yet configured</div>
      )}
    </section>
  );
}

function KeyValue({ dk = false, label, value }: { dk?: boolean; label: string; value: string }) {
  return (
    <div>
      <div className={themed('text-text-faint uppercase tracking-wide mb-1', dk)}>{label}</div>
      <div className={themed('text-text-primary truncate', dk)}>{value}</div>
    </div>
  );
}
