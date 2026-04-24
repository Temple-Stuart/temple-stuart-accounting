'use client';

import AppLayout from '@/components/ui/AppLayout';
import OpsSubNav from '@/components/ops/OpsSubNav';
import OperationsPlanner from '@/components/ops/OperationsPlanner';

export default function OpsPage() {
  return (
    <AppLayout>
      <OpsSubNav />
      <OperationsPlanner />
    </AppLayout>
  );
}
