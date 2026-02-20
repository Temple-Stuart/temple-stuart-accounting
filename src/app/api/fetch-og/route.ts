import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth-helpers';

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { url } = await request.json();
    
    if (!url) {
      return NextResponse.json({ error: 'URL required' }, { status: 400 });
    }

    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; TripPlanner/1.0)'
      }
    });
    
    if (!res.ok) {
      return NextResponse.json({ error: 'Could not fetch URL' }, { status: 400 });
    }

    const html = await res.text();
    
    const getMetaContent = (property: string): string | null => {
      const regex = new RegExp(`<meta[^>]*property=["']${property}["'][^>]*content=["']([^"']*)["']`, 'i');
      const altRegex = new RegExp(`<meta[^>]*content=["']([^"']*)["'][^>]*property=["']${property}["']`, 'i');
      const match = html.match(regex) || html.match(altRegex);
      return match ? match[1] : null;
    };

    const getMetaName = (name: string): string | null => {
      const regex = new RegExp(`<meta[^>]*name=["']${name}["'][^>]*content=["']([^"']*)["']`, 'i');
      const altRegex = new RegExp(`<meta[^>]*content=["']([^"']*)["'][^>]*name=["']${name}["']`, 'i');
      const match = html.match(regex) || html.match(altRegex);
      return match ? match[1] : null;
    };

    let title = getMetaContent('og:title');
    if (!title) {
      const titleMatch = html.match(/<title>([^<]*)<\/title>/i);
      title = titleMatch ? titleMatch[1] : null;
    }

    const image = getMetaContent('og:image');
    const description = getMetaContent('og:description') || getMetaName('description');

    let price: string | null = null;
    const airbnbPrice = html.match(/\$(\d+)\s*(?:\/\s*night|per night)/i);
    if (airbnbPrice) {
      price = '$' + airbnbPrice[1] + '/night';
    }
    const bookingPrice = html.match(/(?:US\$|USD\s*|\$)(\d+)/i);
    if (!price && bookingPrice) {
      price = '$' + bookingPrice[1] + '/night';
    }

    const siteName = getMetaContent('og:site_name');

    return NextResponse.json({
      title: title?.substring(0, 200) || 'Unknown',
      image,
      description: description?.substring(0, 300),
      price,
      siteName,
      url
    });

  } catch (err) {
    console.error('OG fetch error:', err);
    return NextResponse.json({ error: 'Failed to fetch URL metadata' }, { status: 500 });
  }
}
