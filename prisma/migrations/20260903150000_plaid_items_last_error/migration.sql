-- BANK-01: plaid_items.last_error_code / last_error_at — the item's last Plaid
-- ITEM_ERROR (ITEM_LOGIN_REQUIRED and its kin), recorded by sync-complete when
-- Plaid refuses the item and cleared by reconnect-complete once /item/get
-- reports the item healthy again (Plaid Link update mode). The Books page reads
-- them to offer Reconnect on the rows that need it. The code, never the message
-- and never a token: the error text stays in the server log.
--
-- ADDITIVE-ONLY: two nullable columns. Zero data rewrites. Applied by
-- `prisma migrate deploy` at deploy (schema.prisma moves with it).

ALTER TABLE plaid_items ADD COLUMN last_error_code text NULL;
ALTER TABLE plaid_items ADD COLUMN last_error_at timestamptz NULL;
