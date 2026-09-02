'use client';

/**
 * NAV-01b: the slim top bar of the AppLayout shell — the Sidebar's replacement.
 * ONE map: the brand link returns to the cockpit (the family navigation), the
 * utilities menu is the door to the owner pages, and sign-out stays. No second
 * set of module links: the families are the navigation (NAV-01a).
 */
import Link from 'next/link';
import { LogOut } from 'lucide-react';
import UtilitiesMenu from './UtilitiesMenu';

interface Props {
  userLabel: string;
  isAdmin: boolean;
  onSignOut: () => void;
}

export default function ShellBar({ userLabel, isAdmin, onSignOut }: Props) {
  return (
    <header className="border-b border-border bg-white">
      <div className="max-w-[1800px] mx-auto flex h-12 items-center justify-between px-4 lg:px-6">
        <Link href="/" className="flex items-center gap-2" title="Back to the map">
          <span className="text-brand-purple font-bold text-sm">TS</span>
          <span className="text-sm font-semibold tracking-tight text-text-primary">Temple Stuart</span>
          <span className="hidden sm:inline font-mono text-[10px] uppercase tracking-wider text-text-faint">← the map</span>
        </Link>
        <div className="flex items-center gap-4">
          {isAdmin && <UtilitiesMenu />}
          {userLabel && <span className="hidden sm:block text-xs text-text-muted truncate max-w-[12rem]">{userLabel}</span>}
          <button type="button" onClick={onSignOut} className="flex items-center gap-1.5 text-xs text-text-muted hover:text-text-primary" title="Sign out">
            <LogOut className="h-4 w-4" aria-hidden="true" />
            Sign out
          </button>
        </div>
      </div>
    </header>
  );
}
