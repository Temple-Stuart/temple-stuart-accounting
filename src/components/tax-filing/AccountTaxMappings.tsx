'use client';

import { useState, useEffect, useCallback } from 'react';

// ═══════════════════════════════════════════════════════════════════
// AccountTaxMappings — assign COA accounts to Schedule C lines.
//
// Self-contained component. Fetches accounts + current mappings from
// /api/account-tax-mappings, renders a table, auto-saves on dropdown
// change. Scoped to a single tax form (Schedule C) for this PR.
// ═══════════════════════════════════════════════════════════════════

// IRS Schedule C line labels — mirror of src/lib/schedule-c-service.ts LINE_LABELS.
// Key = raw line code as stored in account_tax_mappings.form_line WITHOUT the
// "line_" prefix. We prepend "line_" when writing to the DB to match the
// existing storage convention from seed-entities.ts:parseTaxFormLine.
const SCHEDULE_C_LINES: Array<{ code: string; label: string; defaultMultiplier: number }> = [
  { code: '8', label: 'Advertising', defaultMultiplier: 1.0 },
  { code: '9', label: 'Car and truck expenses', defaultMultiplier: 1.0 },
  { code: '10', label: 'Commissions and fees', defaultMultiplier: 1.0 },
  { code: '11', label: 'Contract labor', defaultMultiplier: 1.0 },
  { code: '12', label: 'Depletion', defaultMultiplier: 1.0 },
  { code: '13', label: 'Depreciation and section 179', defaultMultiplier: 1.0 },
  { code: '14', label: 'Employee benefit programs', defaultMultiplier: 1.0 },
  { code: '15', label: 'Insurance (other than health)', defaultMultiplier: 1.0 },
  { code: '16a', label: 'Interest (mortgage paid to banks)', defaultMultiplier: 1.0 },
  { code: '16b', label: 'Interest (other)', defaultMultiplier: 1.0 },
  { code: '17', label: 'Legal and professional services', defaultMultiplier: 1.0 },
  { code: '18', label: 'Office expense', defaultMultiplier: 1.0 },
  { code: '19', label: 'Pension and profit-sharing plans', defaultMultiplier: 1.0 },
  { code: '20a', label: 'Rent (vehicles, machinery, equipment)', defaultMultiplier: 1.0 },
  { code: '20b', label: 'Rent (other business property)', defaultMultiplier: 1.0 },
  { code: '21', label: 'Repairs and maintenance', defaultMultiplier: 1.0 },
  { code: '22', label: 'Supplies', defaultMultiplier: 1.0 },
  { code: '23', label: 'Taxes and licenses', defaultMultiplier: 1.0 },
  { code: '24a', label: 'Travel', defaultMultiplier: 1.0 },
  { code: '24b', label: 'Deductible meals (50%)', defaultMultiplier: 0.5 },
  { code: '25', label: 'Utilities', defaultMultiplier: 1.0 },
  { code: '26', label: 'Wages', defaultMultiplier: 1.0 },
  { code: '27a', label: 'Other expenses', defaultMultiplier: 1.0 },
];

const UNMAPPED_VALUE = '__unmapped__';

// ─── Types ─────────────────────────────────────────────────────────

interface AccountWithMapping {
  id: string;
  code: string;
  name: string;
  accountType: string;
  entityId: string;
  entityName: string | null;
  mapping: {
    id: string;
    tax_form: string;
    form_line: string; // "line_18"
    tax_year: number;
    multiplier: number;
  } | null;
}

interface ApiResponse {
  year: number;
  tax_form: string;
  entity_id: string | null;
  accounts: AccountWithMapping[];
}

interface EntityOption {
  id: string;
  name: string;
  entity_type: string;
}

interface Props {
  taxYear: number;
  defaultEntityId?: string | null; // if known (e.g., Business entity for Schedule C)
}

// ─── Helpers ───────────────────────────────────────────────────────

function lineCodeFromFormLine(formLine: string | null | undefined): string {
  if (!formLine) return UNMAPPED_VALUE;
  return formLine.replace(/^line_/, '');
}

function formLineFromCode(code: string): string {
  return `line_${code}`;
}

function defaultMultiplierForLine(code: string): number {
  return SCHEDULE_C_LINES.find((l) => l.code === code)?.defaultMultiplier ?? 1.0;
}

// ─── Component ─────────────────────────────────────────────────────

