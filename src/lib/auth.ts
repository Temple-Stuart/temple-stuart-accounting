import { NextRequest } from 'next/server';
import jwt from 'jsonwebtoken';

if (!process.env.JWT_SECRET) {
  throw new Error('FATAL: JWT_SECRET environment variable is not set');
}
const JWT_SECRET = process.env.JWT_SECRET;

export interface UserPayload {
  userId: string;
  email?: string;
}

export async function verifyAuth(request: NextRequest): Promise<string | null> {
  try {
    // Check for auth token in cookies
    const token = request.cookies.get('auth-token')?.value;
    
    if (!token) {
      console.log('No auth token found in cookies');
      // For development, create a default user ID
      if (process.env.NODE_ENV === 'development') {
        return 'default-dev-user';
      }
      return null;
    }

    // Verify JWT token
    const decoded = jwt.verify(token, JWT_SECRET) as UserPayload;
    
    if (!decoded.userId) {
      console.log('Invalid token payload');
      return null;
    }

    return decoded.userId;
  } catch (error) {
    console.error('Auth verification failed:', error);
    // For development, return a default user ID
    if (process.env.NODE_ENV === 'development') {
      return 'default-dev-user';
    }
    return null;
  }
}

export function createAuthToken(userId: string, email?: string): string {
  return jwt.sign(
    { userId, email } as UserPayload,
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

export function setAuthCookie(token: string) {
  return {
    'Set-Cookie': `auth-token=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${7 * 24 * 60 * 60}; ${
      process.env.NODE_ENV === 'production' ? 'Secure;' : ''
    }`
  };
}
