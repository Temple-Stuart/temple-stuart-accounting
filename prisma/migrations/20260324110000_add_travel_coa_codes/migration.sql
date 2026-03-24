-- Insert travel-specific COA codes (P-9xxx for personal, B-9xxx for business)
-- These are inserted for all existing personal and business entities.
-- Uses ON CONFLICT DO NOTHING to be idempotent.

-- Personal Travel COA codes (for every personal entity)
INSERT INTO chart_of_accounts (id, "userId", entity_id, code, name, account_type, balance_type, sub_type, module, is_archived, created_at, updated_at)
SELECT
  gen_random_uuid(), e."userId", e.id, v.code, v.name, 'expense', 'D', 'travel', 'trips', false, NOW(), NOW()
FROM entities e
CROSS JOIN (VALUES
  ('9100', 'Travel Flights'),
  ('9200', 'Travel Lodging'),
  ('9300', 'Travel Vehicle Rental'),
  ('9350', 'Travel Equipment Rental'),
  ('9400', 'Travel Activities & Entertainment'),
  ('9450', 'Travel Nightlife'),
  ('9500', 'Travel Meals & Dining'),
  ('9600', 'Travel Ground Transport'),
  ('9700', 'Travel Coworking'),
  ('9800', 'Travel Incidentals & Supplies'),
  ('9900', 'Travel Insurance'),
  ('9950', 'Travel Tips & Misc')
) AS v(code, name)
WHERE e.entity_type = 'personal'
ON CONFLICT ("userId", entity_id, code) DO NOTHING;

-- Business Travel COA codes (for every business entity)
INSERT INTO chart_of_accounts (id, "userId", entity_id, code, name, account_type, balance_type, sub_type, module, is_archived, created_at, updated_at)
SELECT
  gen_random_uuid(), e."userId", e.id, v.code, v.name, 'expense', 'D', 'travel', 'trips', false, NOW(), NOW()
FROM entities e
CROSS JOIN (VALUES
  ('9100', 'Business Travel Flights'),
  ('9200', 'Business Travel Lodging'),
  ('9300', 'Business Travel Vehicle Rental'),
  ('9350', 'Business Travel Equipment Rental'),
  ('9400', 'Business Travel Activities & Entertainment'),
  ('9450', 'Business Travel Nightlife'),
  ('9500', 'Business Travel Meals & Dining'),
  ('9600', 'Business Travel Ground Transport'),
  ('9700', 'Business Travel Coworking'),
  ('9800', 'Business Travel Incidentals & Supplies'),
  ('9900', 'Business Travel Insurance'),
  ('9950', 'Business Travel Tips & Misc')
) AS v(code, name)
WHERE e.entity_type = 'business'
ON CONFLICT ("userId", entity_id, code) DO NOTHING;
