-- Merchant to COA mapping table for auto-categorization
CREATE TABLE merchant_coa_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_name VARCHAR(255) NOT NULL,
  plaid_category_primary VARCHAR(100),
  plaid_category_detailed VARCHAR(100),
  coa_code VARCHAR(50) NOT NULL REFERENCES chart_of_accounts(code),
  sub_account VARCHAR(100),
  usage_count INTEGER DEFAULT 1,
  confidence_score DECIMAL(3,2) DEFAULT 1.0,
  last_used_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW(),
  created_by UUID,
  
  UNIQUE(merchant_name, plaid_category_primary)
);

CREATE INDEX idx_merchant_lookup ON merchant_coa_mappings(merchant_name);
CREATE INDEX idx_category_lookup ON merchant_coa_mappings(plaid_category_primary);

-- Category to COA default mappings
CREATE TABLE category_coa_defaults (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plaid_category_primary VARCHAR(100) NOT NULL UNIQUE,
  plaid_category_detailed VARCHAR(100),
  coa_code VARCHAR(50) NOT NULL REFERENCES chart_of_accounts(code),
  entity_type VARCHAR(10) CHECK (entity_type IN ('personal', 'business')),
  created_at TIMESTAMP DEFAULT NOW()
);
