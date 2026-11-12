/**
 * TRIPCARDS-03 (Alex's brief, 2026-11-12 21:08 Manila; the board approved on the design canvas at 21:21) — A PHOTO'S PIXEL SIZE,
 * READ FROM ITS OWN HEADER, AND THE 3 : 2 LAW THE STOP CARDS STAND ON.
 *
 * WHY. His brief: "it like cuts out parts of my photos and for example the sunset pic in bali, its cutting out surfers in the
 * sunset which were a big part of the image". The stop card shows every photo WHOLE now, in a 3 : 2 frame (aspect-ratio: 3 / 2,
 * object-fit: cover — src/app/globals.css, the TRIPCARDS-03 block). Cover cuts nothing from a photo that is itself 3 : 2 and cuts
 * the edges off one that is not, so the build refuses, BY NAME, a photo more than 1% from 3 : 2 (the handoff's README, "The
 * photos: the rule that keeps them whole"): the card never crops a photo — Alex crops a new one, on purpose, before it goes in.
 *
 * HOW. The size is the file's own word for it, read from its header — the two kinds the leaf allows (src/lib/wasHere.ts
 * WAS_HERE_IMAGE_SRC: .jpg and .webp):
 *   · JPEG — the frame header: the first SOF marker (C0–CF, but DHT C4, JPG C8 and DAC CC, which are not frames), its height
 *     then its width. A browser shows a JPEG turned by its EXIF orientation, so an orientation of 5 to 8 (the four that turn it
 *     a quarter) swaps the two: the size is the one the card frames. With no EXIF block the photo shows as it is stored — every
 *     photo here is stripped of its metadata (the leaf's notes);
 *   · WebP — the RIFF container's first chunk: VP8 (lossy: the key frame's 14-bit width and height), VP8L (lossless: 14-bit
 *     width − 1 and height − 1) or VP8X (extended: the 24-bit canvas width − 1 and height − 1). Its EXIF chunk, if it has one,
 *     is not read: the size is the canvas the file declares.
 * Anything else — a file that is not what its extension says, a header cut off, a frame of no size, an EXIF block whose own
 * header is not one — is refused by name. Nothing is guessed and nothing is skipped. No dependency: the repo had none that reads
 * image sizes (package.json; sharp is only next's optional one, and is not used).
 *
 * WHY THE BYTES ARE READ HERE, AND NOT IN THE LAW. No test and no law may read a SOURCE file raw (the reader law,
 * scripts/assert-tool-registry.ts — source is read through src/lib/sourceText.ts's code() and comments(), so a law can never pass
 * on a comment). A photo is not source: its header is bytes, which code() would decode as text. photoBytes() below is the one
 * place a photo's bytes are read, and this module is neither a test nor a law — out of the reader law's scope by the same
 * construction as sourceText.ts. The law (the trip log law's photo line) asks it for the bytes of each photo it has already
 * found on disk, and hands them to photoShapeViolations().
 *
 * Everything but photoBytes() is pure: bytes in, a size or a refusal out. No clock, no fetch, no React.
 */
import { readFileSync } from 'node:fs';

export interface PixelSize {
  readonly width: number;
  readonly height: number;
}

/** What a header says: the size, or why it says none. */
export type HeaderRead = ({ readonly ok: true; readonly turned: boolean } & PixelSize) | { readonly ok: false; readonly why: string };

/** How far a photo may stand from 3 : 2 — 1%, as a fraction of 3 : 2 itself. */
export const THREE_TWO_TOLERANCE = 0.01;

const refuse = (why: string): HeaderRead => ({ ok: false, why });
const ascii = (bytes: Uint8Array, at: number, text: string): boolean => [...text].every((ch, k) => bytes[at + k] === ch.charCodeAt(0));

/** A frame header: SOF0–SOF15, but DHT (C4), JPG (C8) and DAC (CC), which share the range and are not frames. */
const isFrame = (marker: number): boolean => marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;

