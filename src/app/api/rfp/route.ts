import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { prisma } = await import('@/lib/prisma');
    const data = await request.json();

    // Save to database
    const prospect = await prisma.prospects.create({
      data: {
        businessName: data.businessName,
        contactName: data.contactName,
        email: data.email,
        phone: data.phone || null,
        expenseTier: data.expenseTier || null,
        frequency: data.frequency || 'monthly',
        monthlyValue: data.totals?.monthly ? parseFloat(data.totals.monthly.toString()) : 0,
        numBankAccounts: data.numBankAccounts || null,
        numCreditCards: data.numCreditCards || null,
        monthlyTransactions: data.monthlyTransactions || null,
        hasPayroll: data.hasPayroll || 'no',
        hasInventory: data.hasInventory || 'no',
        currentBookkeeping: data.currentBookkeeping || null,
        biggestPainPoint: data.biggestPainPoint || null,
        needs: data.needs || null,
        timeline: data.timeline || null,
        status: 'new'
      }
    });

    // Send email notification
    try {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: 'Temple Stuart <noreply@templestuart.com>',
          to: 'your-email@gmail.com', // Replace with your email
          subject: `New Prospect: ${data.businessName}`,
          html: `
            <h2>New Prospect Submission</h2>
            <p><strong>Business:</strong> ${data.businessName}</p>
            <p><strong>Contact:</strong> ${data.contactName}</p>
            <p><strong>Email:</strong> ${data.email}</p>
            <p><strong>Phone:</strong> ${data.phone || 'Not provided'}</p>
            <p><strong>Monthly Value:</strong> $${data.totals?.monthly || 0}</p>
            <p><strong>Timeline:</strong> ${data.timeline || 'Not specified'}</p>
            <p><strong>Needs:</strong> ${data.needs || 'Not specified'}</p>
            <hr>
            <p>View in dashboard: <a href="https://templestuart.com/developer">Developer Dashboard</a></p>
          `
        })
      });
    } catch (emailError) {
      console.error('Email send failed:', emailError);
      // Don't fail the whole request if email fails
    }
    
    return NextResponse.json({ success: true, id: prospect.id });
    
  } catch (error: any) {
    console.error('RFP API Error:', error);
    return NextResponse.json({ 
      error: 'Failed to save', 
      message: error?.message || 'Unknown error'
    }, { status: 500 });
  }
}
