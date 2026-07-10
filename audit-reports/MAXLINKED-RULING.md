# MAXLINKED-RULING — Alex's ruling on the maxLinkedAccounts question (2026-07-10)

**Status:** ruling recorded. **No enforcement code exists or was added** — this document closes the
STOP raised in `MAXLINKED-ENFORCE-AUDIT.md` (branch `claude/maxlinked-enforce`, commit `9eecc30c`),
which found the limit source ambiguous: the only defined numbers are tier-based
(free 0 / pro 10 / pro_plus 25, `src/lib/tiers.ts:48,59,70`) while Plaid access is gated by the
tab:books entitlement, so a tab-only buyer resolves to tier `free` = 0 accounts.

## DECISION (Alex, this session)

**No artificial account cap on tab:books buyers right now — they link what they need.**
The tier-based `maxLinkedAccounts` (free 0 / pro 10 / pro_plus 25) is **NOT enforced** against tab
buyers, because enforcing it as written would wrongly block a paying Books-tab user (a tab:books
purchase is independent of tier; such a user resolves to tier `free` → `maxLinkedAccounts: 0` →
zero bank links on a paid tab). The config values in `tiers.ts` remain defined-but-unenforced,
exactly as the file's own header states (`tiers.ts:15`).

## FUTURE FEATURE (not built): usage-tiered pricing

Price scales with linked-account count — pay more for more accounts. This is a real multi-PR
feature, not a finisher:

- Stripe metered/graduated pricing (new products/prices, webhook handling for quantity changes),
- bracket logic server-side (count → price bracket, upgrade prompts at bracket edges),
- upgrade/downgrade flows in the UI.

It is to be **designed from REAL customer usage data once there are customers** — bracket
boundaries and prices are not to be guessed now. Nothing in this ruling pre-commits a number.

## WHY DEFERRED

- **No customers yet** — there is no usage data to size brackets from, and no revenue at risk.
- **The real cost hole is already capped** — the scan pipeline (the expensive paid surface) got a
  per-user run quota in SCAN-SPEND-QUOTA (`735508e5`, 4 runs/hr/user proposed default,
  `src/lib/scan-rate-limit.ts`).
- **Plaid per-item cost for a normal Books user is low** — a handful of institution links, not a
  runaway-spend shape like the scan was.
- **No advertised promise is being broken** — the old pricing page's "10/25 accounts" bullets were
  removed in the PRICING-PAGE-SELL rebuild; the current page promises no account count.

## PRESERVED for when the feature is built

The count-unit analysis from `MAXLINKED-ENFORCE-AUDIT.md` stands and should be reused:

- **Count accounts, not items** — one Plaid item holds many accounts
  (`prisma/schema.prisma:255-268` vs `:31-60`), and the field/marketing language denominates in
  accounts.
- **Count = `prisma.accounts.count({ where: { userId, plaidItemId: { not: null } } })`** —
  user-scoped, linked-only; manual accounts (`source: 'manual'`,
  `src/app/api/transactions/manual/route.ts:49-55`) never consume a limit.
- **Insertion points** (mapped, unused for now): `exchange-token/route.ts` before
  `itemPublicTokenExchange` (`:30`, before a billable Plaid Item exists; `plaid_items.create` at
  `:61` is the only create site) plus a fail-early mirror in `link-token/route.ts` before
  `linkTokenCreate` (`:41`).
- **Multi-account-per-exchange wrinkle**: one exchange lands 1..N accounts, so bracket/limit
  enforcement needs a post-`accountsGet` check (reject whole link + `itemRemove`), never partial
  persistence.
