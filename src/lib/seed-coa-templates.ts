import { PrismaClient } from '@prisma/client';

interface TemplateAccount {
  code: string;
  name: string;
  account_type: string;
  balance_type: string;
  sub_type?: string;
  tax_form_line?: string;
}

interface TemplateDefinition {
  entity_type: string;
  name: string;
  accounts: TemplateAccount[];
}

const PERSONAL_STANDARD: TemplateDefinition = {
  entity_type: 'personal',
  name: 'Personal Standard',
  accounts: [
    { code: '1010', name: 'Primary Checking', account_type: 'asset', balance_type: 'D' },
    { code: '1020', name: 'Savings', account_type: 'asset', balance_type: 'D' },
    { code: '1030', name: 'Cash & Wallet', account_type: 'asset', balance_type: 'D' },
    { code: '1200', name: 'Brokerage Account', account_type: 'asset', balance_type: 'D', sub_type: 'investment' },
    { code: '1300', name: 'Retirement (457b)', account_type: 'asset', balance_type: 'D', sub_type: 'retirement' },
    { code: '1310', name: 'Retirement (IRA)', account_type: 'asset', balance_type: 'D', sub_type: 'retirement' },
    { code: '2010', name: 'Credit Card', account_type: 'liability', balance_type: 'C', sub_type: 'credit_card' },
    { code: '2020', name: 'Student Loans', account_type: 'liability', balance_type: 'C', sub_type: 'loan' },
    { code: '3000', name: 'Personal Equity', account_type: 'equity', balance_type: 'C' },
    { code: '3100', name: 'Opening Balances', account_type: 'equity', balance_type: 'C' },
    { code: '4000', name: 'Wages & Salary', account_type: 'revenue', balance_type: 'C', tax_form_line: 'form_1040_line_1a' },
    { code: '4100', name: 'Interest Income', account_type: 'revenue', balance_type: 'C', tax_form_line: 'form_1040_line_2b' },
    { code: '4200', name: 'Other Income', account_type: 'revenue', balance_type: 'C', tax_form_line: 'form_1040_line_8' },
    { code: '6100', name: 'Groceries & Food', account_type: 'expense', balance_type: 'D' },
    { code: '6110', name: 'Coffee & Snacks', account_type: 'expense', balance_type: 'D' },
    { code: '6120', name: 'Dating & Social', account_type: 'expense', balance_type: 'D' },
    { code: '6150', name: 'Dining Out', account_type: 'expense', balance_type: 'D' },
    { code: '6200', name: 'Travel & Vacation', account_type: 'expense', balance_type: 'D' },
    { code: '7100', name: 'Flight', account_type: 'expense', balance_type: 'D' },
    { code: '7200', name: 'Lodging', account_type: 'expense', balance_type: 'D' },
    { code: '7300', name: 'Travel Transport', account_type: 'expense', balance_type: 'D' },
    { code: '7400', name: 'Activities', account_type: 'expense', balance_type: 'D' },
    { code: '7500', name: 'Travel Equipment', account_type: 'expense', balance_type: 'D' },
    { code: '7600', name: 'Ground Transport', account_type: 'expense', balance_type: 'D' },
    { code: '7700', name: 'Travel Dining', account_type: 'expense', balance_type: 'D' },
    { code: '7800', name: 'Tips & Misc', account_type: 'expense', balance_type: 'D' },
    { code: '6300', name: 'Bank Fees & Interest', account_type: 'expense', balance_type: 'D' },
    { code: '6400', name: 'Transportation', account_type: 'expense', balance_type: 'D' },
    { code: '6500', name: 'Auto Payment', account_type: 'expense', balance_type: 'D' },
    { code: '6510', name: 'Auto Insurance', account_type: 'expense', balance_type: 'D' },
    { code: '6520', name: 'Gas & Fuel', account_type: 'expense', balance_type: 'D' },
    { code: '6530', name: 'Auto Maintenance', account_type: 'expense', balance_type: 'D' },
    { code: '6610', name: 'Auto Registration', account_type: 'expense', balance_type: 'D' },
    { code: '6620', name: 'Parking', account_type: 'expense', balance_type: 'D' },
    { code: '6630', name: 'Tolls', account_type: 'expense', balance_type: 'D' },
    { code: '8100', name: 'Rent', account_type: 'expense', balance_type: 'D' },
    { code: '8110', name: 'Renters Insurance', account_type: 'expense', balance_type: 'D' },
    { code: '8120', name: 'Utilities', account_type: 'expense', balance_type: 'D' },
    { code: '8130', name: 'Medical & Health', account_type: 'expense', balance_type: 'D' },
    { code: '8140', name: 'Prescriptions', account_type: 'expense', balance_type: 'D' },
    { code: '8150', name: 'Personal Care', account_type: 'expense', balance_type: 'D' },
    { code: '8160', name: 'Clothing & Apparel', account_type: 'expense', balance_type: 'D' },
    { code: '8170', name: 'Entertainment', account_type: 'expense', balance_type: 'D' },
    { code: '8180', name: 'Streaming & Subscriptions', account_type: 'expense', balance_type: 'D' },
    { code: '8190', name: 'Phone & Internet', account_type: 'expense', balance_type: 'D' },
    { code: '8200', name: 'Home & Household', account_type: 'expense', balance_type: 'D' },
    { code: '8210', name: 'Office Supplies', account_type: 'expense', balance_type: 'D' },
    { code: '8220', name: 'Coworking Space', account_type: 'expense', balance_type: 'D' },
    { code: '8230', name: 'Storage Unit', account_type: 'expense', balance_type: 'D' },
    { code: '8310', name: 'Hygiene & Toiletries', account_type: 'expense', balance_type: 'D' },
    { code: '8320', name: 'Cleaning Supplies', account_type: 'expense', balance_type: 'D' },
    { code: '8330', name: 'Kitchen & Household', account_type: 'expense', balance_type: 'D' },
    { code: '8410', name: 'Gym & Fitness', account_type: 'expense', balance_type: 'D' },
    { code: '8420', name: 'Supplements & Vitamins', account_type: 'expense', balance_type: 'D' },
    { code: '8430', name: 'Mental Health', account_type: 'expense', balance_type: 'D' },
    { code: '8510', name: 'Professional Development', account_type: 'expense', balance_type: 'D' },
    { code: '8520', name: 'Community & Social', account_type: 'expense', balance_type: 'D' },
    { code: '8530', name: 'Books & Learning', account_type: 'expense', balance_type: 'D' },
    { code: '8900', name: 'Miscellaneous', account_type: 'expense', balance_type: 'D' },
    { code: '9000', name: 'Uncategorized', account_type: 'expense', balance_type: 'D' },
  ],
};

