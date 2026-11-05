/**
 * TRIPPOST-01 (Alex, 2026-11-05) — THE TRIP POSTS. A stop's whole story, once Alex has
 * written it up: the short version, what he'd do differently, what it cost, every day,
 * what was on, his picks. One post per stop, keyed by its WAS_HERE stop id
 * (src/lib/wasHere.ts). TRIPCARDS-01 (Alex, 2026-11-05): a card shows only the stop and what it
 * cost, so the post's title lives here, beside its dek (src/lib/tripPostCards.ts is gone).
 * Alex's own words, edited for spelling and length, approved by him. THIS FILE IS DATA AND
 * PURE FUNCTIONS: no fetch, no env, no clock, no React (the wasHere.ts rule). Zero imports.
 *
 * WHO READS IT. Only the server page src/app/my-trip/[id]/page.tsx. The landing is a client
 * component and never imports this file, so no post body ships in the home page's JavaScript
 * (src/lib/tripPostWords.ts imports it with `import type` only).
 *
 * THE SHAPE. Every post is exactly { stopId, title, dek, short, lessons, costs, costNote, weeks,
 * picks, writtenOn }:
 *   · stopId names a WAS_HERE row (the build checks it);
 *   · title is the post's title — its page's h1;
 *   · dek is the line under the title;
 *   · short — THE SHORT VERSION — exactly { label, value } each;
 *   · lessons — WHAT I'D DO DIFFERENTLY — exactly { lead, rest } each;
 *   · costs — WHAT IT COST, after the stop's own three (stay, motorbike, flight in — every
 *     stop's, in src/lib/tripCosts.ts; TRIPCARDS-01) — exactly { what, detail, amountCents }
 *     each, amountCents integer cents or null: null is an amount that is not in his log, and
 *     the words say so (src/lib/tripPostWords.ts NOT_IN_LOG);
 *   · costNote — the line under the costs;
 *   · weeks — THE MONTH, DAY BY DAY — exactly { title, days } each; a day is exactly { date,
 *     story, chips }, a chip exactly { kind, value }, kind one of TRIP_POST_CHIP_KINDS;
 *   · picks — MY PICKS — exactly { heading, items } each;
 *   · writtenOn — the day the post was written, 'YYYY-MM-DD'.
 *
 * THE LAW (module scope; re-run at build by scripts/assert-tool-registry.ts, which adds what
 * only it can see — every post's stop id is a WAS_HERE id, and every day falls inside its
 * stop's stay). It refuses by name: an empty or duplicate stopId; a post whose keys are not
 * exactly the ten; an empty title, dek or costNote; writtenOn not
 * 'YYYY-MM-DD'; no short entries, or an empty label or value; no lessons, or an empty lead or
 * rest; a cost with an empty what or detail, or an amountCents neither null nor a positive safe
 * integer; no weeks; a week with an empty title or no days; a day date not 'YYYY-MM-DD'; day
 * dates not strictly ascending across the whole post (a repeat is a refusal); a day after
 * writtenOn; an empty story; a chip kind not one of the four; an empty chip value; two chips of
 * one kind on one day; no picks, an empty heading, or a heading with no items or an empty item;
 * and any nested entry whose keys are not exactly its ruled ones. No clock anywhere.
 */

export type TripPostChipKind = 'brunch' | 'dinner' | 'activity' | 'entertainment';
/** The four chip kinds, in the order a day lists them. */
export const TRIP_POST_CHIP_KINDS: readonly TripPostChipKind[] = ['brunch', 'dinner', 'activity', 'entertainment'];

export interface TripPostChip {
  kind: TripPostChipKind;
  value: string;
}

export interface TripPostDay {
  /** 'YYYY-MM-DD'. */
  date: string;
  story: string;
  chips: TripPostChip[];
}

export interface TripPostWeek {
  title: string;
  days: TripPostDay[];
}

export interface TripPostShort {
  label: string;
  value: string;
}

export interface TripPostLesson {
  lead: string;
  rest: string;
}

