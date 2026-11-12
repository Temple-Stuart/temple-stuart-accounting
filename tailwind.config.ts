import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    // REPAINT-1 landmine fix: ds.ts (and every lib module) carries class
    // strings — DARKEN_MAP outputs border-white/50 and bg-white/40 appeared
    // NOWHERE in the scanned dirs, so themed() emitted classes that never
    // compiled (silent no-ops). Scanning src/lib makes lib-authored classes
    // real, permanently.
    "./src/lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        // Existing tokens now read from the CSS-variable layer (globals.css
        // :root). Each var() resolves to the SAME value as the prior literal
        // — pure value-preserving swap, no visual change.
        brand: {
          // Alpha-compatible: rgb(<channels> / <alpha-value>) so BOTH solid
          // (bg-brand-purple) AND opacity (bg-brand-purple/90) emit valid CSS.
          purple: 'rgb(var(--ts-purple) / <alpha-value>)',              // #3b2d6b
          'purple-deep': 'rgb(var(--ts-purple-deep) / <alpha-value>)',  // #2d1b4e
          'purple-hover': 'rgb(var(--ts-purple-light) / <alpha-value>)',// #4e3e85 (locked --ts-purple-light == old hover value)
          // REPAINT-1: 'purple-light' (#7b6baa) retired — LEGACY, 0 refs, its own comment called for this.
          'purple-wash': 'rgb(var(--ts-purple-wash) / <alpha-value>)',  // #eae7f2
          gold: 'rgb(var(--ts-gold) / <alpha-value>)',                  // #B8860B (REPAINT-1; was #7D6B2C)
          'gold-bright': 'rgb(var(--ts-gold-bright) / <alpha-value>)',  // #C6981B (REPAINT-1; was #8B7D3C)
          'gold-wash': 'var(--ts-gold-wash)',      // rgba(184,134,11,0.07) — baked alpha, solid-only (NOT alpha-modified)
          green: 'rgb(var(--ts-green) / <alpha-value>)',                // #16a34a
          red: 'rgb(var(--ts-red) / <alpha-value>)',                    // #c53030
          amber: 'rgb(var(--ts-amber) / <alpha-value>)',                // #d97706
          accent: 'rgb(var(--ts-accent) / <alpha-value>)',              // #B8860B = gold (REPAINT-1 RULING 3 fold; was #b4b237)
          'accent-dark': 'rgb(var(--ts-accent-dark) / <alpha-value>)',  // #9E7309 (REPAINT-1; was #9a9630)
        },
        // BG-DEPTH: the page canvas — its own token so page and cards move
        // independently (same plain-var pattern as `panel`).
        // REPAINT-04 (2026-09-21): the retired dark surface's family. It stays
        // defined for the three self-declared dark/purple surfaces in
        // src/lib/ds.ts PANEL_TOKEN_ALLOWLIST; the repaint law refuses it anywhere else.
        panel: {
          DEFAULT: 'var(--ts-panel)',              // #11131b (BG-DEPTH lift; was #0d1117)
          surface: 'var(--ts-panel-surface)',      // #161b22
          border: 'var(--ts-panel-border)',        // #30363d
          hover: 'var(--ts-panel-hover)',          // #21262d
          highlight: 'var(--ts-panel-highlight)',  // #1a0f2e
        },
        bg: {
          terminal: 'rgb(var(--ts-bg) / <alpha-value>)',     // #FAF8F3 (REPAINT-1; was #f7f6f3)
          row: 'rgb(var(--ts-bg-row) / <alpha-value>)',      // #F3EFE6 (REPAINT-1; was #f0eee9)
        },
        text: {
          primary: 'var(--ts-text)',               // #1a1a2e
          secondary: 'var(--ts-text-secondary)',   // #4a4a5a
          muted: 'var(--ts-text-muted)',           // #7a7488
          faint: 'var(--ts-text-faint)',           // #a8a2b0
        },
        border: {
          DEFAULT: 'rgb(var(--ts-border) / <alpha-value>)',       // #DDD6E8 lavender hairline (SLICE-1; was #e2e0da)
          light: 'rgb(var(--ts-border-light) / <alpha-value>)',   // #EBE4F7 (SLICE-1; was #f0eee9)
        },
        // PALETTE-OVERHAUL: the idea-state status trio (ADDITIVE — the legacy
        // brand.green/red/amber utilities are untouched; tokens in globals.css).
        status: {
          success: 'rgb(var(--ts-success) / <alpha-value>)',      // #22c55e
          warning: 'rgb(var(--ts-warning) / <alpha-value>)',      // #f59e0b
          info: 'rgb(var(--ts-info) / <alpha-value>)',            // #3b82f6
          danger: 'rgb(var(--ts-danger) / <alpha-value>)',        // #ef4444 (TRADE-CHIPS)
        },
        // NEW design-token family (PR-Ops-DS-2). Enables bg-ts-aqua, text-ts-cyan,
        // bg-ts-white, etc. NOT referenced by any component yet — adoption is the
        // next PR. aqua + warm white are brand-new; cyan/indigo tokenize the
        // existing Trip/Operations source hues.
        ts: {
          aqua: 'var(--ts-aqua)',                  // #14e0c8 (NEW)
          'aqua-deep': 'var(--ts-aqua-deep)',      // #0fb8a8 (NEW)
          cyan: 'var(--ts-cyan)',                  // #22d3ee
          indigo: 'var(--ts-indigo)',              // #818cf8
          white: 'var(--ts-white)',                // #FFFDF9 card cream (REPAINT-1; was #fafaf9)
        },
        // HERO-CREST-01 (Alex, design canvas, 2026-11-11): the guest hero's and the top bar's own colours — the
        // approved design brings them, so they are tokens: named and valued as design-refs/hero-crest-01/README.md's
        // table, typed once in globals.css :root (--ts-hero-*, --ts-glass-*). The same two shapes as above: a hex the
        // design only draws solid is a plain var(); channels the design draws at an alpha take <alpha-value>. ADDITIVE,
        // as the status trio was. The hero's and the bar's stylesheet (the foot of globals.css — the reference's own
        // rules) reads the variables directly; these names make the same colours utilities for the next surface.
        hero: {
          'violet-1': 'var(--ts-hero-violet-1)',                              // #6A33E0 — the ground's sweep, start
          'violet-2': 'var(--ts-hero-violet-2)',                              // #4D1FBC
          'violet-3': 'var(--ts-hero-violet-3)',                              // #32118A
          'violet-4': 'var(--ts-hero-violet-4)',                              // #210A5E — the sweep, end
          bloom: 'rgb(var(--ts-hero-bloom) / <alpha-value>)',                 // 162 107 255 — the light behind the crest
          orchid: 'rgb(var(--ts-hero-orchid) / <alpha-value>)',               // 217 70 239 — the warm corner
          ink: 'var(--ts-hero-ink)',                                          // #FAF8F4 — headline, wordmark, menu rows
          'ink-soft': 'var(--ts-hero-ink-soft)',                              // #E4E0F2 — subline
          'ink-nav': 'var(--ts-hero-ink-nav)',                                // #E8E4F5 — the bar's links
          gold: 'var(--ts-hero-gold)',                                        // #F6C95C — the third sentence, link hover, focus ring
          'gold-1': 'rgb(var(--ts-hero-gold-1) / <alpha-value>)',             // 255 236 178 — the gold pills, start
          'gold-2': 'rgb(var(--ts-hero-gold-2) / <alpha-value>)',             // 248 203 90
          'gold-3': 'rgb(var(--ts-hero-gold-3) / <alpha-value>)',             // 236 178 62 — the gold pills, end
          'on-gold': 'var(--ts-hero-on-gold)',                                // #2A0F5C — ink on the gold pills
          well: 'var(--ts-hero-well)',                                        // #210B5C — the secondary button's fill
          'rim-gold': 'var(--ts-hero-rim-gold)',                              // #F8CB5A — its rim, start
          'rim-lilac': 'var(--ts-hero-rim-lilac)',                            // #B9A2FF — its rim, end
        },
        glass: {
          fill: 'var(--ts-glass-fill)',                                       // rgb(255 255 255 / 0.10) — baked alpha, solid-only
          line: 'var(--ts-glass-line)',                                       // rgb(255 255 255 / 0.22) — baked alpha, solid-only
        },
        // HOME-PLANS-04 (Alex's brief, 2026-11-12 14:07 Manila; the board approved on the design canvas at 14:30): the
        // Financial Software section's own colours — the seventeen the approved section brings, named and valued as
        // design-refs/home-plans-04/README.md's table "New with this section", typed once in globals.css :root (--ts-fs-*).
        // The same two shapes as above. The section's stylesheet (globals.css, above the hero's) reads the variables
        // directly; these names make the same colours utilities for the next surface. ADDITIVE, as `hero` and `glass` were.
        fs: {
          white: 'rgb(var(--ts-fs-white) / <alpha-value>)',                 // 255 255 255 — cards, tools and switches; text on violet and teal
          teal: 'var(--ts-fs-teal)',                                        // #0B7F73 — Trading: its fill and its ring; on white its word, line and ticks
          'teal-deep': 'var(--ts-fs-teal-deep)',                            // #0B5F57 — Trading's switch label while off
          'teal-light': 'var(--ts-fs-teal-light)',                          // #8FE8DA — Trading's word on the band
          'gold-text': 'var(--ts-fs-gold-text)',                            // #8A6408 — gold as small text: Business's word on white (the eyebrow's too, until Alex's note on the built page, 2026-11-12)
          'gold-deep': 'var(--ts-fs-gold-deep)',                            // #6B4E00 — Business's switch label while off
          ink: 'var(--ts-fs-ink)',                                          // #2B2545 — body text
          'ink-soft': 'var(--ts-fs-ink-soft)',                              // #4A4560 — the lede, explainers, family names, the price line
          'ink-muted': 'var(--ts-fs-ink-muted)',                            // #6F6988 — tools not in the plan, roles, counts
          line: 'var(--ts-fs-line)',                                        // #E9E4F2 — the panel's and the cards' border
          rule: 'var(--ts-fs-rule)',                                        // #EEEAF5 — the rules inside them
          'chip-line': 'var(--ts-fs-chip-line)',                            // #E4DFF0 — the border of a tool that is not in the plan
          'button-line': 'var(--ts-fs-button-line)',                        // #CFC6EC — the quiet button's border
          'band-muted': 'var(--ts-fs-band-muted)',                          // #D6CCF7 — the band's role and count
          'band-ring': 'rgb(var(--ts-fs-band-ring) / <alpha-value>)',       // 230 220 255 — the band's rings
          shadow: 'rgb(var(--ts-fs-shadow) / <alpha-value>)',               // 33 10 94 — shadows on the cream
          'band-shadow': 'rgb(var(--ts-fs-band-shadow) / <alpha-value>)',   // 12 6 44 — the shadow under the band's gold button
        },
      },
      fontFamily: {
        mono: ["'IBM Plex Mono'", 'ui-monospace', 'monospace'],
        sans: ["'Inter'", '-apple-system', 'sans-serif'],
      },
      fontSize: {
        'terminal-xs': ['8px', { lineHeight: '12px' }],
        'terminal-sm': ['9px', { lineHeight: '14px' }],
        'terminal-base': ['10.5px', { lineHeight: '16px' }],
        'terminal-lg': ['11px', { lineHeight: '16px' }],
      },
    },
  },
  plugins: [],
};
export default config;
