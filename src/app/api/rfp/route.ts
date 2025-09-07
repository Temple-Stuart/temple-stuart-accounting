import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function POST(request: Request) {
  try {
    const data = await request.json();
    
    // Save to database
    const rfp = await prisma.rFP.create({
      data: {
        businessName: data.businessName,
        contactName: data.contactName,
        email: data.email,
        phone: data.phone || '',
        needs: data.needs,
        why: data.why,
        timeline: data.timeline,
        services: data.selectedServices,
        oneTimeTotal: data.totals.oneTime,
        monthlyTotal: data.totals.monthly
      }
    });

    // Send email notification (you'll need to set up an email service)
    // For now, we'll just log it
    console.log('New RFP submitted:', rfp);

    return NextResponse.json({ success: true, id: rfp.id });
  } catch (error) {
    console.error('RFP submission error:', error);
    return NextResponse.json({ error: 'Failed to submit RFP' }, { status: 500 });
  }
}

export async function GET() {
  try {
    const rfps = await prisma.rFP.findMany({
      orderBy: { createdAt: 'desc' }
    });
    
    return NextResponse.json(rfps);
  } catch (error) {
    console.error('Error fetching RFPs:', error);
    return NextResponse.json({ error: 'Failed to fetch RFPs' }, { status: 500 });
  }
}
