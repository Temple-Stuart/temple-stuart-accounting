# MAXLINKED-ENFORCE — Phase 1 audit: **STOPPED for Alex's ruling (limit source ambiguous)**

**Date:** 2026-07-10 · **Branch:** `claude/maxlinked-enforce` · **Status:** read-only audit committed; NO enforcement code written.

**Why stopped:** the mandate's own tripwire — *"if the limit was tier-based but access is now
tab-based … if ambiguous, STOP and report for Alex's ruling (don't guess a number)."* The only
`maxLinkedAccounts` numbers that exist anywhere are **tier**-based (free 0 / pro 10 / pro_plus 25,
`src/lib/tiers.ts:48,59,70`), but since TAB-SERVER-GATE the Plaid routes are gated by the
**tab:books entitlement** (`link-token/route.ts:25`, `exchange-token/route.ts:25`), which is
purchased independently of tier. A customer who buys tab:books (or bundle:all) while remaining
tier `free` would resolve to `maxLinkedAccounts: 0` — enforcing the tier config as written would
**hard-block bank linking on the tab they paid for**, contradicting Alex's TAB-SERVER-GATE ruling
("pay for a tab = the whole tab works — banks link"). No per-tab limit is defined anywhere
(`TAB_PRICING` in `src/config/pricing-costs.ts` has no account-limit field; `src/lib/entitlements.ts`
defines none). Every buildable path therefore requires either a **number Alex has not defined**
(inventing = forbidden) or a **default-to-unlimited for tab:books users** (tripwired: never
default-to-unlimited). → Ambiguous. Stopped.

---

## 1. Flow map — where a link is created and where the check belongs

| Step | File:line | What happens | Persists anything? |
|---|---|---|---|
| 1. Link token | `src/app/api/plaid/link-token/route.ts:41` (`plaidClient.linkTokenCreate`) | Issues the token that opens the Plaid Link UI | No |
| 2. Public-token exchange | `src/app/api/plaid/exchange-token/route.ts:30` (`itemPublicTokenExchange`) | **Creates the live Item on Plaid's side** (billable until removed) | At Plaid, yes |
| 3. Item persist | `exchange-token/route.ts:61` (`prisma.plaid_items.create`) | The new link lands in our DB | Yes — the ONLY `plaid_items.create` in `src/` |
| 4. Account sync | `exchange-token/route.ts:74-132` (`accountsGet` → per-account create/update with dedup at `:81-111`) | 1..N `accounts` rows per item | Yes |

Both routes already gate `401 → 404 → requireTabAccess('tab:books')` before anything else
(`link-token:10-26`, `exchange-token:10-26`). **The count check belongs (once the limit is ruled):**

- **Real boundary:** `exchange-token/route.ts` — immediately after the tab gate (`:26`), **before
  `itemPublicTokenExchange` at `:30`**, i.e. before the Item even exists at Plaid (no billable
  item created for an over-limit user) and well before `plaid_items.create` at `:61`.
- **Fail-early mirror (UX):** `link-token/route.ts` — after the tab gate (`:26`), before
  `linkTokenCreate` at `:41`, so an at-limit user never gets a Link UI they can't complete.
  Defense-in-depth; the exchange-token check is the enforcement.

## 2. What the config actually defines (the real numbers)

