-- Drop old constraint
ALTER TABLE chart_of_accounts DROP CONSTRAINT IF EXISTS chart_of_accounts_entity_type_check;

-- Add new constraint with 'trading'
ALTER TABLE chart_of_accounts ADD CONSTRAINT chart_of_accounts_entity_type_check 
  CHECK (entity_type IN ('personal', 'business', 'trading'));
