import { Metadata } from 'next';
import { prisma } from '@/lib/prisma';

const MONTHS = ['', 'January', 'February', 'March', 'April', 'May', 'June',
                'July', 'August', 'September', 'October', 'November', 'December'];

const ACTIVITIES: Record<string, string> = {
  surf: '🏄 Surf Trip', kitesurf: '🪁 Kite Trip', sail: '⛵ Sailing Trip',
  snowboard: '🏂 Snowboard Trip', mtb: '🚵 MTB Trip', hike: '🏕️ Hiking Trip',
  climb: '🧗 Climbing Trip', golf: '⛳ Golf Trip', bike: '🚴 Cycling Trip',
  run: '🏃 Running Trip', triathlon: '🏊 Triathlon Trip', skate: '🛹 Skate Trip',
  festival: '🎪 Festival Trip', conference: '🎤 Conference Trip', nomad: '💼 Workation',
};

type Props = {
  children: React.ReactNode;
  searchParams: Promise<{ token?: string }>;
};

export async function generateMetadata({ searchParams }: { searchParams: Promise<{ token?: string }> }): Promise<Metadata> {
  const params = await searchParams;
  const token = params.token;

  if (!token) {
    return {
      title: 'Trip Invitation | Temple Stuart',
      description: 'You have been invited to join a trip!',
    };
  }

  try {
    const trip = await prisma.trips.findFirst({
      where: { inviteToken: token },
      select: {
        name: true,
        destination: true,
        activity: true,
        month: true,
        year: true,
        ogImage: true,
        owner: { select: { name: true } }
      }
    });

    if (!trip) {
      return {
        title: 'Trip Invitation | Temple Stuart',
        description: 'You have been invited to join a trip!',
      };
    }

    const activityLabel = trip.activity ? ACTIVITIES[trip.activity] || 'Trip' : 'Trip';
    const monthName = MONTHS[trip.month];
    const description = `${trip.owner.name} invited you to ${trip.name}${trip.destination ? ` in ${trip.destination}` : ''} - ${monthName} ${trip.year}`;

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://temple-stuart-accounting.vercel.app';
    
    // Build OG image URL with trip details
    const ogParams = new URLSearchParams({
      name: trip.name,
      destination: trip.destination || '',
      activity: trip.activity || '',
      month: trip.month.toString(),
      year: trip.year.toString(),
      owner: trip.owner.name || '',
    });
    
    const ogImageUrl = trip.ogImage || `${baseUrl}/api/og?${ogParams.toString()}`;

    return {
      title: `${trip.name} | Temple Stuart`,
      description,
      openGraph: {
        title: trip.name,
        description,
        type: 'website',
        images: [{ url: ogImageUrl, width: 1200, height: 630, alt: trip.name }],
      },
      twitter: {
        card: 'summary_large_image',
        title: trip.name,
        description,
        images: [ogImageUrl],
      },
    };
  } catch (error) {
    console.error('Error generating metadata:', error);
    return {
      title: 'Trip Invitation | Temple Stuart',
      description: 'You have been invited to join a trip!',
    };
  }
}

export default function RSVPLayout({ children }: Props) {
  return <>{children}</>;
}
