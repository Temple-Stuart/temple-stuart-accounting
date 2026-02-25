import { prisma } from './prisma';

const DEFAULT_COA = [
  // INCOME
  { code: '4000', name: 'Wages & Salary', account_type: 'revenue' },
  { code: '4200', name: 'Other Income', account_type: 'revenue' },
  { code: '4500', name: 'Side Hustle Income', account_type: 'revenue' },
  { code: '4600', name: 'Retirement Distribution', account_type: 'revenue' },

  // TAX-SPECIFIC
  { code: '8950', name: 'Early Withdrawal Penalty', account_type: 'expense' },

  // FIXED EXPENSES
  { code: '8100', name: 'Rent/Mortgage', account_type: 'expense' },
  { code: '8110', name: 'Utilities', account_type: 'expense' },
  { code: '8200', name: 'Phone & Internet', account_type: 'expense' },
  { code: '8140', name: 'Health Insurance', account_type: 'expense' },
  { code: '6600', name: 'Auto Insurance', account_type: 'expense' },
  { code: '8190', name: 'Subscriptions', account_type: 'expense' },
  { code: '6700', name: 'Student Loan Payment', account_type: 'expense' },
  { code: '6710', name: 'Credit Card Payment', account_type: 'expense' },

  // VARIABLE EXPENSES
  { code: '8120', name: 'Groceries', account_type: 'expense' },
  { code: '6100', name: 'Meals & Dining', account_type: 'expense' },
  { code: '6400', name: 'Gas & Fuel', account_type: 'expense' },
  { code: '8130', name: 'Healthcare & Medical', account_type: 'expense' },
  { code: '8150', name: 'Personal Care', account_type: 'expense' },
  { code: '8170', name: 'Entertainment', account_type: 'expense' },

  // TRAVEL EXPENSES
  { code: '7100', name: 'Flights', account_type: 'expense' },
  { code: '7200', name: 'Lodging', account_type: 'expense' },
  { code: '7300', name: 'Rental Car', account_type: 'expense' },
  { code: '7400', name: 'Activities & Tickets', account_type: 'expense' },
  { code: '7500', name: 'Equipment Rental', account_type: 'expense' },
  { code: '7600', name: 'Ground Transport', account_type: 'expense' },
  { code: '7700', name: 'Travel Meals', account_type: 'expense' },
  { code: '7800', name: 'Tips & Misc', account_type: 'expense' },
];

export async function seedDefaultCOA(userId: string, entityId: string): Promise<boolean> {
  try {
    // Check if user already has COA for this entity
    const existingCount = await prisma.chart_of_accounts.count({
      where: { userId, entity_id: entityId }
    });

    if (existingCount > 0) {
      return false; // Already has COA
    }

    // Create default COA entries
    for (const account of DEFAULT_COA) {
      // Check compound unique [userId, entity_id, code]
      const existing = await prisma.chart_of_accounts.findFirst({
        where: { userId, entity_id: entityId, code: account.code }
      });

      if (!existing) {
        await prisma.chart_of_accounts.create({
          data: {
            id: crypto.randomUUID(),
            code: account.code,
            name: account.name,
            account_type: account.account_type,
            balance_type: account.account_type === 'revenue' ? 'C' : 'D',
            entity_id: entityId,
            userId,
            settled_balance: 0,
            pending_balance: 0,
            version: 0,
            is_archived: false,
          }
        });
      }
    }

    return true;
  } catch (error) {
    console.error('Failed to seed default COA:', error);
    return false;
  }
}
