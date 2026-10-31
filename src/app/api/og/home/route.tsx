import { ImageResponse } from 'next/og';

export const runtime = 'edge';

export async function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: '#f9fafb',
          padding: '60px',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '40px' }}>
          <div
            style={{
              width: '64px',
              height: '64px',
              background: 'linear-gradient(135deg, #b4b237 0%, #8f8c2a 100%)',
              borderRadius: '16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: '20px',
            }}
          >
            <span style={{ color: 'white', fontSize: '28px', fontWeight: 'bold' }}>TS</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '32px', fontWeight: 'bold', color: '#111827' }}>Temple Stuart</span>
            <span style={{ fontSize: '18px', color: '#6b7280' }}>Founder&apos;s Back Office</span>
          </div>
        </div>

        {/* Module Cards Preview */}
        <div style={{ display: 'flex', gap: '24px', flex: 1 }}>
          {[
            { icon: '📒', name: 'Bookkeeping', num: '01', color: '#22c55e' },
            { icon: '✈️', name: 'Trips & Agenda', num: '02', color: '#3b82f6' },
            { icon: '📊', name: 'Budget Review', num: '03', color: '#a855f7' },
          ].map((module) => (
            <div
              key={module.name}
              style={{
                flex: 1,
                backgroundColor: 'white',
                borderRadius: '16px',
                padding: '32px',
                display: 'flex',
                flexDirection: 'column',
                border: '1px solid #e5e7eb',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
                <span style={{ fontSize: '48px' }}>{module.icon}</span>
                <span
                  style={{
                    backgroundColor: module.color,
                    color: 'white',
                    padding: '4px 12px',
                    borderRadius: '20px',
                    fontSize: '14px',
                    fontWeight: 'bold',
                    height: 'fit-content',
                  }}
                >
                  {module.num}
                </span>
              </div>
              <span style={{ fontSize: '24px', fontWeight: 'bold', color: '#111827' }}>{module.name}</span>
            </div>
          ))}
        </div>

        {/* Tagline */}
        <div style={{ marginTop: '40px', textAlign: 'center', display: 'flex', justifyContent: 'center' }}>
          <span style={{ fontSize: '24px', color: '#6b7280' }}>
            Track your money. Plan your time. Live smarter.
          </span>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  );
}
