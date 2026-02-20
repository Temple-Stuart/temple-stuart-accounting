import { NextRequest, NextResponse } from 'next/server';
import { searchFlights } from '@/lib/amadeus';
import { getCurrentUser } from '@/lib/auth-helpers';

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const searchParams = request.nextUrl.searchParams;
    
    const origin = searchParams.get('origin');
    const destination = searchParams.get('destination');
    const departureDate = searchParams.get('departureDate');
    const returnDate = searchParams.get('returnDate');
    const adults = searchParams.get('adults') || '1';

    if (!origin || !destination || !departureDate) {
      return NextResponse.json(
        { error: 'Missing required params: origin, destination, departureDate' },
        { status: 400 }
      );
    }

    const flights = await searchFlights({
      originLocationCode: origin,
      destinationLocationCode: destination,
      departureDate,
      returnDate: returnDate || undefined,
      adults: parseInt(adults),
      max: 20, // Fetch more to filter down to best 5
    });

    // Parse duration string "PT6H30M" to minutes
    const parseDuration = (dur: string): number => {
      const match = dur?.match(/PT(?:(\d+)H)?(?:(\d+)M)?/);
      if (!match) return 9999;
      return (parseInt(match[1] || '0') * 60) + parseInt(match[2] || '0');
    };

    // Parse and enrich flight data
    const enriched = flights.map(f => {
      const outbound = f.itineraries[0];
      const returnFlight = f.itineraries[1];
      
      const outboundDeparture = outbound?.segments[0]?.departure;
      const outboundArrival = outbound?.segments[outbound.segments.length - 1]?.arrival;
      const returnDeparture = returnFlight?.segments[0]?.departure;
      const returnArrival = returnFlight?.segments[returnFlight.segments.length - 1]?.arrival;

      const outboundMinutes = outbound ? parseDuration(outbound.duration) : 9999;
      const outboundStops = outbound ? outbound.segments.length - 1 : 99;

      return {
        id: f.id,
        price: parseFloat(f.price.total),
        currency: f.price.currency,
        
        outbound: outbound ? {
          duration: outbound.duration,
          durationMinutes: outboundMinutes,
          durationFormatted: `${Math.floor(outboundMinutes / 60)}h ${outboundMinutes % 60}m`,
          stops: outboundStops,
          segments: outbound.segments.map(s => ({
            carrier: s.carrierCode,
            flightNumber: `${s.carrierCode}${s.number}`,
            departure: {
              airport: s.departure.iataCode,
              time: s.departure.at,
              localTime: s.departure.at?.split('T')[1]?.slice(0, 5),
            },
            arrival: {
              airport: s.arrival.iataCode,
              time: s.arrival.at,
              localTime: s.arrival.at?.split('T')[1]?.slice(0, 5),
            },
          })),
          departure: {
            airport: outboundDeparture?.iataCode,
            time: outboundDeparture?.at,
            localTime: outboundDeparture?.at?.split('T')[1]?.slice(0, 5),
            date: outboundDeparture?.at?.split('T')[0],
          },
          arrival: {
            airport: outboundArrival?.iataCode,
            time: outboundArrival?.at,
            localTime: outboundArrival?.at?.split('T')[1]?.slice(0, 5),
            date: outboundArrival?.at?.split('T')[0],
          },
          carriers: [...new Set(outbound.segments.map(s => s.carrierCode))],
        } : null,

        return: returnFlight ? {
          duration: returnFlight.duration,
          durationMinutes: parseDuration(returnFlight.duration),
          durationFormatted: `${Math.floor(parseDuration(returnFlight.duration) / 60)}h ${parseDuration(returnFlight.duration) % 60}m`,
          stops: returnFlight.segments.length - 1,
          segments: returnFlight.segments.map(s => ({
            carrier: s.carrierCode,
            flightNumber: `${s.carrierCode}${s.number}`,
            departure: {
              airport: s.departure.iataCode,
              time: s.departure.at,
              localTime: s.departure.at?.split('T')[1]?.slice(0, 5),
            },
            arrival: {
              airport: s.arrival.iataCode,
              time: s.arrival.at,
              localTime: s.arrival.at?.split('T')[1]?.slice(0, 5),
            },
          })),
          departure: {
            airport: returnDeparture?.iataCode,
            time: returnDeparture?.at,
            localTime: returnDeparture?.at?.split('T')[1]?.slice(0, 5),
            date: returnDeparture?.at?.split('T')[0],
          },
          arrival: {
            airport: returnArrival?.iataCode,
            time: returnArrival?.at,
            localTime: returnArrival?.at?.split('T')[1]?.slice(0, 5),
            date: returnArrival?.at?.split('T')[0],
          },
          carriers: [...new Set(returnFlight.segments.map(s => s.carrierCode))],
        } : null,

        // Sorting factors
        _outboundStops: outboundStops,
        _outboundMinutes: outboundMinutes,
      };
    });

    // Sort: Non-stop first, then by shortest duration
    const sorted = [...enriched].sort((a, b) => {
      // 1. Non-stop flights first (0 stops beats any number of stops)
      if (a._outboundStops === 0 && b._outboundStops > 0) return -1;
      if (b._outboundStops === 0 && a._outboundStops > 0) return 1;
      
      // 2. Fewer stops is better
      if (a._outboundStops !== b._outboundStops) {
        return a._outboundStops - b._outboundStops;
      }
      
      // 3. Shortest duration wins
      return a._outboundMinutes - b._outboundMinutes;
    });

    // Return top 5, remove internal sorting fields
    const results = sorted.slice(0, 5).map(({ _outboundStops, _outboundMinutes, ...rest }) => rest);

    return NextResponse.json({ 
      flights: results,
      query: {
        origin,
        destination,
        departureDate,
        returnDate,
      }
    });
  } catch (error) {
    console.error('Flight search error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Flight search failed' },
      { status: 500 }
    );
  }
}
