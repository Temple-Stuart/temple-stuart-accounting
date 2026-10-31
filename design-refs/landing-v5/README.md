# Temple Stuart — The Problem + Merged Modules Section (Round 5 · FINAL) · Handoff

Approved by Alex. Supersedes the round-2 merged-modules bundle (`design-refs/merged-modules-spec.md`) and every round-3/4 amendment.
Adds `01 / THE PROBLEM` between the hero and the modules section; the stage becomes the Treatment-A walkthrough with per-step glimpses + truth strips.

Files in this bundle:
- `Modules-v5-Desktop-1440.dc.html` — interactive: the problem section, spine, personas (payoffs), and the walkthrough stage (nine chips with the shipped autoplay; clickable teach rail; Routines glimpses ×4 drawn; others placeholder to the same pattern)
- `Modules-v5-Mobile-390.dc.html` — static: problem, walkthrough with BOTH glimpse-crop options (M1 contain vs M2 key-region — M2 recommended), personas
- `Modules-v5-Build-Spec.dc.html` — rendered spec: kicker renumber table, grid geometry, truth-strip + [IN BUILD] anatomy, glimpse rules, and THE TRUTH LEDGER (49 steps, verbatim) doubling as the glimpse manifest
- `support.js` — the runtime; keep beside the .dc.html files (open them directly in a browser)

Note: the round-2 frame SVGs (`public/demo/*.svg`) retire FROM THE STAGE — per-step glimpses supersede the single frame per module. The files themselves stay in the repo (other surfaces still reference them).

## Kicker renumber
01 / THE PROBLEM (new) · 02 / THE NINE MODULES (was 01) · 03 / LIVE DEMO — TRAVEL (was 02) · 04 / DONE-FOR-YOU (was 03)

## Tokens (unchanged — nothing invented)
`#FAF8F3` canvas · `#F3EFE6` row fill · `#FFFFFF` cards · `#FFFDF9` ts-white · `#DDD6E8` hairline · `#EBE4F7` inner hairline · `#3B2D6B` purple · `#B8860B` gold · `#1A1A2E` / `#4A4A5A` / `#7A7488` / `#A8A2B0` text scale. Green `#16a34a` / red `#c53030` live ONLY inside glimpse illustrations. Fonts: Inter 400/500/600 · IBM Plex Mono 400/500/600.

## §A — THE PROBLEM (copy verbatim, no brand names)
- h2: "Running your life takes nine jobs — and the tools don't talk to each other."
- THE NINE (mono row, purple, gold dots): BUDGET APP · BOOKING SITE · BROKER · TRADE LOG · BOOKKEEPING · COMPLIANCE · TAX APP · FP&A · AI WORK JOURNAL
- the beat: "You can buy all nine — that's the problem. Nine logins, nine subscriptions, nine copies of your life that never meet. The heavy ones — compliance, FP&A — are priced for companies, not people. And to get the one answer that matters, you become the integration: copying numbers from app to app into a spreadsheet."
- close: "None of them can answer the only question that matters:" → "How long does my money last?" (mono 22/600 gold — the section's ONE gold moment) → micro-line, mono muted: NOT FROM NUMBERS YOU TYPED — FROM YOUR REAL LIFE.
- Mobile: the nine wrap as contained mono lines, 12px floor, never horizontal scroll.

## Stage geometry (uniform height law — @1440)
Card outer = 720px in EVERY module and EVERY step: border 1 + bar 36 + rule 1 + BODY 550 + rule 1 + ROW C 130 + border 1.
- BODY left cell: DRAWING AREA 455 (pad 24 · header 20 · gap 12 · strip cells 60 · gap 16 · glimpse surface 299) + rule 1 + TRUTH STRIP 94.
- TRUTH STRIP: fixed 94 = 12 + label 15 + 4 + 3×17 + 12 (sized to the worst 3-line clause); grid 1fr · 1.3fr · 1fr; labels YOU / THE APP muted, → FEEDS 0N gold (terminal steps: → FEEDS, no number).
- RAIL: unchanged 65px rows (rule 1 + 11 + name 15/22 + 3 + teach 12/17 + 11); active = purple fill + gold underline as inset 0 -3px shadow (zero geometry change); spacer law — Tax sits at the 14px minimum.
- Strip cells: fixed 60, num + NAME (ellipsis-guarded); the active cell alone carries ▪ YOU ARE HERE.
- ROW C: fixed 130 (2-line rationale states set it).
Mobile 390: static; if touch switching ever ships, lock the rail block to Tax = 564px.

## Interaction law
Chips keep the shipped autoplay exactly (2s hold, hover pause, reduced-motion/touch never start, any click stops it for good). Rail steps are CLICK-ONLY, user-paced; module switch resets to step 01.

## [IN BUILD] (Compliance 04 Discover + 05 Verify only)
Mono 9 chip after the rail-row name + a chip on the glimpse; muted (bg #F3EFE6, border #DDD6E8, ink #7A7488; on-purple: white/.12 bg, white/.3 border, white/.75 ink). Never sold as live — the APP clauses say "being built now".

## Strings law
Every already-shipped string unchanged. Additions: §A copy above · six persona payoff sentences · THE TRUTH LEDGER (TEACH / YOU / APP / FEEDS / GLIMPSE for all 49 steps) — rendered verbatim in `Modules-v5-Build-Spec.dc.html` §6, the build's single source for rail, truth-strip, and glimpse content.

---
Source: `Temple-Stuart/temple-stuart-accounting` @ main · pipePhases.ts (step names/order) · public/demo/*.svg (the glimpses' visual language) · Landing.tsx (tokens, chips, autoplay, row C).
