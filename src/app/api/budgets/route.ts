import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getVerifiedEmail } from '@/lib/cookie-auth';

export async function GET(request: Request) {
  try {
    const userEmail = await getVerifiedEmail();
    if (!userEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await prisma.users.findFirst({
      where: { email: { equals: userEmail, mode: 'insensitive' } }
    });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const { searchParams } = new URL(request.url);
    const year = parseInt(searchParams.get('year') || new Date().getFullYear().toString());

    const budgets = await prisma.budgets.findMany({
      where: { userId: user.id, year }
    });

    return NextResponse.json({ budgets });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Failed to fetch budgets' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const userEmail = await getVerifiedEmail();
    if (!userEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await prisma.users.findFirst({
      where: { email: { equals: userEmail, mode: 'insensitive' } }
    });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const body = await request.json();
    const { accountCode, year, months } = body;
    // months: { jan?: number, feb?: number, ... }

    const budget = await prisma.budgets.upsert({
      where: {
        userId_accountCode_year: {
          userId: user.id,
          accountCode,
          year
        }
      },
      update: {
        jan: months.jan ?? null,
        feb: months.feb ?? null,
        mar: months.mar ?? null,
        apr: months.apr ?? null,
        may: months.may ?? null,
        jun: months.jun ?? null,
        jul: months.jul ?? null,
        aug: months.aug ?? null,
        sep: months.sep ?? null,
        oct: months.oct ?? null,
        nov: months.nov ?? null,
        dec: months.dec ?? null,
      },
      create: {
        userId: user.id,
        accountCode,
        year,
        jan: months.jan ?? null,
        feb: months.feb ?? null,
        mar: months.mar ?? null,
        apr: months.apr ?? null,
        may: months.may ?? null,
        jun: months.jun ?? null,
        jul: months.jul ?? null,
        aug: months.aug ?? null,
        sep: months.sep ?? null,
        oct: months.oct ?? null,
        nov: months.nov ?? null,
        dec: months.dec ?? null,
      }
    });

    return NextResponse.json({ budget });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Failed to save budget' }, { status: 500 });
  }
}
