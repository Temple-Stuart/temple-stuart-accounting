'use client';

import AppLayout from '@/components/ui/AppLayout';
import DailyDashboard from '@/components/ops/DailyDashboard';

export default function OpsPage() {
  return (
    <AppLayout>
      <DailyDashboard />
    </AppLayout>
  );
}
