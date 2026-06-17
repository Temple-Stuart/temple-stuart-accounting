# Hotel amortization not firing + hotel vanishes after week 1 (READ-ONLY AUDIT)

**Mandate:** Truth-first, read-only, every claim cites file:line. No fixes. Labels:
EXISTS / MISSING / RISK.

**Headline (two INDEPENDENT roots, both found):**
- **BUG 1 — amortization shows full amount:** `perDayBudget` is **NOT on `origin/main`**. PR
  952648f0 (`claude/pr-hotel-daily-amortize`) was built + pushed but **never merged**
  (`git merge-base --is-ancestor 952648f0 origin/main` → **NO**). `perDayBudget`, `isLodgingCoa`,
  `coaCode` do not exist in the deployed code; both footer reduces still do the **raw
  `budgetAmount` sum** (`CalendarGrid.tsx:816, :838`). It's not "not firing" — it's **not
  deployed**. — MISSING (merge), root of BUG 1.
- **BUG 2 — hotel vanishes in week 2+:** the visible-range fetch filters by **`start_date` only**
  (`calendar/route.ts:33-34`): `start_date >= from AND start_date <= to`. A hotel starting Jul 1
  is **excluded** from week-2's `[Jul 5, Jul 11]` window (`Jul 1 >= Jul 5` is false) → never
  fetched → no membership → blank. Month view fetches `[Jul 1, Jul 31]`, so `start_date=Jul 1` is
  included and Span-Fill spreads it onto Jul 5–11. **The two views fetch different windows; the
  query misses events that START before the window but SPAN into it.** — RISK, root of BUG 2.

---

## 1. perDayBudget — merged? called?

