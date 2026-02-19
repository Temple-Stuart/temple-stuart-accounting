import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword) {
    return NextResponse.json({ error: 'Admin access is not configured' }, { status: 403 });
  }

  const { password } = await request.json();

  if (password === adminPassword) {
    return NextResponse.json({ success: true });
  } else {
    return NextResponse.json({ error: 'Invalid password' }, { status: 401 });
  }
}
