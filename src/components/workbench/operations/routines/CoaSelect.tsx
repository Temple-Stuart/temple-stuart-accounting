'use client';

/**
 * CoaSelect (HB-4b) — a self-fetching chart-of-accounts picker, mirroring the project-task COA
 * select (TaskRowView.tsx:473-490). Scoped to ONE entity: it fetches
 * /api/chart-of-accounts?entity_id={entityId} and lists "CODE — Name" options. The VALUE is the
 * BARE code (e.g. "B-9200") — never code+name (the column is VarChar(50), code only).
 *
 * Empty selection → "" (the caller maps "" → null on submit: no default account). If the current
 * value isn't in the fetched list (archived / out-of-entity), it's still surfaced with a ⚠ so the
 * user is never silently re-categorized — same guard as the task picker.
 */

import { useEffect, useState } from 'react';

interface CoaAccount {
  code: string;
  name: string;
}

interface Props {
  /** The routine's entity — scopes the COA list. '' → no options (empty entity). */
  entityId: string;
  /** The bare COA code currently selected ('' = none). */
  value: string;
  /** Receives the bare code ('' when cleared). */
  onChange: (code: string) => void;
  className?: string;
}

export default function CoaSelect({ entityId, value, onChange, className }: Props) {
  const [accounts, setAccounts] = useState<CoaAccount[]>([]);

  useEffect(() => {
    if (!entityId) { setAccounts([]); return; }
    let cancelled = false;
    fetch(`/api/chart-of-accounts?entity_id=${encodeURIComponent(entityId)}`)
      .then((r) => (r.ok ? r.json() : { accounts: [] }))
      .then((d: { accounts?: { code: string; name: string }[] }) => {
        if (cancelled) return;
        setAccounts((d.accounts || []).map((a) => ({ code: a.code, name: a.name })));
      })
      .catch(() => { if (!cancelled) setAccounts([]); });
    return () => { cancelled = true; };
  }, [entityId]);

  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className={className}>
      <option value="">— None —</option>
      {/* Surface an out-of-list current code so saving never silently drops it. */}
      {value !== '' && !accounts.some((a) => a.code === value) && (
        <option value={value}>{value} ⚠ (not in current COA)</option>
      )}
      {accounts.map((a) => (
        <option key={a.code} value={a.code}>
          {a.code} — {a.name}
        </option>
      ))}
    </select>
  );
}