/**
 * An APP1 Exif block's orientation (1–8), or null when the block holds none. Its payload runs [from, to): "Exif\0\0", then a TIFF
 * header (II or MM, 42, the first directory's offset), then that directory's entries — tag 0x0112 is the orientation. A block whose
 * TIFF header is not one, or whose directory runs past the block, is refused by name.
 */
function exifOrientation(bytes: Uint8Array, from: number, to: number): { ok: true; orientation: number | null } | { ok: false; why: string } {
  const tiff = from + 6;
  const little = ascii(bytes, tiff, 'II');
  if (!little && !ascii(bytes, tiff, 'MM')) return { ok: false, why: 'its EXIF block has no TIFF byte order (II or MM)' };
  const u16 = (at: number): number => (little ? bytes[at] | (bytes[at + 1] << 8) : (bytes[at] << 8) | bytes[at + 1]);
  const u32 = (at: number): number => (little ? (bytes[at] | (bytes[at + 1] << 8) | (bytes[at + 2] << 16) | (bytes[at + 3] << 24)) : ((bytes[at] << 24) | (bytes[at + 1] << 16) | (bytes[at + 2] << 8) | bytes[at + 3])) >>> 0;
  if (tiff + 8 > to || u16(tiff + 2) !== 42) return { ok: false, why: 'its EXIF block\'s TIFF header is not one (no 42)' };
  const directory = tiff + u32(tiff + 4);
  if (directory + 2 > to) return { ok: false, why: 'its EXIF block\'s first directory starts past the block' };
  const entries = u16(directory);
  if (directory + 2 + entries * 12 > to) return { ok: false, why: 'its EXIF block\'s first directory runs past the block' };
  for (let k = 0; k < entries; k += 1) {
    const entry = directory + 2 + k * 12;
    if (u16(entry) === 0x0112) return { ok: true, orientation: u16(entry + 8) };
  }
  return { ok: true, orientation: null };
}

/** A JPEG's size from its frame header, turned by its EXIF orientation when that turns it a quarter. */
export function jpegSize(bytes: Uint8Array): HeaderRead {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return refuse('it is not a JPEG — it does not open with the SOI marker FF D8');
  let turned = false;
  let at = 2;
  while (at < bytes.length) {
    if (bytes[at] !== 0xff) return refuse(`there is no marker at byte ${at}, where a segment should start`);
    while (at < bytes.length && bytes[at] === 0xff) at += 1;
    if (at >= bytes.length) break;
    const marker = bytes[at];
    at += 1;
    // the markers that stand alone, with no length: SOI, TEM and the eight restarts
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    if (marker === 0xd9) return refuse('it ends (EOI) before any frame header');
    if (marker === 0xda) return refuse('its scan (SOS) starts before any frame header');
    if (at + 2 > bytes.length) return refuse(`it is cut off inside the segment at byte ${at - 2}`);
    const length = (bytes[at] << 8) | bytes[at + 1];
    if (length < 2 || at + length > bytes.length) return refuse(`its segment at byte ${at - 2} says it is ${length} bytes long, past the file's end`);
    if (marker === 0xe1 && length >= 8 && ascii(bytes, at + 2, 'Exif\0\0')) {
      const exif = exifOrientation(bytes, at + 2, at + length);
      if (!exif.ok) return refuse(exif.why);
      turned = exif.orientation !== null && exif.orientation >= 5 && exif.orientation <= 8;
    }
    if (isFrame(marker)) {
      if (length < 8) return refuse(`its frame header at byte ${at - 2} is too short to hold a size`);
      const height = (bytes[at + 3] << 8) | bytes[at + 4];
      const width = (bytes[at + 5] << 8) | bytes[at + 6];
      if (width === 0 || height === 0) return refuse(`its frame header says ${width} × ${height}`);
      return turned ? { ok: true, turned, width: height, height: width } : { ok: true, turned, width, height };
    }
    at += length;
  }
  return refuse('it has no frame header');
}

