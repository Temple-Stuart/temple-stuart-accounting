'use client';

import AppLayout from '@/components/ui/AppLayout';
import OperationsIdentityBar from '@/components/workbench/operations/IdentityBar';
import { OperationsEntityProvider } from '@/components/workbench/operations/EntitySelector';

/**
 * ROOM-02: the SubNav is GONE from this layout. Its six tabs (Daily Plan,
 * Projects, Routines, Content, Issue Log, Audit Tail) are the room's six
 * phases now, and the ratified Pipe Frame holds ONE phase control, never two —
 * the StageStrip inside page.tsx is it. The layout keeps what is genuinely
 * chrome: the one shell, the entity provider the workbench sections read, and
 * the identity bar. /operations/issues and /operations/audit-log render under
 * this layout too and lose the sub-nav with it; both keep their door through
 * /operations (the rail's step 12), and the audit tail is phase 06's source.
 */

export default function OperationsLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppLayout>
      <OperationsEntityProvider>
        <OperationsIdentityBar />
        <div className="max-w-[1600px] mx-auto px-6 py-4 space-y-3">{children}</div>
      </OperationsEntityProvider>
    </AppLayout>
  );
}
