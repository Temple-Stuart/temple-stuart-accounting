import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'Temple Stuart - Personal Back Office';
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
          padding: '60px',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '40px' }}>
          <div
            style={{
              width: '80px',
              height: '80px',
              backgroundColor: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: '24px',
            }}
          >
            <span style={{ color: '#2d1b4e', fontWeight: 'bold', fontSize: '36px' }}>TS</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ color: 'white', fontSize: '32px', fontWeight: '600' }}>Temple Stuart</span>
            <span style={{ color: '#9ca3af', fontSize: '18px' }}>Personal Back Office</span>
          </div>
        </div>

        {/* Main Content */}
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'center' }}>
          <h1
            style={{
              color: 'white',
              fontSize: '64px',
              fontWeight: '300',
              lineHeight: 1.2,
              margin: 0,
              marginBottom: '24px',
            }}
          >
            Track your money.
            <br />
            Plan your trips.
            <br />
            <span style={{ color: '#9ca3af' }}>Find your people.</span>
          </h1>
        </div>

        {/* Footer Stats */}
        <div style={{ display: 'flex', gap: '60px' }}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ color: 'white', fontSize: '36px', fontWeight: 'bold' }}>12</span>
            <span style={{ color: '#6b7280', fontSize: '14px', textTransform: 'uppercase', letterSpacing: '2px' }}>Modules</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ color: 'white', fontSize: '36px', fontWeight: 'bold' }}>Plaid</span>
            <span style={{ color: '#6b7280', fontSize: '14px', textTransform: 'uppercase', letterSpacing: '2px' }}>Bank Sync</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ color: 'white', fontSize: '36px', fontWeight: 'bold' }}>IRS</span>
            <span style={{ color: '#6b7280', fontSize: '14px', textTransform: 'uppercase', letterSpacing: '2px' }}>Compliant</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ color: 'white', fontSize: '36px', fontWeight: 'bold' }}>AI</span>
            <span style={{ color: '#6b7280', fontSize: '14px', textTransform: 'uppercase', letterSpacing: '2px' }}>Powered</span>
          </div>
        </div>

        {/* Press mention */}
        <div style={{ display: 'flex', marginTop: '40px', alignItems: 'center' }}>
          <span style={{ color: '#6b7280', fontSize: '14px', marginRight: '12px' }}>Featured in</span>
          <span style={{ color: '#9ca3af', fontSize: '18px', fontStyle: 'italic' }}>The New York Times</span>
        </div>
      </div>
    ),
    { ...size }
  );
}
