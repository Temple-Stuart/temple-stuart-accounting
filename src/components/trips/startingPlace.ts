/**
 * HOME-BRIEF-05 (Alex, 2026-11-10 19:00: "start with events, and then once you select them, do flights, and hotels";
 * 2026-11-09 17:45: "would be cool if that populated destination but like user gonna wanna pick their own travel
 * dates") — THE STARTING PLACE of a hotel search: the place an event on the home page hands to the Hotels form when
 * its "Stay near it →" is pressed.
 *
 * WHY A CONTEXT. The Hotels form (PublicHotelSearch.tsx) is in the booking-flow freeze and is not edited. It takes its
 * destination only from the picker it mounts — <CountryCityPicker onChange={setPicked} /> — and the picker is not
 * frozen. So the place reaches the picker through React context, and the picker reports it up through the same
 * onChange a click uses: the form never learns where its destination came from. The landing's booking box
 * (LandingBookingSection.tsx) provides the context around the Hotels panel; every other mount of the form provides
 * none, the default is null, and with null the picker is exactly what it was.
 *
 * WHAT IS HERE: the place's type, its context, the two sentences the picker says when the hotel list does not hold the
 * place, and the ONE function that matches an event's city to the list. Nothing here fetches, stores or reads a clock.
 * No directive: its importers are client components (the picker, the box), which is where a context may be made.
 */
import { createContext } from 'react';

/** The place a hotel search starts from: the event's country — its ISO-2 code and its name — and its city, as the event's row writes them. */
export interface StartingPlace {
  countryCode: string;
  country: string;
  city: string;
}

/** Null — the default, and every mount but the landing's Hotels panel — means no starting place: the picker behaves exactly as it does without one. */
export const StartingPlaceContext = createContext<StartingPlace | null>(null);

/** Under the City field, when the country's list holds no city of that name: the event's city is typed in, not chosen. */
export function cityNotInListLine(city: string): string {
  return `“${city}” isn’t in the hotel list under that name — pick the nearest city from the list.`;
}

/** Under the Country field, when the country list does not hold the event's country code: nothing is chosen. */
export function countryNotInListLine(country: string): string {
  return `${country} isn’t in the hotel list — pick a country.`;
}

/** A name as it is compared: trimmed, lower-cased, its accents stripped (decomposed, the combining marks dropped). */
const folded = (name: string): string => name.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

/**
 * THE ONE MATCH: an event's city against a country's list of cities. Both sides are folded the same way; the answer is
 * THE LIST'S OWN string when exactly one list city is the same name, and null otherwise — none, or more than one. Never
 * a nearest and never a partial match: a city the list does not hold under that name is not chosen for the visitor.
 */
export function matchCity(city: string, list: readonly string[]): string | null {
  const want = folded(city);
  const same = list.filter((name) => folded(name) === want);
  return same.length === 1 ? same[0] : null;
}
