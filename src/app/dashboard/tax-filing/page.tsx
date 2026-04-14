import TaxFilingWizard from '@/components/tax-filing/TaxFilingWizard';

export const metadata = {
  title: 'File your taxes — Temple Stuart',
};

// Server-rendered shell. The wizard itself is a client component so it can
// manage step state and fetch auto-detection data on mount.
export default function TaxFilingPage() {
  return <TaxFilingWizard />;
}
