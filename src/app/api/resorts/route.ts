import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const resorts = await prisma.ikon_resorts.findMany({
      orderBy: [
        { country: 'asc' },
        { region: 'asc' },
        { name: 'asc' }
      ]
    });

    // Group by country/region for easier UI rendering
    const grouped: Record<string, Record<string, typeof resorts>> = {};
    
    for (const resort of resorts) {
      if (!grouped[resort.country]) {
        grouped[resort.country] = {};
      }
      if (!grouped[resort.country][resort.region]) {
        grouped[resort.country][resort.region] = [];
      }
      grouped[resort.country][resort.region].push(resort);
    }

    return NextResponse.json({ resorts, grouped });
  } catch (error) {
    console.error('Get resorts error:', error);
    return NextResponse.json({ error: 'Failed to fetch resorts' }, { status: 500 });
  }
}
