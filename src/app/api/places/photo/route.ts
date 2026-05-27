import { NextRequest, NextResponse } from 'next/server';
import { getVerifiedEmail } from '@/lib/cookie-auth';
import { googleFetch, GooglePlacesQuotaError } from '@/lib/googlePlacesQuota';

// Server-side Google Places photo proxy. Two modes:
//   ?ref=<photo_reference>   — proxy a single place photo (POI cards, lazy).
//   ?destination=<query>     — hero photo for a destination (text search first).
// The API key stays server-side, every call is quota-guarded, and responses are
// cached for 7 days so the same photo is not re-billed on every render.
// COMPLIANCE: Google Places data is never sent to any AI/LLM.

const PHOTO_CACHE = 'public, max-age=604800, stale-while-revalidate=86400';

export async function GET(req: NextRequest) {
  const userEmail = await getVerifiedEmail();
  if (!userEmail) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'Google API not configured' }, { status: 500 });
  }

  const ref = req.nextUrl.searchParams.get('ref');
  const destination = req.nextUrl.searchParams.get('destination');
  if (!ref && !destination) {
    return NextResponse.json({ error: 'ref or destination required' }, { status: 400 });
  }

  try {
    let photoRef = ref;

    // Hero mode: resolve a fresh photo_reference for the destination first.
    if (!photoRef && destination) {
      const searchUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(destination)}&key=${apiKey}`;
      const searchRes = await googleFetch(searchUrl);
      const searchData = await searchRes.json();
      photoRef = searchData.results?.[0]?.photos?.[0]?.photo_reference || null;
      if (!photoRef) {
        return NextResponse.json({ error: 'No photo found' }, { status: 404 });
      }
    }

    const maxwidth = destination ? 800 : 400;
    const photoUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=${maxwidth}&photo_reference=${encodeURIComponent(photoRef!)}&key=${apiKey}`;
    const photoRes = await googleFetch(photoUrl);

    if (!photoRes.ok) {
      return NextResponse.json({ error: 'Photo fetch failed' }, { status: 502 });
    }

    const imageBuffer = await photoRes.arrayBuffer();
    const contentType = photoRes.headers.get('content-type') || 'image/jpeg';

    return new NextResponse(imageBuffer, {
      headers: { 'Content-Type': contentType, 'Cache-Control': PHOTO_CACHE },
    });
  } catch (error) {
    if (error instanceof GooglePlacesQuotaError) {
      return NextResponse.json(
        { error: 'Google Places monthly quota exceeded — bill protection active' },
        { status: 429 }
      );
    }
    console.error('[places/photo] Error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