export interface TripPostCost {
  what: string;
  detail: string;
  /** Integer cents — or null: the amount is not in his log. */
  amountCents: number | null;
}

export interface TripPostPick {
  heading: string;
  items: string[];
}

export interface TripPost {
  /** A WAS_HERE id. */
  stopId: string;
  /** The post's title — its page's h1. */
  title: string;
  dek: string;
  short: TripPostShort[];
  lessons: TripPostLesson[];
  costs: TripPostCost[];
  costNote: string;
  weeks: TripPostWeek[];
  picks: TripPostPick[];
  /** 'YYYY-MM-DD'. */
  writtenOn: string;
}

/** The ten keys every post carries, in the ruled order. */
export const TRIP_POST_FIELDS = ['stopId', 'title', 'dek', 'short', 'lessons', 'costs', 'costNote', 'weeks', 'picks', 'writtenOn'] as const;

export const TRIP_POSTS: readonly TripPost[] = [
  {
    stopId: 'canggu-2026-07',
    title: 'Thirty days in Canggu with no plan.',
    dek: 'I showed up in Bali without a plan. Here’s every day of it: where I ate, what I did, what it cost, and what I’d do differently.',
    short: [
      { label: 'Favorite restaurant', value: 'Ulekan' },
      { label: 'Best day', value: 'the Uluwatu day trip, Jul 5' },
      { label: 'Best night', value: 'FINNS Beach Club, then the G Swing, Jul 28' },
      { label: 'Biggest mistake', value: 'showing up with no plan' },
    ],
    lessons: [
      { lead: 'Plan before you land.', rest: 'I left with no clear plan and spent too many days at a café trying to figure out what to do, when, and what it would cost.' },
      { lead: 'Get a scooter on day one.', rest: 'I suggested we walk. We walked. You need a bike in Canggu.' },
      { lead: 'Pack a plug adapter.', rest: 'US chargers don’t fit Indonesian outlets.' },
      { lead: 'Canggu wakes up around 7:30–8am.', rest: 'I was out at 6 looking for breakfast.' },
      { lead: 'It’s petrol.', rest: 'Call it gas and people look at you like an alien.' },
      { lead: 'Wear repellent.', rest: 'One mosquito bite and I had every symptom of dengue for a few days.' },
      { lead: 'Use a wash-and-fold shop.', rest: 'Same day, and half the price of the hotel’s laundry.' },
      { lead: 'Apply for your next visa three weeks out.', rest: 'I paid $100 for an expedited one instead of $25.' },
      { lead: 'Skip the airport bar.', rest: 'I got tipsy, missed my flight, and spent a night in Hanoi.' },
      { lead: 'Give Uluwatu its own trip.', rest: 'One day there wasn’t enough.' },
    ],
    costs: [
      { what: 'My next visa (Vietnam, for stop 2)', detail: 'Expedited, because I applied late · standard is $25', amountCents: 10000 },
    ],
    costNote: 'These are the numbers in my log. The rest of the month’s spending isn’t in this post yet.',
    weeks: [
      { title: 'Finding my feet', days: [
        { date: '2026-07-01', story: 'Landed in Bali around sunset and took a Grab to The Daun in Canggu. Really good price, amazing location. By the time I got there it was dark, so I walked next door to M Mart for water and called it a night.', chips: [] },
        { date: '2026-07-02', story: 'Walked across the street for breakfast at Negrita Cafe. No scooter yet. Found out US wall chargers don’t fit Indonesian outlets, so back to M Mart for an adapter. Walked down the road to check out ZIN Cafe and its gym, ZINFIT, then the beach to look at the surf schools and board rentals. A friend took me to Times Beach Warung for sunset dinner and drinks, and then we walked around Canggu so I could get my bearings. I’d suggested we walk. She said: OK, you want to walk, let’s walk, you’ll see. I saw.', chips: [{ kind: 'brunch', value: 'Negrita Cafe' }, { kind: 'dinner', value: 'Times Beach Warung' }] },
        { date: '2026-07-03', story: 'Up at 6 for breakfast, and I learned fast that Canggu is a 7:30–8am kind of town. Found Doppio Café: great food and a great look. At 9 the rental shop next to The Daun set me up with a scooter, and they do petrol fill-ups too. Spent the afternoon planning the trip, then rode with a friend to Ulekan for dinner, probably my favorite restaurant of the whole trip and where I found out how good Indonesian food really is. After dinner: Shooters, for mini golf and throwing axes at a wall.', chips: [{ kind: 'brunch', value: 'Doppio Café' }, { kind: 'dinner', value: 'Ulekan' }, { kind: 'activity', value: 'Scooter (Nmax) from Nyoman Motorbike Rental' }, { kind: 'entertainment', value: 'Shooters' }] },
        { date: '2026-07-04', story: 'Rode around alone to learn Canggu. Breakfast at Tiga, very good. At 9 sharp a friend picked me up on her bike for beachwalk Shopping Center, since it’s far and she knows the shortcuts. She said I should practice in Bali traffic before I tried them or I’d slow us down. She was probably right. Bought a bunch of island-vibe clothes, came back, and spent the evening planning the activities I want to do and what they’ll cost.', chips: [{ kind: 'brunch', value: 'Tiga' }, { kind: 'dinner', value: 'ZIN Cafe' }, { kind: 'activity', value: 'beachwalk Shopping Center' }] },
        { date: '2026-07-05', story: 'Cold brew at The Daun’s own café. Canggu has a real trend for good coffee. Then a friend and I rode out to Uluwatu for the day, and it’s amazing. I’m already planning a trip back just for Uluwatu. Lunch at Jimmy Beach Cafe on Balangan Beach with a front-row view of the left-hand reef break and super blue water. Then the Sundaze market at Hatch for a few tees and board shorts at a good price, a haircut at Cukuruku Barbershop while she was at her hair appointment, and dinner at Papi Sapi. Amazing. Uluwatu left a lasting impression on me.', chips: [{ kind: 'brunch', value: 'Jimmy Beach Cafe, Balangan' }, { kind: 'dinner', value: 'Papi Sapi Neighbourhood Grill, Uluwatu' }, { kind: 'activity', value: 'Haircut at Cukuruku Barbershop' }, { kind: 'entertainment', value: 'Sundaze Uluwatu Market at Hatch' }] },
        { date: '2026-07-06', story: 'Slow morning, then brunch and more trip planning: what I’ll do each day. Sunset at Times Beach Warung with a friend, her cousin and another friend. Sunset dinner and drinks is basically a daily ritual in Bali. After that we all went to Berawa’s Kitchen to eat more, sit and talk. Caught up with a college friend in Jakarta about coming to visit.', chips: [{ kind: 'brunch', value: 'ZIN Cafe' }, { kind: 'dinner', value: 'Times Beach Warung' }, { kind: 'entertainment', value: 'Berawa’s Kitchen' }] },
        { date: '2026-07-07', story: 'Filled up the scooter and learned it’s called petrol here. Call it gas and people look at you like an alien. Then a whole day at the café planning the trip ahead. Didn’t do much else.', chips: [{ kind: 'brunch', value: 'ZIN Cafe' }, { kind: 'dinner', value: 'ZIN Cafe' }] },
      ] },
      { title: 'Sick, then sunsets', days: [
        { date: '2026-07-08', story: 'Surfed for an hour on a board from My Mate Surf, then breakfast on the beach at Manta the Oasis with a view of the surfers. Later that day I had every symptom of dengue. Not great, but there was no way I was missing a minute of Bali, so I pushed through. Dinner with a new friend at La Baruna, the beachfront restaurant in Pererenan, then a walk through the streets and the Bali Niki Art Market looking for board shorts.', chips: [{ kind: 'brunch', value: 'Manta the Oasis' }, { kind: 'dinner', value: 'La Baruna, Pererenan' }, { kind: 'activity', value: 'Surfboard from My Mate Surf' }, { kind: 'entertainment', value: 'Bali Niki Art Market' }] },
        { date: '2026-07-09', story: 'Really feeling it today: totally fine until I eat, then 20–30 minutes of feeling awful, and low energy all day. Dropped my laundry with the hotel staff and tested breakfast at Negrita Cafe. Same thing. Spent most of the day in bed. Felt better by evening, so I picked up a friend on the scooter for ramen at Chotto Motto in Seseh, and my stomach hit again right after. Ice cream was a struggle. She told me to try coconut water, so I took one home.', chips: [{ kind: 'brunch', value: 'Negrita Cafe' }, { kind: 'dinner', value: 'Chotto Motto Ramen, Seseh' }] },
        { date: '2026-07-10', story: 'Finally feeling better. It only lasted a few days. Lay in the sun outside my room, did push-ups, squats and crunches, then spent the day at the café still trying to plan the whole trip. I left with no clear plan, so I keep sitting around trying to figure out how to plan the things I want to do.', chips: [{ kind: 'brunch', value: 'ZIN Cafe' }, { kind: 'dinner', value: 'ZIN Cafe' }] },
        { date: '2026-07-11', story: 'Laundry came back after two days: washed, folded, vacuum-sealed and smelling amazing. Straight into the suitcase. Brunch at Open House with a new friend. Amazing food and good vibes, one of my favorites. Sunset drinks at Warung Alus on Munggu Beach with kites all over the sky, a super beautiful spot. Custom frozen yogurt at MIYO for dessert, then home after a long day exploring.', chips: [{ kind: 'brunch', value: 'Open House' }, { kind: 'dinner', value: 'Warung Alus, Munggu Beach' }, { kind: 'entertainment', value: 'MIYO' }] },
        { date: '2026-07-12', story: 'Morning at the café sorting out what activities and entertainment I want to do, when, and what they’ll cost, in a way that’s clear to me. Dinner with a friend: appetizers at YUKI, which were amazing, then she took me to a local spot with authentic Indonesian food, better prices, and money that stays in the community. I wish I knew its name. Drove around looking at the villas I could have rented, then home.', chips: [{ kind: 'brunch', value: 'ZIN Cafe' }, { kind: 'dinner', value: 'YUKI, then a local spot (name unknown)' }] },
        { date: '2026-07-13', story: 'More planning, more budgeting, more time sitting and suffering because I didn’t plan this trip before I left. Then another haircut, at Dirty Sanchez. Then a night at Alex Villas, since I’m thinking about coming back to Bali and wanted to see what a nicer villa is like. Super nice. A friend came over, we had manicures, pedicures and massages come to us, ordered sushi on Grab and watched movies. Had a blast.', chips: [{ kind: 'brunch', value: 'ZIN Cafe' }, { kind: 'dinner', value: 'Sushi on Grab' }, { kind: 'activity', value: 'Haircut at Dirty Sanchez Barber Shop' }, { kind: 'entertainment', value: 'Alex Villas' }] },
        { date: '2026-07-14', story: 'Week two done. Duck and spicy rice on Grab for breakfast, snacks and water from Pepito Market for my room, dropped my friend home, then the café until close, sorting out a trip to Jakarta.', chips: [{ kind: 'brunch', value: 'Grab' }, { kind: 'dinner', value: 'ZIN Cafe' }, { kind: 'activity', value: 'Pepito Market' }] },
      ] },
      { title: 'The gym, a Jakarta detour, and a new café', days: [
        { date: '2026-07-15', story: 'Breakfast at the café, then my first workout of the trip on a day pass at ZINFIT, the gym upstairs. First time lifting in kilos: I almost died putting 225 on the bench thinking it was 135. A Grab to beachwalk Shopping Center to meet a friend, sushi at Genki Sushi, a few hours walking around, then back to hang by the pool with the staff where I’m staying.', chips: [{ kind: 'brunch', value: 'ZIN Cafe' }, { kind: 'dinner', value: 'Genki Sushi, beachwalk Shopping Center' }, { kind: 'activity', value: 'Gym day pass, ZINFIT GYM' }, { kind: 'entertainment', value: 'beachwalk Shopping Center' }] },
        { date: '2026-07-16', story: 'Making plans for two days in Jakarta, hoping to see a college buddy. Day two at the gym, and pretty sore after. Home early.', chips: [{ kind: 'brunch', value: 'ZIN Cafe' }, { kind: 'dinner', value: 'ZIN Cafe' }, { kind: 'activity', value: 'Gym, ZINFIT GYM' }] },
        { date: '2026-07-17', story: 'Breakfast at the café, then a Grab to the airport with a friend and a flight to Jakarta. Checked into the Shangri-La. My college buddy had gone to Singapore for the weekend, so we missed each other. We met my friend’s friends at a club, and I love that clubs in Asia are restaurants and clubs at once, because I’m an old man and I like to sit and eat when I drink. Pretty good night.', chips: [{ kind: 'brunch', value: 'ZIN Cafe' }, { kind: 'dinner', value: 'Bali airport' }, { kind: 'entertainment', value: 'A club in Jakarta' }] },
        { date: '2026-07-18', story: 'Breakfast at the hotel’s restaurant downstairs, then a three-hour Grab to Serang in Banten with my friend. Checked into the Aston and took it easy. That was the day.', chips: [{ kind: 'brunch', value: 'Nishimura, Shangri-La Jakarta' }, { kind: 'dinner', value: 'Ivy Restaurant, Aston Serang Hotel & Convention Center' }] },
        { date: '2026-07-19', story: 'Breakfast at the hotel, a ride back to Jakarta, a flight to Bali, more driving. A travel day. Home around 9:30pm, dinner on Grab in bed and movies.', chips: [{ kind: 'brunch', value: 'Ivy Restaurant, Aston Serang Hotel & Convention Center' }, { kind: 'dinner', value: 'Grab' }] },
        { date: '2026-07-20', story: 'The whole day at the café getting the trip better laid out. Brunch there, dinner there, home to sleep.', chips: [{ kind: 'brunch', value: 'ZIN Cafe' }, { kind: 'dinner', value: 'ZIN Cafe' }] },
        { date: '2026-07-21', story: 'Realized I’d been eating at the same café way too much, so I tried Fold, and I’m really happy I did: amazing food and cold brew. Dinner on a rooftop watching the sunset.', chips: [{ kind: 'brunch', value: 'Fold' }] },
      ] },
      { title: 'The best food of the trip, then goodbye', days: [
        { date: '2026-07-22', story: 'Breakfast at Revolver, which three people had told me to try, and now I see why. Another rooftop dinner at sunset.', chips: [{ kind: 'brunch', value: 'Revolver' }] },
        { date: '2026-07-23', story: 'Cafe Coach for breakfast. Amazing food again, and a coconut cold brew that was so, so good. Bali has a ton of good restaurants.', chips: [{ kind: 'brunch', value: 'Cafe Coach' }] },
        { date: '2026-07-24', story: 'Brunch at Cocomo: pricey, but wow, that food was amazing. Dropped my laundry at March Wash for wash-and-fold: same day, faster, and half the price of having the hotel do it. Planned the trip while I waited, picked it up, then dinner on Grab and movies in bed.', chips: [{ kind: 'brunch', value: 'Cocomo' }, { kind: 'dinner', value: 'Grab' }, { kind: 'activity', value: 'March Wash Laundry' }] },
        { date: '2026-07-25', story: 'Brunch at Two Face. I had plans for a wild adventure, but a pretty cool guy started talking and we sat there five hours. Caught the sunset at the beach, then a new friend messaged me on Instagram about dinner. Better than nothing! We got ramen at Yumei Noodles, right next to where I’m staying and hidden off the street. I never knew it was there.', chips: [{ kind: 'brunch', value: 'Two Face' }, { kind: 'dinner', value: 'Yumei Noodles' }, { kind: 'entertainment', value: 'Sunset at Times Beach Warung' }] },
        { date: '2026-07-26', story: 'Brunch with the same friend at Kawisari Coffee Farm Shop & Eatery. So good. We left the bikes there and walked Echo Beach up to the sunset point, then Smoke Bali for American BBQ. Two hits in one day. Walked back to the bikes and rode home.', chips: [{ kind: 'brunch', value: 'Kawisari Coffee Farm Shop & Eatery' }, { kind: 'dinner', value: 'Smoke Bali' }, { kind: 'entertainment', value: 'Echo Beach sunset point' }] },
        { date: '2026-07-27', story: 'Authentic Indonesian breakfast at Warung Varuna, on a friend’s suggestion. Then planning stop 2: I hadn’t even booked my hotel in Da Nang yet, so I booked it today on Airbnb. I also applied for my Vietnam visa at the last minute. I was supposed to do it three weeks ahead, and paid $100 for an expedited service instead of $25. Dinner with a friend at ACME, which I can’t believe I hadn’t tried. The brisket sandwich is super good. At least I tried it before it was time to go.', chips: [{ kind: 'brunch', value: 'Warung Varuna' }, { kind: 'dinner', value: 'ACME' }] },
        { date: '2026-07-28', story: 'Brunch with a friend at 7AM | 7PM. Lots of hype, and I see why. Walked to Pererenan Beach to see the Gajah Mina statue, then along to Echo Beach to watch the surfers and the sunset, and back for the bikes. Ramen at Ramen Hamatora because I kept seeing Naruto on the sign, and it was good. Then, finally, FINNS Beach Club, and it was sick. I’m old and sick of clubs, but this one excited me. Then the G Swing to wrap up the day.', chips: [{ kind: 'brunch', value: '7AM | 7PM' }, { kind: 'dinner', value: 'Ramen Hamatora' }, { kind: 'activity', value: 'The G Swing' }, { kind: 'entertainment', value: 'FINNS Beach Club' }] },
        { date: '2026-07-29', story: 'My last full day in Bali, and I’m sad. Laundry to March Wash so I’d pack clean clothes, brunch at BAKED while I caught up with a buddy back home on FaceTime, then cleaned my room so the staff wouldn’t have much to do after I left. Packed, unpacked and repacked. I always get paranoid I’ll leave something behind. Dinner at KYND Community: I’m not vegan and didn’t know it was a vegan place, but I didn’t want to be rude and leave, and honestly I enjoyed it.', chips: [{ kind: 'brunch', value: 'BAKED.' }, { kind: 'dinner', value: 'KYND Community' }, { kind: 'activity', value: 'March Wash Laundry' }] },
        { date: '2026-07-30', story: 'Returned the scooter, walked to ACME for one more brisket sandwich, and took a Grab to the airport. Sad the whole ride, and a little excited for the next stop. Then I got a little tipsy at the airport bar and missed my flight. It was the last day of my visa, so I bought a new ticket to Hanoi for a night and decided to have a good time with my mistake. More on that in stop 2.', chips: [{ kind: 'brunch', value: 'ACME' }, { kind: 'activity', value: 'Scooter returned' }] },
      ] },
    ],
    picks: [
      { heading: 'Favorite restaurant', items: ['Ulekan'] },
      { heading: 'Breakfast and brunch', items: ['Open House', 'Fold (the cold brew)', 'Revolver', 'Cafe Coach (coconut cold brew)', 'Cocomo (pricey, worth it)', 'Kawisari Coffee Farm Shop & Eatery', '7AM | 7PM', 'Doppio Café', 'Tiga'] },
      { heading: 'Dinner', items: ['Papi Sapi Neighbourhood Grill, Uluwatu', 'Smoke Bali', 'ACME (the brisket sandwich)', 'Yumei Noodles (hidden ramen)', 'YUKI'] },
      { heading: 'Sunsets', items: ['Times Beach Warung', 'Echo Beach sunset point', 'Warung Alus, Munggu Beach', 'Jimmy Beach Cafe, Balangan'] },
      { heading: 'At night', items: ['FINNS Beach Club', 'The G Swing', 'Shooters, Seminyak (mini golf and axe throwing)'] },
      { heading: 'Shopping', items: ['Sundaze Uluwatu Market at Hatch', 'beachwalk Shopping Center', 'Bali Niki Art Market'] },
      { heading: 'Practical', items: ['March Wash Laundry', 'Pepito Market', 'Nyoman Motorbike Rental'] },
    ],
    writtenOn: '2026-11-05',
  },
];

