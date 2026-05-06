'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';

const OPS_TABS = [
  { name: 'Daily Plan', href: '/compliance', exact: true },
  { name: 'Profile', href: '/compliance/profile', exact: true },
  { name: 'Discovery', href: '/compliance/discovery', exact: false },
  { name: 'Registry', href: '/compliance/registry', exact: false },
  { name: 'Citations', href: '/compliance/citations', exact: false },
  { name: 'Audit Log', href: '/compliance/audit-log', exact: false },
  { name: 'Missions', href: '/compliance/missions', exact: false },
  { name: 'Bookkeeping', href: '', disabled: true },
  { name: 'Trading', href: '', disabled: true },
  { name: 'Travel', href: '', disabled: true },
  { name: 'Operations', href: '', disabled: true },
];

export default function OpsSubNav() {
  const pathname = usePathname();

  const isActive = (tab: (typeof OPS_TABS)[number]) => {
    if (tab.disabled) return false;
    if (tab.exact) return pathname === tab.href;
    return pathname?.startsWith(tab.href);
  };

  return (
    <div className="border-b border-border bg-white">
      <div className="max-w-6xl mx-auto px-4">
        <nav className="flex items-center gap-1 -mb-px">
          {OPS_TABS.map((tab) => {
            const active = isActive(tab);
            if (tab.disabled) {
              return (
                <span key={tab.name} className="px-3 py-2 text-terminal-sm font-mono text-text-faint cursor-default">
                  {tab.name}
                </span>
              );
            }
            return (
              <Link
                key={tab.name}
                href={tab.href}
                className={`px-3 py-2 text-terminal-sm font-mono transition-colors border-b-2 ${
                  active
                    ? 'border-brand-purple text-brand-purple font-medium'
                    : 'border-transparent text-text-muted hover:text-text-primary hover:border-border'
                }`}
              >
                {tab.name}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
