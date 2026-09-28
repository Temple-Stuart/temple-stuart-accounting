/**
 * SEC-02b (2026-09-27) — NO PASSWORD HASH LEAVES THE SERVER.
 *
 * The RSVP POST answered with the whole trip_participants row — passwordHash
 * included — and the trip create answered with `participants: true`. A route that
 * returns a participant returns THIS select: every column but the hash. Whether a
 * password is set is said as a boolean (hasPassword), as the RSVP GET always did.
 * The ownership-and-hash law (scripts/assert-tool-registry.ts, "The password-hash
 * law") refuses any route response that carries a password column.
 */
export const PARTICIPANT_RESPONSE_SELECT = {
  id: true,
  tripId: true,
  email: true,
  firstName: true,
  lastName: true,
  phone: true,
  paymentMethod: true,
  paymentHandle: true,
  inviteToken: true,
  unavailableDays: true,
  rsvpStatus: true,
  rsvpAt: true,
  isOwner: true,
  createdAt: true,
  updatedAt: true,
  homeAirport: true,
  homeAddress: true,
  profileTripType: true,
  profileBudget: true,
  profilePriorities: true,
  profileVibe: true,
  profilePace: true,
  profileGroupSize: true,
  profileActivities: true,
} as const;
