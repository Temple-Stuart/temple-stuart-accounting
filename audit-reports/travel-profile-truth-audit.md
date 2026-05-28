# Travel Profile + AI Truth Audit (read-only)

Branch: `claude/travel-profile-truth-audit`. PR-1 reference commit: `09144ba0`. NO
edits — every claim is cited file + line.

---

## 1. What PR-1 (09144ba0) actually did

`git show 09144ba0 --stat` confirms PR-1 touched these files:

```
src/app/api/places/photo/route.ts                  |  57 ++-
src/app/api/places/usage/route.ts                  |  14 +     (new)
src/app/api/trips/[id]/ai-assistant/route.ts       | 466 ++++--------------
src/app/api/trips/[id]/commit/route.ts             |  13 +-
src/app/budgets/trips/[id]/page.tsx                |  18 -
src/components/trips/TripPlannerAI.tsx             | 538 ++++-----------------
src/lib/googlePlacesQuota.ts                       |  66 +    (new)
src/lib/placesCache.ts                             |  43 ±
src/lib/placesSearch.ts                            |  34 ±
prisma/schema.prisma + migration                   |  +
.env.example                                       |  +
```

The "profile removal" was confined to **two** files:
- **`src/components/trips/TripPlannerAI.tsx`** — deleted `TravelerProfile`,
  `DEFAULT_PROFILE`, `ParticipantProfile`, `TRIP_TYPES`, `BUDGET_OPTIONS`,
  `PRIORITY_GROUPS`, `VIBE_OPTIONS`, `PACE_OPTIONS`, the `profile` /
  `selectedInterests` / `showProfileEditor` / `savingProfile` /
  `scannerProfile` state, and the inline profile-editor JSX. Current file
  no longer mentions any of them — confirmed by grep on
  `src/components/trips/TripPlannerAI.tsx`: profile-related references only
  appear in two comments (`:248` "no traveler profile", `:601` "no profile,
  no AI") plus the unrelated `TripProfileCard` interface field downstream.
- **`src/app/budgets/trips/[id]/page.tsx`** — deleted the `initialProfile`
  and `participantProfiles` props that were being passed into
  `<TripPlannerAI …/>` (was lines 1274-1294 of the pre-PR file; now `:1269`
  only passes id/city/country/activity/month/year/daysTravel/tripDates/onCommitted).

PR-1 did **not** touch the trip-creation page or the standalone profile card.

---

## 2. The profile that's still rendering at `/budgets/trips/new`

**Route file**: `src/app/budgets/trips/new/page.tsx` (389 lines, self-contained
client component — does NOT import `TripPlannerAI`).

**Live UI cites:**
- "Your Travel Profile" header — `src/app/budgets/trips/new/page.tsx:260`.
- Interest-category groups (Active & Outdoors, Festivals, Conferences,
  Nightlife, Food & Craft, Coworking, Culture & Discovery, Bucket List)
  rendered from `ACTIVITY_GROUPS` imported `:6` from `@/lib/activities` —
  chip rendering at `:266-329`.
- "Preferences" panel header at `:334`. Budget (`BUDGET_OPTIONS` defined
  locally at `:10`, rendered `:339-347`), Vibe (`VIBE_OPTIONS` defined `:19`,
  rendered `:356-366`), Pace (`PACE_OPTIONS` defined `:30`, rendered
  `:373-380`).
- State holding the values: `selectedActivities` (`:72`), `budget` (`:73`),
  `vibes` (`:74`), `pace` (`:75`).
- Where the data goes on submit: `handleCreate` (`:140-188`). The form
  PATCHes `/api/trips/{id}/participants` (`:174`) with
  `{ activities, budget, vibe, pace, tripType }` (`:179-185`) → those land
  in the participant's `profileActivities` / `profileBudget` / `profileVibe`
  / `profilePace` / `profileTripType` columns
  (`src/app/api/trips/[id]/participants/route.ts:209-215`).

**This is NOT the same component PR-1 edited.** PR-1 edited
`src/components/trips/TripPlannerAI.tsx` (the planner widget on the *existing*
trip page). The live UI you're seeing is in
`src/app/budgets/trips/new/page.tsx` (the *create* form). Two different files,
two different routes. PR-1 didn't touch this one.

There's also a **third** profile surface: **`TripProfileCard`** —
`src/components/trips/TripProfileCard.tsx` (331 lines), rendered on the trip
detail page at `src/app/budgets/trips/[id]/page.tsx:1048`. It's an editable
profile card (own copies of `BUDGET_OPTIONS`/`VIBE_OPTIONS`/`PACE_OPTIONS` at
`:39-50` area; PATCHes the same `/participants` endpoint via
`:91`-area `patchField`). PR-1 didn't touch this either.

So: **three profile surfaces exist; PR-1 removed exactly one** (the embedded
editor inside `TripPlannerAI`).

---

## 3. Is the AI actually gone — and from which flow?

### From the planner/scan route
PR-1's diff to `src/app/api/trips/[id]/ai-assistant/route.ts` is the 466-line
shrink shown above. The current file no longer imports `grokAgent` or
`analyzeWithLiveSearch`; recommendations come straight from
`searchPlacesMultiQuery` and a deterministic mapper `placeToRecommendation`
(`:30-58`). The compliance comment at `:14-18` says explicitly: *"per Google
Places API terms, Google Places data is NOT sent to any AI/LLM."*
Confirmed clean.

### From the create form / saved-profile data
The profile data saved at `/new` lands in `trip_participants.profile*` columns
via `/api/trips/[id]/participants` PATCH. **Readers of those columns:**

```
src/app/api/trips/[id]/participants/route.ts:51-57, 209-225  (R/W endpoint)
src/app/budgets/trips/[id]/page.tsx:32-38                    (TS interface)
src/app/budgets/trips/[id]/page.tsx:989                      (completion count display)
src/components/trips/TripProfileCard.tsx:13-18               (read in card)
```

None of these is an AI/LLM call. The profile is **persisted and displayed**
but no consumer feeds it into any AI.

### AI/Grok call sites reachable from any travel route
`grep -rnE "grok|XAI_API_KEY|x\.ai"` over `src/app/api/trips src/app/budgets
src/components/trips` → **0 hits**. Repo-wide, Grok lives in:

```
src/lib/grok.ts                              (helper)
src/lib/grokAgent.ts                         (NO importers anywhere — dead since PR-1)
src/lib/convergence/pipeline.ts              (trading)
src/lib/convergence/sentiment.ts             (trading)
src/app/api/data-observatory/check/route.ts  (operations health check)
```

None of these is reachable from any travel route or the new/create flow.
Verified by `grep -rl grokAgent src/` showing only the file itself.

### One flow or two?
**TWO** distinct travel flows:
- **Flow A — Create trip** (`/budgets/trips/new` →
  `src/app/budgets/trips/new/page.tsx`): full profile UI (interests +
  Budget/Vibe/Pace), saves to participant.profile* columns. **No AI involved.**
- **Flow B — Open existing trip and scan** (`/budgets/trips/[id]` →
  `src/app/budgets/trips/[id]/page.tsx` which renders `TripProfileCard`
  + `TripPlannerAI`): card-style profile view/edit (TripProfileCard), and
  the Google-only planner widget (TripPlannerAI). **No AI involved.**

**Verdict on AI:** AI/Grok is gone from **both** travel flows — and was already
gone from Flow A (the create form never had an AI call; it only writes to the
DB).

---

## 4. The traveler-count bug

The count picked in the search bar never reaches the trip. The flow:

1. **Bar default:** `src/components/trips/TripCreationBar.tsx:38` —
   `useState(2)`. So the bar starts at 2.
2. **User changes the count** via `:292-293` — `setBarTravelers(+e.target.value)`.
3. **Bar navigates to /new and encodes the count in the URL:**
   `src/components/trips/TripCreationBar.tsx:161` —
   `if (barTravelers > 1) params.set('travelers', String(barTravelers));`
   (Note: if user leaves it at 1, the param is *not even set*.)
4. **`/new/page.tsx` ignores the URL param.**
   `grep "travelers" src/app/budgets/trips/new/page.tsx` returns **nothing**.
   It reads `tripName`, `startDate`, `endDate`, `tripType`, `destinations`
   from `searchParams` (`:104-108`), but never `travelers`.
5. **`/api/trips` doesn't accept a traveler count either.** The POST creates
   exactly one participant — the owner — at
   `src/app/api/trips/route.ts:136-146` (`participants: { create: { …
   isOwner: true … } }`). There's no participantCount/travelers field in the
   body or destructuring.
6. **Trip lands at `/budgets/trips/[id]`. The bar reloads its count from the
   trip.** `TripCreationBar.tsx:62` — `if (trip.participants)
   setBarTravelers(trip.participants.length || 2);` → resets to 1 (just the
   owner).

So the count is dropped twice: once on the way out (`/new` doesn't read the
URL param), and never accepted by the API. The "reset to 1" is the bar
re-reading the actual participant count from the DB.

The user's earlier observation that "it resets to 2" likely happens when
`trip.participants` is undefined/zero — the fallback `|| 2` kicks in
(`TripCreationBar.tsx:62`).

---

## Truth table

| Question | Reality (cited) |
|---|---|
| Where does the live "Your Travel Profile" UI come from? | `src/app/budgets/trips/new/page.tsx:258-330` (the **create form**). Interest groups from `ACTIVITY_GROUPS` (`:6`). |
| Where do "Preferences" (Budget/Vibe/Pace) come from? | Same file, `:332-384`. Constants defined locally at `:10`, `:19`, `:30`. |
| Where do the values go on save? | PATCH to `/api/trips/{id}/participants` (`new/page.tsx:174`) → `trip_participants.profile*` columns (`participants/route.ts:209-215`). |
| Which file did PR-1 edit to "remove the profile"? | `src/components/trips/TripPlannerAI.tsx` and `src/app/budgets/trips/[id]/page.tsx` only. Confirmed clean post-PR. |
| Same component as the live UI? | **No.** Create form (`new/page.tsx`) ≠ Planner widget (`TripPlannerAI.tsx`). |
| Number of profile surfaces in the app | **Three.** `new/page.tsx` (full editor on create), `TripProfileCard.tsx` (editable card on trip detail), `TripPlannerAI.tsx` (PR-1 removed). |
| Is AI/Grok gone from the planner route? | Yes — `ai-assistant/route.ts:14-18` comment + no `grokAgent` import. |
| Is AI/Grok gone from every travel flow? | Yes — 0 grok/xai hits under `src/app/api/trips`, `src/app/budgets`, `src/components/trips`. The create form never had an AI call. |
| Where is Grok still used? | Trading only: `convergence/pipeline.ts`, `convergence/sentiment.ts`, `data-observatory/check/route.ts`. Not reachable from travel. |
| Why does the traveler count reset? | `TripCreationBar.tsx:161` puts `?travelers=` in the URL → `new/page.tsx` never reads it → `/api/trips` (`route.ts:136-146`) creates only the owner → bar re-reads `participants.length` (`TripCreationBar.tsx:62`) = 1. |

---

## Verdict

The profile you see at `/budgets/trips/new` lives in
**`src/app/budgets/trips/new/page.tsx`** (the trip-creation form). PR-1
removed the **embedded profile editor inside
`src/components/trips/TripPlannerAI.tsx`** (the planner widget on the
existing-trip page) and dropped the profile props from
`src/app/budgets/trips/[id]/page.tsx`. They are **different components on
different routes** — PR-1 did exactly what it claimed for the planner
surface, but never touched the create form or the standalone
`TripProfileCard`.

**AI is gone everywhere in the travel pipe.** Zero Grok/XAI references under
the trips routes or the trip components. Saved profile data is stored in
the DB and rendered, but no AI consumes it. The remaining Grok usage
(`convergence/*`, `data-observatory/check`, `grok.ts`) is trading/ops, not
reachable from travel. `grokAgent.ts` has no importers (dead since PR-1).

**To fully remove the profile + AI from travel and fix the count, change:**
1. `src/app/budgets/trips/new/page.tsx` — remove the "Your Travel Profile"
   block (`:258-330`), the "Preferences" block (`:332-384`), the state at
   `:72-75`, the local `BUDGET_OPTIONS`/`VIBE_OPTIONS`/`PACE_OPTIONS` at
   `:10-34`, the profile PATCH at `:173-188`, and the `ACTIVITY_GROUPS`
   import (`:6`).
2. `src/components/trips/TripProfileCard.tsx` — delete the file, and drop
   the import + render site at `src/app/budgets/trips/[id]/page.tsx:10` and
   `:1048`. Also drop the `profileTripType`-completion display at
   `[id]/page.tsx:989` if you want the profile fully gone.
3. `src/app/api/trips/[id]/participants/route.ts` — if you want the profile
   wiped from the API contract too, strip the `profile*` selects/upserts
   (`:51-57`, `:209-225`). The columns themselves can stay (no readers) or
   be migrated out.
4. **Count fix** — make the create form pass the chosen count through:
   - `src/app/budgets/trips/new/page.tsx`: read
     `searchParams.get('travelers')` (currently absent) and send a
     `travelers` field on the POST.
   - `src/app/api/trips/route.ts:118-147`: accept `travelers` from the body
     and create N-1 placeholder participants alongside the owner at
     `:136-146`. After that change, `TripCreationBar.tsx:62`'s
     `setBarTravelers(trip.participants.length || 2)` will reflect the real
     count.

AI removal is genuine — but the **profile UI is in a file PR-1 never opened.**
