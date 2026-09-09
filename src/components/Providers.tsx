'use client';

import { SessionProvider } from 'next-auth/react';
// ACCOUNTS-01: the rail's open/collapsed state lives above the pages, so walking the
// steps never resets it. React state only — no browser storage.
import { RailStateProvider } from '@/components/shell/RailState';

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <RailStateProvider>{children}</RailStateProvider>
    </SessionProvider>
  );
}
