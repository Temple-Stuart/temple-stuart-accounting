import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const year = parseInt(searchParams.get('year') || new Date().getFullYear().toString());
    
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

    // Get trip budget line items grouped by COA and month
    const items = await prisma.budget_line_items.findMany({
      where: {
        userId: user.id,
        year: year,
        source: 'trip'
      },
      include: {
        trip: {
          select: { name: true, destination: true, startDate: true }
        }
      }
    });

    // COA code to name mapping
    const COA_NAMES: Record<string, string> = {
      'P-7100': '✈️ Flight',
      'P-7200': '🏨 Lodging',
      'P-7300': '🚗 Transportation',
      'P-7400': '🎟️ Activities',
      'P-7500': '🎿 Equipment',
      'P-7600': '🚕 Ground Transport',
      'P-7700': '🍽️ Food & Dining',
      'P-7800': '💵 Tips & Misc',
      'P-8220': '💼 Business Dev',
    };

    // Aggregate by COA and month
    const monthlyData: Record<string, Record<number, number>> = {};
    let grandTotal = 0;

    for (const item of items) {
      const coa = item.coaCode || 'P-7800';
      const month = item.month - 1; // 0-indexed
      const amount = Number(item.amount || 0);

      if (!monthlyData[coa]) {
        monthlyData[coa] = {};
      }
      monthlyData[coa][month] = (monthlyData[coa][month] || 0) + amount;
      grandTotal += amount;
    }

    return NextResponse.json({ year, monthlyData, coaNames: COA_NAMES, grandTotal });
  } catch (error) {
    console.error('Nomad budget error:', error);
    return NextResponse.json({ error: 'Failed to fetch budget' }, { status: 500 });
  }
}
