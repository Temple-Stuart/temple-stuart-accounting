import { NextResponse } from 'next/server';
import { getVerifiedEmail } from '@/lib/cookie-auth';
import { getGoogleUsage } from '@/lib/googlePlacesQuota';

// Simple usage view for the Google Places monthly bill guard. Lets the user see
// current call count vs the cap (GOOGLE_PLACES_MONTHLY_CAP) for this month.
export async function GET() {
  const userEmail = await getVerifiedEmail();
  if (!userEmail) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const usage = await getGoogleUsage();
  return NextResponse.json(usage);
}
