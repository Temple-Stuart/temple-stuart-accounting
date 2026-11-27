/**
 * COALEVELS-01 (Alex, 2026-11-27) — THE ONE RULE OF A LOCATION.
 *
 * A stop's Location says whether it is TRAVEL or HOMEBASE — or says nothing (null: not said). It is the stop's own
 * (operations_routines.location_class; every line of the routine shares it), and it is NOT the stop's venue
 * (operations_routines.location, a text). The column's CHECK holds the two keys; this file holds their words, their codes
 * and how a typed one is read. Pure: no import, no clock, no I/O.
 */

/** The two classes, by the key the column keeps. */
export const LOCATION_CLASSES = ['travel', 'homebase'] as const;
export type LocationClass = (typeof LOCATION_CLASSES)[number];

/** The word a class is printed with. */
export const LOCATION_WORDS: Readonly<Record<LocationClass, string>> = { travel: 'Travel', homebase: 'Homebase' };
/** The code a class takes in an account's rendered string (accountString.ts deriveAccountString — after the entity's letter). */
export const LOCATION_CODES: Readonly<Record<LocationClass, string>> = { travel: 'TRV', homebase: 'HOM' };

export const isLocationClass = (value: unknown): value is LocationClass => typeof value === 'string' && (LOCATION_CLASSES as readonly string[]).includes(value);

/** "Travel or Homebase" — built from the two words. */
export const LOCATION_CHOICE_WORDS = LOCATION_CLASSES.map((c) => LOCATION_WORDS[c]).join(' or ');
export const locationUnknownWords = (typed: string): string => `Location ${JSON.stringify(typed)} is not one this app knows — ${LOCATION_CHOICE_WORDS}`;
export const LOCATION_NOT_TEXT_WORDS = `Location is ${LOCATION_CHOICE_WORDS}, or left out`;

export type LocationRead = { readonly ok: true; readonly value: LocationClass | null } | { readonly ok: false; readonly words: string };

/**
 * A typed Location → the class, none, or why not. undefined, null and only spaces are NONE (null) — not said. A class's key or
 * its word, in either case, trimmed → that class. Text that is neither is refused in words that name it; anything that is not
 * text is refused too. Nothing is guessed: a word this app does not know is never read as one it does.
 */
export function readLocationClass(input: unknown): LocationRead {
  if (input === undefined || input === null) return { ok: true, value: null };
  if (typeof input !== 'string') return { ok: false, words: LOCATION_NOT_TEXT_WORDS };
  const typed = input.trim();
  if (typed === '') return { ok: true, value: null };
  const key = typed.toLowerCase();
  const found = LOCATION_CLASSES.find((c) => c === key || LOCATION_WORDS[c].toLowerCase() === key);
  return found === undefined ? { ok: false, words: locationUnknownWords(typed) } : { ok: true, value: found };
}

/** A STORED Location → the class, or null when the row says none. Anything else is thrown by name: the column is CHECKed, so a stored one is one of the two. */
export function locationClassOf(stored: string | null, what: string): LocationClass | null {
  if (stored === null) return null;
  if (isLocationClass(stored)) return stored;
  throw new Error(`locationClass: ${what} holds the Location ${JSON.stringify(stored)} — not one of ${LOCATION_CLASSES.join(', ')}`);
}
