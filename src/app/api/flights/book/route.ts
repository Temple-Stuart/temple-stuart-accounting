import { NextRequest, NextResponse } from 'next/server';
import { getOffer, createOrder, PassengerDetails } from '@/lib/duffel';
import { getCurrentUser } from '@/lib/auth-helpers';

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { offerId, passengers } = body;

    if (!offerId || !passengers || passengers.length === 0) {
      return NextResponse.json(
        { error: 'Missing offerId or passengers' },
        { status: 400 }
      );
    }

    const offer = await getOffer(offerId);

    const mappedPassengers: PassengerDetails[] = offer.passengers.map((offerPax: any, idx: number) => {
      const paxDetails = passengers[idx];
      return {
        id: offerPax.id,
        title: paxDetails.title || 'mr',
        given_name: paxDetails.given_name || paxDetails.firstName,
        family_name: paxDetails.family_name || paxDetails.lastName,
        born_on: paxDetails.born_on || paxDetails.dateOfBirth,
        email: paxDetails.email,
        phone_number: paxDetails.phone_number || paxDetails.phone,
        gender: paxDetails.gender || 'm',
      };
    });

    const order = await createOrder(offerId, mappedPassengers, {
      type: 'balance',
      amount: offer.total_amount,
      currency: offer.total_currency,
    });

    return NextResponse.json({
      success: true,
      order: {
        id: order.id,
        bookingReference: order.booking_reference,
        status: order.status,
        totalAmount: order.total_amount,
        totalCurrency: order.total_currency,
        passengers: order.passengers,
        slices: order.slices,
      },
    });

  } catch (error) {
    console.error('Booking error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Booking failed' },
      { status: 500 }
    );
  }
}
