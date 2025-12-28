import { Metadata } from 'next';
import { prisma } from '@/lib/prisma';
import RSVPClient from './RSVPClient';

const MONTHS = ['', 'January', 'February', 'March', 'April', 'May', 'June',
                'July', 'August', 'September', 'October', 'November', 'December'];

type Props = {
  searchParams: Promise<{ token?: string }>;
};

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
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

    const monthName = MONTHS[trip.month];
    const description = `${trip.owner.name} invited you to ${trip.name}${trip.destination ? ` in ${trip.destination}` : ''} - ${monthName} ${trip.year}`;

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://temple-stuart-accounting.vercel.app';
    
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

export default function RSVPPage() {
  return <RSVPClient />;
}
