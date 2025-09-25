import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    // For now, return mock data since RFP table doesn't exist yet
    const mockProspects = [
      {
        id: '1',
        businessName: 'Sample Company',
        contactName: 'John Doe',
        email: 'john@example.com',
        timeline: 'immediate',
        selectedServices: ['bookkeeping', 'payroll'],
        createdAt: new Date()
      }
    ];
    
    return NextResponse.json(mockProspects);
  } catch (error) {
    console.error('Error fetching prospects:', error);
    return NextResponse.json([]);
  }
}
