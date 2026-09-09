-- LAUNCH-01 — what a customer-facing launch cannot ship with.
--
-- TIER-01: users.tier had four readers (api/auth/me select, api/auth/signup
-- create, api/owner/accounts select + wire, app/owner/page.tsx render) and no
-- gate — the offer's entitlement rows (user_category_entitlements) are the only
-- access model since SELL-05b. Every reader is removed in this PR; the column
-- goes with them. Values were 'free' for every row the product wrote since
-- SELL-05b (the webhook stopped writing it there); no view or trigger reads it
-- (grep of prisma/migrations and scripts: none).
ALTER TABLE "users" DROP COLUMN "tier";

-- LAPSE-01: when and why an entitlement ended. Written by the Stripe webhook —
-- customer.subscription.deleted → 'canceled'; invoice.payment_failed →
-- 'payment_failed' — beside status 'inactive'. NULL while active or never
-- lapsed; a re-grant (grantEntitlement active) clears both. Read by
-- /api/auth/me (the locked card's "Your subscription ended on <date>") and by
-- requireTabAccess (the 403 says the same — never a bare 403).
ALTER TABLE "user_category_entitlements"
  ADD COLUMN "ended_at" TIMESTAMPTZ(6),
  ADD COLUMN "ended_reason" VARCHAR(32);

ALTER TABLE "user_category_entitlements"
  ADD CONSTRAINT "user_cat_entitle_ended_reason_chk"
  CHECK ("ended_reason" IS NULL OR "ended_reason" IN ('canceled', 'payment_failed'));