const SOLE_PROP_STANDARD: TemplateDefinition = {
  entity_type: 'sole_prop',
  name: 'Sole Proprietor Standard',
  accounts: [
    { code: '1010', name: 'Business Checking', account_type: 'asset', balance_type: 'D' },
    { code: '1020', name: 'Business Savings', account_type: 'asset', balance_type: 'D' },
    { code: '1100', name: 'Accounts Receivable', account_type: 'asset', balance_type: 'D' },
    { code: '1400', name: 'Equipment', account_type: 'asset', balance_type: 'D' },
    { code: '1410', name: 'Accum. Depreciation', account_type: 'asset', balance_type: 'D' },
    { code: '2010', name: 'Accounts Payable', account_type: 'liability', balance_type: 'C' },
    { code: '2020', name: 'Credit Card (Business)', account_type: 'liability', balance_type: 'C' },
    { code: '3000', name: "Owner's Equity", account_type: 'equity', balance_type: 'C' },
    { code: '3100', name: "Owner's Draws", account_type: 'equity', balance_type: 'D' },
    { code: '3200', name: "Owner's Contributions", account_type: 'equity', balance_type: 'C' },
    { code: '4000', name: 'Service Revenue', account_type: 'revenue', balance_type: 'C', tax_form_line: 'schedule_c_line_1' },
    { code: '4100', name: 'Product Revenue', account_type: 'revenue', balance_type: 'C', tax_form_line: 'schedule_c_line_1' },
    { code: '4200', name: 'Other Business Income', account_type: 'revenue', balance_type: 'C', tax_form_line: 'schedule_c_line_6' },
    { code: '6000', name: 'Advertising', account_type: 'expense', balance_type: 'D', tax_form_line: 'schedule_c_line_8' },
    { code: '6010', name: 'Car & Truck Expenses', account_type: 'expense', balance_type: 'D', tax_form_line: 'schedule_c_line_9' },
    { code: '6020', name: 'Commissions & Fees', account_type: 'expense', balance_type: 'D', tax_form_line: 'schedule_c_line_10' },
    { code: '6050', name: 'Insurance (Business)', account_type: 'expense', balance_type: 'D', tax_form_line: 'schedule_c_line_15' },
    { code: '6060', name: 'Interest (Business)', account_type: 'expense', balance_type: 'D', tax_form_line: 'schedule_c_line_16b' },
    { code: '6070', name: 'Legal & Professional', account_type: 'expense', balance_type: 'D', tax_form_line: 'schedule_c_line_17' },
    { code: '6080', name: 'Office Expense', account_type: 'expense', balance_type: 'D', tax_form_line: 'schedule_c_line_18' },
    { code: '6100', name: 'Rent (Business)', account_type: 'expense', balance_type: 'D', tax_form_line: 'schedule_c_line_20b' },
    { code: '6120', name: 'Supplies', account_type: 'expense', balance_type: 'D', tax_form_line: 'schedule_c_line_22' },
    { code: '6130', name: 'Taxes & Licenses', account_type: 'expense', balance_type: 'D', tax_form_line: 'schedule_c_line_23' },
    { code: '6140', name: 'Travel (Business)', account_type: 'expense', balance_type: 'D', tax_form_line: 'schedule_c_line_24a' },
    { code: '6150', name: 'Meals (Business)', account_type: 'expense', balance_type: 'D', tax_form_line: 'schedule_c_line_24b' },
    { code: '6160', name: 'Utilities (Business)', account_type: 'expense', balance_type: 'D', tax_form_line: 'schedule_c_line_25' },
    { code: '6170', name: 'Wages Paid', account_type: 'expense', balance_type: 'D', tax_form_line: 'schedule_c_line_26' },
    { code: '6200', name: 'Software & SaaS', account_type: 'expense', balance_type: 'D', tax_form_line: 'schedule_c_line_27a' },
    { code: '6210', name: 'Hosting & Cloud', account_type: 'expense', balance_type: 'D', tax_form_line: 'schedule_c_line_27a' },
    { code: '6220', name: 'Phone & Internet (Business)', account_type: 'expense', balance_type: 'D', tax_form_line: 'schedule_c_line_27a' },
    { code: '6230', name: 'Education & Training', account_type: 'expense', balance_type: 'D', tax_form_line: 'schedule_c_line_27a' },
    { code: '6240', name: 'Subscriptions (Business)', account_type: 'expense', balance_type: 'D', tax_form_line: 'schedule_c_line_27a' },
  ],
};

