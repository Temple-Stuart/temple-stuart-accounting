'use client';

/**
 * NAV-02 → SHELL-01: the ONE shell for an off-cockpit app page — ShellBar + THE
 * RAIL (the steps, in link mode) beside the page's main column. The /answers shape
 * (AnswersClient.tsx, which keeps its own copy by ruling — THE ANSWERS stays
 * as is): the utilities menu is admin-only, read from /api/auth/me; a failed
 * profile read is declared under the bar (no menu, the failure printed), never
 * swallowed, never retried. Sign-out is the app's one recipe.
 */
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import ShellBar from './ShellBar';
import Rail from '@/components/shell/Rail';

export default function ShellFrame({ viewer, children }: { viewer: string; children: React.ReactNode }) {
  const router = useRouter();
  const { data: session } = useSession();
  const [isAdmin, setIsAdmin] = useState(false);
  // SHELL-01: the same read already made for the utilities menu carries the viewer's
  // entitlement keys, so the rail's lock chip costs no second request. Undefined until
  // it lands — the rail draws no chip on a guess.
  const [entitledKeys, setEntitledKeys] = useState<string[] | undefined>(undefined);
  const [profileError, setProfileError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const res = await fetch('/api/auth/me', { cache: 'no-store' });
        if (!res.ok) {
          let detail = '';
          try {
            const body = (await res.json()) as { error?: unknown };
            if (typeof body.error === 'string') detail = body.error;
          } catch {
            detail = 'no error body';
          }
          if (live) setProfileError(`HTTP ${res.status}${detail ? ` · ${detail}` : ''}`);
          return;
        }
        const body = (await res.json()) as { user?: { isAdmin?: boolean; entitledCategories?: string[] } };
        if (live) {
          setIsAdmin(Boolean(body.user?.isAdmin));
          setEntitledKeys(body.user?.entitledCategories ?? []);
        }
      } catch (e) {
        if (live) setProfileError(`network — ${e instanceof Error ? e.message : String(e)}`);
      }
    })();
    return () => { live = false; };
  }, []);

  const handleSignOut = async () => {
    document.cookie = 'userEmail=; path=/; max-age=0';
    if (session) {
      await signOut({ callbackUrl: '/' });
    } else {
      await fetch('/api/auth/logout', { method: 'POST' });
      router.push('/');
    }
  };

  return (
    <div className="min-h-screen bg-bg-terminal flex flex-col">
      <ShellBar userLabel={viewer.split('@')[0]} isAdmin={isAdmin} onSignOut={handleSignOut} />
      <div className="flex flex-1 flex-col sm:flex-row">
        <Rail entitledKeys={entitledKeys} isAdmin={isAdmin} />
        <main className="max-w-7xl mx-auto w-full min-w-0 px-4 lg:px-8 py-6 sm:py-8">
          {profileError && (
            <p role="alert" className="mb-4 font-mono text-[10px] text-rose-700">Profile read failed — {profileError}. Utilities hidden.</p>
          )}
          {children}
        </main>
      </div>
    </div>
  );
}
