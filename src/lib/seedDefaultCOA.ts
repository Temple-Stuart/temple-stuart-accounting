import { prisma } from './prisma';

const DEFAULT_COA = [
  // INCOME
  { code: 'P-4000', name: 'Wages & Salary', account_type: 'revenue', entity_type: 'personal' },
  { code: 'P-4200', name: 'Other Income', account_type: 'revenue', entity_type: 'personal' },
  { code: 'P-4500', name: 'Side Hustle Income', account_type: 'revenue', entity_type: 'personal' },
  
  // FIXED EXPENSES
  { code: 'P-8100', name: 'Rent/Mortgage', account_type: 'expense', entity_type: 'personal' },
  { code: 'P-8110', name: 'Utilities', account_type: 'expense', entity_type: 'personal' },
  { code: 'P-8200', name: 'Phone & Internet', account_type: 'expense', entity_type: 'personal' },
  { code: 'P-8140', name: 'Health Insurance', account_type: 'expense', entity_type: 'personal' },
  { code: 'P-6600', name: 'Auto Insurance', account_type: 'expense', entity_type: 'personal' },
  { code: 'P-8190', name: 'Subscriptions', account_type: 'expense', entity_type: 'personal' },
  { code: 'P-6700', name: 'Student Loan Payment', account_type: 'expense', entity_type: 'personal' },
  { code: 'P-6710', name: 'Credit Card Payment', account_type: 'expense', entity_type: 'personal' },
  
  // VARIABLE EXPENSES
  { code: 'P-8120', name: 'Groceries', account_type: 'expense', entity_type: 'personal' },
  { code: 'P-6100', name: 'Meals & Dining', account_type: 'expense', entity_type: 'personal' },
  { code: 'P-6400', name: 'Gas & Fuel', account_type: 'expense', entity_type: 'personal' },
  { code: 'P-8130', name: 'Healthcare & Medical', account_type: 'expense', entity_type: 'personal' },
  { code: 'P-8150', name: 'Personal Care', account_type: 'expense', entity_type: 'personal' },
  { code: 'P-8170', name: 'Entertainment', account_type: 'expense', entity_type: 'personal' },
  
  // TRAVEL EXPENSES
  { code: 'P-7100', name: 'Flights', account_type: 'expense', entity_type: 'personal' },
  { code: 'P-7200', name: 'Lodging', account_type: 'expense', entity_type: 'personal' },
  { code: 'P-7300', name: 'Rental Car', account_type: 'expense', entity_type: 'personal' },
  { code: 'P-7400', name: 'Activities & Tickets', account_type: 'expense', entity_type: 'personal' },
  { code: 'P-7500', name: 'Equipment Rental', account_type: 'expense', entity_type: 'personal' },
  { code: 'P-7600', name: 'Ground Transport', account_type: 'expense', entity_type: 'personal' },
  { code: 'P-7700', name: 'Travel Meals', account_type: 'expense', entity_type: 'personal' },
  { code: 'P-7800', name: 'Tips & Misc', account_type: 'expense', entity_type: 'personal' },
];

export async function seedDefaultCOA(userId: string): Promise<boolean> {
  try {
    // Check if user already has COA
    const existingCount = await prisma.chart_of_accounts.count({
      where: { userId }
    });
    
    if (existingCount > 0) {
      return false; // Already has COA
    }
    
    // Create default COA entries
    for (const account of DEFAULT_COA) {
      // Check if code already exists (global unique constraint)
      const existing = await prisma.chart_of_accounts.findUnique({
        where: { code: account.code }
      });
      
      if (!existing) {
        await prisma.chart_of_accounts.create({
          data: { id: crypto.randomUUID(),
            code: account.code,
            name: account.name,
            account_type: account.account_type,
            balance_type: account.account_type === 'revenue' ? 'C' : 'D',
            entity_type: account.entity_type,
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
