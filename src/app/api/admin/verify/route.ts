import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { signCookie } from '@/lib/cookie-auth';

export async function POST(request: Request) {
  const adminPasswordHash = process.env.ADMIN_PASSWORD;
  if (!adminPasswordHash) {
    return NextResponse.json({ error: 'Admin access is not configured' }, { status: 403 });
  }

  const { password } = await request.json();

  if (!password || typeof password !== 'string') {
    return NextResponse.json({ error: 'Invalid password' }, { status: 401 });
  }

  const isValid = await bcrypt.compare(password, adminPasswordHash);

  if (isValid) {
    const response = NextResponse.json({ success: true });
    response.cookies.set('adminSession', signCookie('admin-session'), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 4, // 4 hours
    });
    return response;
  } else {
    return NextResponse.json({ error: 'Invalid password' }, { status: 401 });
  }
}

export async function DELETE() {
  const response = NextResponse.json({ success: true });
  response.cookies.set('adminSession', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
  return response;
}
