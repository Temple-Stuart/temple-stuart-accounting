import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const user = await prisma.users.findFirst({
      where: { email: 'Astuart@templestuart.com' }
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' });
    }

    const testPassword = 'test';
    const isValid = await bcrypt.compare(testPassword, user.password);

    return NextResponse.json({
      userFound: true,
      email: user.email,
      passwordMatches: isValid,
      hashStart: user.password.substring(0, 10)
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message });
  }
}
