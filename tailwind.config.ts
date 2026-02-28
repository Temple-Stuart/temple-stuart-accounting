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
        brand: {
          purple: '#3b2d6b',
          'purple-deep': '#2d1b4e',
          'purple-hover': '#4e3e85',
          'purple-light': '#7b6baa',
          'purple-wash': '#eae7f2',
          gold: '#b8960f',
          'gold-bright': '#d4af37',
          'gold-wash': 'rgba(184,150,15,0.07)',
          green: '#16a34a',
          red: '#c53030',
          amber: '#d97706',
        },
        bg: {
          terminal: '#f7f6f3',
          row: '#f0eee9',
        },
        text: {
          primary: '#1a1a2e',
          secondary: '#4a4a5a',
          muted: '#7a7488',
          faint: '#a8a2b0',
        },
        border: {
          DEFAULT: '#e2e0da',
          light: '#f0eee9',
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
