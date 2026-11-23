/**
 * TripPostView (TRIPPOST-02, Alex, 2026-11-23; TRIPPOST-01 and TRIPCARDS-01, 2026-11-05, before it) — one stop's page, the body of
 * /my-trip/<stop id> (src/app/my-trip/[id]/page.tsx), drawn in the home page's look for every stop from the handoff:
 * design-refs/trippost-02/Post-Reference.html, whose markup it is, token for token, its classes behind the house prefix — and the
 * README beside it. Its stylesheet is that file's, ported into src/app/globals.css (the .ts-post block).
 *
 * ONE COMPONENT, BOTH KINDS (ruling b): a stop written up (its post in src/lib/tripPosts.ts) and a stop not written up yet. A part is
 * drawn only when the stop holds what it shows; nothing is drawn empty and nothing is a placeholder (README, What changes):
 *   · the way back and the stop's place among the stops in the log;
 *   · the head — the eyebrow, the post's title, its dek, the place and the dates; or, not written up, the place as the title, the
 *     dates and the line that says so — beside the stop's photo, whole (a stop with no photo has no frame);
 *   · the four figures (src/lib/tripFigures.ts), each with its sum, or why not, in words;
 *   · what the stop holds of its own: Alex's line, the event it was around (its four lines), DID and LEARNED;
 *   · written up: the tabs (TripPostTabs.tsx), then the short version, his day, his favorites, what it cost, the journal
 *     (TripPostJournal.tsx), what he learned and what was on, each numbered by its place;
 *   · not written up: what it cost and, where it has events, what was on, unnumbered;
 *   · the stop before and the stop after (the footer's own list), the band, and on a stop written up the day it was written.
 * PURE and server-safe: props in, markup out. The lit tab and the open day are the two client pieces' own state; nothing else
 * changes on the page. Every word is read from the home the README's Words table names, and every new one from
 * src/lib/tripPostPageWords.ts: none is typed here. No clock.
 */

import type { ReactNode } from 'react';
import type { WasHereRow } from '@/lib/wasHere';
import type { TripPost, TripPostRoutineKind } from '@/lib/tripPosts';
import type { TripCosts, TripMotoDays } from '@/lib/tripCosts';
import type { Experience } from '@/lib/experiences';
import { dateWords, experienceWindowLine, weekdayWords } from '@/lib/experienceWords';
import { listWords, stayWords, stopEventLine, stopEventPlace } from '@/lib/wasHereWords';
import { UNWRITTEN_COST_NOTE, bookLine, chipLabel, costRows, dayLabel, postEyebrow, postMeta, stopHeading, unwrittenLine, weekEyebrow, writtenLine } from '@/lib/tripPostWords';
import { calendarSeats, routineTotals, stopFigures, weekdayDates } from '@/lib/tripFigures';
import {
  ALSO_IN_LOG, BREAKDOWN_LABEL, COSTS_INTRO, COSTS_INTRO_SHARED, EARLIER_DAY, FAVORITES_INTRO, JOIN, JOURNAL_INTRO, LATER_DAY, PAGER_LABEL, PER_DAY, READ_THAT_DAY,
  REST_LABEL, ROUTINE_INTRO, SECTION_WORDS, SHARE_LABEL, SOURCE_WORD, TABS_LABEL, TAKEAWAY_LABEL, TOTAL_NOTE, TripPostPageWordsError, calendarDayWords, dayOfWords,
  daysWords, eventKindWords, motoDetailWords, numberedEyebrow, pagerAfterWords, pagerBeforeWords, routineBarWords, routineKeyWords, shareNoteWords, splitBarWords,
  splitRows, stayDetailWords, stopCountWords, tileWords, totalAmountWords, totalLabel, twoDigits, type PostSectionKey, type StopAround,
} from '@/lib/tripPostPageWords';
import { functionalMoneyWords } from '@/lib/books/functionalCurrency';
import { DEMO_ANCHOR, MY_TRIP_ANCHOR } from '@/lib/homeAnchors'; // FOOTER-01 (2026-11-09): the front door's anchors, from their one home
import TripPostTabs from './TripPostTabs';
import TripPostJournal, { type JournalDay, type JournalWeek } from './TripPostJournal';

