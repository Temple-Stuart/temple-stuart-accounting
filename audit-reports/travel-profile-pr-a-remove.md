# Travel-Profile-PR-A — Remove all profile UI + write paths from travel

Builds on `audit-reports/travel-profile-truth-audit.md`. PR-1 had already removed
the embedded profile editor inside `TripPlannerAI`. This PR removes the **other two
surfaces** the audit found (the create form and the detail-page card) and **strips
the API write path**. DB columns are deliberately left intact (no migration, no
data destruction). Branch: `claude/travel-profile-pr-a-remove`.

---

## Each surface removed (cited)

### 1. Create form — `src/app/budgets/trips/new/page.tsx`
File rewritten from 389 lines to **127 lines**. Cuts made:
- **"Your Travel Profile" block** (was `:258-330`): interest-group expander, chip
  toggles, "+ Add Category" expander — all gone.
- **"Preferences" Budget/Vibe/Pace block** (was `:332-384`): all three selects gone.
- **State** (was `:71-77`): `selectedChips`, `selectedActivities`, `budget`,
  `vibes`, `pace`, `expandedCategories`, `showAllCategories` — all gone.
- **Local profile constants** (was `:10-34`): `BUDGET_OPTIONS`, `VIBE_OPTIONS`,
  `PACE_OPTIONS` — gone. Also `INTEREST_TO_ACTIVITIES` (was `:36-41`).
- **Profile PATCH** (was `:173-188`): the
  `fetch('/api/trips/{id}/participants', { method: 'PATCH', body: { profile … } })`
  block — gone. The trip POST (`/api/trips`) is untouched (per PR-B scope).
- **`ACTIVITY_GROUPS` import** (was `:6`) — gone. The same import line also
  carried `TRAVEL_INTERESTS` and `INTEREST_CATEGORIES`, both of which were only
  used to drive the (now-removed) profile UI — both removed from the import.
- **`ChevronDown` import** (was `:8`) — only used inside the profile groups — gone.
- **Activity filter chips** (was `:237-255`): the chip row at the top of the page
  existed only to expand interest categories in the (now-removed) profile section.
  Dead UI — gone.

The page now reduces to: read URL params (`tripName`, `startDate`, `endDate`,
`tripType`, `destinations`), auto-create on `?save=1` (the existing
`searchParams`-driven `useEffect`), POST `/api/trips`, write destinations,
redirect to `/budgets/trips/{id}`. Error + saving banners retained.

### 2. Detail-page card — `src/components/trips/TripProfileCard.tsx`
- **File deleted** (`git status -D src/components/trips/TripProfileCard.tsx`).
- **Import dropped** from `src/app/budgets/trips/[id]/page.tsx:10` (was
  `import TripProfileCard from '@/components/trips/TripProfileCard';`).
- **Render block dropped** at `src/app/budgets/trips/[id]/page.tsx:1045-1056`
  (the `{/* Inline profiles */}` grid + `participants.map(p => <TripProfileCard … />)`).
- **Completion-count display dropped** at `:988-990` (the
  `<span>{participants.filter(p => !!p.profileTripType).length} of … profiles complete</span>`).
- **Local `Participant` interface trimmed** at `:31-38`: removed
  `profileTripType`, `profileBudget`, `profilePriorities`, `profileVibe`,
  `profilePace`, `profileGroupSize`, `profileActivities` (these came from the
  GET endpoint, now also gone — see below).

The "Crew" heading + table + invite/email actions remain unchanged.

### 3. API write path — `src/app/api/trips/[id]/participants/route.ts`
- **GET select stripped** at `:51-57` (the seven `profile* : true` fields). GET
  still returns identity/RSVP/payment/blackout/`homeAirport` fields. No reader
  was using the profile fields after edit #2.
- **PATCH handler deleted entirely** (was `:157-234`). The handler ONLY wrote
  profile fields; with the two callers gone (the create form PATCH and
  `TripProfileCard.patchField`), there were zero remaining callers (verified by
  `grep "/participants" src --include='*.ts' --include='*.tsx' | grep -i PATCH`
  → 0 hits). Removing the handler makes profile writes structurally impossible
  via this endpoint. GET, POST (add participant), DELETE (remove participant)
  are unchanged.

---

## Confirmations

- **DB columns left intact (no migration).** `prisma/schema.prisma` is unchanged
  (`git diff main -- prisma/schema.prisma` → 0). The `trip_participants.profile*`
  columns still exist; nothing writes or reads them, so they're inert. No data
  destroyed.
- **Traveler-count logic UNTOUCHED (that's PR-B).**
  `git diff main -- src/components/trips/TripCreationBar.tsx` → 0.
  `git diff main -- src/app/api/trips/route.ts` → 0. The POST body shape in
  `/new/page.tsx` is identical (no `travelers` field added, no participant
  creation logic touched).
- **Planner widget UNTOUCHED + still clean.**
  `git diff main -- src/components/trips/TripPlannerAI.tsx` → 0.
  `git diff main -- src/app/api/trips/[id]/ai-assistant/route.ts` → 0.
- **NO new AI introduced; 0-AI-in-travel state holds.**
  `grep -rnE "grok|XAI_API_KEY|x\.ai" src/app/api/trips src/app/budgets src/components/trips`
  → empty.
- **Zero profile-field references left in travel.**
  `grep -rnE "\.profileTripType|\.profileBudget|\.profileVibe|\.profilePace|\.profileActivities|\.profilePriorities|\.profileGroupSize" src`
  → empty. `grep -rn "TripProfileCard" src` → only a stale doc-comment in
  `src/lib/activities.ts:40` (left as-is, out of scope).
- **Create + render flow still works (by construction):**
  - `/new/page.tsx` reads URL params and POSTs `/api/trips` with the same body
    shape as before (minus the no-op profile field set). `/api/trips` POST
    handler is untouched, so trip creation behaves identically.
  - `/budgets/trips/[id]` page renders without `TripProfileCard`. The Crew
    section keeps its heading + table; no other section depended on the card.
- **tsc clean.** `npx tsc --noEmit` → exit 0.
- **Lint clean (no new errors).**
  - `src/app/api/trips/[id]/participants/route.ts` → 0 errors / 0 warnings.
  - `src/app/budgets/trips/new/page.tsx` → 0 errors, 1 warning (the
    `react-hooks/exhaustive-deps` warning on the auto-create `useEffect` —
    **pre-existing baseline**; same warning existed at the same hook in main
    before my edits, confirmed via `git stash` + lint).
  - `src/app/budgets/trips/[id]/page.tsx` → 54 errors (all
    `@typescript-eslint/no-explicit-any` / `<img>`), **identical to baseline**
    (baseline 54 = now 54; confirmed via `git stash` diff). Repo's
    `next.config.ts` has `eslint: { ignoreDuringBuilds: true }`.

---

## Changeset

```
 M src/app/api/trips/[id]/participants/route.ts   (GET trimmed; PATCH deleted)
 M src/app/budgets/trips/[id]/page.tsx            (import/render/banner/iface cut)
 M src/app/budgets/trips/new/page.tsx             (rewrite: 389 → 127 lines)
 D src/components/trips/TripProfileCard.tsx       (file deleted)
```

Net effect: the entire travel-profile concept is gone from the UI and from any
API write path. The DB columns remain so any historically captured data is
preserved but inert. The traveler-count bug remains as-is — PR-B's job.