`src/lib/tiers.ts` — `maxLinkedAccounts` on `TierConfig` (`:35`): **free = 0** (`:48`),
**pro = 10** (`:59`), **pro_plus = 25** (`:70`). Resolved via `getTierConfig(user.tier)` (`:74-77`).
The file's own header already flags it: *"maxLinkedAccounts is defined but ENFORCED NOWHERE"*
(`tiers.ts:15`). Prior flags: PRICING-AUDIT.md:119 ("zero enforcement found — the pricing page's
'10/25 accounts' bullets are cosmetic"), FRONTEND-PAYWALL-AUDIT.md:65 (PAYWALL-2 finding).
Note: those advertised bullets lived on the **old** pricing page; the PRICING-PAGE-SELL rebuild
(`src/app/pricing/PricingClient.tsx`) no longer advertises any account count — so Alex is free to
set the limit's shape without contradicting current marketing copy.

## 3. Limit-source ruling: **AMBIGUOUS → Alex must rule**

The contradiction, concretely: `requireTabAccess(user.id, 'tab:books')` passes on an active
`tab:books` **or** `bundle:all` entitlement row (`src/lib/entitlements.ts`) — `user.tier` is not
consulted. Tier and tab are independent purchases (webhook writes them separately, mixed-sub
guards in `api/stripe/webhook/route.ts`). So:

| User | Passes tab gate? | Tier config says | Enforcing tier config as-is |
|---|---|---|---|
| tab:books buyer, tier free | ✅ | `maxLinkedAccounts: 0` | **0 accounts on a paid tab — broken product** |
| pro tier, no tab:books | ❌ (never reaches the check) | 10 | moot — gate already 403s |
| pro tier + tab:books | ✅ | 10 | works, but only for this legacy combo |
| admin | ✅ (bypass) | — | bypass (consistent with every gate) |

**Options for Alex (pick one; no number is assumed):**
1. **Per-tab limit (cleanest fit):** define `maxLinkedAccounts` for the Books tab (config const
   next to the entitlement/tab definitions, env-tunable if desired). Alex supplies the number.
   Enforcement = every tab:books-gated linker gets that limit; tiers stop mattering here
   (consistent with tiers.ts:10-14: modules are not tier features anymore).
2. **Hybrid:** limit = `max(tierConfig.maxLinkedAccounts, booksTabLimit)` — only if legacy
   pro/pro_plus holders should keep larger allowances than a bare tab:books buyer.
3. **Tier as written:** enforce `tiers.ts` numbers exactly — listed for completeness, but it
   yields row 1 above (tab-only buyers get 0) and contradicts the TAB-SERVER-GATE ruling.

**Needed from Alex to unblock Phase 2:** (a) which option, and (b) the number for a tab:books
user under option 1/2. On his ruling the build is mechanical (insertion points in §1, count in §4).

## 4. Count-unit ruling: **ACCOUNTS, not items** (this half is NOT ambiguous)

Schema (`prisma/schema.prisma`): `plaid_items` (`:255-268`) = one row per institution link;
`accounts` (`:31-60`) = one row per bank account, `plaidItemId String?` **nullable** (`:33`),
`source String @default("plaid")` (`:50`). One item holds many accounts.

- The config field is named `maxLinked**Accounts**` (`tiers.ts:35`) and the previously advertised
  copy said "10 **accounts**" / "Up to 25 linked **accounts**" (FRONTEND-PAYWALL-AUDIT.md:65) —
  both denominate in accounts, not institutions. → **Count accounts.**
- The `accounts` table also holds **manual** accounts (`source: 'manual'`, created at
  `src/app/api/transactions/manual/route.ts:49-55`, free-tier manualEntry). These are not
  "linked" and must NOT consume the limit. → **Count = `prisma.accounts.count({ where: { userId:
  user.id, plaidItemId: { not: null } } })`** — user-scoped, linked-only.

**Wrinkle to enforce honestly (flagging now for the Phase-2 design):** one exchange lands 1..N
accounts at once (`exchange-token:78`), so a pure pre-check (`existing >= limit → 403`) still lets
a user at limit−1 land several accounts over in a single link. Full enforcement needs a second
check after `accountsGet` (`:74`) — existing + incoming > limit → reject the whole link — but by
then the Item already exists at Plaid, so the reject path should call `itemRemove` before the 403
(never persist a half-link, never silently keep a rejected item alive and billable). Partial
persistence (keep the first K accounts, drop the rest) is a silent-fallback shape — not proposed.

## 5. Tripwires honored in this audit

- **No invented number** — no limit value proposed for tab:books; the 0/10/25 above are quoted
  from config, not chosen.
- **No default-to-unlimited** — the STOP exists precisely because the only non-inventing
  alternative was unlimited-by-default, which is forbidden.
- **No code written** — Phase 2 untouched; the entitlement gate on both routes is unchanged.
