import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: Request) {
  try {
    const data = await request.json();
    
    console.log('Received prospect data:', data);
    
    // Create prospect in database
    const prospect = await prisma.prospects.create({
      data: {
        businessName: data.businessName,
        contactName: data.contactName,
        email: data.email,
        phone: data.phone || null,
        
        // Pricing fields
        expenseTier: data.expenseTier || null,
        frequency: data.frequency || 'monthly',
        monthlyValue: data.totals?.monthly ? parseFloat(data.totals.monthly.toString()) : 0,
        
        // Pipeline assessment
        numBankAccounts: data.numBankAccounts || null,
        numCreditCards: data.numCreditCards || null,
        monthlyTransactions: data.monthlyTransactions || null,
        hasPayroll: data.hasPayroll || 'no',
        hasInventory: data.hasInventory || 'no',
        currentBookkeeping: data.currentBookkeeping || null,
        biggestPainPoint: data.biggestPainPoint || null,
        
        // Needs
        needs: data.needs || null,
        timeline: data.timeline || null,
        
        status: 'new'
      }
    });
    
    console.log('Saved prospect:', prospect);
    
    return NextResponse.json({ success: true, id: prospect.id });
  } catch (error) {
    console.error('Error saving prospect:', error);
    return NextResponse.json({ error: 'Failed to save prospect', details: error }, { status: 500 });
  }
}