export class TripPostsLawError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TripPostsLawError';
  }
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const isIso = (value: unknown): value is string => typeof value === 'string' && ISO_DATE.test(value);
const nonEmpty = (value: unknown): boolean => typeof value === 'string' && value.trim() !== '';
const isObject = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);
const keysAre = (value: Record<string, unknown>, fields: readonly string[]): boolean => Object.keys(value).sort().join(',') === [...fields].sort().join(',');
const positiveCents = (value: unknown): boolean => typeof value === 'number' && Number.isSafeInteger(value) && value > 0;

/** THE LAW. Throws on failure by default; returns the violations list when asked not to throw. `posts` is injectable for tests. */
export function tripPostsLaw(opts: { throwOnFail?: boolean; posts?: readonly TripPost[] } = {}): string[] {
  const violations: string[] = [];
  const posts = opts.posts ?? TRIP_POSTS;
  const ids = new Set<string>();
  for (const post of posts) {
    const who = nonEmpty(post.stopId) ? post.stopId : '(no stopId)';
    if (!nonEmpty(post.stopId)) violations.push(`${who}: empty stopId`);
    if (!keysAre(post as unknown as Record<string, unknown>, TRIP_POST_FIELDS)) violations.push(`${who}: keys are [${Object.keys(post).join(', ')}] — a post carries exactly the ten ruled fields`);
    if (ids.has(post.stopId)) violations.push(`${who}: duplicate stopId`);
    ids.add(post.stopId);
    if (!nonEmpty(post.title)) violations.push(`${who}: empty title`);
    if (!nonEmpty(post.dek)) violations.push(`${who}: empty dek`);
    if (!nonEmpty(post.costNote)) violations.push(`${who}: empty costNote`);
    const written = isIso(post.writtenOn);
    if (!written) violations.push(`${who}: writtenOn "${post.writtenOn}" is not YYYY-MM-DD`);

    // THE SHORT VERSION.
    if (!Array.isArray(post.short) || post.short.length === 0) violations.push(`${who}: no short entries`);
    else post.short.forEach((s, i) => {
      if (!isObject(s) || !keysAre(s, ['label', 'value'])) violations.push(`${who}: short[${i}] keys are not exactly label, value`);
      else {
        if (!nonEmpty(s.label)) violations.push(`${who}: short[${i}] has an empty label`);
        if (!nonEmpty(s.value)) violations.push(`${who}: short[${i}] has an empty value`);
      }
    });

    // WHAT I'D DO DIFFERENTLY.
    if (!Array.isArray(post.lessons) || post.lessons.length === 0) violations.push(`${who}: no lessons`);
    else post.lessons.forEach((l, i) => {
      if (!isObject(l) || !keysAre(l, ['lead', 'rest'])) violations.push(`${who}: lessons[${i}] keys are not exactly lead, rest`);
      else {
        if (!nonEmpty(l.lead)) violations.push(`${who}: lessons[${i}] has an empty lead`);
        if (!nonEmpty(l.rest)) violations.push(`${who}: lessons[${i}] has an empty rest`);
      }
    });

    // WHAT IT COST — the stay is the card's; these are the rows after it. An empty list is allowed.
    if (!Array.isArray(post.costs)) violations.push(`${who}: costs is not a list`);
    else post.costs.forEach((c, i) => {
      if (!isObject(c) || !keysAre(c, ['what', 'detail', 'amountCents'])) { violations.push(`${who}: costs[${i}] keys are not exactly what, detail, amountCents`); return; }
      if (!nonEmpty(c.what)) violations.push(`${who}: costs[${i}] has an empty what`);
      if (!nonEmpty(c.detail)) violations.push(`${who}: costs[${i}] has an empty detail`);
      if (c.amountCents !== null && !positiveCents(c.amountCents)) violations.push(`${who}: costs[${i}] amountCents ${JSON.stringify(c.amountCents)} is neither null nor a positive whole number of cents`);
    });

    // THE MONTH, DAY BY DAY — dates strictly ascending across the whole post, none after writtenOn.
    if (!Array.isArray(post.weeks) || post.weeks.length === 0) violations.push(`${who}: no weeks`);
    else {
      let previous: string | null = null;
      post.weeks.forEach((week, w) => {
        const weekWho = `${who} · week ${w + 1}`;
        if (!isObject(week) || !keysAre(week, ['title', 'days'])) { violations.push(`${weekWho}: keys are not exactly title, days`); return; }
        if (!nonEmpty(week.title)) violations.push(`${weekWho}: empty title`);
        if (!Array.isArray(week.days) || week.days.length === 0) { violations.push(`${weekWho}: no days`); return; }
        for (const day of week.days) {
          if (!isObject(day) || !keysAre(day, ['date', 'story', 'chips'])) { violations.push(`${weekWho}: a day whose keys are not exactly date, story, chips`); continue; }
          const dayWho = `${who} · ${String(day.date)}`;
          if (!isIso(day.date)) { violations.push(`${dayWho}: date "${String(day.date)}" is not YYYY-MM-DD`); continue; }
          if (previous !== null && day.date <= previous) violations.push(`${dayWho}: comes after ${previous} — day dates run strictly ascending across the post, each once`);
          previous = day.date;
          if (written && day.date > post.writtenOn) violations.push(`${dayWho}: is after writtenOn ${post.writtenOn} — a post is written after its days`);
          if (!nonEmpty(day.story)) violations.push(`${dayWho}: empty story`);
          if (!Array.isArray(day.chips)) { violations.push(`${dayWho}: chips is not a list`); continue; }
          const kinds = new Set<string>();
          day.chips.forEach((chip, c) => {
            if (!isObject(chip) || !keysAre(chip, ['kind', 'value'])) { violations.push(`${dayWho}: chips[${c}] keys are not exactly kind, value`); return; }
            if (!(TRIP_POST_CHIP_KINDS as readonly unknown[]).includes(chip.kind)) violations.push(`${dayWho}: chip kind "${String(chip.kind)}" is not brunch | dinner | activity | entertainment`);
            if (!nonEmpty(chip.value)) violations.push(`${dayWho}: chips[${c}] has an empty value`);
            if (kinds.has(String(chip.kind))) violations.push(`${dayWho}: two chips of kind "${String(chip.kind)}" — one of each kind a day`);
            kinds.add(String(chip.kind));
          });
        }
      });
    }

    // MY PICKS.
    if (!Array.isArray(post.picks) || post.picks.length === 0) violations.push(`${who}: no picks`);
    else post.picks.forEach((p, i) => {
      if (!isObject(p) || !keysAre(p, ['heading', 'items'])) { violations.push(`${who}: picks[${i}] keys are not exactly heading, items`); return; }
      if (!nonEmpty(p.heading)) violations.push(`${who}: picks[${i}] has an empty heading`);
      if (!Array.isArray(p.items) || p.items.length === 0) violations.push(`${who}: picks[${i}] has no items`);
      else p.items.forEach((item, j) => { if (!nonEmpty(item)) violations.push(`${who}: picks[${i}] item ${j} is empty`); });
    });
  }
  if (violations.length && opts.throwOnFail !== false) throw new TripPostsLawError(`TRIP POSTS LAW failed:\n  ${violations.join('\n  ')}`);
  return violations;
}

/** The post for a stop — or null when Alex has not written that stop up. */
export function postOf(stopId: string): TripPost | null {
  return TRIP_POSTS.find((p) => p.stopId === stopId) ?? null;
}

tripPostsLaw();
