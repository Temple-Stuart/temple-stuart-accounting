import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getVerifiedEmail } from '@/lib/cookie-auth';
import { generateTaxReport } from '@/lib/tax-report-service';
import { generateScheduleC, generateScheduleSE } from '@/lib/schedule-c-service';
import { generateForm1040 } from '@/lib/form-1040-service';

/**
 * GET /api/tax/report?year=2025
 * GET /api/tax/report?year=2025&form=schedule-c
 * GET /api/tax/report?year=2025&form=schedule-se
 * GET /api/tax/report?year=2025&form=1040
 *
 * Without form param: returns Form 8949 + Schedule D (existing behavior).
 * With form param: returns the requested form data.
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

    const form = request.nextUrl.searchParams.get('form');

    // ── Schedule C ──
    if (form === 'schedule-c') {
      const scheduleC = await generateScheduleC(user.id, taxYear);
      const scheduleSE = generateScheduleSE(scheduleC.line31);
      return NextResponse.json({ scheduleC, scheduleSE });
    }

    // ── Schedule SE (standalone) ──
    if (form === 'schedule-se') {
      const scheduleC = await generateScheduleC(user.id, taxYear);
      const scheduleSE = generateScheduleSE(scheduleC.line31);
      return NextResponse.json({ scheduleSE });
    }

    // ── Form 1040 ──
    if (form === '1040') {
      const form1040 = await generateForm1040(user.id, taxYear);
      return NextResponse.json(form1040);
    }

    // ── Default: Schedule D + Form 8949 (existing behavior, unchanged) ──
    const report = await generateTaxReport(user.id, taxYear);
    return NextResponse.json(report);

  } catch (error) {
    console.error('Tax report error:', error);
    return NextResponse.json({ error: 'Failed to generate tax report' }, { status: 500 });
  }
}
