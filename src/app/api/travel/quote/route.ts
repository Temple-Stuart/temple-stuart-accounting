import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { searchFlights } from '@/lib/amadeus';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const userEmail = cookieStore.get('userEmail')?.value;
    if (!userEmail) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    
    const resortId = searchParams.get('resortId');
    const originAirport = searchParams.get('origin');
    const departureDate = searchParams.get('departureDate');
    const returnDate = searchParams.get('returnDate');
    const travelers = parseInt(searchParams.get('travelers') || '4');

    if (!resortId || !originAirport || !departureDate || !returnDate) {
      return NextResponse.json(
        { error: 'Missing required params: resortId, origin, departureDate, returnDate' },
        { status: 400 }
      );
    }

    const resort = await prisma.ikon_resorts.findUnique({
      where: { id: resortId }
    });

    if (!resort) {
      return NextResponse.json({ error: 'Resort not found' }, { status: 404 });
    }

    const destinationAirport = resort.nearestAirport;
    if (!destinationAirport) {
      return NextResponse.json({ error: 'Resort has no airport configured' }, { status: 400 });
    }

    let flightQuote = null;
    try {
      const flights = await searchFlights({
        originLocationCode: originAirport,
        destinationLocationCode: destinationAirport,
        departureDate,
        returnDate,
        adults: 1,
        max: 3,
      });

      if (flights.length > 0) {
        const prices = flights.map(f => parseFloat(f.price.total));
        flightQuote = {
          lowest: Math.min(...prices),
          average: prices.reduce((a, b) => a + b, 0) / prices.length,
          highest: Math.max(...prices),
        };
      }
    } catch (e) {
      console.error('Flight search failed:', e);
    }

    const checkIn = new Date(departureDate);
    const checkOut = new Date(returnDate);
    const nights = Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24));

    return NextResponse.json({
      resort: {
        id: resort.id,
        name: resort.name,
        airport: destinationAirport,
      },
      origin: originAirport,
      dates: { departure: departureDate, return: returnDate, nights },
      travelers,
      quotes: {
        flight: flightQuote,
        liftTicket: resort.liftTicketMulti ? parseFloat(resort.liftTicketMulti.toString()) : null,
        equipment: (resort.rentalBoardDay && resort.rentalBootsDay) 
          ? parseFloat(resort.rentalBoardDay.toString()) + parseFloat(resort.rentalBootsDay.toString())
          : null,
      },
    });
  } catch (error) {
    console.error('Quote error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Quote failed' },
      { status: 500 }
    );
  }
}
