/**
 * promptSegments (PR-TM-redesign) — the truthful "which spans are user input" model for
 * the Truth Machine's red-input prompt display.
 *
 * A prompt is shown as an ordered list of segments; an 'input' segment is a span the
 * builder INJECTED from the user's project (title / goal / problem / diagnosis / research
 * / audit), a 'template' segment is the fixed prompt scaffolding. The UI colors 'input'
 * segments red — so the red is the builder's DECLARATION of what's interpolated, never a
 * regex guess.
 *
 * NO-DRIFT SAFETY: `verifyAgainst` returns the segments ONLY if they concatenate to the
 * EXACT real prompt string the live call sends; otherwise it returns one neutral segment
 * holding the real string. So the colored preview can never show a prompt that differs
 * from what fires — at worst it shows the real prompt with no coloring.
 */

export interface PromptSegment {
  text: string;
  kind: 'template' | 'input';
}

export function joinSegments(segments: PromptSegment[]): string {
  return segments.map((s) => s.text).join('');
}

/**
 * Truthful guard: only trust the segments if they rebuild the real fired string exactly.
 * Mismatch → fall back to a single neutral segment (correct text, no red) — never a lie.
 */
export function verifyAgainst(segments: PromptSegment[], real: string): PromptSegment[] {
  return joinSegments(segments) === real ? segments : [{ text: real, kind: 'template' }];
}