export default function AccountTaxMappings({
  taxYear,
  defaultEntityId,
}: Props) {
  const [entities, setEntities] = useState<EntityOption[]>([]);
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(
    defaultEntityId ?? null
  );
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Per-account save state: 'idle' | 'saving' | 'saved' | 'error:msg'
  const [rowStatus, setRowStatus] = useState<Record<string, string>>({});
  // Editable multiplier draft state per account, keyed by account id
  const [multDrafts, setMultDrafts] = useState<Record<string, string>>({});

  // Load entity list on mount (so the user can switch entity scope)
  const loadEntities = useCallback(async () => {
    try {
      const res = await fetch('/api/entities');
      if (!res.ok) return;
      const { entities: list } = (await res.json()) as {
        entities: EntityOption[];
      };
      setEntities(list);
      // Prefer sole_prop (Business) entity as default for Schedule C mappings
      if (!selectedEntityId) {
        const soleProp = list.find((e) => e.entity_type === 'sole_prop');
        if (soleProp) setSelectedEntityId(soleProp.id);
      }
    } catch {
      /* non-fatal — user can still proceed */
    }
  }, [selectedEntityId]);

  const loadMappings = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams({
        year: String(taxYear),
        tax_form: 'schedule_c',
      });
      if (selectedEntityId) qs.set('entity_id', selectedEntityId);
      const res = await fetch(`/api/account-tax-mappings?${qs.toString()}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      const json = (await res.json()) as ApiResponse;
      setData(json);
      // Seed multiplier drafts from current data
      const drafts: Record<string, string> = {};
      for (const a of json.accounts) {
        drafts[a.id] = a.mapping ? String(a.mapping.multiplier) : '1.00';
      }
      setMultDrafts(drafts);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load mappings');
    } finally {
      setLoading(false);
    }
  }, [taxYear, selectedEntityId]);

  useEffect(() => {
    loadEntities();
  }, [loadEntities]);

  useEffect(() => {
    if (selectedEntityId) loadMappings();
  }, [loadMappings, selectedEntityId]);

  const markStatus = (accountId: string, status: string) => {
    setRowStatus((prev) => ({ ...prev, [accountId]: status }));
    if (status === 'saved') {
      setTimeout(() => {
        setRowStatus((prev) => {
          if (prev[accountId] !== 'saved') return prev;
          const next = { ...prev };
          delete next[accountId];
          return next;
        });
      }, 2500);
    }
  };

  // Save (upsert) a mapping for an account at the given Schedule C line.
  const saveMapping = async (
    account: AccountWithMapping,
    lineCode: string,
    multiplierOverride?: number
  ) => {
    markStatus(account.id, 'saving');
    const multiplier =
      multiplierOverride != null
        ? multiplierOverride
        : defaultMultiplierForLine(lineCode);
    try {
      const res = await fetch('/api/account-tax-mappings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          account_id: account.id,
          tax_form: 'schedule_c',
          form_line: formLineFromCode(lineCode),
          tax_year: taxYear,
          multiplier,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      const { mapping } = (await res.json()) as {
        mapping: {
          id: string;
          account_id: string;
          tax_form: string;
          form_line: string;
          tax_year: number;
          multiplier: number;
        };
      };
      setData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          accounts: prev.accounts.map((a) =>
            a.id === account.id ? { ...a, mapping } : a
          ),
        };
      });
      setMultDrafts((prev) => ({ ...prev, [account.id]: String(mapping.multiplier) }));
      markStatus(account.id, 'saved');
    } catch (e) {
      markStatus(
        account.id,
        `error:${e instanceof Error ? e.message : 'Save failed'}`
      );
    }
  };

  // Remove a mapping (used when user picks "Unmapped").
  const removeMapping = async (account: AccountWithMapping) => {
    if (!account.mapping) return;
    markStatus(account.id, 'saving');
    try {
      const res = await fetch('/api/account-tax-mappings', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: account.mapping.id }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      setData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          accounts: prev.accounts.map((a) =>
            a.id === account.id ? { ...a, mapping: null } : a
          ),
        };
      });
      setMultDrafts((prev) => ({ ...prev, [account.id]: '1.00' }));
      markStatus(account.id, 'saved');
    } catch (e) {
      markStatus(
        account.id,
        `error:${e instanceof Error ? e.message : 'Delete failed'}`
      );
    }
  };

  const onLineChange = (account: AccountWithMapping, newValue: string) => {
    if (newValue === UNMAPPED_VALUE) {
      void removeMapping(account);
    } else {
      void saveMapping(account, newValue);
    }
  };

  const onMultiplierCommit = (account: AccountWithMapping) => {
    if (!account.mapping) return;
    const draft = multDrafts[account.id];
    const parsed = parseFloat(draft);
    if (isNaN(parsed) || parsed <= 0 || parsed > 10) {
      markStatus(account.id, 'error:Multiplier must be between 0 and 10');
      return;
    }
    if (parsed === account.mapping.multiplier) return; // no change
    const currentLine = lineCodeFromFormLine(account.mapping.form_line);
    void saveMapping(account, currentLine, parsed);
  };

  // ─── Render ──────────────────────────────────────────────────────

  const expenseAccounts = (data?.accounts ?? []).filter(
    (a) => a.accountType === 'expense'
  );
  const unmappedCount = expenseAccounts.filter((a) => !a.mapping).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">
            Schedule C tax mappings
          </h3>
          <p className="text-xs text-gray-500">
            Assign each business expense account to a Schedule C line.
            Mappings are per tax year — changes here affect your{' '}
            <strong>{taxYear}</strong> Schedule C only.
          </p>
        </div>
        {entities.length > 1 && (
          <div className="shrink-0">
            <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">
              Entity
            </label>
            <select
              value={selectedEntityId ?? ''}
              onChange={(e) => setSelectedEntityId(e.target.value || null)}
              className="px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              {entities.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name} ({e.entity_type})
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {loading && (
        <div className="px-3 py-2 text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded">
          Loading accounts and mappings…
        </div>
      )}

      {error && (
        <div className="px-3 py-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded">
          {error}
          <button
            type="button"
            onClick={loadMappings}
            className="ml-2 underline hover:no-underline"
          >
            Retry
          </button>
        </div>
      )}

      {!loading && data && expenseAccounts.length === 0 && (
        <div className="px-3 py-2 text-xs text-gray-600 bg-gray-50 border border-gray-200 rounded">
          No expense accounts found for this entity.
        </div>
      )}

      {!loading && data && expenseAccounts.length > 0 && (
        <>
          {unmappedCount > 0 && (
            <div className="px-3 py-2 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded">
              {unmappedCount} account{unmappedCount === 1 ? '' : 's'} currently
              unmapped — they will default to <strong>Line 27a (Other
              expenses)</strong> on Schedule C until you assign them.
            </div>
          )}

          <div className="border border-gray-200 rounded-lg bg-white overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                  <th className="text-left px-3 py-2">Code</th>
                  <th className="text-left px-3 py-2">Account name</th>
                  <th className="text-left px-3 py-2 hidden sm:table-cell">Type</th>
                  <th className="text-left px-3 py-2">Schedule C line</th>
                  <th className="text-right px-3 py-2">Multiplier</th>
                  <th className="text-right px-3 py-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {expenseAccounts.map((acct) => {
                  const currentCode = acct.mapping
                    ? lineCodeFromFormLine(acct.mapping.form_line)
                    : UNMAPPED_VALUE;
                  const status = rowStatus[acct.id];
                  const isUnmapped = !acct.mapping;
                  return (
                    <tr
                      key={acct.id}
                      className={isUnmapped ? 'bg-amber-50/40' : ''}
                    >
                      <td className="px-3 py-2 font-mono text-xs text-gray-700">
                        {acct.code}
                      </td>
                      <td className="px-3 py-2 text-gray-900">{acct.name}</td>
                      <td className="px-3 py-2 text-xs text-gray-500 hidden sm:table-cell capitalize">
                        {acct.accountType}
                      </td>
                      <td className="px-3 py-2">
                        <select
                          value={currentCode}
                          onChange={(e) => onLineChange(acct, e.target.value)}
                          className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                        >
                          <option value={UNMAPPED_VALUE}>
                            — Unmapped (Line 27a default) —
                          </option>
                          {SCHEDULE_C_LINES.map((l) => (
                            <option key={l.code} value={l.code}>
                              Line {l.code} — {l.label}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-3 py-2 text-right">
                        <input
                          type="number"
                          step="0.01"
                          min="0.01"
                          max="10"
                          value={multDrafts[acct.id] ?? ''}
                          disabled={!acct.mapping}
                          onChange={(e) =>
                            setMultDrafts((prev) => ({
                              ...prev,
                              [acct.id]: e.target.value,
                            }))
                          }
                          onBlur={() => onMultiplierCommit(acct)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              (e.target as HTMLInputElement).blur();
                            }
                          }}
                          className="w-16 px-1.5 py-0.5 text-xs text-right font-mono border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-400"
                        />
                      </td>
                      <td className="px-3 py-2 text-right text-xs">
                        {status === 'saving' && (
                          <span className="text-gray-500">saving…</span>
                        )}
                        {status === 'saved' && (
                          <span className="text-emerald-700 font-semibold">
                            ✓ saved
                          </span>
                        )}
                        {status?.startsWith('error:') && (
                          <span className="text-red-600" title={status.slice(6)}>
                            ✗ error
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      <p className="text-[11px] text-gray-400 italic">
        Multiplier defaults to 1.00 for everything, 0.50 for Deductible meals
        (Line 24b). Adjust only when the account contains amounts already
        netted or when the IRS rule differs.
      </p>
    </div>
  );
}
