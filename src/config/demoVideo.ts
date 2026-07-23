/**
 * DEMO_VIDEO_URL — the hero demo CTA's honesty gate (LOBBY-DECK-1b).
 *
 * Alex sets this when the demo cut exists (YouTube or file URL — either).
 * While it is null, the hero's white CTA stays "See how it works ↓" (the
 * deck scroll) — the landing never advertises a video that doesn't exist.
 * Non-null, the CTA becomes "Watch the demo 🎥" and opens this URL in the
 * landing's token-native modal (YouTube URLs embed via their /embed/ form;
 * any other URL plays through a native <video> tag).
 */
export const DEMO_VIDEO_URL: string | null = null;