- **NOT merged.** `git merge-base --is-ancestor 952648f0 origin/main` → **NO**. `origin/main` tip
  is `f310c5fc` (#979 label-truncate); the most recent hotel merge is #978 (the *audit*), not the
  amortize *build*. Grep on the deployed `CalendarGrid.tsx` for `perDayBudget`, `isLodgingCoa`,
  `LODGING_COA_CODE`, `coaCode` → **zero matches**. — MISSING.
- **Footer reduces still raw-sum** (the pre-amortize code):
  - Week/Day: `CalendarGrid.tsx:816` `const total = dayEvents.reduce((s, e) => s + (e.budgetAmount || 0), 0)`.
  - Month: `:838` `const dayTotal = dayEvents.reduce((sum, e) => sum + (e.budgetAmount || 0), 0)`.
  Neither calls `perDayBudget` (it doesn't exist). So every member day adds the hotel's **full**
  `budgetAmount` → the -$2,009-on-every-day symptom. — EXISTS (raw sum), `:816, :838`.

## 2. Amortization flag — would it match THIS hotel (once merged)?

The amortize code lives only on the unmerged branch, but checking its conditions against the real
hotel (so the merge is known to fix BUG 1, not mask a second failure):

- `coa_code`: `vendor-commit` writes `${prefix}-9200` for lodging (`VENDOR_TYPE_TO_COA.lodging =
  '9200'`, `route.ts:13`; stored at the `calendar_events` INSERT `:399-400`). So this hotel's
  `coa_code` = `P-9200` (personal trip) or `B-9200`. `isLodgingCoa` checks `c.split('-').pop() ===
  '9200'` → **matches**. ✓
- `startTime`: lodging commits write **null** `start_time` (`vendor-commit` `calStartTime = null`
  for non-flight) → the GridEvent `startTime` is null → all-day. **`!e.startTime` true.** ✓
- `endDate !== startDate`: Jul 1 vs ~Jul 31 → **true.** ✓
- `coaCode` plumb: the amortize branch also adds `coaCode` to the GridEvent type + the HubCalendar
  map (`coaCode: e.coa_code`). On `origin/main` neither exists, so even the input is absent. —
  MISSING (on main).

→ **All three predicate conditions WOULD pass** for this hotel. The only reason full amount shows
is that the function isn't deployed (§1). Merging 952648f0 fixes BUG 1. — confirms BUG 1 = merge.

## 3. $2,009 vs $2,010 + a trace

- `calendar_events.budget_amount` = `Math.round(details.amount)` (`vendor-commit` INSERT) — an
  **integer**. The displayed -$2,009 means `budget_amount = 2009` (the stay total rounded). —
  EXISTS.
- **Trace (post-merge) for one day, real values** `budgetAmount=2009`, `startDate='2026-07-01'`,
  `endDate='2026-07-31'`, `coaCode='P-9200'`, `startTime=null`:
  - `isLodgingSpannedAllDay` = true (§2).
  - `nights = round((Jul31 − Jul1)/86_400_000) = 30`.
  - A night (e.g. Jul 5): `2009 / 30 = 66.966…` → footer formats `fractionDigits:0` → **"$67"**.
  - Checkout (Jul 31 == endKey): **$0**.
  - Float sum across the 30 nights = `2009` exactly (reconciles to the stored total). — EXISTS.
- **Minor display note (not a bug):** each day rounds `66.97→$67`, so the *visible* per-day
  figures sum to `30 × $67 = $2,010` (a $1 rounding-display drift vs the stored $2,009). The
  underlying float arithmetic is exact; only the rounded-to-whole-dollar labels drift. — RISK
  (cosmetic).
- **On `origin/main` today** (no perDayBudget): the day returns the raw `budgetAmount = 2009` →
  the footer shows **-$2,009** on every member day. — that is the current behavior.

## 4. Week-2 vanish — membership vs fetch

- **Membership is NOT the cap.** Span-Fill pushes **every** day start→end inclusive
  (`CalendarGrid.tsx:396-413`): `dayDiff = round((endD − startD)/86_400_000)` then `for (off=1;
  off<=dayDiff; off++) pushOn(...)` — for Jul 1→Jul 31 it pushes all 31 days. No loop cap. Both
  week and month read the SAME `eventsByDateKey`/`getEventsForDate`. So **if the hotel is in
  `events`, it is a member of all 30 days in BOTH views.** — EXISTS (membership is complete).
- **The FETCH is the cap.** `HubCalendar` fetches `/api/calendar?from=${range.from}&to=${range.to}`
  (`HubCalendar.tsx:125`), where `range` is the grid's VISIBLE window
  (week → `[weekStart, weekStart+6]`). Week 2 = `[2026-07-05, 2026-07-11]`. The hotel
  (`start_date=2026-07-01`) is filtered OUT (§5) → it's **not in `events`** → not a member → blank.
  Month view's range is `[2026-07-01, 2026-07-31]`, so `start_date=Jul 1` is fetched → member of
  all days → shows on Jul 5–11. **Week and month DISAGREE because they fetch different windows,
  and the query keys on `start_date`.** — RISK, `HubCalendar.tsx:125` + `calendar/route.ts:33-34`.

## 5. FETCH WINDOW — the exact WHERE clause

`calendar/route.ts:29-36` (from/to mode):
```
if (fromParam && toParam && …) {
  events = await prisma.$queryRaw`
    SELECT * FROM calendar_events
    WHERE user_id = ${user.id}
    AND start_date >= ${fromParam}::date        -- :33
    AND start_date <= ${toParam}::date          -- :34
    ORDER BY start_date ASC`;
}
```
**It bounds `start_date` on BOTH sides** — so an event whose `start_date` is **before** `from` is
excluded **regardless of `end_date`**. A multi-day hotel `start_date=Jul 1, end_date=Jul 31`
viewed as week 2 (`from=Jul 5`) fails `start_date >= Jul 5` → **not returned**. The **correct
overlap test** for "does this event intersect the window" is:
```
start_date <= ${to}  AND  (end_date >= ${from}  OR  end_date IS NULL)
```
(`end_date IS NULL` = a single-day event, which overlaps iff `start_date` is in `[from,to]` — still
covered by `start_date <= to` combined with the existing lower bound being dropped; a single-day
event with `start_date < from` and null end legitimately does NOT overlap, so the null arm must
still require `start_date >= from`). The current clause has **no `end_date` term at all** — the
root of BUG 2. — RISK, `calendar/route.ts:33-34`.

**Same flaw in the other two modes** (latent): month (`:46-47` `start_date >= monthStart AND
start_date < monthEnd`) and year (`:57-58`) also key on `start_date` only. A hotel **spanning a
month boundary** (e.g. Jun 28 → Jul 5) viewed in **July** (`hub/page.tsx:194`, year/month mode)
would likewise vanish — `start_date=Jun 28 < Jul 1`. THIS hotel (entirely within July) is spared
in month view only because its `start_date` happens to fall inside the month window. — RISK,
`calendar/route.ts:46-47, 57-58`.

---

## Explicit answers

**(a) Is perDayBudget merged + called? Which condition fails?** **NOT merged** — 952648f0 is not an
ancestor of `origin/main`; `perDayBudget`/`isLodgingCoa`/`coaCode` are absent and the footers do
the raw `budgetAmount` sum (`CalendarGrid.tsx:816, :838`). So it returns the full amount because it
**doesn't exist in deployed code**, NOT because a predicate fails — all three conditions
(`coa_code` suffix 9200 ✓, `startTime` null ✓, `endDate !== startDate` ✓) WOULD pass for this
hotel once merged (§2).

**(b) Bug 2 root — does the fetch exclude events starting before the window?** **YES.**
`calendar/route.ts:33-34` filters `start_date >= from AND start_date <= to` — `start_date` only,
no `end_date` term. A hotel `start_date=Jul 1` is excluded from week-2 `[Jul 5, Jul 11]`. The fetch
must use a range-overlap predicate (`start_date <= to AND (end_date >= from OR end_date IS NULL …)`)
to include multi-day events that begin before the window but span into it.

**(c) Are bug 1 and bug 2 related?** **Independent roots, compounding symptom.** BUG 1 =
unmerged amortize PR (a *display-math* gap). BUG 2 = fetch-overlap (a *data-availability* gap).
Fixing one does not fix the other: merge 952648f0 and the hotel still vanishes in week 2; fix the
WHERE and the hotel reappears but (until the merge) shows the full -$2,009 amortization-free.
**Both are needed.** They share only the victim (the multi-day hotel) and the fact that membership
(Span-Fill) is correct in both — the failures are upstream (fetch) and downstream (footer math).

**(d) Recommended fixes.**
1. **BUG 1 — merge `claude/pr-hotel-daily-amortize` (952648f0). SMALL** (no new code — the PR is
   built, tsc/lint-clean, reconciliation-verified). Just merge to `main`. After merge, month view
   shows $67/night, $0 checkout.
2. **BUG 2 — range-overlap fetch. SMALL-MED.** In `calendar/route.ts` from/to mode (`:29-36`),
   replace the `start_date`-only bounds with the overlap predicate:
   `start_date <= ${to}::date AND (end_date >= ${from}::date OR (end_date IS NULL AND start_date >= ${from}::date))`.
   Apply the same to month/year modes (`:46-47, 57-58`) to fix cross-month spans. **RISK to verify:**
   the per-source summary totals (`calcTotal`, `:64`) sum `budget_amount` over the **fetched** rows
   — a wider overlap fetch now includes a hotel that starts before the window, so `tripTotal` for a
   week-2 fetch would include the full hotel amount. Confirm no consumer treats the per-fetch
   `summary` as a window-scoped total (HubCalendar reads `events`, not `summary`, for the grid — so
   the grid is fine; the `summary` block is the thing to audit before relying on it).

### Citation index
- Unmerged amortize: `git merge-base --is-ancestor 952648f0 origin/main` → NO; deployed footers
  `CalendarGrid.tsx:816, :838` (raw sum, no `perDayBudget`).
- Span-Fill membership (complete, not the cap): `CalendarGrid.tsx:396-413`.
- Fetch WHERE (BUG 2): `calendar/route.ts:29-36` (`:33-34` from/to), `:46-47` month, `:57-58` year.
- Caller windows: `HubCalendar.tsx:125` (from/to, week-2 vanish), `hub/page.tsx:194` (year/month).
- Lodging COA + null start_time at source: `vendor-commit/route.ts:13, :399-400`.
- Per-fetch summary totals (RISK on widened fetch): `calendar/route.ts:64-73`.

*Do not implement — audit only.*
