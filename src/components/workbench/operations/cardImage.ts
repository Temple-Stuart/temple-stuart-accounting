/**
 * cardImage — the day card's plate as a PNG (CLEAN-02, 2026-10-14).
 *
 * "download image" under every card view (day/DayCard.tsx) renders the plate
 * element alone — the bordered card — at pixel ratio 3, with no background
 * colour of its own, so everything outside the plate's rounded corners is
 * transparent for the overlay. The renderer is html-to-image (MIT, pinned
 * exactly in package.json), imported INSIDE downloadCardImage — the click's own
 * work — so the library loads only when the button is pressed. The file is
 * named by cardImageName: the day, then "all" or the step's number and its
 * label slugged. A failure is the caller's to say, in cardImageFailedWords;
 * nothing else is tried. This helper lives outside the day folder, which stays
 * its three files (daycard01.test.ts T5).
 */

export const DOWNLOAD_IMAGE_WORDS = 'download image';
/** The PNG is three device pixels to the CSS pixel — the plate's 640 is 1920 wide. */
export const CARD_IMAGE_PIXEL_RATIO = 3;

/** "could not make the image — <reason>" — under the button, and nothing else. */
export const cardImageFailedWords = (reason: string): string => `could not make the image — ${reason}`;

/** "Brunch at Luka" → "brunch-at-luka": lowercase, every run of non-alphanumerics one hyphen, none at either end. */
export const slugWords = (label: string): string => label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

/**
 * "temple-stuart-2026-10-14-all.png" for the full card;
 * "temple-stuart-2026-10-14-step-2-brunch.png" for step 2, Brunch. A label with
 * no letter or digit to slug is refused by name — never a name made up for it.
 */
export function cardImageName(day: string, focus: { readonly index: number; readonly label: string } | null): string {
  if (focus === null) return `temple-stuart-${day}-all.png`;
  const slug = slugWords(focus.label);
  if (slug === '') throw new Error(`the step's name "${focus.label}" has no letter or digit to name the file`);
  return `temple-stuart-${day}-step-${focus.index}-${slug}.png`;
}

/**
 * The plate, rendered to a PNG and handed to the browser as a download named `name`. Throws what the renderer throws.
 * The renderer copies the plate's computed style onto its copy — the page's centring margins included (mx-auto, the
 * section's spacing), which would shift the card off the image's own box — so the copy's margin is zero: the image is
 * the plate's box exactly. The page's plate is not touched.
 */
export async function downloadCardImage(plate: HTMLElement, name: string): Promise<void> {
  const { toPng } = await import('html-to-image');
  const url = await toPng(plate, { pixelRatio: CARD_IMAGE_PIXEL_RATIO, style: { margin: '0' } });
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
}
