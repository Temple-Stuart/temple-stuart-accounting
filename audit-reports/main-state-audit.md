# Travel PRs — Main State Audit (read-only)

Branch: `claude/main-state-audit`. No code changes. Every claim cites `git`
output.

main HEAD: `562f645c` — Merge pull request #610 from
Temple-Stuart/claude/travel-liteapi-pr-3b.

---

## TL;DR

**All four PRs are on main.** PR-1, PR-2's code, PR-3, and PR-3b are all
present and active. The user's recollection that "PR-2 had merge conflicts
and was never merged" is half-true: there is **no explicit PR-#-style merge
commit** for `claude/travel-registry-pr-2`, **but the identical code landed
on main as commit `a30071f6` brought along by the PR-3 merge** (PR-3 was
based on the rebased PR-2 branch, so its merge dragged PR-2's commit in
behind it). The `travelSourceRegistry.ts` file is on main, the route
dispatches via `getSource()`, `UnimplementedSourceError` is wired, and
`accommodation` is registered as `{ source: 'liteapi', hardBookable: true }`
(updated from PR-2's `'google'` placeholder by PR-3).

---

## Last 10 commits on main

```
562f645c Merge pull request #610 from Temple-Stuart/claude/travel-liteapi-pr-3b
afa50df5 Travel-LiteAPI-PR-3b: booking flow (prebook+book), reservations table, commission ledger
e9fefdd1 Merge pull request #609 from Temple-Stuart/claude/travel-liteapi-pr-3
1d12a103 Travel-LiteAPI-PR-3: Accommodation via LiteAPI (bookable inventory, fail-loud, sandbox)
a30071f6 Travel-Registry-PR-2: SOURCE_BY_CATEGORY declarative routing keystone
692b5a69 Merge pull request #608 from Temple-Stuart/claude/travel-faillout-pr-1
cc6bd3e6 Merge pull request #607 from Temple-Stuart/claude/travel-category-source-audit
007976f2 Travel-FailLoud-PR-1: surface real API errors (kill 13 silent-swallow points)
e90a708b audit(travel): category->source wiring map for per-category provider routing
1f2fe9e2 Merge pull request #606 from Temple-Stuart/claude/travel-triple-empty-audit
```

Note the merge for PR-2 is missing — the commit `a30071f6` sits between
PR-3's commit and PR-1's merge as a non-merge commit, because it rode along
on PR-3's branch when PR #609 merged.

---

## Per-PR status (cited)

### PR-1 (Fail-Loud Typed Errors) — **ON MAIN ✓**
- File present: `src/lib/travelErrors.ts` (76 lines).
- Last touched: commit `1d12a103` (PR-3, added LiteAPI error types) — full
  log: `1d12a103` (PR-3) ← `007976f2` (PR-1, original).
- Route imports: `src/app/api/trips/[id]/ai-assistant/route.ts:11-19`
  imports `MissingGoogleKeyError`, `GooglePlacesApiError`,
  `MissingViatorKeyError`, `ViatorApiError`, `MissingLiteApiKeyError`,
  `LiteApiError` from `@/lib/travelErrors`.
- Explicit merge commit on main: **`692b5a69`** (Merge PR #608).

### PR-2 (`SOURCE_BY_CATEGORY` Registry) — **ON MAIN ✓** (via PR-3's merge, no explicit PR-2 merge commit)
- File present: `src/lib/travelSourceRegistry.ts` (120 lines).
- Last touched: commit `1d12a103` (PR-3 flipped accommodation entry to
  LiteAPI) ← `a30071f6` (PR-2 original).
- Route uses: `src/app/api/trips/[id]/ai-assistant/route.ts:20` imports
  `getSource, UnimplementedSourceError`; `:170` calls
  `getSource(category)`; `:176` throws `UnimplementedSourceError`; `:414`
  catches it.
- No PR-#-style merge commit. The work arrived as a non-merge commit
  `a30071f6` carried by PR-3.
- `claude/travel-registry-pr-2` branch (commit `573fa942`) is still in
  origin; `git diff origin/claude/travel-registry-pr-2 origin/main --
  src/lib/travelSourceRegistry.ts` shows the **only difference is the
  accommodation entry** (PR-2 had it `'google'` placeholder; main has it
  `'liteapi', hardBookable: true` after PR-3's flip). Everything else
  identical. The branch is **stale** — its code IS on main, just updated
  by PR-3.

### PR-3 (LiteAPI Search) — **ON MAIN ✓**
- File present: `src/lib/liteapiClient.ts` (463 lines — includes PR-3b's
  prebook/book additions).
- Last touched: `afa50df5` (PR-3b extensions) ← `1d12a103` (PR-3 original
  search-only).
- Route uses: `src/app/api/trips/[id]/ai-assistant/route.ts:10` imports
  `searchHotelRates, liteApiHotelToRecommendation`; `:180` has
  `if (source === 'liteapi')` branch; `:198` calls `searchHotelRates`.
- `accommodation` in `travelSourceRegistry.ts` reads
  `{ source: 'liteapi', hardBookable: true }`.
- Explicit merge commit on main: **`e9fefdd1`** (Merge PR #609).

### PR-3b (Booking flow + reservations + commission_ledger) — **ON MAIN ✓**
- Schema models present at `prisma/schema.prisma:1100` (`model
  reservations`) and `prisma/schema.prisma:1132` (`model commission_ledger`).
- Migration present:
  `prisma/migrations/20260528000000_travel_reservations_commission_ledger/migration.sql`.
- Routes present: `src/app/api/travel/liteapi/prebook/route.ts` and
  `src/app/api/travel/liteapi/book/route.ts`.
- UI wiring present: `src/components/trips/TripPlannerAI.tsx:34`
  (`liteapiOfferId?` field), `:197` (`reservedKeys` state), `:570-628`
  (`handleLiteApiReserve` handler).
- Client extensions: `src/lib/liteapiClient.ts` includes `prebookRate` and
  `bookRate` (both added by `afa50df5`).
- Explicit merge commit on main: **`562f645c`** (Merge PR #610) — current
  HEAD.

---

## Open `claude/` travel branches and their position vs main

Filtered to travel-related branches:

| Branch | Ahead of main | Behind main | Content status |
|---|---|---|---|
| `claude/travel-category-source-audit` | 0 | 8 | Merged (PR #607) — branch stale |
| `claude/travel-data-pr-1-google-discipline` | 0 | 20 | Older PR — stale, code likely subsumed |
| `claude/travel-faillout-pr-1` | 0 | 8 | Merged (PR #608) — branch stale |
| `claude/travel-liteapi-pr-3` | 0 | 3 | Merged (PR #609) — branch stale |
| `claude/travel-liteapi-pr-3b` | 0 | 1 | Merged (PR #610) — branch stale |
| `claude/travel-profile-pr-a-remove` | 0 | 16 | Older PR — stale |
| `claude/travel-profile-truth-audit` | 0 | 16 | Audit only — stale |
| `claude/travel-registry-pr-2` | **1** | 9 | **Code IS on main via PR-3** (commit `a30071f6`); branch carries the pre-rebase commit `573fa942` — diff vs main is only the temporary accommodation placeholder that PR-3 overwrote. **Stale, no action needed.** |
| `claude/travel-scan-pipe-audit` | 0 | 20 | Audit only — stale |
| `claude/travel-search-0results-audit` | 0 | 12 | Audit only — stale |
| `claude/travel-search-bar` | **1601** | 203 | Major divergent branch — NOT part of this PR sequence. Out of scope for this audit. |
| `claude/travel-tab-reality-audit` | 0 | 35 | Audit only — stale |
| `claude/travel-triple-empty-audit` | 0 | 12 | Audit only — stale |

---

## Plain restatement

**On main right now:**
- A: PR-1 — typed errors module (`travelErrors.ts`), fail-loud propagation in `placesSearch.ts`, `viatorClient.ts`, the scan route's outer catch, and the UI banner. Verified by `692b5a69` merge + file presence.
- B: PR-2 — `travelSourceRegistry.ts` + the `getSource()` dispatch in the scan route + `UnimplementedSourceError`. Verified by `travelSourceRegistry.ts` (120 lines) + route imports at `:20, 170, 176, 414`. **Arrived without an explicit merge commit** — rode along on PR-3's PR #609 merge.
- C: PR-3 — LiteAPI search client + the route's `if (source === 'liteapi')` branch + the registry flip (`accommodation → liteapi, hardBookable: true`). Verified by `liteapiClient.ts` (463 lines), `e9fefdd1` merge, route line `:180`.
- D: PR-3b — booking flow (`prebookRate` + `bookRate` on the client), `reservations` + `commission_ledger` models + migration, `/api/travel/liteapi/prebook` + `/api/travel/liteapi/book` routes (auth'd, user-scoped), Reserve button on `TripPlannerAI.tsx`. Verified by `562f645c` merge (HEAD), schema lines `:1100 / :1132`, migration file, and route file presence.

**Pending on branches (not on main):**
- **Nothing from the active PR sequence is pending.** The PR-2 branch
  (`claude/travel-registry-pr-2`, commit `573fa942`) is technically "1
  ahead of main," but its single ahead-commit is the **pre-rebase version
  of PR-2's work**; the equivalent (and updated) code is already on main
  as `a30071f6`. Diff is the obsolete temporary accommodation placeholder.
  Branch can be deleted (it's just confusing leftover noise).
- `claude/travel-search-bar` is wildly divergent (1601 ahead / 203 behind)
  but is **unrelated to the LiteAPI/PR-1/PR-2/PR-3/PR-3b sequence** —
  separate older feature work, out of scope for this audit.

**Bottom line:** the production code path today is `PR-1 + PR-2 + PR-3 +
PR-3b`. Next PR (PR-4 UX rebuild + real LiteAPI SDK integration) builds on
this state. The `claude/travel-registry-pr-2` branch can be safely deleted
to remove the confusion; no PR is actually pending.
