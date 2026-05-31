# TRAVEL — PR-31 Audit: add-participant action in Crew (+ header "Manage travelers" target)

**Branch:** `claude/travel-pr-31-audit`
**Date:** 2026-05-30
**Mode:** READ-ONLY.
**Goal:** Let the organizer ADD someone to the trip from the Crew section, and
give PR-29's TripHeader "Manage travelers" link a real target. Wire to existing
plumbing.

---

## 1. Crew section + participant data source

`src/app/budgets/trips/[id]/page.tsx:986-1046` — "Crew ({participants.length})"
panel: a read-only table listing `participants` (avatar+name, email, RSVP status
chip, "Organizer" role badge for `isOwner`, blackout days), with a remove (×)
button for non-owners (`removeParticipant`, `:577`). **There is no Add button**
(the header `:988` has a `justify-between` div but nothing on the right) — that's
the gap.

Data: `participants` state ← `loadParticipants` (`:223-227`) ←
`GET /api/trips/[id]/participants` ← `prisma.trip_participants` (`route.ts:36-53`).
The GET already returns a per-participant `inviteUrl`
(`${baseUrl}/trips/rsvp?token=${inviteToken}`, `route.ts:57-60`).

**No `#travelers` anchor exists** — TripHeader's "Manage" link
(`/budgets/trips/{id}#travelers`) currently has no scroll target. PR-31 should
add `id="travelers"` to the Crew section.

## 2. Participants endpoints + the RSVP flow

**`POST /api/trips/[id]/participants`** (the add endpoint, `participants/route.ts:71-148`):
- **Accepts** `{ firstName, lastName, email, phone? }` — **requires firstName +
  lastName + email** (400 if any missing, `:101-103`); `phone` optional. No role
  param (added participants are `isOwner: false`; the organizer is `isOwner`).
- **Dedup:** 409 if a participant with that email already exists on the trip
  (`:106-117`).
- **Creates** a `trip_participants` row with a unique `inviteToken`
  (`randomBytes(32)`), `isOwner: false`, **`rsvpStatus: 'pending'`** (`:119-131`).
- **Returns** the participant + `inviteUrl` (`/trips/rsvp?token=…`, `:135-141`).
- **It does NOT send an email** — it creates a pending row + a **shareable invite
  link** the organizer sends manually.

**`DELETE`** (`removeParticipant`, `:577`): `{ participantId }`; ownership-gated;
refuses to delete the owner (`route.ts:188-194`).

**Added → confirmed flow:** the invitee opens the `inviteUrl` →
`GET /api/trips/rsvp?token=…` (`rsvp/route.ts:7`, resolves trip- or
participant-level token) and `/api/trips/[id]/participant` (GET-by-`inviteToken`,
`participant/route.ts:19`) load the trip/participant → the invitee confirms →
`rsvpStatus` flips `pending → confirmed/declined`. So: **organizer adds (pending +
link) → shares link → invitee RSVPs via token → confirmed.**

## 3. Proposed add-participant UI

- A **"+ Add traveler"** button in the Crew header (`:988`), and the same target
  for the TripHeader "Manage" link (add `id="travelers"` to the Crew panel).
- A small **form/modal**: `firstName`, `lastName`, `email` (all required by the
  POST), optional `phone` → `POST /participants` → on success `loadParticipants()`
  + surface the returned **`inviteUrl`** (a "Copy invite link" affordance) so the
  organizer can share it. (The GET already returns `inviteUrl` per participant, so
  PR-31 can also add a copy-link control on each **pending** row.)
- **Adding creates a pending row + invite link — no auto-email.** If email-send is
  wanted, that's a separate enhancement (no email infra in the handler).

## 4. Auth / ownership on the POST — confirmed

The POST is **auth-gated + ownership-checked**: `getVerifiedEmail()` → 401
(`route.ts:78-80`); user lookup → 404 (`:82-89`); and the trip is loaded
`where: { id, userId: user.id }` → 404 if not the requester's trip (`:91-96`).
So **only the trip owner/organizer can add** participants. (DELETE is gated the
same way.)

## 5. Scope

| Item | Detail |
|---|---|
| New endpoint | **No** — `POST /api/trips/[id]/participants` already does add (auth+ownership, firstName/lastName/email/phone, pending row + invite link) |
| Schema / migration | **No** — `trip_participants` exists (`schema:561-579`) with all needed fields |
| Files | `page.tsx` only — Crew header "+ Add" button, an add form/modal + state, wire to the POST + `loadParticipants`, surface `inviteUrl`, and add `id="travelers"` to the Crew section for the header link |
| New deps | None |

### Taste vs mechanical
- **Mechanical:** Add button + form → existing POST → `loadParticipants`;
  `id="travelers"` anchor; copy-invite-link from the returned/existing `inviteUrl`.
- **Taste calls (Alex sign-off):**
  1. **Inline form vs modal** for the add UI.
  2. **Surface the invite link** per pending participant (copy button) vs only on add.
  3. **Auto-email the invite** — out of scope unless email infra is added (the
     POST only mints a shareable link today).
  4. Required fields: the POST needs first + last + email (not email-only) — keep
     that, or relax the route to email-only (a route change, not just UI).

---

## VERDICT
Add-participant is a **UI-only** addition wired to the **existing, auth- and
ownership-gated** `POST /api/trips/[id]/participants`. No new endpoint, no schema.
PR-31: a Crew "+ Add traveler" button + form (firstName/lastName/email[/phone]) →
POST → refresh + show the shareable invite link, plus an `id="travelers"` anchor
so the TripHeader "Manage travelers" link lands on Crew. Adding creates a
**pending** row + invite link (organizer shares it; invitee RSVPs to confirm) —
flag whether auto-email is wanted (separate, needs infra).

---

**READ-ONLY audit. No implementation performed.**
