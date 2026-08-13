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
          'purple-pop': 'rgb(var(--ts-purple-pop) / <alpha-value>)',    // #5b21ff PR-STRIP-DESIGN-3/4b + POP-ELECTRIC/DEEPEN: the one pop accent (see globals.css)
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
        page: 'var(--ts-page)',                    // #0b0d14
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
          DEFAULT: 'rgb(var(--ts-border) / <alpha-value>)',       // #e2e0da
          light: 'rgb(var(--ts-border-light) / <alpha-value>)',   // #f0eee9
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
