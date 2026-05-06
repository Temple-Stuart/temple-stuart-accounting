'use client';

import AppLayout from '@/components/ui/AppLayout';
import OperationsIdentityBar from '@/components/workbench/operations/IdentityBar';
import SubNav, { type SubNavTab } from '@/components/workbench/operations/SubNav';
import { OperationsEntityProvider } from '@/components/workbench/operations/EntitySelector';

const OPERATIONS_TABS: SubNavTab[] = [
  { label: 'Daily Plan', href: '/operations', exact: true },
  { label: 'Projects', href: '/operations/projects' },
  { label: 'Routines', href: '/operations/routines' },
  { label: 'Roadmap', href: '/operations/roadmap' },
  { label: 'Content', href: '/operations/content' },
  { label: 'Travel', href: '/operations/travel' },
  { label: 'Money', href: '/operations/money' },
  { label: 'Issue Log', href: '/operations/issues' },
  { label: 'Audit Tail', href: '/operations/audit-log' },
];

export default function OperationsLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppLayout>
      <OperationsEntityProvider>
        <OperationsIdentityBar />
        <SubNav tabs={OPERATIONS_TABS} />
        <div className="max-w-[1600px] mx-auto px-6 py-4 space-y-3">{children}</div>
      </OperationsEntityProvider>
    </AppLayout>
  );
}
