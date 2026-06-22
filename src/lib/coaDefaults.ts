// Pure-data, client-safe chart-of-accounts defaults — NO prisma, NO server-only deps.
// Single source of truth for the default chart every new user is seeded with: imported by
// the server seeder (seedDefaultCOA.ts) AND by client surfaces that need the canonical
// category list WITHOUT fetching anyone's per-user COA (e.g. the logged-out routine builder
// shows these starter categories with zero /api/chart-of-accounts call). Rows copied verbatim
// from the original seedDefaultCOA.ts definition — codes/names/account_types unchanged.

export interface CoaDefault {
  code: string;
  name: string;
  account_type: 'revenue' | 'expense';
}

export const DEFAULT_COA: CoaDefault[] = [
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
