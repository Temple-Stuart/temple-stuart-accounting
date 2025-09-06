import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@/generated/prisma';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();

export async function GET(request: NextRequest) {
  try {
    // Verify JWT token from cookie
    const token = request.cookies.get('auth_token')?.value;
    
    if (!token) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET!) as { userId: string };
    } catch (error) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    // Get all Plaid items and accounts for this user
    const plaidItems = await prisma.plaidItem.findMany({
      where: { userId: decoded.userId },
      include: {
        accounts: true
      }
    });

    // Map the data to match frontend interface
    const mappedPlaidItems = plaidItems.map(item => ({
      id: item.id,
      institutionName: item.institutionName,
      accounts: item.accounts.map(account => ({
        id: account.id,
        name: account.name,
        type: account.type,
        subtype: account.subtype || '',
        balance: account.balanceCurrent || 0
      }))
    }));

    return NextResponse.json({ plaidItems: mappedPlaidItems });
  } catch (error) {
    console.error('Error fetching accounts:', error);
    return NextResponse.json({ error: 'Failed to fetch accounts' }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}
