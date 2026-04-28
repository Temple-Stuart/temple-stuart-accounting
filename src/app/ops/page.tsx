'use client';

import AppLayout from '@/components/ui/AppLayout';
import OpsSubNav from '@/components/ops/OpsSubNav';
import DailyDashboard from '@/components/ops/DailyDashboard';

export default function OpsPage() {
  return (
    <AppLayout>
      <OpsSubNav />
      <DailyDashboard />
    </AppLayout>
  );
}
