'use client';

/**
 * NAV-01b → SHELL-02: the ONE menu behind the shell bar. Two sections:
 *
 *   ACCOUNT — Pricing, Contact, Export my data, Manage subscription. These moved
 *   here when HomeClient's marketing header was deleted (SHELL-02). They render
 *   for EVERY signed-in viewer, not just an admin: the export must reach every
 *   authed user and billing must reach every subscriber (the two rationales the
 *   old header carried verbatim at HomeClient.tsx:57-63 and :171-179). Putting
 *   them behind the admin gate would have hidden billing from every customer.
 *
 *   OWNER UTILITIES — src/lib/shellMenu.ts, admin only, as before.
 *
 * A plain <details> so it needs no state and works before hydration. Errors from
 * the two actions render inside the menu — fail-loud, never an alert().
 */
import { useState } from 'react';
import Link from 'next/link';
import { OWNER_UTILITIES } from '@/lib/shellMenu';
import { useExportDownload } from '@/lib/useExportDownload';

const ITEM = 'block w-full rounded px-3 py-2 text-left text-xs text-text-primary hover:bg-bg-row disabled:opacity-60';

export default function UtilitiesMenu({ isAdmin = false }: { isAdmin?: boolean }) {
  // EXPORT-1b: the same hook the old header used — one copy of the behaviour.
  const { busy: exportBusy, error: exportError, run: runExport } = useExportDownload();
  // PR-PRICE-3: the Stripe billing portal, moved from the deleted header verbatim.
  const [manageBusy, setManageBusy] = useState(false);
  const [manageError, setManageError] = useState('');
  const openBillingPortal = async () => {
    setManageError('');
    setManageBusy(true);
    try {
      const res = await fetch('/api/stripe/portal', { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.url) throw new Error(data.error || 'Could not open the billing portal');
      window.location.href = data.url;
    } catch (err) {
      setManageError(err instanceof Error ? err.message : 'Could not open the billing portal');
      setManageBusy(false);
    }
  };

  return (
    <details className="relative" data-utilities-menu>
      <summary className="cursor-pointer list-none text-xs text-text-muted hover:text-text-primary select-none">
        Utilities ▾
      </summary>
      <ul className="absolute right-0 z-40 mt-2 w-64 rounded-lg border border-border bg-white p-1 shadow-sm">
        <li className="px-3 pb-1 pt-2 font-mono text-[9px] uppercase tracking-wider text-text-faint">Account</li>
        <li>
          <Link href="/how-pricing-works" className={ITEM}>Pricing</Link>
        </li>
        <li>
          <a href="mailto:astuart@templestuart.com" className={ITEM}>Contact</a>
        </li>
        <li>
          <button
            type="button" onClick={runExport} disabled={exportBusy} className={ITEM}
            title="Download every financial + travel table you own — one CSV per table, zipped. Never paywalled."
          >
            {exportBusy ? 'Preparing export…' : 'Export my data'}
          </button>
          {exportError && (
            <p role="alert" className="px-3 pb-1 text-[10px] text-rose-600">{exportError}</p>
          )}
        </li>
        <li>
          <button
            type="button" onClick={openBillingPortal} disabled={manageBusy} className={ITEM}
            title="Open the Stripe billing portal — view, update, or cancel your subscriptions."
          >
            {manageBusy ? 'Opening portal…' : 'Manage subscription'}
          </button>
          {manageError && (
            <p role="alert" className="px-3 pb-1 text-[10px] text-rose-600">{manageError}</p>
          )}
        </li>
        {isAdmin && (
          <>
            <li className="mt-1 border-t border-border px-3 pb-1 pt-2 font-mono text-[9px] uppercase tracking-wider text-text-faint">Owner</li>
            {OWNER_UTILITIES.map((u) => (
              <li key={u.href}>
                <Link href={u.href} title={u.why} className={ITEM}>{u.label}</Link>
              </li>
            ))}
          </>
        )}
      </ul>
    </details>
  );
}