export const POST_BACK = '← Back to my trip';
export const POST_BACK_HREF = `/#${MY_TRIP_ANCHOR}`;
/** TRIPCARDS-01: the stop's two lists, as the card once headed them. */
export const DID = 'DID';
export const LEARNED = 'LEARNED';
export const BOOK_BUTTON = 'Book the stay and the flight';
/** The booking strip on the front door (Landing.tsx's live demo act, id={DEMO_ANCHOR}). */
export const BOOK_HREF = `/#${DEMO_ANCHOR}`;

/** Each section's id — what its tab opens — on a stop written up. A stop not written up has no tabs and no ids. */
const SECTION_IDS: Readonly<Record<PostSectionKey, string>> = {
  story: 'post-story',
  routine: 'post-routine',
  favorites: 'post-favorites',
  costs: 'post-costs',
  journal: 'post-journal',
  learned: 'post-learned',
  on: 'post-on',
};
/** Each section's hook, as the page's tests have read it since TRIPPOST-01. */
const SECTION_HOOKS: Readonly<Record<PostSectionKey, string>> = {
  story: 'short',
  routine: 'routine',
  favorites: 'picks',
  costs: 'cost',
  journal: 'days',
  learned: 'differently',
  on: 'on',
};
/** The page's order; a written-up stop draws its day only if the post has one, and what was on only if the stop has events. */
const SECTION_ORDER: readonly PostSectionKey[] = ['story', 'routine', 'favorites', 'costs', 'journal', 'learned', 'on'];
/** The ink of each part of a bar, and of its dot: a day's kinds, the bookings' three lines. */
const KIND_INK: Readonly<Record<TripPostRoutineKind, string>> = {
  activity: 'ts-post-ink--activity',
  meals: 'ts-post-ink--meals',
  focus: 'ts-post-ink--focus',
  entertainment: 'ts-post-ink--entertainment',
  sleep: 'ts-post-ink--sleep',
};
const LINE_INK = { stay: 'ts-post-ink--stay', moto: 'ts-post-ink--moto', flightIn: 'ts-post-ink--flight' } as const;

/** A section: its small heading, its heading, its line where it has one, then what it holds. */
function PostSection({ id, label, first, hook, eyebrow, title, intro, children }: {
  id: string | null;
  label: string;
  first: boolean;
  hook: string;
  eyebrow: string;
  title: string;
  intro: string | null;
  children: ReactNode;
}) {
  return (
    <section id={id === null ? undefined : id} aria-label={label} className={first ? 'ts-post-section ts-post-section--first' : 'ts-post-section'} data-trip-post-section={hook}>
      <p className="ts-post-section__eyebrow">{eyebrow}</p>
      <h2 className="ts-post-section__title">{title}</h2>
      {intro !== null && <p className="ts-post-section__intro">{intro}</p>}
      {children}
    </section>
  );
}

/** The value of the short version's line a favorite names — refused by name where it names none (the posts law holds it). */
function shortValueOf(post: TripPost, label: string): string {
  const line = post.short.find((s) => s.label === label);
  if (line === undefined) throw new TripPostPageWordsError(`${post.stopId}: its favorite names "${label}", no line of its short version`);
  return line.value;
}

