'use client';

import { useEffect } from 'react';
import { SessionProvider } from 'next-auth/react';

function AuthGuard({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
      const res = await originalFetch(...args);
      if (res.status === 401) {
        const url = typeof args[0] === 'string' ? args[0] : (args[0] as Request).url;
        // Only redirect for our API routes, not external calls or auth endpoints
        if (url.startsWith('/api/') && !url.startsWith('/api/auth/')) {
          window.location.href = '/';
        }
      }
      return res;
    };
    return () => { window.fetch = originalFetch; };
  }, []);

  return <>{children}</>;
}

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <AuthGuard>{children}</AuthGuard>
    </SessionProvider>
  );
}
