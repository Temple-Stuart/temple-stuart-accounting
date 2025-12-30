import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';

// COA codes for trip expenses (Personal entity)
const TRIP_COA_CODES: Record<string, string> = {
  flight: 'P-7100',        // Flights
  hotel: 'P-7200',         // Lodging
  car: 'P-7300',           // Rental Car
  groundTransport: 'P-7600', // Ground Transport
  activities: 'P-7400',    // Activities & Tickets
  equipment: 'P-7500',     // Equipment Rental
  meals: 'P-7700',         // Travel Meals
  tips: 'P-7800',          // Tips & Misc
};

// Free geocoding using OpenStreetMap Nominatim
async function geocodeDestination(destination: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(destination)}&limit=1`,
      {
        headers: {
          'User-Agent': 'TempleStuartOS/1.0'
        }
      }
    );
    const data = await response.json();
    if (data && data[0]) {
      return {
        lat: parseFloat(data[0].lat),
        lng: parseFloat(data[0].lon)
      };
    }
    return null;
  } catch (error) {
    console.error('Geocoding error:', error);
    return null;
  }
}

interface BudgetItem {
  category: string;
  amount: number;
  description?: string;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const cookieStore = await cookies();
    const userEmail = cookieStore.get('userEmail')?.value;

    if (!userEmail) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.users.findFirst({
      where: { email: { equals: userEmail, mode: 'insensitive' } }
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const trip = await prisma.trips.findUnique({
      where: { id },
      include: { destinations: true }
    });

    if (!trip || trip.userId !== user.id) {
      return NextResponse.json({ error: 'Trip not found' }, { status: 404 });
    }

    const body = await request.json();
    const { startDay, budgetItems } = body as { startDay: number; budgetItems?: BudgetItem[] };

    if (!startDay) {
      return NextResponse.json({ error: 'Start day required' }, { status: 400 });
    }

    // Calculate actual dates
    const startDate = new Date(trip.year, trip.month - 1, startDay);
    const endDate = new Date(trip.year, trip.month - 1, startDay + trip.daysTravel - 1);

    // Geocode destination if available
    let latitude = null;
    let longitude = null;
    if (trip.destination) {
      const coords = await geocodeDestination(trip.destination);
      if (coords) {
        latitude = coords.lat;
        longitude = coords.lng;
      }
    }

    // Delete existing budget_line_items for this trip (in case of re-commit)
    await prisma.budget_line_items.deleteMany({
      where: { tripId: id }
    });

    // Create budget_line_items for each expense
    if (budgetItems && budgetItems.length > 0) {
      const lineItems = budgetItems
        .filter(item => item.amount > 0)
        .map(item => ({
          userId: user.id,
          tripId: id,
          coaCode: TRIP_COA_CODES[item.category] || 'P-6800',
          year: trip.year,
          month: trip.month,
          amount: item.amount,
          description: item.description || `${trip.name} - ${item.category}`,
          source: 'trip',
        }));

      if (lineItems.length > 0) {
        await prisma.budget_line_items.createMany({
          data: lineItems
        });
      }

      // Update aggregate budgets table
      // Group by COA code and sum amounts
      const coaSums: Record<string, number> = {};
      for (const item of lineItems) {
        coaSums[item.coaCode] = (coaSums[item.coaCode] || 0) + item.amount;
      }

      // Upsert budget records for each COA code
      const monthKey = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'][trip.month - 1];
      
      for (const [coaCode, amount] of Object.entries(coaSums)) {
        // Get existing budget or create new one
        const existing = await prisma.budgets.findUnique({
          where: {
            userId_accountCode_year: {
              userId: user.id,
              accountCode: coaCode,
              year: trip.year
            }
          }
        });

        const currentAmount = existing ? Number(existing[monthKey as keyof typeof existing] || 0) : 0;
        const newAmount = currentAmount + amount;

        await prisma.budgets.upsert({
          where: {
            userId_accountCode_year: {
              userId: user.id,
              accountCode: coaCode,
              year: trip.year
            }
          },
          update: {
            [monthKey]: newAmount
          },
          create: {
            userId: user.id,
            accountCode: coaCode,
            year: trip.year,
            [monthKey]: amount
          }
        });
      }
    }

    const updatedTrip = await prisma.trips.update({
      where: { id },
      data: {
        startDate,
        endDate,
        committedAt: new Date(),
        status: 'confirmed',
        latitude,
        longitude,
      }
    });

    return NextResponse.json({ 
      success: true, 
      trip: {
        ...updatedTrip,
        latitude: updatedTrip.latitude?.toString(),
        longitude: updatedTrip.longitude?.toString(),
      },
      budgetItemsCreated: budgetItems?.filter(i => i.amount > 0).length || 0
    });
  } catch (error) {
    console.error('Commit trip error:', error);
    return NextResponse.json({ error: 'Failed to commit trip' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const cookieStore = await cookies();
    const userEmail = cookieStore.get('userEmail')?.value;

    if (!userEmail) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.users.findFirst({
      where: { email: { equals: userEmail, mode: 'insensitive' } }
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const trip = await prisma.trips.findUnique({ where: { id } });

    if (!trip || trip.userId !== user.id) {
      return NextResponse.json({ error: 'Trip not found' }, { status: 404 });
    }

    // Get budget_line_items to reverse the amounts
    const lineItems = await prisma.budget_line_items.findMany({
      where: { tripId: id }
    });

    // Reverse the budget amounts
    if (lineItems.length > 0) {
      const monthKey = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'][trip.month - 1];
      
      // Group by COA code
      const coaSums: Record<string, number> = {};
      for (const item of lineItems) {
        coaSums[item.coaCode] = (coaSums[item.coaCode] || 0) + Number(item.amount);
      }

      // Subtract from budgets
      for (const [coaCode, amount] of Object.entries(coaSums)) {
        const existing = await prisma.budgets.findUnique({
          where: {
            userId_accountCode_year: {
              userId: user.id,
              accountCode: coaCode,
              year: trip.year
            }
          }
        });

        if (existing) {
          const currentAmount = Number(existing[monthKey as keyof typeof existing] || 0);
          const newAmount = Math.max(0, currentAmount - amount);

          await prisma.budgets.update({
            where: {
              userId_accountCode_year: {
                userId: user.id,
                accountCode: coaCode,
                year: trip.year
              }
            },
            data: {
              [monthKey]: newAmount
            }
          });
        }
      }

      // Delete budget_line_items
      await prisma.budget_line_items.deleteMany({
        where: { tripId: id }
      });
    }

    const updatedTrip = await prisma.trips.update({
      where: { id },
      data: {
        startDate: null,
        endDate: null,
        committedAt: null,
        status: 'planning',
        latitude: null,
        longitude: null,
      }
    });

    return NextResponse.json({ success: true, trip: updatedTrip });
  } catch (error) {
    console.error('Uncommit trip error:', error);
    return NextResponse.json({ error: 'Failed to uncommit trip' }, { status: 500 });
  }
}
