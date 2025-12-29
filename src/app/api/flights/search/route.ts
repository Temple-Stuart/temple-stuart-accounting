import { NextRequest, NextResponse } from 'next/server';
import { searchFlights, parseOffer } from '@/lib/duffel';

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;

    const origin = params.get('origin');
    const destination = params.get('destination');
    const departureDate = params.get('departureDate');
    const returnDate = params.get('returnDate');
    const passengers = parseInt(params.get('passengers') || '1');
    const cabinClass = params.get('cabinClass') as any || 'economy';

    if (!origin || !destination || !departureDate) {
      return NextResponse.json(
        { error: 'Missing required params: origin, destination, departureDate' },
        { status: 400 }
      );
    }

    console.log(`[Duffel] Searching: ${origin} → ${destination}, ${departureDate}${returnDate ? ` - ${returnDate}` : ''}, ${passengers} pax`);

    const result = await searchFlights({
      origin,
      destination,
      departureDate,
      returnDate: returnDate || undefined,
      passengers,
      cabinClass,
    });

    // Parse offers for UI
    const offers = (result.offers || []).map(parseOffer);

    // Sort by price, then by duration
    offers.sort((a: any, b: any) => {
      if (a.price !== b.price) return a.price - b.price;
      return (a.outbound?.durationMinutes || 999) - (b.outbound?.durationMinutes || 999);
    });

    // Return top 10
    return NextResponse.json({
      offers: offers.slice(0, 10),
      offerRequestId: result.id,
      count: offers.length,
    });

  } catch (error) {
    console.error('Flight search error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Flight search failed' },
      { status: 500 }
    );
  }
}
