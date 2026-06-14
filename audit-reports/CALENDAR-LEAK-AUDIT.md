# CALENDAR LEAK AUDIT — logged-out home page shows the owner's personal calendar

**Type:** Security audit — READ ONLY. No source modified.
**Reported:** A logged-out / incognito visitor to the home page (`/`) sees the
owner's real personal calendar (Sleep Routine, Morning Routine, trip activities,
dollar amounts — screenshot-confirmed).
**Question:** Did HCR1.1 break the `authed` gate, and/or are the calendar routes
public/unscoped?

---

## TL;DR — the surprising result

**The current `main` source code is NOT vulnerable.** Every layer is correct:

1. The UI gate holds — `<HubCalendar>` only mounts when `authed === true`
   (`ModuleLauncher.tsx:178`), and `authed` is `false` for a logged-out user.
2. All three calendar feeds return **401 with no session** and scope every query
   to `WHERE user_id = <session user>`; none are in `PUBLIC_PATHS`.
3. `git log -S` proves the calendar mount was **never** shipped ungated — both
   HCR1 and HCR1.1 always wrote `authed === true && <HubCalendar />`.

So a **truly cookieless** request cannot reach this data. The screenshot leak is
therefore **environmental**, and the two candidate causes are named in §4. The
single real hardening gap in the code is the **absence of `private, no-store`
cache headers** on the auth-bearing routes (§2c) — that is the only way the
current code could expose one user's data to another, and only if a caching
layer sits in front.

---

## 1. THE GATE — did HCR1.1 break it? **No.**

### 1a. The exact current JSX around the calendar (post-HCR1.1)

`src/components/home/ModuleLauncher.tsx:178-203`:

```jsx
{authed === true && (
  <section className="w-full py-10 bg-white border-b border-border">
    <div className="max-w-7xl mx-auto px-4 lg:px-8">
      <HubCalendar />
    </div>
  </section>
)}
{authed === false && (
  <section ...>
    ... "Your calendar" login card → onClick={onRequireAuth} ...
  </section>
)}
```

- The calendar is wrapped in `authed === true`. HCR1.1 moved the block **above**
  `{MODULES.map(...)}` (`:204`) but kept the gate — it only dropped the
  `m.key === 'travel'` placement condition, which was a position filter, not the
  auth gate. **The reposition did not drop or weaken the `authed` wrapper.**
- `authed === false` → a static login card (no `<HubCalendar>`, no fetch).
- `authed === null` (initial) → **neither** branch renders → nothing.

### 1b. How `authed` is determined (`ModuleLauncher.tsx:52`, `:58-71`)

```js
const [authed, setAuthed] = useState<boolean | null>(null);   // :52 — starts null
useEffect(() => {
  fetch('/api/auth/me')
    .then(async res => { setAuthed(res.ok); ... })            // :63 — ok === true only on 200
    .catch(() => setAuthed(false));                            // :69 — network error → false
}, []);
```

`authed` for a guest is only ever `null` (before the call resolves) or `false`
(after). It becomes `true` **only** if `/api/auth/me` returns a 2xx, which
requires a valid signed `userEmail` cookie (§2a). **The calendar never mounts
for a logged-out user.** There is no localStorage seed, dev override, or default
that could set `authed = true` without the cookie.

### 1c. Never-ungated — git history proof

`git log -p -S 'authed === true && <HubCalendar'` on `ModuleLauncher.tsx`:

- **e2cb631f (HCR1):** `{m.key === 'travel' && authed === true && <HubCalendar />}`
- **f617e05b (HCR1.1):** `{authed === true && (<HubCalendar />)}`

Both committed states gate on `authed === true`. There is no commit where the
home-page calendar rendered without the gate.

---

## 2. THE ROUTES — the worst-case question. **All three are auth-scoped; none public.**

The three feeds `HubCalendar` calls (`HubCalendar.tsx:71-114`):
`/api/calendar`, `/api/operations/daily-plan/items`, `/api/hub/operations-routines`.

### 2a. None are in `PUBLIC_PATHS` → middleware redirects a guest

`src/middleware.ts:50-80` — the full allowlist is `/`, `/admin`,
`/api/admin/verify`, `/api/admin/users`, `/api/auth`, `/_next`, `/favicon.ico`,
`/pricing`, `/api/stripe/webhook`, `/api/inngest`, `/opengraph-image`, `/terms`,
`/privacy`, and the public **travel** routes (`/api/flights/search`,
`/api/travel/hotels/*`, `/api/travel/activities/search`, `/api/travel/visa/check`,
`/api/travel/locations/*`, `/api/travel/liteapi/{prebook,book}`).

