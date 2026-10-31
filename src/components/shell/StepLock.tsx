'use client';

/**
 * LOCK-01 — a locked step shows ITS OWN ROOM, not a sales pitch.
 *
 * This used to render LockedTabCard: the offer card, six tool rows, a price line
 * and "BILLED MONTHLY · CANCEL ANYTIME" — a marketing card where the product
 * should be. The offer belongs at /pricing and on the deck; inside the app a
 * locked viewer sees the room.
 *
 * It is now a thin re-export of the ONE mechanism (RoomLock): the room renders in
 * full, frozen, under one short inline note with a single link to /pricing. No
 * offer, no price, no billing copy.
 */
export { default, LockedNote, useRoomLock, useTabLock } from '@/components/shell/RoomLock';
