import { AppLayout } from '@/components/ui';
import TaxFilingWizard from '@/components/tax-filing/TaxFilingWizard';
import RoomLock from '@/components/shell/RoomLock';
import { roomGate } from '@/lib/roomGate';

export const metadata = {
  title: 'File your taxes — Temple Stuart',
};

// LOCK-01 — THE LEAK, CLOSED. This page mounted the FULL filing wizard with no
// entitlement check at all: an account holding nothing saw TAX · LOCKED in the
// rail and got the whole wizard at this URL. It now asks the same question the
// Tax tab asks — roomGate → hasTabAccess('tab:tax') — before rendering, and a
// refused viewer gets the room LOCKED (RoomLock), not a redirect and not a pitch.
//
// TAX-1: AppLayout chrome lives HERE (the wizard is bare and reusable on the
// homepage Tax tab). The render is unchanged for an entitled viewer.
export const dynamic = 'force-dynamic';

export default async function TaxFilingPage() {
  const { locked } = await roomGate('tab:tax');
  return (
    <AppLayout>
      <RoomLock locked={locked} stepName="Tax">
        <TaxFilingWizard />
      </RoomLock>
    </AppLayout>
  );
}
