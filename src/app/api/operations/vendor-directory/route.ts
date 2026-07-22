import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getVerifiedEmail } from '@/lib/cookie-auth';

// GET /api/operations/vendor-directory — DIM-3: the minimal USER-SCOPED vendor
// list feeding the commit-time vendor picker. The DIM-3 audit found NO existing
// route over operations_vendor_directory; per the ruling a minimal list GET is
// in scope, full vendor CRUD is not. Read-only, active vendors only, standard
// auth chain (mirrors the commit route's own bar: verified email → user →
// user-scoped query). Cheap DB read — no rate limit needed (authed non-paid
// read convention).
export async function GET() {
  try {
    const userEmail = await getVerifiedEmail();
    if (!userEmail) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const user = await prisma.users.findFirst({
      where: { email: { equals: userEmail, mode: 'insensitive' } },
      select: { id: true },
    });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const vendors = await prisma.operations_vendor_directory.findMany({
      where: { user_id: user.id, is_active: true },
      orderBy: { vendor_name: 'asc' },
      select: { id: true, vendor_name: true, entity_id: true, category: true },
    });

    return NextResponse.json({ vendors });
  } catch (error) {
    console.error('Vendor directory fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch vendors' }, { status: 500 });
  }
}