**`/api/calendar`, `/api/operations/*`, and `/api/hub/*` are absent.** For an
unauthenticated request `isPublic()` is false (`:82-84`), no verified cookie and
no token (`:95-101`) → `NextResponse.redirect('/')` (`:103-104`). A guest's fetch
is bounced to the home HTML, never the data.

### 2b. Each route independently verifies the session AND scopes to `user_id`

Defense in depth — even if middleware were bypassed, the handlers self-guard:

| Route | Auth check (401 if no session) | Query scoping |
|---|---|---|
| `/api/calendar` | `route.ts:7-9` `getVerifiedEmail()` → 401 | `:31` `WHERE user_id = ${user.id}` (and `:42`) |
| `/api/operations/daily-plan/items` | `route.ts:43-44` → 401 | `:91` `where: { user_id: user.id, ... }` |
| `/api/hub/operations-routines` | `route.ts:60-61` → 401 | `:104-105` `where: { user_id: user.id, is_active: true }` |
| `/api/auth/me` (the gate's source) | `route.ts:8-15` `getVerifiedEmail()` → **401** | n/a (returns the session user only) |

`getVerifiedEmail()` (`src/lib/cookie-auth.ts:54-61`) reads the `userEmail`
cookie and HMAC-verifies it; **no cookie → `null`** (`:57`), tampered → `null`
(`:58`, `verifyCookie` `:26-47`). There is no fallback to a default/env user.
So with no valid cookie, **every** route above returns 401 and **`/api/auth/me`
returns 401**, which forces `authed = false`. The data cannot be served to a
cookieless caller by any of these handlers.

### 2c. The ONE real gap — no `Cache-Control: private, no-store`

`grep` of all four route files: **no `Cache-Control` / `no-store` / `s-maxage`
header is set**, and `next.config.ts:14-35` `headers()` sets only the CSP (no
cache directive). The routes are dynamic (they call `cookies()` /
`request.url`, so Next.js does not cache them at build), and there is no custom
CDN cache rule in the repo — so this is **latent, not an active leak in the
code**. But it is the only mechanism by which the current, correctly-scoped code
could ever hand one user's response to another: if any caching layer (CDN edge,
reverse proxy, browser, service worker) were ever configured to cache these
responses **without** `Vary: Cookie` / `private`, the owner's first authed
response could be replayed to anonymous clients. Closing this is cheap
insurance (§5).

---

## 3. UI vs API — is the page fetching, or is data embedded?

- The home page (`src/app/page.tsx:1`) is `'use client'`, renders exactly one
  data-bearing child: `<ModuleLauncher>` (`:74`). Nothing on the page renders
  calendar/routine data server-side; there is **no embedded server payload**.
- The calendar data is fetched **client-side** inside `HubCalendar`'s
  `useEffect` (`HubCalendar.tsx:116`), which runs only after the component
  mounts — and it only mounts when `authed === true`. So for a guest there is
  **no mount and therefore no fetch** of `/api/calendar`, `/api/operations/*`,
  `/api/hub/*`.
- `<HubCalendar>` is mounted in exactly **one** place (grep: only
  `ModuleLauncher.tsx:181`). `CalendarGrid` appears elsewhere (`/hub`,
  `/trading`, `/budgets/...`) but none of those render on the home page.
- The strings in the screenshot ("Sleep Routine", "Morning Routine") are **not**
  the public Operations showroom demo seed — `demoData.ts` is fictional
  ("Maria's Food Truck", `demo-*` IDs); its only match was the comment "a
  morning routine" (`demoData.ts:9`). So the leaked rows are the owner's **real**
  `operations_routines` / `calendar_events`, which can only come from the three
  authed routes — i.e. the request that produced the screenshot **was carrying a
  valid session**.

---

## 4. THE LEAK PATH + SEVERITY

Because (1) the gate is intact and never-ungated, (2) all three routes 401
without a session and scope to `user_id`, none public, and (3) the data is
client-fetched only after an `authed === true` mount — **a truly anonymous
request cannot produce the screenshot.** The leak is reproduced only when the
request carries the owner's session. Two candidate causes:

