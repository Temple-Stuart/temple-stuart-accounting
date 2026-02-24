import { NextRequest, NextResponse } from 'next/server';
import { getVerifiedEmail } from '@/lib/cookie-auth';

export async function GET(req: NextRequest) {
  const userEmail = await getVerifiedEmail();
  if (!userEmail) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const destination = req.nextUrl.searchParams.get('destination');
  if (!destination) {
    return NextResponse.json({ error: 'destination required' }, { status: 400 });
  }

  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'Google API not configured' }, { status: 500 });
  }

  try {
    // Step 1: Text Search to get a fresh photo_reference
    const searchUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(destination)}&key=${apiKey}`;
    const searchRes = await fetch(searchUrl);
    const searchData = await searchRes.json();

    const photoRef = searchData.results?.[0]?.photos?.[0]?.photo_reference;
    if (!photoRef) {
      return NextResponse.json({ error: 'No photo found' }, { status: 404 });
    }

    // Step 2: Fetch actual image bytes (API key stays server-side)
    const photoUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photo_reference=${photoRef}&key=${apiKey}`;
    const photoRes = await fetch(photoUrl);

    if (!photoRes.ok) {
      return NextResponse.json({ error: 'Photo fetch failed' }, { status: 502 });
    }

    const imageBuffer = await photoRes.arrayBuffer();
    const contentType = photoRes.headers.get('content-type') || 'image/jpeg';

    return new NextResponse(imageBuffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=604800, stale-while-revalidate=86400',
      },
    });
  } catch (error) {
    console.error('[places/photo] Error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
