import { randomUUID } from 'crypto';
import { NextResponse } from 'next/server';
export async function POST(request: Request) {
  try {
    const { prisma } = await import('@/lib/prisma');
    const data = await request.json();
    const prospect = await prisma.prospects.create({
      data: {
        id: randomUUID(),
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
        problem: data.problem || null,
        dreamSystem: data.dreamSystem || null,
        enablement: data.enablement || null,
        systemType: data.systemType || null,
        currentTools: data.currentTools || null,
        hasData: data.hasData || null,
        whyNow: data.whyNow || null,
        additionalInfo: data.additionalInfo || null,
        status: 'new',        updatedAt: new Date()
      }
    });
    
    return NextResponse.json({ success: true, id: prospect.id });
    
  } catch (error: any) {
    console.error('RFP API Error:', error);
    return NextResponse.json({ 
      error: 'Failed to save', 
      message: error?.message || 'Unknown error'
    }, { status: 500 });
  }
}
