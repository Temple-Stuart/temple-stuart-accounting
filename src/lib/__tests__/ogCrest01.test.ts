/**
 * OG-CREST-01 (Alex, 2026-11-12) — THE LINK PREVIEW: "Connect, Create, Control", AND THE HERO'S CREST.
 *
 * Alex sent a screenshot of the card iMessage drew for a templestuart.com link — "Founder's Back Office" under a flat
 * aubergine card of the company line — with a crop of the live hero, and wrote: "can instead of founders back office... i
 * want it to say : Connect, Create, Control and for the image it shows... instead of the connect yur world. Create your
 * freedom. Control your future... I wanna see like this image from the hero?"
 *
 *   T1 the titles — layout.tsx's three end "Connect, Create, Control" and "Back Office" is in neither file; the image's
 *      alt says what the picture shows, in the same words in both files (the route's own is og:image:alt, as served);
 *   T2 the crest — opengraph-image.tsx reads the hero's own file (public/brand/hero-crest-desktop.svg) from disk on the
 *      default runtime and draws it whole, as one <img> in one <div>: no words, no other element;
 *   T3 the ground — the <div>'s background is .ts-hero's (src/app/globals.css), layer for layer: each colour its
 *      --ts-hero-* token's value, every alpha written rgba(r, g, b, a) (next/og draws rgb(r g b / a) as the wrong colour);
 *   T4 the picture — the route's own function draws a 1200 × 630 PNG: violet in every pixel of its outer columns, and gold
 *      (the lion and the shield) in the middle and nowhere else.
 *
 * Source is read through code() only (the reader law). T4 draws the image here: no live call, no database, no clock.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as React from 'react';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { inflateSync } from 'node:zlib';
import { code } from '../sourceText';
import drawPreview, { alt, contentType, size } from '@/app/opengraph-image';

Object.assign(globalThis, { React });

const ROOT = resolve(__dirname, '../../..');
const LAYOUT = 'src/app/layout.tsx';
const PREVIEW = 'src/app/opengraph-image.tsx';
const GLOBALS = 'src/app/globals.css';
const CREST = 'public/brand/hero-crest-desktop.svg';
const ALT = 'The Temple Stuart crest: a gold lion on a shield, on a violet ground';

const count = (text: string, part: string): number => text.split(part).length - 1;

/** globals.css — one token's value, declared exactly once. */
function token(name: string): string {
  const found = [...code(GLOBALS).matchAll(new RegExp(`--ts-${name}:\\s*([^;]+);`, 'g'))];
  assert.equal(found.length, 1, `--ts-${name} is declared once in globals.css`);
  return found[0][1].trim();
}

/** A background-image's layers: the value split at its top-level commas. */
function layers(value: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < value.length; i += 1) {
    if (value[i] === '(') depth += 1;
    else if (value[i] === ')') depth -= 1;
    else if (value[i] === ',' && depth === 0) { out.push(value.slice(start, i).trim()); start = i + 1; }
  }
  out.push(value.slice(start).trim());
  return out;
}

/** .ts-hero's layers — the band from 1024px: the one top-level .ts-hero rule (the phone's sits inside its @media). */
function heroLayers(): string[] {
  const css = code(GLOBALS);
  const at = css.indexOf('\n.ts-hero {');
  assert.ok(at > -1 && css.indexOf('\n.ts-hero {', at + 1) === -1, 'one top-level .ts-hero rule in globals.css');
  const rule = css.slice(at, css.indexOf('}', at));
  const found = /background-image:([^;]+);/.exec(rule);
  assert.ok(found, '.ts-hero draws a background-image');
  return layers(found[1].replace(/\s+/g, ' ').trim());
}

/** A hero layer as next/og must take it: each token's value for its var(), each alpha as rgba(r, g, b, a). */
function asPreview(layer: string): string {
  return layer
    .replace(/rgb\(var\(--ts-(hero-[a-z]+)\) \/ ([\d.]+)\)/g, (_, name: string, a: string) => `rgba(${token(name).split(/\s+/).join(', ')}, ${a})`)
    .replace(/var\(--ts-(hero-violet-\d)\)/g, (_, name: string) => token(name));
}

