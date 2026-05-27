import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
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
          'purple-light': 'rgb(123 107 170 / <alpha-value>)',           // #7b6baa LEGACY, unused (0 refs); kept alpha-compatible for family consistency; retire in component-migration PR
          'purple-wash': 'rgb(var(--ts-purple-wash) / <alpha-value>)',  // #eae7f2
          gold: 'var(--ts-gold)',                  // #7D6B2C
          'gold-bright': 'var(--ts-gold-bright)',  // #8B7D3C
          'gold-wash': 'var(--ts-gold-wash)',      // rgba(125,107,44,0.07)
          green: 'var(--ts-green)',                // #16a34a
          red: 'var(--ts-red)',                    // #c53030
          amber: 'var(--ts-amber)',                // #d97706
          accent: 'var(--ts-accent)',              // #b4b237
          'accent-dark': 'var(--ts-accent-dark)',  // #9a9630
        },
        panel: {
          DEFAULT: 'var(--ts-panel)',              // #0d1117
          surface: 'var(--ts-panel-surface)',      // #161b22
          border: 'var(--ts-panel-border)',        // #30363d
          hover: 'var(--ts-panel-hover)',          // #21262d
          highlight: 'var(--ts-panel-highlight)',  // #1a0f2e
        },
        bg: {
          terminal: 'var(--ts-bg)',                // #f7f6f3
          row: 'var(--ts-bg-row)',                 // #f0eee9
        },
        text: {
          primary: 'var(--ts-text)',               // #1a1a2e
          secondary: 'var(--ts-text-secondary)',   // #4a4a5a
          muted: 'var(--ts-text-muted)',           // #7a7488
          faint: 'var(--ts-text-faint)',           // #a8a2b0
        },
        border: {
          DEFAULT: 'var(--ts-border)',             // #e2e0da
          light: 'var(--ts-border-light)',         // #f0eee9
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
          white: 'var(--ts-white)',                // #fafaf9 (NEW warm surface)
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