export default function TripPostView({ row, costs, post, event, stop, motoDays, stops, around }: {
  row: WasHereRow;
  costs: TripCosts;
  post: TripPost | null;
  event: Experience | null;
  stop: number;
  /** The rental's days, or null (TRIP_MOTO_DAYS). */
  motoDays: TripMotoDays | null;
  /** How many stops the log holds. */
  stops: number;
  /** The stop before and the stop after (the footer's own list), each or null. */
  around: { before: StopAround | null; after: StopAround | null };
}) {
  const figures = stopFigures(row, costs, motoDays);
  const tiles = tileWords(row, figures);
  const rows = costRows(costs, post);
  const lines = rows.slice(0, 3);
  const own = rows.slice(3);
  const details = [stayDetailWords(figures), motoDetailWords(figures, motoDays), null];
  const split = figures.dayShareCents === null ? [] : splitRows(figures);
  const note = post === null ? UNWRITTEN_COST_NOTE : post.costNote;
  const keys = post === null ? [] : SECTION_ORDER.filter((key) => (key !== 'routine' || post.routine !== null) && (key !== 'on' || row.events.length > 0));
  const head = (key: PostSectionKey) => ({
    id: post === null ? null : SECTION_IDS[key],
    label: SECTION_WORDS[key].tab,
    first: post !== null && keys[0] === key,
    hook: SECTION_HOOKS[key],
    eyebrow: post === null ? SECTION_WORDS[key].eyebrow : numberedEyebrow(keys.indexOf(key) + 1, SECTION_WORDS[key].eyebrow),
    title: SECTION_WORDS[key].title,
  });
  const ownParts = row.line !== null || event !== null || row.did.length > 0 || row.learned.length > 0;
  const favorite = post === null || post.feature === null ? null : { ...post.feature, value: shortValueOf(post, post.feature.short) };

  // the journal, in the words it is drawn in: every day, its place among the post's days, its week
  const flatDays = post === null ? [] : post.weeks.flatMap((week, w) => week.days.map((day) => ({ day, week, w })));
  const dates = flatDays.map(({ day }) => day.date);
  const journalDays: JournalDay[] = flatDays.map(({ day, week, w }, i) => ({
    date: day.date,
    label: dayLabel(day.date),
    seat: calendarDayWords(day.date),
    place: dayOfWords(i + 1, flatDays.length),
    week: weekEyebrow(w + 1, week),
    weekTitle: week.title,
    story: day.story,
    chips: day.chips.map((chip) => ({ kind: chip.kind, label: chipLabel(chip.kind), value: chip.value })),
  }));
  const journalWeeks: JournalWeek[] = post === null ? [] : post.weeks.map((week, w) => ({ n: w + 1, when: weekEyebrow(w + 1, week), title: week.title, first: week.days[0].date }));

  const costSection = (
    <PostSection {...head('costs')} intro={figures.dayShareCents === null ? COSTS_INTRO : COSTS_INTRO_SHARED}>
      <div className="ts-post-costs">
        <div className="ts-post-card">
          <p className="ts-post-card__label">{BREAKDOWN_LABEL}</p>
          {lines.map((line, i) => (
            <div key={line.what} className={i === 0 ? 'ts-post-cost ts-post-cost--first' : 'ts-post-cost'} data-trip-post-cost>
              <div>
                <p className="ts-post-cost__what">{line.what}</p>
                {line.kind === 'paid' && <p className="ts-post-cost__name">{line.detail}</p>}
                {details[i] !== null && <p className="ts-post-cost__detail">{details[i]}</p>}
              </div>
              <p className={line.kind === 'paid' ? 'ts-post-cost__amount ts-post-cost__amount--paid' : 'ts-post-cost__amount'}>{line.amount}</p>
            </div>
          ))}
          <div className="ts-post-total"><div><p className="ts-post-total__label">{totalLabel(figures)}</p><p className="ts-post-total__note">{TOTAL_NOTE}</p></div><p className="ts-post-total__amount">{totalAmountWords(figures)}</p></div>
          {own.length > 0 && <p className="ts-post-card__label ts-post-card__label--more">{ALSO_IN_LOG}</p>}
          {own.map((cost) => (
            <div key={cost.what} className="ts-post-cost ts-post-cost--own" data-trip-post-cost>
              <div><p className="ts-post-cost__name">{cost.what}</p>{cost.detail !== '' && <p className="ts-post-cost__detail">{cost.detail}</p>}</div>
              <p className={cost.kind === 'paid' ? 'ts-post-cost__amount ts-post-cost__amount--paid' : 'ts-post-cost__amount'}>{cost.amount}</p>
            </div>
          ))}
        </div>
        {figures.dayShareCents === null ? (
          <div className="ts-post-rest ts-post-rest--alone"><p className="ts-post-rest__label">{REST_LABEL}</p><p className="ts-post-rest__text">{note}</p></div>
        ) : (
          <div className="ts-post-card ts-post-card--stack">
            <p className="ts-post-card__label">{SHARE_LABEL}</p>
            <p className="ts-post-rate">{functionalMoneyWords(figures.dayShareCents)} <span className="ts-post-rate__unit">{PER_DAY}</span></p>
            <p className="ts-post-rate__note">{shareNoteWords(figures)}</p>
            <div className="ts-post-bar ts-post-bar--split" role="img" aria-label={splitBarWords(figures)}>
              {split.map((part) => <span key={part.key} className={`ts-post-bar__part ${LINE_INK[part.key]}`} style={{ flexGrow: part.rateCents }} />)}
            </div>
            <div className="ts-post-split">
              {split.map((part) => (
                <div key={part.key} className="ts-post-split__row"><span className={`ts-post-dot ${LINE_INK[part.key]}`} aria-hidden="true" /><p className="ts-post-split__what"><span className="ts-post-split__name">{part.name}</span> <span className="ts-post-split__sum">{part.sum}</span></p><p className="ts-post-split__rate">{part.rate}</p></div>
              ))}
            </div>
            <div className="ts-post-rest ts-post-rest--foot"><p className="ts-post-rest__label">{REST_LABEL}</p><p className="ts-post-rest__text">{note}</p></div>
          </div>
        )}
      </div>
    </PostSection>
  );

  const onSection = row.events.length > 0 && (
    <PostSection {...head('on')} intro={null}>
      <div className="ts-post-on">
        {row.events.map((ev) => (
          <div key={ev.name} className="ts-post-on__row"><div className="ts-post-on__words"><p className="ts-post-on__when">{stopEventLine(ev)}</p><p className="ts-post-on__name">{ev.name}</p><p className="ts-post-on__place">{stopEventPlace(ev)}</p></div><a href={ev.sourceUrl} rel="noopener" target="_blank" className="ts-post-on__source" data-trip-post-event={ev.name}>{SOURCE_WORD}</a></div>
        ))}
      </div>
    </PostSection>
  );

  return (
    <div className="ts-post" data-trip-post={row.id} data-trip-post-kind={post === null ? 'stop' : 'written'}>
      <div className="ts-post__inner ts-post__top">
        <div className="ts-post__crumb">
          <a href={POST_BACK_HREF} className="ts-post__back" data-trip-post-back>{POST_BACK}</a>
          <p className="ts-post__count">{stopCountWords(stop, stops)}</p>
        </div>
        <div className="ts-post__hero">
          {post !== null ? (
            <header className="ts-post__head" data-trip-post-section="header">
              <p className="ts-post__eyebrow">{postEyebrow(stop)}</p>
              <h1 className="ts-post__title">{post.title}</h1>
              <p className="ts-post__dek">{post.dek}</p>
              <p className="ts-post__meta">{postMeta(row).map((part) => <span key={part}>{part}</span>)}</p>
            </header>
          ) : (
            <header className="ts-post__head" data-trip-post-section="header">
              <p className="ts-post__eyebrow">{postEyebrow(stop)}</p>
              <h1 className="ts-post__title">{stopHeading(row)}</h1>
              <p className="ts-post__meta"><span>{stayWords(row)}</span></p>
              <p className="ts-post__unwritten" data-trip-post-unwritten>{unwrittenLine(row)}</p>
            </header>
          )}
          {row.image !== null && (
            <figure className="ts-post-photo" data-trip-post-section="photo">
              {/* A plain <img>, WasHereSection's precedent: a file under public/, served as-is. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={row.image.src} alt={row.image.alt} className="ts-post-photo__img" />
              <figcaption className="ts-post-photo__credit">{row.image.credit}</figcaption>
            </figure>
          )}
        </div>
        <div className="ts-post-tiles" data-trip-post-section="tiles">
          {tiles.map((tile) => (
            <div key={tile.label} className="ts-post-tile">
              <p className="ts-post-tile__label">{tile.label}</p>
              {tile.value.kind === 'words' ? (
                <p className="ts-post-tile__value ts-post-tile__value--words">{tile.value.text}</p>
              ) : (
                <p className="ts-post-tile__value">{tile.value.text}{tile.value.unit !== null && <> <span className="ts-post-tile__unit">{tile.value.unit}</span></>}</p>
              )}
              {tile.note !== null && <p className="ts-post-tile__note">{tile.note}</p>}
            </div>
          ))}
        </div>
        {ownParts && (
          <div className="ts-post-own">
            {row.line !== null && <p className="ts-post-line" data-trip-post-section="line">{row.line}</p>}
            {event !== null && (
              <div className="ts-post-event" data-trip-post-section="event" data-trip-post-experience={event.id}>
                <p className="ts-post-event__kind">{eventKindWords(event)}</p>
                <p className="ts-post-event__name">{event.name}</p>
                <p className="ts-post-event__venue">{event.venue}</p>
                <p className="ts-post-event__window">{experienceWindowLine(event)}</p>
              </div>
            )}
            {row.did.length > 0 && (
              <section className="ts-post-list" data-trip-post-section="did"><p className="ts-post-list__label">{DID}</p><p className="ts-post-list__text">{listWords(row.did)}</p></section>
            )}
            {row.learned.length > 0 && (
              <section className="ts-post-list" data-trip-post-section="learned"><p className="ts-post-list__label">{LEARNED}</p>{row.learned.map((paragraph, i) => <p key={i} className="ts-post-list__text">{paragraph}</p>)}</section>
            )}
          </div>
        )}
      </div>

      {post !== null && <TripPostTabs label={TABS_LABEL} tabs={keys.map((key) => ({ href: `#${SECTION_IDS[key]}`, label: SECTION_WORDS[key].tab }))} />}

      <div className="ts-post__inner ts-post__body">
        {post !== null && (
          <PostSection {...head('story')} intro={null}>
            <div className="ts-post-short">
              {post.short.map((s) => <div key={s.label} className="ts-post-short__item"><p className="ts-post-short__label">{s.label}</p><p className="ts-post-short__value">{s.value}</p></div>)}
            </div>
          </PostSection>
        )}

        {post !== null && post.routine !== null && (
          <PostSection {...head('routine')} intro={ROUTINE_INTRO}>
            <div className="ts-post-stack">
              <div className="ts-post-card">
                <div className="ts-post-bar" role="img" aria-label={routineBarWords(routineTotals(post.routine))}>
                  {post.routine.blocks.map((block, i) => <span key={i} className={`ts-post-bar__part ${KIND_INK[block.kind]}`} style={{ flexGrow: block.hours }} />)}
                </div>
                <ul className="ts-post-key">
                  {routineTotals(post.routine).map((total) => <li key={total.kind} className="ts-post-key__item"><span className={`ts-post-dot ${KIND_INK[total.kind]}`} aria-hidden="true" />{routineKeyWords(total.kind, total.hours)}</li>)}
                </ul>
              </div>
              <div className="ts-post-pair">
                {post.routine.cards.map((card) => <div key={card.label} className="ts-post-card"><p className="ts-post-card__label">{card.label}</p><p className="ts-post-card__title">{card.title}</p><p className="ts-post-card__text">{card.text}</p></div>)}
              </div>
            </div>
          </PostSection>
        )}

        {post !== null && (
          <PostSection {...head('favorites')} intro={FAVORITES_INTRO}>
            <div className="ts-post-stack">
              {favorite !== null && (
                <div className="ts-post-feature">
                  <div className="ts-post-feature__photo">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={favorite.image.src} alt={favorite.image.alt} className="ts-post-feature__img" />
                  </div>
                  <div className="ts-post-feature__words">
                    <p className="ts-post-feature__label">{favorite.short}</p>
                    <p className="ts-post-feature__value">{favorite.value}</p>
                    <p className="ts-post-feature__line">{favorite.line}</p>
                    <div className="ts-post-feature__foot"><a href={`#${SECTION_IDS.journal}`} className="ts-post-feature__go" data-trip-post-pick={favorite.day}>{READ_THAT_DAY}</a><p className="ts-post-feature__credit">{favorite.image.credit}</p></div>
                  </div>
                </div>
              )}
              <div className="ts-post-picks">
                {post.picks.map((pick) => <div key={pick.heading} className="ts-post-pick"><p className="ts-post-pick__heading">{pick.heading}</p><ul className="ts-post-pick__items">{pick.items.map((item) => <li key={item} className="ts-post-pick__item">{item}</li>)}</ul></div>)}
              </div>
            </div>
          </PostSection>
        )}

        {costSection}

        {post !== null && (
          <PostSection {...head('journal')} intro={JOURNAL_INTRO}>
            <TripPostJournal
              span={dateWords(dates[0], dates[dates.length - 1])}
              count={daysWords(dates.length)}
              weekdays={weekdayDates(dates[0]).map(weekdayWords)}
              seats={calendarSeats(dates)}
              days={journalDays}
              weeks={journalWeeks}
              earlier={EARLIER_DAY}
              later={LATER_DAY}
              join={JOIN}
            />
          </PostSection>
        )}

        {post !== null && (
          <PostSection {...head('learned')} intro={null}>
            <ol className="ts-post-lessons">
              {post.lessons.map((lesson, i) => <li key={lesson.lead} className="ts-post-lesson"><span className="ts-post-lesson__n" aria-hidden="true">{twoDigits(i + 1)}</span><div className="ts-post-lesson__words"><p className="ts-post-lesson__lead">{lesson.lead}</p><p className="ts-post-lesson__rest">{lesson.rest}</p></div></li>)}
            </ol>
            <div className="ts-post-takeaway"><p className="ts-post-takeaway__label">{TAKEAWAY_LABEL}</p><p className="ts-post-takeaway__line">{post.lessons[0].lead}</p></div>
          </PostSection>
        )}

        {onSection}

        {(around.before !== null || around.after !== null) && (
          <nav className="ts-post-pager" aria-label={PAGER_LABEL} data-trip-post-section="pager">
            {around.before !== null && <a href={around.before.href} className="ts-post-pager__card"><span className="ts-post-pager__stop">{pagerBeforeWords(around.before.stop)}</span><span className="ts-post-pager__place">{around.before.place}</span></a>}
            {around.after !== null && <a href={around.after.href} className="ts-post-pager__card ts-post-pager__card--next"><span className="ts-post-pager__stop">{pagerAfterWords(around.after.stop)}</span><span className="ts-post-pager__place">{around.after.place}</span></a>}
          </nav>
        )}

        <section aria-label={BOOK_BUTTON} className="ts-post-band" data-trip-post-section="book"><p className="ts-post-band__line">{bookLine(row)}</p><a href={BOOK_HREF} className="ts-post-band__go">{BOOK_BUTTON}</a></section>

        {post !== null && <p className="ts-post__written" data-trip-post-section="written">{writtenLine(post)}</p>}
      </div>
    </div>
  );
}
