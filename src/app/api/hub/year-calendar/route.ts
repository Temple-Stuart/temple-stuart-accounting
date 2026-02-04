import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const year = parseInt(searchParams.get('year') || new Date().getFullYear().toString());
    
    const cookieStore = await cookies();
    const userEmail = cookieStore.get('userEmail')?.value;

    if (!userEmail) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.users.findFirst({
      where: { email: { equals: userEmail, mode: 'insensitive' } }
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const startOfYear = new Date(year, 0, 1);
    const endOfYear = new Date(year, 11, 31, 23, 59, 59);

    // ═══════════════════════════════════════════════════════════════════
    // BUDGET DATA - From calendar_events
    // ═══════════════════════════════════════════════════════════════════
    const events = await prisma.$queryRaw<Array<{
      source: string;
      start_date: Date;
      budget_amount: number;
    }>>`
      SELECT source, start_date, budget_amount
      FROM calendar_events
      WHERE user_id = ${user.id}
        AND start_date >= ${startOfYear}
        AND start_date <= ${endOfYear}
    `;

    const budgetData: Record<number, Record<string, number>> = {};
    for (let m = 0; m < 12; m++) {
      budgetData[m] = { home: 0, auto: 0, shopping: 0, personal: 0, health: 0, growth: 0, trip: 0, total: 0 };
    }

    for (const event of events) {
      const month = new Date(event.start_date).getMonth();
      const amount = Number(event.budget_amount || 0);
      const source = event.source || 'personal';
      
      if (budgetData[month][source] !== undefined) {
        budgetData[month][source] += amount;
      }
      if (source !== 'trip') {
        budgetData[month].total += amount;
      }
    }

    // ═══════════════════════════════════════════════════════════════════
    // ACTUALS DATA - From transactions via chart_of_accounts.module
    // SECURITY: Scoped to user's accounts only
    // ═══════════════════════════════════════════════════════════════════
    const modules = ['home', 'auto', 'shopping', 'personal', 'health', 'growth'];
    
    // Get COA codes grouped by module
    const coaByModule = await prisma.chart_of_accounts.findMany({
      where: { 
        module: { in: modules },
        is_archived: false
      },
      select: { code: true, module: true }
    });

    const moduleCodeMap: Record<string, string[]> = {};
    modules.forEach(m => moduleCodeMap[m] = []);
    coaByModule.forEach(coa => {
      if (coa.module && moduleCodeMap[coa.module]) {
        moduleCodeMap[coa.module].push(coa.code);
      }
    });

    // Get all transactions for the year with relevant COA codes
    const allCodes = coaByModule.map(c => c.code);
    
    const transactions = await prisma.transactions.findMany({
      where: {
        accounts: { userId: user.id },
        accountCode: { in: allCodes },
        date: {
          gte: startOfYear,
          lte: endOfYear
        }
      },
      select: {
        date: true,
        amount: true,
        accountCode: true
      }
    });

    // Build actuals data structure
    const actualData: Record<number, Record<string, number>> = {};
    for (let m = 0; m < 12; m++) {
      actualData[m] = { home: 0, auto: 0, shopping: 0, personal: 0, health: 0, growth: 0, trip: 0, total: 0 };
    }

    // Map transactions to modules
    const codeToModule: Record<string, string> = {};
    coaByModule.forEach(coa => {
      if (coa.module) codeToModule[coa.code] = coa.module;
    });

    for (const txn of transactions) {
      const month = new Date(txn.date).getMonth();
      const amount = Math.abs(txn.amount);
      const module = txn.accountCode ? codeToModule[txn.accountCode] : null;
      
      if (module && actualData[month][module] !== undefined) {
        actualData[month][module] += amount;
        actualData[month].total += amount;
      }
    }

    // Round to 2 decimal places
    for (let m = 0; m < 12; m++) {
      Object.keys(actualData[m]).forEach(key => {
        actualData[m][key] = Math.round(actualData[m][key] * 100) / 100;
      });
    }

    return NextResponse.json({ 
      year, 
      budgetData,
      actualData,
      monthlyData: budgetData 
    });
  } catch (error) {
    console.error('Year calendar error:', error);
    return NextResponse.json({ error: 'Failed to fetch calendar' }, { status: 500 });
  }
}