- **(A) Most likely — the test browser carried the owner's `userEmail` cookie.**
  The reporter is the owner. An "incognito" window that had been used to log in
  earlier in the same session (or a non-incognito tab) still sends the signed
  cookie → `/api/auth/me` 200 → `authed = true` → the owner sees **their own**
  calendar, and the routes return **their own** rows.
  **Severity: none — this is correct behavior, not a cross-user leak.** The fix
  is to re-test from a verified-cookieless state (§5, step 0).

- **(B) Real but infra-level — a caching layer replays an authed response.**
  If a CDN/proxy in front of the deploy caches `/api/auth/me` or a calendar
  route without `Vary: Cookie`/`private`, the owner's first response is served
  to anonymous clients. The code does **not** set `private, no-store` (§2c), so
  this is possible at the edge even though the handlers are correct.
  **Severity: high IF present** (cross-user PII), but the cause is the missing
  cache header, **not** the gate or query scoping. Confirm with the §5 curl.

There is **no third path**: the routes are not public (§2a) and not unscoped
(§2b), so this is not the "worst case" of an open API serving anyone — that
class of bug is absent here.

---

## 5. THE MINIMAL FIX SPEC (defense in depth — not implemented; audit only)

**Step 0 — reproduce honestly first (decides A vs B).** From a verified-empty
state, hit the API directly with no cookie:

```
curl -i 'https://<deploy>/api/calendar?year=2026&month=6'      # expect 302→/ or 401
curl -i 'https://<deploy>/api/auth/me'                          # expect 401
```

- 401 / redirect with **no body data** → the code is sound; the screenshot was
  cause (A) (a cookie was present). No code change required; close as
  "not reproducible anonymously."
- A 200 with calendar rows and **no cookie sent** → cause (B) (a cache/edge is
  replaying an authed response, or the deploy is stale) → apply the route fix
  below and audit the CDN config.

**Fix 1 (routes — the real hardening, do regardless of A/B).** On
`/api/auth/me` and the three calendar routes, make them explicitly uncacheable
and guarantee no caching layer can share them:

- add `export const dynamic = 'force-dynamic';` to each route file, and
- set `Cache-Control: private, no-store` (e.g.
  `NextResponse.json(..., { headers: { 'Cache-Control': 'private, no-store' } })`)
  on every response — including the 401s.

This shuts cause (B) at the application layer even if a future CDN rule is
misconfigured. It is additive and changes no business logic or query.

**Fix 2 (gate — already correct; leave as-is).** The `authed === true` mount in
`ModuleLauncher.tsx:178` and the no-fetch-when-logged-out contract in
`HubCalendar` are correct and need no change. (Optional belt-and-suspenders: a
server-side guard so the home page never even references the component for a
cookieless request — but the routes are the real protection and they already
hold, so this is not required.)

**Do BOTH only if §5 step 0 shows a real anonymous 200** (cause B): Fix 1 is the
substantive change; Fix 2 is already in place. If step 0 shows 401 (cause A),
**no code fix is needed** — the report is a cookie/test-state artifact, and the
right action is documentation + re-test, optionally adopting Fix 1 as cheap
hardening.

---

## Citations index

- Gate JSX + reposition: `src/components/home/ModuleLauncher.tsx:178-204`
- `authed` state machine: `src/components/home/ModuleLauncher.tsx:52`, `:58-71`
- Never-ungated: `git log -p -S 'authed === true && <HubCalendar'` → commits
  `e2cb631f` (HCR1), `f617e05b` (HCR1.1)
- `PUBLIC_PATHS` + redirect: `src/middleware.ts:50-80`, `:82-84`, `:95-104`
- Route auth + scope: `src/app/api/calendar/route.ts:7-9,31,42`;
  `src/app/api/operations/daily-plan/items/route.ts:43-44,91`;
  `src/app/api/hub/operations-routines/route.ts:60-61,104-105`;
  `src/app/api/auth/me/route.ts:8-15`
- Cookie verify (no fallback): `src/lib/cookie-auth.ts:54-61`, `:26-47`
- Client-only fetch: `src/components/hub/HubCalendar.tsx:71-114`, `:116`
- Single mount: grep → `src/components/home/ModuleLauncher.tsx:181`
- Home page render: `src/app/page.tsx:1`, `:74`
- Demo seed is fictional (not the leak): `demoData.ts:9,27-39`
- No cache headers on routes: grep (none); `next.config.ts:14-35` (CSP only)
