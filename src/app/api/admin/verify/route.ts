import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';

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
    return NextResponse.json({ success: true });
  } else {
    return NextResponse.json({ error: 'Invalid password' }, { status: 401 });
  }
}
