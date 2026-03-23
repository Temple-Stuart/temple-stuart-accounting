import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getVerifiedEmail } from '@/lib/cookie-auth';
import { generateForm1040 } from '@/lib/form-1040-service';
import { generateTaxReport } from '@/lib/tax-report-service';
import { generateAllFormsPDF, generateSingleFormPDF } from '@/lib/tax-pdf-service';

export async function GET(request: Request) {
  try {
    const userEmail = await getVerifiedEmail();
    if (!userEmail) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.users.findFirst({
      where: { email: { equals: userEmail, mode: 'insensitive' } },
    });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const yearParam = searchParams.get('year') || '2025';
    const taxYear = parseInt(yearParam, 10);
    const formType = searchParams.get('form') || 'all';

    // Generate tax data from existing services
    const [form1040, taxReport] = await Promise.all([
      generateForm1040(user.id, taxYear),
      generateTaxReport(user.id, taxYear),
    ]);

    let pdfBuffer: Buffer;
    let filename: string;

    if (formType === 'all') {
      pdfBuffer = await generateAllFormsPDF(form1040, taxReport);
      filename = `TaxReturn_${taxYear}.pdf`;
    } else {
      pdfBuffer = await generateSingleFormPDF(formType, form1040, taxReport);
      const formNames: Record<string, string> = {
        '1040': 'Form1040',
        'schedule-c': 'ScheduleC',
        'schedule-d': 'ScheduleD',
        '8949': 'Form8949',
        'schedule-1': 'Schedule1',
        '8863': 'Form8863',
      };
      filename = `${formNames[formType] || 'TaxForm'}_${taxYear}.pdf`;
    }

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': String(pdfBuffer.length),
      },
    });
  } catch (error) {
    console.error('PDF generation error:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Failed to generate PDF',
    }, { status: 500 });
  }
}
