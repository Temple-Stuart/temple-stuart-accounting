import { ImageResponse } from 'next/og';
import { COMPANY_LINE } from '@/lib/brandLines';

export const runtime = 'edge';
export const alt = 'Temple Stuart - Founder\'s Back Office';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: '#2d1b4e',
          padding: '50px',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '30px' }}>
          <div
            style={{
              width: '60px',
              height: '60px',
              backgroundColor: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: '20px',
            }}
          >
            <span style={{ color: '#2d1b4e', fontWeight: 'bold', fontSize: '28px' }}>TS</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ color: 'white', fontSize: '24px', fontWeight: '600' }}>Temple Stuart</span>
            <span style={{ color: '#9ca3af', fontSize: '14px' }}>Founder&apos;s Back Office</span>
          </div>
        </div>

        {/* Main Content — the REAL live hero copy (page.tsx: "Track your money. /
            Plan your time. / Live smarter."), replacing the stale "Plan your trips.
            Find your people." (FOUNDERS-POSITIONING-AND-OG-TRUTH).
            HOME-LINES-01, 2026-11-08: the live hero's words, COMPANY_LINE (src/lib/brandLines.ts); the third wears the wash #eae7f2 (src/app/globals.css :39) — the hero's own third-line colour until HERO-CREST-01, 2026-11-11, when the hero's turned gold; this preview is unchanged. */}
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'center' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <span style={{ color: 'white', fontSize: '52px', fontWeight: '300' }}>
              {COMPANY_LINE[0]}
            </span>
            <span style={{ color: 'white', fontSize: '52px', fontWeight: '300' }}>
              {COMPANY_LINE[1]}
            </span>
            <span style={{ color: '#eae7f2', fontSize: '52px', fontWeight: '300' }}>
              {COMPANY_LINE[2]}
            </span>
          </div>
        </div>

        {/* Footer Stats — ONLY what is true: nine modules (the nine homepage tabs,
            ModuleLauncher TABS) and Plaid bank sync. The old "12 Modules", "IRS
            Compliant", and "AI Powered" badges were false/overclaims — removed.
            HOME-LINES-01, 2026-11-08: the "9 / Modules" stat left — the app has six tabs (src/components/home/ModuleLauncher.tsx TABS), and a count typed into an image drifts unseen; Plaid bank sync stays (src/lib/toolRegistry.ts Banking). */}
        <div style={{ display: 'flex', gap: '50px', marginTop: '20px' }}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ color: 'white', fontSize: '28px', fontWeight: 'bold' }}>Plaid</span>
            <span style={{ color: '#6b7280', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px' }}>Bank Sync</span>
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
