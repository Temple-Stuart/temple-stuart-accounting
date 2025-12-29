import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();
    console.log('[LOGIN] Attempt for:', email);

    if (!email || !password) {
      console.log('[LOGIN] Missing email or password');
      return NextResponse.json(
        { error: 'Missing email or password' },
        { status: 400 }
      );
    }

    const user = await prisma.users.findFirst({
      where: { 
        email: { equals: email, mode: 'insensitive' }
      }
    });

    console.log('[LOGIN] User found:', user?.email, 'ID:', user?.id);

    if (!user) {
      console.log('[LOGIN] No user found for email:', email);
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    const isValid = await bcrypt.compare(password, user.password);
    console.log('[LOGIN] Password valid:', isValid);
    
    if (!isValid) {
      console.log('[LOGIN] Invalid password for:', email);
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    // Create response with cookie set via headers (more reliable on Vercel)
    const response = NextResponse.json({ 
      success: true,
      user: { email: user.email, name: user.name }
    });

    response.cookies.set('userEmail', user.email, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
    });

    console.log('[LOGIN] Cookie set for:', user.email);
    return response;
  } catch (error) {
    console.error('[LOGIN] Error:', error);
    return NextResponse.json(
      { error: 'Failed to login' },
      { status: 500 }
    );
  }
}
