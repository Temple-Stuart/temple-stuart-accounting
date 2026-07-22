'use client';

// MOD-1 rider: the /modules segment error boundary. Next requires error
// boundaries to be client components. Before this file existed, any server
// throw on these public marketing pages fell through to Next's raw default
// crash page (the MOD-0 finding — no error.tsx anywhere in the app tree).
// Honest copy, no theater; token-native (bg-panel family, zero new hex),
// minimally mirroring the landing chrome.

import { useEffect } from 'react';
import Link from 'next/link';

export default function ModulesError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Fail-loud: the real error goes to the console (and Next's server log),
    // never swallowed behind the friendly copy.
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-panel text-white">
      <div className="max-w-md px-4 text-center">
        <p className="mb-2 font-mono text-[10px] font-semibold uppercase tracking-wider text-white/50">
          Modules
        </p>
        <h1 className="text-2xl font-light tracking-tight">This page hit an error.</h1>
        <p className="mt-2 text-xs text-white/60">
          The rest of the site is fine — head back and try again.
        </p>
        <div className="mt-6 flex items-center justify-center gap-3">
          <Link
            href="/"
            className="bg-white px-6 py-2 text-xs font-medium text-brand-purple hover:bg-bg-row"
          >
            Back to the site
          </Link>
          <button
            type="button"
            onClick={reset}
            className="border border-white/30 px-6 py-2 text-xs font-medium text-white hover:bg-white/10"
          >
            Try again
          </button>
        </div>
      </div>
    </div>
  );
}
