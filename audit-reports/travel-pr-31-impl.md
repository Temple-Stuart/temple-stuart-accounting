# TRAVEL — PR-31 Implementation: Crew add-traveler + invite-link copy + #travelers anchor

**Branch:** `claude/travel-pr-31`
**Date:** 2026-05-30
**Scope:** Add-participant UI in the Crew section, wired to the existing
auth+ownership-gated `POST /participants`. Copy-invite-link per pending row.
`#travelers` anchor for the TripHeader "Manage travelers" link. **page.tsx only**
— no new endpoint, no route change, no schema. 0 deps.

---

## STEP 1 — `#travelers` anchor

`page.tsx:986-988` — the Crew panel now has `id="travelers"` (+ `scroll-mt-4`):
```tsx
<div id="travelers" className="rounded-lg overflow-hidden border … scroll-mt-4">
```
TripHeader's link `href={`/budgets/trips/${tripId}#travelers`}`
(`TripHeader.tsx:200`) now resolves to this section.

## STEP 2 — Inline add-traveler form (organizer only)

- **Button** in the Crew header (`page.tsx:994-1001`), gated `isOrganizer`,
  toggles the form ("+ Add traveler" / "Cancel").
- **`isOrganizer`** derived value (`page.tsx:600-603`): the viewer's
  `currentUserEmail` matches the owner participant's email. (UI gate only — the
  real protection is server-side, §4.)
- **Inline form** below the table (`page.tsx:1052-1078`): `firstName`,
  `lastName`, `email` (required), `phone` (optional) — matching the route's
  required fields exactly; an "Add traveler" submit.
- **`handleAddParticipant`** (`page.tsx:590-616`): client-validates first/last/
  email present → `POST /api/trips/[id]/participants` with the form body → on
  success clears + closes the form + `loadParticipants()`. **Error handling:**
  409 → "That email is already on this trip."; other non-2xx → the route's error
  / HTTP status, shown inline (`addError`).

## STEP 3 — Copy invite link (per pending row)

`page.tsx:1033-1041` (actions cell): for `p.rsvpStatus === 'pending' &&
p.inviteUrl`, a "Copy invite link" button → `copyInvite` (`page.tsx:618-625`) →
`navigator.clipboard.writeText(inviteUrl)` with a brief "Copied!" state
(`copiedInvite`). Uses the `inviteUrl` the **GET already returns** (no extra
call). Confirmed/declined rows don't show it.

## STEP 4 — No backend change; server-side gate is the protection

- **No new endpoint, no route change, no schema** — `git diff --name-only main`
  = `page.tsx` only. The `POST /participants` is used **as-is** (it already
  accepts `{firstName,lastName,email,phone}` and mints a pending row + invite
  link).
- **Server-side ownership gate (the real protection)** is intact + untouched —
  `participants/route.ts:91-96`: `prisma.trips.findFirst({ where: { id, userId:
  user.id } })` → 404 if not the owner's trip (preceded by `getVerifiedEmail`
  401). So a non-owner's POST is **rejected server-side regardless of the UI
  gate**. The `isOrganizer` UI gate just hides the affordance.

---

## Hard-constraint compliance

| Constraint | Status |
|---|---|
| page.tsx only; no route/schema touched | ✅ diff = `page.tsx`; `participants/route.ts` + schema not in diff |
| Add gated to organizer in UI + server-side gate is the real protection | ✅ `isOrganizer` UI gate (`:600-603`) + `route.ts:91-96` owner check (cited, untouched) |
| Required fields match the route (first+last+email); route not relaxed | ✅ form requires all three; route unchanged |
| Committed Budget / scan sections / filtering / header / Flights untouched | ✅ not in diff |
| 0 schema, 0 deps | ✅ |
| `tsc --noEmit` | ✅ exit 0 |
| lint clean | ✅ page errors 44 = main (0 new); warnings 21 → 20 |
| git diff = page.tsx (+ report) | ✅ |

---

## Result
The Crew section now has a "+ Add traveler" action (organizer-gated in UI,
owner-gated server-side) that POSTs to the existing endpoint, creating a pending
traveler + a shareable invite link surfaced via "Copy invite link" on the
pending row (no email sent — the organizer shares the link; the invitee RSVPs to
confirm). The TripHeader "Manage travelers" link now lands on the Crew section
via `#travelers`. No backend changes.
