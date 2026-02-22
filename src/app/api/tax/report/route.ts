import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getVerifiedEmail } from '@/lib/cookie-auth';
import { generateTaxReport } from '@/lib/tax-report-service';

/**
 * GET /api/tax/report?year=2025
 * Returns Form 8949 + Schedule D data for the given tax year.
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

    const report = await generateTaxReport(user.id, taxYear);

    return NextResponse.json(report);
  } catch (error) {
    console.error('Tax report error:', error);
    return NextResponse.json({ error: 'Failed to generate tax report' }, { status: 500 });
  }
}
