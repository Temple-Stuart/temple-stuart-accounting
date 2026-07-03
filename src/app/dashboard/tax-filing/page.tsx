import { AppLayout } from '@/components/ui';
import TaxFilingWizard from '@/components/tax-filing/TaxFilingWizard';

export const metadata = {
  title: 'File your taxes — Temple Stuart',
};

// Server-rendered shell. The wizard itself is a client component so it can
// manage step state and fetch auto-detection data on mount.
// TAX-1: AppLayout chrome now lives HERE (moved out of TaxFilingWizard so the wizard is
// bare and reusable on the homepage Tax tab). Render is identical to before — the same
// <AppLayout> wraps the same wizard content.
export default function TaxFilingPage() {
  return (
    <AppLayout>
      <TaxFilingWizard />
    </AppLayout>
  );
}