const TRADING_STANDARD: TemplateDefinition = {
  entity_type: 'personal',
  name: 'Trading Standard',
  accounts: [
    { code: '1010', name: 'Trading Cash', account_type: 'asset', balance_type: 'D' },
    { code: '1100', name: 'Stock Holdings', account_type: 'asset', balance_type: 'D' },
    { code: '1200', name: 'Long Call Positions', account_type: 'asset', balance_type: 'D' },
    { code: '1210', name: 'Long Put Positions', account_type: 'asset', balance_type: 'D' },
    { code: '2100', name: 'Short Call Positions', account_type: 'liability', balance_type: 'C' },
    { code: '2110', name: 'Short Put Positions', account_type: 'liability', balance_type: 'C' },
    { code: '3000', name: 'Trading Equity', account_type: 'equity', balance_type: 'C' },
    { code: '3200', name: 'Contributions', account_type: 'equity', balance_type: 'C' },
    { code: '3300', name: 'Withdrawals', account_type: 'equity', balance_type: 'D' },
    { code: '4100', name: 'Trading Gains', account_type: 'revenue', balance_type: 'C', tax_form_line: 'form_8949' },
    { code: '5100', name: 'Trading Losses', account_type: 'expense', balance_type: 'D', tax_form_line: 'form_8949' },
  ],
};

const ALL_TEMPLATES = [PERSONAL_STANDARD, SOLE_PROP_STANDARD, TRADING_STANDARD];

export async function seedCoaTemplates(prisma: PrismaClient) {
  const results: { name: string; accountCount: number }[] = [];

  for (const tmpl of ALL_TEMPLATES) {
    const template = await prisma.coa_templates.upsert({
      where: {
        entity_type_name: {
          entity_type: tmpl.entity_type,
          name: tmpl.name,
        },
      },
      create: {
        entity_type: tmpl.entity_type,
        name: tmpl.name,
        version: 1,
        is_active: true,
      },
      update: {
        is_active: true,
      },
    });

    for (const acct of tmpl.accounts) {
      await prisma.coa_template_accounts.upsert({
        where: {
          template_id_code: {
            template_id: template.id,
            code: acct.code,
          },
        },
        create: {
          template_id: template.id,
          code: acct.code,
          name: acct.name,
          account_type: acct.account_type,
          balance_type: acct.balance_type,
          sub_type: acct.sub_type ?? null,
          tax_form_line: acct.tax_form_line ?? null,
        },
        update: {
          name: acct.name,
          account_type: acct.account_type,
          balance_type: acct.balance_type,
          sub_type: acct.sub_type ?? null,
          tax_form_line: acct.tax_form_line ?? null,
        },
      });
    }

    results.push({ name: tmpl.name, accountCount: tmpl.accounts.length });
  }

  return results;
}
