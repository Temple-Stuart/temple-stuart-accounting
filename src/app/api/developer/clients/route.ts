import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const users = await prisma.users.findMany({
      include: {
        accounts: {
          include: {
            plaid_items: true,
            _count: {
              select: {
                transactions: true
              }
            }
          }
        },
        _count: {
          select: { 
            accounts: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    // Calculate total transactions per user
    const usersWithStats = users.map(user => {
      const totalTransactions = user.accounts.reduce((sum, account) => 
        sum + (account._count?.transactions || 0), 0
      );
      
      return {
        ...user,
        _count: {
          ...user._count,
          transactions: totalTransactions
        }
      };
    });

    return NextResponse.json(usersWithStats);
  } catch (error) {
    console.error('Error fetching clients:', error);
    return NextResponse.json([]);
  }
}
