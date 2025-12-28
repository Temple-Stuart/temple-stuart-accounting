import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';

export const runtime = 'edge';

const MONTHS = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const ACTIVITY_ICONS: Record<string, string> = {
  surf: '🏄', kitesurf: '🪁', sail: '⛵', snowboard: '🏂', mtb: '🚵',
  hike: '🏕️', climb: '🧗', golf: '⛳', bike: '🚴', run: '🏃',
  triathlon: '🏊', skate: '🛹', festival: '🎪', conference: '🎤', nomad: '💼',
};

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const name = searchParams.get('name') || 'Trip Invitation';
  const destination = searchParams.get('destination') || '';
  const activity = searchParams.get('activity') || '';
  const month = searchParams.get('month') || '';
  const year = searchParams.get('year') || '';
  const owner = searchParams.get('owner') || '';

  const activityIcon = ACTIVITY_ICONS[activity] || '✈️';
  const monthName = month ? MONTHS[parseInt(month)] : '';

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
        }}
      >
        <div style={{ fontSize: 120, marginBottom: 20 }}>{activityIcon}</div>
        <div style={{ fontSize: 56, fontWeight: 'bold', color: 'white', textAlign: 'center', maxWidth: '80%' }}>
          {name}
        </div>
        {destination && (
          <div style={{ fontSize: 32, color: '#b4b237', marginTop: 16 }}>
            📍 {destination}
          </div>
        )}
        <div style={{ fontSize: 28, color: 'rgba(255,255,255,0.7)', marginTop: 16 }}>
          {monthName} {year} {owner && `• Hosted by ${owner}`}
        </div>
        <div style={{ position: 'absolute', bottom: 30, fontSize: 20, color: 'rgba(255,255,255,0.5)' }}>
          Temple Stuart • Group Travel Planning
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
