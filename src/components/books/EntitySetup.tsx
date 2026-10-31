'use client';

/**
 * SELL-04 — ENTITY SETUP, the first-run step in Books (not silent). The
 * user chooses personal, sole proprietorship, or both, names them, and the
 * one creator (POST /api/entities) makes each with its starter chart. Kinds
 * come from src/lib/entities/kinds.ts — the two the routes can read — and
 * the step says why there is no LLC / S-corp choice (UNSUPPORTED_ENTITY_LINE).
 *
 * Two mounts: `first-run` (no entity yet — Books' pipeline and the chart page)
 * and `add` (entities exist, no business one — the chart page; the Answers'
 * "set up your business entity" door lands here). Every failure renders the
 * route's own words; nothing is swallowed, nothing is created on failure.
 */

import { useState } from 'react';
import { ENTITY_KINDS, UNSUPPORTED_ENTITY_LINE, type EntityKindType } from '@/lib/entities/kinds';

interface Existing { id: string; name: string; entity_type: string }

export default function EntitySetup({ existing, mode, onCreated }: { existing: readonly Existing[]; mode: 'first-run' | 'add'; onCreated: () => void }) {
  const kinds = mode === 'add' ? ENTITY_KINDS.filter((k) => !existing.some((e) => e.entity_type === k.type)) : ENTITY_KINDS;
  const [chosen, setChosen] = useState<Record<EntityKindType, boolean>>({ personal: mode === 'first-run', sole_prop: true });
  const [names, setNames] = useState<Record<EntityKindType, string>>({ personal: ENTITY_KINDS[0].defaultName, sole_prop: ENTITY_KINDS[1].defaultName });
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<EntityKindType, string>>>({});
  const [made, setMade] = useState<string[]>([]);

  const selected = kinds.filter((k) => chosen[k.type]);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selected.length === 0) return;
    setBusy(true);
    setErrors({});
    const done: string[] = [];
    const failed: Partial<Record<EntityKindType, string>> = {};
    for (const k of selected) {
      const res = await fetch('/api/entities', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: names[k.type], entity_type: k.type }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { failed[k.type] = typeof data?.error === 'string' ? data.error : `HTTP ${res.status}`; continue; }
      done.push(`${data.entity?.name ?? names[k.type]} — ${k.letter}- chart, ${data.chart?.created ?? '?'} accounts${data.chart?.mappings ? `, ${data.chart.mappings} Schedule C lines` : ''}`);
    }
    setMade(done);
    setErrors(failed);
    setBusy(false);
    if (done.length > 0 && Object.keys(failed).length === 0) onCreated();
  };

  return (
    <form onSubmit={create} className="rounded-lg border border-brand-purple/30 bg-white p-4 space-y-3" data-entity-setup={mode}>
      <div>
        <p className="font-mono text-[10px] font-semibold uppercase tracking-wider text-brand-purple">{mode === 'first-run' ? 'First run · set up your entity' : 'Add your business entity'}</p>
        <p className="mt-1 text-xs text-text-muted">
          {mode === 'first-run'
            ? 'Books keeps one chart per entity. Choose what you keep books for and name it — nothing is created until you say so.'
            : 'The Tax and Business answers read a sole proprietorship — its B- chart with the Schedule C lines.'}
        </p>
      </div>
      <ul className="space-y-2">
        {kinds.map((k) => (
          <li key={k.type} className="flex flex-wrap items-start gap-3 rounded border border-border p-3" data-entity-kind={k.type}>
            <label className="flex items-center gap-2 text-sm text-text-primary">
              <input type="checkbox" checked={chosen[k.type]} onChange={(e) => setChosen((c) => ({ ...c, [k.type]: e.target.checked }))} />
              <span className="font-medium">{k.label}</span>
              <span className="font-mono text-[10px] uppercase tracking-wider text-text-faint">{k.letter}- chart</span>
            </label>
            <input
              type="text"
              value={names[k.type]}
              onChange={(e) => setNames((n) => ({ ...n, [k.type]: e.target.value }))}
              disabled={!chosen[k.type]}
              maxLength={100}
              aria-label={`${k.label} name`}
              className="min-w-[200px] flex-1 border border-border px-2 py-1 text-sm text-text-primary disabled:opacity-50"
              data-entity-name={k.type}
            />
            <p className="basis-full text-[11px] text-text-muted">{k.what}</p>
            {errors[k.type] && <p role="alert" className="basis-full text-xs text-brand-red" data-entity-error={k.type}>{errors[k.type]}</p>}
          </li>
        ))}
      </ul>
      <p className="text-[11px] text-text-faint" data-entity-unsupported>{UNSUPPORTED_ENTITY_LINE}</p>
      {made.length > 0 && (
        <ul className="text-xs text-emerald-700" data-entity-made>
          {made.map((m) => <li key={m}>Created {m}.</li>)}
        </ul>
      )}
      <button type="submit" disabled={busy || selected.length === 0} className="bg-brand-purple px-4 py-2 text-sm font-medium text-white hover:bg-brand-purple-hover disabled:opacity-50" data-entity-create>
        {busy ? 'Creating…' : selected.length === 1 ? `Create ${selected[0].label}` : `Create ${selected.length} entities`}
      </button>
    </form>
  );
}
