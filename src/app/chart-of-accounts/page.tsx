'use client';

import { useEffect, useState } from 'react';
import { AppLayout } from '@/components/ui';
import BookkeepingSection from '@/components/bookkeeping/BookkeepingSection';
import COAManagementTable from '@/components/bookkeeping/COAManagementTable';
import { FAMILIES, FAMILY_RULES, letterFor } from '@/lib/coa/scheme';

/**
 * /chart-of-accounts — COA-01: THE chart of accounts page (the registry's
 * Bookkeeping link, src/lib/toolRegistry.ts). One management table per
 * entity — add, rename, retire / restore, reclassify, the ruled seed sets —
 * with the entity's REAL type driving its code letter. Reads /api/entities
 * (user-scoped) and, per entity, the two chart routes the table calls.
 * Every failure renders as the server's own words; nothing is swallowed.
 */

interface Entity {
  id: string;
  name: string;
  entity_type: string;
  is_default: boolean;
}

const TYPE_ORDER: Record<string, number> = { personal: 0, sole_prop: 1, trading: 2 };

export default function ChartOfAccountsPage() {
  const [entities, setEntities] = useState<Entity[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/entities')
      .then(async (res) => {
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(typeof data?.error === 'string' ? data.error : `entities: HTTP ${res.status}`);
        }
        const data = await res.json();
        const list: Entity[] = (data.entities || []).slice().sort((a: Entity, b: Entity) => {
          if (a.is_default !== b.is_default) return a.is_default ? -1 : 1;
          return (TYPE_ORDER[a.entity_type] ?? 9) - (TYPE_ORDER[b.entity_type] ?? 9) || a.name.localeCompare(b.name);
        });
        if (!cancelled) setEntities(list);
      })
      .catch((err: Error) => { if (!cancelled) setError(err.message); });
    return () => { cancelled = true; };
  }, []);

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto px-4 py-3 space-y-3" data-coa-page>
        <div className="py-2">
          <p className="font-mono text-[10px] font-semibold uppercase tracking-wider text-text-faint">Books · the chart</p>
          <h1 className="text-xl font-medium tracking-tight text-text-primary">Chart of accounts</h1>
          <p className="mt-1 text-xs text-text-muted font-mono" data-scheme-line>
            {FAMILIES.map((f) => `${String(FAMILY_RULES[f].from)[0]}xxx ${FAMILY_RULES[f].label.toLowerCase()} ${FAMILY_RULES[f].from}–${FAMILY_RULES[f].to}`).join(' · ')} · the letter is the entity&apos;s (P personal · B business · T trading)
          </p>
        </div>

        {error && (
          <div className="text-sm text-red-500" role="alert">Failed to load entities: {error}</div>
        )}
        {!error && entities === null && (
          <div className="flex justify-center py-6">
            <div className="w-5 h-5 border-2 border-brand-purple border-t-transparent rounded-full animate-spin" />
          </div>
        )}
        {entities !== null && entities.length === 0 && (
          <div className="text-sm text-text-muted">No entity yet — open Books once and the Personal entity is created with the default chart.</div>
        )}
        {entities?.map((entity) => {
          const letter = letterFor(entity.entity_type);
          return (
            <BookkeepingSection
              key={entity.id}
              title={`${entity.name} — ${letter ? `${letter}- chart` : entity.entity_type}`}
              pipelineKey="COA"
              subtitle={entity.entity_type}
              status="complete"
            >
              <div className="p-3">
                <COAManagementTable entityId={entity.id} entityName={entity.name} entityType={entity.entity_type} />
              </div>
            </BookkeepingSection>
          );
        })}
      </div>
    </AppLayout>
  );
}
