-- BANK-03: plaid_items.retired_at / retired_reason — an item replaced by a fresh
-- link (a new Plaid item for the same institution and accounts) is RETIRED, never
-- deleted: its row and its Plaid item_id stay for history; retired_reason names
-- the item that replaced it ('replaced by <new item id>'). Sync skips a retired
-- item and reports it as retired; /api/accounts hides it.
--
-- ADDITIVE-ONLY: two nullable columns. Zero data rewrites. Applied by
-- `prisma migrate deploy` at deploy (schema.prisma moves with it).

ALTER TABLE plaid_items ADD COLUMN retired_at timestamptz NULL;
ALTER TABLE plaid_items ADD COLUMN retired_reason text NULL;
