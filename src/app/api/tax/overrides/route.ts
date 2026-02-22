import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getVerifiedEmail } from '@/lib/cookie-auth';

const ALLOWED_FIELD_KEYS = [
  'w2_gross_wages',
  'w2_federal_withheld',
  'w2_state_withheld',
  'retirement_distribution_gross',
  'retirement_distribution_taxable',
  'retirement_distribution_withheld',
  'retirement_distribution_code',
  'estimated_payments_made',
  'filing_status',
];

/**
 * GET /api/tax/overrides?year=2025
 * Returns all tax overrides for the given year.
 */
export async function GET(request: NextRequest) {
  try {
    const userEmail = await getVerifiedEmail();
    if (!userEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await prisma.users.findFirst({
      where: { email: { equals: userEmail, mode: 'insensitive' } },
    });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const yearParam = request.nextUrl.searchParams.get('year');
    const taxYear = yearParam ? parseInt(yearParam, 10) : new Date().getFullYear();

    if (isNaN(taxYear) || taxYear < 2000 || taxYear > 2100) {
      return NextResponse.json({ error: 'Invalid year' }, { status: 400 });
    }

    const overrides = await prisma.tax_overrides.findMany({
      where: { userId: user.id, tax_year: taxYear },
      select: { field_key: true, field_value: true, updated_at: true },
    });

    const map: Record<string, string> = {};
    for (const o of overrides) {
      map[o.field_key] = o.field_value;
    }

    return NextResponse.json({ taxYear, overrides: map });
  } catch (error) {
    console.error('Tax overrides GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch overrides' }, { status: 500 });
  }
}

/**
 * POST /api/tax/overrides
 * Body: { year: number, overrides: { [field_key]: value } }
 * Upserts each override for the given year.
 */
export async function POST(request: NextRequest) {
  try {
    const userEmail = await getVerifiedEmail();
    if (!userEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await prisma.users.findFirst({
      where: { email: { equals: userEmail, mode: 'insensitive' } },
    });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const body = await request.json();
    const { year, overrides } = body as { year: number; overrides: Record<string, string> };

    if (!year || typeof year !== 'number' || year < 2000 || year > 2100) {
      return NextResponse.json({ error: 'Invalid year' }, { status: 400 });
    }

    if (!overrides || typeof overrides !== 'object') {
      return NextResponse.json({ error: 'overrides object required' }, { status: 400 });
    }

    const saved: string[] = [];

    for (const [key, value] of Object.entries(overrides)) {
      if (!ALLOWED_FIELD_KEYS.includes(key)) {
        continue; // Silently skip unknown keys
      }

      const strValue = String(value);

      await prisma.tax_overrides.upsert({
        where: {
          userId_tax_year_field_key: {
            userId: user.id,
            tax_year: year,
            field_key: key,
          },
        },
        update: { field_value: strValue },
        create: {
          userId: user.id,
          tax_year: year,
          field_key: key,
          field_value: strValue,
        },
      });

      saved.push(key);
    }

    return NextResponse.json({ saved, year });
  } catch (error) {
    console.error('Tax overrides POST error:', error);
    return NextResponse.json({ error: 'Failed to save overrides' }, { status: 500 });
  }
}
