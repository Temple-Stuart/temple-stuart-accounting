export const PRODUCT_CATEGORIES = [
  { code: 'financial_os', label: 'Financial OS' },
  { code: 'bookkeeping_software', label: 'Bookkeeping software' },
  { code: 'options_trading_analytics', label: 'Options / trading analytics' },
  { code: 'tax_preparation_software', label: 'Tax preparation software' },
  { code: 'travel_planning', label: 'Travel planning' },
  { code: 'payment_processing', label: 'Payment processing' },
  { code: 'payroll_software', label: 'Payroll software' },
  { code: 'crm_or_sales', label: 'CRM / sales' },
  { code: 'marketing_or_advertising', label: 'Marketing / advertising' },
  { code: 'ai_features', label: 'AI features (general)' },
  { code: 'mobile_app', label: 'Mobile app' },
  { code: 'web_app', label: 'Web app' },
  { code: 'api_or_developer_platform', label: 'API / developer platform' },
] as const;

export type ProductCategoryCode = (typeof PRODUCT_CATEGORIES)[number]['code'];

export const PRODUCT_CATEGORY_CODES: ReadonlySet<string> = new Set(
  PRODUCT_CATEGORIES.map((p) => p.code),
);
