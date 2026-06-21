# IS `GET /api/trading` REACHABLE? — REACHABILITY AUDIT (read-only)

**Branch:** `claude/audit-trading-route-reachability` · **Date:** 2026-06-21 · **Scope:** is the **bare** `GET /api/trading` handler (`src/app/api/trading/route.ts`) called by anything, or dead code? Read-only; every claim cites `file:line`. Whole-repo grep (not just `src`).

---

## VERDICT: **DEAD** (no caller anywhere in the codebase)

**No code in the repository calls the bare `/api/trading` route.** Every `/api/trading*` reference is either a **different subroute** (`/api/trading/trades`, `/api/trading/commit-to-ledger`, `/api/trading/convergence`, `/api/trading-journal`, `/api/trading-positions/*`) or text inside **audit `.md` docs** (mine). One honest caveat: Next.js file-based routing keeps the handler **HTTP-accessible** to an authenticated client who hits the URL directly — so it's "dead" in the sense that **nothing in the app invokes it**, not that the endpoint is removed from the server.

---

## 1. EXACT-MATCH CALLERS — MISSING

Grepped the whole repo (excluding `node_modules`/`.next`) across `.ts/.tsx/.js/.jsx/.mjs/.json/.yml/.yaml` for the bare path, distinguishing `/api/trading` from `/api/trading/*` and `/api/trading-*`:
- `grep -rn "/api/trading" … | grep -E "/api/trading([^a-z/-]|'|\"|\`)" | grep -vE "/api/trading/|/api/trading-"` → **empty in all code files.** **MISSING.**
- The only bare `/api/trading` string hits in the entire repo are in **audit docs I authored**: `audits/TRADING-COA-FIX-PLAN.md:85` (and the same path quoted in `TRADING-ROUTE-AUTH.md`) — **documentation, not callers.**

**Full `/api/trading*` distribution (whole repo, `uniq -c` of matched paths):**
| Path | count | Is it the bare route? |
|---|---|---|
| `/api/trading` (bare) | 3 | **No — all in audit `.md` docs** |
| `/api/trading/` | 1 | route-file/path reference, not a call |
| `/api/trading/trades` | 2 | different subroute (`trading/page.tsx:422`) |
| `/api/trading/commit-to-ledger` | 4 + 1 route | different subroute (`trading/page.tsx:606`) |
| `/api/trading/convergence` | 29 + 1 route | different subroute |
| `/api/trading-journal` | 4 + 1 route | different route (`trading/page.tsx:423,699`) |
| `/api/trading-positions/open` | 2 | different route |
| `/api/trading-positions/reset` | 1 | different route |

No row resolves to a call of the **bare** `GET /api/trading`. **MISSING.**

## 2. INDIRECT / DYNAMIC URL CONSTRUCTION — MISSING

Grepped `src` for dynamic builders (`base + '/trading'`, `'/trading'` concatenation, route maps, API-client wrappers): the only hit was `trade-card-links/route.ts:6` — a **doc comment** ("Link a trade card to a trading position"), **not** a URL builder. No `tradingUrl`/`TRADING_URL`/route-map/`+ '/trading'` construction found. **MISSING** — the route is not assembled dynamically anywhere.

## 3. NON-SRC CALLERS — MISSING

Checked outside `src`: `scripts/` (contents: `assert-showroom-fetch-free.mjs`, `pre-pra-export.sh`, `probe-liteapi-*`, `sdk-probe.html`, `tax-export-2025.ts` — none reference trading), `tests/`/`test/`, `.github/`, `prisma/`. `grep -rn "api/trading"` across those, excluding subroutes → **no hit.** No cron/Inngest function calls it (Inngest functions live in `src/inngest/`; none reference `/api/trading`). **MISSING.**

## 4. ROUTE METADATA

`src/app/api/trading/route.ts`:
- **HTTP methods exported:** **`GET` only** — `export async function GET()` (`:5`). No `POST`/`PUT`/`DELETE`/`PATCH` (grep count of other methods = 0). EXISTS (GET-only).
- **Success return (purpose):** a **trading-dashboard summary** of the authenticated user's trading data — `{ summary: { totalRealizedPL, optionRealizedPL, stockRealizedPL, openPositionsCount, closedTradeCount, totalContributions, totalWithdrawals }, byStrategy[], openPositions[], recentTrades[], recentTransactions[] }` (`:25-30` empty-case shape; the full shape is built later in the handler). Read-only aggregation — no writes. EXISTS.

## 5. VERDICT — DEAD

**DEAD — no caller found anywhere in the repository.**
- **Evidence:** zero bare-`/api/trading` calls in any code file (`§1`), no dynamic URL construction (`§2`), no non-`src` caller (`§3`). The only bare references are audit-doc prose. The route exports only `GET` (`§4`).
- **Honest caveat (why not "removed"):** Next.js file-based routing means the handler is still **HTTP-reachable** — an authenticated client hitting `GET /api/trading` directly would run it (it's behind the cookie gate, `§ prior audit`). So it is **dead code from the application's perspective** (nothing invokes it), but the **endpoint physically exists** and would respond. It is **not** "NOT VERIFIED": the codebase search is exhaustive and conclusive that **no in-repo code calls it.** External/manual HTTP access is the only path that reaches it.

**Implication for the prior audit's defects:** the `:35-36` unscoped query and the `:108,111` `T-3200/T-3300` $0 bug live in **dead-from-the-app code** — low urgency; they only matter if the route is revived/wired to a UI or hit directly. A separate decision (out of scope here) is whether to **delete** the dead route entirely vs. fix-and-wire it.

---

*Read-only audit. No code changed; this `.md` is the only file created. Verdict from exhaustive code search; HTTP-accessibility via file-routing noted honestly.*
