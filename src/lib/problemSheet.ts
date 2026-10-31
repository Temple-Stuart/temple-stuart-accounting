// NAV-01a: the deck's PROBLEM_SHEET extracted to a shared LEAF module (zero
// imports, server- and client-safe — the tabDescriptors / modulePillars
// precedent). ONE source for the six families and the 25 tools: the landing
// renders it (Landing.tsx), the tool registry keys on it (toolRegistry.ts), and
// the build-time assert reads it (scripts/assert-tool-registry.ts). Never a
// retyped second copy. Order is the ruled sheet order and renders as such.
export const PROBLEM_SHEET = [
  { header: 'THE WORK', tools: ['Calendar', 'Tasks', 'Time'] },
  { header: 'MONEY IN', tools: ['CRM', 'Contracts', 'Invoicing', 'Payments'] },
  { header: 'MONEY OUT', tools: ['Bill Pay', 'Payroll', 'Expenses', 'Travel', 'Mileage', 'Budget'] },
  { header: 'WHAT YOU OWN', tools: ['Banking', 'Fixed Assets', 'Retirement', 'Brokerage', 'Trade Log'] },
  { header: 'WHAT YOU OWE', tools: ['Debt', 'Sales Tax', 'Ent Filings'] },
  { header: 'THE PROOF', tools: ['Bookkeeping', 'Tax', 'Compliance', 'FP&A'] },
] as const;

export type FamilyName = (typeof PROBLEM_SHEET)[number]['header'];
export type ToolName = (typeof PROBLEM_SHEET)[number]['tools'][number];
