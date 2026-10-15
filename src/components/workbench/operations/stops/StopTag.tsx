/**
 * StopTag — one stop of the day card as a tag for a phone over video (REEL-01, Alex, 2026-10-15).
 *
 * Alex's reel has one bold tag per scene and the full card as the receipt at the end. This is that tag:
 * the badge and the stay's day count and place on top; the vendor big (the stop's name when it has
 * none); the name and the time; the money as the row says it, in the row's tone; the stars when rated;
 * the step view's own spent-so-far line as its foot. Nothing else — no note, no bars, no table.
 *
 * Every word is the day card's (day/dayCard.ts stopTagWords, from the card's own Stop and Focus); the
 * tone's class is the card's own actualTone, handed in, so the colour rule has one home. The element is
 * what day/DayCard.tsx renders to a PNG through cardImage.ts downloadCardImage — the card's pixel ratio,
 * no background of its own outside the rounded corners. It reads nothing and writes nothing. It lives
 * outside the day folder, which stays its three files (daycard01.test.ts T5).
 */

'use client';

import { forwardRef } from 'react';
import { BADGE_WORDS, TAG_WIDTH, type StopTagWords } from '../day/dayCard';

const StopTag = forwardRef<HTMLDivElement, { readonly words: StopTagWords; readonly moneyTone: string }>(function StopTag({ words, moneyTone }, ref) {
  return (
    <div ref={ref} className="bg-ts-white border border-border flex flex-col" style={{ width: TAG_WIDTH, borderRadius: 28, padding: '24px 32px 22px', gap: 10 }} data-stop-tag>
      <div className="flex items-center gap-3">
        <span className="bg-brand-gold text-text-primary rounded-lg flex items-center justify-center font-extrabold shrink-0" style={{ width: 34, height: 34, fontSize: 16 }} aria-hidden="true">{BADGE_WORDS}</span>
        <span className="font-mono font-semibold text-text-muted break-words min-w-0" style={{ fontSize: 20, letterSpacing: '0.04em' }} data-stop-tag-top>{words.top}</span>
      </div>
      <div className="font-extrabold text-text-primary break-words" style={{ fontSize: 58, lineHeight: 1.02, letterSpacing: '-0.01em' }} data-stop-tag-big>{words.big}</div>
      {words.what !== null && <div className="font-semibold text-text-secondary break-words" style={{ fontSize: 30, lineHeight: 1.1 }} data-stop-tag-what>{words.what}</div>}
      {words.money !== null && <div className={`font-extrabold tabular-nums ${words.money.kind === 'budget' ? 'text-text-secondary' : moneyTone}`} style={{ fontSize: 50, lineHeight: 1.05 }} data-stop-tag-money={words.money.kind}>{words.money.words}</div>}
      {words.stars !== null && <div className="font-medium text-text-secondary" style={{ fontSize: 40, lineHeight: 1 }} data-stop-tag-stars>{words.stars}</div>}
      <div className="font-semibold text-text-muted tabular-nums border-t border-border" style={{ fontSize: 20, paddingTop: 10 }} data-stop-tag-foot>{words.foot}</div>
    </div>
  );
});

export default StopTag;
