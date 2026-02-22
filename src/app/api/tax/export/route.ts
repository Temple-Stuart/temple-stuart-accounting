import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getVerifiedEmail } from '@/lib/cookie-auth';
import { generateForm8949, generateForm8949CSV } from '@/lib/tax-report-service';

/**
 * GET /api/tax/export?year=2025&format=8949
 * Downloads a CSV file matching TurboTax Form 8949 import format.
 */
export async function GET(request: NextRequest) {
  try {
    const userEmail = await getVerifiedEmail();
    if (!userEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await prisma.users.findFirst({
      where: { email: { equals: userEmail, mode: 'insensitive' } }
    });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const yearParam = request.nextUrl.searchParams.get('year');
    const taxYear = yearParam ? parseInt(yearParam, 10) : new Date().getFullYear();

    if (isNaN(taxYear) || taxYear < 2000 || taxYear > 2100) {
      return NextResponse.json({ error: 'Invalid year parameter' }, { status: 400 });
    }

    const entries = await generateForm8949(user.id, taxYear);
    const csv = generateForm8949CSV(entries);

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="Form8949_${taxYear}.csv"`,
      },
    });
  } catch (error) {
    console.error('Tax export error:', error);
    return NextResponse.json({ error: 'Failed to generate tax export' }, { status: 500 });
  }
}
