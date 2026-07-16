import { ImageResponse } from 'next/og';

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
            Plan your life. / Act smarter."), replacing the stale "Plan your trips.
            Find your people." (FOUNDERS-POSITIONING-AND-OG-TRUTH). */}
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'center' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <span style={{ color: 'white', fontSize: '52px', fontWeight: '300' }}>
              Track your money.
            </span>
            <span style={{ color: 'white', fontSize: '52px', fontWeight: '300' }}>
              Plan your life.
            </span>
            <span style={{ color: '#9ca3af', fontSize: '52px', fontWeight: '300' }}>
              Act smarter.
            </span>
          </div>
        </div>

        {/* Footer Stats — ONLY what is true: nine modules (the nine homepage tabs,
            ModuleLauncher TABS) and Plaid bank sync. The old "12 Modules", "IRS
            Compliant", and "AI Powered" badges were false/overclaims — removed. */}
        <div style={{ display: 'flex', gap: '50px', marginTop: '20px' }}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ color: 'white', fontSize: '28px', fontWeight: 'bold' }}>9</span>
            <span style={{ color: '#6b7280', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px' }}>Modules</span>
          </div>
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