/** A WebP's size from its first chunk: VP8, VP8L or VP8X. */
export function webpSize(bytes: Uint8Array): HeaderRead {
  if (bytes.length < 30 || !ascii(bytes, 0, 'RIFF') || !ascii(bytes, 8, 'WEBP')) return refuse('it is not a WebP — it does not open with RIFF … WEBP, or is cut off before its first chunk');
  const chunk = 20;
  if (ascii(bytes, 12, 'VP8 ')) {
    if ((bytes[chunk] & 0x01) !== 0 || bytes[chunk + 3] !== 0x9d || bytes[chunk + 4] !== 0x01 || bytes[chunk + 5] !== 0x2a) return refuse('its VP8 chunk does not open with a key frame (9D 01 2A)');
    const width = (bytes[chunk + 6] | (bytes[chunk + 7] << 8)) & 0x3fff;
    const height = (bytes[chunk + 8] | (bytes[chunk + 9] << 8)) & 0x3fff;
    if (width === 0 || height === 0) return refuse(`its VP8 frame says ${width} × ${height}`);
    return { ok: true, turned: false, width, height };
  }
  if (ascii(bytes, 12, 'VP8L')) {
    if (bytes[chunk] !== 0x2f) return refuse('its VP8L chunk does not open with the signature 2F');
    const bits = (bytes[chunk + 1] | (bytes[chunk + 2] << 8) | (bytes[chunk + 3] << 16) | (bytes[chunk + 4] << 24)) >>> 0;
    return { ok: true, turned: false, width: (bits & 0x3fff) + 1, height: ((bits >>> 14) & 0x3fff) + 1 };
  }
  if (ascii(bytes, 12, 'VP8X')) {
    const width = (bytes[chunk + 4] | (bytes[chunk + 5] << 8) | (bytes[chunk + 6] << 16)) + 1;
    const height = (bytes[chunk + 7] | (bytes[chunk + 8] << 8) | (bytes[chunk + 9] << 16)) + 1;
    return { ok: true, turned: false, width, height };
  }
  return refuse(`its first chunk is "${String.fromCharCode(...bytes.slice(12, 16))}", not VP8, VP8L or VP8X`);
}

/** A photo's size by the kind its name says: .jpg or .webp — the two the leaf allows. */
export function headerSize(src: string, bytes: Uint8Array): HeaderRead {
  if (src.endsWith('.jpg')) return jpegSize(bytes);
  if (src.endsWith('.webp')) return webpSize(bytes);
  return refuse('it is neither .jpg nor .webp');
}

/**
 * How far a size stands from 3 : 2, as a fraction of 3 : 2: |(width ÷ height) ÷ (3 ÷ 2) − 1|, computed as |2·width − 3·height| ÷
 * (3·height) — one division of whole numbers, so a photo exactly 1% from 3 : 2 measures exactly 1% (the chained divisions put
 * 1515 × 1000 a hair over it).
 */
export function offThreeTwo(size: PixelSize): number {
  return Math.abs(2 * size.width - 3 * size.height) / (3 * size.height);
}

/** A photo's bytes, from its file — the one place a photo is read (see WHY THE BYTES ARE READ HERE, above). */
export function photoBytes(file: string): Uint8Array {
  return readFileSync(file);
}

/**
 * THE LAW, for one photo of the trip log: its size from its own header, refused by name when the header says none, or when it
 * stands more than 1% from 3 : 2. `id` and `src` are the row's; `bytes` are the file's.
 */
export function photoShapeViolations(id: string, src: string, bytes: Uint8Array): string[] {
  const size = headerSize(src, bytes);
  if (!size.ok) return [`was here: ${id}'s photo ${src} has no size the build can read — ${size.why} (TRIPCARDS-03: the card shows a photo whole at 3 : 2, so the build reads each one's shape from its own header)`];
  const off = offThreeTwo(size);
  if (off <= THREE_TWO_TOLERANCE) return [];
  const shown = size.turned ? `${size.width} × ${size.height} as shown (its EXIF orientation turns it)` : `${size.width} × ${size.height}`;
  return [`was here: ${id}'s photo ${src} is ${shown} — ${(off * 100).toFixed(2)}% from 3 : 2, more than ${Number((THREE_TWO_TOLERANCE * 100).toFixed(4))}%: the card shows a photo whole at 3 : 2, so crop it to 3 : 2 before it goes in (TRIPCARDS-03)`];
}
