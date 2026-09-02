'use client';

/**
 * NAV-01b: the header/profile utilities menu — the ONE door to the owner
 * utility pages (src/lib/shellMenu.ts). Rendered only for an admin viewer; a
 * plain <details> so it needs no state and works before hydration.
 */
import Link from 'next/link';
import { OWNER_UTILITIES } from '@/lib/shellMenu';

export default function UtilitiesMenu() {
  return (
    <details className="relative">
      <summary className="cursor-pointer list-none text-xs text-text-muted hover:text-text-primary select-none">
        Utilities ▾
      </summary>
      <ul className="absolute right-0 z-40 mt-2 w-64 rounded-lg border border-border bg-white p-1 shadow-sm">
        {OWNER_UTILITIES.map((u) => (
          <li key={u.href}>
            <Link href={u.href} title={u.why} className="block rounded px-3 py-2 text-xs text-text-primary hover:bg-bg-row">
              {u.label}
            </Link>
          </li>
        ))}
      </ul>
    </details>
  );
}