/** A PNG's pixels. 8-bit RGBA, not interlaced, is what next/og writes; anything else fails here, by name. */
function pixels(png: Buffer): { width: number; height: number; rgba: (x: number, y: number) => number[] } {
  assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a', 'a PNG');
  let width = 0;
  let height = 0;
  const data: Buffer[] = [];
  for (let at = 8; at < png.length;) {
    const length = png.readUInt32BE(at);
    const kind = png.toString('latin1', at + 4, at + 8);
    const body = png.subarray(at + 8, at + 8 + length);
    if (kind === 'IHDR') {
      width = body.readUInt32BE(0);
      height = body.readUInt32BE(4);
      assert.deepEqual([body[8], body[9], body[12]], [8, 6, 0], '8-bit RGBA, not interlaced');
    }
    if (kind === 'IDAT') data.push(body);
    at += 12 + length;
  }
  const raw = inflateSync(Buffer.concat(data));
  const stride = width * 4;
  const out = Buffer.alloc(height * stride);
  for (let y = 0; y < height; y += 1) {
    const filter = raw[y * (stride + 1)];
    assert.ok(filter <= 4, `row ${y}: PNG filter ${filter}`);
    for (let i = 0; i < stride; i += 1) {
      const a = i >= 4 ? out[y * stride + i - 4] : 0;
      const b = y > 0 ? out[(y - 1) * stride + i] : 0;
      const c = i >= 4 && y > 0 ? out[(y - 1) * stride + i - 4] : 0;
      let v = raw[y * (stride + 1) + 1 + i];
      if (filter === 1) v += a;
      else if (filter === 2) v += b;
      else if (filter === 3) v += (a + b) >> 1;
      else if (filter === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a);
        const pb = Math.abs(p - b);
        const pc = Math.abs(p - c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      out[y * stride + i] = v & 0xff;
    }
  }
  return { width, height, rgba: (x, y) => [...out.subarray((y * width + x) * 4, (y * width + x) * 4 + 4)] };
}

// ── T1 · THE TITLES ──────────────────────────────────────────────────────────

test('T1 the three titles end "Connect, Create, Control", "Back Office" is in neither file, and the image\'s alt says what it shows — the same words in both', () => {
  const layout = code(LAYOUT);
  const preview = code(PREVIEW);
  assert.equal(count(layout, 'title: "Temple Stuart | Connect, Create, Control",'), 1, 'the page\'s title');
  assert.equal(count(layout, 'title: "Temple Stuart — Connect, Create, Control",'), 2, 'Open Graph\'s and Twitter\'s');
  assert.equal(count(layout, 'title:'), 3, 'no fourth title');
  for (const [file, text] of [[LAYOUT, layout], [PREVIEW, preview]]) assert.doesNotMatch(text, /Back Office/i, `${file}: "Founder's Back Office" left the link preview`);
  assert.equal(count(preview, `export const alt = '${ALT}';`), 1, 'the image\'s own alt — og:image:alt, as served');
  assert.equal(count(layout, `alt: "${ALT}",`), 1, 'layout.tsx\'s image entry says the same');
});

// ── T2 · THE CREST ───────────────────────────────────────────────────────────

test('T2 the crest: the hero\'s own file, read from disk on the default runtime and drawn whole as one <img> in one <div> — no words, no other element', () => {
  const preview = code(PREVIEW);
  assert.ok(existsSync(resolve(ROOT, CREST)), `${CREST} is in the tree`);
  assert.match(preview, /^import \{ readFile \} from 'node:fs\/promises';$/m);
  assert.match(preview, /^import \{ join \} from 'node:path';$/m);
  assert.match(preview, /readFile\(join\(process\.cwd\(\), 'public\/brand\/hero-crest-desktop\.svg'\)\)/, 'the hero\'s file from 1024px, from the project\'s root');
  assert.match(preview, /src=\{`data:image\/svg\+xml;base64,\$\{crest\.toString\('base64'\)\}`\}/, 'drawn whole, as an SVG');
  assert.doesNotMatch(preview, /\bexport const (runtime|dynamic|revalidate)\b/, 'the default runtime, Node.js, and nothing dynamic: drawn once, at build');
  const jsx = preview.slice(preview.indexOf('new ImageResponse('));
  assert.deepEqual([...jsx.matchAll(/<\/?[A-Za-z]+/g)].map((m) => m[0]), ['<div', '<img', '</div'], 'one <div> holding one <img>');
  assert.match(jsx, /<div\b[^>]*>\s*<img\b[^>]*\/>\s*<\/div>/, 'and nothing else in it: no words');
});

// ── T3 · THE GROUND ──────────────────────────────────────────────────────────

test('T3 the ground is .ts-hero\'s, layer for layer — the sweep as written, the bloom\'s stops, the orchid corner at the frame\'s own size — each colour its token\'s value, every alpha rgba(r, g, b, a)', () => {
  const preview = code(PREVIEW);
  const [orchid, bloom, sweep, ...more] = heroLayers();
  assert.equal(more.length, 0, '.ts-hero draws three layers');
  assert.ok(orchid.startsWith('radial-gradient(min(46vw, 680px) 56% at 100% 104%, '), `the hero's orchid corner: ${orchid}`);
  assert.equal(count(preview, asPreview(orchid).replace('min(46vw, 680px)', '46%')), 1, 'the orchid corner at the frame\'s own size: min(46vw, 680px) is 46% of 1200px');
  assert.ok(bloom.startsWith('radial-gradient(min(48vw, 700px) 62% at var(--ts-crest-x) 59%, '), `the hero's bloom: ${bloom}`);
  assert.equal(count(preview, asPreview(bloom.slice(bloom.indexOf('rgb(var('), -1))), 1, 'the bloom\'s stops — its radii and its centre scale with the crest');
  assert.equal(count(preview, asPreview(sweep)), 1, 'the sweep, as written');
  assert.equal(count(preview, `backgroundColor: '${token('hero-violet-3')}'`), 1, 'the band\'s flat colour under the gradients');
  const hexes = [...new Set(preview.match(/#[0-9A-Fa-f]{3,8}\b/g) ?? [])].sort();
  assert.deepEqual(hexes, ['hero-violet-1', 'hero-violet-2', 'hero-violet-3', 'hero-violet-4'].map(token).sort(), 'the four violets, and no other hex');
  const channels = [...new Set([...preview.matchAll(/rgba\((\d+), (\d+), (\d+), [\d.]+\)/g)].map((m) => `${m[1]} ${m[2]} ${m[3]}`))].sort();
  assert.deepEqual(channels, [token('hero-bloom'), token('hero-orchid')].sort(), 'the bloom and the orchid, and no other rgba');
  assert.doesNotMatch(preview, /rgba?\(\s*[\d.]+\s+[\d.]+\s+[\d.]+\s*\//, 'no rgb(r g b / a): next/og takes it without an error and draws the wrong colour');
  assert.ok(!preview.includes('var('), 'no custom property: ImageResponse reads no stylesheet');
});

// ── T4 · THE PICTURE ─────────────────────────────────────────────────────────

test('T4 the picture: the route draws a 1200 × 630 PNG — violet in every pixel of its outer columns, and gold, the lion and the shield, in the middle and nowhere else', async () => {
  assert.deepEqual(size, { width: 1200, height: 630 });
  assert.equal(contentType, 'image/png');
  assert.equal(alt, ALT);
  const { width, height, rgba } = pixels(Buffer.from(await (await drawPreview()).arrayBuffer()));
  assert.deepEqual([width, height], [1200, 630], 'the size it says');
  let gold = 0;
  let goldOutside = 0;
  let notViolet = 0;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const [r, g, b] = rgba(x, y);
      const outer = x < 300 || x >= 900; // the crest is drawn 360px to 837px across
      if (r - b > 60) { gold += 1; if (outer) goldOutside += 1; }
      if (outer && !(b > r && b > g)) notViolet += 1;
    }
  }
  assert.equal(notViolet, 0, 'the outer columns are the ground: blue the strongest channel in every pixel');
  assert.equal(goldOutside, 0, 'no gold outside the middle');
  assert.ok(gold / (width * height) > 0.01, `the lion and the shield are drawn: ${((100 * gold) / (width * height)).toFixed(2)}% of the frame is gold`);
});
