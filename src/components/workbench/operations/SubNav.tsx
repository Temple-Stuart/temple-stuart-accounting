'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { themed, type Surface } from '@/lib/ds';

export type SubNavTab = {
  label: string;
  href: string;
  exact?: boolean;
  disabled?: boolean;
};

export default function SubNav({ surface = 'light', tabs }: { surface?: Surface; tabs: SubNavTab[] }) {
  const dk = surface === 'dark';
  const pathname = usePathname();

  const isActive = (tab: SubNavTab): boolean => {
    if (tab.disabled) return false;
    if (tab.exact) return pathname === tab.href;
    return pathname?.startsWith(tab.href) ?? false;
  };

  return (
    <div className={themed('border-b border-border bg-white', dk)}>
      <div className="max-w-[1600px] mx-auto px-4">
        <nav className="flex items-center gap-1 -mb-px">
          {tabs.map((tab) => {
            if (tab.disabled) {
              return (
                <span
                  key={tab.label}
                  className={themed('px-3 py-2 text-terminal-sm font-mono text-text-faint cursor-default', dk)}
                >
                  {tab.label}
                </span>
              );
            }
            const active = isActive(tab);
            return (
              <Link
                key={tab.label}
                href={tab.href}
                className={
                  active
                    ? 'px-3 py-2 text-terminal-sm font-mono transition-colors border-b-2 border-brand-purple text-brand-purple font-medium'
                    : themed('px-3 py-2 text-terminal-sm font-mono transition-colors border-b-2 border-transparent text-text-muted hover:text-text-primary hover:border-border', dk)
                }
              >
                {tab.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
